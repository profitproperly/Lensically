export const MANDATORY_EXECUTION_MAP_VERSION = "mandatory-execution-map-v1";

export type MandatoryExecutionToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type MandatoryExecutionMapCallbacks = {
  signPermit: (payload: Record<string, unknown>) => Promise<string>;
  verifyPermit: (token: unknown) => Promise<Record<string, unknown> | null>;
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
  map_execution?: Record<string, unknown>;
};

const MAP_EXCLUDED_TOOLS = new Set([
  "getOperatorStartupContext",
  "guardLensicallyCall",
  "routeAndExecuteLensicallyCall",
  "executeMappedIntent",
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

function intentAliasesForTool(tool: MandatoryExecutionToolDefinition): string[] {
  const explicit: Record<string, string[]> = {
    engineeringPrecheck: ["inspect engineering state", "load engineering context", "engineering precheck"],
    getRepoStatus: ["inspect repository status", "get repository head", "read current repository sha"],
    readRepoFile: ["read repository file", "inspect source file", "open repo file"],
    searchRepoFiles: ["search repository", "find code in repository", "locate source implementation"],
    applyRepoPatchSet: ["apply implementation", "patch repository", "apply code changes", "implement repository changes"],
    applyRepoTextPatch: ["apply one exact patch", "replace exact repository text"],
    runEngineeringRelease: ["test and deploy release", "run engineering release", "validate and deploy current sha"],
    getEngineeringRelease: ["check engineering release", "wait for release completion"],
    verifyDeployedMcpVersion: ["verify live deployment", "verify deployed mcp", "confirm live version"],
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
  for (const tool of tools) {
    if (MAP_EXCLUDED_TOOLS.has(tool.name)) continue;
    const actionKey = actionKeyForTool(tool.name);
    const existing = await db.prepare(
      `SELECT id FROM operator_execution_map_entries
       WHERE action_key = ? AND status = 'active'
       ORDER BY version DESC LIMIT 1`,
    ).bind(actionKey).first<{ id: string }>();
    if (existing?.id) continue;
    await db.prepare(
      `INSERT INTO operator_execution_map_entries (
        id, action_key, version, status, task_class, intent_aliases_json, tool_name,
        fixed_arguments_json, allowed_input_keys_json, required_input_keys_json,
        forbidden_tools_json, success_rule_json, source_type, verification_summary, verified_at
      ) VALUES (?, ?, 1, 'active', ?, ?, ?, '{}', ?, ?, '[]', ?, 'tool_registry_seed', ?, CURRENT_TIMESTAMP)`,
    ).bind(
      crypto.randomUUID(),
      actionKey,
      toolCategory(tool.name),
      stringify(intentAliasesForTool(tool)),
      tool.name,
      stringify(toolSchemaProperties(tool)),
      stringify(toolRequiredProperties(tool)),
      stringify({ kind: "result_ok", failure_when: "result.ok === false" }),
      "Seeded from the live internal typed tool registry. The map, not the model, selects this tool for the matching action intent.",
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
  await seedMandatoryExecutionMap(db, tools);
  const actionIntent = normalizeText(rawInput.action_intent, 8000);
  const objective = normalizeText(rawInput.objective, 8000);
  const actionKey = normalizeText(rawInput.action_key, 300)?.toLowerCase() ?? null;
  const parsedInputs = safeJson(normalizeText(rawInput.inputs_json, 50000) ?? "{}", null);
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

  const permitPayload = await callbacks.verifyPermit(rawInput.discovery_permit);
  if (permitPayload?.kind === "mandatory_execution_map_discovery"
      && permitPayload.version === MANDATORY_EXECUTION_MAP_VERSION
      && typeof permitPayload.incident_id === "string") {
    const incident = await readOpenIncident(db, permitPayload.incident_id);
    const discoveryTool = normalizeText(rawInput.discovery_tool, 160);
    const tool = tools.find((item) => item.name === discoveryTool);
    if (!incident || !tool || MAP_EXCLUDED_TOOLS.has(tool.name)) {
      return {
        ok: false,
        error: "mandatory_execution_map_discovery_invalid",
        map_state: "discovery",
        incident,
      };
    }
    if (String(incident.action_intent) !== actionIntent || String(permitPayload.action_intent) !== actionIntent) {
      return {
        ok: false,
        error: "mandatory_execution_map_discovery_mismatch",
        map_state: "discovery",
        incident,
      };
    }
    return {
      ok: true,
      tool_name: tool.name,
      arguments: inputs,
      map_state: "discovery",
      incident,
      discovery_permit: String(rawInput.discovery_permit),
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
      },
    };
  }

  const found = await findActiveMapEntry(db, actionIntent, actionKey);
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
    return {
      ok: false,
      error: found.candidates.length ? "mandatory_execution_map_ambiguous" : "mandatory_execution_map_unknown",
      map_state: "unknown",
      incident,
      discovery_permit: await createDiscoveryPermit(callbacks, incident),
      candidates: found.candidates,
    };
  }

  const allowed = Array.isArray(found.entry.allowed_input_keys) ? found.entry.allowed_input_keys.map(String) : [];
  const required = Array.isArray(found.entry.required_input_keys) ? found.entry.required_input_keys.map(String) : [];
  const fixed = found.entry.fixed_arguments && typeof found.entry.fixed_arguments === "object" && !Array.isArray(found.entry.fixed_arguments)
    ? found.entry.fixed_arguments as Record<string, unknown>
    : {};
  const filteredInputs = Object.fromEntries(Object.entries(inputs).filter(([key]) => allowed.includes(key)));
  const argumentsObject = { ...fixed, ...filteredInputs };
  const missingInputs = required.filter((key) => !Object.prototype.hasOwnProperty.call(argumentsObject, key));
  if (missingInputs.length) {
    return {
      ok: false,
      error: "mandatory_execution_map_inputs_missing",
      map_state: "known",
      map_entry: found.entry,
      missing_inputs: missingInputs,
    };
  }
  return {
    ok: true,
    tool_name: String(found.entry.tool_name),
    arguments: argumentsObject,
    map_state: "known",
    map_entry: found.entry,
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

function isReusableExecutionPathFailure(toolName: string, result: Record<string, unknown>): boolean {
  if (result.ok !== false) return false;
  const status = Number(result.status ?? 0);
  const error = String(result.error ?? result.error_code ?? "").toLowerCase();
  const phase = String(result.phase ?? "").toLowerCase();
  if (status >= 500 || [502, 503, 504].includes(Number(result.status_code ?? 0))) return true;
  if (/transport|timeout|upstream|provider|connection|unavailable|head_changed|find_text_must_match|find_must_match|payload_too_large|client_preflight|schema_stale|unknown_runtime/.test(`${error} ${phase}`)) return true;
  if (/repo|github|workflow|deploy|cloudflare|file|patch|commit/i.test(toolName)
      && /not_found|missing|invalid_ref|exact_sha|conflict|rate_limit/.test(error)) return true;
  return false;
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
      forbidden_tools_json, success_rule_json, source_type, source_incident_id,
      supersedes_entry_id, verification_summary, verified_at
    ) VALUES (?, ?, ?, 'active', ?, ?, ?, '{}', ?, ?, ?, ?, 'verified_discovery', ?, ?, ?, CURRENT_TIMESTAMP)`,
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
    stringify({ kind: "result_ok", failure_when: "result.ok === false" }),
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
  await ensureMandatoryExecutionMapTables(db);
  const actionIntent = normalizeText(mapExecution.action_intent, 8000) ?? "unknown action";
  const mode = normalizeText(mapExecution.mode, 80) ?? "unknown";
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
