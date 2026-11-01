-- Phase 8: Operational Minutes & Deliberations (meeting_minutes).
-- Dual-mode: general team strategy/doctrine meetings OR contextually tied to correspondence threads/letters.
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_date TEXT NOT NULL DEFAULT (date('now')),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('epistolary', 'strategy', 'doctrine', 'campaign', 'operational', 'general')),
  thread_id INTEGER REFERENCES correspondence_threads(id) ON DELETE SET NULL,
  after_letter_id INTEGER REFERENCES correspondence_letters(id) ON DELETE SET NULL,
  attendees TEXT NOT NULL,
  agenda TEXT,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  action_items_json TEXT NOT NULL DEFAULT '[]',
  tags TEXT,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_date ON meeting_minutes(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_thread ON meeting_minutes(thread_id);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_category ON meeting_minutes(category);

-- Full-text search for minutes, discussions and action items
CREATE VIRTUAL TABLE IF NOT EXISTS fts_meetings USING fts5(
  title,
  summary,
  body,
  attendees,
  tags,
  content = 'meeting_minutes',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS fts_meetings_ai AFTER INSERT ON meeting_minutes BEGIN
  INSERT INTO fts_meetings(rowid, title, summary, body, attendees, tags)
  VALUES (new.id, new.title, new.summary, new.body, new.attendees, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS fts_meetings_ad AFTER DELETE ON meeting_minutes BEGIN
  INSERT INTO fts_meetings(fts_meetings, rowid, title, summary, body, attendees, tags)
  VALUES ('delete', old.id, old.title, old.summary, old.body, old.attendees, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS fts_meetings_au AFTER UPDATE ON meeting_minutes BEGIN
  INSERT INTO fts_meetings(fts_meetings, rowid, title, summary, body, attendees, tags)
  VALUES ('delete', old.id, old.title, old.summary, old.body, old.attendees, old.tags);
  INSERT INTO fts_meetings(rowid, title, summary, body, attendees, tags)
  VALUES (new.id, new.title, new.summary, new.body, new.attendees, new.tags);
END;
