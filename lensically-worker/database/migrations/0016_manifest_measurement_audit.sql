CREATE TABLE IF NOT EXISTS operator_manifest_learning_briefs (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  brief_key TEXT NOT NULL,
  brief_version TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  evidence_window_start TEXT,
  evidence_window_end TEXT,
  authoritative_post_count INTEGER NOT NULL DEFAULT 0,
  brief_json TEXT NOT NULL,
  strategy_change_json TEXT NOT NULL DEFAULT '{}',
  strategy_version_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, brief_key)
);

CREATE TABLE IF NOT EXISTS operator_manifest_benchmark_snapshots (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  snapshot_key TEXT NOT NULL,
  cycle_id TEXT,
  benchmark_version TEXT NOT NULL,
  window_start TEXT,
  window_end TEXT,
  metrics_json TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, snapshot_key)
);

CREATE TABLE IF NOT EXISTS operator_manifest_run_comparisons (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  cycle_id TEXT NOT NULL,
  previous_cycle_id TEXT,
  comparison_version TEXT NOT NULL,
  comparison_json TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, cycle_id)
);

CREATE TABLE IF NOT EXISTS operator_manifest_saved_pattern_intelligence (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  pattern_identity_key TEXT NOT NULL,
  external_pattern_id INTEGER,
  source_identity_key TEXT NOT NULL,
  verified_metrics_json TEXT NOT NULL,
  semantic_json TEXT NOT NULL,
  mechanism_json TEXT NOT NULL,
  adaptation_options_json TEXT NOT NULL,
  similarity_json TEXT NOT NULL,
  usage_json TEXT NOT NULL,
  results_json TEXT NOT NULL,
  confidence_json TEXT NOT NULL,
  reuse_state TEXT NOT NULL,
  exclusion_state TEXT NOT NULL DEFAULT 'active',
  source_updated_at TEXT,
  intelligence_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, pattern_identity_key)
);

CREATE TABLE IF NOT EXISTS operator_manifest_follower_checkpoints (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  checkpoint_key TEXT NOT NULL,
  threads_user_id TEXT NOT NULL,
  checkpoint_version TEXT NOT NULL,
  snapshot_date TEXT,
  followers_count INTEGER NOT NULL,
  follower_goal INTEGER NOT NULL,
  distance_to_goal INTEGER NOT NULL,
  trajectory_json TEXT NOT NULL,
  attribution_policy TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, checkpoint_key)
);

CREATE INDEX IF NOT EXISTS idx_manifest_learning_briefs_brand_created
  ON operator_manifest_learning_briefs (brand_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manifest_benchmarks_brand_created
  ON operator_manifest_benchmark_snapshots (brand_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manifest_run_comparisons_brand_created
  ON operator_manifest_run_comparisons (brand_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manifest_pattern_intelligence_reuse
  ON operator_manifest_saved_pattern_intelligence (brand_key, reuse_state, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_manifest_follower_checkpoints_brand_created
  ON operator_manifest_follower_checkpoints (brand_key, created_at DESC);
