# ROBOT 01 — The Verbatim Quotation Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: OPEN FOR DISCUSSION & CONSULTATION.**
> Fleet Index: [README](README.md) · Live Status: [10_Harness/02_Harness_Ledger.md](../10_Harness/02_Harness_Ledger.md)

| Attribute | Specification |
|---|---|
| **Number** | 01 |
| **Tier** | Backend / Pipeline |
| **Source** | `src/lib/server/pipeline/cite.ts` & `src/lib/server/pipeline/drafter.ts` |
| **Guards** | Citation truthfulness, zero LLM quotation fabrication |
| **Proves it can fail** | Sabotage test: 1-character altered quote fixture rejected with error |

---

## 1. Why This Exists

In theological and legal debates, citing a holy text, papal encyclical, or international convention with a made-up or slightly altered sentence destroys all credibility instantly.
Large Language Models naturally paraphrase, smooth out grammar, or combine multiple sentences into a single quotation. If this paraphrased output is enclosed in quotation marks, it becomes an ideological vulnerability.

ROBOT-01 enforces that **no quote string can enter an approved argument card, and no quote token `[[src:ID]]` can resolve in the Rhetorical Shield, unless it is a mathematically exact substring of the verified source text in the database.**

---

## 2. Invariant Rules

1. **Exact Substring Match:** For any card claiming `source_quote`, `source_text.content.includes(card.source_quote)` must evaluate to `true`.
2. **Whitespace Normalization:** Multiple consecutive spaces or newlines may be normalized only if the exact character offsets are traced to the source document.
3. **No Phantom Source IDs:** Any citation referencing a `source_id` not present in the retrieved context is immediately stripped before streaming to the client.
4. **Invented Quote Detector:** In the Shield UI, if an LLM outputs quotation marks containing more than 8 words that do not match the cited source, a high-visibility warning banner is attached to the response.

---

## 3. Proof It Can Fail

- **Negative Control:** Pass an argument card where `source_quote` contains a single word altered (e.g. changing *"peace"* to *"harmony"* in *Pacem in Terris §112*).
- **Assertion:** The pipeline's deterministic validator `validateQuoteVerbatim()` throws a `QuoteMismatchError`, aborting card creation.
