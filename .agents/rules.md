# Agent Rules & Architectural Invariants

For complete rules, see [AGENTS.md](../AGENTS.md).

## Summary of Core Invariants
- **No Monolithic Components:** All components must be <100–150 lines. Keep `+page.svelte` files lean (<80–120 lines).
- **Data Reuse:** Recycle existing tables (`sources`, `media_assets`, `arguments`, `meeting_minutes`). Zero parallel data structures.
- **Svelte 5:** Use runes exclusively (`$state`, `$derived`, `$props`, `$effect`).
- **Verbatim Citations:** Zero hallucination. All citations resolve to verified SQLite rows.
- **Verification:** Run `pnpm check` and `pnpm test` before concluding any session.
