CREATE TABLE IF NOT EXISTS user_daily_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,

  me_calls INTEGER DEFAULT 0,
  insights_calls INTEGER DEFAULT 0,
  publish_calls INTEGER DEFAULT 0,
  keyword_calls INTEGER DEFAULT 0,
  discovery_calls INTEGER DEFAULT 0,

  UNIQUE(user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  threads_user_id TEXT NOT NULL CHECK (length(trim(threads_user_id)) > 0),
  post_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'posting', 'posted')),
  scheduled_time TEXT NOT NULL,
  publish_request_id TEXT,
  published_post_id TEXT,
  publish_error_message TEXT,
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

CREATE TRIGGER IF NOT EXISTS trg_user_daily_usage_user_exists_insert
BEFORE INSERT ON user_daily_usage
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM users
  WHERE id = NEW.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'foreign_key_violation:user_daily_usage.user_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_user_daily_usage_user_exists_update
BEFORE UPDATE OF user_id ON user_daily_usage
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM users
  WHERE id = NEW.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'foreign_key_violation:user_daily_usage.user_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_user_daily_usage_user_cleanup
AFTER DELETE ON users
FOR EACH ROW
BEGIN
  DELETE FROM user_daily_usage
  WHERE user_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_user_exists_insert
BEFORE INSERT ON scheduled_posts
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM users
  WHERE id = NEW.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'foreign_key_violation:scheduled_posts.user_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_user_exists_update
BEFORE UPDATE OF user_id ON scheduled_posts
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM users
  WHERE id = NEW.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'foreign_key_violation:scheduled_posts.user_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_user_cleanup
AFTER DELETE ON users
FOR EACH ROW
BEGIN
  DELETE FROM scheduled_posts
  WHERE user_id = OLD.id;
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
