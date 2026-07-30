-- lensically-migration-class: schema
-- lensically-migration-owner: release-engineering
-- lensically-migration-risk: low

-- Manifest Shadow Cycle: physically isolated disposable workspace metadata and compact production receipts.

CREATE TABLE IF NOT EXISTS manifest_shadow_runs (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  scenario TEXT NOT NULL,
  evidence_mode TEXT NOT NULL CHECK (evidence_mode IN ('snapshot', 'live_read')),
  variant_key TEXT NOT NULL,
  operation_root TEXT NOT NULL UNIQUE,
  code_sha TEXT NOT NULL,
  snapshot_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('preparing', 'running', 'completed', 'failed', 'expired')),
  lease_expires_at TEXT NOT NULL,
  details_expires_at TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  failure_code TEXT,
  failure_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manifest_shadow_one_active_run
  ON manifest_shadow_runs(status)
  WHERE status IN ('preparing', 'running');
CREATE INDEX IF NOT EXISTS idx_manifest_shadow_runs_expiry
  ON manifest_shadow_runs(details_expires_at, status);

CREATE TABLE IF NOT EXISTS manifest_shadow_snapshots (
  id TEXT PRIMARY KEY,
  shadow_run_id TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  source_as_of TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  payload_bytes INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shadow_run_id) REFERENCES manifest_shadow_runs(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_manifest_shadow_snapshot_run
  ON manifest_shadow_snapshots(shadow_run_id);
CREATE INDEX IF NOT EXISTS idx_manifest_shadow_snapshot_hash
  ON manifest_shadow_snapshots(snapshot_hash);

CREATE TABLE IF NOT EXISTS manifest_shadow_stage_events (
  id TEXT PRIMARY KEY,
  shadow_run_id TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  event_key TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  duration_ms INTEGER,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shadow_run_id) REFERENCES manifest_shadow_runs(id) ON DELETE CASCADE,
  UNIQUE (shadow_run_id, event_key)
);
CREATE INDEX IF NOT EXISTS idx_manifest_shadow_stage_run
  ON manifest_shadow_stage_events(shadow_run_id, created_at);

CREATE TABLE IF NOT EXISTS manifest_shadow_diagnostic_archives (
  id TEXT PRIMARY KEY,
  shadow_run_id TEXT NOT NULL,
  archive_key TEXT NOT NULL,
  severity TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shadow_run_id) REFERENCES manifest_shadow_runs(id) ON DELETE CASCADE,
  UNIQUE (shadow_run_id, archive_key)
);
CREATE INDEX IF NOT EXISTS idx_manifest_shadow_diagnostics_expiry
  ON manifest_shadow_diagnostic_archives(expires_at);

CREATE TABLE IF NOT EXISTS manifest_shadow_benchmark_receipts (
  id TEXT PRIMARY KEY,
  shadow_run_id TEXT NOT NULL UNIQUE,
  brand_key TEXT NOT NULL,
  scenario TEXT NOT NULL,
  evidence_mode TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  code_sha TEXT NOT NULL,
  contract_versions_json TEXT NOT NULL DEFAULT '{}',
  counts_json TEXT NOT NULL DEFAULT '{}',
  timings_json TEXT NOT NULL DEFAULT '{}',
  external_read_count INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  continuation_count INTEGER NOT NULL DEFAULT 0,
  payload_bytes INTEGER NOT NULL DEFAULT 0,
  production_noninterference_passed INTEGER NOT NULL CHECK (production_noninterference_passed IN (0, 1)),
  threads_mutation_count INTEGER NOT NULL DEFAULT 0,
  cleanup_orphan_count INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL CHECK (passed IN (0, 1)),
  failed_rule TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_manifest_shadow_benchmarks_scenario
  ON manifest_shadow_benchmark_receipts(scenario, created_at);

-- The compact benchmark table is intentionally excluded from every Manifest intelligence query.
-- Detailed run tables are disposable and are populated only in SHADOW_DB.
