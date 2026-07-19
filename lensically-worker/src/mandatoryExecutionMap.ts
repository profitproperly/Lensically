import { resolveLensicallySystemDirectory } from "./systemDirectory";

export const MANDATORY_EXECUTION_MAP_VERSION = "static-execution-router-v1";
export const EXECUTION_POLICY_LIBRARY_VERSION = "retired";
export const DEFECT_GENERALIZATION_GATE_VERSION = "defect-generalization-gate-v1";
export const WINNING_PATH_PROMOTION_VERSION = "winning-path-promotion-v1";

export type DefectClass = "isolated" | "duplicated_assumption" | "contract_drift" | "architectural_drift" | "known_recurrence" | "external_transient";
export type WinningPathSurface = "main_gateway" | "recovery_plane" | "runtime_guard" | "source_control";
export type WinningPathPromotion = {
  id: string;
  status: "active" | "superseded";
  priority: number;
  defect_class: DefectClass;
  matching_conditions: {
    all_terms?: string[];
    any_terms?: string[];
    min_input_characters?: number;
  };
  losing_path: string;
  winning_path: {
    surface: WinningPathSurface;
    route_intent?: string;
    procedure: string[];
  };
  evidence: string[];
  scope: "isolated" | "component" | "account" | "universal";
  enforcement_point: string;
  regression_test_id: string;
  supersedes?: string;
  supersession_rule: string;
};

export type PreventableIncidentClosureInput = {
  cause_classified?: boolean;
  winning_path_proven?: boolean;
  scope_determined?: boolean;
  winning_path_promoted?: boolean;
  losing_path_prohibited?: boolean;
  enforcement_installed?: boolean;
  regression_passed?: boolean;
  original_objective_completed?: boolean;
};

