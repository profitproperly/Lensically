CREATE TABLE IF NOT EXISTS threads_follower_snapshots (
  threads_user_id TEXT NOT NULL CHECK (length(trim(threads_user_id)) > 0),
  snapshot_date TEXT NOT NULL CHECK (length(trim(snapshot_date)) = 10),
  followers_count INTEGER NOT NULL DEFAULT 0,
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (threads_user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_threads_follower_snapshots_captured_at
  ON threads_follower_snapshots (captured_at);
