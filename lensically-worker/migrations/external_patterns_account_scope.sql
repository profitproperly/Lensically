PRAGMA defer_foreign_keys = on;

CREATE TABLE IF NOT EXISTS external_patterns_v2 (
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

INSERT OR IGNORE INTO external_patterns_v2 (
  id,
  app_user_id,
  account_id,
  platform,
  source_url,
  post_id,
  author_handle,
  author_display_name,
  post_text,
  likes,
  replies,
  reposts,
  shares,
  views,
  posted_at,
  capture_confidence,
  raw_payload,
  saved_at,
  updated_at
)
SELECT
  id,
  app_user_id,
  'manifest-mental',
  platform,
  source_url,
  post_id,
  author_handle,
  author_display_name,
  post_text,
  likes,
  replies,
  reposts,
  shares,
  views,
  posted_at,
  capture_confidence,
  raw_payload,
  saved_at,
  updated_at
FROM external_patterns;

DROP TABLE external_patterns;
ALTER TABLE external_patterns_v2 RENAME TO external_patterns;

CREATE INDEX IF NOT EXISTS idx_external_patterns_user_updated
  ON external_patterns (app_user_id, account_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_external_patterns_user_likes
  ON external_patterns (app_user_id, account_id, likes DESC, views DESC, updated_at DESC, id DESC);

PRAGMA defer_foreign_keys = off;
