# Canon 02 · Architecture Manifesto

> **Doc type: DURABLE RULING.**
> **STATUS: AUTHORITATIVE.**
> Summarizes the non-negotiable architectural invariants of **Przymierze Lemiesza (`lemiesz`)**. Detailed specifications live in [implementation_plan.md](../implementation_plan.md) and live verification status in the [Harness Ledger](../10_Harness/02_Harness_Ledger.md).

---

## 1. Priority Order of Design Values

1. **Truthful Citations:** No model may invent, embellish, or paraphrase text inside quotation marks. Every `[n]`, `[[src:ID]]`, `[[quote:ID]]`, and `[[media:ID]]` token is validated against retrieved records and expanded from immutable SQLite rows.
2. **Human Authority Over Public Words:** Only an authenticated human session can set `human_approved` ([ROBOT-02](../17_Robots/ROBOT-02-trust-tier-write-boundary.md)). Any edit to public-facing text resets approval to `draft` and cascades `stale` to dependent argument cards.
3. **Low Running Cost & Sovereignty:** Zero external cloud databases or mandatory SaaS dependencies. Single-process SvelteKit (`@sveltejs/adapter-node`) + embedded SQLite (`better-sqlite3` in WAL mode) + local ONNX multilingual embeddings.
4. **Simplicity:** Plain Server-Sent Events (SSE), Svelte 5 Runes (`$state`, `$derived`, `$effect`), compile-time Paraglide i18n, and language as data rather than schema columns.
