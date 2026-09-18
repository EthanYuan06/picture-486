#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
RAG 检索效果评测脚本
====================
两种模式：
  - retrieval : 本地 import agent 模块，复刻生产检索链路（文本=MMR，图搜=直查 Chroma），
                可选跑 qwen3-vl-rerank 对比重排前后。精确、可复现、带相似度分数。
  - e2e       : 请求 Docker 中的 agent 服务 (POST /api/chat) 走完整链路，评测最终返回图片。
  - both      : 两者都跑（默认）。

指标：Top1命中率 / Recall@K / Precision@K / Hit@K / MRR / 最高相似度 / rerank增益 / 负样本误召。

用法：
  cd jmeter
  ..\\agent\\.venv\\Scripts\\python.exe rag_eval.py --mode both --top-k 10 --rerank
"""
import argparse
import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

import requests
import dashscope
from langchain_core.embeddings import Embeddings
from langchain_chroma import Chroma

# ---------------- 路径 ----------------
JETER_DIR = Path(__file__).resolve().parent
BACKEND_DIR = JETER_DIR.parent
AGENT_DIR = BACKEND_DIR / "agent"
DEFAULT_QUERIES = JETER_DIR / "rag_queries.json"
OUT_DIR = JETER_DIR / "rag_test_results"

LAMBDA_MULT = 0.5          # 与生产 MMR 保持一致
RERANK_POOL = 20           # 送入重排的候选上限（控制 API 成本）
CHROMA_DIR = AGENT_DIR / "app" / "chroma_data"   # 与容器内置的同一批向量
RERANK_URL = "https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank"


# ---------------- 自包含模型/向量库（不 import app.agent，规避其 redis 依赖） ----------------
class QwenVLEmbeddings(Embeddings):
    """复刻生产 DashScopeMultiModalEmbeddings：qwen3-vl-embedding + enable_fusion。"""
    def __init__(self, api_key):
        self.api_key = api_key

    def embed_documents(self, texts):
        out = []
        for t in texts:
            resp = dashscope.MultiModalEmbedding.call(
                api_key=self.api_key, model="qwen3-vl-embedding",
                input=[{"text": t}], enable_fusion=True)
            if getattr(resp, "status_code", 200) != 200:
                raise RuntimeError(str(resp))
            out.append(resp.output["embeddings"][0]["embedding"])
        return out

    def embed_query(self, text):
        return self.embed_documents([text])[0]

    def embed_multimodal(self, text, image_url):
        resp = dashscope.MultiModalEmbedding.call(
            api_key=self.api_key, model="qwen3-vl-embedding",
            input=[{"text": text}, {"image": image_url}], enable_fusion=True)
        if getattr(resp, "status_code", 200) != 200:
            raise RuntimeError(f"多模态嵌入失败: {resp.code} - {resp.message}")
        return resp.output["embeddings"][0]["embedding"]


class Reranker:
    """复刻生产 DashScopeRerankModel.rerank_multimodal：qwen3-vl-rerank。"""
    def __init__(self, api_key):
        self.api_key = api_key

    def rerank_multimodal(self, query, documents_with_images, user_image_url=None, top_n=3):
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        query_obj = {"text": query}
        if user_image_url:
            query_obj["image"] = user_image_url
        data = {
            "model": "qwen3-vl-rerank",
            "input": {"query": query_obj, "documents": documents_with_images},
            "parameters": {"return_documents": False, "top_n": top_n},
        }
        r = requests.post(RERANK_URL, headers=headers, json=data, timeout=15)
        r.raise_for_status()
        return [item["index"] for item in r.json()["output"]["results"]]


def bootstrap_agent():
    """加载 agent/.env 取 DASHSCOPE_API_KEY（不 import app.agent，规避坏的 redis 依赖）。"""
    from dotenv import load_dotenv
    load_dotenv(AGENT_DIR / ".env")
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        raise RuntimeError("未找到 DASHSCOPE_API_KEY，请检查 agent/.env")
    return api_key


def load_meta(api_key):
    """直连本地 Chroma（与容器同一批数据），返回 (records, store, emb_model, rerank_model)。"""
    emb_model = QwenVLEmbeddings(api_key)
    store = Chroma(collection_name="picture_vectors",
                   embedding_function=emb_model,
                   persist_directory=str(CHROMA_DIR))
    rerank_model = Reranker(api_key)
    col = store._collection
    data = col.get(include=["metadatas"])
    records = []
    for cid, m in zip(data["ids"], data["metadatas"]):
        records.append({
            "chroma_id": cid,
            "pic_id": str(m.get("id", "")),
            "name": (m.get("name") or "").strip(),
            "introduction": (m.get("introduction") or "").strip(),
            "category": (m.get("category") or "").strip(),
            "tags": (m.get("tags") or "").strip(),
            "image_url": (m.get("image_url") or "").strip(),
        })
    return records, store, emb_model, rerank_model


# ---------------- ground truth ----------------
def resolve_relevant(records, relevance, exclude_id=None):
    """按 keyword 在指定字段做子串匹配，返回相关 picture id 集合。"""
    kws = relevance.get("keywords", []) or []
    fields = relevance.get("fields", ["name", "introduction", "tags"]) or ["name", "introduction", "tags"]
    rel = set()
    for r in records:
        if exclude_id and r["pic_id"] == str(exclude_id):
            continue
        blob = " ".join(str(r.get(f, "")) for f in fields)
        if any(kw and kw in blob for kw in kws):
            rel.add(r["pic_id"])
    return rel


def resolve_query_image(q, records):
    """图搜：按 query_image_name 找到查询图的 (image_url, pic_id)。"""
    target = q.get("query_image_name", "")
    for r in records:
        if target and (target == r["name"] or target in r["name"]):
            return r["image_url"], r["pic_id"]
    # 兜底：直接给了 url
    url = q.get("query_image_url")
    if url:
        for r in records:
            if r["image_url"] == url:
                return url, r["pic_id"]
        return url, None
    return None, None


# ---------------- 指标 ----------------
def eval_ranking(ranked_ids, relevant, K):
    ranked_ids = [r for r in ranked_ids if r]
    topk = ranked_ids[:K]
    n_rel = len(relevant)
    hits = sum(1 for r in topk if r in relevant)
    precision = hits / len(topk) if topk else 0.0
    recall = (hits / n_rel) if n_rel else None
    mrr = 0.0
    for i, r in enumerate(ranked_ids):
        if r in relevant:
            mrr = 1.0 / (i + 1)
            break
    return {
        "top1": 1 if (topk and topk[0] in relevant) else 0,
        "hit": 1 if hits > 0 else 0,
        "precision": precision,
        "recall": recall,
        "mrr": mrr,
        "n_rel": n_rel,
        "n_ret": len(ranked_ids),
        "hits_in_topk": hits,
    }


# ---------------- retrieval 模式 ----------------
def mmr_retrieve(store, query, expected_count):
    candidate_k = expected_count * 10
    search_kwargs = {"k": candidate_k, "fetch_k": max(candidate_k * 2, 20), "lambda_mult": LAMBDA_MULT}
    retriever = store.as_retriever(search_type="mmr", search_kwargs=search_kwargs)
    docs = retriever.invoke(query)
    return [str(d.metadata.get("id", "")) for d in docs]


def raw_query(store, emb, k):
    res = store._collection.query(query_embeddings=[emb], n_results=k, include=["metadatas", "distances"])
    metas, dists = res["metadatas"][0], res["distances"][0]
    ids = [str(m.get("id", "")) for m in metas]
    sims = [1.0 / (1.0 + d) for d in dists]
    return ids, sims


def build_docs_with_images(records_by_id, ranked_ids):
    out = []
    for pid in ranked_ids:
        r = records_by_id.get(pid)
        if not r:
            continue
        name, intro = r["name"], r["introduction"]
        text = f"{name}：{intro}" if intro else (name or "")
        out.append({"text": text, "image": r["image_url"] or ""})
    return out


def run_rerank(rerank_model, records_by_id, query, ranked_ids, user_image_url, top_n):
    pool = ranked_ids[:RERANK_POOL]
    docs = build_docs_with_images(records_by_id, pool)
    if not docs:
        return []
    idxs = rerank_model.rerank_multimodal(query, docs, user_image_url=user_image_url, top_n=top_n)
    return [pool[i] for i in idxs if i < len(pool)]


def eval_retrieval(q, records, records_by_id, url_to_id, store, emb_model, rerank_model, cfg, do_rerank):
    mode = q["mode"]
    K = cfg["top_k"]
    ec = q.get("expected_count", cfg["default_expected_count"])
    negative = q.get("negative", False)

    image_url, self_id = (None, None)
    if mode == "image":
        image_url, self_id = resolve_query_image(q, records)
    exclude_id = self_id if (mode == "image" and q.get("exclude_self")) else None
    relevant = resolve_relevant(records, q["relevance"], exclude_id=exclude_id)

    qtext = q["query"] if mode == "text" else q.get("query_text", "")

    if mode == "text":
        ranked = mmr_retrieve(store, qtext, ec)
        emb = emb_model.embed_query(qtext)
        _, sims = raw_query(store, emb, K)
        max_sim = sims[0] if sims else 0.0
        user_img = None
    else:
        emb = emb_model.embed_multimodal(qtext, image_url)
        ranked, sims = raw_query(store, emb, ec * 10)
        max_sim = sims[0] if sims else 0.0
        user_img = image_url

    if exclude_id:
        ranked = [r for r in ranked if r != str(exclude_id)]

    before = eval_ranking(ranked, relevant, K)
    after = None
    if do_rerank and not negative and ranked:
        reranked = run_rerank(rerank_model, records_by_id, qtext, ranked, user_img, K)
        after = eval_ranking(reranked, relevant, K)

    return {
        "id": q["id"], "mode": mode, "subtype": q.get("subtype", ""),
        "query": qtext, "image_url": image_url, "negative": negative,
        "n_rel": before["n_rel"], "relevant_ids": sorted(relevant),
        "max_sim": round(max_sim, 4),
        "before": before, "after": after,
        "top_ret": ranked[:5],
    }


# ---------------- e2e 模式 ----------------
async def e2e_one(session, base, q, url_to_id, user_id, image_url):
    import aiohttp  # noqa
    async with session.get(base + "/create-thread") as resp:
        tj = await resp.json()
    thread_id = tj["data"]["thread_id"]
    qtext = q["query"] if q["mode"] == "text" else q.get("query_text", "")
    payload = {"thread_id": thread_id, "query": qtext, "user_id": user_id, "space_id": None}
    if image_url:
        payload["image_url"] = image_url
    async with session.post(base + "/chat", json=payload) as resp:
        cj = await resp.json()
    data = cj.get("data", {}) or {}
    images = data.get("images", []) or []
    reply = data.get("reply", "") or ""
    ranked_ids = [url_to_id.get(u) for u in images]
    return ranked_ids, images, reply


async def run_e2e(queries, records, url_to_id, cfg):
    import aiohttp
    base = cfg["e2e_base_url"].rstrip("/")
    user_id = cfg["user_id"]
    K = cfg["top_k"]
    results = []
    timeout = aiohttp.ClientTimeout(total=120)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        for q in queries:
            image_url = None
            exclude_id = None
            if q["mode"] == "image":
                image_url, self_id = resolve_query_image(q, records)
                exclude_id = self_id if q.get("exclude_self") else None
            relevant = resolve_relevant(records, q["relevance"], exclude_id=exclude_id)
            try:
                ranked_ids, images, reply = await e2e_one(session, base, q, url_to_id, user_id, image_url)
                if exclude_id:
                    ranked_ids = [r for r in ranked_ids if r != str(exclude_id)]
                k_eff = min(K, len(ranked_ids)) if ranked_ids else K
                m = eval_ranking(ranked_ids, relevant, k_eff)
                err = None
            except Exception as e:
                ranked_ids, images, reply, m, err = [], [], "", None, str(e)
            results.append({
                "id": q["id"], "mode": q["mode"], "subtype": q.get("subtype", ""),
                "query": q.get("query") or q.get("query_text", ""),
                "negative": q.get("negative", False), "n_rel": len(relevant),
                "returned": len(images), "ranked_ids": ranked_ids,
                "reply_head": (reply[:60].replace("\n", " ")), "metrics": m, "error": err,
            })
            print(f"  [e2e] {q['id']} 返回{len(images)}张 err={err}")
    return results


# ---------------- 报告 ----------------
def fmt(v, pct=False):
    if v is None:
        return "—"
    return f"{v*100:.0f}%" if pct else f"{v:.2f}"


def aggregate(rows, key_before="before", key_after="after"):
    pos = [r for r in rows if not r["negative"] and r[key_before]["n_rel"] > 0]
    def avg(f):
        vals = [f(r) for r in pos if f(r) is not None]
        return sum(vals) / len(vals) if vals else None
    out = {
        "n": len(pos),
        "top1": avg(lambda r: r[key_before]["top1"]),
        "recall": avg(lambda r: r[key_before]["recall"]),
        "precision": avg(lambda r: r[key_before]["precision"]),
        "mrr": avg(lambda r: r[key_before]["mrr"]),
    }
    if key_after:
        with_after = [r for r in pos if r.get(key_after)]
        if with_after:
            def avga(f):
                vals = [f(r) for r in with_after if f(r) is not None]
                return sum(vals) / len(vals) if vals else None
            out["rerank_top1"] = avga(lambda r: r[key_after]["top1"])
            out["rerank_recall"] = avga(lambda r: r[key_after]["recall"])
            out["rerank_mrr"] = avga(lambda r: r[key_after]["mrr"])
            out["rerank_n"] = len(with_after)
    return out


def write_report(cfg, meta_count, retrieval_rows, e2e_rows, do_rerank):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = []
    lines.append("# RAG 检索效果评测报告\n")
    lines.append(f"- 生成时间：{ts}")
    lines.append(f"- 向量库记录数：{meta_count}")
    lines.append(f"- Top-K：{cfg['top_k']}　|　模式：{'retrieval+e2e' if e2e_rows else 'retrieval'}　|　rerank对比：{'是' if do_rerank else '否'}")
    lines.append(f"- 文本检索：MMR(lambda={LAMBDA_MULT})　图搜：直查 Chroma\n")

    # ground truth
    if retrieval_rows:
        lines.append("## 一、Ground Truth 解析（请核对相关集是否符合预期）\n")
        lines.append("| id | query | 相关数 | 相关图片(pic_id) |")
        lines.append("|----|-------|:---:|------|")
        for r in retrieval_rows:
            ids = ",".join(r["relevant_ids"][:12]) + ("…" if len(r["relevant_ids"]) > 12 else "")
            lines.append(f"| {r['id']} | {r['query'][:22]} | {r['n_rel']} | {ids or '（负样本，空）'} |")
        lines.append("")

        lines.append("## 二、retrieval 模式明细（精确指标）\n")
        head = "| id | 类型 | Top1 | Recall@K | Prec@K | MRR | 最高相似度 |"
        sep = "|----|------|:--:|:--:|:--:|:--:|:--:|"
        if do_rerank:
            head += " rerank后Top1 | rerank后MRR | ΔMRR |"
            sep += ":--:|:--:|:--:|"
        lines.append(head)
        lines.append(sep)
        for r in retrieval_rows:
            b = r["before"]
            if r["negative"]:
                fp = "误召✗" if r["max_sim"] >= cfg["similarity_false_positive_threshold"] else "正常✓"
                row = f"| {r['id']} | {r['subtype']} | — | — | — | — | {r['max_sim']:.2f}({fp}) |"
                if do_rerank:
                    row += " — | — | — |"
                lines.append(row)
                continue
            row = f"| {r['id']} | {r['subtype']} | {'✓' if b['top1'] else '✗'} | {fmt(b['recall'])} | {fmt(b['precision'])} | {fmt(b['mrr'])} | {r['max_sim']:.2f} |"
            if do_rerank:
                a = r.get("after")
                if a:
                    delta = a["mrr"] - b["mrr"]
                    row += f" {'✓' if a['top1'] else '✗'} | {fmt(a['mrr'])} | {delta:+.2f} |"
                else:
                    row += " — | — | — |"
            lines.append(row)
        lines.append("")

        agg = aggregate(retrieval_rows)
        lines.append("## 三、retrieval 汇总\n")
        lines.append(f"- 有效正样本 query 数：{agg['n']}")
        lines.append(f"- 平均 Top1命中率：**{fmt(agg['top1'], True)}**")
        lines.append(f"- 平均 Recall@{cfg['top_k']}：**{fmt(agg['recall'])}**")
        lines.append(f"- 平均 Precision@{cfg['top_k']}：**{fmt(agg['precision'])}**")
        lines.append(f"- 平均 MRR：**{fmt(agg['mrr'])}**")
        if do_rerank and "rerank_mrr" in agg:
            lines.append(f"- rerank 后 平均 Top1：**{fmt(agg['rerank_top1'], True)}**　平均 MRR：**{fmt(agg['rerank_mrr'])}**（样本 {agg['rerank_n']}）")
            dm = (agg["rerank_mrr"] or 0) - (agg["mrr"] or 0)
            dt = (agg["rerank_top1"] or 0) - (agg["top1"] or 0)
            lines.append(f"- **rerank 增益**：MRR {dm:+.2f}，Top1 {dt*100:+.0f}pp")
        negs = [r for r in retrieval_rows if r["negative"]]
        if negs:
            fp = sum(1 for r in negs if r["max_sim"] >= cfg["similarity_false_positive_threshold"])
            lines.append(f"- 负样本误召率：**{fp}/{len(negs)}**（阈值 {cfg['similarity_false_positive_threshold']}）")
        lines.append("")

    if e2e_rows:
        lines.append("## 四、e2e 模式明细（走 /api/chat 全链路，最终返回图片）\n")
        lines.append("| id | 类型 | 返回数 | Top1 | Recall | Prec | MRR | 回复片段 |")
        lines.append("|----|------|:--:|:--:|:--:|:--:|:--:|------|")
        for r in e2e_rows:
            m = r["metrics"]
            if r["error"]:
                lines.append(f"| {r['id']} | {r['subtype']} | 0 | — | — | — | — | ERROR: {r['error'][:30]} |")
                continue
            if r["negative"]:
                lines.append(f"| {r['id']} | {r['subtype']} | {r['returned']} | — | — | — | — | {r['reply_head']} |")
                continue
            lines.append(f"| {r['id']} | {r['subtype']} | {r['returned']} | {'✓' if m['top1'] else '✗'} | {fmt(m['recall'])} | {fmt(m['precision'])} | {fmt(m['mrr'])} | {r['reply_head']} |")
        lines.append("")
        eagg = aggregate([{"negative": r["negative"], "before": r["metrics"] or {"n_rel": 0, "top1": 0, "recall": None, "precision": 0, "mrr": 0}} for r in e2e_rows], key_after=None)
        lines.append("## 五、e2e 汇总\n")
        lines.append(f"- 有效正样本 query 数：{eagg['n']}")
        lines.append(f"- 平均 Top1命中率：**{fmt(eagg['top1'], True)}**")
        lines.append(f"- 平均 Recall：**{fmt(eagg['recall'])}**（受 expected_count/rerank top_n 截断）")
        lines.append(f"- 平均 MRR：**{fmt(eagg['mrr'])}**")
        lines.append("")

    report_path = OUT_DIR / "rag_report.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")

    summary = {
        "generated_at": ts, "vector_count": meta_count, "config": cfg,
        "retrieval": retrieval_rows, "e2e": e2e_rows,
    }
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    return report_path


# ---------------- 主流程 ----------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["retrieval", "e2e", "both"], default="both")
    ap.add_argument("--queries", default=str(DEFAULT_QUERIES))
    ap.add_argument("--top-k", type=int, default=None)
    ap.add_argument("--rerank", action="store_true", help="跑 rerank 前后对比")
    ap.add_argument("--no-rerank", dest="rerank", action="store_false")
    ap.set_defaults(rerank=True)
    args = ap.parse_args()

    qj = json.loads(Path(args.queries).read_text(encoding="utf-8"))
    cfg = qj["config"]
    if args.top_k:
        cfg["top_k"] = args.top_k
    queries = qj["queries"]

    print("=" * 60)
    print("RAG 检索效果评测")
    print("=" * 60)
    api_key = bootstrap_agent()
    records, store, emb_model, rerank_model = load_meta(api_key)
    records_by_id = {r["pic_id"]: r for r in records}
    url_to_id = {r["image_url"]: r["pic_id"] for r in records if r["image_url"]}
    print(f"向量库记录数：{len(records)}　|　模式：{args.mode}　|　rerank：{args.rerank}　|　Top-K：{cfg['top_k']}")

    retrieval_rows = []
    if args.mode in ("retrieval", "both"):
        print("\n[retrieval] 逐条评测中（本地直连向量库）...")
        for q in queries:
            r = eval_retrieval(q, records, records_by_id, url_to_id, store, emb_model, rerank_model, cfg, args.rerank)
            retrieval_rows.append(r)
            b = r["before"]
            tag = "负样本" if r["negative"] else f"Top1={'✓' if b['top1'] else '✗'} R@K={fmt(b['recall'])} MRR={fmt(b['mrr'])}"
            print(f"  {r['id']:<7} rel={r['n_rel']:<2} sim={r['max_sim']:.2f}  {tag}")

    e2e_rows = []
    if args.mode in ("e2e", "both"):
        print(f"\n[e2e] 请求 {cfg['e2e_base_url']} 全链路评测中...")
        e2e_rows = asyncio.run(run_e2e(queries, records, url_to_id, cfg))

    report_path = write_report(cfg, len(records), retrieval_rows, e2e_rows, args.rerank)
    print("\n" + "=" * 60)
    print(f"报告已生成：{report_path}")
    print(f"明细数据：  {OUT_DIR / 'summary.json'}")
    print("=" * 60)


if __name__ == "__main__":
    main()
