# ROBOT 02 — The Trust-Tier Write Boundary

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: IMPLEMENTED (2026-10-01).** Live pass/fail lives in the [Harness Ledger](../10_Harness/02_Harness_Ledger.md).
> Fleet Index: [README](README.md)

| Attribute | Specification |
|---|---|
| **Number** | 02 |
| **Tier** | Backend (Vitest, offline) |
| **Guarded code** | `src/lib/server/review.ts` (state machine), `src/lib/server/rag/trust.ts` and the trust filter inside `src/lib/server/rag/retrieve.ts` |
| **Executable** | `tests/robots/robot-02-trust-tier-boundary.robot.ts` |
| **Run** | `pnpm robots` · sabotage proof: `pnpm robots:sabotage` |
| **Guards** | Trust-tier integrity, stale cascade on source edit, human authority |
| **Proves it can fail** | Mutation proof (5 mutations), see §3 |

---

## 1. Why This Exists

An AI can produce arguments at scale, but public advocacy needs human accountability. Review states:
1. `human_approved`: vetted by a signed-in human.
2. `ai_verified`: drafted and audited by independent AI models, awaiting human sign-off.
3. `draft` / `flagged` / `stale`: incomplete, contested or invalidated.

If an unapproved or stale card leaks into a press release or thread, the movement speaks without human authorisation.

---

## 2. Invariant Rules

1. **Content Engine default.** `allowedReviews('content')` is exactly `['human_approved']`. Retrieval enforces it inside `retrieve()`, so no UI bug can leak a card. Fixture: one `human_approved`, one `ai_verified`, one `draft` card on the same topic return only the approved one.
2. **Override is never silent.** `allowAiVerifiedInContent` adds `ai_verified` (never draft, flagged or stale, whatever other options are set) and sets `watermark = true`; output is then watermarked (`needsWatermark`).
3. **Authority split.** A `system` actor cannot set `human_approved`; a `human` actor cannot set `ai_verified` or `stale` (`ReviewTransitionError`). Actors are built from the validated session or from pipeline code, never from a request body, and every transition is written to `review_events` with `human:<name>` or `system:<name>`.
4. **Edit resets.** Editing a source text resets that text to `draft`, and every dependent `ai_verified` **or `human_approved`** argument card becomes `stale` (`markDependentsStale`). Draft cards are left alone (nothing to invalidate).

### Decision (architect, 2026-10-01)

The cascade covers `human_approved` cards too. An earlier version left approved cards untouched, so a card could stay approved after its source was edited and its quoted span no longer matched. Now the card becomes `stale` and needs the pipeline's re-audit and a human's re-approval. `human_approved` → `stale` is permitted only to the system actor (`canTransition`); a human still cannot set `stale`.

---

## 3. Proof It Can Fail

Mutation proof, measured 2026-10-01 with `pnpm robots:sabotage`:

| Mutation | Result |
|---|---|
| Content policy allows `ai_verified` and `draft` | caught: 2 tests failed |
| A human may set any state | caught: 1 test failed |
| The pipeline may set any state | caught: 1 test failed |
| Source edits no longer stale human-approved cards | caught: 1 test failed |
| Source edits no longer stale any card | caught: 1 test failed |
