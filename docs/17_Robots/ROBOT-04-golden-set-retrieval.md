# ROBOT 04 — The Golden Set Retrieval Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: IMPLEMENTED (2026-10-01).** The offline half runs in `pnpm robots`; the real-embedder half runs in `pnpm eval`. Live status lives in the [Harness Ledger](../10_Harness/02_Harness_Ledger.md).
> Fleet Index: [README](README.md)

| Attribute | Specification |
|---|---|
| **Number** | 04 |
| **Tier** | Eval / Search (offline half: Vitest; real embedder: `pnpm eval`) |
| **Guarded code** | `src/lib/server/rag/` (FTS5, vectors, RRF, thresholds) and `src/lib/server/eval/harness.ts` (`evaluateRetrieval`) |
| **Executable** | `tests/robots/robot-04-golden-set.robot.ts` (offline) and `src/lib/server/eval/quality.eval.ts` (real local embedder) |
| **Data** | `eval/golden.json` |
| **Guards** | Cross-lingual recall regression, vector-threshold calibration, off-topic rejection |
| **Proves it can fail** | The harness reports a wrong expectation as a miss and an on-topic line posing as off-topic as a false positive, see §3 |

---

## 1. Why This Exists

The Shield and Repository rely on hybrid search: SQLite FTS5 (BM25) plus multilingual vector embeddings. Measured earlier: lexical search alone finds 8/10 English→English and 0/6 Polish→English attack lines, and a threshold set too high returns "no strong source" for legitimate Polish queries, while one set too low drags irrelevant texts into off-topic debates. ROBOT-04 keeps both failure modes visible.

---

## 2. Invariant Rules

1. **Golden set.** At least 20 entries in both languages with at least 4 off-topic negatives. Currently 16 positives (10 en, 6 pl) plus 4 negatives. The target is 30–50 real attack lines; the set is a starter, and `RAG_VECTOR_MIN=0.79` is calibrated on it with a thin margin (worst positive 0.806, best negative 0.772).
2. **Every expected source exists** in the seed corpus (offline half).
3. **Recall.** With the real embedder, hybrid recall@5 and end-to-end recall (real thresholds) must be at least 95% (`pnpm eval`).
4. **Off-topic rejection.** Every negative must return tier `none` ("no strong source"): the model never improvises an answer.
5. **Local.** Runs with the in-process ONNX embedder; the only network use is the first model download.

---

## 3. Proof It Can Fail

Offline half, in the test file: an entry that expects the wrong source appears in `missed`, and an on-topic query listed as a negative appears in `falsePositives`. The real-embedder half fails if any threshold change makes a negative score cross the threshold.

Measured: offline half passes on 2026-10-01 (`pnpm robots`). Real-embedder numbers (hybrid recall@5 16/16, negatives 4/4) were measured before Phases 3–5 and are re-run by `pnpm eval`; see the ledger for the date.
