-- lensically-migration-class: schema
-- lensically-migration-owner: signal-radar
-- lensically-migration-risk: low

CREATE TABLE IF NOT EXISTS signal_radar_sources (
  source_id TEXT PRIMARY KEY,
  vendor TEXT NOT NULL,
  product TEXT NOT NULL,
  source_type TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  fetch_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 50,
  poll_interval_minutes INTEGER NOT NULL DEFAULT 60,
  last_checked_at TEXT,
  last_changed_at TEXT,
  last_http_status INTEGER,
  last_etag TEXT,
  last_modified TEXT,
  last_content_hash TEXT,
  last_content TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signal_radar_sources_enabled_priority
  ON signal_radar_sources(enabled, priority DESC, vendor, product);

CREATE TABLE IF NOT EXISTS signal_radar_signals (
  signal_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  vendor TEXT NOT NULL,
  product TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  previous_hash TEXT,
  current_hash TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.95,
  importance INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'new',
  published_at TEXT,
  detected_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES signal_radar_sources(source_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_signal_radar_signals_source_hash
  ON signal_radar_signals(source_id, current_hash);

CREATE INDEX IF NOT EXISTS idx_signal_radar_signals_detected
  ON signal_radar_signals(detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_signal_radar_signals_status_importance
  ON signal_radar_signals(status, importance DESC, detected_at DESC);

CREATE TABLE IF NOT EXISTS signal_radar_runs (
  run_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  source_count INTEGER NOT NULL DEFAULT 0,
  checked_count INTEGER NOT NULL DEFAULT 0,
  changed_count INTEGER NOT NULL DEFAULT 0,
  signal_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signal_radar_runs_started
  ON signal_radar_runs(started_at DESC);
