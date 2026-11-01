-- Phase 10: Spichlerz (Sovereign Second Brain & Deliberation Granary).
-- Extends meeting_minutes with pinning, visual color tags, canonical media/source links,
-- and expands fts_meetings to index agenda and action_items_json (ToDo items).

ALTER TABLE meeting_minutes ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE meeting_minutes ADD COLUMN color_tag TEXT NOT NULL DEFAULT 'zinc' CHECK(color_tag IN ('zinc', 'amber', 'purple', 'blue', 'emerald', 'rose'));
ALTER TABLE meeting_minutes ADD COLUMN media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL;
ALTER TABLE meeting_minutes ADD COLUMN source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_pinned ON meeting_minutes(is_pinned DESC, meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_media ON meeting_minutes(media_id);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_source ON meeting_minutes(source_id);

-- Drop existing FTS triggers and virtual table before updating rows and rebuilding FTS5 schema
DROP TRIGGER IF EXISTS fts_meetings_ai;
DROP TRIGGER IF EXISTS fts_meetings_ad;
DROP TRIGGER IF EXISTS fts_meetings_au;
DROP TABLE IF EXISTS fts_meetings;

-- Pin and color-tag existing canonical entries (Braun deliberation & Backlog)
UPDATE meeting_minutes SET is_pinned = 1, color_tag = 'purple' WHERE id = 1;
UPDATE meeting_minutes SET is_pinned = 1, color_tag = 'amber' WHERE id = 2;

-- Recreate Full-Text Search virtual table including agenda and action_items_json
CREATE VIRTUAL TABLE fts_meetings USING fts5(
  title,
  summary,
  body,
  agenda,
  action_items_json,
  attendees,
  tags,
  content = 'meeting_minutes',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER fts_meetings_ai AFTER INSERT ON meeting_minutes BEGIN
  INSERT INTO fts_meetings(rowid, title, summary, body, agenda, action_items_json, attendees, tags)
  VALUES (new.id, new.title, new.summary, new.body, new.agenda, new.action_items_json, new.attendees, new.tags);
END;

CREATE TRIGGER fts_meetings_ad AFTER DELETE ON meeting_minutes BEGIN
  INSERT INTO fts_meetings(fts_meetings, rowid, title, summary, body, agenda, action_items_json, attendees, tags)
  VALUES ('delete', old.id, old.title, old.summary, old.body, old.agenda, old.action_items_json, old.attendees, old.tags);
END;

CREATE TRIGGER fts_meetings_au AFTER UPDATE ON meeting_minutes BEGIN
  INSERT INTO fts_meetings(fts_meetings, rowid, title, summary, body, agenda, action_items_json, attendees, tags)
  VALUES ('delete', old.id, old.title, old.summary, old.body, old.agenda, old.action_items_json, old.attendees, old.tags);
  INSERT INTO fts_meetings(rowid, title, summary, body, agenda, action_items_json, attendees, tags)
  VALUES (new.id, new.title, new.summary, new.body, new.agenda, new.action_items_json, new.attendees, new.tags);
END;

-- Rebuild FTS index so fts_meetings_docsize matches meeting_minutes row count
INSERT INTO fts_meetings(fts_meetings) VALUES('rebuild');
