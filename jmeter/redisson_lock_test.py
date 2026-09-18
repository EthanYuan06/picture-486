"""
Redisson 分布式锁并发正确性测试
================================
测试目标接口: POST /api/space/add （创建私人相册，普通用户上限 5 个）

被测逻辑（SpaceApplicationServiceImpl.addSpace）:
  lockKey = "lock:space:create:{userId}"
  lock.tryLock(3s 等待, 5s 租约)
    -> 锁内: 统计该用户私人相册数量, >=5 则拒绝
    -> 事务: 保存相册
  finally: 释放锁

验证点:
  1. 【互斥正确性 / 防超卖】对同一普通用户并发发起 N 个创建请求,
     成功创建数量必须 <= 5。若无分布式锁, "先查后插" 的竞态会导致
     多个请求同时读到 count<5 从而都创建成功 => 超卖(>5)。
  2. 【锁行为分布】统计: 达上限被拒 / 抢锁超时(3s)被拒 / 其它错误。
  3. 【DB 交叉核对】查询该用户实际私人相册数, 应 == 成功数且 <= 5。
  4. 【吞吐/延迟】并发创建的耗时分布。

流程: 注册全新普通用户 -> 登录 -> 屏障同步 N 路并发创建 -> 分类统计 -> 交叉核对

用法:
  python redisson_lock_test.py [--concurrency 30] [--base-url http://localhost:8123/api]

依赖:
  pip install aiohttp
  或使用项目 agent 虚拟环境: agent/.venv/Scripts/python.exe redisson_lock_test.py
"""
import argparse
import asyncio
import json
import random
import statistics
import time
from pathlib import Path
from typing import List, Tuple

import aiohttp

# ==================== 默认配置 ====================
DEFAULT_BASE_URL = "http://localhost:8123/api"
DEFAULT_CONCURRENCY = 30          # 并发创建请求数（远大于 5，制造锁竞争）
MAX_PRIVATE_SPACE = 5             # 业务规则：普通用户私人相册上限
TEST_PASSWORD = "Lock1234"        # 满足：>=8位 + 大小写 + 数字

OUTPUT_DIR = Path(__file__).parent / "lock_test_results"


