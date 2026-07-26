CREATE TABLE IF NOT EXISTS threads_user_insights_cache (
  threads_user_id TEXT PRIMARY KEY CHECK (length(trim(threads_user_id)) > 0),
  insights_json TEXT NOT NULL,
  last_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_threads_user_insights_cache_last_refreshed_at
  ON threads_user_insights_cache (last_refreshed_at);

CREATE TABLE IF NOT EXISTS threads_post_insights_cache (
  threads_user_id TEXT NOT NULL,
  post_id TEXT PRIMARY KEY CHECK (length(trim(post_id)) > 0),
  post_text TEXT,
  post_timestamp TEXT,
  post_permalink TEXT,
  post_username TEXT,
  profile_picture_url TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  reposts INTEGER NOT NULL DEFAULT 0,
  quotes INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  last_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  engagement_total INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_threads_post_insights_cache_user_refresh
  ON threads_post_insights_cache (threads_user_id, last_refreshed_at);
CREATE INDEX IF NOT EXISTS idx_threads_post_insights_cache_user_sort_order
  ON threads_post_insights_cache (threads_user_id, sort_order);

CREATE TABLE IF NOT EXISTS threads_posts_cache_state (
  threads_user_id TEXT PRIMARY KEY CHECK (length(trim(threads_user_id)) > 0),
  next_cursor TEXT,
  has_more INTEGER NOT NULL DEFAULT 0,
  last_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_threads_posts_cache_state_last_refreshed_at
  ON threads_posts_cache_state (last_refreshed_at);

CREATE TABLE IF NOT EXISTS threads_posts_archive (
  threads_user_id TEXT NOT NULL,
  post_id TEXT NOT NULL CHECK (length(trim(post_id)) > 0),
  post_text TEXT,
  post_timestamp TEXT,
  post_permalink TEXT,
  post_username TEXT,
  profile_picture_url TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  reposts INTEGER NOT NULL DEFAULT 0,
  quotes INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  engagement_total INTEGER NOT NULL DEFAULT 0,
  source_rank INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (threads_user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_threads_posts_archive_user_timestamp
  ON threads_posts_archive (threads_user_id, post_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_threads_posts_archive_user_engagement
  ON threads_posts_archive (threads_user_id, engagement_total DESC, likes DESC, views DESC);
CREATE INDEX IF NOT EXISTS idx_threads_posts_archive_user_synced
  ON threads_posts_archive (threads_user_id, last_synced_at DESC);

CREATE TABLE IF NOT EXISTS operator_post_metric_snapshots (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  published_post_id TEXT NOT NULL,
  scheduled_post_id INTEGER,
  draft_id TEXT,
  generation_run_id TEXT,
  source_card_id TEXT,
  source_selection_id TEXT,
  metrics_json TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  valid_for_learning INTEGER NOT NULL DEFAULT 1,
  anomaly_reason TEXT,
  collection_source TEXT NOT NULL DEFAULT 'operator',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operator_post_metric_snapshots_post_captured
  ON operator_post_metric_snapshots (brand_key, published_post_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_operator_post_metric_snapshots_learning
  ON operator_post_metric_snapshots (brand_key, valid_for_learning, captured_at DESC);
