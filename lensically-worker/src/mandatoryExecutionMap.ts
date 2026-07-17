export const MANDATORY_EXECUTION_MAP_VERSION = "mandatory-execution-library-v2";
export const EXECUTION_POLICY_LIBRARY_VERSION = "execution-policy-library-v2";

// BEGIN GENERATED EXECUTION KNOWLEDGE
const GENERATED_EXECUTION_KNOWLEDGE: Record<string, string> = {};
// END GENERATED EXECUTION KNOWLEDGE

export type MandatoryExecutionToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type MandatoryExecutionMapCallbacks = {
  signPermit: (payload: Record<string, unknown>) => Promise<string>;
  verifyPermit: (token: unknown) => Promise<Record<string, unknown> | null>;
  readStaticPolicySources?: () => Promise<ExecutionPolicyLibrarySource[]> | ExecutionPolicyLibrarySource[];
};

export type MandatoryExecutionPrepared = {
  ok: boolean;
  error?: string;
  tool_name?: string;
  arguments?: Record<string, unknown>;
  map_state: "known" | "unknown" | "discovery";
  map_entry?: Record<string, unknown> | null;
  incident?: Record<string, unknown> | null;
  discovery_permit?: string | null;
  missing_inputs?: string[];
  candidates?: Array<Record<string, unknown>>;
  execution_library?: Record<string, unknown>;
  map_execution?: Record<string, unknown>;
};

const MAP_EXCLUDED_TOOLS = new Set([
  "guardLensicallyCall",
  "routeAndExecuteLensicallyCall",
  "executeMappedIntent",
  "executeLensicallyIntent",
]);

const INTENT_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "before", "by", "do", "for", "from", "get", "how", "i", "in", "into",
  "is", "it", "me", "of", "on", "or", "our", "please", "read", "run", "that", "the", "this", "to", "use", "we", "with", "want",
]);

