export const SOURCE_FAMILY_RANKING_VERSION = "source-family-ranking-v7";

export type UnifiedLifecycleLabel =
  | "untested"
  | "probation"
  | "tiebreaker"
  | "prospect"
  | "emerging"
  | "proven"
  | "franchise"
  | "underperforming";

export type UnifiedSelectionLane = "exploit" | "develop" | "explore" | "bench";

export type SourcePerformanceObservation = {
  index: number;
  age_days?: number;
};

export type UnifiedSourceFamilyClassification = {
  lifecycle_label: UnifiedLifecycleLabel;
  selection_lane: UnifiedSelectionLane;
  unified_rating: number;
  ranking_score: number;
  raw_weighted_index: number;
  effective_sample_size: number;
  matured_result_count: number;
  pass_count: number;
  failure_count: number;
  probability_above_median: number;
  probability_above_franchise_floor: number;
  probability_below_underperformance_floor: number;
  confidence_label: "low" | "developing" | "directional" | "reliable";
  recency_half_life_days: number;
  minimum_historical_weight: number;
};

const PRIOR_STRENGTH = 4;
const OBSERVATION_VARIANCE = 0.25;
const RANKING_CONFIDENCE_Z = 1.2815515655446004;
const RECENCY_HALF_LIFE_DAYS = 90;
const MINIMUM_HISTORICAL_WEIGHT = 0.2;
const PASS_FLOOR = 0.85;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function recencyWeight(ageDays: number): number {
  const normalizedAge = Math.max(0, finiteNumber(ageDays));
  return Math.max(MINIMUM_HISTORICAL_WEIGHT, Math.pow(0.5, normalizedAge / RECENCY_HALF_LIFE_DAYS));
}

function probabilityAboveThreshold(posteriorMeanLog: number, posteriorSd: number, threshold: number): number {
  return 1 - normalCdf((Math.log(threshold) - posteriorMeanLog) / posteriorSd);
}

function confidenceLabel(probabilities: number[]): UnifiedSourceFamilyClassification["confidence_label"] {
  const strongest = Math.max(...probabilities.map((value) => Math.max(value, 1 - value)));
  if (strongest >= 0.9) return "reliable";
  if (strongest >= 0.8) return "directional";
  if (strongest >= 0.65) return "developing";
  return "low";
}

export function selectionLaneForLifecycle(label: UnifiedLifecycleLabel): UnifiedSelectionLane {
  if (label === "franchise" || label === "proven") return "exploit";
  if (label === "untested") return "explore";
  if (label === "underperforming") return "bench";
  return "develop";
}

