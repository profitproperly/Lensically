export const MANDATORY_RECOVERY_MAP_VERSION = "mandatory-recovery-map-v1";

export type RecoveryMapTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type RecoveryMapCallbacks = {
  sign: (payload: Record<string, unknown>) => Promise<string>;
  verify: (token: unknown) => Promise<Record<string, unknown> | null>;
};

export type PreparedRecoveryAction = {
  ok: boolean;
  error?: string;
  tool_name?: string;
  arguments?: Record<string, unknown>;
  state: "known" | "unknown" | "discovery";
  entry?: Record<string, unknown> | null;
  incident?: Record<string, unknown> | null;
  discovery_permit?: string | null;
  candidates?: Array<Record<string, unknown>>;
  execution?: Record<string, unknown>;
};

const EXCLUDED = new Set(["getRecoveryStartupContext", "executeMappedRecoveryIntent"]);
const STOP = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "do", "for", "from", "get", "how", "in", "is", "it", "of", "on", "or", "the", "this", "to", "use", "we", "with"]);

function text(value: unknown, max = 8000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, max) : null;
}

function key(value: unknown): string {
  return (text(value, 500)?.toLowerCase() ?? "unknown")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 160) || "unknown";
}

function splitName(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
}

function tokens(value: unknown): string[] {
  return Array.from(new Set((text(value, 12000)?.toLowerCase() ?? "").split(/[^a-z0-9]+/g).filter((item) => item.length > 1 && !STOP.has(item))));
}

