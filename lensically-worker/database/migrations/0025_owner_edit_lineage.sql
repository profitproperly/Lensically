ALTER TABLE scheduled_posts ADD COLUMN current_revision_id TEXT;
ALTER TABLE scheduled_posts ADD COLUMN published_revision_id TEXT;

CREATE TABLE IF NOT EXISTS operator_scheduled_post_revisions (
  id TEXT PRIMARY KEY,
  scheduled_post_id INTEGER NOT NULL,
  revision_number INTEGER NOT NULL,
  editor_type TEXT NOT NULL CHECK (editor_type IN ('model', 'owner', 'system')),
  edit_source TEXT NOT NULL CHECK (edit_source IN ('ui', 'mcp', 'backfill', 'publish', 'system')),
  previous_text TEXT,
  revised_text TEXT NOT NULL,
  owner_note TEXT,
  brand_key TEXT,
  account_id TEXT,
  threads_user_id TEXT NOT NULL,
  source_card_id TEXT,
  draft_id TEXT,
  cycle_id TEXT,
  cycle_plan_item_id TEXT,
  change_magnitude TEXT NOT NULL DEFAULT 'untouched' CHECK (change_magnitude IN ('untouched', 'light', 'substantial')),
  became_published INTEGER NOT NULL DEFAULT 0 CHECK (became_published IN (0, 1)),
  published_post_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scheduled_post_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_operator_scheduled_post_revisions_post
  ON operator_scheduled_post_revisions (scheduled_post_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_operator_scheduled_post_revisions_source_card
  ON operator_scheduled_post_revisions (source_card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operator_scheduled_post_revisions_published
  ON operator_scheduled_post_revisions (brand_key, became_published, published_post_id);
CREATE INDEX IF NOT EXISTS idx_operator_scheduled_post_revisions_editor
  ON operator_scheduled_post_revisions (brand_key, editor_type, change_magnitude, created_at DESC);

CREATE TABLE IF NOT EXISTS operator_source_card_owner_guidance (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  account_id TEXT NOT NULL,
  threads_user_id TEXT NOT NULL,
  source_card_id TEXT NOT NULL,
  guidance_text TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  version_number INTEGER NOT NULL DEFAULT 1,
  supersedes_guidance_id TEXT,
  created_by TEXT NOT NULL DEFAULT 'owner' CHECK (created_by = 'owner'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operator_source_card_owner_guidance_history
  ON operator_source_card_owner_guidance (source_card_id, version_number DESC, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_source_card_owner_guidance_active
  ON operator_source_card_owner_guidance (source_card_id)
  WHERE active = 1;

CREATE TRIGGER IF NOT EXISTS trg_operator_source_card_owner_guidance_touch_updated_at
AFTER UPDATE ON operator_source_card_owner_guidance
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE operator_source_card_owner_guidance
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

INSERT OR IGNORE INTO operator_scheduled_post_revisions (
  id, scheduled_post_id, revision_number, editor_type, edit_source,
  previous_text, revised_text, owner_note, brand_key, account_id,
  threads_user_id, source_card_id, draft_id, cycle_id, cycle_plan_item_id,
  change_magnitude, became_published, published_post_id, created_at
)
SELECT
  'revision-baseline-' || s.id,
  s.id,
  1,
  CASE WHEN li.id IS NOT NULL OR d.id IS NOT NULL THEN 'model' ELSE 'owner' END,
  'backfill',
  NULL,
  COALESCE(li.text, d.text, s.post_text),
  NULL,
  COALESCE(li.brand_key, c.brand_key),
  d.account_id,
  s.threads_user_id,
  COALESCE(li.source_card_id, d.source_card_id),
  d.id,
  li.cycle_id,
  li.cycle_plan_item_id,
  'untouched',
  CASE WHEN s.status = 'posted' AND COALESCE(li.text, d.text, s.post_text) = s.post_text THEN 1 ELSE 0 END,
  CASE WHEN s.status = 'posted' AND COALESCE(li.text, d.text, s.post_text) = s.post_text THEN s.published_post_id ELSE NULL END,
  COALESCE(s.created_at, CURRENT_TIMESTAMP)
FROM scheduled_posts s
LEFT JOIN operator_autonomous_lineup_items li
  ON li.id = (
    SELECT li2.id
    FROM operator_autonomous_lineup_items li2
    WHERE li2.scheduled_post_id = s.id
    ORDER BY datetime(li2.updated_at) DESC, datetime(li2.created_at) DESC
    LIMIT 1
  )
LEFT JOIN gpt_generation_drafts d
  ON d.id = (
    SELECT d2.id
    FROM gpt_generation_drafts d2
    WHERE d2.scheduled_post_id = s.id
      AND d2.threads_user_id = s.threads_user_id
    ORDER BY datetime(d2.updated_at) DESC, datetime(d2.created_at) DESC
    LIMIT 1
  )
LEFT JOIN operator_source_cards c
  ON c.id = COALESCE(li.source_card_id, d.source_card_id);

INSERT OR IGNORE INTO operator_scheduled_post_revisions (
  id, scheduled_post_id, revision_number, editor_type, edit_source,
  previous_text, revised_text, owner_note, brand_key, account_id,
  threads_user_id, source_card_id, draft_id, cycle_id, cycle_plan_item_id,
  change_magnitude, became_published, published_post_id, created_at
)
SELECT
  'revision-owner-backfill-' || s.id,
  s.id,
  2,
  'owner',
  'backfill',
  COALESCE(li.text, d.text),
  s.post_text,
  NULL,
  COALESCE(li.brand_key, c.brand_key),
  d.account_id,
  s.threads_user_id,
  COALESCE(li.source_card_id, d.source_card_id),
  d.id,
  li.cycle_id,
  li.cycle_plan_item_id,
  'substantial',
  CASE WHEN s.status = 'posted' THEN 1 ELSE 0 END,
  CASE WHEN s.status = 'posted' THEN s.published_post_id ELSE NULL END,
  COALESCE(s.updated_at, CURRENT_TIMESTAMP)
FROM scheduled_posts s
LEFT JOIN operator_autonomous_lineup_items li
  ON li.id = (
    SELECT li2.id
    FROM operator_autonomous_lineup_items li2
    WHERE li2.scheduled_post_id = s.id
    ORDER BY datetime(li2.updated_at) DESC, datetime(li2.created_at) DESC
    LIMIT 1
  )
LEFT JOIN gpt_generation_drafts d
  ON d.id = (
    SELECT d2.id
    FROM gpt_generation_drafts d2
    WHERE d2.scheduled_post_id = s.id
      AND d2.threads_user_id = s.threads_user_id
    ORDER BY datetime(d2.updated_at) DESC, datetime(d2.created_at) DESC
    LIMIT 1
  )
LEFT JOIN operator_source_cards c
  ON c.id = COALESCE(li.source_card_id, d.source_card_id)
WHERE COALESCE(li.text, d.text) IS NOT NULL
  AND trim(COALESCE(li.text, d.text)) <> trim(s.post_text);

UPDATE scheduled_posts
SET current_revision_id = CASE
  WHEN EXISTS (
    SELECT 1 FROM operator_scheduled_post_revisions r
    WHERE r.scheduled_post_id = scheduled_posts.id AND r.revision_number = 2
  ) THEN 'revision-owner-backfill-' || scheduled_posts.id
  ELSE 'revision-baseline-' || scheduled_posts.id
END
WHERE current_revision_id IS NULL;

UPDATE scheduled_posts
SET published_revision_id = current_revision_id
WHERE status = 'posted'
  AND published_revision_id IS NULL;

UPDATE operator_scheduled_post_revisions
SET became_published = 1,
    published_post_id = (
      SELECT s.published_post_id
      FROM scheduled_posts s
      WHERE s.id = operator_scheduled_post_revisions.scheduled_post_id
    )
WHERE id IN (
  SELECT s.published_revision_id
  FROM scheduled_posts s
  WHERE s.status = 'posted' AND s.published_revision_id IS NOT NULL
);
