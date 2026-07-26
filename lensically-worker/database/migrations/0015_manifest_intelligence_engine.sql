CREATE TABLE IF NOT EXISTS operator_manifest_semantic_signatures (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  scheduled_post_id INTEGER,
  published_post_id TEXT,
  observed_at TEXT,
  text_hash TEXT NOT NULL,
  signature_version TEXT NOT NULL,
  signature_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_manifest_semantic_signatures_recent
  ON operator_manifest_semantic_signatures (brand_key, observed_at DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS operator_manifest_maturity_evaluations (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  published_post_id TEXT NOT NULL,
  checkpoint_hours INTEGER NOT NULL,
  evaluation_version TEXT NOT NULL,
  evaluation_json TEXT NOT NULL,
  structural_change_allowed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, published_post_id, checkpoint_hours)
);

CREATE TABLE IF NOT EXISTS operator_manifest_comparable_analyses (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  published_post_id TEXT NOT NULL,
  checkpoint_hours INTEGER NOT NULL,
  analysis_version TEXT NOT NULL,
  comparable_post_ids_json TEXT NOT NULL,
  analysis_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, published_post_id, checkpoint_hours)
);

CREATE TABLE IF NOT EXISTS operator_manifest_learning_observations (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  level TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  checkpoint_hours INTEGER NOT NULL DEFAULT 24,
  sample_size INTEGER NOT NULL,
  supporting_count INTEGER NOT NULL,
  contradicting_count INTEGER NOT NULL,
  median_overall REAL NOT NULL,
  effect_size REAL NOT NULL,
  confidence_score REAL NOT NULL,
  confidence_label TEXT NOT NULL,
  state TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  learning_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, level, feature_key, checkpoint_hours)
);

CREATE TABLE IF NOT EXISTS operator_manifest_portfolio_states (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  family_key TEXT NOT NULL,
  role TEXT NOT NULL,
  recommended_role TEXT NOT NULL,
  previous_role TEXT,
  confidence_score REAL NOT NULL,
  confidence_label TEXT NOT NULL,
  allocation_weight REAL NOT NULL,
  actual_decay INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  portfolio_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, family_key)
);

CREATE TABLE IF NOT EXISTS operator_manifest_state_transitions (
  id TEXT PRIMARY KEY,
  transition_key TEXT NOT NULL UNIQUE,
  brand_key TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  transitioned_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operator_manifest_experiments (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  experiment_key TEXT NOT NULL,
  family_key TEXT,
  hypothesis_json TEXT NOT NULL,
  comparison_group_json TEXT NOT NULL,
  maturity_windows_json TEXT NOT NULL,
  result_criteria_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  latest_result_json TEXT NOT NULL DEFAULT '{}',
  follow_up_decision TEXT,
  experiment_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, experiment_key)
);

CREATE TABLE IF NOT EXISTS operator_manifest_experiment_assignments (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  cycle_id TEXT,
  slot_key TEXT,
  hypothesis_id TEXT,
  scheduled_post_id INTEGER,
  published_post_id TEXT,
  variant_key TEXT NOT NULL DEFAULT 'variant',
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(experiment_id, scheduled_post_id)
);