function normalizeText(value: unknown, maxLength = 8000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function machineKey(value: unknown, fallback = "unknown_action"): string {
  const text = normalizeText(value, 4000)?.toLowerCase() ?? "";
  const key = text.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return key || fallback;
}

function splitCamel(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
}

function tokenize(value: unknown): string[] {
  const text = normalizeText(value, 12000)?.toLowerCase() ?? "";
  return Array.from(new Set(text.split(/[^a-z0-9]+/g).filter((token) => token.length > 1 && !INTENT_STOP_WORDS.has(token))));
}

function safeJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stringify(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function equivalentJson(left: unknown, right: unknown): boolean {
  return stringify(left) === stringify(right);
}

export type ExecutionPolicyLibrarySource = {
  source_type: string;
  source_id: string;
  text: string;
  updated_at: string | null;
};

const EXECUTION_LIBRARY_DYNAMIC_SOURCE_TABLES = [
  "operator_ops_memory",
  "operator_pre_call_routes",
  "operator_workflow_requirements",
  "operator_mcp_admin_errors",
  "operator_engineering_audit",
  "operator_execution_events",
  "operator_operational_incidents",
  "operator_mcp_tool_overrides",
  "operator_mcp_deployments",
  "operator_continuity_refs",
  "operator_operation_receipts",
  "operator_autonomy_profiles",
  "operator_decision_proposals",
  "operator_decision_execution_events",
  "operator_repo_write_sessions",
  "operator_execution_map_entries",
  "operator_execution_map_incidents",
  "operator_execution_map_attempts",
  "operator_execution_map_promotions",
  "operator_mcp_backlog_items",
  "gpt_strategy_memory",
  "operator_workflow_sessions",
  "operator_context_admissions",
  "operator_production_board_items",
  "operator_source_selection_batches",
  "operator_source_selections",
  "operator_review_batches",
  "operator_daily_source_claims",
  "operator_source_exclusions",
  "operator_source_cards",
  "operator_gates",
  "operator_gate_results",
  "operator_content_inventory",
  "operator_post_metric_snapshots",
] as const;

function executionLibraryTokens(value: unknown): string[] {
  return tokenize(typeof value === "string" ? value : stringify(value));
}

function executionLibrarySourceScore(queryTokens: string[], source: ExecutionPolicyLibrarySource): number {
  const sourceTokens = executionLibraryTokens(source.text);
  if (!sourceTokens.length) return 0;
  const overlap = sourceTokens.filter((token) => queryTokens.includes(token));
  const coverage = overlap.length / Math.max(1, Math.min(sourceTokens.length, 20));
  const operationalBoost = ["ops_memory", "pre_call_route", "pre_call_route_override", "workflow_requirement", "map_entry"].includes(source.source_type) ? 4 : 0;
  return overlap.length * 5 + coverage * 10 + operationalBoost;
}

function generatedExecutionKnowledgeSources(): ExecutionPolicyLibrarySource[] {
  const sources: ExecutionPolicyLibrarySource[] = [];
  for (const [document, content] of Object.entries(GENERATED_EXECUTION_KNOWLEDGE)) {
    const sections = content
      .split(/\n(?=#{1,6}\s|[-*]\s+(?:Failed:|Verified:|Use:|Applies when:)|\d+\.\s)/g)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 1000);
    sections.forEach((text, index) => sources.push({
      source_type: "repository_knowledge",
      source_id: `${document}:${index + 1}`,
      text,
      updated_at: null,
    }));
  }
  return sources;
}

async function ensureExecutionPolicyLibraryTables(db: D1Database): Promise<void> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS operator_execution_library_events (
    id TEXT PRIMARY KEY,
    action_intent TEXT NOT NULL,
    phase TEXT NOT NULL,
    outcome TEXT NOT NULL,
    mapped_tool TEXT,
    source_keys_json TEXT NOT NULL DEFAULT '[]',
    policy_json TEXT NOT NULL DEFAULT '{}',
    evidence_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_operator_execution_library_events
    ON operator_execution_library_events (action_intent, created_at DESC)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS operator_execution_library_sources (
    source_key TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_scope TEXT NOT NULL DEFAULT 'universal',
    text TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    active INTEGER NOT NULL DEFAULT 1,
    source_updated_at TEXT,
    synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_operator_execution_library_sources_lookup
    ON operator_execution_library_sources (active, source_type, source_updated_at DESC)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS operator_execution_library_ingestion_state (
    source_system TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_fingerprint TEXT NOT NULL,
    source_count INTEGER NOT NULL DEFAULT 0,
    last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (source_system, source_name)
  )`).run();
}

function executionLibrarySqlIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function ensureExecutionPolicyLibraryDirtyTriggers(db: D1Database): Promise<void> {
  const placeholders = EXECUTION_LIBRARY_DYNAMIC_SOURCE_TABLES.map(() => "?").join(", ");
  const existing = await db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders}) ORDER BY name`,
  ).bind(...EXECUTION_LIBRARY_DYNAMIC_SOURCE_TABLES).all<{ name: string }>();
  const existingPolicyTables = (existing.results ?? [])
    .map((row) => String(row.name ?? "").trim())
    .filter((tableName) => /(ops_memory|pre_call_routes|workflow_requirements|operational_incidents|mcp_tool_overrides|autonomy_profiles|decision_proposals|execution_map_entries|execution_map_incidents|execution_map_promotions|mcp_backlog_items|gpt_strategy_memory|production_board_items|source_exclusions|source_cards|operator_gates)$/.test(tableName));
  const expectedTriggerNames = existingPolicyTables.flatMap((tableName) =>
    ["insert", "update", "delete"].map((operation) => `trg_execution_library_dirty_${machineKey(tableName)}_${operation}`),
  );
  const existingTriggers = await db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg_execution_library_dirty_%' ORDER BY name`,
  ).all<{ name: string }>();
  const existingTriggerNames = new Set((existingTriggers.results ?? []).map((row) => String(row.name ?? "")));
  const triggersComplete = expectedTriggerNames.every((name) => existingTriggerNames.has(name));
  const fingerprint = executionLibraryTextFingerprint(`${existingPolicyTables.join("|")}::${expectedTriggerNames.join("|")}`);
  if (triggersComplete && !(await executionLibraryRefreshDue(db, "dirty_triggers", 86400, fingerprint))) return;
  const statements: D1PreparedStatement[] = [];
  for (const tableName of existingPolicyTables) {
    for (const operation of ["INSERT", "UPDATE", "DELETE"] as const) {
      const triggerName = `trg_execution_library_dirty_${machineKey(tableName)}_${operation.toLowerCase()}`;
      statements.push(db.prepare(
        `CREATE TRIGGER IF NOT EXISTS ${executionLibrarySqlIdentifier(triggerName)}
         AFTER ${operation} ON ${executionLibrarySqlIdentifier(tableName)}
         BEGIN
           INSERT INTO operator_execution_library_ingestion_state (
             source_system, source_name, source_fingerprint, source_count, last_synced_at
           ) VALUES ('refresh', 'dynamic_sources', 'dirty', 0, CURRENT_TIMESTAMP)
           ON CONFLICT(source_system, source_name) DO UPDATE SET
             source_fingerprint = 'dirty',
             last_synced_at = CURRENT_TIMESTAMP;
         END`,
      ));
    }
  }
  for (let offset = 0; offset < statements.length; offset += 40) {
    const batch = statements.slice(offset, offset + 40);
    if (batch.length) await db.batch(batch);
  }
  await markExecutionLibraryRefresh(db, "dirty_triggers", statements.length, fingerprint);
}

async function readExecutionPolicyLibraryTableCatalog(db: D1Database): Promise<ExecutionPolicyLibrarySource[]> {
  const tables = await db.prepare(
    `SELECT name, COALESCE(sql, '') AS schema_sql
     FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
     ORDER BY name`,
  ).all<{ name: string; schema_sql: string }>();
  return (tables.results ?? [])
    .map((row) => ({
      source_type: "d1_table_manifest",
      source_id: String(row.name ?? "").trim(),
      text: `D1 table ${String(row.name ?? "").trim()} schema ${String(row.schema_sql ?? "")}`,
      updated_at: null,
    }))
    .filter((source) => Boolean(source.source_id));
}

async function persistExecutionPolicyLibrarySources(
  db: D1Database,
  sources: ExecutionPolicyLibrarySource[],
): Promise<void> {
  const unique = new Map<string, ExecutionPolicyLibrarySource>();
  for (const source of sources) unique.set(`${source.source_type}:${source.source_id}`, source);
  const rows = Array.from(unique.values());
  for (let offset = 0; offset < rows.length; offset += 50) {
    const batch = rows.slice(offset, offset + 50).map((source) => db.prepare(
      `INSERT INTO operator_execution_library_sources (
        source_key, source_type, source_id, source_scope, text, metadata_json, active, source_updated_at, synced_at
      ) VALUES (?, ?, ?, 'universal', ?, '{}', 1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(source_key) DO UPDATE SET
        source_type = excluded.source_type,
        source_id = excluded.source_id,
        text = excluded.text,
        active = 1,
        source_updated_at = excluded.source_updated_at,
        synced_at = CURRENT_TIMESTAMP`,
    ).bind(
      `${source.source_type}:${source.source_id}`,
      source.source_type,
      source.source_id,
      source.text.slice(0, 50000),
      source.updated_at,
    ));
    if (batch.length) await db.batch(batch);
  }
}

async function readExecutionPolicyLibrarySources(db: D1Database): Promise<ExecutionPolicyLibrarySource[]> {
  const settledGroups = await Promise.allSettled([
    db.prepare(`
    SELECT 'ops_memory' AS source_type, id AS source_id,
      title || ' ' || COALESCE(problem, '') || ' ' || fix || ' ' || COALESCE(applies_when, '') || ' ' || COALESCE(tags_json, '') AS text,
      updated_at
    FROM operator_ops_memory WHERE active = 1
    UNION ALL
    SELECT 'pre_call_route_override', id,
      route_key || ' ' || mandatory_route || ' ' || reason || ' ' || verification_summary,
      updated_at
    FROM operator_pre_call_routes WHERE active = 1
    UNION ALL
    SELECT 'workflow_requirement', id,
      stage || ' ' || required_sections_json || ' ' || completion_rule || ' ' || enforcement_type,
      updated_at
    FROM operator_workflow_requirements WHERE active = 1
    ORDER BY updated_at DESC
  `).all<Record<string, unknown>>(),
    db.prepare(`
    SELECT 'admin_error' AS source_type, id AS source_id,
      COALESCE(tool_name, '') || ' ' || COALESCE(likely_cause, '') || ' ' || COALESCE(error_response_json, '') AS text,
      created_at AS updated_at
    FROM operator_mcp_admin_errors
    UNION ALL
    SELECT 'engineering_audit', id,
      action || ' ' || COALESCE(diff_summary, '') || ' ' || COALESCE(tests_run_json, '') || ' ' || result || ' ' || COALESCE(metadata_json, ''),
      created_at
    FROM operator_engineering_audit
    UNION ALL
    SELECT 'execution_event', id,
      tool_name || ' ' || operation_class || ' ' || execution_plane || ' ' || decision || ' ' || COALESCE(evidence_json, ''),
      created_at
    FROM operator_execution_events
    ORDER BY updated_at DESC
  `).all<Record<string, unknown>>(),
    db.prepare(`
    SELECT 'operational_incident' AS source_type, id AS source_id,
      incident_key || ' ' || incident_type || ' ' || severity || ' ' || status || ' ' || required_recovery_action || ' ' || COALESCE(publish_error_message, '') || ' ' || COALESCE(evidence_json, '') AS text,
      updated_at
    FROM operator_operational_incidents
    UNION ALL
    SELECT 'tool_override', tool_name,
      tool_name || ' disabled ' || disabled || ' ' || COALESCE(schema_patch_json, '') || ' ' || COALESCE(behavior_patch_json, '') || ' ' || COALESCE(description_override, '') || ' ' || COALESCE(handler_spec_json, '') || ' ' || COALESCE(output_schema_json, '') || ' ' || COALESCE(last_reason, ''),
      updated_at
    FROM operator_mcp_tool_overrides
    UNION ALL
    SELECT 'mcp_deployment', id,
      CAST(version AS TEXT) || ' ' || status || ' ' || COALESCE(change_summary, '') || ' ' || snapshot_json,
      COALESCE(activated_at, created_at)
    FROM operator_mcp_deployments
    ORDER BY updated_at DESC
  `).all<Record<string, unknown>>(),
    db.prepare(`
    SELECT 'continuity_ref' AS source_type, id AS source_id,
      kind || ' ' || brand_key || ' ' || COALESCE(workflow_session_id, '') || ' ' || COALESCE(continuation_choice, '') || ' ' || COALESCE(payload_json, '') AS text,
      created_at AS updated_at
    FROM operator_continuity_refs
    UNION ALL
    SELECT 'operation_receipt', idempotency_key,
      operation_type || ' ' || tool_name || ' ' || status || ' ' || COALESCE(result_json, ''),
      updated_at
    FROM operator_operation_receipts
    UNION ALL
    SELECT 'autonomy_profile', brand_key,
      mode || ' ' || objective || ' ' || model_role || ' ' || owner_role || ' ' || approval_policy || ' ' || operating_constraints_json,
      updated_at
    FROM operator_autonomy_profiles WHERE active = 1
    UNION ALL
    SELECT 'decision_proposal', id,
      decision_key || ' ' || category || ' ' || title || ' ' || decision_text || ' ' || rationale || ' ' || evidence_json || ' ' || expected_outcome || ' ' || risks_json || ' ' || execution_plan || ' ' || authorized_tools_json || ' ' || status || ' ' || COALESCE(owner_response, '') || ' ' || COALESCE(revision_request, '') || ' ' || COALESCE(outcome_summary, '') || ' ' || COALESCE(result_evidence_json, ''),
      updated_at
    FROM operator_decision_proposals
    ORDER BY updated_at DESC
  `).all<Record<string, unknown>>(),
    db.prepare(`
    SELECT 'decision_execution' AS source_type, id AS source_id,
      decision_id || ' ' || tool_name || ' ' || status || ' ' || COALESCE(result_summary, '') AS text,
      COALESCE(completed_at, created_at) AS updated_at
    FROM operator_decision_execution_events
    UNION ALL
    SELECT 'repo_write_session', id,
      path || ' ' || mode || ' ' || message || ' ' || COALESCE(summary, '') || ' ' || status,
      updated_at
    FROM operator_repo_write_sessions
    ORDER BY updated_at DESC
  `).all<Record<string, unknown>>(),
    db.prepare(`
    SELECT 'map_entry' AS source_type, id AS source_id,
      action_key || ' ' || task_class || ' ' || tool_name || ' ' || intent_aliases_json || ' ' || procedure_json || ' ' || historical_failures_json AS text,
      updated_at
    FROM operator_execution_map_entries WHERE status = 'active'
    ORDER BY updated_at DESC
  `).all<Record<string, unknown>>(),
    db.prepare(`
    SELECT 'map_incident' AS source_type, id AS source_id,
      action_intent || ' ' || COALESCE(action_key, '') || ' ' || state || ' ' || status || ' ' || COALESCE(failure_signature, '') AS text,
      updated_at
    FROM operator_execution_map_incidents
    UNION ALL
    SELECT 'map_attempt', id,
      action_intent || ' ' || tool_name || ' ' || mode || ' ' || outcome || ' ' || result_summary_json,
      created_at
    FROM operator_execution_map_attempts
    UNION ALL
    SELECT 'map_promotion', id,
      verification_summary,
      created_at
    FROM operator_execution_map_promotions
    ORDER BY updated_at DESC
  `).all<Record<string, unknown>>(),
    db.prepare(`
    SELECT 'backlog' AS source_type, id AS source_id,
      title || ' ' || COALESCE(observed_issue, '') || ' ' || COALESCE(expected_behavior, '') || ' ' || COALESCE(required_change, '') || ' ' || COALESCE(acceptance_test, '') AS text,
      updated_at
    FROM operator_mcp_backlog_items WHERE status <> 'resolved'
    UNION ALL
    SELECT 'strategy_memory', CAST(id AS TEXT),
      kind || ' ' || COALESCE(title, '') || ' ' || body || ' ' || COALESCE(metadata_json, ''),
      updated_at
        FROM gpt_strategy_memory
    UNION ALL
    SELECT 'workflow_session', id,
      brand_key || ' ' || workflow_template_key || ' ' || COALESCE(objective, '') || ' ' || status || ' ' || COALESCE(current_stage, '') || ' ' || COALESCE(notes, ''),
      updated_at
    FROM operator_workflow_sessions
    ORDER BY updated_at DESC
  `).all<Record<string, unknown>>(),
    db.prepare(`
    SELECT 'context_admission' AS source_type, id AS source_id,
      brand_key || ' ' || admission_scope || ' ' || sections_json || ' partial ' || is_partial || ' ' || COALESCE(notes, '') AS text,
      created_at AS updated_at
    FROM operator_context_admissions
    UNION ALL
    SELECT 'production_board', id,
      brand_key || ' ' || item_type || ' ' || COALESCE(lane_key, '') || ' ' || title || ' ' || body || ' ' || COALESCE(evidence_json, '') || ' ' || status || ' ' || COALESCE(created_from, ''),
      updated_at
    FROM operator_production_board_items
    UNION ALL
    SELECT 'source_selection_batch', id,
      brand_key || ' ' || selection_method || ' minimum_likes ' || eligibility_min_likes || ' pool ' || qualified_pool_count || ' requested ' || requested_count || ' selected ' || selected_count || ' ' || COALESCE(metadata_json, ''),
      created_at
    FROM operator_source_selection_batches
    ORDER BY updated_at DESC
  `).all<Record<string, unknown>>(),
    db.prepare(`
    SELECT 'source_selection' AS source_type, id AS source_id,
      brand_key || ' ' || source_type || ' ' || source_identity_key || ' ' || post_text || ' ' || metrics_snapshot_json || ' ' || source_snapshot_json || ' ' || COALESCE(disposition, '') || ' ' || COALESCE(disposition_reason, '') AS text,
      created_at AS updated_at
    FROM operator_source_selections
    UNION ALL
    SELECT 'review_batch', id,
      brand_key || ' ' || production_date || ' ' || timezone || ' size ' || batch_size || ' ' || status,
      updated_at
    FROM operator_review_batches
    UNION ALL
    SELECT 'daily_source_claim', id,
      brand_key || ' ' || production_date || ' ' || source_identity_key || ' ' || source_type || ' ' || status || ' ' || COALESCE(disposition_reason, ''),
      updated_at
    FROM operator_daily_source_claims
    ORDER BY updated_at DESC
  `).all<Record<string, unknown>>(),
    db.prepare(`
    SELECT 'source_exclusion' AS source_type, id AS source_id,
      brand_key || ' ' || source_identity_key || ' ' || source_type || ' ' || COALESCE(reason, '') || ' active ' || active AS text,
      updated_at
    FROM operator_source_exclusions
    UNION ALL
    SELECT 'source_card', id,
      brand_key || ' ' || sequence_label || ' ' || COALESCE(lane_key, '') || ' ' || title || ' ' || status || ' ' || primary_source_json || ' ' || COALESCE(secondary_sources_json, '') || ' ' || COALESCE(anti_sources_json, '') || ' ' || source_mechanism || ' ' || required_product || ' ' || forbidden_surfaces_json || ' ' || COALESCE(danger_surfaces_json, '') || ' ' || COALESCE(current_inventory_constraints_json, '') || ' ' || pass_conditions_json || ' ' || fail_conditions_json || ' ' || COALESCE(recommended_direction, '') || ' ' || COALESCE(transformation_contract_json, ''),
      updated_at
    FROM operator_source_cards WHERE is_current = 1
    UNION ALL
    SELECT 'gate_policy', id,
      COALESCE(brand_key, 'global') || ' ' || gate_key || ' ' || display_name || ' ' || description || ' ' || stage_scope || ' ' || gate_type || ' ' || severity || ' ' || evaluator || ' ' || COALESCE(applies_when_json, '') || ' ' || COALESCE(pass_examples_json, '') || ' ' || COALESCE(fail_examples_json, '') || ' ' || COALESCE(source_memory_ids_json, ''),
      updated_at
    FROM operator_gates WHERE active = 1
    ORDER BY updated_at DESC
  `).all<Record<string, unknown>>(),
    db.prepare(`
    SELECT 'gate_result' AS source_type, id AS source_id,
      brand_key || ' ' || gate_key || ' ' || result || ' blocking ' || blocking || ' ' || rationale || ' ' || evaluated_by || ' ' || COALESCE(evidence_json, '') || ' ' || COALESCE(repair_guidance, '') AS text,
      created_at AS updated_at
    FROM operator_gate_results
    UNION ALL
    SELECT 'content_inventory', id,
      brand_key || ' ' || source_type || ' ' || text || ' ' || COALESCE(first_line, '') || ' ' || COALESCE(opening_phrase, '') || ' ' || COALESCE(realm_entrance_key, '') || ' ' || COALESCE(hook_style, '') || ' ' || COALESCE(lane_key, '') || ' ' || status || ' ' || COALESCE(metadata_json, ''),
      created_at
    FROM operator_content_inventory
    UNION ALL
    SELECT 'post_metric_snapshot', id,
      brand_key || ' ' || published_post_id || ' ' || metrics_json,
      created_at
    FROM operator_post_metric_snapshots
    ORDER BY updated_at DESC
  `).all<Record<string, unknown>>(),
  ]);
  const fatalFailures = settledGroups
    .flatMap((group) => group.status === "rejected" ? [String(group.reason instanceof Error ? group.reason.message : group.reason)] : [])
    .filter((message) => !/no such table:/i.test(message));
  if (fatalFailures.length) {
    throw new Error(fatalFailures.join("; "));
  }
  return settledGroups
    .flatMap((group) => group.status === "fulfilled" ? group.value.results ?? [] : [])
    .map((row) => ({
      source_type: String(row.source_type ?? "unknown"),
      source_id: String(row.source_id ?? "unknown"),
      text: String(row.text ?? ""),
      updated_at: row.updated_at == null ? null : String(row.updated_at),
    }))
    .sort((left, right) => String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? "")));
}

function executionLibraryTextFingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function executionLibraryTimestampMs(value: unknown): number {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return Number.NaN;
  return Date.parse(text.includes("T") ? text : `${text.replace(" ", "T")}Z`);
}

async function executionLibraryRefreshDue(
  db: D1Database,
  sourceName: string,
  maximumAgeSeconds: number,
  expectedFingerprint?: string,
): Promise<boolean> {
  const state = await db.prepare(
    `SELECT source_fingerprint, last_synced_at FROM operator_execution_library_ingestion_state
     WHERE source_system = 'refresh' AND source_name = ? LIMIT 1`,
  ).bind(sourceName).first<{ source_fingerprint: string; last_synced_at: string }>();
  if (state?.source_fingerprint === "dirty") return true;
  if (expectedFingerprint && state?.source_fingerprint !== expectedFingerprint) return true;
  const lastSynced = executionLibraryTimestampMs(state?.last_synced_at);
  return !Number.isFinite(lastSynced) || Date.now() - lastSynced > maximumAgeSeconds * 1000;
}

async function markExecutionLibraryRefresh(
  db: D1Database,
  sourceName: string,
  sourceCount: number,
  sourceFingerprint = `${sourceName}:${sourceCount}`,
): Promise<void> {
  await db.prepare(
    `INSERT INTO operator_execution_library_ingestion_state (
      source_system, source_name, source_fingerprint, source_count, last_synced_at
    ) VALUES ('refresh', ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(source_system, source_name) DO UPDATE SET
      source_fingerprint = excluded.source_fingerprint,
      source_count = excluded.source_count,
      last_synced_at = CURRENT_TIMESTAMP`,
  ).bind(sourceName, sourceFingerprint, sourceCount).run();
}

async function deactivateExecutionPolicyLibrarySourceTypes(
  db: D1Database,
  sourceTypes: string[],
): Promise<void> {
  if (!sourceTypes.length) return;
  await db.prepare(
    `UPDATE operator_execution_library_sources
     SET active = 0, synced_at = CURRENT_TIMESTAMP
     WHERE source_type IN (${sourceTypes.map(() => "?").join(", ")})`,
  ).bind(...sourceTypes).run();
}

async function syncExecutionPolicyLibrarySources(
  db: D1Database,
  tools: MandatoryExecutionToolDefinition[],
  staticPolicySources: ExecutionPolicyLibrarySource[],
  forceDynamic = false,
): Promise<{ sources: ExecutionPolicyLibrarySource[]; sourceReadError: string | null }> {
  await ensureExecutionPolicyLibraryDirtyTriggers(db);
  const dynamicSourceTypes = [
    "ops_memory", "pre_call_route_override", "workflow_requirement", "admin_error", "engineering_audit",
    "execution_event", "operational_incident", "tool_override", "mcp_deployment", "continuity_ref",
    "operation_receipt", "autonomy_profile", "decision_proposal", "decision_execution", "repo_write_session",
    "map_entry", "map_incident", "map_attempt", "map_promotion", "backlog", "strategy_memory",
    "workflow_session", "context_admission", "production_board", "source_selection_batch", "source_selection",
    "review_batch", "daily_source_claim", "source_exclusion", "source_card", "gate_policy", "gate_result",
    "content_inventory", "post_metric_snapshot",
  ];
  let sourceReadError: string | null = null;
  let dynamicRefreshSucceeded = false;
  let catalogRefreshSucceeded = false;
  let dynamicSources: ExecutionPolicyLibrarySource[] = [];
  let tableCatalogSources: ExecutionPolicyLibrarySource[] = [];
  const generatedSources = generatedExecutionKnowledgeSources();
  const toolSources = tools
    .filter((tool) => !MAP_EXCLUDED_TOOLS.has(tool.name))
    .map((tool) => ({
      source_type: "tool_registry",
      source_id: tool.name,
      text: `${tool.name} ${tool.title} ${tool.description} ${stringify(procedureForTool(tool))}`,
      updated_at: null,
    } satisfies ExecutionPolicyLibrarySource));
  const staticFingerprint = executionLibraryTextFingerprint(stringify({
    map_version: MANDATORY_EXECUTION_MAP_VERSION,
    library_version: EXECUTION_POLICY_LIBRARY_VERSION,
    generated_sources: generatedSources.map((source) => [source.source_id, source.text]),
    tool_sources: toolSources.map((source) => [source.source_id, source.text]),
    static_policy_sources: staticPolicySources.map((source) => [source.source_type, source.source_id, source.text]),
  }));
  const staticRefreshDue = await executionLibraryRefreshDue(db, "static_sources", 86400, staticFingerprint);
  const dynamicRefreshDue = forceDynamic || await executionLibraryRefreshDue(db, "dynamic_sources", 60);
  const catalogRefreshDue = await executionLibraryRefreshDue(db, "d1_table_manifest", 900);
  const refreshSources: ExecutionPolicyLibrarySource[] = [];
  if (staticRefreshDue) {
    await deactivateExecutionPolicyLibrarySourceTypes(db, ["repository_knowledge", "tool_registry", "pre_call_route"]);
    refreshSources.push(...generatedSources, ...toolSources, ...staticPolicySources);
  }
  if (dynamicRefreshDue) {
    try {
      dynamicSources = await readExecutionPolicyLibrarySources(db);
      await deactivateExecutionPolicyLibrarySourceTypes(db, dynamicSourceTypes);
      refreshSources.push(...dynamicSources);
      dynamicRefreshSucceeded = true;
    } catch (error) {
      sourceReadError = error instanceof Error ? error.message : String(error);
    }
  }
  if (catalogRefreshDue) {
    try {
      tableCatalogSources = await readExecutionPolicyLibraryTableCatalog(db);
      await deactivateExecutionPolicyLibrarySourceTypes(db, ["d1_table_manifest"]);
      refreshSources.push(...tableCatalogSources);
      catalogRefreshSucceeded = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sourceReadError = sourceReadError ? `${sourceReadError}; ${message}` : message;
    }
  }
  await persistExecutionPolicyLibrarySources(db, refreshSources);
  if (staticRefreshDue) await markExecutionLibraryRefresh(db, "static_sources", generatedSources.length + toolSources.length + staticPolicySources.length, staticFingerprint);
  if (dynamicRefreshDue && dynamicRefreshSucceeded) await markExecutionLibraryRefresh(db, "dynamic_sources", dynamicSources.length);
  if (catalogRefreshDue && catalogRefreshSucceeded) await markExecutionLibraryRefresh(db, "d1_table_manifest", tableCatalogSources.length);
  const countRows = await db.prepare(
    `SELECT source_type, COUNT(*) AS total
     FROM operator_execution_library_sources
     WHERE active = 1
     GROUP BY source_type`,
  ).all<Record<string, unknown>>();
  const counts = (countRows.results ?? []).map((row) => ({
    source_type: String(row.source_type ?? "unknown"),
    total: Number(row.total ?? 0),
  }));
  if (counts.length) {
    await db.batch(counts.map(({ source_type: sourceType, total }) => db.prepare(
      `INSERT INTO operator_execution_library_ingestion_state (
        source_system, source_name, source_fingerprint, source_count, last_synced_at
      ) VALUES ('execution_library', ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(source_system, source_name) DO UPDATE SET
        source_fingerprint = excluded.source_fingerprint,
        source_count = excluded.source_count,
        last_synced_at = CURRENT_TIMESTAMP`,
    ).bind(sourceType, `${sourceType}:${total}`, total)));
  }
  return { sources: [], sourceReadError };
}

async function readExecutionPolicyLibraryCandidates(
  db: D1Database,
  queryTokens: string[],
): Promise<ExecutionPolicyLibrarySource[]> {
  const tokens = queryTokens.slice(0, 10);
  const tokenPredicates = tokens.map(() => "LOWER(text) LIKE ?");
  const alwaysConsultedTypes = [
    "ops_memory",
    "pre_call_route",
    "pre_call_route_override",
    "workflow_requirement",
    "map_entry",
    "tool_registry",
  ];
  const whereParts = [
    `source_type IN (${alwaysConsultedTypes.map(() => "?").join(", ")})`,
    ...tokenPredicates,
  ];
  const rows = await db.prepare(
    `SELECT source_type, source_id, text, source_updated_at AS updated_at
     FROM operator_execution_library_sources
     WHERE active = 1 AND (${whereParts.join(" OR ")})
     ORDER BY COALESCE(source_updated_at, synced_at) DESC
     LIMIT 1200`,
  ).bind(
    ...alwaysConsultedTypes,
    ...tokens.map((token) => `%${token.toLowerCase()}%`),
  ).all<Record<string, unknown>>();
  return (rows.results ?? []).map((row) => ({
    source_type: String(row.source_type ?? "unknown"),
    source_id: String(row.source_id ?? "unknown"),
    text: String(row.text ?? ""),
    updated_at: row.updated_at == null ? null : String(row.updated_at),
  }));
}

async function readExecutionPolicyLibraryCoverage(db: D1Database): Promise<Array<{ source_type: string; total: number }>> {
  const rows = await db.prepare(
    `SELECT source_type, COUNT(*) AS total
     FROM operator_execution_library_sources
     WHERE active = 1
     GROUP BY source_type
     ORDER BY source_type`,
  ).all<Record<string, unknown>>();
  return (rows.results ?? []).map((row) => ({
    source_type: String(row.source_type ?? "unknown"),
    total: Number(row.total ?? 0),
  }));
}

async function compileExecutionPolicyLibrary(
  db: D1Database,
  actionIntent: string,
  inputs: Record<string, unknown>,
  tools: MandatoryExecutionToolDefinition[],
  staticPolicySources: ExecutionPolicyLibrarySource[],
): Promise<Record<string, unknown>> {
    await ensureExecutionPolicyLibraryTables(db);
  const synchronized = await syncExecutionPolicyLibrarySources(db, tools, staticPolicySources);
  const sourceReadError = synchronized.sourceReadError;
  const queryTokens = executionLibraryTokens(`${actionIntent} ${stringify(inputs)}`);
  const sources = await readExecutionPolicyLibraryCandidates(db, queryTokens);
  const matched = sources
    .map((source) => ({ source, score: executionLibrarySourceScore(queryTokens, source) }))
    .filter((item) => item.score >= 5)
    .sort((left, right) => right.score - left.score)
    .slice(0, 60);
  const authoritativeTypes = new Set([
    "repository_knowledge",
    "ops_memory",
    "pre_call_route",
    "pre_call_route_override",
    "workflow_requirement",
    "tool_override",
    "autonomy_profile",
    "decision_proposal",
    "production_board",
    "source_exclusion",
    "source_card",
    "gate_policy",
    "map_entry",
    "tool_registry",
  ]);
  const mandatoryRules = matched
    .filter((item) => authoritativeTypes.has(item.source.source_type))
    .slice(0, 30)
    .map((item) => ({
      source_key: `${item.source.source_type}:${item.source.source_id}`,
      rule: item.source.text.slice(0, 1600),
      score: Number(item.score.toFixed(2)),
    }));
  const forbiddenRules = mandatoryRules
    .filter((item) => /\b(?:never|do not|must not|forbidden|failed:|block)\b/i.test(item.rule))
    .slice(0, 20);
  let coverage = await readExecutionPolicyLibraryCoverage(db);
  const tableCatalog = await db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  ).all<{ name: string }>();
  const liveTableNames = (tableCatalog.results ?? []).map((row) => String(row.name)).sort();
  const readManifestNames = async (): Promise<string[]> => {
    const rows = await db.prepare(
      `SELECT source_id FROM operator_execution_library_sources
       WHERE active = 1 AND source_type = 'd1_table_manifest'
       ORDER BY source_id`,
    ).all<{ source_id: string }>();
    return (rows.results ?? []).map((row) => String(row.source_id));
  };
  let manifestTableNames = await readManifestNames();
  let tableManifestComplete = equivalentJson(manifestTableNames, liveTableNames);
  let coverageByType = new Map(coverage.map((item) => [item.source_type, item.total]));
  if (!tableManifestComplete) {
    const repairedCatalog = await readExecutionPolicyLibraryTableCatalog(db);
    await deactivateExecutionPolicyLibrarySourceTypes(db, ["d1_table_manifest"]);
    await persistExecutionPolicyLibrarySources(db, repairedCatalog);
    await markExecutionLibraryRefresh(db, "d1_table_manifest", repairedCatalog.length);
    coverage = await readExecutionPolicyLibraryCoverage(db);
    coverageByType = new Map(coverage.map((item) => [item.source_type, item.total]));
    manifestTableNames = await readManifestNames();
    tableManifestComplete = equivalentJson(manifestTableNames, liveTableNames);
  }
  const requiredSourceTypes = ["pre_call_route", "map_entry", "tool_registry", "d1_table_manifest"];
  const missingRequiredSourceTypes = requiredSourceTypes.filter((sourceType) => Number(coverageByType.get(sourceType) ?? 0) === 0);
  const policyReady = sourceReadError === null
    && missingRequiredSourceTypes.length === 0
    && tableManifestComplete;
  const policyEventId = crypto.randomUUID();
  const bundle = {
    version: EXECUTION_POLICY_LIBRARY_VERSION,
    policy_event_id: policyEventId,
    mandatory: true,
    policy_ready: policyReady,
    consulted_before_execution: true,
    model_path_choice_allowed: false,
    action_intent: actionIntent,
    required_source_types: requiredSourceTypes,
    missing_required_source_types: missingRequiredSourceTypes,
    table_manifest_complete: tableManifestComplete,
    source_coverage: coverage,
    d1_table_catalog: (tableCatalog.results ?? []).map((row) => row.name),
    matched_source_keys: matched.map((item) => `${item.source.source_type}:${item.source.source_id}`),
    mandatory_rules: mandatoryRules,
    forbidden_rules: forbiddenRules,
    source_read_error: sourceReadError,
    discovery_allowed_only_when: ["no verified path exists", "the exact verified path was followed and failed"],
    failure_recording_rule: "Record a newly observed failure before discovery or repair. Promote the verified fix before the interrupted objective resumes.",
  };
  await db.prepare(
    `INSERT INTO operator_execution_library_events (
      id, action_intent, phase, outcome, mapped_tool, source_keys_json, policy_json, evidence_json
    ) VALUES (?, ?, 'policy_compiled', ?, NULL, ?, ?, '{}')`,
  ).bind(
    policyEventId,
    actionIntent,
    policyReady ? "ready" : "not_ready",
    stringify(bundle.matched_source_keys).slice(0, 50000),
    stringify(bundle).slice(0, 50000),
  ).run();
  return bundle;
}

