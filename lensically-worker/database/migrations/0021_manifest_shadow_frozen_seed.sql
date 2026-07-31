CREATE TABLE IF NOT EXISTS manifest_shadow_frozen_seeds (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL UNIQUE,
  contract_version TEXT NOT NULL,
  source_as_of TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  source_count INTEGER NOT NULL,
  source_candidates_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_manifest_shadow_frozen_seeds_brand
  ON manifest_shadow_frozen_seeds(brand_key, updated_at);
