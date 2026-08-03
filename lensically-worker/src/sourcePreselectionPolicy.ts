type JsonRecord = Record<string, unknown>;

export const SOURCE_PRESELECTION_POLICY_VERSION = "source-preselection-policy-v2";

export type SourcePreselectionAllocationTier = "winner" | "development" | "exploration";

export type SourcePreselectionSignal = {
  signal_type: "hard_ban" | "experiment" | "strategy_directive" | "strongest_evidence" | "weakest_evidence";
  signal_key: string;
  effect: "exclude" | "reserve" | "weight" | "tier";
  detail?: string;
};

export type SourcePreselectionTarget = {
  source_identity_key?: string;
  source_card_id?: string;
  source_card_family_id?: string;
  saved_pattern_id?: string;
};

export type SourcePreselectionHardExclusion = SourcePreselectionTarget & {
  exclusion_key: string;
  reason: string;
  signal: SourcePreselectionSignal;
};

export type SourcePreselectionReservation = SourcePreselectionTarget & {
  reservation_key: string;
  required_slots: number;
  slot_keys: string[];
  variant_key?: string;
  signal: SourcePreselectionSignal;
};

export type SourcePreselectionAdjustment = {
  candidate_key: string;
  score_multiplier: number;
  score_addend: number;
  allocation_tier_override?: SourcePreselectionAllocationTier;
  signals: SourcePreselectionSignal[];
};

export type SourcePreselectionPolicy = {
  contract_version: string;
  policy_hash: string;
  hard_exclusions: SourcePreselectionHardExclusion[];
  experiment_reservations: SourcePreselectionReservation[];
  candidate_adjustments: SourcePreselectionAdjustment[];
  causal_signal_counts: Record<string, number>;
  requested_slot_count: number;
};

export type CompileSourcePreselectionPolicyInput = {
  candidates: JsonRecord[];
  slot_keys: string[];
  strategy_directives?: unknown;
  active_experiments?: unknown;
  hard_bans?: unknown;
  strongest_mature_evidence?: unknown;
  weakest_mature_evidence?: unknown;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function records(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) return [item as JsonRecord];
      return [];
    });
  }
  if (value && typeof value === "object") return [value as JsonRecord];
  return [];
}

function finite(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stable(nested)]),
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(stable(value));
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function candidateKey(candidate: JsonRecord): string {
  return String(
    candidate.source_identity_key
    ?? candidate.source_card_id
    ?? candidate.source_card_family_id
    ?? candidate.saved_pattern_id
    ?? "unknown",
  );
}

function candidateTargets(candidate: JsonRecord): SourcePreselectionTarget {
  const target: SourcePreselectionTarget = {};
  if (candidate.source_identity_key) target.source_identity_key = String(candidate.source_identity_key);
  if (candidate.source_card_id) target.source_card_id = String(candidate.source_card_id);
  if (candidate.source_card_family_id) target.source_card_family_id = String(candidate.source_card_family_id);
  if (candidate.saved_pattern_id) target.saved_pattern_id = String(candidate.saved_pattern_id);
  return target;
}

function candidateReferenceSet(candidate: JsonRecord): Set<string> {
  return new Set([
    candidate.source_identity_key,
    candidate.source_card_id,
    candidate.source_card_family_id,
    candidate.saved_pattern_id,
    candidate.internal_source_id,
    candidate.family_key,
  ].filter((value) => value !== null && value !== undefined && String(value).trim()).map((value) => normalized(value)));
}

function candidateSearchText(candidate: JsonRecord): string {
  const primary = record(candidate.primary_source);
  return [
    candidate.text,
    candidate.source_mechanism,
    candidate.required_product,
    candidate.recommended_direction,
    primary.post_text,
    primary.text,
  ].map(normalized).filter(Boolean).join("\n");
}

const REFERENCE_KEY = /(?:source_identity_key|source_card_id|source_card_family_id|saved_pattern_id|internal_source_id|family_key)$/i;

function collectReferences(value: unknown): string[] {
  const output = new Set<string>();
  const visit = (item: unknown, key = ""): void => {
    if (Array.isArray(item)) {
      for (const child of item) visit(child, key);
      return;
    }
    if (!item || typeof item !== "object") {
      if (REFERENCE_KEY.test(key) && String(item ?? "").trim()) output.add(normalized(item));
      return;
    }
    for (const [childKey, child] of Object.entries(item as JsonRecord)) {
      if (REFERENCE_KEY.test(childKey)) {
        if (Array.isArray(child)) {
          for (const nested of child) if (String(nested ?? "").trim()) output.add(normalized(nested));
        } else if (String(child ?? "").trim()) output.add(normalized(child));
      }
      visit(child, childKey);
    }
  };
  visit(value);
  return [...output];
}

