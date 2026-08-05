import { assertDatabaseIntegrity } from "./databaseIntegrity";
import type { SourcePreselectionPolicy, SourcePreselectionSignal } from "./sourcePreselectionPolicy";
import {
  compileSourcePreselectionPolicy,
  sourcePreselectionAdjustmentForCandidate,
  sourcePreselectionExclusionForCandidate,
  sourcePreselectionTargetMatchesCandidate,
} from "./sourcePreselectionPolicy";
import {
  buildDynamicLaneTargets,
  classifyUnifiedSourceFamily,
  developmentResolutionPriority,
  selectionLaneForLifecycle,
  type UnifiedLifecycleLabel,
  type UnifiedSelectionLane,
} from "./sourceFamilyRankingV7";

export const SOURCE_FAMILY_LABEL_POLICY_VERSION = "source-family-label-policy-v7";
export const SOURCE_SELECTION_ENGINE_VERSION = "source-selection-engine-v9";
export const SOURCE_LABEL_ALLOCATION_POLICY_VERSION = "source-label-allocation-40-60-v1";

export const SOURCE_LABEL_ALLOCATION_ORDER = [
  "probation",
  "tiebreaker",
  "untested",
  "franchise",
  "proven",
  "prospect",
  "emerging",
] as const;

export type SourceSelectableLifetimeLabel = typeof SOURCE_LABEL_ALLOCATION_ORDER[number];

export type SourceLabelAllocationState = {
  policy_version: typeof SOURCE_LABEL_ALLOCATION_POLICY_VERSION;
  balances: Record<SourceSelectableLifetimeLabel, number>;
  selections_total: number;
};

const SOURCE_ESTABLISHED_LABELS = ["franchise", "proven", "prospect", "emerging"] as const;
const SOURCE_UNRESOLVED_LABELS = ["untested", "probation", "tiebreaker"] as const;
const SOURCE_ESTABLISHED_POOL_SHARE = 0.4;
const SOURCE_UNRESOLVED_POOL_SHARE = 0.6;


export type SourceFamilyLifetimeLabel = UnifiedLifecycleLabel;

export type SourceFamilyAuditionState =
  | "untested"
  | "probation"
  | "provisional_pass"
  | "tiebreaker"
  | "graduated"
  | "underperforming";

export function normalizeSourceFamilyLifetimeLabel(value: unknown): SourceFamilyLifetimeLabel {
  const normalized = String(value ?? "untested");
  if (normalized === "disproven") return "underperforming";
    if (["untested", "probation", "tiebreaker", "prospect", "emerging", "proven", "franchise", "underperforming"].includes(normalized)) {
    return normalized as SourceFamilyLifetimeLabel;
  }
  return "untested";
}


export type SourceFamilyRecentLabel =
  | "no_recent_data"
  | "hot"
  | "healthy"
  | "cooling"
  | "cold"
  | "recovering";

export type SourceFamilyConfidenceLabel = "low" | "developing" | "directional" | "reliable";
export type SourceAllocationTier = "winner" | "development" | "exploration";

export type SourceSelectionCandidate = Record<string, unknown> & {
  source_identity_key?: string;
  source_card_id?: string | null;
  source_card_family_id?: string | null;
    lifetime_label?: SourceFamilyLifetimeLabel;
  audition_state?: SourceFamilyAuditionState;
  audition_passes?: number;
  audition_failures?: number;
  audition_opportunities_remaining?: number;
  graduated?: boolean;
    recent_label?: SourceFamilyRecentLabel;
  confidence_label?: SourceFamilyConfidenceLabel;
  lifetime_sample_size?: number;
  unified_rating?: number;
  ranking_score?: number;
  global_rank?: number | null;
  selection_lane?: UnifiedSelectionLane;

  recent_sample_size?: number;
  lifetime_index?: number;
  recent_index?: number | null;
  uses_24h?: number;
  uses_7d?: number;
    uses_28d?: number;
  published_uses_72h?: number;
  future_scheduled_uses?: number;
  latest_published_at?: string | null;
  next_scheduled_at?: string | null;
  published_exposure_times?: string[];
  future_scheduled_exposure_times?: string[];
  semantic_exposure_times?: string[];
  semantic_published_uses_24h?: number;
  semantic_future_scheduled_uses?: number;
    hours_since_last_use?: number | null;
  lifetime_published_uses?: number;
  historical_opportunity_count?: number;
  semantic_key?: string;
};

export type SourceSelectionReceipt = {
  policy_version: string;
  slot_key: string;
  source_identity_key: string;
  source_card_id: string;
  source_card_family_id: string;
    lifetime_label: SourceFamilyLifetimeLabel;
  audition_state: SourceFamilyAuditionState;
  audition_passes: number;
  audition_failures: number;
  audition_opportunities_remaining: number;
  recent_label: SourceFamilyRecentLabel;
  lifetime_sample_size: number;

    lifetime_index: number;
  unified_rating: number;
  ranking_score: number;
  global_rank: number | null;
  selection_lane: UnifiedSelectionLane;
  recent_factor: number;
  shrunk_performance: number;
  exploration_bonus: number;
        cycle_coverage_bonus: number;
  winner_initial_coverage_count: number;
  winner_proportional_weight: number;
  winner_exact_additional_share: number;
  winner_rounded_additional_placements: number;
  winner_final_target_count: number;
  winner_actual_selected_count: number;
  winner_target_satisfied: boolean;
  winner_share_deficit: number;
  development_resolution_priority: number;
  evidence_debt_bonus: number;
  waiting_priority: number;
  historical_opportunity_count: number;
  uses_24h: number;
  uses_7d: number;
  uses_28d: number;
    planned_uses: number;
  semantic_key: string;
  semantic_overlap_count: number;
  published_uses_72h: number;
  future_scheduled_uses: number;
  semantic_published_uses_24h: number;
  semantic_future_scheduled_uses: number;
  allocation_tier: SourceAllocationTier;
  exposure_burden: number;
  negative_evidence_multiplier: number;
  cooldown_hours: number;
  cooldown_relaxation: number;
    score: number;
  deterministic_tiebreak: number;
  preselection_policy_version?: string;
  preselection_policy_hash?: string;
  preselection_score_multiplier?: number;
  preselection_score_addend?: number;
    preselection_signals?: SourcePreselectionSignal[];
  experiment_reservation_key?: string | null;
  allocation_policy_version: typeof SOURCE_LABEL_ALLOCATION_POLICY_VERSION;
  allocation_label: SourceSelectableLifetimeLabel;
  allocation_available_labels: SourceSelectableLifetimeLabel[];
  allocation_effective_shares: Partial<Record<SourceSelectableLifetimeLabel, number>>;
  allocation_balances_before: Record<SourceSelectableLifetimeLabel, number>;
  allocation_balances_after: Record<SourceSelectableLifetimeLabel, number>;
  allocation_selections_total_before: number;
  allocation_selections_total_after: number;
  allocation_state_before_cycle: SourceLabelAllocationState;
  allocation_state_after_cycle: SourceLabelAllocationState;
};


function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value ?? "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}