function executionPolicyLibraryReceipt(bundle: Record<string, unknown>): Record<string, unknown> {
  const coverage = Array.isArray(bundle.source_coverage) ? bundle.source_coverage as Array<Record<string, unknown>> : [];
  const matchedSources = Array.isArray(bundle.matched_source_keys) ? bundle.matched_source_keys : [];
  const mandatoryRules = Array.isArray(bundle.mandatory_rules) ? bundle.mandatory_rules : [];
  const forbiddenRules = Array.isArray(bundle.forbidden_rules) ? bundle.forbidden_rules : [];
  return {
    version: bundle.version,
    policy_event_id: bundle.policy_event_id,
    mandatory: bundle.mandatory === true,
    policy_ready: bundle.policy_ready === true,
    consulted_before_execution: bundle.consulted_before_execution === true,
    model_path_choice_allowed: bundle.model_path_choice_allowed === true,
    action_intent: bundle.action_intent,
    required_source_types: bundle.required_source_types,
    missing_required_source_types: bundle.missing_required_source_types,
    table_manifest_complete: bundle.table_manifest_complete === true,
    consulted_source_types: coverage.filter((item) => Number(item.total ?? 0) > 0).map((item) => String(item.source_type ?? "unknown")),
    source_type_count: coverage.filter((item) => Number(item.total ?? 0) > 0).length,
    total_source_count: coverage.reduce((total, item) => total + Number(item.total ?? 0), 0),
    matched_source_count: matchedSources.length,
    mandatory_rule_count: mandatoryRules.length,
    forbidden_rule_count: forbiddenRules.length,
    source_read_error: bundle.source_read_error ?? null,
    discovery_allowed_only_when: bundle.discovery_allowed_only_when,
    failure_recording_rule: bundle.failure_recording_rule,
  };
}

