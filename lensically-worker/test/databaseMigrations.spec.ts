import { applyD1Migrations, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

type TestMigrationBinding = Parameters<typeof applyD1Migrations>[1];
type SchemaObjectRow = { name: string; type: string };
type CountRow = { total: number | string };

const testEnv = env as typeof env & {
    TEST_MIGRATIONS: TestMigrationBinding;
    UPGRADE_DB: D1Database;
    IDENTITY_UPGRADE_DB: D1Database;
    MEASUREMENT_UPGRADE_DB: D1Database;
    GENERATION_UPGRADE_DB: D1Database;
    SOURCE_UPGRADE_DB: D1Database;
  QUALITY_UPGRADE_DB: D1Database;
    CONTINUITY_UPGRADE_DB: D1Database;
    CYCLE_DECISION_UPGRADE_DB: D1Database;
    ASSURANCE_UPGRADE_DB: D1Database;
    WORK_STATE_UPGRADE_DB: D1Database;
    EXECUTION_CONTROL_UPGRADE_DB: D1Database;
    PERFORMANCE_FOCUS_UPGRADE_DB: D1Database;
      MANIFEST_INTELLIGENCE_UPGRADE_DB: D1Database;
        MANIFEST_ENGINE_UPGRADE_DB: D1Database;
        MANIFEST_MEASUREMENT_AUDIT_UPGRADE_DB: D1Database;
    FINAL_AUTHORITY_UPGRADE_DB: D1Database;
};

const requiredColumns: Record<string, string[]> = {
  external_patterns: [
    "id", "app_user_id", "account_id", "platform", "source_url", "post_id",
    "author_handle", "author_display_name", "post_text", "likes", "replies",
    "reposts", "shares", "views", "posted_at", "capture_confidence",
    "raw_payload", "saved_at", "updated_at",
  ],
  threads_follower_snapshots: [
    "threads_user_id", "snapshot_date", "followers_count",
    "baseline_followers_count", "captured_at", "created_at",
  ],
    gpt_strategy_memory: [
    "id", "account_id", "threads_user_id", "kind", "title", "body",
    "metadata_json", "created_at", "updated_at",
  ],
  gpt_post_strategy_tags: [
    "scheduled_post_id", "account_id", "threads_user_id", "pillar", "hook_style",
    "format", "intent", "experiment", "novelty_level", "metadata_json",
    "created_at", "updated_at",
  ],
  gpt_generation_runs: [
    "id", "account_id", "threads_user_id", "objective", "prompt_summary",
    "status", "metadata_json", "created_at", "updated_at", "source_card_id",
    "source_card_family_id", "source_card_version_number", "adaptation_plan_json",
    "prior_adaptation_context_json",
  ],
  gpt_generation_drafts: [
    "id", "run_id", "account_id", "threads_user_id", "draft_index", "text",
    "status", "rejection_reason", "score_json", "strategy_json",
    "replacement_for_draft_id", "scheduled_post_id", "metadata_json", "created_at",
    "updated_at", "source_card_id", "owner_feedback", "gate_summary_json",
    "showable", "published_post_id",
  ],
    gpt_preflight_snapshots: [
    "id", "account_id", "threads_user_id", "objective", "sections_json",
    "manifest_json", "created_at", "updated_at",
  ],
  operator_source_selection_batches: [
    "id", "brand_key", "workflow_session_id", "selection_method",
    "eligibility_min_likes", "qualified_pool_count", "requested_count",
    "selected_count", "selected_at", "metadata_json", "created_at",
    "production_date", "status", "retired_at", "retirement_reason",
  ],
  operator_source_selections: [
    "id", "batch_id", "brand_key", "workflow_session_id", "draw_order",
    "source_identity_key", "source_type", "internal_source_id", "threads_post_id",
    "canonical_source_url", "post_text", "original_posted_at",
    "metrics_snapshot_json", "source_snapshot_json", "source_card_id",
    "selected_at", "created_at", "disposition", "disposition_reason",
    "disposition_at", "workflow_sequence",
  ],
  operator_daily_source_claims: [
    "id", "brand_key", "production_date", "timezone", "source_identity_key",
    "source_type", "internal_source_id", "source_batch_id", "source_selection_id",
    "workflow_session_id", "review_batch_id", "review_item_number", "source_card_id",
    "generation_run_id", "draft_id", "scheduled_post_id", "status",
    "disposition_reason", "created_at", "updated_at",
  ],
  operator_source_exclusions: [
    "id", "brand_key", "source_identity_key", "source_type", "internal_source_id",
    "reason", "active", "created_at", "updated_at",
  ],
  operator_source_card_families: [
    "id", "brand_key", "source_identity_key", "source_type", "internal_source_id",
    "threads_post_id", "canonical_source_url", "current_source_card_id", "status",
    "created_at", "updated_at",
  ],
    operator_source_cards: [
    "id", "brand_key", "workflow_session_id", "sequence_label", "lane_key",
    "title", "status", "primary_source_json", "secondary_sources_json",
    "anti_sources_json", "metrics_snapshot_json", "source_mechanism",
    "required_product", "forbidden_surfaces_json", "danger_surfaces_json",
    "current_inventory_constraints_json", "pass_conditions_json",
    "fail_conditions_json", "recommended_direction", "context_admission_id",
    "created_by", "family_id", "source_selection_id", "version_number",
    "is_current", "supersedes_source_card_id", "version_reason",
    "transformation_contract_json", "locked_at", "invalidated_at",
    "invalidation_reason", "created_at", "updated_at",
  ],
  operator_gates: [
    "id", "brand_key", "gate_key", "display_name", "description", "stage_scope",
    "lane_scope", "content_type_scope", "gate_type", "severity", "evaluator",
    "active", "order_index", "applies_when_json", "pass_examples_json",
    "fail_examples_json", "source_memory_ids_json", "created_from", "created_at",
    "updated_at",
  ],
  operator_gate_results: [
    "id", "brand_key", "draft_id", "source_card_id", "gate_id", "gate_key",
    "result", "blocking", "rationale", "evaluated_by", "evidence_json",
    "repair_guidance", "created_at",
  ],
  operator_content_inventory: [
    "id", "brand_key", "source_type", "source_id", "text", "first_line",
    "opening_phrase", "realm_entrance_key", "hook_style", "lane_key",
    "source_card_id", "status", "used_at", "metadata_json", "created_at",
  ],
    operator_workflow_requirements: [
    "id", "brand_key", "stage", "required_sections_json", "completion_rule",
    "enforcement_type", "active", "version", "created_at", "updated_at",
  ],
  operator_mcp_sessions: [
    "id", "selected_brand_key", "proceeded_at", "created_at", "updated_at",
    "expires_at",
  ],
  operator_continuity_refs: [
    "id", "kind", "brand_key", "workflow_session_id", "continuation_choice",
    "payload_json", "expires_at", "created_at",
  ],
  operator_operation_receipts: [
    "idempotency_key", "brand_key", "workflow_session_id", "operation_type",
    "tool_name", "request_fingerprint", "status", "result_json", "created_at",
    "updated_at",
  ],
  operator_growth_missions: [
    "brand_key", "contract_version", "version", "status", "execution_mode",
    "mission_json", "diagnostic_json", "owner_response", "change_summary",
    "approved_at", "last_diagnostic_at", "created_at", "updated_at",
  ],
  operator_growth_mission_revisions: [
    "id", "brand_key", "mission_version", "status", "execution_mode",
    "mission_json", "diagnostic_json", "owner_response", "change_summary",
    "created_at",
  ],
    operator_autonomy_profiles: [
    "brand_key", "mode", "objective", "model_role", "owner_role",
    "approval_policy", "operating_constraints_json", "active", "version",
    "created_at", "updated_at",
  ],
  operator_autonomous_growth_cycles: [
    "id", "brand_key", "operation_id", "engine_version", "status", "timezone",
    "horizon_hours", "horizon_start_local", "horizon_end_local",
    "target_slots_json", "missing_slots_json", "account_position_json",
    "strategic_thesis_json", "scheduled_post_ids_json", "error_json", "receipt_id",
    "strategy_version_id", "exposure_snapshot_id", "evidence_snapshot_id",
    "cycle_strategy_id", "created_at", "updated_at",
  ],
  operator_autonomous_lineup_items: [
    "id", "cycle_id", "brand_key", "slot_key", "slot_date", "slot_time", "text",
    "generation_mode", "family_key", "strategic_purpose", "strategy_json",
    "cycle_strategy_id", "cycle_plan_item_id", "gate_receipt_id", "source_card_id",
    "source_selection_id", "hypothesis_id", "generation_run_id", "draft_id",
    "scheduled_post_id", "status", "owner_feedback", "created_at", "updated_at",
  ],
  operator_decision_proposals: [
    "id", "brand_key", "decision_key", "category", "title", "decision_text",
    "rationale", "evidence_json", "expected_outcome", "risks_json", "reversibility",
    "execution_plan", "authorized_tools_json", "execution_budget_json", "status",
    "proposed_by", "owner_response", "revision_request", "outcome_summary",
    "result_evidence_json", "supersedes_decision_id", "approved_at", "rejected_at",
    "executed_at", "created_at", "updated_at",
  ],
    operator_decision_execution_events: [
    "id", "decision_id", "brand_key", "tool_name", "operation_id",
    "request_fingerprint", "status", "result_summary", "created_at", "completed_at",
  ],
  operator_operational_incidents: [
    "id", "brand_key", "incident_key", "incident_type", "severity", "status",
    "scheduled_post_id", "production_date", "scheduled_time", "observed_status",
    "delivery_state", "published_post_id", "publish_error_message", "last_attempted_at",
    "required_recovery_action", "evidence_json", "opened_at", "last_observed_at",
    "resolved_at", "resolution_note", "created_at", "updated_at",
  ],
  operator_engineering_audit: [
    "id", "action", "files_changed_json", "diff_summary", "tests_run_json", "result",
    "deployment_id", "rollback_target", "owner_approval", "metadata_json", "created_at",
  ],
  operator_hardening_incidents: [
    "id", "signature", "boundary", "severity", "classification", "state",
    "affected_scope", "blocked_profile_id", "blocked_tool_name", "request_fingerprint",
    "expected_json", "observed_json", "side_effect_state", "root_cause",
    "generalized_cause", "prevention_rule_id", "regression_test_ids_json", "tested_sha",
    "deployment_id", "live_verification_json", "resume_capsule_json", "resume_result_json",
    "autonomy_dividend_json", "efficiency_result_json", "created_at", "updated_at",
    "closed_at",
  ],
  operator_hardening_incident_events: [
    "id", "incident_id", "from_state", "to_state", "evidence_json", "created_at",
  ],
    operator_operational_observations: [
    "id", "operation_id", "incident_id", "profile_id", "capability", "outcome",
    "duration_ms", "call_count", "external_requests", "repeated_fingerprint_count",
    "progress_checkpoint", "metadata_json", "created_at",
  ],
  operator_work_state: [
    "id", "contract_version", "policy_version", "role", "active_outcome_key",
    "active_outcome_title", "active_scope_json", "status", "scope_frozen",
    "active_interrupt_key", "next_action", "completion_evidence_json", "created_at",
    "updated_at",
  ],
  operator_work_ledger: [
    "id", "work_key", "title", "summary", "priority", "status", "intake_decision",
    "intake_reason", "required_for_active_outcome", "dependencies_json",
    "completion_condition", "execution_order", "evidence_json", "merged_into_work_key",
    "created_at", "updated_at", "completed_at",
  ],
  operator_repo_write_sessions: [
    "id", "path", "mode", "message", "summary", "content", "status",
    "created_at", "updated_at",
  ],
    operator_system_retirements: [
    "retirement_key", "completed_at",
  ],
  operator_manifest_prepare_checkpoints: [
    "id", "brand_key", "operation_id", "checkpoint_version", "phase", "timezone",
    "horizon_hours", "state_json", "created_at", "updated_at",
  ],
  operator_pre_call_routes: [
    "id", "route_key", "provider", "tool_name", "operation_key", "match_json",
    "action", "required_tool", "mandatory_route", "argument_patch_json",
    "allowed_argument_keys_json", "reason", "verification_summary", "source_memory_id",
    "priority", "active", "expires_at", "created_at", "updated_at",
  ],
    operator_execution_events: [
    "id", "brand_key", "workflow_session_id", "tool_name", "operation_class",
    "execution_plane", "policy_version", "decision", "known_failure_prevented",
    "evidence_json", "created_at",
  ],
  operator_post_fingerprints: [
    "id", "brand_key", "published_post_id", "scheduled_post_id", "draft_id",
    "source_card_id", "source_selection_id", "text_hash", "fingerprint_version",
    "fingerprint_json", "created_at", "updated_at",
  ],
  operator_post_performance_scores: [
    "id", "brand_key", "published_post_id", "checkpoint_hours", "snapshot_id",
    "captured_at", "post_age_hours", "metrics_json", "rates_json", "velocity_json",
    "scores_json", "distribution_state", "valid_for_learning", "evaluator_version",
    "created_at", "updated_at",
  ],
  operator_performance_evidence: [
    "id", "brand_key", "checkpoint_hours", "dimension", "feature_key", "sample_size",
    "cohort_size", "medians_json", "effect_json", "confidence_score",
    "confidence_label", "direction", "status", "evaluator_version", "created_at",
    "updated_at",
  ],
  operator_performance_hypotheses: [
    "id", "brand_key", "checkpoint_hours", "dimension", "feature_key",
    "hypothesis_text", "direction", "sample_size", "confidence_score",
    "confidence_label", "evidence_json", "status", "evaluator_version", "created_at",
    "updated_at",
  ],
  operator_generation_learning_briefs: [
    "id", "brand_key", "checkpoint_hours", "sample_size", "brief_json", "active",
    "evaluator_version", "generated_at", "created_at",
  ],
  operator_content_focus_reviews: [
    "id", "brand_key", "cadence", "period_key", "anchor_date", "windows_json",
    "decisions_json", "allocation_json", "generated_at", "evaluator_version",
    "created_at", "updated_at",
  ],
    operator_content_focus_family_states: [
    "id", "brand_key", "source_card_family_id", "source_identity_key", "status",
    "recommended_status", "confidence_score", "confidence_label", "allocation_weight",
    "decision_reason", "reuse_directives_json", "stop_directives_json",
    "horizon_evidence_json", "manual_lock", "last_review_id", "created_at", "updated_at",
  ],
  operator_manifest_intelligence_policies: [
    "brand_key", "policy_version", "policy_json", "active", "created_at", "updated_at",
  ],
  operator_manifest_strategy_versions: [
    "id", "brand_key", "version", "contract_version", "parent_version_id", "status",
    "strategy_hash", "strategy_json", "evidence_json", "change_summary",
    "reversal_conditions_json", "source_cycle_id", "created_at",
  ],
  operator_manifest_exposure_snapshots: [
    "id", "cycle_id", "brand_key", "ledger_version", "as_of", "timezone",
    "horizon_start_local", "horizon_end_local", "published_json", "scheduled_json",
    "dimensions_json", "source_hash", "revision", "created_at", "updated_at",
  ],
  operator_manifest_evidence_snapshots: [
    "id", "cycle_id", "brand_key", "snapshot_version", "as_of", "timezone",
    "window_days", "window_start", "window_end", "post_count", "mature_count",
    "immature_count", "incomplete_count", "page_size", "page_count", "page_byte_budget",
    "benchmarks_json", "previous_benchmarks_json", "recent_exposure_json",
    "future_schedule_json", "hard_bans_json", "experiments_json", "source_hash",
    "created_at", "updated_at",
  ],
  operator_manifest_evidence_posts: [
    "id", "snapshot_id", "brand_key", "published_post_id", "scheduled_post_id", "text",
    "published_at", "age_hours", "maturity_state", "primary_likes", "like_rate",
    "metrics_json", "maturity_snapshots_json", "lineage_json", "classification_json",
    "created_at",
  ],
  operator_manifest_evidence_pages: [
    "id", "snapshot_id", "cycle_id", "brand_key", "page_index", "page_contract_version",
    "item_count", "byte_count", "evidence_types_json", "items_json", "created_at",
  ],
  operator_manifest_analysis_page_reads: [
    "id", "snapshot_id", "cycle_id", "brand_key", "page_index", "read_at",
  ],
  operator_manifest_cycle_strategies: [
    "id", "cycle_id", "brand_key", "snapshot_id", "contract_version",
    "account_conclusion_json", "content_focus_json", "benchmarks_json", "strongest_json",
    "weakest_json", "directives_json", "experiments_json", "risks_json", "lineup_json",
    "strategy_hash", "status", "locked_at", "created_at",
  ],
  operator_manifest_cycle_plan_items: [
    "id", "strategy_id", "cycle_id", "brand_key", "slot_key", "slot_date", "slot_time",
    "family_key", "strategic_role", "generation_mode", "source_kind", "source_card_id",
    "source_selection_id", "audience_reward", "hook_direction", "placement_reason",
    "nearby_avoid_json", "exploration_mode", "status", "revision", "created_at", "updated_at",
  ],
  operator_manifest_candidate_gate_receipts: [
    "id", "cycle_id", "strategy_id", "plan_item_id", "brand_key", "slot_key",
    "candidate_hash", "receipt_version", "results_json", "passed", "created_at",
  ],
  operator_manifest_hard_bans: [
    "id", "brand_key", "rule_key", "description", "rule_type", "pattern", "scope",
    "pass_examples_json", "fail_examples_json", "source_authority", "active", "created_at",
    "updated_at",
  ],
  operator_manifest_cycle_receipts: [
    "id", "cycle_id", "brand_key", "operation_id", "receipt_version", "status",
    "trigger_json", "startup_state_json", "input_strategy_version_id",
    "output_strategy_version_id", "exposure_snapshot_id", "horizon_plan_json",
    "completion_json", "unresolved_issues_json", "started_at", "completed_at", "created_at",
  ],
  operator_manifest_cycle_receipt_events: [
    "id", "cycle_id", "brand_key", "event_key", "event_type", "slot_key", "payload_json",
    "created_at",
  ],
  operator_manifest_cycle_defect_receipts: [
    "id", "cycle_id", "brand_key", "defect_key", "receipt_version", "stage_number",
    "stage_key", "phase", "slot_key", "operation_id", "error_code", "error_message",
    "impact_state", "retryable", "blocking", "status", "occurrence_count", "first_seen_at",
    "last_seen_at", "reconciliation_json", "root_cause", "repair_commit_sha", "deployed_sha",
    "regression_tests_json", "verification_json", "metadata_json", "resolved_at", "created_at",
    "updated_at",
  ],
    operator_manifest_post_hypotheses: [
    "id", "cycle_id", "brand_key", "slot_key", "hypothesis_version", "strategy_version_id",
    "source_kind", "source_type", "source_identity_key", "source_card_id",
    "source_selection_id", "internal_source_id", "expected_response_type",
    "expected_audience_reward", "hook_rationale", "premise_rationale", "exploration_mode",
    "comparable_post_ids_json", "expected_performance_range_json", "uncertainty",
    "falsification_conditions_json", "candidate_trace_json", "model_evaluation_json",
    "scheduled_post_id", "status", "revision", "locked_at", "created_at", "updated_at",
  ],
  operator_manifest_semantic_signatures: [
    "id", "brand_key", "content_type", "content_id", "scheduled_post_id",
    "published_post_id", "observed_at", "text_hash", "signature_version",
    "signature_json", "created_at", "updated_at",
  ],
  operator_manifest_maturity_evaluations: [
    "id", "brand_key", "published_post_id", "checkpoint_hours", "evaluation_version",
    "evaluation_json", "structural_change_allowed", "created_at", "updated_at",
  ],
  operator_manifest_comparable_analyses: [
    "id", "brand_key", "published_post_id", "checkpoint_hours", "analysis_version",
    "comparable_post_ids_json", "analysis_json", "created_at", "updated_at",
  ],
  operator_manifest_learning_observations: [
    "id", "brand_key", "level", "feature_key", "checkpoint_hours", "sample_size",
    "supporting_count", "contradicting_count", "median_overall", "effect_size",
    "confidence_score", "confidence_label", "state", "evidence_json", "active",
    "learning_version", "created_at", "updated_at",
  ],
  operator_manifest_portfolio_states: [
    "id", "brand_key", "family_key", "role", "recommended_role", "previous_role",
    "confidence_score", "confidence_label", "allocation_weight", "actual_decay",
    "reason", "evidence_json", "portfolio_version", "created_at", "updated_at",
  ],
  operator_manifest_state_transitions: [
    "id", "transition_key", "brand_key", "entity_type", "entity_id", "from_state",
    "to_state", "reason", "evidence_json", "transitioned_at", "created_at",
  ],
  operator_manifest_experiments: [
    "id", "brand_key", "experiment_key", "family_key", "hypothesis_json",
    "comparison_group_json", "maturity_windows_json", "result_criteria_json", "status",
    "latest_result_json", "follow_up_decision", "experiment_version", "created_at",
    "updated_at",
  ],
    operator_manifest_experiment_assignments: [
    "id", "experiment_id", "brand_key", "cycle_id", "slot_key", "hypothesis_id",
    "scheduled_post_id", "published_post_id", "variant_key", "status", "created_at",
    "updated_at",
  ],
  operator_manifest_learning_briefs: [
    "id", "brand_key", "brief_key", "brief_version", "source_fingerprint",
    "evidence_window_start", "evidence_window_end", "authoritative_post_count",
    "brief_json", "strategy_change_json", "strategy_version_id", "created_at", "updated_at",
  ],
  operator_manifest_benchmark_snapshots: [
    "id", "brand_key", "snapshot_key", "cycle_id", "benchmark_version", "window_start",
    "window_end", "metrics_json", "source_fingerprint", "created_at", "updated_at",
  ],
  operator_manifest_run_comparisons: [
    "id", "brand_key", "cycle_id", "previous_cycle_id", "comparison_version",
    "comparison_json", "source_fingerprint", "created_at", "updated_at",
  ],
  operator_manifest_saved_pattern_intelligence: [
    "id", "brand_key", "pattern_identity_key", "external_pattern_id",
    "source_identity_key", "verified_metrics_json", "semantic_json", "mechanism_json",
    "adaptation_options_json", "similarity_json", "usage_json", "results_json",
    "confidence_json", "reuse_state", "exclusion_state", "source_updated_at",
    "intelligence_version", "created_at", "updated_at",
  ],
    operator_manifest_follower_checkpoints: [
    "id", "brand_key", "checkpoint_key", "threads_user_id", "checkpoint_version",
    "snapshot_date", "followers_count", "follower_goal", "distance_to_goal",
    "trajectory_json", "attribution_policy", "created_at", "updated_at",
  ],
  operator_source_family_evidence_states: [
    "id", "brand_key", "source_card_family_id", "source_identity_key",
    "label_policy_version", "lifetime_label", "recent_label", "confidence_label",
    "lifetime_sample_size", "recent_sample_size", "account_lifetime_median_likes",
    "account_28d_median_likes", "family_lifetime_median_likes",
    "family_28d_median_likes", "lifetime_index", "recent_index",
    "latest_two_recent_index", "probability_above_median",
    "probability_above_franchise_floor", "probability_below_underperformance_floor",
    "state_json", "created_at", "updated_at",
  ],
  operator_source_family_label_transitions: [
    "id", "brand_key", "source_card_family_id", "source_identity_key",
    "label_policy_version", "previous_lifetime_label", "lifetime_label",
    "previous_recent_label", "recent_label", "evidence_json", "created_at",
  ],
  operator_source_selection_receipts: [
    "id", "brand_key", "scope_type", "scope_id", "slot_key", "selection_order",
    "source_identity_key", "source_card_family_id", "source_card_id", "engine_version",
    "receipt_json", "created_at",
  ],
  operator_source_selection_plans: [
    "id", "brand_key", "cycle_id", "slot_key", "selection_order",
    "source_identity_key", "source_card_family_id", "source_card_id", "engine_version",
    "receipt_json", "status", "created_at", "updated_at",
  ],
  operator_manifest_decision_influences: [
    "id", "influence_key", "brand_key", "cycle_id", "slot_key", "scheduled_post_id",
    "hypothesis_id", "strategy_version_id", "learning_brief_key",
    "benchmark_snapshot_key", "family_key", "portfolio_role", "experiment_key",
    "saved_pattern_identity_key", "decision_changed", "decision_change_types_json",
    "decision_summary", "evidence_json", "influence_version", "created_at", "updated_at",
  ],
    users: [
    "id", "email", "password_hash", "email_verified", "threads_user_id",
    "threads_username", "access_token", "token_expires_at", "is_admin",
    "connection_active", "timezone", "clock_format", "created_at",
  ],
  app_threads_accounts: [
    "app_user_id", "threads_user_id", "connection_active", "is_active",
    "tombstone_expires_at", "created_at",
  ],
  threads_accounts: [
    "threads_user_id", "access_token", "expires_at", "created_at",
    "configured_account_id",
  ],
  threads_profile_cache: [
    "threads_user_id", "username", "name", "threads_biography", "is_verified",
    "threads_profile_picture_url", "last_refreshed_at", "created_at",
  ],
    meta_deletion_requests: [
    "confirmation_code", "platform_user_id", "status", "requested_at", "completed_at",
  ],
  threads_user_insights_cache: [
    "threads_user_id", "insights_json", "last_refreshed_at", "created_at",
  ],
  threads_post_insights_cache: [
    "threads_user_id", "post_id", "post_text", "post_timestamp", "post_permalink",
    "post_username", "profile_picture_url", "views", "likes", "replies", "reposts",
    "quotes", "shares", "sort_order", "last_refreshed_at", "created_at",
    "engagement_total",
  ],
  threads_posts_cache_state: [
    "threads_user_id", "next_cursor", "has_more", "last_refreshed_at", "created_at",
  ],
  threads_posts_archive: [
    "threads_user_id", "post_id", "post_text", "post_timestamp", "post_permalink",
    "post_username", "profile_picture_url", "views", "likes", "replies", "reposts",
    "quotes", "shares", "engagement_total", "source_rank", "first_seen_at",
    "last_seen_at", "last_synced_at",
  ],
  operator_post_metric_snapshots: [
    "id", "brand_key", "published_post_id", "scheduled_post_id", "draft_id",
    "generation_run_id", "source_card_id", "source_selection_id", "metrics_json",
    "captured_at", "valid_for_learning", "anomaly_reason", "collection_source",
    "created_at",
  ],
  scheduled_posts: [
    "id", "user_id", "threads_user_id", "post_text", "spoiler_all_text",
    "spoiler_phrases_json", "status", "scheduled_time", "publish_request_id",
    "published_post_id", "publish_error_message", "idempotency_key", "created_at",
    "updated_at", "processing_started_at", "published_at", "failed_at",
    "cancelled_at", "last_attempted_at",
  ],
  scheduled_post_deletions: [
    "id", "scheduled_post_id", "user_id", "threads_user_id", "post_text",
    "scheduled_time", "status_before", "reason_code", "reason",
    "learning_effect", "deleted_by", "deletion_source", "operation_id",
    "created_at",
  ],
  batch_schedule_presets: [
    "id", "user_id", "threads_user_id", "name", "times_json", "is_favorite",
    "created_at", "updated_at",
  ],
  threads_publish_idempotency: [
    "id", "scope", "app_user_id", "threads_user_id", "request_hash",
    "request_bucket", "response_status", "response_body", "created_at",
  ],
};

const expectedObjects = [
  "idx_external_patterns_user_updated",
  "idx_external_patterns_user_likes",
  "idx_external_patterns_user_account_source",
  "idx_external_patterns_user_account_post",
  "idx_threads_follower_snapshots_captured_at",
  "idx_gpt_strategy_memory_account_kind_updated",
    "idx_gpt_strategy_memory_threads_updated",
  "trg_gpt_strategy_memory_touch_updated_at",
  "idx_gpt_post_strategy_tags_account_updated",
  "idx_gpt_post_strategy_tags_threads",
  "trg_gpt_post_strategy_tags_touch_updated_at",
  "idx_gpt_generation_runs_account_updated",
  "trg_gpt_generation_runs_touch_updated_at",
  "idx_gpt_generation_drafts_run_index",
  "idx_gpt_generation_drafts_account_status",
  "trg_gpt_generation_drafts_touch_updated_at",
    "idx_gpt_preflight_snapshots_account_updated",
  "idx_operator_source_selection_batches_brand_created",
  "idx_operator_source_batches_production_date",
  "idx_operator_source_selections_batch_order",
  "idx_operator_source_selections_source_card",
  "idx_operator_source_selections_batch_disposition",
  "idx_operator_daily_source_claims_batch",
  "idx_operator_daily_source_claims_day",
  "trg_operator_daily_source_claims_touch_updated_at",
  "idx_operator_source_exclusions_active",
  "idx_operator_source_card_families_brand_current",
  "trg_operator_source_card_families_touch_updated_at",
  "idx_operator_source_cards_brand_status",
  "idx_operator_source_cards_family_version",
  "idx_operator_source_cards_family_current",
    "trg_operator_source_cards_touch_updated_at",
  "idx_operator_gates_scope_unique",
  "idx_operator_gates_lookup",
  "idx_operator_gate_results_draft",
  "idx_operator_content_inventory_brand_used",
    "idx_operator_workflow_requirements_scope",
  "idx_operator_mcp_sessions_expires",
  "idx_operator_continuity_refs_scope",
  "idx_operator_operation_receipts_scope",
    "idx_operator_growth_mission_revisions_brand",
  "idx_operator_autonomous_cycles_brand_status",
  "idx_operator_autonomous_lineup_schedule",
  "idx_operator_autonomous_lineup_strategy",
  "idx_operator_autonomous_lineup_plan",
  "idx_operator_autonomous_lineup_gate",
  "idx_operator_decision_proposals_key",
  "idx_operator_decision_proposals_status",
    "idx_operator_decision_execution_events_budget",
  "idx_operator_operational_incidents_open",
  "trg_operator_operational_incidents_touch_updated_at",
  "idx_operator_hardening_open_signature",
  "idx_operator_hardening_state_severity",
  "idx_operator_hardening_events_incident",
    "idx_operator_observations_capability_created",
  "trg_operator_hardening_touch_updated_at",
    "idx_operator_work_ledger_status_order",
  "idx_operator_pre_call_routes_lookup",
    "idx_operator_execution_events_recent",
  "idx_operator_post_fingerprints_brand_updated",
  "idx_operator_post_performance_scores_cohort",
  "idx_operator_performance_evidence_lookup",
  "idx_operator_performance_hypotheses_lookup",
  "idx_operator_generation_learning_briefs_active",
  "idx_operator_content_focus_reviews_latest",
    "idx_operator_content_focus_family_selection",
  "idx_manifest_strategy_versions_brand",
  "idx_manifest_evidence_posts_page",
  "idx_manifest_evidence_pages_snapshot",
  "idx_manifest_cycle_plan_items_strategy",
  "idx_manifest_receipt_events_cycle",
  "idx_manifest_cycle_defects_status",
    "idx_manifest_hypotheses_cycle",
    "idx_manifest_semantic_signatures_recent",
  "idx_manifest_learning_briefs_brand_created",
  "idx_manifest_benchmarks_brand_created",
  "idx_manifest_run_comparisons_brand_created",
  "idx_manifest_pattern_intelligence_reuse",
    "idx_manifest_follower_checkpoints_brand_created",
  "idx_operator_source_family_evidence_labels",
  "idx_operator_source_family_label_transitions",
  "idx_operator_source_selection_receipts_scope",
  "idx_operator_source_selection_plans_cycle",
  "idx_manifest_decision_influences_brand_created",
  "idx_manifest_decision_influences_scheduled",



  "idx_scheduled_posts_due",
  "idx_scheduled_posts_user_id",
  "idx_scheduled_posts_threads_user_id",
  "idx_scheduled_posts_idempotency_key",
  "trg_scheduled_posts_user_exists_insert",
  "trg_scheduled_posts_user_exists_update",
  "trg_scheduled_posts_user_cleanup",
  "trg_scheduled_posts_touch_updated_at",
  "idx_scheduled_post_deletions_account_time",
  "idx_scheduled_post_deletions_scheduled_post",
  "idx_scheduled_post_deletions_operation",
  "idx_batch_schedule_presets_user_id",
  "idx_batch_schedule_presets_user_threads",
  "idx_batch_schedule_presets_favorite_per_user_threads",
  "trg_batch_schedule_presets_touch_updated_at",
  "trg_batch_schedule_presets_user_cleanup",
  "idx_threads_publish_idempotency_created_at",
  "trg_threads_publish_idempotency_user_exists_insert",
    "trg_threads_publish_idempotency_user_cleanup",
  "idx_app_threads_accounts_app_user_active",
  "idx_app_threads_accounts_threads_user_id",
  "idx_app_threads_accounts_one_active_per_user",
  "trg_app_threads_accounts_user_exists_insert",
  "trg_app_threads_accounts_user_exists_update",
  "trg_app_threads_accounts_user_cleanup",
  "idx_threads_accounts_configured_account_id",
    "idx_threads_profile_cache_last_refreshed_at",
  "idx_threads_user_insights_cache_last_refreshed_at",
  "idx_threads_post_insights_cache_user_refresh",
  "idx_threads_post_insights_cache_user_sort_order",
  "idx_threads_posts_cache_state_last_refreshed_at",
  "idx_threads_posts_archive_user_timestamp",
  "idx_threads_posts_archive_user_engagement",
  "idx_threads_posts_archive_user_synced",
  "idx_operator_post_metric_snapshots_post_captured",
  "idx_operator_post_metric_snapshots_learning",
];

async function countWhere(sql: string, ...bindings: unknown[]): Promise<number> {
  const row = await testEnv.DB.prepare(sql).bind(...bindings).first<CountRow>();
  return Number(row?.total ?? 0);
}

async function countWhereIn(db: D1Database, sql: string, ...bindings: unknown[]): Promise<number> {
  const row = await db.prepare(sql).bind(...bindings).first<CountRow>();
  return Number(row?.total ?? 0);
}

async function materializeMigrationWithoutLedger(db: D1Database, migrationName: string): Promise<void> {
  const migrations = testEnv.TEST_MIGRATIONS as Array<{ name: string; queries: string[] }>;
  const migration = migrations.find((candidate) => candidate.name === migrationName);
  expect(migration, `Missing test migration ${migrationName}`).toBeDefined();
  for (const query of migration?.queries ?? []) {
    await db.prepare(query).run();
  }
}

type MigrationFixtureProbe = {
  table: string;
  column: string;
  value: string;
};

async function seedManifestIntelligenceFixture(
  db: D1Database,
  suffix: string,
): Promise<MigrationFixtureProbe[]> {
  const cycleId = `cycle-${suffix}`;
  const snapshotId = `snapshot-${suffix}`;
  const strategyId = `strategy-${suffix}`;
  const planItemId = `plan-${suffix}`;

  await db.prepare(
    `INSERT INTO operator_manifest_intelligence_policies (
      brand_key, policy_version, policy_json
    ) VALUES (?, 'policy-v1', '{"analysis_window_days":28}')`,
  ).bind(`brand-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_strategy_versions (
      id, brand_key, version, contract_version, strategy_hash, strategy_json
    ) VALUES (?, ?, 1, 'strategy-v1', ?, '{"focus":"quality"}')`,
  ).bind(`strategy-version-${suffix}`, `brand-${suffix}`, `strategy-hash-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_exposure_snapshots (
      id, cycle_id, brand_key, ledger_version, as_of, timezone, source_hash
    ) VALUES (?, ?, ?, 'ledger-v1', '2099-01-01T00:00:00Z', 'America/New_York', ?)`,
  ).bind(`exposure-${suffix}`, cycleId, `brand-${suffix}`, `exposure-hash-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_evidence_snapshots (
      id, cycle_id, brand_key, snapshot_version, as_of, timezone, window_start,
      window_end, source_hash
    ) VALUES (?, ?, ?, 'snapshot-v1', '2099-01-01T00:00:00Z', 'America/New_York',
      '2098-12-04T00:00:00Z', '2099-01-01T00:00:00Z', ?)`,
  ).bind(snapshotId, cycleId, `brand-${suffix}`, `evidence-hash-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_evidence_posts (
      id, snapshot_id, brand_key, published_post_id, text, published_at,
      age_hours, maturity_state
    ) VALUES (?, ?, ?, ?, 'Evidence fixture', '2098-12-31T00:00:00Z', 24, 'mature')`,
  ).bind(`evidence-post-${suffix}`, snapshotId, `brand-${suffix}`, `published-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_evidence_pages (
      id, snapshot_id, cycle_id, brand_key, page_index, page_contract_version,
      item_count, byte_count, items_json
    ) VALUES (?, ?, ?, ?, 0, 'page-v1', 1, 100, '[{"id":"post-1"}]')`,
  ).bind(`page-${suffix}`, snapshotId, cycleId, `brand-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_analysis_page_reads (
      id, snapshot_id, cycle_id, brand_key, page_index
    ) VALUES (?, ?, ?, ?, 0)`,
  ).bind(`page-read-${suffix}`, snapshotId, cycleId, `brand-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_cycle_strategies (
      id, cycle_id, brand_key, snapshot_id, contract_version,
      account_conclusion_json, content_focus_json, benchmarks_json, directives_json,
      lineup_json, strategy_hash, locked_at
    ) VALUES (?, ?, ?, ?, 'cycle-strategy-v1', '{}', '{}', '{}', '{}', '[]', ?,
      '2099-01-01T01:00:00Z')`,
  ).bind(strategyId, cycleId, `brand-${suffix}`, snapshotId, `cycle-strategy-hash-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_cycle_plan_items (
      id, strategy_id, cycle_id, brand_key, slot_key, slot_date, slot_time,
      family_key, strategic_role, generation_mode, source_kind, audience_reward,
      hook_direction, placement_reason, exploration_mode
    ) VALUES (?, ?, ?, ?, '2099-01-01-01', '2099-01-01', '01:00', 'family-1',
      'coverage', 'source_backed', 'source_card', 'recognition', 'question',
      'Preserve quality', 'controlled')`,
  ).bind(planItemId, strategyId, cycleId, `brand-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_candidate_gate_receipts (
      id, cycle_id, strategy_id, plan_item_id, brand_key, slot_key,
      candidate_hash, receipt_version, results_json, passed
    ) VALUES (?, ?, ?, ?, ?, '2099-01-01-01', ?, 'gate-v1', '{"all_passed":true}', 1)`,
  ).bind(`gate-${suffix}`, cycleId, strategyId, planItemId, `brand-${suffix}`, `candidate-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_hard_bans (
      id, brand_key, rule_key, description, rule_type, pattern, source_authority
    ) VALUES (?, ?, ?, 'Fixture ban', 'literal', 'forbidden phrase', 'owner')`,
  ).bind(`ban-${suffix}`, `brand-${suffix}`, `ban-key-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_cycle_receipts (
      id, cycle_id, brand_key, operation_id, receipt_version, trigger_json,
      startup_state_json, started_at
    ) VALUES (?, ?, ?, ?, 'receipt-v1', '{"trigger":"scheduled"}', '{}',
      '2099-01-01T00:00:00Z')`,
  ).bind(`receipt-${suffix}`, cycleId, `brand-${suffix}`, `operation-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_cycle_receipt_events (
      id, cycle_id, brand_key, event_key, event_type, payload_json
    ) VALUES (?, ?, ?, ?, 'checkpoint', '{"phase":"evidence"}')`,
  ).bind(`receipt-event-${suffix}`, cycleId, `brand-${suffix}`, `event-key-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_cycle_defect_receipts (
      id, cycle_id, brand_key, defect_key, receipt_version, stage_number, stage_key,
      phase, error_code, error_message, impact_state, first_seen_at, last_seen_at
    ) VALUES (?, ?, ?, ?, 'defect-v1', 4, 'schema', 'validation', 'fixture_error',
      'Fixture defect', 'contained', '2099-01-01T00:00:00Z', '2099-01-01T00:00:00Z')`,
  ).bind(`defect-${suffix}`, cycleId, `brand-${suffix}`, `defect-key-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_post_hypotheses (
      id, cycle_id, brand_key, slot_key, hypothesis_version, source_kind, source_type,
      expected_response_type, expected_audience_reward, hook_rationale,
      premise_rationale, exploration_mode, expected_performance_range_json,
      uncertainty
    ) VALUES (?, ?, ?, '2099-01-01-01', 'hypothesis-v1', 'internal', 'source_card',
      'engagement', 'recognition', 'Question hook', 'Proven premise', 'controlled',
      '{"likes_min":100}', 'medium')`,
  ).bind(`hypothesis-${suffix}`, cycleId, `brand-${suffix}`).run();

  return [
    { table: "operator_manifest_intelligence_policies", column: "brand_key", value: `brand-${suffix}` },
    { table: "operator_manifest_strategy_versions", column: "id", value: `strategy-version-${suffix}` },
    { table: "operator_manifest_exposure_snapshots", column: "id", value: `exposure-${suffix}` },
    { table: "operator_manifest_evidence_snapshots", column: "id", value: snapshotId },
    { table: "operator_manifest_evidence_posts", column: "id", value: `evidence-post-${suffix}` },
    { table: "operator_manifest_evidence_pages", column: "id", value: `page-${suffix}` },
    { table: "operator_manifest_analysis_page_reads", column: "id", value: `page-read-${suffix}` },
    { table: "operator_manifest_cycle_strategies", column: "id", value: strategyId },
    { table: "operator_manifest_cycle_plan_items", column: "id", value: planItemId },
    { table: "operator_manifest_candidate_gate_receipts", column: "id", value: `gate-${suffix}` },
    { table: "operator_manifest_hard_bans", column: "id", value: `ban-${suffix}` },
    { table: "operator_manifest_cycle_receipts", column: "id", value: `receipt-${suffix}` },
    { table: "operator_manifest_cycle_receipt_events", column: "id", value: `receipt-event-${suffix}` },
    { table: "operator_manifest_cycle_defect_receipts", column: "id", value: `defect-${suffix}` },
    { table: "operator_manifest_post_hypotheses", column: "id", value: `hypothesis-${suffix}` },
  ];
}

async function seedManifestIntelligenceEngineFixture(
  db: D1Database,
  suffix: string,
): Promise<MigrationFixtureProbe[]> {
  const brandKey = `brand-${suffix}`;
  const experimentId = `experiment-${suffix}`;

  await db.prepare(
    `INSERT INTO operator_manifest_semantic_signatures (
      id, brand_key, content_type, content_id, text_hash, signature_version, signature_json
    ) VALUES (?, ?, 'published', ?, ?, 'signature-v1', '{"semantic_key":"fixture"}')`,
  ).bind(`signature-${suffix}`, brandKey, `content-${suffix}`, `hash-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_maturity_evaluations (
      id, brand_key, published_post_id, checkpoint_hours, evaluation_version,
      evaluation_json, structural_change_allowed
    ) VALUES (?, ?, ?, 24, 'maturity-v1', '{"mature":true}', 1)`,
  ).bind(`maturity-${suffix}`, brandKey, `post-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_comparable_analyses (
      id, brand_key, published_post_id, checkpoint_hours, analysis_version,
      comparable_post_ids_json, analysis_json
    ) VALUES (?, ?, ?, 24, 'analysis-v1', '["control-post"]', '{"delta":12}')`,
  ).bind(`analysis-${suffix}`, brandKey, `post-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_learning_observations (
      id, brand_key, level, feature_key, checkpoint_hours, sample_size,
      supporting_count, contradicting_count, median_overall, effect_size,
      confidence_score, confidence_label, state, evidence_json, learning_version
    ) VALUES (?, ?, 'family', ?, 24, 8, 6, 2, 70, 12, 0.8, 'directional',
      'active', '{"source":"fixture"}', 'learning-v1')`,
  ).bind(`learning-${suffix}`, brandKey, `feature-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_portfolio_states (
      id, brand_key, family_key, role, recommended_role, confidence_score,
      confidence_label, allocation_weight, reason, evidence_json, portfolio_version
    ) VALUES (?, ?, ?, 'core', 'franchise', 0.8, 'directional', 1.3,
      'Fixture evidence', '{"sample":8}', 'portfolio-v1')`,
  ).bind(`portfolio-${suffix}`, brandKey, `family-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_state_transitions (
      id, transition_key, brand_key, entity_type, entity_id, from_state, to_state,
      reason, evidence_json, transitioned_at
    ) VALUES (?, ?, ?, 'confidence', ?, 'emerging', 'directional',
      'Fixture transition', '{}', '2099-01-01T00:00:00Z')`,
  ).bind(`transition-${suffix}`, `transition-key-${suffix}`, brandKey, `entity-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_experiments (
      id, brand_key, experiment_key, family_key, hypothesis_json,
      comparison_group_json, maturity_windows_json, result_criteria_json,
      experiment_version
    ) VALUES (?, ?, ?, ?, '{"claim":"fixture"}', '{"control":"matched"}',
      '[24]', '{"win_delta":8}', 'experiment-v1')`,
  ).bind(experimentId, brandKey, `experiment-key-${suffix}`, `family-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_experiment_assignments (
      id, experiment_id, brand_key, cycle_id, slot_key, hypothesis_id,
      scheduled_post_id, published_post_id, variant_key, status
    ) VALUES (?, ?, ?, ?, '2099-01-01-01', ?, ?, ?, 'variant-a', 'published')`,
  ).bind(
    `assignment-${suffix}`,
    experimentId,
    brandKey,
    `cycle-${suffix}`,
    `hypothesis-${suffix}`,
    900000,
    `published-${suffix}`,
  ).run();

  return [
    { table: "operator_manifest_semantic_signatures", column: "id", value: `signature-${suffix}` },
    { table: "operator_manifest_maturity_evaluations", column: "id", value: `maturity-${suffix}` },
    { table: "operator_manifest_comparable_analyses", column: "id", value: `analysis-${suffix}` },
    { table: "operator_manifest_learning_observations", column: "id", value: `learning-${suffix}` },
    { table: "operator_manifest_portfolio_states", column: "id", value: `portfolio-${suffix}` },
    { table: "operator_manifest_state_transitions", column: "id", value: `transition-${suffix}` },
    { table: "operator_manifest_experiments", column: "id", value: experimentId },
    { table: "operator_manifest_experiment_assignments", column: "id", value: `assignment-${suffix}` },
  ];
}

async function seedManifestMeasurementAuditFixture(
  db: D1Database,
  suffix: string,
): Promise<MigrationFixtureProbe[]> {
  const brandKey = `brand-${suffix}`;

  await db.prepare(
    `INSERT INTO operator_manifest_learning_briefs (
      id, brand_key, brief_key, brief_version, source_fingerprint,
      evidence_window_start, evidence_window_end, authoritative_post_count,
      brief_json, strategy_change_json
    ) VALUES (?, ?, ?, 'brief-v1', ?, '2099-01-01', '2099-01-28', 12,
      '{"improvements":["fixture"]}', '{"changed":true}')`,
  ).bind(`brief-${suffix}`, brandKey, `brief-key-${suffix}`, `brief-source-${suffix}`).run();
  await db.prepare(
    `INSERT INTO operator_manifest_benchmark_snapshots (
      id, brand_key, snapshot_key, cycle_id, benchmark_version, window_start,
      window_end, metrics_json, source_fingerprint
    ) VALUES (?, ?, ?, ?, 'benchmark-v1', '2099-01-01', '2099-01-28',
      '{"median_likes":70}', ?)`,
  ).bind(
    `benchmark-${suffix}`,
    brandKey,
    `snapshot-key-${suffix}`,
    `cycle-${suffix}`,
    `benchmark-source-${suffix}`,
  ).run();
  await db.prepare(
    `INSERT INTO operator_manifest_run_comparisons (
      id, brand_key, cycle_id, previous_cycle_id, comparison_version,
      comparison_json, source_fingerprint
    ) VALUES (?, ?, ?, ?, 'comparison-v1', '{"delta":12}', ?)`,
  ).bind(
    `comparison-${suffix}`,
    brandKey,
    `cycle-${suffix}`,
    `previous-cycle-${suffix}`,
    `comparison-source-${suffix}`,
  ).run();
  await db.prepare(
    `INSERT INTO operator_manifest_saved_pattern_intelligence (
      id, brand_key, pattern_identity_key, external_pattern_id, source_identity_key,
      verified_metrics_json, semantic_json, mechanism_json, adaptation_options_json,
      similarity_json, usage_json, results_json, confidence_json, reuse_state,
      exclusion_state, intelligence_version
    ) VALUES (?, ?, ?, 101, ?, '{"likes":1000}', '{"premise":"fixture"}',
      '{"mechanism":"question"}', '["adapt"]', '{}', '{}', '{}',
      '{"label":"high"}', 'eligible', 'active', 'pattern-v1')`,
  ).bind(
    `pattern-intelligence-${suffix}`,
    brandKey,
    `pattern-${suffix}`,
    `source-${suffix}`,
  ).run();
  await db.prepare(
    `INSERT INTO operator_manifest_follower_checkpoints (
      id, brand_key, checkpoint_key, threads_user_id, checkpoint_version,
      snapshot_date, followers_count, follower_goal, distance_to_goal,
      trajectory_json, attribution_policy
    ) VALUES (?, ?, ?, ?, 'follower-v1', '2099-01-28', 700, 1000000, 999300,
      '{"direction":"up"}', 'account_level_only')`,
  ).bind(
    `follower-${suffix}`,
    brandKey,
    `checkpoint-${suffix}`,
    `threads-${suffix}`,
  ).run();

  return [
    { table: "operator_manifest_learning_briefs", column: "id", value: `brief-${suffix}` },
    { table: "operator_manifest_benchmark_snapshots", column: "id", value: `benchmark-${suffix}` },
    { table: "operator_manifest_run_comparisons", column: "id", value: `comparison-${suffix}` },
    { table: "operator_manifest_saved_pattern_intelligence", column: "id", value: `pattern-intelligence-${suffix}` },
    { table: "operator_manifest_follower_checkpoints", column: "id", value: `follower-${suffix}` },
  ];
}


describe("canonical database migrations", () => {
  it("creates every extracted table with the required columns, indexes, and triggers", async () => {
    for (const [table, expectedColumns] of Object.entries(requiredColumns)) {
      const columns = await testEnv.DB.prepare(`PRAGMA table_info(${table})`)
        .all<{ name: string }>();
      expect((columns.results ?? []).map((column) => column.name)).toEqual(
        expect.arrayContaining(expectedColumns),
      );
    }

        const objectRows: SchemaObjectRow[] = [];
    for (let offset = 0; offset < expectedObjects.length; offset += 50) {
      const chunk = expectedObjects.slice(offset, offset + 50);
      const objects = await testEnv.DB.prepare(
        `SELECT name, type FROM sqlite_master
         WHERE name IN (${chunk.map(() => "?").join(", ")})`,
      ).bind(...chunk).all<SchemaObjectRow>();
      objectRows.push(...(objects.results ?? []));
    }
    expect(objectRows.map((row) => row.name).sort()).toEqual(
      [...expectedObjects].sort(),
    );
  });

  it("reapplies the canonical migration ledger without losing existing data", async () => {
    const suffix = crypto.randomUUID();
    const userId = `migration-user-${suffix}`;
    const sourceUrl = `https://threads.net/t/${suffix}`;
    const followerId = `migration-follower-${suffix}`;
    const accountId = `migration-account-${suffix}`;
    const scheduledKey = `migration-scheduled-${suffix}`;
    const operationId = `migration-delete-${suffix}`;
        const presetId = `migration-preset-${suffix}`;
    const requestHash = `migration-hash-${suffix}`;
        const configuredAccountId = `configured-${suffix}`;
    const confirmationCode = `confirmation-${suffix}`;
    const cachedPostId = `cached-${suffix}`;
        const archivedPostId = `archived-${suffix}`;
    const metricSnapshotId = `metric-${suffix}`;
    const generationRunId = `run-${suffix}`;
        const generationDraftId = `draft-${suffix}`;
    const preflightSnapshotId = `preflight-${suffix}`;
    const sourceBatchId = `source-batch-${suffix}`;
    const sourceSelectionId = `source-selection-${suffix}`;
    const sourceFamilyId = `source-family-${suffix}`;
    const sourceCardId = `source-card-${suffix}`;
    const sourceClaimId = `source-claim-${suffix}`;
    const sourceExclusionId = `source-exclusion-${suffix}`;



    await testEnv.DB.prepare(
      `INSERT INTO users (id, email, email_verified, timezone, clock_format)
       VALUES (?, ?, 1, 'America/New_York', '12h')`,
    ).bind(userId, `${suffix}@example.com`).run();
    await testEnv.DB.prepare(
      `INSERT INTO external_patterns (
        app_user_id, account_id, source_url, post_text, likes
      ) VALUES (?, ?, ?, 'Migration fixture', 1000)`,
    ).bind(userId, "manifest-mental", sourceUrl).run();
    await testEnv.DB.prepare(
      `INSERT INTO threads_follower_snapshots (
        threads_user_id, snapshot_date, followers_count
      ) VALUES (?, '2099-01-01', 42)`,
    ).bind(followerId).run();
    await testEnv.DB.prepare(
      `INSERT INTO gpt_strategy_memory (
        account_id, threads_user_id, kind, body
      ) VALUES (?, ?, 'approved_rule', 'Migration fixture')`,
    ).bind(accountId, followerId).run();
    const scheduled = await testEnv.DB.prepare(
      `INSERT INTO scheduled_posts (
        user_id, threads_user_id, post_text, status, scheduled_time, idempotency_key
      ) VALUES (?, ?, 'Migration scheduled fixture', 'approved', '2099-01-02T12:00:00.000Z', ?)`,
    ).bind(userId, followerId, scheduledKey).run();
    const scheduledPostId = Number(scheduled.meta?.last_row_id ?? 0);
    expect(scheduledPostId).toBeGreaterThan(0);
    await testEnv.DB.prepare(
      `INSERT INTO scheduled_post_deletions (
        id, scheduled_post_id, user_id, threads_user_id, post_text, scheduled_time,
        status_before, reason_code, reason, learning_effect, deleted_by,
        deletion_source, operation_id
      ) VALUES (?, ?, ?, ?, 'Migration deleted fixture', '2099-01-02T12:00:00.000Z',
        'approved', 'technical_corruption', 'Migration fixture', 'unobserved',
        'model', 'mcp', ?)`,
    ).bind(`deletion-${suffix}`, scheduledPostId, userId, followerId, operationId).run();
    await testEnv.DB.prepare(
      `INSERT INTO batch_schedule_presets (
        id, user_id, threads_user_id, name, times_json, is_favorite
      ) VALUES (?, ?, ?, 'Migration preset', '["09:00"]', 1)`,
    ).bind(presetId, userId, followerId).run();
        await testEnv.DB.prepare(
      `INSERT INTO threads_publish_idempotency (
        scope, app_user_id, threads_user_id, request_hash, request_bucket,
        response_status, response_body
      ) VALUES ('immediate', ?, ?, ?, '2099-01-02T12', 200, '{"ok":true}')`,
    ).bind(userId, followerId, requestHash).run();
    await testEnv.DB.prepare(
      `INSERT INTO threads_accounts (
        threads_user_id, access_token, expires_at, created_at, configured_account_id
      ) VALUES (?, 'migration-token', 4102444800, 1, ?)`,
    ).bind(followerId, configuredAccountId).run();
    await testEnv.DB.prepare(
      `INSERT INTO threads_profile_cache (
        threads_user_id, username, name, threads_biography, is_verified,
        threads_profile_picture_url
      ) VALUES (?, 'migration-user', 'Migration User', 'Migration profile', 1,
        'https://example.com/profile.png')`,
    ).bind(followerId).run();
    await testEnv.DB.prepare(
      `INSERT INTO app_threads_accounts (
        app_user_id, threads_user_id, connection_active, is_active,
        tombstone_expires_at, created_at
      ) VALUES (?, ?, 1, 1, NULL, 1)`,
    ).bind(userId, followerId).run();
        await testEnv.DB.prepare(
      `INSERT INTO meta_deletion_requests (
        confirmation_code, platform_user_id, status
      ) VALUES (?, ?, 'pending')`,
    ).bind(confirmationCode, followerId).run();
    await testEnv.DB.prepare(
      `INSERT INTO threads_user_insights_cache (
        threads_user_id, insights_json
      ) VALUES (?, '{"followers_count":42}')`,
    ).bind(followerId).run();
    await testEnv.DB.prepare(
      `INSERT INTO threads_post_insights_cache (
        threads_user_id, post_id, post_text, post_timestamp, post_permalink,
        post_username, profile_picture_url, views, likes, replies, reposts,
        quotes, shares, sort_order, engagement_total
      ) VALUES (?, ?, 'Cached migration fixture', '2099-01-03T12:00:00.000Z',
        'https://threads.net/t/cached', 'migration-user',
        'https://example.com/profile.png', 1000, 100, 5, 3, 2, 1, 7, 111)`,
    ).bind(followerId, cachedPostId).run();
    await testEnv.DB.prepare(
      `INSERT INTO threads_posts_cache_state (
        threads_user_id, next_cursor, has_more
      ) VALUES (?, 'cursor-migration', 1)`,
    ).bind(followerId).run();
    await testEnv.DB.prepare(
      `INSERT INTO threads_posts_archive (
        threads_user_id, post_id, post_text, post_timestamp, post_permalink,
        post_username, profile_picture_url, views, likes, replies, reposts,
        quotes, shares, engagement_total, source_rank
      ) VALUES (?, ?, 'Archived migration fixture', '2099-01-03T12:00:00.000Z',
        'https://threads.net/t/archived', 'migration-user',
        'https://example.com/profile.png', 2000, 200, 10, 6, 4, 2, 222, 1)`,
    ).bind(followerId, archivedPostId).run();
        await testEnv.DB.prepare(
      `INSERT INTO operator_post_metric_snapshots (
        id, brand_key, published_post_id, scheduled_post_id, draft_id,
        generation_run_id, source_card_id, source_selection_id, metrics_json,
        captured_at, valid_for_learning, anomaly_reason, collection_source
      ) VALUES (?, 'manifest_mental', ?, ?, 'draft-migration', 'run-migration',
        'card-migration', 'selection-migration', '{"likes":200}',
        '2099-01-03T13:00:00.000Z', 0, 'migration_anomaly', 'insights_refresh')`,
    ).bind(metricSnapshotId, archivedPostId, scheduledPostId).run();
    await testEnv.DB.prepare(
      `INSERT INTO gpt_post_strategy_tags (
        scheduled_post_id, account_id, threads_user_id, pillar, hook_style,
        format, intent, experiment, novelty_level, metadata_json
      ) VALUES (?, ?, ?, 'intuition', 'direct_validation', 'short_text',
        'reassurance', 'migration_test', 'controlled_variation', '{"lineage":true}')`,
    ).bind(scheduledPostId, accountId, followerId).run();
    await testEnv.DB.prepare(
      `INSERT INTO gpt_generation_runs (
        id, account_id, threads_user_id, objective, prompt_summary, status,
        metadata_json, source_card_id, source_card_family_id,
        source_card_version_number, adaptation_plan_json,
        prior_adaptation_context_json
      ) VALUES (?, ?, ?, 'Migration objective', 'Migration prompt', 'completed',
        '{"migration":true}', 'card-migration', 'family-migration', 3,
        '{"style":"structure_preserving"}', '{"prior_runs":2}')`,
    ).bind(generationRunId, accountId, followerId).run();
    await testEnv.DB.prepare(
      `INSERT INTO gpt_generation_drafts (
        id, run_id, account_id, threads_user_id, draft_index, text, status,
        rejection_reason, score_json, strategy_json, replacement_for_draft_id,
        scheduled_post_id, metadata_json, source_card_id, owner_feedback,
        gate_summary_json, showable, published_post_id
      ) VALUES (?, ?, ?, ?, 1, 'Migration draft', 'scheduled', NULL,
        '{"overall":9}', '{"pillar":"intuition"}', 'prior-draft', ?,
        '{"migration":true}', 'card-migration', 'Preserve lineage',
        '{"passed":true}', 1, ?)`,
    ).bind(generationDraftId, generationRunId, accountId, followerId, scheduledPostId, archivedPostId).run();
        await testEnv.DB.prepare(
      `INSERT INTO gpt_preflight_snapshots (
        id, account_id, threads_user_id, objective, sections_json, manifest_json
      ) VALUES (?, ?, ?, 'Migration preflight', '{"strategy":{"ok":true}}',
        '{"complete":true}')`,
    ).bind(preflightSnapshotId, accountId, followerId).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_source_selection_batches (
        id, brand_key, workflow_session_id, selection_method,
        eligibility_min_likes, qualified_pool_count, requested_count,
        selected_count, selected_at, metadata_json, production_date, status,
        retired_at, retirement_reason
      ) VALUES (?, 'manifest_mental', 'workflow-migration', 'random_draw',
        1000, 25, 4, 1, '2099-01-04T12:00:00.000Z', '{"seed":7}',
        '2099-01-04', 'retired', '2099-01-04T13:00:00.000Z',
        'migration_complete')`,
    ).bind(sourceBatchId).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_source_selections (
        id, batch_id, brand_key, workflow_session_id, draw_order,
        source_identity_key, source_type, internal_source_id, threads_post_id,
        canonical_source_url, post_text, original_posted_at,
        metrics_snapshot_json, source_snapshot_json, source_card_id, selected_at,
        disposition, disposition_reason, disposition_at, workflow_sequence
      ) VALUES (?, ?, 'manifest_mental', 'workflow-migration', 1,
        'saved_pattern:migration', 'saved_pattern', 'pattern-migration',
        'threads-migration', 'https://threads.net/t/source-migration',
        'Migration source', '2099-01-01T12:00:00.000Z', '{"likes":2000}',
        '{"text":"Migration source"}', ?, '2099-01-04T12:00:00.000Z',
        'accepted', 'selected_for_lineup', '2099-01-04T12:05:00.000Z', 3)`,
    ).bind(sourceSelectionId, sourceBatchId, sourceCardId).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_source_exclusions (
        id, brand_key, source_identity_key, source_type, internal_source_id,
        reason, active
      ) VALUES (?, 'manifest_mental', 'saved_pattern:excluded-migration',
        'saved_pattern', 'excluded-migration', 'permanent_source_exclusion', 1)`,
    ).bind(sourceExclusionId).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_source_card_families (
        id, brand_key, source_identity_key, source_type, internal_source_id,
        threads_post_id, canonical_source_url, current_source_card_id, status
      ) VALUES (?, 'manifest_mental', 'saved_pattern:migration', 'saved_pattern',
        'pattern-migration', 'threads-migration',
        'https://threads.net/t/source-migration', ?, 'active')`,
    ).bind(sourceFamilyId, sourceCardId).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_source_cards (
        id, brand_key, workflow_session_id, sequence_label, lane_key, title,
        status, primary_source_json, secondary_sources_json, anti_sources_json,
        metrics_snapshot_json, source_mechanism, required_product,
        forbidden_surfaces_json, danger_surfaces_json,
        current_inventory_constraints_json, pass_conditions_json,
        fail_conditions_json, recommended_direction, context_admission_id,
        created_by, family_id, source_selection_id, version_number, is_current,
        supersedes_source_card_id, version_reason, transformation_contract_json,
        locked_at
      ) VALUES (?, 'manifest_mental', 'workflow-migration', 'source-1',
        'intuition', 'Migration source card', 'locked', '{"text":"Migration source"}',
        '[]', '[]', '{"likes":2000}', 'direct validation',
        'recognition and reassurance', '[]', '[]', '[]', '["preserve hook"]',
        '["do not invent premise"]', 'close source mimicry',
        'context-migration', 'model', ?, ?, 2, 1, 'prior-card-migration',
        'source interpretation changed', '{"must_preserve_function":["payoff"]}',
        '2099-01-04T12:10:00.000Z')`,
    ).bind(sourceCardId, sourceFamilyId, sourceSelectionId).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_daily_source_claims (
        id, brand_key, production_date, timezone, source_identity_key,
        source_type, internal_source_id, source_batch_id, source_selection_id,
        workflow_session_id, review_batch_id, review_item_number, source_card_id,
        generation_run_id, draft_id, scheduled_post_id, status,
        disposition_reason
      ) VALUES (?, 'manifest_mental', '2099-01-04', 'America/New_York',
        'saved_pattern:migration', 'saved_pattern', 'pattern-migration', ?, ?,
        'workflow-migration', 'review-migration', 1, ?, ?, ?, ?, 'scheduled',
        'lineage_complete')`,
    ).bind(sourceClaimId, sourceBatchId, sourceSelectionId, sourceCardId,
      generationRunId, generationDraftId, scheduledPostId).run();

    await applyD1Migrations(
      testEnv.DB,
      testEnv.TEST_MIGRATIONS,
      "lensically_test_migrations",
    );

    const counts = await Promise.all([
      countWhere("SELECT COUNT(*) AS total FROM users WHERE id = ?", userId),
      countWhere("SELECT COUNT(*) AS total FROM external_patterns WHERE source_url = ?", sourceUrl),
      countWhere("SELECT COUNT(*) AS total FROM threads_follower_snapshots WHERE threads_user_id = ?", followerId),
      countWhere("SELECT COUNT(*) AS total FROM gpt_strategy_memory WHERE account_id = ?", accountId),
      countWhere("SELECT COUNT(*) AS total FROM scheduled_posts WHERE idempotency_key = ?", scheduledKey),
      countWhere("SELECT COUNT(*) AS total FROM scheduled_post_deletions WHERE operation_id = ?", operationId),
      countWhere("SELECT COUNT(*) AS total FROM batch_schedule_presets WHERE id = ?", presetId),
            countWhere("SELECT COUNT(*) AS total FROM threads_publish_idempotency WHERE request_hash = ?", requestHash),
      countWhere("SELECT COUNT(*) AS total FROM threads_accounts WHERE configured_account_id = ?", configuredAccountId),
      countWhere("SELECT COUNT(*) AS total FROM threads_profile_cache WHERE threads_user_id = ?", followerId),
      countWhere("SELECT COUNT(*) AS total FROM app_threads_accounts WHERE app_user_id = ? AND threads_user_id = ?", userId, followerId),
            countWhere("SELECT COUNT(*) AS total FROM meta_deletion_requests WHERE confirmation_code = ?", confirmationCode),
      countWhere("SELECT COUNT(*) AS total FROM threads_user_insights_cache WHERE threads_user_id = ?", followerId),
      countWhere("SELECT COUNT(*) AS total FROM threads_post_insights_cache WHERE post_id = ? AND engagement_total = 111", cachedPostId),
      countWhere("SELECT COUNT(*) AS total FROM threads_posts_cache_state WHERE threads_user_id = ? AND next_cursor = 'cursor-migration'", followerId),
      countWhere("SELECT COUNT(*) AS total FROM threads_posts_archive WHERE post_id = ? AND engagement_total = 222", archivedPostId),
            countWhere("SELECT COUNT(*) AS total FROM operator_post_metric_snapshots WHERE id = ? AND valid_for_learning = 0 AND anomaly_reason = 'migration_anomaly'", metricSnapshotId),
      countWhere("SELECT COUNT(*) AS total FROM gpt_post_strategy_tags WHERE scheduled_post_id = ? AND pillar = 'intuition'", scheduledPostId),
      countWhere("SELECT COUNT(*) AS total FROM gpt_generation_runs WHERE id = ? AND source_card_version_number = 3 AND adaptation_plan_json IS NOT NULL", generationRunId),
      countWhere("SELECT COUNT(*) AS total FROM gpt_generation_drafts WHERE id = ? AND showable = 1 AND scheduled_post_id = ? AND published_post_id = ?", generationDraftId, scheduledPostId, archivedPostId),
                  countWhere("SELECT COUNT(*) AS total FROM gpt_preflight_snapshots WHERE id = ? AND manifest_json = ?", preflightSnapshotId, '{"complete":true}'),
      countWhere("SELECT COUNT(*) AS total FROM operator_source_selection_batches WHERE id = ? AND status = 'retired' AND retirement_reason = 'migration_complete'", sourceBatchId),
      countWhere("SELECT COUNT(*) AS total FROM operator_source_selections WHERE id = ? AND disposition = 'accepted' AND workflow_sequence = 3", sourceSelectionId),
      countWhere("SELECT COUNT(*) AS total FROM operator_source_exclusions WHERE id = ? AND active = 1", sourceExclusionId),
      countWhere("SELECT COUNT(*) AS total FROM operator_source_card_families WHERE id = ? AND current_source_card_id = ?", sourceFamilyId, sourceCardId),
      countWhere("SELECT COUNT(*) AS total FROM operator_source_cards WHERE id = ? AND version_number = 2 AND is_current = 1 AND transformation_contract_json IS NOT NULL", sourceCardId),
      countWhere("SELECT COUNT(*) AS total FROM operator_daily_source_claims WHERE id = ? AND generation_run_id = ? AND draft_id = ? AND scheduled_post_id = ?", sourceClaimId, generationRunId, generationDraftId, scheduledPostId),
    ]);
    expect(counts).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });

    it("upgrades the legacy scheduled-deletion schema before backfilling new fields", async () => {
    await testEnv.UPGRADE_DB.prepare(
      `CREATE TABLE scheduled_post_deletions (
        id TEXT PRIMARY KEY,
        scheduled_post_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        threads_user_id TEXT NOT NULL,
        post_text TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        status_before TEXT NOT NULL,
        reason TEXT NOT NULL,
        deleted_by TEXT NOT NULL,
        deletion_source TEXT NOT NULL,
        operation_id TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await testEnv.UPGRADE_DB.prepare(
      `INSERT INTO scheduled_post_deletions (
        id, scheduled_post_id, user_id, threads_user_id, post_text, scheduled_time,
        status_before, reason, deleted_by, deletion_source
      ) VALUES (
        'legacy-deletion', 1, 'legacy-user', 'legacy-threads', 'Legacy fixture',
        '2099-01-01T12:00:00.000Z', 'approved', 'Legacy reason', 'model', 'mcp'
      )`,
    ).run();

    await applyD1Migrations(
      testEnv.UPGRADE_DB,
      testEnv.TEST_MIGRATIONS,
      "lensically_upgrade_migrations",
    );

    const columns = await testEnv.UPGRADE_DB.prepare(
      "PRAGMA table_info(scheduled_post_deletions)",
    ).all<{ name: string }>();
    expect((columns.results ?? []).map((column) => column.name)).toEqual(
      expect.arrayContaining(["reason_code", "learning_effect"]),
    );
    const upgraded = await testEnv.UPGRADE_DB.prepare(
      `SELECT reason_code, learning_effect
       FROM scheduled_post_deletions
       WHERE id = 'legacy-deletion'`,
    ).first<{ reason_code: string; learning_effect: string }>();
    expect(upgraded).toEqual({
      reason_code: "legacy_unclassified",
      learning_effect: "unobserved",
    });
  });

    it("upgrades legacy account keys while preserving tokens, profiles, and deletion receipts", async () => {
    const db = testEnv.IDENTITY_UPGRADE_DB;
    await db.prepare(
      `CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0,
        threads_user_id TEXT,
        threads_username TEXT,
        access_token TEXT,
        token_expires_at INTEGER,
        is_admin INTEGER NOT NULL DEFAULT 0,
        connection_active INTEGER NOT NULL DEFAULT 1,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        clock_format TEXT NOT NULL DEFAULT '12h',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO users (id, email, email_verified, is_admin)
       VALUES ('legacy-owner', 'legacy-owner@example.com', 1, 1)`,
    ).run();
    await db.prepare(
      `CREATE TABLE app_threads_accounts (
        app_user_id TEXT PRIMARY KEY,
        threads_user_id TEXT NOT NULL,
        connection_active INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        tombstone_expires_at TEXT,
        created_at INTEGER NOT NULL
      )`,
    ).run();
        await db.prepare(
      `INSERT INTO app_threads_accounts (
        app_user_id, threads_user_id, connection_active, is_active,
        tombstone_expires_at, created_at
      ) VALUES (
        'legacy-owner', 'legacy-threads', 1, 1, '2099-01-01T00:00:00.000Z', 1
      )`,
    ).run();
    await db.prepare(
      `CREATE TRIGGER trg_app_threads_accounts_user_cleanup
       AFTER DELETE ON users
       FOR EACH ROW
       BEGIN
         DELETE FROM app_threads_accounts WHERE app_user_id = OLD.id;
       END`,
    ).run();
    await db.prepare(
      `CREATE TABLE threads_accounts (
        threads_user_id TEXT NOT NULL,
        access_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        configured_account_id TEXT
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO threads_accounts (
        threads_user_id, access_token, expires_at, created_at, configured_account_id
      ) VALUES ('legacy-threads', 'legacy-token', 4102444800, 1, 'manifest-mental')`,
    ).run();
    await db.prepare(
      `CREATE TABLE threads_profile_cache (
        threads_user_id TEXT PRIMARY KEY,
        username TEXT,
        name TEXT,
        threads_biography TEXT,
        is_verified INTEGER NOT NULL DEFAULT 0,
        threads_profile_picture_url TEXT,
        last_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO threads_profile_cache (
        threads_user_id, username, name, threads_biography, is_verified,
        threads_profile_picture_url
      ) VALUES (
        'legacy-threads', 'legacyuser', 'Legacy User', 'Legacy profile', 1,
        'https://example.com/legacy.png'
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE meta_deletion_requests (
        confirmation_code TEXT PRIMARY KEY,
        platform_user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO meta_deletion_requests (
        confirmation_code, platform_user_id, status
      ) VALUES ('legacy-confirmation', 'legacy-threads', 'pending')`,
    ).run();

    await applyD1Migrations(
      db,
      testEnv.TEST_MIGRATIONS,
      "lensically_identity_upgrade_migrations",
    );

    const appColumns = await db.prepare("PRAGMA table_info(app_threads_accounts)")
      .all<{ name: string; pk: number }>();
    const appPrimaryKey = new Map((appColumns.results ?? []).map((column) => [column.name, Number(column.pk)]));
    expect(appPrimaryKey.get("app_user_id")).toBe(1);
    expect(appPrimaryKey.get("threads_user_id")).toBe(2);

    const tokenColumns = await db.prepare("PRAGMA table_info(threads_accounts)")
      .all<{ name: string; pk: number }>();
    expect((tokenColumns.results ?? []).find((column) => column.name === "threads_user_id")?.pk).toBe(1);

    const identity = await db.prepare(
      `SELECT a.tombstone_expires_at, t.access_token, t.configured_account_id,
              p.username, p.threads_profile_picture_url, d.status
       FROM app_threads_accounts a
       JOIN threads_accounts t ON t.threads_user_id = a.threads_user_id
       JOIN threads_profile_cache p ON p.threads_user_id = t.threads_user_id
       JOIN meta_deletion_requests d ON d.platform_user_id = t.threads_user_id
       WHERE a.app_user_id = 'legacy-owner'`,
    ).first<Record<string, unknown>>();
    expect(identity).toMatchObject({
      tombstone_expires_at: null,
      access_token: "legacy-token",
      configured_account_id: "manifest-mental",
      username: "legacyuser",
      threads_profile_picture_url: "https://example.com/legacy.png",
      status: "pending",
    });

    await db.prepare(
      `INSERT INTO app_threads_accounts (
        app_user_id, threads_user_id, connection_active, is_active, created_at
      ) VALUES ('legacy-owner', 'second-threads', 1, 0, 2)`,
    ).run();
        const linkedAccountCount = await db.prepare(
      "SELECT COUNT(*) AS total FROM app_threads_accounts WHERE app_user_id = 'legacy-owner'",
    ).first<CountRow>();
    expect(Number(linkedAccountCount?.total ?? 0)).toBe(2);

    await expect(
      db.prepare(
        `INSERT INTO app_threads_accounts (
          app_user_id, threads_user_id, connection_active, is_active, created_at
        ) VALUES ('missing-owner', 'missing-threads', 1, 1, 1)`,
      ).run(),
    ).rejects.toThrow(/foreign_key_violation:app_threads_accounts\.app_user_id/);

    await db.prepare("DELETE FROM users WHERE id = 'legacy-owner'").run();
    const remainingLinks = await db.prepare(
      "SELECT COUNT(*) AS total FROM app_threads_accounts WHERE app_user_id = 'legacy-owner'",
    ).first<CountRow>();
    expect(Number(remainingLinks?.total ?? 0)).toBe(0);
  });

    it("adopts the live measurement schema without losing caches, archive history, or learning metadata", async () => {
    const db = testEnv.MEASUREMENT_UPGRADE_DB;
    await db.prepare(
      `CREATE TABLE threads_user_insights_cache (
        threads_user_id TEXT PRIMARY KEY,
        insights_json TEXT NOT NULL,
        last_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE threads_post_insights_cache (
        threads_user_id TEXT NOT NULL,
        post_id TEXT PRIMARY KEY,
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
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE threads_posts_cache_state (
        threads_user_id TEXT PRIMARY KEY,
        next_cursor TEXT,
        has_more INTEGER NOT NULL DEFAULT 0,
        last_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE threads_posts_archive (
        threads_user_id TEXT NOT NULL,
        post_id TEXT NOT NULL,
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
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_post_metric_snapshots (
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
      )`,
    ).run();

    await db.prepare(
      `INSERT INTO threads_user_insights_cache (threads_user_id, insights_json)
       VALUES ('live-threads', '{"followers_count":777}')`,
    ).run();
    await db.prepare(
      `INSERT INTO threads_post_insights_cache (
        threads_user_id, post_id, post_text, likes, engagement_total
      ) VALUES ('live-threads', 'live-cached-post', 'Live cached post', 300, 333)`,
    ).run();
    await db.prepare(
      `INSERT INTO threads_posts_cache_state (threads_user_id, next_cursor, has_more)
       VALUES ('live-threads', 'live-cursor', 1)`,
    ).run();
    await db.prepare(
      `INSERT INTO threads_posts_archive (
        threads_user_id, post_id, post_text, likes, engagement_total, source_rank
      ) VALUES ('live-threads', 'live-archived-post', 'Live archived post', 400, 444, 2)`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_post_metric_snapshots (
        id, brand_key, published_post_id, generation_run_id, metrics_json,
        captured_at, valid_for_learning, anomaly_reason, collection_source
      ) VALUES (
        'live-metric', 'manifest_mental', 'live-archived-post', 'live-run',
        '{"likes":400}', '2099-03-01T12:00:00.000Z', 0,
        'live_anomaly', 'insights_refresh'
      )`,
    ).run();

    await applyD1Migrations(
      db,
      testEnv.TEST_MIGRATIONS,
      "lensically_measurement_upgrade_migrations",
    );

    const userInsights = await db.prepare(
      "SELECT insights_json FROM threads_user_insights_cache WHERE threads_user_id = 'live-threads'",
    ).first<{ insights_json: string }>();
    const cachedPost = await db.prepare(
      "SELECT likes, engagement_total FROM threads_post_insights_cache WHERE post_id = 'live-cached-post'",
    ).first<{ likes: number; engagement_total: number }>();
    const cacheState = await db.prepare(
      "SELECT next_cursor, has_more FROM threads_posts_cache_state WHERE threads_user_id = 'live-threads'",
    ).first<{ next_cursor: string; has_more: number }>();
    const archivedPost = await db.prepare(
      "SELECT likes, engagement_total, source_rank FROM threads_posts_archive WHERE post_id = 'live-archived-post'",
    ).first<{ likes: number; engagement_total: number; source_rank: number }>();
    const metric = await db.prepare(
      `SELECT generation_run_id, valid_for_learning, anomaly_reason, collection_source
       FROM operator_post_metric_snapshots WHERE id = 'live-metric'`,
    ).first<Record<string, unknown>>();

    expect(userInsights?.insights_json).toBe('{"followers_count":777}');
    expect(cachedPost).toMatchObject({ likes: 300, engagement_total: 333 });
    expect(cacheState).toMatchObject({ next_cursor: "live-cursor", has_more: 1 });
    expect(archivedPost).toMatchObject({ likes: 400, engagement_total: 444, source_rank: 2 });
    expect(metric).toMatchObject({
      generation_run_id: "live-run",
      valid_for_learning: 0,
      anomaly_reason: "live_anomaly",
      collection_source: "insights_refresh",
    });
  });

    it("adopts the live generation schema without losing adaptation, gate, or preflight lineage", async () => {
    const db = testEnv.GENERATION_UPGRADE_DB;
    await db.prepare(
      `CREATE TABLE gpt_generation_runs (
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
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE gpt_generation_drafts (
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
        published_post_id TEXT
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE gpt_preflight_snapshots (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        threads_user_id TEXT NOT NULL,
        objective TEXT,
        sections_json TEXT NOT NULL,
        manifest_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE gpt_post_strategy_tags (
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
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();

    await db.prepare(
      `INSERT INTO gpt_generation_runs (
        id, account_id, threads_user_id, objective, prompt_summary, status,
        metadata_json, source_card_id, source_card_family_id,
        source_card_version_number, adaptation_plan_json,
        prior_adaptation_context_json
      ) VALUES (
        'live-generation-run', 'manifest-mental', 'live-threads',
        'Live objective', 'Live prompt', 'completed', '{"live":true}',
        'live-card', 'live-family', 4, '{"style":"close_mimicry"}',
        '{"prior":"preserved"}'
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO gpt_generation_drafts (
        id, run_id, account_id, threads_user_id, draft_index, text, status,
        score_json, strategy_json, replacement_for_draft_id, scheduled_post_id,
        metadata_json, source_card_id, owner_feedback, gate_summary_json,
        showable, published_post_id
      ) VALUES (
        'live-generation-draft', 'live-generation-run', 'manifest-mental',
        'live-threads', 2, 'Live draft', 'scheduled', '{"overall":10}',
        '{"pillar":"intuition"}', 'live-prior-draft', 42, '{"live":true}',
        'live-card', 'Live feedback', '{"passed":true}', 1,
        'live-published-post'
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO gpt_preflight_snapshots (
        id, account_id, threads_user_id, objective, sections_json, manifest_json
      ) VALUES (
        'live-preflight', 'manifest-mental', 'live-threads', 'Live preflight',
        '{"sources":{"complete":true}}', '{"manifest":"preserved"}'
      )`,
    ).run();

    await applyD1Migrations(
      db,
      testEnv.TEST_MIGRATIONS,
      "lensically_generation_upgrade_migrations",
    );

    const run = await db.prepare(
      `SELECT source_card_id, source_card_family_id, source_card_version_number,
              adaptation_plan_json, prior_adaptation_context_json
       FROM gpt_generation_runs WHERE id = 'live-generation-run'`,
    ).first<Record<string, unknown>>();
    const draft = await db.prepare(
      `SELECT score_json, strategy_json, replacement_for_draft_id,
              scheduled_post_id, source_card_id, owner_feedback,
              gate_summary_json, showable, published_post_id
       FROM gpt_generation_drafts WHERE id = 'live-generation-draft'`,
    ).first<Record<string, unknown>>();
    const preflight = await db.prepare(
      `SELECT sections_json, manifest_json
       FROM gpt_preflight_snapshots WHERE id = 'live-preflight'`,
    ).first<Record<string, unknown>>();

    expect(run).toMatchObject({
      source_card_id: "live-card",
      source_card_family_id: "live-family",
      source_card_version_number: 4,
      adaptation_plan_json: '{"style":"close_mimicry"}',
      prior_adaptation_context_json: '{"prior":"preserved"}',
    });
    expect(draft).toMatchObject({
      score_json: '{"overall":10}',
      strategy_json: '{"pillar":"intuition"}',
      replacement_for_draft_id: "live-prior-draft",
      scheduled_post_id: 42,
      source_card_id: "live-card",
      owner_feedback: "Live feedback",
      gate_summary_json: '{"passed":true}',
      showable: 1,
      published_post_id: "live-published-post",
    });
    expect(preflight).toMatchObject({
      sections_json: '{"sources":{"complete":true}}',
      manifest_json: '{"manifest":"preserved"}',
    });
  });

    it("adopts the live source lineage schema without losing draw, claim, exclusion, or version state", async () => {
    const db = testEnv.SOURCE_UPGRADE_DB;
    await db.prepare(
      `CREATE TABLE operator_source_selection_batches (
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
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_source_selections (
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
        workflow_sequence INTEGER
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_daily_source_claims (
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
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_source_exclusions (
        id TEXT PRIMARY KEY,
        brand_key TEXT NOT NULL,
        source_identity_key TEXT NOT NULL,
        source_type TEXT NOT NULL,
        internal_source_id TEXT NOT NULL,
        reason TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_source_card_families (
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
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_source_cards (
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
      )`,
    ).run();

    await db.prepare(
      `INSERT INTO operator_source_selection_batches (
        id, brand_key, workflow_session_id, selection_method,
        eligibility_min_likes, qualified_pool_count, requested_count,
        selected_count, selected_at, production_date, status, retired_at,
        retirement_reason
      ) VALUES (
        'live-source-batch', 'manifest_mental', 'live-workflow', 'random_draw',
        1000, 50, 4, 1, '2099-04-01T12:00:00.000Z', '2099-04-01',
        'retired', '2099-04-01T13:00:00.000Z', 'live_retirement'
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_source_selections (
        id, batch_id, brand_key, workflow_session_id, draw_order,
        source_identity_key, source_type, internal_source_id, post_text,
        metrics_snapshot_json, source_snapshot_json, source_card_id, selected_at,
        disposition, disposition_reason, disposition_at, workflow_sequence
      ) VALUES (
        'live-source-selection', 'live-source-batch', 'manifest_mental',
        'live-workflow', 1, 'saved_pattern:live', 'saved_pattern', 'live-pattern',
        'Live source', '{"likes":5000}', '{"text":"Live source"}',
        'live-source-card', '2099-04-01T12:00:00.000Z', 'accepted',
        'live_selection', '2099-04-01T12:05:00.000Z', 4
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_source_exclusions (
        id, brand_key, source_identity_key, source_type, internal_source_id,
        reason, active
      ) VALUES (
        'live-source-exclusion', 'manifest_mental', 'saved_pattern:excluded-live',
        'saved_pattern', 'excluded-live', 'permanent', 1
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_source_card_families (
        id, brand_key, source_identity_key, source_type, internal_source_id,
        current_source_card_id, status
      ) VALUES (
        'live-source-family', 'manifest_mental', 'saved_pattern:live',
        'saved_pattern', 'live-pattern', 'live-source-card', 'active'
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_source_cards (
        id, brand_key, sequence_label, title, status, primary_source_json,
        source_mechanism, required_product, forbidden_surfaces_json,
        pass_conditions_json, fail_conditions_json, family_id,
        source_selection_id, version_number, is_current,
        supersedes_source_card_id, version_reason, transformation_contract_json,
        locked_at
      ) VALUES (
        'live-source-card', 'manifest_mental', 'live-1', 'Live source card',
        'locked', '{"text":"Live source"}', 'direct validation',
        'recognition', '[]', '["preserve payoff"]', '["no new premise"]',
        'live-source-family', 'live-source-selection', 5, 1,
        'live-prior-card', 'live_version_reason',
        '{"must_preserve_function":["payoff"]}', '2099-04-01T12:10:00.000Z'
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_daily_source_claims (
        id, brand_key, production_date, timezone, source_identity_key,
        source_type, internal_source_id, source_batch_id, source_selection_id,
        workflow_session_id, source_card_id, generation_run_id, draft_id,
        scheduled_post_id, status, disposition_reason
      ) VALUES (
        'live-source-claim', 'manifest_mental', '2099-04-01',
        'America/New_York', 'saved_pattern:live', 'saved_pattern',
        'live-pattern', 'live-source-batch', 'live-source-selection',
        'live-workflow', 'live-source-card', 'live-run', 'live-draft', 42,
        'scheduled', 'live_lineage'
      )`,
    ).run();

    await applyD1Migrations(
      db,
      testEnv.TEST_MIGRATIONS,
      "lensically_source_upgrade_migrations",
    );

    const batch = await db.prepare(
      `SELECT production_date, status, retired_at, retirement_reason
       FROM operator_source_selection_batches WHERE id = 'live-source-batch'`,
    ).first<Record<string, unknown>>();
    const selection = await db.prepare(
      `SELECT disposition, disposition_reason, disposition_at, workflow_sequence
       FROM operator_source_selections WHERE id = 'live-source-selection'`,
    ).first<Record<string, unknown>>();
    const claim = await db.prepare(
      `SELECT generation_run_id, draft_id, scheduled_post_id, status
       FROM operator_daily_source_claims WHERE id = 'live-source-claim'`,
    ).first<Record<string, unknown>>();
    const exclusion = await db.prepare(
      `SELECT reason, active FROM operator_source_exclusions
       WHERE id = 'live-source-exclusion'`,
    ).first<Record<string, unknown>>();
    const family = await db.prepare(
      `SELECT current_source_card_id, status FROM operator_source_card_families
       WHERE id = 'live-source-family'`,
    ).first<Record<string, unknown>>();
    const card = await db.prepare(
      `SELECT version_number, is_current, supersedes_source_card_id,
              version_reason, transformation_contract_json, locked_at
       FROM operator_source_cards WHERE id = 'live-source-card'`,
    ).first<Record<string, unknown>>();

    expect(batch).toMatchObject({
      production_date: "2099-04-01",
      status: "retired",
      retired_at: "2099-04-01T13:00:00.000Z",
      retirement_reason: "live_retirement",
    });
    expect(selection).toMatchObject({
      disposition: "accepted",
      disposition_reason: "live_selection",
      disposition_at: "2099-04-01T12:05:00.000Z",
      workflow_sequence: 4,
    });
    expect(claim).toMatchObject({
      generation_run_id: "live-run",
      draft_id: "live-draft",
      scheduled_post_id: 42,
      status: "scheduled",
    });
    expect(exclusion).toMatchObject({ reason: "permanent", active: 1 });
    expect(family).toMatchObject({
      current_source_card_id: "live-source-card",
      status: "active",
    });
    expect(card).toMatchObject({
      version_number: 5,
      is_current: 1,
      supersedes_source_card_id: "live-prior-card",
      version_reason: "live_version_reason",
      transformation_contract_json: '{"must_preserve_function":["payoff"]}',
      locked_at: "2099-04-01T12:10:00.000Z",
    });
  });

    it("preserves quality enforcement records across migration replay", async () => {
    const suffix = crypto.randomUUID();
    const gateId = `quality-gate-${suffix}`;
    const gateKey = `quality_gate_${suffix}`;
    const gateResultId = `quality-result-${suffix}`;
    const inventoryId = `quality-inventory-${suffix}`;
    const requirementId = `quality-requirement-${suffix}`;
    const requirementStage = `quality-stage-${suffix}`;

    await testEnv.DB.prepare(
      `INSERT INTO operator_gates (
        id, brand_key, gate_key, display_name, description, stage_scope,
        lane_scope, content_type_scope, gate_type, severity, evaluator,
        active, order_index, applies_when_json, pass_examples_json,
        fail_examples_json, source_memory_ids_json, created_from
      ) VALUES (?, 'manifest_mental', ?, 'Migration quality gate',
        'Preserve quality enforcement', 'draft', 'intuition', 'short_text',
        'model', 'blocking', 'model', 1, 25, ?, ?, ?, ?, 'migration_test')`,
    ).bind(
      gateId,
      gateKey,
      '{"requires_source_card":true}',
      '["preserves source payoff"]',
      '["invents a new premise"]',
      '["memory-quality-1"]',
    ).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_gate_results (
        id, brand_key, draft_id, source_card_id, gate_id, gate_key,
        result, blocking, rationale, evaluated_by, evidence_json,
        repair_guidance
      ) VALUES (?, 'manifest_mental', 'draft-quality', 'card-quality', ?, ?,
        'fail', 1, 'Migration rationale', 'model', ?, 'Restore source payoff')`,
    ).bind(gateResultId, gateId, gateKey, '{"missing":["payoff"]}').run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_content_inventory (
        id, brand_key, source_type, source_id, text, first_line,
        opening_phrase, realm_entrance_key, hook_style, lane_key,
        source_card_id, status, used_at, metadata_json
      ) VALUES (?, 'manifest_mental', 'scheduled_post', 'scheduled-quality',
        'Read this when your intuition feels loud.', 'Read this when your intuition feels loud.',
        'Read this when', 'read_this', 'direct_validation', 'intuition',
        'card-quality', 'scheduled', '2099-05-01T12:00:00.000Z', ?)`,
    ).bind(inventoryId, '{"fingerprint":"quality-migration"}').run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_workflow_requirements (
        id, brand_key, stage, required_sections_json, completion_rule,
        enforcement_type, active, version
      ) VALUES (?, 'manifest_mental', ?, ?, 'quality_complete', 'block', 1, 3)`,
    ).bind(requirementId, requirementStage, '["gate_results","content_inventory"]').run();

    await applyD1Migrations(
      testEnv.DB,
      testEnv.TEST_MIGRATIONS,
      "lensically_test_migrations",
    );

    const gate = await testEnv.DB.prepare(
      `SELECT lane_scope, content_type_scope, severity, applies_when_json,
              pass_examples_json, fail_examples_json, source_memory_ids_json
       FROM operator_gates WHERE id = ?`,
    ).bind(gateId).first<Record<string, unknown>>();
    const result = await testEnv.DB.prepare(
      `SELECT blocking, evidence_json, repair_guidance
       FROM operator_gate_results WHERE id = ?`,
    ).bind(gateResultId).first<Record<string, unknown>>();
    const inventory = await testEnv.DB.prepare(
      `SELECT opening_phrase, realm_entrance_key, hook_style, lane_key,
              source_card_id, metadata_json
       FROM operator_content_inventory WHERE id = ?`,
    ).bind(inventoryId).first<Record<string, unknown>>();
    const requirement = await testEnv.DB.prepare(
      `SELECT required_sections_json, completion_rule, enforcement_type,
              active, version
       FROM operator_workflow_requirements WHERE id = ?`,
    ).bind(requirementId).first<Record<string, unknown>>();

    expect(gate).toMatchObject({
      lane_scope: "intuition",
      content_type_scope: "short_text",
      severity: "blocking",
      applies_when_json: '{"requires_source_card":true}',
      pass_examples_json: '["preserves source payoff"]',
      fail_examples_json: '["invents a new premise"]',
      source_memory_ids_json: '["memory-quality-1"]',
    });
    expect(result).toMatchObject({
      blocking: 1,
      evidence_json: '{"missing":["payoff"]}',
      repair_guidance: "Restore source payoff",
    });
    expect(inventory).toMatchObject({
      opening_phrase: "Read this when",
      realm_entrance_key: "read_this",
      hook_style: "direct_validation",
      lane_key: "intuition",
      source_card_id: "card-quality",
      metadata_json: '{"fingerprint":"quality-migration"}',
    });
    expect(requirement).toMatchObject({
      required_sections_json: '["gate_results","content_inventory"]',
      completion_rule: "quality_complete",
      enforcement_type: "block",
      active: 1,
      version: 3,
    });
  });

  it("adopts the live quality enforcement schema without losing gate, evidence, inventory, or requirement state", async () => {
    const db = testEnv.QUALITY_UPGRADE_DB;
    await db.prepare(
      `CREATE TABLE operator_gates (
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
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_gate_results (
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
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_content_inventory (
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
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_workflow_requirements (
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
      )`,
    ).run();

    await db.prepare(
      `INSERT INTO operator_gates (
        id, brand_key, gate_key, display_name, description, stage_scope,
        lane_scope, content_type_scope, gate_type, severity, evaluator,
        active, order_index, applies_when_json, pass_examples_json,
        fail_examples_json, source_memory_ids_json, created_from
      ) VALUES (
        'live-quality-gate', NULL, 'source_fidelity', 'Source Fidelity',
        'Preserve the source contract', 'draft', NULL, NULL, 'model',
        'blocking', 'model', 1, 10, '{"source_card_required":true}',
        '["same payoff"]', '["new premise"]', '["memory-live"]', 'live_seed'
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_gate_results (
        id, brand_key, draft_id, source_card_id, gate_id, gate_key,
        result, blocking, rationale, evaluated_by, evidence_json,
        repair_guidance
      ) VALUES (
        'live-quality-result', 'manifest_mental', 'live-draft', 'live-card',
        'live-quality-gate', 'source_fidelity', 'fail', 1,
        'Live quality failure', 'model', '{"distance":0.9}',
        'Return to the source structure'
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_content_inventory (
        id, brand_key, source_type, source_id, text, first_line,
        opening_phrase, realm_entrance_key, hook_style, lane_key,
        source_card_id, status, used_at, metadata_json
      ) VALUES (
        'live-quality-inventory', 'manifest_mental', 'published_post',
        'live-post', 'Read this when your mind gets loud.',
        'Read this when your mind gets loud.', 'Read this when', 'read_this',
        'direct_validation', 'intuition', 'live-card', 'published',
        '2099-05-02T12:00:00.000Z', '{"fingerprint":"live-quality"}'
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_workflow_requirements (
        id, brand_key, stage, required_sections_json, completion_rule,
        enforcement_type, active, version
      ) VALUES (
        'live-quality-requirement', NULL, 'draft', '["gate_suite"]',
        'all_blocking_gates_pass', 'block', 1, 4
      )`,
    ).run();

    await applyD1Migrations(
      db,
      testEnv.TEST_MIGRATIONS,
      "lensically_quality_upgrade_migrations",
    );

    const gate = await db.prepare(
      `SELECT applies_when_json, pass_examples_json, fail_examples_json,
              source_memory_ids_json, order_index
       FROM operator_gates WHERE id = 'live-quality-gate'`,
    ).first<Record<string, unknown>>();
    const result = await db.prepare(
      `SELECT blocking, evidence_json, repair_guidance
       FROM operator_gate_results WHERE id = 'live-quality-result'`,
    ).first<Record<string, unknown>>();
    const inventory = await db.prepare(
      `SELECT opening_phrase, realm_entrance_key, hook_style, lane_key,
              source_card_id, metadata_json
       FROM operator_content_inventory WHERE id = 'live-quality-inventory'`,
    ).first<Record<string, unknown>>();
    const requirement = await db.prepare(
      `SELECT required_sections_json, completion_rule, enforcement_type,
              active, version
       FROM operator_workflow_requirements
       WHERE id = 'live-quality-requirement'`,
    ).first<Record<string, unknown>>();

    expect(gate).toMatchObject({
      applies_when_json: '{"source_card_required":true}',
      pass_examples_json: '["same payoff"]',
      fail_examples_json: '["new premise"]',
      source_memory_ids_json: '["memory-live"]',
      order_index: 10,
    });
    expect(result).toMatchObject({
      blocking: 1,
      evidence_json: '{"distance":0.9}',
      repair_guidance: "Return to the source structure",
    });
    expect(inventory).toMatchObject({
      opening_phrase: "Read this when",
      realm_entrance_key: "read_this",
      hook_style: "direct_validation",
      lane_key: "intuition",
      source_card_id: "live-card",
      metadata_json: '{"fingerprint":"live-quality"}',
    });
    expect(requirement).toMatchObject({
      required_sections_json: '["gate_suite"]',
      completion_rule: "all_blocking_gates_pass",
      enforcement_type: "block",
      active: 1,
      version: 4,
    });

    await expect(
      db.prepare(
        `INSERT INTO operator_gates (
          id, brand_key, gate_key, display_name, description, stage_scope,
          gate_type, severity, evaluator
        ) VALUES (
          'duplicate-quality-gate', NULL, 'source_fidelity', 'Duplicate',
          'Duplicate global scope', 'draft', 'model', 'blocking', 'model'
        )`,
      ).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    await expect(
      db.prepare(
        `INSERT INTO operator_workflow_requirements (
          id, brand_key, stage, required_sections_json, completion_rule,
          enforcement_type
        ) VALUES (
          'duplicate-quality-requirement', NULL, 'draft', '[]',
          'duplicate', 'block'
        )`,
      ).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

    it("preserves operator continuity and autonomy records across migration replay", async () => {
    const suffix = crypto.randomUUID();
    const brandKey = `continuity-${suffix}`;
    const sessionId = `session-${suffix}`;
    const continuityId = `continuity-ref-${suffix}`;
    const receiptKey = `receipt-${suffix}`;
    const revisionId = `mission-revision-${suffix}`;

    await testEnv.DB.prepare(
      `INSERT INTO operator_mcp_sessions (
        id, selected_brand_key, proceeded_at, expires_at
      ) VALUES (?, ?, '2099-06-01T12:00:00.000Z', '2099-06-02T12:00:00.000Z')`,
    ).bind(sessionId, brandKey).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_continuity_refs (
        id, kind, brand_key, workflow_session_id, continuation_choice,
        payload_json, expires_at
      ) VALUES (?, 'workflow', ?, 'workflow-continuity', 'resume', ?, 4102444800)`,
    ).bind(continuityId, brandKey, '{"checkpoint":"source_card"}').run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_operation_receipts (
        idempotency_key, brand_key, workflow_session_id, operation_type,
        tool_name, request_fingerprint, status, result_json
      ) VALUES (?, ?, 'workflow-continuity', 'schedule', 'schedule_approved_draft',
        'fingerprint-continuity', 'completed', ?)`,
    ).bind(receiptKey, brandKey, '{"scheduled_post_id":42}').run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_growth_missions (
        brand_key, contract_version, version, status, execution_mode,
        mission_json, diagnostic_json, owner_response, change_summary,
        approved_at, last_diagnostic_at
      ) VALUES (?, 'growth-mission-v3', 7, 'approved', 'autonomous_operator',
        ?, ?, 'approved by owner', 'continuity migration',
        '2099-06-01T12:05:00.000Z', '2099-06-01T12:04:00.000Z')`,
    ).bind(
      brandKey,
      '{"objective":"grow safely"}',
      '{"status":"healthy"}',
    ).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_growth_mission_revisions (
        id, brand_key, mission_version, status, execution_mode,
        mission_json, diagnostic_json, owner_response, change_summary
      ) VALUES (?, ?, 6, 'revision_required', 'autonomous_operator',
        ?, ?, 'revise scope', 'prior mission revision')`,
    ).bind(
      revisionId,
      brandKey,
      '{"objective":"prior objective"}',
      '{"status":"needs_revision"}',
    ).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_autonomy_profiles (
        brand_key, mode, objective, model_role, owner_role, approval_policy,
        operating_constraints_json, active, version
      ) VALUES (?, 'full_auto', 'Operate the account', 'operator', 'owner',
        'protected_only', ?, 1, 9)`,
    ).bind(
      brandKey,
      '{"hourly_coverage_required":true,"protected_operations_owner_ratified":true}',
    ).run();

    await applyD1Migrations(
      testEnv.DB,
      testEnv.TEST_MIGRATIONS,
      "lensically_test_migrations",
    );

    const session = await testEnv.DB.prepare(
      `SELECT selected_brand_key, proceeded_at, expires_at
       FROM operator_mcp_sessions WHERE id = ?`,
    ).bind(sessionId).first<Record<string, unknown>>();
    const continuity = await testEnv.DB.prepare(
      `SELECT kind, workflow_session_id, continuation_choice, payload_json, expires_at
       FROM operator_continuity_refs WHERE id = ?`,
    ).bind(continuityId).first<Record<string, unknown>>();
    const receipt = await testEnv.DB.prepare(
      `SELECT operation_type, tool_name, request_fingerprint, status, result_json
       FROM operator_operation_receipts WHERE idempotency_key = ?`,
    ).bind(receiptKey).first<Record<string, unknown>>();
    const mission = await testEnv.DB.prepare(
      `SELECT contract_version, version, status, execution_mode, mission_json,
              diagnostic_json, owner_response, change_summary, approved_at,
              last_diagnostic_at
       FROM operator_growth_missions WHERE brand_key = ?`,
    ).bind(brandKey).first<Record<string, unknown>>();
    const revision = await testEnv.DB.prepare(
      `SELECT mission_version, status, mission_json, diagnostic_json,
              owner_response, change_summary
       FROM operator_growth_mission_revisions WHERE id = ?`,
    ).bind(revisionId).first<Record<string, unknown>>();
    const autonomy = await testEnv.DB.prepare(
      `SELECT mode, objective, model_role, owner_role, approval_policy,
              operating_constraints_json, active, version
       FROM operator_autonomy_profiles WHERE brand_key = ?`,
    ).bind(brandKey).first<Record<string, unknown>>();

    expect(session).toMatchObject({
      selected_brand_key: brandKey,
      proceeded_at: "2099-06-01T12:00:00.000Z",
      expires_at: "2099-06-02T12:00:00.000Z",
    });
    expect(continuity).toMatchObject({
      kind: "workflow",
      workflow_session_id: "workflow-continuity",
      continuation_choice: "resume",
      payload_json: '{"checkpoint":"source_card"}',
      expires_at: 4102444800,
    });
    expect(receipt).toMatchObject({
      operation_type: "schedule",
      tool_name: "schedule_approved_draft",
      request_fingerprint: "fingerprint-continuity",
      status: "completed",
      result_json: '{"scheduled_post_id":42}',
    });
    expect(mission).toMatchObject({
      contract_version: "growth-mission-v3",
      version: 7,
      status: "approved",
      execution_mode: "autonomous_operator",
      mission_json: '{"objective":"grow safely"}',
      diagnostic_json: '{"status":"healthy"}',
      owner_response: "approved by owner",
      change_summary: "continuity migration",
      approved_at: "2099-06-01T12:05:00.000Z",
      last_diagnostic_at: "2099-06-01T12:04:00.000Z",
    });
    expect(revision).toMatchObject({
      mission_version: 6,
      status: "revision_required",
      mission_json: '{"objective":"prior objective"}',
      diagnostic_json: '{"status":"needs_revision"}',
      owner_response: "revise scope",
      change_summary: "prior mission revision",
    });
    expect(autonomy).toMatchObject({
      mode: "full_auto",
      objective: "Operate the account",
      model_role: "operator",
      owner_role: "owner",
      approval_policy: "protected_only",
      operating_constraints_json: '{"hourly_coverage_required":true,"protected_operations_owner_ratified":true}',
      active: 1,
      version: 9,
    });
  });

  it("adopts the live operator continuity schema without losing session, receipt, mission, revision, or autonomy state", async () => {
    const db = testEnv.CONTINUITY_UPGRADE_DB;
    await db.prepare(
      `CREATE TABLE operator_mcp_sessions (
        id TEXT PRIMARY KEY,
        selected_brand_key TEXT,
        proceeded_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_continuity_refs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        brand_key TEXT NOT NULL,
        workflow_session_id TEXT,
        continuation_choice TEXT,
        payload_json TEXT,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_operation_receipts (
        idempotency_key TEXT PRIMARY KEY,
        brand_key TEXT,
        workflow_session_id TEXT,
        operation_type TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        request_fingerprint TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'started',
        result_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_growth_missions (
        brand_key TEXT PRIMARY KEY,
        contract_version TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'discussion',
        execution_mode TEXT NOT NULL DEFAULT 'autonomous_operator',
        mission_json TEXT NOT NULL,
        diagnostic_json TEXT NOT NULL DEFAULT '{}',
        owner_response TEXT,
        change_summary TEXT,
        approved_at TEXT,
        last_diagnostic_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_growth_mission_revisions (
        id TEXT PRIMARY KEY,
        brand_key TEXT NOT NULL,
        mission_version INTEGER NOT NULL,
        status TEXT NOT NULL,
        execution_mode TEXT NOT NULL,
        mission_json TEXT NOT NULL,
        diagnostic_json TEXT NOT NULL,
        owner_response TEXT,
        change_summary TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_autonomy_profiles (
        brand_key TEXT PRIMARY KEY,
        mode TEXT NOT NULL,
        objective TEXT NOT NULL,
        model_role TEXT NOT NULL,
        owner_role TEXT NOT NULL,
        approval_policy TEXT NOT NULL,
        operating_constraints_json TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();

    await db.prepare(
      `INSERT INTO operator_mcp_sessions (
        id, selected_brand_key, proceeded_at, expires_at
      ) VALUES (
        'live-session', 'manifest_mental', '2099-06-03T12:00:00.000Z',
        '2099-06-04T12:00:00.000Z'
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_continuity_refs (
        id, kind, brand_key, workflow_session_id, continuation_choice,
        payload_json, expires_at
      ) VALUES (
        'live-continuity', 'workflow', 'manifest_mental', 'live-workflow',
        'resume', '{"checkpoint":"draft"}', 4102444800
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_operation_receipts (
        idempotency_key, brand_key, workflow_session_id, operation_type,
        tool_name, request_fingerprint, status, result_json
      ) VALUES (
        'live-receipt', 'manifest_mental', 'live-workflow', 'schedule',
        'schedule_approved_draft', 'live-fingerprint', 'completed',
        '{"scheduled_post_id":77}'
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_growth_missions (
        brand_key, contract_version, version, status, execution_mode,
        mission_json, diagnostic_json, owner_response, change_summary,
        approved_at, last_diagnostic_at
      ) VALUES (
        'manifest_mental', 'growth-mission-v4', 11, 'approved',
        'autonomous_operator', '{"objective":"live growth"}',
        '{"status":"live"}', 'live approval', 'live mission state',
        '2099-06-03T12:10:00.000Z', '2099-06-03T12:09:00.000Z'
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_growth_mission_revisions (
        id, brand_key, mission_version, status, execution_mode,
        mission_json, diagnostic_json, owner_response, change_summary
      ) VALUES (
        'live-mission-revision', 'manifest_mental', 10, 'revision_required',
        'autonomous_operator', '{"objective":"prior live growth"}',
        '{"status":"revise"}', 'live revise', 'live prior revision'
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_autonomy_profiles (
        brand_key, mode, objective, model_role, owner_role, approval_policy,
        operating_constraints_json, active, version
      ) VALUES (
        'manifest_mental', 'full_auto', 'Live autonomous operation',
        'operator', 'owner', 'protected_only',
        '{"full_auto_owner_authorized":true,"hourly_coverage_required":true}',
        1, 12
      )`,
    ).run();

    await applyD1Migrations(
      db,
      testEnv.TEST_MIGRATIONS,
      "lensically_continuity_upgrade_migrations",
    );

    const session = await db.prepare(
      `SELECT selected_brand_key, proceeded_at, expires_at
       FROM operator_mcp_sessions WHERE id = 'live-session'`,
    ).first<Record<string, unknown>>();
    const continuity = await db.prepare(
      `SELECT workflow_session_id, continuation_choice, payload_json, expires_at
       FROM operator_continuity_refs WHERE id = 'live-continuity'`,
    ).first<Record<string, unknown>>();
    const receipt = await db.prepare(
      `SELECT request_fingerprint, status, result_json
       FROM operator_operation_receipts WHERE idempotency_key = 'live-receipt'`,
    ).first<Record<string, unknown>>();
    const mission = await db.prepare(
      `SELECT contract_version, version, status, mission_json, diagnostic_json,
              owner_response, change_summary, approved_at, last_diagnostic_at
       FROM operator_growth_missions WHERE brand_key = 'manifest_mental'`,
    ).first<Record<string, unknown>>();
    const revision = await db.prepare(
      `SELECT mission_version, status, mission_json, diagnostic_json,
              owner_response, change_summary
       FROM operator_growth_mission_revisions WHERE id = 'live-mission-revision'`,
    ).first<Record<string, unknown>>();
    const autonomy = await db.prepare(
      `SELECT mode, objective, approval_policy, operating_constraints_json,
              active, version
       FROM operator_autonomy_profiles WHERE brand_key = 'manifest_mental'`,
    ).first<Record<string, unknown>>();

    expect(session).toMatchObject({
      selected_brand_key: "manifest_mental",
      proceeded_at: "2099-06-03T12:00:00.000Z",
      expires_at: "2099-06-04T12:00:00.000Z",
    });
    expect(continuity).toMatchObject({
      workflow_session_id: "live-workflow",
      continuation_choice: "resume",
      payload_json: '{"checkpoint":"draft"}',
      expires_at: 4102444800,
    });
    expect(receipt).toMatchObject({
      request_fingerprint: "live-fingerprint",
      status: "completed",
      result_json: '{"scheduled_post_id":77}',
    });
    expect(mission).toMatchObject({
      contract_version: "growth-mission-v4",
      version: 11,
      status: "approved",
      mission_json: '{"objective":"live growth"}',
      diagnostic_json: '{"status":"live"}',
      owner_response: "live approval",
      change_summary: "live mission state",
      approved_at: "2099-06-03T12:10:00.000Z",
      last_diagnostic_at: "2099-06-03T12:09:00.000Z",
    });
    expect(revision).toMatchObject({
      mission_version: 10,
      status: "revision_required",
      mission_json: '{"objective":"prior live growth"}',
      diagnostic_json: '{"status":"revise"}',
      owner_response: "live revise",
      change_summary: "live prior revision",
    });
    expect(autonomy).toMatchObject({
      mode: "full_auto",
      objective: "Live autonomous operation",
      approval_policy: "protected_only",
      operating_constraints_json: '{"full_auto_owner_authorized":true,"hourly_coverage_required":true}',
      active: 1,
      version: 12,
    });

    await expect(
      db.prepare(
        `INSERT INTO operator_operation_receipts (
          idempotency_key, operation_type, tool_name, request_fingerprint
        ) VALUES ('live-receipt', 'duplicate', 'duplicate', 'duplicate')`,
      ).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

    it("preserves autonomous cycle and protected decision records across migration replay", async () => {
    const suffix = crypto.randomUUID();
    const cycleId = `cycle-${suffix}`;
    const operationId = `operation-${suffix}`;
    const lineupId = `lineup-${suffix}`;
    const decisionId = `decision-${suffix}`;
    const decisionKey = `decision-key-${suffix}`;
    const eventId = `decision-event-${suffix}`;

    await testEnv.DB.prepare(
      `INSERT INTO operator_autonomous_growth_cycles (
        id, brand_key, operation_id, engine_version, status, timezone, horizon_hours,
        horizon_start_local, horizon_end_local, target_slots_json, missing_slots_json,
        account_position_json, strategic_thesis_json, scheduled_post_ids_json,
        receipt_id, strategy_version_id, exposure_snapshot_id, evidence_snapshot_id,
        cycle_strategy_id
      ) VALUES (?, 'manifest_mental', ?, 'engine-v1', 'prepared', 'America/New_York', 24,
        '2099-01-01T00:00', '2099-01-02T00:00', '["2099-01-01-01"]',
        '["2099-01-01-01"]', '{"followers":1000}', '{"focus":"quality"}', '[]',
        'receipt-1', 'strategy-1', 'exposure-1', 'evidence-1', 'cycle-strategy-1')`,
    ).bind(cycleId, operationId).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_autonomous_lineup_items (
        id, cycle_id, brand_key, slot_key, slot_date, slot_time, text,
        generation_mode, family_key, strategic_purpose, strategy_json,
        cycle_strategy_id, cycle_plan_item_id, gate_receipt_id, source_card_id,
        source_selection_id, hypothesis_id, generation_run_id, draft_id,
        scheduled_post_id, status
      ) VALUES (?, ?, 'manifest_mental', '2099-01-01-01', '2099-01-01', '01:00',
        'Cycle fixture', 'source_backed', 'family-1', 'coverage', '{"lane":"primary"}',
        'cycle-strategy-1', 'plan-1', 'gate-1', 'source-card-1', 'selection-1',
        'hypothesis-1', 'run-1', 'draft-1', 99, 'scheduled')`,
    ).bind(lineupId, cycleId).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_decision_proposals (
        id, brand_key, decision_key, category, title, decision_text, rationale,
        evidence_json, expected_outcome, risks_json, reversibility, execution_plan,
        authorized_tools_json, execution_budget_json, status, proposed_by,
        owner_response, outcome_summary, result_evidence_json
      ) VALUES (?, 'manifest_mental', ?, 'routine_operation', 'Fixture decision',
        'Execute fixture', 'Evidence supports it', '["evidence-1"]', 'Safe result',
        '["low-risk"]', 'reversible', 'Run one tool', '["fixture_tool"]',
        '{"fixture_tool":1}', 'executed', 'model', 'approved', 'Completed',
        '["result-1"]')`,
    ).bind(decisionId, decisionKey).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_decision_execution_events (
        id, decision_id, brand_key, tool_name, operation_id, request_fingerprint,
        status, result_summary, completed_at
      ) VALUES (?, ?, 'manifest_mental', 'fixture_tool', ?, 'fingerprint-1',
        'completed', 'Fixture completed', CURRENT_TIMESTAMP)`,
    ).bind(eventId, decisionId, operationId).run();

    await applyD1Migrations(
      testEnv.DB,
      testEnv.TEST_MIGRATIONS,
      "lensically_test_migrations",
    );

    const counts = await Promise.all([
      countWhere("SELECT COUNT(*) AS total FROM operator_autonomous_growth_cycles WHERE id = ?", cycleId),
      countWhere("SELECT COUNT(*) AS total FROM operator_autonomous_lineup_items WHERE id = ?", lineupId),
      countWhere("SELECT COUNT(*) AS total FROM operator_decision_proposals WHERE id = ?", decisionId),
      countWhere("SELECT COUNT(*) AS total FROM operator_decision_execution_events WHERE id = ?", eventId),
    ]);
    expect(counts).toEqual([1, 1, 1, 1]);
  });

  it("adopts the live autonomous cycle and protected decision schema without losing lineage or budgets", async () => {
    const db = testEnv.CYCLE_DECISION_UPGRADE_DB;
    await db.prepare(
      `CREATE TABLE operator_autonomous_growth_cycles (
        id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, operation_id TEXT NOT NULL,
        engine_version TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'prepared',
        timezone TEXT NOT NULL, horizon_hours INTEGER NOT NULL,
        horizon_start_local TEXT NOT NULL, horizon_end_local TEXT NOT NULL,
        target_slots_json TEXT NOT NULL, missing_slots_json TEXT NOT NULL,
        account_position_json TEXT NOT NULL, strategic_thesis_json TEXT,
        scheduled_post_ids_json TEXT NOT NULL DEFAULT '[]', error_json TEXT,
        receipt_id TEXT, strategy_version_id TEXT, exposure_snapshot_id TEXT,
        evidence_snapshot_id TEXT, cycle_strategy_id TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(brand_key, operation_id)
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_autonomous_lineup_items (
        id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL, brand_key TEXT NOT NULL,
        slot_key TEXT NOT NULL, slot_date TEXT NOT NULL, slot_time TEXT NOT NULL,
        text TEXT NOT NULL, generation_mode TEXT NOT NULL, family_key TEXT NOT NULL,
        strategic_purpose TEXT NOT NULL, strategy_json TEXT NOT NULL,
        cycle_strategy_id TEXT, cycle_plan_item_id TEXT, gate_receipt_id TEXT,
        source_card_id TEXT, source_selection_id TEXT, hypothesis_id TEXT,
        generation_run_id TEXT, draft_id TEXT, scheduled_post_id INTEGER,
        status TEXT NOT NULL DEFAULT 'planned', owner_feedback TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(cycle_id, slot_key)
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_decision_proposals (
        id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, decision_key TEXT NOT NULL,
        category TEXT NOT NULL, title TEXT NOT NULL, decision_text TEXT NOT NULL,
        rationale TEXT NOT NULL, evidence_json TEXT NOT NULL,
        expected_outcome TEXT NOT NULL, risks_json TEXT NOT NULL,
        reversibility TEXT NOT NULL, execution_plan TEXT NOT NULL,
        authorized_tools_json TEXT NOT NULL, execution_budget_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'proposed', proposed_by TEXT NOT NULL DEFAULT 'model',
        owner_response TEXT, revision_request TEXT, outcome_summary TEXT,
        result_evidence_json TEXT, supersedes_decision_id TEXT, approved_at TEXT,
        rejected_at TEXT, executed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_decision_execution_events (
        id TEXT PRIMARY KEY, decision_id TEXT NOT NULL, brand_key TEXT NOT NULL,
        tool_name TEXT NOT NULL, operation_id TEXT, request_fingerprint TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'started', result_summary TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT
      )`,
    ).run();

    await db.prepare(
      `INSERT INTO operator_autonomous_growth_cycles (
        id, brand_key, operation_id, engine_version, timezone, horizon_hours,
        horizon_start_local, horizon_end_local, target_slots_json, missing_slots_json,
        account_position_json, cycle_strategy_id
      ) VALUES ('live-cycle', 'manifest_mental', 'live-operation', 'engine-v1',
        'America/New_York', 24, '2099-02-01T00:00', '2099-02-02T00:00', '[]', '[]',
        '{"followers":2000}', 'live-cycle-strategy')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_autonomous_lineup_items (
        id, cycle_id, brand_key, slot_key, slot_date, slot_time, text,
        generation_mode, family_key, strategic_purpose, strategy_json,
        cycle_strategy_id, cycle_plan_item_id, gate_receipt_id, source_selection_id,
        hypothesis_id
      ) VALUES ('live-lineup', 'live-cycle', 'manifest_mental', '2099-02-01-01',
        '2099-02-01', '01:00', 'Live lineup', 'source_backed', 'family-live',
        'coverage', '{"lane":"primary"}', 'live-cycle-strategy', 'live-plan',
        'live-gate', 'live-selection', 'live-hypothesis')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_decision_proposals (
        id, brand_key, decision_key, category, title, decision_text, rationale,
        evidence_json, expected_outcome, risks_json, reversibility, execution_plan,
        authorized_tools_json, execution_budget_json
      ) VALUES ('live-decision', 'manifest_mental', 'live-decision-key',
        'routine_operation', 'Live decision', 'Execute', 'Evidence', '[]', 'Result',
        '[]', 'reversible', 'Plan', '["fixture_tool"]', '{"fixture_tool":1}')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_decision_execution_events (
        id, decision_id, brand_key, tool_name, operation_id, request_fingerprint
      ) VALUES ('live-event', 'live-decision', 'manifest_mental', 'fixture_tool',
        'live-operation', 'live-fingerprint')`,
    ).run();

    await applyD1Migrations(
      db,
      testEnv.TEST_MIGRATIONS,
      "lensically_cycle_decision_upgrade_migrations",
    );

    const preserved = await Promise.all([
      db.prepare("SELECT COUNT(*) AS total FROM operator_autonomous_growth_cycles WHERE id = 'live-cycle'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_autonomous_lineup_items WHERE id = 'live-lineup'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_decision_proposals WHERE id = 'live-decision'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_decision_execution_events WHERE id = 'live-event'").first<CountRow>(),
    ]);
    expect(preserved.map((row) => Number(row?.total ?? 0))).toEqual([1, 1, 1, 1]);

    await expect(
      db.prepare(
        `INSERT INTO operator_autonomous_growth_cycles (
          id, brand_key, operation_id, engine_version, timezone, horizon_hours,
          horizon_start_local, horizon_end_local, target_slots_json, missing_slots_json,
          account_position_json
        ) VALUES ('duplicate-cycle', 'manifest_mental', 'live-operation', 'engine-v1',
          'America/New_York', 24, '2099-02-01T00:00', '2099-02-02T00:00', '[]', '[]', '{}')`,
      ).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    await expect(
      db.prepare(
        `INSERT INTO operator_decision_proposals (
          id, brand_key, decision_key, category, title, decision_text, rationale,
          evidence_json, expected_outcome, risks_json, reversibility, execution_plan,
          authorized_tools_json, execution_budget_json
        ) VALUES ('duplicate-decision', 'manifest_mental', 'live-decision-key',
          'routine_operation', 'Duplicate', 'Execute', 'Evidence', '[]', 'Result',
          '[]', 'reversible', 'Plan', '[]', '{}')`,
      ).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

    it("preserves operational assurance records across migration replay", async () => {
    const suffix = crypto.randomUUID();
    const operationalId = `operational-${suffix}`;
    const auditId = `audit-${suffix}`;
    const hardeningId = `hardening-${suffix}`;
    const eventId = `hardening-event-${suffix}`;
    const observationId = `observation-${suffix}`;

    await testEnv.DB.prepare(
      `INSERT INTO operator_operational_incidents (
        id, brand_key, incident_key, incident_type, severity, status,
        required_recovery_action, evidence_json
      ) VALUES (?, 'manifest_mental', ?, 'delivery_failure', 'critical', 'open',
        'repair_delivery', '{"post_id":99}')`,
    ).bind(operationalId, `incident-${suffix}`).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_engineering_audit (
        id, action, files_changed_json, diff_summary, tests_run_json, result,
        deployment_id, metadata_json
      ) VALUES (?, 'migration_fixture', '["src/index.ts"]', 'Fixture change',
        '["databaseMigrations.spec.ts"]', 'passed', 'deployment-1', '{"sha":"abc"}')`,
    ).bind(auditId).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_hardening_incidents (
        id, signature, boundary, severity, classification, state, affected_scope,
        blocked_tool_name, request_fingerprint, expected_json, observed_json,
        side_effect_state, root_cause, generalized_cause, prevention_rule_id,
        regression_test_ids_json, tested_sha, deployment_id, live_verification_json,
        resume_capsule_json, resume_result_json, autonomy_dividend_json,
        efficiency_result_json
      ) VALUES (?, ?, 'tool_boundary', 'high', 'schema_drift', 'verified', 'objective',
        'fixture_tool', 'fingerprint-1', '{"expected":true}', '{"observed":true}',
        'none', 'Fixture cause', 'Fixture generalized cause', 'rule-1', '["test-1"]',
        'abc123', 'deployment-1', '{"live":true}', '{"resume":"next"}',
        '{"resumed":true}', '{"calls_saved":2}', '{"duration_ms":10}')`,
    ).bind(hardeningId, `signature-${suffix}`).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_hardening_incident_events (
        id, incident_id, from_state, to_state, evidence_json
      ) VALUES (?, ?, 'detected', 'verified', '{"test":"passed"}')`,
    ).bind(eventId, hardeningId).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_operational_observations (
        id, operation_id, incident_id, profile_id, capability, outcome,
        duration_ms, call_count, external_requests, repeated_fingerprint_count,
        progress_checkpoint, metadata_json
      ) VALUES (?, 'operation-1', ?, 'profile-1', 'fixture_capability', 'success',
        10, 2, 1, 0, 'verified', '{"bounded":true}')`,
    ).bind(observationId, hardeningId).run();

    await applyD1Migrations(
      testEnv.DB,
      testEnv.TEST_MIGRATIONS,
      "lensically_test_migrations",
    );

    const counts = await Promise.all([
      countWhere("SELECT COUNT(*) AS total FROM operator_operational_incidents WHERE id = ?", operationalId),
      countWhere("SELECT COUNT(*) AS total FROM operator_engineering_audit WHERE id = ?", auditId),
      countWhere("SELECT COUNT(*) AS total FROM operator_hardening_incidents WHERE id = ?", hardeningId),
      countWhere("SELECT COUNT(*) AS total FROM operator_hardening_incident_events WHERE id = ?", eventId),
      countWhere("SELECT COUNT(*) AS total FROM operator_operational_observations WHERE id = ?", observationId),
    ]);
    expect(counts).toEqual([1, 1, 1, 1, 1]);
  });

  it("adopts the live assurance schema without losing incidents, audit receipts, events, or observations", async () => {
    const db = testEnv.ASSURANCE_UPGRADE_DB;
    await db.prepare(
      `CREATE TABLE operator_operational_incidents (
        id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, incident_key TEXT NOT NULL,
        incident_type TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'critical',
        status TEXT NOT NULL DEFAULT 'open', scheduled_post_id INTEGER,
        production_date TEXT, scheduled_time TEXT, observed_status TEXT,
        delivery_state TEXT, published_post_id TEXT, publish_error_message TEXT,
        last_attempted_at TEXT, required_recovery_action TEXT NOT NULL,
        evidence_json TEXT, opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT,
        resolution_note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(brand_key, incident_key)
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_engineering_audit (
        id TEXT PRIMARY KEY, action TEXT NOT NULL, files_changed_json TEXT,
        diff_summary TEXT, tests_run_json TEXT, result TEXT NOT NULL,
        deployment_id TEXT, rollback_target TEXT, owner_approval TEXT,
        metadata_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_hardening_incidents (
        id TEXT PRIMARY KEY, signature TEXT NOT NULL, boundary TEXT NOT NULL,
        severity TEXT NOT NULL, classification TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'detected', affected_scope TEXT NOT NULL DEFAULT 'objective',
        blocked_profile_id TEXT, blocked_tool_name TEXT, request_fingerprint TEXT,
        expected_json TEXT, observed_json TEXT,
        side_effect_state TEXT NOT NULL DEFAULT 'not_applicable', root_cause TEXT,
        generalized_cause TEXT, prevention_rule_id TEXT, regression_test_ids_json TEXT,
        tested_sha TEXT, deployment_id TEXT, live_verification_json TEXT,
        resume_capsule_json TEXT, resume_result_json TEXT, autonomy_dividend_json TEXT,
        efficiency_result_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, closed_at TEXT
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_hardening_incident_events (
        id TEXT PRIMARY KEY, incident_id TEXT NOT NULL, from_state TEXT,
        to_state TEXT NOT NULL, evidence_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_operational_observations (
        id TEXT PRIMARY KEY, operation_id TEXT, incident_id TEXT, profile_id TEXT,
        capability TEXT, outcome TEXT NOT NULL, duration_ms INTEGER, call_count INTEGER,
        external_requests INTEGER, repeated_fingerprint_count INTEGER,
        progress_checkpoint TEXT, metadata_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();

    await db.prepare(
      `INSERT INTO operator_operational_incidents (
        id, brand_key, incident_key, incident_type, required_recovery_action
      ) VALUES ('live-operational', 'manifest_mental', 'live-key', 'delivery_failure', 'repair')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_engineering_audit (id, action, result)
       VALUES ('live-audit', 'deploy', 'passed')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_hardening_incidents (
        id, signature, boundary, severity, classification, state
      ) VALUES ('live-hardening', 'live-signature', 'tool_boundary', 'high', 'schema_drift', 'verified')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_hardening_incident_events (id, incident_id, to_state)
       VALUES ('live-event', 'live-hardening', 'verified')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_operational_observations (id, incident_id, capability, outcome)
       VALUES ('live-observation', 'live-hardening', 'fixture_capability', 'success')`,
    ).run();

    await applyD1Migrations(
      db,
      testEnv.TEST_MIGRATIONS,
      "lensically_assurance_upgrade_migrations",
    );

    const preserved = await Promise.all([
      db.prepare("SELECT COUNT(*) AS total FROM operator_operational_incidents WHERE id = 'live-operational'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_engineering_audit WHERE id = 'live-audit'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_hardening_incidents WHERE id = 'live-hardening'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_hardening_incident_events WHERE id = 'live-event'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_operational_observations WHERE id = 'live-observation'").first<CountRow>(),
    ]);
    expect(preserved.map((row) => Number(row?.total ?? 0))).toEqual([1, 1, 1, 1, 1]);

    await expect(
      db.prepare(
        `INSERT INTO operator_operational_incidents (
          id, brand_key, incident_key, incident_type, required_recovery_action
        ) VALUES ('duplicate-operational', 'manifest_mental', 'live-key', 'delivery_failure', 'repair')`,
      ).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    await expect(
      db.prepare(
        `INSERT INTO operator_hardening_incidents (
          id, signature, boundary, severity, classification, state
        ) VALUES ('duplicate-hardening', 'live-signature', 'tool_boundary', 'high', 'schema_drift', 'detected')`,
      ).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

    it("preserves durable work state, ledger, and repo-write sessions across migration replay", async () => {
    const suffix = crypto.randomUUID();
    const workKey = `work-${suffix}`;
    const writeSessionId = `write-${suffix}`;

    await testEnv.DB.prepare(
      `INSERT OR REPLACE INTO operator_work_state (
        id, contract_version, policy_version, role, active_outcome_key,
        active_outcome_title, active_scope_json, status, scope_frozen,
        active_interrupt_key, next_action, completion_evidence_json
      ) VALUES ('singleton', 'contract-v1', 'policy-v1', 'Autonomous Operator',
        'outcome-1', 'Complete migration', '{"scope":["database"]}', 'active', 1,
        'interrupt-1', 'Run validation', '["migration preserved"]')`,
    ).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_work_ledger (
        id, work_key, title, summary, priority, status, intake_decision,
        intake_reason, required_for_active_outcome, dependencies_json,
        completion_condition, execution_order, evidence_json
      ) VALUES (?, ?, 'Fixture work', 'Preserve durable work', 'P1', 'executing',
        'activate', 'required_prerequisite', 1, '["dependency-1"]',
        'Migration passes', 10, '["evidence-1"]')`,
    ).bind(`ledger-${suffix}`, workKey).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_repo_write_sessions (
        id, path, mode, message, summary, content, status
      ) VALUES (?, 'ENGINEERING_CONTINUATION.md', 'replace', 'Fixture write',
        'Preserve session', 'fixture content', 'open')`,
    ).bind(writeSessionId).run();

    await applyD1Migrations(
      testEnv.DB,
      testEnv.TEST_MIGRATIONS,
      "lensically_test_migrations",
    );

    const counts = await Promise.all([
      countWhere("SELECT COUNT(*) AS total FROM operator_work_state WHERE id = 'singleton' AND next_action = 'Run validation'"),
      countWhere("SELECT COUNT(*) AS total FROM operator_work_ledger WHERE work_key = ?", workKey),
      countWhere("SELECT COUNT(*) AS total FROM operator_repo_write_sessions WHERE id = ? AND content = 'fixture content'", writeSessionId),
      countWhere("SELECT COUNT(*) AS total FROM operator_system_retirements WHERE retirement_key = 'human-free-retirement-v2'"),
    ]);
    expect(counts).toEqual([1, 1, 1, 1]);
  });

  it("adopts the live durable work schema and completes legacy retirements without data loss", async () => {
    const db = testEnv.WORK_STATE_UPGRADE_DB;
    await db.prepare(
      `CREATE TABLE operator_work_state (
        id TEXT PRIMARY KEY CHECK (id = 'singleton'), contract_version TEXT NOT NULL,
        policy_version TEXT NOT NULL, role TEXT NOT NULL, active_outcome_key TEXT NOT NULL,
        active_outcome_title TEXT NOT NULL, active_scope_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active', scope_frozen INTEGER NOT NULL DEFAULT 1,
        active_interrupt_key TEXT, next_action TEXT NOT NULL,
        completion_evidence_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_work_ledger (
        id TEXT PRIMARY KEY, work_key TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
        summary TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL,
        intake_decision TEXT NOT NULL, intake_reason TEXT NOT NULL,
        required_for_active_outcome INTEGER NOT NULL DEFAULT 0,
        dependencies_json TEXT NOT NULL DEFAULT '[]', completion_condition TEXT NOT NULL,
        execution_order INTEGER NOT NULL DEFAULT 1000, evidence_json TEXT NOT NULL DEFAULT '[]',
        merged_into_work_key TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_repo_write_sessions (
        id TEXT PRIMARY KEY, path TEXT NOT NULL, mode TEXT NOT NULL,
        message TEXT NOT NULL, summary TEXT, content TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_system_retirements (
        retirement_key TEXT PRIMARY KEY,
        completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    for (const table of [
      "operator_workflow_sessions",
      "operator_context_admissions",
      "operator_production_board_items",
      "operator_review_batches",
      "agent_account_controls",
      "operator_local_execution_nodes",
      "operator_local_execution_jobs",
      "operator_local_validation_receipts",
      "operator_validation_plane_events",
      "operator_local_execution_enrollment_tokens",
    ]) {
      await db.prepare(`CREATE TABLE ${table} (id TEXT PRIMARY KEY)`).run();
    }

    await db.prepare(
      `INSERT INTO operator_work_state (
        id, contract_version, policy_version, role, active_outcome_key,
        active_outcome_title, active_scope_json, next_action, completion_evidence_json
      ) VALUES ('singleton', 'live-contract', 'live-policy', 'Live Operator',
        'live-outcome', 'Live outcome', '{"live":true}', 'Continue live work', '["live-evidence"]')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_work_ledger (
        id, work_key, title, summary, priority, status, intake_decision,
        intake_reason, required_for_active_outcome, dependencies_json,
        completion_condition, execution_order, evidence_json
      ) VALUES ('live-ledger', 'live-work', 'Live work', 'Preserve this row', 'P1',
        'executing', 'activate', 'required', 1, '["live-dependency"]',
        'Complete safely', 5, '["live-evidence"]')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_repo_write_sessions (
        id, path, mode, message, summary, content, status
      ) VALUES ('live-write', 'src/index.ts', 'replace', 'Live write',
        'Preserve write session', 'live-content', 'open')`,
    ).run();

    await applyD1Migrations(
      db,
      testEnv.TEST_MIGRATIONS,
      "lensically_work_state_upgrade_migrations",
    );

    const preserved = await Promise.all([
      db.prepare("SELECT COUNT(*) AS total FROM operator_work_state WHERE id = 'singleton' AND next_action = 'Continue live work'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_work_ledger WHERE work_key = 'live-work'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_repo_write_sessions WHERE id = 'live-write' AND content = 'live-content'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_system_retirements WHERE retirement_key = 'human-free-retirement-v2'").first<CountRow>(),
    ]);
    expect(preserved.map((row) => Number(row?.total ?? 0))).toEqual([1, 1, 1, 1]);

    for (const table of [
      "operator_workflow_sessions",
      "operator_context_admissions",
      "operator_production_board_items",
      "operator_review_batches",
      "agent_account_controls",
      "operator_local_execution_nodes",
      "operator_local_execution_jobs",
      "operator_local_validation_receipts",
      "operator_validation_plane_events",
      "operator_local_execution_enrollment_tokens",
    ]) {
      const retired = await db.prepare(
        "SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name = ?",
      ).bind(table).first<CountRow>();
      expect(Number(retired?.total ?? 0)).toBe(0);
    }

    await expect(
      db.prepare(
        `INSERT INTO operator_work_ledger (
          id, work_key, title, summary, priority, status, intake_decision,
          intake_reason, completion_condition
        ) VALUES ('duplicate-ledger', 'live-work', 'Duplicate', 'Duplicate', 'P2',
          'queued', 'defer', 'duplicate', 'Never inserts')`,
      ).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    await expect(
      db.prepare(
        `INSERT INTO operator_work_state (
          id, contract_version, policy_version, role, active_outcome_key,
          active_outcome_title, active_scope_json, next_action
        ) VALUES ('not-singleton', 'v1', 'v1', 'Operator', 'outcome',
          'Outcome', '{}', 'Next')`,
      ).run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

    it("preserves execution checkpoints, persistent routes, and decision events across migration replay", async () => {
    const suffix = crypto.randomUUID();
    const checkpointId = `checkpoint-${suffix}`;
    const operationId = `operation-${suffix}`;
    const routeId = `route-${suffix}`;
    const routeKey = `route-key-${suffix}`;
    const eventId = `execution-event-${suffix}`;

    await testEnv.DB.prepare(
      `INSERT INTO operator_manifest_prepare_checkpoints (
        id, brand_key, operation_id, checkpoint_version, phase, timezone,
        horizon_hours, state_json
      ) VALUES (?, 'manifest_mental', ?, 'checkpoint-v1', 'evidence_ready',
        'America/New_York', 24, '{"page":2}')`,
    ).bind(checkpointId, operationId).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_pre_call_routes (
        id, route_key, provider, tool_name, operation_key, match_json, action,
        required_tool, mandatory_route, argument_patch_json,
        allowed_argument_keys_json, reason, verification_summary, priority, active
      ) VALUES (?, ?, 'lensically', 'searchRepoFiles', 'repository_search',
        '{"prefix":{"$exists":true}}', 'apply', 'searchRepoFiles', 'main_gateway',
        '{"limit":20}', '["query","prefix","limit"]', 'Use bounded search',
        'Route verified', 10, 1)`,
    ).bind(routeId, routeKey).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_execution_events (
        id, brand_key, tool_name, operation_class, execution_plane,
        policy_version, decision, known_failure_prevented, evidence_json
      ) VALUES (?, 'manifest_mental', 'searchRepoFiles', 'read', 'main',
        'policy-v1', 'allowed', 1, '{"canonical_fingerprint":"fingerprint-1"}')`,
    ).bind(eventId).run();

    await applyD1Migrations(
      testEnv.DB,
      testEnv.TEST_MIGRATIONS,
      "lensically_test_migrations",
    );

    const counts = await Promise.all([
      countWhere("SELECT COUNT(*) AS total FROM operator_manifest_prepare_checkpoints WHERE id = ? AND state_json = '{\"page\":2}'", checkpointId),
      countWhere("SELECT COUNT(*) AS total FROM operator_pre_call_routes WHERE route_key = ? AND priority = 10", routeKey),
      countWhere("SELECT COUNT(*) AS total FROM operator_execution_events WHERE id = ? AND known_failure_prevented = 1", eventId),
    ]);
    expect(counts).toEqual([1, 1, 1]);
  });

  it("adopts the live execution-control schema without losing checkpoints, routes, or events", async () => {
    const db = testEnv.EXECUTION_CONTROL_UPGRADE_DB;
    await db.prepare(
      `CREATE TABLE operator_manifest_prepare_checkpoints (
        id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, operation_id TEXT NOT NULL,
        checkpoint_version TEXT NOT NULL, phase TEXT NOT NULL, timezone TEXT NOT NULL,
        horizon_hours INTEGER NOT NULL, state_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(brand_key, operation_id)
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_pre_call_routes (
        id TEXT PRIMARY KEY, route_key TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL DEFAULT 'lensically', tool_name TEXT NOT NULL,
        operation_key TEXT NOT NULL DEFAULT '*', match_json TEXT NOT NULL DEFAULT '{}',
        action TEXT NOT NULL DEFAULT 'apply', required_tool TEXT,
        mandatory_route TEXT NOT NULL, argument_patch_json TEXT NOT NULL DEFAULT '{}',
        allowed_argument_keys_json TEXT, reason TEXT NOT NULL,
        verification_summary TEXT NOT NULL, source_memory_id TEXT,
        priority INTEGER NOT NULL DEFAULT 100, active INTEGER NOT NULL DEFAULT 1,
        expires_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_execution_events (
        id TEXT PRIMARY KEY, brand_key TEXT, workflow_session_id TEXT,
        tool_name TEXT NOT NULL, operation_class TEXT NOT NULL,
        execution_plane TEXT NOT NULL, policy_version TEXT NOT NULL,
        decision TEXT NOT NULL, known_failure_prevented INTEGER NOT NULL DEFAULT 0,
        evidence_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();

    await db.prepare(
      `INSERT INTO operator_manifest_prepare_checkpoints (
        id, brand_key, operation_id, checkpoint_version, phase, timezone,
        horizon_hours, state_json
      ) VALUES ('live-checkpoint', 'manifest_mental', 'live-operation', 'checkpoint-v1',
        'coverage_ready', 'America/New_York', 48, '{"slots":48}')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_pre_call_routes (
        id, route_key, tool_name, mandatory_route, reason, verification_summary
      ) VALUES ('live-route', 'live-route-key', 'readRepoFile', 'main_gateway',
        'Use canonical reader', 'Live route verified')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_execution_events (
        id, tool_name, operation_class, execution_plane, policy_version,
        decision, evidence_json
      ) VALUES ('live-event', 'readRepoFile', 'read', 'main', 'policy-v1',
        'allowed', '{"runtime_commit_sha":"live-sha"}')`,
    ).run();

    await applyD1Migrations(
      db,
      testEnv.TEST_MIGRATIONS,
      "lensically_execution_control_upgrade_migrations",
    );

    const preserved = await Promise.all([
      db.prepare("SELECT COUNT(*) AS total FROM operator_manifest_prepare_checkpoints WHERE id = 'live-checkpoint' AND state_json = '{\"slots\":48}'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_pre_call_routes WHERE route_key = 'live-route-key'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_execution_events WHERE id = 'live-event'").first<CountRow>(),
    ]);
    expect(preserved.map((row) => Number(row?.total ?? 0))).toEqual([1, 1, 1]);

    await expect(
      db.prepare(
        `INSERT INTO operator_manifest_prepare_checkpoints (
          id, brand_key, operation_id, checkpoint_version, phase, timezone,
          horizon_hours
        ) VALUES ('duplicate-checkpoint', 'manifest_mental', 'live-operation',
          'checkpoint-v1', 'duplicate', 'America/New_York', 24)`,
      ).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    await expect(
      db.prepare(
        `INSERT INTO operator_pre_call_routes (
          id, route_key, tool_name, mandatory_route, reason, verification_summary
        ) VALUES ('duplicate-route', 'live-route-key', 'searchRepoFiles',
          'main_gateway', 'Duplicate', 'Duplicate')`,
      ).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

    it("preserves performance learning and content focus state across migration replay", async () => {
    const suffix = crypto.randomUUID();
    const postId = `post-${suffix}`;
    const familyId = `family-${suffix}`;

    await testEnv.DB.prepare(
      `INSERT INTO operator_post_fingerprints (
        id, brand_key, published_post_id, scheduled_post_id, draft_id, source_card_id,
        source_selection_id, text_hash, fingerprint_version, fingerprint_json
      ) VALUES (?, 'manifest_mental', ?, 1, 'draft-1', 'source-card-1',
        'selection-1', 'hash-1', 'fingerprint-v1', '{"hook_style":"question"}')`,
    ).bind(`fingerprint-${suffix}`, postId).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_post_performance_scores (
        id, brand_key, published_post_id, checkpoint_hours, snapshot_id, captured_at,
        post_age_hours, metrics_json, rates_json, velocity_json, scores_json,
        distribution_state, valid_for_learning, evaluator_version
      ) VALUES (?, 'manifest_mental', ?, 24, 'snapshot-1', '2099-01-01T12:00:00Z',
        24, '{"likes":1000}', '{"like_rate":0.1}', '{"likes_per_hour":40}',
        '{"overall":90}', 'distributed', 1, 'evaluator-v1')`,
    ).bind(`score-${suffix}`, postId).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_performance_evidence (
        id, brand_key, checkpoint_hours, dimension, feature_key, sample_size,
        cohort_size, medians_json, effect_json, confidence_score, confidence_label,
        direction, evaluator_version
      ) VALUES (?, 'manifest_mental', 24, 'hook_style', 'question', 10, 100,
        '{"feature":90}', '{"delta":15}', 0.9, 'high', 'positive', 'evaluator-v1')`,
    ).bind(`evidence-${suffix}`).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_performance_hypotheses (
        id, brand_key, checkpoint_hours, dimension, feature_key, hypothesis_text,
        direction, sample_size, confidence_score, confidence_label, evidence_json,
        evaluator_version
      ) VALUES (?, 'manifest_mental', 24, 'hook_style', 'question',
        'Question hooks outperform', 'positive', 10, 0.9, 'high',
        '{"evidence_id":"evidence-1"}', 'evaluator-v1')`,
    ).bind(`hypothesis-${suffix}`).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_generation_learning_briefs (
        id, brand_key, checkpoint_hours, sample_size, brief_json, active,
        evaluator_version, generated_at
      ) VALUES (?, 'manifest_mental', 24, 10, '{"directive":"use questions"}', 1,
        'evaluator-v1', '2099-01-01T13:00:00Z')`,
    ).bind(`brief-${suffix}`).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_content_focus_reviews (
        id, brand_key, cadence, period_key, anchor_date, windows_json,
        decisions_json, allocation_json, generated_at, evaluator_version
      ) VALUES (?, 'manifest_mental', 'weekly', '2099-01-01', '2099-01-01',
        '{"7d":{}}', '[{"family":"family-1"}]', '{"family-1":1}',
        '2099-01-01T14:00:00Z', 'evaluator-v1')`,
    ).bind(`review-${suffix}`).run();
    await testEnv.DB.prepare(
      `INSERT INTO operator_content_focus_family_states (
        id, brand_key, source_card_family_id, source_identity_key, status,
        recommended_status, confidence_score, confidence_label, allocation_weight,
        decision_reason, reuse_directives_json, stop_directives_json,
        horizon_evidence_json, manual_lock, last_review_id
      ) VALUES (?, 'manifest_mental', ?, 'identity-1', 'healthy', 'healthy', 0.9,
        'high', 1.5, 'Strong evidence', '{"reuse":true}', '{"stop":false}',
        '{"7d":{}}', 0, ?)`,
    ).bind(`focus-${suffix}`, familyId, `review-${suffix}`).run();

    await applyD1Migrations(
      testEnv.DB,
      testEnv.TEST_MIGRATIONS,
      "lensically_test_migrations",
    );

    const counts = await Promise.all([
      countWhere("SELECT COUNT(*) AS total FROM operator_post_fingerprints WHERE published_post_id = ?", postId),
      countWhere("SELECT COUNT(*) AS total FROM operator_post_performance_scores WHERE published_post_id = ? AND checkpoint_hours = 24", postId),
      countWhere("SELECT COUNT(*) AS total FROM operator_performance_evidence WHERE id = ?", `evidence-${suffix}`),
      countWhere("SELECT COUNT(*) AS total FROM operator_performance_hypotheses WHERE id = ?", `hypothesis-${suffix}`),
      countWhere("SELECT COUNT(*) AS total FROM operator_generation_learning_briefs WHERE id = ?", `brief-${suffix}`),
      countWhere("SELECT COUNT(*) AS total FROM operator_content_focus_reviews WHERE id = ?", `review-${suffix}`),
      countWhere("SELECT COUNT(*) AS total FROM operator_content_focus_family_states WHERE source_card_family_id = ?", familyId),
    ]);
    expect(counts).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it("adopts the live performance learning and content focus schema without data loss", async () => {
    const db = testEnv.PERFORMANCE_FOCUS_UPGRADE_DB;
    await db.prepare(
      `CREATE TABLE operator_post_fingerprints (
        id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, published_post_id TEXT NOT NULL,
        scheduled_post_id INTEGER, draft_id TEXT, source_card_id TEXT,
        source_selection_id TEXT, text_hash TEXT, fingerprint_version TEXT NOT NULL,
        fingerprint_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(brand_key, published_post_id)
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_post_performance_scores (
        id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, published_post_id TEXT NOT NULL,
        checkpoint_hours INTEGER NOT NULL, snapshot_id TEXT NOT NULL, captured_at TEXT NOT NULL,
        post_age_hours REAL NOT NULL, metrics_json TEXT NOT NULL, rates_json TEXT NOT NULL,
        velocity_json TEXT NOT NULL, scores_json TEXT NOT NULL, distribution_state TEXT NOT NULL,
        valid_for_learning INTEGER NOT NULL DEFAULT 1, evaluator_version TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(brand_key, published_post_id, checkpoint_hours)
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_performance_evidence (
        id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, checkpoint_hours INTEGER NOT NULL,
        dimension TEXT NOT NULL, feature_key TEXT NOT NULL, sample_size INTEGER NOT NULL,
        cohort_size INTEGER NOT NULL, medians_json TEXT NOT NULL, effect_json TEXT NOT NULL,
        confidence_score REAL NOT NULL, confidence_label TEXT NOT NULL, direction TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active', evaluator_version TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(brand_key, checkpoint_hours, dimension, feature_key)
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_performance_hypotheses (
        id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, checkpoint_hours INTEGER NOT NULL,
        dimension TEXT NOT NULL, feature_key TEXT NOT NULL, hypothesis_text TEXT NOT NULL,
        direction TEXT NOT NULL, sample_size INTEGER NOT NULL, confidence_score REAL NOT NULL,
        confidence_label TEXT NOT NULL, evidence_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active', evaluator_version TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(brand_key, checkpoint_hours, dimension, feature_key)
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_generation_learning_briefs (
        id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, checkpoint_hours INTEGER,
        sample_size INTEGER NOT NULL DEFAULT 0, brief_json TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1, evaluator_version TEXT NOT NULL,
        generated_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_content_focus_reviews (
        id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, cadence TEXT NOT NULL,
        period_key TEXT NOT NULL, anchor_date TEXT NOT NULL, windows_json TEXT NOT NULL,
        decisions_json TEXT NOT NULL, allocation_json TEXT NOT NULL, generated_at TEXT NOT NULL,
        evaluator_version TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(brand_key, cadence, period_key)
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE operator_content_focus_family_states (
        id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, source_card_family_id TEXT NOT NULL,
        source_identity_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'test',
        recommended_status TEXT NOT NULL DEFAULT 'test', confidence_score REAL NOT NULL DEFAULT 0,
        confidence_label TEXT NOT NULL DEFAULT 'insufficient', allocation_weight REAL NOT NULL DEFAULT 1,
        decision_reason TEXT NOT NULL, reuse_directives_json TEXT NOT NULL DEFAULT '{}',
        stop_directives_json TEXT NOT NULL DEFAULT '{}', horizon_evidence_json TEXT NOT NULL DEFAULT '{}',
        manual_lock INTEGER NOT NULL DEFAULT 0, last_review_id TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(brand_key, source_card_family_id)
      )`,
    ).run();

    await db.prepare(
      `INSERT INTO operator_post_fingerprints (
        id, brand_key, published_post_id, fingerprint_version, fingerprint_json
      ) VALUES ('live-fingerprint', 'manifest_mental', 'live-post', 'v1', '{}')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_post_performance_scores (
        id, brand_key, published_post_id, checkpoint_hours, snapshot_id, captured_at,
        post_age_hours, metrics_json, rates_json, velocity_json, scores_json,
        distribution_state, evaluator_version
      ) VALUES ('live-score', 'manifest_mental', 'live-post', 24, 'snapshot',
        '2099-01-01T12:00:00Z', 24, '{}', '{}', '{}', '{"overall":88}',
        'distributed', 'v1')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_performance_evidence (
        id, brand_key, checkpoint_hours, dimension, feature_key, sample_size,
        cohort_size, medians_json, effect_json, confidence_score, confidence_label,
        direction, evaluator_version
      ) VALUES ('live-evidence', 'manifest_mental', 24, 'hook', 'question', 10, 100,
        '{}', '{}', 0.8, 'high', 'positive', 'v1')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_performance_hypotheses (
        id, brand_key, checkpoint_hours, dimension, feature_key, hypothesis_text,
        direction, sample_size, confidence_score, confidence_label, evidence_json,
        evaluator_version
      ) VALUES ('live-hypothesis', 'manifest_mental', 24, 'hook', 'question',
        'Questions win', 'positive', 10, 0.8, 'high', '{}', 'v1')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_generation_learning_briefs (
        id, brand_key, brief_json, evaluator_version, generated_at
      ) VALUES ('live-brief', 'manifest_mental', '{}', 'v1', '2099-01-01T13:00:00Z')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_content_focus_reviews (
        id, brand_key, cadence, period_key, anchor_date, windows_json,
        decisions_json, allocation_json, generated_at, evaluator_version
      ) VALUES ('live-review', 'manifest_mental', 'weekly', '2099-01-01',
        '2099-01-01', '{}', '[]', '{}', '2099-01-01T14:00:00Z', 'v1')`,
    ).run();
    await db.prepare(
      `INSERT INTO operator_content_focus_family_states (
        id, brand_key, source_card_family_id, source_identity_key, decision_reason
      ) VALUES ('live-focus', 'manifest_mental', 'live-family', 'live-identity',
        'Preserve focus')`,
    ).run();

    await applyD1Migrations(
      db,
      testEnv.TEST_MIGRATIONS,
      "lensically_performance_focus_upgrade_migrations",
    );

    const preserved = await Promise.all([
      db.prepare("SELECT COUNT(*) AS total FROM operator_post_fingerprints WHERE id = 'live-fingerprint'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_post_performance_scores WHERE id = 'live-score'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_performance_evidence WHERE id = 'live-evidence'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_performance_hypotheses WHERE id = 'live-hypothesis'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_generation_learning_briefs WHERE id = 'live-brief'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_content_focus_reviews WHERE id = 'live-review'").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM operator_content_focus_family_states WHERE id = 'live-focus'").first<CountRow>(),
    ]);
    expect(preserved.map((row) => Number(row?.total ?? 0))).toEqual([1, 1, 1, 1, 1, 1, 1]);

    await expect(
      db.prepare(
        `INSERT INTO operator_post_fingerprints (
          id, brand_key, published_post_id, fingerprint_version, fingerprint_json
        ) VALUES ('duplicate-fingerprint', 'manifest_mental', 'live-post', 'v1', '{}')`,
      ).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    await expect(
      db.prepare(
        `INSERT INTO operator_content_focus_reviews (
          id, brand_key, cadence, period_key, anchor_date, windows_json,
          decisions_json, allocation_json, generated_at, evaluator_version
        ) VALUES ('duplicate-review', 'manifest_mental', 'weekly', '2099-01-01',
          '2099-01-01', '{}', '[]', '{}', '2099-01-01T15:00:00Z', 'v1')`,
      ).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

    it("preserves Manifest Intelligence policy, evidence, strategy, receipt, ban, and hypothesis state across migration replay", async () => {
    const suffix = crypto.randomUUID();
    const probes = await seedManifestIntelligenceFixture(testEnv.DB, suffix);

    await applyD1Migrations(
      testEnv.DB,
      testEnv.TEST_MIGRATIONS,
      "lensically_test_migrations",
    );

    const counts = await Promise.all(probes.map((probe) =>
      countWhere(
        `SELECT COUNT(*) AS total FROM ${probe.table} WHERE ${probe.column} = ?`,
        probe.value,
      )));
    expect(counts).toEqual(probes.map(() => 1));
  });

  it("adopts the exact live Manifest Intelligence schema without losing policy, evidence, strategy, receipt, ban, or hypothesis state", async () => {
    const db = testEnv.MANIFEST_INTELLIGENCE_UPGRADE_DB;
    await materializeMigrationWithoutLedger(db, "0014_manifest_intelligence.sql");
    const suffix = crypto.randomUUID();
    const probes = await seedManifestIntelligenceFixture(db, suffix);

    await applyD1Migrations(
      db,
      testEnv.TEST_MIGRATIONS,
      "lensically_manifest_intelligence_upgrade_migrations",
    );

    const counts = await Promise.all(probes.map((probe) =>
      countWhereIn(
        db,
        `SELECT COUNT(*) AS total FROM ${probe.table} WHERE ${probe.column} = ?`,
        probe.value,
      )));
    expect(counts).toEqual(probes.map(() => 1));

    await expect(
      db.prepare(
        `INSERT INTO operator_manifest_strategy_versions (
          id, brand_key, version, contract_version, strategy_hash, strategy_json
        ) VALUES ('duplicate-strategy', ?, 2, 'strategy-v1', ?, '{}')`,
      ).bind(`brand-${suffix}`, `strategy-hash-${suffix}`).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    await expect(
      db.prepare(
        `INSERT INTO operator_manifest_cycle_receipt_events (
          id, cycle_id, brand_key, event_key, event_type, payload_json
        ) VALUES ('duplicate-event', ?, ?, ?, 'duplicate', '{}')`,
      ).bind(`cycle-${suffix}`, `brand-${suffix}`, `event-key-${suffix}`).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    await expect(
      db.prepare(
        `INSERT INTO operator_manifest_post_hypotheses (
          id, cycle_id, brand_key, slot_key, hypothesis_version, source_kind,
          source_type, expected_response_type, expected_audience_reward,
          hook_rationale, premise_rationale, exploration_mode,
          expected_performance_range_json, uncertainty
        ) VALUES ('duplicate-hypothesis', ?, ?, '2099-01-01-01', 'hypothesis-v1',
          'internal', 'source_card', 'engagement', 'recognition', 'Question hook',
          'Proven premise', 'controlled', '{}', 'medium')`,
      ).bind(`cycle-${suffix}`, `brand-${suffix}`).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

    it("preserves Manifest Intelligence Engine semantic, maturity, learning, portfolio, transition, and experiment state across migration replay", async () => {
    const suffix = crypto.randomUUID();
    const probes = await seedManifestIntelligenceEngineFixture(testEnv.DB, suffix);

    await applyD1Migrations(
      testEnv.DB,
      testEnv.TEST_MIGRATIONS,
      "lensically_test_migrations",
    );

    const counts = await Promise.all(probes.map((probe) =>
      countWhere(
        `SELECT COUNT(*) AS total FROM ${probe.table} WHERE ${probe.column} = ?`,
        probe.value,
      )));
    expect(counts).toEqual(probes.map(() => 1));
  });

  it("adopts the exact live Manifest Intelligence Engine schema without losing semantic, maturity, learning, portfolio, transition, or experiment state", async () => {
    const db = testEnv.MANIFEST_ENGINE_UPGRADE_DB;
    await materializeMigrationWithoutLedger(db, "0015_manifest_intelligence_engine.sql");
    const suffix = crypto.randomUUID();
    const probes = await seedManifestIntelligenceEngineFixture(db, suffix);

    await applyD1Migrations(
      db,
      testEnv.TEST_MIGRATIONS,
      "lensically_manifest_engine_upgrade_migrations",
    );

    const counts = await Promise.all(probes.map((probe) =>
      countWhereIn(
        db,
        `SELECT COUNT(*) AS total FROM ${probe.table} WHERE ${probe.column} = ?`,
        probe.value,
      )));
    expect(counts).toEqual(probes.map(() => 1));

    await expect(
      db.prepare(
        `INSERT INTO operator_manifest_semantic_signatures (
          id, brand_key, content_type, content_id, text_hash, signature_version,
          signature_json
        ) VALUES ('duplicate-signature', ?, 'published', ?, 'duplicate-hash',
          'signature-v1', '{}')`,
      ).bind(`brand-${suffix}`, `content-${suffix}`).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    await expect(
      db.prepare(
        `INSERT INTO operator_manifest_learning_observations (
          id, brand_key, level, feature_key, checkpoint_hours, sample_size,
          supporting_count, contradicting_count, median_overall, effect_size,
          confidence_score, confidence_label, state, evidence_json, learning_version
        ) VALUES ('duplicate-learning', ?, 'family', ?, 24, 1, 1, 0, 1, 1,
          0.5, 'emerging', 'active', '{}', 'learning-v1')`,
      ).bind(`brand-${suffix}`, `feature-${suffix}`).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    await expect(
      db.prepare(
        `INSERT INTO operator_manifest_experiment_assignments (
          id, experiment_id, brand_key, scheduled_post_id
        ) VALUES ('duplicate-assignment', ?, ?, 900000)`,
      ).bind(`experiment-${suffix}`, `brand-${suffix}`).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

    it("preserves Manifest Measurement Audit learning, benchmark, comparison, pattern, and follower state across migration replay", async () => {
    const suffix = crypto.randomUUID();
    const probes = await seedManifestMeasurementAuditFixture(testEnv.DB, suffix);

    await applyD1Migrations(
      testEnv.DB,
      testEnv.TEST_MIGRATIONS,
      "lensically_test_migrations",
    );

    const counts = await Promise.all(probes.map((probe) =>
      countWhere(
        `SELECT COUNT(*) AS total FROM ${probe.table} WHERE ${probe.column} = ?`,
        probe.value,
      )));
    expect(counts).toEqual(probes.map(() => 1));
  });

  it("adopts the exact live Manifest Measurement Audit schema without losing learning, benchmark, comparison, pattern, or follower state", async () => {
    const db = testEnv.MANIFEST_MEASUREMENT_AUDIT_UPGRADE_DB;
    await materializeMigrationWithoutLedger(db, "0016_manifest_measurement_audit.sql");
    const suffix = crypto.randomUUID();
    const probes = await seedManifestMeasurementAuditFixture(db, suffix);

    await applyD1Migrations(
      db,
      testEnv.TEST_MIGRATIONS,
      "lensically_manifest_measurement_audit_upgrade_migrations",
    );

    const counts = await Promise.all(probes.map((probe) =>
      countWhereIn(
        db,
        `SELECT COUNT(*) AS total FROM ${probe.table} WHERE ${probe.column} = ?`,
        probe.value,
      )));
    expect(counts).toEqual(probes.map(() => 1));

    await expect(
      db.prepare(
        `INSERT INTO operator_manifest_learning_briefs (
          id, brand_key, brief_key, brief_version, source_fingerprint, brief_json
        ) VALUES ('duplicate-brief', ?, ?, 'brief-v1', 'duplicate', '{}')`,
      ).bind(`brand-${suffix}`, `brief-key-${suffix}`).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    await expect(
      db.prepare(
        `INSERT INTO operator_manifest_saved_pattern_intelligence (
          id, brand_key, pattern_identity_key, source_identity_key,
          verified_metrics_json, semantic_json, mechanism_json,
          adaptation_options_json, similarity_json, usage_json, results_json,
          confidence_json, reuse_state, intelligence_version
        ) VALUES ('duplicate-pattern', ?, ?, 'duplicate-source', '{}', '{}', '{}',
          '[]', '{}', '{}', '{}', '{}', 'eligible', 'pattern-v1')`,
      ).bind(`brand-${suffix}`, `pattern-${suffix}`).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    await expect(
      db.prepare(
        `INSERT INTO operator_manifest_follower_checkpoints (
          id, brand_key, checkpoint_key, threads_user_id, checkpoint_version,
          followers_count, follower_goal, distance_to_goal, trajectory_json,
          attribution_policy
        ) VALUES ('duplicate-follower', ?, ?, 'threads', 'follower-v1', 1, 1000000,
          999999, '{}', 'account_level_only')`,
      ).bind(`brand-${suffix}`, `checkpoint-${suffix}`).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it("enforces parent-user guards and cascades cleanup through scheduling tables", async () => {
    const suffix = crypto.randomUUID();
    const missingUserId = `missing-${suffix}`;

    await expect(
      testEnv.DB.prepare(
        `INSERT INTO scheduled_posts (
          user_id, threads_user_id, post_text, status, scheduled_time
        ) VALUES (?, ?, 'Missing user fixture', 'approved', '2099-02-01T12:00:00.000Z')`,
      ).bind(missingUserId, `threads-${suffix}`).run(),
    ).rejects.toThrow(/foreign_key_violation:scheduled_posts\.user_id/);

    await expect(
      testEnv.DB.prepare(
        `INSERT INTO threads_publish_idempotency (
          scope, app_user_id, threads_user_id, request_hash, request_bucket
        ) VALUES ('immediate', ?, ?, ?, '2099-02-01T12')`,
      ).bind(missingUserId, `threads-${suffix}`, `missing-hash-${suffix}`).run(),
    ).rejects.toThrow(/foreign_key_violation:threads_publish_idempotency\.app_user_id/);

    const userId = `cleanup-user-${suffix}`;
    const threadsUserId = `cleanup-threads-${suffix}`;
    await testEnv.DB.prepare(
      `INSERT INTO users (id, email, email_verified)
       VALUES (?, ?, 1)`,
    ).bind(userId, `cleanup-${suffix}@example.com`).run();
    await testEnv.DB.prepare(
      `INSERT INTO scheduled_posts (
        user_id, threads_user_id, post_text, status, scheduled_time, idempotency_key
      ) VALUES (?, ?, 'Cleanup fixture', 'approved', '2099-02-02T12:00:00.000Z', ?)`,
    ).bind(userId, threadsUserId, `cleanup-scheduled-${suffix}`).run();
    await testEnv.DB.prepare(
      `INSERT INTO batch_schedule_presets (
        id, user_id, threads_user_id, name, times_json, is_favorite
      ) VALUES (?, ?, ?, 'Cleanup preset', '["10:00"]', 1)`,
    ).bind(`cleanup-preset-${suffix}`, userId, threadsUserId).run();
    await testEnv.DB.prepare(
      `INSERT INTO threads_publish_idempotency (
        scope, app_user_id, threads_user_id, request_hash, request_bucket
      ) VALUES ('immediate', ?, ?, ?, '2099-02-02T12')`,
    ).bind(userId, threadsUserId, `cleanup-hash-${suffix}`).run();

    await testEnv.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();

    const childCounts = await Promise.all([
      countWhere("SELECT COUNT(*) AS total FROM scheduled_posts WHERE user_id = ?", userId),
      countWhere("SELECT COUNT(*) AS total FROM batch_schedule_presets WHERE user_id = ?", userId),
      countWhere("SELECT COUNT(*) AS total FROM threads_publish_idempotency WHERE app_user_id = ?", userId),
    ]);
    expect(childCounts).toEqual([0, 0, 0]);
  });
});
