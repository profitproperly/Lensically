export const MANDATORY_EXECUTION_MAP_VERSION = "static-execution-router-v1";
export const EXECUTION_POLICY_LIBRARY_VERSION = "retired";

export type MandatoryExecutionToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ExecutionPolicyLibrarySource = {
  source_type: string;
  source_id: string;
  text: string;
  updated_at: string | null;
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

const ROUTER_EXCLUDED_TOOLS = new Set([
  "guardLensicallyCall",
  "routeAndExecuteLensicallyCall",
  "executeMappedIntent",
  "executeLensicallyIntent",
  "runEngineeringTool",
  "listOpsMemory",
  "searchOpsMemory",
  "readOpsMemory",
  "updateOpsMemory",
  "recordOpsMemory",
  "listPreCallRoutes",
  "recordPreCallRoute",
]);

const SOURCE_DEFINED_DIRECT_ENGINEERING_TOOLS = new Set([
  "engineeringPrecheck",
  "getEngineeringAccessState",
  "getRepoStatus",
  "listRepoFiles",
  "readRepoFile",
  "searchRepoFiles",
  "applyRepoPatchSet",
  "applyRepoTextPatch",
  "startRepoFileWrite",
  "appendRepoFileChunk",
  "commitRepoFileWrite",
  "createRepoFile",
  "deleteRepoFile",
  "runMcpTests",
  "runGitHubWorkflow",
  "listGitHubWorkflowRuns",
  "getGitHubWorkflowRun",
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

const INTENT_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "before", "by", "can", "do", "for", "from", "get", "how", "i", "in", "into",
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

function publicToolName(toolName: string): string {
  return toolName.replace(/^(?:mm|om|vx)_/, "");
}

function sourceDefinedEntry(tool: MandatoryExecutionToolDefinition, mode: string): Record<string, unknown> {
  return {
    id: `source:${tool.name}`,
    action_key: actionKeyForTool(tool.name),
    version: 1,
    status: "active",
    task_class: toolCategory(tool.name),
    tool_name: tool.name,
    source_type: mode,
    verification_summary: "Source-defined deterministic route selected before execution. Database policy lookup, discovery, incidents, promotions, and model tool choice are disabled.",
  };
}

const EXPLICIT_INTENT_ALIASES: Record<string, string[]> = {
  getOperatorStartupContext: ["startup", "operator startup", "fresh session startup", "load startup context"],
  selectOperatorKey: ["select operator key", "select key", "choose brand key", "set brand key"],
  confirmOperatorProceed: ["confirm operator proceed", "confirm proceed", "proceed to next step", "continue operator workflow"],
  getWorkflowStatus: ["get workflow status", "workflow status", "resume workflow state", "current workflow state"],
  engineeringPrecheck: ["engineering precheck", "mcp status", "operator status", "runtime status", "gateway status", "gateway health", "mcp health"],
  getEngineeringAccessState: ["engineering access state", "check engineering access", "verify engineering authority"],
  getRepoStatus: ["repository status", "repo status", "repository head", "current repository sha", "repository runtime alignment"],
  listRepoFiles: ["list repository files", "list repo files", "repository tree"],
  readRepoFile: ["read repository file", "inspect source file", "open repo file"],
  searchRepoFiles: ["search repository", "find code in repository", "locate source implementation", "repository search"],
  applyRepoPatchSet: ["apply implementation", "patch repository", "apply code changes", "implement repository changes", "engineering repair", "fix mcp", "fix gateway"],
  applyRepoTextPatch: ["apply one exact patch", "replace exact repository text", "single file repair"],
  runGitHubWorkflow: ["run typecheck", "run operator tests", "run gpt memory tests", "run regression tests"],
  runEngineeringRelease: ["test and deploy release", "run engineering release", "validate and deploy", "deploy worker", "deploy mcp", "release worker", "release mcp"],
  getEngineeringRelease: ["check engineering release", "release status", "wait for release completion"],
  verifyDeployedMcpVersion: ["verify live deployment", "verify deployed mcp", "confirm live version", "post deployment verification"],
  listEngineeringAudit: ["list engineering audit", "read engineering audit", "inspect execution audit"],
  inspectMcpFailure: ["inspect mcp failure", "diagnose gateway failure", "diagnose mcp", "inspect execution failure"],
  listMcpTools: ["list mcp tools", "inspect internal mcp registry"],
  get_hourly_coverage: ["get hourly coverage", "hourly coverage", "open schedule slots", "calendar coverage"],
  claim_manifest_review_batch: ["claim manifest review batch", "claim review batch"],
  get_manifest_review_batch: ["get manifest review batch", "read manifest review batch", "show review batch"],
  attach_manifest_review_draft: ["attach manifest review draft", "attach draft to review batch"],
  schedule_manifest_review_batch: ["schedule manifest review batch", "schedule review batch"],
  skip_manifest_review_source: ["skip manifest review source", "skip source"],
  draw_source_candidate_batch: ["draw source candidate batch", "select source candidates", "draw sources"],
  get_source_candidate_batch: ["get source candidate batch", "read source candidate batch"],
  create_source_card: ["create source card", "build source card"],
  create_generation_run: ["create generation run", "start generation run"],
  submit_candidate_draft: ["submit candidate draft", "save generated candidate", "gate draft"],
  mark_draft_shown: ["mark draft shown", "show draft"],
  approve_draft: ["approve draft", "approve post"],
  reject_draft: ["reject draft", "reject post"],
  schedule_approved_draft: ["schedule approved draft", "schedule approved post"],
  list_scheduled_posts: ["list scheduled posts", "scheduled posts", "scheduled calendar"],
  edit_scheduled_post: ["edit scheduled post", "update scheduled post", "retry scheduled post"],
  get_performance_learning: ["get performance learning", "performance learning", "account learning"],
};

function aliasesForTool(tool: MandatoryExecutionToolDefinition): string[] {
  return Array.from(new Set([
    splitCamel(tool.name),
    splitCamel(publicToolName(tool.name)),
    tool.title.toLowerCase(),
    tool.description.toLowerCase(),
    ...(EXPLICIT_INTENT_ALIASES[tool.name] ?? []),
    ...(EXPLICIT_INTENT_ALIASES[publicToolName(tool.name)] ?? []),
  ].map((item) => item.trim()).filter(Boolean)));
}

function deterministicToolForOperationalIntent(actionIntent: string, inputs: Record<string, unknown>): string | null {
  const text = `${actionIntent} ${normalizeText(inputs.intent_hint, 1000) ?? ""} ${normalizeText(inputs.path, 1000) ?? ""}`.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(text);
  if (/^startup$/.test(text.trim()) || has(/\boperator\s+startup\b/)) return "getOperatorStartupContext";
  if (has(/\bselect\b/) && has(/\b(key|brand)\b/)) return "selectOperatorKey";
  if (has(/\b(confirm|continue|proceed)\b/) && has(/\b(operator|workflow|step|proceed)\b/)) return "confirmOperatorProceed";
  if (has(/\bworkflow\s+status\b/) || has(/\bcurrent\s+workflow\s+state\b/)) return "getWorkflowStatus";
  if (has(/\bhourly\s+coverage\b/) || has(/\bcalendar\s+coverage\b/) || has(/\bopen\s+(schedule\s+)?slots\b/)) return "get_hourly_coverage";
  if (has(/\bengineering\s+access\b/) || has(/\b(access|authority)\b/) && has(/\b(engineering|github|cloudflare)\b/)) return "getEngineeringAccessState";
  if (
    has(/\b(mcp|operator|runtime|gateway)\b/) && has(/\b(status|health|version|versions)\b/)
    || has(/\bstatus\s+(request|check|verification)\b/)
    || has(/\bcheck\s+(mcp|operator|runtime|gateway)\b/)
  ) return "engineeringPrecheck";
  if (has(/\b(list|show)\b/) && has(/\b(repo|repository)\b/) && has(/\b(files|tree)\b/)) return "listRepoFiles";
  if (has(/\b(start|begin|open)\b/) && has(/\b(repo|repository)\b/) && has(/\b(file\s+write|write\s+session|chunked\s+write)\b/)) return "startRepoFileWrite";
  if (has(/\b(append|add)\b/) && has(/\b(repo|repository)\b/) && has(/\b(file\s+chunk|write\s+chunk|chunk)\b/)) return "appendRepoFileChunk";
  if (has(/\b(commit|finish|complete)\b/) && has(/\b(repo|repository)\b/) && has(/\b(file\s+write|write\s+session|chunked\s+write)\b/)) return "commitRepoFileWrite";
  if (has(/\b(create|add)\b/) && has(/\b(repo|repository)\b/) && has(/\bfile\b/)) return "createRepoFile";
  if (has(/\b(list|show|inspect)\b/) && has(/\b(workflow|github)\b/) && has(/\b(runs|history)\b/)) return "listGitHubWorkflowRuns";
  if (has(/\b(get|read|inspect|check|wait)\b/) && has(/\b(workflow|github|release)\b/) && has(/\b(run|status|result|completion)\b/)) {
    if (has(/\bengineering\s+release\b/) || has(/\brelease\s+(status|completion|result)\b/)) return "getEngineeringRelease";
    return "getGitHubWorkflowRun";
  }
  if (has(/\b(runtime\/repository|repository\/runtime|runtime repository|repository runtime|repo runtime|runtime source|source runtime)\b/) && has(/\b(alignment|verify|verification|sha|status|current)\b/)) return "getRepoStatus";
  if (has(/\b(deployed|deployment|post[- ]?deployment|live)\b/) && has(/\b(verify|verification|alignment|mcp|version)\b/)) return "verifyDeployedMcpVersion";
  if (has(/\b(search|find|locate)\b/) && has(/\b(repo|repository|code|source|file)\b/)) return "searchRepoFiles";
  if (has(/\b(repository|repo|source|file)\b/) && has(/\b(read|inspect|open|status|sha|head)\b/)) {
    if (normalizeText(inputs.path, 1000) || has(/\b(read|open|file|source)\b/)) return "readRepoFile";
    return "getRepoStatus";
  }
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
  if (has(/\b(deploy|deployment|release)\b/) && has(/\b(run|perform|execute|ship|deploy|release)\b/)) return "runEngineeringRelease";
  if (has(/\bclaim\b/) && has(/\bmanifest\b/) && has(/\breview\s+batch\b/)) return "claim_manifest_review_batch";
  if (has(/\b(get|read|show)\b/) && has(/\bmanifest\b/) && has(/\breview\s+batch\b/)) return "get_manifest_review_batch";
  if (has(/\battach\b/) && has(/\bdraft\b/) && has(/\breview\s+batch\b/)) return "attach_manifest_review_draft";
  if (has(/\bschedule\b/) && has(/\breview\s+batch\b/)) return "schedule_manifest_review_batch";
  if (has(/\bskip\b/) && has(/\b(source|candidate)\b/)) return "skip_manifest_review_source";
  if (has(/\b(draw|select)\b/) && has(/\bsource\s+candidates?\b/)) return "draw_source_candidate_batch";
  if (has(/\b(get|read|show)\b/) && has(/\bsource\s+candidate\s+batch\b/)) return "get_source_candidate_batch";
  if (has(/\bcreate\b/) && has(/\bsource\s+card\b/)) return "create_source_card";
  if (has(/\bcreate\b/) && has(/\bgeneration\s+run\b/)) return "create_generation_run";
  if (has(/\bsubmit\b/) && has(/\b(candidate\s+)?draft\b/)) return "submit_candidate_draft";
  if (has(/\bmark\b/) && has(/\bdraft\b/) && has(/\bshown\b/)) return "mark_draft_shown";
  if (has(/\bapprove\b/) && has(/\b(draft|post)\b/)) return "approve_draft";
  if (has(/\breject\b/) && has(/\b(draft|post)\b/)) return "reject_draft";
  if (has(/\bschedule\b/) && has(/\bapproved\b/) && has(/\b(draft|post)\b/)) return "schedule_approved_draft";
  if (has(/\b(list|show|get)\b/) && has(/\bscheduled\s+posts?\b/)) return "list_scheduled_posts";
  if (has(/\b(edit|update|retry)\b/) && has(/\bscheduled\s+post\b/)) return "edit_scheduled_post";
  if (has(/\bperformance\s+learning\b/) || has(/\baccount\s+learning\b/)) return "get_performance_learning";
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

function routeScore(actionIntent: string, tool: MandatoryExecutionToolDefinition, inputs: Record<string, unknown>): number {
  const normalizedIntent = actionIntent.toLowerCase().trim();
  const intentTokens = tokenize(normalizedIntent);
  let best = 0;
  for (const alias of aliasesForTool(tool)) {
    const normalizedAlias = alias.toLowerCase().trim();
    if (!normalizedAlias) continue;
    if (normalizedIntent === normalizedAlias) best = Math.max(best, 100);
    if (normalizedIntent.includes(normalizedAlias) || normalizedAlias.includes(normalizedIntent)) best = Math.max(best, 35);
    const aliasTokens = tokenize(normalizedAlias);
    const overlap = aliasTokens.filter((token) => intentTokens.includes(token));
    const coverage = aliasTokens.length ? overlap.length / aliasTokens.length : 0;
    const specificity = overlap.reduce((total, token) => total + Math.min(token.length, 10), 0) / 10;
    best = Math.max(best, overlap.length * 5 + coverage * 10 + specificity);
  }
  const explicitKey = machineKey(actionIntent, "");
  if (explicitKey && [machineKey(tool.name), machineKey(publicToolName(tool.name))].includes(explicitKey)) best += 120;
  const brandKey = normalizeText(inputs.brand_key, 80);
  const scopedPrefix = brandKey === "manifest_mental" ? "mm_" : brandKey === "opmg_deadman" ? "om_" : brandKey === "vectrix" ? "vx_" : null;
  if (scopedPrefix) {
    if (tool.name.startsWith(scopedPrefix)) best += 2;
    if (!/^(?:mm|om|vx)_/.test(tool.name)) best += 4;
  }
  return best;
}

function availableTools(tools: MandatoryExecutionToolDefinition[]): MandatoryExecutionToolDefinition[] {
  return tools.filter((tool) => !ROUTER_EXCLUDED_TOOLS.has(tool.name));
}

function resolveStaticTool(
  actionIntent: string,
  actionKey: string | null,
  inputs: Record<string, unknown>,
  tools: MandatoryExecutionToolDefinition[],
): { tool: MandatoryExecutionToolDefinition | null; candidates: Array<Record<string, unknown>> } {
  const usable = availableTools(tools);
  if (actionKey) {
    const normalizedActionKey = machineKey(actionKey, "");
    const exact = usable.find((tool) => [machineKey(tool.name), machineKey(publicToolName(tool.name)), machineKey(actionKeyForTool(tool.name))].includes(normalizedActionKey));
    if (exact) return { tool: exact, candidates: [{ tool_name: exact.name, score: 1000 }] };
  }
  const deterministic = deterministicToolForOperationalIntent(actionIntent, inputs);
  if (deterministic) {
    const exact = usable.find((tool) => tool.name === deterministic)
      ?? usable.find((tool) => publicToolName(tool.name) === deterministic);
    if (exact) return { tool: exact, candidates: [{ tool_name: exact.name, score: 900 }] };
  }
  const ranked = usable
    .map((tool) => ({ tool, score: routeScore(actionIntent, tool, inputs) }))
    .filter((item) => item.score >= 8)
    .sort((left, right) => right.score - left.score || left.tool.name.localeCompare(right.tool.name));
  return {
    tool: ranked[0]?.tool ?? null,
    candidates: ranked.slice(0, 5).map((item) => ({ tool_name: item.tool.name, action_key: actionKeyForTool(item.tool.name), score: Number(item.score.toFixed(2)) })),
  };
}

function prepareStaticCall(
  actionIntent: string,
  objective: string | null,
  actionKey: string | null,
  inputs: Record<string, unknown>,
  tools: MandatoryExecutionToolDefinition[],
  engineeringOnly = false,
): MandatoryExecutionPrepared | null {
  const resolved = resolveStaticTool(actionIntent, actionKey, inputs, tools);
  if (!resolved.tool) return null;
  if (engineeringOnly && !SOURCE_DEFINED_DIRECT_ENGINEERING_TOOLS.has(resolved.tool.name)) return null;
  const allowed = toolSchemaProperties(resolved.tool);
  const required = toolRequiredProperties(resolved.tool);
  const filteredInputs = Object.fromEntries(Object.entries(inputs).filter(([key]) => allowed.includes(key)));
  const argumentsObject = { ...inferredArgumentsForOperationalIntent(resolved.tool.name, actionIntent), ...filteredInputs };
  const missingInputs = required.filter((key) => !Object.prototype.hasOwnProperty.call(argumentsObject, key));
  const mode = SOURCE_DEFINED_DIRECT_ENGINEERING_TOOLS.has(resolved.tool.name)
    ? "source_defined_direct_engineering"
    : "source_defined_static_route";
  const entry = sourceDefinedEntry(resolved.tool, mode);
  if (missingInputs.length) {
    return {
      ok: false,
      error: "static_router_inputs_missing",
      map_state: "known",
      map_entry: entry,
      missing_inputs: missingInputs,
      candidates: resolved.candidates,
    };
  }
  return {
    ok: true,
    tool_name: resolved.tool.name,
    arguments: argumentsObject,
    map_state: "known",
    map_entry: entry,
    candidates: resolved.candidates,
    map_execution: {
      version: MANDATORY_EXECUTION_MAP_VERSION,
      mode,
      action_intent: actionIntent,
      action_key: entry.action_key,
      objective,
      entry_id: entry.id,
      entry_version: entry.version,
      mapped_tool: resolved.tool.name,
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

export function prepareSourceDefinedDirectEngineeringCall(
  actionIntent: string,
  objective: string | null,
  inputs: Record<string, unknown>,
  tools: MandatoryExecutionToolDefinition[],
): MandatoryExecutionPrepared | null {
  return prepareStaticCall(actionIntent, objective, null, inputs, tools, true);
}

export async function prepareMandatoryExecutionMapCall(
  _db: D1Database,
  rawInput: Record<string, unknown>,
  tools: MandatoryExecutionToolDefinition[],
  _callbacks: MandatoryExecutionMapCallbacks,
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
      error: "static_router_input_invalid",
      map_state: "unknown",
    };
  }

  const prepared = prepareStaticCall(actionIntent, objective, actionKey, inputs, tools);
  if (prepared) return prepared;

  const candidates = availableTools(tools)
    .map((tool) => ({ tool_name: tool.name, action_key: actionKeyForTool(tool.name), score: routeScore(actionIntent, tool, inputs) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((item) => ({ ...item, score: Number(item.score.toFixed(2)) }));
  return {
    ok: false,
    error: "static_router_unknown_intent",
    map_state: "unknown",
    candidates,
  };
}

export async function finalizeMandatoryExecutionMapCall(
  _db: D1Database,
  mapExecution: Record<string, unknown> | null,
  toolName: string,
  _args: Record<string, unknown>,
  result: Record<string, unknown>,
  _tools: MandatoryExecutionToolDefinition[],
  _callbacks: MandatoryExecutionMapCallbacks,
): Promise<Record<string, unknown> | null> {
  if (!mapExecution) return null;
  const actionIntent = normalizeText(mapExecution.action_intent, 8000) ?? "unknown action";
  const mode = normalizeText(mapExecution.mode, 80) ?? "source_defined_static_route";
  return {
    version: MANDATORY_EXECUTION_MAP_VERSION,
    map_state: result.ok === false ? "source_defined_route_failed" : "source_defined_route_completed",
    route_mode: mode,
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

export async function getMandatoryExecutionMapSummary(
  _db: D1Database,
  tools: MandatoryExecutionToolDefinition[],
): Promise<Record<string, unknown>> {
  const usable = availableTools(tools);
  return {
    version: MANDATORY_EXECUTION_MAP_VERSION,
    enforcement: "Every external action is resolved from source-defined intent aliases and live typed schemas. Database routing, discovery, incidents, promotions, and model tool choice are disabled.",
    route_source: "source_control",
    active_internal_actions: usable.length,
    direct_engineering_actions: usable.filter((tool) => SOURCE_DEFINED_DIRECT_ENGINEERING_TOOLS.has(tool.name)).length,
    retired_internal_actions: tools.filter((tool) => ROUTER_EXCLUDED_TOOLS.has(tool.name)).map((tool) => tool.name),
    d1_execution_library_bypassed: true,
    discovery_allowed: false,
    model_tool_choice_allowed: false,
  };
}
