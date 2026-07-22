import capabilityLifecycleManifest from "./capabilityLifecycle.json";

export * from "./clientSafeRequests";

export const LENSICALLY_CAPABILITY_LIFECYCLE = capabilityLifecycleManifest;

export const LENSICALLY_SYSTEM_DIRECTORY_VERSION = "lensically-system-directory-v1";
export const LENSICALLY_SYSTEM_DIRECTORY_CANONICAL_LOCATION = "lensically-worker/src/systemDirectory/index.ts";

export type SystemDirectoryPlane =
  | "product"
  | "publishing"
  | "content_production"
  | "analytics"
  | "workflows"
  | "accounts"
  | "operating_knowledge"
  | "engineering"
  | "deployment"
  | "recovery"
  | "supporting_systems";

export type SystemDirectoryActionSize = "single_record" | "bounded_search" | "bounded_read" | "bounded_mutation" | "coherent_change_set";

export type SystemDirectoryPayloadProfile = {
  action_size: SystemDirectoryActionSize;
  max_results?: number;
  max_response_bytes?: number;
  required_inputs?: string[];
};

export type SystemDirectoryEntry = {
  id: string;
  title: string;
  plane: SystemDirectoryPlane;
  system_of_record: string;
  primary_surfaces: string[];
  objects: string[];
  keywords: string[];
  capabilities: string[];
  payload: SystemDirectoryPayloadProfile;
  route_intent?: string;
  default_inputs?: Record<string, unknown>;
  related_entry_ids?: string[];
  recommended_next_planes?: SystemDirectoryPlane[];
  hard_gates?: string[];
};

export type SystemDirectoryDirective = {
  entry_id: string;
  plane: SystemDirectoryPlane;
  system_of_record: string;
  primary_surfaces: string[];
  capability: string | null;
  payload: SystemDirectoryPayloadProfile;
  route_intent: string | null;
  default_inputs: Record<string, unknown>;
  related_entry_ids: string[];
  recommended_next_planes: SystemDirectoryPlane[];
  hard_gates: string[];
  confidence: number;
};

export type SystemDirectoryIndex = {
  entries: readonly SystemDirectoryEntry[];
  by_id: ReadonlyMap<string, SystemDirectoryEntry>;
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalize(value).split(/\s+/).filter((token) => token.length > 1));
}

