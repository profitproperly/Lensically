CREATE TABLE IF NOT EXISTS commercial_orders (
  session_id TEXT PRIMARY KEY,
  payment_intent_id TEXT,
  customer_email TEXT,
  customer_name TEXT,
  product_key TEXT NOT NULL,
  release_version TEXT NOT NULL,
  payment_link_id TEXT NOT NULL,
  price_id TEXT NOT NULL,
  amount_total INTEGER NOT NULL,
  currency TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  license_key TEXT NOT NULL UNIQUE,
  checkout_created_at INTEGER,
  first_verified_at TEXT NOT NULL,
  last_verified_at TEXT NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_commercial_orders_email
  ON commercial_orders(customer_email);

CREATE TABLE IF NOT EXISTS commercial_download_tokens (
  token_hash TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (session_id) REFERENCES commercial_orders(session_id)
);

CREATE INDEX IF NOT EXISTS idx_commercial_download_tokens_session
  ON commercial_download_tokens(session_id, expires_at);