async function recordExecutionPolicyLibraryEvent(
  db: D1Database,
  input: {
    actionIntent: string;
    phase: string;
    outcome: string;
    mappedTool?: string | null;
    policy?: Record<string, unknown> | null;
    evidence?: Record<string, unknown> | null;
  },
): Promise<void> {
  await ensureExecutionPolicyLibraryTables(db);
  const sourceKeys = Array.isArray(input.policy?.matched_source_keys) ? input.policy?.matched_source_keys : [];
  const eventId = crypto.randomUUID();
  const policyJson = stringify(input.policy ?? {}).slice(0, 50000);
  const evidenceJson = stringify(input.evidence ?? {}).slice(0, 50000);
  const eventText = `${input.actionIntent} ${input.phase} ${input.outcome} ${input.mappedTool ?? ""} ${policyJson} ${evidenceJson}`.slice(0, 50000);
  await db.batch([
    db.prepare(
      `INSERT INTO operator_execution_library_events (
        id, action_intent, phase, outcome, mapped_tool, source_keys_json, policy_json, evidence_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      eventId,
      input.actionIntent,
      input.phase,
      input.outcome,
      input.mappedTool ?? null,
      stringify(sourceKeys).slice(0, 50000),
      policyJson,
      evidenceJson,
    ),
    db.prepare(
      `INSERT INTO operator_execution_library_sources (
        source_key, source_type, source_id, source_scope, text, metadata_json, active, source_updated_at, synced_at
      ) VALUES (?, 'execution_library_event', ?, 'universal', ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(source_key) DO UPDATE SET
        text = excluded.text,
        metadata_json = excluded.metadata_json,
        active = 1,
        source_updated_at = CURRENT_TIMESTAMP,
        synced_at = CURRENT_TIMESTAMP`,
    ).bind(
      `execution_library_event:${eventId}`,
      eventId,
      eventText,
      stringify({ action_intent: input.actionIntent, phase: input.phase, outcome: input.outcome, mapped_tool: input.mappedTool ?? null }),
    ),
  ]);
}

function toolCategory(toolName: string): string {
  if (/repo|github|file|patch|commit/i.test(toolName)) return "repository";
  if (/deploy|release|cloudflare|version/i.test(toolName)) return "deployment";
  if (/schedule|post|publish|hourly|canary/i.test(toolName)) return "scheduling";
  if (/source|draft|generation|gate|content|review/i.test(toolName)) return "content";
  if (/memory|learning|performance|insight/i.test(toolName)) return "intelligence";
  if (/workflow|continuity|proceed|operator/i.test(toolName)) return "workflow";
  return "system";
}

function actionKeyForTool(toolName: string): string {
  return `${toolCategory(toolName)}.${machineKey(toolName)}`;
}

function toolSchemaProperties(tool: MandatoryExecutionToolDefinition): string[] {
  const properties = tool.inputSchema.properties;
  return properties && typeof properties === "object" && !Array.isArray(properties)
    ? Object.keys(properties as Record<string, unknown>)
    : [];
}

function toolRequiredProperties(tool: MandatoryExecutionToolDefinition): string[] {
  return Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required.map(String) : [];
}

function procedureForTool(tool: MandatoryExecutionToolDefinition): Record<string, unknown> {
  const overrides: Record<string, Record<string, unknown>> = {
    getRepoStatus: { ordered_steps: ["Read the configured branch head once.", "Return the exact commit SHA before any mutation."], forbidden_paths: ["Guessing the current SHA", "Using a stale previously observed SHA"], success_signals: ["ok=true", "nonempty sha"] },
    readRepoFile: { ordered_steps: ["Use the bounded named-file read.", "Respect the schema line maximum.", "Use the returned SHA/content as the source of truth."], forbidden_paths: ["Retrying an oversized line request", "Assuming code search indexed a large file"], success_signals: ["ok=true", "content returned"] },
    searchRepoFiles: { ordered_steps: ["Use a neutral query.", "When an exact large file is known, read that blob once and search locally."], forbidden_paths: ["Credential-shaped queries", "Repeated empty code searches", "Recursive per-file fanout"], success_signals: ["bounded matches or an authoritative empty result"] },
    applyRepoTextPatch: { ordered_steps: ["Read the current target text.", "Anchor the replacement so it matches exactly once.", "Commit the exact replacement against the current branch head.", "Read back the changed boundary when syntax is sensitive."], forbidden_paths: ["Retrying duplicate matches", "Patching generated strings without readback"], success_signals: ["ok=true", "commit_sha returned"] },
    applyRepoPatchSet: { ordered_steps: ["Read the latest repository head.", "Validate every exact replacement together.", "Commit once with the expected head SHA.", "If the head changes, reload and revalidate instead of retrying stale input."], forbidden_paths: ["Removing optimistic concurrency", "Resending an oversized rejected payload", "Serial independent commits for one coherent change"], success_signals: ["all replacements validated", "one commit SHA returned"] },
    runGitHubWorkflow: { ordered_steps: ["Use an exact current commit SHA.", "Dispatch only an isolated diagnostic task."], forbidden_paths: ["Dispatching against an unverified branch alias", "Using diagnostic workflows as a normal release"], success_signals: ["dispatched=true", "verified_head_sha matches"] },
    getGitHubWorkflowRun: { ordered_steps: ["Read the exact run identity.", "If concurrency created a newer same-SHA run, follow the newest authoritative run.", "Treat a superseded cancellation as replacement evidence, not an implementation failure.", "Read bounded failed-step annotations only after completion."], forbidden_paths: ["Polling alternate runs without identity evidence", "Diagnosing a superseded run after a newer same-SHA run exists"], success_signals: ["authoritative terminal run identified"] },
    runEngineeringRelease: { ordered_steps: ["Resolve the exact final SHA.", "Synchronize the MCP version, every exact test assertion, release preflight, and CURRENT_STATE in the same change set.", "Run one combined validation and deploy release.", "Reuse an existing successful receipt for the same SHA."], forbidden_paths: ["Separate full validation and deploy loops", "Duplicate same-SHA releases", "Bumping only the runtime version while leaving assertions or documentation stale"], success_signals: ["release identity returned", "exact SHA preserved", "version contract synchronized"] },
    getEngineeringRelease: { ordered_steps: ["Read the exact release identity.", "Use bounded server-side waiting.", "Inspect detailed failure state only after completion."], forbidden_paths: ["Chat-side rapid polling", "Switching to a different run"], success_signals: ["terminal release status"] },
    verifyDeployedMcpVersion: { ordered_steps: ["Verify deployed commit and MCP version identity.", "Only then evaluate newly introduced runtime fields."], forbidden_paths: ["Judging new fields on a stale deployment response"], success_signals: ["expected commit", "expected MCP version"] },
    setScheduledPostSchedulerMode: { ordered_steps: ["Inspect scheduler state and overdue inventory.", "Require owner ratification for protected mode changes.", "Use canary for exactly one post before normal activation.", "Keep normal blocked while overdue rows exist."], forbidden_paths: ["Activating the full overdue queue", "Generic unapproved mode changes"], success_signals: ["persisted safe mode", "allowed-post set verified"] },
    runApprovedPostCanary: { ordered_steps: ["Audit the exact scheduled post.", "Authorize only that post.", "Attempt once.", "Return automatically to paused."], forbidden_paths: ["Canary without an exact post ID", "Leaving scheduler normal after the attempt"], success_signals: ["one attempted post", "mode paused afterward"] },
  };
  return overrides[tool.name] ?? {
    ordered_steps: ["Validate variable inputs against the live typed schema.", `Execute ${tool.name} through the selected internal handler once.`, "Record the result and success evidence."],
    forbidden_paths: ["Choosing a same-handler alias as a fallback", "Repeating a deterministic failure without a changed verified path"],
    success_signals: ["handler returned through the mapped execution boundary"],
  };
}

function intentAliasesForTool(tool: MandatoryExecutionToolDefinition): string[] {
  const explicit: Record<string, string[]> = {
    engineeringPrecheck: ["inspect engineering state", "load engineering context", "engineering precheck", "engineering diagnosis", "diagnose engineering", "mcp status", "operator status", "runtime status", "gateway status", "gateway health", "gateway execution health", "mcp health", "operator health", "current mcp status", "check mcp version", "check current status"],
    getEngineeringAccessState: ["inspect engineering access state", "get engineering access state", "check engineering access", "verify engineering authority"],
    getRepoStatus: ["inspect repository status", "get repository head", "read current repository sha", "repository sha", "runtime repository alignment", "runtime/repository alignment verification", "repository runtime alignment", "runtime source alignment", "current repository status"],
    readRepoFile: ["read repository file", "inspect source file", "open repo file", "repository inspection"],
    searchRepoFiles: ["search repository", "find code in repository", "locate source implementation", "repository search"],
    applyRepoPatchSet: ["apply implementation", "patch repository", "apply code changes", "implement repository changes", "engineering repair", "repair repository", "repair gateway", "repair mcp", "fix gateway", "fix mcp", "dry-run patch", "harmless test patch"],
    applyRepoTextPatch: ["apply one exact patch", "replace exact repository text", "single file repair"],
    deleteRepoFile: ["delete repository file", "remove repository file"],
    runMcpTests: ["run mcp tests", "run mcp self checks", "run built-in mcp checks", "test gateway configuration", "test mcp configuration"],
    runGitHubWorkflow: ["run typecheck", "run operator tests", "run gpt memory tests", "run focused engineering tests", "run regression tests"],
    runEngineeringRelease: ["test and deploy release", "run engineering release", "validate and deploy current sha", "deployment", "deploy worker", "deploy mcp", "release worker", "release mcp"],
    getEngineeringRelease: ["check engineering release", "wait for release completion"],
    verifyDeployedMcpVersion: ["verify live deployment", "verify deployed mcp", "confirm live version", "post-deployment verification", "deployment verification", "runtime alignment verification", "mcp status verification", "verify runtime", "verify worker", "verify current deployment"],
        listEngineeringAudit: ["list engineering audit", "read engineering audit", "inspect engineering audit", "inspect execution audit", "read execution audit", "inspect execution policy records"],
    inspectMcpFailure: ["inspect mcp failure", "engineering diagnosis", "diagnose gateway failure", "repair path diagnosis", "diagnose mcp", "diagnose operator", "inspect gateway failure", "inspect execution failure"],
    listMcpTools: ["list mcp tools", "inspect internal mcp registry", "bridge cached tool call"],
    createMcpTool: ["create mcp tool", "add internal mcp tool", "register internal mcp tool"],
    readMcpToolDefinition: ["read mcp tool definition", "inspect mcp tool schema"],
    updateMcpToolSchema: ["update mcp tool schema", "patch mcp schema"],
    updateMcpToolBehavior: ["update mcp tool behavior", "patch mcp behavior"],
    getScheduledPostSchedulerState: ["inspect scheduler state", "check publishing scheduler"],
    setScheduledPostSchedulerMode: ["change scheduler mode", "pause scheduler", "activate scheduler"],
    runApprovedPostCanary: ["run publishing canary", "test one scheduled post"],
    list_scheduled_posts: ["list scheduled posts", "inspect scheduled calendar"],
    edit_scheduled_post: ["edit scheduled post", "retry scheduled post"],
    schedule_approved_draft: ["schedule approved draft", "place approved post on calendar"],
    create_source_card: ["create source card", "build source manual"],
    create_generation_run: ["create generation run", "plan source adaptation"],
    submit_candidate_draft: ["submit and gate draft", "save generated candidate"],
  };
  return Array.from(new Set([
    splitCamel(tool.name),
    tool.title.toLowerCase(),
    tool.description.toLowerCase(),
    ...(explicit[tool.name] ?? []),
  ]));
}

function deterministicToolForOperationalIntent(actionIntent: string, inputs: Record<string, unknown>): string | null {
  const text = `${actionIntent} ${normalizeText(inputs.intent_hint, 1000) ?? ""} ${normalizeText(inputs.path, 1000) ?? ""}`.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(text);
  if (has(/\bstartup\b/)) return "getOperatorStartupContext";
  if (has(/\bengineering\s+access\b/) || has(/\b(access|authority)\b/) && has(/\b(engineering|github|cloudflare)\b/)) return "getEngineeringAccessState";
  if (
    has(/\b(mcp|operator|runtime|gateway)\b/) && has(/\b(status|health|version|versions)\b/)
    || has(/\bstatus\s+(request|check|verification)\b/)
    || has(/\bcheck\s+(mcp|operator|runtime|gateway)\b/)
    || has(/\bgateway\s+execution\s+health\b/)
  ) return "engineeringPrecheck";
  if (has(/\b(runtime\/repository|repository\/runtime|runtime repository|repository runtime|repo runtime|runtime source|source runtime)\b/) && has(/\b(alignment|verify|verification|sha|status|current)\b/)) return "getRepoStatus";
  if (has(/\b(deployed|deployment|post[- ]?deployment|live)\b/) && has(/\b(verify|verification|alignment|mcp|version)\b/)) return "verifyDeployedMcpVersion";
  if (has(/\b(repository|repo|source|file)\b/) && has(/\b(read|inspect|open|status|sha|head)\b/)) {
    if (normalizeText(inputs.path, 1000) || has(/\b(read|open|file|source)\b/)) return "readRepoFile";
    return "getRepoStatus";
  }
  if (has(/\b(search|find|locate)\b/) && has(/\b(repo|repository|code|source|file)\b/)) return "searchRepoFiles";
  if (has(/\b(list|inspect|show|read)\b/) && has(/\b(mcp|internal)\b/) && has(/\b(tool|tools|registry|schema|definition)\b/)) {
    if (has(/\b(schema|definition)\b/)) return "readMcpToolDefinition";
    return "listMcpTools";
  }
  if (has(/\b(create|add|register)\b/) && has(/\b(mcp|internal)\b/) && has(/\btool\b/)) return "createMcpTool";
  if (has(/\b(update|patch|change)\b/) && has(/\bmcp\b/) && has(/\btool\b/) && has(/\bschema\b/)) return "updateMcpToolSchema";
    if (has(/\b(update|patch|change)\b/) && has(/\bmcp\b/) && has(/\btool\b/) && has(/\bbehavior\b/)) return "updateMcpToolBehavior";
  if (has(/\b(engineering|execution|policy)\s+audit\b/) || has(/\baudit\s+(entries|records|history)\b/)) return "listEngineeringAudit";
  if (has(/\b(engineering|gateway|mcp|operator|execution)\b/) && has(/\b(diagnose|diagnosis|failure|debug|inspect|broken|timeout|timed out)\b/)) return "inspectMcpFailure";
  if (has(/\b(engineering|repository|repo|code|source|gateway|mcp|operator)\b/) && has(/\b(repair|patch|fix|implement|change|dry[- ]?run)\b/)) return "applyRepoPatchSet";
  if (has(/\btypecheck\b/) || has(/\boperator\s+tests?\b/) || has(/\bgpt\s+memory\s+tests?\b/) || has(/\bregression\s+tests?\b/)) return "runGitHubWorkflow";
  if (has(/\b(run mcp tests?|mcp self checks?|built-in mcp checks?|gateway configuration|mcp configuration)\b/)) return "runMcpTests";
  if (has(/\b(test|tests|testing|regression)\b/)) return "runGitHubWorkflow";
  if (has(/\b(deploy|deployment|release)\b/) && has(/\b(run|perform|execute|ship)\b/)) return "runEngineeringRelease";
  return null;
}

function inferredArgumentsForOperationalIntent(toolName: string, actionIntent: string): Record<string, unknown> {
  if (toolName !== "runGitHubWorkflow") return {};
  const normalized = actionIntent.toLowerCase();
  if (/\btypecheck\b/.test(normalized)) return { task: "typecheck" };
  if (/\bgpt\s+memory\s+tests?\b/.test(normalized)) return { task: "gpt-memory-tests" };
  if (/\boperator\s+tests?\b/.test(normalized) || /\bregression\s+tests?\b/.test(normalized)) return { task: "operator-tests" };
  return {};
}

const SOURCE_DEFINED_DIRECT_ENGINEERING_TOOLS = new Set([
  "engineeringPrecheck",
  "getEngineeringAccessState",
  "getRepoStatus",
  "readRepoFile",
  "searchRepoFiles",
  "applyRepoPatchSet",
  "applyRepoTextPatch",
  "deleteRepoFile",
  "runMcpTests",
  "runGitHubWorkflow",
  "runEngineeringRelease",
  "getEngineeringRelease",
  "verifyDeployedMcpVersion",
  "listEngineeringAudit",
  "inspectMcpFailure",
  "listMcpTools",
  "createMcpTool",
  "readMcpToolDefinition",
  "updateMcpToolSchema",
  "updateMcpToolBehavior",
]);

export function prepareSourceDefinedDirectEngineeringCall(
  actionIntent: string,
  objective: string | null,
  inputs: Record<string, unknown>,
  tools: MandatoryExecutionToolDefinition[],
): MandatoryExecutionPrepared | null {
  const toolName = deterministicToolForOperationalIntent(actionIntent, inputs);
  if (!toolName || !SOURCE_DEFINED_DIRECT_ENGINEERING_TOOLS.has(toolName)) return null;
  const tool = tools.find((item) => item.name === toolName);
  if (!tool) return null;
  const allowed = toolSchemaProperties(tool);
  const required = toolRequiredProperties(tool);
  const filteredInputs = Object.fromEntries(Object.entries(inputs).filter(([key]) => allowed.includes(key)));
  const argumentsObject = { ...inferredArgumentsForOperationalIntent(toolName, actionIntent), ...filteredInputs };
  const missingInputs = required.filter((key) => !Object.prototype.hasOwnProperty.call(argumentsObject, key));
  const entry = {
    id: `source-direct:${toolName}`,
    action_key: actionKeyForTool(toolName),
    version: 1,
    status: "active",
    task_class: toolCategory(toolName),
    tool_name: toolName,
    source_type: "source_defined_direct_engineering",
    verification_summary: "Recovery-style deterministic engineering path. No D1 execution-library compilation or discovery is permitted before execution.",
  };
  if (missingInputs.length) {
    return {
      ok: false,
      error: "mandatory_execution_map_inputs_missing",
      map_state: "known",
      map_entry: entry,
      missing_inputs: missingInputs,
    };
  }
  return {
    ok: true,
    tool_name: toolName,
    arguments: argumentsObject,
    map_state: "known",
    map_entry: entry,
    map_execution: {
      version: MANDATORY_EXECUTION_MAP_VERSION,
      mode: "source_defined_direct_engineering",
      action_intent: actionIntent,
      action_key: entry.action_key,
      objective,
      entry_id: entry.id,
      entry_version: entry.version,
      mapped_tool: toolName,
      input_keys: Object.keys(inputs).sort(),
      input_character_count: stringify(inputs).length,
      argument_keys: Object.keys(argumentsObject).sort(),
      model_tool_choice_allowed: false,
      d1_execution_library_bypassed: true,
      discovery_allowed: false,
      compact_receipt_only: true,
    },
  };
}

async function ensureMandatoryExecutionMapTables(db: D1Database): Promise<void> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS operator_execution_map_entries (
    id TEXT PRIMARY KEY,
    action_key TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    task_class TEXT NOT NULL,
    intent_aliases_json TEXT NOT NULL DEFAULT '[]',
    tool_name TEXT NOT NULL,
    fixed_arguments_json TEXT NOT NULL DEFAULT '{}',
    allowed_input_keys_json TEXT NOT NULL DEFAULT '[]',
    required_input_keys_json TEXT NOT NULL DEFAULT '[]',
    forbidden_tools_json TEXT NOT NULL DEFAULT '[]',
    procedure_json TEXT NOT NULL DEFAULT '{}',
    historical_failures_json TEXT NOT NULL DEFAULT '[]',
    success_rule_json TEXT NOT NULL DEFAULT '{}',
    source_type TEXT NOT NULL DEFAULT 'verified_discovery',
    source_incident_id TEXT,
    supersedes_entry_id TEXT,
    verification_summary TEXT,
    verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_operator_execution_map_active
    ON operator_execution_map_entries (status, action_key, version DESC, updated_at DESC)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS operator_execution_map_incidents (
    id TEXT PRIMARY KEY,
    objective TEXT,
    action_intent TEXT NOT NULL,
    action_key TEXT,
    failed_entry_id TEXT,
    state TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'discovery_open',
    failure_signature TEXT,
    original_inputs_json TEXT NOT NULL DEFAULT '{}',
    replacement_entry_id TEXT,
    opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_operator_execution_map_incidents
    ON operator_execution_map_incidents (status, state, updated_at DESC)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS operator_execution_map_attempts (
    id TEXT PRIMARY KEY,
    incident_id TEXT,
    entry_id TEXT,
    action_intent TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    arguments_json TEXT NOT NULL DEFAULT '{}',
    mode TEXT NOT NULL,
    outcome TEXT NOT NULL,
    result_summary_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_operator_execution_map_attempts
    ON operator_execution_map_attempts (incident_id, created_at DESC)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS operator_execution_map_promotions (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    entry_id TEXT NOT NULL,
    superseded_entry_id TEXT,
    verification_summary TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

async function repairDeterministicInputValidationIncidents(db: D1Database): Promise<void> {
  const incidents = await db.prepare(
    `SELECT id, failed_entry_id, failure_signature
     FROM operator_execution_map_incidents
     WHERE status = 'discovery_open' AND state = 'stale' AND failed_entry_id IS NOT NULL
     ORDER BY datetime(updated_at) ASC`,
  ).all<Record<string, unknown>>();
  for (const incident of incidents.results ?? []) {
    const failureSignature = String(incident.failure_signature ?? "").toLowerCase();
    if (!/head_changed|find_text_must_match|find_must_match/.test(failureSignature)) continue;
    const failedEntryId = String(incident.failed_entry_id ?? "");
    const reactivated = await db.prepare(
      `UPDATE operator_execution_map_entries
       SET status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'stale'`,
    ).bind(failedEntryId).run();
    if (Number(reactivated.meta?.changes ?? 0) !== 1) continue;
    await db.prepare(
      `UPDATE operator_execution_map_incidents
       SET status = 'resolved', replacement_entry_id = ?, resolved_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'discovery_open'`,
    ).bind(failedEntryId, String(incident.id)).run();
  }
}

function serializeEntry(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    action_key: row.action_key,
    version: Number(row.version ?? 1),
    status: row.status,
    task_class: row.task_class,
    intent_aliases: safeJson(String(row.intent_aliases_json ?? "[]"), []),
    tool_name: row.tool_name,
    fixed_arguments: safeJson(String(row.fixed_arguments_json ?? "{}"), {}),
    allowed_input_keys: safeJson(String(row.allowed_input_keys_json ?? "[]"), []),
    required_input_keys: safeJson(String(row.required_input_keys_json ?? "[]"), []),
    forbidden_tools: safeJson(String(row.forbidden_tools_json ?? "[]"), []),
    procedure: safeJson(String(row.procedure_json ?? "{}"), {}),
    historical_failures: safeJson(String(row.historical_failures_json ?? "[]"), []),
    success_rule: safeJson(String(row.success_rule_json ?? "{}"), {}),
    source_type: row.source_type,
    source_incident_id: row.source_incident_id ?? null,
    supersedes_entry_id: row.supersedes_entry_id ?? null,
    verification_summary: row.verification_summary ?? null,
    verified_at: row.verified_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    map_version: MANDATORY_EXECUTION_MAP_VERSION,
  };
}

function serializeIncident(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    objective: row.objective ?? null,
    action_intent: row.action_intent,
    action_key: row.action_key ?? null,
    failed_entry_id: row.failed_entry_id ?? null,
    state: row.state,
    status: row.status,
    failure_signature: row.failure_signature ?? null,
    original_inputs: safeJson(String(row.original_inputs_json ?? "{}"), {}),
    replacement_entry_id: row.replacement_entry_id ?? null,
    opened_at: row.opened_at,
    resolved_at: row.resolved_at ?? null,
    updated_at: row.updated_at,
    map_version: MANDATORY_EXECUTION_MAP_VERSION,
  };
}

async function seedMandatoryExecutionMap(
  db: D1Database,
  tools: MandatoryExecutionToolDefinition[],
): Promise<void> {
  await ensureMandatoryExecutionMapTables(db);
  await repairDeterministicInputValidationIncidents(db);
  for (const tool of tools) {
    if (MAP_EXCLUDED_TOOLS.has(tool.name)) continue;
    const actionKey = actionKeyForTool(tool.name);
    const desiredAliases = stringify(intentAliasesForTool(tool));
    const desiredAllowedInputs = stringify(toolSchemaProperties(tool));
    const desiredRequiredInputs = stringify(toolRequiredProperties(tool));
    const desiredProcedure = stringify(procedureForTool(tool));
    const desiredSuccessRule = stringify({ kind: "mapped_handler_result", path_failure_classifier: "reusable_execution_path_failure_only" });
    const desiredVerificationSummary = `Seeded from the live internal typed tool registry. The map, not the model, selects this tool for the matching action intent. Contract ${MANDATORY_EXECUTION_MAP_VERSION}.`;
    const existing = await db.prepare(
      `SELECT id, source_type, status, verification_summary
       FROM operator_execution_map_entries
       WHERE action_key = ?
       ORDER BY version DESC LIMIT 1`,
    ).bind(actionKey).first<Record<string, unknown>>();
    if (existing?.id) {
      const sourceDefined = existing.source_type === "tool_registry_seed";
      const active = existing.status === "active";
      const currentContract = existing.verification_summary === desiredVerificationSummary;
      if (sourceDefined && active && !currentContract) {
        await db.prepare(
          `UPDATE operator_execution_map_entries
           SET version = version + 1,
               task_class = ?, intent_aliases_json = ?, tool_name = ?,
               allowed_input_keys_json = ?, required_input_keys_json = ?,
               procedure_json = ?, success_rule_json = ?, verification_summary = ?,
               verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        ).bind(
          toolCategory(tool.name),
          desiredAliases,
          tool.name,
          desiredAllowedInputs,
          desiredRequiredInputs,
          desiredProcedure,
          desiredSuccessRule,
          desiredVerificationSummary,
          String(existing.id),
        ).run();
      }
      continue;
    }
    await db.prepare(
      `INSERT INTO operator_execution_map_entries (
        id, action_key, version, status, task_class, intent_aliases_json, tool_name,
        fixed_arguments_json, allowed_input_keys_json, required_input_keys_json,
        forbidden_tools_json, procedure_json, historical_failures_json, success_rule_json,
        source_type, verification_summary, verified_at
      ) VALUES (?, ?, 1, 'active', ?, ?, ?, '{}', ?, ?, '[]', ?, '[]', ?, 'tool_registry_seed', ?, CURRENT_TIMESTAMP)`,
    ).bind(
      crypto.randomUUID(),
      actionKey,
      toolCategory(tool.name),
      desiredAliases,
      tool.name,
      desiredAllowedInputs,
      desiredRequiredInputs,
      desiredProcedure,
      desiredSuccessRule,
      desiredVerificationSummary,
    ).run();
  }
}