function parseJson(value: unknown): Record<string, unknown> | null {
  const raw = text(value, 50000) ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function properties(tool: RecoveryMapTool): string[] {
  const raw = tool.inputSchema.properties;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? Object.keys(raw as Record<string, unknown>) : [];
}

function required(tool: RecoveryMapTool): string[] {
  return Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required.map(String) : [];
}

const EXPLICIT_ALIASES: Record<string, string[]> = {
  recoveryHealth: ["check recovery health", "verify recovery and main health"],
  getRepoStatus: ["inspect repository status", "read repository head", "get current repository sha"],
  readRepoFile: ["read repository file", "inspect source file"],
  searchRepoFiles: ["search repository", "find code in repository"],
  applyRepoTextPatch: ["apply exact repository patch", "patch repository file"],
  listGitHubWorkflowRuns: ["list workflow runs", "inspect recent github workflows"],
  runGitHubWorkflow: ["run github workflow", "dispatch engineering workflow", "run tests", "deploy worker"],
  getGitHubWorkflowRun: ["inspect workflow run", "read workflow result", "check workflow failure"],
  verifyMainMcp: ["verify main mcp", "inspect main mcp health"],
  getCloudflareWorkerState: ["inspect cloudflare worker", "read worker deployment state"],
  queryCloudflareTelemetry: ["query cloudflare telemetry", "inspect worker logs"],
  rollbackMainWorker: ["rollback main worker", "restore prior worker version"],
  startRepoFileWrite: ["start large repository file write"],
  appendRepoFileChunk: ["append repository file chunk"],
  commitRepoFileWrite: ["commit repository file write"],
  runMainMcpSmoke: ["run main mcp smoke", "verify live main mcp contract"],
};

function aliases(tool: RecoveryMapTool): string[] {
  return Array.from(new Set([splitName(tool.name), tool.title.toLowerCase(), tool.description.toLowerCase(), ...(EXPLICIT_ALIASES[tool.name] ?? [])]));
}

function score(intent: string, tool: RecoveryMapTool): number {
  const intentTokens = tokens(intent);
  let best = 0;
  for (const alias of aliases(tool)) {
    if (intent.toLowerCase() === alias) best = Math.max(best, 100);
    const aliasTokens = tokens(alias);
    const overlap = aliasTokens.filter((item) => intentTokens.includes(item));
    const coverage = aliasTokens.length ? overlap.length / aliasTokens.length : 0;
    best = Math.max(best, overlap.length * 4 + coverage * 6 + overlap.reduce((sum, item) => sum + Math.min(item.length, 10), 0) / 10);
  }
  return best;
}

function entryKey(intent: string): string {
  return `execution-map:entry:${key(intent)}`;
}

function staleKey(intent: string): string {
  return `execution-map:stale:${key(intent)}`;
}

function incidentKey(id: string): string {
  return `execution-map:incident:${id}`;
}

async function openIncident(
  kv: KVNamespace,
  input: { objective: string | null; action_intent: string; state: "unknown" | "stale"; failed_tool: string | null; inputs: Record<string, unknown>; failure?: Record<string, unknown> | null },
): Promise<Record<string, unknown>> {
  const id = crypto.randomUUID();
  const incident = {
    id,
    version: MANDATORY_RECOVERY_MAP_VERSION,
    status: "discovery_open",
    opened_at: new Date().toISOString(),
    ...input,
  };
  await kv.put(incidentKey(id), JSON.stringify(incident), { expirationTtl: 30 * 24 * 60 * 60 });
  return incident;
}

async function permit(callbacks: RecoveryMapCallbacks, incident: Record<string, unknown>): Promise<string> {
  return callbacks.sign({
    kind: "mandatory_recovery_discovery",
    version: MANDATORY_RECOVERY_MAP_VERSION,
    incident_id: incident.id,
    action_intent: incident.action_intent,
    exp: Math.floor(Date.now() / 1000) + 30 * 60,
  });
}

export async function prepareRecoveryAction(
  kv: KVNamespace,
  raw: Record<string, unknown>,
  tools: RecoveryMapTool[],
  callbacks: RecoveryMapCallbacks,
): Promise<PreparedRecoveryAction> {
  const actionIntent = text(raw.action_intent, 8000);
  const objective = text(raw.objective, 8000);
  const inputs = parseJson(raw.inputs_json);
  if (!actionIntent || !inputs) return { ok: false, error: "mandatory_recovery_map_input_invalid", state: "unknown" };

  const verified = await callbacks.verify(raw.discovery_permit);
  if (verified?.kind === "mandatory_recovery_discovery"
      && verified.version === MANDATORY_RECOVERY_MAP_VERSION
      && typeof verified.incident_id === "string") {
    const incident = await kv.get(incidentKey(verified.incident_id), "json") as Record<string, unknown> | null;
    const discoveryTool = text(raw.discovery_tool, 160);
    const tool = tools.find((item) => item.name === discoveryTool && !EXCLUDED.has(item.name));
    if (!incident || incident.status !== "discovery_open" || incident.action_intent !== actionIntent || !tool) {
      return { ok: false, error: "mandatory_recovery_discovery_invalid", state: "discovery", incident };
    }
    return {
      ok: true,
      tool_name: tool.name,
      arguments: inputs,
      state: "discovery",
      incident,
      discovery_permit: String(raw.discovery_permit),
      execution: {
        mode: "authorized_discovery",
        version: MANDATORY_RECOVERY_MAP_VERSION,
        objective,
        action_intent: actionIntent,
        incident_id: incident.id,
        failed_tool: incident.failed_tool ?? null,
        requested_inputs: inputs,
      },
    };
  }

  const promoted = await kv.get(entryKey(actionIntent), "json") as Record<string, unknown> | null;
  const stale = await kv.get(staleKey(actionIntent), "json") as Record<string, unknown> | null;
  if (stale && !promoted) {
    const incident = await openIncident(kv, {
      objective,
      action_intent: actionIntent,
      state: "stale",
      failed_tool: typeof stale.tool_name === "string" ? stale.tool_name : null,
      inputs,
      failure: stale.failure && typeof stale.failure === "object" ? stale.failure as Record<string, unknown> : null,
    });
    return { ok: false, error: "mandatory_recovery_path_stale", state: "unknown", incident, discovery_permit: await permit(callbacks, incident) };
  }

  let tool: RecoveryMapTool | undefined;
  let entry: Record<string, unknown> | null = null;
  if (promoted?.status === "active" && typeof promoted.tool_name === "string") {
    tool = tools.find((item) => item.name === promoted.tool_name);
    entry = promoted;
  }
  if (!tool) {
    const ranked = tools
      .filter((item) => !EXCLUDED.has(item.name))
      .map((item) => ({ tool: item, score: score(actionIntent, item) }))
      .filter((item) => item.score >= 8)
      .sort((left, right) => right.score - left.score);
    const first = ranked[0];
    const second = ranked[1];
    if (first && (first.score >= 18 || !second || first.score - second.score >= 4)) {
      tool = first.tool;
      entry = {
        id: `source:${tool.name}`,
        status: "active",
        version: 1,
        source: "source_defined_recovery_manual",
        action_intent: actionIntent,
        tool_name: tool.name,
      };
    } else {
      const incident = await openIncident(kv, { objective, action_intent: actionIntent, state: "unknown", failed_tool: null, inputs });
      return {
        ok: false,
        error: ranked.length ? "mandatory_recovery_map_ambiguous" : "mandatory_recovery_map_unknown",
        state: "unknown",
        incident,
        discovery_permit: await permit(callbacks, incident),
        candidates: ranked.slice(0, 5).map((item) => ({ tool_name: item.tool.name, score: item.score })),
      };
    }
  }

  const allowed = properties(tool);
  const filtered = Object.fromEntries(Object.entries(inputs).filter(([inputKey]) => allowed.includes(inputKey)));
  const missing = required(tool).filter((inputKey) => !Object.prototype.hasOwnProperty.call(filtered, inputKey));
  if (missing.length) return { ok: false, error: "mandatory_recovery_inputs_missing", state: "known", entry, candidates: missing.map((inputKey) => ({ missing_input: inputKey })) };
  return {
    ok: true,
    tool_name: tool.name,
    arguments: filtered,
    state: "known",
    entry,
    execution: {
      mode: "mandatory_known_path",
      version: MANDATORY_RECOVERY_MAP_VERSION,
      objective,
      action_intent: actionIntent,
      entry_id: entry?.id ?? null,
      mapped_tool: tool.name,
      requested_inputs: inputs,
      enforced_arguments: filtered,
      model_tool_choice_allowed: false,
    },
  };
}

async function recordAttempt(kv: KVNamespace, execution: Record<string, unknown>, toolName: string, args: Record<string, unknown>, result: Record<string, unknown>): Promise<void> {
  const id = crypto.randomUUID();
  const incidentId = typeof execution.incident_id === "string" ? execution.incident_id : "known";
  await kv.put(`execution-map:attempt:${incidentId}:${Date.now()}:${id}`, JSON.stringify({
    id,
    version: MANDATORY_RECOVERY_MAP_VERSION,
    created_at: new Date().toISOString(),
    action_intent: execution.action_intent,
    mode: execution.mode,
    incident_id: execution.incident_id ?? null,
    tool_name: toolName,
    arguments: args,
    outcome: result.ok === false ? "failed" : "succeeded",
    result: { ok: result.ok !== false, error: result.error ?? null, status: result.status ?? null, phase: result.phase ?? null },
  }), { expirationTtl: 90 * 24 * 60 * 60 });
}

export async function finalizeRecoveryAction(
  kv: KVNamespace,
  execution: Record<string, unknown> | null,
  toolName: string,
  args: Record<string, unknown>,
  result: Record<string, unknown>,
  callbacks: RecoveryMapCallbacks,
): Promise<Record<string, unknown> | null> {
  if (!execution) return null;
  await recordAttempt(kv, execution, toolName, args, result);
  const mode = text(execution.mode, 80);
  const actionIntent = text(execution.action_intent, 8000) ?? "unknown action";
  if (mode === "mandatory_known_path" && result.ok === false) {
    await kv.put(staleKey(actionIntent), JSON.stringify({
      version: MANDATORY_RECOVERY_MAP_VERSION,
      action_intent: actionIntent,
      tool_name: toolName,
      stale_at: new Date().toISOString(),
      failure: { error: result.error ?? null, status: result.status ?? null, phase: result.phase ?? null },
    }), { expirationTtl: 90 * 24 * 60 * 60 });
    await kv.delete(entryKey(actionIntent));
    const incident = await openIncident(kv, {
      objective: text(execution.objective, 8000),
      action_intent: actionIntent,
      state: "stale",
      failed_tool: toolName,
      inputs: execution.requested_inputs && typeof execution.requested_inputs === "object" && !Array.isArray(execution.requested_inputs)
        ? execution.requested_inputs as Record<string, unknown>
        : args,
      failure: { error: result.error ?? null, status: result.status ?? null, phase: result.phase ?? null },
    });
    return { version: MANDATORY_RECOVERY_MAP_VERSION, state: "known_path_became_stale", incident, discovery_permit: await permit(callbacks, incident), old_path_blocked: true, objective_may_resume: false };
  }
  if (mode === "authorized_discovery") {
    const incidentId = text(execution.incident_id, 160);
    const incident = incidentId ? await kv.get(incidentKey(incidentId), "json") as Record<string, unknown> | null : null;
    if (!incident) return { version: MANDATORY_RECOVERY_MAP_VERSION, state: "discovery_incident_missing", objective_may_resume: false };
    if (result.ok === false) {
      return { version: MANDATORY_RECOVERY_MAP_VERSION, state: "discovery_continues", incident, discovery_permit: await permit(callbacks, incident), failed_path_recorded: true, objective_may_resume: false };
    }
    const promoted = {
      id: crypto.randomUUID(),
      status: "active",
      version: 1,
      source: "verified_recovery_discovery",
      source_incident_id: incident.id,
      action_intent: actionIntent,
      tool_name: toolName,
      supersedes_tool: incident.failed_tool ?? null,
      verification_summary: `Successful recovery discovery through ${toolName}.`,
      activated_at: new Date().toISOString(),
    };
    await kv.put(entryKey(actionIntent), JSON.stringify(promoted));
    await kv.delete(staleKey(actionIntent));
    const resolved = { ...incident, status: "resolved", replacement_entry_id: promoted.id, resolved_at: new Date().toISOString() };
    await kv.put(incidentKey(String(incident.id)), JSON.stringify(resolved), { expirationTtl: 90 * 24 * 60 * 60 });
    return { version: MANDATORY_RECOVERY_MAP_VERSION, state: "discovery_promoted", active_entry: promoted, previous_path_superseded: Boolean(incident.failed_tool), mandatory_from_now_on: true, objective_may_resume: true };
  }
  return { version: MANDATORY_RECOVERY_MAP_VERSION, state: "known_path_completed", mandatory_path_followed: true, objective_may_resume: true };
}

export async function recoveryMapSummary(kv: KVNamespace, toolCount: number): Promise<Record<string, unknown>> {
  const [entries, incidents, attempts] = await Promise.all([
    kv.list({ prefix: "execution-map:entry:", limit: 1000 }),
    kv.list({ prefix: "execution-map:incident:", limit: 1000 }),
    kv.list({ prefix: "execution-map:attempt:", limit: 1000 }),
  ]);
  return {
    version: MANDATORY_RECOVERY_MAP_VERSION,
    internal_tool_count: toolCount,
    public_tool_count: 2,
    promoted_entries: entries.keys.length,
    incidents_recorded: incidents.keys.length,
    attempts_recorded: attempts.keys.length,
    model_tool_choice_allowed: false,
    enforcement: "Known recovery actions are mandatory. Unknown or stale recovery terrain requires a signed discovery incident and promotion before the objective resumes.",
  };
}
