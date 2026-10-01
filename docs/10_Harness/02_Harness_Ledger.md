# 10 · Harness Ledger & Measured Status

> **Doc type: MEASURED STATUS.**
> **STATUS: OPEN FOR DISCUSSION & CONSULTATION.**
> This file owns the live pass/fail status and measured performance figures of the Pakt Lemiesza platform and its Robot Fleet.
> Any measurement here must state the date it was taken and the command used to take it ([Canon 03 · D2](../00_Canon/03_Rules_of_Engagement.md)).

---

## 1. Test Suite Status

| Suite | Runner | Test Count | Status | Measured Date | Command |
|---|---|---:|---|---|---|
| **Unit & Integration** | Vitest | 129 tests | ✅ PASS | 2026-10-01 | `pnpm test` |
| **HTTP Smoke Suite** | Node HTTP client | 28 checks | ✅ PASS | 2026-10-01 | `pnpm smoke` |
| **Type Check & Lint** | svelte-check | 0 errors | ✅ PASS | 2026-10-01 | `pnpm check` |
| **Retrieval Evaluation** | tsx local embedder | 20 attack queries | ✅ PASS (100% recall@5) | 2026-10-01 | `pnpm eval` |

---

## 2. The Robot Fleet Ledger

*The definitive specification of each robot is in [`docs/17_Robots/`](../17_Robots/README.md).*

| # | Robot | Tier | Status | Last Measured | Proof of Failure Method |
|---|---|---|---|---|---|
| **ROBOT-01** | [The Verbatim Quotation Gate](../17_Robots/ROBOT-01-verbatim-quotation-gate.md) | Backend | 🟡 Proposed / In Dev | — | Sabotage: corrupted quote fixture |
| **ROBOT-02** | [The Trust-Tier Write Boundary](../17_Robots/ROBOT-02-trust-tier-write-boundary.md) | Backend | 🟡 Proposed / In Dev | — | Negative control: unapproved card export |
| **ROBOT-03** | [The Auditor Trap (Canary)](../17_Robots/ROBOT-03-auditor-trap-canary.md) | Eval | 🟡 Proposed / In Dev | — | Deliberate bad card injection (5 seeds) |
| **ROBOT-04** | [The Golden Set Retrieval Gate](../17_Robots/ROBOT-04-golden-set-retrieval.md) | Eval | ✅ PASS (16/16 recall, 4/4 reject) | 2026-10-01 | Out-of-domain negative controls |
| **ROBOT-05** | [The Locale Parity Gate](../17_Robots/ROBOT-05-locale-parity-gate.md) | Static Gate | 🟡 Proposed / In Dev | — | `--self-test` missing key injection |
| **ROBOT-06** | [The SQLite Disk Assertion Gate](../17_Robots/ROBOT-06-sqlite-disk-assertion.md) | Backend | ✅ PASS (in DB init) | 2026-10-01 | Simulated network mount rejection |
| **ROBOT-07** | [The License & Cleared-to-Store Gate](../17_Robots/ROBOT-07-license-and-storage-gate.md) | Backend | 🟡 Proposed / In Dev | — | Negative control: unreviewed full-text ingest |
| **ROBOT-08** | [The Fleet Census & Doc-Rot Gate](../17_Robots/ROBOT-08-doc-rot-and-census-gate.md) | Static Gate | 🟡 Proposed / In Dev | — | `--self-test` synthetic doc drift |

> **Status Legend:**
> - ✅ PASS: Automated check exists, passes, and has documented proof of failure.
> - 🟡 Proposed / In Dev: Under consultation/design before full script formalization.
> - 🔴 FAIL / Sabotaged: Failing gate or intentional control check.
