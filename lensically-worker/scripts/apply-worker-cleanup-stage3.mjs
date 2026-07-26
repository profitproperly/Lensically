import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const indexPath = resolve(root, "src/index.ts");
const testPath = resolve(root, "test/humanFreeAutonomy.spec.ts");
let source = await readFile(indexPath, "utf8");
let tests = await readFile(testPath, "utf8");
const changes = [];
const count = (text, needle) => text.split(needle).length - 1;

function removeExact(needle, label) {
  const found = count(source, needle);
  if (found !== 1) throw new Error(`${label}: expected one exact block, found ${found}`);
  source = source.replace(needle, "");
  changes.push(label);
}
function replaceExact(find, replace, label) {
  const found = count(source, find);
  if (found !== 1) throw new Error(`${label}: expected one exact block, found ${found}`);
  source = source.replace(find, replace);
  changes.push(label);
}
function replaceRange(start, end, replacement, label) {
  const startCount = count(source, start);
  const endCount = count(source, end);
  if (startCount !== 1 || endCount !== 1) throw new Error(`${label}: marker mismatch ${startCount}/${endCount}`);
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (to <= from) throw new Error(`${label}: invalid marker order`);
  source = `${source.slice(0, from)}${replacement}${source.slice(to)}`;
  changes.push(label);
}

