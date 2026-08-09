-- lensically-migration-class: schema
-- lensically-migration-owner: operator-engineering
-- lensically-migration-risk: low

CREATE TABLE IF NOT EXISTS operator_release_authority (
  authority_id TEXT PRIMARY KEY,
  expected_release_sha TEXT NOT NULL,
  previous_release_sha TEXT,
  release_id TEXT,
  state TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (authority_id = 'production')
);
