CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  threads_user_id TEXT,
  threads_username TEXT,
  access_token TEXT,
  token_expires_at INTEGER,
  is_admin INTEGER NOT NULL DEFAULT 0,
  connection_active INTEGER NOT NULL DEFAULT 1,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  clock_format TEXT NOT NULL DEFAULT '12h' CHECK (clock_format IN ('12h', '24h')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  threads_user_id TEXT NOT NULL CHECK (length(trim(threads_user_id)) > 0),
  post_text TEXT NOT NULL,
  spoiler_all_text INTEGER NOT NULL DEFAULT 0,
  spoiler_phrases_json TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'posting', 'posted')),
  scheduled_time TEXT NOT NULL,
  publish_request_id TEXT,
  published_post_id TEXT,
  publish_error_message TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processing_started_at TEXT,
  published_at TEXT,
  failed_at TEXT,
  cancelled_at TEXT,
  last_attempted_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due
  ON scheduled_posts (status, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_id
  ON scheduled_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_threads_user_id
  ON scheduled_posts (threads_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_posts_idempotency_key
  ON scheduled_posts (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_user_exists_insert
BEFORE INSERT ON scheduled_posts
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'foreign_key_violation:scheduled_posts.user_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_user_exists_update
BEFORE UPDATE OF user_id ON scheduled_posts
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'foreign_key_violation:scheduled_posts.user_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_user_cleanup
AFTER DELETE ON users
FOR EACH ROW
BEGIN
  DELETE FROM scheduled_posts WHERE user_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_touch_updated_at
AFTER UPDATE ON scheduled_posts
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE scheduled_posts
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS scheduled_post_deletions (
  id TEXT PRIMARY KEY,
  scheduled_post_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  threads_user_id TEXT NOT NULL,
  post_text TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  status_before TEXT NOT NULL,
  reason_code TEXT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  learning_effect TEXT NOT NULL DEFAULT 'unobserved' CHECK (learning_effect = 'unobserved'),
  deleted_by TEXT NOT NULL CHECK (deleted_by IN ('owner', 'model')),
  deletion_source TEXT NOT NULL CHECK (deletion_source IN ('ui', 'mcp')),
  operation_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

UPDATE scheduled_post_deletions
SET reason_code = COALESCE(NULLIF(trim(reason_code), ''), 'legacy_unclassified'),
    learning_effect = 'unobserved';

CREATE INDEX IF NOT EXISTS idx_scheduled_post_deletions_account_time
  ON scheduled_post_deletions (threads_user_id, scheduled_time DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_post_deletions_scheduled_post
  ON scheduled_post_deletions (scheduled_post_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_post_deletions_operation
  ON scheduled_post_deletions (operation_id)
  WHERE operation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS batch_schedule_presets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  threads_user_id TEXT,
  name TEXT NOT NULL,
  times_json TEXT NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_batch_schedule_presets_user_id
  ON batch_schedule_presets (user_id, is_favorite DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_schedule_presets_user_threads
  ON batch_schedule_presets (user_id, threads_user_id, is_favorite DESC, updated_at DESC);
DROP INDEX IF EXISTS idx_batch_schedule_presets_favorite_per_user;
CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_schedule_presets_favorite_per_user_threads
  ON batch_schedule_presets (user_id, threads_user_id)
  WHERE is_favorite = 1 AND threads_user_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_batch_schedule_presets_touch_updated_at
AFTER UPDATE ON batch_schedule_presets
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE batch_schedule_presets
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_batch_schedule_presets_user_cleanup
AFTER DELETE ON users
FOR EACH ROW
BEGIN
  DELETE FROM batch_schedule_presets WHERE user_id = OLD.id;
END;

CREATE TABLE IF NOT EXISTS threads_publish_idempotency (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  app_user_id TEXT NOT NULL,
  threads_user_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  request_bucket TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scope, app_user_id, threads_user_id, request_hash, request_bucket),
  FOREIGN KEY (app_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_threads_publish_idempotency_created_at
  ON threads_publish_idempotency (created_at);

CREATE TRIGGER IF NOT EXISTS trg_threads_publish_idempotency_user_exists_insert
BEFORE INSERT ON threads_publish_idempotency
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.app_user_id)
BEGIN
  SELECT RAISE(ABORT, 'foreign_key_violation:threads_publish_idempotency.app_user_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_threads_publish_idempotency_user_cleanup
AFTER DELETE ON users
FOR EACH ROW
BEGIN
  DELETE FROM threads_publish_idempotency WHERE app_user_id = OLD.id;
END;
