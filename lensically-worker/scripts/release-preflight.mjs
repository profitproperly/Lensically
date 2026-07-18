import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Validates the verified release marker, fail-closed capability lifecycle, Guided Growth Mission, and client-safety registry before deployment.
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
const systemDirectoryTests = read("test/systemDirectory.spec.ts");
const workflow = read("../.github/workflows/lensically-engineering.yml");
const validationWorkflow = read("../.github/workflows/lensically-validation.yml");
const currentState = read("../CURRENT_STATE.md");
const recoverySource = read("../lensically-recovery-worker/src/index.ts");

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
if (!workflow.includes("node scripts/release-preflight.mjs --capability-lifecycle-only")) lifecycleErrors.push("capability_lifecycle_engineering_gate_missing");

if (lifecycleErrors.length > 0) {
  for (const error of lifecycleErrors) console.error(`[capability-lifecycle] ${error}`);
  process.exit(1);
}
if (process.argv.includes("--capability-lifecycle-only")) {
  console.log(`[capability-lifecycle] ok declarations=${lifecycleDeclarations.length} tools=${toolDefinitionNames.length} directory_entries=${directoryEntryIds.length}`);
  process.exit(0);
}

const version = source.match(/const OPERATOR_MCP_VERSION = "([^"]+)";/)?.[1] ?? null;
if (!version) errors.push("operator_mcp_version_missing");
if (version && !currentState.includes(`Operator MCP v${version}`)) {
  errors.push(`current_state_version_mismatch:${version}`);
}

const versionAssertionLines = tests
  .split(/\r?\n/)
  .filter((line) => /runtime\.mcp_version|serverInfo\.version|payload\.mcp_version/.test(line));
const assertedVersions = versionAssertionLines
  .map((line) => line.match(/\.toBe\("([0-9]+\.[0-9]+\.[0-9]+)"\)/)?.[1] ?? null)
  .filter((value) => value !== null);
if (assertedVersions.length < 3) {
  errors.push(`operator_version_assertions_incomplete:${assertedVersions.length}`);
} else if (version && assertedVersions.some((asserted) => asserted !== version)) {
  errors.push(`operator_version_assertion_mismatch:runtime=${version}:tests=${[...new Set(assertedVersions)].join(",")}`);
}

if (!source.includes('const OPERATOR_REGISTRY_GENERATION = "static-execution-router-v1";')
    || !router.includes('MANDATORY_EXECUTION_MAP_VERSION = "static-execution-router-v1"')
    || !router.includes("source_defined_static_route")
    || !router.includes("d1_execution_library_bypassed: true")
    || !router.includes("discovery_allowed: false")
    || !router.includes("model_tool_choice_allowed: false")) {
  errors.push("static_execution_router_contract_missing");
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

if (!source.includes('name: "executeLensicallyIntent"')
    || !source.includes('required: ["objective", "intent", "inputs"]')
    || !source.includes("routed_execution_gateway_required")
    || !source.includes("prepareMandatoryExecutionMapCall")
    || !source.includes("finalizeMandatoryExecutionMapCall")) {
  errors.push("single_gateway_contract_missing");
}

if (!source.includes("const sourceDefinedStaticRoute = routedMapExecution?.d1_execution_library_bypassed === true;")
    || !source.includes("const preCallRouting = sourceDefinedStaticRoute")
    || !source.includes("if (!sourceDefinedStaticRoute) {\n        await recordOperatorExecutionDecision")) {
  errors.push("static_route_runtime_bypass_missing");
}

if (!workflow.includes("run-name: Lensically ${{ inputs.task }} · ${{ inputs.release_id || github.sha }}")) errors.push("workflow_run_name_missing");
if (!workflow.includes("cancel-in-progress: true")) errors.push("workflow_concurrency_cancellation_missing");
if (!workflow.includes("node scripts/release-preflight.mjs --print-crons")) errors.push("workflow_cron_single_source_missing");
if (!workflow.includes("release_id:")) errors.push("workflow_release_id_missing");
if (!workflow.includes("release_sha:")) errors.push("workflow_release_sha_missing");
if (!workflow.includes("- name: System Directory tests")
    || !workflow.includes("inputs.task == 'system-directory-tests' || inputs.task == 'worker-deploy'")) {
  errors.push("system_directory_release_gate_missing");
}
if (!workflow.includes("worker:\n    if: ${{ github.event_name == 'workflow_dispatch' }}")) {
  errors.push("worker_job_must_be_dispatch_only");
}
if (!workflow.includes("# verified-release-marker:")
    || !workflow.includes("verified-release-marker:")
    || !workflow.includes("[verified-worker-release]")
    || !workflow.includes("gh workflow run lensically-engineering.yml")
    || !workflow.includes("--field task=worker-deploy")
    || !workflow.includes('--field release_sha="${RELEASE_SHA}"')
    || !workflow.includes("actions: write")) {
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
if (!source.includes("Worker deployment is Recovery-only")
    || !clientSafety.includes('verified_release_marker')
    || !clientSafety.includes('recovery_task_only_deploy_dispatch')
    || !clientSafety.includes('surface: "recovery_plane"')
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
    || !tests.includes("routes the persisted Growth Mission Brief for guided owner discussion")
    || !tests.includes("routes owner-approved Growth Mission updates without enabling full auto implicitly")
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

console.log(`[release-preflight] ok version=${version} crons=${crons.length} static_router=true exact_version_assertions=${assertedVersions.length}`);
