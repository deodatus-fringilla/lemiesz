# 17 · The Robot Fleet

> **Doc type: DURABLE RULING + MEASURED INDEX.**
> **STATUS: OPEN FOR DISCUSSION & CONSULTATION.**
> One document per robot, each describing *why that robot exists, what it guards, and how it proves it can fail*.
> Live pass/fail status lives in [10_Harness/02_Harness_Ledger.md](../10_Harness/02_Harness_Ledger.md).

---

## What a Robot Is and Why They Exist

A **robot** is a small automated program that exercises the platform and shouts when something breaks. The name is deliberate: **conclusions rot; robots don't.**

In Pakt Lemiesza, rules written only in prose or agreed upon in chat sessions will inevitably be forgotten or bypassed by future LLM updates or human edits. Every critical boundary—whether theological citation rigor, copyright safety, or retrieval accuracy—must be guarded by a numbered automated Robot.

---

## The Three Homes Rule ([Canon 03 §D3](../00_Canon/03_Rules_of_Engagement.md))

Every robot in the fleet must have:
1. **A specification document in this folder:** `ROBOT-XX-<name>.md` detailing its rationale, guarded invariants, and failure proof.
2. **A status row in the ledger:** [10_Harness/02_Harness_Ledger.md](../10_Harness/02_Harness_Ledger.md) carrying a real measured date.
3. **An executable test/script:** in `scripts/robots/` or `tests/robots/`.

---

## The Numbering Rule

Before numbering a new robot, check the table below and claim the next available sequential number. Do not assign numbers from memory.

Highest number currently claimed: **ROBOT-08**.

---

## The 4 Tiers of Robots

1. **Static Gates (Fast Node scripts, `< 1s`):**
   Run without starting the database or test framework. Pre-commit & CI checks for syntax, missing locale keys, dead links, and fleet census.
2. **Backend & Database Gates (Vitest, `1–3s`):**
   Run against in-memory or throw-away test SQLite databases. Exercise schema constraints, foreign key cascades, verbatim quote substrings, and trust-tier write boundaries.
3. **AI Pipeline & Retrieval Gates (`pnpm eval` / Vitest, `5–15s`):**
   Exercise the hybrid search engine, golden query sets, and LLM Drafter/Auditor rubrics using real local embeddings and canary test cases.
4. **HTTP Smoke & Streaming Gates (Real server, `5s`):**
   Exercise the built application over HTTP: authentication, session handling, rate limiting, and SSE streaming token resolution.

---

## The Fleet Index

| # | Robot Document | Tier | Primary Guard / Invariant | Proof It Can Fail |
|---|---|---|---|---|
| **01** | [The Verbatim Quotation Gate](ROBOT-01-verbatim-quotation-gate.md) | Backend | Invariant: Every quote in an argument card or shield output must be an exact substring of stored DB text. | Sabotage: 1-character altered quote fixture. |
| **02** | [The Trust-Tier Write Boundary](ROBOT-02-trust-tier-write-boundary.md) | Backend | Invariant: Unapproved (`draft`, `flagged`, `stale`) cards are mathematically barred from public export by default. | Negative controls: export attempt without approval flag. |
| **03** | [The Auditor Trap (Canary Gate)](ROBOT-03-auditor-trap-canary.md) | Eval | Invariant: The Auditor model must catch 100% of planted bad cards (fabricated quotes, fallacies). | Negative controls: 5 planted synthetic failure cards. |
| **04** | [The Golden Set Retrieval Gate](ROBOT-04-golden-set-retrieval.md) | Eval | Invariant: Retrieval recall@5 on golden attack lines must remain $\ge 95\%$; off-topic rejection must be 100%. | Negative controls: out-of-domain query evaluation. |
| **05** | [The Locale Parity Gate](ROBOT-05-locale-parity-gate.md) | Static Gate | Invariant: Key parity between `messages/pl.json` and `messages/en.json` must be 1:1. | `--self-test`: synthetic missing key detection. |
| **06** | [The SQLite Disk Assertion Gate](ROBOT-06-sqlite-disk-assertion.md) | Backend | Invariant: Database startup must abort if running on network mount/UNC share, or if WAL/busy timeout are disabled. | Simulated network mount rejection. |
| **07** | [The License & Cleared-to-Store Gate](ROBOT-07-license-and-storage-gate.md) | Backend | Invariant: Cannot seed or store full text when `cleared_to_store=0`, or without explicit reviewer/license attribution. | Negative control: unreviewed full-text ingest attempt. |
| **08** | [The Fleet Census & Doc-Rot Gate](ROBOT-08-doc-rot-and-census-gate.md) | Static Gate | Invariant: Every `ROBOT-*.md` document must match a row in the ledger and have an existing script/test. | `--self-test`: missing row detection. |

---

## How to Add a New Robot

1. Take the next free number from the index above.
2. Draft its specification document (`ROBOT-XX-...md`) following the standard template.
3. Implement the script or test.
4. **Prove it can fail** by running negative controls or sabotaging application code. Record the proof in the robot document.
5. Add the status row with the date and measurement to [10_Harness/02_Harness_Ledger.md](../10_Harness/02_Harness_Ledger.md).