function intentScore(intent: string, entry: Record<string, unknown>): number {
  const intentTokens = tokenize(intent);
  const aliases = Array.isArray(entry.intent_aliases) ? entry.intent_aliases.map(String) : [];
  const actionKey = String(entry.action_key ?? "");
  const normalizedIntent = intent.toLowerCase();
  let best = 0;
  for (const alias of [...aliases, actionKey.replace(/[._-]+/g, " ")]) {
    const normalizedAlias = alias.toLowerCase().trim();
    if (!normalizedAlias) continue;
    if (normalizedIntent === normalizedAlias) best = Math.max(best, 100);
    if (normalizedIntent.includes(normalizedAlias) || normalizedAlias.includes(normalizedIntent)) best = Math.max(best, 25);
    const aliasTokens = tokenize(normalizedAlias);
    const overlap = aliasTokens.filter((token) => intentTokens.includes(token));
    const specificity = overlap.reduce((score, token) => score + Math.min(token.length, 10), 0);
    const coverage = aliasTokens.length ? overlap.length / aliasTokens.length : 0;
    best = Math.max(best, overlap.length * 4 + specificity / 10 + coverage * 5);
  }
  return best;
}

async function findActiveMapEntry(
  db: D1Database,
  actionIntent: string,
  actionKey: string | null,
  inputs: Record<string, unknown>,
): Promise<{ entry: Record<string, unknown> | null; candidates: Array<Record<string, unknown>> }> {
  const rows = await db.prepare(
    `SELECT * FROM operator_execution_map_entries
     WHERE status = 'active'
     ORDER BY version DESC, datetime(updated_at) DESC`,
  ).all<Record<string, unknown>>();
  const entries = (rows.results ?? []).map(serializeEntry);
  if (actionKey) {
    const exact = entries.find((entry) => String(entry.action_key) === actionKey) ?? null;
    return { entry: exact, candidates: exact ? [exact] : [] };
  }
  const deterministicTool = deterministicToolForOperationalIntent(actionIntent, inputs);
  if (deterministicTool) {
    const exactTool = entries.find((entry) => String(entry.tool_name) === deterministicTool) ?? null;
    if (exactTool) return { entry: exactTool, candidates: [exactTool] };
  }
  const ranked = entries
    .map((entry) => ({ entry, score: intentScore(actionIntent, entry) }))
    .filter((item) => item.score >= 8)
    .sort((left, right) => right.score - left.score);
  if (!ranked.length) return { entry: null, candidates: [] };
  const first = ranked[0];
  const second = ranked[1];
  const confident = first.score >= 18 || !second || first.score - second.score >= 4;
  return {
    entry: confident ? first.entry : null,
    candidates: ranked.slice(0, 5).map((item) => ({ action_key: item.entry.action_key, task_class: item.entry.task_class, score: item.score })),
  };
}

