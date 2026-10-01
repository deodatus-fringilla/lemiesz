# Transfer letter — Claude (Sonnet 5.5) to the next session

> **Doc type: HANDOFF (point-in-time).** Written 2026-10-01 at the end of the session that audited Gemini's Phase 0–1 and built Phases 2–5.
> **Authority:** this letter owns nothing. Status lives in the [Harness ledger](../10_Harness/02_Harness_Ledger.md), design in the [plan](../implementation_plan.md), operations in [OPERATIONS.md](../OPERATIONS.md). Where this letter and those disagree, they win and this letter is out of date. Measured claims below carry the date and command ([Canon 03 · D2](../00_Canon/03_Rules_of_Engagement.md)).

---

## 1. Where things stand

All five planned phases are implemented, tested and committed. `main` is at `5e5f5b8` and **pushed by the architect**; the working tree was clean when this letter was started (this file and nothing else is new).

| Commit | Content |
|---|---|
| `ea45ad1` | Audit fixes for Phase 0–1 + Phase 2 (arguments, hybrid retrieval, Drafter/Auditor pipeline, eval harness) |
| `27d9d76` | Phase 3 — Rhetorical Shield (SSE, citation validation) + README, smoke test, plan §17–18 |
| `ce8086b` | Phase 4 — Content Engine |
| `5e5f5b8` | Phase 5 — dashboard/health, backups + restore drill, user management, CSP/headers, ops guide |

**Measured on 2026-10-01 (the last time each command was run):**

| What | Command | Result |
|---|---|---|
| Types | `pnpm check` | 0 errors, 0 warnings |
| Unit/integration | `pnpm test` | 175 tests pass |
| HTTP smoke on the built server | `pnpm build && pnpm smoke` | 41 checks pass |
| Retrieval quality, real local embedder | `pnpm eval` → `data/eval-report.txt` | hybrid recall@5 16/16 (en→en 10/10, pl→en 6/6); lexical alone 8/10 and 0/6; end-to-end with real thresholds 100%; off-topic queries correctly empty 4/4. Run **before** Phases 3–5; retrieval code has not changed since |
| Seed quotes are verbatim on their cited pages | `pnpm eval` (`seed/verify.eval.ts`) | 7/7 |
| Docker amd64 | `docker build`, run, `docker stop` | healthy; login; scheduled backup written; restore drill passes inside the container; clean shutdown (no `-wal`); restart without reseeding |
| Docker arm64 (QEMU emulation, not real hardware) | `docker build --platform linux/arm64` | builds; better-sqlite3+FTS5 and onnxruntime-node load; app healthy |

## 2. What was built, and where (map, not documentation)

* `src/lib/server/review.ts` — the trust state machine. **Only a signed-in human sets `human_approved`; only the pipeline sets `ai_verified`/`stale`; any edit resets to `draft`.** Everything else leans on this.
* `rag/` — FTS5 per locale (tables built from the locale registry at startup), vectors in RAM, RRF, **trust filter enforced inside retrieval**, two-tier `arguments → sources → "no strong source"`.
* `pipeline/` — Drafter → deterministic verbatim span check → independent Auditor (pass/fail rubric, fail-closed); review queue with 10% sampling and disagreement alarm.
* `shield/` and `content/` — SSE generators. `[[src:ID]]`/`[[quote:ID]]` tokens are validated against the retrieved set (including tokens split across chunks) and expanded to **database text only**.
* `backup.ts`, `health.ts`, `scripts/restore-drill.mjs` — Phase 5.
* `eval/golden.json`, `eval/bad-cards.json`, `src/lib/server/eval/` — the quality harness.
* Tests sit next to the code (`*.test.ts`); `*.eval.ts` run only under `pnpm eval`.

## 3. What has NOT been verified — read this twice