function matchingCandidates(candidates: JsonRecord[], value: unknown): JsonRecord[] {
  const references = new Set(collectReferences(value));
  if (!references.size) return [];
  return candidates.filter((candidate) => [...candidateReferenceSet(candidate)].some((key) => references.has(key)));
}

function addSignalCount(counts: Record<string, number>, type: SourcePreselectionSignal["signal_type"]): void {
  counts[type] = Number(counts[type] ?? 0) + 1;
}

function createAdjustmentStore(): Map<string, SourcePreselectionAdjustment> {
  return new Map<string, SourcePreselectionAdjustment>();
}

function ensureAdjustment(
  store: Map<string, SourcePreselectionAdjustment>,
  candidate: JsonRecord,
): SourcePreselectionAdjustment {
  const key = candidateKey(candidate);
  const existing = store.get(key);
  if (existing) return existing;
  const created: SourcePreselectionAdjustment = {
    candidate_key: key,
    score_multiplier: 1,
    score_addend: 0,
    signals: [],
  };
  store.set(key, created);
  return created;
}

function applyWeight(
  store: Map<string, SourcePreselectionAdjustment>,
  candidate: JsonRecord,
  multiplier: number,
  addend: number,
  signal: SourcePreselectionSignal,
): void {
  const adjustment = ensureAdjustment(store, candidate);
  adjustment.score_multiplier *= multiplier;
  adjustment.score_addend += addend;
  adjustment.signals.push(signal);
}

function applyTier(
  store: Map<string, SourcePreselectionAdjustment>,
  candidate: JsonRecord,
  tier: SourcePreselectionAllocationTier,
  signal: SourcePreselectionSignal,
): void {
  const adjustment = ensureAdjustment(store, candidate);
  adjustment.allocation_tier_override = tier;
  adjustment.signals.push(signal);
}

function hardBanMatchesCandidate(ban: JsonRecord, candidate: JsonRecord): boolean {
  const directMatches = matchingCandidates([candidate], ban).length > 0;
  if (directMatches) return true;
  const searchText = candidateSearchText(candidate);
  if (!searchText) return false;
  const phraseFields = [ban.phrase, ban.rule_text, ban.body];
  for (const value of phraseFields) {
    const phrase = normalized(value);
    if (phrase.length >= 4 && searchText.includes(phrase)) return true;
  }
  const pattern = String(ban.pattern ?? "").trim();
  if (!pattern) return false;
  try {
    return new RegExp(pattern, "i").test(searchText);
  } catch {
    return searchText.includes(normalized(pattern));
  }
}

