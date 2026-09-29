# Implementation Plan v2 — Pakt Lemiesza (PL) Management Center & Internal Second Brain

**Status:** Authoritative. Supersedes `implementation_plan.v1.md`.
**Basis:** Consensus in `docs/discussions/implementation_plan_critique.md` (§6–§13). References like *(§12.3 t)* point to that document.

A secure, lightweight, **bilingual (Polish default, English second, open to more)** internal web application for the core team of **Pakt Lemiesza (PL)** (*The Plowshare Pact*). It combines:

- an **Ideological Repository** of canonical sources and a curated argument taxonomy;
- a **Rhetorical Shield**: retrieval-grounded debate defence in which every citation is verifiable;
- a **Content Engine** for platform-specific drafts (X, Facebook, Shorts/TikTok, press statements) that a human reviews before publishing.

Design values, in priority order: **truthful citations → human authority over public words → low running cost → simplicity.**

---

## 1. Assumptions & Owner Decisions

### Decided (owner, §11.1 / §13)

| Topic | Decision |
| :-- | :-- |
| Languages | Polish (default) + English now; more later without migrations |
| Hosting | One Docker image, two modes: **VPS behind Caddy** or **local machine over Tailscale**. DB on a local disk in both |
| LLM policy | **Paid, non-training API tier only.** Nothing but the public seed corpus ever goes to a free tier that may train on inputs |
| Editorial workflow | Automated **Drafter + Auditor** pipeline, with the human authority rules in §7 |
| Public content | `human_approved` cards only by default. Explicit override watermarks the draft (§7.4) |
| Seed licensing | Phase 1 ingests only official/public-record texts. Encumbered translations are stored as metadata + movement-authored paraphrase (§9) |
| Social media | Formatting and generation in scope. **No publishing API integrations in v1**: copy or markdown export only |

### Assumptions pending owner confirmation

- Team size 3–10.
- Running-cost target is "as low as practical". Candidate figure: a few USD/month for hosting plus LLM. **Prices and model names are not fixed by this plan and must be checked at implementation time.**
- Named reviewers for the argument taxonomy and for translations (needed before Phase 2 exits).

---

## 2. Architecture

```
+-----------------------------------------------------------------------------+
|                   Svelte 5 frontend (runes) + Paraglide JS                  |
|  Dashboard · Repository · Shield · Content Engine · Review queue · Settings |
+-----------------------------------------------------------------------------+
                  |  SvelteKit endpoints (+server.ts), SSE streams
+-----------------------------------------------------------------------------+
| hooks.server.ts: session auth · rate limiting · locale resolution           |
+-----------------------------------------------------------------------------+
|  Retrieval (rag/)            Generation (llm/)          Pipeline (scripts/) |
|  FTS5 BM25 per locale        LlmProvider interface      Drafter → span      |
|  + vector scan (RAM)         Embedder interface         check → Auditor     |
|  + RRF, trust-tier filter    citation validator         eval harness        |
+-----------------------------------------------------------------------------+
|              SQLite (better-sqlite3, WAL) on a LOCAL disk: /data            |
+-----------------------------------------------------------------------------+
```

Key choices (all ratified):