async function openMapIncident(
  db: D1Database,
  input: {
    objective: string | null;
    actionIntent: string;
    actionKey: string | null;
    failedEntryId: string | null;
    state: "unknown" | "stale";
    failureSignature: string | null;
    inputs: Record<string, unknown>;
  },
): Promise<Record<string, unknown>> {
  const existing = await db.prepare(
    `SELECT * FROM operator_execution_map_incidents
     WHERE status = 'discovery_open'
       AND action_intent = ?
       AND COALESCE(failed_entry_id, '') = COALESCE(?, '')
     ORDER BY datetime(updated_at) DESC LIMIT 1`,
  ).bind(input.actionIntent, input.failedEntryId).first<Record<string, unknown>>();
  if (existing) return serializeIncident(existing);
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO operator_execution_map_incidents (
      id, objective, action_intent, action_key, failed_entry_id, state, status,
      failure_signature, original_inputs_json
    ) VALUES (?, ?, ?, ?, ?, ?, 'discovery_open', ?, ?)`,
  ).bind(
    id,
    input.objective,
    input.actionIntent,
    input.actionKey,
    input.failedEntryId,
    input.state,
    input.failureSignature,
    stringify(input.inputs),
  ).run();
  const created = await db.prepare(`SELECT * FROM operator_execution_map_incidents WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  return serializeIncident(created ?? { id, ...input, status: "discovery_open" });
}

async function createDiscoveryPermit(
  callbacks: MandatoryExecutionMapCallbacks,
  incident: Record<string, unknown>,
): Promise<string> {
  return callbacks.signPermit({
    kind: "mandatory_execution_map_discovery",
    version: MANDATORY_EXECUTION_MAP_VERSION,
    incident_id: incident.id,
    action_intent: incident.action_intent,
    exp: Math.floor(Date.now() / 1000) + 30 * 60,
  });
}

async function readOpenIncident(db: D1Database, incidentId: string): Promise<Record<string, unknown> | null> {
  const row = await db.prepare(
    `SELECT * FROM operator_execution_map_incidents
     WHERE id = ? AND status = 'discovery_open' LIMIT 1`,
  ).bind(incidentId).first<Record<string, unknown>>();
  return row ? serializeIncident(row) : null;
}

