CREATE TABLE IF NOT EXISTS threads_accounts (
  threads_user_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
