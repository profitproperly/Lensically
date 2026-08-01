-- lensically-migration-class: small-data
-- lensically-migration-owner: release-engineering
-- lensically-migration-risk: low

-- Register the already accepted and deployed Main Cycle Champion without invoking Main.

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
