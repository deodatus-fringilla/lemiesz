-- Spichlerz: the ToDo inbox (Backlog) is identified by a flag, not by its title.
-- Exactly one inbox can exist (partial unique index), and the database itself refuses to delete it.

ALTER TABLE meeting_minutes ADD COLUMN is_inbox INTEGER NOT NULL DEFAULT 0 CHECK(is_inbox IN (0, 1));

-- Adopt the existing Backlog note, if there is one (the oldest, should several share the title).
UPDATE meeting_minutes SET is_inbox = 1
WHERE id = (SELECT MIN(id) FROM meeting_minutes WHERE title = 'Podręczny rejestr zadań (Backlog)');

CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_minutes_single_inbox ON meeting_minutes(is_inbox) WHERE is_inbox = 1;

CREATE TRIGGER IF NOT EXISTS meeting_minutes_keep_inbox BEFORE DELETE ON meeting_minutes
WHEN old.is_inbox = 1
BEGIN
  SELECT RAISE(ABORT, 'The Spichlerz ToDo inbox (Backlog) cannot be deleted');
END;