function recursivelyVisit(value: unknown, visitor: (path: string, value: unknown) => void, path = ""): void {
  visitor(path, value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => recursivelyVisit(item, visitor, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    recursivelyVisit(nested, visitor, path ? `${path}.${key}` : key);
  }
}

function slotKeysFromExperiment(experiment: JsonRecord): string[] {
  const output = new Set<string>();
  recursivelyVisit(experiment, (path, value) => {
    if (!/(?:slot_keys|reserved_slot_keys|required_slot_keys)$/i.test(path)) return;
    if (Array.isArray(value)) {
      for (const item of value) if (String(item ?? "").trim()) output.add(String(item));
    }
  });
  return [...output].sort();
}

function requiredSlotsFromExperiment(experiment: JsonRecord): number {
  let required = 0;
  recursivelyVisit(experiment, (path, value) => {
    if (!/(?:required_slots|reserved_slots|slot_count)$/i.test(path)) return;
    required = Math.max(required, Math.floor(finite(value)));
  });
  return Math.max(0, Math.min(1, required));
}

function strategyWeightEntries(value: unknown): Array<{ reference: string; weight: number; path: string }> {
  const output: Array<{ reference: string; weight: number; path: string }> = [];
  recursivelyVisit(value, (path, nested) => {
    if (!/(?:source_weights|family_weights|candidate_weights|selection_weights)$/i.test(path)) return;
    const mapping = record(nested);
    for (const [reference, weight] of Object.entries(mapping)) {
      const parsed = finite(weight, Number.NaN);
      if (Number.isFinite(parsed) && parsed > 0) output.push({ reference: normalized(reference), weight: parsed, path });
    }
  });
  return output;
}

export function sourcePreselectionTargetMatchesCandidate(
  target: SourcePreselectionTarget,
  candidate: JsonRecord,
): boolean {
  const checks: Array<[unknown, unknown]> = [
    [target.source_identity_key, candidate.source_identity_key],
    [target.source_card_id, candidate.source_card_id],
    [target.source_card_family_id, candidate.source_card_family_id],
    [target.saved_pattern_id, candidate.saved_pattern_id],
  ];
  const populated = checks.filter(([expected]) => expected !== undefined && expected !== null && String(expected).trim());
  return populated.length > 0 && populated.every(([expected, actual]) => normalized(expected) === normalized(actual));
}

export function sourcePreselectionAdjustmentForCandidate(
  policy: SourcePreselectionPolicy | undefined,
  candidate: JsonRecord,
): SourcePreselectionAdjustment | null {
  const key = candidateKey(candidate);
  return policy?.candidate_adjustments.find((adjustment) => adjustment.candidate_key === key) ?? null;
}

export function sourcePreselectionExclusionForCandidate(
  policy: SourcePreselectionPolicy | undefined,
  candidate: JsonRecord,
): SourcePreselectionHardExclusion | null {
  return policy?.hard_exclusions.find((exclusion) => sourcePreselectionTargetMatchesCandidate(exclusion, candidate)) ?? null;
}

export function compileSourcePreselectionPolicy(
  input: CompileSourcePreselectionPolicyInput,
): SourcePreselectionPolicy {
  const candidates = input.candidates.map((candidate) => ({ ...candidate }));
  const hardExclusions: SourcePreselectionHardExclusion[] = [];
  const reservations: SourcePreselectionReservation[] = [];
  const adjustments = createAdjustmentStore();
  const signalCounts: Record<string, number> = {};

  for (const [index, ban] of records(input.hard_bans).entries()) {
    if (ban.active === false || Number(ban.active ?? 1) === 0) continue;
    for (const candidate of candidates) {
      if (!hardBanMatchesCandidate(ban, candidate)) continue;
      const signal: SourcePreselectionSignal = {
        signal_type: "hard_ban",
        signal_key: String(ban.rule_key ?? ban.id ?? `hard-ban-${index}`),
        effect: "exclude",
        detail: String(ban.description ?? ban.rule_text ?? ban.phrase ?? "active hard ban"),
      };
      hardExclusions.push({
        ...candidateTargets(candidate),
        exclusion_key: `${signal.signal_key}:${candidateKey(candidate)}`,
        reason: "preselection_hard_ban",
        signal,
      });
      addSignalCount(signalCounts, signal.signal_type);
    }
  }

  const strategy = input.strategy_directives;
  recursivelyVisit(strategy, (path, value) => {
    if (!path) return;
    const references = collectReferences(value);
    if (!references.length) return;
    const matched = candidates.filter((candidate) => [...candidateReferenceSet(candidate)].some((key) => references.includes(key)));
    if (!matched.length) return;
    if (/(?:ban|block|exclude|forbid)/i.test(path)) {
      for (const candidate of matched) {
        const signal: SourcePreselectionSignal = {
          signal_type: "strategy_directive",
          signal_key: path,
          effect: "exclude",
          detail: "strategy source exclusion",
        };
        hardExclusions.push({
          ...candidateTargets(candidate),
          exclusion_key: `${path}:${candidateKey(candidate)}`,
          reason: "preselection_strategy_exclusion",
          signal,
        });
        addSignalCount(signalCounts, signal.signal_type);
      }
      return;
    }
    const tier = /winner/i.test(path)
      ? "winner"
      : /development/i.test(path)
        ? "development"
        : /exploration/i.test(path)
          ? "exploration"
          : null;
    if (tier && /(?:allocation|tier|source|family|priority)/i.test(path)) {
      for (const candidate of matched) {
        const signal: SourcePreselectionSignal = {
          signal_type: "strategy_directive",
          signal_key: path,
          effect: "tier",
          detail: `forced ${tier} allocation tier`,
        };
        applyTier(adjustments, candidate, tier, signal);
        addSignalCount(signalCounts, signal.signal_type);
      }
      return;
    }
    const multiplier = /(?:promote|boost|increase|prioriti[sz]e)/i.test(path)
      ? 1.25
      : /(?:reduce|deprioriti[sz]e|suppress|cool)/i.test(path)
        ? 0.75
        : null;
    if (multiplier !== null) {
      for (const candidate of matched) {
        const signal: SourcePreselectionSignal = {
          signal_type: "strategy_directive",
          signal_key: path,
          effect: "weight",
          detail: `score multiplier ${multiplier}`,
        };
        applyWeight(adjustments, candidate, multiplier, 0, signal);
        addSignalCount(signalCounts, signal.signal_type);
      }
    }
  });
  for (const entry of strategyWeightEntries(strategy)) {
    for (const candidate of candidates) {
      if (!candidateReferenceSet(candidate).has(entry.reference)) continue;
      const signal: SourcePreselectionSignal = {
        signal_type: "strategy_directive",
        signal_key: entry.path,
        effect: "weight",
        detail: `explicit score multiplier ${entry.weight}`,
      };
      applyWeight(adjustments, candidate, entry.weight, 0, signal);
      addSignalCount(signalCounts, signal.signal_type);
    }
  }

  for (const [index, experiment] of records(input.active_experiments).entries()) {
    const status = normalized(experiment.status ?? "active");
    if (["completed", "stopped", "inactive", "rejected"].includes(status)) continue;
    const requiredSlots = requiredSlotsFromExperiment(experiment);
    if (requiredSlots < 1) continue;
    const matched = matchingCandidates(candidates, experiment).sort((left, right) => candidateKey(left).localeCompare(candidateKey(right)));
    if (!matched.length) continue;
    const candidate = matched[0];
    const reservationKey = String(experiment.experiment_key ?? experiment.id ?? `experiment-${index}`);
    const signal: SourcePreselectionSignal = {
      signal_type: "experiment",
      signal_key: reservationKey,
      effect: "reserve",
      detail: String(experiment.variant_key ?? experiment.follow_up_decision ?? "active experiment reservation"),
    };
    reservations.push({
      ...candidateTargets(candidate),
      reservation_key: reservationKey,
      required_slots: requiredSlots,
      slot_keys: slotKeysFromExperiment(experiment).filter((slotKey) => input.slot_keys.includes(slotKey)),
      variant_key: experiment.variant_key ? String(experiment.variant_key) : undefined,
      signal,
    });
    addSignalCount(signalCounts, signal.signal_type);
  }

  for (const [index, evidence] of records(input.strongest_mature_evidence).entries()) {
    for (const candidate of matchingCandidates(candidates, evidence)) {
      const signal: SourcePreselectionSignal = {
        signal_type: "strongest_evidence",
        signal_key: String(evidence.published_post_id ?? evidence.post_id ?? `strongest-${index}`),
        effect: "weight",
        detail: "mature strongest evidence promotion",
      };
      applyWeight(adjustments, candidate, 1.15, 0.05, signal);
      addSignalCount(signalCounts, signal.signal_type);
    }
  }
  for (const [index, evidence] of records(input.weakest_mature_evidence).entries()) {
    for (const candidate of matchingCandidates(candidates, evidence)) {
      const signal: SourcePreselectionSignal = {
        signal_type: "weakest_evidence",
        signal_key: String(evidence.published_post_id ?? evidence.post_id ?? `weakest-${index}`),
        effect: "weight",
        detail: "mature weakest evidence reduction",
      };
      applyWeight(adjustments, candidate, 0.7, -0.05, signal);
      addSignalCount(signalCounts, signal.signal_type);
    }
  }

  const dedupedExclusions = [...new Map(hardExclusions.map((item) => [item.exclusion_key, item])).values()]
    .sort((left, right) => left.exclusion_key.localeCompare(right.exclusion_key));
    const sortedReservations: SourcePreselectionReservation[] = [];
  const sortedAdjustments: SourcePreselectionAdjustment[] = [];
  const withoutHash = {
    contract_version: SOURCE_PRESELECTION_POLICY_VERSION,
    hard_exclusions: dedupedExclusions,
    experiment_reservations: sortedReservations,
    candidate_adjustments: sortedAdjustments,
    causal_signal_counts: Object.fromEntries(Object.entries(signalCounts).sort(([left], [right]) => left.localeCompare(right))),
    requested_slot_count: input.slot_keys.length,
  };
  return {
    ...withoutHash,
    policy_hash: `${SOURCE_PRESELECTION_POLICY_VERSION}:${hashText(stableJson(withoutHash))}`,
  };
}
