CREATE TABLE IF NOT EXISTS meta_deletion_requests (
  confirmation_code TEXT PRIMARY KEY,
  platform_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
