-- lemiesz:foreign-keys-off
-- Journal "Lemiesz. Czy Neutralność jest możliwa? Rozprawy geoideologiczne", step 1 (data).
--
-- 1. media_assets also holds the Biblioteka: plain web links (articles, films, paintings, poetry, podcasts…) with no
--    embedded player. SQLite cannot change a CHECK in place, so the table is rebuilt (ids, links and FTS preserved).
--    Embeds keep ROBOT-09's rules: only the two privacy hosts, derived embed_url. A 'web' row never has an embed_url,
--    so it can never reach an <iframe>.
-- 2. Journal articles (rozprawy) in two calibres, with per-locale texts. Readers see a separately stored published
--    version, so editing the working copy (which resets it to draft, as everywhere) never takes a live article down.
-- 3. Approvals are tied to a revision: any edit makes earlier approvals irrelevant.

CREATE TABLE media_assets_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist_or_author TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK(media_type IN (
    'music', 'video', 'speech', 'podcast', 'short_clip', 'article', 'film', 'painting', 'poetry'
  )),
  genre TEXT NOT NULL DEFAULT 'other' CHECK(genre IN (
    'gregorian_sacred', 'patriotic_folk', 'classical', 'reggae_acoustic', 'modern_synth', 'rock_metal', 'ambient', 'spoken_word', 'other'
  )),
  mood TEXT,
  target_audience TEXT,
  platform TEXT NOT NULL CHECK(platform IN ('youtube', 'spotify', 'web')),
  external_id TEXT NOT NULL,
  url TEXT NOT NULL CHECK(url LIKE 'https://%' OR url LIKE 'http://%'),
  -- Derived by code from platform + external_id, never taken from user input. The CHECK is the second lock (ROBOT-09).
  embed_url TEXT CHECK(
    (platform = 'web' AND embed_url IS NULL) OR
    -- IS NOT NULL is required: "NULL LIKE ..." is unknown, and a CHECK lets unknown through.
    (platform IN ('youtube', 'spotify') AND embed_url IS NOT NULL AND (
      embed_url LIKE 'https://www.youtube-nocookie.com/embed/%' OR embed_url LIKE 'https://open.spotify.com/embed/%'
    ))
  ),
  duration_seconds INTEGER,
  language TEXT,
  ai_assisted INTEGER NOT NULL DEFAULT 0 CHECK(ai_assisted IN (0, 1)),
  production_credits TEXT,
  lyrics_or_transcript TEXT,
  lyrics_license TEXT,
  lyrics_cleared_to_store INTEGER NOT NULL DEFAULT 0 CHECK(lyrics_cleared_to_store IN (0, 1)),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'human_approved', 'flagged')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Biblioteka: the public editor's note ("why this matters"), an archived copy against link rot, the last link check.
  public_note TEXT,
  archive_url TEXT CHECK(archive_url IS NULL OR archive_url LIKE 'https://%'),
  link_checked_at TEXT,
  link_status INTEGER,
  UNIQUE(platform, external_id),
  CHECK(ai_assisted = 0 OR length(trim(coalesce(production_credits, ''))) > 0),
  CHECK(lyrics_or_transcript IS NULL OR (lyrics_cleared_to_store = 1 AND length(trim(coalesce(lyrics_license, ''))) >= 5))
);

INSERT INTO media_assets_new (
  id, slug, title, artist_or_author, media_type, genre, mood, target_audience, platform, external_id, url, embed_url,
  duration_seconds, language, ai_assisted, production_credits, lyrics_or_transcript, lyrics_license,
  lyrics_cleared_to_store, notes, status, reviewed_by, reviewed_at, created_by, created_at, updated_at
)
SELECT
  id, slug, title, artist_or_author, media_type, genre, mood, target_audience, platform, external_id, url, embed_url,
  duration_seconds, language, ai_assisted, production_credits, lyrics_or_transcript, lyrics_license,
  lyrics_cleared_to_store, notes, status, reviewed_by, reviewed_at, created_by, created_at, updated_at
FROM media_assets;

DROP TABLE media_assets;
ALTER TABLE media_assets_new RENAME TO media_assets;

CREATE INDEX IF NOT EXISTS idx_media_status_genre ON media_assets(status, genre);
CREATE INDEX IF NOT EXISTS idx_media_platform_type ON media_assets(platform, media_type);

-- The table's triggers went with it; fts_media (same ids) is rebuilt from the copied rows.
CREATE TRIGGER fts_media_ai AFTER INSERT ON media_assets BEGIN
  INSERT INTO fts_media(rowid, title, artist_or_author, lyrics_or_transcript)
  VALUES (new.id, new.title, new.artist_or_author, new.lyrics_or_transcript);