removeExact(`  await env.DB.prepare(
    \`CREATE TABLE IF NOT EXISTS operator_workflow_sessions (
      id TEXT PRIMARY KEY,
      brand_key TEXT NOT NULL,
      workflow_template_key TEXT NOT NULL DEFAULT 'content_operator_v1',
      objective TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      current_stage TEXT,
      active_source_card_id TEXT,
      active_generation_run_id TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )\`,
  ).run();
  await env.DB.prepare(
    \`CREATE INDEX IF NOT EXISTS idx_operator_workflow_sessions_brand_status
     ON operator_workflow_sessions (brand_key, status, updated_at DESC)\`,
  ).run();
  if (!(await doesColumnExist(env, "operator_workflow_sessions", "objective"))) {
    await env.DB.prepare("ALTER TABLE operator_workflow_sessions ADD COLUMN objective TEXT").run();
  }
  await env.DB.prepare(
    \`CREATE TRIGGER IF NOT EXISTS trg_operator_workflow_sessions_touch_updated_at
     AFTER UPDATE ON operator_workflow_sessions
     FOR EACH ROW
     WHEN NEW.updated_at = OLD.updated_at
     BEGIN
       UPDATE operator_workflow_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
     END\`,
  ).run();

`, "workflow session schema");
removeExact(`  await env.DB.prepare(
    \`CREATE TABLE IF NOT EXISTS operator_context_admissions (
      id TEXT PRIMARY KEY,
      brand_key TEXT NOT NULL,
      workflow_session_id TEXT,
      snapshot_id TEXT,
      admission_scope TEXT NOT NULL,
      sections_json TEXT NOT NULL,
      freshness_started_at TEXT,
      freshness_completed_at TEXT,
      is_partial INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )\`,
  ).run();
  await env.DB.prepare(
    \`CREATE INDEX IF NOT EXISTS idx_operator_context_admissions_brand_created
     ON operator_context_admissions (brand_key, created_at DESC)\`,
  ).run();

`, "context admission schema");
removeExact(`  await env.DB.prepare(
    \`CREATE TABLE IF NOT EXISTS operator_production_board_items (
      id TEXT PRIMARY KEY,
      brand_key TEXT NOT NULL,
      workflow_session_id TEXT,
      item_type TEXT NOT NULL,
      lane_key TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      evidence_json TEXT,
      priority INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      created_from TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )\`,
  ).run();
    await env.DB.prepare(
    \`CREATE INDEX IF NOT EXISTS idx_operator_production_board_brand_status
     ON operator_production_board_items (brand_key, status, priority ASC, updated_at DESC)\`,
  ).run();

`, "production board schema");
removeExact(`  await env.DB.prepare(
    \`CREATE TABLE IF NOT EXISTS operator_review_batches (
      id TEXT PRIMARY KEY,
      brand_key TEXT NOT NULL,
      workflow_session_id TEXT,
      source_batch_id TEXT,
      production_date TEXT NOT NULL,
      timezone TEXT NOT NULL,
      batch_size INTEGER NOT NULL DEFAULT 4,
      status TEXT NOT NULL DEFAULT 'building',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )\`,
  ).run();
  await env.DB.prepare(
    \`CREATE INDEX IF NOT EXISTS idx_operator_review_batches_active
     ON operator_review_batches (brand_key, production_date, status, updated_at DESC)\`,
  ).run();
    await env.DB.prepare(
    \`CREATE TRIGGER IF NOT EXISTS trg_operator_review_batches_touch_updated_at
     AFTER UPDATE ON operator_review_batches
     FOR EACH ROW
     WHEN NEW.updated_at = OLD.updated_at
     BEGIN
       UPDATE operator_review_batches SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
     END\`,
  ).run();

`, "review batch schema");
replaceExact(`  await env.DB.prepare(
    \`CREATE TABLE IF NOT EXISTS operator_post_metric_snapshots (
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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )\`,
  ).run();
    await env.DB.prepare(
    \`CREATE INDEX IF NOT EXISTS idx_operator_post_metric_snapshots_post_captured
     ON operator_post_metric_snapshots (brand_key, published_post_id, captured_at DESC)\`,
  ).run();

`, `  await ensureOperatorPostMetricSnapshotsTable(env);

`, "metric snapshot schema ownership");
replaceRange(
  "const DEFAULT_OPERATOR_WORKFLOW_REQUIREMENTS: Array<{",
  "type OperatorWorkItemStatus =",
  `const DEFAULT_OPERATOR_WORKFLOW_REQUIREMENTS: Array<{
  stage: OperatorWorkflowStage;
  required_sections: string[];
  completion_rule: string;
  enforcement_type: string;
}> = [
  {
    stage: "source_card",
    required_sections: ["locked_source_card"],
    completion_rule: "active_source_card_locked",
    enforcement_type: "block",
  },
  {
    stage: "generation_run_and_candidates",
    required_sections: ["locked_source_card", "generation_run"],
    completion_rule: "locked_source_card_and_run",
    enforcement_type: "block",
  },
];

`,
  "autonomous workflow requirements",
);
for (const line of [
  `  { gate_key: "operator_precheck_before_workflow", display_name: "Operator Precheck Before Workflow", description: "A full operator precheck must be loaded before workflow, admin, or engineering actions.", stage_scope: "account_selection", gate_type: "hard", severity: "block", evaluator: "backend", order_index: 15 },\n`,
  `  { gate_key: "context_admission_gate", display_name: "Context Admission", description: "Relevant data coverage must be recorded and partial data labeled.", stage_scope: "context_admission", gate_type: "hard", severity: "warn", evaluator: "backend", order_index: 20 },\n`,
  `  { gate_key: "approved_before_schedule_gate", display_name: "Approved Before Schedule", description: "Only approved drafts can be scheduled unless an override is recorded.", stage_scope: "scheduling", gate_type: "hard", severity: "block", evaluator: "backend", order_index: 20 },\n`,
  `  { gate_key: "status_transition_gate", display_name: "Status Transition", description: "Draft status transitions must follow the operator workflow.", stage_scope: "owner_review_and_decision", gate_type: "hard", severity: "block", evaluator: "backend", order_index: 10 },\n`,
]) removeExact(line, `retired gate ${line.slice(20, 60)}`);
replaceExact(
`     WHERE gate_key = 'historical_owner_rejection_gate'
        OR created_from = 'strategy_memory'
        OR gate_key = 'manifest_owner_review_rules_2026_07_16'\`,`,
`     WHERE gate_key IN (
          'historical_owner_rejection_gate',
          'operator_precheck_before_workflow',
          'context_admission_gate',
          'approved_before_schedule_gate',
          'status_transition_gate',
          'manifest_owner_review_rules_2026_07_16'
        )
        OR created_from = 'strategy_memory'\`,`,
"retired gate deactivation",
);
replaceExact(
`  await env.DB.prepare(
    \`UPDATE operator_workflow_requirements
     SET required_sections_json = ?,
         completion_rule = ?,
         enforcement_type = 'block',
         active = 1,
         version = version + 1
     WHERE stage = 'context_admission'
       AND (
         completion_rule <> ?
         OR required_sections_json <> ?
       )\`,
  ).bind(
    JSON.stringify(["operator_precheck"]),
    "key_handshake_complete_before_account_work",
    "key_handshake_complete_before_account_work",
    JSON.stringify(["operator_precheck"]),
  ).run();`,
`  await env.DB.prepare(
    \`UPDATE operator_workflow_requirements
     SET active = 0,
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE stage IN ('context_admission', 'owner_review_and_decision', 'scheduling')
       AND active <> 0\`,
  ).run();`,
"retired workflow requirement deactivation",
);
replaceRange(
  "const operatorModePreparationByEnv = new WeakMap<object, Promise<void>>();",
  "function workflowTemplatePayload(): Record<string, unknown> {",
  `const operatorModePreparationByEnv = new WeakMap<object, Promise<void>>();

async function prepareOperatorMode(env: Env): Promise<void> {
  const prepare = async () => {
    await ensureGptGenerationDraftsTable(env);
    await ensureScheduledPostsTable(env);
    await ensureOperatorWorkflowTables(env);
    await ensureOperatorMcpAdminTables(env);
    await seedDefaultOperatorGates(env);
    await retireLegacyHumanGuidanceState(env);
  };
  if (hasTestRuntimeTokens(env)) {
    await prepare();
    return;
  }
  const cached = operatorModePreparationByEnv.get(env as object);
  if (cached) return cached;
  const preparation = prepare();
  operatorModePreparationByEnv.set(env as object, preparation);
  try {
    await preparation;
  } catch (error) {
    operatorModePreparationByEnv.delete(env as object);
    throw error;
  }
}

`,
  "autonomous operator preparation",
);
replaceExact(
  `const LEGACY_HUMAN_GUIDANCE_RETIREMENT_VERSION = "human-free-retirement-v1";`,
  `const LEGACY_HUMAN_GUIDANCE_RETIREMENT_VERSION = "human-free-retirement-v2";`,
  "human guidance retirement version",
);
replaceExact(
`  const statements = [
    "DELETE FROM gpt_strategy_memory",
    "UPDATE operator_workflow_sessions SET status = 'retired', updated_at = CURRENT_TIMESTAMP WHERE status = 'active'",
    "UPDATE operator_review_batches SET status = 'retired', updated_at = CURRENT_TIMESTAMP WHERE status NOT IN ('retired', 'completed')",
    "DROP TABLE IF EXISTS agent_account_controls",
    "DROP TABLE IF EXISTS operator_local_execution_nodes",
    "DROP TABLE IF EXISTS operator_local_execution_jobs",
    "DROP TABLE IF EXISTS operator_local_validation_receipts",
    "DROP TABLE IF EXISTS operator_validation_plane_events",
    "DROP TABLE IF EXISTS operator_local_execution_enrollment_tokens",
  ];`,
`  const statements = [
    "DROP TABLE IF EXISTS gpt_strategy_memory",
    "DROP TABLE IF EXISTS operator_workflow_sessions",
    "DROP TABLE IF EXISTS operator_context_admissions",
    "DROP TABLE IF EXISTS operator_production_board_items",
    "DROP TABLE IF EXISTS operator_review_batches",
    "DROP TABLE IF EXISTS agent_account_controls",
    "DROP TABLE IF EXISTS operator_local_execution_nodes",
    "DROP TABLE IF EXISTS operator_local_execution_jobs",
    "DROP TABLE IF EXISTS operator_local_validation_receipts",
    "DROP TABLE IF EXISTS operator_validation_plane_events",
    "DROP TABLE IF EXISTS operator_local_execution_enrollment_tokens",
  ];`,
"retired database state removal",
);
replaceExact(
`async function handleOperatorTool(request: Request, env: Env, toolName: string): Promise<Response> {
  if (!isGptRequestAuthorized(request, env) && !isOperatorMcpRequestAuthorized(request, env) && !isInternalRequestAuthorized(request, env)) {
    return unauthorizedGptResponse();
  }
  if (operatorToolRequiresLegacyPreparation(toolName)) {
    await prepareOperatorMode(env);
  }
    const payload = await readOperatorPayload(request);`,
`async function handleOperatorTool(request: Request, env: Env, toolName: string): Promise<Response> {
  if (!isGptRequestAuthorized(request, env) && !isOperatorMcpRequestAuthorized(request, env) && !isInternalRequestAuthorized(request, env)) {
    return unauthorizedGptResponse();
  }
  const canonicalToolName = toolName.replace(/^(?:mm_|om_|vx_)/, "");
  if (RETIRED_HUMAN_GUIDANCE_TOOL_NAMES.has(canonicalToolName)) {
    return operatorJsonResponse({
      success: false,
      error: "human_guidance_tool_retired",
      tool_name: canonicalToolName,
      human_free_autonomy: HUMAN_FREE_AUTONOMY_CONTRACT,
    }, 410);
  }
  await prepareOperatorMode(env);
  const payload = await readOperatorPayload(request);`,
"retired direct tool boundary",
);
replaceExact(
`  if (toolName === "list_accounts") {
    return operatorJsonResponse({ accounts: await listOperatorAccounts(env), workflow_template: workflowTemplatePayload() });
  }`,
`  if (toolName === "list_accounts") {
    return operatorJsonResponse({
      accounts: await listOperatorAccounts(env),
      operating_mode: "autonomous_operator",
      human_free_autonomy: HUMAN_FREE_AUTONOMY_CONTRACT,
    });
  }`,
"autonomous account listing",
);
replaceRange(
  "async function buildOperatorManifestProceedCapsule(",
  "async function buildOperatorProceedCapsule(",
`async function buildOperatorManifestProceedCapsule(
  request: Request,
  env: Env,
  brand: GptResolvedBrand,
  _session: Record<string, unknown> | null,
  choice: OperatorContinuationChoice,
): Promise<Record<string, unknown>> {
  const [deliveryReconciliation, calendarCoverage, autonomyProfile, tools, growthMission, latestCycleRow] = await Promise.all([
    inspectOperatorDeliveryIncidents(env, brand, WORKSPACE_DEFAULT_TIMEZONE),
    getOperatorHourlyCoverage(env, brand, WORKSPACE_DEFAULT_TIMEZONE, 3, null),
    getOperatorAutonomyProfile(env, brand.brand_key),
    buildOperatorMcpTools(env, false, false),
    readOperatorGrowthMission(env, brand.brand_key),
    env.DB.prepare(
      \`SELECT id FROM operator_autonomous_growth_cycles
       WHERE brand_key = ?
       ORDER BY datetime(updated_at) DESC LIMIT 1\`,
    ).bind(brand.brand_key).first<{ id: string }>(),
  ]);
  const activeAutonomy = String(autonomyProfile?.mode ?? "") === MANIFEST_AUTONOMY_MODE;
  const blockingIncident = deliveryReconciliation.unresolved_incidents[0] ?? null;
  const pendingDecisions = autonomyProfile
    ? await listOperatorDecisionProposals(env, brand.brand_key, ["proposed", "approved", "executing", "revision_required"], 20)
    : [];
  const latestCycle = latestCycleRow?.id
    ? await readManifestAutonomousCycle(env, brand.brand_key, latestCycleRow.id)
    : null;
  const next = blockingIncident
    ? {
        action: "resolve_delivery_incident",
        canonical_tool: "list_scheduled_posts",
        last_completed_action: "live_delivery_state_reconciled",
      }
    : activeAutonomy
      ? {
          action: "prepare_autonomous_growth_cycle",
          canonical_tool: "prepare_manifest_autonomous_cycle",
          last_completed_action: "live_schedule_state_reconciled",
        }
      : {
          action: "configure_autonomy_profile",
          canonical_tool: "updateGrowthMission",
          last_completed_action: "account_configuration_inspected",
        };
  const operationId = \`\${brand.brand_key}:\${next.action}:\${String(calendarCoverage.current_local_date ?? "current")}\`;
  return {
    version: OPERATOR_CONTINUITY_CONTRACT_VERSION,
    choice,
    brand_key: brand.brand_key,
    account_data_loaded: true,
    canonical_state_source: "database_plus_live_reconciliation",
    continuity_mode: activeAutonomy ? "autonomous_growth_operator" : "autonomy_configuration_required",
    continuity_diagnostics: {
      live_schedule_inspected: true,
      live_delivery_state_inspected: true,
      guided_workflow_state_loaded: false,
      workflow_session_dependency: false,
      review_batch_dependency: false,
      owner_taste_dependency: false,
      calendar_horizon_days: 3,
    },
    autonomy_governance: {
      contract: OPERATOR_AUTONOMY_CONTRACT,
      profile: autonomyProfile,
      pending_protected_decisions: pendingDecisions,
      engineering_authority: OPERATOR_ENGINEERING_AUTHORITY_CONTRACT,
      next_behavior: activeAutonomy
        ? "Resume autonomous Manifest operation from live schedule, cycle, evidence, and incident state."
        : "Load fixed account configuration before autonomous account mutation. Do not create a guided review or taste-learning cycle.",
    },
    growth_mission: growthMission,
    account_execution: {
      unlocked: activeAutonomy,
      configuration_required: !activeAutonomy,
      routine_account_operations_autonomous: activeAutonomy,
      human_learning_disabled: true,
      owner_review_dependency: false,
      protected_boundaries_only: true,
    },
    calendar_coverage: {
      ...calendarCoverage,
      unresolved_delivery_count: deliveryReconciliation.unresolved_incidents.length,
      unresolved_delivery_slots: deliveryReconciliation.unresolved_incidents.map((incident) => ({
        incident_id: incident.id,
        scheduled_post_id: incident.scheduled_post_id,
        production_date: incident.production_date,
        scheduled_time: incident.scheduled_time,
        delivery_state: incident.delivery_state,
      })),
    },
    latest_autonomous_cycle: latestCycle,
    unresolved_incidents: deliveryReconciliation.unresolved_incidents,
    required_recovery_actions: deliveryReconciliation.required_recovery_actions,
    new_scheduling_blocked: Boolean(blockingIncident) || !activeAutonomy,
    scheduling_block_reason: blockingIncident
      ? "unresolved_delivery_incident"
      : activeAutonomy
        ? null
        : "autonomy_configuration_required",
    operation_checkpoint: {
      last_completed_action: next.last_completed_action,
      next_pending_action: next.action,
      canonical_next_tool: next.canonical_tool,
      next_operation_id: operationId,
    },
    idempotency: {
      version: OPERATOR_IDEMPOTENCY_VERSION,
      next_operation_id: operationId,
      replay_same_operation_id_after_interruption: true,
    },
    runtime_identity: {
      ...operatorRuntimeMetadata(env),
      live_tool_count: tools.length,
      request_origin: new URL(request.url).origin,
    },
  };
}

`,
"autonomous Manifest continuity",
);
replaceExact(
`async function buildOperatorProceedCapsule(
  request: Request,
  env: Env,
  brand: GptResolvedBrand,
  session: Record<string, unknown> | null,
  choice: OperatorContinuationChoice,
): Promise<Record<string, unknown>> {
  return brand.brand_key === "manifest_mental"
    ? buildOperatorManifestProceedCapsule(request, env, brand, session, choice)
    : buildOperatorContinuityCapsule(request, env, brand, session, choice);
}`,
`async function buildOperatorProceedCapsule(
  request: Request,
  env: Env,
  brand: GptResolvedBrand,
  session: Record<string, unknown> | null,
  choice: OperatorContinuationChoice,
): Promise<Record<string, unknown>> {
  if (brand.brand_key === "manifest_mental") {
    return buildOperatorManifestProceedCapsule(request, env, brand, session, choice);
  }
  const [autonomyProfile, tools] = await Promise.all([
    getOperatorAutonomyProfile(env, brand.brand_key),
    buildOperatorMcpTools(env, false, false),
  ]);
  const configured = Boolean(autonomyProfile?.active);
  return {
    version: OPERATOR_CONTINUITY_CONTRACT_VERSION,
    choice,
    brand_key: brand.brand_key,
    account_data_loaded: true,
    canonical_state_source: "account_configuration",
    continuity_mode: configured ? "autonomous_account_operator" : "autonomy_configuration_required",
    continuity_diagnostics: {
      guided_workflow_state_loaded: false,
      workflow_session_dependency: false,
      review_batch_dependency: false,
      owner_taste_dependency: false,
    },
    autonomy_governance: {
      contract: OPERATOR_AUTONOMY_CONTRACT,
      profile: autonomyProfile,
      engineering_authority: OPERATOR_ENGINEERING_AUTHORITY_CONTRACT,
    },
    account_execution: {
      unlocked: configured,
      configuration_required: !configured,
      human_learning_disabled: true,
      owner_review_dependency: false,
      protected_boundaries_only: true,
    },
    operation_checkpoint: {
      next_pending_action: configured ? "inspect_account_state" : "configure_autonomy_profile",
      canonical_next_tool: configured ? "get_account_state" : "updateGrowthMission",
    },
    runtime_identity: {
      ...operatorRuntimeMetadata(env),
      live_tool_count: tools.length,
      request_origin: new URL(request.url).origin,
    },
  };
}`,
"universal autonomous continuity boundary",
);
replaceRange(
  `        if (toolName === "confirmOperatorProceed") {`,
  `  if (toolName === "getGrowthMission") {`,
`  if (toolName === "confirmOperatorProceed") {
    const brandKey = normalizeGptBrandKey(args.brand_key);
    if (!brandKey) {
      return { ok: false, error: "invalid_brand_key", canonical_keys: ["manifest_mental", "opmg_deadman", "vectrix"], account_data_loaded: false };
    }
    const brand = await resolveGptBrand(env, brandKey);
    if (!brand) {
      return { ok: false, error: "brand_unavailable", account_data_loaded: false };
    }
    await createOperatorContinuityReference(env, {
      kind: "continuity_context",
      brandKey,
      workflowSessionId: null,
      continuationChoice: "autonomous_state",
      ttlSeconds: OPERATOR_CONTINUITY_TOKEN_TTL_SECONDS,
      payload: {
        continuity_version: OPERATOR_CONTINUITY_CONTRACT_VERSION,
        execution_policy_version: OPERATOR_EXECUTION_POLICY_VERSION,
        autonomous_state_only: true,
        guided_workflow_state_loaded: false,
      },
    });
    const capsule = await buildOperatorProceedCapsule(request, env, brand, null, "resume_existing_workflow");
    const accountExecution = capsule.account_execution && typeof capsule.account_execution === "object" && !Array.isArray(capsule.account_execution)
      ? capsule.account_execution as Record<string, unknown>
      : null;
    const configurationRequired = accountExecution?.configuration_required === true;
    const checkpoint = capsule.operation_checkpoint && typeof capsule.operation_checkpoint === "object" && !Array.isArray(capsule.operation_checkpoint)
      ? capsule.operation_checkpoint as Record<string, unknown>
      : null;
    const idempotency = capsule.idempotency && typeof capsule.idempotency === "object" && !Array.isArray(capsule.idempotency)
      ? capsule.idempotency as Record<string, unknown>
      : null;
    return {
      ok: true,
      selected_key: brandKey,
      proceeded: true,
      proceed_confirmed: true,
      account_data_loaded: true,
      continuity_loaded: true,
      continuation_choice_required: false,
      continuation_choice: "autonomous_state",
      continuity_state_expires_in_seconds: OPERATOR_CONTINUITY_TOKEN_TTL_SECONDS,
      continuity_capsule: capsule,
      account_execution_locked_until_configuration: configurationRequired,
      required_next_owner_action: configurationRequired ? "Configure the fixed account mission and protected boundaries." : null,
      human_learning_disabled: true,
      next_call_requirement: {
        brand_key: operatorClientSafeBrandKey(brandKey),
        operation_id: idempotency?.next_operation_id ?? checkpoint?.next_operation_id ?? null,
      },
    };
  }

`,
"autonomous Proceed continuity",
);
replaceExact(
  `execution_mode TEXT NOT NULL DEFAULT 'guided_owner_approval',`,
  `execution_mode TEXT NOT NULL DEFAULT 'autonomous_operator',`,
  "autonomous growth mission default",
);

