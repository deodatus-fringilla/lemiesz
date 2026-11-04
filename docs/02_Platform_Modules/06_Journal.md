# Module 06 · Journal "Lemiesz. Czy Neutralność jest możliwa? Rozprawy geoideologiczne"

> **Status:** steps 1 (data layer) and 2 (editorial back-office, `/redakcja`, behind login) implemented.
> Public pages (step 3) and hardening (step 4) follow.

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
