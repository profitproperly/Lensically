import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = process.cwd();
const repoRoot = resolve(root, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const ignoredRepositoryDirectories = new Set([".git", "node_modules", ".wrangler", "dist", "coverage"]);
const repositoryKnowledgeExtensions = new Set([".md", ".txt", ".json", ".jsonc", ".yml", ".yaml", ".sql", ".mjs"]);
function collectRepositoryFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredRepositoryDirectories.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectRepositoryFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}
const repositoryFiles = collectRepositoryFiles(repoRoot);
const repositoryFileManifest = repositoryFiles.map((absolute) => ({
  path: relative(repoRoot, absolute).replaceAll("\\", "/"),
  size: statSync(absolute).size,
}));
const repositoryTextKnowledge = Object.fromEntries(repositoryFiles
  .map((absolute) => ({
    absolute,
    path: relative(repoRoot, absolute).replaceAll("\\", "/"),
    size: statSync(absolute).size,
  }))
  .filter((file) => file.path !== "lensically-worker/src/mandatoryExecutionMap.ts")
  .filter((file) => file.size <= 120000)
  .filter((file) => repositoryKnowledgeExtensions.has(file.path.slice(file.path.lastIndexOf("."))))
  .map((file) => [file.path, readFileSync(file.absolute, "utf8")]));
const wrangler = read("wrangler.jsonc");
const source = read("src/index.ts");
let executionMap = read("src/mandatoryExecutionMap.ts");
const tests = read("test/operatorMode.spec.ts");
const workflow = read("../.github/workflows/lensically-engineering.yml");
const currentState = read("../CURRENT_STATE.md");
const operatingMemory = read("../OPERATING_MEMORY.md");
const agents = read("../AGENTS.md");
const recoverySource = read("../lensically-recovery-worker/src/index.ts");

const sourceDefinedRoutes = source.match(/const SOURCE_DEFINED_PRE_CALL_ROUTES = \[[\s\S]*?\] as const;/)?.[0] ?? "";
const sourceDefinedProcedures = executionMap.match(/const overrides: Record<string, Record<string, unknown>> = \{[\s\S]*?return overrides\[tool\.name\][\s\S]*?\n\}/)?.[0] ?? "";
const generatedKnowledge = {
  ...repositoryTextKnowledge,
  "__repository_file_manifest__": JSON.stringify(repositoryFileManifest),
  "OPERATING_MEMORY.md": operatingMemory,
  "AGENTS.md": agents,
  "CURRENT_STATE.md": currentState,
  "source_defined_pre_call_routes": sourceDefinedRoutes,
  "source_defined_execution_procedures": sourceDefinedProcedures,
};
const generatedBlock = `// BEGIN GENERATED EXECUTION KNOWLEDGE\nconst GENERATED_EXECUTION_KNOWLEDGE: Record<string, string> = ${JSON.stringify(generatedKnowledge, null, 2)};\n// END GENERATED EXECUTION KNOWLEDGE`;
const generatedPattern = /\/\/ BEGIN GENERATED EXECUTION KNOWLEDGE[\s\S]*?\/\/ END GENERATED EXECUTION KNOWLEDGE/;
if (!generatedPattern.test(executionMap)) throw new Error("execution_knowledge_marker_missing");
executionMap = executionMap.replace(generatedPattern, generatedBlock);
writeFileSync(resolve(root, "src/mandatoryExecutionMap.ts"), executionMap, "utf8");

const cronMatch = wrangler.match(/"crons"\s*:\s*(\[[\s\S]*?\])/);
if (!cronMatch) {
  throw new Error("wrangler_crons_missing");
}
const crons = JSON.parse(cronMatch[1]);
if (!Array.isArray(crons) || crons.length === 0 || crons.some((cron) => typeof cron !== "string" || !cron.trim())) {
  throw new Error("wrangler_crons_invalid");
}

if (process.argv.includes("--print-crons")) {
  process.stdout.write(`${crons.join("\n")}\n`);
  process.exit(0);
}

