# 10 · Harness Ledger & Measured Status

> **Doc type: MEASURED STATUS.**
> **STATUS: OPEN FOR DISCUSSION & CONSULTATION.**
> This file owns the live pass/fail status and measured performance figures of the Pakt Lemiesza platform and its Robot Fleet.
> Any measurement here must state the date it was taken and the command used to take it ([Canon 03 · D2](../00_Canon/03_Rules_of_Engagement.md)).

---

## 1. Test Suite Status

| Suite | Runner | Test Count | Status | Measured Date | Command |
|---|---|---:|---|---|---|
| **Unit & Integration** | Vitest | 193 tests | ✅ PASS | 2026-10-01 | `pnpm test` |
| **HTTP Smoke Suite** | Node HTTP client | 45 checks | ✅ PASS | 2026-10-01 | `pnpm smoke` |
| **Type Check & Lint** | svelte-check | 0 errors | ✅ PASS | 2026-10-01 | `pnpm check` |
| **Retrieval Evaluation** | Vitest, real local embedder | 16 attack lines + 4 off-topic negatives | ✅ PASS (hybrid recall@5 100%, negatives 4/4) | 2026-10-01 | `pnpm eval` |
| **Robot Fleet** | Node + Vitest | ROBOT-01–10 | see §2 | 2026-10-01 | `pnpm robots` |

---

## 2. The Robot Fleet Ledger

*The definitive specification of each robot is in [`docs/17_Robots/`](../17_Robots/README.md).*

| # | Robot | Tier | Status | Last Measured | Command | Proof of Failure |
|---|---|---|---|---|---|---|
| **ROBOT-01** | [The Verbatim Quotation Gate](../17_Robots/ROBOT-01-verbatim-quotation-gate.md) | Backend | ✅ PASS | 2026-10-01 | `pnpm robots` | 3/3 mutations caught (`pnpm robots:sabotage`) + one-word-altered fixture |
| **ROBOT-02** | [The Trust-Tier Write Boundary](../17_Robots/ROBOT-02-trust-tier-write-boundary.md) | Backend | ✅ PASS | 2026-10-01 | `pnpm robots` | 5/5 mutations caught (cascade now covers human-approved cards) |
| **ROBOT-03** | [The Auditor Trap (Canary)](../17_Robots/ROBOT-03-auditor-trap-canary.md) | Eval | ✅ PASS (offline half) · model half NOT RUN | 2026-10-01 | `pnpm robots`; model half `pnpm eval` with `LLM_AUDITOR_*` | Rubber-stamp and paranoid fake auditors both exposed |
| **ROBOT-04** | [The Golden Set Retrieval Gate](../17_Robots/ROBOT-04-golden-set-retrieval.md) | Eval | ✅ PASS (offline half; real embedder: hybrid recall@5 16/16, negatives 4/4) | 2026-10-01 | `pnpm robots`; real embedder `pnpm eval` | Harness reports a wrong expectation as a miss and an on-topic line as a false positive |
| **ROBOT-05** | [The Locale Parity Gate](../17_Robots/ROBOT-05-locale-parity-gate.md) | Static Gate | ✅ PASS | 2026-10-01 | `pnpm robots` | `--self-test`: 6/6 sabotage cases detected |
| **ROBOT-06** | [The SQLite Disk Assertion Gate](../17_Robots/ROBOT-06-sqlite-disk-assertion.md) | Backend | ✅ PASS | 2026-10-01 | `pnpm robots` | 3/3 mutations caught (UNC check, WAL abort, pragma abort) |
| **ROBOT-07** | [The License & Cleared-to-Store Gate](../17_Robots/ROBOT-07-license-and-storage-gate.md) | Backend | ✅ PASS | 2026-10-01 | `pnpm robots` | 2/2 mutations caught |
| **ROBOT-08** | [The Fleet Census & Doc-Rot Gate](../17_Robots/ROBOT-08-doc-rot-and-census-gate.md) | Static Gate | ✅ PASS | 2026-10-01 | `pnpm robots` | `--self-test`: 8/8 defects detected |
| **ROBOT-09** | [The Media Link & Privacy Gate](../17_Robots/ROBOT-09-media-link-privacy-gate.md) | Backend | ✅ PASS (offline half) · live link check NOT WRITTEN | 2026-10-01 | `pnpm robots` | 4/4 mutations caught |
| **ROBOT-10** | [The Lyrics & Attribution Gate](../17_Robots/ROBOT-10-lyrics-attribution-gate.md) | Backend | ✅ PASS | 2026-10-01 | `pnpm robots` | 4/4 mutations caught |

> **Status Legend:**
> - ✅ PASS: Automated check exists, passes, and has documented proof of failure.
> - 🟡 Proposed / In Dev: Under consultation/design before full script formalization.
> - 🔴 FAIL / Sabotaged: Failing gate or intentional control check.