- **`@sveltejs/adapter-node`** (replaces `adapter-auto`). Native bindings cannot run on serverless. *(§3.1)*
- **Hybrid retrieval**: SQLite FTS5 (BM25) + in-RAM vector scan, fused with **Reciprocal Rank Fusion**. No `sqlite-vec`. Corpus is small, so brute-force is fast. Revisit above ~50k chunks. *(§6.1, §7.1 b)*
- **Vector cache** on `globalThis.__vectorCache`, loaded lazily on first query and invalidated by write endpoints. This avoids the Vite HMR duplication problem.
- **No vendor SDK outside `src/lib/server/llm/`.** Provider and embedder are chosen by configuration. *(§10.2 #4)*
- **Plain SSE** over `fetch` + `ReadableStream`. No `@ai-sdk/svelte`. *(§7.2 3)*

---

## 3. Data Model

**Principle:** a language is data and configuration, never schema. No `*_pl` / `*_en` columns. *(§8.2)*

### 3.1 Locale registry (`src/lib/i18n/locales.ts`)

```ts
export const LOCALES = {
  pl: { label: 'Polski',  fts: 'unicode61 remove_diacritics 2',        minPrefix: 4, stemMode: 'keywords' },
  en: { label: 'English', fts: 'porter unicode61 remove_diacritics 2', minPrefix: 3, stemMode: 'porter'   }
} as const;
export const DEFAULT_LOCALE = 'pl';
// Languages we may STORE source text in, but do not offer as UI/output languages
// (e.g. Latin, German, French, Italian for encyclicals and Swiss documents).
export const ORIGINAL_ONLY = ['la', 'de', 'fr', 'it'] as const;
```

The registry drives FTS table creation, the UI switcher, prompt templates and validation. Adding a language = a registry entry + a message file + content + a golden-set subset.

### 3.2 Tables

Language-neutral identity rows, plus one translation row per locale.

| Table | Columns (abridged) | Notes |
| :-- | :-- | :-- |
| `sources` | `id, work, section_ref, category, url, license, cleared_to_store, original_locale, version, source_hash, updated_by, updated_at` | Identity, e.g. *Pacem in Terris §127*. `original_locale` may be an original-only language |
| `source_texts` | `source_id, locale, text, keywords, origin, review, translator, audit_json, audit_notes, drafter_model, auditor_model, prompt_version, source_hash` | PK `(source_id, locale)`. **The only text that may be quoted.** `text` is empty/paraphrase-only when `cleared_to_store = 0` |
| `arguments` | `id, fallacy_type, core_principle, tags, updated_by, updated_at` | Taxonomy entry |
| `argument_texts` | `argument_id, locale, opponent_claim, counter_punch, keywords, origin, review, supporting_spans_json, audit_json, audit_notes, drafter_model, auditor_model, prompt_version, source_hash` | PK `(argument_id, locale)` |
| `argument_sources` | `argument_id, source_id` | Links arguments to canonical sources |
| `embeddings` | `owner_type, owner_id, locale, model, dim, vector BLOB` | PK `(owner_type, owner_id, locale, model)`. Only the active model's rows are queried |
| `conversations`, `messages` | `messages(conversation_id, role, content, locale, sources_json, created_at)` | |
| `users`, `sessions` | | Auth (§8) |
| `review_events` | `id, owner_type, owner_id, locale, from_review, to_review, actor, reason, at` | Audit trail of every state change |
| `fts_<locale>` | FTS5 virtual tables, one per registered locale, built from the registry's tokenizer string | Backfilled when a locale is added |

### 3.3 Provenance vs. review (two columns, not one) *(§12.3 s)*

- `origin`: `original | official_translation | human_translation | machine_translation | ai_drafted`
- `review`: `draft | flagged | ai_verified | human_approved | stale`

Transitions:

- Only a human can set `human_approved`.
- **Any edit** to a card's text or linked sources resets `review` to `draft`.
- A change to the canonical source text, the audit prompt version or the auditor model marks dependent `ai_verified` cards `stale` for re-audit.
- Every transition writes a `review_events` row.

### 3.4 SQLite settings

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
```

**WAL requires a local filesystem.** On startup the app refuses to run (or fails loudly) if the DB path is a UNC path or a detected network mount. Backups use `VACUUM INTO` or the SQLite backup API on a schedule, written to a second location. *(§8.1)*

---

## 4. Retrieval Pipeline (`src/lib/server/rag/`)

1. **Locale handling.** Query locale = UI locale or explicit override, with a cheap script and stopword heuristic for auto-detection. Output locale = UI locale or explicit request.
2. **Lexical search.** FTS5 BM25 on the query locale's table (plus other locales when detection is uncertain). Prefix wildcards (`pokoj*`) are enforced with the per-locale `minPrefix`. The per-locale `keywords` column carries hand-curated forms for Polish inflection *(§7.2 1, §8.1)*.
3. **Vector search.** Multilingual embeddings over all locales, which gives cross-lingual retrieval. The `Embedder` module hides model quirks (e.g. e5 `query:` / `passage:` prefixes).
4. **Fusion.** RRF at the level of the **neutral entity** (`source_id` / `argument_id`), so a card that matches in both languages counts once.
5. **Two-tier order.** Match the claim against `arguments` first and pull their linked `sources`. If the best score is under the threshold, fall back to general `sources` search. If that also fails, return the deterministic **"no strong source found"** state, and the model is not asked to improvise. *(§6.3 d)*
6. **Trust-tier filter (enforced here, not only in the UI).** See §7.4.
7. **Output text resolution** per entity: the output-locale row if `review` is acceptable, otherwise the `original_locale` text, **visibly labelled** ("original text, DE, no PL translation yet"). *(§8.2 j)*

### Quotation integrity *(§6.3 f, §7.1, §8.2 j)*

- The model emits citation tokens such as `[[src:42]]` and never writes quotations itself.
- The server validates every token against the retrieved set (an unknown ID is stripped and logged), then replaces it with the immutable DB text and reference.
- Machine translations of quotations are never shown silently. They must carry a `machine_translation` badge.

### Prompt-injection posture

Retrieved text is wrapped in delimited data blocks and the model is told to treat it as untrusted. Write endpoints require auth and record `updated_by`.

---

## 5. LLM & Embedding Layer (`src/lib/server/llm/`)

```ts
interface LlmProvider {
  stream(req: ChatRequest): AsyncIterable<Token>;
  structured<T>(req: ChatRequest, schema: Schema<T>): Promise<T>;
  readonly id: string;               // recorded on every generated/audited card
}
interface Embedder {
  embedQuery(text: string): Promise<Float32Array>;
  embedPassage(text: string): Promise<Float32Array>;
  readonly model: string; readonly dim: number;
}
```

- **Providers are config-selected** (`LLM_PROVIDER`, `EMBEDDER`, keys via `$env/dynamic/private`, never committed).
- **Requirements** for any provider: strong Polish, streaming, structured output, a **contractual no-training-on-API-data** policy. Model names and prices are checked at implementation time.
- **Embeddings:** default local multilingual model (e.g. `multilingual-e5-small` via the current `@huggingface/transformers`). API embeddings are a config swap. Changing the model triggers a re-index job. Verify `onnxruntime-node` builds for the target architecture (arm64 VPS tiers).
- **Drafter and Auditor use different model families**, both via `LlmProvider`. *(§12.3 q)*

---

## 6. Modules & UI

Svelte 5 runes (`$state`, `$derived`, `$effect`); Tailwind CSS; dark/light theme; `lucide-svelte` icons.

- **Dashboard `/`**: principles, quick argument lookup, recent sessions, and pipeline health (flagged queue size, stale count, last eval results).
- **Repository `/repository`**: category filters (`magisterium`, `economics`, `geopolitics`, `rebuttals`); lexical + semantic search; source/argument inspector and editor; **translation coverage per locale** (also the editorial to-do list); status filters and badges.
- **Rhetorical Shield `/shield`**: strategy presets ("Swiss Shield", "Double Distance", "Plowshare Paradox"; names per locale); streamed answers; **source-tracking pane** fed by the SSE `sources` event; badges for `ai_verified` cards; explicit "no strong source" state.
- **Content Engine `/content`**: see below.
- **Review queue `/review`**: the `flagged` list, the 10% `ai_verified` sample, the `stale` list, and cards ranked by Shield usage. Approving is one click and writes a `review_events` row.
- **Settings**: locale, theme, provider status (no secrets shown), the "include drafts" toggle (badged when on).

### 6.1 Content Engine

Platform templates and tone presets, per locale (Polish press style ≠ English press style):

| Target | Format |
| :-- | :-- |
| **X** | Multi-post thread, hook-driven, 280-char limit enforced per post, citation tags |
| **Facebook** | Long-form, conversational and pastoral tone, paragraph spacing |
| **Shorts / TikTok** | 30–60 s spoken script with cues (e.g. *[Pause]*, *[Show graphic: quote]*) |
| **Press statement** | Formal, dated, canonical citations |

- Explicit `outputLocale`. Prompts are locale templates, not English prompts with "answer in Polish" appended.
- Flow: **draft → human review → copy/markdown export.** The retrieved sources and their `review` state sit beside the draft.
- **No publishing integrations in v1.**

### 6.2 SSE contract (`/api/chat`, `/api/content`)

| Event | Payload |
| :-- | :-- |
| `sources` | Retrieved entities with scores, badges and resolved text. **Sent first** so the pane fills before the tokens |
| `token` | Text delta (may contain `[[src:N]]`, which the server resolves before sending) |
| `done` | Final message id, citation list, watermark flag |
| `error` | Code + safe message |

### 6.3 UI i18n

**Paraglide JS**: compile-time, typed, tree-shaken. `messages/pl.json` is the base and `messages/en.json` the second. A build-time check fails if any key is missing from any locale. Locale is stored in a cookie or the user profile, with **no URL prefixes**. Dates and numbers use `Intl`.

---

## 7. Content Pipeline: Drafter + Auditor

### 7.1 Flow

```
canonical source_texts
        │
        ▼
Drafter (model family A) ──► card(s) with source_ids + exact supporting span(s)   review=draft, origin=ai_drafted
        │
        ▼
Deterministic span check (code, no LLM)
   span ⊂ canonical source_texts (whitespace/diacritic-normalised)?   no → reject
        │
        ▼
Auditor (model family B) ──► structured verdict per criterion: pass | fail | unsure (+ one-line reason)
        │
   all pass ─────────────► review=ai_verified
   anything else ────────► review=flagged
```

### 7.2 Auditor rubric

Gating criteria (all must `pass`):

1. **Source fidelity.** Every claim is supported by the supplied spans. Nothing is attributed to the source that is not in it.
2. **Doctrinal alignment.** Consistent with Active Neutrality, Subsidiarity and Double Distance, and does not fall into known opponent traps.
3. **Terminology and translation accuracy.** Canonical concepts (*bonum commune*, *ordo iuris*, active neutrality) are rendered exactly.

Advisory (recorded in `audit_notes`, may rank cards, **never gates**): 4. rhetorical efficacy.

Stored per card: `audit_json`, `audit_notes`, `drafter_model`, `auditor_model`, `prompt_version`, `source_hash`. There is no numeric confidence score.

### 7.3 Human oversight, cheap and by exception

- The `flagged` queue is the main human worklist.
- A **random 10% sample** of `ai_verified` cards goes to the human queue. The disagreement rate is tracked, and above a threshold the auditor prompt or model is treated as broken.
- Review order is by Shield usage frequency (highest impact first).

### 7.4 Trust tiers *(§12.3 t, §13.1)*

| `review` | Shield (internal practice) | Content Engine (public output) |
| :-- | :--: | :--: |
| `human_approved` | Yes | Yes |
| `ai_verified` | Yes, badge **"AI-verified, not human-approved"** | **No by default.** Explicit override checkbox allowed; output is **watermarked** for editorial review |
| `flagged`, `draft`, `stale` | No (unless "include drafts", badged) | No |

Machine translations of quotations remain `machine_translation` and subject to the §4 quotation rules regardless of `review`. Enforcement lives in the retrieval layer.

### 7.5 Testing the pipeline *(§12.3 v)*

The golden set includes **seeded bad cards**: fabricated quotes, misattributed sources, off-doctrine punches, and subtly wrong translations. The auditor's **catch rate on these** is an acceptance criterion. If it misses too many, it gates nothing. The check re-runs whenever the auditor model or prompt changes.

---

## 8. Security, Privacy & Operations

- **Auth in v1:** team passphrase or per-user login with a session cookie, verified in `hooks.server.ts`. Applies even behind Tailscale.
- **Rate limiting:** in-memory sliding window on `/api/*`, especially chat, content and pipeline endpoints. This protects the LLM budget.
- **Secrets:** environment variables only. `.env` is git-ignored and an `.env.example` is shipped.
- **Privacy:** paid, non-training tier only for anything beyond the public seed corpus. Provider terms are recorded in the repo docs when chosen.
- **Logging:** log request metadata and errors, not full prompts and responses by default.
- **Backups:** scheduled `VACUUM INTO` to a second location, with a documented restore drill.

### 8.1 Deployment (one image, two modes) *(§11.1)*

- `Dockerfile` (multi-stage, `adapter-node`) and `docker-compose.yml` with a `/data` volume holding `lemiesz.db`.
- **Mode A, VPS:** enable the Caddy profile for automatic HTTPS.
- **Mode B, local / Tailscale:** no proxy profile. Reachable only over the tailnet.
- Build and smoke-test on the **target architecture** (arm64 for the cheapest VPS tiers). This covers `better-sqlite3` prebuilds and `onnxruntime-node`.
- The container refuses to start if `/data` is not a local filesystem.

---

## 9. Seed Corpus & Licensing *(§10.2 #6, §11.1 4, §12.1)*

Every source goes through an ingestion checklist before it is stored:

`work · section_ref · url · license (exact terms, not "public domain" unless it is) · original_locale · origin · cleared_to_store (yes/no) · reviewer`

| Text | Phase 1 handling |
| :-- | :-- |
| *Pacem in Terris*, *Gaudium et Spes* | Official Holy See texts (reproduction with attribution). Polish official text from the Holy See or an official Polish Church source. Record the exact terms |
| Swiss neutrality documents (FDFA) | Official public records. Original language may be DE/FR/IT and is stored as original-only, with labelled fallback |
| PL Manifesto, Double Distance Strategy | Movement-authored, canonical Polish |
| Bastiat, *The Law* (modern Polish editions) | **Metadata, section refs and movement-authored paraphrase only** until redistribution rights are verified |

The team makes a per-text human decision on `cleared_to_store` before ingestion.

---

## 10. Evaluation Harness (`scripts/eval/`)

- **Golden set**: 30–50 real attack lines, tagged by locale, each with expected sources or arguments. Covers **PL→PL, EN→EN, PL→EN and EN→PL**.
- Reports **recall@5** for FTS-only, vector-only and hybrid, per locale pair. The hybrid choice rests on these numbers.
- **Seeded bad cards** for the auditor (§7.5).
- **Citation-validator tests**: an unknown `[[src:N]]` is stripped, and a quote is never model-authored.
- Acceptance for a new language = a passing golden subset for it.
- Unit tests (Vitest) for `rag/`, the span checker, the trust-tier filter and the locale registry. A **smoke test** starts the built server and calls the chat endpoint.

---

## 11. Dependencies & Workspace Changes

Package manager: **pnpm** (existing lockfile).

- **Replace:** `@sveltejs/adapter-auto` → `@sveltejs/adapter-node`.
- **Add (runtime):** `@huggingface/transformers` (local embeddings, pin current), `lucide-svelte`, `clsx`, `tailwind-merge`, `@inlang/paraglide-js` (SvelteKit integration).
- **Add (dev):** `tailwindcss`, `@tailwindcss/vite`, `vitest`.
- **Already present:** `better-sqlite3`, `@types/better-sqlite3`.
- **Do not add:** `sqlite-vec`, `@ai-sdk/svelte`.
- Vendor LLM SDKs only inside `src/lib/server/llm/`, if used at all. Plain `fetch` is preferred.
- The file links in v1 pointed to a UNC path and are dropped. All paths below are workspace-relative.

---

## 12. Project Structure

```
src/
  hooks.server.ts                 auth, rate limit, locale
  lib/
    i18n/locales.ts               registry
    server/
      db.ts                       connection, pragmas, migrations, local-disk check
      migrations/                 numbered SQL files
      rag/                        fts.ts, vectors.ts, fuse.ts, resolve.ts, trust.ts
      llm/                        provider.ts, embedder.ts, providers/*
      cite.ts                     [[src:N]] validation + substitution
      pipeline/                   drafter.ts, spancheck.ts, auditor.ts, transitions.ts
      seed/                       ingestion checklist + seed data
  routes/
    +layout.svelte  +page.svelte
    repository/  shield/  content/  review/  settings/
    api/chat/  api/content/  api/chunks/  api/review/
messages/                         pl.json, en.json
scripts/                          reindex.ts, bootstrap-taxonomy.ts, eval/
Dockerfile  docker-compose.yml  Caddyfile  .env.example
```

---

## 13. Phased Roadmap

Within every phase: **complete and evaluate Polish first, then English.**

| Phase | Scope | Exit criteria |
| :-- | :-- | :-- |
| **0. Foundation** | Scaffold, `adapter-node`, Tailwind, Paraglide, locale registry, DB schema + migrations + pragmas + local-disk check, `LlmProvider` / `Embedder` interfaces, auth + rate limiting skeleton, Docker for both modes tested on the target architecture, `.env.example` | App boots in Docker; migrations run; empty UI in PL/EN; missing message keys fail the build |
| **1. Sources & lexical search** | Ingestion checklist and seed (cleared texts only), sources CRUD, per-locale FTS, repository UI with coverage and status filters | Team can search and edit sources in PL and EN; every source has a recorded licence and `cleared_to_store` |
| **2. Taxonomy & hybrid retrieval** | `arguments`, embeddings, RRF, two-tier retrieval, trust-tier filter, Drafter + span check + Auditor scripts, review queue, `review_events`, golden set and seeded bad cards | recall@5 measured per locale pair; auditor catch-rate target met; named reviewers exist; draft content is provably excluded from retrieval |
| **3. Shield** | SSE contract, citation validator, source pane, badges, "no strong source" state, presets | Unknown citation IDs never reach the UI; every quote is DB text; golden-set answers cite expected sources |
| **4. Content Engine** | Platform templates and tone presets per locale, human-review flow, watermark on override, copy/markdown export | Public drafts use only `human_approved` cards by default; watermark appears on override |
| **5. Dashboard & polish** | Pipeline health, usage-ranked review queue, 10% sampling, backups + restore drill, docs | Restore drill passes; sampling disagreement rate reported |

---

## 14. Verification Plan

### Automated

1. `pnpm check` (svelte-check) and `pnpm test` (Vitest).
2. `pnpm build`, then a **smoke test** of the built server: it starts, migrates, serves `/api/chat`, and loads native bindings.
3. `pnpm eval`: recall@5 per locale pair; seeded-bad-card catch rate.
4. i18n key-parity check across locales.
5. Docker build on the target architecture.

### Manual

1. **Retrieval:** exact-cite queries ("*Pacem in Terris* §127") and inflected Polish queries (*pokoju*, *lemiesza*) return the right sources.
2. **Cross-lingual:** a Polish attack line retrieves an English-only source, labelled correctly.
3. **Shield:** attacks such as "Russian appeasers and isolationists" pull argument cards and update the source pane. Weak queries give "no strong source".
4. **Trust tiers:** a `flagged` or `draft` card never appears. An `ai_verified` card shows its badge in the Shield and is absent from Content Engine drafts unless the override is ticked, which watermarks the draft.
5. **State machine:** editing a card resets it to `draft`. Changing a source marks dependants `stale`.
6. **Deployment:** the same image runs in Mode A and Mode B. It refuses to start on a network path.

---

## 15. Risks & Mitigations

| Risk | Mitigation |
| :-- | :-- |
| Invented or misattributed citations | Citation tokens, server-side validation, DB-only quotes, span check, "no strong source" state |
| AI-graded-AI blind spots | Different model families, deterministic span check, pass/fail rubric, 10% human sampling, seeded-bad-card evaluation |
| Unreviewed AI text in public speech | Trust-tier table in the retrieval layer, watermark on override, copy-only output |
| Polish inflection hurts recall | Prefix search, per-locale `keywords`, multilingual embeddings, per-locale golden set |
| Licensing violation | Ingestion checklist, `cleared_to_store`, paraphrase-only for encumbered texts |
| Leaked strategy via LLM provider | Paid non-training tier, provider abstraction, no logging of full prompts |
| Budget burn from a leaked URL | Auth, rate limiting, provider spend caps |
| Provider/model churn and price drift | Interfaces, config-selected providers, re-index job, prices checked at implementation time |
| Scope creep from bilingual work | Polish-first inside each phase; registry and schema built in Phase 0 |

---

## 16. Open Items

1. Owner confirmation of the assumptions in §1.
2. Named taxonomy and translation reviewers (needed by the end of Phase 2).
3. Per-text `cleared_to_store` decisions (needed before Phase 1 ingestion).
4. Provider selection, with current pricing and terms verified.
5. Final Auditor pass-rate and sampling-disagreement thresholds, to be set from the first evaluation runs.
