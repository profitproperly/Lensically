CREATE TABLE IF NOT EXISTS operator_post_fingerprints (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  published_post_id TEXT NOT NULL,
  scheduled_post_id INTEGER,
  draft_id TEXT,
  source_card_id TEXT,
  source_selection_id TEXT,
  text_hash TEXT,
  fingerprint_version TEXT NOT NULL,
  fingerprint_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, published_post_id)
);
CREATE INDEX IF NOT EXISTS idx_operator_post_fingerprints_brand_updated
  ON operator_post_fingerprints (brand_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS operator_post_performance_scores (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  published_post_id TEXT NOT NULL,
  checkpoint_hours INTEGER NOT NULL,
  snapshot_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  post_age_hours REAL NOT NULL,
  metrics_json TEXT NOT NULL,
  rates_json TEXT NOT NULL,
  velocity_json TEXT NOT NULL,
  scores_json TEXT NOT NULL,
  distribution_state TEXT NOT NULL,
  valid_for_learning INTEGER NOT NULL DEFAULT 1,
  evaluator_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, published_post_id, checkpoint_hours)
);
CREATE INDEX IF NOT EXISTS idx_operator_post_performance_scores_cohort
  ON operator_post_performance_scores (
    brand_key, checkpoint_hours, valid_for_learning, updated_at DESC
  );

CREATE TABLE IF NOT EXISTS operator_performance_evidence (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  checkpoint_hours INTEGER NOT NULL,
  dimension TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  sample_size INTEGER NOT NULL,
  cohort_size INTEGER NOT NULL,
  medians_json TEXT NOT NULL,
  effect_json TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  confidence_label TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  evaluator_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, checkpoint_hours, dimension, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_operator_performance_evidence_lookup
  ON operator_performance_evidence (
    brand_key, status, checkpoint_hours, confidence_score DESC
  );

CREATE TABLE IF NOT EXISTS operator_performance_hypotheses (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  checkpoint_hours INTEGER NOT NULL,
  dimension TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  hypothesis_text TEXT NOT NULL,
  direction TEXT NOT NULL,
  sample_size INTEGER NOT NULL,
  confidence_score REAL NOT NULL,
  confidence_label TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  evaluator_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, checkpoint_hours, dimension, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_operator_performance_hypotheses_lookup
  ON operator_performance_hypotheses (
    brand_key, status, confidence_score DESC, updated_at DESC
  );

CREATE TABLE IF NOT EXISTS operator_generation_learning_briefs (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  checkpoint_hours INTEGER,
  sample_size INTEGER NOT NULL DEFAULT 0,
  brief_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  evaluator_version TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_operator_generation_learning_briefs_active
  ON operator_generation_learning_briefs (brand_key, active, generated_at DESC);

CREATE TABLE IF NOT EXISTS operator_content_focus_reviews (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  cadence TEXT NOT NULL,
  period_key TEXT NOT NULL,
  anchor_date TEXT NOT NULL,
  windows_json TEXT NOT NULL,
  decisions_json TEXT NOT NULL,
  allocation_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  evaluator_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, cadence, period_key)
);
CREATE INDEX IF NOT EXISTS idx_operator_content_focus_reviews_latest
  ON operator_content_focus_reviews (brand_key, cadence, generated_at DESC);

CREATE TABLE IF NOT EXISTS operator_content_focus_family_states (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  source_card_family_id TEXT NOT NULL,
  source_identity_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'test',
  recommended_status TEXT NOT NULL DEFAULT 'test',
  confidence_score REAL NOT NULL DEFAULT 0,
  confidence_label TEXT NOT NULL DEFAULT 'insufficient',
  allocation_weight REAL NOT NULL DEFAULT 1,
  decision_reason TEXT NOT NULL,
  reuse_directives_json TEXT NOT NULL DEFAULT '{}',
  stop_directives_json TEXT NOT NULL DEFAULT '{}',
  horizon_evidence_json TEXT NOT NULL DEFAULT '{}',
  manual_lock INTEGER NOT NULL DEFAULT 0,
  last_review_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, source_card_family_id)
);
CREATE INDEX IF NOT EXISTS idx_operator_content_focus_family_selection
  ON operator_content_focus_family_states (
    brand_key, status, allocation_weight DESC, updated_at DESC
  );