export const WINNING_PATH_PROMOTIONS: readonly WinningPathPromotion[] = [
  {
    id: "scheduled_publish_unknown_state_quarantine",
    status: "active",
    priority: 300,
    defect_class: "known_recurrence",
    matching_conditions: {
      any_terms: ["duplicate post", "double post", "publish retry", "scheduler retry", "status transition", "posting state"],
    },
    losing_path: "Return a scheduled post to approved after an external publish attempt, infer staleness through raw timestamp-string comparison, retry while the provider result is uncertain, or leave the scheduler operational while a publish is quarantined.",
    winning_path: {
      surface: "runtime_guard",
      procedure: ["Acquire the approved-to-posting claim atomically.", "Create the Threads container and poll its status until FINISHED before committing.", "Call threads_publish exactly once after readiness succeeds.", "Compare processing timestamps through SQLite datetime normalization.", "Keep failed, stale, or ambiguous external attempts quarantined in posting.", "Pause the scheduler immediately when any quarantined publish exists.", "Treat a returned Threads post ID as authoritative.", "Require explicit reconciliation before any new publish attempt."],
    },
    evidence: ["Cloudflare telemetry showed scheduled posts 579 and 580 claimed by fetch and alarm invocations seconds apart.", "One concurrent attempt published successfully while the sibling failed its local posting-to-posted transition.", "The stale cutoff used ISO text against SQLite CURRENT_TIMESTAMP text, immediately reopening active posting rows.", "The July 18 8:00 PM failure remained quarantined while scheduler health still reported normal and operational, leaving later slots exposed."],
    scope: "universal",
    enforcement_point: "Scheduled-post state machine, automatic quarantine pause, health fail-closed behavior, normalized stale-state guard, and focused Operator regressions.",
    regression_test_id: "never reopens stale posting rows after an external publish attempt",
    supersession_rule: "A replacement must preserve at-most-once external publication and require positive reconciliation evidence before retrying an uncertain attempt.",
  },
  {
    id: "large_repository_mutation_recovery",
    status: "active",
    priority: 200,
    defect_class: "contract_drift",
    matching_conditions: {
      any_terms: ["implement", "implementation", "patch", "repair", "architecture", "repository"],
      min_input_characters: 3000,
    },
    losing_path: "Submit one large repository-mutation specification through the public gateway.",
    winning_path: {
      surface: "recovery_plane",
      procedure: ["Inspect bounded known source.", "Apply compact phrase-level exact patches.", "Run focused validation.", "Release the exact tested head."],
    },
    evidence: ["The public implementation payload was rejected before the gateway received it.", "Bounded Recovery inspection and exact patches were accepted."],
    scope: "universal",
    enforcement_point: "Mandatory Execution Map pre-action resolution and client-safe request registry.",
    regression_test_id: "routes large repository mutations to the promoted Recovery path",
    supersession_rule: "Replace only after a newer verified request profile completes the same operation with less risk or cost.",
  },
  {
    id: "multi_stage_engineering_implementation_first",
    status: "active",
    priority: 100,
    defect_class: "contract_drift",
    matching_conditions: {
      all_terms: ["architecture"],
      any_terms: ["release", "deploy", "verify", "validation"],
    },
    losing_path: "Route a multi-stage engineering objective directly to final verification or leave it unknown.",
    winning_path: {
      surface: "main_gateway",
      route_intent: "apply implementation",
      procedure: ["Implement first.", "Run focused validation.", "Release the exact tested head.", "Verify production."],
    },
    evidence: ["The broad end-to-end implementation objective was not classified.", "The deterministic implementation route is the required first stage."],
    scope: "universal",
    enforcement_point: "Mandatory Execution Map pre-action resolution.",
    regression_test_id: "promotes multi-stage architecture work to implementation before release",
    supersession_rule: "A replacement must preserve implementation-before-verification ordering and pass the same regression.",
  },
  {
    id: "bounded_integration_test_timeout",
    status: "active",
    priority: 100,
    defect_class: "contract_drift",
    matching_conditions: {
      all_terms: ["test", "timeout"],
      any_terms: ["integration", "database", "d1", "workflow"],
    },
    losing_path: "Rely on the five-second unit-test default for a bounded integration regression with database setup and MCP execution.",
    winning_path: {
      surface: "source_control",
      procedure: ["Keep the production behavior unchanged.", "Assign a bounded timeout to the specific integration regression.", "Do not raise the global test timeout.", "Re-run the deterministic shard."],
    },
    evidence: ["The monthly-growth integration regression completed beyond the five-second default while neighboring shard tests passed."],
    scope: "component",
    enforcement_point: "Focused integration test definition and deterministic shard regression.",
    regression_test_id: "records the bounded integration-test timeout winning path",
    supersession_rule: "Remove the explicit timeout only after the test is measurably optimized below the default across repeated deterministic runs.",
  },
  {
    id: "operator_mcp_version_single_source",
    status: "active",
    priority: 100,
    defect_class: "duplicated_assumption",
    matching_conditions: {
      all_terms: ["operator", "version"],
      any_terms: ["release", "bump", "deploy", "metadata"],
    },
    losing_path: "Maintain the Operator MCP semantic version independently in source code and architecture documentation.",
    winning_path: {
      surface: "source_control",
      procedure: ["Write the version only in OPERATOR_MCP_VERSION.", "Keep architecture documentation versionless.", "Verify artifact, runtime version, deployment commit, and exact release head."],
    },
    evidence: ["A manually duplicated CURRENT_STATE version caused a release-preflight failure."],
    scope: "universal",
    enforcement_point: "Release preflight.",
    regression_test_id: "keeps Operator MCP version metadata single-source",
    supersession_rule: "Any replacement must retain one writable version source and fail closed on runtime or artifact mismatch.",
  },
];

const PREVENTABLE_INCIDENT_CLOSURE_STEPS = [
  "cause_classified",
  "winning_path_proven",
  "scope_determined",
  "winning_path_promoted",
  "losing_path_prohibited",
  "enforcement_installed",
  "regression_passed",
  "original_objective_completed",
] as const;

function winningPathContextText(actionIntent: string, objective: string | null, inputs: Record<string, unknown>): string {
  return `${objective ?? ""} ${actionIntent} ${JSON.stringify(inputs)}`.toLowerCase();
}

