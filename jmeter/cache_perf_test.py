"""
多级缓存性能对比测试脚本（简单版）
==================================
测试目标接口: POST /api/picture/list/page/vo（公共图库首页）

测试方式: 单请求串行（并发=1），每次请求前精确控制缓存状态，
          排除并发排队干扰，直接测量三层路径的真实延迟：

  场景 A（无缓存）:   每次请求前清除 L1+L2  → 请求必走数据库
  场景 B（L2 命中）:  每次请求前仅清除 L1   → 请求必走 Redis L2
  场景 C（L1 命中）:  不清除（预热后连续请求）→ 请求必走 Caffeine L1

使用方法:
  python cache_perf_test.py [--iterations 30] [--base-url http://localhost:8123/api]

依赖:
  pip install aiohttp
  或使用项目 agent 虚拟环境: agent/.venv/Scripts/python.exe cache_perf_test.py
"""
import argparse
import asyncio
import json
import statistics
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Tuple

import aiohttp

# ==================== 默认配置 ====================
DEFAULT_BASE_URL = "http://localhost:8123/api"
DEFAULT_ADMIN_ACCOUNT = "nina1024"
DEFAULT_ADMIN_PASSWORD = "Nina1024"
DEFAULT_ITERATIONS = 30  # 每场景串行请求次数
DEFAULT_QUERY_PAYLOAD = {"current": 1, "pageSize": 20, "spaceId": None}

# 输出目录（与脚本同级）
OUTPUT_DIR = Path(__file__).parent / "cache_test_results"


# ==================== 数据结构 ====================
@dataclass
class ScenarioResult:
    name: str
    mode: str              # 测试模式：单请求串行
    iterations: int        # 迭代次数
    success: int
    failed: int
    qps: float             # 单连接串行 QPS = 1000 / 平均延迟
    avg_latency_ms: float
    p50_ms: float
    p95_ms: float
    p99_ms: float
    min_ms: float
    max_ms: float
    duration_s: float
    cache_stats_before: dict


