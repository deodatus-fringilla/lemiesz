# 17 · The Robot Fleet

> **Doc type: DURABLE RULING + MEASURED INDEX.**
> **STATUS: ROBOTS 01–10 IMPLEMENTED (2026-10-01); model-dependent halves of 03/04 and the live link check of 09 are not run here.**
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
3. **An executable test/script:** in `scripts/robots/` or `tests/robots/`, named in an `Executable` row of the spec's attribute table (ROBOT-08 checks that it exists).

---

## Running the Fleet

| Command | What it does |
|---|---|
| `pnpm robots` | Runs every robot that needs no network, model or key: the static gates (each preceded by its own `--self-test`) and one Vitest file per backend robot. About 5 seconds. Exit code 1 if any robot fails. |
| `pnpm robots:sabotage` | Canon 03 D4: breaks one guarded line at a time, requires the guarding robot to turn red, restores the file. Run it whenever a robot or its guarded code changes. |
| `pnpm eval` | The model-dependent halves of ROBOT-03 (needs `LLM_AUDITOR_*`) and ROBOT-04 (real local embedder, downloads the model once). |

Gate strictness (decided 2026-10-01): robots run through `pnpm robots` and in CI. The two static gates (05, 08) are cheap enough to add to a pre-commit hook later; nothing that needs the embedder or an LLM ever runs there.

---

## The Numbering Rule

Before numbering a new robot, check the table below and claim the next available sequential number. Do not assign numbers from memory.

Highest number currently claimed: **ROBOT-10**.

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
| **01** | [The Verbatim Quotation Gate](ROBOT-01-verbatim-quotation-gate.md) | Backend | Every quote in a card or Shield answer is verbatim stored text; citations outside the retrieved set are stripped. | Mutation proof (3) + one-word-altered fixture. |
| **02** | [The Trust-Tier Write Boundary](ROBOT-02-trust-tier-write-boundary.md) | Backend | Public output sees only `human_approved` cards; only a human approves, only the pipeline verifies; source edits stale AI-verified cards. | Mutation proof (4). |
| **03** | [The Auditor Trap (Canary Gate)](ROBOT-03-auditor-trap-canary.md) | Eval | The Auditor must catch every planted bad card in `eval/bad-cards.json` and verify the sound controls (model half not yet run). | Rubber-stamp and paranoid fake auditors exposed. |
| **04** | [The Golden Set Retrieval Gate](ROBOT-04-golden-set-retrieval.md) | Eval | Recall@5 on `eval/golden.json` stays at least 95%; off-topic lines return "no strong source". | Wrong expectation reported as miss; on-topic line as false positive. |
| **05** | [The Locale Parity Gate](ROBOT-05-locale-parity-gate.md) | Static Gate | `messages/*.json` have identical keys and parameters; no empty or TODO strings. | `--self-test` (6 sabotage cases). |
| **06** | [The SQLite Disk Assertion Gate](ROBOT-06-sqlite-disk-assertion.md) | Backend | Startup refuses UNC/network paths; WAL, foreign keys and busy timeout are on. | Mutation proof (2). |
| **07** | [The License & Cleared-to-Store Gate](ROBOT-07-license-and-storage-gate.md) | Backend | No source enters the repository without licence terms, a named reviewer and an explicit storage decision. | Mutation proof (2). |
| **08** | [The Fleet Census & Doc-Rot Gate](ROBOT-08-doc-rot-and-census-gate.md) | Static Gate | Every robot has spec, ledger row and existing executable; all docs links resolve; no local paths. | `--self-test` (8 defects). |
| **09** | [The Media Link & Privacy Embed Gate](ROBOT-09-media-link-privacy-gate.md) | Backend | Media embed only from `youtube-nocookie.com` / `open.spotify.com`, derived by code, CSP and code agree. (Link liveness: not run.) | Mutation proof (4). |
| **10** | [The Lyrics & Attribution Gate](ROBOT-10-lyrics-attribution-gate.md) | Backend | AI-assisted media name their tools; lyrics only when cleared and licensed; only a human approves; edits withdraw approval. | Mutation proof (4). |

---

## Numbering policy

One continuous sequence (decided 2026-10-01). No reserved blocks.

---

## How to Add a New Robot

1. Take the next free number from the index above.
2. Draft its specification document (`ROBOT-XX-...md`) following the standard template.
3. Implement the script or test.
4. **Prove it can fail** by running negative controls or sabotaging application code (add a mutation to `scripts/robots/sabotage.mjs`). Record the proof in the robot document.
5. Add the executable to `scripts/robots/run.mjs` and name it in the spec's `Executable` row, then add the status row with the date and measurement to [10_Harness/02_Harness_Ledger.md](../10_Harness/02_Harness_Ledger.md).
