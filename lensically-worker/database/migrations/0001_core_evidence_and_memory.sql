CREATE TABLE IF NOT EXISTS external_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_user_id TEXT NOT NULL,
  account_id TEXT NOT NULL DEFAULT 'manifest-mental',
  platform TEXT NOT NULL DEFAULT 'threads',
  source_url TEXT NOT NULL,
  post_id TEXT,
  author_handle TEXT,
  author_display_name TEXT,
  post_text TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  reposts INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  views INTEGER,
  posted_at TEXT,
  capture_confidence TEXT NOT NULL DEFAULT 'medium',
  raw_payload TEXT,
  saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(app_user_id, account_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_external_patterns_user_updated
  ON external_patterns (app_user_id, account_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_external_patterns_user_likes
  ON external_patterns (app_user_id, account_id, likes DESC, views DESC, updated_at DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_patterns_user_account_source
  ON external_patterns (app_user_id, account_id, source_url);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_patterns_user_account_post
  ON external_patterns (app_user_id, account_id, platform, post_id)
  WHERE post_id IS NOT NULL AND trim(post_id) <> '';

CREATE TABLE IF NOT EXISTS threads_follower_snapshots (
  threads_user_id TEXT NOT NULL CHECK (length(trim(threads_user_id)) > 0),
  snapshot_date TEXT NOT NULL CHECK (length(trim(snapshot_date)) = 10),
  followers_count INTEGER NOT NULL DEFAULT 0,
  baseline_followers_count INTEGER,
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (threads_user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_threads_follower_snapshots_captured_at
  ON threads_follower_snapshots (captured_at);

CREATE TABLE IF NOT EXISTS gpt_strategy_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  threads_user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gpt_strategy_memory_account_kind_updated
  ON gpt_strategy_memory (account_id, kind, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_gpt_strategy_memory_threads_updated
  ON gpt_strategy_memory (threads_user_id, updated_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS trg_gpt_strategy_memory_touch_updated_at
AFTER UPDATE ON gpt_strategy_memory
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE gpt_strategy_memory
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;
