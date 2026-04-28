CREATE TABLE IF NOT EXISTS threads_profile_cache (
  threads_user_id TEXT PRIMARY KEY CHECK (length(trim(threads_user_id)) > 0),
  username TEXT,
  name TEXT,
  threads_biography TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  threads_profile_picture_url TEXT,
  last_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (threads_user_id) REFERENCES threads_accounts(threads_user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_threads_profile_cache_last_refreshed_at
  ON threads_profile_cache (last_refreshed_at);
