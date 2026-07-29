import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateDatabaseAuthority } from "./validate-database-authority.mjs";


// Validates the verified release marker, capability lifecycle, Guided Growth Mission, and client-safety registry before deployment.
const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const databaseAuthorityReceipt = validateDatabaseAuthority(root);


const wrangler = read("wrangler.jsonc");
const source = read("src/index.ts");
const operatorMcpProtocol = read("src/operatorMcpProtocol.ts");
const operatorMcpProtocolTests = read("test/operatorMcpProtocol.spec.ts");
const operatorMcpToolDefinitions = read("src/operatorMcpToolDefinitions.ts");
const operatorMcpToolDefinitionTests = read("test/operatorMcpToolDefinitions.spec.ts");
const operatorMcpToolDirectory = read("src/operatorMcpToolDirectory.ts");
const operatorMcpToolDirectoryTests = read("test/operatorMcpToolDirectory.spec.ts");
const operatorMcpEngineeringRegistry = read("src/operatorMcpEngineeringRegistry.ts");
const operatorMcpEngineeringRegistryTests = read("test/operatorMcpEngineeringRegistry.spec.ts");
const operatorMcpAdminRegistry = read("src/operatorMcpAdminRegistry.ts");
const operatorMcpAdminRegistryTests = read("test/operatorMcpAdminRegistry.spec.ts");
const operatorMcpAccountFoundationRegistry = read("src/operatorMcpAccountFoundationRegistry.ts");
const operatorMcpAccountFoundationRegistryTests = read("test/operatorMcpAccountFoundationRegistry.spec.ts");
const operatorMcpSourceDraftRegistry = read("src/operatorMcpSourceDraftRegistry.ts");
const operatorMcpSourceDraftRegistryTests = read("test/operatorMcpSourceDraftRegistry.spec.ts");
const operatorMcpStrategyScheduleRegistry = read("src/operatorMcpStrategyScheduleRegistry.ts");
const operatorMcpStrategyScheduleRegistryTests = read("test/operatorMcpStrategyScheduleRegistry.spec.ts");
const operatorMcpManifestCycleRegistry = read("src/operatorMcpManifestCycleRegistry.ts");
const operatorMcpManifestCycleRegistryTests = read("test/operatorMcpManifestCycleRegistry.spec.ts");
const operatorMcpAutonomousExecutionRegistry = read("src/operatorMcpAutonomousExecutionRegistry.ts");
const operatorMcpAutonomousExecutionRegistryTests = read("test/operatorMcpAutonomousExecutionRegistry.spec.ts");
const operatorMcpAccountAnalyticsRegistry = read("src/operatorMcpAccountAnalyticsRegistry.ts");
const operatorMcpAccountAnalyticsRegistryTests = read("test/operatorMcpAccountAnalyticsRegistry.spec.ts");
const operatorMcpRegistryComposition = read("src/operatorMcpRegistryComposition.ts");
const operatorMcpRegistryCompositionTests = read("test/operatorMcpRegistryComposition.spec.ts");
const operatorMcpRoutingPolicy = read("src/operatorMcpRoutingPolicy.ts");
const operatorMcpRoutingPolicyTests = read("test/operatorMcpRoutingPolicy.spec.ts");
const operatorMcpTransport = read("src/operatorMcpTransport.ts");
const operatorMcpTransportTests = read("test/operatorMcpTransport.spec.ts");
const operatorMcpDispatcher = read("src/operatorMcpDispatcher.ts");
const operatorMcpDispatcherTests = read("test/operatorMcpDispatcher.spec.ts");
const operatorMcpToolCallDispatcher = read("src/operatorMcpToolCallDispatcher.ts");
const operatorMcpToolCallDispatcherTests = read("test/operatorMcpToolCallDispatcher.spec.ts");
const operatorManifestCycleService = read("src/operatorManifestCycleService.ts");
const operatorManifestCycleServiceTests = read("test/operatorManifestCycleService.spec.ts");
const operatorHourlyCoverageService = read("src/operatorHourlyCoverageService.ts");
const operatorHourlyCoverageServiceTests = read("test/operatorHourlyCoverageService.spec.ts");
const operatorManifestPrepareCheckpointService = read("src/operatorManifestPrepareCheckpointService.ts");
const operatorManifestPrepareCheckpointServiceTests = read("test/operatorManifestPrepareCheckpointService.spec.ts");
const operatorManifestCycleConstructionService = read("src/operatorManifestCycleConstructionService.ts");
const operatorManifestCycleConstructionServiceTests = read("test/operatorManifestCycleConstructionService.spec.ts");
const operatorManifestPersistenceAdmissionService = read("src/operatorManifestPersistenceAdmissionService.ts");
const operatorManifestPersistenceAdmissionServiceTests = read("test/operatorManifestPersistenceAdmissionService.spec.ts");
const operatorManifestPersistenceService = read("src/operatorManifestPersistenceService.ts");
const operatorManifestPersistenceServiceTests = read("test/operatorManifestPersistenceService.spec.ts");
const operatorManifestScheduledReviewService = read("src/operatorManifestScheduledReviewService.ts");
const operatorManifestScheduledReviewServiceTests = read("test/operatorManifestScheduledReviewService.spec.ts");
const operatorManifestCycleObservationService = read("src/operatorManifestCycleObservationService.ts");
const operatorManifestCycleObservationServiceTests = read("test/operatorManifestCycleObservationService.spec.ts");
const operatorAccountStateService = read("src/operatorAccountStateService.ts");
const operatorAccountStateServiceTests = read("test/operatorAccountStateService.spec.ts");
const operatorLensicallyUiSurfaceService = read("src/operatorLensicallyUiSurfaceService.ts");
const operatorLensicallyUiSurfaceServiceTests = read("test/operatorLensicallyUiSurfaceService.spec.ts");
const operatorManifestReviewBatchRetirementService = read("src/operatorManifestReviewBatchRetirementService.ts");
const operatorManifestReviewBatchRetirementServiceTests = read("test/operatorManifestReviewBatchRetirementService.spec.ts");
const operatorManifestReviewBatchStateService = read("src/operatorManifestReviewBatchStateService.ts");
const operatorManifestReviewBatchStateServiceTests = read("test/operatorManifestReviewBatchStateService.spec.ts");
const operatorManifestReviewDraftAttachmentService = read("src/operatorManifestReviewDraftAttachmentService.ts");
const operatorManifestReviewDraftAttachmentServiceTests = read("test/operatorManifestReviewDraftAttachmentService.spec.ts");
const operatorManifestReviewSourceResolutionService = read("src/operatorManifestReviewSourceResolutionService.ts");
const operatorManifestReviewSourceResolutionServiceTests = read("test/operatorManifestReviewSourceResolutionService.spec.ts");
const operatorManifestReviewBatchSchedulingService = read("src/operatorManifestReviewBatchSchedulingService.ts");
const operatorManifestReviewBatchSchedulingServiceTests = read("test/operatorManifestReviewBatchSchedulingService.spec.ts");
const operatorWorkflowSessionStartService = read("src/operatorWorkflowSessionStartService.ts");
const operatorWorkflowSessionStartServiceTests = read("test/operatorWorkflowSessionStartService.spec.ts");
const operatorContextAdmissionService = read("src/operatorContextAdmissionService.ts");
const operatorContextAdmissionServiceTests = read("test/operatorContextAdmissionService.spec.ts");
const operatorProductionBoardService = read("src/operatorProductionBoardService.ts");
const operatorProductionBoardServiceTests = read("test/operatorProductionBoardService.spec.ts");
const operatorSourceCandidateListService = read("src/operatorSourceCandidateListService.ts");
const operatorSourceCandidateListServiceTests = read("test/operatorSourceCandidateListService.spec.ts");
const operatorSavedPatternSourceExclusionService = read("src/operatorSavedPatternSourceExclusionService.ts");
const operatorSavedPatternSourceExclusionServiceTests = read("test/operatorSavedPatternSourceExclusionService.spec.ts");
const operatorManifestSourceDrawService = read("src/operatorManifestSourceDrawService.ts");
const operatorManifestSourceDrawServiceTests = read("test/operatorManifestSourceDrawService.spec.ts");
const operatorPublishedPostLineageAuditService = read("src/operatorPublishedPostLineageAuditService.ts");
const operatorPublishedPostLineageAuditServiceTests = read("test/operatorPublishedPostLineageAuditService.spec.ts");
const operatorManifestSourceCardBackfillService = read("src/operatorManifestSourceCardBackfillService.ts");
const operatorManifestSourceCardBackfillServiceTests = read("test/operatorManifestSourceCardBackfillService.spec.ts");
const operatorManifestSourceCardBackfillPreparationService = read("src/operatorManifestSourceCardBackfillPreparationService.ts");
const operatorManifestSourceCardBackfillPreparationServiceTests = read("test/operatorManifestSourceCardBackfillPreparationService.spec.ts");
const operatorSourceCandidateBatchReadService = read("src/operatorSourceCandidateBatchReadService.ts");
const operatorSourceCandidateBatchReadServiceTests = read("test/operatorSourceCandidateBatchReadService.spec.ts");
const operatorSourceCardAdmissionService = read("src/operatorSourceCardAdmissionService.ts");
const operatorSourceCardAdmissionServiceTests = read("test/operatorSourceCardAdmissionService.spec.ts");
const operatorSourceCardFamilyResolutionService = read("src/operatorSourceCardFamilyResolutionService.ts");
const operatorSourceCardFamilyResolutionServiceTests = read("test/operatorSourceCardFamilyResolutionService.spec.ts");
const operatorSourceCardPersistencePlanningService = read("src/operatorSourceCardPersistencePlanningService.ts");
const operatorSourceCardPersistencePlanningServiceTests = read("test/operatorSourceCardPersistencePlanningService.spec.ts");
const operatorSourceCardLockService = read("src/operatorSourceCardLockService.ts");
const operatorSourceCardLockServiceTests = read("test/operatorSourceCardLockService.spec.ts");
const operatorSourceCardReadService = read("src/operatorSourceCardReadService.ts");
const operatorSourceCardReadServiceTests = read("test/operatorSourceCardReadService.spec.ts");
const operatorGenerationRunAdmissionService = read("src/operatorGenerationRunAdmissionService.ts");
const operatorGenerationRunAdmissionServiceTests = read("test/operatorGenerationRunAdmissionService.spec.ts");
const operatorGenerationRunPersistencePlanningService = read("src/operatorGenerationRunPersistencePlanningService.ts");
const operatorGenerationRunPersistencePlanningServiceTests = read("test/operatorGenerationRunPersistencePlanningService.spec.ts");
const operatorGenerationDraftAdmissionService = read("src/operatorGenerationDraftAdmissionService.ts");
const operatorGenerationDraftAdmissionServiceTests = read("test/operatorGenerationDraftAdmissionService.spec.ts");
const operatorGenerationDraftPersistencePlanningService = read("src/operatorGenerationDraftPersistencePlanningService.ts");
const operatorGenerationDraftPersistencePlanningServiceTests = read("test/operatorGenerationDraftPersistencePlanningService.spec.ts");
const operatorDraftShownTransitionService = read("src/operatorDraftShownTransitionService.ts");
const operatorDraftShownTransitionServiceTests = read("test/operatorDraftShownTransitionService.spec.ts");
const operatorDraftDecisionService = read("src/operatorDraftDecisionService.ts");
const operatorDraftDecisionServiceTests = read("test/operatorDraftDecisionService.spec.ts");
const operatorActiveGateReadService = read("src/operatorActiveGateReadService.ts");
const operatorActiveGateReadServiceTests = read("test/operatorActiveGateReadService.spec.ts");
const operatorGateMutationPlanningService = read("src/operatorGateMutationPlanningService.ts");
const operatorGateMutationPlanningServiceTests = read("test/operatorGateMutationPlanningService.spec.ts");
const operatorStrategyMemoryListReadService = read("src/operatorStrategyMemoryListReadService.ts");
const operatorStrategyMemoryListReadServiceTests = read("test/operatorStrategyMemoryListReadService.spec.ts");
const operatorStrategyMemorySaveService = read("src/operatorStrategyMemorySaveService.ts");
const operatorStrategyMemorySaveServiceTests = read("test/operatorStrategyMemorySaveService.spec.ts");
const operatorScheduledPostListReadService = read("src/operatorScheduledPostListReadService.ts");
const operatorScheduledPostListReadServiceTests = read("test/operatorScheduledPostListReadService.spec.ts");
const operatorScheduledPostDeletionService = read("src/operatorScheduledPostDeletionService.ts");
const operatorScheduledPostDeletionServiceTests = read("test/operatorScheduledPostDeletionService.spec.ts");
const operatorScheduledPostRetryService = read("src/operatorScheduledPostRetryService.ts");
const operatorScheduledPostRetryServiceTests = read("test/operatorScheduledPostRetryService.spec.ts");
const operatorScheduledPostEditMutationService = read("src/operatorScheduledPostEditMutationService.ts");
const operatorScheduledPostEditMutationServiceTests = read("test/operatorScheduledPostEditMutationService.spec.ts");
const wranglerDeployRetry = read("scripts/run-wrangler-deploy-with-retry.mjs");
const wranglerDeployRetryCore = read("scripts/wrangler-deploy-retry-core.mjs");
const wranglerDeployRetryTests = read("test/wranglerDeployRetry.spec.ts");


























const operatorMcpSchemas = read("src/operatorMcpSchemas.ts");
const operatorMcpConstants = read("src/operatorMcpConstants.ts");
const manifestIntelligence = read("src/manifestIntelligence.ts");
const manifestIntelligenceMigration = read("database/migrations/0014_manifest_intelligence.sql");
const manifestMeasurementAudit = read("src/manifestMeasurementAudit.ts");
const operatorContinuityMigration = read("database/migrations/0008_operator_continuity_and_autonomy.sql");
const cycleDecisionMigration = read("database/migrations/0009_autonomous_cycles_and_decisions.sql");
const workStateMigration = read("database/migrations/0011_durable_work_state_and_retirements.sql");
const router = read("src/mandatoryExecutionMap.ts");
const clientSafety = read("src/systemDirectory/clientSafeRequests.ts");
const systemDirectorySource = read("src/systemDirectory/index.ts");
const systemDirectoryTests = read("test/systemDirectory.spec.ts");
const humanFreeAutonomyTests = read("test/humanFreeAutonomy.spec.ts");
const capabilityLifecycle = JSON.parse(read("src/systemDirectory/capabilityLifecycle.json"));
const tests = read("test/operatorMode.spec.ts");
const manifestAutonomousTests = read("manifest-autonomous-cycle.test.ts");
const operatorShardRunner = read("scripts/run-operator-shard.mjs");
const testSyntaxValidator = read("scripts/validate-test-syntax.mjs");
const workflow = read("../.github/workflows/lensically-engineering.yml").replace(/\r\n/g, "\n");
const workflowLint = read("../.github/workflows/lensically-workflow-lint.yml").replace(/\r\n/g, "\n");
const workflowStructureValidator = read("scripts/validate-engineering-workflow.rb");

const agentRules = read("../AGENTS.md");
const currentState = read("../CURRENT_STATE.md");
const operatingMemory = read("../OPERATING_MEMORY.md");
const recoverySource = read("../lensically-recovery-worker/src/index.ts");
const threadsPublishService = read("src/utils/threadsPublishService.ts");
const threadsPublishTests = read("test/threadsPublishService.spec.ts");

const cronMatch = wrangler.match(/"crons"\s*:\s*(\[[\s\S]*?\])/);
if (!cronMatch) throw new Error("wrangler_crons_missing");
const crons = JSON.parse(cronMatch[1]);
if (!Array.isArray(crons) || crons.length === 0 || crons.some((cron) => typeof cron !== "string" || !cron.trim())) {
  throw new Error("wrangler_crons_invalid");
}
if (new Set(crons).size !== crons.length) throw new Error("duplicate_wrangler_crons");

if (process.argv.includes("--print-crons")) {
  process.stdout.write(`${crons.join("\n")}\n`);
  process.exit(0);
}

const errors = [];
if (!workflow.includes("test/operatorMcpProtocol.spec.ts")) {
  errors.push("operator_mcp_protocol_workflow_gate_missing");
}
if (!workflow.includes("test/operatorMcpToolDefinitions.spec.ts")) {
  errors.push("operator_mcp_tool_definition_workflow_gate_missing");
}
if (!workflow.includes("test/operatorMcpToolDirectory.spec.ts")) {
  errors.push("operator_mcp_tool_directory_workflow_gate_missing");
}
if (!workflow.includes("test/operatorMcpEngineeringRegistry.spec.ts")) {
  errors.push("operator_mcp_engineering_registry_workflow_gate_missing");
}
if (!workflow.includes("test/operatorMcpAdminRegistry.spec.ts")) {
  errors.push("operator_mcp_admin_registry_workflow_gate_missing");
}
if (!workflow.includes("test/operatorMcpAccountFoundationRegistry.spec.ts")) {
  errors.push("operator_mcp_account_foundation_registry_workflow_gate_missing");
}
if (!workflow.includes("test/operatorMcpSourceDraftRegistry.spec.ts")) {
  errors.push("operator_mcp_source_draft_registry_workflow_gate_missing");
}
if (!workflow.includes("test/operatorMcpStrategyScheduleRegistry.spec.ts")) {
  errors.push("operator_mcp_strategy_schedule_registry_workflow_gate_missing");
}
if (!workflow.includes("test/operatorMcpManifestCycleRegistry.spec.ts")) {
  errors.push("operator_mcp_manifest_cycle_registry_workflow_gate_missing");
}
if (!workflow.includes("test/operatorMcpAutonomousExecutionRegistry.spec.ts")) {
  errors.push("operator_mcp_autonomous_execution_registry_workflow_gate_missing");
}
if (!workflow.includes("test/operatorMcpAccountAnalyticsRegistry.spec.ts")) {
  errors.push("operator_mcp_account_analytics_registry_workflow_gate_missing");
}
if (!workflow.includes("test/operatorMcpRegistryComposition.spec.ts")) {
  errors.push("operator_mcp_registry_composition_workflow_gate_missing");
}
if (!workflow.includes("test/operatorMcpRoutingPolicy.spec.ts")) {
  errors.push("operator_mcp_routing_policy_workflow_gate_missing");
}
if (!workflow.includes("test/operatorMcpTransport.spec.ts")) {
  errors.push("operator_mcp_transport_workflow_gate_missing");
}
if (!workflow.includes("test/operatorMcpDispatcher.spec.ts")) {
  errors.push("operator_mcp_dispatcher_workflow_gate_missing");
}
if (!workflow.includes("test/operatorMcpToolCallDispatcher.spec.ts")) {
  errors.push("operator_mcp_tool_call_dispatcher_workflow_gate_missing");
}
if (!workflow.includes("test/operatorManifestCycleService.spec.ts")) {
  errors.push("operator_manifest_cycle_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorHourlyCoverageService.spec.ts")) {
  errors.push("operator_hourly_coverage_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorManifestPrepareCheckpointService.spec.ts")) {
  errors.push("operator_manifest_prepare_checkpoint_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorManifestCycleConstructionService.spec.ts")) {
  errors.push("operator_manifest_cycle_construction_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorManifestPersistenceAdmissionService.spec.ts")) {
  errors.push("operator_manifest_persistence_admission_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorManifestPersistenceService.spec.ts")) {
  errors.push("operator_manifest_persistence_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorManifestScheduledReviewService.spec.ts")) {
  errors.push("operator_manifest_scheduled_review_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorManifestCycleObservationService.spec.ts")) {
  errors.push("operator_manifest_cycle_observation_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorAccountStateService.spec.ts")) {
  errors.push("operator_account_state_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorLensicallyUiSurfaceService.spec.ts")) {
  errors.push("operator_lensically_ui_surface_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorManifestReviewBatchRetirementService.spec.ts")) {
  errors.push("operator_manifest_review_batch_retirement_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorManifestReviewBatchStateService.spec.ts")) {
  errors.push("operator_manifest_review_batch_state_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorManifestReviewDraftAttachmentService.spec.ts")) {
  errors.push("operator_manifest_review_draft_attachment_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorManifestReviewSourceResolutionService.spec.ts")) {
  errors.push("operator_manifest_review_source_resolution_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorManifestReviewBatchSchedulingService.spec.ts")) {
  errors.push("operator_manifest_review_batch_scheduling_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorWorkflowSessionStartService.spec.ts")) {
  errors.push("operator_workflow_session_start_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorContextAdmissionService.spec.ts")) {
  errors.push("operator_context_admission_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorProductionBoardService.spec.ts")) {
  errors.push("operator_production_board_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorSourceCandidateListService.spec.ts")) {
  errors.push("operator_source_candidate_list_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorSavedPatternSourceExclusionService.spec.ts")) {
  errors.push("operator_saved_pattern_source_exclusion_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorManifestSourceDrawService.spec.ts")) {
  errors.push("operator_manifest_source_draw_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorPublishedPostLineageAuditService.spec.ts")) {
  errors.push("operator_published_post_lineage_audit_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorManifestSourceCardBackfillService.spec.ts")) {
  errors.push("operator_manifest_source_card_backfill_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorManifestSourceCardBackfillPreparationService.spec.ts")) {
  errors.push("operator_manifest_source_card_backfill_preparation_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorSourceCandidateBatchReadService.spec.ts")) {
  errors.push("operator_source_candidate_batch_read_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorSourceCardAdmissionService.spec.ts")) {
  errors.push("operator_source_card_admission_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorSourceCardFamilyResolutionService.spec.ts")) {
  errors.push("operator_source_card_family_resolution_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorSourceCardPersistencePlanningService.spec.ts")) {
  errors.push("operator_source_card_persistence_planning_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorSourceCardLockService.spec.ts")) {
  errors.push("operator_source_card_lock_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorSourceCardReadService.spec.ts")) {
  errors.push("operator_source_card_read_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorGenerationRunAdmissionService.spec.ts")) {
  errors.push("operator_generation_run_admission_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorGenerationRunPersistencePlanningService.spec.ts")) {
  errors.push("operator_generation_run_persistence_planning_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorGenerationDraftAdmissionService.spec.ts")) {
  errors.push("operator_generation_draft_admission_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorGenerationDraftPersistencePlanningService.spec.ts")) {
  errors.push("operator_generation_draft_persistence_planning_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorDraftShownTransitionService.spec.ts")) {
  errors.push("operator_draft_shown_transition_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorDraftDecisionService.spec.ts")) {
  errors.push("operator_draft_decision_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorActiveGateReadService.spec.ts")) {
  errors.push("operator_active_gate_read_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorGateMutationPlanningService.spec.ts")) {
  errors.push("operator_gate_mutation_planning_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorStrategyMemoryListReadService.spec.ts")) {
  errors.push("operator_strategy_memory_list_read_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorStrategyMemorySaveService.spec.ts")) {
  errors.push("operator_strategy_memory_save_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorScheduledPostListReadService.spec.ts")) {
  errors.push("operator_scheduled_post_list_read_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorScheduledPostDeletionService.spec.ts")) {
  errors.push("operator_scheduled_post_deletion_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorScheduledPostRetryService.spec.ts")) {
  errors.push("operator_scheduled_post_retry_service_workflow_gate_missing");
}
if (!workflow.includes("test/operatorScheduledPostEditMutationService.spec.ts")) {
  errors.push("operator_scheduled_post_edit_mutation_service_workflow_gate_missing");
}
if (!workflow.includes("test/wranglerDeployRetry.spec.ts")) {
  errors.push("wrangler_deploy_retry_workflow_gate_missing");
}
if ((workflow.match(/node scripts\/validate-test-syntax\.mjs/g) ?? []).length < 3) {
  errors.push("test_syntax_validation_workflow_coverage_missing");
}
if (!testSyntaxValidator.includes('import { transform } from "esbuild"')
    || !testSyntaxValidator.includes("await collect(testRoot)")
    || !testSyntaxValidator.includes("await transform(source")
    || !testSyntaxValidator.includes("test_syntax_invalid")) {
  errors.push("test_syntax_validator_incomplete");
}
if (!workflowLint.includes('name: Lensically workflow lint')
    || !workflowLint.includes('".github/workflows/lensically-engineering.yml"')
    || !workflowLint.includes("ruby lensically-worker/scripts/validate-engineering-workflow.rb")
    || !workflowLint.includes("workflow_dispatch:")) {
  errors.push("independent_workflow_yaml_watchdog_incomplete");
}
if (!workflowStructureValidator.includes("document = YAML.parse_file(path)")
    || !workflowStructureValidator.includes("assert_no_duplicate_mapping_keys(document)")
    || !workflowStructureValidator.includes("duplicate_mapping_key")
    || !workflowStructureValidator.includes("required = %w[push-validation fast-validation operator-test-shards worker-release]")
    || !workflowStructureValidator.includes('job.key?("runs-on")')
    || !workflowStructureValidator.includes('job["steps"].is_a?(Array)')
    || !workflowStructureValidator.includes("required_worker_release_steps")
    || !workflowStructureValidator.includes("Verify production runtime, scheduler, retained website, and retired legacy surfaces")) {
  errors.push("engineering_workflow_structure_validator_incomplete");
}

if (!workflow.includes("for attempt in $(seq 1 45); do")
    || !workflow.includes("runtime_ok=false")
    || !workflow.includes("scheduler_ok=false")
    || !workflow.includes("dashboard_ok=false")
    || !workflow.includes('gpt_memory_status="$(curl')
    || !workflow.includes('agent_status="$(curl')
    || !workflow.includes('intelligence_status="$(curl')
    || !workflow.includes("sleep 2")) {
  errors.push("release_runtime_propagation_guard_incomplete");
}
if (!workflow.includes('node scripts/run-wrangler-deploy-with-retry.mjs --config wrangler.jsonc --var "LENSICALLY_COMMIT_SHA:$(git rev-parse HEAD)"')
    || !workflow.includes("node ../lensically-worker/scripts/run-wrangler-deploy-with-retry.mjs --config wrangler.toml")
    || workflow.includes('run: npx wrangler deploy')
        || !wranglerDeployRetry.includes('from "./wrangler-deploy-retry-core.mjs"')
    || !wranglerDeployRetry.includes('from "node:child_process"')
    || !wranglerDeployRetry.includes("spawn: spawnSync")
    || !wranglerDeployRetryCore.includes("export function isTransientWranglerDeployFailure")
    || !wranglerDeployRetryCore.includes("export function getDeployRetryDelayMs")
    || !wranglerDeployRetryCore.includes("export async function runWranglerDeployWithRetry")
    || !wranglerDeployRetryCore.includes("maxAttempts = 4")
    || !wranglerDeployRetryCore.includes("[code:\\s*10013]")
    || !wranglerDeployRetryCore.includes("deterministic failure; not retrying")
    || !wranglerDeployRetryCore.includes("transient retry budget exhausted")
    || wranglerDeployRetryCore.includes('from "node:')
    || wranglerDeployRetryCore.includes("process.")
    || !wranglerDeployRetryTests.includes("classifies Cloudflare assets-upload code 10013 as transient")
    || !wranglerDeployRetryTests.includes("recovers after one classified transient failure")
    || !wranglerDeployRetryTests.includes("fails immediately for a deterministic deployment error")
    || !wranglerDeployRetryTests.includes("stops after the bounded transient retry budget")) {
  errors.push("wrangler_deploy_retry_contract_incomplete");
}






















