-- Phase 9: Kuźnia Ducha i Myśli (Hermeneutic Analysis & Cultural-Theological Deliberations).
-- Recycles existing media_assets and sources without creating duplicate tables.
CREATE TABLE IF NOT EXISTS kuznia_deliberations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type TEXT NOT NULL CHECK(item_type IN ('media', 'source')),
  media_id INTEGER REFERENCES media_assets(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  key_quote TEXT,
  theological_notes TEXT NOT NULL DEFAULT '',
  philosophical_notes TEXT NOT NULL DEFAULT '',
  political_notes TEXT NOT NULL DEFAULT '',
  debate_comments_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'human_approved', 'flagged')),
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK((media_id IS NOT NULL AND source_id IS NULL) OR (media_id IS NULL AND source_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kuznia_media ON kuznia_deliberations(media_id) WHERE media_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_kuznia_source ON kuznia_deliberations(source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kuznia_status ON kuznia_deliberations(status);
