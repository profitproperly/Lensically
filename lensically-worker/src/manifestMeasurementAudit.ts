import {
  ensureManifestIntelligenceTables,
  ensureManifestStrategyVersion,
  getLatestManifestStrategyVersion,
} from "./manifestIntelligence";
import {
  buildManifestSemanticSignature,
  compareManifestSemanticSignatures,
  ensureManifestIntelligenceEngineTables,
  type ManifestSemanticSignature,
} from "./manifestIntelligenceEngine";

export const MANIFEST_MEASUREMENT_AUDIT_VERSION = "manifest-measurement-audit-v1";
export const MANIFEST_LEARNING_BRIEF_VERSION = "manifest-learning-brief-v1";
export const MANIFEST_OPERATOR_BENCHMARK_VERSION = "manifest-operator-benchmark-v1";
export const MANIFEST_RUN_COMPARISON_VERSION = "manifest-run-comparison-v1";
export const MANIFEST_SAVED_PATTERN_INTELLIGENCE_VERSION = "manifest-saved-pattern-intelligence-v1";
export const MANIFEST_FOLLOWER_CHECKPOINT_VERSION = "manifest-follower-checkpoint-v1";
export const MANIFEST_AUDIT_READ_VERSION = "manifest-audit-read-v1";
export const MANIFEST_FOLLOWER_GOAL = 1_000_000;

export type ManifestAuditSection =
  | "summary"
  | "learning_brief"
  | "benchmarks"
  | "run_comparisons"
  | "saved_patterns"
  | "follower_checkpoint"
  | "strategy_transitions"
  | "portfolio"
  | "experiments"
  | "capability_gaps";

type JsonRecord = Record<string, unknown>;

type BenchmarkValue = {
  value: number | null;
  sample_size: number;
  direction: "higher_is_better" | "lower_is_better" | "contextual";
  unit: "ratio" | "count" | "score" | "followers";
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Number((numerator / denominator).toFixed(6)) : null;
}

function machine(value: unknown, fallback = "unknown"): string {
  const normalized = text(value, 240).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function parseJson(value: unknown, fallback: unknown): unknown {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as JsonRecord)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, stableValue(child)]));
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function uniqueStrings(values: unknown[], limit = 30): string[] {
  return Array.from(new Set(values.map((value) => text(value, 400)).filter(Boolean))).slice(0, limit);
}

function median(values: number[]): number {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
}