const lifecycleErrors = [];
const lifecycleRequiredFields = capabilityLifecycle?.declaration_schema?.required_fields ?? [];
const lifecycleDeclarations = Array.isArray(capabilityLifecycle?.declarations) ? capabilityLifecycle.declarations : [];
const lifecycleBaselineTools = new Set(capabilityLifecycle?.baseline?.active_tool_names ?? []);
const lifecycleBaselineDirectoryIds = new Set(capabilityLifecycle?.baseline?.directory_entry_ids ?? []);
const lifecycleReleaseScopes = new Set(capabilityLifecycle?.allowed_release_scopes ?? []);
const lifecycleImplementationModes = new Set(capabilityLifecycle?.declaration_schema?.implementation_modes ?? []);
const combinedRegressionTests = `${systemDirectoryTests}\n${tests}\n${humanFreeAutonomyTests}`;
const combinedToolDefinitionSource = `${source}\n${operatorMcpEngineeringRegistry}\n${operatorMcpAdminRegistry}\n${operatorMcpAccountFoundationRegistry}\n${operatorMcpSourceDraftRegistry}\n${operatorMcpStrategyScheduleRegistry}\n${operatorMcpManifestCycleRegistry}\n${operatorMcpAutonomousExecutionRegistry}\n${operatorMcpAccountAnalyticsRegistry}`;
const toolDefinitionNames = Array.from(new Set(Array.from(combinedToolDefinitionSource.matchAll(/\{\s*name:\s*"([^"]+)"[\s\S]{0,1600}?\btitle:\s*"[^"]+"[\s\S]{0,1600}?\binputSchema:\s*\{/g), (match) => match[1])));
const directorySection = systemDirectorySource.slice(
  systemDirectorySource.indexOf("export const LENSICALLY_SYSTEM_DIRECTORY_ENTRIES"),
  systemDirectorySource.indexOf("export const LENSICALLY_SYSTEM_DIRECTORY_INDEX"),
);
const directoryEntryIds = Array.from(new Set(Array.from(directorySection.matchAll(/\bid:\s*"([^"]+)"/g), (match) => match[1])));
const declaredCapabilityIds = new Set();
const declaredDirectoryIds = new Set();
const declaredNewHandlers = new Set();
const version = operatorMcpProtocol.match(/export\s+const OPERATOR_MCP_VERSION = "([^"]+)";/)?.[1] ?? null;
const versionAssertionEntries = tests
  .split(/\r?\n/)
  .map((line, index) => ({ line, line_number: index + 1 }))
  .filter((entry) => entry.line.includes("expect(") && /mcp_version|serverInfo\.version/.test(entry.line));
const literalVersionAssertionEntries = versionAssertionEntries.filter((entry) => /["'][0-9]+\.[0-9]+\.[0-9]+["']/.test(entry.line));
const canonicalVersionAssertionEntries = versionAssertionEntries.filter((entry) => entry.line.includes("OPERATOR_MCP_VERSION"));

if (!version) lifecycleErrors.push("operator_mcp_version_missing");
if (!source.includes('from "./operatorMcpProtocol"')) lifecycleErrors.push("operator_mcp_protocol_import_missing");
if (source.includes("function operatorMcpInstructions(")
    || source.includes("function operatorKeyHandshakeLines(")
    || source.includes('export const OPERATOR_MCP_VERSION = "')) {
  lifecycleErrors.push("operator_mcp_protocol_contract_returned_to_index");
}
if (!operatorMcpProtocol.includes("buildOperatorMcpInitializeResult")
    || !operatorMcpProtocol.includes("buildOperatorMcpInstructions")
    || !operatorMcpProtocol.includes("buildOperatorKeyHandshakeLines")) {
  lifecycleErrors.push("operator_mcp_protocol_module_incomplete");
}
if (!operatorMcpProtocolTests.includes("builds the exact default initialize payload")
    || !operatorMcpProtocolTests.includes("builds the visible standards-first selected-key handshake")) {
  lifecycleErrors.push("operator_mcp_protocol_tests_incomplete");
}
if (!source.includes('from "./operatorMcpToolDefinitions"')) {
  lifecycleErrors.push("operator_mcp_tool_definition_import_missing");
}
if (source.includes("type OperatorMcpToolDefinition =")
    || source.includes("function cloneOperatorMcpTool(")
    || source.includes("function createScopedOperatorWrapperTool(")) {
  lifecycleErrors.push("operator_mcp_tool_definition_construction_returned_to_index");
}
if (!operatorMcpToolDefinitions.includes("buildOperatorMcpToolDefinitions")
    || !operatorMcpToolDefinitions.includes("createScopedOperatorWrapperTool")
    || !operatorMcpToolDefinitions.includes("addOperatorExecutionMetadataSchema")) {
  lifecycleErrors.push("operator_mcp_tool_definition_module_incomplete");
}
if (!operatorMcpToolDefinitionTests.includes("builds account-scoped wrappers without brand_key")
    || !operatorMcpToolDefinitionTests.includes("builds three scoped account wrappers and preserves priority order")) {
  lifecycleErrors.push("operator_mcp_tool_definition_tests_incomplete");
}
if (!source.includes('from "./operatorMcpToolDirectory"')) {
  lifecycleErrors.push("operator_mcp_tool_directory_import_missing");
}
if (source.includes("const FORBIDDEN_RETIRED_TOOL_NAMES =")
    || source.includes("const OPERATOR_PUBLIC_DIRECT_TOOL_NAMES =")
    || source.includes("const RETIRED_HUMAN_GUIDANCE_TOOL_NAMES =")
    || source.includes("function isOperatorPublicDirectToolName(")) {
  lifecycleErrors.push("operator_mcp_tool_directory_policy_returned_to_index");
}
if (!operatorMcpToolDirectory.includes("OPERATOR_PUBLIC_DIRECT_TOOL_NAMES")
    || !operatorMcpToolDirectory.includes("RETIRED_HUMAN_GUIDANCE_TOOL_NAMES")
    || !operatorMcpToolDirectory.includes("filterOperatorPublicMcpTools")
    || !operatorMcpToolDirectory.includes("findOperatorMcpToolDefinition")) {
  lifecycleErrors.push("operator_mcp_tool_directory_module_incomplete");
}
if (!operatorMcpToolDirectoryTests.includes("preserves the exact 75-tool public surface and retirement policy")
    || !operatorMcpToolDirectoryTests.includes("shapes engineering, admin, and backend definitions with required fields")) {
  lifecycleErrors.push("operator_mcp_tool_directory_tests_incomplete");
}
if (!source.includes('from "./operatorMcpEngineeringRegistry"')) {
  lifecycleErrors.push("operator_mcp_engineering_registry_import_missing");
}
if (source.includes("const OPERATOR_MCP_ENGINEERING_TOOL_NAMES =")
    || source.includes("const OPERATOR_MCP_ENGINEERING_TOOLS:")
    || source.includes("type OperatorMcpEngineeringToolName =")
    || source.includes('{ name: "engineeringPrecheck"')) {
  lifecycleErrors.push("operator_mcp_engineering_registry_returned_to_index");
}
if (!operatorMcpEngineeringRegistry.includes("export const OPERATOR_MCP_ENGINEERING_TOOL_NAMES")
    || !operatorMcpEngineeringRegistry.includes("export type OperatorMcpEngineeringToolName")
    || !operatorMcpEngineeringRegistry.includes("export const OPERATOR_MCP_ENGINEERING_TOOLS")) {
  lifecycleErrors.push("operator_mcp_engineering_registry_module_incomplete");
}
if (!operatorMcpEngineeringRegistryTests.includes("preserves the exact 33-tool engineering registry without duplicates")
    || !operatorMcpEngineeringRegistryTests.includes("preserves exact workflow and deployment controls")) {
  lifecycleErrors.push("operator_mcp_engineering_registry_tests_incomplete");
}
if (!source.includes('from "./operatorMcpAdminRegistry"')
    || !source.includes('from "./operatorMcpSchemas"')) {
  lifecycleErrors.push("operator_mcp_admin_registry_import_missing");
}
if (source.includes("const OPERATOR_MCP_ADMIN_TOOL_NAMES =")
    || source.includes("const OPERATOR_MCP_ADMIN_TOOLS:")
    || source.includes("type OperatorMcpAdminToolName =")
    || source.includes('{ name: "selectOperatorKey"')
    || source.includes("const BRAND_KEY_SCHEMA =")
    || source.includes("const SOURCE_DRAFT_ANALYSIS_SCHEMA =")) {
  lifecycleErrors.push("operator_mcp_admin_registry_returned_to_index");
}
if (!operatorMcpAdminRegistry.includes("export const OPERATOR_MCP_ADMIN_TOOL_NAMES")
    || !operatorMcpAdminRegistry.includes("export type OperatorMcpAdminToolName")
    || !operatorMcpAdminRegistry.includes("export const OPERATOR_MCP_ADMIN_TOOLS")) {
  lifecycleErrors.push("operator_mcp_admin_registry_module_incomplete");
}
if (!operatorMcpSchemas.includes("export const BRAND_KEY_SCHEMA")
    || !operatorMcpSchemas.includes("export const SOURCE_DRAFT_ANALYSIS_SCHEMA")
    || !operatorMcpSchemas.includes("export const SOURCE_TRANSFORMATION_CONTRACT_SCHEMA")) {
  lifecycleErrors.push("operator_mcp_shared_schemas_incomplete");
}
if (!operatorMcpConstants.includes('export const OPERATOR_WORKFLOW_TEMPLATE_KEY = "content_operator_v1"')) {
  lifecycleErrors.push("operator_mcp_shared_constants_incomplete");
}
if (!operatorMcpAdminRegistryTests.includes("preserves the intentional 25-name classification and 24 static definitions")
    || !operatorMcpAdminRegistryTests.includes("preserves protected scheduler and decision schemas")
    || !operatorMcpAdminRegistryTests.includes("preserves workflow and gate compatibility schemas")) {
  lifecycleErrors.push("operator_mcp_admin_registry_tests_incomplete");
}
if (!operatorMcpRegistryComposition.includes('from "./operatorMcpAccountFoundationRegistry"')
    || !source.includes('from "./operatorMcpConstants"')) {
  lifecycleErrors.push("operator_mcp_account_foundation_registry_import_missing");
}
if (source.includes('{ name: "list_accounts"')
    || source.includes('{ name: "discard_manifest_review_batch"')
    || source.includes('{ name: "start_workflow_session"')
    || source.includes('{ name: "audit_published_post_lineage"')
    || source.includes('{ name: "get_source_candidate_batch"')
    || source.includes('const OPERATOR_WORKFLOW_TEMPLATE_KEY = "content_operator_v1"')
    || source.includes("const SOURCE_TRANSFORMATION_CONTRACT_SCHEMA =")) {
  lifecycleErrors.push("operator_mcp_account_foundation_registry_returned_to_index");
}
if (!operatorMcpAccountFoundationRegistry.includes("export const OPERATOR_MCP_ACCOUNT_FOUNDATION_TOOL_NAMES")
    || !operatorMcpAccountFoundationRegistry.includes("export type OperatorMcpAccountFoundationToolName")
    || !operatorMcpAccountFoundationRegistry.includes("export const OPERATOR_MCP_ACCOUNT_FOUNDATION_TOOLS")) {
  lifecycleErrors.push("operator_mcp_account_foundation_registry_module_incomplete");
}
if (!operatorMcpAccountFoundationRegistryTests.includes("preserves the exact ordered 21-tool foundation registry")
    || !operatorMcpAccountFoundationRegistryTests.includes("preserves guided review limits and workflow defaults")
    || !operatorMcpAccountFoundationRegistryTests.includes("preserves source deletion, lineage recovery, and bounded backfill contracts")) {
  lifecycleErrors.push("operator_mcp_account_foundation_registry_tests_incomplete");
}
if (!operatorMcpRegistryComposition.includes('from "./operatorMcpSourceDraftRegistry"')) {
  lifecycleErrors.push("operator_mcp_source_draft_registry_import_missing");
}
if (source.includes('{ name: "create_source_card"')
    || source.includes('{ name: "create_generation_run"')
    || source.includes('{ name: "submit_candidate_draft"')
    || source.includes('{ name: "list_active_gates"')
    || source.includes("const GENERATION_ADAPTATION_PLAN_SCHEMA =")) {
  lifecycleErrors.push("operator_mcp_source_draft_registry_returned_to_index");
}
if (!operatorMcpSourceDraftRegistry.includes("export const OPERATOR_MCP_SOURCE_DRAFT_TOOL_NAMES")
    || !operatorMcpSourceDraftRegistry.includes("export type OperatorMcpSourceDraftToolName")
    || !operatorMcpSourceDraftRegistry.includes("export const OPERATOR_MCP_SOURCE_DRAFT_TOOLS")) {
  lifecycleErrors.push("operator_mcp_source_draft_registry_module_incomplete");
}
if (!operatorMcpSchemas.includes("export const GENERATION_ADAPTATION_PLAN_SCHEMA")) {
  lifecycleErrors.push("operator_mcp_generation_adaptation_schema_missing");
}
if (!operatorMcpSourceDraftRegistryTests.includes("preserves the exact ordered 13-tool source-draft registry")
    || !operatorMcpSourceDraftRegistryTests.includes("preserves source-card versioning and generation adaptation contracts")
    || !operatorMcpSourceDraftRegistryTests.includes("preserves showable draft lifecycle and rejection evidence requirements")
    || !operatorMcpSourceDraftRegistryTests.includes("preserves gate discovery, mutation, and memory-promotion schemas")) {
  lifecycleErrors.push("operator_mcp_source_draft_registry_tests_incomplete");
}
if (!operatorMcpRegistryComposition.includes('from "./operatorMcpStrategyScheduleRegistry"')) {
  lifecycleErrors.push("operator_mcp_strategy_schedule_registry_import_missing");
}
if (source.includes('{ name: "list_strategy_memory"')
    || source.includes('{ name: "delete_scheduled_post"')
    || source.includes('{ name: "schedule_owner_approved_batch"')
    || source.includes("const GPT_STRATEGY_MEMORY_KINDS =")) {
  lifecycleErrors.push("operator_mcp_strategy_schedule_registry_returned_to_index");
}
if (!operatorMcpStrategyScheduleRegistry.includes("export const OPERATOR_MCP_STRATEGY_SCHEDULE_TOOL_NAMES")
    || !operatorMcpStrategyScheduleRegistry.includes("export type OperatorMcpStrategyScheduleToolName")
    || !operatorMcpStrategyScheduleRegistry.includes("export const OPERATOR_MCP_STRATEGY_SCHEDULE_TOOLS")) {
  lifecycleErrors.push("operator_mcp_strategy_schedule_registry_module_incomplete");
}
if (!operatorMcpConstants.includes("export const GPT_STRATEGY_MEMORY_KINDS")) {
  lifecycleErrors.push("operator_mcp_strategy_memory_kinds_missing");
}
if (!operatorMcpStrategyScheduleRegistryTests.includes("preserves the exact ordered seven-tool strategy-scheduling registry")
    || !operatorMcpStrategyScheduleRegistryTests.includes("preserves shared strategy-memory kind authority")
    || !operatorMcpStrategyScheduleRegistryTests.includes("preserves protected scheduled-post deletion and retry restrictions")
    || !operatorMcpStrategyScheduleRegistryTests.includes("preserves owner batch limits and Manifest lineage protections")) {
  lifecycleErrors.push("operator_mcp_strategy_schedule_registry_tests_incomplete");
}
if (!operatorMcpRegistryComposition.includes('from "./operatorMcpManifestCycleRegistry"')) {
  lifecycleErrors.push("operator_mcp_manifest_cycle_registry_import_missing");
}
if (source.includes('{ name: "get_manifest_intelligence_foundation"')
    || source.includes('{ name: "get_manifest_cycle_receipt"')
    || source.includes('{ name: "record_manifest_cycle_defect"')
    || source.includes('{ name: "get_manifest_cycle_analysis_page"')
    || source.includes('{ name: "commit_manifest_cycle_strategy"')) {
  lifecycleErrors.push("operator_mcp_manifest_cycle_registry_returned_to_index");
}
if (!operatorMcpManifestCycleRegistry.includes("export const OPERATOR_MCP_MANIFEST_CYCLE_TOOL_NAMES")
    || !operatorMcpManifestCycleRegistry.includes("export type OperatorMcpManifestCycleToolName")
    || !operatorMcpManifestCycleRegistry.includes("export const OPERATOR_MCP_MANIFEST_CYCLE_TOOLS")) {
  lifecycleErrors.push("operator_mcp_manifest_cycle_registry_module_incomplete");
}
if (!operatorMcpManifestCycleRegistryTests.includes("preserves the exact ordered six-tool Manifest cycle registry")
    || !operatorMcpManifestCycleRegistryTests.includes("preserves pageable canonical cycle receipt reconstruction")
    || !operatorMcpManifestCycleRegistryTests.includes("preserves seven-stage defect evidence and durable repair verification")
    || !operatorMcpManifestCycleRegistryTests.includes("preserves complete analysis consumption and source-backed strategy locking")) {
  lifecycleErrors.push("operator_mcp_manifest_cycle_registry_tests_incomplete");
}
if (!operatorMcpRegistryComposition.includes('from "./operatorMcpAutonomousExecutionRegistry"')) {
  lifecycleErrors.push("operator_mcp_autonomous_execution_registry_import_missing");
}
if (source.includes('{ name: "prepare_manifest_autonomous_cycle"')
    || source.includes('{ name: "persist_manifest_autonomous_post"')
    || source.includes('{ name: "review_manifest_scheduled_post"')) {
  lifecycleErrors.push("operator_mcp_autonomous_execution_registry_returned_to_index");
}
if (!operatorMcpAutonomousExecutionRegistry.includes("export const OPERATOR_MCP_AUTONOMOUS_EXECUTION_TOOL_NAMES")
    || !operatorMcpAutonomousExecutionRegistry.includes("export type OperatorMcpAutonomousExecutionToolName")
    || !operatorMcpAutonomousExecutionRegistry.includes("export const OPERATOR_MCP_AUTONOMOUS_EXECUTION_TOOLS")) {
  lifecycleErrors.push("operator_mcp_autonomous_execution_registry_module_incomplete");
}
if (!operatorMcpAutonomousExecutionRegistryTests.includes("preserves the exact ordered three-tool autonomous execution registry")
    || !operatorMcpAutonomousExecutionRegistryTests.includes("preserves immediate prepare invocation and rolling runway bounds")
    || !operatorMcpAutonomousExecutionRegistryTests.includes("preserves one-post source lineage, hypothesis, and idempotency contracts")
    || !operatorMcpAutonomousExecutionRegistryTests.includes("preserves complete model evaluation and nonempty gate evidence")
    || !operatorMcpAutonomousExecutionRegistryTests.includes("preserves optional owner review and slot-preserving replacement")) {
  lifecycleErrors.push("operator_mcp_autonomous_execution_registry_tests_incomplete");
}
if (!operatorMcpRegistryComposition.includes('from "./operatorMcpAccountAnalyticsRegistry"')) {
  lifecycleErrors.push("operator_mcp_account_analytics_registry_import_missing");
}
if (source.includes("const OPERATOR_MCP_TOOLS:")
    || source.includes('{ name: "get_post_results"')
    || source.includes('{ name: "get_monthly_growth_review"')
    || source.includes('{ name: "get_performance_learning"')
    || source.includes('{ name: "get_manifest_intelligence_audit"')
    || source.includes('{ name: "get_content_focus"')) {
  lifecycleErrors.push("operator_mcp_static_account_registry_returned_to_index");
}
if (!operatorMcpAccountAnalyticsRegistry.includes("export const OPERATOR_MCP_ACCOUNT_ANALYTICS_TOOL_NAMES")
    || !operatorMcpAccountAnalyticsRegistry.includes("export type OperatorMcpAccountAnalyticsToolName")
    || !operatorMcpAccountAnalyticsRegistry.includes("export const OPERATOR_MCP_ACCOUNT_ANALYTICS_TOOLS")) {
  lifecycleErrors.push("operator_mcp_account_analytics_registry_module_incomplete");
}
if (!operatorMcpAccountAnalyticsRegistryTests.includes("preserves the exact ordered five-tool account analytics registry")
    || !operatorMcpAccountAnalyticsRegistryTests.includes("preserves compact post-result verification and date-bounded growth review")
    || !operatorMcpAccountAnalyticsRegistryTests.includes("preserves maturity-normalized learning without follower attribution")
    || !operatorMcpAccountAnalyticsRegistryTests.includes("preserves bounded intelligence-audit pagination")
    || !operatorMcpAccountAnalyticsRegistryTests.includes("preserves persisted Content Focus reads")) {
  lifecycleErrors.push("operator_mcp_account_analytics_registry_tests_incomplete");
}
if (!source.includes('from "./operatorMcpRegistryComposition"')) {
  lifecycleErrors.push("operator_mcp_registry_composition_import_missing");
}
if (source.includes("const OPERATOR_MCP_ACCOUNT_TOOLS:")
    || source.includes("const OPERATOR_MCP_ADMIN_TOOL_NAME_SET")
    || source.includes("const OPERATOR_MCP_ENGINEERING_TOOL_NAME_SET")
    || source.includes("const ACCOUNT_SCOPED_MCP_ADMIN_TOOLS")
    || source.includes("function isOperatorMcpAdminToolName(")
    || source.includes("function isOperatorMcpEngineeringToolName(")
    || source.includes("function operatorMcpToolNameRequiresProceed(")
    || source.includes("const directPriority = new Map(")
    || source.includes("buildOperatorMcpToolDefinitions({")) {
  lifecycleErrors.push("operator_mcp_registry_composition_returned_to_index");
}
if (!source.includes("assertClientSafetyRegistry();")
    || !source.includes("return buildComposedOperatorMcpTools(includeScopedWrappers);")) {
  lifecycleErrors.push("operator_mcp_registry_runtime_boundary_incomplete");
}
if (!operatorMcpRegistryComposition.includes("OPERATOR_MCP_ADMIN_TOOL_NAMES")
    || !operatorMcpRegistryComposition.includes("OPERATOR_MCP_ENGINEERING_TOOL_NAMES")
    || !operatorMcpRegistryComposition.includes("export const OPERATOR_MCP_ACCOUNT_TOOLS")
    || !operatorMcpRegistryComposition.includes("export const OPERATOR_MCP_ADMIN_TOOL_NAME_SET")
    || !operatorMcpRegistryComposition.includes("export const OPERATOR_MCP_ENGINEERING_TOOL_NAME_SET")
    || !operatorMcpRegistryComposition.includes("export const OPERATOR_MCP_DIRECT_PRIORITIES")
    || !operatorMcpRegistryComposition.includes("export function operatorMcpToolNameRequiresProceed")
    || !operatorMcpRegistryComposition.includes("export function buildComposedOperatorMcpTools")) {
  lifecycleErrors.push("operator_mcp_registry_composition_module_incomplete");
}
if (!operatorMcpRegistryCompositionTests.includes("preserves the exact 55-tool account aggregation order")
    || !operatorMcpRegistryCompositionTests.includes("preserves engineering, admin, and intentional monthly-growth classifications")
    || !operatorMcpRegistryCompositionTests.includes("preserves guided Proceed membership without blocking list_accounts")
    || !operatorMcpRegistryCompositionTests.includes("builds the exact 112 direct tools with deterministic priority ordering")
    || !operatorMcpRegistryCompositionTests.includes("builds all three scoped account wrapper surfaces without brand_key")) {
  lifecycleErrors.push("operator_mcp_registry_composition_tests_incomplete");
}
if (!source.includes('from "./operatorMcpRoutingPolicy"')
    || !source.includes("admitOperatorRuntimeToolCall,")
    || !source.includes("dispatchOperatorManifestRuntimeTool,")
    || !source.includes("const OPERATOR_MCP_ROUTING_POLICY = createOperatorMcpRoutingPolicy")) {
  lifecycleErrors.push("operator_mcp_routing_policy_import_or_binding_missing");
}
const operatorToolHandlerStart = source.indexOf("async function handleOperatorTool(");
const operatorToolHandlerDispatchStart = source.indexOf(
  "const manifestRuntimeDispatch = await dispatchOperatorManifestRuntimeTool(",
  operatorToolHandlerStart,
);
const operatorToolAdmissionShell = operatorToolHandlerStart >= 0
  && operatorToolHandlerDispatchStart > operatorToolHandlerStart
  ? source.slice(operatorToolHandlerStart, operatorToolHandlerDispatchStart)
  : "";
if (!operatorToolAdmissionShell.includes("admitOperatorRuntimeToolCall({ request, toolName }")
    || !operatorToolAdmissionShell.includes("retiredToolNames: RETIRED_HUMAN_GUIDANCE_TOOL_NAMES")
    || !operatorToolAdmissionShell.includes("accountDirectoryResponse: async ()")
    || !operatorToolAdmissionShell.includes("resolveBrand: (payload) => resolveOperatorBrandFromPayload(env, payload)")
    || !operatorToolAdmissionShell.includes('if (admission.kind === "response") return admission.response')) {
  lifecycleErrors.push("operator_runtime_admission_cutover_incomplete");
}
const operatorAccountStateDispatchStart = source.indexOf(
  "const accountCoverageRuntimeDispatch = await dispatchOperatorKeyedRuntimeTool(",
  operatorToolHandlerDispatchStart,
);
const operatorManifestRuntimeShell = operatorToolHandlerDispatchStart >= 0
  && operatorAccountStateDispatchStart > operatorToolHandlerDispatchStart
  ? source.slice(operatorToolHandlerDispatchStart, operatorAccountStateDispatchStart)
  : "";
if (!operatorManifestRuntimeShell.includes("dispatchOperatorManifestRuntimeTool({")
    || !operatorManifestRuntimeShell.includes("isCycleServiceToolName: isOperatorManifestCycleServiceToolName")
    || !operatorManifestRuntimeShell.includes("handleCycleService:")
    || !operatorManifestRuntimeShell.includes("prepare: (servicePayload) => prepareManifestAutonomousCycle")
    || !operatorManifestRuntimeShell.includes("persist: (servicePayload) => persistManifestAutonomousPost")
    || !operatorManifestRuntimeShell.includes("review: (servicePayload) => reviewManifestScheduledPost")
    || !operatorManifestRuntimeShell.includes("if (manifestRuntimeDispatch.handled)")) {
  lifecycleErrors.push("operator_manifest_runtime_dispatch_cutover_incomplete");
}
if (operatorManifestRuntimeShell.includes("if (isOperatorManifestCycleServiceToolName(toolName))")
    || operatorManifestRuntimeShell.includes('if (toolName === "prepare_manifest_autonomous_cycle")')
    || operatorManifestRuntimeShell.includes('if (toolName === "commit_manifest_autonomous_runway")')
    || operatorManifestRuntimeShell.includes('if (toolName === "persist_manifest_autonomous_post")')
    || operatorManifestRuntimeShell.includes('if (toolName === "review_manifest_scheduled_post")')) {
  lifecycleErrors.push("operator_manifest_runtime_dispatch_returned_to_index");
}
const operatorClaimReviewDispatchStart = source.indexOf(
  "const claimReviewRuntimeDispatch = await dispatchOperatorKeyedRuntimeTool(",
  operatorAccountStateDispatchStart,
);
const operatorAccountCoverageRuntimeShell = operatorAccountStateDispatchStart >= 0
  && operatorClaimReviewDispatchStart > operatorAccountStateDispatchStart
  ? source.slice(operatorAccountStateDispatchStart, operatorClaimReviewDispatchStart)
  : "";
if (!operatorAccountCoverageRuntimeShell.includes("dispatchOperatorKeyedRuntimeTool(toolName, {")
    || !operatorAccountCoverageRuntimeShell.includes("get_account_state: async () =>")
    || !operatorAccountCoverageRuntimeShell.includes("read_lensically_ui_surface: async () =>")
    || !operatorAccountCoverageRuntimeShell.includes("discard_manifest_review_batch: async () =>")
    || !operatorAccountCoverageRuntimeShell.includes("get_hourly_coverage: async () =>")
    || !operatorAccountCoverageRuntimeShell.includes("if (accountCoverageRuntimeDispatch.handled)")) {
  lifecycleErrors.push("operator_account_coverage_runtime_dispatch_cutover_incomplete");
}
if (operatorAccountCoverageRuntimeShell.includes('if (toolName === "get_account_state")')
    || operatorAccountCoverageRuntimeShell.includes('if (toolName === "read_lensically_ui_surface")')
    || operatorAccountCoverageRuntimeShell.includes('if (toolName === "discard_manifest_review_batch")')
    || operatorAccountCoverageRuntimeShell.includes('if (toolName === "get_hourly_coverage")')) {
  lifecycleErrors.push("operator_account_coverage_runtime_dispatch_returned_to_index");
}
const operatorReviewOperationsDispatchStart = source.indexOf(
  "const reviewOperationsRuntimeDispatch = await dispatchOperatorKeyedRuntimeTool(",
  operatorClaimReviewDispatchStart,
);
const operatorClaimReviewRuntimeShell = operatorClaimReviewDispatchStart >= 0
  && operatorReviewOperationsDispatchStart > operatorClaimReviewDispatchStart
  ? source.slice(operatorClaimReviewDispatchStart, operatorReviewOperationsDispatchStart)
  : "";
if (!operatorClaimReviewRuntimeShell.includes("claim_manifest_review_batch: async () =>")
    || !operatorClaimReviewRuntimeShell.includes("claimOperatorManifestReviewBatch({")
    || !operatorClaimReviewRuntimeShell.includes("insertDailyClaim: async")
    || !operatorClaimReviewRuntimeShell.includes("if (claimReviewRuntimeDispatch.handled)")) {
  lifecycleErrors.push("operator_review_batch_claim_runtime_cutover_incomplete");
}
if (operatorClaimReviewRuntimeShell.includes('if (toolName === "claim_manifest_review_batch")')
    || operatorClaimReviewRuntimeShell.includes("const terminalExistingReview")
    || operatorClaimReviewRuntimeShell.includes("const loadAvailableSelections")
    || operatorClaimReviewRuntimeShell.includes("source_batch_rollover_failed")
    || operatorClaimReviewRuntimeShell.includes("no_unclaimed_sources_available")) {
  lifecycleErrors.push("operator_review_batch_claim_logic_returned_to_index");
}
const operatorWorkflowSessionDispatchStart = source.indexOf(
  "const workflowContextSourceRuntimeDispatch = await dispatchOperatorKeyedRuntimeTool(",
  operatorReviewOperationsDispatchStart,
);
const operatorReviewOperationsRuntimeShell = operatorReviewOperationsDispatchStart >= 0
  && operatorWorkflowSessionDispatchStart > operatorReviewOperationsDispatchStart
  ? source.slice(operatorReviewOperationsDispatchStart, operatorWorkflowSessionDispatchStart)
  : "";
if (!operatorReviewOperationsRuntimeShell.includes("dispatchOperatorKeyedRuntimeTool(toolName, {")
    || !operatorReviewOperationsRuntimeShell.includes("get_manifest_review_batch: async () =>")
    || !operatorReviewOperationsRuntimeShell.includes("attach_manifest_review_draft: async () =>")
    || !operatorReviewOperationsRuntimeShell.includes("skip_manifest_review_source: async () =>")
    || !operatorReviewOperationsRuntimeShell.includes("schedule_manifest_review_batch: async () =>")
    || !operatorReviewOperationsRuntimeShell.includes("if (reviewOperationsRuntimeDispatch.handled)")) {
  lifecycleErrors.push("operator_review_operations_runtime_dispatch_cutover_incomplete");
}
if (operatorReviewOperationsRuntimeShell.includes('if (toolName === "get_manifest_review_batch")')
    || operatorReviewOperationsRuntimeShell.includes('if (toolName === "attach_manifest_review_draft")')
    || operatorReviewOperationsRuntimeShell.includes('if (toolName === "skip_manifest_review_source")')
    || operatorReviewOperationsRuntimeShell.includes('if (toolName === "schedule_manifest_review_batch")')) {
  lifecycleErrors.push("operator_review_operations_runtime_dispatch_returned_to_index");
}
const operatorSourceDrawDispatchStart = source.indexOf(
  'if (toolName === "draw_source_candidate_batch")',
  operatorWorkflowSessionDispatchStart,
);
const operatorWorkflowContextSourceRuntimeShell = operatorWorkflowSessionDispatchStart >= 0
  && operatorSourceDrawDispatchStart > operatorWorkflowSessionDispatchStart
  ? source.slice(operatorWorkflowSessionDispatchStart, operatorSourceDrawDispatchStart)
  : "";
if (!operatorWorkflowContextSourceRuntimeShell.includes("dispatchOperatorKeyedRuntimeTool(toolName, {")
    || !operatorWorkflowContextSourceRuntimeShell.includes("start_workflow_session: async () =>")
    || !operatorWorkflowContextSourceRuntimeShell.includes("admit_context: async () =>")
    || !operatorWorkflowContextSourceRuntimeShell.includes("get_production_board: async () =>")
    || !operatorWorkflowContextSourceRuntimeShell.includes("list_source_candidates: async () =>")
    || !operatorWorkflowContextSourceRuntimeShell.includes("delete_saved_pattern_source: async () =>")
    || !operatorWorkflowContextSourceRuntimeShell.includes("if (workflowContextSourceRuntimeDispatch.handled)")) {
  lifecycleErrors.push("operator_workflow_context_source_runtime_dispatch_cutover_incomplete");
}
if (operatorWorkflowContextSourceRuntimeShell.includes('if (toolName === "start_workflow_session")')
    || operatorWorkflowContextSourceRuntimeShell.includes('if (toolName === "admit_context")')
    || operatorWorkflowContextSourceRuntimeShell.includes('if (toolName === "get_production_board")')
    || operatorWorkflowContextSourceRuntimeShell.includes('if (toolName === "list_source_candidates")')
    || operatorWorkflowContextSourceRuntimeShell.includes('if (toolName === "delete_saved_pattern_source")')) {
  lifecycleErrors.push("operator_workflow_context_source_runtime_dispatch_returned_to_index");
}
if (operatorToolAdmissionShell.includes("if (!isGptRequestAuthorized(request, env)")
    || operatorToolAdmissionShell.includes("const canonicalToolName = OPERATOR_MCP_ROUTING_POLICY.canonicalScopedToolName(toolName)")
    || operatorToolAdmissionShell.includes("RETIRED_HUMAN_GUIDANCE_TOOL_NAMES.has(canonicalToolName)")
    || operatorToolAdmissionShell.includes("const scopedCall = OPERATOR_MCP_ROUTING_POLICY.scopeCall(toolName, payload)")
    || operatorToolAdmissionShell.includes('if (toolName === "list_accounts")')
    || operatorToolAdmissionShell.includes("const brand = await resolveOperatorBrandFromPayload(env, payload)")) {
  lifecycleErrors.push("operator_runtime_admission_returned_to_index");
}
if (source.includes("function requestedMcpBrandKey(")
    || source.includes("function operatorMcpCallRequiresProceed(")
    || source.includes("function operatorMcpProceedConfirmed(")
    || source.includes("function canonicalOperatorExecutionArgs(")
    || source.includes("function canonicalAutonomyToolName(")
    || source.includes('toolName.replace(/^(?:mm_|om_|vx_)/')
    || source.includes('payload.brand_key = "manifestmental"')
    || source.includes('payload.brand_key = "opmgdeadman"')) {
  lifecycleErrors.push("operator_mcp_routing_policy_returned_to_index");
}
if (!operatorToolAdmissionShell.includes("scopeCall: OPERATOR_MCP_ROUTING_POLICY.scopeCall")
    || !source.includes("OPERATOR_MCP_ROUTING_POLICY.callRequiresProceed(toolName, args)")
    || !source.includes("OPERATOR_MCP_ROUTING_POLICY.canonicalExecutionArgs(toolName, args)")
    || !operatorMcpToolCallDispatcher.includes("dependencies.classifyHandler(toolName)")) {
  lifecycleErrors.push("operator_mcp_routing_policy_runtime_cutover_incomplete");
}
if (!operatorMcpRoutingPolicy.includes("export function canonicalScopedOperatorMcpToolName")
    || !operatorMcpRoutingPolicy.includes("export function scopeOperatorMcpToolCall")
    || !operatorMcpRoutingPolicy.includes("export function requestedMcpBrandKey")
    || !operatorMcpRoutingPolicy.includes("export function operatorMcpCallRequiresProceed")
    || !operatorMcpRoutingPolicy.includes("export function canonicalOperatorExecutionArgs")
    || !operatorMcpRoutingPolicy.includes("export function canonicalAutonomyToolName")
    || !operatorMcpRoutingPolicy.includes("export function classifyOperatorMcpHandler")
    || !operatorMcpRoutingPolicy.includes("export function createOperatorMcpRoutingPolicy")
        || !operatorMcpRoutingPolicy.includes("export async function admitOperatorRuntimeToolCall")
        || !operatorMcpRoutingPolicy.includes("export async function dispatchOperatorKeyedRuntimeTool")
    || !operatorMcpRoutingPolicy.includes("handlers[toolName]")
    || !operatorMcpRoutingPolicy.includes("status: result.status ?? 200")
    || !operatorMcpRoutingPolicy.includes("export async function dispatchOperatorManifestRuntimeTool")
    || !operatorMcpRoutingPolicy.includes('toolName === "prepare_manifest_autonomous_cycle"')
    || !operatorMcpRoutingPolicy.includes('toolName === "persist_manifest_autonomous_post"')
    || !operatorMcpRoutingPolicy.includes("side_effect_state: \"unknown\"")
    || !operatorMcpRoutingPolicy.includes("dependencies.retiredToolNames.has(canonicalToolName)")
    || !operatorMcpRoutingPolicy.includes('scopedCall.tool_name === "list_accounts"')
    || !operatorMcpRoutingPolicy.includes("dependencies.resolveBrand(payload)")) {
  lifecycleErrors.push("operator_mcp_routing_policy_module_incomplete");
}
if (!operatorMcpRoutingPolicyTests.includes("preserves scoped wrapper canonicalization and account injection")
    || !operatorMcpRoutingPolicyTests.includes("preserves scoped precedence and direct brand alias normalization")
    || !operatorMcpRoutingPolicyTests.includes("preserves guided Proceed requirements and autonomous exemptions")
    || !operatorMcpRoutingPolicyTests.includes("preserves nested alias canonicalization and strips execution metadata")
    || !operatorMcpRoutingPolicyTests.includes("preserves autonomy canonical names and handler classification")
    || !operatorMcpRoutingPolicyTests.includes("binds injected normalizers into one deterministic routing policy")
    || !operatorMcpRoutingPolicyTests.includes("stops unauthorized requests before routing work")
    || !operatorMcpRoutingPolicyTests.includes("retires canonical tools before preparation or payload reads")
    || !operatorMcpRoutingPolicyTests.includes("preserves scoped payload admission and brand resolution order")
    || !operatorMcpRoutingPolicyTests.includes("serves the account directory without brand resolution")
        || !operatorMcpRoutingPolicyTests.includes("returns the exact missing-brand response after scoped admission")
    || !operatorMcpRoutingPolicyTests.includes("routes cycle-service tools before autonomous branches")
    || !operatorMcpRoutingPolicyTests.includes("observes successful autonomous preparation")
    || !operatorMcpRoutingPolicyTests.includes("normalizes preparation exceptions through cycle observation")
    || !operatorMcpRoutingPolicyTests.includes("preserves the retired monolithic commit response")
    || !operatorMcpRoutingPolicyTests.includes("normalizes ambiguous persistence exceptions without retrying")
        || !operatorMcpRoutingPolicyTests.includes("routes scheduled review and leaves unrelated tools unhandled")
    || !operatorMcpRoutingPolicyTests.includes("executes only the exact matching handler and preserves explicit status")
    || !operatorMcpRoutingPolicyTests.includes("defaults handled responses to 200 and leaves unknown tools untouched")) {
  lifecycleErrors.push("operator_mcp_routing_policy_tests_incomplete");
}
if (!source.includes('from "./operatorMcpTransport"')) {
  lifecycleErrors.push("operator_mcp_transport_import_missing");
}
if (source.includes("function mcpJsonResponse(")
    || source.includes("function mcpErrorResponse(")
    || source.includes("structuredContent:")) {
  lifecycleErrors.push("operator_mcp_transport_shaping_returned_to_index");
}
if (!source.includes("return buildOperatorMcpRuntimeHeaders({")
    || !source.includes("return operatorTransportFailureResponse({")
    || !operatorMcpToolCallDispatcher.includes("return mcpToolCompletionResponse(id, toolName, resultPayload, isError);")
    || !operatorMcpToolCallDispatcher.includes("mcpToolResultResponse(")) {
  lifecycleErrors.push("operator_mcp_transport_runtime_cutover_incomplete");
}
if (!operatorMcpTransport.includes("export function mcpJsonResponse")
    || !operatorMcpTransport.includes("export function mcpErrorResponse")
    || !operatorMcpTransport.includes("export function buildMcpToolResultEnvelope")
    || !operatorMcpTransport.includes("export function mcpToolResultResponse")
    || !operatorMcpTransport.includes("export function buildOperatorMcpToolCompletionText")
    || !operatorMcpTransport.includes("export function mcpToolCompletionResponse")
    || !operatorMcpTransport.includes("export function buildOperatorMcpRuntimeHeaders")
    || !operatorMcpTransport.includes("export function operatorTransportFailureResponse")) {
  lifecycleErrors.push("operator_mcp_transport_module_incomplete");
}
if (!operatorMcpTransportTests.includes("preserves JSON status, cache, content type, and extra headers")
    || !operatorMcpTransportTests.includes("preserves JSON-RPC errors, null IDs, optional data, and request IDs")
    || !operatorMcpTransportTests.includes("preserves exact MCP tool-result envelopes and response shaping")
    || !operatorMcpTransportTests.includes("preserves canonical completion and failure language")
    || !operatorMcpTransportTests.includes("preserves deployment, commit, kernel, and optional session headers")
    || !operatorMcpTransportTests.includes("preserves bounded transport failures and runtime evidence")) {
  lifecycleErrors.push("operator_mcp_transport_tests_incomplete");
}
if (!source.includes('from "./operatorMcpDispatcher"')
    || !source.includes("return dispatchOperatorMcpRequest(request, {")) {
  lifecycleErrors.push("operator_mcp_dispatcher_import_or_binding_missing");
}
if (source.includes("type JsonRpcRequest =")
    || source.includes("const message = await request.json().catch")
    || source.includes('if (method === "initialize")')
    || source.includes('if (method === "notifications/initialized")')
    || source.includes('if (method === "ping")')
    || source.includes('if (method === "tools/list")')
    || source.includes('return mcpErrorResponse(id, -32601, "Method not found")')
    || source.includes("Internal MCP error:")) {
  lifecycleErrors.push("operator_mcp_dispatcher_shell_returned_to_index");
}
if (!source.includes("async function handleOperatorMcpToolCall(")
    || !source.includes("handleToolCall: ({ request: candidate, id, params }) => handleOperatorMcpToolCall(candidate, env, id, params)")
    || !source.includes("runtimeMetadata: () => operatorRuntimeMetadata(env)")) {
  lifecycleErrors.push("operator_mcp_dispatcher_runtime_cutover_incomplete");
}
if (!operatorMcpDispatcher.includes("export async function dispatchOperatorMcpRequest")
    || !operatorMcpDispatcher.includes('if (request.method !== "POST")')
    || !operatorMcpDispatcher.includes("const message = await request.json().catch")
    || !operatorMcpDispatcher.includes('if (method === "initialize")')
    || !operatorMcpDispatcher.includes('if (method === "notifications/initialized")')
    || !operatorMcpDispatcher.includes('if (method === "ping")')
    || !operatorMcpDispatcher.includes('if (method === "tools/list")')
    || !operatorMcpDispatcher.includes('if (method === "tools/call")')
    || !operatorMcpDispatcher.includes('return mcpErrorResponse(id, -32601, "Method not found")')
    || !operatorMcpDispatcher.includes("Internal MCP error:")) {
  lifecycleErrors.push("operator_mcp_dispatcher_module_incomplete");
}
if (!operatorMcpDispatcherTests.includes("preserves POST-only admission and authorization")
    || !operatorMcpDispatcherTests.includes("preserves parse and invalid-request JSON-RPC errors")
    || !operatorMcpDispatcherTests.includes("preserves initialize and deployment-scoped session headers")
    || !operatorMcpDispatcherTests.includes("preserves stale-session replacement and initialized notification")
    || !operatorMcpDispatcherTests.includes("preserves ping, tools/list, and tools/call delegation")
    || !operatorMcpDispatcherTests.includes("preserves unsupported-method and bounded internal-error shaping")) {
  lifecycleErrors.push("operator_mcp_dispatcher_tests_incomplete");
}
if (!source.includes('from "./operatorMcpToolCallDispatcher"')
    || !source.includes("return dispatchOperatorMcpToolCall({ request, id, params }, {")) {
  lifecycleErrors.push("operator_mcp_tool_call_dispatcher_import_or_binding_missing");
}
if (source.includes("const directPublicEntry")
    || source.includes("const sourceDefinedStaticRoute")
    || source.includes("const idempotencyKey = sourceDefinedDirectEngineering")
    || source.includes("const autonomyAuthorization = sourceDefinedDirectEngineering")
    || source.includes("resultPayload.operator_action_closure")) {
  lifecycleErrors.push("operator_mcp_tool_call_state_machine_returned_to_index");
}
if (!operatorMcpToolCallDispatcher.includes("export async function dispatchOperatorMcpToolCall")
    || !operatorMcpToolCallDispatcher.includes("const directPublicEntry = dependencies.isPublicDirectToolName")
    || !operatorMcpToolCallDispatcher.includes("const sourceDefinedStaticRoute = directPublicEntry")
    || !operatorMcpToolCallDispatcher.includes("const idempotencyKey = sourceDefinedDirectEngineering")
    || !operatorMcpToolCallDispatcher.includes("const autonomyAuthorization: OperatorMcpAutonomyAuthorization")
    || !operatorMcpToolCallDispatcher.includes("dependencies.classifyHandler(toolName)")
    || !operatorMcpToolCallDispatcher.includes("resultPayload.operator_action_closure")
    || !operatorMcpToolCallDispatcher.includes("return mcpToolCompletionResponse(id, toolName, resultPayload, isError);")) {
  lifecycleErrors.push("operator_mcp_tool_call_dispatcher_module_incomplete");
}
if (!operatorMcpToolCallDispatcherTests.includes("preserves direct-public admission and rejects hidden routes")
    || !operatorMcpToolCallDispatcherTests.includes("preserves registered gateway compilation failures")
    || !operatorMcpToolCallDispatcherTests.includes("preserves proven pre-call redirects before execution")
    || !operatorMcpToolCallDispatcherTests.includes("preserves completed idempotency replay without re-execution")
    || !operatorMcpToolCallDispatcherTests.includes("preserves autonomy blocking before handler execution")
    || !operatorMcpToolCallDispatcherTests.includes("preserves handler completion, hardening intake, and action closure")) {
  lifecycleErrors.push("operator_mcp_tool_call_dispatcher_tests_incomplete");
}
if (!source.includes('from "./operatorManifestCycleService"')
    || !source.includes("isCycleServiceToolName: isOperatorManifestCycleServiceToolName")
    || !source.includes("handleCycleService: (serviceToolName, servicePayload) => handleOperatorManifestCycleServiceTool({")
    || !source.includes("buildCycleReceiptRead: (receipt, section, offset, limit)")
    || !source.includes("readIntelligenceFoundation: (brandKey)")
    || !source.includes("readPerformanceLearning: (brandKey, includePosts)")
    || !source.includes("readIntelligenceAudit: ({ brandKey, section, offset, limit })")
    || !source.includes("readContentFocus: (brandKey)")) {
  lifecycleErrors.push("operator_manifest_cycle_service_import_or_binding_missing");
}
if (source.includes('error: "complete_cycle_strategy_required"')
    || source.includes('"manifest_cycle_receipt_not_found"')
    || source.includes('eventType: "cycle_strategy_locked"')
    || source.includes('completion_trigger: "last_blocking_defect_resolved"')
        || source.includes("const receiptRead = receipt")
    || source.includes("if (receiptSection) delete receiptSection.summary")
    || source.includes("intelligence_foundation: await getManifestIntelligenceFoundation")
    || source.includes("performance_learning: await getLatestOperatorPerformanceLearning")
    || source.includes("intelligence_audit: await buildManifestMeasurementAuditRead")
    || source.includes("content_focus: await getLatestOperatorContentFocus")) {
  lifecycleErrors.push("operator_manifest_cycle_service_returned_to_index");
}
if (!operatorManifestCycleService.includes("export const OPERATOR_MANIFEST_CYCLE_SERVICE_TOOL_NAMES")
    || !operatorManifestCycleService.includes("export function isOperatorManifestCycleServiceToolName")
    || !operatorManifestCycleService.includes("export async function handleOperatorManifestCycleServiceTool")
        || !operatorManifestCycleService.includes('toolName === "get_manifest_cycle_analysis_page"')
        || !operatorManifestCycleService.includes('toolName === "get_manifest_cycle_receipt"')
    || !operatorManifestCycleService.includes("dependencies.buildCycleReceiptRead")
    || !operatorManifestCycleService.includes("cycle_receipt: receiptRead?.summary ?? null")
    || !operatorManifestCycleService.includes('toolName === "get_manifest_intelligence_foundation"')
    || !operatorManifestCycleService.includes("dependencies.readIntelligenceFoundation")
    || !operatorManifestCycleService.includes('toolName === "get_performance_learning"')
    || !operatorManifestCycleService.includes("dependencies.readPerformanceLearning")
    || !operatorManifestCycleService.includes('toolName === "get_manifest_intelligence_audit"')
    || !operatorManifestCycleService.includes("dependencies.readIntelligenceAudit")
    || !operatorManifestCycleService.includes('toolName === "get_content_focus"')
    || !operatorManifestCycleService.includes("dependencies.readContentFocus")
    || !operatorManifestCycleService.includes('toolName === "commit_manifest_cycle_strategy"')
    || !operatorManifestCycleService.includes('toolName === "record_manifest_cycle_defect"')
    || !operatorManifestCycleService.includes("dependencies.readEvidencePage")
    || !operatorManifestCycleService.includes("dependencies.validateLockedLineup")
    || !operatorManifestCycleService.includes("dependencies.commitStrategy")
    || !operatorManifestCycleService.includes("dependencies.recordCycleDefect")
    || !operatorManifestCycleService.includes("dependencies.resolveCycleDefect")
    || !operatorManifestCycleService.includes("dependencies.finalizeCycleReceipt")
    || !operatorManifestCycleService.includes('primary_metric: "24_hour_likes"')
    || !operatorManifestCycleService.includes('completion_trigger: "last_blocking_defect_resolved"')) {
  lifecycleErrors.push("operator_manifest_cycle_service_module_incomplete");
}
if (!operatorManifestCycleServiceTests.includes("preserves bounded evidence-page validation and observed failures")
        || !operatorManifestCycleServiceTests.includes("preserves bounded cycle receipt reads and exact unavailable state")
    || !operatorManifestCycleServiceTests.includes("preserves adjacent Manifest intelligence reads and audit normalization")
    || !operatorManifestCycleServiceTests.includes("preserves complete strategy locking and source-selection metadata")
    || !operatorManifestCycleServiceTests.includes("preserves seven-stage defect validation and receipt requirements")
    || !operatorManifestCycleServiceTests.includes("preserves final defect resolution and cycle completion reconciliation")) {
  lifecycleErrors.push("operator_manifest_cycle_service_tests_incomplete");
}
if (!source.includes('from "./operatorHourlyCoverageService"')
    || !source.includes("get_hourly_coverage: async () =>")
    || !source.includes("handleOperatorHourlyCoverageService({")) {
  lifecycleErrors.push("operator_hourly_coverage_service_import_or_binding_missing");
}
if (source.includes('const driftDefectKey = `coverage-ledger-drift:')
    || source.includes('errorCode: "manifest_cycle_missing_slot_ledger_drift"')
    || source.includes('completion_trigger: "authoritative_coverage_reconciliation"')) {
  lifecycleErrors.push("operator_hourly_coverage_service_returned_to_index");
}
if (!operatorHourlyCoverageService.includes("export async function handleOperatorHourlyCoverageService")
    || !operatorHourlyCoverageService.includes("dependencies.getCoverage")
    || !operatorHourlyCoverageService.includes("dependencies.occupiedSlots")
    || !operatorHourlyCoverageService.includes("dependencies.reconcileCoverage")
    || !operatorHourlyCoverageService.includes("dependencies.recordDefect")
    || !operatorHourlyCoverageService.includes("dependencies.resolveDefect")
    || !operatorHourlyCoverageService.includes("dependencies.updateCycleCoverage")
    || !operatorHourlyCoverageService.includes("dependencies.readNextPlanItem")
    || !operatorHourlyCoverageService.includes("dependencies.finalizeCycleReceipt")
    || !operatorHourlyCoverageService.includes('completion_trigger: "authoritative_coverage_reconciliation"')
    || !operatorHourlyCoverageService.includes('eventType: "coverage_reconciled"')) {
  lifecycleErrors.push("operator_hourly_coverage_service_module_incomplete");
}
if (!operatorHourlyCoverageServiceTests.includes("preserves generic bounded hourly coverage reads for every brand")
    || !operatorHourlyCoverageServiceTests.includes("repairs authoritative Manifest ledger drift and selects the next locked plan item")
    || !operatorHourlyCoverageServiceTests.includes("finalizes complete coverage while ignoring elapsed unfilled slots")) {
  lifecycleErrors.push("operator_hourly_coverage_service_tests_incomplete");
}
if (!source.includes('from "./operatorManifestPrepareCheckpointService"')
    || !source.includes("handleOperatorManifestPrepareCheckpoint({")
    || !source.includes("if (checkpointResult.handled) return checkpointResult.response;")) {
  lifecycleErrors.push("operator_manifest_prepare_checkpoint_service_import_or_binding_missing");
}
if (source.includes('error: "manifest_live_collection_checkpoint_missing"')
    || source.includes('stage_completed: "manifest_intelligence_semantic"')
    || source.includes('stage_completed: "manifest_intelligence_learning_batch"')
    || source.includes('next_stage: "manifest_measurement_audit"')) {
  lifecycleErrors.push("operator_manifest_prepare_checkpoint_service_returned_to_index");
}
if (!operatorManifestPrepareCheckpointService.includes("export async function handleOperatorManifestPrepareCheckpoint")
    || !operatorManifestPrepareCheckpointService.includes("dependencies.getAutonomyProfile")
    || !operatorManifestPrepareCheckpointService.includes("dependencies.readCheckpoint")
    || !operatorManifestPrepareCheckpointService.includes("dependencies.refreshThreadsSnapshot")
    || !operatorManifestPrepareCheckpointService.includes("dependencies.refreshIntelligenceEngine")
    || !operatorManifestPrepareCheckpointService.includes("dependencies.refreshMeasurementAudit")
    || !operatorManifestPrepareCheckpointService.includes("dependencies.refreshContentFocus")
    || !operatorManifestPrepareCheckpointService.includes('phase: "learning_observations"')
    || !operatorManifestPrepareCheckpointService.includes('phase: "cycle_construction"')) {
  lifecycleErrors.push("operator_manifest_prepare_checkpoint_service_module_incomplete");
}
if (!operatorManifestPrepareCheckpointServiceTests.includes("preserves admission and idempotency mismatch blocking")
    || !operatorManifestPrepareCheckpointServiceTests.includes("checkpoints bounded live collection before evaluator recomputation")
    || !operatorManifestPrepareCheckpointServiceTests.includes("persists bounded learning continuation offsets")
    || !operatorManifestPrepareCheckpointServiceTests.includes("finalizes Content Focus and returns cycle-construction context")) {
  lifecycleErrors.push("operator_manifest_prepare_checkpoint_service_tests_incomplete");
}
if (!source.includes('from "./operatorManifestCycleConstructionService"')
    || !source.includes("constructOperatorManifestAutonomousCycle({")
    || !source.includes("growthEngineVersion: MANIFEST_AUTONOMOUS_GROWTH_ENGINE_VERSION")) {
  lifecycleErrors.push("operator_manifest_cycle_construction_service_import_or_binding_missing");
}
if (source.includes('invocation_mode: "model_orchestrated_autonomous_cycle"')
    || source.includes("original_model_posts_forbidden: true")
    || source.includes('collision_behavior: "Treat an occupied slot as nonfatal')) {
  lifecycleErrors.push("operator_manifest_cycle_construction_service_returned_to_index");
}
if (!operatorManifestCycleConstructionService.includes("export async function constructOperatorManifestAutonomousCycle")
    || !operatorManifestCycleConstructionService.includes("dependencies.resolveClock")
    || !operatorManifestCycleConstructionService.includes("dependencies.buildCoverage")
    || !operatorManifestCycleConstructionService.includes("dependencies.refreshSavedPatternIntelligence")
    || !operatorManifestCycleConstructionService.includes("dependencies.selectSourceLineup")
    || !operatorManifestCycleConstructionService.includes("dependencies.buildRollingEvidence")
    || !operatorManifestCycleConstructionService.includes("dependencies.beginCycleReceipt")
    || !operatorManifestCycleConstructionService.includes('eventType: "cycle_prepared"')
    || !operatorManifestCycleConstructionService.includes("original_model_posts_forbidden: true")) {
  lifecycleErrors.push("operator_manifest_cycle_construction_service_module_incomplete");
}
if (!operatorManifestCycleConstructionServiceTests.includes("constructs a new authoritative cycle and locks only eligible source cards")
    || !operatorManifestCycleConstructionServiceTests.includes("refreshes an existing cycle with a compact cycle and decision reference")
    || !operatorManifestCycleConstructionServiceTests.includes("completes a fully occupied horizon without source-plan work")) {
  lifecycleErrors.push("operator_manifest_cycle_construction_service_tests_incomplete");
}
if (!source.includes('from "./operatorManifestPersistenceAdmissionService"')
    || !source.includes("admitOperatorManifestPersistence({")
    || !source.includes("registerExperimentAssignment: (input)")) {
  lifecycleErrors.push("operator_manifest_persistence_admission_service_import_or_binding_missing");
}
if (source.includes("replayed_persist_event: true")
    || source.includes("candidate_requires_reslot: liveMissing.length > 0")
    || source.includes('eventType: "post_reused"')) {
  lifecycleErrors.push("operator_manifest_persistence_admission_service_returned_to_index");
}
if (!operatorManifestPersistenceAdmissionService.includes("export async function admitOperatorManifestPersistence")
    || !operatorManifestPersistenceAdmissionService.includes("dependencies.getCycleStrategy")
    || !operatorManifestPersistenceAdmissionService.includes("dependencies.getEvidenceConsumption")
    || !operatorManifestPersistenceAdmissionService.includes("dependencies.getCyclePlanItem")
    || !operatorManifestPersistenceAdmissionService.includes("dependencies.buildCoverage")
    || !operatorManifestPersistenceAdmissionService.includes("dependencies.getPublishLineage")
    || !operatorManifestPersistenceAdmissionService.includes("replayed_persist_event: true")
    || !operatorManifestPersistenceAdmissionService.includes('eventType: "post_reused"')) {
  lifecycleErrors.push("operator_manifest_persistence_admission_service_module_incomplete");
}
if (!operatorManifestPersistenceAdmissionServiceTests.includes("rejects candidates that do not match the locked cycle plan")
    || !operatorManifestPersistenceAdmissionServiceTests.includes("returns a typed continuation only after every admission check passes")
    || !operatorManifestPersistenceAdmissionServiceTests.includes("reconciles an elapsed slot without treating it as a fatal persistence failure")
    || !operatorManifestPersistenceAdmissionServiceTests.includes("replays an exact prior persistence receipt without duplicating lineage mutations")
    || !operatorManifestPersistenceAdmissionServiceTests.includes("repairs and receipts an existing complete scheduled lineage")) {
  lifecycleErrors.push("operator_manifest_persistence_admission_service_tests_incomplete");
}
if (!source.includes('from "./operatorManifestPersistenceService"')
    || !source.includes("persistOperatorManifestCandidate({")
    || !source.includes("persistLineageRecords: (input)")
    || !source.includes("readLineageStatus: (input)")) {
  lifecycleErrors.push("operator_manifest_persistence_service_import_or_binding_missing");
}
if (source.includes('completion_trigger: "final_post_persisted"')
    || source.includes('eventType: "post_persisted"')
    || source.includes('error: "autonomous_lineage_incomplete_after_persist"')) {
  lifecycleErrors.push("operator_manifest_persistence_service_returned_to_index");
}
if (!operatorManifestPersistenceService.includes("export async function persistOperatorManifestCandidate")
    || !operatorManifestPersistenceService.includes("dependencies.findExactDuplicate")
    || !operatorManifestPersistenceService.includes("dependencies.analyzeRepetition")
    || !operatorManifestPersistenceService.includes("dependencies.runGateSuite")
    || !operatorManifestPersistenceService.includes("dependencies.recordGateReceipt")
    || !operatorManifestPersistenceService.includes("dependencies.persistLineageRecords")
    || !operatorManifestPersistenceService.includes("dependencies.readLineageStatus")
    || !operatorManifestPersistenceService.includes("dependencies.reconcileCoverageState")
    || !operatorManifestPersistenceService.includes("dependencies.finalizeCycleReceipt")
    || !operatorManifestPersistenceService.includes('completion_trigger: "final_post_persisted"')) {
  lifecycleErrors.push("operator_manifest_persistence_service_module_incomplete");
}
if (!operatorManifestPersistenceServiceTests.includes("blocks exact duplicate text before source and gate execution")
    || !operatorManifestPersistenceServiceTests.includes("requires explicit evidence for every canonical owner hard ban")
    || !operatorManifestPersistenceServiceTests.includes("blocks publication and records exact missing lineage stages")
    || !operatorManifestPersistenceServiceTests.includes("persists complete lineage and leaves the next authoritative slot open")
    || !operatorManifestPersistenceServiceTests.includes("finalizes the cycle when authoritative coverage is complete")) {
  lifecycleErrors.push("operator_manifest_persistence_service_tests_incomplete");
}
if (!source.includes('from "./operatorManifestScheduledReviewService"')
    || !source.includes("reviewOperatorManifestScheduledPost({")
    || !source.includes("runGenerationGates: async")
    || !source.includes("saveStrategyMemory: (input)")) {
  lifecycleErrors.push("operator_manifest_scheduled_review_service_import_or_binding_missing");
}
if (source.includes("replacement_generation_gates_failed")
    || source.includes("only_unpublished_approved_post_reviewable")
    || source.includes('operational_effect: action === "keep"')) {
  lifecycleErrors.push("operator_manifest_scheduled_review_service_returned_to_index");
}
if (!operatorManifestScheduledReviewService.includes("export async function reviewOperatorManifestScheduledPost")
    || !operatorManifestScheduledReviewService.includes("dependencies.readScheduledPost")
    || !operatorManifestScheduledReviewService.includes("dependencies.runGenerationGates")
    || !operatorManifestScheduledReviewService.includes("dependencies.runSchedulingGates")
    || !operatorManifestScheduledReviewService.includes("dependencies.updateScheduledPost")
    || !operatorManifestScheduledReviewService.includes("dependencies.updateLineup")
    || !operatorManifestScheduledReviewService.includes("dependencies.saveStrategyMemory")
    || !operatorManifestScheduledReviewService.includes('return "approved_rule"')
    || !operatorManifestScheduledReviewService.includes('return "current_belief"')) {
  lifecycleErrors.push("operator_manifest_scheduled_review_service_module_incomplete");
}
if (!operatorManifestScheduledReviewServiceTests.includes("requires a valid scheduled-post action and feedback")
    || !operatorManifestScheduledReviewServiceTests.includes("allows review only for approved unpublished scheduled posts")
    || !operatorManifestScheduledReviewServiceTests.includes("blocks a replacement when generation gates fail")
    || !operatorManifestScheduledReviewServiceTests.includes("rewrites the same scheduled slot after generation and scheduling gates pass")
    || !operatorManifestScheduledReviewServiceTests.includes("records keep feedback without a production mutation and maps permanent rules")) {
  lifecycleErrors.push("operator_manifest_scheduled_review_service_tests_incomplete");
}
if (!source.includes('from "./operatorManifestCycleObservationService"')
    || !source.includes("observeOperatorManifestCycleToolResult({")
    || !source.includes("resolveDefectsByScope: (input)")
    || !source.includes("recordDefect: (input)")) {
  lifecycleErrors.push("operator_manifest_cycle_observation_service_import_or_binding_missing");
}
if (source.includes("function manifestCycleToolScope(")
    || source.includes('resolution_mode: "successful_scoped_retry_or_reconciliation"')
    || source.includes('impactState = result.scheduled_post_id')) {
  lifecycleErrors.push("operator_manifest_cycle_observation_service_returned_to_index");
}
if (!operatorManifestCycleObservationService.includes("export function manifestCycleFailureIsDefect")
    || !operatorManifestCycleObservationService.includes("export function manifestCycleToolScope")
    || !operatorManifestCycleObservationService.includes("export async function observeOperatorManifestCycleToolResult")
    || !operatorManifestCycleObservationService.includes("dependencies.resolveDefectsByScope")
    || !operatorManifestCycleObservationService.includes("dependencies.recordDefect")
    || !operatorManifestCycleObservationService.includes('impactState = result.scheduled_post_id')
    || !operatorManifestCycleObservationService.includes('resolution_mode: "successful_scoped_retry_or_reconciliation"')) {
  lifecycleErrors.push("operator_manifest_cycle_observation_service_module_incomplete");
}
if (!operatorManifestCycleObservationServiceTests.includes("classifies expected autonomous control outcomes without defect receipts")
    || !operatorManifestCycleObservationServiceTests.includes("maps persistence and evaluator tools to deterministic cycle scopes")
    || !operatorManifestCycleObservationServiceTests.includes("resolves matching open defects after a successful scoped retry")
    || !operatorManifestCycleObservationServiceTests.includes("does not record expected gate or continuation failures")
    || !operatorManifestCycleObservationServiceTests.includes("records unexpected partially successful failures with deterministic metadata")) {
  lifecycleErrors.push("operator_manifest_cycle_observation_service_tests_incomplete");
}
if (!source.includes('from "./operatorAccountStateService"')
    || !source.includes("readOperatorAccountDirectory({")
    || !source.includes("readOperatorAccountState({")
    || !source.includes("readOperatorPostResults({")
        || !source.includes("listAccounts: () => listOperatorAccounts(env)")
    || !source.includes("getActiveSession: (brandKey)")
    || !source.includes("countScheduledPosts: async")
    || !source.includes("loadScheduledLineage: async (publishedPostId)")
    || !source.includes("insertMetricSnapshot: async (snapshot)")
    || !source.includes("listPerformanceScores: async (publishedPostId)")) {
  lifecycleErrors.push("operator_account_state_service_import_or_binding_missing");
}
const operatorAccountDirectoryHandlerStart = source.indexOf('if (toolName === "list_accounts")');
const operatorAccountDirectoryHandlerEnd = source.indexOf(
  "const brand = await resolveOperatorBrandFromPayload",
  operatorAccountDirectoryHandlerStart,
);
const operatorAccountDirectoryHandler = operatorAccountDirectoryHandlerStart >= 0
  && operatorAccountDirectoryHandlerEnd > operatorAccountDirectoryHandlerStart
  ? source.slice(operatorAccountDirectoryHandlerStart, operatorAccountDirectoryHandlerEnd)
  : "";
const operatorPostResultsHandlerStart = source.indexOf('if (toolName === "get_post_results")');
const operatorPostResultsHandlerEnd = source.indexOf(
  'return operatorJsonResponse({ success: false, error: "unknown_operator_tool"',
  operatorPostResultsHandlerStart,
);
const operatorPostResultsHandler = operatorPostResultsHandlerStart >= 0
  && operatorPostResultsHandlerEnd > operatorPostResultsHandlerStart
  ? source.slice(operatorPostResultsHandlerStart, operatorPostResultsHandlerEnd)
  : "";
if (operatorAccountDirectoryHandler.includes("accounts: await listOperatorAccounts(env)")
    || operatorAccountDirectoryHandler.includes('operating_mode: "autonomous_operator"')
    || operatorAccountDirectoryHandler.includes("human_free_autonomy: HUMAN_FREE_AUTONOMY_CONTRACT")
    || source.includes("active_workflow_session: activeSession")
    || source.includes("latest_approved_drafts: approved")
    || source.includes("active_gates_count: gates.length")
    || operatorPostResultsHandler.includes("const lineageRow = scheduled ?? draftFallback")
    || operatorPostResultsHandler.includes('response_mode: "compact"')
    || operatorPostResultsHandler.includes("follower_attribution_policy: {")
    || operatorPostResultsHandler.includes("latestSnapshot?.metrics_json !== serializedMetrics")) {
  lifecycleErrors.push("operator_account_state_service_returned_to_index");
}
if (!operatorAccountStateService.includes("export async function readOperatorAccountDirectory")
    || !operatorAccountStateService.includes("dependencies.listAccounts")
    || !operatorAccountStateService.includes('operating_mode: "autonomous_operator"')
    || !operatorAccountStateService.includes("human_free_autonomy: input.humanFreeAutonomy")
    || !operatorAccountStateService.includes("export async function readOperatorAccountState")
    || !operatorAccountStateService.includes("dependencies.getActiveSession")
    || !operatorAccountStateService.includes("dependencies.getSourceCard")
    || !operatorAccountStateService.includes("dependencies.listDraftsByStatus")
    || !operatorAccountStateService.includes("dependencies.countScheduledPosts")
    || !operatorAccountStateService.includes("dependencies.listActiveGates")
        || !operatorAccountStateService.includes("active_workflow_session: activeSession")
    || !operatorAccountStateService.includes("warnings: []")
    || !operatorAccountStateService.includes("export async function readOperatorPostResults")
    || !operatorAccountStateService.includes("dependencies.ensureArchiveTable")
    || !operatorAccountStateService.includes("const lineageRow = scheduled ?? draftFallback")
    || !operatorAccountStateService.includes('response_mode: "compact"')
    || !operatorAccountStateService.includes("dependencies.insertMetricSnapshot")
    || !operatorAccountStateService.includes("latestSnapshot?.metrics_json !== serializedMetrics")
    || !operatorAccountStateService.includes("follower_attribution_policy: {")
    || !operatorAccountStateService.includes("dependencies.listMetricHistory")) {
  lifecycleErrors.push("operator_account_state_service_module_incomplete");
}
if (!operatorAccountStateServiceTests.includes("returns the canonical account directory and autonomy contract without brand selection")
    || !operatorAccountStateServiceTests.includes("reads the selected account state and resolves its active source card")
    || !operatorAccountStateServiceTests.includes("does not read a source card when the active session has no source identity")
        || !operatorAccountStateServiceTests.includes("normalizes an unavailable scheduled count without changing the response contract")
    || !operatorAccountStateServiceTests.includes("prepares schemas before exact published-post admission")
    || !operatorAccountStateServiceTests.includes("preserves the compact lineage and generation evidence response")
    || !operatorAccountStateServiceTests.includes("persists changed metrics and returns full maturity evidence with optional history")
    || !operatorAccountStateServiceTests.includes("skips duplicate metric persistence and omitted history reads")) {
  lifecycleErrors.push("operator_account_state_service_tests_incomplete");
}
if (!source.includes('from "./operatorLensicallyUiSurfaceService"')
    || !source.includes("readOperatorLensicallyUiSurface({")
    || !source.includes("refreshFollowerSnapshot: (account, timezone)")
    || !source.includes("listSavedPatterns: async")) {
  lifecycleErrors.push("operator_lensically_ui_surface_service_import_or_binding_missing");
}
if (source.includes("unsupported_lensically_ui_surface")
    || source.includes('if (surface === "dashboard")')
    || source.includes('if (surface === "saved_patterns")')) {

  lifecycleErrors.push("operator_lensically_ui_surface_service_returned_to_index");
}
if (!operatorLensicallyUiSurfaceService.includes("export async function readOperatorLensicallyUiSurface")
    || !operatorLensicallyUiSurfaceService.includes("dependencies.getThreadsAccount")
    || !operatorLensicallyUiSurfaceService.includes("dependencies.buildDashboard")
    || !operatorLensicallyUiSurfaceService.includes("dependencies.refreshFollowerSnapshot")
    || !operatorLensicallyUiSurfaceService.includes("dependencies.fetchPostsPage")
    || !operatorLensicallyUiSurfaceService.includes("dependencies.listPostArchive")
    || !operatorLensicallyUiSurfaceService.includes("dependencies.listSavedPatterns")
    || !operatorLensicallyUiSurfaceService.includes("unsupported_lensically_ui_surface")
    || !operatorLensicallyUiSurfaceService.includes("threads_insights_upstream_failed")) {
  lifecycleErrors.push("operator_lensically_ui_surface_service_module_incomplete");
}
if (!operatorLensicallyUiSurfaceServiceTests.includes("enforces selected Threads account and dashboard token admission")
    || !operatorLensicallyUiSurfaceServiceTests.includes("maps follower snapshots into exact deltas and pagination")
    || !operatorLensicallyUiSurfaceServiceTests.includes("bounds insights cursor depth and writes first-page archive and cache state")
    || !operatorLensicallyUiSurfaceServiceTests.includes("preserves archive and missing saved-pattern pagination contracts")
    || !operatorLensicallyUiSurfaceServiceTests.includes("returns the exact unsupported-surface status and body")) {
  lifecycleErrors.push("operator_lensically_ui_surface_service_tests_incomplete");
}
if (!source.includes('from "./operatorManifestReviewBatchRetirementService"')
    || !source.includes("retireOperatorManifestReviewBatch({")
    || !source.includes("findBatch: (brandKey, reviewBatchId)")
    || !source.includes("retireBatch: (reviewBatchId, brandKey)")) {
  lifecycleErrors.push("operator_manifest_review_batch_retirement_service_import_or_binding_missing");
}
if (source.includes("source_lineage_preserved: true")
    || source.includes('reason: "no_active_review_batch"')
    || source.includes('retired: priorStatus !== "retired"')) {
  lifecycleErrors.push("operator_manifest_review_batch_retirement_service_returned_to_index");
}
if (!operatorManifestReviewBatchRetirementService.includes("export async function retireOperatorManifestReviewBatch")
    || !operatorManifestReviewBatchRetirementService.includes("dependencies.findBatch")
    || !operatorManifestReviewBatchRetirementService.includes("dependencies.retireBatch")
    || !operatorManifestReviewBatchRetirementService.includes("review_batch_not_configured_for_brand")
    || !operatorManifestReviewBatchRetirementService.includes("discard_reason_required")
    || !operatorManifestReviewBatchRetirementService.includes("source_lineage_preserved: true")) {
  lifecycleErrors.push("operator_manifest_review_batch_retirement_service_module_incomplete");
}
if (!operatorManifestReviewBatchRetirementServiceTests.includes("admits only Manifest review-batch retirement")
    || !operatorManifestReviewBatchRetirementServiceTests.includes("requires a nonempty discard reason before lookup")
    || !operatorManifestReviewBatchRetirementServiceTests.includes("returns an idempotent preserved-source result when no active batch exists")
    || !operatorManifestReviewBatchRetirementServiceTests.includes("retires an active batch while preserving source records and lineage")
    || !operatorManifestReviewBatchRetirementServiceTests.includes("preserves terminal batch status without issuing another mutation")) {
    lifecycleErrors.push("operator_manifest_review_batch_retirement_service_tests_incomplete");
}
if (!source.includes('from "./operatorManifestReviewBatchStateService"')
    || !source.includes("claimOperatorManifestReviewBatch,")
    || !source.includes("claim_manifest_review_batch: async () =>")
    || !source.includes("claimOperatorManifestReviewBatch({")
    || !source.includes("get_manifest_review_batch: async () =>")
    || !source.includes("readOperatorManifestReviewBatchState({")
    || !source.includes("findActiveReviewBatchId: async")
    || !source.includes("findActiveAutonomousCycle: (brandKey)")) {
  lifecycleErrors.push("operator_manifest_review_batch_state_service_import_or_binding_missing");
}
if (source.includes("autonomous_cycle_active: Boolean(activeAutonomousCycle)")
    || source.includes("required_route: activeAutonomousCycle")
    || source.includes("Continue the prepared autonomous cycle with exactly one model-evaluated post per persistence call.")) {
  lifecycleErrors.push("operator_manifest_review_batch_state_service_returned_to_index");
}
if (!operatorManifestReviewBatchStateService.includes("export async function readOperatorManifestReviewBatchState")
    || !operatorManifestReviewBatchStateService.includes("export async function claimOperatorManifestReviewBatch")
    || !operatorManifestReviewBatchStateService.includes("dependencies.ensureSourceBatch")
    || !operatorManifestReviewBatchStateService.includes("dependencies.insertDailyClaim")
    || !operatorManifestReviewBatchStateService.includes("dependencies.markSelectionClaimed")
    || !operatorManifestReviewBatchStateService.includes("source_batch_rollover_failed")
    || !operatorManifestReviewBatchStateService.includes("no_unclaimed_sources_available")
    || !operatorManifestReviewBatchStateService.includes("dependencies.ensureWorkflowTables")
    || !operatorManifestReviewBatchStateService.includes("dependencies.findActiveReviewBatchId")
    || !operatorManifestReviewBatchStateService.includes("dependencies.findActiveAutonomousCycle")
    || !operatorManifestReviewBatchStateService.includes("dependencies.serializeReviewBatch")
    || !operatorManifestReviewBatchStateService.includes('state: "no_active_review_batch"')
    || !operatorManifestReviewBatchStateService.includes('error: "review_batch_not_found"')) {
  lifecycleErrors.push("operator_manifest_review_batch_state_service_module_incomplete");
}
if (!operatorManifestReviewBatchStateServiceTests.includes("ensures workflow readiness before enforcing Manifest-only admission")
    || !operatorManifestReviewBatchStateServiceTests.includes("serializes an explicitly identified review batch without discovery")
    || !operatorManifestReviewBatchStateServiceTests.includes("discovers the latest active batch with optional production-date scope")
    || !operatorManifestReviewBatchStateServiceTests.includes("returns autonomous-cycle continuation guidance when no review batch is active")
    || !operatorManifestReviewBatchStateServiceTests.includes("returns the exact not-found response when an identified batch cannot serialize")
    || !operatorManifestReviewBatchStateServiceTests.includes("rejects non-Manifest and invalid production dates before claim mutations")
    || !operatorManifestReviewBatchStateServiceTests.includes("reuses an active nonterminal review batch idempotently")
    || !operatorManifestReviewBatchStateServiceTests.includes("completes terminal batches and claims a bounded new source lineup")
    || !operatorManifestReviewBatchStateServiceTests.includes("rolls to a fresh source batch when the first draw has no available selections")
    || !operatorManifestReviewBatchStateServiceTests.includes("returns exact source-batch and empty-claim failure states")) {
    lifecycleErrors.push("operator_manifest_review_batch_state_service_tests_incomplete");
}
if (!source.includes('from "./operatorManifestReviewDraftAttachmentService"')
    || !source.includes("attach_manifest_review_draft: async () =>")
    || !source.includes("attachOperatorManifestReviewDraft({")
    || !source.includes("findDuplicateClaim: async")
    || !source.includes("applyAttachment: async")) {
  lifecycleErrors.push("operator_manifest_review_draft_attachment_service_import_or_binding_missing");
}
if (source.includes("const replacementSelectionId = String(replacement.source_selection_id)")
    || source.includes("const nextClaimStatus = draft.status === \"approved\"")
    || source.includes("replacement_source_already_claimed_for_day")) {
  lifecycleErrors.push("operator_manifest_review_draft_attachment_service_returned_to_index");
}
if (!operatorManifestReviewDraftAttachmentService.includes("export async function attachOperatorManifestReviewDraft")
    || !operatorManifestReviewDraftAttachmentService.includes("dependencies.getDraft")
    || !operatorManifestReviewDraftAttachmentService.includes("dependencies.getClaim")
    || !operatorManifestReviewDraftAttachmentService.includes("dependencies.getReplacement")
    || !operatorManifestReviewDraftAttachmentService.includes("dependencies.findDuplicateClaim")
    || !operatorManifestReviewDraftAttachmentService.includes("dependencies.applyAttachment")
    || !operatorManifestReviewDraftAttachmentService.includes("dependencies.countUnresolved")
    || !operatorManifestReviewDraftAttachmentService.includes("dependencies.updateReviewBatchStatus")
    || !operatorManifestReviewDraftAttachmentService.includes("review_source_replacement_requires_skip")) {
  lifecycleErrors.push("operator_manifest_review_draft_attachment_service_module_incomplete");
}
if (!operatorManifestReviewDraftAttachmentServiceTests.includes("rejects incomplete attachment identity before any mutation")
    || !operatorManifestReviewDraftAttachmentServiceTests.includes("enforces passing draft state and exact source-card generation lineage")
    || !operatorManifestReviewDraftAttachmentServiceTests.includes("requires selected same-day replacement authority and a skipped prior source")
    || !operatorManifestReviewDraftAttachmentServiceTests.includes("rejects a replacement source already claimed for the production day")
    || !operatorManifestReviewDraftAttachmentServiceTests.includes("persists attachment state and completes the batch when no unresolved items remain")) {
    lifecycleErrors.push("operator_manifest_review_draft_attachment_service_tests_incomplete");
}
if (!source.includes('from "./operatorManifestReviewSourceResolutionService"')
    || !source.includes("skip_manifest_review_source: async () =>")
    || !source.includes("resolveOperatorManifestReviewSource({")
    || !source.includes("upsertSourceExclusion: async")
    || !source.includes("updateSourceSelection: async")) {
  lifecycleErrors.push("operator_manifest_review_source_resolution_service_import_or_binding_missing");
}
if (source.includes("const resolvedReviewBatchId = String(claim.review_batch_id ?? reviewBatchId)")
    || source.includes("const nextStatus = scope === \"delete_source\"")
    || source.includes("Owner rejected source for production use.")) {
  lifecycleErrors.push("operator_manifest_review_source_resolution_service_returned_to_index");
}
if (!operatorManifestReviewSourceResolutionService.includes("export async function resolveOperatorManifestReviewSource")
    || !operatorManifestReviewSourceResolutionService.includes("dependencies.getClaim")
    || !operatorManifestReviewSourceResolutionService.includes("dependencies.upsertSourceExclusion")
    || !operatorManifestReviewSourceResolutionService.includes("dependencies.updateClaim")
    || !operatorManifestReviewSourceResolutionService.includes("dependencies.updateSourceSelection")
    || !operatorManifestReviewSourceResolutionService.includes("dependencies.countUnresolved")
    || !operatorManifestReviewSourceResolutionService.includes("dependencies.updateReviewBatchStatus")
    || !operatorManifestReviewSourceResolutionService.includes("only_saved_patterns_can_be_deleted_as_sources")) {
  lifecycleErrors.push("operator_manifest_review_source_resolution_service_module_incomplete");
}
if (!operatorManifestReviewSourceResolutionServiceTests.includes("returns the exact missing-item response without any mutation")
    || !operatorManifestReviewSourceResolutionServiceTests.includes("limits permanent source deletion to saved patterns")
    || !operatorManifestReviewSourceResolutionServiceTests.includes("uses the default owner reason for current-day source skips")
    || !operatorManifestReviewSourceResolutionServiceTests.includes("upserts a durable exclusion and completes a deleted saved-pattern source")
    || !operatorManifestReviewSourceResolutionServiceTests.includes("uses the claim batch identity and preserves an empty serialized fallback")) {
    lifecycleErrors.push("operator_manifest_review_source_resolution_service_tests_incomplete");
}
if (!source.includes('from "./operatorManifestReviewBatchSchedulingService"')
    || !source.includes("schedule_manifest_review_batch: async () =>")
    || !source.includes("scheduleOperatorManifestReviewBatch({")
    || !source.includes("listApprovedClaims: async")
    || !source.includes("runSchedulingGates: async")
    || !source.includes("persistScheduledState: async")) {
  lifecycleErrors.push("operator_manifest_review_batch_scheduling_service_import_or_binding_missing");
}
if (source.includes("remaining_approved_item_numbers")
    || source.includes("const eligibleClaimsAll =")
    || source.includes("insufficient_open_hourly_slots")) {
  lifecycleErrors.push("operator_manifest_review_batch_scheduling_service_returned_to_index");
}
if (!operatorManifestReviewBatchSchedulingService.includes("export async function scheduleOperatorManifestReviewBatch")
    || !operatorManifestReviewBatchSchedulingService.includes("dependencies.getReviewBatch")
    || !operatorManifestReviewBatchSchedulingService.includes("dependencies.listScheduledPosts")
    || !operatorManifestReviewBatchSchedulingService.includes("dependencies.listApprovedClaims")
    || !operatorManifestReviewBatchSchedulingService.includes("dependencies.runSchedulingGates")
    || !operatorManifestReviewBatchSchedulingService.includes("dependencies.createScheduledPost")
    || !operatorManifestReviewBatchSchedulingService.includes("dependencies.persistScheduledState")
    || !operatorManifestReviewBatchSchedulingService.includes("dependencies.saveStrategyTag")
    || !operatorManifestReviewBatchSchedulingService.includes("dependencies.insertInventory")
    || !operatorManifestReviewBatchSchedulingService.includes("remaining_approved_item_numbers")
    || !operatorManifestReviewBatchSchedulingService.includes("insufficient_open_hourly_slots")) {
  lifecycleErrors.push("operator_manifest_review_batch_scheduling_service_module_incomplete");
}
if (!operatorManifestReviewBatchSchedulingServiceTests.includes("returns the exact missing-batch response before schedule reads")
    || !operatorManifestReviewBatchSchedulingServiceTests.includes("reconciles occupied hours and preserves one-post continuation fields")
    || !operatorManifestReviewBatchSchedulingServiceTests.includes("returns insufficient slots without reading or mutating a draft")
    || !operatorManifestReviewBatchSchedulingServiceTests.includes("isolates scheduling gate failures without scheduler or lineage writes")
    || !operatorManifestReviewBatchSchedulingServiceTests.includes("isolates scheduler failures and keeps continuation state deterministic")
    || !operatorManifestReviewBatchSchedulingServiceTests.includes("persists scheduled state, strategy lineage, inventory, and completed review status")) {
    lifecycleErrors.push("operator_manifest_review_batch_scheduling_service_tests_incomplete");
}
if (!source.includes('from "./operatorWorkflowSessionStartService"')
    || !source.includes("start_workflow_session: async () =>")
    || !source.includes("startOperatorWorkflowSession({")
    || !source.includes("getActiveSession: ()")
    || !source.includes("insertSession: async")) {
  lifecycleErrors.push("operator_workflow_session_start_service_import_or_binding_missing");
}
if (source.includes("active_workflow_session_already_exists")
    || source.includes("next_required_stage: existingSession.current_stage")) {
  lifecycleErrors.push("operator_workflow_session_start_service_returned_to_index");
}
if (!operatorWorkflowSessionStartService.includes("export async function startOperatorWorkflowSession")
    || !operatorWorkflowSessionStartService.includes("dependencies.getActiveSession")
    || !operatorWorkflowSessionStartService.includes("dependencies.insertSession")
    || !operatorWorkflowSessionStartService.includes("dependencies.workflowTemplatePayload")
    || !operatorWorkflowSessionStartService.includes("active_workflow_session_already_exists")
    || !operatorWorkflowSessionStartService.includes('current_stage: "account_selection"')) {
  lifecycleErrors.push("operator_workflow_session_start_service_module_incomplete");
}
if (!operatorWorkflowSessionStartServiceTests.includes("reuses an account-selection session with exact idempotency guidance")
    || !operatorWorkflowSessionStartServiceTests.includes("reuses later-stage sessions without forcing context admission")
    || !operatorWorkflowSessionStartServiceTests.includes("preserves the missing existing-stage display and next-stage edge contract")
    || !operatorWorkflowSessionStartServiceTests.includes("creates a new session with the canonical template fallback and null notes")
    || !operatorWorkflowSessionStartServiceTests.includes("normalizes a requested template and notes for new-session persistence")) {
  lifecycleErrors.push("operator_workflow_session_start_service_tests_incomplete");
}
if (!source.includes('from "./operatorContextAdmissionService"')
    || !source.includes("admit_context: async () =>")
    || !source.includes("admitOperatorContext({")
    || !source.includes("insertAdmission: async")) {
  lifecycleErrors.push("operator_context_admission_service_import_or_binding_missing");
}
if (source.includes("const sectionsInput = Array.isArray(payload.sections)")
    || source.includes("const isPartial = coverage.some")
    || source.includes("Context admission is partial.")) {
  lifecycleErrors.push("operator_context_admission_service_returned_to_index");
}
if (!operatorContextAdmissionService.includes("export async function admitOperatorContext")
    || !operatorContextAdmissionService.includes("dependencies.insertAdmission")
    || !operatorContextAdmissionService.includes("dependencies.normalizeMachineKey")
    || !operatorContextAdmissionService.includes("coverage_status")
    || !operatorContextAdmissionService.includes("Context admission is partial.")) {
  lifecycleErrors.push("operator_context_admission_service_module_incomplete");
}
if (!operatorContextAdmissionServiceTests.includes("persists an empty complete admission with canonical defaults")
    || !operatorContextAdmissionServiceTests.includes("normalizes pagination coverage and uses the admission snapshot fallback")
    || !operatorContextAdmissionServiceTests.includes("preserves explicit pagination overrides and section snapshot precedence")
    || !operatorContextAdmissionServiceTests.includes("infers partial coverage from remaining pagination and emits the exact warning")
    || !operatorContextAdmissionServiceTests.includes("normalizes admission metadata and honors explicit partial status")) {
  lifecycleErrors.push("operator_context_admission_service_tests_incomplete");
}
if (!source.includes('from "./operatorProductionBoardService"')
    || !source.includes("get_production_board: async () =>")
    || !source.includes("readOperatorProductionBoard({")
    || !source.includes("listActiveItems: async")
    || !source.includes("parseJsonString: safeParseJsonString")) {
  lifecycleErrors.push("operator_production_board_service_import_or_binding_missing");
}
if (source.includes(`if (toolName === "get_production_board") {
    const rows = await env.DB.prepare(`)
    || source.includes(").bind(brand.brand_key, normalizeOperatorText(payload.workflow_session_id, 120, true), normalizeOperatorText(payload.workflow_session_id, 120, true)).all<Record<string, unknown>>();")
    || source.includes(`return operatorJsonResponse({
      brand_key: brand.brand_key,
      items: (rows.results ?? []).map((row) => ({`)) {
  lifecycleErrors.push("operator_production_board_service_returned_to_index");
}
if (!operatorProductionBoardService.includes("export async function readOperatorProductionBoard")
    || !operatorProductionBoardService.includes("dependencies.listActiveItems")
    || !operatorProductionBoardService.includes("dependencies.parseJsonString")
    || !operatorProductionBoardService.includes("priority: row.priority")
    || !operatorProductionBoardService.includes("warnings: []")) {
  lifecycleErrors.push("operator_production_board_service_module_incomplete");
}
if (!operatorProductionBoardServiceTests.includes("returns an empty board with exact brand identity and warnings")
    || !operatorProductionBoardServiceTests.includes("normalizes the optional workflow-session filter before querying")
    || !operatorProductionBoardServiceTests.includes("serializes stable item fields and preserves nullable values")
    || !operatorProductionBoardServiceTests.includes("converts numeric priorities and decodes evidence payloads")
    || !operatorProductionBoardServiceTests.includes("falls back to an empty evidence array when parsing returns null")) {
  lifecycleErrors.push("operator_production_board_service_tests_incomplete");
}
if (!source.includes('from "./operatorSourceCandidateListService"')
    || !source.includes("list_source_candidates: async () =>")
    || !source.includes("listOperatorSourceCandidates({")
    || !source.includes("listCandidates: async")
    || !source.includes("manifestSourceMinVerifiedLikes: MANIFEST_SOURCE_MIN_VERIFIED_LIKES")) {
  lifecycleErrors.push("operator_source_candidate_list_service_import_or_binding_missing");
}
if (source.includes(`if (toolName === "list_source_candidates") {
    const sourceTypes = Array.isArray(payload.source_types)`)
    || source.includes("const { candidates, total_count: totalCount } = await listSourceCandidatesForBrand")
    || source.includes('eligibility_min_likes: brand.brand_key === "manifest_mental"')) {
  lifecycleErrors.push("operator_source_candidate_list_service_returned_to_index");
}
if (!operatorSourceCandidateListService.includes("export async function listOperatorSourceCandidates")
    || !operatorSourceCandidateListService.includes("dependencies.listCandidates")
    || !operatorSourceCandidateListService.includes("sourceTypes")
    || !operatorSourceCandidateListService.includes("has_more")
    || !operatorSourceCandidateListService.includes("eligibility_min_likes")) {
  lifecycleErrors.push("operator_source_candidate_list_service_module_incomplete");
}
if (!operatorSourceCandidateListServiceTests.includes("uses empty source filters and canonical pagination defaults")
    || !operatorSourceCandidateListServiceTests.includes("normalizes mixed source types and numeric pagination inputs")
    || !operatorSourceCandidateListServiceTests.includes("reports continuation when returned candidates do not exhaust the total")
    || !operatorSourceCandidateListServiceTests.includes("reports complete pagination when the returned window reaches the total")
    || !operatorSourceCandidateListServiceTests.includes("returns Manifest eligibility metadata and null for other brands")) {
  lifecycleErrors.push("operator_source_candidate_list_service_tests_incomplete");
}
if (!source.includes('from "./operatorSavedPatternSourceExclusionService"')
    || !source.includes("delete_saved_pattern_source: async () =>")
    || !source.includes("excludeOperatorSavedPatternSource({")
    || !source.includes("upsertExclusion: async")
    || !source.includes("skipActiveSelections: async")
    || !source.includes("markActiveClaimsDeleted: async")) {
  lifecycleErrors.push("operator_saved_pattern_source_exclusion_service_import_or_binding_missing");
}
if (source.includes(`if (toolName === "delete_saved_pattern_source") {
    const patternId = Math.trunc(Number(payload.pattern_id ?? 0));`)
    || source.includes("const ownerApproval = normalizeOperatorText(payload.owner_approval, 500, true)")
    || source.includes("skipped_active_selection_count: Number(skipped.meta.changes ?? 0)")) {
  lifecycleErrors.push("operator_saved_pattern_source_exclusion_service_returned_to_index");
}
if (!source.includes("Legacy destructive deletion path intentionally retired")
    || !source.includes("Historical pattern,")
    || !source.includes("card, generation, and analytics data must remain intact.")) {
  lifecycleErrors.push("operator_saved_pattern_source_destructive_retirement_documentation_missing");
}
if (!operatorSavedPatternSourceExclusionService.includes("export async function excludeOperatorSavedPatternSource")
    || !operatorSavedPatternSourceExclusionService.includes("dependencies.getPattern")
    || !operatorSavedPatternSourceExclusionService.includes("dependencies.upsertExclusion")
    || !operatorSavedPatternSourceExclusionService.includes("dependencies.skipActiveSelections")
    || !operatorSavedPatternSourceExclusionService.includes("dependencies.markActiveClaimsDeleted")
    || !operatorSavedPatternSourceExclusionService.includes("preserved_historical_data: true")) {
  lifecycleErrors.push("operator_saved_pattern_source_exclusion_service_module_incomplete");
}
if (!operatorSavedPatternSourceExclusionServiceTests.includes("rejects missing explicit delete approval before reads or mutation")
    || !operatorSavedPatternSourceExclusionServiceTests.includes("returns the exact not-found preservation response without mutation")
    || !operatorSavedPatternSourceExclusionServiceTests.includes("prefers the stored Threads post ID for durable source identity")
    || !operatorSavedPatternSourceExclusionServiceTests.includes("falls back from canonical URL identity to saved-pattern identity")
    || !operatorSavedPatternSourceExclusionServiceTests.includes("retires active work in order while preserving all historical data")) {
  lifecycleErrors.push("operator_saved_pattern_source_exclusion_service_tests_incomplete");
}
if (!source.includes('from "./operatorManifestSourceDrawService"')
    || !source.includes("drawOperatorManifestSourceBatch({")
    || !source.includes("getActiveSession: async")
    || !source.includes("persistDraw: async")
    || !source.includes("updateWorkflowStage: async")) {
  lifecycleErrors.push("operator_manifest_source_draw_service_import_or_binding_missing");
}
if (source.includes(`if (toolName === "draw_source_candidate_batch") {
    if (brand.brand_key !== "manifest_mental")`)
    || source.includes("if (qualifiedPool.length < MANIFEST_DAILY_SOURCE_DRAW_SIZE)")
    || source.includes("const selectedCandidates = shuffleOperatorSources(qualifiedPool).slice")) {
  lifecycleErrors.push("operator_manifest_source_draw_service_returned_to_index");
}
if (!operatorManifestSourceDrawService.includes("export async function drawOperatorManifestSourceBatch")
    || !operatorManifestSourceDrawService.includes("dependencies.getActiveSession")
    || !operatorManifestSourceDrawService.includes("dependencies.getExistingBatch")
    || !operatorManifestSourceDrawService.includes("dependencies.persistDraw")
    || !operatorManifestSourceDrawService.includes("dependencies.updateWorkflowStage")
    || !operatorManifestSourceDrawService.includes("uniform_random_without_replacement")) {
  lifecycleErrors.push("operator_manifest_source_draw_service_module_incomplete");
}
if (!operatorManifestSourceDrawServiceTests.includes("rejects unsupported brands without mutation")
    || !operatorManifestSourceDrawServiceTests.includes("requires a normalized active workflow session before reading batches")
    || !operatorManifestSourceDrawServiceTests.includes("reuses the latest existing batch without pool or persistence work")
    || !operatorManifestSourceDrawServiceTests.includes("rejects an insufficient qualified source pool without mutation")
    || !operatorManifestSourceDrawServiceTests.includes("persists one uniform random batch and advances the workflow stage")) {
  lifecycleErrors.push("operator_manifest_source_draw_service_tests_incomplete");
}
if (!source.includes('from "./operatorPublishedPostLineageAuditService"')
    || !source.includes("auditOperatorPublishedPostLineage({")
    || !source.includes("recoverOperatorPublishedPostLineage({")
    || !source.includes("listRows: async ({ minimumLikes, days, limit })")
    || !source.includes("recoverLineage: async (recoveryPayload, minimumVerifiedLikes)")) {
  lifecycleErrors.push("operator_published_post_lineage_audit_service_import_or_binding_missing");
}
const publishedLineageRecoveryHandlerStart = source.indexOf('if (toolName === "recover_published_post_lineage")');
const publishedLineageRecoveryHandlerEnd = source.indexOf(
  'if (toolName === "create_all_missing_manifest_source_cards")',
  publishedLineageRecoveryHandlerStart,
);
const publishedLineageRecoveryHandler = publishedLineageRecoveryHandlerStart >= 0
  && publishedLineageRecoveryHandlerEnd > publishedLineageRecoveryHandlerStart
  ? source.slice(publishedLineageRecoveryHandlerStart, publishedLineageRecoveryHandlerEnd)
  : "";
if (source.includes("const minimumLikes = Math.max(1, Math.trunc(Number(payload.minimum_likes ?? 1000)))")
    || source.includes("const posts = (rows.results ?? []).map((row) =>")
    || source.includes("if (!row.source_selection_id || !row.source_batch_id) missingStages.push(\"source\")")
    || publishedLineageRecoveryHandler.includes("compatibilityWorkflowSessionId")
    || publishedLineageRecoveryHandler.includes("bridgeOperationId")
    || publishedLineageRecoveryHandler.includes("backfillHttpStatus")) {
  lifecycleErrors.push("operator_published_post_lineage_audit_service_returned_to_index");
}
if (!operatorPublishedPostLineageAuditService.includes("export async function auditOperatorPublishedPostLineage")
    || !operatorPublishedPostLineageAuditService.includes("dependencies.listRows")
    || !operatorPublishedPostLineageAuditService.includes('missingStages.push("source")')
    || !operatorPublishedPostLineageAuditService.includes('missingStages.push("metrics")')
    || !operatorPublishedPostLineageAuditService.includes("saved_pattern_id")
        || !operatorPublishedPostLineageAuditService.includes("complete_count")
    || !operatorPublishedPostLineageAuditService.includes("incomplete_count")
    || !operatorPublishedPostLineageAuditService.includes("export async function recoverOperatorPublishedPostLineage")
    || !operatorPublishedPostLineageAuditService.includes("compatibilityWorkflowSessionId")
    || !operatorPublishedPostLineageAuditService.includes('"create_all_missing_manifest_source_cards"')
    || !operatorPublishedPostLineageAuditService.includes("dependencies.recoverLineage")
    || !operatorPublishedPostLineageAuditService.includes("backfillHttpStatus >= 100")) {
  lifecycleErrors.push("operator_published_post_lineage_audit_service_module_incomplete");
}
if (!operatorPublishedPostLineageAuditServiceTests.includes("applies exact defaults and bounded criteria before row retrieval")
    || !operatorPublishedPostLineageAuditServiceTests.includes("serializes complete lineage with stable metrics and numeric identifiers")
        || !operatorPublishedPostLineageAuditServiceTests.includes("classifies every missing lineage stage in deterministic order")
    || !operatorPublishedPostLineageAuditServiceTests.includes("counts mixed results and omits saved-pattern identity for other source types")
    || !operatorPublishedPostLineageAuditServiceTests.includes("routes the $label through the bounded Manifest backfill bridge")
    || !operatorPublishedPostLineageAuditServiceTests.includes("coerces an invalid compatibility bridge status to 200")
    || !operatorPublishedPostLineageAuditServiceTests.includes("delegates normal recovery with the canonical minimum verified likes")
    || !operatorPublishedPostLineageAuditServiceTests.includes("does not apply the Manifest compatibility bridge to another brand")) {
  lifecycleErrors.push("operator_published_post_lineage_audit_service_tests_incomplete");
}
if (!source.includes('from "./operatorManifestSourceCardBackfillService"')
    || !source.includes("createAllMissingManifestSourceCards({")
    || !source.includes("callTool: async (internalToolName, internalPayload)")) {
  lifecycleErrors.push("operator_manifest_source_card_backfill_service_import_or_binding_missing");
}
// Ownership markers must remain handler-specific. Generic loop fragments are shared across domains
// and may never be used to decide that this service returned to index.ts.
if (source.includes(`if (toolName === "create_all_missing_manifest_source_cards") {
    if (brand.brand_key !== "manifest_mental")`)
    || source.includes("manifest_source_card_backfill_prepare_failed")
    || source.includes("failed_saved_pattern_id: savedPatternId")) {
  lifecycleErrors.push("operator_manifest_source_card_backfill_service_returned_to_index");
}

if (!operatorManifestSourceCardBackfillService.includes("export async function createAllMissingManifestSourceCards")
    || !operatorManifestSourceCardBackfillService.includes("dependencies.callTool")
    || !operatorManifestSourceCardBackfillService.includes('"prepare_manifest_source_card_backfill"')
    || !operatorManifestSourceCardBackfillService.includes('"create_source_card"')
    || !operatorManifestSourceCardBackfillService.includes("manifest_source_card_creation_failed")
    || !operatorManifestSourceCardBackfillService.includes("continuation_required")) {
  lifecycleErrors.push("operator_manifest_source_card_backfill_service_module_incomplete");
}
if (!operatorManifestSourceCardBackfillServiceTests.includes("rejects non-Manifest brands before any internal tool call")
    || !operatorManifestSourceCardBackfillServiceTests.includes("maps prepare failures without starting source-card creation")
    || !operatorManifestSourceCardBackfillServiceTests.includes("constructs source-faithful payloads sequentially and returns ready continuation state")
    || !operatorManifestSourceCardBackfillServiceTests.includes("stops on the first source-card failure with exact partial evidence")
    || !operatorManifestSourceCardBackfillServiceTests.includes("returns complete state when verification finds no remaining patterns")) {
  lifecycleErrors.push("operator_manifest_source_card_backfill_service_tests_incomplete");
}
if (!source.includes('from "./operatorManifestSourceCardBackfillPreparationService"')
    || !source.includes("prepareOperatorManifestSourceCardBackfill({")
    || !source.includes("loadState: async ({ limit })")) {
  lifecycleErrors.push("operator_manifest_source_card_backfill_preparation_service_import_or_binding_missing");
}
if (source.includes(`if (toolName === "prepare_manifest_source_card_backfill") {

    if (brand.brand_key !== "manifest_mental")`)
    || source.includes("already_carded_count: alreadyCardedCount")
    || source.includes("completion_rule: \"Complete only when every Saved Pattern has a linked source card.\"")) {
  lifecycleErrors.push("operator_manifest_source_card_backfill_preparation_service_returned_to_index");
}
if (!operatorManifestSourceCardBackfillPreparationService.includes("export async function prepareOperatorManifestSourceCardBackfill")
    || !operatorManifestSourceCardBackfillPreparationService.includes("dependencies.loadState")
    || !operatorManifestSourceCardBackfillPreparationService.includes("dependencies.canonicalizeThreadsSourceUrl")
    || !operatorManifestSourceCardBackfillPreparationService.includes("dependencies.extractThreadsPostIdFromUrl")
    || !operatorManifestSourceCardBackfillPreparationService.includes("source_identity_key")
    || !operatorManifestSourceCardBackfillPreparationService.includes("engagement_total")
    || !operatorManifestSourceCardBackfillPreparationService.includes("completion_rule")
    || !operatorManifestSourceCardBackfillPreparationService.includes("interruption_rule")) {
  lifecycleErrors.push("operator_manifest_source_card_backfill_preparation_service_module_incomplete");
}
if (!operatorManifestSourceCardBackfillPreparationServiceTests.includes("rejects non-Manifest brands before reading state")
    || !operatorManifestSourceCardBackfillPreparationServiceTests.includes("applies the exact default and bounded limits before state retrieval")
    || !operatorManifestSourceCardBackfillPreparationServiceTests.includes("uses deterministic source identity precedence across post ID, URL, and Saved Pattern ID")
    || !operatorManifestSourceCardBackfillPreparationServiceTests.includes("serializes metrics, nullable metadata, and exact rules without mutation")
    || !operatorManifestSourceCardBackfillPreparationServiceTests.includes("returns complete state and clamps negative uncarded totals to zero")) {
  lifecycleErrors.push("operator_manifest_source_card_backfill_preparation_service_tests_incomplete");
}
if (!source.includes('from "./operatorSourceCandidateBatchReadService"')
    || !source.includes("readOperatorSourceCandidateBatch(payload")
    || !source.includes("listSelections: async (batchId)")) {
  lifecycleErrors.push("operator_source_candidate_batch_read_service_import_or_binding_missing");
}
if (source.includes(`if (toolName === "get_source_candidate_batch") {
    const batchId = normalizeOperatorText(payload.source_batch_id, 120);`)
    || source.includes("metadata: safeParseJsonString(String(batch.metadata_json")
    || source.includes("canonical_source_card_version: row.canonical_source_card_version === null")) {
  lifecycleErrors.push("operator_source_candidate_batch_read_service_returned_to_index");
}
if (!operatorSourceCandidateBatchReadService.includes("export async function readOperatorSourceCandidateBatch")
    || !operatorSourceCandidateBatchReadService.includes("dependencies.loadBatch")
    || !operatorSourceCandidateBatchReadService.includes("dependencies.listSelections")
    || !operatorSourceCandidateBatchReadService.includes("dependencies.parseJson")
    || !operatorSourceCandidateBatchReadService.includes("source_batch_not_found")
    || !operatorSourceCandidateBatchReadService.includes("canonical_source_card_version")
    || !operatorSourceCandidateBatchReadService.includes('disposition: row.disposition ?? "pending"')
    || !operatorSourceCandidateBatchReadService.includes("workflow_sequence")) {
  lifecycleErrors.push("operator_source_candidate_batch_read_service_module_incomplete");
}
if (!operatorSourceCandidateBatchReadServiceTests.includes("rejects a missing batch ID before any repository read")
    || !operatorSourceCandidateBatchReadServiceTests.includes("returns exact not-found behavior without reading selections")
    || !operatorSourceCandidateBatchReadServiceTests.includes("parses batch and selection snapshots and serializes complete canonical state")
    || !operatorSourceCandidateBatchReadServiceTests.includes("applies empty-object, pending, and null defaults deterministically")) {
  lifecycleErrors.push("operator_source_candidate_batch_read_service_tests_incomplete");
}
if (!source.includes('from "./operatorSourceCardAdmissionService"')
    || !source.includes("admitOperatorSourceCardCreation({")
    || !source.includes("persistSavedPatternSelection: async ({")
    || !source.includes("loadSelection: async (sourceSelectionId)")
    || !source.includes("validateSourceCard: validateSourceCardLockable")) {
  lifecycleErrors.push("operator_source_card_admission_service_import_or_binding_missing");
}
if (source.includes("const compatibilitySequenceLabel = normalizeOperatorText(payload.sequence_label, 120, true)")
    || source.includes("Use the selected account's saved workflow before creating source cards. Do not create batch or multi-post source cards")
    || source.includes("sourceSelectionId = normalizeOperatorText(payload.source_selection_id, 120)")
    || source.includes("manifest_source_selection_id_or_saved_pattern_id_required")
    || source.includes("source_selection_workflow_mismatch")
    || source.includes("selection_already_resolved")) {
  lifecycleErrors.push("operator_source_card_admission_service_returned_to_index");
}
if (!operatorSourceCardAdmissionService.includes("export async function admitOperatorSourceCardCreation")
    || !operatorSourceCardAdmissionService.includes("dependencies.runBackfillBridge")
    || !operatorSourceCardAdmissionService.includes("dependencies.getWorkflowConflict")
    || !operatorSourceCardAdmissionService.includes("dependencies.persistSavedPatternSelection")
    || !operatorSourceCardAdmissionService.includes("dependencies.loadSelection")
    || !operatorSourceCardAdmissionService.includes("dependencies.loadSourceCard")
    || !operatorSourceCardAdmissionService.includes("saved_pattern_not_found")
    || !operatorSourceCardAdmissionService.includes("manifest_source_selection_id_or_saved_pattern_id_required")
    || !operatorSourceCardAdmissionService.includes("source_selection_workflow_mismatch")
    || !operatorSourceCardAdmissionService.includes("selection_already_resolved")
    || !operatorSourceCardAdmissionService.includes("sourceIdentityKey")) {
  lifecycleErrors.push("operator_source_card_admission_service_module_incomplete");
}
if (!operatorSourceCardAdmissionServiceTests.includes("routes the Manifest backfill compatibility bridge with exact status and identity")
    || !operatorSourceCardAdmissionServiceTests.includes("returns the exact saved-workflow conflict before any source read")
    || !operatorSourceCardAdmissionServiceTests.includes("requires a primary source for non-Manifest accounts")
    || !operatorSourceCardAdmissionServiceTests.includes("requires a Manifest selection or positive Saved Pattern ID")
    || !operatorSourceCardAdmissionServiceTests.includes("returns exact Saved Pattern not-found behavior before persistence")
    || !operatorSourceCardAdmissionServiceTests.includes("builds deterministic Saved Pattern selection evidence and hydrates continuation state")
    || !operatorSourceCardAdmissionServiceTests.includes("reuses an already resolved selection with exact linked-card response")
    || !operatorSourceCardAdmissionServiceTests.includes("rejects a source-selection workflow mismatch before hydration")
    || !operatorSourceCardAdmissionServiceTests.includes("hydrates an explicit selection and preserves versioning inputs deterministically")) {
  lifecycleErrors.push("operator_source_card_admission_service_tests_incomplete");
}
if (!source.includes('from "./operatorSourceCardFamilyResolutionService"')
    || !source.includes("resolveOperatorSourceCardFamily({")
    || !source.includes("loadFamily: async (sourceIdentityKey)")
    || !source.includes("createFamily: async ({")
    || !source.includes("linkSelectionToCurrentCard: async ({")
    || !source.includes("parseWorkflowSequence: parseOperatorWorkflowSequence")
    || !source.includes("validateSourceCard: validateSourceCardLockable")) {
  lifecycleErrors.push("operator_source_card_family_resolution_service_import_or_binding_missing");
}
if (source.includes('const sourceIdentityKey = String(selection.source_identity_key ?? "")')
    || source.includes('reason: "canonical_source_card_reused"')
    || source.includes("supersedesSourceCardId = String(currentCard.id)")
    || source.includes("versionNumber = Number(currentCard.version_number ?? 1) + 1")) {
  lifecycleErrors.push("operator_source_card_family_resolution_service_returned_to_index");
}
if (!operatorSourceCardFamilyResolutionService.includes("export async function resolveOperatorSourceCardFamily")
    || !operatorSourceCardFamilyResolutionService.includes("dependencies.loadFamily")
    || !operatorSourceCardFamilyResolutionService.includes("dependencies.createFamily")
    || !operatorSourceCardFamilyResolutionService.includes("dependencies.loadSourceCard")
    || !operatorSourceCardFamilyResolutionService.includes("dependencies.linkSelectionToCurrentCard")
    || !operatorSourceCardFamilyResolutionService.includes("canonical_source_card_reused")
    || !operatorSourceCardFamilyResolutionService.includes("version_reason_required")
    || !operatorSourceCardFamilyResolutionService.includes("supersedesSourceCardId")) {
  lifecycleErrors.push("operator_source_card_family_resolution_service_module_incomplete");
}
if (!operatorSourceCardFamilyResolutionServiceTests.includes("creates a missing active family from exact selection identity")
    || !operatorSourceCardFamilyResolutionServiceTests.includes("continues with an existing family that has no current card")
    || !operatorSourceCardFamilyResolutionServiceTests.includes("reuses the current canonical card and links the selection deterministically")
    || !operatorSourceCardFamilyResolutionServiceTests.includes("requires a version reason before replacing the current card")
    || !operatorSourceCardFamilyResolutionServiceTests.includes("increments the canonical version and preserves replacement identity")) {
  lifecycleErrors.push("operator_source_card_family_resolution_service_tests_incomplete");
}
if (!source.includes('from "./operatorSourceCardPersistencePlanningService"')
    || !source.includes("planOperatorSourceCardPersistence({")
    || !source.includes("composeOperatorSourceCardPersistenceResponse({")
    || !source.includes("normalizeJson: normalizeOperatorJson")
    || !source.includes("nowIso: () => new Date().toISOString()")
    || !source.includes("const persistencePlan = persistencePlanning.plan")
    || !source.includes("await env.DB.batch(sourceCardStatements)")) {
  lifecycleErrors.push("operator_source_card_persistence_planning_service_import_or_binding_missing");
}
if (source.includes("const backfillValidation = savedPatternId !== null")
    || source.includes("const backfillLockedAt = savedPatternId !== null")
    || source.includes('error: "saved_pattern_source_card_not_lockable"')
    || source.includes('status: savedPatternId !== null ? "locked" : "draft"')) {
  lifecycleErrors.push("operator_source_card_persistence_planning_service_returned_to_index");
}
if (!operatorSourceCardPersistencePlanningService.includes("export function planOperatorSourceCardPersistence")
    || !operatorSourceCardPersistencePlanningService.includes("export function composeOperatorSourceCardPersistenceResponse")
    || !operatorSourceCardPersistencePlanningService.includes("saved_pattern_source_card_not_lockable")
    || !operatorSourceCardPersistencePlanningService.includes("retireSupersededCardId")
    || !operatorSourceCardPersistencePlanningService.includes("familyUpdate")
    || !operatorSourceCardPersistencePlanningService.includes("selectionLink")
    || !operatorSourceCardPersistencePlanningService.includes("insertValues")
    || !operatorSourceCardPersistencePlanningService.includes("owner_presentation")) {
  lifecycleErrors.push("operator_source_card_persistence_planning_service_module_incomplete");
}
if (!operatorSourceCardPersistencePlanningServiceTests.includes("returns exact Saved Pattern lockability rejection before persistence planning")
    || !operatorSourceCardPersistencePlanningServiceTests.includes("builds a normalized locked plan with every mutation intent")
    || !operatorSourceCardPersistencePlanningServiceTests.includes("builds a draft plan without lock validation or optional linkage intents")
    || !operatorSourceCardPersistencePlanningServiceTests.includes("composes the exact persisted-card response from the completed plan")
    || !operatorSourceCardPersistencePlanningServiceTests.includes("validates an empty object when the persisted card read is missing")) {
  lifecycleErrors.push("operator_source_card_persistence_planning_service_tests_incomplete");
}
if (!source.includes('from "./operatorSourceCardLockService"')
    || !source.includes("planOperatorSourceCardLock(payload")
    || !source.includes("loadSourceCard: async (sourceCardId)")
    || !source.includes("nowIso: () => new Date().toISOString()")
    || !source.includes("lockPlanning.plan.lockedAt")
    || !source.includes("lockPlanning.plan.sourceCardId")) {
  lifecycleErrors.push("operator_source_card_lock_service_import_or_binding_missing");
}
if (source.includes(`if (toolName === "lock_source_card") {
    const sourceCardId = normalizeOperatorText(payload.source_card_id, 120);`)
    || source.includes("return operatorJsonResponse({ success: false, source_card_id: sourceCardId, status: card.status, validation }, 400)")
    || source.includes('return operatorJsonResponse({ source_card_id: sourceCardId, status: "locked", locked_at: lockedAt, warnings: [] })')) {
  lifecycleErrors.push("operator_source_card_lock_service_returned_to_index");
}
if (!operatorSourceCardLockService.includes("export async function planOperatorSourceCardLock")
    || !operatorSourceCardLockService.includes("dependencies.loadSourceCard")
    || !operatorSourceCardLockService.includes("dependencies.validateSourceCard")
    || !operatorSourceCardLockService.includes("source_card_not_found")
    || !operatorSourceCardLockService.includes("lockedAt")
    || !operatorSourceCardLockService.includes("warnings: []")) {
  lifecycleErrors.push("operator_source_card_lock_service_module_incomplete");
}
if (!operatorSourceCardLockServiceTests.includes("returns exact not-found behavior for a missing source-card ID without a lookup")
    || !operatorSourceCardLockServiceTests.includes("returns exact not-found behavior after an account-scoped lookup")
    || !operatorSourceCardLockServiceTests.includes("returns the exact lockability rejection with current status")
    || !operatorSourceCardLockServiceTests.includes("returns deterministic lock persistence intent and success response")) {
  lifecycleErrors.push("operator_source_card_lock_service_tests_incomplete");
}
if (!source.includes('from "./operatorSourceCardReadService"')
    || !source.includes("readOperatorSourceCard({")
    || !source.includes("loadSourceCard: async (sourceCardId)")
    || !source.includes("loadHistory: async (sourceCard)")
    || !source.includes("SOURCE_CARD_OWNER_PRESENTATION_CONTRACT")) {
  lifecycleErrors.push("operator_source_card_read_service_import_or_binding_missing");
}
if (source.includes(`if (toolName === "get_source_card") {
    const sourceCardId = normalizeOperatorText(payload.source_card_id, 120);`)
    || source.includes("const history = payload.include_history === false")
    || source.includes("canonical_context: history")) {
  lifecycleErrors.push("operator_source_card_read_service_returned_to_index");
}
if (!operatorSourceCardReadService.includes("export async function readOperatorSourceCard")
    || !operatorSourceCardReadService.includes("dependencies.loadSourceCard")
    || !operatorSourceCardReadService.includes("dependencies.loadHistory")
    || !operatorSourceCardReadService.includes("input.payload.include_history === false")
    || !operatorSourceCardReadService.includes("source_card_not_found")
    || !operatorSourceCardReadService.includes("canonical_context")
    || !operatorSourceCardReadService.includes("owner_presentation")) {
  lifecycleErrors.push("operator_source_card_read_service_module_incomplete");
}
if (!operatorSourceCardReadServiceTests.includes("returns exact not-found behavior without loading history")
    || !operatorSourceCardReadServiceTests.includes("suppresses history retrieval only when include_history is exactly false")
    || !operatorSourceCardReadServiceTests.includes("loads canonical history by default and composes the exact response")) {
  lifecycleErrors.push("operator_source_card_read_service_tests_incomplete");
}
if (!source.includes('from "./operatorGenerationRunAdmissionService"')
    || !source.includes("admitOperatorGenerationRun({")
    || !source.includes("getWorkflowConflict: getLensicallySavedWorkflowConflict")
    || !source.includes("normalizeAdaptationPlan: normalizeGenerationAdaptationPlan")
    || !source.includes("loadCanonicalContext: async (sourceCard)")
    || !source.includes("loadAccountRejectionContext: async ()")
    || !source.includes("loadPerformanceLearning: async ()")
    || !source.includes("generationAdmission.context")) {
  lifecycleErrors.push("operator_generation_run_admission_service_import_or_binding_missing");
}
if (source.includes("Create generation runs according to the selected account's saved workflow")
    || source.includes("const adaptationPlan = normalizeGenerationAdaptationPlan(payload.adaptation_plan)")
    || source.includes("const canonicalContext = await getOperatorSourceCardHistory(env, brand, card)")
    || source.includes("manifest_adaptation_goal_required")) {
  lifecycleErrors.push("operator_generation_run_admission_service_returned_to_index");
}
if (!operatorGenerationRunAdmissionService.includes("export async function admitOperatorGenerationRun")
    || !operatorGenerationRunAdmissionService.includes("dependencies.getWorkflowConflict")
    || !operatorGenerationRunAdmissionService.includes("dependencies.loadSourceCard")
    || !operatorGenerationRunAdmissionService.includes("dependencies.normalizeAdaptationPlan")
    || !operatorGenerationRunAdmissionService.includes("dependencies.loadCanonicalContext")
    || !operatorGenerationRunAdmissionService.includes("dependencies.loadAccountRejectionContext")
    || !operatorGenerationRunAdmissionService.includes("dependencies.loadPerformanceLearning")
    || !operatorGenerationRunAdmissionService.includes("locked_source_card_required")
    || !operatorGenerationRunAdmissionService.includes("manifest_adaptation_goal_required")
    || !operatorGenerationRunAdmissionService.includes("slice(-24)")) {
  lifecycleErrors.push("operator_generation_run_admission_service_module_incomplete");
}
if (!operatorGenerationRunAdmissionServiceTests.includes("returns the exact saved-workflow conflict before any source-card lookup")
    || !operatorGenerationRunAdmissionServiceTests.includes("requires a normalized locked source card before adaptation work")
    || !operatorGenerationRunAdmissionServiceTests.includes("requires a Manifest adaptation goal before context retrieval")
    || !operatorGenerationRunAdmissionServiceTests.includes("allows a non-Manifest run without an adaptation goal")
    || !operatorGenerationRunAdmissionServiceTests.includes("assembles canonical context with only the latest 24 historical runs")
    || !operatorGenerationRunAdmissionServiceTests.includes("uses empty canonical defaults when optional history fields are malformed")) {
  lifecycleErrors.push("operator_generation_run_admission_service_tests_incomplete");
}
if (!source.includes('from "./operatorGenerationRunPersistencePlanningService"')
    || !source.includes("planOperatorGenerationRunPersistence({")
    || !source.includes("loadExistingRun: async ({ sourceCardId: existingSourceCardId, operationId })")
    || !source.includes("parseJson: safeParseJsonString")
    || !source.includes("const generationPlan = generationPersistence.plan")
    || !source.includes("const insertValues = generationPlan.insertValues")) {
  lifecycleErrors.push("operator_generation_run_persistence_planning_service_import_or_binding_missing");
}
if (source.includes("const operationId = normalizeOperatorText(payload.operation_id, 240, true)")
    || source.includes("generation_operation_already_completed")
    || source.includes("canonical_source_card_reuse: Boolean(card.family_id)")
    || source.includes("source_card_version_number: Number(card.version_number ?? 1)")) {
  lifecycleErrors.push("operator_generation_run_persistence_planning_service_returned_to_index");
}
if (!operatorGenerationRunPersistencePlanningService.includes("export async function planOperatorGenerationRunPersistence")
    || !operatorGenerationRunPersistencePlanningService.includes("dependencies.loadExistingRun")
    || !operatorGenerationRunPersistencePlanningService.includes("generation_operation_already_completed")
    || !operatorGenerationRunPersistencePlanningService.includes("adaptationPlanJson")
    || !operatorGenerationRunPersistencePlanningService.includes("priorAdaptationContextJson")
    || !operatorGenerationRunPersistencePlanningService.includes("transformation_contract_version")
    || !operatorGenerationRunPersistencePlanningService.includes("performance_learning")) {
  lifecycleErrors.push("operator_generation_run_persistence_planning_service_module_incomplete");
}
if (!operatorGenerationRunPersistencePlanningServiceTests.includes("skips the existing-run lookup when operation ID is absent")
    || !operatorGenerationRunPersistencePlanningServiceTests.includes("returns the exact existing-run reuse response with parsed persisted context")
    || !operatorGenerationRunPersistencePlanningServiceTests.includes("falls back to current context and defaults when persisted JSON is unavailable")
    || !operatorGenerationRunPersistencePlanningServiceTests.includes("builds normalized insert values and exact new-run response")
    || !operatorGenerationRunPersistencePlanningServiceTests.includes("uses canonical family and version defaults for a root source card")) {
  lifecycleErrors.push("operator_generation_run_persistence_planning_service_tests_incomplete");
}
if (!source.includes('from "./operatorGenerationDraftAdmissionService"')
    || !source.includes("admitOperatorGenerationDraft(payload")
    || !source.includes("loadExistingDraft: async ({ runId, sourceCardId, text })")
    || !source.includes("countExistingDrafts: async ({ runId, sourceCardId })")
    || !source.includes("draftAdmission.context")) {
  lifecycleErrors.push("operator_generation_draft_admission_service_import_or_binding_missing");
}
if (source.includes('error: "run_id, source_card_id, and text are required"')
    || source.includes("identical_run_draft_already_exists")
    || source.includes("existing_draft_count: existingDraftCount")) {
  lifecycleErrors.push("operator_generation_draft_admission_service_returned_to_index");
}
if (!operatorGenerationDraftAdmissionService.includes("export async function admitOperatorGenerationDraft")
    || !operatorGenerationDraftAdmissionService.includes("dependencies.loadExistingDraft")
    || !operatorGenerationDraftAdmissionService.includes("dependencies.countExistingDrafts")
    || !operatorGenerationDraftAdmissionService.includes("run_id, source_card_id, and text are required")
    || !operatorGenerationDraftAdmissionService.includes("identical_run_draft_already_exists")
    || !operatorGenerationDraftAdmissionService.includes("existingDraftCount >= 2")
    || !operatorGenerationDraftAdmissionService.includes("lensically_saved_workflow_required")) {
  lifecycleErrors.push("operator_generation_draft_admission_service_module_incomplete");
}
if (!operatorGenerationDraftAdmissionServiceTests.includes("returns the exact required-fields rejection before database reads")
    || !operatorGenerationDraftAdmissionServiceTests.includes("returns the exact identical-draft reuse response with parsed gate arrays")
    || !operatorGenerationDraftAdmissionServiceTests.includes("uses empty gate arrays when an existing draft summary is malformed")
    || !operatorGenerationDraftAdmissionServiceTests.includes("returns the exact saved-workflow rejection at the two-draft limit")
    || !operatorGenerationDraftAdmissionServiceTests.includes("returns normalized continuation context below the draft limit")) {
  lifecycleErrors.push("operator_generation_draft_admission_service_tests_incomplete");
}
if (!source.includes('from "./operatorGenerationDraftPersistencePlanningService"')
    || !source.includes("planOperatorGenerationDraftPersistence({")
    || !source.includes("runGates: async (gateInput)")
    || !source.includes("const insertValues = draftPersistence.insertValues")
    || !source.includes("return operatorJsonResponse(draftPersistence.body)")) {
  lifecycleErrors.push("operator_generation_draft_persistence_planning_service_import_or_binding_missing");
}
if (source.includes('const status = toolName === "save_self_rejected_draft"')
    || source.includes("const draftIndex = Number.isFinite(Number(payload.draft_index))")
    || source.includes("repair_guidance: gateRun.blocking_failures")) {
  lifecycleErrors.push("operator_generation_draft_persistence_planning_service_returned_to_index");
}
if (!operatorGenerationDraftPersistencePlanningService.includes("export async function planOperatorGenerationDraftPersistence")
    || !operatorGenerationDraftPersistencePlanningService.includes('status === "candidate"')
    || !operatorGenerationDraftPersistencePlanningService.includes("dependencies.runGates")
    || !operatorGenerationDraftPersistencePlanningService.includes("gateSummaryJson")
    || !operatorGenerationDraftPersistencePlanningService.includes("metadataJson")
    || !operatorGenerationDraftPersistencePlanningService.includes("repair_guidance")) {
  lifecycleErrors.push("operator_generation_draft_persistence_planning_service_module_incomplete");
}
if (!operatorGenerationDraftPersistencePlanningServiceTests.includes("runs candidate gates with exact context and builds insert values plus repair guidance")
    || !operatorGenerationDraftPersistencePlanningServiceTests.includes("skips gates and returns deterministic defaults for self-rejected drafts")
    || !operatorGenerationDraftPersistencePlanningServiceTests.includes("normalizes malformed strategy and analysis with a zero floor for draft index")
    || !operatorGenerationDraftPersistencePlanningServiceTests.includes("uses scores fallback and stable operator metadata in the persistence plan")) {
  lifecycleErrors.push("operator_generation_draft_persistence_planning_service_tests_incomplete");
}
if (!source.includes('from "./operatorDraftShownTransitionService"')
    || !source.includes("planOperatorDraftShownTransition({")
    || !source.includes("loadDraft: async (draftId)")
    || !source.includes("isAllowedTransition: isAllowedOperatorTransition")
    || !source.includes("const shownPlan = shownTransition.plan")
    || !source.includes("await insertOperatorInventory(env")) {
  lifecycleErrors.push("operator_draft_shown_transition_service_import_or_binding_missing");
}
if (source.includes(`if (toolName === "mark_draft_shown") {
    const draftId = normalizeOperatorText(payload.draft_id, 120);`)
    || source.includes('idempotency_reason: "draft_already_shown_or_advanced"')
    || source.includes('return operatorJsonResponse({ success: false, error: "draft_not_showable", draft_id: draftId')) {
  lifecycleErrors.push("operator_draft_shown_transition_service_returned_to_index");
}
if (!operatorDraftShownTransitionService.includes("export async function planOperatorDraftShownTransition")
    || !operatorDraftShownTransitionService.includes("dependencies.loadDraft")
        || !operatorDraftShownTransitionService.includes("dependencies.isAllowedTransition(currentStatus, \"shown\")")
    || !operatorDraftShownTransitionService.includes("draft_already_shown_or_advanced")
    || !operatorDraftShownTransitionService.includes("draft_not_showable")
    || !operatorDraftShownTransitionService.includes("updateStatus: \"shown\"")
    || !operatorDraftShownTransitionService.includes("inventory")) {
  lifecycleErrors.push("operator_draft_shown_transition_service_module_incomplete");
}
if (!operatorDraftShownTransitionServiceTests.includes("returns the exact required-ID rejection without loading a draft")
    || !operatorDraftShownTransitionServiceTests.includes("returns the exact not-found response after account-scoped retrieval")
    || !operatorDraftShownTransitionServiceTests.includes("returns exact idempotent reuse for %s drafts")
    || !operatorDraftShownTransitionServiceTests.includes("returns the exact not-showable rejection before transition validation")
    || !operatorDraftShownTransitionServiceTests.includes("returns the exact rejection when the shown transition is not allowed")
    || !operatorDraftShownTransitionServiceTests.includes("builds exact update, inventory, and success intents for an eligible draft")) {
  lifecycleErrors.push("operator_draft_shown_transition_service_tests_incomplete");
}
if (!source.includes('from "./operatorDraftDecisionService"')
    || !source.includes("planOperatorDraftDecision({")
    || !source.includes("composeOperatorDraftDecisionResponse(decisionPlan, memory)")
    || !source.includes("loadDraft: async (draftId)")
    || !source.includes("const decisionPlan = decisionPlanning.plan")
    || !source.includes("saveGptStrategyMemory(env, decisionPlan.memory)")) {
  lifecycleErrors.push("operator_draft_decision_service_import_or_binding_missing");
}
if (source.includes(`if (toolName === "approve_draft" || toolName === "reject_draft") {
    const draftId = normalizeOperatorText(payload.draft_id, 120);`)
    || source.includes('idempotency_reason: "draft_decision_already_applied"')
    || source.includes("const memoryKind = toolName === \"approve_draft\"")) {
  lifecycleErrors.push("operator_draft_decision_service_returned_to_index");
}
if (!operatorDraftDecisionService.includes("export async function planOperatorDraftDecision")
    || !operatorDraftDecisionService.includes("export function composeOperatorDraftDecisionResponse")
    || !operatorDraftDecisionService.includes("dependencies.loadDraft")
    || !operatorDraftDecisionService.includes("dependencies.isAllowedTransition")
    || !operatorDraftDecisionService.includes("draft_decision_already_applied")
    || !operatorDraftDecisionService.includes("invalid_status_transition")
    || !operatorDraftDecisionService.includes("claimUpdate")
    || !operatorDraftDecisionService.includes("memory")
    || !operatorDraftDecisionService.includes("inventory")) {
  lifecycleErrors.push("operator_draft_decision_service_module_incomplete");
}
if (!operatorDraftDecisionServiceTests.includes("returns the exact required-ID rejection before loading a draft")
    || !operatorDraftDecisionServiceTests.includes("returns the exact not-found response after account-scoped retrieval")
    || !operatorDraftDecisionServiceTests.includes("returns exact idempotent reuse for %s from %s")
    || !operatorDraftDecisionServiceTests.includes("returns the exact invalid-transition response with canonical statuses")
    || !operatorDraftDecisionServiceTests.includes("builds complete approval update, claim, memory, inventory, and response intents")
    || !operatorDraftDecisionServiceTests.includes("uses feedback then the stable default for rejection reasons and draft strategy fallback")
    || !operatorDraftDecisionServiceTests.includes("composes the exact persisted decision response with nullable memory identity")) {
  lifecycleErrors.push("operator_draft_decision_service_tests_incomplete");
}
if (!source.includes('from "./operatorActiveGateReadService"')
    || !source.includes("readOperatorActiveGates({")
        || !source.includes("listGates: async ({ stageScope, laneKey, contentType })")
    || !source.includes("brand.brand_key,\n        stageScope")
    || !source.includes("return operatorJsonResponse(activeGateRead)")) {
  lifecycleErrors.push("operator_active_gate_read_service_import_or_binding_missing");
}
if (source.includes(`if (toolName === "list_active_gates") {
    const gates = await listOperatorGates(`)
    || source.includes("payload.stage_scope ? normalizeOperatorStage(payload.stage_scope) : null")) {
  lifecycleErrors.push("operator_active_gate_read_service_returned_to_index");
}
if (!operatorActiveGateReadService.includes("export async function readOperatorActiveGates<TStage extends string>")
    || !operatorActiveGateReadService.includes("OperatorActiveGateReadDependencies<TStage extends string>")
    || !operatorActiveGateReadService.includes("stageScope: TStage | null")
    || !operatorActiveGateReadService.includes("dependencies.normalizeStage")
    || !operatorActiveGateReadService.includes("dependencies.normalizeMachineKey")
    || !operatorActiveGateReadService.includes("dependencies.listGates")
    || !operatorActiveGateReadService.includes("return { gates }")) {
  lifecycleErrors.push("operator_active_gate_read_service_module_incomplete");
}
if (!operatorActiveGateReadServiceTests.includes("passes null scopes when optional filters are absent")
    || !operatorActiveGateReadServiceTests.includes("normalizes every supplied scope and returns the exact gates response")) {
  lifecycleErrors.push("operator_active_gate_read_service_tests_incomplete");
}
const operatorGateEvaluationHandlerStart = source.indexOf('if (toolName === "run_gates") {');
const operatorGateEvaluationHandlerEnd = source.indexOf(
  'if (toolName === "submit_candidate_draft"',
  operatorGateEvaluationHandlerStart,
);
const operatorGateEvaluationHandler = operatorGateEvaluationHandlerStart >= 0
  && operatorGateEvaluationHandlerEnd > operatorGateEvaluationHandlerStart
  ? source.slice(operatorGateEvaluationHandlerStart, operatorGateEvaluationHandlerEnd)
  : "";
if (!source.includes('from "./operatorGateMutationPlanningService"')
    || !source.includes("planOperatorGateMutation({")
    || !source.includes("evaluateOperatorGates({ payload }, {")
    || !source.includes("loadMemory: async (memoryId)")
    || !source.includes("loadExistingGate: async ({ brandScope, gateKey, laneScope, contentTypeScope })")
    || !source.includes("createGateId: () => crypto.randomUUID()")
    || !source.includes("runGates: (gateInput) => runOperatorGates(env, {")
    || !source.includes('if (gateMutation.mode === "update")')
    || !source.includes("return operatorJsonResponse(gateMutation.body)")) {
  lifecycleErrors.push("operator_gate_mutation_planning_service_import_or_binding_missing");
}
if (source.includes("let description = normalizeOperatorText(payload.description, 4000, true)")
    || source.includes("const gateKey = normalizeOperatorMachineKey(payload.gate_key)")
    || source.includes("const gateId = existing?.id ?? crypto.randomUUID()")
    || operatorGateEvaluationHandler.includes("sourceCardId: normalizeOperatorText(payload.source_card_id")
    || operatorGateEvaluationHandler.includes("draftText: normalizeOperatorText(payload.draft_text")
    || operatorGateEvaluationHandler.includes("payload.lane_key ?? (payload.draft_analysis")
    || operatorGateEvaluationHandler.includes("Array.isArray(payload.model_gate_results)")) {
  lifecycleErrors.push("operator_gate_mutation_planning_service_returned_to_index");
}
if (!operatorGateMutationPlanningService.includes("export async function planOperatorGateMutation")
    || !operatorGateMutationPlanningService.includes("dependencies.loadMemory")
    || !operatorGateMutationPlanningService.includes("dependencies.loadExistingGate")
    || !operatorGateMutationPlanningService.includes("dependencies.createGateId")
    || !operatorGateMutationPlanningService.includes("memory_not_found")
    || !operatorGateMutationPlanningService.includes("gate_key and description are required")
    || !operatorGateMutationPlanningService.includes('createdFrom = "strategy_memory"')
    || !operatorGateMutationPlanningService.includes('mode: existing?.id ? "update" : "insert"')
    || !operatorGateMutationPlanningService.includes("sourceMemoryIdsJson")
    || !operatorGateMutationPlanningService.includes("created_from_memory_id")
        || !operatorGateMutationPlanningService.includes("export async function evaluateOperatorGates")
    || !operatorGateMutationPlanningService.includes("dependencies.normalizeText(payload.source_card_id")
    || !operatorGateMutationPlanningService.includes("dependencies.normalizeStage(payload.stage")
    || !operatorGateMutationPlanningService.includes("payload.lane_key ?? draftAnalysis?.lane_key")
    || !operatorGateMutationPlanningService.includes("Array.isArray(payload.model_gate_results)")
    || !operatorGateMutationPlanningService.includes("return dependencies.runGates({")
    || !operatorGateMutationPlanningService.includes("export async function runOperatorGateEngine")
    || !operatorGateMutationPlanningService.includes('gateKey === "source_transformation_contract_gate"')
    || !operatorGateMutationPlanningService.includes('gateKey === "historical_owner_rejection_gate"')
    || !operatorGateMutationPlanningService.includes('gateKey === "exact_duplicate_gate"')
    || !operatorGateMutationPlanningService.includes('gateKey === "scheduled_collision_gate"')
    || !operatorGateMutationPlanningService.includes("dependencies.persistGateResult")
    || !operatorGateMutationPlanningService.includes("No candidate gate executed for this context.")) {
  lifecycleErrors.push("operator_gate_mutation_planning_service_module_incomplete");
}
const operatorGateEngineAdapterStart = source.indexOf("async function runOperatorGates(");
const operatorGateEngineAdapterEnd = source.indexOf(
  "function isAllowedOperatorTransition",
  operatorGateEngineAdapterStart,
);
const operatorGateEngineAdapter = operatorGateEngineAdapterStart >= 0
  && operatorGateEngineAdapterEnd > operatorGateEngineAdapterStart
  ? source.slice(operatorGateEngineAdapterStart, operatorGateEngineAdapterEnd)
  : "";
if (!operatorGateEngineAdapter.includes("return runOperatorGateEngine({")
    || !operatorGateEngineAdapter.includes("findExactDuplicate: async")
    || !operatorGateEngineAdapter.includes("persistGateResult:")) {
  lifecycleErrors.push("operator_gate_engine_adapter_incomplete");
}
if (source.includes("function buildGateResult(")
    || operatorGateEngineAdapter.includes('gateKey === "source_transformation_contract_gate"')
    || operatorGateEngineAdapter.includes('gateKey === "historical_owner_rejection_gate"')
    || operatorGateEngineAdapter.includes('gateKey === "exact_duplicate_gate"')
    || operatorGateEngineAdapter.includes('gateKey === "scheduled_collision_gate"')
    || operatorGateEngineAdapter.includes("No candidate gate executed for this context.")) {
  lifecycleErrors.push("operator_gate_engine_returned_to_index");
}
if (!operatorGateMutationPlanningServiceTests.includes("returns memory_not_found for an invalid promotion ID before gate lookup")
    || !operatorGateMutationPlanningServiceTests.includes("returns memory_not_found when the account-scoped promotion source is absent")
    || !operatorGateMutationPlanningServiceTests.includes("returns the exact required-fields rejection before identity lookup")
    || !operatorGateMutationPlanningServiceTests.includes("uses promoted memory fallbacks and builds an exact update plan")
    || !operatorGateMutationPlanningServiceTests.includes("builds a normalized account-scoped insert plan and exact response")
    || !operatorGateMutationPlanningServiceTests.includes("normalizes gate-evaluation input and preserves exact gate-engine results")
    || !operatorGateMutationPlanningServiceTests.includes("preserves explicit lane precedence and rejects invalid structured surfaces")
    || !operatorGateMutationPlanningServiceTests.includes("preserves deterministic blocking gates and required execution auditing")
    || !operatorGateMutationPlanningServiceTests.includes("preserves exact model results and persists every draft gate receipt")
    || !operatorGateMutationPlanningServiceTests.includes("preserves duplicate and scheduling collision outcomes through explicit adapters")) {
  lifecycleErrors.push("operator_gate_mutation_planning_service_tests_incomplete");
}
if (!source.includes('from "./operatorStrategyMemoryListReadService"')
    || !source.includes("readOperatorStrategyMemoryList({ payload }")
    || !source.includes("listActiveMemory: async ({ kinds, limit, offset, status })")
    || !source.includes("countActiveMemory: async ({ kinds, status })")
    || !source.includes("return operatorJsonResponse(memoryList)")) {
  lifecycleErrors.push("operator_strategy_memory_list_read_service_import_or_binding_missing");
}
if (source.includes("const limit = Math.min(Math.max(Math.trunc(Number(payload.limit ?? 50)), 1), 100)")
    || source.includes("const kinds = kind ? [kind] : []")
    || source.includes("has_more: offset + items.length < total")) {
  lifecycleErrors.push("operator_strategy_memory_list_read_service_returned_to_index");
}
if (!operatorStrategyMemoryListReadService.includes("export async function readOperatorStrategyMemoryList")
    || !operatorStrategyMemoryListReadService.includes("dependencies.normalizeMachineKey")
    || !operatorStrategyMemoryListReadService.includes("Math.min(")
    || !operatorStrategyMemoryListReadService.includes("Math.max(")
    || !operatorStrategyMemoryListReadService.includes('status: "active"')
    || !operatorStrategyMemoryListReadService.includes("dependencies.listActiveMemory")
    || !operatorStrategyMemoryListReadService.includes("dependencies.countActiveMemory")
    || !operatorStrategyMemoryListReadService.includes("returned_count: items.length")
    || !operatorStrategyMemoryListReadService.includes("has_more: offset + items.length < total")) {
  lifecycleErrors.push("operator_strategy_memory_list_read_service_module_incomplete");
}
if (!operatorStrategyMemoryListReadServiceTests.includes("uses unfiltered active memory with default pagination and exact counts")
    || !operatorStrategyMemoryListReadServiceTests.includes("normalizes one kind and clamps limit and offset before active retrieval")
    || !operatorStrategyMemoryListReadServiceTests.includes("applies the lower limit bound and computes has_more from offset plus returned count")) {
  lifecycleErrors.push("operator_strategy_memory_list_read_service_tests_incomplete");
}
if (!source.includes('from "./operatorStrategyMemorySaveService"')
    || !source.includes("planOperatorStrategyMemorySave(payload")
    || !source.includes("normalizeKind: normalizeGptStrategyMemoryKind")
    || !source.includes("allowedKinds: Array.from(GPT_STRATEGY_MEMORY_KINDS)")
    || !source.includes("kind: memorySave.values.memoryKind")
    || !source.includes("composeOperatorStrategyMemorySaveResponse(memory)")) {
  lifecycleErrors.push("operator_strategy_memory_save_service_import_or_binding_missing");
}
if (source.includes("const kind = normalizeGptStrategyMemoryKind(payload.kind)")
    || source.includes("strategy_memory_body_required\" }, 400")
    || source.includes("metadataJson: normalizeOperatorJson({ ...(payload.metadata")) {
  lifecycleErrors.push("operator_strategy_memory_save_service_returned_to_index");
}
if (!operatorStrategyMemorySaveService.includes("export function planOperatorStrategyMemorySave")
    || !operatorStrategyMemorySaveService.includes("export function composeOperatorStrategyMemorySaveResponse")
    || !operatorStrategyMemorySaveService.includes("allowedKinds: readonly unknown[]")
    || !operatorStrategyMemorySaveService.includes("dependencies.normalizeKind")
    || !operatorStrategyMemorySaveService.includes("invalid_strategy_memory_kind")
    || !operatorStrategyMemorySaveService.includes("Array.from(dependencies.allowedKinds)")
    || !operatorStrategyMemorySaveService.includes("strategy_memory_body_required")
    || !operatorStrategyMemorySaveService.includes("source: payload.source ?? \"mcp_operator\"")
    || !operatorStrategyMemorySaveService.includes("metadataJson")
    || !operatorStrategyMemorySaveService.includes("memory_id: memory?.id ?? null")) {
  lifecycleErrors.push("operator_strategy_memory_save_service_module_incomplete");
}
if (!operatorStrategyMemorySaveServiceTests.includes("returns the exact invalid-kind rejection with all allowed kinds")
    || !operatorStrategyMemorySaveServiceTests.includes("returns the exact required-body rejection after valid kind admission")
    || !operatorStrategyMemorySaveServiceTests.includes("builds normalized persistence values with default source metadata")
    || !operatorStrategyMemorySaveServiceTests.includes("uses an explicit source and ignores malformed metadata containers")
    || !operatorStrategyMemorySaveServiceTests.includes("composes exact persisted and null memory responses")) {
  lifecycleErrors.push("operator_strategy_memory_save_service_tests_incomplete");
}
if (!source.includes('from "./operatorScheduledPostListReadService"')
    || !source.includes("readOperatorScheduledPostList({ payload }")
    || !source.includes("defaultTimezone: WORKSPACE_DEFAULT_TIMEZONE")
    || !source.includes("listForLocalDate: async ({ date, timezone })")
    || !source.includes("return operatorJsonResponse(scheduledPostList)")) {
  lifecycleErrors.push("operator_scheduled_post_list_read_service_import_or_binding_missing");
}
const scheduledPostListHandlerStart = source.indexOf('if (toolName === "list_scheduled_posts")');
const scheduledPostListHandlerEnd = source.indexOf('if (toolName === "delete_scheduled_post")', scheduledPostListHandlerStart);
const scheduledPostListHandler = scheduledPostListHandlerStart >= 0 && scheduledPostListHandlerEnd > scheduledPostListHandlerStart
  ? source.slice(scheduledPostListHandlerStart, scheduledPostListHandlerEnd)
  : "";
if (scheduledPostListHandler.includes("const date = normalizeOperatorText(payload.date, 20, true)")
    || scheduledPostListHandler.includes("const timezone = normalizeOperatorText(payload.timezone, 100, true) ?? WORKSPACE_DEFAULT_TIMEZONE")
    || scheduledPostListHandler.includes("const items = date && isValidIsoDate(date)")) {
  lifecycleErrors.push("operator_scheduled_post_list_read_service_returned_to_index");
}
if (!operatorScheduledPostListReadService.includes("export async function readOperatorScheduledPostList")
    || !operatorScheduledPostListReadService.includes("dependencies.normalizeText(input.payload.date, 20, true)")
    || !operatorScheduledPostListReadService.includes("dependencies.defaultTimezone")
    || !operatorScheduledPostListReadService.includes("dependencies.isValidIsoDate(date)")
    || !operatorScheduledPostListReadService.includes("dependencies.listForLocalDate")
    || !operatorScheduledPostListReadService.includes("returned_count: items.length")
    || !operatorScheduledPostListReadService.includes("has_more: false")
    || !operatorScheduledPostListReadService.includes("deletion_history_exposed_to_model: false")) {
  lifecycleErrors.push("operator_scheduled_post_list_read_service_module_incomplete");
}
if (!operatorScheduledPostListReadServiceTests.includes("retrieves one valid local date with the normalized explicit timezone")
    || !operatorScheduledPostListReadServiceTests.includes("uses the workspace timezone and returns an empty exact response when date is absent")
    || !operatorScheduledPostListReadServiceTests.includes("suppresses retrieval for an invalid normalized date")) {
  lifecycleErrors.push("operator_scheduled_post_list_read_service_tests_incomplete");
}
if (!source.includes('from "./operatorScheduledPostDeletionService"')
    || !source.includes("deleteOperatorScheduledPost({ payload }")
    || !source.includes("normalizeReasonCode: normalizeScheduledPostDeletionReasonCode")
    || !source.includes("allowedReasonCodes: SCHEDULED_POST_DELETION_REASON_CODES")
    || !source.includes('deletedBy: "model"')
    || !source.includes('deletionSource: "mcp"')
    || !source.includes("return operatorJsonResponse(scheduledPostDeletion.body, scheduledPostDeletion.statusCode)")) {
  lifecycleErrors.push("operator_scheduled_post_deletion_service_import_or_binding_missing");
}
const scheduledPostDeletionHandlerStart = source.indexOf('if (toolName === "delete_scheduled_post")');
const scheduledPostDeletionHandlerEnd = source.indexOf('if (toolName === "edit_scheduled_post")', scheduledPostDeletionHandlerStart);
const scheduledPostDeletionHandler = scheduledPostDeletionHandlerStart >= 0 && scheduledPostDeletionHandlerEnd > scheduledPostDeletionHandlerStart
  ? source.slice(scheduledPostDeletionHandlerStart, scheduledPostDeletionHandlerEnd)
  : "";
if (scheduledPostDeletionHandler.includes("const scheduledPostId = Math.trunc(Number(payload.scheduled_post_id ?? 0))")
    || scheduledPostDeletionHandler.includes("const reasonCode = normalizeScheduledPostDeletionReasonCode(payload.reason_code)")
    || scheduledPostDeletionHandler.includes('deletion.outcome === "not_found"')) {
  lifecycleErrors.push("operator_scheduled_post_deletion_service_returned_to_index");
}
if (!operatorScheduledPostDeletionService.includes("export async function deleteOperatorScheduledPost")
    || !operatorScheduledPostDeletionService.includes("allowedReasonCodes: readonly unknown[]")
    || !operatorScheduledPostDeletionService.includes("scheduled_post_id is required")
    || !operatorScheduledPostDeletionService.includes("scheduled_post_deletion_reason_code_required")
    || !operatorScheduledPostDeletionService.includes("dependencies.deleteScheduledPost")
    || !operatorScheduledPostDeletionService.includes("scheduled_post_not_found")
    || !operatorScheduledPostDeletionService.includes("only_approved_scheduled_posts_can_be_deleted")
    || !operatorScheduledPostDeletionService.includes("scheduled_post_deletion_reason_required")
    || !operatorScheduledPostDeletionService.includes("strategy_memory_written: false")) {
  lifecycleErrors.push("operator_scheduled_post_deletion_service_module_incomplete");
}
if (!operatorScheduledPostDeletionServiceTests.includes("rejects a missing scheduled-post ID before protected deletion")
    || !operatorScheduledPostDeletionServiceTests.includes("rejects an invalid deletion reason with the exact allowed codes")
    || !operatorScheduledPostDeletionServiceTests.includes("normalizes and forwards the protected deletion request")
    || !operatorScheduledPostDeletionServiceTests.includes("maps %s to the exact error response")
    || !operatorScheduledPostDeletionServiceTests.includes("returns null deletion and false replay for a fresh helper result")) {
  lifecycleErrors.push("operator_scheduled_post_deletion_service_tests_incomplete");
}
if (!source.includes('from "./operatorScheduledPostRetryService"')
    || !source.includes("retryOperatorScheduledPost({ scheduledPostId }")
    || !source.includes("approvedStatus: SCHEDULED_POST_STATUS_APPROVED")
    || !source.includes("postedStatus: SCHEDULED_POST_STATUS_POSTED")
    || !source.includes("nowMs: Date.now()")
    || !source.includes("getRetryable: async (id)")
    || !source.includes("processScheduledPost: async (scheduledPost)")
    || !source.includes("getRefreshed: async (id)")
    || !source.includes("return operatorJsonResponse(scheduledPostRetry.body, scheduledPostRetry.statusCode)")) {
  lifecycleErrors.push("operator_scheduled_post_retry_service_import_or_binding_missing");
}
const scheduledPostEditHandlerStart = source.indexOf('if (toolName === "edit_scheduled_post")');
const scheduledPostEditMutationStart = source.indexOf("const hasText = Object.prototype.hasOwnProperty.call(payload, \"text\")", scheduledPostEditHandlerStart);
const scheduledPostRetryHandler = scheduledPostEditHandlerStart >= 0 && scheduledPostEditMutationStart > scheduledPostEditHandlerStart
  ? source.slice(scheduledPostEditHandlerStart, scheduledPostEditMutationStart)
  : "";
if (scheduledPostRetryHandler.includes("const retryable = await env.DB.prepare")
    || scheduledPostRetryHandler.includes('retryable.status !== SCHEDULED_POST_STATUS_APPROVED')
    || scheduledPostRetryHandler.includes("const published = refreshed?.status === SCHEDULED_POST_STATUS_POSTED")) {
  lifecycleErrors.push("operator_scheduled_post_retry_service_returned_to_index");
}
if (!operatorScheduledPostRetryService.includes("export async function retryOperatorScheduledPost")
    || !operatorScheduledPostRetryService.includes("dependencies.getRetryable")
    || !operatorScheduledPostRetryService.includes("scheduled_post_already_published")
    || !operatorScheduledPostRetryService.includes("scheduled_post_not_retryable")
    || !operatorScheduledPostRetryService.includes("dependencies.nowMs")
    || !operatorScheduledPostRetryService.includes("dependencies.processScheduledPost")
    || !operatorScheduledPostRetryService.includes("dependencies.getRefreshed")
    || !operatorScheduledPostRetryService.includes("statusCode: published ? 200 : 502")
    || !operatorScheduledPostRetryService.includes("scheduled_post_retry_failed")) {
  lifecycleErrors.push("operator_scheduled_post_retry_service_module_incomplete");
}
if (!operatorScheduledPostRetryServiceTests.includes("returns the exact not-found response before processing")
    || !operatorScheduledPostRetryServiceTests.includes("rejects an already-published record")
    || !operatorScheduledPostRetryServiceTests.includes("rejects a non-approved record with its current status")
    || !operatorScheduledPostRetryServiceTests.includes("uses the injected clock to reject a future approved record")
    || !operatorScheduledPostRetryServiceTests.includes("processes once and returns exact refreshed publication success")
        || !operatorScheduledPostRetryServiceTests.includes("returns the refreshed publish error with a 502 response")
    || !operatorScheduledPostRetryServiceTests.includes("uses the exact fallback when refreshed state is unavailable")
    || !operatorScheduledPostRetryServiceTests.includes("async (override) =>")
    || operatorScheduledPostRetryServiceTests.includes("async ([override]) =>")) {
  lifecycleErrors.push("operator_scheduled_post_retry_service_tests_incomplete");
}
































































if (!source.includes('from "./operatorScheduledPostEditMutationService"')
    || !source.includes("editOperatorScheduledPost({")
    || !source.includes("brandKey: brand.brand_key")
    || !source.includes("defaultTimezone: WORKSPACE_DEFAULT_TIMEZONE")
    || !source.includes("normalizeSpoilerPhrases: normalizeSpoilerPhrasesInput")
    || !source.includes("updateScheduledPost: async ({")
    || !source.includes("loadLinkedDraft: async (id) => await env.DB.prepare")
    || !source.includes("parseStrategyJson: (value) => safeParseJsonString(value)")
    || !source.includes("persistInventory: async (inventory)")
    || !source.includes("return operatorJsonResponse(scheduledPostEdit.body, scheduledPostEdit.statusCode)")) {
  lifecycleErrors.push("operator_scheduled_post_edit_mutation_service_import_or_binding_missing");
}
const scheduledPostEditMutationEnd = source.indexOf('if (toolName === "schedule_owner_approved_batch")', scheduledPostEditHandlerStart);
const scheduledPostEditMutationHandler = scheduledPostEditHandlerStart >= 0 && scheduledPostEditMutationEnd > scheduledPostEditHandlerStart
  ? source.slice(scheduledPostEditHandlerStart, scheduledPostEditMutationEnd)
  : "";
if (scheduledPostEditMutationHandler.includes('const hasText = Object.prototype.hasOwnProperty.call(payload, "text")')
    || scheduledPostEditMutationHandler.includes("if (!updated.success || !updated.scheduledPost)")
    || scheduledPostEditMutationHandler.includes("linked_drafts_updated: updated.linkedDraftsUpdated ?? 0")) {
  lifecycleErrors.push("operator_scheduled_post_edit_mutation_service_returned_to_index");
}
if (!operatorScheduledPostEditMutationService.includes("export async function editOperatorScheduledPost")
    || !operatorScheduledPostEditMutationService.includes('Object.prototype.hasOwnProperty.call(payload, "text")')
    || !operatorScheduledPostEditMutationService.includes('Object.prototype.hasOwnProperty.call(payload, "spoiler_phrases")')
    || !operatorScheduledPostEditMutationService.includes("dependencies.updateScheduledPost")
    || !operatorScheduledPostEditMutationService.includes("scheduled_post_update_failed")
    || !operatorScheduledPostEditMutationService.includes("dependencies.loadLinkedDraft")
    || !operatorScheduledPostEditMutationService.includes("dependencies.persistInventory")
    || !operatorScheduledPostEditMutationService.includes('edit_source: "edit_scheduled_post"')
    || !operatorScheduledPostEditMutationService.includes("linked_drafts_updated: updated.linkedDraftsUpdated ?? 0")) {
  lifecycleErrors.push("operator_scheduled_post_edit_mutation_service_module_incomplete");
}
if (!operatorScheduledPostEditMutationServiceTests.includes("preserves omitted edit fields and writes exact unlinked inventory")
    || !operatorScheduledPostEditMutationServiceTests.includes("normalizes every supplied edit and preserves linked-draft inventory lineage")
    || !operatorScheduledPostEditMutationServiceTests.includes("maps an exact protected update failure without draft or inventory work")
    || !operatorScheduledPostEditMutationServiceTests.includes("uses the exact update-failure fallback and zero linked-draft count")) {
  lifecycleErrors.push("operator_scheduled_post_edit_mutation_service_tests_incomplete");
}
if (!source.includes("scheduleOperatorOwnerApprovedBatch({")
    || !source.includes("isValidTime: (value) =>")
    || !source.includes("createScheduledPost: async ({ text, date, time, timezone })")
    || !source.includes("saveStrategyMemory: async (memory)")
    || !source.includes("return operatorJsonResponse(ownerApprovedBatch.body, ownerApprovedBatch.statusCode)")) {
  lifecycleErrors.push("operator_owner_approved_batch_scheduling_service_import_or_binding_missing");
}
const ownerApprovedBatchHandlerStart = source.indexOf('if (toolName === "schedule_owner_approved_batch")');
const ownerApprovedBatchHandlerEnd = source.indexOf('if (toolName === "schedule_approved_draft")', ownerApprovedBatchHandlerStart);
const ownerApprovedBatchHandler = ownerApprovedBatchHandlerStart >= 0 && ownerApprovedBatchHandlerEnd > ownerApprovedBatchHandlerStart
  ? source.slice(ownerApprovedBatchHandlerStart, ownerApprovedBatchHandlerEnd)
  : "";
if (ownerApprovedBatchHandler.includes("const ownerApproval = normalizeOperatorText(payload.owner_approval")
    || ownerApprovedBatchHandler.includes("for (let index = 0; index < rawPosts.length; index += 1)")
    || ownerApprovedBatchHandler.includes("scheduled_count: scheduledItems.length")) {
  lifecycleErrors.push("operator_owner_approved_batch_scheduling_service_returned_to_index");
}
if (!operatorScheduledPostEditMutationService.includes("export async function scheduleOperatorOwnerApprovedBatch")
    || !operatorScheduledPostEditMutationService.includes("input.payload.posts.slice(0, 12)")
    || !operatorScheduledPostEditMutationService.includes("manifest_lineage_preserving_schedule_required")
    || !operatorScheduledPostEditMutationService.includes("dependencies.isValidIsoDate(date)")
    || !operatorScheduledPostEditMutationService.includes("dependencies.isValidTime(time)")
    || !operatorScheduledPostEditMutationService.includes("dependencies.createScheduledPost")
    || !operatorScheduledPostEditMutationService.includes("dependencies.saveStrategyMemory")
    || !operatorScheduledPostEditMutationService.includes('source: "schedule_owner_approved_batch"')) {
  lifecycleErrors.push("operator_owner_approved_batch_scheduling_service_module_incomplete");
}
if (!operatorScheduledPostEditMutationServiceTests.includes("rejects missing approval or posts before scheduling")
    || !operatorScheduledPostEditMutationServiceTests.includes("blocks Manifest direct scheduling with the exact lineage response")
    || !operatorScheduledPostEditMutationServiceTests.includes("returns exact partial progress when a later post is invalid")
    || !operatorScheduledPostEditMutationServiceTests.includes("maps a scheduling failure with exact prior progress")
    || !operatorScheduledPostEditMutationServiceTests.includes("normalizes, schedules sequentially, saves exact memory, and returns success")) {
  lifecycleErrors.push("operator_owner_approved_batch_scheduling_service_tests_incomplete");
}
if (!source.includes("scheduleOperatorApprovedDraft({")
    || !source.includes("loadDraft: async (draftId) =>")
    || !source.includes("loadExistingScheduled: async (scheduledPostId)")
    || !source.includes("runSchedulingGates: async ({ draftId, sourceCardId, draftText, date, time, timezone })")
    || !source.includes("updateDraftScheduled: async ({ scheduledPostId, draftId })")
    || !source.includes("updateDailySourceClaim: async ({ scheduledPostId, draftId })")
    || !source.includes("persistStrategyTag: async ({ scheduledPostId, strategy })")
    || !source.includes("persistInventory: async ({ scheduledPostId, text, sourceCardId, strategy })")
    || !source.includes("return operatorJsonResponse(approvedDraftSchedule.body, approvedDraftSchedule.statusCode)")) {
  lifecycleErrors.push("operator_approved_draft_scheduling_service_import_or_binding_missing");
}
const approvedDraftScheduleHandlerStart = source.indexOf('if (toolName === "schedule_approved_draft")');
const approvedDraftScheduleHandlerEnd = source.indexOf('if (toolName === "get_manifest_cycle_receipt")', approvedDraftScheduleHandlerStart);
const approvedDraftScheduleHandler = approvedDraftScheduleHandlerStart >= 0 && approvedDraftScheduleHandlerEnd > approvedDraftScheduleHandlerStart
  ? source.slice(approvedDraftScheduleHandlerStart, approvedDraftScheduleHandlerEnd)
  : "";
if (approvedDraftScheduleHandler.includes("const draftId = normalizeOperatorText(payload.draft_id")
    || approvedDraftScheduleHandler.includes("if ((draft.status === \"scheduled\" || draft.status === \"published\")")
    || approvedDraftScheduleHandler.includes("return operatorJsonResponse({ scheduled_post_id: scheduled.scheduledPostId")) {
  lifecycleErrors.push("operator_approved_draft_scheduling_service_returned_to_index");
}
if (!operatorScheduledPostEditMutationService.includes("export async function scheduleOperatorApprovedDraft")
    || !operatorScheduledPostEditMutationService.includes("dependencies.loadDraft")
    || !operatorScheduledPostEditMutationService.includes("draft_already_scheduled")
    || !operatorScheduledPostEditMutationService.includes("dependencies.runSchedulingGates")
    || !operatorScheduledPostEditMutationService.includes("scheduling_gates_failed")
    || !operatorScheduledPostEditMutationService.includes("dependencies.updateDraftScheduled")
    || !operatorScheduledPostEditMutationService.includes("dependencies.updateDailySourceClaim")
    || !operatorScheduledPostEditMutationService.includes("dependencies.persistStrategyTag")
    || !operatorScheduledPostEditMutationService.includes("dependencies.persistInventory")) {
  lifecycleErrors.push("operator_approved_draft_scheduling_service_module_incomplete");
}
if (!operatorScheduledPostEditMutationServiceTests.includes("rejects missing draft or schedule fields before orchestration")
    || !operatorScheduledPostEditMutationServiceTests.includes("reuses an already scheduled draft with the exact idempotency response")
    || !operatorScheduledPostEditMutationServiceTests.includes("returns the exact scheduling gate failure")
    || !operatorScheduledPostEditMutationServiceTests.includes("maps one scheduled-post creation failure without persistence")
    || !operatorScheduledPostEditMutationServiceTests.includes("normalizes, gates, schedules, persists lineage, and returns exact success")) {
  lifecycleErrors.push("operator_approved_draft_scheduling_service_tests_incomplete");
}



if (literalVersionAssertionEntries.length > 0) {
  lifecycleErrors.push(`operator_version_literal_assertion_forbidden:${literalVersionAssertionEntries.map((entry) => entry.line_number).join(",")}`);
}
if (versionAssertionEntries.length === 0) {
  lifecycleErrors.push("operator_version_assertions_missing");
} else if (canonicalVersionAssertionEntries.length !== versionAssertionEntries.length) {
  lifecycleErrors.push(`operator_canonical_version_assertions_incomplete:${canonicalVersionAssertionEntries.length}:${versionAssertionEntries.length}`);
}

if (capabilityLifecycle?.version !== "lensically-capability-lifecycle-v1") lifecycleErrors.push("capability_lifecycle_version_invalid");
if (capabilityLifecycle?.canonical_location !== "lensically-worker/src/systemDirectory/capabilityLifecycle.json") lifecycleErrors.push("capability_lifecycle_location_invalid");
if (capabilityLifecycle?.mandatory !== true) lifecycleErrors.push("capability_lifecycle_not_mandatory");
if (capabilityLifecycle?.rules?.model_executes_automatically !== true) lifecycleErrors.push("capability_lifecycle_model_execution_not_automatic");
if (capabilityLifecycle?.rules?.owner_prompt_required !== false) lifecycleErrors.push("capability_lifecycle_owner_prompt_not_disabled");
if (capabilityLifecycle?.rules?.compatibility_bridges_forbidden !== true) lifecycleErrors.push("capability_lifecycle_bridge_ban_missing");
if (!Array.isArray(capabilityLifecycle?.required_sequence) || !capabilityLifecycle.required_sequence.includes("verify_live_capability")) lifecycleErrors.push("capability_lifecycle_live_verification_step_missing");
if (toolDefinitionNames.length < lifecycleBaselineTools.size) lifecycleErrors.push(`capability_lifecycle_tool_parser_incomplete:${toolDefinitionNames.length}:${lifecycleBaselineTools.size}`);

for (const declaration of lifecycleDeclarations) {
  for (const field of lifecycleRequiredFields) {
    if (!(field in declaration) || declaration[field] === null || declaration[field] === "") lifecycleErrors.push(`capability_declaration_field_missing:${declaration.capability_id ?? "unknown"}:${field}`);
  }
  if (declaredCapabilityIds.has(declaration.capability_id)) lifecycleErrors.push(`capability_declaration_duplicate:${declaration.capability_id}`);
  declaredCapabilityIds.add(declaration.capability_id);
  if (declaredDirectoryIds.has(declaration.directory_entry_id)) lifecycleErrors.push(`capability_directory_declaration_duplicate:${declaration.directory_entry_id}`);
  declaredDirectoryIds.add(declaration.directory_entry_id);
  if (!lifecycleImplementationModes.has(declaration.implementation_mode)) lifecycleErrors.push(`capability_implementation_mode_invalid:${declaration.capability_id}`);
  if (!lifecycleReleaseScopes.has(declaration.release_scope)) lifecycleErrors.push(`capability_release_scope_invalid:${declaration.capability_id}:${declaration.release_scope}`);
  if (declaration.compatibility_bridge !== false) lifecycleErrors.push(`capability_bridge_forbidden:${declaration.capability_id}`);
  if (!toolDefinitionNames.includes(declaration.canonical_handler)) lifecycleErrors.push(`capability_handler_missing:${declaration.capability_id}:${declaration.canonical_handler}`);
  if (!directoryEntryIds.includes(declaration.directory_entry_id)) lifecycleErrors.push(`capability_directory_entry_missing:${declaration.capability_id}:${declaration.directory_entry_id}`);
  if (!combinedRegressionTests.includes(`it("${declaration.focused_regression}"`)) lifecycleErrors.push(`capability_regression_missing:${declaration.capability_id}`);
  if (typeof declaration.live_verification !== "string" || declaration.live_verification.trim().length < 20) lifecycleErrors.push(`capability_live_verification_missing:${declaration.capability_id}`);
  const entryStart = directorySection.indexOf(`id: "${declaration.directory_entry_id}"`);
  const entryEnd = entryStart >= 0 ? directorySection.indexOf("\n  },", entryStart) : -1;
  const entryText = entryStart >= 0 ? directorySection.slice(entryStart, entryEnd >= 0 ? entryEnd : undefined) : "";
  if (!entryText.includes(`route_intent: "${declaration.route_intent}"`)) lifecycleErrors.push(`capability_static_route_missing:${declaration.capability_id}:${declaration.route_intent}`);
  if (declaration.implementation_mode === "new_handler") declaredNewHandlers.add(declaration.canonical_handler);
}

for (const toolName of toolDefinitionNames) {
  if (!lifecycleBaselineTools.has(toolName) && !declaredNewHandlers.has(toolName)) lifecycleErrors.push(`undeclared_new_capability_handler:${toolName}`);
}
for (const entryId of directoryEntryIds) {
  if (!lifecycleBaselineDirectoryIds.has(entryId) && !declaredDirectoryIds.has(entryId)) lifecycleErrors.push(`undeclared_new_directory_entry:${entryId}`);
}
if (!workflow.includes("fast-validation:")
    || !workflow.includes("Typecheck and lifecycle gate")
    || !workflow.includes("node scripts/release-preflight.mjs --capability-lifecycle-only")) {
  lifecycleErrors.push("capability_lifecycle_fast_validation_gate_missing");
}

if (!workflow.includes("node scripts/release-preflight.mjs --capability-lifecycle-only")) lifecycleErrors.push("capability_lifecycle_engineering_gate_missing");

if (lifecycleErrors.length > 0) {
  for (const error of lifecycleErrors) {
    console.error(`[capability-lifecycle] ${error}`);
    console.error(`::error title=Capability lifecycle gate::${error}`);
  }
  throw new Error(`capability_lifecycle_invalid:${lifecycleErrors.join("|")}`);
}
if (process.argv.includes("--capability-lifecycle-only")) {
  console.log(`[capability-lifecycle] ok declarations=${lifecycleDeclarations.length} tools=${toolDefinitionNames.length} directory_entries=${directoryEntryIds.length}`);
  process.exit(0);
}

if (!currentState.includes("Operator MCP uses the canonical `OPERATOR_MCP_VERSION` value declared in `lensically-worker/src/operatorMcpProtocol.ts`")) {
  errors.push("current_state_canonical_version_reference_missing");
}
if (/Operator MCP v\d+\.\d+\.\d+/.test(currentState)) {
  errors.push("current_state_manual_version_literal_forbidden");
}

// Fresh-chat acceptance requires startup documents to match the advertised direct typed Main schema.
for (const [documentName, documentText] of [["AGENTS.md", agentRules], ["CURRENT_STATE.md", currentState], ["OPERATING_MEMORY.md", operatingMemory]]) {
  if (!documentText.includes("direct typed")
      || !documentText.includes("not advertised") && !documentText.includes("not public")
      || !documentText.includes("`profile_id`")
      || !documentText.includes("generic `inputs`")) {
    errors.push(`startup_public_contract_drift:${documentName}`);
  }
}

if (!source.includes('const OPERATOR_REGISTRY_GENERATION = "static-execution-router-v2";')
        || !router.includes('MANDATORY_EXECUTION_MAP_VERSION = "static-execution-router-v2"')
    || !router.includes("source_defined_static_route")
    || !router.includes("d1_execution_library_bypassed: true")
    || !router.includes("discovery_allowed: false")
    || !router.includes("model_tool_choice_allowed: false")) {
  errors.push("static_execution_router_contract_missing");
}

if (!router.includes('AGENT_NATIVE_OPERATING_CONTRACT_VERSION = "agent-native-operating-contract-v1"')
    || !router.includes('SINGLE_ACTIVE_OUTCOME_POLICY_VERSION = "single-active-outcome-v1"')
    || !router.includes('AUTONOMOUS_BUSINESS_OPERATOR_ROLE = "Lensically Autonomous Business Operator"')
    || !router.includes("classifyOperatorWorkIntake")
    || !router.includes("validateOperatorActionClosure")
        || !workStateMigration.includes("CREATE TABLE IF NOT EXISTS operator_work_state")
    || !workStateMigration.includes("CREATE TABLE IF NOT EXISTS operator_work_ledger")
    || !workStateMigration.includes("CREATE TABLE IF NOT EXISTS operator_repo_write_sessions")
    || !workStateMigration.includes("CREATE TABLE IF NOT EXISTS operator_system_retirements")
    || !workStateMigration.includes("DROP TABLE IF EXISTS operator_workflow_sessions")
    || !workStateMigration.includes("human-free-retirement-v2")
    || !source.includes('table: "operator_work_state"')
    || !source.includes('table: "operator_work_ledger"')
    || !source.includes('table: "operator_repo_write_sessions"')
    || !source.includes('table: "operator_system_retirements"')
        || !operatorMcpEngineeringRegistry.includes('name: "getOperatorWorkState"')
    || !operatorMcpEngineeringRegistry.includes('name: "intakeOperatorWork"')
    || !operatorMcpEngineeringRegistry.includes('name: "advanceOperatorWork"')
    || !source.includes("active_outcome_requirements_incomplete")
    || !source.includes("operator_work_self_merge_forbidden")
    || source.includes("active_outcome_key = CASE WHEN operator_work_state.status")
        || !operatorMcpToolCallDispatcher.includes("resultPayload.operator_action_closure = await dependencies.buildActionClosure")
    || !source.includes("cloudflare_validation_state")
    || !clientSafety.includes("repository_status")
    || !systemDirectoryTests.includes("reads repository and validation status through the exact Main profile")
    || !clientSafety.includes("operator_work_state")
    || !clientSafety.includes("operator_work_intake")
    || !clientSafety.includes("operator_work_transition")
    || !systemDirectoryTests.includes("defines the autonomous business operator as a durable runtime contract")
    || !systemDirectoryTests.includes("defers noncritical scope while allowing only mandatory interruptions")
    || !systemDirectoryTests.includes("blocks operational closure without a selected next action and dependency retirement path")
    || !systemDirectoryTests.includes("registers the durable operator work capabilities")
    || !agentRules.includes("Lensically Autonomous Business Operator")
    || !currentState.includes("single-active-outcome-v1")
    || !operatingMemory.includes("operator_work_ledger")) {
  errors.push("autonomous_business_operator_contract_missing");
}

if (!router.includes('WINNING_PATH_PROMOTION_VERSION = "winning-path-promotion-v1"')
    || !router.includes("WINNING_PATH_PROMOTIONS")
    || !router.includes("resolvePromotedWinningPath")
    || !router.includes("evaluatePreventableIncidentClosure")
    || !router.includes("promoted_winning_path_external_surface_required")
    || !systemDirectoryTests.includes("promotes multi-stage architecture work to implementation before release")
        || !systemDirectoryTests.includes("keeps bounded large repository patch sets on the Main gateway")
    || !systemDirectoryTests.includes("blocks incident closure until the winning path is promoted and enforced")
    || !systemDirectoryTests.includes("keeps Operator MCP version metadata single-source")
    || !systemDirectoryTests.includes("routes compact quarantined-post reschedules to the protected recovery path")
    || !systemDirectoryTests.includes("builds compact scheduled-post audit requests")
    || !systemDirectoryTests.includes("uses compact release-marker messages for verified patches")
    || !clientSafety.includes('public_large_repository_mutation_payload')
        || !clientSafety.includes('repository_patch_set')
    || !clientSafety.includes('public_protected_scheduler_recovery_narrative')
    || !clientSafety.includes('public_scheduled_post_audit_narrative')
    || !clientSafety.includes('public_main_release_marker_verbose_message')) {
  errors.push("winning_path_promotion_contract_missing");
}

if (router.includes("operator_execution_library_sources")
    || router.includes("operator_execution_map_entries")
    || router.includes("operator_execution_map_incidents")
    || router.includes("operator_execution_map_promotions")
    || router.includes("compileExecutionPolicyLibrary")
    || router.includes("promoteDiscovery")) {
  errors.push("retired_dynamic_execution_infrastructure_present");
}

if (!source.includes("const RETIRED_EXECUTION_TABLES")
    || !source.includes('"operator_execution_library_sources"')
    || !source.includes('"operator_execution_map_entries"')
    || !source.includes('"operator_pre_call_routes"')
    || !source.includes('"operator_ops_memory"')
    || !source.includes("retireLegacyExecutionInfrastructure(env)")
    || !source.includes("retired_execution_infrastructure: true")) {
  errors.push("legacy_execution_storage_retirement_missing");
}

const directMainContractChecks = [
    ["public_allowlist", operatorMcpToolDirectory.includes("export const OPERATOR_PUBLIC_DIRECT_TOOL_NAMES")],
  ["public_tool_builder", source.includes("buildOperatorPublicMcpTools")],
    ["direct_contract_metadata", source.includes('public_contract: "direct_typed_tools_v2"')],
  ["direct_discovery", source.includes("const tools = await buildOperatorPublicMcpTools(env)")],
    ["direct_entry_gate", operatorMcpToolCallDispatcher.includes("const directPublicEntry = dependencies.isPublicDirectToolName(requestedToolName)")],
  ["legacy_gateway_hidden", operatorMcpToolCallDispatcher.includes("const legacyGatewayEntry = requestedToolName === dependencies.routedExecutionGateway")],
  ["direct_server_guard", operatorMcpToolCallDispatcher.includes("execution_guard: await dependencies.createExecutionGuard(requestedToolName, requestedArgs)")],
  ["generic_gateway_not_advertised", tests.includes('expect(names).not.toEqual(expect.arrayContaining([\n      "executeLensicallyIntent"')],
  ["closed_public_schemas", tests.includes("tool.inputSchema?.additionalProperties === false")],
  ["server_side_proceed", source.includes("Later direct account calls use server-side continuity and do not send a Proceed flag")],
  ["execution_kernel_name", source.includes('export const EXECUTION_KERNEL_NAME = "Execution Kernel"')],
  ["execution_kernel_version", source.includes('export const EXECUTION_KERNEL_VERSION = "lensically-execution-kernel-v1"')],
  ["session_creation", source.includes("createOperatorMcpSessionId")],
  ["session_verification", source.includes("verifyOperatorMcpSession")],
  ["stale_session_rejection", source.includes("stale_mcp_deployment_session")],
];
for (const [checkId, present] of directMainContractChecks) {
  if (!present) errors.push(`direct_main_contract_missing:${checkId}`);
}

if (!operatorMcpToolCallDispatcher.includes("const sourceDefinedStaticRoute = directPublicEntry || routedMapExecution?.d1_execution_library_bypassed === true;")
    || !operatorMcpToolCallDispatcher.includes("const preCallRouting: PreCallRoutingResult = sourceDefinedStaticRoute")
    || !operatorMcpToolCallDispatcher.includes("if (!sourceDefinedStaticRoute) {\n    await dependencies.recordExecutionDecision")) {
  errors.push("direct_static_route_runtime_bypass_missing");
}

if (!workflow.includes("run-name: Lensically ${{ inputs.task || 'push-validation' }} · ${{ inputs.release_id || github.sha }}")
    && !workflow.includes("run-name: \"Lensically ${{ inputs.task || 'push-validation' }} · ${{ inputs.release_id || github.sha }}\"")
    && !workflow.includes("run-name: \"Lensically ${{ inputs.task }} · ${{ inputs.release_id }}\"")) {
  errors.push("workflow_run_name_missing");
}
if (!workflow.includes("cancel-in-progress: true")) {
  errors.push("workflow_superseded_run_cancellation_missing");
}
if (!workflow.includes("node scripts/release-preflight.mjs --print-crons")) errors.push("workflow_cron_single_source_missing");
if (!workflow.includes("release_id:")) errors.push("workflow_release_id_missing");
if (!workflow.includes("release_sha:")) errors.push("workflow_release_sha_missing");
if (!workflow.includes("test/systemDirectory.spec.ts")
    || !workflow.includes("Run exact-head release gates")) {
  errors.push("system_directory_release_gate_missing");
}
if (!workflow.includes("fast-validation:")
    || !workflow.includes("inputs.task != 'operator-tests'")
    || !workflow.includes("inputs.task != 'worker-deploy'")) {
  errors.push("fast_validation_must_exclude_parallel_tests_and_release");
}

if (!workflow.includes("operator-test-shards:")
    || !workflow.includes("name: Operator shard ${{ matrix.shard }}/8")
    || (!workflow.includes("shard: [1, 2, 3, 4, 5, 6, 7, 8]")
      && !workflow.includes("shard:\n          - 1\n          - 2\n          - 3\n          - 4\n          - 5\n          - 6\n          - 7\n          - 8"))
    || !workflow.includes('node scripts/run-operator-shard.mjs "${{ matrix.shard }}" 8')
    || !operatorShardRunner.includes("titleDefinitionCounts")
    || !operatorShardRunner.includes("shardAssignments")
    || !operatorShardRunner.includes("assignedTitles.length !== weightedTitles.length")
    || !operatorShardRunner.includes("selectedAssignment = shardAssignments[shardNumber - 1]")
    || !operatorShardRunner.includes("--testNamePattern=")) {
  errors.push("parallel_operator_test_shards_missing");
}
if (workflow.includes("Full Operator MCP tests") || workflow.includes("/tmp/lensically-operator-tests.log")) {
  errors.push("serial_operator_test_monolith_forbidden");
}
if (!workflow.includes("worker-release:")
    || !workflow.includes("inputs.task == 'worker-deploy'")
    || !workflow.includes("Deploy exact validated Worker head")
    || !workflow.includes("npx wrangler deploy")) {
  errors.push("explicit_exact_sha_release_path_missing");
}

if (workflow.includes("git push origin HEAD:main") || workflow.includes("RECOVERY_TYPECHECK_LOG.txt")) {
  errors.push("workflow_self_commit_forbidden");
}
if (!workflow.includes('ref: ${{ inputs.release_sha || github.sha }}')) errors.push("workflow_exact_sha_checkout_missing");
if (!workflow.includes('test "$(git rev-parse HEAD)" = "${{ inputs.release_sha }}"')) errors.push("workflow_exact_sha_verification_missing");
if (!workflow.includes('.healthy == true and .operational == true and .heartbeat_fresh == true')
        || !workflow.includes('(.control.mode == "normal")')
        || workflow.includes('(.control.mode == "paused") or')) {
  errors.push("scheduler_release_gate_must_require_operational_normal_mode");
}

if (!source.includes("quarantineScheduledPostPublishAttempt")
    || !source.includes("finalizeScheduledPostPublished")
    || !source.includes("datetime(processing_started_at) <= datetime(?)")
    || !source.includes("WHERE status IN (?, ?)")
    || !source.includes("SCHEDULED_POST_QUARANTINE_ISOLATED")
    || source.includes("SCHEDULED_POST_SCHEDULER_PAUSED_FOR_QUARANTINE")
    || !source.includes('reason: "automatic_delivery_default"')
    || !source.includes("quarantined_post_ids")
    || source.includes("scheduler_must_be_paused_for_recovery")
    || source.includes("publish_interrupted_retry")
    || !tests.includes("never reopens stale posting rows after an external publish attempt")
    || !tests.includes("quarantines uncertain attempts and treats returned Threads ids as authoritative")
    || !tests.includes('expect(autoResumed.control.mode).toBe("normal")')
    || !tests.includes('expect(autoResumed.publishing_enabled).toBe(true)')
    || !tests.includes("expect(autoResumed.quarantined_post_ids).toContain(stalePostId)")) {
  errors.push("scheduled_publish_unknown_state_quarantine_missing");
}
if (!threadsPublishService.includes('publishCreateBody.set("auto_publish_text", "true")')
    || !threadsPublishService.includes("if (autoPublishText) {")
    || !threadsPublishTests.includes("uses native auto-publish for text posts and never calls threads_publish")
    || !threadsPublishService.includes("const readinessResult = await waitForContainerReadiness(")
    || !threadsPublishService.includes("// At-most-once external commit")
    || !threadsPublishService.includes("const commitResult = await publishContainer(accessToken, threadsUserId, publishRequestId)")
    || !threadsPublishTests.includes("waits for FINISHED before making exactly one publish commit")
    || !threadsPublishTests.includes("does not call the publish endpoint when readiness never completes")
        || !workflow.includes("threads-publish-tests")
    || !workflow.includes("test/threadsPublishService.spec.ts")) {
  errors.push("threads_text_auto_publish_contract_missing");
}
// Production release is an explicit exact-SHA workflow dispatch after validation.
if (!workflow.includes("release_sha:")
    || !workflow.includes('ref: ${{ inputs.release_sha }}')
    || !workflow.includes('test "$(git rev-parse HEAD)" = "${{ inputs.release_sha }}"')
    || !workflow.includes("Run exact-head release gates")
        || !workflow.includes("Deploy exact validated Worker head")
        || (!workflow.includes("Verify production runtime and scheduler")
      && !workflow.includes("Verify production runtime, scheduler, and intelligence product")
      && !workflow.includes("Verify production runtime, scheduler, retained website, and retired legacy surfaces"))) {
  errors.push("explicit_exact_sha_release_contract_missing");
}


if (!operatorMcpAccountAnalyticsRegistry.includes('name: "get_monthly_growth_review"')
    || !source.includes("OPERATOR_MCP_MAX_STRUCTURED_BYTES = 24_000")
    || !operatorMcpToolCallDispatcher.includes("dependencies.enforcePayloadBudget(resultPayload)")
    || !router.includes('return "get_monthly_growth_review"')
    || !tests.includes("routes the exact monthly growth question to one bounded analytics response")) {
  errors.push("bounded_monthly_growth_contract_missing");
}

const manifestAutonomousGrowthChecks = [
  ["growth_mission_version", source.includes('const OPERATOR_GROWTH_MISSION_VERSION = "autonomous-growth-mission-v2"')],
  ["growth_engine_version", source.includes('const MANIFEST_AUTONOMOUS_GROWTH_ENGINE_VERSION = "manifest-autonomous-growth-engine-v1"')],
  ["autonomy_contract_version", source.includes('const OPERATOR_AUTONOMY_CONTRACT_VERSION = "operator-autonomy-governance-v4"')],
    ["growth_mission_tables", operatorContinuityMigration.includes("CREATE TABLE IF NOT EXISTS operator_growth_missions")
    && operatorContinuityMigration.includes("CREATE TABLE IF NOT EXISTS operator_growth_mission_revisions")
    && source.includes('table: "operator_growth_missions"')
    && source.includes('table: "operator_growth_mission_revisions"')],
    ["autonomous_cycle_tables", cycleDecisionMigration.includes("CREATE TABLE IF NOT EXISTS operator_autonomous_growth_cycles")
    && cycleDecisionMigration.includes("CREATE TABLE IF NOT EXISTS operator_autonomous_lineup_items")
    && source.includes('table: "operator_autonomous_growth_cycles"')
    && source.includes('table: "operator_autonomous_lineup_items"')],
  ["protected_decision_tables", cycleDecisionMigration.includes("CREATE TABLE IF NOT EXISTS operator_decision_proposals")
    && cycleDecisionMigration.includes("CREATE TABLE IF NOT EXISTS operator_decision_execution_events")
    && source.includes('table: "operator_decision_proposals"')
    && source.includes('table: "operator_decision_execution_events"')],
    ["prepare_tool", operatorMcpAutonomousExecutionRegistry.includes('name: "prepare_manifest_autonomous_cycle"')],
    ["analysis_page_tool", operatorMcpManifestCycleRegistry.includes('name: "get_manifest_cycle_analysis_page"')],
  ["cycle_strategy_tool", operatorMcpManifestCycleRegistry.includes('name: "commit_manifest_cycle_strategy"')],
    ["persist_tool", operatorMcpAutonomousExecutionRegistry.includes('name: "persist_manifest_autonomous_post"')],
  ["retired_monolithic_commit", source.includes('error: "retired_monolithic_autonomous_commit"')
    && !source.includes("async function commitManifestAutonomousRunway(")
    && !source.includes("invalid_or_duplicate_autonomous_post")
    && !source.includes("autonomous_generation_gates_failed")
    && !source.includes("autonomous_scheduling_gates_failed")],
    ["source_backed_only", source.includes('source_backed_generation_only: true')
    && source.includes('canonical_source_card_required')
    && manifestIntelligence.includes('manifest_cycle_lineup_source_backed_only')
    && manifestIntelligence.includes('manifest_cycle_lineup_source_card_required')],
  ["original_generation_modes_removed", !source.includes('"operator_hypothesis"')
    && !source.includes('"original_discovery"')
    && !source.includes('"market_response"')],
    ["strategy_and_plan_required", operatorManifestPersistenceAdmissionService.includes('manifest_cycle_strategy_required_before_persist')
    && operatorManifestPersistenceAdmissionService.includes('manifest_cycle_plan_item_required')
    && operatorManifestPersistenceAdmissionService.includes('manifest_cycle_strategy_mismatch')
    && operatorManifestPersistenceAdmissionService.includes('manifest_cycle_plan_item_mismatch')],
    ["hard_ban_enforcement", operatorManifestPersistenceService.includes('canonical_hard_ban_evaluation_incomplete')],
  ["nonempty_gate_execution", operatorManifestPersistenceService.includes('required_candidate_gate_execution_empty') && operatorManifestPersistenceService.includes('candidate_gate_receipt_failed')],
    ["placement_and_exposure_assessment", operatorMcpAutonomousExecutionRegistry.includes('slot_placement_assessment: { type: "string"') && operatorMcpAutonomousExecutionRegistry.includes('recent_exposure_assessment: { type: "string"')],
  ["live_reconciliation", source.includes('refreshManifestAutonomousThreadsSnapshot') && source.includes('buildManifestAutonomousCoverageLedger')],
  ["intelligence_v3", manifestIntelligence.includes('MANIFEST_INTELLIGENCE_FOUNDATION_VERSION = "manifest-intelligence-foundation-v3"')],
  ["rolling_windows", manifestIntelligence.includes('MANIFEST_ANALYSIS_WINDOW_DAYS = 28') && manifestIntelligence.includes('MANIFEST_RECENT_EXPOSURE_HOURS = 72')],
    ["paged_evidence", manifestIntelligence.includes('MANIFEST_EVIDENCE_PAGE_SIZE = 12')
    && manifestIntelligence.includes('MANIFEST_EVIDENCE_PAGE_MAX_BYTES = 12000')
    && manifestIntelligence.includes('MANIFEST_EVIDENCE_RESPONSE_MAX_BYTES = 20000')
    && manifestIntelligence.includes('MANIFEST_EVIDENCE_PAGE_CONTRACT_VERSION = "manifest-evidence-page-v1"')
        && manifestIntelligenceMigration.includes("CREATE TABLE IF NOT EXISTS operator_manifest_evidence_snapshots")
    && manifestIntelligenceMigration.includes("CREATE TABLE IF NOT EXISTS operator_manifest_evidence_posts")
    && manifestIntelligenceMigration.includes("CREATE TABLE IF NOT EXISTS operator_manifest_evidence_pages")
    && manifestIntelligence.includes('table: "operator_manifest_evidence_snapshots"')
    && manifestIntelligence.includes('table: "operator_manifest_evidence_posts"')
    && manifestIntelligence.includes('table: "operator_manifest_evidence_pages"')
    && manifestIntelligence.includes('response_bytes_estimated: true')
    && manifestIntelligence.includes('Math.min(MANIFEST_EVIDENCE_RESPONSE_MAX_BYTES, storedPageBytes + 2048)')],
  ["likes_first", manifestIntelligence.includes('primary_metric: "24_hour_likes"')],
  ["single_cycle_strategy_writer", !source.includes("ensureManifestStrategyVersion")
    && !manifestMeasurementAudit.includes("ensureManifestStrategyVersion")],
    ["one_cycle_strategy", manifestIntelligenceMigration.includes("CREATE TABLE IF NOT EXISTS operator_manifest_cycle_strategies")
    && manifestIntelligenceMigration.includes("CREATE TABLE IF NOT EXISTS operator_manifest_cycle_plan_items")
    && manifestIntelligence.includes('table: "operator_manifest_cycle_strategies"')
    && manifestIntelligence.includes('table: "operator_manifest_cycle_plan_items"')],
  ["gate_receipts_and_bans", manifestIntelligenceMigration.includes("CREATE TABLE IF NOT EXISTS operator_manifest_candidate_gate_receipts")
    && manifestIntelligenceMigration.includes("CREATE TABLE IF NOT EXISTS operator_manifest_hard_bans")
    && manifestIntelligence.includes('table: "operator_manifest_candidate_gate_receipts"')
    && manifestIntelligence.includes('table: "operator_manifest_hard_bans"')],
  ["workflow_regression", workflow.includes('manifest-autonomous-cycle.test.ts')],
  ["clock_regressions", manifestAutonomousTests.includes("uses Threads server time when the runtime clock is behind") && manifestAutonomousTests.includes("uses the newest verified publication as a hard lower bound") && manifestAutonomousTests.includes("starts the rolling horizon at the next future hour")],
    ["source_only_regression", manifestAutonomousTests.includes("rejects model-originated sources and accepts canonical source-card lineage")],
  ["likes_first_regression", manifestAutonomousTests.includes("builds mature likes-first benchmarks and excludes immature evidence")],
  ["byte_bounded_evidence_regression", manifestAutonomousTests.includes("packs every strategy evidence item into complete byte-bounded canonical pages")],
  ["prepare_regression", systemDirectoryTests.includes("prepares the complete rolling 28-day likes-first evidence snapshot and authoritative runway without requiring owner review")],
  ["analysis_page_regression", systemDirectoryTests.includes("reads and durably records one complete rolling evidence page without truncation")],
  ["strategy_regression", systemDirectoryTests.includes("locks exactly one likes-first account strategy and a complete source-backed missing-slot lineup")],
  ["persist_regression", systemDirectoryTests.includes("persists one source-card-backed post against the locked cycle strategy, exact plan item, and nonempty passing gate receipt")],
  ["scheduled_review_regression", tests.includes("reviews a scheduled autonomous post without making the owner an operational dependency")],
  ["winner_decay_regression", tests.includes("preserves a frequent winner until comparable mature performance actually decays")],
];
for (const [name, passed] of manifestAutonomousGrowthChecks) {
  if (!passed) errors.push(`manifest_autonomous_growth_contract_missing:${name}`);
}

if (!tests.includes("routes operational status and engineering intents deterministically away from content procedures")) {
  errors.push("static_router_engineering_regression_missing");
}
if (tests.includes(".only(") || /operatorMode\.spec\.ts[^\n]*\s-t\s/.test(workflow)) {
  errors.push("focused_operator_test_filter_forbidden");
}

if (source.includes("follower_day_net_change")) errors.push("post_level_follower_attribution_forbidden");
if (!source.includes("export const OPERATOR_PERFORMANCE_MATURITY_CHECKPOINTS = [6, 12, 18, 24] as const;")) {
  errors.push("performance_checkpoint_contract_mismatch");
}
if (!source.includes('post_level_attribution: "forbidden"') || !source.includes('day_or_period_post_attribution: "forbidden"')) {
  errors.push("performance_evaluator_follower_policy_missing");
}

if (errors.length > 0) {
  for (const error of errors) console.error(`[release-preflight] ${error}`);
  process.exit(1);
}

console.log(`[release-preflight] ok version=${version} crons=${crons.length} static_router=true canonical_version_assertions=${canonicalVersionAssertionEntries.length} database_tables=${databaseAuthorityReceipt.active_table_count} database_ddl_sources=${databaseAuthorityReceipt.runtime_ddl_source_count}`);
