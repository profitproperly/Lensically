-- lensically-migration-class: schema
-- lensically-migration-owner: release-engineering
-- lensically-migration-risk: low

-- Canonical Main Champion semantic version and paired Main/Innovation rail state.

CREATE TABLE IF NOT EXISTS manifest_cycle_champions (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  semantic_version TEXT NOT NULL,
  major_version INTEGER NOT NULL CHECK (major_version >= 0),
  minor_version INTEGER NOT NULL CHECK (minor_version >= 0),
  patch_version INTEGER NOT NULL CHECK (patch_version >= 0),
  source_sha TEXT NOT NULL,
  selector_version TEXT,
  preselection_policy_version TEXT,
  component_versions_json TEXT NOT NULL DEFAULT '{}',
  promoted_from_innovation_run_id TEXT,
  promotion_classification TEXT NOT NULL CHECK (
    promotion_classification IN ('baseline', 'patch', 'minor', 'major')
  ),
  status TEXT NOT NULL CHECK (status IN ('current', 'historical')),
  promoted_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (brand_key, semantic_version),
  UNIQUE (brand_key, major_version, minor_version, patch_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manifest_cycle_one_current_champion
  ON manifest_cycle_champions (brand_key)
  WHERE status = 'current';

CREATE INDEX IF NOT EXISTS idx_manifest_cycle_champions_history
  ON manifest_cycle_champions (brand_key, major_version DESC, minor_version DESC, patch_version DESC);

CREATE TABLE IF NOT EXISTS manifest_cycle_innovation_runs (
  run_id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK (
    state IN ('current_challenger', 'champion_candidate', 'passed', 'failed', 'retired', 'promoted')
  ),
  challenged_main_version TEXT,
  tested_sha TEXT NOT NULL,
  snapshot_hash TEXT,
  selector_version TEXT,
  preselection_policy_version TEXT,
  control_or_challenger TEXT CHECK (
    control_or_challenger IS NULL OR control_or_challenger IN ('control', 'challenger')
  ),
  passed INTEGER CHECK (passed IS NULL OR passed IN (0, 1)),
  promotion_eligible INTEGER NOT NULL DEFAULT 0 CHECK (promotion_eligible IN (0, 1)),
  promotion_destination_version TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    state != 'promoted'
    OR (passed = 1 AND promotion_eligible = 1 AND promotion_destination_version IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manifest_cycle_one_active_challenger
  ON manifest_cycle_innovation_runs (brand_key)
  WHERE state IN ('current_challenger', 'champion_candidate');

CREATE INDEX IF NOT EXISTS idx_manifest_cycle_innovation_history
  ON manifest_cycle_innovation_runs (brand_key, COALESCE(completed_at, started_at, created_at) DESC, run_id DESC);

CREATE TABLE IF NOT EXISTS manifest_cycle_rail_state (
  brand_key TEXT PRIMARY KEY,
  main_state TEXT NOT NULL CHECK (
    main_state IN ('current_champion', 'incumbent_behind_challenger', 'incumbent_awaiting_promotion')
  ),
  innovation_state TEXT NOT NULL CHECK (
    innovation_state IN ('standby', 'current_challenger', 'champion_candidate')
  ),
  current_champion_id TEXT NOT NULL,
  active_innovation_run_id TEXT,
  challenged_main_version TEXT,
  candidate_version TEXT,
  state_contract_version TEXT NOT NULL DEFAULT 'manifest-cycle-rail-state-v1',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (main_state = 'current_champion' AND innovation_state = 'standby' AND active_innovation_run_id IS NULL)
    OR
    (main_state = 'incumbent_behind_challenger' AND innovation_state = 'current_challenger' AND active_innovation_run_id IS NOT NULL)
    OR
    (main_state = 'incumbent_awaiting_promotion' AND innovation_state = 'champion_candidate' AND active_innovation_run_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS manifest_cycle_promotion_history (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL,
  previous_version TEXT,
  promoted_version TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('baseline', 'patch', 'minor', 'major')),
  innovation_run_id TEXT,
  tested_sha TEXT NOT NULL,
  promotion_receipt_json TEXT NOT NULL DEFAULT '{}',
  promoted_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (brand_key, promoted_version)
);

CREATE INDEX IF NOT EXISTS idx_manifest_cycle_promotions_history
  ON manifest_cycle_promotion_history (brand_key, promoted_at DESC, id DESC);

INSERT OR IGNORE INTO manifest_cycle_champions (
  id,
  brand_key,
  semantic_version,
  major_version,
  minor_version,
  patch_version,
  source_sha,
  selector_version,
  preselection_policy_version,
  component_versions_json,
  promoted_from_innovation_run_id,
  promotion_classification,
  status,
  promoted_at
) VALUES (
  'manifest-main-v1.0.0',
  'manifest_mental',
  'v1.0.0',
  1,
  0,
  0,
  'ec52201fab48e0a00926c8e7319b90e0a925a584',
  'source-selection-engine-v6',
  'source-preselection-policy-v1',
  '{"cycle_receipt":"manifest-cycle-receipt-v3","intelligence_foundation":"manifest-intelligence-foundation-v3","exposure_ledger":"manifest-exposure-ledger-v3","strategy_contract":"manifest-cycle-strategy-v1","mcp":"1.41.0"}',
  'shadow-0471e82a5bb485665cc038a4e73641ee',
  'baseline',
  'current',
  '2026-08-01T16:37:15.026Z'
);

INSERT OR IGNORE INTO manifest_cycle_innovation_runs (
  run_id,
  brand_key,
  state,
  challenged_main_version,
  tested_sha,
  snapshot_hash,
  selector_version,
  preselection_policy_version,
  control_or_challenger,
  passed,
  promotion_eligible,
  promotion_destination_version,
  started_at,
  completed_at
) VALUES (
  'shadow-0471e82a5bb485665cc038a4e73641ee',
  'manifest_mental',
  'promoted',
  NULL,
  'ec52201fab48e0a00926c8e7319b90e0a925a584',
  'a3536b1afc2613ca985040cd2b02a140e160f6ae85ff9c0d529d9923c82372b8',
  'source-selection-engine-v6',
  'source-preselection-policy-v1',
  'challenger',
  1,
  1,
  'v1.0.0',
  '2026-08-01T16:29:58.728Z',
  '2026-08-01T16:37:15.026Z'
);

INSERT OR IGNORE INTO manifest_cycle_rail_state (
  brand_key,
  main_state,
  innovation_state,
  current_champion_id,
  active_innovation_run_id,
  challenged_main_version,
  candidate_version
) VALUES (
  'manifest_mental',
  'current_champion',
  'standby',
  'manifest-main-v1.0.0',
  NULL,
  NULL,
  NULL
);

INSERT OR IGNORE INTO manifest_cycle_promotion_history (
  id,
  brand_key,
  previous_version,
  promoted_version,
  classification,
  innovation_run_id,
  tested_sha,
  promotion_receipt_json,
  promoted_at
) VALUES (
  'manifest-main-v1.0.0-registration',
  'manifest_mental',
  NULL,
  'v1.0.0',
  'baseline',
  'shadow-0471e82a5bb485665cc038a4e73641ee',
  'ec52201fab48e0a00926c8e7319b90e0a925a584',
  '{"control_run_id":"shadow-6860ced7162b1d7e5bf70c0f4fd72495","challenger_run_id":"shadow-0471e82a5bb485665cc038a4e73641ee","snapshot_hash":"a3536b1afc2613ca985040cd2b02a140e160f6ae85ff9c0d529d9923c82372b8","selected_lineup_hash":"7992b94ff781cf2784f997a00818810fd7f68ef810a025f1502d117ed27d40a5","combined_candidates":"48/48","combined_gates":"576/576","main_invoked":false}',
  '2026-08-01T16:37:15.026Z'
);
