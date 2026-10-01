# ROBOT 01 — The Verbatim Quotation Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: IMPLEMENTED (2026-10-01).** Live pass/fail lives in the [Harness Ledger](../10_Harness/02_Harness_Ledger.md).
> Fleet Index: [README](README.md)

| Attribute | Specification |
|---|---|
| **Number** | 01 |
| **Tier** | Backend (Vitest, offline) |
| **Guarded code** | `src/lib/server/pipeline/spancheck.ts` (`spanInText`, `verifySpans`) and `src/lib/server/shield/cite.ts` (`CitationStreamer`, `findUnverifiedQuotes`) |
| **Executable** | `tests/robots/robot-01-verbatim-quotation.robot.ts` |
| **Run** | `pnpm robots` · sabotage proof: `pnpm robots:sabotage` |
| **Guards** | Citation truthfulness: no model-written quotation reaches a card or an answer |
| **Proves it can fail** | Mutation proof (3 mutations) and a one-word-altered fixture, see §3 |

---

## 1. Why This Exists

In theological and legal debates, citing a papal encyclical or an international convention with a made-up or slightly altered sentence destroys credibility instantly. Language models paraphrase, smooth grammar and merge sentences; if the result is put in quotation marks it is an ideological vulnerability.

ROBOT-01 enforces that **no quotation can enter an argument card, and no citation can resolve in the Rhetorical Shield or Content Engine, unless it is verbatim text from a stored source.**

---

## 2. Invariant Rules

1. **Exact substring after typographic normalisation.** `spanInText(span, text)` is true only if the span occurs in the text after `normalizeForSpan`: Unicode NFKC, quote and dash variants unified, footnote markers `(59)` removed, diacritics and case ignored, whitespace collapsed. Words are never normalised: one altered word fails.
2. **Minimum length.** A span shorter than `MIN_SPAN_CHARS` (20) proves nothing and fails.
3. **Linked source only.** `verifySpans` fails a span whose `source_id` is not among the card's linked sources (`source_not_linked`), whose source has no stored text (`source_missing`), or that is not in that source's text in any language (`not_in_source`). A card with no spans fails.
4. **Deterministic traps need no LLM.** The `fabricated_quote` and `misattributed` cards in `eval/bad-cards.json` must fail `verifySpans`; the sound controls must pass it.
5. **No phantom citations.** `CitationStreamer` strips `[[src:ID]]` / `[[quote:ID]]` tokens whose ID is not in the retrieved set, including tokens split across stream chunks, and expands `[[quote:ID]]` only from database text.
6. **Typed quotations are flagged.** `findUnverifiedQuotes` flags a quoted passage of 40+ characters in a Shield answer that is in none of the retrieved sources.

Not covered by this robot: whether a seed row is verbatim on the *publisher's* page. That needs the network and is `pnpm eval` (`seed/verify.eval.ts`).

---

## 3. Proof It Can Fail

Fixture: a Pacem in Terris §127 span with *justice* changed to *harmony* must be rejected.

Mutation proof, measured 2026-10-01 with `pnpm robots:sabotage` (each mutation breaks one line, the robot must turn red, the file is restored):

| Mutation | Result |
|---|---|
| `spanInText` always returns true | caught: 5 tests failed |
| `verifySpans` ignores the linked-source rule | caught: 1 test failed |
| `CitationStreamer` accepts IDs outside the retrieved set | caught: 1 test failed |
