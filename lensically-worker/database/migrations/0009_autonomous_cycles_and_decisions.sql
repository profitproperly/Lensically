CREATE TABLE IF NOT EXISTS operator_autonomous_growth_cycles (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prepared',
  timezone TEXT NOT NULL,
  horizon_hours INTEGER NOT NULL,
  horizon_start_local TEXT NOT NULL,
  horizon_end_local TEXT NOT NULL,
  target_slots_json TEXT NOT NULL,
  missing_slots_json TEXT NOT NULL,
  account_position_json TEXT NOT NULL,
  strategic_thesis_json TEXT,
  scheduled_post_ids_json TEXT NOT NULL DEFAULT '[]',
  error_json TEXT,
  receipt_id TEXT,
  strategy_version_id TEXT,
  exposure_snapshot_id TEXT,
  evidence_snapshot_id TEXT,
  cycle_strategy_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, operation_id)
);
CREATE INDEX IF NOT EXISTS idx_operator_autonomous_cycles_brand_status
  ON operator_autonomous_growth_cycles (brand_key, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS operator_autonomous_lineup_items (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  slot_date TEXT NOT NULL,
  slot_time TEXT NOT NULL,
  text TEXT NOT NULL,
  generation_mode TEXT NOT NULL,
  family_key TEXT NOT NULL,
  strategic_purpose TEXT NOT NULL,
  strategy_json TEXT NOT NULL,
  cycle_strategy_id TEXT,
  cycle_plan_item_id TEXT,
  gate_receipt_id TEXT,
  source_card_id TEXT,
  source_selection_id TEXT,
  hypothesis_id TEXT,
  generation_run_id TEXT,
  draft_id TEXT,
  scheduled_post_id INTEGER,
  status TEXT NOT NULL DEFAULT 'planned',
  owner_feedback TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cycle_id, slot_key)
);
CREATE INDEX IF NOT EXISTS idx_operator_autonomous_lineup_schedule
  ON operator_autonomous_lineup_items (brand_key, scheduled_post_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_operator_autonomous_lineup_strategy
  ON operator_autonomous_lineup_items (cycle_strategy_id, cycle_id, slot_key);
CREATE INDEX IF NOT EXISTS idx_operator_autonomous_lineup_plan
  ON operator_autonomous_lineup_items (cycle_plan_item_id);
CREATE INDEX IF NOT EXISTS idx_operator_autonomous_lineup_gate
  ON operator_autonomous_lineup_items (gate_receipt_id);

CREATE TABLE IF NOT EXISTS operator_decision_proposals (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  decision_key TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  decision_text TEXT NOT NULL,
  rationale TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  expected_outcome TEXT NOT NULL,
  risks_json TEXT NOT NULL,
  reversibility TEXT NOT NULL,
  execution_plan TEXT NOT NULL,
  authorized_tools_json TEXT NOT NULL,
  execution_budget_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  proposed_by TEXT NOT NULL DEFAULT 'model',
  owner_response TEXT,
  revision_request TEXT,
  outcome_summary TEXT,
  result_evidence_json TEXT,
  supersedes_decision_id TEXT,
  approved_at TEXT,
  rejected_at TEXT,
  executed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_decision_proposals_key
  ON operator_decision_proposals (brand_key, decision_key);
CREATE INDEX IF NOT EXISTS idx_operator_decision_proposals_status
  ON operator_decision_proposals (brand_key, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS operator_decision_execution_events (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  operation_id TEXT,
  request_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  result_summary TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_operator_decision_execution_events_budget
  ON operator_decision_execution_events (decision_id, tool_name, status, created_at DESC);
