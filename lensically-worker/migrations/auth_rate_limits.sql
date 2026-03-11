CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  route TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_route_updated_at
  ON auth_rate_limits (route, updated_at);
