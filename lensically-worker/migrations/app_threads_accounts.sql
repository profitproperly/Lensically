CREATE TABLE IF NOT EXISTS app_threads_accounts (
  app_user_id TEXT PRIMARY KEY,
  threads_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (app_user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
