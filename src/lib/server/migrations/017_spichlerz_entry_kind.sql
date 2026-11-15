-- Spichlerz: distinguish quick notes ('note') from full meeting protocols ('minute').
ALTER TABLE meeting_minutes
  ADD COLUMN entry_kind TEXT NOT NULL DEFAULT 'minute' CHECK(entry_kind IN ('note', 'minute'));
