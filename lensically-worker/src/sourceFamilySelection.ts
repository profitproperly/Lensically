import { assertDatabaseIntegrity } from "./databaseIntegrity";
import type { SourcePreselectionPolicy, SourcePreselectionSignal } from "./sourcePreselectionPolicy";
import {
  sourcePreselectionAdjustmentForCandidate,
  sourcePreselectionExclusionForCandidate,
  sourcePreselectionTargetMatchesCandidate,
} from "./sourcePreselectionPolicy";

export const SOURCE_FAMILY_LABEL_POLICY_VERSION = "source-family-label-policy-v6";
export const SOURCE_SELECTION_ENGINE_VERSION = "source-selection-engine-v6";

export type SourceFamilyLifetimeLabel =
  | "untested"
  | "prospect"
  | "emerging"
  | "proven"
  | "franchise"
  | "underperforming";

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
  if (["untested", "prospect", "emerging", "proven", "franchise", "underperforming"].includes(normalized)) {
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
  recent_factor: number;
  shrunk_performance: number;
  exploration_bonus: number;
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
}): {
  label: SourceFamilyLifetimeLabel;
  audition_state: SourceFamilyAuditionState;
  audition_passes: number;
  audition_failures: number;
  audition_opportunities_remaining: number;
  graduated: boolean;
  median_index: number | null;
  probability_above_median: number;
  probability_above_franchise_floor: number;
  probability_below_underperformance_floor: number;
  confidence_label: SourceFamilyConfidenceLabel;
} {
  const indexes = input.indexes.filter(Number.isFinite).map((value) => Math.max(0, value));
  if (!indexes.length) {
    return {
      label: "untested",
      audition_state: "untested",
      audition_passes: 0,
      audition_failures: 0,
      audition_opportunities_remaining: 2,
      graduated: false,
      median_index: null,
      probability_above_median: 0.5,
      probability_above_franchise_floor: 0.5,
      probability_below_underperformance_floor: 0.5,
      confidence_label: "low",
    };
  }
  const medianIndex = median(indexes) ?? 1;
  const aboveMedian = posteriorThresholdProbability(indexes, 1, "above");
  const aboveFranchiseFloor = posteriorThresholdProbability(indexes, 1.25, "above");
  const belowUnderperformanceFloor = posteriorThresholdProbability(indexes, 0.85, "below");
  const auditionIndexes = indexes.slice(0, 3);
  const auditionPasses = auditionIndexes.filter((value) => value >= 0.85).length;
  const auditionFailures = auditionIndexes.length - auditionPasses;
  let auditionState: SourceFamilyAuditionState;
  let auditionOpportunitiesRemaining = 0;
  let graduated = false;
  if (indexes.length === 1) {
    auditionState = indexes[0] >= 0.85 ? "provisional_pass" : "probation";
    auditionOpportunitiesRemaining = 1;
  } else if (indexes.length === 2) {
    if (auditionPasses === 2) {
      auditionState = "graduated";
      graduated = true;
    } else if (auditionFailures === 2) {
      auditionState = "underperforming";
    } else {
      auditionState = "tiebreaker";
      auditionOpportunitiesRemaining = 1;
    }
  } else if (auditionPasses >= 2) {
    auditionState = "graduated";
    graduated = true;
  } else {
    auditionState = "underperforming";
  }
  let label: SourceFamilyLifetimeLabel = graduated ? "prospect" : "untested";
  if (auditionState === "underperforming") label = "underperforming";
  else if (graduated) {
    if (medianIndex < 0.85) label = "underperforming";
    else if (medianIndex >= 1.5 && aboveFranchiseFloor >= 0.9) label = "franchise";
    else if (aboveMedian >= 0.8) label = "proven";
    else if (medianIndex >= 1.15) label = "emerging";
  }
  if (label === "underperforming") auditionState = "underperforming";
  return {
    label,
    audition_state: auditionState,
    audition_passes: auditionPasses,
    audition_failures: auditionFailures,
    audition_opportunities_remaining: auditionOpportunitiesRemaining,
    graduated: graduated && label !== "underperforming",
    median_index: medianIndex,
    probability_above_median: aboveMedian,
    probability_above_franchise_floor: aboveFranchiseFloor,
    probability_below_underperformance_floor: belowUnderperformanceFloor,
    confidence_label: confidenceLabel([aboveMedian, aboveFranchiseFloor, belowUnderperformanceFloor]),
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
  const indexes = input.recent_indexes.filter(Number.isFinite).map((value) => Math.max(0, value));
  if (!indexes.length) return { label: "no_recent_data", median_index: null, latest_two_index: null };
  const medianIndex = median(indexes) ?? 1;
  const latestTwoIndex = median(indexes.slice(-2));
  const previousWasWeak = input.previous_label === "cooling" || input.previous_label === "cold";
  if (previousWasWeak && indexes.length >= 2 && Number(latestTwoIndex ?? 0) >= 1) {
    return { label: "recovering", median_index: medianIndex, latest_two_index: latestTwoIndex };
  }
  if (medianIndex >= 1.5) return { label: "hot", median_index: medianIndex, latest_two_index: latestTwoIndex };
  if (medianIndex >= 0.9) return { label: "healthy", median_index: medianIndex, latest_two_index: latestTwoIndex };
  if (medianIndex >= 0.75) return { label: "cooling", median_index: medianIndex, latest_two_index: latestTwoIndex };
  return { label: "cold", median_index: medianIndex, latest_two_index: latestTwoIndex };
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
  if (label === "franchise" || label === "proven") return "winner";
  if (label === "emerging" || label === "prospect") return "development";
  return "exploration";
}

function allocationTierForCandidate(
  candidate: SourceSelectionCandidate,
  policy?: SourcePreselectionPolicy,
): SourceAllocationTier {
  if (["probation", "provisional_pass", "tiebreaker"].includes(String(candidate.audition_state ?? ""))) {
    return "exploration";
  }
  return sourcePreselectionAdjustmentForCandidate(policy, candidate)?.allocation_tier_override
    ?? allocationTierForLabel(candidate.lifetime_label);
}

function buildAllocationTargets(
  candidates: SourceSelectionCandidate[],
  requestedSlots: number,
  policy?: SourcePreselectionPolicy,
): Record<SourceAllocationTier, number> {
  const available: Record<SourceAllocationTier, number> = { winner: 0, development: 0, exploration: 0 };
  for (const candidate of candidates) available[allocationTierForCandidate(candidate, policy)] += 1;

    const desiredWinner = Math.floor(requestedSlots * 0.4);
  const desiredDevelopment = Math.floor(requestedSlots * 0.3);
  const desiredExploration = requestedSlots - desiredWinner - desiredDevelopment;
  const targets: Record<SourceAllocationTier, number> = {
    winner: Math.min(available.winner, desiredWinner),
    development: Math.min(available.development, desiredDevelopment),
    exploration: Math.min(available.exploration, desiredExploration),
  };
  let remaining = requestedSlots - targets.winner - targets.development - targets.exploration;
  const expansionOrder: SourceAllocationTier[] = ["exploration", "development", "winner"];
  while (remaining > 0) {
    let allocated = false;
    for (const tier of expansionOrder) {
      if (targets[tier] >= available[tier]) continue;
      targets[tier] += 1;
      remaining -= 1;
      allocated = true;
      if (remaining === 0) break;
    }
    if (!allocated) throw new Error(`insufficient_hardened_source_families:${requestedSlots - remaining}:${requestedSlots}`);
  }
  return targets;
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
  ]);
}