# ==================== 测试器 ====================
class RedissonLockTester:
    def __init__(self, base_url: str, concurrency: int):
        self.base_url = base_url.rstrip("/")
        self.concurrency = concurrency
        self.session: aiohttp.ClientSession = None
        self.account: str = None
        self.user_id: int = None

    # ---------- 1. 注册全新普通用户 ----------
    async def register_user(self) -> int:
        """注册一个唯一账号的普通用户（非管理员），返回 userId"""
        for attempt in range(5):
            # 账号规则: 4-20位, 字母开头, 同时含字母和数字, 无特殊字符
            account = f"locktest{random.randint(1000, 9999)}{attempt if attempt else ''}"
            payload = {
                "userAccount": account,
                "userEmail": f"{account}@test.com",
                "userPassword": TEST_PASSWORD,
                "checkPassword": TEST_PASSWORD,
            }
            async with self.session.post(f"{self.base_url}/user/register", json=payload) as resp:
                data = await resp.json()
            if data.get("code") == 0:
                self.account = account
                uid = data.get("data")
                print(f"[注册] 普通用户 {account} 注册成功, userId={uid}")
                return uid
            # 账号冲突等，重试
            print(f"[注册] {account} 失败({data.get('message')}), 重试...")
        raise RuntimeError("注册测试用户失败（多次重试）")

    # ---------- 2. 登录 ----------
    async def login(self):
        async with self.session.post(
            f"{self.base_url}/user/login",
            json={"userAccount": self.account, "userPassword": TEST_PASSWORD}
        ) as resp:
            data = await resp.json()
            if data.get("code") != 0:
                raise RuntimeError(f"登录失败: {data}")
            self.user_id = int(data["data"]["id"])
            print(f"[登录] {self.account} 登录成功, userId={self.user_id}")

    # ---------- 3. 屏障同步并发创建 ----------
    async def concurrent_create(self) -> List[Tuple[float, dict]]:
        """N 路并发创建私人相册，用 Event 屏障保证尽可能同时发起"""
        url = f"{self.base_url}/space/add"
        payload = {"spaceName": "并发压测相册", "spaceLevel": 0, "spaceType": 0}
        start_gate = asyncio.Event()

        async def worker(idx: int) -> Tuple[float, dict]:
            await start_gate.wait()
            t0 = time.perf_counter()
            try:
                async with self.session.post(url, json=payload,
                                             timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    data = await resp.json()
            except Exception as e:
                data = {"code": -1, "message": f"EXC:{e!r}"}
            return (time.perf_counter() - t0) * 1000, data

        tasks = [asyncio.create_task(worker(i)) for i in range(self.concurrency)]
        await asyncio.sleep(0.2)   # 等所有 worker 抵达屏障
        wall_start = time.perf_counter()
        start_gate.set()           # 同时放行
        results = await asyncio.gather(*tasks)
        self.wall_time = (time.perf_counter() - wall_start) * 1000
        return results

    # ---------- 4. 结果分类 ----------
    def classify(self, results: List[Tuple[float, dict]]) -> dict:
        success, limit_rejected, lock_timeout, other = 0, 0, 0, 0
        other_msgs = {}
        latencies_success: List[float] = []
        latencies_all: List[float] = []
        for latency, data in results:
            latencies_all.append(latency)
            code = data.get("code")
            msg = data.get("message", "") or ""
            if code == 0:
                success += 1
                latencies_success.append(latency)
            elif "仅允许创建5个" in msg or "仅允许创建" in msg:
                limit_rejected += 1
            elif "操作频繁" in msg:
                lock_timeout += 1
            else:
                other += 1
                other_msgs[msg] = other_msgs.get(msg, 0) + 1
        return {
            "concurrency": self.concurrency,
            "success": success,
            "limit_rejected": limit_rejected,
            "lock_timeout": lock_timeout,
            "other": other,
            "other_msgs": other_msgs,
            "wall_time_ms": round(self.wall_time, 2),
            "latencies_all": latencies_all,
            "latencies_success": latencies_success,
        }

    # ---------- 5. DB 交叉核对 ----------
    async def verify_db_count(self) -> int:
        """查询该用户实际的私人相册数量"""
        payload = {"current": 1, "pageSize": 100, "userId": self.user_id, "spaceType": 0}
        async with self.session.post(f"{self.base_url}/space/list/page/vo", json=payload) as resp:
            data = await resp.json()
        if data.get("code") != 0:
            print(f"[核对] 查询相册列表失败: {data}")
            return -1
        records = data.get("data", {}).get("records", []) or []
        # 客户端再按 userId + spaceType 过滤一次，规避服务端过滤差异
        cnt = sum(1 for r in records
                  if str(r.get("userId")) == str(self.user_id) and r.get("spaceType") == 0)
        return cnt

    # ---------- 主流程 ----------
    async def run(self):
        connector = aiohttp.TCPConnector(limit=0)  # 不限制连接数，保证真并发
        async with aiohttp.ClientSession(connector=connector,
                                         cookie_jar=aiohttp.CookieJar()) as session:
            self.session = session
            await self.register_user()
            await self.login()

            print(f"\n[压测] 对 userId={self.user_id} 并发发起 {self.concurrency} 个"
                  f"「创建私人相册」请求（上限 {MAX_PRIVATE_SPACE} 个）...")
            results = await self.concurrent_create()
            stats = self.classify(results)

            db_count = await self.verify_db_count()

            self.print_report(stats, db_count)
            self.save_summary(stats, db_count)

    # ---------- 报告 ----------
    def print_report(self, s: dict, db_count: int):
        print("\n" + "=" * 78)
        print("Redisson 分布式锁并发正确性测试结果")
        print("=" * 78)
        print(f"并发请求数        : {s['concurrency']}")
        print(f"成功创建(code=0)  : {s['success']}")
        print(f"达上限被拒        : {s['limit_rejected']}   (仅允许创建5个私人相册)")
        print(f"抢锁超时被拒      : {s['lock_timeout']}   (操作频繁, tryLock 3s 未获取)")
        print(f"其它错误          : {s['other']}")
        if s["other_msgs"]:
            for m, c in s["other_msgs"].items():
                print(f"    - [{c}次] {m[:80]}")
        print("-" * 78)
        print(f"并发总墙钟耗时    : {s['wall_time_ms']:.2f} ms")
        print(f"吞吐(成功/秒)     : {s['success'] / (s['wall_time_ms'] / 1000):.2f}")
        if s["latencies_all"]:
            la = sorted(s["latencies_all"])
            print(f"请求延迟(ms)      : avg={statistics.mean(la):.2f} "
                  f"p50={la[len(la)//2]:.2f} min={la[0]:.2f} max={la[-1]:.2f}")
        print("-" * 78)
        print(f"DB 实际私人相册数 : {db_count}")

        # 核心判定
        print("\n【核心判定：是否发生超卖】")
        oversell = s["success"] > MAX_PRIVATE_SPACE
        db_mismatch = db_count >= 0 and db_count != s["success"]
        if not oversell and not db_mismatch and db_count <= MAX_PRIVATE_SPACE:
            print(f"  ✅ PASS：并发 {s['concurrency']} 个请求下，成功创建 {s['success']} 个 (<= {MAX_PRIVATE_SPACE})，"
                  f"DB 实际 {db_count} 个，两者一致。")
            print(f"     分布式锁正确串行化了「先查后插」，未发生超卖。")
        else:
            if oversell:
                print(f"  ❌ FAIL：成功创建 {s['success']} 个 > 上限 {MAX_PRIVATE_SPACE}，发生超卖！")
            if db_mismatch:
                print(f"  ⚠️ 警告：接口成功数({s['success']}) 与 DB 实际数({db_count}) 不一致，请复核。")

    def save_summary(self, s: dict, db_count: int):
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        summary = {
            "base_url": self.base_url,
            "account": self.account,
            "user_id": self.user_id,
            "db_private_space_count": db_count,
            **{k: v for k, v in s.items()
               if k not in ("latencies_all", "latencies_success")},
            "latency_avg_ms": round(statistics.mean(s["latencies_all"]), 2) if s["latencies_all"] else 0,
            "latency_max_ms": round(max(s["latencies_all"]), 2) if s["latencies_all"] else 0,
        }
        f = OUTPUT_DIR / "lock_summary.json"
        with open(f, "w", encoding="utf-8") as fp:
            json.dump(summary, fp, ensure_ascii=False, indent=2)
        print(f"\n[汇总] 已保存 {f}")


# ==================== CLI ====================
def parse_args():
    p = argparse.ArgumentParser(description="Redisson 分布式锁并发正确性测试")
    p.add_argument("--base-url", default=DEFAULT_BASE_URL)
    p.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY,
                   help="并发创建请求数（默认 30，远大于上限 5 以制造锁竞争）")
    return p.parse_args()


async def main():
    args = parse_args()
    print(f"配置: base_url={args.base_url}, concurrency={args.concurrency}")
    tester = RedissonLockTester(args.base_url, args.concurrency)
    await tester.run()


if __name__ == "__main__":
    asyncio.run(main())
