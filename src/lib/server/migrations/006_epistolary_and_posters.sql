-- Phase 7: Epistolary format ('letter'), Correspondence Dossier (letters/Korona), and Local Campaign Posters (/images/*).
-- 1. Extend content_drafts.platform CHECK to allow 'letter' while preserving all existing rows and columns.
CREATE TABLE content_drafts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('x', 'facebook', 'shorts', 'press', 'letter')),
  tone TEXT NOT NULL,
  locale TEXT NOT NULL,
  brief TEXT NOT NULL,
  body TEXT NOT NULL,
  watermark INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'reviewed')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  sources_json TEXT NOT NULL DEFAULT '[]',
  checks_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  media_json TEXT NOT NULL DEFAULT '[]'
);

INSERT INTO content_drafts_new (
  id, created_by, platform, tone, locale, brief, body, watermark, status,
  reviewed_by, reviewed_at, sources_json, checks_json, created_at, updated_at, media_json
)
SELECT
  id, created_by, platform, tone, locale, brief, body, watermark, status,
  reviewed_by, reviewed_at, sources_json, checks_json, created_at, updated_at, media_json
FROM content_drafts;

DROP TABLE content_drafts;
ALTER TABLE content_drafts_new RENAME TO content_drafts;
CREATE INDEX IF NOT EXISTS idx_content_drafts_created ON content_drafts(created_at);

-- 2. Local visual campaign posters (/images/* under img-src 'self' CSP).
-- Kept separate from media_assets so external iframe embed invariants (ROBOT-09) remain untouched.
CREATE TABLE IF NOT EXISTS campaign_posters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist_or_author TEXT NOT NULL,
  image_path TEXT NOT NULL UNIQUE CHECK(image_path LIKE '/images/%'),
  theme TEXT NOT NULL DEFAULT 'sacred_life',
  caption_pl TEXT,
  caption_en TEXT,
  symbolism_notes TEXT,
  ai_assisted INTEGER NOT NULL DEFAULT 0 CHECK(ai_assisted IN (0, 1)),
  production_credits TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'human_approved', 'flagged')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(ai_assisted = 0 OR length(trim(coalesce(production_credits, ''))) > 0)
);

CREATE TABLE IF NOT EXISTS argument_poster_links (
  argument_id INTEGER NOT NULL REFERENCES arguments(id) ON DELETE CASCADE,
  poster_id INTEGER NOT NULL REFERENCES campaign_posters(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (argument_id, poster_id)
);

-- 3. Epistolary Correspondence Dossier (e.g. letters/Korona/*).
CREATE TABLE IF NOT EXISTS correspondence_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  interlocutor TEXT NOT NULL,
  organization TEXT NOT NULL,
  methodology TEXT NOT NULL DEFAULT 'thomistic_disputation',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS correspondence_letters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES correspondence_threads(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('outbound', 'inbound')),
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  date_label TEXT NOT NULL,
  filename TEXT NOT NULL UNIQUE,
  summary_pl TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  body TEXT NOT NULL,
  key_claims_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_correspondence_letters_thread ON correspondence_letters(thread_id, turn_number);