export function validateWinningPathPromotions(promotions: readonly WinningPathPromotion[] = WINNING_PATH_PROMOTIONS): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const ids = promotions.map((promotion) => promotion.id);
  if (new Set(ids).size !== ids.length) errors.push("duplicate_winning_path_id");
  const idSet = new Set(ids);
  for (const promotion of promotions) {
    if (!promotion.losing_path.trim() || !promotion.winning_path.procedure.length || !promotion.evidence.length) errors.push(`winning_path_incomplete:${promotion.id}`);
    if (!promotion.enforcement_point.trim() || !promotion.regression_test_id.trim() || !promotion.supersession_rule.trim()) errors.push(`winning_path_enforcement_incomplete:${promotion.id}`);
    if (promotion.supersedes && !idSet.has(promotion.supersedes)) errors.push(`winning_path_supersedes_unknown:${promotion.id}:${promotion.supersedes}`);
    if (!promotion.matching_conditions.all_terms?.length && !promotion.matching_conditions.any_terms?.length && promotion.matching_conditions.min_input_characters === undefined) errors.push(`winning_path_match_missing:${promotion.id}`);
  }
  return { ok: errors.length === 0, errors };
}

export function resolvePromotedWinningPath(actionIntent: string, objective: string | null, inputs: Record<string, unknown>): WinningPathPromotion | null {
  const text = winningPathContextText(actionIntent, objective, inputs);
  const inputCharacters = JSON.stringify(inputs).length;
  return [...WINNING_PATH_PROMOTIONS]
    .filter((promotion) => promotion.status === "active")
    .filter((promotion) => {
      const conditions = promotion.matching_conditions;
      if (conditions.min_input_characters !== undefined && inputCharacters < conditions.min_input_characters) return false;
      if (conditions.all_terms?.some((term) => !text.includes(term.toLowerCase()))) return false;
      if (conditions.any_terms?.length && !conditions.any_terms.some((term) => text.includes(term.toLowerCase()))) return false;
      return true;
    })
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))[0] ?? null;
}

export function evaluatePreventableIncidentClosure(input: PreventableIncidentClosureInput): { closure_allowed: boolean; missing_steps: string[] } {
  const missingSteps = PREVENTABLE_INCIDENT_CLOSURE_STEPS.filter((step) => input[step] !== true);
  return { closure_allowed: missingSteps.length === 0, missing_steps: missingSteps };
}
export type DefectGeneralizationResult = {
  version: typeof DEFECT_GENERALIZATION_GATE_VERSION;
  activated: true;
  defect_class: DefectClass;
  sibling_scan_required: boolean;
  prevention_disposition: "bounded_local_fix" | "bounded_external_handling" | "targeted_sibling_scan_required_before_local_fix";
  local_fix_closure_allowed: boolean;
  evidence: string[];
};

const GENERALIZABLE_DEFECT_CLASSES = new Set<DefectClass>([
  "duplicated_assumption",
  "contract_drift",
  "architectural_drift",
  "known_recurrence",
]);

function defectEvidenceText(actionIntent: string, result: Record<string, unknown>): string {
  const values: unknown[] = [
    actionIntent,
    result.error,
    result.status,
    result.phase,
    result.likely_cause,
    result.recommended_fix_path,
    result.contradiction === true || result.contract_contradiction === true ? "explicit contradiction" : null,
  ];
  return values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .map((value) => String(value))
    .join(" ")
    .toLowerCase();
}

