CREATE TABLE IF NOT EXISTS operator_manifest_prepare_checkpoints (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  checkpoint_version TEXT NOT NULL,
  phase TEXT NOT NULL,
  timezone TEXT NOT NULL,
  horizon_hours INTEGER NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, operation_id)
);

CREATE TABLE IF NOT EXISTS operator_pre_call_routes (
  id TEXT PRIMARY KEY,
  route_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'lensically',
  tool_name TEXT NOT NULL,
  operation_key TEXT NOT NULL DEFAULT '*',
  match_json TEXT NOT NULL DEFAULT '{}',
  action TEXT NOT NULL DEFAULT 'apply',
  required_tool TEXT,
  mandatory_route TEXT NOT NULL,
  argument_patch_json TEXT NOT NULL DEFAULT '{}',
  allowed_argument_keys_json TEXT,
  reason TEXT NOT NULL,
  verification_summary TEXT NOT NULL,
  source_memory_id TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_operator_pre_call_routes_lookup
  ON operator_pre_call_routes (
    active, provider, tool_name, operation_key, priority DESC, updated_at DESC
  );

CREATE TABLE IF NOT EXISTS operator_execution_events (
  id TEXT PRIMARY KEY,
  brand_key TEXT,
  workflow_session_id TEXT,
  tool_name TEXT NOT NULL,
  operation_class TEXT NOT NULL,
  execution_plane TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  decision TEXT NOT NULL,
  known_failure_prevented INTEGER NOT NULL DEFAULT 0,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_operator_execution_events_recent
  ON operator_execution_events (created_at DESC, tool_name);
