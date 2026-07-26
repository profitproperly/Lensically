CREATE TABLE IF NOT EXISTS operator_source_family_evidence_states (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  source_card_family_id TEXT NOT NULL,
  source_identity_key TEXT NOT NULL,
  label_policy_version TEXT NOT NULL,
  lifetime_label TEXT NOT NULL,
  recent_label TEXT NOT NULL,
  confidence_label TEXT NOT NULL,
  lifetime_sample_size INTEGER NOT NULL DEFAULT 0,
  recent_sample_size INTEGER NOT NULL DEFAULT 0,
  account_lifetime_median_likes REAL NOT NULL DEFAULT 0,
  account_28d_median_likes REAL NOT NULL DEFAULT 0,
  family_lifetime_median_likes REAL,
  family_28d_median_likes REAL,
  lifetime_index REAL,
  recent_index REAL,
  latest_two_recent_index REAL,
  probability_above_median REAL NOT NULL DEFAULT 0.5,
  probability_above_franchise_floor REAL NOT NULL DEFAULT 0.5,
  probability_below_underperformance_floor REAL NOT NULL DEFAULT 0.5,
  state_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, source_card_family_id)
);

CREATE INDEX IF NOT EXISTS idx_operator_source_family_evidence_labels
  ON operator_source_family_evidence_states (brand_key, lifetime_label, recent_label, updated_at DESC);

CREATE TABLE IF NOT EXISTS operator_source_family_label_transitions (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  source_card_family_id TEXT NOT NULL,
  source_identity_key TEXT NOT NULL,
  label_policy_version TEXT NOT NULL,
  previous_lifetime_label TEXT,
  lifetime_label TEXT NOT NULL,
  previous_recent_label TEXT,
  recent_label TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operator_source_family_label_transitions
  ON operator_source_family_label_transitions (brand_key, source_card_family_id, created_at DESC);

CREATE TABLE IF NOT EXISTS operator_source_selection_receipts (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  selection_order INTEGER NOT NULL,
  source_identity_key TEXT NOT NULL,
  source_card_family_id TEXT NOT NULL,
  source_card_id TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  receipt_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, scope_type, scope_id, slot_key)
);

CREATE INDEX IF NOT EXISTS idx_operator_source_selection_receipts_scope
  ON operator_source_selection_receipts (brand_key, scope_type, scope_id, selection_order);

CREATE TABLE IF NOT EXISTS operator_source_selection_plans (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  cycle_id TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  selection_order INTEGER NOT NULL,
  source_identity_key TEXT NOT NULL,
  source_card_family_id TEXT NOT NULL,
  source_card_id TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  receipt_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'locked',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, cycle_id, slot_key)
);

CREATE INDEX IF NOT EXISTS idx_operator_source_selection_plans_cycle
  ON operator_source_selection_plans (brand_key, cycle_id, selection_order);

CREATE TABLE IF NOT EXISTS operator_manifest_decision_influences (
  id TEXT PRIMARY KEY,
  influence_key TEXT NOT NULL UNIQUE,
  brand_key TEXT NOT NULL,
  cycle_id TEXT,
  slot_key TEXT,
  scheduled_post_id INTEGER,
  hypothesis_id TEXT,
  strategy_version_id TEXT,
  learning_brief_key TEXT,
  benchmark_snapshot_key TEXT,
  family_key TEXT,
  portfolio_role TEXT,
  experiment_key TEXT,
  saved_pattern_identity_key TEXT,
  decision_changed INTEGER NOT NULL DEFAULT 0,
  decision_change_types_json TEXT NOT NULL DEFAULT '[]',
  decision_summary TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  influence_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, cycle_id, slot_key)
);

CREATE INDEX IF NOT EXISTS idx_manifest_decision_influences_brand_created
  ON operator_manifest_decision_influences (brand_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manifest_decision_influences_scheduled
  ON operator_manifest_decision_influences (brand_key, scheduled_post_id);
