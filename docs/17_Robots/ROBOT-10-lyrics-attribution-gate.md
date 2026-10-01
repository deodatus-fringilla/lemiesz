# ROBOT 10 — The Lyrics & Attribution Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: IMPLEMENTED (2026-10-01).** Live status lives in the [Harness Ledger](../10_Harness/02_Harness_Ledger.md).
> Fleet Index: [README](README.md)

| Attribute | Specification |
|---|---|
| **Number** | 10 |
| **Tier** | Backend (Vitest, offline) |
| **Guarded code** | `src/lib/server/media.ts` (`validateMedia`, `setMediaStatus`, `updateMedia`), the CHECK constraints in `src/lib/server/migrations/005_media.sql`, `src/lib/server/seed/mediaSeed.ts` |
| **Executable** | `tests/robots/robot-10-media-attribution.robot.ts` |
| **Run** | `pnpm robots` · sabotage proof: `pnpm robots:sabotage` |
| **Guards** | Honest credit for AI-assisted work, lawful storage of lyrics, human authority over what is public |
| **Proves it can fail** | Mutation proof (4 mutations) and rejected-input fixtures, see §3 |

---

## 1. Why This Exists

The movement will present songs made with AI tools (for example the seeded *Iluzja Wolności*, credited by the owner as Suno-assisted). Hiding that would be a credibility risk; storing someone else's lyrics without permission is a legal one. And, as with every other public-facing item, a human, not a pipeline, decides what the Content Engine may suggest.

An earlier draft of this robot promised to confirm that stored lyrics "match the audio" and "match database quotes verbatim". A program cannot listen, and lyrics are not quoted from a source row, so the robot enforces what it can prove: who decided what, and what was declared.

---

## 2. Invariant Rules

1. **Credit.** `ai_assisted = 1` requires non-empty `production_credits` naming the tools. Enforced in `validateMedia` and by a database CHECK.
2. **Lyrics need a decision.** `lyrics_or_transcript` is stored only with `lyrics_cleared_to_store = 1` **and** `lyrics_license` of at least 5 characters. Enforced in code and by a database CHECK. No seed row stores lyrics.
3. **Humans approve.** A `system` actor cannot set `human_approved` (`MediaError`); the approver and time are recorded.
4. **Drafts first.** Every new asset, including seeds, is a `draft`.
5. **Edits withdraw approval.** Changing credits, lyrics, licence, title, artist, link or genre of an approved asset sends it back to `draft` and clears the reviewer.
6. **Cues are human-written** (`linkMedia` refuses a non-human actor and a malformed cue); the Content Engine copies them from the database and never invents one. Covered in `src/lib/server/media.test.ts`.

### Not covered
* Whether the credit text is *true*, or whether a lyrics licence is real. Those are human review decisions; the robot only ensures that they were made and recorded.

---

## 3. Proof It Can Fail

Mutation proof, measured 2026-10-01 with `pnpm robots:sabotage`:

| Mutation | Result |
|---|---|
| AI-assisted works need no credit | caught: 1 test failed |
| Lyrics storable without a clearance decision | caught: 1 test failed |
| The pipeline may approve media | caught: 1 test failed |
| Editing credits keeps an approved asset approved | caught: 1 test failed |
