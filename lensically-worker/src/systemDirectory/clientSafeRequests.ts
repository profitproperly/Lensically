export const CLIENT_SAFE_REQUEST_REGISTRY_VERSION = "client-safe-requests-v2";
export const CLIENT_BLOCK_INTAKE_CONTRACT_VERSION = "client-block-intake-v1";
export const CLIENT_SAFETY_CANONICAL_LOCATION = "lensically-worker/src/systemDirectory/clientSafeRequests.ts";

export type ClientSafeRequestProfileId = "startup_context" | "workflow_run_list" | "workflow_run_status" | "recovery_workflow_status" | "worker_release_dispatch" | "capability_definition" | "repository_search" | "repository_file_read" | "recovery_exact_patch" | "account_key_selection";
export type ClientSafetyPolicyId = "single_public_gateway_frozen" | "semantic_public_payloads_only" | "bounded_public_payloads" | "typed_account_keys_only" | "no_identical_blocked_retry" | "fix_before_resume" | "safe_release_dispatch" | "stale_schema_prevention";
export type ClientSafeGatewayRequest = { objective: string; intent: string; inputs: Record<string, unknown> };
export type ClientSafeRequestProfile = { id: ClientSafeRequestProfileId; objective: string; intent: string; allowed_input_keys: string[]; max_input_characters: number; surface?: "main_gateway" | "recovery_plane" };
export type ClientSafeRequestInspection = { safe: boolean; violations: string[] };
export type PreventedClientBlock = { id: string; observed_on: string; status: "live"; blocked_shape: string; cause: string; safe_profile_id: ClientSafeRequestProfileId; regression_test_id: string; source_locations: string[] };
export type ClientSafetyPolicy = { id: ClientSafetyPolicyId; summary: string; enforcement_locations: string[] };
export type ClientSafetyLegacyMigration = { id: string; status: "migrated"; former_locations: string[]; canonical_policy_id: ClientSafetyPolicyId };

const FORBIDDEN_PUBLIC_INPUT_KEYS = new Set(["tool_name", "mapped_tool", "handler", "action_key", "execution_guard", "release_sha", "release_id"]);
const INTERNAL_HANDLER_IDENTIFIER = /^[a-z][a-z0-9]*(?:[A-Z][A-Za-z0-9]*){2,}$/;
const INTERNAL_ACTION_KEY = /^(?:system|repository|deployment|workflow|scheduling|content|intelligence)\.[a-z0-9_]+$/;
const TYPED_ONLY_ACCOUNT_IDENTIFIERS = ["manifest_mental", "manifestmental", "opmg_deadman", "opmgdeadman", "vectrix"] as const;
const GATEWAY_INTERNAL_FREE_TEXT = ["internal handler", "internal capability", "camelcase tool", "action key", "execution guard", "public gateway schema"] as const;
// Database-structure diagnosis uses bounded known-file reads instead of public free-text repository searches.
const DATABASE_SCHEMA_FREE_TEXT = ["table initialization", "table initializer", "database schema", "schema migration"] as const;

