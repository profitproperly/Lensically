-- lensically-migration-class: schema
-- lensically-migration-owner: release-engineering
-- lensically-migration-risk: low

CREATE TABLE IF NOT EXISTS lensically_backfill_runs (
  backfill_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  plan_sha256 TEXT NOT NULL,
  source_sha TEXT NOT NULL,
  table_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('running', 'paused', 'completed', 'failed')
  ),
  last_cursor INTEGER,
  batches_completed INTEGER NOT NULL DEFAULT 0,
  rows_changed INTEGER NOT NULL DEFAULT 0,
  remaining_rows INTEGER,
  error_message TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  PRIMARY KEY (backfill_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_lensically_backfill_runs_status
  ON lensically_backfill_runs(status, updated_at);

CREATE TABLE IF NOT EXISTS lensically_backfill_batch_receipts (
  backfill_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  batch_number INTEGER NOT NULL,
  cursor_from INTEGER,
  cursor_to INTEGER,
  selected_rows INTEGER NOT NULL,
  changed_rows INTEGER NOT NULL,
  remaining_rows INTEGER,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (backfill_id, operation_id, batch_number),
  FOREIGN KEY (backfill_id, operation_id)
    REFERENCES lensically_backfill_runs(backfill_id, operation_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lensically_backfill_batch_receipts_lookup
  ON lensically_backfill_batch_receipts(backfill_id, operation_id, batch_number);
