CREATE TABLE IF NOT EXISTS app_threads_accounts_v2 (
  app_user_id TEXT NOT NULL,
  threads_user_id TEXT NOT NULL,
  connection_active INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  tombstone_expires_at TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (app_user_id, threads_user_id),
  FOREIGN KEY (app_user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT OR REPLACE INTO app_threads_accounts_v2 (
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
  created_at
FROM app_threads_accounts;

DROP TABLE app_threads_accounts;
ALTER TABLE app_threads_accounts_v2 RENAME TO app_threads_accounts;

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
WHEN NOT EXISTS (
  SELECT 1
  FROM users
  WHERE id = NEW.app_user_id
)
BEGIN
  SELECT RAISE(ABORT, 'foreign_key_violation:app_threads_accounts.app_user_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_app_threads_accounts_user_exists_update
BEFORE UPDATE OF app_user_id ON app_threads_accounts
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM users
  WHERE id = NEW.app_user_id
)
BEGIN
  SELECT RAISE(ABORT, 'foreign_key_violation:app_threads_accounts.app_user_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_app_threads_accounts_user_cleanup
AFTER DELETE ON users
FOR EACH ROW
BEGIN
  DELETE FROM app_threads_accounts
  WHERE app_user_id = OLD.id;
END;
