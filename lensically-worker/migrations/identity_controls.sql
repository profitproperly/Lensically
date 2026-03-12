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
