CREATE TABLE IF NOT EXISTS operator_manifest_intelligence_policies (
  brand_key TEXT PRIMARY KEY,
  policy_version TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operator_manifest_strategy_versions (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  contract_version TEXT NOT NULL,
  parent_version_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  strategy_hash TEXT NOT NULL,
  strategy_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  change_summary TEXT,
  reversal_conditions_json TEXT NOT NULL DEFAULT '[]',
  source_cycle_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, version),
  UNIQUE(brand_key, strategy_hash)
);
CREATE INDEX IF NOT EXISTS idx_manifest_strategy_versions_brand
  ON operator_manifest_strategy_versions (brand_key, version DESC);

CREATE TABLE IF NOT EXISTS operator_manifest_exposure_snapshots (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL UNIQUE,
  brand_key TEXT NOT NULL,
  ledger_version TEXT NOT NULL,
  as_of TEXT NOT NULL,
  timezone TEXT NOT NULL,
  horizon_start_local TEXT,
  horizon_end_local TEXT,
  published_json TEXT NOT NULL DEFAULT '[]',
  scheduled_json TEXT NOT NULL DEFAULT '[]',
  dimensions_json TEXT NOT NULL DEFAULT '{}',
  source_hash TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operator_manifest_evidence_snapshots (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL UNIQUE,
  brand_key TEXT NOT NULL,
  snapshot_version TEXT NOT NULL,
  as_of TEXT NOT NULL,
  timezone TEXT NOT NULL,
  window_days INTEGER NOT NULL DEFAULT 28,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  post_count INTEGER NOT NULL DEFAULT 0,
  mature_count INTEGER NOT NULL DEFAULT 0,
  immature_count INTEGER NOT NULL DEFAULT 0,
  incomplete_count INTEGER NOT NULL DEFAULT 0,
  page_size INTEGER NOT NULL DEFAULT 12,
  page_count INTEGER NOT NULL DEFAULT 0,
  page_byte_budget INTEGER NOT NULL DEFAULT 12000,
  benchmarks_json TEXT NOT NULL DEFAULT '{}',
  previous_benchmarks_json TEXT NOT NULL DEFAULT '{}',
  recent_exposure_json TEXT NOT NULL DEFAULT '{}',
  future_schedule_json TEXT NOT NULL DEFAULT '[]',
  hard_bans_json TEXT NOT NULL DEFAULT '[]',
  experiments_json TEXT NOT NULL DEFAULT '[]',
  source_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operator_manifest_evidence_posts (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  published_post_id TEXT NOT NULL,
  scheduled_post_id INTEGER,
  text TEXT NOT NULL,
  published_at TEXT NOT NULL,
  age_hours REAL NOT NULL,
  maturity_state TEXT NOT NULL,
  primary_likes INTEGER,
  like_rate REAL,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  maturity_snapshots_json TEXT NOT NULL DEFAULT '[]',
  lineage_json TEXT NOT NULL DEFAULT '{}',
  classification_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(snapshot_id, published_post_id)
);
CREATE INDEX IF NOT EXISTS idx_manifest_evidence_posts_page
  ON operator_manifest_evidence_posts (snapshot_id, published_at DESC, published_post_id DESC);

CREATE TABLE IF NOT EXISTS operator_manifest_evidence_pages (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  cycle_id TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  page_index INTEGER NOT NULL,
  page_contract_version TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  byte_count INTEGER NOT NULL,
  evidence_types_json TEXT NOT NULL DEFAULT '[]',
  items_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(snapshot_id, page_index)
);
CREATE INDEX IF NOT EXISTS idx_manifest_evidence_pages_snapshot
  ON operator_manifest_evidence_pages (snapshot_id, page_index ASC);

CREATE TABLE IF NOT EXISTS operator_manifest_analysis_page_reads (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  cycle_id TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  page_index INTEGER NOT NULL,
  read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(snapshot_id, page_index)
);

CREATE TABLE IF NOT EXISTS operator_manifest_cycle_strategies (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL UNIQUE,
  brand_key TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  account_conclusion_json TEXT NOT NULL,
  content_focus_json TEXT NOT NULL,
  benchmarks_json TEXT NOT NULL,
  strongest_json TEXT NOT NULL DEFAULT '[]',
  weakest_json TEXT NOT NULL DEFAULT '[]',
  directives_json TEXT NOT NULL,
  experiments_json TEXT NOT NULL DEFAULT '[]',
  risks_json TEXT NOT NULL DEFAULT '[]',
  lineup_json TEXT NOT NULL,
  strategy_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'locked',
  locked_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, strategy_hash)
);

CREATE TABLE IF NOT EXISTS operator_manifest_cycle_plan_items (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  cycle_id TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  slot_date TEXT NOT NULL,
  slot_time TEXT NOT NULL,
  family_key TEXT NOT NULL,
  strategic_role TEXT NOT NULL,
  generation_mode TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_card_id TEXT,
  source_selection_id TEXT,
  audience_reward TEXT NOT NULL,
  hook_direction TEXT NOT NULL,
  placement_reason TEXT NOT NULL,
  nearby_avoid_json TEXT NOT NULL DEFAULT '[]',
  exploration_mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cycle_id, slot_key)
);
CREATE INDEX IF NOT EXISTS idx_manifest_cycle_plan_items_strategy
  ON operator_manifest_cycle_plan_items (strategy_id, slot_key ASC);

