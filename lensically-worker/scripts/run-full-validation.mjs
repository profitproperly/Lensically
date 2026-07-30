import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const workerRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vitestCli = resolve(workerRoot, "node_modules", "vitest", "vitest.mjs");

const completeTestFiles = [
  "test/databaseMigrations.spec.ts",
  "test/operatorMcpProtocol.spec.ts",
  "test/operatorMcpToolDefinitions.spec.ts",
  "test/operatorMcpToolDirectory.spec.ts",
  "test/operatorMcpEngineeringRegistry.spec.ts",
  "test/operatorMcpAdminRegistry.spec.ts",
  "test/operatorMcpAccountFoundationRegistry.spec.ts",
  "test/operatorMcpSourceDraftRegistry.spec.ts",
  "test/operatorMcpStrategyScheduleRegistry.spec.ts",
  "test/operatorMcpManifestCycleRegistry.spec.ts",
  "test/operatorMcpAutonomousExecutionRegistry.spec.ts",
  "test/operatorMcpAccountAnalyticsRegistry.spec.ts",
  "test/operatorMcpRegistryComposition.spec.ts",
  "test/operatorMcpRoutingPolicy.spec.ts",
  "test/operatorMcpTransport.spec.ts",
  "test/operatorMcpDispatcher.spec.ts",
  "test/operatorMcpToolCallDispatcher.spec.ts",
    "test/operatorManifestCycleService.spec.ts",
  "test/operatorManifestShadowService.spec.ts",
  "test/operatorHourlyCoverageService.spec.ts",
  "test/operatorManifestPrepareCheckpointService.spec.ts",
  "test/operatorManifestCycleConstructionService.spec.ts",
  "test/operatorManifestPersistenceAdmissionService.spec.ts",
  "test/operatorManifestPersistenceService.spec.ts",
  "test/operatorManifestScheduledReviewService.spec.ts",
  "test/operatorManifestCycleObservationService.spec.ts",
  "test/operatorAccountStateService.spec.ts",
  "test/operatorLensicallyUiSurfaceService.spec.ts",
  "test/operatorManifestReviewBatchRetirementService.spec.ts",
  "test/operatorManifestReviewBatchStateService.spec.ts",
  "test/operatorManifestReviewDraftAttachmentService.spec.ts",
  "test/operatorManifestReviewSourceResolutionService.spec.ts",
  "test/operatorManifestReviewBatchSchedulingService.spec.ts",
  "test/operatorWorkflowSessionStartService.spec.ts",
  "test/operatorContextAdmissionService.spec.ts",
  "test/operatorProductionBoardService.spec.ts",
  "test/operatorSourceCandidateListService.spec.ts",
  "test/operatorSavedPatternSourceExclusionService.spec.ts",
  "test/operatorManifestSourceDrawService.spec.ts",
  "test/operatorPublishedPostLineageAuditService.spec.ts",
  "test/operatorManifestSourceCardBackfillService.spec.ts",
  "test/operatorManifestSourceCardBackfillPreparationService.spec.ts",
  "test/operatorSourceCandidateBatchReadService.spec.ts",
  "test/operatorSourceCardAdmissionService.spec.ts",
  "test/operatorSourceCardFamilyResolutionService.spec.ts",
  "test/operatorSourceCardPersistencePlanningService.spec.ts",
  "test/operatorSourceCardLockService.spec.ts",
  "test/operatorSourceCardReadService.spec.ts",
  "test/operatorGenerationRunAdmissionService.spec.ts",
  "test/operatorGenerationRunPersistencePlanningService.spec.ts",
  "test/operatorGenerationDraftAdmissionService.spec.ts",
  "test/operatorGenerationDraftPersistencePlanningService.spec.ts",
  "test/operatorDraftShownTransitionService.spec.ts",
  "test/operatorDraftDecisionService.spec.ts",
  "test/operatorActiveGateReadService.spec.ts",
  "test/operatorGateMutationPlanningService.spec.ts",
  "test/operatorStrategyMemoryListReadService.spec.ts",
  "test/operatorStrategyMemorySaveService.spec.ts",
  "test/operatorScheduledPostListReadService.spec.ts",
  "test/operatorScheduledPostDeletionService.spec.ts",
  "test/operatorScheduledPostRetryService.spec.ts",
  "test/operatorScheduledPostEditMutationService.spec.ts",
  "test/wranglerDeployRetry.spec.ts",
  "manifest-autonomous-cycle.test.ts",
  "test/systemDirectory.spec.ts",
  "test/threadsPublishService.spec.ts",
  "test/humanFreeAutonomy.spec.ts",
];

const completeTestGroups = Array.from(
  { length: Math.ceil(completeTestFiles.length / 11) },
  (_, index) => completeTestFiles.slice(index * 11, (index + 1) * 11),
);

