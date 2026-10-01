# ROBOT 07 — The License & Cleared-to-Store Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: IMPLEMENTED (2026-10-01).** Live pass/fail lives in the [Harness Ledger](../10_Harness/02_Harness_Ledger.md).
> Fleet Index: [README](README.md)

| Attribute | Specification |
|---|---|
| **Number** | 07 |
| **Tier** | Backend (Vitest, offline) |
| **Guarded code** | `src/lib/server/seed/checklist.ts` (`validateIngestionChecklist`), the seed in `seed/seedData.ts`, and the `sources.cleared_to_store` schema default |
| **Executable** | `tests/robots/robot-07-license-storage.robot.ts` |
| **Run** | `pnpm robots` · sabotage proof: `pnpm robots:sabotage` |
| **Guards** | Copyright compliance, attribution discipline, safe text storage |
| **Proves it can fail** | Mutation proof (2 mutations) and rejected-ingestion fixtures, see §3 |

---

## 1. Why This Exists

Storing full texts of copyrighted books, articles or translations without permission is a legal liability. Public-domain texts and openly licensed ones may be stored in full; commercial commentary may not. ROBOT-07 is the legal firewall at the ingestion boundary: nothing enters the repository without a documented licence, a named reviewer and an explicit storage decision.

---

## 2. Invariant Rules

`validateIngestionChecklist` must reject an item when:

1. **No licence.** `license` is blank or shorter than 5 characters. (There is no fixed licence vocabulary; the text must say the exact terms. A translation labelled "public domain" must say the release was verified.)
2. **No reviewer.** `reviewer` (the curator who checked licence and provenance) is blank. *Earlier drafts called this `reviewed_by`; the field is `reviewer`.*
3. **No decision.** `cleared_to_store` is not an explicit boolean.
4. **Storage without clearance.** `cleared_to_store = false` is allowed only for a movement paraphrase (`origin: paraphrase`) or an AI draft of one; any other origin is rejected.
5. Also rejected: unregistered languages, non-http(s) URLs, missing work, section reference, category, text or origin.

Structural rules:

6. **No back door.** Every production caller of `createSource` (the seed, `POST /api/sources`, the repository page action) goes through the checklist; the robot scans `src/` and fails if a caller does not import it. `createSource` itself does not validate: enforcement is at the boundary.
7. **Defaults are closed.** The `sources.cleared_to_store` column defaults to `0`, and every seed row passes the checklist and is created as `draft`.

Not covered: periodic re-fetching of seed URLs to detect retracted passages (needs the network; verbatim-on-page checking is `pnpm eval` `seed/verify.eval.ts`, 7/7 rows on 2026-10-01 per the transfer letter), and a licence vocabulary. Both are possible follow-ups.

---

## 3. Proof It Can Fail

Mutation proof, measured 2026-10-01 with `pnpm robots:sabotage`:

| Mutation | Result |
|---|---|
| Reviewer requirement removed | caught: 1 test failed |
| Storage-without-clearance rule removed | caught: 1 test failed |
