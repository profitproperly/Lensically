-- lensically-migration-class: schema
-- lensically-migration-owner: operator-engineering
-- lensically-migration-risk: low

CREATE TABLE IF NOT EXISTS operator_source_label_allocation_state (
  brand_key TEXT PRIMARY KEY,
  policy_version TEXT NOT NULL,
  state_json TEXT NOT NULL,
  last_cycle_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operator_source_label_allocation_state_updated
  ON operator_source_label_allocation_state(updated_at);