export async function prepareMandatoryExecutionMapCall(
  db: D1Database,
  rawInput: Record<string, unknown>,
  tools: MandatoryExecutionToolDefinition[],
  callbacks: MandatoryExecutionMapCallbacks,
): Promise<MandatoryExecutionPrepared> {
  const actionIntent = normalizeText(rawInput.intent, 8000) ?? normalizeText(rawInput.action_intent, 8000);
  const objective = normalizeText(rawInput.objective, 8000);
  const actionKey = normalizeText(rawInput.action_key, 300)?.toLowerCase() ?? null;
  const parsedInputs = rawInput.inputs && typeof rawInput.inputs === "object" && !Array.isArray(rawInput.inputs)
    ? rawInput.inputs
    : safeJson(normalizeText(rawInput.inputs_json, 50000) ?? "{}", null);
  const inputs = parsedInputs && typeof parsedInputs === "object" && !Array.isArray(parsedInputs)
    ? parsedInputs as Record<string, unknown>
    : null;
  if (!actionIntent || !inputs) {
    return {
      ok: false,
      error: "mandatory_execution_map_input_invalid",
      map_state: "unknown",
    };
  }
  const directEngineering = prepareSourceDefinedDirectEngineeringCall(actionIntent, objective, inputs, tools);
  if (directEngineering) return directEngineering;

  await seedMandatoryExecutionMap(db, tools);
  const staticPolicySources = callbacks.readStaticPolicySources
    ? await callbacks.readStaticPolicySources()
    : [];
  const compiledExecutionLibrary = await compileExecutionPolicyLibrary(db, actionIntent, inputs, tools, staticPolicySources);
  const executionLibrary = executionPolicyLibraryReceipt(compiledExecutionLibrary);
  if (compiledExecutionLibrary.policy_ready !== true) {
    return {
      ok: false,
      error: "execution_policy_library_not_ready",
      map_state: "unknown",
      execution_library: executionLibrary,
    };
  }

    const continuationIncidentId = normalizeText(rawInput.continuation_id, 160);
  const continuationIncident = continuationIncidentId ? await readOpenIncident(db, continuationIncidentId) : null;
  const signedPermitPayload = await callbacks.verifyPermit(rawInput.permit ?? rawInput.discovery_permit);
  const permitPayload = signedPermitPayload ?? (continuationIncident ? {
    kind: "mandatory_execution_map_discovery",
    version: MANDATORY_EXECUTION_MAP_VERSION,
    incident_id: continuationIncident.id,
    action_intent: continuationIncident.action_intent,
  } : null);
  if (permitPayload?.kind === "mandatory_execution_map_discovery"
      && permitPayload.version === MANDATORY_EXECUTION_MAP_VERSION
      && typeof permitPayload.incident_id === "string") {
    const incident = await readOpenIncident(db, permitPayload.incident_id);
    if (normalizeText(rawInput.incident_id, 160) && normalizeText(rawInput.incident_id, 160) !== String(permitPayload.incident_id)) {
      return {
        ok: false,
        error: "mandatory_execution_map_discovery_mismatch",
        map_state: "discovery",
        incident,
      };
    }
        const incidentInputs = incident?.original_inputs && typeof incident.original_inputs === "object" && !Array.isArray(incident.original_inputs)
      ? incident.original_inputs as Record<string, unknown>
      : null;
    const requestIdentityInputs = { ...inputs };
    delete requestIdentityInputs.discovery_tool;
    const rawDiscoveryInputs = requestIdentityInputs.discovery_inputs;
    delete requestIdentityInputs.discovery_inputs;
    const discoveryInputs = rawDiscoveryInputs && typeof rawDiscoveryInputs === "object" && !Array.isArray(rawDiscoveryInputs)
      ? rawDiscoveryInputs as Record<string, unknown>
      : null;
    const permitMatchesAction = incident !== null
      && String(incident.action_intent) === actionIntent
      && String(permitPayload.action_intent) === actionIntent;
    const permitMatchesRequest = permitMatchesAction
      && (!incidentInputs || equivalentJson(incidentInputs, requestIdentityInputs));
    const discoveryTool = normalizeText((inputs as Record<string, unknown> | null)?.discovery_tool, 160)
      ?? normalizeText(rawInput.discovery_tool, 160);
    if (!discoveryTool && permitMatchesRequest) {
      return {
        ok: false,
        error: "mandatory_execution_map_discovery_tool_required",
        map_state: "discovery",
        incident,
        discovery_permit: String(rawInput.permit ?? rawInput.discovery_permit),
        map_execution: {
          version: MANDATORY_EXECUTION_MAP_VERSION,
          mode: "authorized_discovery",
          action_intent: actionIntent,
          action_key: incident?.action_key ?? actionKey,
          objective,
          incident_id: String(incident?.id ?? permitPayload.incident_id),
          requested_inputs: requestIdentityInputs,
          permit_accepted: true,
          model_tool_choice_allowed: false,
        },
      };
    }
    const tool = tools.find((item) => item.name === discoveryTool);
    if (!incident || !tool || MAP_EXCLUDED_TOOLS.has(tool.name)) {
      return {
        ok: false,
        error: "mandatory_execution_map_discovery_invalid",
        map_state: "discovery",
        incident,
      };
    }
    if (!permitMatchesAction) {
      return {
        ok: false,
        error: "mandatory_execution_map_discovery_mismatch",
        map_state: "discovery",
        incident,
      };
    }
    const executionInputs = discoveryInputs ?? requestIdentityInputs;
    const duplicate = await db.prepare(
      `SELECT id FROM operator_execution_map_attempts
       WHERE incident_id = ? AND tool_name = ? AND arguments_json = ?
       LIMIT 1`,
    ).bind(String(incident.id), tool.name, stringify(executionInputs).slice(0, 50000)).first<Record<string, unknown>>();
    if (duplicate) {
      return {
        ok: false,
        error: "mandatory_execution_map_duplicate_discovery_attempt",
        map_state: "discovery",
        incident,
      };
    }
    return {
      ok: true,
      tool_name: tool.name,
      arguments: executionInputs,
      map_state: "discovery",
      incident,
      discovery_permit: String(rawInput.permit ?? rawInput.discovery_permit),
      execution_library: executionLibrary,
      map_execution: {
        version: MANDATORY_EXECUTION_MAP_VERSION,
        mode: "authorized_discovery",
        action_intent: actionIntent,
        action_key: incident.action_key ?? actionKey,
        objective,
        incident_id: incident.id,
        failed_entry_id: incident.failed_entry_id ?? null,
        mapped_tool: null,
        discovery_tool: tool.name,
        requested_inputs: inputs,
        execution_library: executionLibrary,
      },
    };
  }

  const openIncident = await db.prepare(
    `SELECT * FROM operator_execution_map_incidents
     WHERE status = 'discovery_open' AND action_intent = ?
     ORDER BY datetime(updated_at) DESC
     LIMIT 1`,
  ).bind(actionIntent).first<Record<string, unknown>>();
  if (openIncident) {
    const incident = serializeIncident(openIncident);
    return {
      ok: false,
      error: "mandatory_execution_map_open_incident_permit_required",
      map_state: "unknown",
      incident,
      discovery_permit: await createDiscoveryPermit(callbacks, incident),
      execution_library: executionLibrary,
    };
  }

  const found = await findActiveMapEntry(db, actionIntent, actionKey, inputs);
  if (!found.entry) {
    const incident = await openMapIncident(db, {
      objective,
      actionIntent,
      actionKey,
      failedEntryId: null,
      state: "unknown",
      failureSignature: found.candidates.length ? "intent_match_ambiguous" : "no_matching_execution_map_entry",
      inputs,
    });
    await recordExecutionPolicyLibraryEvent(db, {
      actionIntent,
      phase: "path_resolution",
      outcome: "unknown_or_ambiguous",
      policy: executionLibrary,
      evidence: { candidates: found.candidates, incident_id: incident.id },
    });
    return {
      ok: false,
      error: found.candidates.length ? "mandatory_execution_map_ambiguous" : "mandatory_execution_map_unknown",
      map_state: "unknown",
      incident,
      discovery_permit: await createDiscoveryPermit(callbacks, incident),
      candidates: found.candidates,
      execution_library: executionLibrary,
    };
  }

  const allowed = Array.isArray(found.entry.allowed_input_keys) ? found.entry.allowed_input_keys.map(String) : [];
  const required = Array.isArray(found.entry.required_input_keys) ? found.entry.required_input_keys.map(String) : [];
  const fixed = found.entry.fixed_arguments && typeof found.entry.fixed_arguments === "object" && !Array.isArray(found.entry.fixed_arguments)
    ? found.entry.fixed_arguments as Record<string, unknown>
    : {};
  const filteredInputs = Object.fromEntries(Object.entries(inputs).filter(([key]) => allowed.includes(key)));
  const inferredArguments = inferredArgumentsForOperationalIntent(String(found.entry.tool_name), actionIntent);
  const argumentsObject = { ...fixed, ...inferredArguments, ...filteredInputs };
  const missingInputs = required.filter((key) => !Object.prototype.hasOwnProperty.call(argumentsObject, key));
  if (missingInputs.length) {
    return {
      ok: false,
      error: "mandatory_execution_map_inputs_missing",
      map_state: "known",
      map_entry: found.entry,
      missing_inputs: missingInputs,
      execution_library: executionLibrary,
    };
  }
  return {
    ok: true,
    tool_name: String(found.entry.tool_name),
    arguments: argumentsObject,
    map_state: "known",
    map_entry: found.entry,
    execution_library: executionLibrary,
    map_execution: {
      version: MANDATORY_EXECUTION_MAP_VERSION,
      mode: "mandatory_known_path",
      action_intent: actionIntent,
      action_key: found.entry.action_key,
      objective,
      entry_id: found.entry.id,
      entry_version: found.entry.version,
      mapped_tool: found.entry.tool_name,
      requested_inputs: inputs,
      enforced_arguments: argumentsObject,
      execution_library: executionLibrary,
      model_tool_choice_allowed: false,
    },
  };
}

function resultFailureSignature(result: Record<string, unknown>): string {
  const signature = {
    error: result.error ?? null,
    error_code: result.error_code ?? null,
    status: result.status ?? null,
    phase: result.phase ?? null,
  };
  return stringify(signature).slice(0, 2000);
}

function isDeterministicInputValidationFailure(result: Record<string, unknown>): boolean {
  const error = String(result.error ?? result.error_code ?? "").toLowerCase();
  return /head_changed|find_text_must_match|find_must_match/.test(error);
}

function isReusableExecutionPathFailure(toolName: string, result: Record<string, unknown>): boolean {
  if (result.ok !== false || isDeterministicInputValidationFailure(result)) return false;
  const status = Number(result.status ?? 0);
  const error = String(result.error ?? result.error_code ?? "").toLowerCase();
  const phase = String(result.phase ?? "").toLowerCase();
  if (status >= 500 || [502, 503, 504].includes(Number(result.status_code ?? 0))) return true;
  if (/transport|timeout|upstream|provider|connection|unavailable|payload_too_large|client_preflight|schema_stale|unknown_runtime|repo_file_read_failed/.test(`${error} ${phase}`)) return true;
  if (/repo|github|workflow|deploy|cloudflare|file|patch|commit/i.test(toolName)
      && /not_found|missing|invalid_ref|exact_sha|conflict|rate_limit/.test(error)) return true;
  return false;
}

function shouldRefreshExecutionLibraryAfterTool(toolName: string): boolean {
  return /memory|route|requirement|gate|decision|sourcecard|source_card|backlog|override|tool(schema|behavior)|createMcpTool|ops/i.test(toolName);
}

function compactExecutionResultEvidence(result: Record<string, unknown>): Record<string, unknown> {
  const omitted = new Set(["execution_library", "routed_execution", "execution_policy", "mandatory_execution_map"]);
  return Object.fromEntries(Object.entries(result)
    .filter(([key]) => !omitted.has(key))
    .slice(0, 40)
    .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 4000) : value]));
}

