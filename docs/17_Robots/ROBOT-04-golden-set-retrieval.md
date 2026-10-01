# ROBOT 04 — The Golden Set Retrieval Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: OPEN FOR DISCUSSION & CONSULTATION.**
> Fleet Index: [README](README.md) · Live Status: [10_Harness/02_Harness_Ledger.md](../10_Harness/02_Harness_Ledger.md)

| Attribute | Specification |
|---|---|
| **Number** | 04 |
| **Tier** | Eval / Search |
| **Source** | `src/lib/server/search/hybrid.ts` & `scripts/eval-retrieval.ts` |
| **Guards** | Cross-lingual recall regression, vector calibration, off-topic rejection |
| **Proves it can fail** | Out-of-domain queries assert "no strong source" fallback |

---

## 1. Why This Exists

The Rhetorical Shield and Repository rely on a hybrid search engine combining SQLite FTS5 (BM25 lexical matching) and multilingual vector embeddings (`bge-m3` / `multilingual-e5`).
In past tests, lexical-only search failed on 100% of Polish colloquial attack lines, and setting the similarity threshold too high (e.g. 0.86) caused legitimate Polish queries to falsely report *"no strong source"*. Conversely, lowering the threshold too far causes off-topic political attacks to pull irrelevant religious texts.

ROBOT-04 executes the golden attack evaluation suite to ensure that neither lexical drift nor embedding calibration destroys retrieval recall or hallucination guards.

---

## 2. Invariant Rules

1. **Golden Set Size & Balance:** At least 20 attack lines (split evenly between Polish and English colloquial debating styles, covering the Swiss Shield, Double Distance, and Plowshare Paradox arguments) + 4 out-of-domain negative controls.
2. **Recall Invariant:** Recall@5 across all on-topic attack lines must remain $\ge 95\%$ (currently 16/16 = 100%).
3. **Negative Control Invariant:** 100% of off-topic queries (e.g. *"What is the tax rate on electric cars?"*) must return `no_strong_source` fallback, preventing the model from improvising an answer.
4. **Local Execution:** Must run completely offline using local in-process ONNX embeddings (`EMBEDDER=local`) without external API calls.

---

## 3. Proof It Can Fail

- **Negative Control:** Run the 4 off-topic attack lines against the evaluation harness.
- **Assertion:** Best off-topic similarity score must remain strictly below the calibrated fallback threshold (currently max off-topic score is 0.772; threshold is 0.790). If an off-topic score crosses 0.790, the test fails.
