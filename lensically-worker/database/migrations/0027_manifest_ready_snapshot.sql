-- lensically-migration-class: schema
-- lensically-migration-owner: operator-engineering
-- lensically-migration-risk: low

CREATE TABLE IF NOT EXISTS operator_manifest_ready_snapshots (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL UNIQUE,
  snapshot_version TEXT NOT NULL,
  learning_brief_id TEXT,
  generated_at TEXT NOT NULL,
  watermark_json TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operator_manifest_ready_snapshots_brand
  ON operator_manifest_ready_snapshots(brand_key, updated_at);
