-- How often a card is actually used by the Shield / Content Engine. Drives the review-queue ordering.
CREATE TABLE IF NOT EXISTS card_usage (
  owner_type TEXT NOT NULL CHECK(owner_type IN ('source', 'argument')),
  owner_id INTEGER NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  PRIMARY KEY (owner_type, owner_id)
);

-- One row per Drafter / Auditor run (provenance and cost tracking).
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK(kind IN ('draft', 'audit', 'reindex')),
  source_id INTEGER,
  actor TEXT NOT NULL,
  drafter_model TEXT,
  auditor_model TEXT,
  prompt_version TEXT,
  created_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  verified_count INTEGER NOT NULL DEFAULT 0,
  flagged_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE argument_texts ADD COLUMN audited_at TEXT;
