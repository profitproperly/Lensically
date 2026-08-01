-- lensically-migration-class: schema
-- lensically-migration-owner: release-engineering
-- lensically-migration-risk: low

-- Main DB stores released Champion identity only. Active Innovation truth remains isolated.

CREATE TABLE IF NOT EXISTS manifest_cycle_champions (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  semantic_version TEXT NOT NULL,
  major_version INTEGER NOT NULL CHECK (major_version >= 0),
  minor_version INTEGER NOT NULL CHECK (minor_version >= 0),
  patch_version INTEGER NOT NULL CHECK (patch_version >= 0),
  source_sha TEXT NOT NULL,
  selector_version TEXT,
  preselection_policy_version TEXT,
  component_versions_json TEXT NOT NULL DEFAULT '{}',
  promoted_from_innovation_run_id TEXT,
  promotion_classification TEXT NOT NULL CHECK (
    promotion_classification IN ('baseline', 'patch', 'minor', 'major')
  ),
  status TEXT NOT NULL CHECK (status IN ('current', 'historical')),
  promoted_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (brand_key, semantic_version),
  UNIQUE (brand_key, major_version, minor_version, patch_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manifest_cycle_one_current_champion
  ON manifest_cycle_champions (brand_key)
  WHERE status = 'current';

CREATE INDEX IF NOT EXISTS idx_manifest_cycle_champions_history
  ON manifest_cycle_champions (brand_key, major_version DESC, minor_version DESC, patch_version DESC);

CREATE TABLE IF NOT EXISTS manifest_cycle_promotion_history (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  previous_version TEXT,
  promoted_version TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('baseline', 'patch', 'minor', 'major')),
  innovation_run_id TEXT,
  tested_sha TEXT NOT NULL,
  promotion_receipt_json TEXT NOT NULL DEFAULT '{}',
  promoted_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (brand_key, promoted_version)
);

CREATE INDEX IF NOT EXISTS idx_manifest_cycle_promotions_history
  ON manifest_cycle_promotion_history (brand_key, promoted_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_manifest_cycle_promotions_innovation_run
  ON manifest_cycle_promotion_history (brand_key, innovation_run_id, promoted_at DESC);
