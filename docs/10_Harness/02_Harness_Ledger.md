# 10 · Harness Ledger & Measured Status

> **Doc type: MEASURED STATUS.**
> **STATUS: OPEN FOR DISCUSSION & CONSULTATION.**
> This file owns the live pass/fail status and measured performance figures of the Przymierze Lemiesza platform and its Robot Fleet.
> Any measurement here must state the date it was taken and the command used to take it ([Canon 03 · D2](../00_Canon/03_Rules_of_Engagement.md)).

---

## 1. Test Suite Status

| Suite | Runner | Test Count | Status | Measured Date | Command |
|---|---|---:|---|---|---|
| **Unit & Integration** | Vitest (projects `unit` on an empty database, `baseline` on `data/baseline.sql`) | 214 tests | ✅ PASS | 2026-10-25 | `pnpm test` |
| **HTTP Smoke Suite** | Node HTTP client | 48 checks | ✅ PASS | 2026-10-25 | `pnpm build && pnpm smoke` |
| **Type Check & Lint** | svelte-check | 0 errors | ✅ PASS | 2026-10-25 | `pnpm check` |
| **Retrieval Evaluation** | Vitest, real local embedder, corpus = `data/baseline.sql` | 16 attack lines + 4 off-topic negatives | ✅ PASS (hybrid recall@5 100%, end-to-end 100%, negatives 4/4; cosine margin thin: worst positive 0.814, best negative 0.790 vs `RAG_VECTOR_MIN=0.79`, suggested 0.802) | 2026-10-25 | `pnpm eval` |
| **Robot Fleet** | Node + Vitest | ROBOT-01–10 | see §2 | 2026-10-25 | `pnpm robots` |

---

## 2. The Robot Fleet Ledger

*The definitive specification of each robot is in [`docs/17_Robots/`](../17_Robots/README.md).*

| # | Robot | Tier | Status | Last Measured | Command | Proof of Failure |
|---|---|---|---|---|---|---|
| **ROBOT-01** | [The Verbatim Quotation Gate](../17_Robots/ROBOT-01-verbatim-quotation-gate.md) | Backend | ✅ PASS | 2026-10-25 | `pnpm robots` | 3/3 mutations caught (`pnpm robots:sabotage`) + one-word-altered fixture |
| **ROBOT-02** | [The Trust-Tier Write Boundary](../17_Robots/ROBOT-02-trust-tier-write-boundary.md) | Backend | ✅ PASS | 2026-10-25 | `pnpm robots` | 5/5 mutations caught (cascade now covers human-approved cards) |
| **ROBOT-03** | [The Auditor Trap (Canary)](../17_Robots/ROBOT-03-auditor-trap-canary.md) | Eval | ✅ PASS (offline half) · model half NOT RUN | 2026-10-25 | `pnpm robots`; model half `pnpm eval` with `LLM_AUDITOR_*` | Rubber-stamp and paranoid fake auditors both exposed |
| **ROBOT-04** | [The Golden Set Retrieval Gate](../17_Robots/ROBOT-04-golden-set-retrieval.md) | Eval | ✅ PASS (offline half; real embedder on `data/baseline.sql`: hybrid recall@5 16/16, negatives 4/4) | 2026-10-25 | `pnpm robots`; real embedder `pnpm eval` | Harness reports a wrong expectation as a miss and an on-topic line as a false positive |
| **ROBOT-05** | [The Locale Parity Gate](../17_Robots/ROBOT-05-locale-parity-gate.md) | Static Gate | ✅ PASS | 2026-10-25 | `pnpm robots` | `--self-test`: 6/6 sabotage cases detected |
| **ROBOT-06** | [The SQLite Disk Assertion Gate](../17_Robots/ROBOT-06-sqlite-disk-assertion.md) | Backend | ✅ PASS | 2026-10-25 | `pnpm robots` | 3/3 mutations caught (UNC check, WAL abort, pragma abort) |
| **ROBOT-07** | [The License & Cleared-to-Store Gate](../17_Robots/ROBOT-07-license-and-storage-gate.md) | Backend | ✅ PASS | 2026-10-25 | `pnpm robots` | 2/2 mutations caught |
| **ROBOT-08** | [The Fleet Census & Doc-Rot Gate](../17_Robots/ROBOT-08-doc-rot-and-census-gate.md) | Static Gate | ✅ PASS | 2026-10-25 | `pnpm robots` | `--self-test`: 10/10 defects detected (now also line anchors and links in `corpus/`) |
| **ROBOT-09** | [The Media Link & Privacy Gate](../17_Robots/ROBOT-09-media-link-privacy-gate.md) | Backend | ✅ PASS (offline half) · live link check NOT WRITTEN | 2026-10-25 | `pnpm robots` | 4/4 mutations caught |
| **ROBOT-10** | [The Lyrics & Attribution Gate](../17_Robots/ROBOT-10-lyrics-attribution-gate.md) | Backend | ✅ PASS | 2026-10-25 | `pnpm robots` | 4/4 mutations caught |

> **Status Legend:**
> - ✅ PASS: Automated check exists, passes, and has documented proof of failure.
> - 🟡 Proposed / In Dev: Under consultation/design before full script formalization.
> - 🔴 FAIL / Sabotaged: Failing gate or intentional control check.