function percentile(values: number[], target: number): number {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const position = clamp(target) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function average(values: number[]): number {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function safeIso(value: unknown): string | null {
  const parsed = Date.parse(text(value, 120));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function dateOnly(value: unknown): string | null {
  const iso = safeIso(value);
  return iso ? iso.slice(0, 10) : null;
}

function benchmark(value: number | null, sampleSize: number, direction: BenchmarkValue["direction"], unit: BenchmarkValue["unit"]): BenchmarkValue {
  return {
    value: value === null ? null : Number(value.toFixed(6)),
    sample_size: Math.max(0, Math.trunc(sampleSize)),
    direction,
    unit,
  };
}

function compactEvidence(value: unknown, itemLimit = 12): JsonRecord {
  const source = record(parseJson(value, {}));
  const output: JsonRecord = {};
  for (const [key, child] of Object.entries(source)) {
    if (Array.isArray(child)) {
      output[key] = child.slice(0, itemLimit);
      output[`${key}_count`] = child.length;
      if (child.length > itemLimit) output[`${key}_truncated`] = true;
    } else {
      output[key] = child;
    }
  }
  return output;
}

export async function ensureManifestMeasurementAuditTables(db: D1Database): Promise<void> {
  await ensureManifestIntelligenceTables(db);
  await ensureManifestIntelligenceEngineTables(db);
  const statements = [
    `CREATE TABLE IF NOT EXISTS operator_manifest_learning_briefs (
      id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, brief_key TEXT NOT NULL,
      brief_version TEXT NOT NULL, source_fingerprint TEXT NOT NULL,
      evidence_window_start TEXT, evidence_window_end TEXT, authoritative_post_count INTEGER NOT NULL DEFAULT 0,
      brief_json TEXT NOT NULL, strategy_change_json TEXT NOT NULL DEFAULT '{}',
      strategy_version_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(brand_key, brief_key))`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_benchmark_snapshots (
      id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, snapshot_key TEXT NOT NULL,
      cycle_id TEXT, benchmark_version TEXT NOT NULL, window_start TEXT, window_end TEXT,
      metrics_json TEXT NOT NULL, source_fingerprint TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(brand_key, snapshot_key))`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_run_comparisons (
      id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, cycle_id TEXT NOT NULL,
      previous_cycle_id TEXT, comparison_version TEXT NOT NULL, comparison_json TEXT NOT NULL,
      source_fingerprint TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(brand_key, cycle_id))`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_saved_pattern_intelligence (
      id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, pattern_identity_key TEXT NOT NULL,
      external_pattern_id INTEGER, source_identity_key TEXT NOT NULL, verified_metrics_json TEXT NOT NULL,
      semantic_json TEXT NOT NULL, mechanism_json TEXT NOT NULL, adaptation_options_json TEXT NOT NULL,
      similarity_json TEXT NOT NULL, usage_json TEXT NOT NULL, results_json TEXT NOT NULL,
      confidence_json TEXT NOT NULL, reuse_state TEXT NOT NULL, exclusion_state TEXT NOT NULL DEFAULT 'active',
      source_updated_at TEXT, intelligence_version TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(brand_key, pattern_identity_key))`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_follower_checkpoints (
      id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, checkpoint_key TEXT NOT NULL,
      threads_user_id TEXT NOT NULL, checkpoint_version TEXT NOT NULL,
      snapshot_date TEXT, followers_count INTEGER NOT NULL, follower_goal INTEGER NOT NULL,
      distance_to_goal INTEGER NOT NULL, trajectory_json TEXT NOT NULL,
      attribution_policy TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(brand_key, checkpoint_key))`,
    `CREATE INDEX IF NOT EXISTS idx_manifest_learning_briefs_brand_created
      ON operator_manifest_learning_briefs (brand_key, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_manifest_benchmarks_brand_created
      ON operator_manifest_benchmark_snapshots (brand_key, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_manifest_run_comparisons_brand_created
      ON operator_manifest_run_comparisons (brand_key, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_manifest_pattern_intelligence_reuse
      ON operator_manifest_saved_pattern_intelligence (brand_key, reuse_state, updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_manifest_follower_checkpoints_brand_created
      ON operator_manifest_follower_checkpoints (brand_key, created_at DESC)`,
  ];
  for (const statement of statements) await db.prepare(statement).run();
}

export function buildManifestLearningBrief(input: {
  observations: JsonRecord[];
  portfolio_states: JsonRecord[];
  experiments: JsonRecord[];
  transitions: JsonRecord[];
  authoritative_post_count: number;
  evidence_window_start?: string | null;
  evidence_window_end?: string | null;
}): JsonRecord {
  const observations = input.observations.map((item) => ({
    ...item,
    level: machine(item.level),
    feature_key: machine(item.feature_key),
    confidence_label: machine(item.confidence_label),
    state: machine(item.state),
    effect_size: number(item.effect_size),
    sample_size: number(item.sample_size),
  }));
  const structural = observations.filter((item) => item.level !== "exact_post" && ["directional", "reliable", "contested"].includes(String(item.confidence_label)));
  const improvements = structural
    .filter((item) => number(item.effect_size) >= 6 && item.state === "supporting")
    .sort((left, right) => number(right.effect_size) - number(left.effect_size))
    .slice(0, 12)
    .map((item) => ({
      level: item.level,
      feature_key: item.feature_key,
      effect_size: number(item.effect_size),
      sample_size: number(item.sample_size),
      confidence: item.confidence_label,
    }));
  const weakening = structural
    .filter((item) => number(item.effect_size) <= -6 && item.state === "contradicting")
    .sort((left, right) => number(left.effect_size) - number(right.effect_size))
    .slice(0, 12)
    .map((item) => ({
      level: item.level,
      feature_key: item.feature_key,
      effect_size: number(item.effect_size),
      sample_size: number(item.sample_size),
      confidence: item.confidence_label,
    }));
  const uncertainty = observations
    .filter((item) => ["insufficient", "emerging", "contested"].includes(String(item.confidence_label)))
    .sort((left, right) => number(right.sample_size) - number(left.sample_size))
    .slice(0, 15)
    .map((item) => ({
      level: item.level,
      feature_key: item.feature_key,
      sample_size: number(item.sample_size),
      confidence: item.confidence_label,
      state: item.state,
    }));
  const familyOpportunities = input.portfolio_states
    .filter((item) => ["franchise", "core", "emerging"].includes(machine(item.role)))
    .sort((left, right) => number(right.allocation_weight) - number(left.allocation_weight))
    .slice(0, 12)
    .map((item) => ({
      family_key: machine(item.family_key),
      role: machine(item.role),
      allocation_weight: number(item.allocation_weight),
      confidence: machine(item.confidence_label),
      reason: text(item.reason, 1000),
    }));
  const fatigue = input.portfolio_states
    .filter((item) => number(item.actual_decay) === 1)
    .slice(0, 12)
    .map((item) => ({
      family_key: machine(item.family_key),
      role: machine(item.role),
      verified_decay: true,
      reason: text(item.reason, 1000),
    }));
  const experimentDecisions = input.experiments.map((item) => ({
    experiment_key: machine(item.experiment_key),
    family_key: machine(item.family_key, "unlinked"),
    status: machine(item.status),
    decision: machine(item.follow_up_decision, "insufficient_evidence"),
    latest_result: record(parseJson(item.latest_result_json ?? item.latest_result, {})),
  }));
  const disprovenAssumptions = [
    ...weakening.filter((item) => item.confidence === "reliable").map((item) => ({
      type: "reliable_negative_observation",
      level: item.level,
      feature_key: item.feature_key,
      effect_size: item.effect_size,
    })),
    ...experimentDecisions.filter((item) => item.decision === "stop").map((item) => ({
      type: "experiment_stopped",
      experiment_key: item.experiment_key,
      family_key: item.family_key,
      result: item.latest_result,
    })),
  ].slice(0, 15);
  const nextRunTests = [
    ...experimentDecisions
      .filter((item) => ["continue", "revise", "insufficient_evidence"].includes(item.decision))
      .map((item) => ({
        test_type: "controlled_experiment",
        experiment_key: item.experiment_key,
        family_key: item.family_key,
        next_action: item.decision === "revise" ? "change_one_variable_and_retest" : "collect_more_mature_evidence",
      })),
    ...familyOpportunities
      .filter((item) => item.role === "emerging")
      .map((item) => ({
        test_type: "family_development",
        family_key: item.family_key,
        next_action: "schedule_a_materially_distinct_execution_with_the_same_proven_mechanism",
      })),
    ...uncertainty
      .filter((item) => item.confidence === "contested")
      .map((item) => ({
        test_type: "belief_resolution",
        level: item.level,
        feature_key: item.feature_key,
        next_action: "run_a_matched_comparison_that_isolates_one_variable",
      })),
  ].slice(0, 20);
  const reliableChanges = [...improvements, ...weakening].filter((item) => item.confidence === "reliable");
  const strategyChangeWarranted = input.authoritative_post_count >= 3
    && (reliableChanges.length > 0 || fatigue.length > 0 || disprovenAssumptions.length > 0
      || experimentDecisions.some((item) => ["expand", "stop", "revise"].includes(item.decision)));
  const directives = {
    emphasize: improvements.filter((item) => item.confidence === "reliable").map((item) => `${item.level}:${item.feature_key}`),
    develop: familyOpportunities.filter((item) => item.role === "emerging").map((item) => item.family_key),
    preserve_winners: familyOpportunities.filter((item) => ["franchise", "core"].includes(item.role)).map((item) => item.family_key),
    reduce: weakening.filter((item) => item.confidence === "reliable").map((item) => `${item.level}:${item.feature_key}`),
    cool_verified_decay_only: fatigue.map((item) => item.family_key),
    experiments: experimentDecisions.filter((item) => item.decision !== "insufficient_evidence"),
    next_tests: nextRunTests,
  };
  return {
    version: MANIFEST_LEARNING_BRIEF_VERSION,
    evidence_window: {
      start: input.evidence_window_start ?? null,
      end: input.evidence_window_end ?? null,
      authoritative_post_count: input.authoritative_post_count,
    },
    improvements,
    weakening,
    uncertainty,
    family_opportunities: familyOpportunities,
    fatigue,
    disproven_assumptions: disprovenAssumptions,
    experiment_decisions: experimentDecisions.slice(0, 20),
    recent_state_transitions: input.transitions.slice(0, 20).map((item) => ({
      entity_type: machine(item.entity_type),
      entity_id: text(item.entity_id, 400),
      from_state: item.from_state ?? null,
      to_state: item.to_state ?? null,
      reason: text(item.reason, 1000),
      transitioned_at: item.transitioned_at ?? null,
    })),
    next_run_tests: nextRunTests,
    strategy_change: {
      warranted: strategyChangeWarranted,
      reason: strategyChangeWarranted
        ? "Authoritative evidence contains a reliable improvement, weakening, verified decay, disproven assumption, or terminal experiment decision."
        : "No structural strategy update is authorized until mature evidence crosses the confidence and effect thresholds.",
      directives,
    },
  };
}

async function refreshManifestLearningBrief(db: D1Database, brandKey: string): Promise<JsonRecord> {
  const observationRows = await db.prepare(`SELECT level, feature_key, sample_size, supporting_count,
      contradicting_count, median_overall, effect_size, confidence_score, confidence_label,
      state, evidence_json, updated_at
    FROM operator_manifest_learning_observations
    WHERE brand_key = ? AND active = 1
    ORDER BY confidence_score DESC, sample_size DESC, updated_at DESC LIMIT 250`).bind(brandKey).all<JsonRecord>();
  const portfolioRows = await db.prepare(`SELECT family_key, role, recommended_role, previous_role,
      confidence_score, confidence_label, allocation_weight, actual_decay, reason, evidence_json, updated_at
    FROM operator_manifest_portfolio_states WHERE brand_key = ?
    ORDER BY allocation_weight DESC, confidence_score DESC LIMIT 100`).bind(brandKey).all<JsonRecord>();
  const experimentRows = await db.prepare(`SELECT experiment_key, family_key, status,
      latest_result_json, follow_up_decision, updated_at
    FROM operator_manifest_experiments WHERE brand_key = ?
    ORDER BY datetime(updated_at) DESC LIMIT 100`).bind(brandKey).all<JsonRecord>();
  const transitionRows = await db.prepare(`SELECT entity_type, entity_id, from_state, to_state,
      reason, evidence_json, transitioned_at
    FROM operator_manifest_state_transitions WHERE brand_key = ?
    ORDER BY datetime(transitioned_at) DESC LIMIT 100`).bind(brandKey).all<JsonRecord>();
  const maturityWindow = await db.prepare(`SELECT MIN(datetime(created_at)) AS window_start,
      MAX(datetime(updated_at)) AS window_end,
      COUNT(DISTINCT published_post_id) AS authoritative_post_count
    FROM operator_manifest_maturity_evaluations
    WHERE brand_key = ? AND checkpoint_hours = 24 AND structural_change_allowed = 1`).bind(brandKey).first<JsonRecord>();
  const observations = observationRows.results ?? [];
  const portfolio = portfolioRows.results ?? [];
  const experiments = experimentRows.results ?? [];
  const transitions = transitionRows.results ?? [];
  const authoritativePostCount = number(maturityWindow?.authoritative_post_count);
  const sourceEvidence = {
    observations: observations.map((item) => [item.level, item.feature_key, item.sample_size, item.effect_size, item.confidence_label, item.state]),
    portfolio: portfolio.map((item) => [item.family_key, item.role, item.confidence_label, item.actual_decay, item.allocation_weight]),
    experiments: experiments.map((item) => [item.experiment_key, item.status, item.follow_up_decision, item.latest_result_json]),
    transitions: transitions.map((item) => [item.entity_type, item.entity_id, item.from_state, item.to_state, item.transitioned_at]),
    authoritative_post_count: authoritativePostCount,
  };
  const sourceFingerprint = fnv1a(stableJson(sourceEvidence));
  const brief = buildManifestLearningBrief({
    observations,
    portfolio_states: portfolio,
    experiments,
    transitions,
    authoritative_post_count: authoritativePostCount,
    evidence_window_start: safeIso(maturityWindow?.window_start),
    evidence_window_end: safeIso(maturityWindow?.window_end),
  });
  const latestStrategy = await getLatestManifestStrategyVersion(db, brandKey);
  const strategyChange = record(brief.strategy_change);
  let strategyVersionId: string | null = null;
  if (strategyChange.warranted === true) {
    const latestStrategyBody = record(latestStrategy?.strategy);
    const nextStrategy = {
      ...latestStrategyBody,
      intelligence_directives: record(strategyChange.directives),
      intelligence_learning_brief_key: sourceFingerprint,
      intelligence_learning_brief_version: MANIFEST_LEARNING_BRIEF_VERSION,
    };
    const latestCycle = await db.prepare(`SELECT id FROM operator_autonomous_growth_cycles
      WHERE brand_key = ? ORDER BY datetime(updated_at) DESC LIMIT 1`).bind(brandKey).first<{ id: string }>();
    const strategy = await ensureManifestStrategyVersion(db, {
      brandKey,
      strategy: nextStrategy,
      evidence: {
        learning_brief_key: sourceFingerprint,
        authoritative_post_count: authoritativePostCount,
        reliable_changes: [
          ...array(brief.improvements).filter((item) => record(item).confidence === "reliable"),
          ...array(brief.weakening).filter((item) => record(item).confidence === "reliable"),
        ],
        verified_decay: brief.fatigue,
        disproven_assumptions: brief.disproven_assumptions,
        experiment_decisions: brief.experiment_decisions,
      },
      changeSummary: "Automatic Manifest strategy update from authoritative mature learning brief.",
      reversalConditions: [
        "Reverse or reduce a directive when matched 24-hour evidence becomes contested or reliably contradicting.",
        "Do not cool a family from frequency alone; require verified comparable decay.",
      ],
      sourceCycleId: latestCycle?.id ?? null,
      parentVersionId: text(latestStrategy?.id, 160) || null,
    });
    strategyVersionId = text(strategy.id, 160) || null;
  }
  const briefKey = sourceFingerprint;
  await db.prepare(`INSERT INTO operator_manifest_learning_briefs (
      id, brand_key, brief_key, brief_version, source_fingerprint,
      evidence_window_start, evidence_window_end, authoritative_post_count,
      brief_json, strategy_change_json, strategy_version_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(brand_key, brief_key) DO UPDATE SET
      brief_version = excluded.brief_version, source_fingerprint = excluded.source_fingerprint,
      evidence_window_start = excluded.evidence_window_start, evidence_window_end = excluded.evidence_window_end,
      authoritative_post_count = excluded.authoritative_post_count, brief_json = excluded.brief_json,
      strategy_change_json = excluded.strategy_change_json,
      strategy_version_id = COALESCE(excluded.strategy_version_id, operator_manifest_learning_briefs.strategy_version_id),
      updated_at = CURRENT_TIMESTAMP`).bind(
      crypto.randomUUID(), brandKey, briefKey, MANIFEST_LEARNING_BRIEF_VERSION, sourceFingerprint,
      safeIso(maturityWindow?.window_start), safeIso(maturityWindow?.window_end), authoritativePostCount,
      stableJson(brief), stableJson(strategyChange), strategyVersionId,
    ).run();
  return {
    brief_key: briefKey,
    source_fingerprint: sourceFingerprint,
    authoritative_post_count: authoritativePostCount,
    strategy_change_warranted: strategyChange.warranted === true,
    strategy_version_id: strategyVersionId,
    brief,
  };
}

function expectedRangeCalibration(expected: JsonRecord, score: JsonRecord, metrics: JsonRecord): number | null {
  const checks: boolean[] = [];
  const inspect = (key: string, actual: number | null): void => {
    if (actual === null) return;
    const candidate = record(expected[key]);
    if (!Object.keys(candidate).length) return;
    const minimum = nullableNumber(candidate.min ?? candidate.minimum ?? candidate.low);
    const maximum = nullableNumber(candidate.max ?? candidate.maximum ?? candidate.high);
    if (minimum === null && maximum === null) return;
    checks.push((minimum === null || actual >= minimum) && (maximum === null || actual <= maximum));
  };
  inspect("overall", nullableNumber(score.overall));
  inspect("overall_score", nullableNumber(score.overall));
  for (const key of ["views", "likes", "replies", "reposts", "quotes", "shares", "engagement_total"]) {
    inspect(key, nullableNumber(metrics[key]));
  }
  return checks.length ? checks.filter(Boolean).length / checks.length : null;
}

export function buildManifestOperatorBenchmarks(input: {
  target_slot_count: number;
  scheduled_slot_count: number;
  candidate_attempt_count: number;
  duplicate_rejection_count: number;
  semantic_collision_count: number;
  gate_failure_count: number;
  semantic_signatures: JsonRecord[];
  lineage_complete_count: number;
  lineage_total_count: number;
  prediction_calibrations: number[];
  confidence_labels: string[];
  authoritative_scores: number[];
  recent_scores: number[];
  previous_scores: number[];
  portfolio_states: JsonRecord[];
  experiments: JsonRecord[];
  new_family_count: number;
  strategy_changed: boolean;
}): Record<string, BenchmarkValue> {
  const signatures = input.semantic_signatures.map((item) => record(item.signature ?? item));
  const premiseKeys = signatures.map((item) => machine(item.premise_key, "none:none:none"));
  const meaningfulPremises = premiseKeys.filter((item) => item !== "none:none:none");
  const genericCount = signatures.filter((item) => (
    machine(item.audience_reward_key) === "general_encouragement"
    && machine(item.question_type, "none") === "none"
    && machine(item.financial_scenario_key, "none") === "none"
    && machine(item.tension_key, "none") === "none"
  )).length;
  const confidenceEligible = input.confidence_labels.filter((item) => ["directional", "reliable", "contested"].includes(machine(item)));
  const confidenceSettled = confidenceEligible.filter((item) => ["directional", "reliable"].includes(machine(item))).length;
  const winners = input.portfolio_states.filter((item) => ["franchise", "core"].includes(machine(item.role)));
  const preservedWinners = winners.filter((item) => number(item.actual_decay) !== 1).length;
  const learnedExperiments = input.experiments.filter((item) => {
    const decision = machine(item.follow_up_decision, "insufficient_evidence");
    return ["continue", "expand", "revise", "stop"].includes(decision);
  }).length;
  const recentFloor = input.recent_scores.length ? percentile(input.recent_scores, 0.25) : 0;
  const previousFloor = input.previous_scores.length ? percentile(input.previous_scores, 0.25) : 0;
  return {
    coverage_accuracy: benchmark(ratio(input.scheduled_slot_count, input.target_slot_count), input.target_slot_count, "higher_is_better", "ratio"),
    duplicate_rate: benchmark(ratio(input.duplicate_rejection_count, input.candidate_attempt_count), input.candidate_attempt_count, "lower_is_better", "ratio"),
    semantic_repetition_rate: benchmark(ratio(input.semantic_collision_count, input.candidate_attempt_count), input.candidate_attempt_count, "lower_is_better", "ratio"),
    premise_diversity: benchmark(ratio(new Set(meaningfulPremises).size, meaningfulPremises.length), meaningfulPremises.length, "higher_is_better", "ratio"),
    generic_content_rate: benchmark(ratio(genericCount, signatures.length), signatures.length, "lower_is_better", "ratio"),
    gate_failure_rate: benchmark(ratio(input.gate_failure_count, input.candidate_attempt_count), input.candidate_attempt_count, "lower_is_better", "ratio"),
    lineage_completeness: benchmark(ratio(input.lineage_complete_count, input.lineage_total_count), input.lineage_total_count, "higher_is_better", "ratio"),
    prediction_accuracy: benchmark(input.prediction_calibrations.length ? average(input.prediction_calibrations) : null, input.prediction_calibrations.length, "higher_is_better", "ratio"),
    strategy_calibration: benchmark(ratio(confidenceSettled, confidenceEligible.length), confidenceEligible.length, "higher_is_better", "ratio"),
    engagement_floor_movement: benchmark(
      input.recent_scores.length && input.previous_scores.length ? recentFloor - previousFloor : null,
      input.recent_scores.length + input.previous_scores.length,
      "higher_is_better",
      "score",
    ),
    median_performance: benchmark(input.authoritative_scores.length ? median(input.authoritative_scores) : null, input.authoritative_scores.length, "higher_is_better", "score"),
    high_performance_hit_rate: benchmark(
      ratio(input.authoritative_scores.filter((score) => score >= 65).length, input.authoritative_scores.length),
      input.authoritative_scores.length,
      "higher_is_better",
      "ratio",
    ),
    new_family_discovery: benchmark(input.new_family_count, input.portfolio_states.length, "higher_is_better", "count"),
    winner_preservation: benchmark(ratio(preservedWinners, winners.length), winners.length, "higher_is_better", "ratio"),
    experiment_learning_rate: benchmark(ratio(learnedExperiments, input.experiments.length), input.experiments.length, "higher_is_better", "ratio"),
    strategy_influence: benchmark(input.strategy_changed ? 1 : 0, 1, "higher_is_better", "ratio"),
  };
}

function benchmarkMetricValue(metrics: JsonRecord, key: string): number | null {
  return nullableNumber(record(metrics[key]).value);
}

function benchmarkDelta(current: JsonRecord, previous: JsonRecord, key: string): JsonRecord {
  const currentMetric = record(current[key]);
  const previousMetric = record(previous[key]);
  const currentValue = nullableNumber(currentMetric.value);
  const previousValue = nullableNumber(previousMetric.value);
  const direction = machine(currentMetric.direction, "contextual");
  if (currentValue === null || previousValue === null) {
    return { metric: key, current: currentValue, previous: previousValue, delta: null, status: "insufficient_comparable_evidence", direction };
  }
  const delta = currentValue - previousValue;
  const adjusted = direction === "lower_is_better" ? -delta : direction === "higher_is_better" ? delta : Math.abs(currentValue) - Math.abs(previousValue);
  return {
    metric: key,
    current: currentValue,
    previous: previousValue,
    delta: Number(delta.toFixed(6)),
    status: Math.abs(delta) < 0.000001 ? "unchanged" : adjusted > 0 ? "improved" : "weakened",
    direction,
  };
}

export function buildManifestRunComparison(input: {
  cycle_id: string;
  previous_cycle_id?: string | null;
  current_metrics: JsonRecord;
  previous_metrics?: JsonRecord | null;
}): JsonRecord {
  const previous = record(input.previous_metrics);
  const groups: Record<string, string[]> = {
    diversity: ["premise_diversity", "semantic_repetition_rate"],
    hypothesis_quality: ["prediction_accuracy", "lineage_completeness"],
    generic_output: ["generic_content_rate"],
    prediction_calibration: ["prediction_accuracy", "strategy_calibration"],
    evidence_use: ["strategy_calibration", "strategy_influence"],
    repeated_mistakes: ["duplicate_rate", "semantic_repetition_rate", "gate_failure_rate"],
    strategy_influence: ["strategy_influence", "winner_preservation", "experiment_learning_rate"],
  };
  const dimensions = Object.fromEntries(Object.entries(groups).map(([group, keys]) => {
    const deltas = keys.map((key) => benchmarkDelta(input.current_metrics, previous, key));
    const comparable = deltas.filter((item) => item.status !== "insufficient_comparable_evidence");
    const improved = comparable.filter((item) => item.status === "improved").length;
    const weakened = comparable.filter((item) => item.status === "weakened").length;
    return [group, {
      status: comparable.length === 0 ? "insufficient_comparable_evidence" : improved > weakened ? "improved" : weakened > improved ? "weakened" : "mixed_or_unchanged",
      metrics: deltas,
    }];
  }));
  const repeatedMistakes = array(record(dimensions.repeated_mistakes).metrics)
    .filter((item) => record(item).status === "weakened")
    .map((item) => record(item).metric);
  return {
    version: MANIFEST_RUN_COMPARISON_VERSION,
    cycle_id: input.cycle_id,
    previous_cycle_id: input.previous_cycle_id ?? null,
    comparable: Boolean(input.previous_cycle_id && Object.keys(previous).length),
    dimensions,
    repeated_mistakes: repeatedMistakes,
    actual_strategy_influence: benchmarkMetricValue(input.current_metrics, "strategy_influence") === 1,
  };
}

async function refreshManifestBenchmarks(db: D1Database, brandKey: string, requestedCycleId?: string | null): Promise<JsonRecord> {
  const cycle = requestedCycleId
    ? await db.prepare(`SELECT * FROM operator_autonomous_growth_cycles WHERE brand_key = ? AND id = ? LIMIT 1`).bind(brandKey, requestedCycleId).first<JsonRecord>()
    : await db.prepare(`SELECT * FROM operator_autonomous_growth_cycles WHERE brand_key = ? ORDER BY datetime(updated_at) DESC LIMIT 1`).bind(brandKey).first<JsonRecord>();
  const cycleId = text(cycle?.id, 160) || `no-cycle-${new Date().toISOString().slice(0, 10)}`;
  const targetSlots = array(parseJson(cycle?.target_slots_json, []));
  const lineups = cycle?.id
    ? await db.prepare(`SELECT id, slot_key, family_key, source_card_id, generation_run_id, draft_id,
        scheduled_post_id, hypothesis_id, source_selection_id, status
      FROM operator_autonomous_lineup_items WHERE brand_key = ? AND cycle_id = ?
      ORDER BY slot_key ASC`).bind(brandKey, cycle.id).all<JsonRecord>()
    : { results: [] as JsonRecord[] };
  const lineupRows = lineups.results ?? [];
  const scheduledLineups = lineupRows.filter((item) => number(item.scheduled_post_id) > 0);
  const eventRows = cycle?.id
    ? await db.prepare(`SELECT event_type, payload_json, created_at FROM operator_manifest_cycle_receipt_events
      WHERE brand_key = ? AND cycle_id = ? ORDER BY datetime(created_at) ASC`).bind(brandKey, cycle.id).all<JsonRecord>()
    : { results: [] as JsonRecord[] };
  const events = eventRows.results ?? [];
  const rejected = events.filter((item) => machine(item.event_type) === "candidate_rejected");
  const evaluated = events.filter((item) => ["candidate_evaluated", "candidate_rejected", "post_persisted", "post_reused"].includes(machine(item.event_type)));
  const rejectionErrors = rejected.map((item) => machine(record(parseJson(item.payload_json, {})).error));
  const duplicateCount = rejectionErrors.filter((item) => item === "exact_duplicate_post").length;
  const semanticCount = rejectionErrors.filter((item) => item === "semantic_repetition_collision").length;
  const gateFailureCount = rejected.filter((item) => {
    const error = machine(record(parseJson(item.payload_json, {})).error);
    return !["exact_duplicate_post", "semantic_repetition_collision", "slot_not_authoritatively_missing", "autonomous_slot_already_scheduled"].includes(error);
  }).length;
  const semanticRows = cycle?.id
    ? await db.prepare(`SELECT sig.signature_json
      FROM operator_autonomous_lineup_items l
      JOIN operator_manifest_semantic_signatures sig ON sig.brand_key = l.brand_key
        AND sig.content_type = 'scheduled' AND sig.scheduled_post_id = l.scheduled_post_id
      WHERE l.brand_key = ? AND l.cycle_id = ? AND l.scheduled_post_id IS NOT NULL`).bind(brandKey, cycle.id).all<JsonRecord>()
    : { results: [] as JsonRecord[] };
  const signatures = (semanticRows.results ?? []).map((item) => record(parseJson(item.signature_json, {})));
  const lineageComplete = scheduledLineups.filter((item) => (
    text(item.hypothesis_id, 160)
    && number(item.scheduled_post_id) > 0
    && text(item.generation_run_id, 160)
    && text(item.draft_id, 160)
    && (text(item.source_card_id, 160) || text(item.source_selection_id, 160))
  )).length;
  const predictionRows = await db.prepare(`SELECT h.expected_performance_range_json,
      score.scores_json, score.metrics_json
    FROM operator_manifest_post_hypotheses h
    JOIN scheduled_posts scheduled ON scheduled.id = h.scheduled_post_id
    JOIN operator_post_performance_scores score ON score.brand_key = h.brand_key
      AND score.published_post_id = scheduled.published_post_id
      AND score.checkpoint_hours = 24 AND score.valid_for_learning = 1
    WHERE h.brand_key = ? AND h.status IN ('scheduled', 'published', 'evaluated')
    ORDER BY datetime(score.updated_at) DESC LIMIT 250`).bind(brandKey).all<JsonRecord>();
  const calibrations = (predictionRows.results ?? []).map((item) => expectedRangeCalibration(
    record(parseJson(item.expected_performance_range_json, {})),
    record(parseJson(item.scores_json, {})),
    record(parseJson(item.metrics_json, {})),
  )).filter((item): item is number => item !== null);
  const learningRows = await db.prepare(`SELECT confidence_label FROM operator_manifest_learning_observations
    WHERE brand_key = ? AND active = 1 AND level <> 'exact_post' LIMIT 250`).bind(brandKey).all<JsonRecord>();
  const scoreRows = await db.prepare(`SELECT published_post_id, scores_json, updated_at
    FROM operator_post_performance_scores
    WHERE brand_key = ? AND checkpoint_hours = 24 AND valid_for_learning = 1
    ORDER BY datetime(updated_at) DESC LIMIT 100`).bind(brandKey).all<JsonRecord>();
  const authoritativeScores = (scoreRows.results ?? []).map((item) => number(record(parseJson(item.scores_json, {})).overall, Number.NaN)).filter(Number.isFinite);
  const midpoint = Math.ceil(authoritativeScores.length / 2);
  const recentScores = authoritativeScores.slice(0, midpoint);
  const previousScores = authoritativeScores.slice(midpoint);
  const portfolioRows = await db.prepare(`SELECT family_key, role, previous_role, actual_decay, allocation_weight,
      confidence_label, created_at, updated_at
    FROM operator_manifest_portfolio_states WHERE brand_key = ?`).bind(brandKey).all<JsonRecord>();
  const portfolio = portfolioRows.results ?? [];
  const experimentRows = await db.prepare(`SELECT experiment_key, status, follow_up_decision, latest_result_json
    FROM operator_manifest_experiments WHERE brand_key = ?`).bind(brandKey).all<JsonRecord>();
  const experiments = experimentRows.results ?? [];
  const newFamilyCount = portfolio.filter((item) => ["emerging", "prospect"].includes(machine(item.role))
    && (!item.previous_role || machine(item.previous_role) === "prospect")).length;
  const receipt = cycle?.id
    ? await db.prepare(`SELECT input_strategy_version_id, output_strategy_version_id
      FROM operator_manifest_cycle_receipts WHERE brand_key = ? AND cycle_id = ? LIMIT 1`).bind(brandKey, cycle.id).first<JsonRecord>()
    : null;
  const strategyChanged = Boolean(receipt?.output_strategy_version_id
    && receipt?.input_strategy_version_id !== receipt?.output_strategy_version_id);
  const metrics = buildManifestOperatorBenchmarks({
    target_slot_count: targetSlots.length,
    scheduled_slot_count: scheduledLineups.length,
    candidate_attempt_count: Math.max(evaluated.length, scheduledLineups.length + rejected.length),
    duplicate_rejection_count: duplicateCount,
    semantic_collision_count: semanticCount,
    gate_failure_count: gateFailureCount,
    semantic_signatures: signatures,
    lineage_complete_count: lineageComplete,
    lineage_total_count: scheduledLineups.length,
    prediction_calibrations: calibrations,
    confidence_labels: (learningRows.results ?? []).map((item) => text(item.confidence_label, 80)),
    authoritative_scores: authoritativeScores,
    recent_scores: recentScores,
    previous_scores: previousScores,
    portfolio_states: portfolio,
    experiments,
    new_family_count: newFamilyCount,
    strategy_changed: strategyChanged,
  });
  const sourceFingerprint = fnv1a(stableJson({ cycle_id: cycleId, metrics, event_count: events.length, score_ids: (scoreRows.results ?? []).map((item) => item.published_post_id) }));
  const snapshotKey = cycleId;
  await db.prepare(`INSERT INTO operator_manifest_benchmark_snapshots (
      id, brand_key, snapshot_key, cycle_id, benchmark_version, window_start, window_end,
      metrics_json, source_fingerprint
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(brand_key, snapshot_key) DO UPDATE SET
      cycle_id = excluded.cycle_id, benchmark_version = excluded.benchmark_version,
      window_start = excluded.window_start, window_end = excluded.window_end,
      metrics_json = excluded.metrics_json, source_fingerprint = excluded.source_fingerprint,
      updated_at = CURRENT_TIMESTAMP`).bind(
      crypto.randomUUID(), brandKey, snapshotKey, cycle?.id ?? null, MANIFEST_OPERATOR_BENCHMARK_VERSION,
      safeIso(cycle?.created_at), new Date().toISOString(), stableJson(metrics), sourceFingerprint,
    ).run();
  const previousSnapshot = await db.prepare(`SELECT cycle_id, metrics_json, source_fingerprint
    FROM operator_manifest_benchmark_snapshots
    WHERE brand_key = ? AND snapshot_key <> ?
    ORDER BY datetime(updated_at) DESC LIMIT 1`).bind(brandKey, snapshotKey).first<JsonRecord>();
  const comparison = buildManifestRunComparison({
    cycle_id: cycleId,
    previous_cycle_id: text(previousSnapshot?.cycle_id, 160) || null,
    current_metrics: metrics,
    previous_metrics: record(parseJson(previousSnapshot?.metrics_json, {})),
  });
  const comparisonFingerprint = fnv1a(stableJson({ current: sourceFingerprint, previous: previousSnapshot?.source_fingerprint ?? null, comparison }));
  if (cycle?.id) {
    await db.prepare(`INSERT INTO operator_manifest_run_comparisons (
        id, brand_key, cycle_id, previous_cycle_id, comparison_version, comparison_json, source_fingerprint
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(brand_key, cycle_id) DO UPDATE SET
        previous_cycle_id = excluded.previous_cycle_id, comparison_version = excluded.comparison_version,
        comparison_json = excluded.comparison_json, source_fingerprint = excluded.source_fingerprint,
        updated_at = CURRENT_TIMESTAMP`).bind(
        crypto.randomUUID(), brandKey, cycle.id, previousSnapshot?.cycle_id ?? null,
        MANIFEST_RUN_COMPARISON_VERSION, stableJson(comparison), comparisonFingerprint,
      ).run();
  }
  return {
    snapshot_key: snapshotKey,
    cycle_id: cycle?.id ?? null,
    source_fingerprint: sourceFingerprint,
    metrics,
    comparison,
  };
}

export function buildManifestSavedPatternIntelligence(input: {
  pattern: JsonRecord;
  signature: ManifestSemanticSignature;
  source_card?: JsonRecord | null;
  usage_rows: JsonRecord[];
  result_rows: JsonRecord[];
  similarities: JsonRecord[];
  excluded: boolean;
}): JsonRecord {
  const pattern = input.pattern;
  const likes = number(pattern.likes);
  const replies = number(pattern.replies);
  const reposts = number(pattern.reposts);
  const shares = number(pattern.shares);
  const views = number(pattern.views);
  const engagementTotal = likes + replies + reposts + shares;
  const sourceCard = record(input.source_card);
  const resultScores = input.result_rows
    .map((item) => number(record(parseJson(item.scores_json ?? item.scores, {})).overall, Number.NaN))
    .filter(Number.isFinite);
  const usageDates = input.usage_rows.map((item) => safeIso(item.selected_at ?? item.created_at)).filter((item): item is string => Boolean(item));
  const lastUsedAt = usageDates.sort().at(-1) ?? null;
  const daysSinceUse = lastUsedAt ? Math.max(0, (Date.now() - Date.parse(lastUsedAt)) / 86400000) : null;
  const resultMedian = resultScores.length ? median(resultScores) : null;
  const resultMaximum = resultScores.length ? Math.max(...resultScores) : null;
  let confidenceLabel = "qualified_source_only";
  let confidenceScore = likes >= 10000 ? 55 : likes >= 5000 ? 45 : 30;
  if (resultScores.length >= 3) {
    confidenceLabel = "reliable_adaptation_evidence";
    confidenceScore = Math.min(95, 60 + resultScores.length * 4 + Math.abs(number(resultMedian, 50) - 50) * 0.5);
  } else if (resultScores.length >= 2) {
    confidenceLabel = "directional_adaptation_evidence";
    confidenceScore = 58;
  } else if (resultScores.length === 1) {
    confidenceLabel = "emerging_adaptation_evidence";
    confidenceScore = 45;
  }
  let reuseState = "monitor";
  if (input.excluded) reuseState = "excluded";
  else if (resultScores.length >= 3 && number(resultMedian, 50) < 40) reuseState = "cooling";
  else if (resultScores.length >= 2 && number(resultMedian) >= 60) reuseState = "proven";
  else if (input.usage_rows.length === 0 || daysSinceUse === null || daysSinceUse >= 7) reuseState = "ready";
  const mechanism = text(sourceCard.source_mechanism, 2000)
    || `${input.signature.question_type}:${input.signature.financial_scenario_key}:${input.signature.tension_key}`;
  const reward = text(sourceCard.required_product, 2000) || input.signature.audience_reward_key;
  const adaptationOptions = {
    preserve: uniqueStrings([mechanism, reward], 8),
    vary: uniqueStrings([
      `premise:${input.signature.premise_key}`,
      `financial_scenario:${input.signature.financial_scenario_key}`,
      `sentence_architecture:${input.signature.sentence_architecture}`,
      `opening:${input.signature.opening_key}`,
      `closing:${input.signature.closing_key}`,
      "Use a materially different specific situation while preserving the audience reward.",
      "Change one variable per controlled experiment so results remain interpretable.",
    ], 12),
    avoid: input.similarities.slice(0, 5).map((item) => ({
      pattern_identity_key: item.pattern_identity_key,
      semantic_score: item.semantic_score,
      repeated_dimensions: item.repeated_dimensions,
    })),
    recommended_direction: text(sourceCard.recommended_direction, 1600) || null,
    transformation_contract: parseJson(sourceCard.transformation_contract_json, {}),
  };
  return {
    version: MANIFEST_SAVED_PATTERN_INTELLIGENCE_VERSION,
    verified_metrics: {
      views,
      likes,
      replies,
      reposts,
      shares,
      engagement_total: engagementTotal,
      engagement_rate: views > 0 ? engagementTotal / views : null,
      verified_like_floor_passed: likes >= 1000,
    },
    stable_identity: {
      external_pattern_id: number(pattern.id),
      post_id: text(pattern.post_id, 255) || null,
      source_url: text(pattern.source_url, 2000) || null,
      source_identity_key: text(pattern.source_identity_key, 1000),
    },
    hook: input.signature.opening_key,
    mechanism,
    reward,
    structure: input.signature.sentence_architecture,
    topic: input.signature.financial_scenario_key !== "none" ? input.signature.financial_scenario_key : input.signature.question_type,
    tension: input.signature.tension_key,
    semantic_signature: input.signature,
    adaptation_options: adaptationOptions,
    similarity: input.similarities.slice(0, 10),
    prior_uses: {
      count: input.usage_rows.length,
      source_selection_ids: uniqueStrings(input.usage_rows.map((item) => item.id), 20),
      last_used_at: lastUsedAt,
      days_since_use: daysSinceUse === null ? null : Number(daysSinceUse.toFixed(2)),
    },
    results: {
      mature_result_count: resultScores.length,
      mature_overall_scores: resultScores.slice(0, 20),
      median_overall: resultMedian,
      maximum_overall: resultMaximum,
      published_post_ids: uniqueStrings(input.result_rows.map((item) => item.published_post_id), 20),
    },
    confidence: {
      label: confidenceLabel,
      score: Number(confidenceScore.toFixed(2)),
      source_metric_evidence: true,
      adaptation_result_sample_size: resultScores.length,
    },
    reuse_state: reuseState,
    exclusion_state: input.excluded ? "excluded" : "active",
  };
}

async function refreshManifestSavedPatternIntelligence(db: D1Database, input: {
  brand_key: string;
  account_id: string;
  app_user_id: string;
}): Promise<JsonRecord> {
  const patterns = await db.prepare(`SELECT id, post_id, post_text, views, likes, replies,
      reposts, shares, source_url, posted_at, capture_confidence, updated_at
    FROM external_patterns
    WHERE app_user_id = ? AND account_id = ? AND likes >= 1000
    ORDER BY likes DESC, views DESC, updated_at DESC LIMIT 250`).bind(input.app_user_id, input.account_id).all<JsonRecord>();
    const patternRows: Array<JsonRecord & { source_identity_key: string; signature: ManifestSemanticSignature }> = (patterns.results ?? []).map((item) => {
    const postId = text(item.post_id, 255);
    const sourceUrl = text(item.source_url, 2000);
    const sourceIdentityKey = postId ? `threads:${postId}` : sourceUrl ? `url:${sourceUrl}` : `saved_pattern:${number(item.id)}`;
    const signature = buildManifestSemanticSignature({ text: text(item.post_text, 20000) });
    return { ...item, source_identity_key: sourceIdentityKey, signature };
  });
  const sourceCards = await db.prepare(`SELECT fam.source_identity_key, fam.id AS family_id,
      fam.current_source_card_id, fam.status AS family_status,
      card.source_mechanism, card.required_product, card.recommended_direction,
      card.transformation_contract_json, card.status AS source_card_status
    FROM operator_source_card_families fam
    LEFT JOIN operator_source_cards card ON card.id = fam.current_source_card_id
    WHERE fam.brand_key = ?`).bind(input.brand_key).all<JsonRecord>();
  const sourceCardByIdentity = new Map((sourceCards.results ?? []).map((item) => [text(item.source_identity_key, 1000), item]));
  const selections = await db.prepare(`SELECT id, source_identity_key, source_card_id, selected_at,
      disposition, disposition_reason
    FROM operator_source_selections WHERE brand_key = ?
    ORDER BY datetime(selected_at) DESC LIMIT 2000`).bind(input.brand_key).all<JsonRecord>();
  const usageByIdentity = new Map<string, JsonRecord[]>();
  for (const row of selections.results ?? []) {
    const key = text(row.source_identity_key, 1000);
    if (!key) continue;
    const entries = usageByIdentity.get(key) ?? [];
    entries.push(row);
    usageByIdentity.set(key, entries);
  }
  const results = await db.prepare(`SELECT h.source_identity_key, scheduled.published_post_id,
      score.scores_json, score.metrics_json, score.updated_at
    FROM operator_manifest_post_hypotheses h
    JOIN scheduled_posts scheduled ON scheduled.id = h.scheduled_post_id
    JOIN operator_post_performance_scores score ON score.brand_key = h.brand_key
      AND score.published_post_id = scheduled.published_post_id
      AND score.checkpoint_hours = 24 AND score.valid_for_learning = 1
    WHERE h.brand_key = ? AND h.source_identity_key IS NOT NULL
    ORDER BY datetime(score.updated_at) DESC LIMIT 2000`).bind(input.brand_key).all<JsonRecord>();
  const resultsByIdentity = new Map<string, JsonRecord[]>();
  for (const row of results.results ?? []) {
    const key = text(row.source_identity_key, 1000);
    if (!key) continue;
    const entries = resultsByIdentity.get(key) ?? [];
    entries.push(row);
    resultsByIdentity.set(key, entries);
  }
  const exclusions = await db.prepare(`SELECT source_identity_key FROM operator_source_exclusions
    WHERE brand_key = ? AND active = 1`).bind(input.brand_key).all<JsonRecord>();
  const excluded = new Set((exclusions.results ?? []).map((item) => text(item.source_identity_key, 1000)).filter(Boolean));
  const similarityByIdentity = new Map<string, JsonRecord[]>();
  for (let leftIndex = 0; leftIndex < patternRows.length; leftIndex += 1) {
    const left = patternRows[leftIndex];
    const matches: JsonRecord[] = [];
    for (let rightIndex = 0; rightIndex < patternRows.length; rightIndex += 1) {
      if (leftIndex === rightIndex) continue;
      const right = patternRows[rightIndex];
      const comparison = compareManifestSemanticSignatures(left.signature, right.signature);
      if (comparison.score < 0.58) continue;
      matches.push({
        pattern_identity_key: right.source_identity_key,
        external_pattern_id: number(right.id),
        semantic_score: comparison.score,
        premise_similarity: comparison.premise_similarity,
        execution_similarity: comparison.execution_similarity,
        severity: comparison.severity,
        repeated_dimensions: comparison.repeated_dimensions,
      });
    }
    matches.sort((a, b) => number(b.semantic_score) - number(a.semantic_score));
    similarityByIdentity.set(left.source_identity_key, matches.slice(0, 10));
  }
  let readyCount = 0;
  let provenCount = 0;
  let coolingCount = 0;
  let excludedCount = 0;
  for (const pattern of patternRows) {
    const intelligence = buildManifestSavedPatternIntelligence({
      pattern,
      signature: pattern.signature,
      source_card: sourceCardByIdentity.get(pattern.source_identity_key) ?? null,
      usage_rows: usageByIdentity.get(pattern.source_identity_key) ?? [],
      result_rows: resultsByIdentity.get(pattern.source_identity_key) ?? [],
      similarities: similarityByIdentity.get(pattern.source_identity_key) ?? [],
      excluded: excluded.has(pattern.source_identity_key),
    });
    const reuseState = machine(intelligence.reuse_state);
    if (reuseState === "ready") readyCount += 1;
    if (reuseState === "proven") provenCount += 1;
    if (reuseState === "cooling") coolingCount += 1;
    if (reuseState === "excluded") excludedCount += 1;
    await db.prepare(`INSERT INTO operator_manifest_saved_pattern_intelligence (
        id, brand_key, pattern_identity_key, external_pattern_id, source_identity_key,
        verified_metrics_json, semantic_json, mechanism_json, adaptation_options_json,
        similarity_json, usage_json, results_json, confidence_json, reuse_state,
        exclusion_state, source_updated_at, intelligence_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(brand_key, pattern_identity_key) DO UPDATE SET
        external_pattern_id = excluded.external_pattern_id, source_identity_key = excluded.source_identity_key,
        verified_metrics_json = excluded.verified_metrics_json, semantic_json = excluded.semantic_json,
        mechanism_json = excluded.mechanism_json, adaptation_options_json = excluded.adaptation_options_json,
        similarity_json = excluded.similarity_json, usage_json = excluded.usage_json,
        results_json = excluded.results_json, confidence_json = excluded.confidence_json,
        reuse_state = excluded.reuse_state, exclusion_state = excluded.exclusion_state,
        source_updated_at = excluded.source_updated_at, intelligence_version = excluded.intelligence_version,
        updated_at = CURRENT_TIMESTAMP`).bind(
        crypto.randomUUID(), input.brand_key, pattern.source_identity_key, number(pattern.id), pattern.source_identity_key,
        stableJson(intelligence.verified_metrics), stableJson(intelligence.semantic_signature),
        stableJson({ hook: intelligence.hook, mechanism: intelligence.mechanism, reward: intelligence.reward, structure: intelligence.structure, topic: intelligence.topic, tension: intelligence.tension }),
        stableJson(intelligence.adaptation_options), stableJson(intelligence.similarity),
        stableJson(intelligence.prior_uses), stableJson(intelligence.results), stableJson(intelligence.confidence),
        reuseState, machine(intelligence.exclusion_state), safeIso(pattern.updated_at), MANIFEST_SAVED_PATTERN_INTELLIGENCE_VERSION,
      ).run();
  }
  return {
    qualified_pattern_count: patternRows.length,
    ready_count: readyCount,
    proven_count: provenCount,
    cooling_count: coolingCount,
    excluded_count: excludedCount,
  };
}

export function buildManifestFollowerCheckpoint(input: {
  snapshots: JsonRecord[];
  follower_goal?: number;
}): JsonRecord {
  const followerGoal = Math.max(1, Math.trunc(input.follower_goal ?? MANIFEST_FOLLOWER_GOAL));
  const snapshots = input.snapshots
    .map((item) => ({
      snapshot_date: text(item.snapshot_date, 10),
      followers_count: Math.max(0, Math.trunc(number(item.followers_count))),
      captured_at: safeIso(item.captured_at),
    }))
    .filter((item) => item.snapshot_date)
    .sort((left, right) => left.snapshot_date.localeCompare(right.snapshot_date));
  const latest = snapshots.at(-1) ?? { snapshot_date: null, followers_count: 0, captured_at: null };
  const changes = snapshots.slice(1).map((item, index) => ({
    snapshot_date: item.snapshot_date,
    change: item.followers_count - snapshots[index].followers_count,
  }));
  const trailing = (days: number): number[] => changes.slice(Math.max(0, changes.length - days)).map((item) => item.change);
  const average7 = trailing(7).length ? average(trailing(7)) : null;
  const average30 = trailing(30).length ? average(trailing(30)) : null;
  const distance = Math.max(0, followerGoal - latest.followers_count);
  const velocity = average30 && average30 > 0 ? average30 : average7 && average7 > 0 ? average7 : null;
  const estimatedDays = velocity && distance > 0 ? Math.ceil(distance / velocity) : distance === 0 ? 0 : null;
  const trend = velocity === null ? "insufficient_history" : velocity > 0 ? "growing" : velocity < 0 ? "declining" : "flat";
  return {
    version: MANIFEST_FOLLOWER_CHECKPOINT_VERSION,
    account_level_only: true,
    snapshot_date: latest.snapshot_date,
    captured_at: latest.captured_at,
    followers_count: latest.followers_count,
    follower_goal: followerGoal,
    distance_to_goal: distance,
    progress_ratio: followerGoal > 0 ? latest.followers_count / followerGoal : 0,
    trajectory: {
      snapshot_count: snapshots.length,
      daily_changes: changes.slice(-30),
      average_daily_change_7d: average7,
      average_daily_change_30d: average30,
      trend,
      estimated_days_to_goal_at_observed_velocity: estimatedDays,
      projection_is_attribution: false,
    },
    attribution_policy: "Account-level checkpoint only. Never infer post, day, family, experiment, cycle, source, schedule, or posting-period follower attribution.",
  };
}

async function refreshManifestFollowerCheckpoint(db: D1Database, input: {
  brand_key: string;
  threads_user_id: string;
}): Promise<JsonRecord> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS threads_follower_snapshots (
    threads_user_id TEXT NOT NULL, snapshot_date TEXT NOT NULL, followers_count INTEGER NOT NULL DEFAULT 0,
    baseline_followers_count INTEGER, captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (threads_user_id, snapshot_date))`).run();
  const rows = await db.prepare(`SELECT snapshot_date, followers_count, baseline_followers_count, captured_at
    FROM threads_follower_snapshots WHERE threads_user_id = ?
    ORDER BY snapshot_date ASC LIMIT 365`).bind(input.threads_user_id).all<JsonRecord>();
  const checkpoint = buildManifestFollowerCheckpoint({ snapshots: rows.results ?? [] });
  const checkpointKey = text(checkpoint.snapshot_date, 10) || "no-snapshot";
  await db.prepare(`INSERT INTO operator_manifest_follower_checkpoints (
      id, brand_key, checkpoint_key, threads_user_id, checkpoint_version, snapshot_date,
      followers_count, follower_goal, distance_to_goal, trajectory_json, attribution_policy
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(brand_key, checkpoint_key) DO UPDATE SET
      threads_user_id = excluded.threads_user_id, checkpoint_version = excluded.checkpoint_version,
      snapshot_date = excluded.snapshot_date, followers_count = excluded.followers_count,
      follower_goal = excluded.follower_goal, distance_to_goal = excluded.distance_to_goal,
      trajectory_json = excluded.trajectory_json, attribution_policy = excluded.attribution_policy,
      updated_at = CURRENT_TIMESTAMP`).bind(
      crypto.randomUUID(), input.brand_key, checkpointKey, input.threads_user_id,
      MANIFEST_FOLLOWER_CHECKPOINT_VERSION, checkpoint.snapshot_date ?? null,
      number(checkpoint.followers_count), number(checkpoint.follower_goal, MANIFEST_FOLLOWER_GOAL),
      number(checkpoint.distance_to_goal), stableJson(checkpoint.trajectory), text(checkpoint.attribution_policy, 2000),
    ).run();
  return checkpoint;
}

function serializeLearningBrief(row: JsonRecord | null): JsonRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    brief_key: row.brief_key,
    brief_version: row.brief_version,
    evidence_window_start: row.evidence_window_start ?? null,
    evidence_window_end: row.evidence_window_end ?? null,
    authoritative_post_count: number(row.authoritative_post_count),
    brief: parseJson(row.brief_json, {}),
    strategy_change: parseJson(row.strategy_change_json, {}),
    strategy_version_id: row.strategy_version_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeBenchmark(row: JsonRecord): JsonRecord {
  return {
    id: row.id,
    snapshot_key: row.snapshot_key,
    cycle_id: row.cycle_id ?? null,
    benchmark_version: row.benchmark_version,
    window_start: row.window_start ?? null,
    window_end: row.window_end ?? null,
    metrics: parseJson(row.metrics_json, {}),
    source_fingerprint: row.source_fingerprint,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeRunComparison(row: JsonRecord): JsonRecord {
  return {
    id: row.id,
    cycle_id: row.cycle_id,
    previous_cycle_id: row.previous_cycle_id ?? null,
    comparison_version: row.comparison_version,
    comparison: parseJson(row.comparison_json, {}),
    source_fingerprint: row.source_fingerprint,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeSavedPattern(row: JsonRecord): JsonRecord {
  const mechanism = record(parseJson(row.mechanism_json, {}));
  return {
    pattern_identity_key: row.pattern_identity_key,
    external_pattern_id: number(row.external_pattern_id),
    source_identity_key: row.source_identity_key,
    verified_metrics: parseJson(row.verified_metrics_json, {}),
    semantic_signature: parseJson(row.semantic_json, {}),
    mechanism,
    adaptation_options: compactEvidence(row.adaptation_options_json, 10),
    similarity: array(parseJson(row.similarity_json, [])).slice(0, 10),
    prior_uses: parseJson(row.usage_json, {}),
    results: parseJson(row.results_json, {}),
    confidence: parseJson(row.confidence_json, {}),
    reuse_state: row.reuse_state,
    exclusion_state: row.exclusion_state,
    source_updated_at: row.source_updated_at ?? null,
    updated_at: row.updated_at,
  };
}

function serializeFollowerCheckpoint(row: JsonRecord | null): JsonRecord | null {
  if (!row) return null;
  return {
    checkpoint_key: row.checkpoint_key,
    checkpoint_version: row.checkpoint_version,
    snapshot_date: row.snapshot_date ?? null,
    followers_count: number(row.followers_count),
    follower_goal: number(row.follower_goal, MANIFEST_FOLLOWER_GOAL),
    distance_to_goal: number(row.distance_to_goal),
    trajectory: parseJson(row.trajectory_json, {}),
    account_level_only: true,
    attribution_policy: row.attribution_policy,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function refreshManifestMeasurementAudit(db: D1Database, input: {
  brand_key: string;
  threads_user_id: string;
  account_id: string;
  saved_patterns_app_user_id: string;
  cycle_id?: string | null;
}): Promise<JsonRecord> {
  await ensureManifestMeasurementAuditTables(db);
  const savedPatterns = await refreshManifestSavedPatternIntelligence(db, {
    brand_key: input.brand_key,
    account_id: input.account_id,
    app_user_id: input.saved_patterns_app_user_id,
  });
  const followerCheckpoint = await refreshManifestFollowerCheckpoint(db, {
    brand_key: input.brand_key,
    threads_user_id: input.threads_user_id,
  });
  const learningBrief = await refreshManifestLearningBrief(db, input.brand_key);
  const benchmarks = await refreshManifestBenchmarks(db, input.brand_key, input.cycle_id ?? null);
  return {
    version: MANIFEST_MEASUREMENT_AUDIT_VERSION,
    learning_brief: {
      brief_key: learningBrief.brief_key,
      authoritative_post_count: learningBrief.authoritative_post_count,
      strategy_change_warranted: learningBrief.strategy_change_warranted,
      strategy_version_id: learningBrief.strategy_version_id,
    },
    benchmarks: {
      snapshot_key: benchmarks.snapshot_key,
      cycle_id: benchmarks.cycle_id,
      source_fingerprint: benchmarks.source_fingerprint,
    },
    run_comparison: benchmarks.comparison,
    saved_patterns: savedPatterns,
    follower_checkpoint: {
      snapshot_date: followerCheckpoint.snapshot_date,
      followers_count: followerCheckpoint.followers_count,
      distance_to_goal: followerCheckpoint.distance_to_goal,
      account_level_only: true,
    },
  };
}

async function manifestAuditSummary(db: D1Database, brandKey: string): Promise<JsonRecord> {
  await ensureManifestMeasurementAuditTables(db);
  const [brief, benchmarkRow, comparisonRow, followerRow, latestStrategy, savedCounts, transitionCount, authoritativeCount] = await Promise.all([
    db.prepare(`SELECT * FROM operator_manifest_learning_briefs WHERE brand_key = ?
      ORDER BY datetime(updated_at) DESC LIMIT 1`).bind(brandKey).first<JsonRecord>(),
    db.prepare(`SELECT * FROM operator_manifest_benchmark_snapshots WHERE brand_key = ?
      ORDER BY datetime(updated_at) DESC LIMIT 1`).bind(brandKey).first<JsonRecord>(),
    db.prepare(`SELECT * FROM operator_manifest_run_comparisons WHERE brand_key = ?
      ORDER BY datetime(updated_at) DESC LIMIT 1`).bind(brandKey).first<JsonRecord>(),
    db.prepare(`SELECT * FROM operator_manifest_follower_checkpoints WHERE brand_key = ?
      ORDER BY datetime(updated_at) DESC LIMIT 1`).bind(brandKey).first<JsonRecord>(),
    getLatestManifestStrategyVersion(db, brandKey),
    db.prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN reuse_state = 'ready' THEN 1 ELSE 0 END) AS ready,
        SUM(CASE WHEN reuse_state = 'proven' THEN 1 ELSE 0 END) AS proven,
        SUM(CASE WHEN reuse_state = 'cooling' THEN 1 ELSE 0 END) AS cooling,
        SUM(CASE WHEN reuse_state = 'excluded' THEN 1 ELSE 0 END) AS excluded
      FROM operator_manifest_saved_pattern_intelligence WHERE brand_key = ?`).bind(brandKey).first<JsonRecord>(),
    db.prepare(`SELECT COUNT(*) AS total FROM operator_manifest_state_transitions WHERE brand_key = ?`).bind(brandKey).first<JsonRecord>(),
    db.prepare(`SELECT COUNT(DISTINCT published_post_id) AS total
      FROM operator_manifest_maturity_evaluations
      WHERE brand_key = ? AND checkpoint_hours = 24 AND structural_change_allowed = 1`).bind(brandKey).first<JsonRecord>(),
  ]);
  const latestBenchmark = benchmarkRow ? serializeBenchmark(benchmarkRow) : null;
  const predictionMetric = record(record(latestBenchmark?.metrics).prediction_accuracy);
  const follower = serializeFollowerCheckpoint(followerRow);
  const capabilityGaps = [
    number(authoritativeCount?.total) === 0 ? "No authoritative 24-hour post evidence exists yet." : null,
    !comparisonRow ? "No prior cycle benchmark exists yet, so run-to-run comparison is not available." : null,
    number(savedCounts?.total) === 0 ? "No qualified Saved Patterns are available for enriched intelligence." : null,
    number(predictionMetric.sample_size) === 0 ? "No hypotheses with machine-readable expected ranges have mature outcomes for prediction calibration." : null,
    !follower || number(record(follower.trajectory).snapshot_count) < 2 ? "Follower history has fewer than two account-level checkpoints, so velocity remains uncertain." : null,
  ].filter(Boolean);
  return {
    version: MANIFEST_AUDIT_READ_VERSION,
    brand_key: brandKey,
    latest_strategy: latestStrategy ? {
      id: latestStrategy.id,
      version: latestStrategy.version,
      parent_version_id: latestStrategy.parent_version_id ?? null,
      change_summary: latestStrategy.change_summary ?? null,
      strategy: latestStrategy.strategy,
      evidence: compactEvidence(latestStrategy.evidence, 10),
      reversal_conditions: latestStrategy.reversal_conditions,
      source_cycle_id: latestStrategy.source_cycle_id ?? null,
      created_at: latestStrategy.created_at,
    } : null,
    learning_brief: serializeLearningBrief(brief),
    latest_benchmark: latestBenchmark,
    latest_run_comparison: comparisonRow ? serializeRunComparison(comparisonRow) : null,
    saved_pattern_inventory: {
      total: number(savedCounts?.total),
      ready: number(savedCounts?.ready),
      proven: number(savedCounts?.proven),
      cooling: number(savedCounts?.cooling),
      excluded: number(savedCounts?.excluded),
    },
    follower_checkpoint: follower,
    transition_count: number(transitionCount?.total),
    authoritative_post_count: number(authoritativeCount?.total),
    capability_status: {
      automatic_learning_brief: Boolean(brief),
      operator_benchmarks: Boolean(benchmarkRow),
      run_to_run_comparison: Boolean(comparisonRow),
      conversational_audit: true,
      saved_pattern_intelligence: number(savedCounts?.total) > 0,
      account_level_follower_checkpoint: Boolean(followerRow),
    },
    capability_gaps: capabilityGaps,
    owner_dependency: false,
    noninterference_preserved: true,
  };
}