END;

CREATE TRIGGER fts_media_ad AFTER DELETE ON media_assets BEGIN
  INSERT INTO fts_media(fts_media, rowid, title, artist_or_author, lyrics_or_transcript)
  VALUES ('delete', old.id, old.title, old.artist_or_author, old.lyrics_or_transcript);
END;

CREATE TRIGGER fts_media_au AFTER UPDATE ON media_assets BEGIN
  INSERT INTO fts_media(fts_media, rowid, title, artist_or_author, lyrics_or_transcript)
  VALUES ('delete', old.id, old.title, old.artist_or_author, old.lyrics_or_transcript);
  INSERT INTO fts_media(rowid, title, artist_or_author, lyrics_or_transcript)
  VALUES (new.id, new.title, new.artist_or_author, new.lyrics_or_transcript);
END;

INSERT INTO fts_media(fts_media) VALUES('rebuild');

-- ---- Journal articles ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS journal_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE CHECK(length(slug) BETWEEN 1 AND 120 AND slug NOT GLOB '*[^a-z0-9-]*'),
  -- 'light' = lekki kaliber, "jak budowa cepa"; 'heavy' = ciężki kaliber, "jak szwajcarski zegarek".
  caliber TEXT NOT NULL CHECK(caliber IN ('light', 'heavy')),
  -- Optional twin in the other calibre (kept symmetric by code). Deferred: data/baseline.sql replays rows in id order,
  -- so an article may point at a twin with a higher id that is inserted later in the same transaction.
  twin_id INTEGER REFERENCES journal_articles(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED CHECK(twin_id IS NULL OR twin_id <> id),
  -- NULL = the editorial voice; otherwise the signed author.
  author TEXT,
  tags TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_article_texts (
  -- Explicit integer key: fts_journal maps to it, and VACUUM may renumber an implicit rowid.
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES journal_articles(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  -- Working copy (editors only).
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  lead TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'human_approved', 'flagged')),
  -- AI-drafted text stays watermarked until a human review publishes it (ROBOT-03 spirit).
  ai_assisted INTEGER NOT NULL DEFAULT 0 CHECK(ai_assisted IN (0, 1)),
  -- The version readers see. Survives edits of the working copy until a new revision is approved and published.
  published_title TEXT,
  published_lead TEXT,
  published_body TEXT,
  published_revision INTEGER,
  published_at TEXT,
  published_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (article_id, locale),
  CHECK((published_body IS NULL) = (published_revision IS NULL)),
  CHECK(published_body IS NULL OR (published_by IS NOT NULL AND published_at IS NOT NULL AND published_title IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS journal_approvals (
  article_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  revision INTEGER NOT NULL,
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (article_id, locale, revision, approved_by),
  FOREIGN KEY (article_id, locale) REFERENCES journal_article_texts(article_id, locale) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_journal_articles_caliber ON journal_articles(caliber);
CREATE INDEX IF NOT EXISTS idx_journal_texts_published ON journal_article_texts(locale, published_at DESC);

-- Public search covers the published version only, never the working copy.
CREATE VIRTUAL TABLE IF NOT EXISTS fts_journal USING fts5(
  locale UNINDEXED,
  published_title,
  published_lead,
  published_body,
  content = 'journal_article_texts',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS fts_journal_ai AFTER INSERT ON journal_article_texts BEGIN
  INSERT INTO fts_journal(rowid, locale, published_title, published_lead, published_body)
  VALUES (new.id, new.locale, new.published_title, new.published_lead, new.published_body);
END;

CREATE TRIGGER IF NOT EXISTS fts_journal_ad AFTER DELETE ON journal_article_texts BEGIN
  INSERT INTO fts_journal(fts_journal, rowid, locale, published_title, published_lead, published_body)
  VALUES ('delete', old.id, old.locale, old.published_title, old.published_lead, old.published_body);
END;

CREATE TRIGGER IF NOT EXISTS fts_journal_au AFTER UPDATE ON journal_article_texts BEGIN
  INSERT INTO fts_journal(fts_journal, rowid, locale, published_title, published_lead, published_body)
  VALUES ('delete', old.id, old.locale, old.published_title, old.published_lead, old.published_body);
  INSERT INTO fts_journal(rowid, locale, published_title, published_lead, published_body)
  VALUES (new.id, new.locale, new.published_title, new.published_lead, new.published_body);
END;