1. **No real LLM has ever been called.** Chat, Drafter, Auditor and the Content Engine are tested with scripted fakes (`FakeLlm`) and with `scripts/mock-llm.mjs` (which deliberately misbehaves). Prompt wording, the Auditor's real catch rate on the planted bad cards, the Drafter's real behaviour with the span check, and streaming against a real provider are all unmeasured. The first real run will find problems; budget time for it.
2. **The retrieval threshold is thin.** `RAG_VECTOR_MIN=0.79` was calibrated on 16 attacks + 4 negatives; the margin is 0.806 (worst positive) vs 0.772 (best negative). Treat it as a placeholder until the golden set is 30–50 real lines.
3. **Doctrine and wording are mine, not the movement's.** `pipeline/doctrine.ts` is a working summary of three tenets; the Shield preset attacks (`messages/*.json`), tone presets and platform rules (`content/formats.ts`) are first drafts. The architect said they will review the presets.
4. **The seed corpus is mostly placeholders.** Seven rows are verbatim English texts (Pacem in Terris §112/§127, Gaudium et Spes §78/§79, Hague V Art. 1/2/5), all `draft`. Three rows (Manifesto, Double Distance, Bastiat) are AI placeholders labelled as such. There are **no Polish source texts**.
5. **Real arm64 hardware, a real VPS deployment behind Caddy, and Tailscale access** have not been tried.
6. `pnpm eval` has not been re-run since Phase 2; nothing in retrieval changed, but the date on that measurement is older than the code around it.

## 4. Things to know before touching anything

* **Working-tree edits by someone else.** During this session `src/lib/server/auth.ts` was modified outside my edits (it switched `authDisabled()` to `$env/dynamic/private`). My `git add -A` committed it in `ea45ad1`. I replaced it in `5e5f5b8` with one uniform mechanism (`vite.config.ts` loads `.env` into `process.env` for `vite dev` only). If another agent or tool edits the tree, run `git diff` before committing.
* **The new docs architecture (this `docs/` tree) is a draft by the partner and is partly ahead of reality.** Specifically, and per Canon D2/D4 these are defects to resolve, not facts:
  * The ledger says 129 tests, 28 smoke checks and 20 attack queries; current measurements are in §1 above (the golden set is 16 positives + 4 negatives).
  * The robot documents reference `scripts/robots/`, `tests/robots/`, `scripts/eval-auditor.ts` and `pnpm eval:auditor`. **None exist.** The equivalent checks that do exist are mapped below.
  * ROBOT-03's trap list (A–E) does not match `eval/bad-cards.json` (fabricated quote, misattributed source, off-doctrine, overreach + 2 sound controls). Its "100% catch" criterion cannot be evaluated without a real auditor.
  * ROBOT-06 says startup must abort if WAL or `busy_timeout` are disabled. The code sets them but only aborts on UNC paths and Linux network mounts.
  * The README tree lists files that do not exist yet (`01_Architecture/`, `02_Modules/`, `00_Canon/01–02`). `ROBOT-08` (census) has no implementation.
* **What already guards each robot's invariant (not yet wrapped as numbered robots):**

  | Robot | Existing guard |
  |---|---|
  | 01 verbatim quotation | `pipeline/spancheck.ts` + tests; `shield/cite.ts` `findUnverifiedQuotes`; `seed/verify.eval.ts`; content checks |
  | 02 trust-tier boundary | `rag/trust.ts`, trust tests in `rag/retrieve.test.ts`, `shield.test.ts`, `content/content.test.ts`; smoke checks on drafts |
  | 03 auditor canary | `eval/bad-cards.json` + `evaluateAuditor` in `src/lib/server/eval/harness.ts` (runs under `pnpm eval` when `LLM_AUDITOR_*` is set) |
  | 04 golden set | `eval/golden.json` + `evaluateRetrieval`; `pnpm eval` |
  | 05 locale parity | `src/lib/i18n/locales.test.ts` (key parity and registry/inlang match) |
  | 06 disk assertion | `assertLocalFilesystem` in `db.ts` + `db.test.ts` |
  | 07 license/storage | `seed/checklist.ts` + `sources.test.ts` |
  | 08 census | nothing |
