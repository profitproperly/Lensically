CREATE TABLE IF NOT EXISTS operator_work_state (
  id TEXT PRIMARY KEY CHECK (id = 'singleton'),
  contract_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  role TEXT NOT NULL,
  active_outcome_key TEXT NOT NULL,
  active_outcome_title TEXT NOT NULL,
  active_scope_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  scope_frozen INTEGER NOT NULL DEFAULT 1,
  active_interrupt_key TEXT,
  next_action TEXT NOT NULL,
  completion_evidence_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operator_work_ledger (
  id TEXT PRIMARY KEY,
  work_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  intake_decision TEXT NOT NULL,
  intake_reason TEXT NOT NULL,
  required_for_active_outcome INTEGER NOT NULL DEFAULT 0,
  dependencies_json TEXT NOT NULL DEFAULT '[]',
  completion_condition TEXT NOT NULL,
  execution_order INTEGER NOT NULL DEFAULT 1000,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  merged_into_work_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_operator_work_ledger_status_order
  ON operator_work_ledger (status, priority, execution_order, updated_at DESC);

CREATE TABLE IF NOT EXISTS operator_repo_write_sessions (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  mode TEXT NOT NULL,
  message TEXT NOT NULL,
  summary TEXT,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operator_system_retirements (
  retirement_key TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS operator_workflow_sessions;
DROP TABLE IF EXISTS operator_context_admissions;
DROP TABLE IF EXISTS operator_production_board_items;
DROP TABLE IF EXISTS operator_review_batches;
DROP TABLE IF EXISTS agent_account_controls;
DROP TABLE IF EXISTS operator_local_execution_nodes;
DROP TABLE IF EXISTS operator_local_execution_jobs;
DROP TABLE IF EXISTS operator_local_validation_receipts;
DROP TABLE IF EXISTS operator_validation_plane_events;
DROP TABLE IF EXISTS operator_local_execution_enrollment_tokens;

INSERT OR REPLACE INTO operator_system_retirements (retirement_key, completed_at)
VALUES ('human-free-retirement-v2', CURRENT_TIMESTAMP);
