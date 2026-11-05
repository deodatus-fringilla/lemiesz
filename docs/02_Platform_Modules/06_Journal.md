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

## Article format: blocks (D-lite)

Since migration 014 an article text is a **list of blocks** (`src/lib/journal-blocks.ts`): `text` and `callout`
(Markdown with `[[src:ID]]` / `[[quote:ID]]`), `heading` (level 2–4), `quote` (a source id), `separator`, and
`image` and `media`. The list is flat: the layout is **not a block** (see "Layout: one or two columns" below).

* Stored as `blocks_json` (working copy) and `published_blocks_json` (what readers see), validated on every save by
  `validateBlocks` (known types and fields only, size and nesting limits). `body` / `published_body` are **derived**
  (`flattenBlocks`) for search, RSS and citation checks and are never edited directly.
* Existing texts were converted to one text block by the migration; nothing had to be republished.
* Rendering (`renderBlocks`) numbers footnotes across the whole article.
* **Layout: one or two columns** (migration 016). A setting of each text (language), `layout_columns` for the working
  copy and `published_layout_columns` for what readers see, so changing it is a revision that needs approval like any
  other change. With two columns the text flows from the first column into the second (CSS multi-column, as in the
  article editor's two-column preview); it applies where the article is at least 40 rem wide and is one column on a
  phone. Wide and edge-to-edge images and the footnotes span both columns; images written into the text stand column
  wide. Articles that used the old `columns` block keep their look: `validateBlocks` reads such a block as its blocks
  in reading order, and the migration gave those texts two columns. Nothing is lost; the stored JSON is rewritten the
  next time the text is saved.
* **The block editor** (`src/lib/components/journal/blocks/`) is the only article editor: cards with "+" between them,
  ↑/↓ and ✕, the **visual text editor** (below), a source picker for `[[src:ID]]` and quotation blocks (approved
  sources only; a quotation needs approved text in the article's language), and Edycja / Podgląd / Obok, and the **Układ** switch (1 or 2 columns). The preview is rendered by the server with the
  readers' renderer and shows the chosen layout (two columns need the full-width preview: the page widens for it, and
  Obok is too narrow, which it says).
* **The visual text editor** (text and highlight blocks) replaced the Markdown textarea. Writers see bold, headings 2-4,
  lists, quotations, links, separator lines and source notes as they will look; what is stored is still the same
  Markdown. It is the standalone article editor from its own repository (https://github.com/deodatus-fringilla/editor),
  kept in `src/lib/editor/` as a **copy that is never edited by hand**: change the Editor repository and run
  `pnpm editor:sync <path to the Editor checkout>` (see `src/lib/editor/SOURCE.md` for the version in use). Its tests
  live there (they need a real browser). The copy is exempt from the 150-line component guideline for that reason.
  The platform's side of it is `blocks/BlockTextField.svelte` (the editor with the dark amber theme), `PickModal.svelte`
  (the window for choosing an image or a source) and `editor-labels.ts` (every editor text from Paraglide, `ed_*` keys).
  Things it keeps but does not edit (tables, code blocks) show as locked boxes and are saved exactly as written; lists
  are flat (a nested list becomes a flat one when the text is edited); pasting from Word or Google Docs is cleaned to
  the formatting the editor knows.
* **Images in text.** The editor's image button opens the platform's image library (search, or upload a new one with
  author, licence and description) and writes one line: `![description](library address "caption"){.left}`, with
  `.left`, `.right` or nothing (centred, as wide as the text). Everything readers see about the picture, its
  description, credit and licence, comes from the **library image**, never from that line: the line only says which
  picture and where, so a text can never show a picture the library has not approved. An image shows to readers only
  when it is approved **and** described in the article's language; approval and publishing check it exactly like image
  blocks (`imageIssues` reads both), and the problems panel names each one with a button to approve the image or add the
  missing description right there. An address that is not in the library (another site, a deleted image) shows nothing
  and is reported as "missing". Search and the feed see only the caption. Left and right images float with the text
  around them (not on narrow screens, and not in two-column layout, where they are column wide). A wide or edge-to-edge image still needs an image block.
* **Images** (block `image`: picture, size `column` / `wide` / `full`, optional caption). The library is
  `campaign_posters` (migration 015 adds `alt_pl`, `alt_en`, `license`, `origin`, `width`, `height`). Readers see an image
  only when it is approved **and** has alternative text in the article's language; approval and publishing check this,
  like citations. Existing heavy JPEGs are served from pre-made light copies in `static/images/web/` (same path, `.webp`,
  ~100–300 kB); originals stay untouched. Uploads are shrunk in the browser (canvas, ≤ 1600 px, ≤ 400 kB, WebP or JPEG;
  this also drops EXIF/GPS), then re-checked on the server (`image-files.ts`: real type by content, size, dimensions,
  metadata stripped again; SVG refused), stored in `data/uploads/journal/<content-hash>` and served at
  `/images/uploads/…`: approved ones publicly with a one-year cache, drafts only to editors. An uploaded image needs an
  author, a licence and alternative text. Changing alt text or licence sends an approved image back to draft.
* **Media** (block `media`: an item of `media_assets`, optional caption). YouTube/Spotify items render as a
  click-to-load card: nothing is requested from the provider until the reader presses play (verified: zero third-party
  requests before the click), then the record's derived privacy-host `embed_url` loads (ROBOT-09). Biblioteka web links
  render as link cards with the editor's note (and the archived copy when the link check found it broken). Only
  approved items reach readers; approval and publishing check it.
* **Print:** articles print black on white without navigation; a player prints its title and address, a link card
  its address.
* Unsaved changes block approving and publishing (they apply to the saved version) and warn before leaving the page.
* A new article starts empty (title only); an empty article cannot be approved.

## Back-office (`/redakcja`)

* **Rozprawy:** list of every article and language with calibre, state and approvals; "new article" form.
  `/redakcja/[id]?lang=pl|en` edits one language: working copy, review → publish panel, citation check, calibre /
  author / tags / twin, delete (only while nothing is live).
* **Biblioteka:** add, edit, approve, flag and delete links. The public note is required. YouTube/Spotify addresses
  still become players; everything else is a plain link.
* **One-person team:** set `JOURNAL_HEAVY_REVIEWERS=1` in `.env`; set it back to 2 when a second editor joins. Every
  approval records who gave it.
* **Second person:** with `AUTH_DISABLED=true` everyone is the same `dev` identity, so two people cannot exist. Turn
  real accounts on (remove `AUTH_DISABLED`, set `ADMIN_USERNAME`/`ADMIN_PASSWORD` once), create the second editor in
  Ustawienia, and each signs in and approves. A `dev` approval does **not** count once real accounts are on (otherwise
  one person plus an old `dev` approval would pass the two-person rule); the name `dev` is reserved.
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
9. **Images in text come from the library.** An image line is resolved to a library image (`imageBySrc`); picture,
   description, credit and licence are the library's, and it shows only while approved and described in the language.

## Migration notes

Migration 013 rebuilds `media_assets` (SQLite cannot alter a CHECK) and therefore carries the first-line marker
`-- lemiesz:foreign-keys-off`: the runner turns foreign keys off for it (otherwise `DROP TABLE` would cascade into
`argument_media_links` and null `meeting_minutes.media_id`), runs `PRAGMA foreign_key_check` before commit and turns
them back on. `journal_articles.twin_id` is `DEFERRABLE INITIALLY DEFERRED` so `data/baseline.sql` can replay twins in
id order.