export function classifyUnifiedSourceFamily(
  observations: SourcePerformanceObservation[],
): UnifiedSourceFamilyClassification {
  const normalized = observations
    .map((observation) => ({
      index: clamp(finiteNumber(observation.index, 1), 0.05, 20),
      age_days: Math.max(0, finiteNumber(observation.age_days)),
    }))
    .filter((observation) => Number.isFinite(observation.index));

  if (!normalized.length) {
    return {
      lifecycle_label: "untested",
      selection_lane: "explore",
      unified_rating: 1,
      ranking_score: 1,
      raw_weighted_index: 1,
      effective_sample_size: 0,
      matured_result_count: 0,
      pass_count: 0,
      failure_count: 0,
      probability_above_median: 0.5,
      probability_above_franchise_floor: 0.5,
      probability_below_underperformance_floor: 0.5,
      confidence_label: "low",
      recency_half_life_days: RECENCY_HALF_LIFE_DAYS,
      minimum_historical_weight: MINIMUM_HISTORICAL_WEIGHT,
    };
  }

  const weighted = normalized.map((observation) => ({
    ...observation,
    weight: recencyWeight(observation.age_days),
    log_index: Math.log(observation.index),
  }));
  const effectiveSampleSize = weighted.reduce((sum, observation) => sum + observation.weight, 0);
  const weightedLogTotal = weighted.reduce((sum, observation) => sum + observation.weight * observation.log_index, 0);
  const posteriorPrecision = PRIOR_STRENGTH + effectiveSampleSize / OBSERVATION_VARIANCE;
  const posteriorMeanLog = (weightedLogTotal / OBSERVATION_VARIANCE) / posteriorPrecision;
  const posteriorSd = Math.sqrt(1 / posteriorPrecision);
  const unifiedRating = Math.exp(posteriorMeanLog);
    const rankingScore = Math.exp(posteriorMeanLog - RANKING_CONFIDENCE_Z * posteriorSd);
  const rawWeightedIndex = Math.exp(weightedLogTotal / Math.max(effectiveSampleSize, Number.EPSILON));
  const probabilityAboveMedian = probabilityAboveThreshold(posteriorMeanLog, posteriorSd, 1);
  const probabilityAboveFranchiseFloor = probabilityAboveThreshold(posteriorMeanLog, posteriorSd, 1.25);
  const probabilityBelowUnderperformanceFloor = 1 - probabilityAboveThreshold(posteriorMeanLog, posteriorSd, 0.85);
  const passCount = normalized.filter((observation) => observation.index >= PASS_FLOOR).length;
  const failureCount = normalized.length - passCount;

  let lifecycleLabel: UnifiedLifecycleLabel;
  if (normalized.length === 1) {
    lifecycleLabel = normalized[0].index >= PASS_FLOOR ? "prospect" : "probation";
  } else if (normalized.length === 2) {
    if (failureCount === 2) lifecycleLabel = "underperforming";
    else if (passCount === 1) lifecycleLabel = "tiebreaker";
    else lifecycleLabel = unifiedRating >= 1.05 ? "emerging" : "prospect";
  } else if (failureCount >= 2 && passCount < 2) {
    lifecycleLabel = "underperforming";
  } else if (unifiedRating < 0.85 && probabilityBelowUnderperformanceFloor >= 0.8) {
    lifecycleLabel = "underperforming";
  } else if (
    normalized.length >= 5
    && unifiedRating >= 1.35
    && probabilityAboveFranchiseFloor >= 0.9
  ) {
    lifecycleLabel = "franchise";
  } else if (
    normalized.length >= 3
    && unifiedRating >= 1.1
    && probabilityAboveMedian >= 0.8
  ) {
    lifecycleLabel = "proven";
  } else if (unifiedRating >= 1.02 && probabilityAboveMedian >= 0.6) {
    lifecycleLabel = "emerging";
  } else {
    lifecycleLabel = "prospect";
  }

  return {
    lifecycle_label: lifecycleLabel,
    selection_lane: selectionLaneForLifecycle(lifecycleLabel),
    unified_rating: unifiedRating,
    ranking_score: rankingScore,
    raw_weighted_index: rawWeightedIndex,
    effective_sample_size: effectiveSampleSize,
    matured_result_count: normalized.length,
    pass_count: passCount,
    failure_count: failureCount,
    probability_above_median: probabilityAboveMedian,
    probability_above_franchise_floor: probabilityAboveFranchiseFloor,
    probability_below_underperformance_floor: probabilityBelowUnderperformanceFloor,
    confidence_label: confidenceLabel([
      probabilityAboveMedian,
      probabilityAboveFranchiseFloor,
      probabilityBelowUnderperformanceFloor,
    ]),
    recency_half_life_days: RECENCY_HALF_LIFE_DAYS,
    minimum_historical_weight: MINIMUM_HISTORICAL_WEIGHT,
  };
}

export function buildDynamicLaneTargets(input: {
  requested_slots: number;
  exploit_source_count: number;
  develop_source_count: number;
  explore_source_count: number;
}): Record<"exploit" | "develop" | "explore", number> {
  const requestedSlots = Math.max(0, Math.floor(input.requested_slots));
  const capacities: Record<"exploit" | "develop" | "explore", number> = {
    exploit: input.exploit_source_count > 0 ? requestedSlots : 0,
    develop: Math.max(0, Math.floor(input.develop_source_count)),
    explore: Math.max(0, Math.floor(input.explore_source_count)),
  };
  const targets: Record<"exploit" | "develop" | "explore", number> = {
    exploit: 0,
    develop: 0,
    explore: 0,
  };
  const order: Array<"exploit" | "develop" | "explore"> = ["exploit", "develop", "explore"];

  for (let allocated = 0; allocated < requestedSlots; allocated += 1) {
    const available = order
      .filter((lane) => targets[lane] < capacities[lane])
      .sort((left, right) => targets[left] - targets[right] || order.indexOf(left) - order.indexOf(right));
    const lane = available[0];
    if (!lane) {
      throw new Error(`insufficient_active_source_capacity:${allocated}:${requestedSlots}`);
    }
    targets[lane] += 1;
  }

  return targets;
}

export function developmentResolutionPriority(label: UnifiedLifecycleLabel): number {
  if (label === "tiebreaker") return 1.4;
  if (label === "probation") return 1.3;
  if (label === "prospect") return 1.2;
  if (label === "emerging") return 1.1;
  return 1;
}
