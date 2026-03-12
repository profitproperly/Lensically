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

CREATE TRIGGER IF NOT EXISTS trg_account_deletion_guards_user_exists_insert
BEFORE INSERT ON account_deletion_guards
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM users
  WHERE id = NEW.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'foreign_key_violation:account_deletion_guards.user_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_account_deletion_guards_user_exists_update
BEFORE UPDATE OF user_id ON account_deletion_guards
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM users
  WHERE id = NEW.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'foreign_key_violation:account_deletion_guards.user_id');
END;