# ==================== 测试器 ====================
class CachePerfTester:
    def __init__(self, base_url: str, account: str, password: str,
                 iterations: int, payload: dict):
        self.base_url = base_url.rstrip("/")
        self.account = account
        self.password = password
        self.iterations = iterations
        self.payload = payload
        self.session: aiohttp.ClientSession = None

    # ---------- 缓存控制 ----------
    async def login(self):
        """登录管理员账号，获取 Sa-Token cookie"""
        async with self.session.post(
            f"{self.base_url}/user/login",
            json={"userAccount": self.account, "userPassword": self.password}
        ) as resp:
            data = await resp.json()
            if data.get("code") != 0:
                raise RuntimeError(f"登录失败: {data}")
            print(f"[登录] 管理员 {self.account} 登录成功")

    async def clear_all_cache(self):
        """清除 L1 + L2"""
        async with self.session.post(f"{self.base_url}/picture/cache/clear-all") as resp:
            data = await resp.json()
            if data.get("code") != 0:
                raise RuntimeError(f"清除 L1+L2 失败: {data}")

    async def clear_local_cache(self):
        """仅清除 L1（Caffeine），保留 L2（Redis）"""
        async with self.session.post(f"{self.base_url}/picture/cache/clear-local") as resp:
            data = await resp.json()
            if data.get("code") != 0:
                raise RuntimeError(f"清除 L1 失败: {data}")

    async def get_cache_stats(self) -> dict:
        """查询当前缓存状态"""
        async with self.session.get(f"{self.base_url}/picture/cache/stats") as resp:
            data = await resp.json()
            stats = data.get("data", {})
            print(f"  [缓存状态] L1={stats.get('l1Size', 0)}, "
                  f"L2(listPageVo)={stats.get('l2ListPageVoKeys', 0)}")
            return stats

    async def warmup(self, rounds: int = 2):
        """预热：让 L1+L2 填充数据"""
        for _ in range(rounds):
            await self.single_request()

    # ---------- 单次请求 ----------
    async def single_request(self) -> Tuple[float, bool]:
        """发送单次查询请求，返回 (延迟ms, 是否成功)"""
        start = time.perf_counter()
        try:
            async with self.session.post(
                f"{self.base_url}/picture/list/page/vo",
                json=self.payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                data = await resp.json()
                elapsed_ms = (time.perf_counter() - start) * 1000
                return elapsed_ms, data.get("code") == 0
        except Exception:
            elapsed_ms = (time.perf_counter() - start) * 1000
            return elapsed_ms, False

    # ---------- 场景执行 ----------
    async def run_scenario(self, name: str, before_each, warmup_rounds: int = 0) -> ScenarioResult:
        """
        串行执行 iterations 次单请求。
        before_each: 每次请求前执行的缓存控制协程函数（可为 None）
        """
        print(f"\n场景 {name}：{self.iterations} 次串行请求 ...")
        if warmup_rounds:
            await self.warmup(warmup_rounds)
        stats_before = await self.get_cache_stats()

        latencies: List[float] = []
        failed = 0
        start_ts = time.perf_counter()
        for i in range(self.iterations):
            if before_each is not None:
                await before_each()
            latency_ms, success = await self.single_request()
            if success:
                latencies.append(latency_ms)
                print(f"  [{i + 1:>2}/{self.iterations}] {latency_ms:8.2f} ms")
            else:
                failed += 1
                print(f"  [{i + 1:>2}/{self.iterations}] 请求失败")
        duration = time.perf_counter() - start_ts

        result = self.calc_stats(name, latencies, failed, duration, stats_before)
        self.save_latencies(name, latencies)
        return result

    async def scenario_a_db(self) -> ScenarioResult:
        """场景 A：无缓存，每次请求前清除 L1+L2 → 必走数据库"""
        return await self.run_scenario("A-无缓存查DB", self.clear_all_cache)

    async def scenario_b_l2(self) -> ScenarioResult:
        """场景 B：L2 命中，每次请求前仅清除 L1 → 必走 Redis"""
        return await self.run_scenario("B-Redis L2命中", self.clear_local_cache, warmup_rounds=2)

    async def scenario_c_l1(self) -> ScenarioResult:
        """场景 C：L1 命中，预热后连续请求 → 必走 Caffeine"""
        return await self.run_scenario("C-Caffeine L1命中", None, warmup_rounds=2)

    # ---------- 统计 ----------
    def calc_stats(self, name: str, latencies: List[float], failed: int,
                   duration: float, stats_before: dict) -> ScenarioResult:
        if not latencies:
            return ScenarioResult(name, "单请求串行", self.iterations, 0, failed,
                                  0, 0, 0, 0, 0, 0, 0, duration, stats_before)
        sorted_lat = sorted(latencies)
        n = len(sorted_lat)
        avg = statistics.mean(sorted_lat)

        def percentile(p):
            return round(sorted_lat[min(int(n * p), n - 1)], 2)

        return ScenarioResult(
            name=name,
            mode="单请求串行",
            iterations=self.iterations,
            success=n,
            failed=failed,
            qps=round(1000 / avg, 2) if avg > 0 else 0,  # 单连接串行 QPS
            avg_latency_ms=round(avg, 2),
            p50_ms=percentile(0.50),
            p95_ms=percentile(0.95),
            p99_ms=percentile(0.99),
            min_ms=round(sorted_lat[0], 2),
            max_ms=round(sorted_lat[-1], 2),
            duration_s=round(duration, 2),
            cache_stats_before=stats_before
        )

    def save_latencies(self, name: str, latencies: List[float]):
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        key = name.split("-")[0]
        file = OUTPUT_DIR / f"{key}_latencies.json"
        with open(file, "w", encoding="utf-8") as f:
            json.dump(latencies, f)

    # ---------- 对比输出 ----------
    def print_comparison(self, results: List[ScenarioResult]):
        print("\n" + "=" * 90)
        print("多级缓存性能对比结果（单请求串行）")
        print("=" * 90)
        print(f"{'场景':<20} {'次数':>4} {'平均(ms)':>10} {'P50':>8} {'P95':>8} "
              f"{'Min':>8} {'Max':>8} {'串行QPS':>9}")
        print("-" * 90)
        for r in results:
            print(f"{r.name:<20} {r.iterations:>4} {r.avg_latency_ms:>10.2f} {r.p50_ms:>8.2f} "
                  f"{r.p95_ms:>8.2f} {r.min_ms:>8.2f} {r.max_ms:>8.2f} {r.qps:>9.2f}")

        db = next((r for r in results if r.name.startswith("A")), None)
        if db and db.avg_latency_ms > 0:
            print("\n引入缓存后的性能提升（相对无缓存查 DB）:")
            for r in results:
                if r.name.startswith("A"):
                    continue
                speedup = db.avg_latency_ms / r.avg_latency_ms if r.avg_latency_ms > 0 else 0
                print(f"  {r.name}: {db.avg_latency_ms:.2f}ms -> {r.avg_latency_ms:.2f}ms, "
                      f"提升 {speedup:.2f}x")

    # ---------- 主流程 ----------
    async def run_all(self) -> List[ScenarioResult]:
        connector = aiohttp.TCPConnector(limit=10)
        async with aiohttp.ClientSession(connector=connector,
                                         cookie_jar=aiohttp.CookieJar()) as session:
            self.session = session
            await self.login()

            results = [
                await self.scenario_a_db(),
                await self.scenario_b_l2(),
                await self.scenario_c_l1(),
            ]

            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            summary_file = OUTPUT_DIR / "summary.json"
            with open(summary_file, "w", encoding="utf-8") as f:
                json.dump([asdict(r) for r in results], f, ensure_ascii=False, indent=2)
            print(f"\n[汇总] 保存到 {summary_file}")

            self.print_comparison(results)

            try:
                from cache_report_generator import generate_report
                generate_report([asdict(r) for r in results], OUTPUT_DIR / "cache_report.md")
            except Exception as e:
                print(f"[警告] 自动生成报告失败: {e}，请手动运行 cache_report_generator.py")

            return results


# ==================== CLI ====================
def parse_args():
    parser = argparse.ArgumentParser(description="多级缓存性能对比测试（简单版）")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="后端 API 基础 URL")
    parser.add_argument("--account", default=DEFAULT_ADMIN_ACCOUNT, help="管理员账号")
    parser.add_argument("--password", default=DEFAULT_ADMIN_PASSWORD, help="管理员密码")
    parser.add_argument("--iterations", type=int, default=DEFAULT_ITERATIONS,
                        help="每场景串行请求次数（默认 30）")
    parser.add_argument("--page", type=int, default=1, help="查询页码")
    parser.add_argument("--page-size", type=int, default=20, help="每页条数")
    return parser.parse_args()


async def main():
    args = parse_args()
    payload = {"current": args.page, "pageSize": args.page_size, "spaceId": None}
    print(f"配置: base_url={args.base_url}, iterations={args.iterations}, payload={payload}")

    tester = CachePerfTester(
        base_url=args.base_url,
        account=args.account,
        password=args.password,
        iterations=args.iterations,
        payload=payload
    )
    await tester.run_all()


if __name__ == "__main__":
    asyncio.run(main())