export function classifyDefectForGeneralization(
  actionIntent: string,
  result: Record<string, unknown>,
): DefectGeneralizationResult {
  const text = defectEvidenceText(actionIntent, result);
  const evidence: string[] = [];
  let defectClass: DefectClass = "isolated";

  if (/\b(recurr|again|same failure|known failure|previously|keeps happening|repeat(?:ed|ing)?)\b/.test(text)) {
    defectClass = "known_recurrence";
    evidence.push("recurrence_signal");
  } else if (/\b(stale|hard[- ]?coded|literal|duplicate|duplicated|multiple copies|canonical source|single source of truth)\b/.test(text)) {
    defectClass = "duplicated_assumption";
    evidence.push("shared_assumption_signal");
  } else if (/\b(obsolete|legacy|architecture|architectural|preflight|algorithm|boundary|structural drift)\b/.test(text)) {
    defectClass = "architectural_drift";
    evidence.push("architecture_drift_signal");
  } else if (/\b(schema|contract|assertion|expectation|mismatch|misroute|wrong route|unknown intent|client[- ]side rejection|contradiction)\b/.test(text)) {
    defectClass = "contract_drift";
    evidence.push("contract_drift_signal");
  } else if (/\b(timeout|timed out|rate limit|network|upstream|502|503|504|temporar(?:y|ily)|unavailable)\b/.test(text)) {
    defectClass = "external_transient";
    evidence.push("external_transient_signal");
  } else {
    evidence.push("bounded_isolated_signal");
  }

  const siblingScanRequired = GENERALIZABLE_DEFECT_CLASSES.has(defectClass);
  return {
    version: DEFECT_GENERALIZATION_GATE_VERSION,
    activated: true,
    defect_class: defectClass,
    sibling_scan_required: siblingScanRequired,
    prevention_disposition: siblingScanRequired
      ? "targeted_sibling_scan_required_before_local_fix"
      : defectClass === "external_transient"
        ? "bounded_external_handling"
        : "bounded_local_fix",
    local_fix_closure_allowed: !siblingScanRequired,
    evidence,
  };
}

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
    "verifyDeployedMcpVersion",
  "listEngineeringAudit",
  "inspectMcpFailure",
  "listMcpTools",
  "readMcpToolDefinition",
]);

const INTENT_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "before", "by", "can", "do", "for", "from", "get", "how", "i", "in", "into",
  "is", "it", "me", "of", "on", "or", "our", "please", "read", "run", "that", "the", "this", "to", "use", "we", "with", "want",
]);

type IntentOperationClass = "read" | "mutation" | "unknown";

function classifyIntentOperation(value: unknown): IntentOperationClass {
  const text = normalizeText(value, 12000)?.toLowerCase() ?? "";
  if (!text) return "unknown";
  if (/\b(create|add|update|revise|approve|activate|pause|change|apply|patch|fix|implement|delete|remove|discard|clear|retire|schedule|publish|submit|attach|skip|recover|prepare|start|advance|set|mark|promote|save|execute|claim|draw|propose|resolve|retry)\b/.test(text)) {
    return "mutation";
  }
  if (/\b(get|list|read|show|inspect|audit|verify|calculate|rank|find|compare|report|status|health)\b/.test(text)) {
    return "read";
  }
  return "unknown";
}