CREATE TABLE IF NOT EXISTS operator_manifest_candidate_gate_receipts (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  plan_item_id TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  candidate_hash TEXT NOT NULL,
  receipt_version TEXT NOT NULL,
  results_json TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cycle_id, slot_key, candidate_hash)
);

CREATE TABLE IF NOT EXISTS operator_manifest_hard_bans (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  description TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'manifest_generation',
  pass_examples_json TEXT NOT NULL DEFAULT '[]',
  fail_examples_json TEXT NOT NULL DEFAULT '[]',
  source_authority TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, rule_key)
);

CREATE TABLE IF NOT EXISTS operator_manifest_cycle_receipts (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL UNIQUE,
  brand_key TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  receipt_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  trigger_json TEXT NOT NULL,
  startup_state_json TEXT NOT NULL,
  input_strategy_version_id TEXT,
  output_strategy_version_id TEXT,
  exposure_snapshot_id TEXT,
  horizon_plan_json TEXT NOT NULL DEFAULT '{}',
  completion_json TEXT,
  unresolved_issues_json TEXT NOT NULL DEFAULT '[]',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operator_manifest_cycle_receipt_events (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  slot_key TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cycle_id, event_key)
);
CREATE INDEX IF NOT EXISTS idx_manifest_receipt_events_cycle
  ON operator_manifest_cycle_receipt_events (cycle_id, created_at ASC);

CREATE TABLE IF NOT EXISTS operator_manifest_cycle_defect_receipts (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  defect_key TEXT NOT NULL,
  receipt_version TEXT NOT NULL,
  stage_number INTEGER NOT NULL,
  stage_key TEXT NOT NULL,
  phase TEXT NOT NULL,
  slot_key TEXT,
  operation_id TEXT,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  impact_state TEXT NOT NULL,
  retryable INTEGER NOT NULL DEFAULT 0,
  blocking INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open',
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  reconciliation_json TEXT NOT NULL DEFAULT '{}',
  root_cause TEXT,
  repair_commit_sha TEXT,
  deployed_sha TEXT,
  regression_tests_json TEXT NOT NULL DEFAULT '[]',
  verification_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cycle_id, defect_key)
);
CREATE INDEX IF NOT EXISTS idx_manifest_cycle_defects_status
  ON operator_manifest_cycle_defect_receipts (
    cycle_id, status, blocking, first_seen_at ASC
  );

CREATE TABLE IF NOT EXISTS operator_manifest_post_hypotheses (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  hypothesis_version TEXT NOT NULL,
  strategy_version_id TEXT,
  source_kind TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_identity_key TEXT,
  source_card_id TEXT,
  source_selection_id TEXT,
  internal_source_id TEXT,
  expected_response_type TEXT NOT NULL,
  expected_audience_reward TEXT NOT NULL,
  hook_rationale TEXT NOT NULL,
  premise_rationale TEXT NOT NULL,
  exploration_mode TEXT NOT NULL,
  comparable_post_ids_json TEXT NOT NULL DEFAULT '[]',
  expected_performance_range_json TEXT NOT NULL,
  uncertainty TEXT NOT NULL,
  falsification_conditions_json TEXT NOT NULL DEFAULT '[]',
  candidate_trace_json TEXT NOT NULL DEFAULT '[]',
  model_evaluation_json TEXT NOT NULL DEFAULT '{}',
  scheduled_post_id INTEGER,
  status TEXT NOT NULL DEFAULT 'proposed',
  revision INTEGER NOT NULL DEFAULT 1,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cycle_id, slot_key)
);
CREATE INDEX IF NOT EXISTS idx_manifest_hypotheses_cycle
  ON operator_manifest_post_hypotheses (cycle_id, slot_key ASC);
