ALTER TABLE scheduled_posts ADD COLUMN threads_user_id TEXT;
ALTER TABLE scheduled_posts ADD COLUMN status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'posting', 'posted'));
ALTER TABLE scheduled_posts ADD COLUMN publish_request_id TEXT;
ALTER TABLE scheduled_posts ADD COLUMN published_post_id TEXT;
ALTER TABLE scheduled_posts ADD COLUMN publish_error_message TEXT;
ALTER TABLE scheduled_posts ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE scheduled_posts ADD COLUMN processing_started_at TEXT;
ALTER TABLE scheduled_posts ADD COLUMN published_at TEXT;
ALTER TABLE scheduled_posts ADD COLUMN failed_at TEXT;
ALTER TABLE scheduled_posts ADD COLUMN cancelled_at TEXT;
ALTER TABLE scheduled_posts ADD COLUMN last_attempted_at TEXT;

UPDATE scheduled_posts
SET
  status = CASE
    WHEN status = 'queued' THEN 'approved'
    WHEN status = 'processing' THEN 'posting'
    WHEN status = 'published' THEN 'posted'
    WHEN status = 'failed' THEN 'approved'
    WHEN status = 'cancelled' THEN 'approved'
    WHEN status IS NULL THEN 'approved'
    ELSE status
  END,
  updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
WHERE status IN ('queued', 'processing', 'published', 'failed', 'cancelled')
   OR status IS NULL
   OR updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due
  ON scheduled_posts (status, scheduled_time);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_id
  ON scheduled_posts (user_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_threads_user_id
  ON scheduled_posts (threads_user_id);

CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_threads_user_id_required_insert
BEFORE INSERT ON scheduled_posts
FOR EACH ROW
WHEN NEW.threads_user_id IS NULL OR length(trim(NEW.threads_user_id)) = 0
BEGIN
  SELECT RAISE(ABORT, 'constraint_violation:scheduled_posts.threads_user_id_required');
END;

CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_threads_user_id_required_update
BEFORE UPDATE OF threads_user_id ON scheduled_posts
FOR EACH ROW
WHEN NEW.threads_user_id IS NULL OR length(trim(NEW.threads_user_id)) = 0
BEGIN
  SELECT RAISE(ABORT, 'constraint_violation:scheduled_posts.threads_user_id_required');
END;

CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_status_allowed_insert
BEFORE INSERT ON scheduled_posts
FOR EACH ROW
WHEN NEW.status NOT IN ('approved', 'posting', 'posted')
BEGIN
  SELECT RAISE(ABORT, 'constraint_violation:scheduled_posts.status_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_status_allowed_update
BEFORE UPDATE OF status ON scheduled_posts
FOR EACH ROW
WHEN NEW.status NOT IN ('approved', 'posting', 'posted')
BEGIN
  SELECT RAISE(ABORT, 'constraint_violation:scheduled_posts.status_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_touch_updated_at
AFTER UPDATE ON scheduled_posts
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE scheduled_posts
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;