* **Environment quirks (Windows, Git Bash, PowerShell):**
  * Bash heredocs containing quotes or backticks often fail or mangle backslashes; write files with the file tool and avoid `node -e` with regexes.
  * Do **not** run `pnpm check`/`pnpm test` while `vite dev` is running: they recompile the Paraglide message files under the dev server and break the page.
  * Stop servers by port with PowerShell (`Get-NetTCPConnection … | Stop-Process`); `pkill` does not work.
  * In Git Bash, `/tmp` maps to `C:\Users\<you>\AppData\Local\Temp`; Docker needs `MSYS_NO_PATHCONV=1` for container paths.
  * Docker Desktop was installed via winget (CLI in `C:\Program Files\Docker\Docker\resources\bin`). `docker`/buildx work; arm64 emulation works.
* **Working agreements observed so far:** commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; the architect pushes manually; I commit only when asked; nothing is published or sent anywhere automatically; the plan and README are updated alongside code; claims are checked (tests, smoke, browser, Docker) rather than asserted.

## 5. Input I need from the architect (the "required input")

In rough order of how much it unblocks:

1. **LLM access** — provider(s), model names, keys, monthly budget. Needed: one chat model, one drafter and one auditor from **different families**; a paid, non-training tier. Decide embeddings: `local` (free, ~100 MB model) or an API.
2. **People** — who reviews the argument cards, who reviews translations, who is the second reviewer for public text (and whether `CONTENT_REQUIRE_SECOND_REVIEWER=true`). Who are the admins.
3. **Content** — the movement's own Manifesto and Double Distance text; the movement's own wording of the three tenets (`DOCTRINE_FILE`); Polish source texts and a **licence decision per text** (opoka.org.pl, Mises Institute's *Prawo*, others) before anything is stored with `cleared_to_store=1`.
4. **Real attack lines** — 14–34 more for the golden set (target 30–50), in both languages, ideally with the sources a good answer must cite.
5. **Wording review** — Shield presets, tone presets, platform rules.
6. **Deployment choices** — VPS or Tailscale, domain, where backups go (`BACKUP_DIR` on another disk, plus an off-machine copy).
7. **Coordination with the partner** — whether the partner's docs tree and Robot Fleet are to be adopted as written; see §6.

## 6. Suggested first moves for the next session

1. Resolve the docs drift in §4 before anything else: either correct the ledger and robot specs to match reality, or implement what they promise. My recommendation: make the ledger honest first (numbers, dates, commands), then add the **thin wrappers** that give each robot its three homes (spec, ledger row, executable) around the guards that already exist, then write ROBOT-08 so drift cannot recur. Prove each can fail (Canon D4) — several already have negative controls in their tests; ROBOT-01/02 deserve a deliberate-sabotage run.
2. With LLM access: run the real chat/drafter/auditor once, read the outputs, then `pnpm eval` with `LLM_AUDITOR_*` set. Fix prompts from evidence, not from taste.
3. Grow the golden set, re-run `pnpm eval`, and recalibrate `RAG_VECTOR_MIN` (the harness prints a suggestion).
4. Replace the placeholder seed rows with the movement's texts; add Polish translations; approve the verified English texts after a human read.
5. Do a real deployment rehearsal on the intended host and run `node scripts/restore-drill.mjs … --boot` there.

## 7. How to resume in five minutes

```sh
git log --oneline | head -5            # expect 5e5f5b8 at the top, then this letter if committed
pnpm install
pnpm check && pnpm test                # 0 errors; 175 tests
pnpm build && pnpm smoke               # 41 checks
pnpm eval                              # needs network on first run (embedding model download)
```

Read, in this order: [OPERATIONS.md](../OPERATIONS.md) → plan §17–§20 (deviations and measured results) → [Canon 03](../00_Canon/03_Rules_of_Engagement.md) → the Robot README. Claude's project memory (`project-lemiesz-state.md`) holds a shorter version of this letter and the tool quirks.

## 8. What I would want the next session to be sceptical about

* My own prompts and thresholds (§3). They pass fakes; that proves plumbing, not quality.
* Any status in the ledger without a date and command.
* "Verified" in my commit messages means *by the command named in the plan section*, nothing broader.
* The Auditor. An AI grading an AI is only as good as its measured catch rate on traps that humans wrote; until then `ai_verified` is a hint, which is exactly why the Content Engine refuses it by default.

See you in the next session.

— Claude
