CREATE TABLE IF NOT EXISTS operator_source_selection_batches (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  workflow_session_id TEXT NOT NULL,
  selection_method TEXT NOT NULL,
  eligibility_min_likes INTEGER NOT NULL,
  qualified_pool_count INTEGER NOT NULL,
  requested_count INTEGER NOT NULL,
  selected_count INTEGER NOT NULL,
  selected_at TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  production_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  retired_at TEXT,
  retirement_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_operator_source_selection_batches_brand_created
  ON operator_source_selection_batches (brand_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operator_source_batches_production_date
  ON operator_source_selection_batches (brand_key, production_date, status, created_at DESC);

CREATE TABLE IF NOT EXISTS operator_source_selections (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  workflow_session_id TEXT NOT NULL,
  draw_order INTEGER NOT NULL,
  source_identity_key TEXT NOT NULL,
  source_type TEXT NOT NULL,
  internal_source_id TEXT NOT NULL,
  threads_post_id TEXT,
  canonical_source_url TEXT,
  post_text TEXT NOT NULL,
  original_posted_at TEXT,
  metrics_snapshot_json TEXT NOT NULL,
  source_snapshot_json TEXT NOT NULL,
  source_card_id TEXT,
  selected_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disposition TEXT NOT NULL DEFAULT 'pending',
  disposition_reason TEXT,
  disposition_at TEXT,
  workflow_sequence INTEGER,
  FOREIGN KEY (batch_id) REFERENCES operator_source_selection_batches(id) ON DELETE CASCADE,
  UNIQUE(batch_id, draw_order),
  UNIQUE(batch_id, source_identity_key)
);

CREATE INDEX IF NOT EXISTS idx_operator_source_selections_batch_order
  ON operator_source_selections (batch_id, draw_order ASC);
CREATE INDEX IF NOT EXISTS idx_operator_source_selections_source_card
  ON operator_source_selections (source_card_id);
CREATE INDEX IF NOT EXISTS idx_operator_source_selections_batch_disposition
  ON operator_source_selections (batch_id, disposition, draw_order ASC);

CREATE TABLE IF NOT EXISTS operator_daily_source_claims (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  production_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  source_identity_key TEXT NOT NULL,
  source_type TEXT NOT NULL,
  internal_source_id TEXT NOT NULL,
  source_batch_id TEXT,
  source_selection_id TEXT,
  workflow_session_id TEXT,
  review_batch_id TEXT,
  review_item_number INTEGER,
  source_card_id TEXT,
  generation_run_id TEXT,
  draft_id TEXT,
  scheduled_post_id INTEGER,
  status TEXT NOT NULL DEFAULT 'claimed',
  disposition_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, production_date, source_identity_key),
  UNIQUE(review_batch_id, review_item_number)
);

CREATE INDEX IF NOT EXISTS idx_operator_daily_source_claims_batch
  ON operator_daily_source_claims (review_batch_id, review_item_number ASC);
CREATE INDEX IF NOT EXISTS idx_operator_daily_source_claims_day
  ON operator_daily_source_claims (brand_key, production_date, status, created_at ASC);

CREATE TRIGGER IF NOT EXISTS trg_operator_daily_source_claims_touch_updated_at
AFTER UPDATE ON operator_daily_source_claims
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE operator_daily_source_claims
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS operator_source_exclusions (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  source_identity_key TEXT NOT NULL,
  source_type TEXT NOT NULL,
  internal_source_id TEXT NOT NULL,
  reason TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, source_identity_key)
);

CREATE INDEX IF NOT EXISTS idx_operator_source_exclusions_active
  ON operator_source_exclusions (brand_key, active, source_type);

CREATE TABLE IF NOT EXISTS operator_source_card_families (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  source_identity_key TEXT NOT NULL,
  source_type TEXT NOT NULL,
  internal_source_id TEXT NOT NULL,
  threads_post_id TEXT,
  canonical_source_url TEXT,
  current_source_card_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_key, source_identity_key)
);

CREATE INDEX IF NOT EXISTS idx_operator_source_card_families_brand_current
  ON operator_source_card_families (brand_key, status, updated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_operator_source_card_families_touch_updated_at
AFTER UPDATE ON operator_source_card_families
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE operator_source_card_families
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS operator_source_cards (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  workflow_session_id TEXT,
  sequence_label TEXT NOT NULL,
  lane_key TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  primary_source_json TEXT NOT NULL,
  secondary_sources_json TEXT,
  anti_sources_json TEXT,
  metrics_snapshot_json TEXT,
  source_mechanism TEXT NOT NULL,
  required_product TEXT NOT NULL,
  forbidden_surfaces_json TEXT NOT NULL,
  danger_surfaces_json TEXT,
  current_inventory_constraints_json TEXT,
  pass_conditions_json TEXT NOT NULL,
  fail_conditions_json TEXT NOT NULL,
  recommended_direction TEXT,
  context_admission_id TEXT,
  created_by TEXT,
  family_id TEXT,
  source_selection_id TEXT,
  version_number INTEGER NOT NULL DEFAULT 1,
  is_current INTEGER NOT NULL DEFAULT 1,
  supersedes_source_card_id TEXT,
  version_reason TEXT,
  transformation_contract_json TEXT,
  locked_at TEXT,
  invalidated_at TEXT,
  invalidation_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operator_source_cards_brand_status
  ON operator_source_cards (brand_key, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_operator_source_cards_family_version
  ON operator_source_cards (family_id, version_number DESC, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_source_cards_family_current
  ON operator_source_cards (family_id)
  WHERE family_id IS NOT NULL AND is_current = 1;

CREATE TRIGGER IF NOT EXISTS trg_operator_source_cards_touch_updated_at
AFTER UPDATE ON operator_source_cards
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE operator_source_cards
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;
