CREATE TABLE IF NOT EXISTS app_threads_accounts (
  app_user_id TEXT NOT NULL,
  threads_user_id TEXT NOT NULL,
  connection_active INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  tombstone_expires_at TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (app_user_id, threads_user_id),
  FOREIGN KEY (app_user_id) REFERENCES users(id) ON DELETE CASCADE
);

DROP TRIGGER IF EXISTS trg_app_threads_accounts_user_cleanup;
DROP TRIGGER IF EXISTS trg_app_threads_accounts_user_exists_insert;
DROP TRIGGER IF EXISTS trg_app_threads_accounts_user_exists_update;

DROP TABLE IF EXISTS app_threads_accounts_multi_rebuild;
CREATE TABLE app_threads_accounts_multi_rebuild (
  app_user_id TEXT NOT NULL,
  threads_user_id TEXT NOT NULL,
  connection_active INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  tombstone_expires_at TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (app_user_id, threads_user_id),
  FOREIGN KEY (app_user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT OR REPLACE INTO app_threads_accounts_multi_rebuild (
  app_user_id,
  threads_user_id,
  connection_active,
  is_active,
  tombstone_expires_at,
  created_at
)
SELECT
  app_user_id,
  threads_user_id,
  COALESCE(connection_active, is_active, 1),
  COALESCE(is_active, connection_active, 1),
  tombstone_expires_at,
  COALESCE(created_at, CAST(strftime('%s','now') AS INTEGER))
FROM app_threads_accounts
WHERE app_user_id IS NOT NULL
  AND length(trim(app_user_id)) > 0
  AND threads_user_id IS NOT NULL
  AND length(trim(threads_user_id)) > 0;

DROP TABLE app_threads_accounts;
ALTER TABLE app_threads_accounts_multi_rebuild RENAME TO app_threads_accounts;

UPDATE app_threads_accounts
SET connection_active = COALESCE(connection_active, is_active, 1),
    is_active = COALESCE(is_active, connection_active, 1);

UPDATE app_threads_accounts
SET tombstone_expires_at = NULL
WHERE app_user_id IN (
  SELECT id FROM users WHERE is_admin = 1
)
  AND tombstone_expires_at IS NOT NULL;

UPDATE app_threads_accounts
SET is_active = CASE
  WHEN COALESCE(connection_active, is_active, 1) = 1
   AND threads_user_id = (
     SELECT preferred.threads_user_id
     FROM app_threads_accounts AS preferred
     WHERE preferred.app_user_id = app_threads_accounts.app_user_id
       AND COALESCE(preferred.connection_active, preferred.is_active, 1) = 1
     ORDER BY preferred.created_at DESC, preferred.threads_user_id ASC
     LIMIT 1
   ) THEN 1
  ELSE 0
END;

CREATE INDEX IF NOT EXISTS idx_app_threads_accounts_app_user_active
  ON app_threads_accounts (app_user_id, connection_active, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_threads_accounts_threads_user_id
  ON app_threads_accounts (threads_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_threads_accounts_one_active_per_user
  ON app_threads_accounts (app_user_id)
  WHERE COALESCE(connection_active, is_active, 1) = 1
    AND COALESCE(is_active, 1) = 1;

CREATE TRIGGER IF NOT EXISTS trg_app_threads_accounts_user_exists_insert
BEFORE INSERT ON app_threads_accounts
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.app_user_id)
BEGIN
  SELECT RAISE(ABORT, 'foreign_key_violation:app_threads_accounts.app_user_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_app_threads_accounts_user_exists_update
BEFORE UPDATE OF app_user_id ON app_threads_accounts
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.app_user_id)
BEGIN
  SELECT RAISE(ABORT, 'foreign_key_violation:app_threads_accounts.app_user_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_app_threads_accounts_user_cleanup
AFTER DELETE ON users
FOR EACH ROW
BEGIN
  DELETE FROM app_threads_accounts WHERE app_user_id = OLD.id;
END;

CREATE TABLE IF NOT EXISTS threads_accounts (
  threads_user_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  configured_account_id TEXT
);

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

DROP TABLE IF EXISTS threads_profile_cache_migration_backup;
CREATE TABLE threads_profile_cache_migration_backup (
  threads_user_id TEXT PRIMARY KEY,
  username TEXT,
  name TEXT,
  threads_biography TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  threads_profile_picture_url TEXT,
  last_refreshed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT OR REPLACE INTO threads_profile_cache_migration_backup (
  threads_user_id,
  username,
  name,
  threads_biography,
  is_verified,
  threads_profile_picture_url,
  last_refreshed_at,
  created_at
)
SELECT
  threads_user_id,
  username,
  name,
  threads_biography,
  COALESCE(is_verified, 0),
  threads_profile_picture_url,
  COALESCE(last_refreshed_at, CURRENT_TIMESTAMP),
  COALESCE(created_at, CURRENT_TIMESTAMP)
FROM threads_profile_cache
WHERE threads_user_id IS NOT NULL
  AND length(trim(threads_user_id)) > 0;

DROP TABLE threads_profile_cache;
DROP TABLE IF EXISTS threads_accounts_rebuild;
CREATE TABLE threads_accounts_rebuild (
  threads_user_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  configured_account_id TEXT
);

INSERT OR REPLACE INTO threads_accounts_rebuild (
  threads_user_id,
  access_token,
  expires_at,
  created_at,
  configured_account_id
)
SELECT
  threads_user_id,
  COALESCE(access_token, ''),
  COALESCE(expires_at, 0),
  COALESCE(created_at, CAST(strftime('%s','now') AS INTEGER)),
  configured_account_id
FROM threads_accounts
WHERE threads_user_id IS NOT NULL
  AND length(trim(threads_user_id)) > 0;

DROP TABLE threads_accounts;
ALTER TABLE threads_accounts_rebuild RENAME TO threads_accounts;

CREATE INDEX IF NOT EXISTS idx_threads_accounts_configured_account_id
  ON threads_accounts (configured_account_id);

CREATE TABLE threads_profile_cache (
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

INSERT OR REPLACE INTO threads_profile_cache (
  threads_user_id,
  username,
  name,
  threads_biography,
  is_verified,
  threads_profile_picture_url,
  last_refreshed_at,
  created_at
)
SELECT
  backup.threads_user_id,
  backup.username,
  backup.name,
  backup.threads_biography,
  backup.is_verified,
  backup.threads_profile_picture_url,
  backup.last_refreshed_at,
  backup.created_at
FROM threads_profile_cache_migration_backup AS backup
JOIN threads_accounts AS account
  ON account.threads_user_id = backup.threads_user_id;

DROP TABLE threads_profile_cache_migration_backup;

CREATE INDEX IF NOT EXISTS idx_threads_profile_cache_last_refreshed_at
  ON threads_profile_cache (last_refreshed_at);

CREATE TABLE IF NOT EXISTS meta_deletion_requests (
  confirmation_code TEXT PRIMARY KEY,
  platform_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
