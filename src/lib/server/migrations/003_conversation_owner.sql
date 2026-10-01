-- Conversations belong to the user who started them.
ALTER TABLE conversations ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at);
