CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work TEXT NOT NULL,
  section_ref TEXT NOT NULL,
  category TEXT NOT NULL,
  url TEXT,
  license TEXT NOT NULL,
  cleared_to_store INTEGER NOT NULL DEFAULT 0,
  original_locale TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  source_hash TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS source_texts (
  source_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  text TEXT NOT NULL,
  keywords TEXT,
  origin TEXT NOT NULL CHECK(origin IN ('original', 'official_translation', 'human_translation', 'machine_translation', 'ai_drafted')),
  review TEXT NOT NULL CHECK(review IN ('draft', 'flagged', 'ai_verified', 'human_approved', 'stale')),
  translator TEXT,
  audit_json TEXT,
  audit_notes TEXT,
  drafter_model TEXT,
  auditor_model TEXT,
  prompt_version TEXT,
  source_hash TEXT,
  PRIMARY KEY (source_id, locale),
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS arguments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fallacy_type TEXT,
  core_principle TEXT NOT NULL,
  tags TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS argument_texts (
  argument_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  opponent_claim TEXT NOT NULL,
  counter_punch TEXT NOT NULL,
  keywords TEXT,
  origin TEXT NOT NULL CHECK(origin IN ('original', 'official_translation', 'human_translation', 'machine_translation', 'ai_drafted')),
  review TEXT NOT NULL CHECK(review IN ('draft', 'flagged', 'ai_verified', 'human_approved', 'stale')),
  supporting_spans_json TEXT,
  audit_json TEXT,
  audit_notes TEXT,
  drafter_model TEXT,
  auditor_model TEXT,
  prompt_version TEXT,
  source_hash TEXT,
  PRIMARY KEY (argument_id, locale),
  FOREIGN KEY (argument_id) REFERENCES arguments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS argument_sources (
  argument_id INTEGER NOT NULL,
  source_id INTEGER NOT NULL,
  PRIMARY KEY (argument_id, source_id),
  FOREIGN KEY (argument_id) REFERENCES arguments(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS embeddings (
  owner_type TEXT NOT NULL CHECK(owner_type IN ('source', 'argument')),
  owner_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  vector BLOB NOT NULL,
  PRIMARY KEY (owner_type, owner_id, locale, model)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  locale TEXT NOT NULL DEFAULT 'pl',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  locale TEXT NOT NULL,
  sources_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS review_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_type TEXT NOT NULL CHECK(owner_type IN ('source', 'argument')),
  owner_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  from_review TEXT NOT NULL,
  to_review TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_pl USING fts5(
  owner_type,
  owner_id UNINDEXED,
  title,
  content,
  keywords,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_en USING fts5(
  owner_type,
  owner_id UNINDEXED,
  title,
  content,
  keywords,
  tokenize = 'porter unicode61 remove_diacritics 2'
);
