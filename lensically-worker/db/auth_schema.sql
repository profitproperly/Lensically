-- Authentication schema for Lensically worker

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  clock_format TEXT NOT NULL DEFAULT '12h' CHECK (clock_format IN ('12h', '24h')),
  email_verified INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'discord', 'github')),
  provider_user_id TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider, provider_user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  route TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_route_updated_at
  ON auth_rate_limits (route, updated_at);

CREATE TABLE IF NOT EXISTS account_deletion_guards (
  session_token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_guards_user_id
  ON account_deletion_guards (user_id);

CREATE TABLE IF NOT EXISTS account_deletion_tombstones (
  id TEXT PRIMARY KEY,
  identity_type TEXT NOT NULL CHECK (identity_type IN ('email', 'google', 'github', 'discord')),
  identity_value TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tombstones_identity_expires
  ON account_deletion_tombstones (identity_type, identity_value, expires_at);

CREATE TABLE IF NOT EXISTS banned_identities (
  id TEXT PRIMARY KEY,
  identity_type TEXT NOT NULL CHECK (identity_type IN ('email', 'google', 'github', 'discord')),
  identity_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_banned_identity_expires
  ON banned_identities (identity_type, identity_value, expires_at);

CREATE TABLE IF NOT EXISTS batch_schedule_presets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  threads_user_id TEXT,
  name TEXT NOT NULL,
  times_json TEXT NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_batch_schedule_presets_user_id
  ON batch_schedule_presets (user_id, is_favorite DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_batch_schedule_presets_user_threads
  ON batch_schedule_presets (user_id, threads_user_id, is_favorite DESC, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_schedule_presets_favorite_per_user_threads
  ON batch_schedule_presets (user_id, threads_user_id)
  WHERE is_favorite = 1 AND threads_user_id IS NOT NULL;
