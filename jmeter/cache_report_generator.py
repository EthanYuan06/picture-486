"""
缓存性能测试报告生成器
======================
读取 cache_perf_test.py 生成的 summary.json，输出 Markdown 格式对比报告。

使用方法:
  python cache_report_generator.py [--input cache_test_results/summary.json] [--output cache_test_results/cache_report.md]
"""
import argparse
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any


def load_summary(input_file: Path) -> List[Dict[str, Any]]:
    with open(input_file, "r", encoding="utf-8") as f:
        return json.load(f)


def find_scenario(results: List[Dict], prefix: str) -> Dict:
    for r in results:
        if r["name"].startswith(prefix):
            return r
    return None


def calc_speedup(base: Dict, target: Dict, metric: str) -> float:
    """计算 target 相对 base 的提升倍数"""
    base_val = base.get(metric, 0)
    target_val = target.get(metric, 0)
    if target_val == 0:
        return 0.0
    return round(base_val / target_val, 2)


def generate_report(results: List[Dict], output_file: Path):
    db = find_scenario(results, "A")
    l2 = find_scenario(results, "B")
    l1 = find_scenario(results, "C")

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    lines = []
    lines.append("# 多级缓存性能对比测试报告\n")
    lines.append(f"**生成时间**: {now}\n")
    lines.append(f"**测试接口**: `POST /api/picture/list/page/vo`\n")
    lines.append(f"**查询条件**: `{{current: 1, pageSize: 20, spaceId: null}}`（公共图库首页）\n")

    if db:
        lines.append(f"**测试方式**: {db.get('mode', '单请求串行')}，每场景 {db.get('iterations', 0)} 次请求，"
                     f"每次请求前精确控制缓存状态\n")

    lines.append("\n---\n")

    # ===== 核心对比表 =====
    lines.append("## 1. 核心性能对比\n")
    lines.append("| 场景 | 缓存层级 | 次数 | 平均延迟(ms) | P50(ms) | P95(ms) | Min(ms) | Max(ms) | 串行QPS |")
    lines.append("|------|---------|-----:|------------:|--------:|--------:|--------:|--------:|--------:|")

    scenario_labels = {
        "A": ("A-无缓存查DB", "无缓存（DB）"),
        "B": ("B-Redis L2命中", "Redis L2"),
        "C": ("C-Caffeine L1命中", "Caffeine L1"),
    }
    for prefix, (name, layer) in scenario_labels.items():
        r = find_scenario(results, prefix)
        if r:
            lines.append(
                f"| {r['name']} | {layer} | {r.get('iterations', r['success'])} | "
                f"{r['avg_latency_ms']:.2f} | {r['p50_ms']:.2f} | {r['p95_ms']:.2f} | "
                f"{r['min_ms']:.2f} | {r['max_ms']:.2f} | {r['qps']:.2f} |"
            )

    # ===== 相对提升 =====
    lines.append("\n## 2. 引入缓存后的性能提升（相对无缓存查 DB）\n")
    if db and db["avg_latency_ms"] > 0:
        lines.append("| 场景 | 平均延迟变化 | 提升倍数 | P95 变化 |")
        lines.append("|------|:-----------:|:-------:|:--------:|")
        for prefix in ["B", "C"]:
            r = find_scenario(results, prefix)
            if r:
                lat_speedup = calc_speedup(db, r, "avg_latency_ms")
                lines.append(
                    f"| {r['name']} | {db['avg_latency_ms']:.2f}ms → {r['avg_latency_ms']:.2f}ms | "
                    f"**{lat_speedup}x** | {db['p95_ms']:.2f}ms → {r['p95_ms']:.2f}ms |"
                )
    else:
        lines.append("_数据不足，无法计算提升倍数_\n")

    # ===== 缓存状态 =====
    lines.append("\n## 3. 各场景压测前缓存状态\n")
    lines.append("| 场景 | L1 大小 | L2 listPage Keys | L2 listPageVo Keys |")
    lines.append("|------|-------:|----------------:|------------------:|")
    for prefix in ["A", "B", "C"]:
        r = find_scenario(results, prefix)
        if r:
            stats = r.get("cache_stats_before", {})
            lines.append(
                f"| {r['name']} | {stats.get('l1Size', 0)} | "
                f"{stats.get('l2ListPageKeys', 0)} | {stats.get('l2ListPageVoKeys', 0)} |"
            )

    # ===== 结论（数据驱动，反常时告警） =====
    lines.append("\n## 4. 结论与分析\n")
    if db and l2 and l1:
        if l1["avg_latency_ms"] < db["avg_latency_ms"] and l2["avg_latency_ms"] < db["avg_latency_ms"]:
            lines.append(f"1. **引入二级缓存后**: 首页接口平均延迟从 {db['avg_latency_ms']:.2f}ms（无缓存查 DB）"
                         f"降至 {l1['avg_latency_ms']:.2f}ms（L1 命中），提升 "
                         f"**{calc_speedup(db, l1, 'avg_latency_ms')}x**。")
            lines.append(f"2. **L2 (Redis) vs DB**: 平均延迟从 {db['avg_latency_ms']:.2f}ms 降至 "
                         f"{l2['avg_latency_ms']:.2f}ms，提升 **{calc_speedup(db, l2, 'avg_latency_ms')}x**；"
                         f"L2 的价值在于多实例共享与 L1 失效后的兜底。")
            lines.append(f"3. **L1 vs L2**: L1 比 L2 快 **{calc_speedup(l2, l1, 'avg_latency_ms')}x**，"
                         f"体现本地缓存零网络往返的优势。")
            lines.append(f"4. **稳定性**: DB 场景 Max={db['max_ms']:.2f}ms，L1 场景 Max={l1['max_ms']:.2f}ms，"
                         f"缓存同时降低了尾延迟波动。")
        else:
            lines.append("> ⚠️ **数据反常**: 缓存场景延迟未低于 DB 场景，可能原因："
                         "缓存状态控制未生效 / 固定开销（鉴权、用户表查询、JSON 序列化）占比过大 / 环境抖动。"
                         "请检查测试流程后重跑。\n")
            lines.append(f"- DB={db['avg_latency_ms']:.2f}ms, L2={l2['avg_latency_ms']:.2f}ms, "
                         f"L1={l1['avg_latency_ms']:.2f}ms")
    else:
        lines.append("_部分场景数据缺失，无法生成完整结论。_\n")

    lines.append("\n---\n")
    lines.append("_报告由 cache_report_generator.py 自动生成_\n")

    # 写入文件
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"[报告] 已生成: {output_file}")


def main():
    parser = argparse.ArgumentParser(description="缓存性能测试报告生成器")
    default_input = Path(__file__).parent / "cache_test_results" / "summary.json"
    default_output = Path(__file__).parent / "cache_test_results" / "cache_report.md"
    parser.add_argument("--input", type=Path, default=default_input, help="summary.json 路径")
    parser.add_argument("--output", type=Path, default=default_output, help="输出 Markdown 路径")
    args = parser.parse_args()

    if not args.input.exists():
        print(f"[错误] 输入文件不存在: {args.input}")
        print("请先运行 cache_perf_test.py 生成测试数据")
        return

    results = load_summary(args.input)
    generate_report(results, args.output)


if __name__ == "__main__":
    main()
