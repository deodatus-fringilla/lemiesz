# Pakt Lemiesza — Management Center & Second Brain

Internal, bilingual (Polish default, English second) knowledge base and debate-defence tool for the
core team of Pakt Lemiesza. SvelteKit 5 + SQLite (FTS5) + in-RAM vector search, no external
infrastructure.

The authoritative design is [docs/implementation_plan.md](docs/implementation_plan.md); the
decisions behind it are in [docs/discussions/implementation_plan_critique.md](docs/discussions/implementation_plan_critique.md).

## What works today (Phases 0–5)

- **Repository** — canonical sources per language, with licence/provenance checklist, translation coverage, human review.
- **Arguments** — opponent claim → counter-punch → sources, per language.
- **Review queue** — flagged / stale / draft items and a random spot-check sample of AI-verified cards, most-used first.
- **Retrieval engine** — FTS5 + multilingual vectors fused with RRF, two-tier (arguments → sources → "no strong source"), trust-tier filtering.
- **Drafter + Auditor pipeline** — AI drafts cards with exact quotes; code verifies the quotes are verbatim in the source; an independent model audits. Only a human can approve.
- **Shield** — paste an attack; evidence is retrieved first (trust-filtered), the answer streams over SSE, every citation is validated against what was retrieved and the quotation shown is database text. With no strong source the model is not called. Works without a chat model as an evidence browser.
- **Content Engine** — drafts for X threads, Facebook, Shorts/TikTok scripts and press statements in Polish or English, built only from human-approved material (an explicit override allows AI-verified cards and watermarks the draft). Deterministic checks, human review step, copy and markdown export. Nothing is published automatically.
- Login, rate limiting, Docker (VPS or Tailscale).

- **Operations** — dashboard with system health and operator warnings, scheduled verified backups with a restore drill, user management and password change, security headers and CSP. See [docs/OPERATIONS.md](docs/OPERATIONS.md).

All five planned phases are implemented. Open items are owner decisions and content (see the plan, §16 and §17-§20): real LLM access, reviewers, Polish source texts, the movement's own texts and doctrine wording, a larger golden set.

## Trust rules in one paragraph

Every text has a `review` state. **Only a signed-in human can set `human_approved`.** Editing a text
resets it to `draft`. The pipeline can set `ai_verified` / `flagged` / `stale`, never `human_approved`.
The Shield may use `human_approved` and `ai_verified` cards (badged); public Content Engine output
uses `human_approved` only, unless a user explicitly overrides, which watermarks the draft.

## Develop

Requires Node 22+ and pnpm.

```sh
pnpm install
cp .env.example .env        # then edit; for local dev you can set AUTH_DISABLED=true
pnpm dev
```

First start creates `./data/lemiesz.db` (must be a **local** disk — SQLite WAL), applies migrations
and seeds the starter corpus as **drafts**. Approve texts in the Repository after reading them.

To sign in you need a user: set `ADMIN_USERNAME` and `ADMIN_PASSWORD` (12+ characters) before the
first start, or use `AUTH_DISABLED=true` for local development only (ignored in production).

## Test

| Command | What it does |
| :-- | :-- |
| `pnpm check` | svelte-check / TypeScript |
| `pnpm test` | unit + integration tests (offline, throw-away database) |
| `pnpm build && pnpm smoke` | starts the built server and tests auth, review rules and pages over real HTTP |
| `node scripts/mock-llm.mjs 4901` | a fake OpenAI-compatible model for trying the Shield UI without an API key (set `LLM_CHAT_BASE_URL=http://127.0.0.1:4901/v1`, `LLM_CHAT_API_KEY=x`, `LLM_CHAT_MODEL=mock`) |
| `node scripts/restore-drill.mjs <backup> --live <db> --boot` | proves a backup can be restored (also runs inside the container) |
| `pnpm eval` | quality run with the **real** local embedder: recall@5 per method and language pair, threshold calibration, and a network check that every seed quote is verbatim on its cited page. Writes `data/eval-report.txt`. Also evaluates the auditor if `LLM_AUDITOR_*` is set. First run downloads the embedding model (~100 MB). |

## Deploy

One image, two modes ([docker-compose.yml](docker-compose.yml)):

```sh
# Mode B — local machine / Tailscale
docker compose up -d
# Mode A — VPS with automatic HTTPS (set DOMAIN, ORIGIN, ADDRESS_HEADER in .env)
docker compose --profile vps up -d
```

`ORIGIN` **must** be set to the exact URL people type (for example `https://lemiesz.example.org` or
`http://100.64.0.5:3000`). Without it adapter-node assumes `https` and SvelteKit rejects every form
POST. The database and the downloaded embedding model live on the `/data` volume.

## Configuration

See [.env.example](.env.example). LLM access uses any OpenAI-compatible endpoint, configured
separately for the drafter and the auditor, which **must be different model families**. Use a paid,
non-training API tier for anything beyond the public seed texts.

## Adding a language

1. Add it to `LOCALES` in `src/lib/i18n/locales.ts` (tokenizer, minimum prefix).
2. Add it to `project.inlang/settings.json` and create `messages/<code>.json` (a test fails if keys differ).
3. Add golden-set entries in `eval/golden.json` and run `pnpm eval`.

No database migration is needed: the full-text table for the new language is created and back-filled at startup.
