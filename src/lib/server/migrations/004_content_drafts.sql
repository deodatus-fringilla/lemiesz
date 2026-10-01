-- Content Engine drafts (plan §6.1): draft -> human review -> copy / export. Nothing is ever published automatically.
CREATE TABLE IF NOT EXISTS content_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('x', 'facebook', 'shorts', 'press')),
  tone TEXT NOT NULL,
  locale TEXT NOT NULL,
  brief TEXT NOT NULL,
  body TEXT NOT NULL,
  -- 1 while the text still carries the "unreviewed material" watermark line (plan §7.4)
  watermark INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'reviewed')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  -- evidence behind the draft: [{id, work, section_ref, url, license, locale, review, text}]
  sources_json TEXT NOT NULL DEFAULT '[]',
  checks_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_content_drafts_created ON content_drafts(created_at);
