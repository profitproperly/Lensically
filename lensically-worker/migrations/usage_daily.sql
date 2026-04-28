CREATE TABLE IF NOT EXISTS user_usage_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  me_calls INTEGER NOT NULL DEFAULT 0,
  insights_calls INTEGER NOT NULL DEFAULT 0,
  publish_calls INTEGER NOT NULL DEFAULT 0,
  keyword_calls INTEGER NOT NULL DEFAULT 0,
  profile_calls INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS trg_user_usage_daily_user_exists_insert
BEFORE INSERT ON user_usage_daily
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM users
  WHERE id = NEW.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'foreign_key_violation:user_usage_daily.user_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_user_usage_daily_user_exists_update
BEFORE UPDATE OF user_id ON user_usage_daily
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM users
  WHERE id = NEW.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'foreign_key_violation:user_usage_daily.user_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_user_usage_daily_user_cleanup
AFTER DELETE ON users
FOR EACH ROW
BEGIN
  DELETE FROM user_usage_daily
  WHERE user_id = OLD.id;
END;

CREATE TABLE IF NOT EXISTS user_usage_feature_daily (
  usage_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  feature TEXT NOT NULL CHECK (
    feature IN ('me', 'insights', 'publish', 'keyword_search', 'profile_discovery')
  ),
  date TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, feature, date)
);

CREATE INDEX IF NOT EXISTS idx_user_usage_feature_daily_user_date
  ON user_usage_feature_daily (user_id, date);

CREATE TRIGGER IF NOT EXISTS trg_user_usage_feature_daily_user_cleanup
AFTER DELETE ON users
FOR EACH ROW
BEGIN
  DELETE FROM user_usage_feature_daily
  WHERE user_id = OLD.id;
END;
