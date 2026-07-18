export * from "./clientSafeRequests";

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
    capabilities: ["read known source file", "apply coherent change set", "verify repository head"],
    payload: { action_size: "coherent_change_set", max_results: 20, max_response_bytes: 16000 },
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
    system_of_record: "Recovery dispatch, GitHub Actions, and Cloudflare Worker versions",
    primary_surfaces: ["Lensically Engineering workflow", "Cloudflare Worker deployment"],
    objects: ["deployment", "Worker version", "release", "live commit"],
    keywords: ["deploy", "release", "ship", "live worker", "exact SHA"],
    capabilities: ["verify repository head", "dispatch Recovery deployment", "verify live version"],
    payload: { action_size: "coherent_change_set", max_response_bytes: 12000 },
    related_entry_ids: ["engineering.repository", "engineering.operator_validation", "recovery.control_plane"],
    recommended_next_planes: ["recovery"],
    hard_gates: ["Deployment requests never use the main public gateway.", "Recovery dispatch requires a verified repository head and passing validation."],
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
  };
}


