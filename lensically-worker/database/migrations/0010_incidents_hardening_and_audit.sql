CREATE TABLE IF NOT EXISTS operator_operational_incidents (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  incident_key TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'critical',
  status TEXT NOT NULL DEFAULT 'open',
  scheduled_post_id INTEGER,
  production_date TEXT,
  scheduled_time TEXT,
  observed_status TEXT,
  delivery_state TEXT,
  published_post_id TEXT,
  publish_error_message TEXT,
  last_attempted_at TEXT,
  required_recovery_action TEXT NOT NULL,
  evidence_json TEXT,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, incident_key)
);
CREATE INDEX IF NOT EXISTS idx_operator_operational_incidents_open
  ON operator_operational_incidents (brand_key, status, severity, last_observed_at DESC);
CREATE TRIGGER IF NOT EXISTS trg_operator_operational_incidents_touch_updated_at
AFTER UPDATE ON operator_operational_incidents
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE operator_operational_incidents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS operator_engineering_audit (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  files_changed_json TEXT,
  diff_summary TEXT,
  tests_run_json TEXT,
  result TEXT NOT NULL,
  deployment_id TEXT,
  rollback_target TEXT,
  owner_approval TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operator_hardening_incidents (
  id TEXT PRIMARY KEY,
  signature TEXT NOT NULL,
  boundary TEXT NOT NULL,
  severity TEXT NOT NULL,
  classification TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'detected',
  affected_scope TEXT NOT NULL DEFAULT 'objective',
  blocked_profile_id TEXT,
  blocked_tool_name TEXT,
  request_fingerprint TEXT,
  expected_json TEXT,
  observed_json TEXT,
  side_effect_state TEXT NOT NULL DEFAULT 'not_applicable',
  root_cause TEXT,
  generalized_cause TEXT,
  prevention_rule_id TEXT,
  regression_test_ids_json TEXT,
  tested_sha TEXT,
  deployment_id TEXT,
  live_verification_json TEXT,
  resume_capsule_json TEXT,
  resume_result_json TEXT,
  autonomy_dividend_json TEXT,
  efficiency_result_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_hardening_open_signature
  ON operator_hardening_incidents (signature)
  WHERE state <> 'closed';
CREATE INDEX IF NOT EXISTS idx_operator_hardening_state_severity
  ON operator_hardening_incidents (state, severity, updated_at DESC);
CREATE TRIGGER IF NOT EXISTS trg_operator_hardening_touch_updated_at
AFTER UPDATE ON operator_hardening_incidents
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE operator_hardening_incidents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS operator_hardening_incident_events (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_operator_hardening_events_incident
  ON operator_hardening_incident_events (incident_id, created_at ASC);

CREATE TABLE IF NOT EXISTS operator_operational_observations (
  id TEXT PRIMARY KEY,
  operation_id TEXT,
  incident_id TEXT,
  profile_id TEXT,
  capability TEXT,
  outcome TEXT NOT NULL,
  duration_ms INTEGER,
  call_count INTEGER,
  external_requests INTEGER,
  repeated_fingerprint_count INTEGER,
  progress_checkpoint TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_operator_observations_capability_created
  ON operator_operational_observations (capability, created_at DESC);
