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
    || !workflowLint.includes("YAML.parse_file")
    || !workflowLint.includes("required = %w[push-validation fast-validation operator-test-shards worker-release]")
    || !workflowLint.includes('job.key?("runs-on")')
    || !workflowLint.includes('job["steps"].is_a?(Array)')
    || !workflowLint.includes("workflow_dispatch:")) {
  errors.push("independent_workflow_yaml_watchdog_incomplete");
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
    || !source.includes("const OPERATOR_MCP_ROUTING_POLICY = createOperatorMcpRoutingPolicy")) {
  lifecycleErrors.push("operator_mcp_routing_policy_import_or_binding_missing");
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
if (!source.includes("OPERATOR_MCP_ROUTING_POLICY.scopeCall(toolName, payload)")
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
    || !operatorMcpRoutingPolicy.includes("export function createOperatorMcpRoutingPolicy")) {
  lifecycleErrors.push("operator_mcp_routing_policy_module_incomplete");
}
if (!operatorMcpRoutingPolicyTests.includes("preserves scoped wrapper canonicalization and account injection")
    || !operatorMcpRoutingPolicyTests.includes("preserves scoped precedence and direct brand alias normalization")
    || !operatorMcpRoutingPolicyTests.includes("preserves guided Proceed requirements and autonomous exemptions")
    || !operatorMcpRoutingPolicyTests.includes("preserves nested alias canonicalization and strips execution metadata")
    || !operatorMcpRoutingPolicyTests.includes("preserves autonomy canonical names and handler classification")
    || !operatorMcpRoutingPolicyTests.includes("binds injected normalizers into one deterministic routing policy")) {
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
    || !source.includes("if (isOperatorManifestCycleServiceToolName(toolName))")
    || !source.includes("handleOperatorManifestCycleServiceTool({")) {
  lifecycleErrors.push("operator_manifest_cycle_service_import_or_binding_missing");
}
if (source.includes('error: "complete_cycle_strategy_required"')
    || source.includes('"manifest_cycle_receipt_not_found"')
    || source.includes('eventType: "cycle_strategy_locked"')
    || source.includes('completion_trigger: "last_blocking_defect_resolved"')) {
  lifecycleErrors.push("operator_manifest_cycle_service_returned_to_index");
}
if (!operatorManifestCycleService.includes("export const OPERATOR_MANIFEST_CYCLE_SERVICE_TOOL_NAMES")
    || !operatorManifestCycleService.includes("export function isOperatorManifestCycleServiceToolName")
    || !operatorManifestCycleService.includes("export async function handleOperatorManifestCycleServiceTool")
    || !operatorManifestCycleService.includes('toolName === "get_manifest_cycle_analysis_page"')
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
    || !operatorManifestCycleServiceTests.includes("preserves complete strategy locking and source-selection metadata")
    || !operatorManifestCycleServiceTests.includes("preserves seven-stage defect validation and receipt requirements")
    || !operatorManifestCycleServiceTests.includes("preserves final defect resolution and cycle completion reconciliation")) {
  lifecycleErrors.push("operator_manifest_cycle_service_tests_incomplete");
}
if (!source.includes('from "./operatorHourlyCoverageService"')
    || !source.includes('if (toolName === "get_hourly_coverage")')
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
    || !source.includes("readOperatorAccountState({")
    || !source.includes("getActiveSession: (brandKey)")
    || !source.includes("countScheduledPosts: async")) {
  lifecycleErrors.push("operator_account_state_service_import_or_binding_missing");
}
if (source.includes("active_workflow_session: activeSession")
    || source.includes("latest_approved_drafts: approved")
    || source.includes("active_gates_count: gates.length")) {
  lifecycleErrors.push("operator_account_state_service_returned_to_index");
}
if (!operatorAccountStateService.includes("export async function readOperatorAccountState")
    || !operatorAccountStateService.includes("dependencies.getActiveSession")
    || !operatorAccountStateService.includes("dependencies.getSourceCard")
    || !operatorAccountStateService.includes("dependencies.listDraftsByStatus")
    || !operatorAccountStateService.includes("dependencies.countScheduledPosts")
    || !operatorAccountStateService.includes("dependencies.listActiveGates")
    || !operatorAccountStateService.includes("active_workflow_session: activeSession")
    || !operatorAccountStateService.includes("warnings: []")) {
  lifecycleErrors.push("operator_account_state_service_module_incomplete");
}
if (!operatorAccountStateServiceTests.includes("reads the selected account state and resolves its active source card")
    || !operatorAccountStateServiceTests.includes("does not read a source card when the active session has no source identity")
    || !operatorAccountStateServiceTests.includes("normalizes an unavailable scheduled count without changing the response contract")) {
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
    || !operatorManifestReviewBatchStateServiceTests.includes("returns the exact not-found response when an identified batch cannot serialize")) {
    lifecycleErrors.push("operator_manifest_review_batch_state_service_tests_incomplete");
}
if (!source.includes('from "./operatorManifestReviewDraftAttachmentService"')
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
    || !source.includes("listRows: async ({ minimumLikes, days, limit })")) {
  lifecycleErrors.push("operator_published_post_lineage_audit_service_import_or_binding_missing");
}
if (source.includes("const minimumLikes = Math.max(1, Math.trunc(Number(payload.minimum_likes ?? 1000)))")
    || source.includes("const posts = (rows.results ?? []).map((row) =>")
    || source.includes("if (!row.source_selection_id || !row.source_batch_id) missingStages.push(\"source\")")) {
  lifecycleErrors.push("operator_published_post_lineage_audit_service_returned_to_index");
}
if (!operatorPublishedPostLineageAuditService.includes("export async function auditOperatorPublishedPostLineage")
    || !operatorPublishedPostLineageAuditService.includes("dependencies.listRows")
    || !operatorPublishedPostLineageAuditService.includes('missingStages.push("source")')
    || !operatorPublishedPostLineageAuditService.includes('missingStages.push("metrics")')
    || !operatorPublishedPostLineageAuditService.includes("saved_pattern_id")
    || !operatorPublishedPostLineageAuditService.includes("complete_count")
    || !operatorPublishedPostLineageAuditService.includes("incomplete_count")) {
  lifecycleErrors.push("operator_published_post_lineage_audit_service_module_incomplete");
}
if (!operatorPublishedPostLineageAuditServiceTests.includes("applies exact defaults and bounded criteria before row retrieval")
    || !operatorPublishedPostLineageAuditServiceTests.includes("serializes complete lineage with stable metrics and numeric identifiers")
    || !operatorPublishedPostLineageAuditServiceTests.includes("classifies every missing lineage stage in deterministic order")
    || !operatorPublishedPostLineageAuditServiceTests.includes("counts mixed results and omits saved-pattern identity for other source types")) {
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
  ["retired_monolithic_commit", source.includes('error: "retired_monolithic_autonomous_commit"')],
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