const operatorMilestoneTitles = [
  "advertises the curated direct typed Main surface and concise instructions",
  "makes the static router the only public action path",
  "routes operational status and engineering intents deterministically away from content procedures",
  "routes bounded known-file repository search through the main Execution Kernel without Recovery",
  "validates complete Execution Kernel routes without mutations",
  "rejects an MCP session created by a previous Worker deployment before routing",
  "lists only the active static MCP registry and concise instructions",
  "arms, executes, and re-arms the independent scheduled-post alarm with shared cron health",
  "recovers a known Saved Pattern into complete published-post lineage",
  "reconciles prepare_manifest_autonomous_cycle again with the same durable operation id",
];

const requiredFiles = [
  "test/databaseMigrations.spec.ts",
    "test/operatorMcpRoutingPolicy.spec.ts",
  "test/operatorManifestShadowService.spec.ts",
  "test/operatorManifestPersistenceService.spec.ts",
  "test/operatorScheduledPostEditMutationService.spec.ts",
  "manifest-autonomous-cycle.test.ts",
  "test/systemDirectory.spec.ts",
  "test/threadsPublishService.spec.ts",
  "test/humanFreeAutonomy.spec.ts",
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function validatePlan() {
  const duplicates = completeTestFiles.filter((file, index) => completeTestFiles.indexOf(file) !== index);
  if (duplicates.length > 0) fail(`full_validation_duplicate_files:${[...new Set(duplicates)].join(",")}`);

  const missingFiles = completeTestFiles.filter((file) => !existsSync(resolve(workerRoot, file)));
  if (missingFiles.length > 0) fail(`full_validation_missing_files:${missingFiles.join(",")}`);

    const missingRequired = requiredFiles.filter((file) => !completeTestFiles.includes(file));
  if (missingRequired.length > 0) fail(`full_validation_required_files_missing:${missingRequired.join(",")}`);

  const groupedFiles = completeTestGroups.flat();
    if (completeTestGroups.length !== Math.ceil(completeTestFiles.length / 11)
      || completeTestGroups.some((group, index) => group.length < 1 || group.length > 11 || (index < completeTestGroups.length - 1 && group.length !== 11))
      || groupedFiles.length !== completeTestFiles.length
      || groupedFiles.some((file, index) => file !== completeTestFiles[index])) {
    fail("full_validation_batch_partition_invalid");
  }

  if (operatorMilestoneTitles.length < 10 || new Set(operatorMilestoneTitles).size !== operatorMilestoneTitles.length) {
    fail("full_validation_operator_milestone_plan_invalid");
  }

  return {
    contract: "lensically-full-validation-v1",
    complete_test_file_count: completeTestFiles.length,
    operator_milestone_test_count: operatorMilestoneTitles.length,
        process_count: completeTestGroups.length + 2,
    complete_test_batch_count: completeTestGroups.length,
        complete_test_batch_size: 11,
  };
}

function run(label, command, args) {
  const startedAt = performance.now();
  console.log(`[full-validation] start ${label}`);
  const result = spawnSync(command, args, {
    cwd: workerRoot,
    stdio: "inherit",
    env: process.env,
  });
  const durationMs = Math.round(performance.now() - startedAt);
  if (result.error) fail(`[full-validation] ${label} spawn failed: ${result.error.message}`);
  if (result.status !== 0) {
    console.error(JSON.stringify({ label, duration_ms: durationMs, status: result.status }, null, 2));
    process.exit(result.status ?? 1);
  }
  console.log(JSON.stringify({ label, duration_ms: durationMs, status: "passed" }));
  return durationMs;
}

const plan = validatePlan();
if (process.argv.includes("--check")) {
  console.log(JSON.stringify({ ...plan, status: "valid" }));
  process.exit(0);
}
if (process.argv.includes("--print-plan")) {
  console.log(JSON.stringify({
    ...plan,
        complete_test_files: completeTestFiles,
    complete_test_groups: completeTestGroups,
    operator_milestone_titles: operatorMilestoneTitles,
  }, null, 2));
  process.exit(0);
}
if (!existsSync(vitestCli)) fail(`full_validation_vitest_cli_missing:${vitestCli}`);

const totalStartedAt = performance.now();
const durations = [];
durations.push(run("operator-smoke", process.execPath, ["scripts/run-operator-validation.mjs", "smoke"]));
for (const [index, testFiles] of completeTestGroups.entries()) {
  durations.push(run(`complete-test-inventory-${index + 1}/${completeTestGroups.length}`, process.execPath, [
    vitestCli,
    "--run",
        ...testFiles,
    "--no-file-parallelism",
    "--reporter=dot",
    "--bail=1",
  ]));
}
const escapedPattern = operatorMilestoneTitles
  .map((title) => title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
durations.push(run("operator-milestone-acceptance", process.execPath, [
  vitestCli,
  "--run",
  "test/operatorMode.spec.ts",
  `--testNamePattern=${escapedPattern}`,
  "--reporter=dot",
  "--bail=1",
]));

console.log(JSON.stringify({
  ...plan,
  status: "passed",
  total_duration_ms: Math.round(performance.now() - totalStartedAt),
  process_durations_ms: durations,
}));
