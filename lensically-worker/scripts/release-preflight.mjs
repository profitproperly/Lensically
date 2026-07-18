import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const wrangler = read("wrangler.jsonc");
const source = read("src/index.ts");
const router = read("src/mandatoryExecutionMap.ts");
const clientSafety = read("src/systemDirectory/clientSafeRequests.ts");
const tests = read("test/operatorMode.spec.ts");
const workflow = read("../.github/workflows/lensically-engineering.yml");
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

if (!workflow.includes("run-name: Lensically engineering · ${{ github.sha }}")) errors.push("workflow_run_name_missing");
if (!workflow.includes("cancel-in-progress: true")) errors.push("workflow_concurrency_cancellation_missing");
if (!workflow.includes("node scripts/release-preflight.mjs --print-crons")) errors.push("workflow_cron_single_source_missing");
if (workflow.includes("release_id:")) errors.push("obsolete_workflow_release_id_present");
if (!workflow.includes("release_sha:")) errors.push("workflow_release_sha_missing");
if (!workflow.includes("- name: System Directory tests")
    || !workflow.includes("inputs.task == 'system-directory-tests' || inputs.task == 'worker-deploy'")) {
  errors.push("system_directory_release_gate_missing");
}
if (!workflow.includes("worker:\n    if: ${{ github.event_name == 'workflow_dispatch' }}")) {
  errors.push("worker_job_must_be_dispatch_only");
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
    || !clientSafety.includes('intent: "recovery deployment dispatch"')
    || !clientSafety.includes('surface: "recovery_plane"')) {
  errors.push("recovery_only_release_contract_missing");
}

if (!source.includes('name: "get_monthly_growth_review"')
    || !source.includes("OPERATOR_MCP_MAX_STRUCTURED_BYTES = 24_000")
    || !source.includes("enforceOperatorPayloadBudget(resultPayload)")
    || !router.includes('return "get_monthly_growth_review"')
    || !tests.includes("routes the exact monthly growth question to one bounded analytics response")) {
  errors.push("bounded_monthly_growth_contract_missing");
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
