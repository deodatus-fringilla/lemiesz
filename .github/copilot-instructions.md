# GitHub Copilot Instructions for Przymierze Lemiesza

This repository follows the engineering standards documented in [AGENTS.md](../AGENTS.md).

## Core Principles
1. **Component Modularity:** Never generate monolithic components of 500+ lines. Break UI features into small, focused subcomponents (<100–150 lines each) inside `src/lib/components/`.
2. **Svelte 5 Runes:** Use `$state()`, `$derived()`, `$props()`, and `$effect()`. Do not use Svelte 3/4 stores (`writable`) or legacy slot syntax.
3. **Data Recycling:** Reuse existing SQLite tables (`sources`, `media_assets`, `arguments`, `meeting_minutes`) instead of creating redundant schemas.
4. **Trust Boundary:** Only humans set `human_approved`. Edits reset text to `draft`.
5. **Quality Gates:** Always verify code compiles cleanly with `pnpm check` and tests pass with `pnpm test`.
