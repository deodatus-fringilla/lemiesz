# AGENTS.md · AI Agent Guidelines & Architecture Invariants

> **Project:** Przymierze Lemiesza (`lemiesz`)  
> **Status:** AUTHORITATIVE & BINDING FOR ALL AI CODING AGENTS (Antigravity, Claude, Copilot, Cursor, etc.)  
> **Canon Reference:** [docs/00_Canon/02_Architecture_Manifesto.md](docs/00_Canon/02_Architecture_Manifesto.md) & [docs/00_Canon/03_Rules_of_Engagement.md](docs/00_Canon/03_Rules_of_Engagement.md)

---

## 1. Architectural Invariants (Canon 02)

1. **Single-Process Sovereignty:** Single-process SvelteKit (`@sveltejs/adapter-node`) + embedded SQLite (`better-sqlite3` in WAL mode) + local ONNX multilingual embeddings. Zero external cloud database dependencies.
2. **Local Disk Only:** SQLite WAL requires real POSIX / Windows local disk file locking. Never deploy on or configure UNC paths or network mounts.
3. **Truthful Citations (Zero Hallucination):** No LLM may invent or embellish citations. Every `[[src:ID]]` is validated against database-stored text.
4. **Human Authority Over Public Words:** Only an authenticated human session can set `status = 'human_approved'`. Any edit to public-facing text resets status to `'draft'` and cascades `'stale'` to dependent cards.
5. **Snapshot & Baseline Discipline:** The baseline starting corpus lives in `data/baseline.sql`. Every migration or canonical content change must be snapshotted via `pnpm db:snapshot` and committed with the change.

---

## 2. Frontend Engineering & Svelte 5 Guidelines

### Rule 2.1: NO Monolithic Components (The 150-Line Guardrail)
* **Never create 500–800+ line monolithic pages or components.** Monolithic components are a dead end that makes maintenance, testing, and reasoning painful.
* **Route pages (`+page.svelte`) must be lean orchestrators (<80–120 lines):** Their job is strictly to receive `data`, bind top-level state, and assemble focused child components.
* **Single Responsibility Components (<100–150 lines):** Break every feature down into small, digestible, single-responsibility components.

### Rule 2.2: Reusability & Component Placement
* Place reusable components in `src/lib/components/` (e.g. `ReviewBadge.svelte`, `TopicCard.svelte`).
* Group feature-specific modular components into feature subdirectories:
  * `src/lib/components/media/`
  * `src/lib/components/salon/`
  * `src/lib/components/shield/`
* Prefer reusing existing components (cards, badges, modals, viewports) over reinventing markup.

### Rule 2.3: Modern Svelte 5 Runes Only
* Always use Svelte 5 runes: `$state()`, `$derived()`, `$props()`, `$effect()`.
* Do **NOT** use Svelte 3/4 legacy stores (`writable`, `readable`) in UI components unless interfacing with legacy third-party libraries.
* Do **NOT** use legacy `let:` slot syntax — use Svelte 5 snippets (`{#snippet name()}...{/snippet}` and `{@render name()}`).

---

## 3. Data Model Recycling & Reuse (Zero Duplication)

**Do NOT invent redundant tables or parallel databases.** When building new features (such as `/salon`, debate rooms, hermeneutics, or campaign tools), always recycle and link to the existing canonical tables:

1. **`sources` & `source_texts`:**
   * Canonical texts, Scripture (Biblia), Papal encyclicals, international law (Hague Conventions), philosophical treatises, historical speeches, poetry.
2. **`media_assets`:**
   * All music tracks, YouTube videos, Spotify tracks, podcasts, recorded speeches, artwork, paintings, and visual campaign posters.
3. **`arguments` & `argument_texts`:**
   * Rhetorical counter-punches, opponent claims, debate cards, and fallacy classifications.
4. **`correspondence_threads` & `correspondence_letters`:**
   * External diplomatic and political correspondence dossiers (e.g. Korona/Braun).
5. **`meeting_minutes`:**
   * Team deliberations, operational minutes, tactical analyses, and actionable to-do items (`action_items_json`).

Any new analytical or debating feature should reference `media_id`, `source_id`, or `argument_id` via foreign keys rather than storing duplicate copies of lyrics, scripture, or audio links.

---

## 4. Full-Text Search (FTS5) & Internationalization (i18n)

1. **FTS5 Triggers:** All content tables searchable by text must maintain external-content FTS5 virtual tables synchronized via SQLite `AFTER INSERT`, `AFTER UPDATE`, and `AFTER DELETE` triggers with `tokenize = 'unicode61 remove_diacritics 2'`.
2. **Paraglide i18n:**
   * Every user-facing string must be localized via Paraglide (`$lib/paraglide/messages.js`).
   * When adding a key to `messages/pl.json`, the **exact same key** must be added to `messages/en.json`.
   * Run `pnpm paraglide` after modifying message files.

---

## 5. Verification Checklist (Before Completing Any Task)

Every AI coding session must ensure all three gates are GREEN:
1. `pnpm check` — Must report `0 errors and 0 warnings` (svelte-check + TypeScript).
2. `pnpm test` — All test suites (unit, baseline, restore drill) must pass.
3. `pnpm db:snapshot` — If schema migrations or baseline data were touched, update `data/baseline.sql` and verify with `pnpm vitest run src/lib/server/corpus.baseline.test.ts`.