function operationClassesCompatible(requested: IntentOperationClass, candidate: IntentOperationClass): boolean {
  return requested !== "unknown" && candidate !== "unknown" && requested === candidate;
}

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
  getOperatorStartupContext: ["load operator context", "startup", "operator startup", "fresh session startup", "load startup context"],
  selectOperatorKey: ["select operator key", "select key", "choose brand key", "set brand key"],
  confirmOperatorProceed: ["confirm operator proceed", "confirm proceed", "proceed to next step", "continue operator workflow"],
  getGrowthMission: ["get growth mission", "show growth mission", "growth mission brief", "current growth plan", "read growth plan"],
  updateGrowthMission: ["update growth mission", "revise growth mission", "approve growth mission", "update growth plan", "revise growth plan", "approve growth plan"],
  getWorkflowStatus: ["get workflow status", "workflow status", "resume workflow state", "current workflow state"],
  engineeringPrecheck: ["engineering precheck", "mcp status", "operator status", "runtime status", "gateway status", "gateway health", "mcp health"],
  getEngineeringAccessState: ["engineering access state", "check engineering access", "verify engineering authority"],
  getRepoStatus: ["repository status", "repo status", "repository head", "current repository sha", "repository runtime alignment"],
  listRepoFiles: ["list repository files", "list repo files", "repository tree"],
  readRepoFile: ["read repository file", "inspect source file", "open repo file"],
  
  applyRepoPatchSet: ["apply implementation", "patch repository", "apply code changes", "implement repository changes", "engineering repair", "fix mcp", "fix gateway"],
  applyRepoTextPatch: ["apply one exact patch", "replace exact repository text", "single file repair"],
  deleteRepoFile: ["delete repository file", "delete repo file", "remove repository file", "remove repo file"],
  runGitHubWorkflow: ["run typecheck", "run operator tests", "run gpt memory tests", "run regression tests"],
  
  verifyDeployedMcpVersion: ["verify live deployment", "verify deployed mcp", "confirm live version", "post deployment verification"],
  listEngineeringAudit: ["list engineering audit", "read engineering audit", "inspect execution audit"],
  inspectMcpFailure: ["inspect mcp failure", "diagnose gateway failure", "diagnose mcp", "inspect execution failure"],
    listMcpTools: ["list mcp tools", "inspect internal mcp registry"],
  readMcpToolDefinition: ["read capability definition", "inspect capability definition", "read capability schema"],
  get_hourly_coverage: ["get hourly coverage", "hourly coverage", "open schedule slots", "calendar coverage"],
  read_lensically_ui_surface: ["read lensically ui surface", "read saved patterns", "list saved patterns", "read post archive", "list post archive", "read live insights", "list insights posts", "read follower history", "read dashboard"],
  claim_manifest_review_batch: ["claim manifest review batch", "claim review batch"],
  get_manifest_review_batch: ["get manifest review batch", "read manifest review batch", "show review batch"],
  discard_manifest_review_batch: ["discard manifest review batch", "retire manifest review batch", "scrap manifest review batch", "discard stale review batch"],
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
  get_monthly_growth_review: [
    "get monthly growth review",
    "monthly growth review",
    "follower growth this month",
    "followers grown this month",
    "best posts this month",
    "top posts this month",
    "monthly follower growth and top posts",
  ],
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
  if (/^startup$/.test(text.trim()) || has(/\boperator\s+startup\b/) || has(/\bload\s+operator\s+context\b/)) return "getOperatorStartupContext";
  if (has(/\bselect\b/) && has(/\b(key|brand)\b/)) return "selectOperatorKey";
  if (has(/\b(confirm|continue|proceed)\b/) && has(/\b(operator|workflow|step|proceed)\b/)) return "confirmOperatorProceed";
  if (has(/\b(update|revise|approve|activate|pause|change)\b/) && has(/\b(growth\s+mission|growth\s+plan|mission\s+brief)\b/)) return "updateGrowthMission";
  if (has(/\b(get|read|show|current|review|discuss)\b/) && has(/\b(growth\s+mission|growth\s+plan|mission\s+brief)\b/)) return "getGrowthMission";
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
  if (has(/\b(delete|remove)\b/) && has(/\b(repo|repository)\b/) && has(/\bfile\b/)) return "deleteRepoFile";
    if (has(/\b(create|add)\b/) && has(/\b(repo|repository)\b/) && has(/\bfile\b/)) return "createRepoFile";
  if (has(/\b(read|inspect|show)\b/) && has(/\b(capability|schema|definition)\b/)) return "readMcpToolDefinition";
  if (has(/\b(list|show|inspect)\b/) && has(/\b(workflow|github)\b/) && has(/\b(runs|history|activity)\b/)) return "listGitHubWorkflowRuns";
    if (has(/\b(get|read|inspect|check|wait)\b/) && has(/\b(workflow|github)\b/) && has(/\b(run|status|result|completion)\b/)) return "getGitHubWorkflowRun";
  if (has(/\b(runtime\/repository|repository\/runtime|runtime repository|repository runtime|repo runtime|runtime source|source runtime)\b/) && has(/\b(alignment|verify|verification|sha|status|current)\b/)) return "getRepoStatus";
  if (has(/\b(engineering|repository|repo|code|source|gateway|mcp|operator|architecture)\b/) && has(/\b(repair|apply|patch|fix|implement|change|dry[- ]?run)\b/)) return "applyRepoPatchSet";
  if (has(/\b(deployed|deployment|post[- ]?deployment|live)\b/) && has(/\b(verify|verification|alignment|mcp|version)\b/)) return "verifyDeployedMcpVersion";
  
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
    
  if (has(/\btypecheck\b/) || has(/\boperator\s+tests?\b/) || has(/\bgpt\s+memory\s+tests?\b/) || has(/\bregression\s+tests?\b/)) return "runGitHubWorkflow";
  if (has(/\b(run mcp tests?|mcp self checks?|built-in mcp checks?|gateway configuration|mcp configuration)\b/)) return "runMcpTests";
  if (has(/\b(read|list|show|get|pull)\b/) && has(/\b(saved\s+patterns?|post\s+archive|live\s+insights|insights\s+posts?|follower\s+history|dashboard|lensically\s+ui\s+surface)\b/)) return "read_lensically_ui_surface";
  if (has(/\b(discard|retire|scrap|clear|remove)\b/) && has(/\b(stale\s+)?(manifest\s+)?review\s+batch\b/)) return "discard_manifest_review_batch";
  
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
  if (
    has(/\b(month|monthly|this month|date range|period)\b/)
    && (
      has(/\bfollowers?\b/) && has(/\b(growth|grown|gained|gain|trajectory)\b/)
      || has(/\b(best|top|strongest|winning|performed well)\s+posts?\b/)
      || has(/\bposts?\b/) && has(/\bperformance\b/)
    )
  ) return "get_monthly_growth_review";
  if (has(/\bperformance\s+learning\b/) || has(/\baccount\s+learning\b/)) return "get_performance_learning";
  return null;
}