async function recordMapAttempt(
  db: D1Database,
  input: {
    incidentId: string | null;
    entryId: string | null;
    actionIntent: string;
    toolName: string;
    args: Record<string, unknown>;
    mode: string;
    result: Record<string, unknown>;
  },
): Promise<void> {
  await db.prepare(
    `INSERT INTO operator_execution_map_attempts (
      id, incident_id, entry_id, action_intent, tool_name, arguments_json,
      mode, outcome, result_summary_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    input.incidentId,
    input.entryId,
    input.actionIntent,
    input.toolName,
    stringify(input.args).slice(0, 50000),
    input.mode,
    input.result.ok === false ? "failed" : "succeeded",
    stringify({
      ok: input.result.ok !== false,
      error: input.result.error ?? null,
      status: input.result.status ?? null,
      phase: input.result.phase ?? null,
    }).slice(0, 8000),
  ).run();
}

async function promoteDiscovery(
  db: D1Database,
  incident: Record<string, unknown>,
  tool: MandatoryExecutionToolDefinition,
  actionIntent: string,
): Promise<Record<string, unknown>> {
  const failedEntryId = normalizeText(incident.failed_entry_id, 160);
  const failedEntry = failedEntryId
    ? await db.prepare(`SELECT * FROM operator_execution_map_entries WHERE id = ? LIMIT 1`).bind(failedEntryId).first<Record<string, unknown>>()
    : null;
  const actionKey = normalizeText(incident.action_key, 300)?.toLowerCase()
    ?? normalizeText(failedEntry?.action_key, 300)?.toLowerCase()
    ?? `${toolCategory(tool.name)}.${machineKey(actionIntent)}`;
  const highest = await db.prepare(
    `SELECT MAX(version) AS version FROM operator_execution_map_entries WHERE action_key = ?`,
  ).bind(actionKey).first<{ version: number }>();
  const nextVersion = Number(highest?.version ?? 0) + 1;
  const entryId = crypto.randomUUID();
  const priorAliases = failedEntry ? safeJson(String(failedEntry.intent_aliases_json ?? "[]"), []) : [];
  const aliases = Array.from(new Set([
    ...(Array.isArray(priorAliases) ? priorAliases.map(String) : []),
    actionIntent,
    ...intentAliasesForTool(tool),
  ]));
  const attempts = await db.prepare(
    `SELECT tool_name, arguments_json, outcome, result_summary_json, created_at
     FROM operator_execution_map_attempts
     WHERE incident_id = ?
     ORDER BY datetime(created_at) ASC, rowid ASC`,
  ).bind(String(incident.id)).all<Record<string, unknown>>();
  const historicalFailures = (attempts.results ?? [])
    .filter((attempt) => attempt.outcome === "failed")
    .map((attempt) => ({
      tool_name: attempt.tool_name,
      arguments: safeJson(String(attempt.arguments_json ?? "{}"), {}),
      result: safeJson(String(attempt.result_summary_json ?? "{}"), {}),
      created_at: attempt.created_at,
    }));
  const promotedProcedure = {
    ...procedureForTool(tool),
    testimony: {
      incident_id: incident.id,
      original_failure_signature: incident.failure_signature ?? null,
      failed_paths: historicalFailures,
      verified_successful_tool: tool.name,
      mandatory_statement: `For this action intent, ${tool.name} is the active verified path until a genuine path failure opens a stale incident.`,
    },
  };
  if (failedEntryId) {
    await db.prepare(
      `UPDATE operator_execution_map_entries
       SET status = 'superseded', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).bind(failedEntryId).run();
  }
  await db.prepare(
    `INSERT INTO operator_execution_map_entries (
      id, action_key, version, status, task_class, intent_aliases_json, tool_name,
      fixed_arguments_json, allowed_input_keys_json, required_input_keys_json,
      forbidden_tools_json, procedure_json, historical_failures_json, success_rule_json,
      source_type, source_incident_id, supersedes_entry_id, verification_summary, verified_at
    ) VALUES (?, ?, ?, 'active', ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?, 'verified_discovery', ?, ?, ?, CURRENT_TIMESTAMP)`,
  ).bind(
    entryId,
    actionKey,
    nextVersion,
    toolCategory(tool.name),
    stringify(aliases),
    tool.name,
    stringify(toolSchemaProperties(tool)),
    stringify(toolRequiredProperties(tool)),
    stringify(failedEntryId ? [String(failedEntry?.tool_name ?? "")] : []),
    stringify(promotedProcedure),
    stringify(historicalFailures),
    stringify({ kind: "verified_discovery_success", path_failure_classifier: "reusable_execution_path_failure_only" }),
    String(incident.id),
    failedEntryId,
    `Promoted automatically after incident ${String(incident.id)}. The successful discovery tool ${tool.name} is now mandatory for this action intent.`,
  ).run();
  await db.prepare(
    `INSERT INTO operator_execution_map_promotions (
      id, incident_id, entry_id, superseded_entry_id, verification_summary
    ) VALUES (?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    String(incident.id),
    entryId,
    failedEntryId,
    `Successful discovery through ${tool.name}; activated as map version ${nextVersion}.`,
  ).run();
  await db.prepare(
    `UPDATE operator_execution_map_incidents
     SET status = 'resolved', replacement_entry_id = ?, resolved_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).bind(entryId, String(incident.id)).run();
  const entry = await db.prepare(`SELECT * FROM operator_execution_map_entries WHERE id = ?`).bind(entryId).first<Record<string, unknown>>();
  return serializeEntry(entry ?? { id: entryId, action_key: actionKey, version: nextVersion, tool_name: tool.name, status: "active" });
}

export async function finalizeMandatoryExecutionMapCall(
  db: D1Database,
  mapExecution: Record<string, unknown> | null,
  toolName: string,
  args: Record<string, unknown>,
  result: Record<string, unknown>,
  tools: MandatoryExecutionToolDefinition[],
  callbacks: MandatoryExecutionMapCallbacks,
): Promise<Record<string, unknown> | null> {
  if (!mapExecution) return null;
  const actionIntent = normalizeText(mapExecution.action_intent, 8000) ?? "unknown action";
  const mode = normalizeText(mapExecution.mode, 80) ?? "unknown";
  if (mode === "source_defined_direct_engineering") {
    return {
      version: MANDATORY_EXECUTION_MAP_VERSION,
      map_state: result.ok === false ? "source_defined_direct_failed" : "source_defined_direct_completed",
      action_intent: actionIntent,
      mapped_tool: toolName,
      mandatory_path_followed: true,
      model_tool_choice_allowed: false,
      d1_execution_library_bypassed: true,
      discovery_allowed: false,
      objective_may_resume: result.ok !== false,
      failure: result.ok === false ? {
        error: result.error ?? null,
        status: result.status ?? null,
        phase: result.phase ?? null,
      } : null,
    };
  }
  await ensureMandatoryExecutionMapTables(db);
  const entryId = normalizeText(mapExecution.entry_id, 160);
  const incidentId = normalizeText(mapExecution.incident_id, 160);
  await recordMapAttempt(db, {
    incidentId,
    entryId,
    actionIntent,
    toolName,
    args,
    mode,
    result,
  });
  const executionLibrary = mapExecution.execution_library && typeof mapExecution.execution_library === "object" && !Array.isArray(mapExecution.execution_library)
    ? mapExecution.execution_library as Record<string, unknown>
    : null;
  await recordExecutionPolicyLibraryEvent(db, {
    actionIntent,
    phase: "result_observed",
    outcome: result.ok === false ? "failed_recorded_before_repair" : "succeeded",
    mappedTool: toolName,
    policy: executionLibrary,
    evidence: {
      error: result.error ?? null,
      status: result.status ?? null,
      phase: result.phase ?? null,
      map_mode: mode,
      result: compactExecutionResultEvidence(result),
    },
  });
  if (result.ok !== false && shouldRefreshExecutionLibraryAfterTool(toolName)) {
    const staticPolicySources = callbacks.readStaticPolicySources
      ? await callbacks.readStaticPolicySources()
      : [];
    await syncExecutionPolicyLibrarySources(db, tools, staticPolicySources, true);
  }

  if (mode === "mandatory_known_path" && entryId && isReusableExecutionPathFailure(toolName, result)) {
    await db.prepare(
      `UPDATE operator_execution_map_entries
       SET status = 'stale', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'active'`,
    ).bind(entryId).run();
    const incident = await openMapIncident(db, {
      objective: normalizeText(mapExecution.objective, 8000),
      actionIntent,
      actionKey: normalizeText(mapExecution.action_key, 300)?.toLowerCase() ?? null,
      failedEntryId: entryId,
      state: "stale",
      failureSignature: resultFailureSignature(result),
      inputs: mapExecution.requested_inputs && typeof mapExecution.requested_inputs === "object" && !Array.isArray(mapExecution.requested_inputs)
        ? mapExecution.requested_inputs as Record<string, unknown>
        : args,
    });
    await recordMapAttempt(db, {
      incidentId: String(incident.id),
      entryId,
      actionIntent,
      toolName,
      args,
      mode,
      result,
    });
    return {
      version: MANDATORY_EXECUTION_MAP_VERSION,
      map_state: "known_path_became_stale",
      incident,
      discovery_permit: await createDiscoveryPermit(callbacks, incident),
      old_path_blocked: true,
      model_discovery_allowed: true,
      objective_may_resume: false,
    };
  }

  if (mode === "authorized_discovery" && incidentId) {
    const incident = await readOpenIncident(db, incidentId);
    if (!incident) {
      return {
        version: MANDATORY_EXECUTION_MAP_VERSION,
        map_state: "discovery_incident_missing",
        objective_may_resume: false,
      };
    }
    if (result.ok === false) {
      return {
        version: MANDATORY_EXECUTION_MAP_VERSION,
        map_state: "discovery_continues",
        incident,
        discovery_permit: await createDiscoveryPermit(callbacks, incident),
        failed_path_recorded: true,
        objective_may_resume: false,
      };
    }
    const tool = tools.find((item) => item.name === toolName);
    if (!tool) {
      return {
        version: MANDATORY_EXECUTION_MAP_VERSION,
        map_state: "promotion_blocked_unknown_tool",
        incident,
        objective_may_resume: false,
      };
    }
    const entry = await promoteDiscovery(db, incident, tool, actionIntent);
    await recordExecutionPolicyLibraryEvent(db, {
      actionIntent,
      phase: "verified_fix_promoted",
      outcome: "mandatory_path_updated_before_resume",
      mappedTool: toolName,
      policy: executionLibrary,
      evidence: { incident_id: incident.id, active_entry_id: entry.id, superseded_entry_id: incident.failed_entry_id ?? null },
    });
    return {
      version: MANDATORY_EXECUTION_MAP_VERSION,
      map_state: "discovery_promoted",
      incident_id: incident.id,
      active_entry: entry,
      previous_path_superseded: Boolean(incident.failed_entry_id),
      objective_may_resume: true,
      mandatory_from_now_on: true,
    };
  }

  return {
    version: MANDATORY_EXECUTION_MAP_VERSION,
    map_state: "known_path_completed",
    entry_id: entryId,
    objective_may_resume: true,
    mandatory_path_followed: true,
  };
}

export async function getMandatoryExecutionMapSummary(
  db: D1Database,
  tools: MandatoryExecutionToolDefinition[],
): Promise<Record<string, unknown>> {
  await seedMandatoryExecutionMap(db, tools);
  const entryCounts = await db.prepare(
    `SELECT status, COUNT(*) AS total
     FROM operator_execution_map_entries
     GROUP BY status`,
  ).all<Record<string, unknown>>();
  const incidentCounts = await db.prepare(
    `SELECT status, state, COUNT(*) AS total
     FROM operator_execution_map_incidents
     GROUP BY status, state`,
  ).all<Record<string, unknown>>();
  const attempts = await db.prepare(
    `SELECT COUNT(*) AS total FROM operator_execution_map_attempts`,
  ).first<{ total: number }>();
  const promotions = await db.prepare(
    `SELECT COUNT(*) AS total FROM operator_execution_map_promotions`,
  ).first<{ total: number }>();
  return {
    version: MANDATORY_EXECUTION_MAP_VERSION,
    enforcement: "Every external action must resolve to an active map entry or a signed discovery incident. Known paths are mandatory and model tool choice is disabled.",
    scenarios: {
      known: "Execute the active mapped procedure only.",
      stale: "Block the failed procedure, open discovery, promote the verified replacement, then resume.",
      unknown: "Open discovery, record every attempt, promote the first verified solution, then resume.",
    },
    entry_counts: entryCounts.results ?? [],
    incident_counts: incidentCounts.results ?? [],
    attempts_total: Number(attempts?.total ?? 0),
    promotions_total: Number(promotions?.total ?? 0),
    seeded_internal_actions: tools.filter((tool) => !MAP_EXCLUDED_TOOLS.has(tool.name)).length,
    model_tool_choice_allowed: false,
  };
}
