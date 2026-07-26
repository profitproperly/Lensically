CREATE TABLE IF NOT EXISTS operator_mcp_sessions (
  id TEXT PRIMARY KEY,
  selected_brand_key TEXT,
  proceeded_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_operator_mcp_sessions_expires
  ON operator_mcp_sessions (expires_at);

CREATE TABLE IF NOT EXISTS operator_continuity_refs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  workflow_session_id TEXT,
  continuation_choice TEXT,
  payload_json TEXT,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operator_continuity_refs_scope
  ON operator_continuity_refs (brand_key, kind, expires_at);

CREATE TABLE IF NOT EXISTS operator_operation_receipts (
  idempotency_key TEXT PRIMARY KEY,
  brand_key TEXT,
  workflow_session_id TEXT,
  operation_type TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operator_operation_receipts_scope
  ON operator_operation_receipts (
    brand_key,
    workflow_session_id,
    operation_type,
    updated_at DESC
  );

CREATE TABLE IF NOT EXISTS operator_growth_missions (
  brand_key TEXT PRIMARY KEY,
  contract_version TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'discussion',
  execution_mode TEXT NOT NULL DEFAULT 'autonomous_operator',
  mission_json TEXT NOT NULL,
  diagnostic_json TEXT NOT NULL DEFAULT '{}',
  owner_response TEXT,
  change_summary TEXT,
  approved_at TEXT,
  last_diagnostic_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operator_growth_mission_revisions (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  mission_version INTEGER NOT NULL,
  status TEXT NOT NULL,
  execution_mode TEXT NOT NULL,
  mission_json TEXT NOT NULL,
  diagnostic_json TEXT NOT NULL,
  owner_response TEXT,
  change_summary TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operator_growth_mission_revisions_brand
  ON operator_growth_mission_revisions (
    brand_key,
    mission_version DESC,
    created_at DESC
  );

CREATE TABLE IF NOT EXISTS operator_autonomy_profiles (
  brand_key TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  objective TEXT NOT NULL,
  model_role TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  approval_policy TEXT NOT NULL,
  operating_constraints_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
