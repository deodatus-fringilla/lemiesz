-- Phase 6: Cultural & Media Engine (docs/02_Platform_Modules/05_Media_and_Culture.md).
-- Media are NOT sources: they carry no canonical text of the movement, only links, metadata and (when cleared)
-- lyrics. The trust rule is the same as everywhere else: only a signed-in human sets `human_approved`, and any
-- edit of what is shown to the public resets the asset to `draft` (enforced in media.ts, guarded by ROBOT-09/10).
CREATE TABLE IF NOT EXISTS media_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist_or_author TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK(media_type IN ('music', 'video', 'speech', 'podcast', 'short_clip')),
  genre TEXT NOT NULL DEFAULT 'other' CHECK(genre IN (
    'gregorian_sacred', 'patriotic_folk', 'classical', 'reggae_acoustic', 'modern_synth', 'rock_metal', 'ambient', 'spoken_word', 'other'
  )),
  mood TEXT,
  target_audience TEXT,
  -- v1 plays external embeds only (no local audio hosting); every host here is on the CSP frame-src allow-list.
  platform TEXT NOT NULL CHECK(platform IN ('youtube', 'spotify')),
  external_id TEXT NOT NULL,
  url TEXT NOT NULL,
  -- Derived by code from platform + external_id, never taken from user input. The CHECK is the second lock.
  embed_url TEXT NOT NULL CHECK(
    embed_url LIKE 'https://www.youtube-nocookie.com/embed/%' OR embed_url LIKE 'https://open.spotify.com/embed/%'
  ),
  duration_seconds INTEGER,
  language TEXT,
  -- Transparent credit: an AI-assisted work must say which tools were used (ROBOT-10).
  ai_assisted INTEGER NOT NULL DEFAULT 0 CHECK(ai_assisted IN (0, 1)),
  production_credits TEXT,
  -- Lyrics / transcript are stored only when a human has decided they may be, with the licence terms (ROBOT-10, cf. ROBOT-07).
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
  UNIQUE(platform, external_id),
  CHECK(ai_assisted = 0 OR length(trim(coalesce(production_credits, ''))) > 0),
  CHECK(lyrics_or_transcript IS NULL OR (lyrics_cleared_to_store = 1 AND length(trim(coalesce(lyrics_license, ''))) >= 5))
);

CREATE INDEX IF NOT EXISTS idx_media_status_genre ON media_assets(status, genre);

-- Full-text search over titles, lyrics and transcripts. External-content table kept in sync by triggers.
CREATE VIRTUAL TABLE IF NOT EXISTS fts_media USING fts5(
  title,
  artist_or_author,
  lyrics_or_transcript,
  content = 'media_assets',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS fts_media_ai AFTER INSERT ON media_assets BEGIN
  INSERT INTO fts_media(rowid, title, artist_or_author, lyrics_or_transcript)
  VALUES (new.id, new.title, new.artist_or_author, new.lyrics_or_transcript);
END;

CREATE TRIGGER IF NOT EXISTS fts_media_ad AFTER DELETE ON media_assets BEGIN
  INSERT INTO fts_media(fts_media, rowid, title, artist_or_author, lyrics_or_transcript)
  VALUES ('delete', old.id, old.title, old.artist_or_author, old.lyrics_or_transcript);
END;

CREATE TRIGGER IF NOT EXISTS fts_media_au AFTER UPDATE ON media_assets BEGIN
  INSERT INTO fts_media(fts_media, rowid, title, artist_or_author, lyrics_or_transcript)
  VALUES ('delete', old.id, old.title, old.artist_or_author, old.lyrics_or_transcript);
  INSERT INTO fts_media(rowid, title, artist_or_author, lyrics_or_transcript)
  VALUES (new.id, new.title, new.artist_or_author, new.lyrics_or_transcript);
END;

-- Which media go with which argument card, and where the hook is. The cue is written by a human, never by a model.
CREATE TABLE IF NOT EXISTS argument_media_links (
  argument_id INTEGER NOT NULL REFERENCES arguments(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  cue TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (argument_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_media_links_media ON argument_media_links(media_id);

-- Which approved media a Content Engine draft referenced (audit trail; the body already holds the expanded text).
ALTER TABLE content_drafts ADD COLUMN media_json TEXT NOT NULL DEFAULT '[]';
