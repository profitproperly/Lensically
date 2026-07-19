import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Validates the verified release marker, capability lifecycle, Guided Growth Mission, and client-safety registry before deployment.
const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const wrangler = read("wrangler.jsonc");
const source = read("src/index.ts");
const router = read("src/mandatoryExecutionMap.ts");
const clientSafety = read("src/systemDirectory/clientSafeRequests.ts");
const systemDirectorySource = read("src/systemDirectory/index.ts");
const systemDirectoryTests = read("test/systemDirectory.spec.ts");
const gptMemoryTests = read("test/gptMemoryRoutes.spec.ts");
const capabilityLifecycle = JSON.parse(read("src/systemDirectory/capabilityLifecycle.json"));
const tests = read("test/operatorMode.spec.ts");
const operatorShardRunner = read("scripts/run-operator-shard.mjs");
const workflow = read("../.github/workflows/lensically-engineering.yml");
const validationWorkflow = read("../.github/workflows/lensically-validation.yml");
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
const lifecycleErrors = [];
const lifecycleRequiredFields = capabilityLifecycle?.declaration_schema?.required_fields ?? [];
const lifecycleDeclarations = Array.isArray(capabilityLifecycle?.declarations) ? capabilityLifecycle.declarations : [];
const lifecycleBaselineTools = new Set(capabilityLifecycle?.baseline?.active_tool_names ?? []);
const lifecycleBaselineDirectoryIds = new Set(capabilityLifecycle?.baseline?.directory_entry_ids ?? []);
const lifecycleReleaseScopes = new Set(capabilityLifecycle?.allowed_release_scopes ?? []);
const lifecycleImplementationModes = new Set(capabilityLifecycle?.declaration_schema?.implementation_modes ?? []);
const combinedRegressionTests = `${systemDirectoryTests}\n${tests}\n${gptMemoryTests}`;
const toolDefinitionNames = Array.from(new Set(Array.from(source.matchAll(/\{\s*name:\s*"([^"]+)"[\s\S]{0,1600}?\btitle:\s*"[^"]+"[\s\S]{0,1600}?\binputSchema:\s*\{/g), (match) => match[1])));
const directorySection = systemDirectorySource.slice(
  systemDirectorySource.indexOf("export const LENSICALLY_SYSTEM_DIRECTORY_ENTRIES"),
  systemDirectorySource.indexOf("export const LENSICALLY_SYSTEM_DIRECTORY_INDEX"),
);
const directoryEntryIds = Array.from(new Set(Array.from(directorySection.matchAll(/\bid:\s*"([^"]+)"/g), (match) => match[1])));
const declaredCapabilityIds = new Set();
const declaredDirectoryIds = new Set();
const declaredNewHandlers = new Set();
const version = source.match(/(?:export\s+)?const OPERATOR_MCP_VERSION = "([^"]+)";/)?.[1] ?? null;
const versionAssertionEntries = tests
  .split(/\r?\n/)
  .map((line, index) => ({ line, line_number: index + 1 }))
  .filter((entry) => entry.line.includes("expect(") && /mcp_version|serverInfo\.version/.test(entry.line));
const literalVersionAssertionEntries = versionAssertionEntries.filter((entry) => /["'][0-9]+\.[0-9]+\.[0-9]+["']/.test(entry.line));
const canonicalVersionAssertionEntries = versionAssertionEntries.filter((entry) => entry.line.includes("OPERATOR_MCP_VERSION"));

if (!version) lifecycleErrors.push("operator_mcp_version_missing");
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
if (!validationWorkflow.includes("node scripts/release-preflight.mjs --capability-lifecycle-only")) lifecycleErrors.push("capability_lifecycle_fast_validation_gate_missing");
if (!validationWorkflow.includes("[typecheck]")
    || !validationWorkflow.includes("[acceptance-regressions]")
    || !validationWorkflow.includes('scope="acceptance"')) {
  lifecycleErrors.push("main_validation_push_markers_missing");
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

if (!currentState.includes("Operator MCP uses the canonical `OPERATOR_MCP_VERSION` value declared in `lensically-worker/src/index.ts`")) {
  errors.push("current_state_canonical_version_reference_missing");
}
if (/Operator MCP v\d+\.\d+\.\d+/.test(currentState)) {
  errors.push("current_state_manual_version_literal_forbidden");
}

// Fresh-chat acceptance requires startup documentation to match the advertised profile-only action schema.
for (const [documentName, documentText] of [["AGENTS.md", agentRules], ["CURRENT_STATE.md", currentState], ["OPERATING_MEMORY.md", operatingMemory]]) {
  if (!documentText.includes("`profile_id`")
      || !documentText.includes("bounded `inputs`")
      || documentText.includes("concise `objective`, `intent`")) {
    errors.push(`startup_public_contract_drift:${documentName}`);
  }
}

if (!source.includes('const OPERATOR_REGISTRY_GENERATION = "static-execution-router-v1";')
    || !router.includes('MANDATORY_EXECUTION_MAP_VERSION = "static-execution-router-v1"')
    || !router.includes("source_defined_static_route")
    || !router.includes("d1_execution_library_bypassed: true")
    || !router.includes("discovery_allowed: false")
    || !router.includes("model_tool_choice_allowed: false")) {
  errors.push("static_execution_router_contract_missing");
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
    || !clientSafety.includes('recovery_release_marker_verbose_message')) {
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

const singleGatewayContractChecks = [
  ["public_tool", source.includes('name: "executeLensicallyIntent"')],
  ["profile_inputs_required", source.includes('required: ["profile_id", "inputs"]')],
  ["retired_freehand_required_absent", !source.includes('required: ["objective", "intent", "inputs"]')],
  ["server_compilation_description", source.includes("Lensically compiles the canonical objective and intent server-side")],
  ["profile_contract_metadata", source.includes('public_contract: "profile_id_inputs_v1"')],
  ["legacy_compatibility_metadata", source.includes("legacy_freehand_compatibility: true")],
  ["execution_kernel_name", source.includes('export const EXECUTION_KERNEL_NAME = "Execution Kernel"')],
  ["execution_kernel_version", source.includes('export const EXECUTION_KERNEL_VERSION = "lensically-execution-kernel-v1"')],
  ["session_creation", source.includes("createOperatorMcpSessionId")],
  ["session_verification", source.includes("verifyOperatorMcpSession")],
  ["stale_session_rejection", source.includes("stale_mcp_deployment_session")],
  ["profile_compiler", source.includes("compileOperatorPublicProfileRequest")],
  ["canonical_profile_gate", source.includes("canonical_safe_profile_required")],
  ["routed_gateway_gate", source.includes("routed_execution_gateway_required")],
  ["map_prepare", source.includes("prepareMandatoryExecutionMapCall")],
  ["map_finalize", source.includes("finalizeMandatoryExecutionMapCall")],
  ["execution_kernel_receipt", source.includes("resultPayload.execution_kernel")],
];
for (const [checkId, present] of singleGatewayContractChecks) {
  if (!present) errors.push(`single_gateway_contract_missing:${checkId}`);
}

if (!source.includes("const sourceDefinedStaticRoute = routedMapExecution?.d1_execution_library_bypassed === true;")
    || !source.includes("const preCallRouting = sourceDefinedStaticRoute")
    || !source.includes("if (!sourceDefinedStaticRoute) {\n        await recordOperatorExecutionDecision")) {
  errors.push("static_route_runtime_bypass_missing");
}

if (!workflow.includes("run-name: Lensically ${{ github.event.inputs.task || 'marker-push' }} · ${{ github.event.inputs.release_id || github.sha }}")) errors.push("workflow_run_name_missing");
if (!workflow.includes("cancel-in-progress: true")) errors.push("workflow_concurrency_cancellation_missing");
if (!workflow.includes("node scripts/release-preflight.mjs --print-crons")) errors.push("workflow_cron_single_source_missing");
if (!workflow.includes("release_id:")) errors.push("workflow_release_id_missing");
if (!workflow.includes("release_sha:")) errors.push("workflow_release_sha_missing");
if (!workflow.includes("- name: System Directory tests")
    || !workflow.includes("inputs.task == 'system-directory-tests' || inputs.task == 'worker-deploy'")) {
  errors.push("system_directory_release_gate_missing");
}
if (!workflow.includes("worker:\n    if: ${{ github.event_name == 'workflow_dispatch' && inputs.task != 'operator-tests' }}")) {
  errors.push("worker_job_must_exclude_parallel_operator_tests");
}
if (!workflow.includes("operator-test-shards:")
    || !workflow.includes("name: Operator shard ${{ matrix.shard }}/8")
    || !workflow.includes("shard: [1, 2, 3, 4, 5, 6, 7, 8]")
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
if (!validationWorkflow.includes("[verified-worker-release]")
    || !validationWorkflow.includes("Run verified release supporting gates")
    || !validationWorkflow.includes("Deploy verified Worker head")
    || !validationWorkflow.includes("npx wrangler deploy")) {
  errors.push("verified_release_marker_dispatch_missing");
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
    || !workflow.includes("Threads publish readiness tests")
    || !workflow.includes("test/threadsPublishService.spec.ts")) {
  errors.push("threads_text_auto_publish_contract_missing");
}
// Main release-marker commits are exact-SHA triggers; the validation workflow rechecks the marker head.
if (!source.includes("Worker deployment is triggered by a verified source-control release marker through the Main engineering path")
    || !clientSafety.includes('Main repository patch path')
    || !systemDirectoryTests.includes("routes deployment through the Main verified source marker")
    || !workflow.includes("[verified-worker-release]")
    || !workflow.includes("gh workflow run lensically-engineering.yml")
    || !workflow.includes("--field release_id=\"${RELEASE_SHA:0:12}\"")
    || !workflow.includes("--field release_sha=\"${RELEASE_SHA}\"")) {
  errors.push("verified_release_marker_contract_missing");
}

if (!source.includes('name: "get_monthly_growth_review"')
    || !source.includes("OPERATOR_MCP_MAX_STRUCTURED_BYTES = 24_000")
    || !source.includes("enforceOperatorPayloadBudget(resultPayload)")
    || !router.includes('return "get_monthly_growth_review"')
    || !tests.includes("routes the exact monthly growth question to one bounded analytics response")) {
  errors.push("bounded_monthly_growth_contract_missing");
}

if (!source.includes('const OPERATOR_GROWTH_MISSION_VERSION = "guided-growth-mission-v1"')
    || !source.includes("CREATE TABLE IF NOT EXISTS operator_growth_missions")
    || !source.includes("CREATE TABLE IF NOT EXISTS operator_growth_mission_revisions")
    || !source.includes('name: "getGrowthMission"')
    || !source.includes('name: "updateGrowthMission"')
    || !source.includes('error: "approved_growth_mission_required"')
    || !source.includes("account_mutation_requires_approved_plan: true")
    || !source.includes("full_auto_requires_explicit_owner_mode_change: true")
    || !router.includes('return "getGrowthMission"')
    || !router.includes('return "updateGrowthMission"')
    || !systemDirectoryTests.includes("routes the persisted Growth Mission Brief for guided owner discussion")
    || !systemDirectoryTests.includes("routes owner-approved Growth Mission updates without enabling full auto implicitly")
    || !tests.includes("opens a guided Growth Mission discussion after Proceed and blocks account mutations until approval")) {
  errors.push("guided_growth_mission_contract_missing");
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

console.log(`[release-preflight] ok version=${version} crons=${crons.length} static_router=true canonical_version_assertions=${canonicalVersionAssertionEntries.length}`);