function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function loadLiveSavedPatternIds(db: D1Database): Promise<Set<string> | null> {
  const table = await db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'external_patterns' LIMIT 1`,
  ).first<{ name: string }>();
  if (!table?.name) return null;
  const rows = await db.prepare(`SELECT CAST(id AS TEXT) AS id FROM external_patterns`).all<{ id: string }>();
  return new Set((rows.results ?? []).map((row) => String(row.id)));
}

function isLiveSavedPatternId(liveIds: Set<string> | null, value: unknown): boolean {
  const id = String(value ?? "");
  return liveIds === null || !/^\d+$/.test(id) || liveIds.has(id);
}

export function isSourceCardOriginEligibleForSelection(
  sourceType: unknown,
  savedPatternId: unknown,
  liveSavedPatternIds: Set<string> | null,
): boolean {
  return String(sourceType ?? "").trim() !== "saved_pattern"
    || isLiveSavedPatternId(liveSavedPatternIds, savedPatternId);
}


export function extractOwnerBannedSavedPatternIds(value: unknown): Set<string> {
  const ids = new Set<string>();
    const visit = (item: unknown, key = ""): void => {
    if (typeof item === "number") {
      if (/saved[ _-]*patterns?/i.test(key) && Number.isInteger(item) && item > 0) ids.add(String(item));
      return;
    }
    if (typeof item === "string") {
      if (/saved[ _-]*patterns?/i.test(key) || /saved\s+patterns?/i.test(item)) {
        for (const match of item.matchAll(/\b\d+\b/g)) ids.add(match[0]);
      }
      return;
    }
    if (Array.isArray(item)) {
      for (const child of item) visit(child, key);
      return;
    }
    if (!item || typeof item !== "object") return;
    for (const [childKey, child] of Object.entries(item as Record<string, unknown>)) {
      if (/saved[ _-]*pattern/i.test(childKey) && (typeof child === "number" || typeof child === "string")) {
        const normalized = String(child);
        if (/^\d+$/.test(normalized)) ids.add(normalized);
      }
      visit(child, childKey);
    }
  };
  visit(value);
  return ids;
}

function normalizedIndex(value: number, baseline: number): number {
  if (baseline > 0) return Math.max(0, value) / baseline;
  if (value <= 0) return 1;
  return 1 + Math.log1p(value);
}

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normalCdf(value: number): number {
  return 0.5 * (1 + erf(value / Math.sqrt(2)));
}

function posteriorThresholdProbability(
  indexes: number[],
  threshold: number,
  direction: "above" | "below",
): number {
  if (!indexes.length) return 0.5;
  const logs = indexes.map((value) => Math.log(clamp(value, 0.05, 20)));
  const priorVariance = 1;
    const observationVariance = 0.25;

  const posteriorPrecision = 1 / priorVariance + logs.length / observationVariance;
  const posteriorMean = (logs.reduce((sum, value) => sum + value, 0) / observationVariance) / posteriorPrecision;
  const posteriorSd = Math.sqrt(1 / posteriorPrecision);
  const rawAbove = 1 - normalCdf((Math.log(threshold) - posteriorMean) / posteriorSd);
  const raw = direction === "above" ? rawAbove : 1 - rawAbove;
  const evidenceCap = 1 - Math.exp(-logs.length / 2.5);
  return clamp(0.5 + (raw - 0.5) * evidenceCap, 0, 1);
}

function confidenceLabel(probabilities: number[]): SourceFamilyConfidenceLabel {
  const strongest = Math.max(...probabilities.map((value) => Math.max(value, 1 - value)));
  if (strongest >= 0.9) return "reliable";
  if (strongest >= 0.8) return "directional";
  if (strongest >= 0.65) return "developing";
  return "low";
}

export function classifySourceFamilyLifetime(input: {
  indexes: number[];
  age_days?: number[];
}): {
  label: SourceFamilyLifetimeLabel;
  audition_state: SourceFamilyAuditionState;
  audition_passes: number;
  audition_failures: number;
  audition_opportunities_remaining: number;
  graduated: boolean;
  median_index: number | null;
  unified_rating: number;
  ranking_score: number;
  effective_sample_size: number;
  selection_lane: UnifiedSelectionLane;
  probability_above_median: number;
  probability_above_franchise_floor: number;
  probability_below_underperformance_floor: number;
  confidence_label: SourceFamilyConfidenceLabel;
} {
  const indexes = input.indexes.filter(Number.isFinite).map((value) => Math.max(0, value));
  const unified = classifyUnifiedSourceFamily(indexes.map((index, position) => ({
    index,
    age_days: input.age_days?.[position] ?? 0,
  })));
  const label = unified.lifecycle_label as SourceFamilyLifetimeLabel;
  const auditionState: SourceFamilyAuditionState = label === "untested"
    ? "untested"
    : label === "probation"
      ? "probation"
      : label === "tiebreaker"
        ? "tiebreaker"
        : label === "underperforming"
          ? "underperforming"
          : indexes.length === 1
            ? "provisional_pass"
            : "graduated";
  const auditionOpportunitiesRemaining = label === "untested"
    ? 2
    : label === "probation" || label === "tiebreaker" || indexes.length === 1
      ? 1
      : 0;
  return {
    label,
    audition_state: auditionState,
    audition_passes: unified.pass_count,
    audition_failures: unified.failure_count,
    audition_opportunities_remaining: auditionOpportunitiesRemaining,
    graduated: ["emerging", "proven", "franchise"].includes(label) || (label === "prospect" && indexes.length >= 2),
    median_index: indexes.length ? unified.raw_weighted_index : null,
    unified_rating: unified.unified_rating,
    ranking_score: unified.ranking_score,
    effective_sample_size: unified.effective_sample_size,
    selection_lane: unified.selection_lane,
    probability_above_median: unified.probability_above_median,
    probability_above_franchise_floor: unified.probability_above_franchise_floor,
    probability_below_underperformance_floor: unified.probability_below_underperformance_floor,
    confidence_label: unified.confidence_label,
  };
}


export function classifySourceFamilyRecent(input: {
  recent_indexes: number[];
  previous_label?: SourceFamilyRecentLabel | null;
}): {
  label: SourceFamilyRecentLabel;
  median_index: number | null;
  latest_two_index: number | null;
} {
  void input;
  return { label: "no_recent_data", median_index: null, latest_two_index: null };
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableUnit(value: string): number {
  return stableHash(value) / 4294967295;
}

function semanticToken(value: unknown): string {
  return String(value ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 180) || "unknown";
}

function parseTimeMs(value: unknown): number | null {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampMs(value: string): number | null {
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00Z` : value;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function slotDistanceHours(left: string, right: string): number {
  const leftMs = timestampMs(left);
  const rightMs = timestampMs(right);
  if (leftMs === null || rightMs === null) return Number.POSITIVE_INFINITY;
  return Math.abs(leftMs - rightMs) / 3600000;
}

function allocationTierForLabel(label: SourceFamilyLifetimeLabel | undefined): SourceAllocationTier {
  const lane = selectionLaneForLifecycle(normalizeSourceFamilyLifetimeLabel(label));
  if (lane === "exploit") return "winner";
  if (lane === "develop") return "development";
  return "exploration";
}

function allocationTierForCandidate(
  candidate: SourceSelectionCandidate,
  policy?: SourcePreselectionPolicy,
): SourceAllocationTier {
  void policy;
  return allocationTierForLabel(candidate.lifetime_label);
}

function emptySourceLabelAllocationBalances(): Record<SourceSelectableLifetimeLabel, number> {
  return Object.fromEntries(SOURCE_LABEL_ALLOCATION_ORDER.map((label) => [label, 0]))
    as Record<SourceSelectableLifetimeLabel, number>;
}

export function normalizeSourceLabelAllocationState(value?: unknown): SourceLabelAllocationState {
  const record = parseJsonRecord(value);
  const rawBalances = parseJsonRecord(record.balances);
  const balances = emptySourceLabelAllocationBalances();
  for (const label of SOURCE_LABEL_ALLOCATION_ORDER) {
    balances[label] = Number(finiteNumber(rawBalances[label]).toFixed(12));
  }
  return {
    policy_version: SOURCE_LABEL_ALLOCATION_POLICY_VERSION,
    balances,
    selections_total: Math.max(0, Math.floor(finiteNumber(record.selections_total))),
  };
}

function cloneSourceLabelAllocationState(state: SourceLabelAllocationState): SourceLabelAllocationState {
  return normalizeSourceLabelAllocationState(state);
}

export function buildSourceLabelEffectiveShares(
  availableLabels: Iterable<SourceSelectableLifetimeLabel>,
): Partial<Record<SourceSelectableLifetimeLabel, number>> {
  const available = new Set(availableLabels);
  const established = SOURCE_ESTABLISHED_LABELS.filter((label) => available.has(label));
  const unresolved = SOURCE_UNRESOLVED_LABELS.filter((label) => available.has(label));
  const shares: Partial<Record<SourceSelectableLifetimeLabel, number>> = {};
  if (!established.length && !unresolved.length) return shares;
  const establishedPool = unresolved.length ? SOURCE_ESTABLISHED_POOL_SHARE : 1;
  const unresolvedPool = established.length ? SOURCE_UNRESOLVED_POOL_SHARE : 1;
  for (const label of established) shares[label] = establishedPool / established.length;
  for (const label of unresolved) shares[label] = unresolvedPool / unresolved.length;
  return shares;
}

function advanceSourceLabelAllocation(
  state: SourceLabelAllocationState,
  availableLabels: SourceSelectableLifetimeLabel[],
  forcedLabel?: SourceSelectableLifetimeLabel | null,
): {
  selected_label: SourceSelectableLifetimeLabel;
  shares: Partial<Record<SourceSelectableLifetimeLabel, number>>;
  balances_before: Record<SourceSelectableLifetimeLabel, number>;
  state_after: SourceLabelAllocationState;
} {
  const shares = buildSourceLabelEffectiveShares(availableLabels);
  const balancesBefore = { ...state.balances };
  const credited = { ...state.balances };
  for (const label of availableLabels) credited[label] += finiteNumber(shares[label]);
  const selectedLabel = forcedLabel ?? [...availableLabels].sort((left, right) =>
    credited[right] - credited[left]
    || SOURCE_LABEL_ALLOCATION_ORDER.indexOf(left) - SOURCE_LABEL_ALLOCATION_ORDER.indexOf(right)
  )[0];
  if (!selectedLabel || !availableLabels.includes(selectedLabel)) {
    throw new Error("source_label_allocation_unavailable");
  }
  credited[selectedLabel] -= 1;
  for (const label of SOURCE_LABEL_ALLOCATION_ORDER) credited[label] = Number(credited[label].toFixed(12));
  return {
    selected_label: selectedLabel,
    shares,
    balances_before: balancesBefore,
    state_after: {
      policy_version: SOURCE_LABEL_ALLOCATION_POLICY_VERSION,
      balances: credited,
      selections_total: state.selections_total + 1,
    },
  };
}

function buildAllocationTargets(

  candidates: SourceSelectionCandidate[],
  requestedSlots: number,
  policy?: SourcePreselectionPolicy,
): Record<SourceAllocationTier, number> {
  const available: Record<SourceAllocationTier, number> = { winner: 0, development: 0, exploration: 0 };
  for (const candidate of candidates) available[allocationTierForCandidate(candidate, policy)] += 1;
  const dynamic = buildDynamicLaneTargets({
    requested_slots: requestedSlots,
    exploit_source_count: available.winner,
    develop_source_count: available.development,
    explore_source_count: available.exploration,
  });
  return {
    winner: dynamic.exploit,
    development: dynamic.develop,
    exploration: dynamic.explore,
  };
}

export type WinnerAllocationTarget = {
  source_identity_key: string;
  source_card_family_id: string;
  ranking_score: number;
  global_rank: number | null;
  initial_coverage_count: number;
  proportional_weight: number;
  exact_additional_share: number;
  rounded_additional_placements: number;
  final_target_count: number;
};

export function buildWinnerAllocationPlan(
  candidates: SourceSelectionCandidate[],
  winnerSlots: number,
): WinnerAllocationTarget[] {
  const requested = Math.max(0, Math.floor(winnerSlots));
  const byFamily = new Map<string, SourceSelectionCandidate>();
  for (const candidate of candidates) {
    if (allocationTierForCandidate(candidate) !== "winner") continue;
    const familyId = String(candidate.source_card_family_id ?? "");
    const identity = String(candidate.source_identity_key ?? "");
    if (!familyId || !identity) continue;
    const existing = byFamily.get(familyId);
    if (!existing || finiteNumber(candidate.ranking_score, finiteNumber(candidate.unified_rating, 1))
      > finiteNumber(existing.ranking_score, finiteNumber(existing.unified_rating, 1))) {
      byFamily.set(familyId, candidate);
    }
  }
  const ranked = [...byFamily.values()].sort((left, right) =>
    finiteNumber(right.ranking_score, finiteNumber(right.unified_rating, 1))
      - finiteNumber(left.ranking_score, finiteNumber(left.unified_rating, 1))
    || finiteNumber(left.global_rank, Number.MAX_SAFE_INTEGER) - finiteNumber(right.global_rank, Number.MAX_SAFE_INTEGER)
    || String(left.source_identity_key).localeCompare(String(right.source_identity_key))
  );
  if (!ranked.length || requested === 0) return ranked.map((candidate) => ({
    source_identity_key: String(candidate.source_identity_key),
    source_card_family_id: String(candidate.source_card_family_id),
    ranking_score: Math.max(0, finiteNumber(candidate.ranking_score, finiteNumber(candidate.unified_rating, 1))),
    global_rank: candidate.global_rank === null || candidate.global_rank === undefined ? null : Math.max(1, finiteNumber(candidate.global_rank, 1)),
    initial_coverage_count: 0,
    proportional_weight: 0,
    exact_additional_share: 0,
    rounded_additional_placements: 0,
    final_target_count: 0,
  }));

  if (requested < ranked.length) {
    return ranked.map((candidate, index) => ({
      source_identity_key: String(candidate.source_identity_key),
      source_card_family_id: String(candidate.source_card_family_id),
      ranking_score: Math.max(0, finiteNumber(candidate.ranking_score, finiteNumber(candidate.unified_rating, 1))),
      global_rank: candidate.global_rank === null || candidate.global_rank === undefined ? null : Math.max(1, finiteNumber(candidate.global_rank, 1)),
      initial_coverage_count: index < requested ? 1 : 0,
      proportional_weight: 0,
      exact_additional_share: 0,
      rounded_additional_placements: 0,
      final_target_count: index < requested ? 1 : 0,
    }));
  }

  const additionalCapacity = requested - ranked.length;
  const rawWeights = ranked.map((candidate) => Math.max(0, finiteNumber(
    candidate.ranking_score,
    finiteNumber(candidate.unified_rating, 1),
  )));
  const positiveWeightTotal = rawWeights.reduce((sum, weight) => sum + weight, 0);
  const weights = positiveWeightTotal > 0 ? rawWeights : ranked.map(() => 1);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const working = ranked.map((candidate, index) => {
    const exactAdditionalShare = additionalCapacity * (weights[index] / Math.max(weightTotal, Number.EPSILON));
    const roundedAdditionalPlacements = Math.floor(exactAdditionalShare);
    return {
      candidate,
      proportionalWeight: weights[index],
      exactAdditionalShare,
      roundedAdditionalPlacements,
      remainder: exactAdditionalShare - roundedAdditionalPlacements,
    };
  });
  let unassigned = additionalCapacity - working.reduce((sum, item) => sum + item.roundedAdditionalPlacements, 0);
  const remainderOrder = [...working].sort((left, right) =>
    right.remainder - left.remainder
    || finiteNumber(right.candidate.ranking_score, finiteNumber(right.candidate.unified_rating, 1))
      - finiteNumber(left.candidate.ranking_score, finiteNumber(left.candidate.unified_rating, 1))
    || String(left.candidate.source_identity_key).localeCompare(String(right.candidate.source_identity_key))
  );
  for (let index = 0; index < remainderOrder.length && unassigned > 0; index += 1, unassigned -= 1) {
    remainderOrder[index].roundedAdditionalPlacements += 1;
  }

  return working.map((item) => ({
    source_identity_key: String(item.candidate.source_identity_key),
    source_card_family_id: String(item.candidate.source_card_family_id),
    ranking_score: Math.max(0, finiteNumber(item.candidate.ranking_score, finiteNumber(item.candidate.unified_rating, 1))),
    global_rank: item.candidate.global_rank === null || item.candidate.global_rank === undefined
      ? null
      : Math.max(1, finiteNumber(item.candidate.global_rank, 1)),
    initial_coverage_count: 1,
    proportional_weight: item.proportionalWeight,
    exact_additional_share: item.exactAdditionalShare,
    rounded_additional_placements: item.roundedAdditionalPlacements,
    final_target_count: 1 + item.roundedAdditionalPlacements,
  }));
}

function chooseAllocationTier(
  targets: Record<SourceAllocationTier, number>,
  selected: Record<SourceAllocationTier, number>,
  available: Set<SourceAllocationTier>,
  slotIndex: number,
  slotCount: number,
): SourceAllocationTier | null {
  const order: SourceAllocationTier[] = ["winner", "development", "exploration"];
  const ranked = order
    .filter((tier) => available.has(tier) && selected[tier] < targets[tier])
    .map((tier) => ({
      tier,
      deficit: targets[tier] * ((slotIndex + 1) / Math.max(1, slotCount)) - selected[tier],
    }))
    .sort((left, right) => right.deficit - left.deficit || order.indexOf(left.tier) - order.indexOf(right.tier));
  return ranked[0]?.tier ?? null;
}


export async function ensureSourceFamilySelectionTables(db: D1Database): Promise<void> {
  await Promise.all([
    assertDatabaseIntegrity(db, {
      table: "operator_source_family_evidence_states",
      columns: ["id", "brand_key", "source_card_family_id", "source_identity_key", "label_policy_version", "lifetime_label", "recent_label", "confidence_label", "lifetime_sample_size", "recent_sample_size", "account_lifetime_median_likes", "account_28d_median_likes", "family_lifetime_median_likes", "family_28d_median_likes", "lifetime_index", "recent_index", "latest_two_recent_index", "probability_above_median", "probability_above_franchise_floor", "probability_below_underperformance_floor", "state_json", "created_at", "updated_at"],
    }),
    assertDatabaseIntegrity(db, {
      table: "operator_source_family_label_transitions",
      columns: ["id", "brand_key", "source_card_family_id", "source_identity_key", "label_policy_version", "previous_lifetime_label", "lifetime_label", "previous_recent_label", "recent_label", "evidence_json", "created_at"],
    }),
    assertDatabaseIntegrity(db, {
      table: "operator_source_selection_receipts",
      columns: ["id", "brand_key", "scope_type", "scope_id", "slot_key", "selection_order", "source_identity_key", "source_card_family_id", "source_card_id", "engine_version", "receipt_json", "created_at"],
    }),
        assertDatabaseIntegrity(db, {
      table: "operator_source_selection_plans",
      columns: ["id", "brand_key", "cycle_id", "slot_key", "selection_order", "source_identity_key", "source_card_family_id", "source_card_id", "engine_version", "receipt_json", "status", "created_at", "updated_at"],
    }),
    assertDatabaseIntegrity(db, {
      table: "operator_source_label_allocation_state",
      columns: ["brand_key", "policy_version", "state_json", "last_cycle_id", "created_at", "updated_at"],
    }),
  ]);
}

export async function loadSourceLabelAllocationState(
  db: D1Database,
  brandKey: string,
  cycleId?: string,
): Promise<SourceLabelAllocationState> {
  await ensureSourceFamilySelectionTables(db);
  if (cycleId) {
    const existingCycle = await db.prepare(
      `SELECT receipt_json FROM operator_source_selection_plans
       WHERE brand_key = ? AND cycle_id = ? AND engine_version = ? AND status = 'locked'
       ORDER BY selection_order ASC LIMIT 1`,
    ).bind(brandKey, cycleId, SOURCE_SELECTION_ENGINE_VERSION).first<{ receipt_json: string }>();
    const beforeCycle = parseJsonRecord(parseJsonRecord(existingCycle?.receipt_json).allocation_state_before_cycle);
    if (beforeCycle.policy_version === SOURCE_LABEL_ALLOCATION_POLICY_VERSION) {
      return normalizeSourceLabelAllocationState(beforeCycle);
    }
  }
  const row = await db.prepare(
    `SELECT policy_version, state_json FROM operator_source_label_allocation_state WHERE brand_key = ?`,
  ).bind(brandKey).first<{ policy_version: string; state_json: string }>();
  if (String(row?.policy_version ?? "") !== SOURCE_LABEL_ALLOCATION_POLICY_VERSION) {
    return normalizeSourceLabelAllocationState();
  }
  return normalizeSourceLabelAllocationState(parseJsonRecord(row?.state_json));
}

async function reconcileSourceLabelAllocationState(
  db: D1Database,
  input: { brand_key: string; cycle_id: string; receipts: SourceSelectionReceipt[] },
): Promise<void> {
  if (!input.receipts.length) return;
  const before = normalizeSourceLabelAllocationState(input.receipts[0].allocation_state_before_cycle);
  const after = normalizeSourceLabelAllocationState(input.receipts[input.receipts.length - 1].allocation_state_after_cycle);
  const existing = await db.prepare(
    `SELECT policy_version, state_json, last_cycle_id
     FROM operator_source_label_allocation_state WHERE brand_key = ?`,
  ).bind(input.brand_key).first<{ policy_version: string; state_json: string; last_cycle_id: string | null }>();
  const current = String(existing?.policy_version ?? "") === SOURCE_LABEL_ALLOCATION_POLICY_VERSION
    ? normalizeSourceLabelAllocationState(parseJsonRecord(existing?.state_json))
    : normalizeSourceLabelAllocationState();
  const sameState = (left: SourceLabelAllocationState, right: SourceLabelAllocationState): boolean =>
    JSON.stringify(left) === JSON.stringify(right);
  if (existing?.last_cycle_id !== input.cycle_id && !sameState(current, before)) {
    throw new Error("source_label_allocation_state_conflict");
  }
  await db.prepare(
    `INSERT INTO operator_source_label_allocation_state (
       brand_key, policy_version, state_json, last_cycle_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(brand_key) DO UPDATE SET
       policy_version = excluded.policy_version,
       state_json = excluded.state_json,
       last_cycle_id = excluded.last_cycle_id,
       updated_at = CURRENT_TIMESTAMP`,
  ).bind(
    input.brand_key,
    SOURCE_LABEL_ALLOCATION_POLICY_VERSION,
    JSON.stringify(after),
    input.cycle_id,
  ).run();
}


export async function refreshSourceFamilyLabels(
  db: D1Database,
  brandKey: string,
  nowIso = new Date().toISOString(),
): Promise<Record<string, unknown>> {
  await ensureSourceFamilySelectionTables(db);
        const familyRows = await db.prepare(
      `SELECT fam.id AS source_card_family_id, fam.source_identity_key,
              COALESCE(sel.source_type, fam.source_type, 'source_card') AS source_origin_type,
              CASE
                WHEN COALESCE(sel.source_type, fam.source_type) = 'saved_pattern'
                THEN COALESCE(sel.internal_source_id, fam.internal_source_id)
                ELSE NULL
              END AS saved_pattern_id
       FROM operator_source_card_families fam
       JOIN operator_source_cards card
         ON card.id = fam.current_source_card_id
        AND card.brand_key = fam.brand_key
        AND card.is_current = 1
       LEFT JOIN operator_source_selections sel
         ON sel.id = card.source_selection_id
        AND sel.brand_key = card.brand_key
       WHERE fam.brand_key = ?
         AND fam.status = 'active'
         AND card.status = 'locked'`,
    ).bind(brandKey).all<Record<string, unknown>>();
  const liveSavedPatternIds = await loadLiveSavedPatternIds(db);
  const eligibleFamilyRows = (familyRows.results ?? []).filter((row) =>
    isSourceCardOriginEligibleForSelection(
      row.source_origin_type,
      row.saved_pattern_id,
      liveSavedPatternIds,
    )
  );


  const evidenceRows = await db.prepare(
    `SELECT c.family_id AS source_card_family_id, fam.source_identity_key,
            s.published_post_id, s.captured_at, s.metrics_json,
            COALESCE(a.post_timestamp, s.captured_at) AS posted_at
     FROM operator_post_performance_scores s
     JOIN operator_post_fingerprints f
       ON f.brand_key = s.brand_key AND f.published_post_id = s.published_post_id
     JOIN operator_source_cards c
       ON c.id = f.source_card_id AND c.brand_key = s.brand_key
     JOIN operator_source_card_families fam
       ON fam.id = c.family_id AND fam.brand_key = s.brand_key
     LEFT JOIN threads_posts_archive a ON a.post_id = s.published_post_id
     WHERE s.brand_key = ? AND s.checkpoint_hours = 24 AND s.valid_for_learning = 1`,
  ).bind(brandKey).all<Record<string, unknown>>();
  const accountRows = await db.prepare(
    `SELECT s.published_post_id, s.captured_at, s.metrics_json,
            COALESCE(a.post_timestamp, s.captured_at) AS posted_at
     FROM operator_post_performance_scores s
     LEFT JOIN threads_posts_archive a ON a.post_id = s.published_post_id
     WHERE s.brand_key = ? AND s.checkpoint_hours = 24 AND s.valid_for_learning = 1`,
  ).bind(brandKey).all<Record<string, unknown>>();
  const previousRows = await db.prepare(
    `SELECT * FROM operator_source_family_evidence_states WHERE brand_key = ?`,
  ).bind(brandKey).all<Record<string, unknown>>();
  const previousByFamily = new Map((previousRows.results ?? []).map((row) => [String(row.source_card_family_id), row]));
    const nowMs = parseTimeMs(nowIso) ?? Date.now();
  const likesFromRow = (row: Record<string, unknown>): number => {
    try {
      const metrics = JSON.parse(String(row.metrics_json ?? "{}")) as Record<string, unknown>;
      return Math.max(0, finiteNumber(metrics.likes));
    } catch {
      return 0;
    }
  };
    const accountTimeline = [...(accountRows.results ?? [])].sort((left, right) =>
    String(left.posted_at ?? left.captured_at).localeCompare(String(right.posted_at ?? right.captured_at))
  );
  const accountLifetimeLikes = accountTimeline.map(likesFromRow);
  const accountLifetimeMedian = median(accountLifetimeLikes) ?? 0;
  const rollingBaselineByPostId = new Map<string, number>();
  for (let index = 0; index < accountTimeline.length; index += 1) {
    const window = accountTimeline.slice(Math.max(0, index - 39), index + 1).map(likesFromRow);
    rollingBaselineByPostId.set(
      String(accountTimeline[index].published_post_id ?? ""),
      median(window) ?? accountLifetimeMedian,
    );
  }
  const evidenceByFamily = new Map<string, Record<string, unknown>[]>();
  for (const row of evidenceRows.results ?? []) {
    const familyId = String(row.source_card_family_id ?? "");
    if (!familyId) continue;
    const rows = evidenceByFamily.get(familyId) ?? [];
    rows.push(row);
    evidenceByFamily.set(familyId, rows);
  }
  const stateStatements: D1PreparedStatement[] = [];
  const transitionStatements: D1PreparedStatement[] = [];
  const labelCounts: Record<string, number> = {};
    for (const family of eligibleFamilyRows) {
    const familyId = String(family.source_card_family_id ?? "");
    const sourceIdentityKey = String(family.source_identity_key ?? "");
    if (!familyId || !sourceIdentityKey) continue;
    const rows = (evidenceByFamily.get(familyId) ?? []).sort((left, right) =>
      String(left.posted_at ?? left.captured_at).localeCompare(String(right.posted_at ?? right.captured_at))
    );
            const lifetimeLikes = rows.map(likesFromRow);
    const lifetimeIndexes = rows.map((row) => normalizedIndex(
      likesFromRow(row),
      rollingBaselineByPostId.get(String(row.published_post_id ?? "")) ?? accountLifetimeMedian,
    ));
    const ageDays = rows.map((row) => {
      const observedMs = parseTimeMs(row.posted_at ?? row.captured_at);
      return observedMs === null ? 0 : Math.max(0, (nowMs - observedMs) / 86400000);
    });
    const previous = previousByFamily.get(familyId);
    const lifetime = classifySourceFamilyLifetime({ indexes: lifetimeIndexes, age_days: ageDays });
    const familyLifetimeMedian = median(lifetimeLikes);
    const state = {
      policy_version: SOURCE_FAMILY_LABEL_POLICY_VERSION,
      lifecycle_label: lifetime.label,
      selection_lane: lifetime.selection_lane,
      unified_rating: lifetime.unified_rating,
      ranking_score: lifetime.ranking_score,
      lifetime: {
        label: lifetime.label,
        audition_state: lifetime.audition_state,
        audition_passes: lifetime.audition_passes,
        audition_failures: lifetime.audition_failures,
        audition_opportunities_remaining: lifetime.audition_opportunities_remaining,
        graduated: lifetime.graduated,
        sample_size: lifetimeLikes.length,
        effective_sample_size: lifetime.effective_sample_size,
        median_likes: familyLifetimeMedian,
        account_median_likes: accountLifetimeMedian,
        median_index: lifetime.median_index,
        unified_rating: lifetime.unified_rating,
        ranking_score: lifetime.ranking_score,
        selection_lane: lifetime.selection_lane,
        probability_above_median: lifetime.probability_above_median,
        probability_above_franchise_floor: lifetime.probability_above_franchise_floor,
        probability_below_underperformance_floor: lifetime.probability_below_underperformance_floor,
      },
            normalization_contract: {
        maturity_horizon_hours: 24,
        account_baseline: "rolling_previous_40_matured_posts_including_current",
        comparable_across_account_growth: true,
      },
      recent_classification: "retired",
      confidence_label: lifetime.confidence_label,
      updated_at: nowIso,
    };
    labelCounts[lifetime.label] = Number(labelCounts[lifetime.label] ?? 0) + 1;
    stateStatements.push(db.prepare(
      `INSERT INTO operator_source_family_evidence_states (
        id, brand_key, source_card_family_id, source_identity_key, label_policy_version,
        lifetime_label, recent_label, confidence_label, lifetime_sample_size, recent_sample_size,
        account_lifetime_median_likes, account_28d_median_likes,
        family_lifetime_median_likes, family_28d_median_likes, lifetime_index, recent_index,
        latest_two_recent_index, probability_above_median, probability_above_franchise_floor,
        probability_below_underperformance_floor, state_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(brand_key, source_card_family_id) DO UPDATE SET
        source_identity_key = excluded.source_identity_key,
        label_policy_version = excluded.label_policy_version,
        lifetime_label = excluded.lifetime_label,
        recent_label = excluded.recent_label,
        confidence_label = excluded.confidence_label,
        lifetime_sample_size = excluded.lifetime_sample_size,
        recent_sample_size = excluded.recent_sample_size,
        account_lifetime_median_likes = excluded.account_lifetime_median_likes,
        account_28d_median_likes = excluded.account_28d_median_likes,
        family_lifetime_median_likes = excluded.family_lifetime_median_likes,
        family_28d_median_likes = excluded.family_28d_median_likes,
        lifetime_index = excluded.lifetime_index,
        recent_index = excluded.recent_index,
        latest_two_recent_index = excluded.latest_two_recent_index,
        probability_above_median = excluded.probability_above_median,
        probability_above_franchise_floor = excluded.probability_above_franchise_floor,
        probability_below_underperformance_floor = excluded.probability_below_underperformance_floor,
        state_json = excluded.state_json,
        updated_at = CURRENT_TIMESTAMP`,
        ).bind(
      crypto.randomUUID(), brandKey, familyId, sourceIdentityKey, SOURCE_FAMILY_LABEL_POLICY_VERSION,
      lifetime.label, "no_recent_data", lifetime.confidence_label, lifetimeLikes.length, 0,
      accountLifetimeMedian, 0, familyLifetimeMedian, null,
      lifetime.unified_rating, null, null,
      lifetime.probability_above_median, lifetime.probability_above_franchise_floor,
      lifetime.probability_below_underperformance_floor, JSON.stringify(state),
    ));
    const previousLifetime = previous ? String(previous.lifetime_label ?? "") : null;
    const previousRecent = previous ? String(previous.recent_label ?? "") : null;
    if (previousLifetime !== lifetime.label) {
      transitionStatements.push(db.prepare(
        `INSERT INTO operator_source_family_label_transitions (
          id, brand_key, source_card_family_id, source_identity_key, label_policy_version,
          previous_lifetime_label, lifetime_label, previous_recent_label, recent_label, evidence_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(), brandKey, familyId, sourceIdentityKey, SOURCE_FAMILY_LABEL_POLICY_VERSION,
        previousLifetime, lifetime.label, previousRecent, "no_recent_data", JSON.stringify(state),
      ));
    }
  }
  for (let index = 0; index < stateStatements.length; index += 50) {
    await db.batch(stateStatements.slice(index, index + 50));
  }
  for (let index = 0; index < transitionStatements.length; index += 50) {
    await db.batch(transitionStatements.slice(index, index + 50));
  }
    return {
    policy_version: SOURCE_FAMILY_LABEL_POLICY_VERSION,
    family_count: eligibleFamilyRows.length,
    mature_account_post_count: accountLifetimeLikes.length,
    account_lifetime_median_likes: accountLifetimeMedian,
    recent_classification_retired: true,
        continuous_recency_weighting: true,
    normalization_contract: "rolling_40_matured_account_median_at_observation",
    label_counts: labelCounts,
    transition_count: transitionStatements.length,
  };
}

export async function loadLockedSourceCardSelectionCandidates(
  db: D1Database,
  brandKey: string,
  nowIso = new Date().toISOString(),
): Promise<SourceSelectionCandidate[]> {
  await ensureSourceFamilySelectionTables(db);
  await refreshSourceFamilyLabels(db, brandKey, nowIso);
  return loadLockedSourceCardDecisionCandidates(db, brandKey, nowIso);
}

export async function loadLockedSourceCardDecisionCandidates(
  db: D1Database,
  brandKey: string,
  nowIso = new Date().toISOString(),
): Promise<SourceSelectionCandidate[]> {
  await ensureSourceFamilySelectionTables(db);
  const rows = await db.prepare(

                      `SELECT fam.id AS source_card_family_id, fam.source_identity_key,
              card.id AS source_card_id, card.source_mechanism, card.required_product,
              card.metrics_snapshot_json, card.primary_source_json, card.recommended_direction,
              COALESCE(sel.source_type, fam.source_type, 'source_card') AS source_origin_type,
              COALESCE(sel.internal_source_id, fam.internal_source_id, card.id) AS source_origin_internal_id,
              CASE
                WHEN COALESCE(sel.source_type, fam.source_type) = 'saved_pattern'
                THEN COALESCE(sel.internal_source_id, fam.internal_source_id)
                ELSE NULL
              END AS saved_pattern_id
       FROM operator_source_card_families fam
       JOIN operator_source_cards card
         ON card.id = fam.current_source_card_id
        AND card.brand_key = fam.brand_key
        AND card.is_current = 1
       LEFT JOIN operator_source_selections sel
         ON sel.id = card.source_selection_id
        AND sel.brand_key = card.brand_key
       WHERE fam.brand_key = ?
         AND fam.status = 'active'
         AND card.status = 'locked'`,


    ).bind(brandKey).all<Record<string, unknown>>();
    const liveSavedPatternIds = await loadLiveSavedPatternIds(db);
  const [strategyRow, sourceExclusionRows] = await Promise.all([
    db.prepare(
      `SELECT directives_json FROM operator_manifest_cycle_strategies
       WHERE brand_key = ? ORDER BY datetime(created_at) DESC LIMIT 1`,
    ).bind(brandKey).first<{ directives_json: string | null }>(),
        db.prepare(
      `SELECT source_identity_key, internal_source_id FROM operator_source_exclusions
       WHERE brand_key = ? AND active = 1`,
    ).bind(brandKey).all<{ source_identity_key: string | null; internal_source_id: string | null }>(), 
  ]);
  let directives: unknown = {};
  try { directives = JSON.parse(String(strategyRow?.directives_json ?? "{}")); } catch { directives = {}; }
  const excludedPatternIds = extractOwnerBannedSavedPatternIds(directives);
  const excludedIdentityKeys = new Set<string>();
    for (const exclusion of sourceExclusionRows.results ?? []) {
    if (exclusion.internal_source_id && /^\d+$/.test(String(exclusion.internal_source_id))) {
      excludedPatternIds.add(String(exclusion.internal_source_id));
    }
    if (exclusion.source_identity_key) excludedIdentityKeys.add(String(exclusion.source_identity_key));
  }
    const eligibleRows = (rows.results ?? []).filter((row) =>
    isSourceCardOriginEligibleForSelection(
      row.source_origin_type,
      row.saved_pattern_id,
      liveSavedPatternIds,
    )
    && (String(row.source_origin_type ?? "") !== "saved_pattern"
      || !excludedPatternIds.has(String(row.saved_pattern_id ?? "")))
    && !excludedIdentityKeys.has(String(row.source_identity_key ?? ""))
  );

  const candidates = eligibleRows.map((row) => {
    let metrics: Record<string, unknown> = {};
    let primarySource: Record<string, unknown> = {};
    try { metrics = JSON.parse(String(row.metrics_snapshot_json ?? "{}")) as Record<string, unknown>; } catch { metrics = {}; }
    try { primarySource = JSON.parse(String(row.primary_source_json ?? "{}")) as Record<string, unknown>; } catch { primarySource = {}; }
    return {
      source_candidate_id: `source_card:${String(row.source_card_id ?? "")}`,
      source_identity_key: String(row.source_identity_key ?? ""),
      source_card_family_id: String(row.source_card_family_id ?? ""),
      source_card_id: String(row.source_card_id ?? ""),
            source_type: "source_card",
      internal_source_id: String(row.source_card_id ?? ""),
            saved_pattern_id: row.saved_pattern_id === null || row.saved_pattern_id === undefined
        ? null
        : String(row.saved_pattern_id),
      source_origin_type: String(row.source_origin_type ?? "source_card"),
      source_origin_internal_id: String(row.source_origin_internal_id ?? row.source_card_id ?? ""),
      source_origin_selectable: true,
      source_mechanism: row.source_mechanism ?? null,

      required_product: row.required_product ?? null,
      recommended_direction: row.recommended_direction ?? null,
      text: primarySource.post_text ?? primarySource.text ?? null,
      metrics,
      primary_source: primarySource,
    };
  }).filter((candidate) => candidate.source_identity_key && candidate.source_card_id && candidate.source_card_family_id);
  return enrichSourceCandidatesForSelection(db, brandKey, candidates, nowIso);
}

export async function enrichSourceCandidatesForSelection(
  db: D1Database,
  brandKey: string,
  candidates: SourceSelectionCandidate[],
  nowIso = new Date().toISOString(),
): Promise<SourceSelectionCandidate[]> {

  await ensureSourceFamilySelectionTables(db);
  const stateRows = await db.prepare(
    `SELECT fam.id AS source_card_family_id, fam.source_identity_key, fam.current_source_card_id,
            card.source_mechanism, card.required_product,
            state.lifetime_label, state.recent_label, state.confidence_label,
                        state.lifetime_sample_size, state.recent_sample_size,
            state.lifetime_index, state.recent_index, state.state_json

     FROM operator_source_card_families fam
     LEFT JOIN operator_source_cards card
       ON card.id = fam.current_source_card_id AND card.brand_key = fam.brand_key
     LEFT JOIN operator_source_family_evidence_states state
       ON state.brand_key = fam.brand_key AND state.source_card_family_id = fam.id
     WHERE fam.brand_key = ? AND fam.status = 'active'`,
  ).bind(brandKey).all<Record<string, unknown>>();
    const audienceExposureRows = await db.prepare(
    `SELECT DISTINCT fam.source_identity_key, fam.id AS source_card_family_id,
            sp.status, sp.scheduled_time, sp.published_at,
            COALESCE(sp.published_post_id, draft.published_post_id) AS published_post_id,
            archive.post_timestamp
     FROM gpt_generation_drafts draft
     JOIN operator_source_cards card
       ON card.id = draft.source_card_id
     JOIN operator_source_card_families fam
       ON fam.id = card.family_id AND fam.brand_key = card.brand_key
     JOIN scheduled_posts sp
       ON sp.id = draft.scheduled_post_id
     LEFT JOIN threads_posts_archive archive
       ON archive.post_id = COALESCE(sp.published_post_id, draft.published_post_id)
     WHERE fam.brand_key = ?
       AND draft.scheduled_post_id IS NOT NULL
       AND sp.cancelled_at IS NULL
              AND (
         sp.status = 'posted'
         OR
         (sp.status IN ('approved', 'posting') AND datetime(sp.scheduled_time) >= datetime(?))
       )`,
  ).bind(brandKey, nowIso).all<Record<string, unknown>>();
    const stateByIdentity = new Map((stateRows.results ?? []).map((row) => [String(row.source_identity_key), row]));
  const rankedIdentities = (stateRows.results ?? [])
    .map((row) => {
      const persisted = parseJsonRecord(row.state_json);
      const label = normalizeSourceFamilyLifetimeLabel(row.lifetime_label);
      return {
        identity: String(row.source_identity_key ?? ""),
        label,
        ranking_score: finiteNumber(persisted.ranking_score, finiteNumber(row.lifetime_index, 1)),
      };
    })
    .filter((row) => row.identity && row.label !== "untested" && row.label !== "underperforming")
    .sort((left, right) => right.ranking_score - left.ranking_score || left.identity.localeCompare(right.identity));
  const globalRankByIdentity = new Map(rankedIdentities.map((row, index) => [row.identity, index + 1]));
  const nowMs = parseTimeMs(nowIso) ?? Date.now();
  type AudienceExposure = { published: string[]; scheduled: string[] };
  const exposureByIdentity = new Map<string, AudienceExposure>();
  for (const row of audienceExposureRows.results ?? []) {
    const identity = String(row.source_identity_key ?? "");
    if (!identity) continue;
    const exposure = exposureByIdentity.get(identity) ?? { published: [], scheduled: [] };
    const status = String(row.status ?? "");
    if (status === "posted") {
      const observedAt = String(row.published_at ?? row.post_timestamp ?? row.scheduled_time ?? "");
      if (parseTimeMs(observedAt) !== null) exposure.published.push(observedAt);
    } else {
      const scheduledAt = String(row.scheduled_time ?? "");
      const scheduledMs = parseTimeMs(scheduledAt);
      if (scheduledMs !== null && scheduledMs >= nowMs) exposure.scheduled.push(scheduledAt);
    }
    exposureByIdentity.set(identity, exposure);
  }
  const enriched = candidates.map((candidate) => {
    const identity = String(candidate.source_identity_key ?? "");
    const state = stateByIdentity.get(identity);
    const exposure = exposureByIdentity.get(identity) ?? { published: [], scheduled: [] };
    const publishedTimes = exposure.published
      .filter((value) => parseTimeMs(value) !== null)
      .sort((left, right) => Number(parseTimeMs(left)) - Number(parseTimeMs(right)));
    const scheduledTimes = exposure.scheduled
      .filter((value) => parseTimeMs(value) !== null)
      .sort((left, right) => Number(parseTimeMs(left)) - Number(parseTimeMs(right)));
    const countPublishedSince = (hours: number): number => publishedTimes.filter((value) =>
      Number(parseTimeMs(value)) >= nowMs - hours * 3600000
    ).length;
    const latestPublishedAt = publishedTimes[publishedTimes.length - 1] ?? null;
    const lastUsedMs = parseTimeMs(latestPublishedAt);
        const sourceMechanism = state?.source_mechanism ?? candidate.source_mechanism;
    const requiredProduct = state?.required_product ?? candidate.required_product;
    const persistedState = parseJsonRecord(state?.state_json);
    const persistedLifetime = parseJsonRecord(persistedState.lifetime);
    return {

      ...candidate,
      source_card_family_id: state?.source_card_family_id ? String(state.source_card_family_id) : null,
      source_card_id: state?.current_source_card_id ? String(state.current_source_card_id) : null,
                  lifetime_label: normalizeSourceFamilyLifetimeLabel(state?.lifetime_label),
      audition_state: String(persistedLifetime.audition_state ?? "untested") as SourceFamilyAuditionState,
      audition_passes: finiteNumber(persistedLifetime.audition_passes),
      audition_failures: finiteNumber(persistedLifetime.audition_failures),
      audition_opportunities_remaining: finiteNumber(persistedLifetime.audition_opportunities_remaining),
      graduated: persistedLifetime.graduated === true,
      recent_label: "no_recent_data" as SourceFamilyRecentLabel,
      confidence_label: (state?.confidence_label ?? "low") as SourceFamilyConfidenceLabel,
      lifetime_sample_size: finiteNumber(state?.lifetime_sample_size),
      unified_rating: finiteNumber(persistedState.unified_rating, finiteNumber(state?.lifetime_index, 1)),
      ranking_score: finiteNumber(persistedState.ranking_score, finiteNumber(state?.lifetime_index, 1)),
      global_rank: globalRankByIdentity.get(identity) ?? null,
      selection_lane: String(persistedState.selection_lane ?? selectionLaneForLifecycle(normalizeSourceFamilyLifetimeLabel(state?.lifetime_label))) as UnifiedSelectionLane,
      recent_sample_size: 0,
      lifetime_index: finiteNumber(persistedState.unified_rating, finiteNumber(state?.lifetime_index, 1)),
      recent_index: null,
            uses_24h: countPublishedSince(24),
      uses_7d: countPublishedSince(24 * 7),
      uses_28d: countPublishedSince(24 * 28),
      lifetime_published_uses: publishedTimes.length,
      historical_opportunity_count: publishedTimes.length + scheduledTimes.length,
      published_uses_72h: countPublishedSince(72),
      future_scheduled_uses: scheduledTimes.length,
      latest_published_at: latestPublishedAt,
      next_scheduled_at: scheduledTimes[0] ?? null,
      published_exposure_times: publishedTimes,
      future_scheduled_exposure_times: scheduledTimes,
      hours_since_last_use: lastUsedMs === null ? null : Math.max(0, (nowMs - lastUsedMs) / 3600000),
      semantic_key: `${semanticToken(sourceMechanism)}:${semanticToken(requiredProduct)}`,
      source_mechanism: sourceMechanism ?? null,
      required_product: requiredProduct ?? null,
    } as SourceSelectionCandidate;
  });
  const semanticExposureTimes = new Map<string, { published: string[]; scheduled: string[] }>();
  for (const candidate of enriched) {
    const semanticKey = String(candidate.semantic_key ?? "unknown");
    const exposure = semanticExposureTimes.get(semanticKey) ?? { published: [], scheduled: [] };
    exposure.published.push(...(candidate.published_exposure_times ?? []));
    exposure.scheduled.push(...(candidate.future_scheduled_exposure_times ?? []));
    semanticExposureTimes.set(semanticKey, exposure);
  }
  return enriched.map((candidate) => {
    const semanticKey = String(candidate.semantic_key ?? "unknown");
    const exposure = semanticExposureTimes.get(semanticKey) ?? { published: [], scheduled: [] };
    const semanticPublished24h = exposure.published.filter((value) =>
      Number(parseTimeMs(value)) >= nowMs - 24 * 3600000
    ).length;
    return {
      ...candidate,
      semantic_exposure_times: [...exposure.published, ...exposure.scheduled],
      semantic_published_uses_24h: semanticPublished24h,
      semantic_future_scheduled_uses: exposure.scheduled.length,
    };
  });
}

export function selectSourceFamilyLineup(input: {
  candidates: SourceSelectionCandidate[];
  slot_keys: string[];
  seed: string;
  preselection_policy?: SourcePreselectionPolicy;
  include_parity_trace?: boolean;
  allocation_state?: SourceLabelAllocationState | Record<string, unknown>;

}): {

  selected: SourceSelectionCandidate[];
  receipts: SourceSelectionReceipt[];
  summary: Record<string, unknown>;
  parity_trace?: Record<string, unknown>;
} {
    const normalizedCandidates = input.candidates.map((candidate) => ({
    ...candidate,
    lifetime_label: normalizeSourceFamilyLifetimeLabel(candidate.lifetime_label),
  }));
  const exclusionReason = (candidate: SourceSelectionCandidate): string | null => {
    if (!candidate.source_identity_key) return "source_identity_missing";
    if (!candidate.source_card_id) return "source_card_missing";
        if (!candidate.source_card_family_id) return "source_family_missing";
    const preselectionExclusion = sourcePreselectionExclusionForCandidate(input.preselection_policy, candidate);
    if (preselectionExclusion) return preselectionExclusion.reason;
        if (candidate.lifetime_label === "underperforming") return "lifetime_underperforming";
    const allocationTier = allocationTierForCandidate(candidate, input.preselection_policy);
    if (
      allocationTier !== "winner"
      && (finiteNumber(candidate.future_scheduled_uses) > 0 || finiteNumber(candidate.uses_24h) > 0)
    ) return "unresolved_source_pending_24h_evidence";
    return null;
  };
    const exclusions = normalizedCandidates

    .map((candidate) => ({ candidate, reason: exclusionReason(candidate) }))
    .filter((entry) => entry.reason !== null)
    .map((entry) => ({
      source_identity_key: entry.candidate.source_identity_key ?? null,
      source_card_id: entry.candidate.source_card_id ?? null,
            source_card_family_id: entry.candidate.source_card_family_id ?? null,
      reason: entry.reason,
      preselection_signal: sourcePreselectionExclusionForCandidate(input.preselection_policy, entry.candidate)?.signal ?? null,

    }));
    const active = normalizedCandidates.filter((candidate) => exclusionReason(candidate) === null);

    if (!active.length && input.slot_keys.length > 0) {
    throw new Error(`insufficient_active_source_capacity:0:${input.slot_keys.length}`);
  }
  const eligibleFamilyCount = new Set(active.map((candidate) => String(candidate.source_card_family_id))).size;
  const cooldownHours = 0;
  const semanticSpacingHours = 0;
    const requireUniqueSource = false;
  const allocationStateBeforeCycle = normalizeSourceLabelAllocationState(input.allocation_state);
  let allocationState = cloneSourceLabelAllocationState(allocationStateBeforeCycle);
  const reservations = [...(input.preselection_policy?.experiment_reservations ?? [])];

  const reservationCandidate = new Map(reservations.map((reservation) => [
    reservation.reservation_key,
    active.find((candidate) => sourcePreselectionTargetMatchesCandidate(reservation, candidate)) ?? null,
  ]));
  for (const reservation of reservations) {
    if (!reservationCandidate.get(reservation.reservation_key)) {
      throw new Error(`preselection_experiment_reservation_ineligible:${reservation.reservation_key}`);
    }
  }
  
  const fulfilledReservations = new Set<string>();
  const selectedTierCounts: Record<SourceAllocationTier, number> = { winner: 0, development: 0, exploration: 0 };

  const selected: SourceSelectionCandidate[] = [];
  const receipts: SourceSelectionReceipt[] = [];
    const usedSources = new Set<string>();
  const plannedCounts = new Map<string, number>();
  const relaxationCounts: Record<string, number> = { strict: 0, half: 0, exhausted: 0 };
  const slotRankings: Record<string, unknown>[] = [];

    for (let slotIndex = 0; slotIndex < input.slot_keys.length; slotIndex += 1) {
    const slotKey = input.slot_keys[slotIndex];
    const explicitReservation = reservations.find((reservation) =>
      !fulfilledReservations.has(reservation.reservation_key)
      && reservation.slot_keys.includes(slotKey)
    );
    const genericReservation = explicitReservation ?? reservations.find((reservation) =>
      !fulfilledReservations.has(reservation.reservation_key)
      && reservation.slot_keys.length === 0
    );
    const activeReservation = genericReservation ?? null;
        const pendingReservedCandidateKeys = new Set<string>();
    for (const reservation of reservations) {
      if (fulfilledReservations.has(reservation.reservation_key)) continue;
      const reservedCandidate = reservationCandidate.get(reservation.reservation_key);
      if (reservedCandidate?.source_identity_key) {
        pendingReservedCandidateKeys.add(String(reservedCandidate.source_identity_key));
      }
    }

                const slotEligible = active.filter((candidate) => {
      const identity = String(candidate.source_identity_key);
      const candidateTier = allocationTierForCandidate(candidate, input.preselection_policy);
      if (candidateTier !== "winner" && usedSources.has(identity)) return false;

      if (activeReservation) {
        if (!sourcePreselectionTargetMatchesCandidate(activeReservation, candidate)) return false;
      } else if (pendingReservedCandidateKeys.has(identity)) {
        return false;
      }
      return true;
    });
    if (!slotEligible.length) throw new Error(`hardened_source_selection_exhausted:${slotIndex}`);
        const availableTiers = new Set(slotEligible.map((candidate) => allocationTierForCandidate(candidate, input.preselection_policy)));
    const allocationTier = activeReservation
      ? allocationTierForCandidate(slotEligible[0], input.preselection_policy)
      : chooseAllocationTier(
          allocationTargets,
          selectedTierCounts,
          availableTiers,
          slotIndex,
          input.slot_keys.length,
        );

    if (!allocationTier) throw new Error(`hardened_allocation_target_unavailable:${slotIndex}`);
        const available = slotEligible.filter((candidate) => allocationTierForCandidate(candidate, input.preselection_policy) === allocationTier);

    const scored: Array<{ candidate: SourceSelectionCandidate; receipt: SourceSelectionReceipt }> = [];
    for (const candidate of available) {
      const identity = String(candidate.source_identity_key);
      const familyId = String(candidate.source_card_family_id);
      const sourceCardId = String(candidate.source_card_id);
            const n = Math.max(0, finiteNumber(candidate.lifetime_sample_size));
      const lifecycleLabel = normalizeSourceFamilyLifetimeLabel(candidate.lifetime_label);
      const selectionLane = selectionLaneForLifecycle(lifecycleLabel);
      const lifetimeIndex = Math.max(0, finiteNumber(candidate.lifetime_index, 1));
      const unifiedRating = Math.max(0, finiteNumber(candidate.unified_rating, lifetimeIndex));
      const rankingScore = Math.max(0, finiteNumber(candidate.ranking_score, unifiedRating));
      const globalRank = candidate.global_rank === null || candidate.global_rank === undefined
        ? null
        : Math.max(1, finiteNumber(candidate.global_rank, 1));
      const shrunkPerformance = rankingScore;
      const recentFactor = 1;
            const plannedUses = Math.max(0, plannedCounts.get(familyId) ?? 0);
      const winnerTarget = winnerAllocationByFamily.get(familyId) ?? null;
      const cycleCoverageBonus = allocationTier === "winner" && plannedUses === 0 ? 1000 : 0;
      const winnerShareDeficit = allocationTier === "winner" && winnerTarget
        ? winnerTarget.final_target_count
          * ((selectedTierCounts.winner + 1) / Math.max(1, allocationTargets.winner))
          - plannedUses
        : 0;
            const developmentPriority = allocationTier === "development"
        ? developmentResolutionPriority(lifecycleLabel) * 10
        : 0;
      const historicalOpportunityCount = Math.max(0, finiteNumber(candidate.historical_opportunity_count, n));
      const evidenceDebtBonus = allocationTier === "development"
        ? 10 / (n + 1)
        : allocationTier === "exploration"
          ? 10 / (historicalOpportunityCount + 1)
          : 0;
      const hoursSinceLastUse = candidate.hours_since_last_use === null || candidate.hours_since_last_use === undefined
        ? null
        : Math.max(0, finiteNumber(candidate.hours_since_last_use));
      const waitingPriority = allocationTier === "winner"
        ? 0
        : hoursSinceLastUse === null
          ? 2
          : Math.min(2, hoursSinceLastUse / (24 * 30));
      const explorationBonus = 0;
      const uses24h = Math.max(0, finiteNumber(candidate.uses_24h));
      const uses7d = Math.max(0, finiteNumber(candidate.uses_7d));
      const uses28d = Math.max(0, finiteNumber(candidate.uses_28d));
      const semanticKey = String(candidate.semantic_key ?? "source_identity_only");
      const semanticOverlapCount = 0;
      const publishedUses72h = Math.max(0, finiteNumber(candidate.published_uses_72h));
      const futureScheduledUses = Math.max(0, finiteNumber(candidate.future_scheduled_uses));
      const semanticPublishedUses24h = Math.max(0, finiteNumber(candidate.semantic_published_uses_24h));
      const semanticFutureScheduledUses = Math.max(0, finiteNumber(candidate.semantic_future_scheduled_uses));
      const exposureBurden = 1;
      const negativeEvidenceMultiplier = 1;
            const preselectionAdjustment = sourcePreselectionAdjustmentForCandidate(input.preselection_policy, candidate);
      const preselectionScoreMultiplier = 1;
      const preselectionScoreAddend = 0;
                        const baseScore = allocationTier === "winner"
        ? rankingScore + cycleCoverageBonus + winnerShareDeficit * 100
        : rankingScore + developmentPriority + evidenceDebtBonus + waitingPriority;
      const score = baseScore;

      const deterministicTiebreak = stableUnit(`${input.seed}|${slotKey}|${identity}`);
      scored.push({
        candidate,
        receipt: {
          policy_version: SOURCE_SELECTION_ENGINE_VERSION,
          slot_key: slotKey,
          source_identity_key: identity,
          source_card_id: sourceCardId,
          source_card_family_id: familyId,
                    lifetime_label: candidate.lifetime_label ?? "untested",
          audition_state: candidate.audition_state ?? "untested",
          audition_passes: Math.max(0, finiteNumber(candidate.audition_passes)),
          audition_failures: Math.max(0, finiteNumber(candidate.audition_failures)),
          audition_opportunities_remaining: Math.max(0, finiteNumber(candidate.audition_opportunities_remaining)),
          recent_label: candidate.recent_label ?? "no_recent_data",

                    lifetime_sample_size: n,
          lifetime_index: lifetimeIndex,
          unified_rating: unifiedRating,
          ranking_score: rankingScore,
          global_rank: globalRank,
          selection_lane: selectionLane,
          recent_factor: recentFactor,
          shrunk_performance: shrunkPerformance,
          exploration_bonus: explorationBonus,
                                        cycle_coverage_bonus: cycleCoverageBonus,
          winner_initial_coverage_count: winnerTarget?.initial_coverage_count ?? 0,
          winner_proportional_weight: winnerTarget?.proportional_weight ?? 0,
          winner_exact_additional_share: winnerTarget?.exact_additional_share ?? 0,
          winner_rounded_additional_placements: winnerTarget?.rounded_additional_placements ?? 0,
          winner_final_target_count: winnerTarget?.final_target_count ?? 0,
          winner_actual_selected_count: 0,
          winner_target_satisfied: allocationTier !== "winner",
                    winner_share_deficit: winnerShareDeficit,
          development_resolution_priority: developmentPriority,
          evidence_debt_bonus: evidenceDebtBonus,
          waiting_priority: waitingPriority,
          historical_opportunity_count: historicalOpportunityCount,
          uses_24h: uses24h,
          uses_7d: uses7d,
          uses_28d: uses28d,
          planned_uses: plannedUses,
          semantic_key: semanticKey,
          semantic_overlap_count: semanticOverlapCount,
          published_uses_72h: publishedUses72h,
          future_scheduled_uses: futureScheduledUses,
          semantic_published_uses_24h: semanticPublishedUses24h,
          semantic_future_scheduled_uses: semanticFutureScheduledUses,
          allocation_tier: allocationTier,
          exposure_burden: exposureBurden,
          negative_evidence_multiplier: negativeEvidenceMultiplier,
          cooldown_hours: cooldownHours,
          cooldown_relaxation: 1,
                    score,
          deterministic_tiebreak: deterministicTiebreak,
          preselection_policy_version: input.preselection_policy?.contract_version,
          preselection_policy_hash: input.preselection_policy?.policy_hash,
          preselection_score_multiplier: preselectionScoreMultiplier,
          preselection_score_addend: preselectionScoreAddend,
          preselection_signals: preselectionAdjustment?.signals ?? [],
          experiment_reservation_key: activeReservation?.reservation_key ?? null,

        },
      });
    }
    scored.sort((left, right) =>
      right.receipt.score - left.receipt.score
      || right.receipt.deterministic_tiebreak - left.receipt.deterministic_tiebreak
      || left.receipt.source_identity_key.localeCompare(right.receipt.source_identity_key)
    );
    if (input.include_parity_trace) {
      slotRankings.push({
        slot_key: slotKey,
        allocation_tier: allocationTier,
        ranked_source_identity_keys: scored.map((entry) => entry.receipt.source_identity_key),
        ranked_source_card_ids: scored.map((entry) => entry.receipt.source_card_id),
                        winner_reuse_allowed: true,
        recent_classification_retired: true,
        experiment_reservation_key: activeReservation?.reservation_key ?? null,
        preselection_policy_hash: input.preselection_policy?.policy_hash ?? null,
      });

    }
    const winner = scored[0];
    if (!winner) throw new Error(`hardened_source_selection_exhausted:${slotIndex}`);
    const receipt = {
      ...winner.receipt,
            score: Number(winner.receipt.score.toFixed(8)),
      unified_rating: Number(winner.receipt.unified_rating.toFixed(6)),
      ranking_score: Number(winner.receipt.ranking_score.toFixed(6)),
      shrunk_performance: Number(winner.receipt.shrunk_performance.toFixed(6)),
      exploration_bonus: Number(winner.receipt.exploration_bonus.toFixed(6)),
                        cycle_coverage_bonus: Number(winner.receipt.cycle_coverage_bonus.toFixed(6)),
      winner_proportional_weight: Number(winner.receipt.winner_proportional_weight.toFixed(8)),
      winner_exact_additional_share: Number(winner.receipt.winner_exact_additional_share.toFixed(8)),
      winner_share_deficit: Number(winner.receipt.winner_share_deficit.toFixed(8)),
      development_resolution_priority: Number(winner.receipt.development_resolution_priority.toFixed(6)),
      evidence_debt_bonus: Number(winner.receipt.evidence_debt_bonus.toFixed(6)),
      waiting_priority: Number(winner.receipt.waiting_priority.toFixed(6)),
      recent_factor: Number(winner.receipt.recent_factor.toFixed(6)),
      exposure_burden: Number(winner.receipt.exposure_burden.toFixed(6)),
      deterministic_tiebreak: Number(winner.receipt.deterministic_tiebreak.toFixed(8)),
    };
    selected.push({ ...winner.candidate, selection_receipt: receipt, assigned_slot_key: slotKey });
    receipts.push(receipt);
    usedSources.add(receipt.source_identity_key);
        plannedCounts.set(receipt.source_card_family_id, receipt.planned_uses + 1);
    selectedTierCounts[receipt.allocation_tier] += 1;
    if (receipt.experiment_reservation_key) fulfilledReservations.add(receipt.experiment_reservation_key);
    relaxationCounts.strict += 1;

  }
    if (fulfilledReservations.size !== reservations.length) {
    const unresolved = reservations.find((reservation) => !fulfilledReservations.has(reservation.reservation_key));
    throw new Error(`preselection_experiment_reservation_unfulfilled:${unresolved?.reservation_key ?? "unknown"}`);
  }
  for (const tier of ["winner", "development", "exploration"] as SourceAllocationTier[]) {
    if (selectedTierCounts[tier] !== allocationTargets[tier]) {

      throw new Error(`hardened_allocation_target_mismatch:${tier}:${selectedTierCounts[tier]}:${allocationTargets[tier]}`);
    }
  }
    const winnerActualCounts = receipts.reduce<Record<string, number>>((counts, receipt) => {
    if (receipt.allocation_tier === "winner") {
      counts[receipt.source_card_family_id] = Number(counts[receipt.source_card_family_id] ?? 0) + 1;
    }
    return counts;
  }, {});
  const winnerTargetMismatches = winnerAllocationPlan.filter((target) =>
    Number(winnerActualCounts[target.source_card_family_id] ?? 0) !== target.final_target_count
  );
  if (winnerTargetMismatches.length > 0) {
    const first = winnerTargetMismatches[0];
    throw new Error(`winner_allocation_target_mismatch:${first.source_card_family_id}:${winnerActualCounts[first.source_card_family_id] ?? 0}:${first.final_target_count}`);
  }
  for (const receipt of receipts) {
    if (receipt.allocation_tier !== "winner") continue;
    const actual = Number(winnerActualCounts[receipt.source_card_family_id] ?? 0);
    receipt.winner_actual_selected_count = actual;
    receipt.winner_target_satisfied = actual === receipt.winner_final_target_count;
  }
  const labelCounts = selected.reduce<Record<string, number>>((counts, candidate) => {
    const label = String(candidate.lifetime_label ?? "untested");
    counts[label] = Number(counts[label] ?? 0) + 1;
    return counts;
  }, {});
  return {
    selected,
    receipts,
    summary: {
      engine_version: SOURCE_SELECTION_ENGINE_VERSION,
      deterministic: true,
      model_override_allowed: false,
            lifecycle_authority: "unified_confidence_adjusted_rating",
      recent_classification_retired: true,
      continuous_recency_weighting: true,
      eligible_family_count: eligibleFamilyCount,
      hard_exclusion_count: exclusions.length,
      requested_slot_count: input.slot_keys.length,
      selected_count: selected.length,
      arbitrary_cooldown_blocker_active: false,
      semantic_spacing_blocker_active: false,
      winner_reuse_allowed: true,
      unresolved_source_unique_per_cycle: true,
      unresolved_pending_24h_evidence_blocked: true,
      allocation_targets: allocationTargets,
            selected_allocation_tiers: selectedTierCounts,
      winner_allocation_contract: "first_coverage_then_score_weighted_largest_remainder_v1",
      qualified_winner_count: winnerAllocationPlan.length,
      winner_target_distribution: winnerAllocationPlan.map((target) => ({
        source_identity_key: target.source_identity_key,
        source_card_family_id: target.source_card_family_id,
        ranking_score: Number(target.ranking_score.toFixed(8)),
        global_rank: target.global_rank,
        initial_coverage_count: target.initial_coverage_count,
        proportional_weight: Number(target.proportional_weight.toFixed(8)),
        exact_additional_share: Number(target.exact_additional_share.toFixed(8)),
        rounded_additional_placements: target.rounded_additional_placements,
        final_target_count: target.final_target_count,
        actual_selected_count: Number(winnerActualCounts[target.source_card_family_id] ?? 0),
        target_satisfied: Number(winnerActualCounts[target.source_card_family_id] ?? 0) === target.final_target_count,
      })),
      winner_actual_distribution: winnerActualCounts,
      winner_target_mismatch_count: winnerTargetMismatches.length,
      maximum_exact_family_concentration: allocationTargets.winner > 0
        ? Math.max(0, ...Object.values(winnerActualCounts)) / allocationTargets.winner
        : 0,
      selected_lifetime_labels: labelCounts,
      preselection_policy_version: input.preselection_policy?.contract_version ?? null,
      preselection_policy_hash: input.preselection_policy?.policy_hash ?? null,
      preselection_causal_signal_counts: input.preselection_policy?.causal_signal_counts ?? {},
      experiment_reservations_required: 0,
      experiment_reservations_fulfilled: 0,
      strategy_influence_enforced: false,

    },
    parity_trace: input.include_parity_trace
      ? {
          engine_version: SOURCE_SELECTION_ENGINE_VERSION,
          eligible_pool: active.map((candidate) => ({
            source_identity_key: candidate.source_identity_key ?? null,
            source_card_id: candidate.source_card_id ?? null,
            source_card_family_id: candidate.source_card_family_id ?? null,
            lifetime_label: candidate.lifetime_label ?? "untested",
            recent_label: candidate.recent_label ?? "no_recent_data",
                        audition_state: candidate.audition_state ?? "untested",
            allocation_tier: allocationTierForCandidate(candidate, input.preselection_policy),
            preselection_signals: sourcePreselectionAdjustmentForCandidate(input.preselection_policy, candidate)?.signals ?? [],

          })).sort((left, right) => String(left.source_identity_key).localeCompare(String(right.source_identity_key))),
          exclusions,
                    preselection_policy: input.preselection_policy ?? null,
          allocation_targets: allocationTargets,
          slot_rankings: slotRankings,

          selected_source_to_slot: receipts.map((receipt) => ({
            slot_key: receipt.slot_key,
            source_identity_key: receipt.source_identity_key,
            source_card_id: receipt.source_card_id,
            source_card_family_id: receipt.source_card_family_id,
                        allocation_tier: receipt.allocation_tier,
            winner_final_target_count: receipt.winner_final_target_count,
            winner_actual_selected_count: receipt.winner_actual_selected_count,
            winner_target_satisfied: receipt.winner_target_satisfied,
            semantic_key: receipt.semantic_key,
          })),
        }
      : undefined,
  };
}

export async function persistSourceSelectionReceipts(
  db: D1Database,
  input: {
    brand_key: string;
    scope_type: "batch" | "cycle";
    scope_id: string;
    receipts: SourceSelectionReceipt[];
  },
): Promise<void> {
  await ensureSourceFamilySelectionTables(db);
  const statements = input.receipts.map((receipt, index) => db.prepare(
    `INSERT INTO operator_source_selection_receipts (
      id, brand_key, scope_type, scope_id, slot_key, selection_order,
      source_identity_key, source_card_family_id, source_card_id, engine_version, receipt_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(brand_key, scope_type, scope_id, slot_key) DO UPDATE SET
      selection_order = excluded.selection_order,
      source_identity_key = excluded.source_identity_key,
      source_card_family_id = excluded.source_card_family_id,
      source_card_id = excluded.source_card_id,
      engine_version = excluded.engine_version,
      receipt_json = excluded.receipt_json`,
  ).bind(
    crypto.randomUUID(), input.brand_key, input.scope_type, input.scope_id, receipt.slot_key, index + 1,
    receipt.source_identity_key, receipt.source_card_family_id, receipt.source_card_id,
    SOURCE_SELECTION_ENGINE_VERSION, JSON.stringify(receipt),
  ));
  for (let index = 0; index < statements.length; index += 50) await db.batch(statements.slice(index, index + 50));
}

export async function persistLockedSourceSelectionPlan(
  db: D1Database,
  input: {
    brand_key: string;
    cycle_id: string;
    receipts: SourceSelectionReceipt[];
  },
): Promise<Record<string, unknown>[]> {
    await ensureSourceFamilySelectionTables(db);
  const anyExistingRows = await db.prepare(
    `SELECT engine_version FROM operator_source_selection_plans
     WHERE brand_key = ? AND cycle_id = ? AND status = 'locked'`,
  ).bind(input.brand_key, input.cycle_id).all<{ engine_version: string }>();
  const incompatiblePlanExists = (anyExistingRows.results ?? [])
    .some((row) => String(row.engine_version ?? "") !== SOURCE_SELECTION_ENGINE_VERSION);
  if (incompatiblePlanExists) {
    const committedStrategy = await db.prepare(
      `SELECT COUNT(*) AS total FROM operator_manifest_cycle_strategies
       WHERE brand_key = ? AND cycle_id = ?`,
    ).bind(input.brand_key, input.cycle_id).first<{ total: number }>();
    if (Number(committedStrategy?.total ?? 0) > 0) {
      throw new Error("locked_source_selection_plan_version_conflict_after_strategy_commit");
    }
    await db.prepare(
      `DELETE FROM operator_source_selection_plans WHERE brand_key = ? AND cycle_id = ?`,
    ).bind(input.brand_key, input.cycle_id).run();
  }
  const existing = await readLockedSourceSelectionPlan(db, input.brand_key, input.cycle_id);

    if (existing.length) {
    const existingSignature = existing.map((row) => `${row.slot_key}:${row.source_card_id}`).join("|");
    const requestedSignature = input.receipts.map((row) => `${row.slot_key}:${row.source_card_id}`).join("|");
    if (existingSignature === requestedSignature) return existing;
    const committedStrategy = await db.prepare(
      `SELECT COUNT(*) AS total FROM operator_manifest_cycle_strategies
       WHERE brand_key = ? AND cycle_id = ?`,
    ).bind(input.brand_key, input.cycle_id).first<{ total: number }>();
    if (Number(committedStrategy?.total ?? 0) > 0) {
      throw new Error("locked_source_selection_plan_conflict_after_strategy_commit");
    }
    await db.batch([
      db.prepare(
        `DELETE FROM operator_source_selection_plans WHERE brand_key = ? AND cycle_id = ?`,
      ).bind(input.brand_key, input.cycle_id),
      db.prepare(
        `DELETE FROM operator_source_selection_receipts
         WHERE brand_key = ? AND scope_type = 'cycle' AND scope_id = ?`,
      ).bind(input.brand_key, input.cycle_id),
    ]);
  }
  const statements = input.receipts.map((receipt, index) => db.prepare(
    `INSERT INTO operator_source_selection_plans (
      id, brand_key, cycle_id, slot_key, selection_order, source_identity_key,
      source_card_family_id, source_card_id, engine_version, receipt_json, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'locked')`,
  ).bind(
    crypto.randomUUID(), input.brand_key, input.cycle_id, receipt.slot_key, index + 1,
    receipt.source_identity_key, receipt.source_card_family_id, receipt.source_card_id,
    SOURCE_SELECTION_ENGINE_VERSION, JSON.stringify(receipt),
  ));
  for (let index = 0; index < statements.length; index += 50) await db.batch(statements.slice(index, index + 50));
  await persistSourceSelectionReceipts(db, {
    brand_key: input.brand_key,
    scope_type: "cycle",
    scope_id: input.cycle_id,
    receipts: input.receipts,
  });
  return readLockedSourceSelectionPlan(db, input.brand_key, input.cycle_id);
}

export async function readLockedSourceSelectionPlan(
  db: D1Database,
  brandKey: string,
  cycleId: string,
): Promise<Record<string, unknown>[]> {
  await ensureSourceFamilySelectionTables(db);
  const rows = await db.prepare(
    `SELECT slot_key, selection_order, source_identity_key, source_card_family_id,
            source_card_id, engine_version, receipt_json, status
     FROM operator_source_selection_plans
          WHERE brand_key = ? AND cycle_id = ? AND status = 'locked' AND engine_version = ?
     ORDER BY selection_order ASC`,
  ).bind(brandKey, cycleId, SOURCE_SELECTION_ENGINE_VERSION).all<Record<string, unknown>>();

  return (rows.results ?? []).map((row) => ({
    slot_key: row.slot_key,
    selection_order: finiteNumber(row.selection_order),
    source_identity_key: row.source_identity_key,
    source_card_family_id: row.source_card_family_id,
    source_card_id: row.source_card_id,
    engine_version: row.engine_version,
    receipt: (() => {
      try { return JSON.parse(String(row.receipt_json ?? "{}")); } catch { return {}; }
    })(),
    status: row.status,
  }));
}

export async function validateLineupAgainstLockedSourceSelectionPlan(
  db: D1Database,
  input: {
    brand_key: string;
    cycle_id: string;
    lineup: Record<string, unknown>[];
  },
): Promise<Record<string, unknown>[]> {
    const plan = await readLockedSourceSelectionPlan(db, input.brand_key, input.cycle_id);
  if (!plan.length) throw new Error("locked_source_selection_plan_missing");
  if (plan.length !== input.lineup.length) throw new Error("locked_source_selection_plan_lineup_count_mismatch");
        const seenSourceLanes = new Map<string, UnifiedSelectionLane>();
  const lockedWinnerTargets = new Map<string, number>();
  const lockedWinnerActuals = new Map<string, number>();
  for (const row of plan) {
    const receipt = row.receipt && typeof row.receipt === "object" && !Array.isArray(row.receipt)
      ? row.receipt as Record<string, unknown>
      : {};
    const slotKey = String(row.slot_key ?? "");
    const sourceIdentityKey = String(row.source_identity_key ?? "");
    const lifetimeLabel = normalizeSourceFamilyLifetimeLabel(receipt.lifetime_label);
    const selectionLane = String(receipt.selection_lane ?? selectionLaneForLifecycle(lifetimeLabel)) as UnifiedSelectionLane;
    if (String(receipt.policy_version ?? "") !== SOURCE_SELECTION_ENGINE_VERSION) {
      throw new Error(`locked_source_selection_plan_policy_mismatch:${slotKey}`);
    }
    if (lifetimeLabel === "underperforming") {
      throw new Error(`locked_source_selection_plan_weak_family:${slotKey}`);
    }
    if (!sourceIdentityKey || !["exploit", "develop", "explore"].includes(selectionLane)) {
      throw new Error(`locked_source_selection_plan_strategy_evidence_missing:${slotKey}`);
    }
    if (finiteNumber(receipt.unified_rating) <= 0 || finiteNumber(receipt.ranking_score) <= 0) {
      throw new Error(`locked_source_selection_plan_ranking_evidence_missing:${slotKey}`);
    }
    if (
      selectionLane !== "exploit"
      && (finiteNumber(receipt.future_scheduled_uses) > 0 || finiteNumber(receipt.uses_24h) > 0)
    ) {
      throw new Error(`locked_source_selection_plan_unresolved_evidence_pending:${slotKey}`);
    }
    const priorLane = seenSourceLanes.get(sourceIdentityKey);
    if (priorLane && (priorLane !== "exploit" || selectionLane !== "exploit")) {
      throw new Error(`locked_source_selection_plan_duplicate_unresolved_source:${slotKey}`);
    }
        seenSourceLanes.set(sourceIdentityKey, selectionLane);
    if (selectionLane === "exploit") {
      const familyId = String(row.source_card_family_id ?? receipt.source_card_family_id ?? "");
      const target = Math.max(0, Math.floor(finiteNumber(receipt.winner_final_target_count)));
      if (!familyId || target < 1) {
        throw new Error(`locked_source_selection_plan_winner_target_missing:${slotKey}`);
      }
      const existingTarget = lockedWinnerTargets.get(familyId);
      if (existingTarget !== undefined && existingTarget !== target) {
        throw new Error(`locked_source_selection_plan_winner_target_conflict:${familyId}`);
      }
      lockedWinnerTargets.set(familyId, target);
      lockedWinnerActuals.set(familyId, Number(lockedWinnerActuals.get(familyId) ?? 0) + 1);
      if (finiteNumber(receipt.winner_actual_selected_count) !== target || receipt.winner_target_satisfied !== true) {
        throw new Error(`locked_source_selection_plan_winner_receipt_unreconciled:${slotKey}`);
      }
    }
  }
  for (const [familyId, target] of lockedWinnerTargets) {
    const actual = Number(lockedWinnerActuals.get(familyId) ?? 0);
    if (actual !== target) {
      throw new Error(`locked_source_selection_plan_winner_target_mismatch:${familyId}:${actual}:${target}`);
    }
  }
  const expected = new Map(plan.map((row) => [String(row.slot_key), String(row.source_card_id)]));
  for (const item of input.lineup) {
    const slotKey = String(item.slot_key ?? "");
    const sourceCardId = String(item.source_card_id ?? "");
    if (!expected.has(slotKey)) throw new Error(`locked_source_selection_plan_unknown_slot:${slotKey}`);
    if (expected.get(slotKey) !== sourceCardId) throw new Error(`locked_source_selection_plan_source_mismatch:${slotKey}`);
  }
  return plan;
}

export function runSourceFamilySelectionEdgeCases(): Record<string, unknown> {
  const oneBreakout = classifySourceFamilyLifetime({ indexes: [4] });
  const repeatedWinners = classifySourceFamilyLifetime({ indexes: [1.8, 1.7, 1.9, 1.6, 2, 1.75] });
  const viralPlusFailures = classifySourceFamilyLifetime({ indexes: [5, 0.4, 0.5, 0.6, 0.55, 0.45] });
  const repeatedLosers = classifySourceFamilyLifetime({ indexes: [0.4, 0.5, 0.55, 0.45, 0.6, 0.5] });
  const recentRetired = classifySourceFamilyRecent({ recent_indexes: [2, 0.4], previous_label: "hot" });
  const laneTargets16 = buildDynamicLaneTargets({
    requested_slots: 16,
    exploit_source_count: 5,
    develop_source_count: 10,
    explore_source_count: 10,
  });
  const laneTargets33 = buildDynamicLaneTargets({
    requested_slots: 33,
    exploit_source_count: 5,
    develop_source_count: 20,
    explore_source_count: 20,
  });
  const newAccountCandidates: SourceSelectionCandidate[] = Array.from({ length: 24 }, (_, index) => ({
    source_identity_key: `new-${index}`,
    source_card_id: `card-${index}`,
    source_card_family_id: `family-${index}`,
    lifetime_label: "untested",
    recent_label: "no_recent_data",
    lifetime_sample_size: 0,
    unified_rating: 1,
    ranking_score: 1,
    lifetime_index: 1,
    uses_24h: 0,
    uses_7d: 0,
    uses_28d: 0,
  }));
  const newAccountSlots = Array.from({ length: 24 }, (_, index) => `2026-01-01T${String(index).padStart(2, "0")}:00`);
  const newAccountSelection = selectSourceFamilyLineup({
    candidates: newAccountCandidates,
    slot_keys: newAccountSlots,
    seed: "new-account",
  });
  const mixedCandidates: SourceSelectionCandidate[] = [
    ...Array.from({ length: 3 }, (_, index) => ({
      source_identity_key: `winner-${index}`,
      source_card_id: `winner-card-${index}`,
      source_card_family_id: `winner-family-${index}`,
      lifetime_label: "franchise" as const,
      recent_label: "no_recent_data" as const,
      lifetime_sample_size: 8 + index,
      unified_rating: 1.8 - index * 0.1,
      ranking_score: 1.7 - index * 0.1,
      lifetime_index: 1.8 - index * 0.1,
      global_rank: index + 1,
      uses_24h: 4,
      uses_7d: 10,
      uses_28d: 20,
      published_uses_72h: 1,
    })),
    ...Array.from({ length: 10 }, (_, index) => ({
      source_identity_key: `untested-${index}`,
      source_card_id: `untested-card-${index}`,
      source_card_family_id: `untested-family-${index}`,
      lifetime_label: "untested" as const,
      recent_label: "no_recent_data" as const,
      lifetime_sample_size: 0,
      unified_rating: 1,
      ranking_score: 1,
      lifetime_index: 1,
      uses_24h: 0,
      uses_7d: 0,
      uses_28d: 0,
    })),
  ];
  const mixedSelection = selectSourceFamilyLineup({
    candidates: mixedCandidates,
    slot_keys: Array.from({ length: 10 }, (_, index) => `2026-01-02T${String(index).padStart(2, "0")}:00`),
    seed: "mixed-winner-explore",
  });
  const pendingSelection = selectSourceFamilyLineup({
    candidates: [
      {
        source_identity_key: "pending-untested",
        source_card_id: "pending-card",
        source_card_family_id: "pending-family",
        lifetime_label: "untested",
        unified_rating: 1,
        ranking_score: 1,
        lifetime_index: 1,
        uses_24h: 1,
      },
      {
        source_identity_key: "fresh-untested",
        source_card_id: "fresh-card",
        source_card_family_id: "fresh-family",
        lifetime_label: "untested",
        unified_rating: 1,
        ranking_score: 1,
        lifetime_index: 1,
        uses_24h: 0,
      },
    ],
    slot_keys: ["2026-01-03T00:00"],
    seed: "pending-evidence",
  });
    const selectedWinnerCounts = mixedSelection.selected.reduce<Record<string, number>>((counts, candidate) => {
    const identity = String(candidate.source_identity_key ?? "");
    if (identity.startsWith("winner-")) counts[identity] = Number(counts[identity] ?? 0) + 1;
    return counts;
  }, {});
  const developmentFairnessSelection = selectSourceFamilyLineup({
    candidates: [
      {
        source_identity_key: "develop-needs-evidence",
        source_card_id: "develop-needs-evidence-card",
        source_card_family_id: "develop-needs-evidence-family",
        lifetime_label: "prospect",
        lifetime_sample_size: 1,
        unified_rating: 1.05,
        ranking_score: 1,
        lifetime_index: 1.05,
        historical_opportunity_count: 1,
        hours_since_last_use: 720,
        uses_24h: 0,
      },
      {
        source_identity_key: "develop-many-opportunities",
        source_card_id: "develop-many-opportunities-card",
        source_card_family_id: "develop-many-opportunities-family",
        lifetime_label: "prospect",
        lifetime_sample_size: 5,
        unified_rating: 1.45,
        ranking_score: 1.4,
        lifetime_index: 1.45,
        historical_opportunity_count: 5,
        hours_since_last_use: 24,
        uses_24h: 0,
      },
    ],
    slot_keys: ["2026-01-04T00:00"],
    seed: "development-fairness",
  });
    const sameMechanismIndependentSelection = selectSourceFamilyLineup({
    candidates: [
      {
        source_identity_key: "finger-source-a",
        source_card_id: "finger-card-a",
        source_card_family_id: "finger-family-a",
        lifetime_label: "untested",
        unified_rating: 1,
        ranking_score: 1,
        lifetime_index: 1,
        semantic_key: "finger_touch",
        uses_24h: 0,
      },
      {
        source_identity_key: "finger-source-b",
        source_card_id: "finger-card-b",
        source_card_family_id: "finger-family-b",
        lifetime_label: "untested",
        unified_rating: 1,
        ranking_score: 1,
        lifetime_index: 1,
        semantic_key: "finger_touch",
        uses_24h: 0,
      },
    ],
    slot_keys: ["2026-01-05T00:00", "2026-01-05T01:00"],
    seed: "same-mechanism-independent-sources",
  });
  const advisoryOnlyPolicy = compileSourcePreselectionPolicy({
    candidates: [
      { source_identity_key: "policy-a", source_card_id: "policy-card-a" },
      { source_identity_key: "policy-b", source_card_id: "policy-card-b" },
    ],
    slot_keys: ["2026-01-05T02:00"],
    strategy_directives: {
      winner_priority_source_identity_key: "policy-a",
      source_weights: { "policy-a": 99 },
    },
    active_experiments: [{
      id: "experiment-a",
      status: "active",
      required_slots: 1,
      source_identity_key: "policy-a",
    }],
    hard_bans: [{ id: "ban-b", source_identity_key: "policy-b", active: true }],
  });
  const explorationFairnessSelection = selectSourceFamilyLineup({
    candidates: [
      {
        source_identity_key: "explore-never-used",
        source_card_id: "explore-never-used-card",
        source_card_family_id: "explore-never-used-family",
        lifetime_label: "untested",
        unified_rating: 1,
        ranking_score: 1,
        lifetime_index: 1,
        historical_opportunity_count: 0,
        hours_since_last_use: null,
        uses_24h: 0,
      },
      {
        source_identity_key: "explore-used-three-times",
        source_card_id: "explore-used-three-times-card",
        source_card_family_id: "explore-used-three-times-family",
        lifetime_label: "untested",
        unified_rating: 1,
        ranking_score: 1,
        lifetime_index: 1,
        historical_opportunity_count: 3,
        hours_since_last_use: 720,
        uses_24h: 0,
      },
    ],
    slot_keys: ["2026-01-05T00:00"],
    seed: "exploration-fairness",
  });
  const assertions = {
        one_breakout_enters_development: oneBreakout.label === "prospect" && oneBreakout.selection_lane === "develop",
    repeated_winners_franchise: repeatedWinners.label === "franchise" && repeatedWinners.selection_lane === "exploit",
    unequal_sample_rank_is_conservative: oneBreakout.ranking_score < repeatedWinners.ranking_score,
    viral_plus_failures_not_winner: viralPlusFailures.label === "underperforming",
    repeated_losers_underperforming: repeatedLosers.label === "underperforming",
    recent_classification_retired: recentRetired.label === "no_recent_data",
    dynamic_16_slots: JSON.stringify(laneTargets16) === JSON.stringify({ exploit: 6, develop: 5, explore: 5 }),
    dynamic_33_slots: JSON.stringify(laneTargets33) === JSON.stringify({ exploit: 11, develop: 11, explore: 11 }),
    new_account_explores_all: new Set(newAccountSelection.selected.map((item) => item.source_identity_key)).size === 24,
    winner_reuse_allowed: mixedSelection.selected.filter((item) => String(item.source_identity_key).startsWith("winner-")).length === 5,
    qualified_winners_covered_before_repeat: Object.keys(selectedWinnerCounts).length === 3,
        pending_unresolved_source_waits: pendingSelection.selected[0]?.source_identity_key === "fresh-untested",
    development_evidence_debt_prevents_starvation:
      developmentFairnessSelection.selected[0]?.source_identity_key === "develop-needs-evidence",
        exploration_fewest_opportunities_first:
      explorationFairnessSelection.selected[0]?.source_identity_key === "explore-never-used",
    similar_sources_remain_independent:
      new Set(sameMechanismIndependentSelection.selected.map((candidate) => candidate.source_identity_key)).size === 2,
    strategy_cannot_override_unified_math:
      advisoryOnlyPolicy.candidate_adjustments.length === 0 && advisoryOnlyPolicy.experiment_reservations.length === 0,
    explicit_hard_bans_remain_enforced: advisoryOnlyPolicy.hard_exclusions.length === 1,
    deterministic_replay: JSON.stringify(newAccountSelection.receipts) === JSON.stringify(selectSourceFamilyLineup({
      candidates: newAccountCandidates,
      slot_keys: newAccountSlots,
      seed: "new-account",
    }).receipts),
  };
  return {
    passed: Object.values(assertions).every(Boolean),
    assertions,
    examples: {
      oneBreakout,
      repeatedWinners,
      viralPlusFailures,
      repeatedLosers,
      recentRetired,
      laneTargets16,
            laneTargets33,
      selectedWinnerCounts,
            developmentFairnessSelection: developmentFairnessSelection.receipts,
      explorationFairnessSelection: explorationFairnessSelection.receipts,
      sameMechanismIndependentSelection: sameMechanismIndependentSelection.receipts,
      advisoryOnlyPolicy,
    },
  };
}
