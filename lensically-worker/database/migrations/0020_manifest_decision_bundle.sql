-- lensically-migration-class: schema
-- lensically-migration-owner: release-engineering
-- lensically-migration-risk: low

-- One complete compact strategy-consumption bundle per Manifest cycle.

CREATE TABLE IF NOT EXISTS operator_manifest_decision_bundles (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  bundle_hash TEXT NOT NULL,
  page_hashes_json TEXT NOT NULL,
  bundle_json TEXT NOT NULL,
  payload_bytes INTEGER NOT NULL,
  requires_detail_read INTEGER NOT NULL DEFAULT 0 CHECK (requires_detail_read IN (0, 1)),
  detail_reason TEXT,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (cycle_id, brand_key),
  UNIQUE (snapshot_id, bundle_hash)
);

CREATE INDEX IF NOT EXISTS idx_manifest_decision_bundle_snapshot
  ON operator_manifest_decision_bundles (snapshot_id, brand_key);
CREATE INDEX IF NOT EXISTS idx_manifest_decision_bundle_consumption
  ON operator_manifest_decision_bundles (brand_key, consumed_at, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_manifest_decision_bundle_touch_updated_at
AFTER UPDATE ON operator_manifest_decision_bundles
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE operator_manifest_decision_bundles
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;
