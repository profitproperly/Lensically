CREATE TABLE IF NOT EXISTS operator_gates (
  id TEXT PRIMARY KEY,
  brand_key TEXT,
  gate_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  stage_scope TEXT NOT NULL,
  lane_scope TEXT,
  content_type_scope TEXT,
  gate_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  evaluator TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 100,
  applies_when_json TEXT,
  pass_examples_json TEXT,
  fail_examples_json TEXT,
  source_memory_ids_json TEXT,
  created_from TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_gates_scope_unique
  ON operator_gates (
    COALESCE(brand_key, '__global__'),
    gate_key,
    COALESCE(lane_scope, '__all__'),
    COALESCE(content_type_scope, '__all__')
  );
CREATE INDEX IF NOT EXISTS idx_operator_gates_lookup
  ON operator_gates (active, stage_scope, brand_key, order_index ASC);

CREATE TABLE IF NOT EXISTS operator_gate_results (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  draft_id TEXT,
  source_card_id TEXT,
  gate_id TEXT NOT NULL,
  gate_key TEXT NOT NULL,
  result TEXT NOT NULL,
  blocking INTEGER NOT NULL DEFAULT 0,
  rationale TEXT NOT NULL,
  evaluated_by TEXT NOT NULL,
  evidence_json TEXT,
  repair_guidance TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operator_gate_results_draft
  ON operator_gate_results (draft_id, created_at DESC);

CREATE TABLE IF NOT EXISTS operator_content_inventory (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  text TEXT NOT NULL,
  first_line TEXT,
  opening_phrase TEXT,
  realm_entrance_key TEXT,
  hook_style TEXT,
  lane_key TEXT,
  source_card_id TEXT,
  status TEXT NOT NULL,
  used_at TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operator_content_inventory_brand_used
  ON operator_content_inventory (brand_key, used_at DESC);

CREATE TABLE IF NOT EXISTS operator_workflow_requirements (
  id TEXT PRIMARY KEY,
  brand_key TEXT,
  stage TEXT NOT NULL,
  required_sections_json TEXT NOT NULL,
  completion_rule TEXT NOT NULL,
  enforcement_type TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_workflow_requirements_scope
  ON operator_workflow_requirements (COALESCE(brand_key, '__global__'), stage);