function auditPagination(total: number, offset: number, limit: number): JsonRecord {
  return {
    total,
    offset,
    limit,
    returned: Math.max(0, Math.min(limit, total - offset)),
    has_more: offset + limit < total,
    next_offset: offset + limit < total ? offset + limit : null,
  };
}

export async function buildManifestMeasurementAuditRead(db: D1Database, input: {
  brand_key: string;
  section?: ManifestAuditSection | null;
  offset?: number;
  limit?: number;
}): Promise<JsonRecord> {
  await ensureManifestMeasurementAuditTables(db);
  const section = input.section ?? "summary";
  const offset = Math.max(0, Math.trunc(input.offset ?? 0));
  const limit = Math.max(1, Math.min(50, Math.trunc(input.limit ?? 20)));
  const summary = await manifestAuditSummary(db, input.brand_key);
  if (section === "summary") return { summary, section, pagination: auditPagination(1, 0, 1), records: [summary] };
  if (section === "learning_brief") {
    const row = await db.prepare(`SELECT * FROM operator_manifest_learning_briefs WHERE brand_key = ?
      ORDER BY datetime(updated_at) DESC LIMIT 1`).bind(input.brand_key).first<JsonRecord>();
    return { summary, section, pagination: auditPagination(row ? 1 : 0, 0, 1), records: row ? [serializeLearningBrief(row)] : [] };
  }
  if (section === "follower_checkpoint") {
    const row = await db.prepare(`SELECT * FROM operator_manifest_follower_checkpoints WHERE brand_key = ?
      ORDER BY datetime(updated_at) DESC LIMIT 1`).bind(input.brand_key).first<JsonRecord>();
    return { summary, section, pagination: auditPagination(row ? 1 : 0, 0, 1), records: row ? [serializeFollowerCheckpoint(row)] : [] };
  }
  if (section === "capability_gaps") {
    const gaps = array(summary.capability_gaps);
    return { summary, section, pagination: auditPagination(gaps.length, 0, Math.max(1, gaps.length)), records: gaps };
  }
  if (section === "benchmarks") {
    const totalRow = await db.prepare(`SELECT COUNT(*) AS total FROM operator_manifest_benchmark_snapshots WHERE brand_key = ?`).bind(input.brand_key).first<JsonRecord>();
    const rows = await db.prepare(`SELECT * FROM operator_manifest_benchmark_snapshots WHERE brand_key = ?
      ORDER BY datetime(updated_at) DESC LIMIT ? OFFSET ?`).bind(input.brand_key, limit, offset).all<JsonRecord>();
    const total = number(totalRow?.total);
    return { summary, section, pagination: auditPagination(total, offset, limit), records: (rows.results ?? []).map(serializeBenchmark) };
  }
  if (section === "run_comparisons") {
    const totalRow = await db.prepare(`SELECT COUNT(*) AS total FROM operator_manifest_run_comparisons WHERE brand_key = ?`).bind(input.brand_key).first<JsonRecord>();
    const rows = await db.prepare(`SELECT * FROM operator_manifest_run_comparisons WHERE brand_key = ?
      ORDER BY datetime(updated_at) DESC LIMIT ? OFFSET ?`).bind(input.brand_key, limit, offset).all<JsonRecord>();
    const total = number(totalRow?.total);
    return { summary, section, pagination: auditPagination(total, offset, limit), records: (rows.results ?? []).map(serializeRunComparison) };
  }
  if (section === "saved_patterns") {
    const totalRow = await db.prepare(`SELECT COUNT(*) AS total FROM operator_manifest_saved_pattern_intelligence WHERE brand_key = ?`).bind(input.brand_key).first<JsonRecord>();
    const rows = await db.prepare(`SELECT * FROM operator_manifest_saved_pattern_intelligence WHERE brand_key = ?
      ORDER BY CASE reuse_state WHEN 'proven' THEN 1 WHEN 'ready' THEN 2 WHEN 'monitor' THEN 3 WHEN 'cooling' THEN 4 ELSE 5 END,
        datetime(updated_at) DESC LIMIT ? OFFSET ?`).bind(input.brand_key, limit, offset).all<JsonRecord>();
    const total = number(totalRow?.total);
    return { summary, section, pagination: auditPagination(total, offset, limit), records: (rows.results ?? []).map(serializeSavedPattern) };
  }
  if (section === "strategy_transitions") {
    const totalRow = await db.prepare(`SELECT COUNT(*) AS total FROM operator_manifest_state_transitions WHERE brand_key = ?`).bind(input.brand_key).first<JsonRecord>();
    const rows = await db.prepare(`SELECT entity_type, entity_id, from_state, to_state, reason,
        evidence_json, transitioned_at
      FROM operator_manifest_state_transitions WHERE brand_key = ?
      ORDER BY datetime(transitioned_at) DESC LIMIT ? OFFSET ?`).bind(input.brand_key, limit, offset).all<JsonRecord>();
    const total = number(totalRow?.total);
    return {
      summary, section, pagination: auditPagination(total, offset, limit),
      records: (rows.results ?? []).map((row) => ({ ...row, evidence: compactEvidence(row.evidence_json, 10) })),
    };
  }
  if (section === "portfolio") {
    const totalRow = await db.prepare(`SELECT COUNT(*) AS total FROM operator_manifest_portfolio_states WHERE brand_key = ?`).bind(input.brand_key).first<JsonRecord>();
    const rows = await db.prepare(`SELECT family_key, role, recommended_role, previous_role,
        confidence_score, confidence_label, allocation_weight, actual_decay, reason, evidence_json, updated_at
      FROM operator_manifest_portfolio_states WHERE brand_key = ?
      ORDER BY allocation_weight DESC, confidence_score DESC LIMIT ? OFFSET ?`).bind(input.brand_key, limit, offset).all<JsonRecord>();
    const total = number(totalRow?.total);
    return {
      summary, section, pagination: auditPagination(total, offset, limit),
      records: (rows.results ?? []).map((row) => ({ ...row, actual_decay: number(row.actual_decay) === 1, evidence: compactEvidence(row.evidence_json, 10) })),
    };
  }
  const totalRow = await db.prepare(`SELECT COUNT(*) AS total FROM operator_manifest_experiments WHERE brand_key = ?`).bind(input.brand_key).first<JsonRecord>();
  const rows = await db.prepare(`SELECT experiment_key, family_key, hypothesis_json, comparison_group_json,
      maturity_windows_json, result_criteria_json, status, latest_result_json,
      follow_up_decision, updated_at
    FROM operator_manifest_experiments WHERE brand_key = ?
    ORDER BY datetime(updated_at) DESC LIMIT ? OFFSET ?`).bind(input.brand_key, limit, offset).all<JsonRecord>();
  const total = number(totalRow?.total);
  return {
    summary, section: "experiments", pagination: auditPagination(total, offset, limit),
    records: (rows.results ?? []).map((row) => ({
      experiment_key: row.experiment_key,
      family_key: row.family_key ?? null,
      hypothesis: parseJson(row.hypothesis_json, {}),
      comparison_group: parseJson(row.comparison_group_json, {}),
      maturity_windows: parseJson(row.maturity_windows_json, []),
      result_criteria: parseJson(row.result_criteria_json, {}),
      status: row.status,
      latest_result: parseJson(row.latest_result_json, {}),
      follow_up_decision: row.follow_up_decision ?? null,
      updated_at: row.updated_at,
    })),
  };
}