const errors = [];
const versionMatch = source.match(/const OPERATOR_MCP_VERSION = "([^"]+)";/);
const version = versionMatch?.[1] ?? null;
if (!version) {
  errors.push("operator_mcp_version_missing");
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

if (version && !currentState.includes(`Operator MCP v${version}`)) {
  errors.push(`current_state_version_mismatch:${version}`);
}
if (!workflow.includes("run-name: Lensically ${{ inputs.task }}")) {
  errors.push("workflow_run_name_missing");
}
if (!workflow.includes("cancel-in-progress: true")) {
  errors.push("workflow_concurrency_cancellation_missing");
}
if (!workflow.includes("node scripts/release-preflight.mjs --print-crons")) {
  errors.push("workflow_cron_single_source_missing");
}
if (!workflow.includes("release_id:")) {
  errors.push("workflow_release_id_missing");
}
if (!workflow.includes("release_sha:")) {
  errors.push("workflow_release_sha_missing");
}
if (!workflow.includes('ref: ${{ inputs.release_sha || github.sha }}')) {
  errors.push("workflow_exact_sha_checkout_missing");
}
if (!workflow.includes('test "$(git rev-parse HEAD)" = "${{ inputs.release_sha }}"')) {
  errors.push("workflow_exact_sha_verification_missing");
}
if (!source.includes("const dispatchRef = config.branch;")
    || !source.includes("release_sha: headSha")
    || !source.includes("ref: dispatchRef")) {
  errors.push("main_release_exact_sha_dispatch_guard_missing");
}
if (source.includes("follower_day_net_change")) {
  errors.push("post_level_follower_attribution_forbidden");
}
if (!source.includes("export const OPERATOR_PERFORMANCE_MATURITY_CHECKPOINTS = [6, 12, 18, 24] as const;")) {
  errors.push("performance_checkpoint_contract_mismatch");
}
if (!source.includes('limit: "40",')) {
  errors.push("latest_40_insights_collection_contract_missing");
}
if (!source.includes('post_level_attribution: "forbidden"') || !source.includes('day_or_period_post_attribution: "forbidden"')) {
  errors.push("performance_evaluator_follower_policy_missing");
}
if (source.includes('      await prepareOperatorMode(env);\n      const executionPolicy = buildOperatorExecutionPolicy(toolName, args);')) {
  errors.push("duplicate_mcp_dispatcher_bootstrap_forbidden");
}
if (source.includes('      await ensureOperatorMcpAdminTables(env);\n      const executionPolicy = buildOperatorExecutionPolicy(toolName, args);')) {
  errors.push("mcp_dispatcher_schema_initialization_forbidden");
}
if (!source.includes('name: "executeLensicallyIntent"')
    || !source.includes('required: ["objective", "intent", "inputs"]')
    || source.includes('filter((tool) => tool.name === "getOperatorStartupContext" || tool.name === OPERATOR_ROUTED_EXECUTION_GATEWAY)')
    || !source.includes('prepareMandatoryExecutionMapCall')
    || !source.includes('finalizeMandatoryExecutionMapCall')
    || !source.includes('model_tool_choice_allowed: false')
    || !source.includes('direct_operational_calls_allowed: false')) {
  errors.push("mandatory_execution_map_contract_missing");
}
if (!tests.includes('makes the execution map the only public action path')
    || !tests.includes('records unknown terrain, permits discovery once, and promotes the successful path')
    || !tests.includes('blocks a stale known path and makes the verified replacement mandatory')) {
  errors.push("mandatory_execution_map_regression_missing");
}
if (!executionMap.includes("isDeterministicInputValidationFailure")
    || !executionMap.includes("result.ok !== false || isDeterministicInputValidationFailure(result)")
    || !executionMap.includes("repairDeterministicInputValidationIncidents")
    || !executionMap.includes("await repairDeterministicInputValidationIncidents(db)")) {
  errors.push("mandatory_execution_map_input_validation_repair_missing");
}
if (!executionMap.includes('runGitHubWorkflow: ["run typecheck"')
    || executionMap.includes('runMcpTests: ["run mcp tests", "run operator tests"')
    || !executionMap.includes("inferredArgumentsForOperationalIntent")
    || !executionMap.includes('return { task: "typecheck" }')
    || !executionMap.includes('existing.source_type === "tool_registry_seed"')
    || !executionMap.includes("desiredVerificationSummary")) {
  errors.push("engineering_validation_route_contract_missing");
}
if (!executionMap.includes('EXECUTION_POLICY_LIBRARY_VERSION = "execution-policy-library-v2"')
    || !executionMap.includes("operator_execution_library_sources")
    || !executionMap.includes("operator_execution_library_ingestion_state")
    || !executionMap.includes("syncExecutionPolicyLibrarySources")
    || !executionMap.includes("readExecutionPolicyLibraryTableCatalog")
    || !executionMap.includes("d1_table_manifest")
    || !executionMap.includes("executionLibraryRefreshDue")
    || !executionMap.includes("readExecutionPolicyLibraryCandidates")
    || !executionMap.includes("execution_policy_library_not_ready")
    || !executionMap.includes("policy_ready: policyReady")
    || !executionMap.includes("table_manifest_complete")
    || !executionMap.includes("compileExecutionPolicyLibrary")
    || !executionMap.includes("consulted_before_execution: true")
    || !executionMap.includes("failed_recorded_before_repair")
    || !executionMap.includes("mandatory_path_updated_before_resume")
    || !executionMap.includes("__repository_file_manifest__")
    || !source.includes("execution_library?: Record<string, unknown>")
    || !source.includes("execution_library: prepared.execution_library ?? null")
    || !source.includes("resultPayload.execution_library = routedGatewayMetadata.execution_library")) {
  errors.push("mandatory_execution_library_contract_missing");
}
if (!tests.includes("consulted_before_execution: true")
    || !tests.includes('"ops_memory"')
    || !tests.includes('"pre_call_route"')
    || !tests.includes('"map_entry"')) {
  errors.push("mandatory_execution_library_regression_missing");
}

if (!recoverySource.includes('exact_sha_not_current_branch_head') || !recoverySource.includes('dispatch_ref: dispatchRef') || !recoverySource.includes('verified_head_sha: verifiedHeadSha')) {
  errors.push("recovery_exact_sha_dispatch_guard_missing");
}

if (new Set(crons).size !== crons.length) {

  errors.push("duplicate_wrangler_crons");
}

if (errors.length > 0) {
  for (const error of errors) console.error(`[release-preflight] ${error}`);
  process.exit(1);
}

console.log(`[release-preflight] ok version=${version} crons=${crons.length} exact_version_assertions=${assertedVersions.length}`);
