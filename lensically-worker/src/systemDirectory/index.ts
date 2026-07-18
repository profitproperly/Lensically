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
    .map((entry) => ({ entry, score: entryScore(query, entry) }))
    .filter((candidate) => candidate.score >= minimumScore)
    .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id));
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
    related_entry_ids: [...(winner.entry.related_entry_ids ?? [])],
    recommended_next_planes: [...(winner.entry.recommended_next_planes ?? [])],
    hard_gates: [...(winner.entry.hard_gates ?? [])],
    confidence,
  };
}
