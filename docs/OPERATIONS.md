# Operations guide

For whoever runs the server. Design background is in [implementation_plan.md](implementation_plan.md).

## 1. First deployment

1. Copy `.env.example` to `.env` and fill it in. The minimum:

   | Variable | Why |
   | :-- | :-- |
   | `ORIGIN` | The exact URL people type (`https://lemiesz.example.org`, or `http://100.x.y.z:3000` over Tailscale). **Required.** Without it adapter-node assumes `https` and every form POST is rejected |
   | `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Creates the first admin when the user table is empty (12+ characters). Remove `ADMIN_PASSWORD` after the first start; the dashboard warns while it is still set |
   | `LLM_CHAT_*`, `LLM_DRAFTER_*`, `LLM_AUDITOR_*` | OpenAI-compatible endpoints. Drafter and auditor must be **different model families**. Paid, non-training tier only |
   | `EMBEDDER=local` | Multilingual search (a Polish attack finds an English source). The model (~100 MB) downloads on first use into `MODEL_CACHE_DIR`, which in Docker is on the `/data` volume |

2. **Mode B — local machine or Tailscale:** `docker compose up -d`. Set `APP_BIND` to the Tailscale IP (default `127.0.0.1` = this machine only).
3. **Mode A — VPS with HTTPS:** set `DOMAIN`, `ORIGIN=https://<domain>`, `ADDRESS_HEADER=X-Forwarded-For`, keep `APP_BIND=127.0.0.1`, then `docker compose --profile vps up -d`.
4. Open the app, sign in, and look at the **Dashboard**. Every red or amber box says what to fix.
5. The database starts with ten **draft** seed texts. Nothing is approved. A person must read each text in the Repository and approve it before the Shield or the Content Engine will use it.

The database must live on a **local disk** (SQLite WAL). The app refuses to start on a UNC path or a Linux network mount.

## 2. Backups

* The app takes a verified backup **every 24 h** (`BACKUP_INTERVAL_HOURS`, `0` turns it off) and keeps the newest **14** (`BACKUP_KEEP`). Backups are single self-contained `.db` files in `BACKUP_DIR` (default: `backups/` next to the database, i.e. on the `/data` volume).
* **That is not enough on its own.** A backup on the same disk does not survive losing the disk. Either point `BACKUP_DIR` at another disk, or copy the folder off the machine regularly. The dashboard shows an info notice while backups share the database's disk.
* Take one now: Dashboard → *Back up now* (admin). Before an upgrade, always do this first.
* Copy out of Docker: `docker cp lemiesz-app:/data/backups ./lemiesz-backups`.
* The dashboard goes red if there is no backup, or the newest is older than 48 h (or twice the interval).

### Restore drill — do it regularly

A backup you have never restored is a hope, not a backup. The drill restores the newest backup into a scratch folder and checks it:

```sh
# on any machine with node and this repo's node_modules (or inside the container):
node scripts/restore-drill.mjs ./lemiesz-backups --live ./data/lemiesz.db --boot
docker compose exec app node scripts/restore-drill.mjs /data/backups --boot
```

It runs SQLite's integrity and foreign-key checks, confirms the full-text indexes match the stored texts, confirms a user exists, and with `--boot` starts the built app on the restored copy and calls `/api/health`. Exit code 0 means restorable. **Schedule it** (monthly is reasonable) and after any change to the backup setup.

### Real restore (the live database is lost or damaged)

1. `docker compose stop app`
2. Pick the backup and run the drill on it first.
3. Replace the live files: copy the backup over `lemiesz.db` in the data volume **and delete any `lemiesz.db-wal` / `lemiesz.db-shm`** next to it.
4. `docker compose start app`; check the dashboard and the review queue.

Restored data is exactly as of the backup. Anything approved, edited or reviewed since then must be redone.

## 3. Day-to-day

| Task | Where |
| :-- | :-- |
| Add a team member, reset a password | Settings (admin). A password change signs the user out of other devices |
| Approve sources and cards | Repository / Arguments; the Review queue lists everything waiting, most-used first |
| Spot-check the AI auditor | The queue includes ~10% of AI-verified cards (`REVIEW_SAMPLE_PERCENT`). If humans overturn too many (`REVIEW_DISAGREEMENT_ALERT`, default 20%), the dashboard raises an alarm: fix the auditor prompt or model |
| Cap AI spending | `LLM_DAILY_REQUESTS` (default 300 per user per day: chat, content and card generation). Also set spend limits at the provider |
| Require a second pair of eyes on public text | `CONTENT_REQUIRE_SECOND_REVIEWER=true` |

## 4. Upgrading

1. Back up (Dashboard → *Back up now*) and copy the file off the machine.
2. `git pull && docker compose up -d --build`. Migrations run automatically at start; they are numbered SQL files and are never edited after release.
3. Look at the dashboard. AI-verified cards whose source text changed show as *stale*: run the card pipeline again or review them by hand.
4. Run `pnpm eval` (on a developer machine) after changing the embedding model, the thresholds or the auditor, and compare with the previous report in `data/eval-report.txt`.

Changing the embedding model: vectors are stored per model, so old ones are simply ignored. Use *Re-index vectors* in the review queue (admin) to build the new ones.

## 5. Security notes

* Sessions are random tokens stored hashed; passwords use scrypt. Login attempts are rate-limited per IP, API calls per IP, and AI spending per user.
* Production builds send a Content-Security-Policy (`script-src 'self'` plus per-request nonces), `X-Frame-Options: DENY`, `nosniff` and a strict referrer policy. Caddy adds HSTS in VPS mode.
* Behind Caddy, `ADDRESS_HEADER=X-Forwarded-For` lets rate limiting see real client IPs. Do **not** set it in Mode B, where clients could spoof the header.
* `AUTH_DISABLED=true` exists only for local development and is ignored in production.
* Secrets live in `.env` (git-ignored) or the container environment. The app never logs prompts or model replies.

## 6. Troubleshooting

| Symptom | Cause / fix |
| :-- | :-- |
| "Cross-site POST form submissions are forbidden" | `ORIGIN` is missing or does not match the URL in the browser |
| Everyone shares one rate-limit bucket | Behind a proxy without `ADDRESS_HEADER` |
| Container exits at start with "[FATAL] Database path … network" | `DATABASE_PATH` is on a network share; use a local volume |
| Shield says "no strong source" for a good attack | Nothing approved matches yet, or `EMBEDDER=none` and the attack is in another language than the source. Approve more texts; enable embeddings; extend `eval/golden.json` and re-run `pnpm eval` |
| First search after a restart is slow | The local embedding model is loading (~20 s) |
| Dashboard: "backups on the same disk" | Set `BACKUP_DIR` to another disk, or copy the folder off the machine |
| `pnpm check`/`test` while `vite dev` is running breaks the page | They recompile the message files under the dev server; stop dev first |