function inferredArgumentsForOperationalIntent(
  toolName: string,
  actionIntent: string,
  inputs: Record<string, unknown>,
): Record<string, unknown> {
  const capability = normalizeText(inputs.capability, 500) ?? "";
  const normalized = `${actionIntent} ${capability}`.toLowerCase();
  if (toolName === "read_lensically_ui_surface") {
    if (/\bsaved\s+patterns?\b/.test(normalized)) return { surface: "saved_patterns" };
    if (/\bpost\s+archive\b/.test(normalized)) return { surface: "post_archive" };
    if (/\b(live\s+insights|insights\s+posts?)\b/.test(normalized)) return { surface: "insights" };
    if (/\bfollower\s+history\b/.test(normalized)) return { surface: "followers" };
    if (/\bdashboard\b/.test(normalized)) return { surface: "dashboard" };
    return {};
  }
  if (toolName === "readMcpToolDefinition") {
    if (/\b(workflow|github)\b/.test(normalized) && /\b(runs|history|activity|listing)\b/.test(normalized)) return { tool_name: "listGitHubWorkflowRuns" };
    if (/\b(workflow|github)\b/.test(normalized) && /\b(run status|single run|completion|result)\b/.test(normalized)) return { tool_name: "getGitHubWorkflowRun" };
    if (/\b(account|brand)\b/.test(normalized) && /\b(key|alias|selection)\b/.test(normalized)) return { tool_name: "selectOperatorKey" };
    
    if (/\b(repository|source)\b/.test(normalized) && /\b(file|read|open)\b/.test(normalized)) return { tool_name: "readRepoFile" };
    
    if (/\b(public|request)\b/.test(normalized) && /\b(gateway|action)\b/.test(normalized)) return { tool_name: "executeLensicallyIntent" };
    return {};
  }
    if (toolName !== "runGitHubWorkflow") return {};
  
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

function exactSourceDefinedToolForIntent(
  actionIntent: string,
  tools: MandatoryExecutionToolDefinition[],
): MandatoryExecutionToolDefinition | null {
  const normalizedIntent = actionIntent.toLowerCase().trim();
  if (!normalizedIntent) return null;
  return availableTools(tools).find((tool) =>
    aliasesForTool(tool).some((alias) => alias.toLowerCase().trim() === normalizedIntent)
    || machineKey(actionIntent, "") === machineKey(tool.name, ""),
  ) ?? null;
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
  const exactSourceDefined = exactSourceDefinedToolForIntent(actionIntent, usable);
  if (exactSourceDefined) {
    return { tool: exactSourceDefined, candidates: [{ tool_name: exactSourceDefined.name, score: 950 }] };
  }
  const deterministic = deterministicToolForOperationalIntent(actionIntent, inputs);
  if (deterministic) {
    const exact = usable.find((tool) => tool.name === deterministic)
      ?? usable.find((tool) => publicToolName(tool.name) === deterministic);
    if (exact) return { tool: exact, candidates: [{ tool_name: exact.name, score: 900 }] };
  }
  const requestedOperationClass = classifyIntentOperation(actionIntent);
  const ranked = usable
    .map((tool) => ({
      tool,
      score: routeScore(actionIntent, tool, inputs),
      operation_class: classifyIntentOperation(`${tool.name} ${tool.title}`),
    }))
    .filter((item) => item.score >= 30 && operationClassesCompatible(requestedOperationClass, item.operation_class))
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
  const winningPathValidation = validateWinningPathPromotions();
  if (!winningPathValidation.ok) {
    return {
      ok: false,
      error: "winning_path_registry_invalid",
      map_state: "unknown",
      candidates: winningPathValidation.errors.map((error) => ({ error })),
    };
  }
  const promotedWinningPath = resolvePromotedWinningPath(actionIntent, objective, inputs);
  if (promotedWinningPath?.winning_path.surface === "recovery_plane") {
    return {
      ok: false,
      error: "promoted_winning_path_external_surface_required",
      map_state: "known",
      map_entry: promotedWinningPath,
      map_execution: {
        version: MANDATORY_EXECUTION_MAP_VERSION,
        winning_path_version: WINNING_PATH_PROMOTION_VERSION,
        winning_path_id: promotedWinningPath.id,
        winning_path_surface: promotedWinningPath.winning_path.surface,
        losing_path_prohibited: true,
        objective,
        action_intent: actionIntent,
        input_character_count: stringify(inputs).length,
      },
    };
  }
  const promotedRouteIntent = promotedWinningPath?.winning_path.surface === "main_gateway"
    ? promotedWinningPath.winning_path.route_intent ?? null
    : null;
  const systemDirectory = resolveLensicallySystemDirectory(`${objective ?? ""} ${actionIntent}`);
  const effectiveActionIntent = promotedRouteIntent ?? actionIntent;
  const exactOperationalIntent = deterministicToolForOperationalIntent(effectiveActionIntent, inputs);
  const exactSourceDefinedIntent = exactSourceDefinedToolForIntent(effectiveActionIntent, tools);
  const directoryIntent = systemDirectory?.route_intent ?? null;
  const directoryHasBoundedDefaults = Boolean(
    systemDirectory?.default_inputs
    && Object.keys(systemDirectory.default_inputs).length > 0,
  );
  const directoryConfidenceFloor = engineeringOnly && directoryHasBoundedDefaults ? 0.5 : 0.75;
  const directoryMayRoute = Boolean(
    !actionKey
    && !promotedRouteIntent
    && !exactOperationalIntent
    && !exactSourceDefinedIntent
    && directoryIntent
    && (systemDirectory?.confidence ?? 0) >= directoryConfidenceFloor
    && operationClassesCompatible(classifyIntentOperation(actionIntent), classifyIntentOperation(directoryIntent)),
  );
  let resolvedIntent = promotedRouteIntent ?? (directoryMayRoute ? directoryIntent ?? actionIntent : actionIntent);
  let resolvedInputs = directoryMayRoute ? { ...(systemDirectory?.default_inputs ?? {}), ...inputs } : inputs;
  let resolved = resolveStaticTool(resolvedIntent, actionKey, resolvedInputs, tools);
  let directoryRouteApplied = Boolean(directoryMayRoute && systemDirectory?.route_intent && resolved.tool);
  if (!resolved.tool && !promotedRouteIntent && systemDirectory?.route_intent && systemDirectory.route_intent !== actionIntent) {
    resolvedIntent = actionIntent;
    resolvedInputs = inputs;
    resolved = resolveStaticTool(actionIntent, actionKey, inputs, tools);
    directoryRouteApplied = false;
  }
  if (!resolved.tool) return null;
  if (engineeringOnly && !SOURCE_DEFINED_DIRECT_ENGINEERING_TOOLS.has(resolved.tool.name)) return null;
  const allowed = toolSchemaProperties(resolved.tool);
  const required = toolRequiredProperties(resolved.tool);
    const filteredInputs = Object.fromEntries(Object.entries(resolvedInputs).filter(([key]) => allowed.includes(key)));
  const argumentsObject = { ...inferredArgumentsForOperationalIntent(resolved.tool.name, resolvedIntent, resolvedInputs), ...filteredInputs };
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
      resolved_action_intent: resolvedIntent,
      action_key: entry.action_key,
      objective,
            system_directory: systemDirectory ? { ...systemDirectory, route_applied: directoryRouteApplied } : null,
      entry_id: entry.id,
      entry_version: entry.version,
      winning_path_promotion: promotedWinningPath ? {
        version: WINNING_PATH_PROMOTION_VERSION,
        id: promotedWinningPath.id,
        scope: promotedWinningPath.scope,
        enforcement_point: promotedWinningPath.enforcement_point,
        losing_path_prohibited: true,
        surface: promotedWinningPath.winning_path.surface,
      } : null,
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
  const directEngineering = mode === "source_defined_direct_engineering";
  const explicitContradiction = result.contradiction === true || result.contract_contradiction === true || result.status === "contradiction";
  const effectiveFailure = result.ok === false || explicitContradiction;
  const defectGeneralization = directEngineering && effectiveFailure ? classifyDefectForGeneralization(actionIntent, result) : null;
  return {
    version: MANDATORY_EXECUTION_MAP_VERSION,
    map_state: directEngineering
      ? effectiveFailure ? "source_defined_direct_failed" : "source_defined_direct_completed"
      : effectiveFailure ? "source_defined_route_failed" : "source_defined_route_completed",
    route_mode: mode,
    action_intent: actionIntent,
    mapped_tool: toolName,
    mandatory_path_followed: true,
    model_tool_choice_allowed: false,
    d1_execution_library_bypassed: true,
    discovery_allowed: false,
    objective_may_resume: !effectiveFailure,
    ...(defectGeneralization ? { defect_generalization_gate: defectGeneralization } : {}),
    failure: effectiveFailure ? {
      error: result.error ?? (explicitContradiction ? "explicit_contradiction" : null),
      status: result.status ?? null,
      phase: result.phase ?? null,
      ...(defectGeneralization ? {
        defect_class: defectGeneralization.defect_class,
        sibling_scan_required: defectGeneralization.sibling_scan_required,
        prevention_disposition: defectGeneralization.prevention_disposition,
      } : {}),
    } : null,
  };
}

export async function getMandatoryExecutionMapSummary(
  _db: D1Database,
  tools: MandatoryExecutionToolDefinition[],
): Promise<Record<string, unknown>> {
  const usable = availableTools(tools);
  const winningPathValidation = validateWinningPathPromotions();
  return {
    version: MANDATORY_EXECUTION_MAP_VERSION,
    winning_path_promotion_version: WINNING_PATH_PROMOTION_VERSION,
    winning_path_registry_valid: winningPathValidation.ok,
    winning_path_registry_errors: winningPathValidation.errors,
    active_winning_path_count: WINNING_PATH_PROMOTIONS.filter((promotion) => promotion.status === "active").length,
    enforcement: "Every external action is resolved from source-defined intent aliases, promoted winning paths, and live typed schemas. Known losing paths are prohibited before execution; unknown terrain remains available for bounded discovery.",
    route_source: "source_control",
    active_internal_actions: usable.length,
    direct_engineering_actions: usable.filter((tool) => SOURCE_DEFINED_DIRECT_ENGINEERING_TOOLS.has(tool.name)).length,
    retired_internal_actions: tools.filter((tool) => ROUTER_EXCLUDED_TOOLS.has(tool.name)).map((tool) => tool.name),
    d1_execution_library_bypassed: true,
    discovery_allowed: false,
    model_tool_choice_allowed: false,
  };
}