export async function refreshSourceFamilyLabels(
  db: D1Database,
  brandKey: string,
  nowIso = new Date().toISOString(),
): Promise<Record<string, unknown>> {
  await ensureSourceFamilySelectionTables(db);
    const familyRows = await db.prepare(
                `SELECT fam.id AS source_card_family_id, fam.source_identity_key,
                sel.internal_source_id AS saved_pattern_id
     FROM operator_source_card_families fam
     JOIN operator_source_cards card
       ON card.id = fam.current_source_card_id
      AND card.brand_key = fam.brand_key
      AND card.is_current = 1
     JOIN operator_source_selections sel
       ON sel.id = card.source_selection_id
      AND sel.brand_key = card.brand_key
      AND sel.source_type = 'saved_pattern'
     WHERE fam.brand_key = ?
       AND fam.status = 'active'
       AND card.status = 'locked'
       AND card.source_selection_id IS NOT NULL`,
    ).bind(brandKey).all<Record<string, unknown>>();
  const liveSavedPatternIds = await loadLiveSavedPatternIds(db);
    const eligibleFamilyRows = (familyRows.results ?? []).filter((row) =>
    isLiveSavedPatternId(liveSavedPatternIds, row.saved_pattern_id)
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
  const cutoffMs = (parseTimeMs(nowIso) ?? Date.now()) - 28 * 86400000;
  const likesFromRow = (row: Record<string, unknown>): number => {
    try {
      const metrics = JSON.parse(String(row.metrics_json ?? "{}")) as Record<string, unknown>;
      return Math.max(0, finiteNumber(metrics.likes));
    } catch {
      return 0;
    }
  };
  const isRecent = (row: Record<string, unknown>): boolean => {
    const postedMs = parseTimeMs(row.posted_at ?? row.captured_at);
    return postedMs !== null && postedMs >= cutoffMs;
  };
  const accountLifetimeLikes = (accountRows.results ?? []).map(likesFromRow);
  const accountRecentLikes = (accountRows.results ?? []).filter(isRecent).map(likesFromRow);
  const accountLifetimeMedian = median(accountLifetimeLikes) ?? 0;
  const accountRecentMedian = median(accountRecentLikes) ?? accountLifetimeMedian;
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
    const recentRows = rows.filter(isRecent);
    const recentLikes = recentRows.map(likesFromRow);
    const lifetimeIndexes = lifetimeLikes.map((likes) => normalizedIndex(likes, accountLifetimeMedian));
    const recentIndexes = recentLikes.map((likes) => normalizedIndex(likes, accountRecentMedian));
    const previous = previousByFamily.get(familyId);
    const lifetime = classifySourceFamilyLifetime({ indexes: lifetimeIndexes });
    const recent = classifySourceFamilyRecent({
      recent_indexes: recentIndexes,
      previous_label: previous?.recent_label as SourceFamilyRecentLabel | null | undefined,
    });
    const familyLifetimeMedian = median(lifetimeLikes);
    const familyRecentMedian = median(recentLikes);
    const state = {
      policy_version: SOURCE_FAMILY_LABEL_POLICY_VERSION,
            lifetime: {
        label: lifetime.label,
        audition_state: lifetime.audition_state,
        audition_passes: lifetime.audition_passes,
        audition_failures: lifetime.audition_failures,
        audition_opportunities_remaining: lifetime.audition_opportunities_remaining,
        graduated: lifetime.graduated,
        sample_size: lifetimeLikes.length,

        median_likes: familyLifetimeMedian,
        account_median_likes: accountLifetimeMedian,
        median_index: lifetime.median_index,
        probability_above_median: lifetime.probability_above_median,
        probability_above_franchise_floor: lifetime.probability_above_franchise_floor,
        probability_below_underperformance_floor: lifetime.probability_below_underperformance_floor,
      },
      recent_28d: {
        label: recent.label,
        sample_size: recentLikes.length,
        median_likes: familyRecentMedian,
        account_median_likes: accountRecentMedian,
        median_index: recent.median_index,
        latest_two_index: recent.latest_two_index,
      },
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
      lifetime.label, recent.label, lifetime.confidence_label, lifetimeLikes.length, recentLikes.length,
      accountLifetimeMedian, accountRecentMedian, familyLifetimeMedian, familyRecentMedian,
      lifetime.median_index, recent.median_index, recent.latest_two_index,
      lifetime.probability_above_median, lifetime.probability_above_franchise_floor,
      lifetime.probability_below_underperformance_floor, JSON.stringify(state),
    ));
    const previousLifetime = previous ? String(previous.lifetime_label ?? "") : null;
    const previousRecent = previous ? String(previous.recent_label ?? "") : null;
    if (previousLifetime !== lifetime.label || previousRecent !== recent.label) {
      transitionStatements.push(db.prepare(
        `INSERT INTO operator_source_family_label_transitions (
          id, brand_key, source_card_family_id, source_identity_key, label_policy_version,
          previous_lifetime_label, lifetime_label, previous_recent_label, recent_label, evidence_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(), brandKey, familyId, sourceIdentityKey, SOURCE_FAMILY_LABEL_POLICY_VERSION,
        previousLifetime, lifetime.label, previousRecent, recent.label, JSON.stringify(state),
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
    recent_account_post_count: accountRecentLikes.length,
    account_lifetime_median_likes: accountLifetimeMedian,
    account_28d_median_likes: accountRecentMedian,
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
            sel.internal_source_id AS saved_pattern_id
     FROM operator_source_card_families fam
     JOIN operator_source_cards card
       ON card.id = fam.current_source_card_id
      AND card.brand_key = fam.brand_key
      AND card.is_current = 1
     JOIN operator_source_selections sel
       ON sel.id = card.source_selection_id
      AND sel.brand_key = card.brand_key
      AND sel.source_type = 'saved_pattern'
     WHERE fam.brand_key = ?
       AND fam.status = 'active'
       AND card.status = 'locked'
       AND card.source_selection_id IS NOT NULL`,

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
    isLiveSavedPatternId(liveSavedPatternIds, row.saved_pattern_id)
    && !excludedPatternIds.has(String(row.saved_pattern_id ?? ""))
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
      saved_pattern_id: String(row.saved_pattern_id ?? ""),
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
         (sp.status = 'posted'
          AND datetime(COALESCE(sp.published_at, archive.post_timestamp, sp.scheduled_time)) >= datetime(?, '-28 days'))
         OR
         (sp.status IN ('approved', 'posting') AND datetime(sp.scheduled_time) >= datetime(?))
       )`,
  ).bind(brandKey, nowIso, nowIso).all<Record<string, unknown>>();
  const stateByIdentity = new Map((stateRows.results ?? []).map((row) => [String(row.source_identity_key), row]));
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
      recent_label: (state?.recent_label ?? "no_recent_data") as SourceFamilyRecentLabel,

      confidence_label: (state?.confidence_label ?? "low") as SourceFamilyConfidenceLabel,
      lifetime_sample_size: finiteNumber(state?.lifetime_sample_size),
      recent_sample_size: finiteNumber(state?.recent_sample_size),
      lifetime_index: finiteNumber(state?.lifetime_index, 1),
      recent_index: state?.recent_index === null || state?.recent_index === undefined ? null : finiteNumber(state.recent_index, 1),
      uses_24h: countPublishedSince(24),
      uses_7d: countPublishedSince(24 * 7),
      uses_28d: publishedTimes.length,
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

    if (finiteNumber(candidate.published_uses_72h) > 0) return "source_published_within_72h";

    if (finiteNumber(candidate.future_scheduled_uses) > 0) return "source_already_future_scheduled";
    const semanticExposureTimes = Array.isArray(candidate.semantic_exposure_times)
      ? candidate.semantic_exposure_times
      : [];
    if (input.slot_keys.length > 0 && semanticExposureTimes.length > 0 && input.slot_keys.every((slotKey) =>
      semanticExposureTimes.some((value) => slotDistanceHours(slotKey, value) < 24)
    )) return "semantic_exposure_blocks_horizon";
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

  if (active.length < input.slot_keys.length) {
    throw new Error(`insufficient_hardened_source_families:${active.length}:${input.slot_keys.length}`);
  }
  const eligibleFamilyCount = new Set(active.map((candidate) => String(candidate.source_card_family_id))).size;
  const cooldownHours = 72;
  const semanticSpacingHours = 24;
  const requireUniqueSource = input.slot_keys.length > 0;
    const allocationTargets = buildAllocationTargets(active, input.slot_keys.length, input.preselection_policy);
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
  const reservedTierMinimums: Record<SourceAllocationTier, number> = { winner: 0, development: 0, exploration: 0 };
  for (const reservation of reservations) {
    const candidate = reservationCandidate.get(reservation.reservation_key);
    if (candidate) reservedTierMinimums[allocationTierForCandidate(candidate, input.preselection_policy)] += 1;
  }
  for (const tier of ["winner", "development", "exploration"] as SourceAllocationTier[]) {
    while (allocationTargets[tier] < reservedTierMinimums[tier]) {
      const donor = (["exploration", "development", "winner"] as SourceAllocationTier[])
        .find((candidateTier) => candidateTier !== tier && allocationTargets[candidateTier] > reservedTierMinimums[candidateTier]);
      if (!donor) throw new Error(`preselection_reservation_allocation_unavailable:${tier}`);
      allocationTargets[donor] -= 1;
      allocationTargets[tier] += 1;
    }
  }
  const fulfilledReservations = new Set<string>();
  const selectedTierCounts: Record<SourceAllocationTier, number> = { winner: 0, development: 0, exploration: 0 };

  const selected: SourceSelectionCandidate[] = [];
  const receipts: SourceSelectionReceipt[] = [];
  const usedSources = new Set<string>();
  const plannedCounts = new Map<string, number>();
  const plannedLastSlot = new Map<string, string>();
  const plannedSemanticSlots = new Map<string, string[]>();
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
    const pendingReservedCandidateKeys = new Set(reservations
      .filter((reservation) => !fulfilledReservations.has(reservation.reservation_key))
      .map((reservation) => reservationCandidate.get(reservation.reservation_key))
      .filter((candidate): candidate is SourceSelectionCandidate => Boolean(candidate))
      .map((candidate) => String(candidate.source_identity_key)));
    const slotEligible = active.filter((candidate) => {

      const identity = String(candidate.source_identity_key);
      const familyId = String(candidate.source_card_family_id);
      const semanticKey = String(candidate.semantic_key ?? "unknown");
            if (usedSources.has(identity)) return false;
      if (activeReservation) {
        if (!sourcePreselectionTargetMatchesCandidate(activeReservation, candidate)) return false;
      } else if (pendingReservedCandidateKeys.has(identity)) {
        return false;
      }
      const plannedLast = plannedLastSlot.get(familyId);

      if (plannedLast && slotDistanceHours(slotKey, plannedLast) < cooldownHours) return false;
      const historicalSemanticTimes = Array.isArray(candidate.semantic_exposure_times)
        ? candidate.semantic_exposure_times
        : [];
      if (historicalSemanticTimes.some((value) => slotDistanceHours(slotKey, value) < semanticSpacingHours)) return false;
      const plannedSemanticTimes = plannedSemanticSlots.get(semanticKey) ?? [];
      if (plannedSemanticTimes.some((value) => slotDistanceHours(slotKey, value) < semanticSpacingHours)) return false;
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
      const lifetimeIndex = Math.max(0, finiteNumber(candidate.lifetime_index, 1));
      const shrunkPerformance = (2 + n * lifetimeIndex) / (n + 2);
      const recentFactor = candidate.recent_index === null || candidate.recent_index === undefined
        ? 1
        : clamp(finiteNumber(candidate.recent_index, 1), 0.75, 1.25);
      const explorationBonus = 0.5 / Math.sqrt(n + 1);
      const uses24h = Math.max(0, finiteNumber(candidate.uses_24h));
      const uses7d = Math.max(0, finiteNumber(candidate.uses_7d));
      const uses28d = Math.max(0, finiteNumber(candidate.uses_28d));
      const plannedUses = Math.max(0, plannedCounts.get(familyId) ?? 0);
      const semanticKey = String(candidate.semantic_key ?? "unknown");
      const semanticOverlapCount = (plannedSemanticSlots.get(semanticKey) ?? []).length;
      const publishedUses72h = Math.max(0, finiteNumber(candidate.published_uses_72h));
      const futureScheduledUses = Math.max(0, finiteNumber(candidate.future_scheduled_uses));
      const semanticPublishedUses24h = Math.max(0, finiteNumber(candidate.semantic_published_uses_24h));
      const semanticFutureScheduledUses = Math.max(0, finiteNumber(candidate.semantic_future_scheduled_uses));
      const exposureBurden = 1 + 0.75 * uses7d + 0.25 * uses28d + 2 * plannedUses + 0.5 * semanticOverlapCount;
            const negativeEvidenceMultiplier = 1;
      const preselectionAdjustment = sourcePreselectionAdjustmentForCandidate(input.preselection_policy, candidate);
      const preselectionScoreMultiplier = preselectionAdjustment?.score_multiplier ?? 1;
      const preselectionScoreAddend = preselectionAdjustment?.score_addend ?? 0;
      const baseScore = ((shrunkPerformance * recentFactor + explorationBonus) / exposureBurden) * negativeEvidenceMultiplier;
      const score = baseScore * preselectionScoreMultiplier + preselectionScoreAddend;

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
          recent_factor: recentFactor,
          shrunk_performance: shrunkPerformance,
          exploration_bonus: explorationBonus,
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
                cooldown_relaxation: 1,
        experiment_reservation_key: activeReservation?.reservation_key ?? null,
        preselection_policy_hash: input.preselection_policy?.policy_hash ?? null,
      });

    }
    const winner = scored[0];
    if (!winner) throw new Error(`hardened_source_selection_exhausted:${slotIndex}`);
    const receipt = {
      ...winner.receipt,
      score: Number(winner.receipt.score.toFixed(8)),
      shrunk_performance: Number(winner.receipt.shrunk_performance.toFixed(6)),
      exploration_bonus: Number(winner.receipt.exploration_bonus.toFixed(6)),
      recent_factor: Number(winner.receipt.recent_factor.toFixed(6)),
      exposure_burden: Number(winner.receipt.exposure_burden.toFixed(6)),
      deterministic_tiebreak: Number(winner.receipt.deterministic_tiebreak.toFixed(8)),
    };
    selected.push({ ...winner.candidate, selection_receipt: receipt, assigned_slot_key: slotKey });
    receipts.push(receipt);
    usedSources.add(receipt.source_identity_key);
    plannedCounts.set(receipt.source_card_family_id, receipt.planned_uses + 1);
    plannedLastSlot.set(receipt.source_card_family_id, slotKey);
    const semanticSlots = plannedSemanticSlots.get(receipt.semantic_key) ?? [];
    semanticSlots.push(slotKey);
    plannedSemanticSlots.set(receipt.semantic_key, semanticSlots);
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
      recent_exposure_authority: "published_and_scheduled_lineage",
      eligible_family_count: eligibleFamilyCount,
      hard_exclusion_count: exclusions.length,
      requested_slot_count: input.slot_keys.length,
      selected_count: selected.length,
      cooldown_hours: cooldownHours,
      semantic_spacing_hours: semanticSpacingHours,
      unique_source_enforced: requireUniqueSource,
      cooldown_relaxations: relaxationCounts,
      allocation_targets: allocationTargets,
      selected_allocation_tiers: selectedTierCounts,
            selected_lifetime_labels: labelCounts,
      preselection_policy_version: input.preselection_policy?.contract_version ?? null,
      preselection_policy_hash: input.preselection_policy?.policy_hash ?? null,
      preselection_causal_signal_counts: input.preselection_policy?.causal_signal_counts ?? {},
      experiment_reservations_required: reservations.length,
      experiment_reservations_fulfilled: fulfilledReservations.size,
      strategy_influence_enforced: true,

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
  const seenSources = new Set<string>();
  const semanticSlots = new Map<string, string[]>();
  for (const row of plan) {
    const receipt = row.receipt && typeof row.receipt === "object" && !Array.isArray(row.receipt)
      ? row.receipt as Record<string, unknown>
      : {};
    const slotKey = String(row.slot_key ?? "");
    const sourceIdentityKey = String(row.source_identity_key ?? "");
    const lifetimeLabel = String(receipt.lifetime_label ?? "");
    const semanticKey = String(receipt.semantic_key ?? "");
    if (String(receipt.policy_version ?? "") !== SOURCE_SELECTION_ENGINE_VERSION) {
      throw new Error(`locked_source_selection_plan_policy_mismatch:${slotKey}`);
    }
    if (lifetimeLabel === "underperforming" || lifetimeLabel === "disproven") {
      throw new Error(`locked_source_selection_plan_weak_family:${slotKey}`);
    }
    if (finiteNumber(receipt.published_uses_72h) > 0) {
      throw new Error(`locked_source_selection_plan_recent_source:${slotKey}`);
    }
    if (finiteNumber(receipt.future_scheduled_uses) > 0) {
      throw new Error(`locked_source_selection_plan_scheduled_source:${slotKey}`);
    }
    if (finiteNumber(receipt.cooldown_relaxation) !== 1 || finiteNumber(receipt.cooldown_hours) !== 72) {
      throw new Error(`locked_source_selection_plan_relaxed_cooldown:${slotKey}`);
    }
    if (!sourceIdentityKey || seenSources.has(sourceIdentityKey)) {
      throw new Error(`locked_source_selection_plan_duplicate_source:${slotKey}`);
    }
    seenSources.add(sourceIdentityKey);
    if (!semanticKey || !String(receipt.allocation_tier ?? "")) {
      throw new Error(`locked_source_selection_plan_strategy_evidence_missing:${slotKey}`);
    }
    const priorSlots = semanticSlots.get(semanticKey) ?? [];
    if (priorSlots.some((priorSlot) => slotDistanceHours(slotKey, priorSlot) < 24)) {
      throw new Error(`locked_source_selection_plan_semantic_crowding:${slotKey}`);
    }
    priorSlots.push(slotKey);
    semanticSlots.set(semanticKey, priorSlots);
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
  const recentAbsent = classifySourceFamilyRecent({ recent_indexes: [] });
  const recovering = classifySourceFamilyRecent({ recent_indexes: [0.7, 1.1, 1.2], previous_label: "cold" });
  const newAccountCandidates: SourceSelectionCandidate[] = Array.from({ length: 24 }, (_, index) => ({
    source_identity_key: `new-${index}`,
    source_card_id: `card-${index}`,
    source_card_family_id: `family-${index}`,
    lifetime_label: "untested",
    recent_label: "no_recent_data",
    lifetime_sample_size: 0,
    lifetime_index: 1,
    recent_index: null,
    uses_24h: 0,
    uses_7d: 0,
    uses_28d: 0,
    hours_since_last_use: null,
    semantic_key: `semantic-${index}`,
  }));
  const newAccountSelection = selectSourceFamilyLineup({
    candidates: newAccountCandidates,
    slot_keys: Array.from({ length: 24 }, (_, index) => `2026-01-01T${String(index).padStart(2, "0")}:00`),
    seed: "new-account",
  });
  const monopolyCandidates: SourceSelectionCandidate[] = [
    {
      source_identity_key: "winner",
      source_card_id: "winner-card",
      source_card_family_id: "winner-family",
      lifetime_label: "franchise",
      recent_label: "hot",
      lifetime_sample_size: 20,
      lifetime_index: 2,
      recent_index: 2,
      uses_24h: 4,
      uses_7d: 10,
            uses_28d: 20,
      published_uses_72h: 1,
      hours_since_last_use: 1,
      semantic_key: "winner",
    },
    ...Array.from({ length: 10 }, (_, index) => ({
      source_identity_key: `untested-${index}`,
      source_card_id: `untested-card-${index}`,
      source_card_family_id: `untested-family-${index}`,
      lifetime_label: "untested" as const,
      recent_label: "no_recent_data" as const,
      lifetime_sample_size: 0,
      lifetime_index: 1,
      recent_index: null,
      uses_24h: 0,
      uses_7d: 0,
      uses_28d: 0,
      hours_since_last_use: null,
      semantic_key: `untested-${index}`,
    })),
  ];
  const monopolySelection = selectSourceFamilyLineup({
    candidates: monopolyCandidates,
    slot_keys: Array.from({ length: 10 }, (_, index) => `2026-01-02T${String(index).padStart(2, "0")}:00`),
    seed: "monopoly",
  });
  const assertions = {
    one_breakout_recognized: oneBreakout.label === "emerging",
    repeated_winners_franchise: repeatedWinners.label === "franchise",
    viral_plus_failures_not_franchise: viralPlusFailures.label !== "franchise" && viralPlusFailures.label !== "proven",
        repeated_losers_underperforming: repeatedLosers.label === "underperforming",

    absent_recent_data_preserved: recentAbsent.label === "no_recent_data",
    recovery_detected: recovering.label === "recovering",
    new_account_explores_all: new Set(newAccountSelection.selected.map((item) => item.source_identity_key)).size === 24,
    winner_monopoly_blocked: monopolySelection.selected.filter((item) => item.source_identity_key === "winner").length === 0,
    deterministic_replay: JSON.stringify(newAccountSelection.receipts) === JSON.stringify(selectSourceFamilyLineup({
      candidates: newAccountCandidates,
      slot_keys: Array.from({ length: 24 }, (_, index) => `2026-01-01T${String(index).padStart(2, "0")}:00`),
      seed: "new-account",
    }).receipts),
  };
  return {
    passed: Object.values(assertions).every(Boolean),
    assertions,
    examples: { oneBreakout, repeatedWinners, viralPlusFailures, repeatedLosers, recentAbsent, recovering },
  };
}