function uniqueStrings(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

function normalizedEntry(entry: SystemDirectoryEntry): SystemDirectoryEntry {
  return {
    ...entry,
    id: entry.id.trim(),
    title: entry.title.trim(),
    system_of_record: entry.system_of_record.trim(),
    primary_surfaces: uniqueStrings(entry.primary_surfaces),
    objects: uniqueStrings(entry.objects),
    keywords: uniqueStrings(entry.keywords),
        capabilities: uniqueStrings(entry.capabilities),
    route_intent: entry.route_intent?.trim() || undefined,
    default_inputs: entry.default_inputs ? { ...entry.default_inputs } : undefined,
    related_entry_ids: uniqueStrings(entry.related_entry_ids),
    recommended_next_planes: Array.from(new Set(entry.recommended_next_planes ?? [])),
    hard_gates: uniqueStrings(entry.hard_gates),
    payload: {
      ...entry.payload,
      required_inputs: uniqueStrings(entry.payload.required_inputs),
    },
  };
}

export function createSystemDirectoryIndex(entries: SystemDirectoryEntry[]): SystemDirectoryIndex {
  const normalized = entries.map(normalizedEntry);
  const byId = new Map<string, SystemDirectoryEntry>();
  for (const entry of normalized) {
    if (!entry.id || !entry.title || !entry.system_of_record) {
      throw new Error("system_directory_entry_required_field_missing");
    }
    if (!entry.primary_surfaces.length || !entry.objects.length || !entry.capabilities.length) {
      throw new Error(`system_directory_entry_incomplete:${entry.id}`);
    }
    if (byId.has(entry.id)) {
      throw new Error(`system_directory_duplicate_entry:${entry.id}`);
    }
    if (entry.payload.max_results !== undefined && entry.payload.max_results < 1) {
      throw new Error(`system_directory_invalid_max_results:${entry.id}`);
    }
    if (entry.payload.max_response_bytes !== undefined && entry.payload.max_response_bytes < 256) {
      throw new Error(`system_directory_invalid_max_response_bytes:${entry.id}`);
    }
    byId.set(entry.id, entry);
  }
  for (const entry of normalized) {
    for (const relatedId of entry.related_entry_ids ?? []) {
      if (!byId.has(relatedId)) {
        throw new Error(`system_directory_unknown_related_entry:${entry.id}:${relatedId}`);
      }
    }
  }
  return { entries: normalized, by_id: byId };
}

function phraseScore(query: string, phrase: string, weight: number): number {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return 0;
  if (query === normalizedPhrase) return weight * 2;
  if (query.includes(normalizedPhrase)) return weight;
  const queryTokens = tokens(query);
  const phraseTokens = tokens(normalizedPhrase);
  let overlap = 0;
  for (const token of phraseTokens) {
    if (queryTokens.has(token)) overlap += 1;
  }
  return phraseTokens.size ? weight * (overlap / phraseTokens.size) : 0;
}

function entryScore(query: string, entry: SystemDirectoryEntry): number {
  let score = phraseScore(query, entry.title, 8);
  for (const object of entry.objects) score += phraseScore(query, object, 7);
  for (const surface of entry.primary_surfaces) score += phraseScore(query, surface, 6);
  for (const keyword of entry.keywords) score += phraseScore(query, keyword, 4);
  for (const capability of entry.capabilities) score += phraseScore(query, capability, 3);
  return score;
}

function exactPhrasePriority(query: string, entry: SystemDirectoryEntry): number {
  const groups: Array<{ phrases: string[]; weight: number }> = [
    { phrases: entry.route_intent ? [entry.route_intent] : [], weight: 10 },
    { phrases: entry.objects, weight: 9 },
    { phrases: [entry.title], weight: 8 },
    { phrases: entry.primary_surfaces, weight: 7 },
    { phrases: entry.keywords, weight: 6 },
    { phrases: entry.capabilities, weight: 5 },
  ];
  let best = 0;
  for (const group of groups) {
    for (const phrase of group.phrases) {
      const normalizedPhrase = normalize(phrase);
      const phraseTokenCount = tokens(normalizedPhrase).size;
      if (phraseTokenCount < 2) continue;
      if (query === normalizedPhrase || query.includes(normalizedPhrase)) {
        best = Math.max(best, group.weight * 100 + phraseTokenCount);
      }
    }
  }
  return best;
}

function inferredCapability(query: string, entry: SystemDirectoryEntry): string | null {
  return entry.capabilities
    .map((capability) => ({ capability, score: phraseScore(query, capability, 3) }))
    .sort((left, right) => right.score - left.score)[0]?.score
    ? entry.capabilities.map((capability) => ({ capability, score: phraseScore(query, capability, 3) })).sort((left, right) => right.score - left.score)[0].capability
    : null;
}

export function resolveSystemDirectory(
  rawQuery: string,
  index: SystemDirectoryIndex,
  minimumScore = 3,
): SystemDirectoryDirective | null {
  const query = normalize(rawQuery);
  if (!query) return null;
  const ranked = index.entries
    .map((entry) => ({ entry, score: entryScore(query, entry), exact_priority: exactPhrasePriority(query, entry) }))
    .filter((candidate) => candidate.score >= minimumScore)
    .sort((left, right) => right.exact_priority - left.exact_priority || right.score - left.score || left.entry.id.localeCompare(right.entry.id));
  const winner = ranked[0];
  if (!winner) return null;
  const runnerUp = ranked[1]?.score ?? 0;
  const confidence = Number(Math.min(1, winner.score / Math.max(winner.score + runnerUp, 1)).toFixed(3));
  return {
    entry_id: winner.entry.id,
    plane: winner.entry.plane,
    system_of_record: winner.entry.system_of_record,
    primary_surfaces: [...winner.entry.primary_surfaces],
    capability: inferredCapability(query, winner.entry),
    payload: { ...winner.entry.payload, required_inputs: [...(winner.entry.payload.required_inputs ?? [])] },
    route_intent: winner.entry.route_intent ?? null,
    default_inputs: { ...(winner.entry.default_inputs ?? {}) },
    related_entry_ids: [...(winner.entry.related_entry_ids ?? [])],
    recommended_next_planes: [...(winner.entry.recommended_next_planes ?? [])],
    hard_gates: [...(winner.entry.hard_gates ?? [])],
    confidence,
  };
}

export const LENSICALLY_SYSTEM_DIRECTORY_ENTRIES: readonly SystemDirectoryEntry[] = [
  {
    id: "operating.startup",
    title: "Operator startup context",
    plane: "operating_knowledge",
    system_of_record: "getOperatorStartupContext and the mandatory startup documents",
    primary_surfaces: ["startup receipt", "Operator startup", "client-safety receipt"],
    objects: ["operator startup", "startup context", "load operator context", "fresh session bootstrap"],
    keywords: ["startup", "load operator context", "startup receipt", "fresh session"],
    capabilities: ["load non-account startup context", "report the active tool surface", "verify the client-safety registry"],
    payload: { action_size: "bounded_read", max_response_bytes: 24000 },
    route_intent: "load operator context",
    related_entry_ids: ["operating.current_state", "operating.rules", "accounts.continuity"],
    recommended_next_planes: ["accounts", "engineering"],
    hard_gates: ["Startup cannot load account data before explicit Proceed."],
  },
  {
    id: "operating.current_state",
    title: "Current state and implementation backlog",
    plane: "operating_knowledge",
    system_of_record: "CURRENT_STATE.md on GitHub main",
    primary_surfaces: ["CURRENT_STATE.md", "active architecture", "implementation backlog"],
    objects: ["current state", "remaining work", "backlog item", "active architecture"],
    keywords: ["what remains", "what else", "list implementation backlog items", "current implementation", "cleanup remaining"],
    capabilities: ["read current architecture", "identify remaining implementation", "review active behavior"],
    payload: { action_size: "bounded_read", max_response_bytes: 14000, required_inputs: ["path"] },
    route_intent: "read repository file",
    default_inputs: { path: "CURRENT_STATE.md", start_line: 1, max_characters: 14000 },
    related_entry_ids: ["operating.rules", "engineering.repository"],
    recommended_next_planes: ["engineering"],
  },
  {
    id: "operating.rules",
    title: "Active operating rules",
    plane: "operating_knowledge",
    system_of_record: "OPERATING_MEMORY.md and AGENTS.md on GitHub main",
    primary_surfaces: ["OPERATING_MEMORY.md", "AGENTS.md", "startup contract"],
    objects: ["operating rule", "active instruction", "engineering default", "startup behavior"],
    keywords: ["rule", "known path", "fresh chat", "operating memory", "agent instructions"],
    capabilities: ["read active rules", "verify engineering contract", "inspect startup requirements"],
    payload: { action_size: "bounded_read", max_response_bytes: 14000, required_inputs: ["path"] },
    route_intent: "read repository file",
    default_inputs: { path: "OPERATING_MEMORY.md", start_line: 1, max_characters: 14000 },
    related_entry_ids: ["operating.current_state", "accounts.continuity"],
    recommended_next_planes: ["workflows", "engineering"],
  },
  {
    id: "engineering.repository",
    title: "Repository source and implementation",
    plane: "engineering",
    system_of_record: "GitHub main",
    primary_surfaces: ["Lensically repository", "source files", "commit history"],
    objects: ["repository", "source file", "implementation", "code change"],
    keywords: ["GitHub", "repo", "patch", "source", "implementation"],
    capabilities: ["read known source file", "search one known source file", "apply coherent change set", "verify repository head"],
    payload: { action_size: "coherent_change_set", max_results: 20, max_response_bytes: 16000 },
    route_intent: "search repository files",
    related_entry_ids: ["engineering.operator_validation", "deployment.main_worker"],
    recommended_next_planes: ["deployment"],
    hard_gates: ["Deployment requires a verified repository head and passing focused validation."],
  },
  {
    id: "engineering.operator_validation",
    title: "Operator validation and regression tests",
    plane: "engineering",
    system_of_record: "GitHub Actions and lensically-worker tests",
    primary_surfaces: ["Lensically Validation workflow", "Operator tests", "domain test scopes"],
    objects: ["operator test", "regression test", "validation run", "test suite"],
    keywords: ["run operator tests", "operator-tests", "full operator suite", "test failure", "validation"],
    capabilities: ["run Operator tests", "run focused domain validation", "inspect test result"],
    payload: { action_size: "bounded_mutation", max_response_bytes: 10000, required_inputs: ["task"] },
    route_intent: "run operator tests",
    default_inputs: { task: "operator-tests" },
    related_entry_ids: ["engineering.repository", "operating.current_state"],
    recommended_next_planes: ["engineering", "deployment"],
  },
  {
    id: "engineering.capability_lifecycle",
    title: "Autonomous capability lifecycle",
    plane: "engineering",
    system_of_record: "capabilityLifecycle.json, System Directory, release preflight, focused regressions, and live startup verification",
    primary_surfaces: ["capability lifecycle manifest", "System Directory", "release preflight", "startup receipt"],
    objects: ["new capability", "capability declaration", "new typed handler", "new static route", "feature implementation"],
    keywords: ["create and register a missing capability", "create capability", "add capability", "new feature", "register capability", "implement missing function"],
    capabilities: ["reuse an existing capability", "create and register a missing capability", "validate and release a capability autonomously"],
    payload: { action_size: "bounded_read", max_response_bytes: 18000, required_inputs: ["path"] },
    route_intent: "read repository file",
    default_inputs: { path: "lensically-worker/src/systemDirectory/capabilityLifecycle.json", start_line: 1, max_characters: 18000 },
    related_entry_ids: ["engineering.repository", "engineering.operator_validation", "deployment.main_worker"],
    recommended_next_planes: ["engineering", "deployment"],
    hard_gates: [
      "Reuse an existing canonical capability when it is sufficient.",
      "A missing capability requires a declaration, Directory entry, one canonical handler, one static route, a focused regression, a release scope, exact-head deployment, and live verification.",
      "Routine capability work is executed by the model without owner prompting; compatibility bridges are forbidden.",
    ],
  },
  {
    id: "engineering.hardening_incident_intake",
    title: "Continuous hardening incident intake",
    plane: "engineering",
    system_of_record: "operator_hardening_incidents and operator_hardening_incident_events",
    primary_surfaces: ["hardening incident intake", "client block intake", "prevention breach record"],
    objects: ["hardening incident", "client block", "server failure", "preventable recurrence"],
    keywords: ["record hardening incident", "open incident", "client block intake", "prevention breach"],
    capabilities: ["record one bounded hardening incident", "deduplicate identical open incidents", "classify prevention recurrence"],
    payload: { action_size: "bounded_mutation", max_response_bytes: 12000, required_inputs: ["boundary", "blocked_profile_id", "error_category"] },
    route_intent: "record hardening incident",
    related_entry_ids: ["engineering.hardening_status", "engineering.hardening_transition", "engineering.repository"],
    recommended_next_planes: ["engineering"],
    hard_gates: ["Identical open incidents converge; normal work cannot resume before evidence-gated prevention and validation."],
  },
  {
    id: "engineering.hardening_status",
    title: "Continuous hardening status",
    plane: "engineering",
    system_of_record: "operator_hardening_incidents and operator_hardening_incident_events",
    primary_surfaces: ["hardening status", "active incident state", "transition evidence"],
    objects: ["active hardening incident", "incident lifecycle", "blocking severity", "transition proof"],
    keywords: ["get hardening status", "read active incident", "incident state", "hardening evidence"],
    capabilities: ["read bounded hardening incidents", "identify normal-work blockers", "inspect transition evidence"],
    payload: { action_size: "bounded_read", max_results: 50, max_response_bytes: 16000 },
    route_intent: "get hardening status",
    related_entry_ids: ["engineering.hardening_incident_intake", "engineering.hardening_transition", "operating.work_state"],
    recommended_next_planes: ["engineering", "operating_knowledge"],
  },
  {
    id: "engineering.hardening_transition",
    title: "Continuous hardening transition",
    plane: "engineering",
    system_of_record: "operator_hardening_incidents and operator_hardening_incident_events",
    primary_surfaces: ["hardening lifecycle transition", "prevention lock", "release and live verification evidence"],
    objects: ["incident transition", "root cause", "prevention rule", "regression proof", "live verification"],
    keywords: ["advance hardening incident", "transition incident", "prevention locked", "close incident"],
    capabilities: ["advance one incident state", "enforce transition evidence", "close only after autonomy dividend"],
    payload: { action_size: "bounded_mutation", max_response_bytes: 14000, required_inputs: ["incident_id", "target_state"] },
    route_intent: "advance hardening incident",
    related_entry_ids: ["engineering.hardening_incident_intake", "engineering.hardening_status", "engineering.operator_validation", "deployment.main_worker"],
    recommended_next_planes: ["engineering", "deployment"],
    hard_gates: ["Lifecycle states cannot be skipped; validation, exact-head release, live verification, resume proof, and autonomy dividend are mandatory before closure."],
  },
  {
    id: "engineering.operational_observation",
    title: "Operational efficiency observation",
    plane: "engineering",
    system_of_record: "operator_operational_observations and continuous hardening incidents",
    primary_surfaces: ["operation observation", "efficiency evidence", "repeated-call detection"],
    objects: ["operation duration", "call count", "external request count", "progress checkpoint", "repeated fingerprint"],
    keywords: ["record operational observation", "record efficiency", "operation telemetry", "slow execution"],
    capabilities: ["record compact execution cost", "compare recent successful baselines", "open efficiency incidents when thresholds are exceeded"],
    payload: { action_size: "bounded_mutation", max_response_bytes: 10000, required_inputs: ["capability", "outcome"] },
    route_intent: "record operational observation",
    related_entry_ids: ["engineering.hardening_incident_intake", "engineering.hardening_status", "operating.work_state"],
    recommended_next_planes: ["engineering", "operating_knowledge"],
  },
  {
    id: "operating.work_state",
    title: "Autonomous operator work state",
    plane: "operating_knowledge",
    system_of_record: "operator_work_state and operator_work_ledger",
    primary_surfaces: ["active outcome", "deferred work ledger", "operator checkpoint"],
    objects: ["active implementation outcome", "scope freeze", "queued prerequisite", "deferred work", "interrupt state"],
    keywords: ["get operator work state", "read active outcome", "deferred work ledger", "what is queued"],
    capabilities: ["restore the frozen active outcome", "read ordered deferred work", "report the current operator-selected next action"],
    payload: { action_size: "bounded_read", max_results: 100, max_response_bytes: 20000 },
    route_intent: "get operator work state",
    related_entry_ids: ["operating.work_intake", "operating.work_transition", "engineering.hardening_status"],
    recommended_next_planes: ["operating_knowledge", "engineering"],
    hard_gates: ["Only one active implementation outcome may exist outside a bounded P0/P1 interruption."],
  },
  {
    id: "operating.work_intake",
    title: "Autonomous operator work intake",
    plane: "operating_knowledge",
    system_of_record: "operator_work_state, operator_work_ledger, and single-active-outcome-v1",
    primary_surfaces: ["work intake decision", "scope guard", "deferred-work capture"],
    objects: ["new implementation idea", "proposed work", "scope interruption", "duplicate objective", "mission conflict"],
    keywords: ["intake operator work", "record deferred work", "classify new work", "capture implementation idea"],
    capabilities: ["activate required work", "defer noncritical work", "merge duplicates", "reject mission conflicts"],
    payload: { action_size: "bounded_mutation", max_response_bytes: 14000, required_inputs: ["work_key", "title", "summary", "completion_condition"] },
    route_intent: "intake operator work",
    related_entry_ids: ["operating.work_state", "operating.work_transition", "engineering.hardening_incident_intake"],
    recommended_next_planes: ["operating_knowledge", "engineering"],
    hard_gates: ["New work cannot silently expand frozen scope; only P0/P1, required prerequisites, or material irreversible rework may interrupt."],
  },
  {
    id: "operating.work_transition",
    title: "Autonomous operator work transition",
    plane: "operating_knowledge",
    system_of_record: "operator_work_state and operator_work_ledger",
    primary_surfaces: ["work item transition", "active-outcome checkpoint", "interrupt resume"],
    objects: ["queued work", "completed work", "deferred work", "active interrupt", "next action checkpoint"],
    keywords: ["advance operator work", "complete work item", "resume active outcome", "close active outcome"],
    capabilities: ["advance one work item", "clear completed interrupts", "checkpoint the next action", "close an active outcome with evidence"],
    payload: { action_size: "bounded_mutation", max_response_bytes: 16000, required_inputs: ["work_key", "status"] },
    route_intent: "advance operator work",
    related_entry_ids: ["operating.work_state", "operating.work_intake", "engineering.hardening_transition"],
    recommended_next_planes: ["operating_knowledge", "engineering"],
    hard_gates: ["The active outcome closes only with completion evidence and one selected follow-on action."],
  },
  {
    id: "strategy.growth_mission_read",
    title: "Guided Growth Mission Brief",
    plane: "workflows",
    system_of_record: "operator_growth_missions, operator_growth_mission_revisions, follower snapshots, post archive, calendar coverage, and canonical workflow state",
    primary_surfaces: ["Growth Mission Brief", "post-Proceed diagnostic", "growth planning discussion"],
    objects: ["growth mission", "growth plan", "current bottleneck", "primary objective", "proposed experiments", "million follower mission"],
    keywords: ["growth mission brief", "show growth plan", "current growth mission", "diagnostic", "brainstorm plan", "one million followers"],
    capabilities: ["read persistent growth mission", "review current diagnostic", "discuss evidence-led plan", "identify current bottleneck"],
    payload: { action_size: "single_record", max_response_bytes: 24000, required_inputs: ["brand_key"] },
    route_intent: "get growth mission",
    related_entry_ids: ["strategy.growth_mission_update", "analytics.monthly_growth", "analytics.performance_learning", "workflows.production_state"],
    recommended_next_planes: ["workflows", "analytics"],
    hard_gates: ["Proceed opens planning and discussion; it does not authorize account mutations."],
  },
  {
    id: "strategy.growth_mission_update",
    title: "Growth Mission revision and approval",
    plane: "workflows",
    system_of_record: "operator_growth_missions and immutable operator_growth_mission_revisions",
    primary_surfaces: ["Growth Mission approval", "plan revision", "guided autonomy mode"],
    objects: ["approve growth plan", "revise mission", "activate plan", "pause plan", "full-auto mode change"],
    keywords: ["approve the guided growth plan", "approve growth plan", "approve growth mission", "revise growth plan", "update mission", "activate plan", "pause plan", "enable full auto"],
    capabilities: ["persist owner-model brainstorming", "revise active objectives", "approve account execution plan", "explicitly change execution mode"],
    payload: { action_size: "bounded_mutation", max_response_bytes: 18000, required_inputs: ["brand_key"] },
    route_intent: "update growth mission",
    related_entry_ids: ["strategy.growth_mission_read", "accounts.continuity", "content.production", "publishing.scheduled_posts"],
    recommended_next_planes: ["workflows", "content_production"],
    hard_gates: [
      "Approval or activation requires the owner's exact response.",
      "Account mutations remain locked while the mission is in discussion or paused.",
      "Full autonomous account execution requires an explicit owner-authorized execution-mode change.",
    ],
  },
  {
    id: "product.ui_surface_parity",
    title: "Lensically UI data surfaces",
    plane: "product",
    system_of_record: "the same Dashboard, Followers, Insights, Post Archive, and Saved Patterns backend services used by the Lensically web UI",
    primary_surfaces: ["Dashboard", "Followers", "Insights", "Post Archive", "Saved Patterns"],
    objects: ["saved patterns", "post archive", "live insights", "follower history", "dashboard data", "Lensically UI surface"],
    keywords: ["entire saved patterns", "entire post archive", "pull insights", "read follower history", "read dashboard", "UI parity"],
    capabilities: ["read every paginated Saved Pattern", "read every archived post", "pull live Threads post insights", "read follower history", "read dashboard"],
    payload: { action_size: "bounded_read", max_results: 200, max_response_bytes: 24000, required_inputs: ["brand_key", "surface"] },
    route_intent: "read lensically ui surface",
    related_entry_ids: ["analytics.monthly_growth", "analytics.performance_learning", "product.post_archive", "content.sources"],
    recommended_next_planes: ["analytics", "content_production"],
    hard_gates: ["Large surfaces remain completely reachable through bounded pagination or the live Insights cursor."],
  },
  {
    id: "content.review_batch_retirement",
    title: "Manifest review-batch retirement",
    plane: "content_production",
    system_of_record: "operator_review_batches and preserved source lineage",
    primary_surfaces: ["four-post review batch", "workflow continuity"],
    objects: ["stale review batch", "obsolete review inventory", "retired review batch"],
    keywords: ["scrap old review batch", "discard stale review batch", "retire review batch"],
    capabilities: ["retire stale review inventory", "prevent stale continuity resumption", "preserve underlying source records"],
    payload: { action_size: "bounded_mutation", max_response_bytes: 12000, required_inputs: ["brand_key", "reason"] },
    route_intent: "discard manifest review batch",
    related_entry_ids: ["content.production", "content.sources", "workflows.production_state"],
    recommended_next_planes: ["workflows", "content_production"],
    hard_gates: ["Retirement must not delete Saved Pattern, archive, analytics, or source-lineage records."],
  },
  {
    id: "analytics.monthly_growth",
    title: "Monthly follower growth and strongest posts",
    plane: "analytics",
    system_of_record: "follower snapshots and published-post archive",
    primary_surfaces: ["Followers", "Post Archive", "monthly growth review"],
    objects: ["monthly follower growth", "follower trajectory", "top posts this month", "monthly post performance"],
    keywords: ["followers grown this month", "monthly growth", "strongest posts", "best posts this month"],
    capabilities: ["calculate account follower growth", "rank monthly posts", "return bounded trajectory"],
    payload: { action_size: "bounded_read", max_results: 10, max_response_bytes: 24000, required_inputs: ["brand_key", "date_from", "date_to"] },
    route_intent: "get monthly growth review",
    related_entry_ids: ["analytics.performance_learning", "product.post_archive"],
    recommended_next_planes: ["content_production"],
    hard_gates: ["Follower totals remain account-level and cannot be attributed to individual posts."],
  },
  {
    id: "analytics.performance_learning",
    title: "Maturity-normalized performance learning",
    plane: "analytics",
    system_of_record: "published-post archive and metric snapshots",
    primary_surfaces: ["Insights", "performance learning"],
    objects: ["post performance", "maturity checkpoint", "content learning", "fatigue signal"],
    keywords: ["performance learning", "what worked", "post metrics", "6 hour", "24 hour"],
    capabilities: ["read performance learning", "compare age-matched evidence", "surface generation guidance"],
    payload: { action_size: "bounded_read", max_response_bytes: 20000, required_inputs: ["brand_key"] },
    route_intent: "get performance learning",
    related_entry_ids: ["analytics.monthly_growth", "content.production"],
    recommended_next_planes: ["content_production"],
  },
  {
    id: "analytics.content_focus",
    title: "Content Focus decisions and source-family allocation",
    plane: "analytics",
    system_of_record: "content-focus reviews and source-card family states",
    primary_surfaces: ["Insights", "Content Focus"],
    objects: ["daily focus decision", "source-card family state", "allocation weight", "reuse directive", "stop directive"],
    keywords: ["content focus", "use more", "use less", "learn next", "repeat", "expand", "hold", "retire"],
    capabilities: ["read Content Focus decisions", "read source-family classifications", "read allocation evidence"],
    payload: { action_size: "bounded_read", max_response_bytes: 20000, required_inputs: ["brand_key"] },
    route_intent: "get content focus",
    related_entry_ids: ["analytics.performance_learning", "content.sources", "content.production"],
    recommended_next_planes: ["content_production"],
    hard_gates: ["This read cannot publish, schedule, or mutate account content."],
  },
    {
    id: "strategy.manifest_intelligence_foundation",
    title: "Manifest intelligence foundation",
    plane: "analytics",
    system_of_record: "Manifest intelligence policies, immutable strategy versions, exposure snapshots, post hypotheses, and autonomous-cycle receipts",
    primary_surfaces: ["intelligence foundation", "strategy version", "noninterference policy", "follower attribution boundary"],
    objects: ["active intelligence policy", "durable strategy version", "latest cycle receipt", "exposure ledger"],
    keywords: ["manifest intelligence", "strategy version", "noninterference", "follower attribution policy", "intelligence foundation"],
    capabilities: ["read active intelligence policy", "read latest strategy version", "read latest cycle receipt", "verify follower attribution boundary"],
    payload: { action_size: "bounded_read", max_response_bytes: 24000, required_inputs: ["brand_key"] },
    route_intent: "get manifest intelligence foundation",
    related_entry_ids: ["strategy.manifest_autonomous_cycle", "strategy.manifest_cycle_receipt", "analytics.performance_learning", "analytics.content_focus"],
    recommended_next_planes: ["analytics", "content_production"],
    hard_gates: ["Follower attribution remains account-level only.", "The owner noninterference policy does not weaken protected safety boundaries."],
  },
  {
    id: "strategy.manifest_cycle_receipt",
    title: "Manifest autonomous cycle receipt",
    plane: "analytics",
    system_of_record: "autonomous cycle receipt header, append-only cycle events, exposure snapshot, strategy versions, post hypotheses, and lineage records",
    primary_surfaces: ["cycle receipt", "autonomous run audit", "post hypotheses", "source-to-results lineage"],
    objects: ["cycle trigger", "startup state", "candidate trace", "post hypothesis", "coverage checkpoint", "completion evidence"],
    keywords: ["cycle receipt", "audit autonomous run", "why did the model choose", "run evidence", "post hypothesis"],
    capabilities: ["read a complete autonomous cycle", "inspect candidate decisions", "inspect source-or-hypothesis lineage", "verify completion evidence"],
    payload: { action_size: "bounded_read", max_response_bytes: 24000, required_inputs: ["brand_key"] },
    route_intent: "get manifest cycle receipt",
    related_entry_ids: ["strategy.manifest_intelligence_foundation", "strategy.manifest_autonomous_cycle", "content.manifest_autonomous_post_persistence"],
    recommended_next_planes: ["analytics", "content_production"],
    hard_gates: ["Receipt reads never mutate scheduled content.", "Missing receipts return an available=false read result rather than a false incident."],
  },
  {
    id: "accounts.continuity",
    title: "Selected account and server-side continuity",
    plane: "accounts",
    system_of_record: "configured account records and operator continuity state",
    primary_surfaces: ["account selector", "Proceed handshake", "continuity capsule"],
    objects: ["brand key", "selected account", "workflow continuity", "account profile", "select operator key", "confirm operator proceed"],
    keywords: ["manifest mental", "vectrix", "opmg", "proceed", "resume workflow", "select operator key", "confirm operator proceed"],
    capabilities: ["select account", "select operator key", "confirm Proceed", "confirm operator proceed", "restore canonical continuity"],
    payload: { action_size: "single_record", max_response_bytes: 16000, required_inputs: ["brand_key"] },
    related_entry_ids: ["workflows.production_state", "operating.rules"],
    recommended_next_planes: ["workflows"],
    hard_gates: ["Account data cannot load before explicit Proceed."],
  },
  {
    id: "workflows.production_state",
    title: "Production workflow state",
    plane: "workflows",
    system_of_record: "operator workflow sessions and production board",
    primary_surfaces: ["workflow status", "production board", "context admission"],
    objects: ["workflow session", "production state", "active stage", "context admission"],
    keywords: ["where we left off", "workflow status", "active workflow", "production board"],
    capabilities: ["read workflow status", "restore active stage", "evaluate blockers"],
    payload: { action_size: "single_record", max_response_bytes: 18000, required_inputs: ["brand_key"] },
    route_intent: "get workflow status",
    related_entry_ids: ["accounts.continuity", "content.production"],
    recommended_next_planes: ["content_production", "publishing"],
  },
  {
    id: "content.sources",
    title: "Source candidates, saved patterns, and source cards",
    plane: "content_production",
    system_of_record: "saved patterns, archive posts, source selections, daily claims, and source cards",
    primary_surfaces: ["Saved Patterns", "source candidate batch", "source card"],
    objects: ["source candidate", "saved pattern", "source selection", "source card"],
    keywords: ["draw sources", "source candidates", "saved pattern", "build source card", "1000 likes"],
    capabilities: ["draw source candidate batch", "read candidate batch", "create source card"],
    payload: { action_size: "bounded_read", max_results: 24, max_response_bytes: 22000, required_inputs: ["brand_key"] },
    route_intent: "list source candidates",
    related_entry_ids: ["content.production", "workflows.production_state"],
    recommended_next_planes: ["content_production"],
  },
  {
    id: "content.lineage_audit",
    title: "Published lineage audit",
    plane: "content_production",
    system_of_record: "published-post archive, scheduled posts, source selections, source cards, generation runs, drafts, and metric snapshots",
    primary_surfaces: ["Post Archive", "source card", "post results"],
    objects: ["winner lineage", "lineage completeness", "source-to-metrics audit"],
    keywords: ["audit winner lineage", "verify source to metrics lineage", "inspect published post lineage"],
    capabilities: ["audit published post lineage", "identify missing lineage stages"],
    payload: { action_size: "bounded_read", max_results: 50, max_response_bytes: 22000, required_inputs: ["brand_key"] },
    route_intent: "audit published post lineage",
    related_entry_ids: ["content.lineage_recovery", "content.sources", "analytics.performance_learning", "product.post_archive"],
    recommended_next_planes: ["analytics", "content_production"],
    hard_gates: ["Audit is read-only and must not create or relink records."],
  },
  {
    id: "content.lineage_recovery",
    title: "Published lineage recovery",
    plane: "content_production",
    system_of_record: "verified Saved Patterns, canonical source-card families, generation runs, drafts, scheduled posts, and metric snapshots",
    primary_surfaces: ["Saved Patterns", "Post Archive", "source card", "post results"],
    objects: ["winner lineage", "historical published post", "source-card backfill", "Saved Pattern recovery"],
    keywords: ["recover winner lineage", "backfill source card", "tie winner to saved pattern", "restore post lineage"],
    capabilities: ["recover published post lineage", "preserve historical metrics", "create dedicated recovery generation runs"],
    payload: { action_size: "bounded_mutation", max_results: 10, max_response_bytes: 22000, required_inputs: ["brand_key", "saved_pattern_id", "published_post_ids"] },
    route_intent: "recover published post lineage",
    related_entry_ids: ["content.lineage_audit", "content.sources", "content.production", "analytics.performance_learning", "product.post_archive"],
    recommended_next_planes: ["analytics", "content_production"],
    hard_gates: [
      "The Saved Pattern must exist and meet the verified like floor.",
      "Every requested published post must already exist in scheduled or archive evidence.",
      "Recovery must preserve metrics and create dedicated post-level generation lineage without rewriting published text.",
    ],
  },
  {
    id: "content.production",
    title: "Generation, drafts, gates, and review batches",
    plane: "content_production",
    system_of_record: "generation runs, drafts, rejection context, gate results, and review batches",
    primary_surfaces: ["generation run", "candidate drafts", "gate suite", "four-post review batch"],
    objects: ["generation run", "draft", "content gate", "review batch"],
    keywords: ["generate post", "candidate draft", "gate draft", "review batch", "approve all"],
    capabilities: ["create generation run", "submit candidate draft", "read active review batch"],
    payload: { action_size: "bounded_mutation", max_results: 4, max_response_bytes: 22000, required_inputs: ["brand_key"] },
    route_intent: "get manifest review batch",
    related_entry_ids: ["content.sources", "publishing.scheduled_posts", "analytics.performance_learning"],
    recommended_next_planes: ["publishing"],
  },
    {
    id: "strategy.manifest_autonomous_cycle",
    title: "Manifest autonomous strategic cycle",
    plane: "content_production",
    system_of_record: "operator_autonomous_growth_cycles, live schedule coverage, performance learning, Content Focus, follower snapshots, and recent inventory",
    primary_surfaces: ["autonomous cycle", "48-hour runway", "strategic thesis", "account position"],
    objects: ["autonomous growth cycle", "rolling runway", "daily strategy", "missing hourly slots"],
    keywords: ["prepare autonomous cycle", "build rolling runway", "reconcile 48 hours", "strategic account position"],
    capabilities: ["reconcile live account position", "persist exact rolling runway", "return adaptive strategic generation contract"],
    payload: { action_size: "bounded_mutation", max_response_bytes: 24000, required_inputs: ["brand_key"] },
    route_intent: "prepare manifest autonomous cycle",
        related_entry_ids: ["analytics.performance_learning", "analytics.content_focus", "content.manifest_autonomous_post_persistence", "publishing.scheduled_posts"],
    recommended_next_planes: ["content_production", "publishing"],
    hard_gates: ["Existing scheduled posts are preserved.", "Live state overrides stale continuity summaries.", "Fixed content percentages are forbidden."],
  },
    {
    id: "content.manifest_autonomous_post_persistence",
    title: "Manifest autonomous post persistence",
    plane: "content_production",
    system_of_record: "autonomous cycle lineup, source-card families, generation runs, model evaluation evidence, drafts, scheduled posts, strategy tags, and inventory",
    primary_surfaces: ["autonomous post", "exact missing slot", "source-to-metrics lineage"],
    objects: ["model-evaluated post", "lineup assignment", "missing schedule slot", "operator hypothesis"],
    keywords: ["persist autonomous post", "schedule one missing slot", "store model-evaluated post", "autonomous post lineage"],
    capabilities: ["persist exactly one completed post", "enforce slot and exact-duplicate safety", "preserve full post lineage", "resume one identical post idempotently"],
    payload: { action_size: "single_record", max_results: 1, max_response_bytes: 16000, required_inputs: ["brand_key", "cycle_id", "strategic_thesis", "post", "model_evaluation", "operation_id"] },
    route_intent: "persist manifest autonomous post",
    related_entry_ids: ["strategy.manifest_autonomous_cycle", "content.production", "publishing.scheduled_posts", "analytics.performance_learning"],
    recommended_next_planes: ["publishing", "analytics"],
    hard_gates: ["Only one exact missing slot from the prepared cycle may be persisted per call.", "The model must complete generation, novelty, winner-preservation, and scheduling evaluation before persistence.", "The server performs no internal multi-post loop, gate fanout, runway scan, or Threads API call.", "Every accepted post requires complete lineage."],
  },
  {
    id: "content.manifest_scheduled_review",
    title: "Optional Manifest scheduled-post review",
    plane: "content_production",
    system_of_record: "scheduled posts, linked drafts, autonomous lineup items, gate results, and strategy memory",
    primary_surfaces: ["Scheduled Posts", "owner criticism", "scheduled replacement"],
    objects: ["scheduled post review", "rewrite", "reject and replace", "scoped owner lesson"],
    keywords: ["review scheduled post", "rewrite scheduled post", "reject and replace post", "record post criticism"],
    capabilities: ["record optional owner feedback", "replace text without opening the slot", "scope lessons without creating accidental permanent bans"],
    payload: { action_size: "single_record", max_response_bytes: 16000, required_inputs: ["brand_key", "scheduled_post_id", "action", "feedback", "lesson_scope"] },
    route_intent: "review manifest scheduled post",
        related_entry_ids: ["content.manifest_autonomous_post_persistence", "publishing.scheduled_posts", "content.production"],
    recommended_next_planes: ["content_production", "publishing"],
    hard_gates: ["Only unpublished approved posts are reviewable.", "Rewrite and replacement preserve the same scheduled slot.", "Permanent rules require explicit permanent-rule scope."],
  },
  {
    id: "publishing.scheduled_posts",
    title: "Scheduled posts and calendar coverage",
    plane: "publishing",
    system_of_record: "scheduled posts and hourly coverage",
    primary_surfaces: ["Scheduled Posts", "hourly calendar", "Create Post"],
    objects: ["scheduled post", "open slot", "calendar coverage", "approved draft"],
    keywords: ["scheduled posts", "next open slot", "hourly coverage", "schedule approved post"],
    capabilities: ["list scheduled posts", "read hourly coverage", "schedule approved draft"],
    payload: { action_size: "bounded_read", max_results: 50, max_response_bytes: 22000, required_inputs: ["brand_key"] },
    route_intent: "list scheduled posts",
    related_entry_ids: ["publishing.scheduler", "content.production", "product.post_archive"],
    recommended_next_planes: ["publishing", "analytics"],
    hard_gates: ["Only approved, account-owned, gate-passing drafts may be scheduled."],
  },
  {
    id: "publishing.scheduler",
    title: "Scheduled-post publisher and safety control",
    plane: "publishing",
    system_of_record: "Cloudflare Cron, scheduler Durable Object, and persisted control state",
    primary_surfaces: ["scheduler state", "cron", "canary mode", "overdue recovery"],
    objects: ["scheduler", "publishing attempt", "canary", "overdue post"],
    keywords: ["scheduler state", "publishing duplicate", "cron", "canary", "overdue"],
    capabilities: ["read scheduler state", "audit scheduled post", "recover overdue posts"],
    payload: { action_size: "single_record", max_response_bytes: 14000 },
    route_intent: "get scheduled post scheduler state",
    related_entry_ids: ["publishing.scheduled_posts", "product.post_archive", "recovery.control_plane"],
    recommended_next_planes: ["engineering", "recovery"],
    hard_gates: ["Scheduler safety changes and overdue recovery retain protected controls."],
  },
  {
    id: "product.post_archive",
    title: "Published Post Archive",
    plane: "product",
    system_of_record: "published-post archive and posted schedule records",
    primary_surfaces: ["Post Archive", "published post results"],
    objects: ["published post", "archived post", "Threads publication", "post metrics"],
    keywords: ["posted twice", "duplicate publication", "published post", "post results"],
    capabilities: ["find publication", "compare duplicate publications", "read post results"],
    payload: { action_size: "bounded_search", max_results: 20, max_response_bytes: 18000, required_inputs: ["brand_key"] },
    related_entry_ids: ["publishing.scheduler", "publishing.scheduled_posts", "analytics.monthly_growth"],
    recommended_next_planes: ["publishing", "analytics"],
  },
  
    {
    id: "deployment.main_worker",
    title: "Main Worker validation and deployment",
    plane: "deployment",
    system_of_record: "GitHub Actions exact-SHA release workflow and Cloudflare Worker versions",
    primary_surfaces: ["Lensically Engineering workflow", "Cloudflare Worker deployment", "live runtime verification"],
    objects: ["deployment", "Worker version", "release", "live commit"],
    keywords: ["deploy", "release", "ship", "live worker", "exact SHA"],
    capabilities: ["verify repository head", "run fast validation", "run full Operator shards", "deploy exact validated SHA", "verify live version"],
    payload: { action_size: "coherent_change_set", max_response_bytes: 12000 },
    route_intent: "run github workflow",
    related_entry_ids: ["engineering.repository", "engineering.operator_validation", "recovery.control_plane"],
    recommended_next_planes: ["engineering"],
    hard_gates: ["Production releases require one explicit exact 40-character repository SHA.", "The release workflow validates, deploys, and verifies the same SHA.", "Recovery remains break-glass only."],
  },
  {
    id: "recovery.control_plane",
    title: "Independent Recovery control plane",
    plane: "recovery",
    system_of_record: "Recovery Worker and Recovery ChatGPT app",
    primary_surfaces: ["Recovery health", "GitHub workflow dispatch", "Cloudflare deployment inspection"],
    objects: ["recovery plane", "break-glass repair", "deployment dispatch", "rollback"],
    keywords: ["Recovery", "main MCP unavailable", "client blocked", "deployment plane"],
    capabilities: ["inspect main health", "read or repair source", "dispatch verified deployment", "verify live MCP"],
    payload: { action_size: "bounded_mutation", max_response_bytes: 16000 },
    related_entry_ids: ["deployment.main_worker", "publishing.scheduler"],
    recommended_next_planes: ["engineering", "deployment"],
    hard_gates: ["Use Recovery only when the main Worker or its deployment or client path cannot receive or complete the operation."],
  },
];

export const LENSICALLY_SYSTEM_DIRECTORY_INDEX = createSystemDirectoryIndex([...LENSICALLY_SYSTEM_DIRECTORY_ENTRIES]);

export function resolveLensicallySystemDirectory(rawQuery: string): SystemDirectoryDirective | null {
  return resolveSystemDirectory(rawQuery, LENSICALLY_SYSTEM_DIRECTORY_INDEX);
}

export function getLensicallySystemDirectorySummary(): Record<string, unknown> {
  const planes = Array.from(new Set(LENSICALLY_SYSTEM_DIRECTORY_ENTRIES.map((entry) => entry.plane))).sort();
  const routeDefaultCount = LENSICALLY_SYSTEM_DIRECTORY_ENTRIES.filter((entry) => entry.route_intent || entry.default_inputs).length;
  return {
    version: LENSICALLY_SYSTEM_DIRECTORY_VERSION,
    canonical_location: LENSICALLY_SYSTEM_DIRECTORY_CANONICAL_LOCATION,
    entry_count: LENSICALLY_SYSTEM_DIRECTORY_ENTRIES.length,
    planes,
    plane_count: planes.length,
    pre_router_resolution: true,
    compact_directive_only: true,
    advisory_fallback_to_original_intent: true,
    route_default_count: routeDefaultCount,
    capability_lifecycle_version: LENSICALLY_CAPABILITY_LIFECYCLE.version,
    capability_lifecycle_location: LENSICALLY_CAPABILITY_LIFECYCLE.canonical_location,
    capability_lifecycle_mandatory: LENSICALLY_CAPABILITY_LIFECYCLE.mandatory,
    model_executes_capability_lifecycle_automatically: LENSICALLY_CAPABILITY_LIFECYCLE.rules.model_executes_automatically,
    owner_prompt_required_for_routine_capability_work: LENSICALLY_CAPABILITY_LIFECYCLE.rules.owner_prompt_required,
    new_capability_completion_requires: [...LENSICALLY_CAPABILITY_LIFECYCLE.required_sequence],
  };
}


