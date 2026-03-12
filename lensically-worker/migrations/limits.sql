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
  post_text TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
