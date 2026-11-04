# Module 06 · Journal "Lemiesz. Czy Neutralność jest możliwa? Rozprawy geoideologiczne"

> **Status:** all four steps implemented (2026-11-04): data layer, editorial back-office (`/redakcja`, behind login),
> public pages, hardening.

## Public pages (no login, read-only)

| URL | What |
|---|---|
| `/czasopismo` · `/en/czasopismo` | Front page: latest light and heavy treatises; `?q=` search, `?kaliber=light\|heavy`, `?tag=` |
| `/czasopismo/<slug>` · `/en/czasopismo/<slug>` | One published article: calibre typography, verbatim quotations, footnotes, twin link, language switch |
| `/biblioteka` · `/en/biblioteka` | Approved library items with an editor's note; `?typ=` filter |
| `/czasopismo/rss.xml` · `/en/czasopismo/rss.xml` | RSS 2.0, latest 30 |
| `/sitemap.xml` | Both sections and every published article, per language (English only once something is published) |

* The hook opens these paths for **GET/HEAD only** (`PUBLIC_JOURNAL_PATH` in `src/lib/journal-paths.ts`); everything
  else, including `/redakcja`, still needs a session. Public pages send public fields only.
* Polish has no URL prefix, English lives under `/en` (route `[[lang=journallang]]`). Page text follows the URL's
  language (`m.key({}, { locale })`), not the app's language cookie.
* Rendering (`journal-render.ts`): raw HTML in Markdown is shown as text, only http(s)/mailto/#/relative links survive
  (`rel="noopener noreferrer nofollow"`), images become links (CSP and readers' privacy), and a `[[quote:ID]]` shows
  stored text only while it is human-approved in that language; otherwise it degrades to a footnote.

## Hardening (step 4)

* **Caching:** a signed-out reader's journal page is `public, max-age=60, stale-while-revalidate=300` with
  `Vary: Cookie` (the chrome follows the language cookie). A signed-in editor's page carries their name, and a response
  that sets a cookie belongs to one browser: both are `private, no-store`. Set in `hooks.server.ts`; proven by the smoke
  test on the built server.
* **Reader frame:** signed-out readers get `JournalReaderShell` (masthead + journal footer) instead of the app header,
  menu and panel, whose links would only lead to the login page. Signed-in editors keep the app frame.
* **Rate limit:** `JOURNAL_READS_PER_MINUTE` (default 300) per IP for signed-out journal reads; editors are not limited.
* **robots.txt** (route, not a static file, so it can name the sitemap): allows `/`, the journal and the library in
  both languages, disallows the rest.
* **Dead links:** "Sprawdź linki" in the Biblioteka tab checks up to 50 web links (oldest check first) from the server.
  Every hop, including redirects, is re-validated and must resolve to public addresses only (SSRF guard). Results are
  stored per link without touching its approval; readers see "may no longer work" next to a broken one.

## Public-route audit (2026-11-04)

| Check | Result |
|---|---|
| Paths open without login | exactly `/czasopismo…`, `/biblioteka…` (both languages), `/sitemap.xml`, `/robots.txt`, plus the earlier `/`, `/login`, `/api/health`; GET/HEAD only (unit test + smoke) |
| Writes from the public side | none: public routes have no form actions; a POST to them is answered with a redirect to `/login` |
| Data sent to readers | published fields only; no working copy, reviewer, internal note or authorship metadata (checked in page source) |
| Article HTML | sanitised in `journal-render.ts`: raw HTML escaped, unsafe links dropped, images as links, quotations from approved stored text only |
| Query parameters | `q` ≤ 200 chars through the FTS sanitiser, `tag` ≤ 60 and matched with `instr` (no wildcards), `kaliber`/`typ` allow-listed |
| Headers | CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` on journal pages (smoke) |
| Outbound links | `rel="noopener noreferrer nofollow"`, new tab; no third-party embeds or images on public pages |
| Missing or unpublished article | 404 (smoke) |

## Back-office (`/redakcja`)

* **Rozprawy:** list of every article and language with calibre, state and approvals; "new article" form.
  `/redakcja/[id]?lang=pl|en` edits one language: working copy, review → publish panel, citation check, calibre /
  author / tags / twin, delete (only while nothing is live).
* **Biblioteka:** add, edit, approve, flag and delete links. The public note is required. YouTube/Spotify addresses
  still become players; everything else is a plain link.
* **One-person team:** set `JOURNAL_HEAVY_REVIEWERS=1` in `.env`; set it back to 2 when a second editor joins. Every
  approval records who gave it.
* **Citations need approved sources:** a `[[src:ID]]` resolves only to a source text approved in Weryfikacja.

Two public sections fed from the same database:

| Section | What | Where it lives |
|---|---|---|
| **Biblioteka** | Curated links: articles, podcasts, films, paintings, songs, poetry, each with a public editor's note | `media_assets` (reused). Plain links use `platform = 'web'` |
| **Rozprawy** | Own articles in two calibres: `light` (lekki kaliber, "jak budowa cepa") and `heavy` (ciężki kaliber, "jak szwajcarski zegarek") | `journal_articles`, `journal_article_texts`, `journal_approvals` (migration 013) |

## Decisions taken (2026-11-04)

Continuous stream (no numbered issues yet) · same app, public read-only pages · Polish first, per-language texts ·
`/czasopismo` (articles) and `/biblioteka` (links) · language in public URLs · new tables for articles (nothing
existing fits) · one approval for light, two different people for heavy · AI drafts allowed, never published without
human approval · optional twin between calibres · RSS from day one · comments off.

Open: author names vs one editorial voice (`author` is nullable, so both work). Press-law registration and election
material rules: to be checked with a lawyer before launch.

## Invariants

1. **Web links never embed.** A `web` row has `embed_url IS NULL` (database CHECK). Every player list (`listMedia()`
   default, Content Engine, Shield) returns embeddable media only; the Biblioteka asks for `kind: 'link'` (ROBOT-09).
2. **Links are opt-in and cleaned.** `as_link: true` is required; `parseWebUrl` accepts public http(s) only (no
   credentials, IPs or local hosts) and drops tracking parameters and the fragment. Editing the public note resets the
   item to `draft`.
3. **Edits never take a live article down.** Readers see `published_*`; any edit bumps `revision` and resets the
   working copy to `draft`. A fix goes live only when its own revision is approved and published.
4. **Approvals belong to a revision.** `journal_approvals` is keyed by revision, so an edit makes earlier approvals
   irrelevant. Distinct people count; heavy needs `JOURNAL_HEAVY_REVIEWERS` (default 2).
5. **Citations resolve to approved stored text.** `[[src:ID]]` needs a human-approved source text; `[[quote:ID]]` one
   in the article's language. Checked on approval and again on publish.
6. **Only humans** approve, flag, publish, unpublish or link twins. A pipeline author marks the text AI-assisted.
7. **No deleting a live article**: unpublish every language first.
8. **Public search sees published text only** (`fts_journal` over `published_*`).

## Migration notes

Migration 013 rebuilds `media_assets` (SQLite cannot alter a CHECK) and therefore carries the first-line marker
`-- lemiesz:foreign-keys-off`: the runner turns foreign keys off for it (otherwise `DROP TABLE` would cascade into
`argument_media_links` and null `meeting_minutes.media_id`), runs `PRAGMA foreign_key_check` before commit and turns
them back on. `journal_articles.twin_id` is `DEFERRABLE INITIALLY DEFERRED` so `data/baseline.sql` can replay twins in
id order.
