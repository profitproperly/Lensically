CREATE TABLE IF NOT EXISTS gpt_post_strategy_tags (
  scheduled_post_id INTEGER PRIMARY KEY,
  account_id TEXT NOT NULL,
  threads_user_id TEXT NOT NULL,
  pillar TEXT,
  hook_style TEXT,
  format TEXT,
  intent TEXT,
  experiment TEXT,
  novelty_level TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (scheduled_post_id) REFERENCES scheduled_posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gpt_post_strategy_tags_account_updated
  ON gpt_post_strategy_tags (account_id, updated_at DESC, scheduled_post_id DESC);
CREATE INDEX IF NOT EXISTS idx_gpt_post_strategy_tags_threads
  ON gpt_post_strategy_tags (threads_user_id, pillar, hook_style, format, intent);

CREATE TRIGGER IF NOT EXISTS trg_gpt_post_strategy_tags_touch_updated_at
AFTER UPDATE ON gpt_post_strategy_tags
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE gpt_post_strategy_tags
  SET updated_at = CURRENT_TIMESTAMP
  WHERE scheduled_post_id = NEW.scheduled_post_id;
END;

CREATE TABLE IF NOT EXISTS gpt_generation_runs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  threads_user_id TEXT NOT NULL,
  objective TEXT,
  prompt_summary TEXT,
  status TEXT NOT NULL DEFAULT 'drafted',
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source_card_id TEXT,
  source_card_family_id TEXT,
  source_card_version_number INTEGER,
  adaptation_plan_json TEXT,
  prior_adaptation_context_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_gpt_generation_runs_account_updated
  ON gpt_generation_runs (account_id, updated_at DESC, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_gpt_generation_runs_touch_updated_at
AFTER UPDATE ON gpt_generation_runs
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE gpt_generation_runs
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS gpt_generation_drafts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  threads_user_id TEXT NOT NULL,
  draft_index INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drafted',
  rejection_reason TEXT,
  score_json TEXT,
  strategy_json TEXT,
  replacement_for_draft_id TEXT,
  scheduled_post_id INTEGER,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source_card_id TEXT,
  owner_feedback TEXT,
  gate_summary_json TEXT,
  showable INTEGER NOT NULL DEFAULT 0,
  published_post_id TEXT,
  FOREIGN KEY (run_id) REFERENCES gpt_generation_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gpt_generation_drafts_run_index
  ON gpt_generation_drafts (run_id, draft_index ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_gpt_generation_drafts_account_status
  ON gpt_generation_drafts (account_id, status, updated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_gpt_generation_drafts_touch_updated_at
AFTER UPDATE ON gpt_generation_drafts
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE gpt_generation_drafts
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS gpt_preflight_snapshots (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  threads_user_id TEXT NOT NULL,
  objective TEXT,
  sections_json TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gpt_preflight_snapshots_account_updated
  ON gpt_preflight_snapshots (account_id, updated_at DESC);
