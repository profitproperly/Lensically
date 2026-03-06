CREATE TABLE IF NOT EXISTS user_daily_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,

  me_calls INTEGER DEFAULT 0,
  insights_calls INTEGER DEFAULT 0,
  publish_calls INTEGER DEFAULT 0,
  keyword_calls INTEGER DEFAULT 0,
  discovery_calls INTEGER DEFAULT 0,

  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  post_text TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