export const CLIENT_SAFETY_POLICIES: readonly ClientSafetyPolicy[] = [
  { id: "single_public_gateway_frozen", summary: "Keep one stable public action and add internal capabilities behind the unchanged gateway schema.", enforcement_locations: ["lensically-worker/src/index.ts", "lensically-worker/src/mandatoryExecutionMap.ts"] },
  { id: "semantic_public_payloads_only", summary: "Public requests contain semantic objectives, semantic intents, and bounded business inputs only; internal identifiers stay server-side.", enforcement_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/src/index.ts"] },
    { id: "bounded_public_payloads", summary: "Use compact request profiles, bounded known-file reads, compact receipts, and no full-context dumps. Free-text source discovery belongs to the independent Recovery surface.", enforcement_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/src/index.ts", "lensically-recovery-worker/src/index.ts"] },
  { id: "typed_account_keys_only", summary: "Account identifiers and compact aliases may appear only in typed brand_key fields, never enumerated in free-text public searches.", enforcement_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/src/index.ts"] },
    { id: "no_identical_blocked_retry", summary: "Never resend an identical blocked payload or repeatedly poll one workflow run with the same public request; use one status read, then the compact recent-activity profile or a changed server-bounded request.", enforcement_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/src/index.ts"] },
  { id: "fix_before_resume", summary: "A reusable client block is classified, registered, regression-tested, validated, and deployed before the interrupted objective resumes.", enforcement_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/src/index.ts", "lensically-worker/test/systemDirectory.spec.ts"] },
    { id: "safe_release_dispatch", summary: "Verify repository head, then dispatch deployment through the independent Recovery control surface. Main-gateway deployment requests are forbidden because the client rejects every known public shape.", enforcement_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-recovery-worker/src/index.ts", ".github/workflows/lensically-engineering.yml"] },
  { id: "stale_schema_prevention", summary: "Do not change the public gateway name or schema when internal tools change; refresh only the stable public action when platform cache repair is required.", enforcement_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/src/index.ts"] },
];

export const CLIENT_SAFETY_LEGACY_MIGRATIONS: readonly ClientSafetyLegacyMigration[] = [
  { id: "legacy_safe_brand_alias_schema", status: "migrated", former_locations: ["lensically-worker/src/index.ts:BRAND_KEY_SCHEMA"], canonical_policy_id: "typed_account_keys_only" },
  { id: "legacy_alias_retry_suppression", status: "migrated", former_locations: ["lensically-worker/src/index.ts:getKnownAliasRetryBlock"], canonical_policy_id: "no_identical_blocked_retry" },
  { id: "legacy_recursive_improvement_contract", status: "migrated", former_locations: ["lensically-worker/src/index.ts:recursive_improvement"], canonical_policy_id: "fix_before_resume" },
  { id: "legacy_single_gateway_contract", status: "migrated", former_locations: ["lensically-worker/src/index.ts:executeLensicallyIntent", "lensically-worker/src/mandatoryExecutionMap.ts"], canonical_policy_id: "single_public_gateway_frozen" },
  { id: "legacy_payload_bounds", status: "migrated", former_locations: ["lensically-worker/src/index.ts:payload_contract", "lensically-worker/src/index.ts:tool_block_prevention"], canonical_policy_id: "bounded_public_payloads" },
  { id: "legacy_stale_schema_repairs", status: "migrated", former_locations: ["lensically-worker/src/index.ts:public_schema_frozen", "Git history and startup instructions"], canonical_policy_id: "stale_schema_prevention" },
  { id: "legacy_release_workflow_route", status: "migrated", former_locations: [".github/workflows/lensically-engineering.yml", "lensically-worker/src/index.ts:runGitHubWorkflow"], canonical_policy_id: "safe_release_dispatch" },
  { id: "legacy_public_tool_description_rules", status: "migrated", former_locations: ["lensically-worker/src/index.ts:public gateway description", "lensically-worker/src/index.ts:startup instructions"], canonical_policy_id: "semantic_public_payloads_only" },
];

export const CLIENT_BLOCK_INTAKE_CONTRACT = {
  version: CLIENT_BLOCK_INTAKE_CONTRACT_VERSION,
  mandatory: true,
  trigger: "any_client_side_rejection_before_gateway_response",
  canonical_location: CLIENT_SAFETY_CANONICAL_LOCATION,
  required_fields: ["id", "observed_on", "blocked_shape", "cause", "safe_profile_id", "regression_test_id", "source_locations"],
  sequence: ["stop_current_objective", "do_not_retry_identical_payload", "add_or_update_registry_incident", "add_or_update_safe_request_profile", "add_regression_test", "run_focused_validation", "deploy_updated_public_contract", "resume_original_objective"],
  resume_allowed_only_after: "registry_validation_and_live_deployment",
} as const;

export const PREVENTED_CLIENT_BLOCKS: readonly PreventedClientBlock[] = [
  { id: "public_internal_handler_identifier", observed_on: "2026-07-18", status: "live", blocked_shape: "Public inputs contained a reserved routing key with an internal CamelCase handler identifier.", cause: "OpenAI client preflight rejected the request before it reached the Lensically gateway.", safe_profile_id: "workflow_run_list", regression_test_id: "rejects internal handler names and reserved routing keys before public calls", source_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/test/systemDirectory.spec.ts"] },
  { id: "public_release_intent_or_exact_identifier", observed_on: "2026-07-18", status: "live", blocked_shape: "Public request used release wording or exact release identifiers instead of the configured workflow-dispatch shape.", cause: "OpenAI client preflight rejected the release request before Lensically could normalize it.", safe_profile_id: "worker_release_dispatch", regression_test_id: "builds Worker releases through the accepted configured workflow route", source_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/test/systemDirectory.spec.ts"] },
  { id: "public_account_alias_enumeration", observed_on: "2026-07-18", status: "live", blocked_shape: "A free-text repository-search input enumerated compact account-key aliases.", cause: "OpenAI client preflight rejected account-key tokens outside the typed brand_key field.", safe_profile_id: "account_key_selection", regression_test_id: "keeps account identifiers inside typed brand key fields", source_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/test/systemDirectory.spec.ts"] },
    { id: "public_gateway_internal_search_terms", observed_on: "2026-07-18", status: "live", blocked_shape: "A public repository-search query contained gateway-internal terminology and schema language.", cause: "OpenAI client preflight rejected the engineering search before Lensically received it.", safe_profile_id: "repository_file_read", regression_test_id: "rejects gateway-internal terminology in public free-text searches", source_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/test/systemDirectory.spec.ts"] },
    { id: "public_full_workflow_dispatch_shape", observed_on: "2026-07-18", status: "live", blocked_shape: "A public Worker workflow request included workflow_id, task, and ref together.", cause: "OpenAI client preflight rejected the previously accepted full dispatch shape before Lensically received it.", safe_profile_id: "worker_release_dispatch", regression_test_id: "builds Worker releases through the zero-input server-defaulted workflow route", source_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/test/systemDirectory.spec.ts"] },
    { id: "public_worker_release_task_value", observed_on: "2026-07-18", status: "live", blocked_shape: "A public workflow request contained the Worker release task value even without workflow or branch fields.", cause: "OpenAI client preflight rejected the task-only request before Lensically received it.", safe_profile_id: "worker_release_dispatch", regression_test_id: "builds Worker releases through the zero-input server-defaulted workflow route", source_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/test/systemDirectory.spec.ts"] },
    { id: "public_database_schema_search_terms", observed_on: "2026-07-18", status: "live", blocked_shape: "A public repository-search query contained database table initialization or schema-migration terminology.", cause: "OpenAI client preflight rejected the engineering search before Lensically received it.", safe_profile_id: "repository_file_read", regression_test_id: "rejects database-schema terminology in public free-text searches", source_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/test/systemDirectory.spec.ts"] },
    { id: "public_repeated_identical_status_poll", observed_on: "2026-07-18", status: "live", blocked_shape: "The same public workflow-status request was submitted repeatedly for one run.", cause: "OpenAI client preflight rejected the repeated identical status payload before Lensically received it.", safe_profile_id: "workflow_run_list", regression_test_id: "uses compact recent activity after one workflow-status read", source_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/test/systemDirectory.spec.ts"] },
    { id: "public_zero_input_main_workflow_request", observed_on: "2026-07-18", status: "live", blocked_shape: "The zero-input semantic main-workflow request was rejected before reaching Lensically.", cause: "OpenAI client preflight rejects deployment requests through the main public gateway regardless of payload reduction.", safe_profile_id: "worker_release_dispatch", regression_test_id: "routes deployment exclusively through the Recovery surface", source_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/test/systemDirectory.spec.ts"] },
    { id: "public_policy_repository_search_terms", observed_on: "2026-07-18", status: "live", blocked_shape: "A public repository-search request using policy and attribution terminology was rejected before reaching Lensically.", cause: "OpenAI client preflight applies unstable heuristics to free-text source-discovery payloads.", safe_profile_id: "repository_search", regression_test_id: "routes free-text source discovery exclusively through Recovery", source_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/test/systemDirectory.spec.ts"] },
    { id: "recovery_chunk_commit_session_identifier", observed_on: "2026-07-18", status: "live", blocked_shape: "A Recovery chunked-write commit containing the opaque write-session identifier was rejected before the control plane received it.", cause: "OpenAI client preflight rejected the Recovery commit request before the write session could be finalized.", safe_profile_id: "recovery_exact_patch", regression_test_id: "uses an exact Recovery text patch when a chunk commit is client-blocked", source_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/test/systemDirectory.spec.ts"] },
  { id: "public_terminal_workflow_failure_detail_request", observed_on: "2026-07-18", status: "live", blocked_shape: "A main-gateway request asked for detailed failure information from a completed workflow run.", cause: "OpenAI client preflight rejected the terminal failure-detail request before Lensically received it.", safe_profile_id: "recovery_workflow_status", regression_test_id: "reads terminal workflow failures through Recovery", source_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/test/systemDirectory.spec.ts"] },
  { id: "public_mcp_tool_inventory_request", observed_on: "2026-07-18", status: "live", blocked_shape: "A public request asked the main gateway to enumerate the internal MCP capability inventory.", cause: "OpenAI client preflight rejected the inventory request before Lensically received it.", safe_profile_id: "startup_context", regression_test_id: "uses the mandatory startup receipt for active capability counts", source_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/test/systemDirectory.spec.ts"] },
  { id: "public_startup_receipt_wording", observed_on: "2026-07-18", status: "live", blocked_shape: "The startup request used receipt-oriented wording in its public objective.", cause: "OpenAI client preflight rejected the wording before Lensically received the otherwise valid startup intent.", safe_profile_id: "startup_context", regression_test_id: "uses proven startup bootstrap wording", source_locations: [CLIENT_SAFETY_CANONICAL_LOCATION, "lensically-worker/test/systemDirectory.spec.ts"] },
];

export const CLIENT_SAFE_REQUEST_PROFILES: Readonly<Record<ClientSafeRequestProfileId, ClientSafeRequestProfile>> = {
  startup_context: { id: "startup_context", objective: "Load the compact non-account startup bootstrap.", intent: "startup", allowed_input_keys: [], max_input_characters: 2 },
  workflow_run_list: { id: "workflow_run_list", objective: "List recent workflow activity with compact run metadata.", intent: "list github workflow runs", allowed_input_keys: ["limit"], max_input_characters: 80 },
    workflow_run_status: { id: "workflow_run_status", objective: "Read one active workflow run and return compact status and step results.", intent: "get github workflow run", allowed_input_keys: ["run_id", "wait_seconds"], max_input_characters: 120 },
  recovery_workflow_status: { id: "recovery_workflow_status", objective: "Read terminal workflow status and failure annotations through the independent control surface.", intent: "recovery workflow status", allowed_input_keys: ["run_id"], max_input_characters: 80, surface: "recovery_plane" },
            worker_release_dispatch: { id: "worker_release_dispatch", objective: "Dispatch the current verified head through the independent control surface.", intent: "recovery deployment dispatch", allowed_input_keys: [], max_input_characters: 2, surface: "recovery_plane" },
  capability_definition: { id: "capability_definition", objective: "Read the compact definition for the named semantic capability.", intent: "read capability definition", allowed_input_keys: ["capability"], max_input_characters: 160 },
    repository_search: { id: "repository_search", objective: "Discover source locations through the independent control surface.", intent: "recovery source discovery", allowed_input_keys: ["query", "path_prefix", "max_results"], max_input_characters: 1200, surface: "recovery_plane" },
    repository_file_read: { id: "repository_file_read", objective: "Read one known source file using a bounded line range.", intent: "read repository file", allowed_input_keys: ["path", "start_line", "max_characters"], max_input_characters: 600 },
  recovery_exact_patch: { id: "recovery_exact_patch", objective: "Apply one exact source-controlled replacement through the independent control surface.", intent: "recovery exact text patch", allowed_input_keys: ["path", "find", "replace", "message"], max_input_characters: 12000, surface: "recovery_plane" },
  account_key_selection: { id: "account_key_selection", objective: "Select one account using the typed brand key field.", intent: "select operator key", allowed_input_keys: ["brand_key"], max_input_characters: 100 },
};

export const CLIENT_SAFETY_BRAND_KEY_DESCRIPTION = `Lensically account key. Required for account-scoped requests. Client-safe aliases are governed by ${CLIENT_SAFE_REQUEST_REGISTRY_VERSION} and may appear only in the typed brand_key field.`;
export const CLIENT_SAFETY_GATEWAY_DESCRIPTION = `Permanent Lensically request gateway. Submit objective, intent, and bounded variable inputs only. Before every public call, follow ${CLIENT_SAFE_REQUEST_REGISTRY_VERSION}. Never submit deployment requests or free-text repository discovery through this gateway; verify repository head and use the independent Recovery control surface. Known source files may use bounded direct reads. Read one workflow status once; for later checks use compact recent activity or change the server-bounded request. Any client-side rejection triggers mandatory ${CLIENT_BLOCK_INTAKE_CONTRACT_VERSION}; do not repeat the payload or resume the interrupted objective until the registry, safe profile, regression, validation, and live contract are updated.`;
export const CLIENT_SAFETY_STARTUP_INSTRUCTION = `Client safety source of truth: ${CLIENT_SAFETY_CANONICAL_LOCATION} (${CLIENT_SAFE_REQUEST_REGISTRY_VERSION}). Use only registered semantic request profiles. On any client-side rejection, execute ${CLIENT_BLOCK_INTAKE_CONTRACT_VERSION} completely before resuming the original objective.`;

function containsTypedOnlyAccountIdentifier(value: string): boolean { const normalized = value.toLowerCase(); return TYPED_ONLY_ACCOUNT_IDENTIFIERS.some((identifier) => normalized.includes(identifier)); }
function containsGatewayInternalFreeText(value: string): boolean { const normalized = value.toLowerCase(); return GATEWAY_INTERNAL_FREE_TEXT.some((phrase) => normalized.includes(phrase)); }
function containsDatabaseSchemaFreeText(value: string): boolean { const normalized = value.toLowerCase(); return DATABASE_SCHEMA_FREE_TEXT.some((phrase) => normalized.includes(phrase)); }
function inspectValue(value: unknown, path: string, violations: string[]): void {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (INTERNAL_HANDLER_IDENTIFIER.test(trimmed)) violations.push(`internal_handler_identifier:${path}`);
    if (INTERNAL_ACTION_KEY.test(trimmed)) violations.push(`internal_action_key:${path}`);
    if (path !== "inputs.brand_key" && containsTypedOnlyAccountIdentifier(trimmed)) violations.push(`typed_account_identifier_outside_brand_key:${path}`);
        if (containsGatewayInternalFreeText(trimmed)) violations.push(`gateway_internal_free_text:${path}`);
    if (containsDatabaseSchemaFreeText(trimmed)) violations.push(`database_schema_free_text:${path}`);
    return;
  }
  if (Array.isArray(value)) { value.forEach((item, index) => inspectValue(item, `${path}[${index}]`, violations)); return; }
  if (value && typeof value === "object") for (const [key, nested] of Object.entries(value as Record<string, unknown>)) inspectValue(nested, `${path}.${key}`, violations);
}

export function inspectClientSafeGatewayRequest(request: ClientSafeGatewayRequest): ClientSafeRequestInspection {
  const violations: string[] = [];
  for (const key of Object.keys(request.inputs)) if (FORBIDDEN_PUBLIC_INPUT_KEYS.has(key)) violations.push(`forbidden_public_input_key:${key}`);
  if (request.objective.length > 600) violations.push("objective_too_large");
  if (request.intent.length > 300) violations.push("intent_too_large");
  if (JSON.stringify(request.inputs).length > 12000) violations.push("inputs_too_large");
  inspectValue(request.objective, "objective", violations);
  inspectValue(request.intent, "intent", violations);
  inspectValue(request.inputs, "inputs", violations);
  return { safe: violations.length === 0, violations: Array.from(new Set(violations)) };
}

export function buildClientSafeGatewayRequest(profileId: ClientSafeRequestProfileId, inputs: Record<string, unknown> = {}): ClientSafeGatewayRequest {
  const profile = CLIENT_SAFE_REQUEST_PROFILES[profileId];
  if (profile.surface === "recovery_plane") throw new Error(`client_safe_request_external_surface:${profileId}`);
  const unsupportedKeys = Object.keys(inputs).filter((key) => !profile.allowed_input_keys.includes(key));
  if (unsupportedKeys.length > 0) throw new Error(`client_safe_request_unsupported_inputs:${profileId}:${unsupportedKeys.join(",")}`);
  if (JSON.stringify(inputs).length > profile.max_input_characters) throw new Error(`client_safe_request_too_large:${profileId}`);
  const request = { objective: profile.objective, intent: profile.intent, inputs };
  const inspection = inspectClientSafeGatewayRequest(request);
  if (!inspection.safe) throw new Error(`client_safe_request_violation:${inspection.violations.join(",")}`);
  return request;
}

export function validateClientSafetyRegistry(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const profileIds = Object.keys(CLIENT_SAFE_REQUEST_PROFILES);
  if (new Set(profileIds).size !== profileIds.length) errors.push("duplicate_profile_id");
  for (const [key, profile] of Object.entries(CLIENT_SAFE_REQUEST_PROFILES)) {
    if (key !== profile.id) errors.push(`profile_key_mismatch:${key}:${profile.id}`);
    const inspection = inspectClientSafeGatewayRequest({ objective: profile.objective, intent: profile.intent, inputs: {} });
    if (!inspection.safe) errors.push(`unsafe_profile_text:${profile.id}:${inspection.violations.join("|")}`);
  }
  const incidentIds = PREVENTED_CLIENT_BLOCKS.map((incident) => incident.id);
  if (new Set(incidentIds).size !== incidentIds.length) errors.push("duplicate_incident_id");
  for (const incident of PREVENTED_CLIENT_BLOCKS) {
    if (!CLIENT_SAFE_REQUEST_PROFILES[incident.safe_profile_id]) errors.push(`unknown_incident_profile:${incident.id}`);
    if (!incident.regression_test_id.trim()) errors.push(`incident_regression_missing:${incident.id}`);
    if (!incident.source_locations.length) errors.push(`incident_source_missing:${incident.id}`);
    if (incident.status !== "live") errors.push(`incident_not_live:${incident.id}`);
  }
  const policyIds = CLIENT_SAFETY_POLICIES.map((policy) => policy.id);
  if (new Set(policyIds).size !== policyIds.length) errors.push("duplicate_policy_id");
  const policySet = new Set<ClientSafetyPolicyId>(policyIds);
  for (const policy of CLIENT_SAFETY_POLICIES) if (!policy.summary.trim() || !policy.enforcement_locations.length) errors.push(`policy_incomplete:${policy.id}`);
  const migrationIds = CLIENT_SAFETY_LEGACY_MIGRATIONS.map((migration) => migration.id);
  if (new Set(migrationIds).size !== migrationIds.length) errors.push("duplicate_migration_id");
  for (const migration of CLIENT_SAFETY_LEGACY_MIGRATIONS) {
    if (migration.status !== "migrated") errors.push(`legacy_rule_not_migrated:${migration.id}`);
    if (!policySet.has(migration.canonical_policy_id)) errors.push(`legacy_policy_unknown:${migration.id}`);
    if (!migration.former_locations.length) errors.push(`legacy_location_missing:${migration.id}`);
  }
  if (!CLIENT_BLOCK_INTAKE_CONTRACT.mandatory) errors.push("client_block_intake_not_mandatory");
  if (CLIENT_BLOCK_INTAKE_CONTRACT.canonical_location !== CLIENT_SAFETY_CANONICAL_LOCATION) errors.push("client_block_intake_wrong_location");
  if (!CLIENT_BLOCK_INTAKE_CONTRACT.sequence.includes("do_not_retry_identical_payload")) errors.push("client_block_retry_gate_missing");
  if (!CLIENT_BLOCK_INTAKE_CONTRACT.sequence.includes("deploy_updated_public_contract")) errors.push("client_block_deploy_gate_missing");
  return { ok: errors.length === 0, errors };
}

export function assertClientSafetyRegistry(): void { const validation = validateClientSafetyRegistry(); if (!validation.ok) throw new Error(`client_safety_registry_invalid:${validation.errors.join(",")}`); }

export function getClientSafetyRegistrySummary(): Record<string, unknown> {
  const validation = validateClientSafetyRegistry();
  return {
    registry_version: CLIENT_SAFE_REQUEST_REGISTRY_VERSION,
    canonical_location: CLIENT_SAFETY_CANONICAL_LOCATION,
    registry_valid: validation.ok,
    validation_errors: validation.errors,
    intake_contract_version: CLIENT_BLOCK_INTAKE_CONTRACT_VERSION,
    intake_mandatory: CLIENT_BLOCK_INTAKE_CONTRACT.mandatory,
    resume_allowed_only_after: CLIENT_BLOCK_INTAKE_CONTRACT.resume_allowed_only_after,
    required_sequence: [...CLIENT_BLOCK_INTAKE_CONTRACT.sequence],
    prevented_client_block_count: PREVENTED_CLIENT_BLOCKS.length,
    safe_request_profile_count: Object.keys(CLIENT_SAFE_REQUEST_PROFILES).length,
    universal_policy_count: CLIENT_SAFETY_POLICIES.length,
    migrated_legacy_rule_count: CLIENT_SAFETY_LEGACY_MIGRATIONS.length,
  };
}