const testInsertion = `

  it("prepares active operator state without recreating guided workflow tables", async () => {
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS operator_system_retirements (retirement_key TEXT PRIMARY KEY, completed_at TEXT)").run();
    await env.DB.prepare("DELETE FROM operator_system_retirements WHERE retirement_key = 'human-free-retirement-v2'").run();
    for (const table of [
      "operator_workflow_sessions",
      "operator_context_admissions",
      "operator_production_board_items",
      "operator_review_batches",
      "gpt_strategy_memory",
    ]) {
      await env.DB.prepare(\`CREATE TABLE IF NOT EXISTS \${table} (id TEXT)\`).run();
    }
    const response = await fetchFromWorker("/api/operator/tools/list_accounts", {
      headers: { authorization: "Bearer test-gpt-key" },
    });
    expect(response.status).toBe(200);
    for (const table of [
      "operator_workflow_sessions",
      "operator_context_admissions",
      "operator_production_board_items",
      "operator_review_batches",
      "gpt_strategy_memory",
    ]) {
      const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
        .bind(table)
        .first<{ name?: string }>();
      expect(row).toBeNull();
    }
    const retiredTool = await fetchFromWorker("/api/operator/tools/approve_draft", {
      method: "POST",
      headers: {
        authorization: "Bearer test-gpt-key",
        "content-type": "application/json",
      },
      body: JSON.stringify({ brand_key: "manifest_mental", draft_id: "retired" }),
    });
    expect(retiredTool.status).toBe(410);
    expect((await retiredTool.json() as Record<string, unknown>).error).toBe("human_guidance_tool_retired");
  });`;
const testEnd = tests.lastIndexOf("\n});");
if (testEnd < 0) throw new Error("human-free test insertion marker missing");
tests = `${tests.slice(0, testEnd)}${testInsertion}${tests.slice(testEnd)}`;

for (const forbidden of [
  "CREATE TABLE IF NOT EXISTS operator_workflow_sessions",
  "CREATE TABLE IF NOT EXISTS operator_context_admissions",
  "CREATE TABLE IF NOT EXISTS operator_production_board_items",
  "CREATE TABLE IF NOT EXISTS operator_review_batches",
  "continuity_mode: \"guided_growth_diagnostic\"",
  "legacy_review_batch: activeReviewBatch",
]) {
  if (source.includes(forbidden)) throw new Error(`Stage 3 cleanup incomplete: ${forbidden}`);
}
await writeFile(indexPath, source);
await writeFile(testPath, tests);
process.stdout.write(`${JSON.stringify({ ok: true, changes, index_bytes: Buffer.byteLength(source) }, null, 2)}\n`);
