import { getLatestManifestStrategyVersion } from "./manifestIntelligence";
import { getManifestIntelligenceEngineState } from "./manifestIntelligenceEngine";
import {
  buildManifestMeasurementAuditRead,
  ensureManifestMeasurementAuditTables,
} from "./manifestMeasurementAudit";

type JsonRecord = Record<string, unknown>;

export const MANIFEST_PRODUCT_INTEGRATION_VERSION = "manifest-product-integration-v1";
export const MANIFEST_DECISION_INTELLIGENCE_VERSION = "manifest-decision-intelligence-v1";
export const MANIFEST_DECISION_INFLUENCE_VERSION = "manifest-decision-influence-v1";
export const MANIFEST_INTELLIGENCE_DASHBOARD_VERSION = "manifest-intelligence-dashboard-v1";

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function machine(value: unknown, fallback = "none"): string {
  const normalized = text(value, 400)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as JsonRecord).sort().map((key) => `${JSON.stringify(key)}:${stable((value as JsonRecord)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function compact(value: unknown, maxArray = 12): unknown {
  if (Array.isArray(value)) return value.slice(0, maxArray).map((item) => compact(item, maxArray));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as JsonRecord).map(([key, item]) => [key, compact(item, maxArray)]));
}

function stableEvidence(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableEvidence);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .filter(([key]) => key !== "generated_at" && key !== "created_at" && key !== "updated_at")
      .map(([key, item]) => [key, stableEvidence(item)]),
  );
}


function uniqueStrings(values: unknown[], limit = 20): string[] {
  return Array.from(new Set(values.map((value) => text(value, 1000)).filter(Boolean))).slice(0, limit);
}

export async function ensureManifestProductIntegrationTables(db: D1Database): Promise<void> {
  await ensureManifestMeasurementAuditTables(db);
  await db.prepare(`CREATE TABLE IF NOT EXISTS operator_manifest_decision_influences (
    id TEXT PRIMARY KEY,
    influence_key TEXT NOT NULL UNIQUE,
    brand_key TEXT NOT NULL,
    cycle_id TEXT,
    slot_key TEXT,
    scheduled_post_id INTEGER,
    hypothesis_id TEXT,
    strategy_version_id TEXT,
    learning_brief_key TEXT,
    benchmark_snapshot_key TEXT,
    family_key TEXT,
    portfolio_role TEXT,
    experiment_key TEXT,
    saved_pattern_identity_key TEXT,
    decision_changed INTEGER NOT NULL DEFAULT 0,
    decision_change_types_json TEXT NOT NULL DEFAULT '[]',
    decision_summary TEXT NOT NULL,
    evidence_json TEXT NOT NULL DEFAULT '{}',
    influence_version TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(brand_key, cycle_id, slot_key)
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_manifest_decision_influences_brand_created
    ON operator_manifest_decision_influences(brand_key, created_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_manifest_decision_influences_scheduled
    ON operator_manifest_decision_influences(brand_key, scheduled_post_id)`).run();
}

function serializeStrategy(strategy: JsonRecord | null): JsonRecord | null {
  if (!strategy) return null;
  return {
    id: strategy.id ?? null,
    version: strategy.version ?? null,
    parent_version_id: strategy.parent_version_id ?? null,
    strategy: compact(strategy.strategy ?? {}, 3),
    change_summary: strategy.change_summary ?? null,
    reversal_conditions: array(strategy.reversal_conditions).slice(0, 4),
    source_cycle_id: strategy.source_cycle_id ?? null,
  };
}

function serializeLearningBrief(row: JsonRecord | null): JsonRecord | null {
  if (!row) return null;
  const brief = record(parseJson(row.brief_json, {}));
  const strategyChange = record(parseJson(row.strategy_change_json, brief.strategy_change ?? {}));
  return {
    brief_key: row.brief_key,
    brief_version: row.brief_version,
    authoritative_post_count: number(row.authoritative_post_count),
    brief: {
      improvements: array(brief.improvements).slice(0, 4),
      weakening: array(brief.weakening).slice(0, 4),
      uncertainty: array(brief.uncertainty).slice(0, 4),
      family_opportunities: array(brief.family_opportunities).slice(0, 4),
      fatigue: array(brief.fatigue).slice(0, 4),
      disproven_assumptions: array(brief.disproven_assumptions).slice(0, 4),
      experiment_decisions: array(brief.experiment_decisions).slice(0, 4),
      next_run_tests: array(brief.next_run_tests).slice(0, 6),
    },
    strategy_change: {
      warranted: strategyChange.warranted === true,
      reason: strategyChange.reason ?? null,
      directives: array(strategyChange.directives).slice(0, 8),
    },
    strategy_version_id: row.strategy_version_id ?? null,
  };
}

function serializeBenchmark(row: JsonRecord | null): JsonRecord | null {
  if (!row) return null;
  const metrics = record(parseJson(row.metrics_json, {}));
  return {
    snapshot_key: row.snapshot_key,
    cycle_id: row.cycle_id ?? null,
    metrics: {
      completion: metrics.completion ?? {},
      candidate_efficiency: metrics.candidate_efficiency ?? {},
      repeated_mistakes: metrics.repeated_mistakes ?? {},
      prediction_accuracy: metrics.prediction_accuracy ?? {},
      engagement_floor: metrics.engagement_floor ?? {},
      mature_performance: metrics.mature_performance ?? {},
      strategy_influence: metrics.strategy_influence ?? {},
    },
    source_fingerprint: row.source_fingerprint,
  };
}

function serializeRunComparison(row: JsonRecord | null): JsonRecord | null {
  if (!row) return null;
  const comparison = record(parseJson(row.comparison_json, {}));
  const dimensions = record(comparison.dimensions);
  return {
    cycle_id: row.cycle_id,
    previous_cycle_id: row.previous_cycle_id ?? null,
    comparison: {
      comparable: comparison.comparable === true,
      repeated_mistakes: array(comparison.repeated_mistakes).slice(0, 8),
      actual_strategy_influence: comparison.actual_strategy_influence === true,
      dimension_status: Object.fromEntries(Object.entries(dimensions).map(([key, value]) => [key, record(value).status ?? null])),
    },
    source_fingerprint: row.source_fingerprint,
  };
}


export async function buildManifestDecisionIntelligence(db: D1Database, brandKey: string): Promise<JsonRecord> {
  await ensureManifestProductIntegrationTables(db);
  const [strategy, briefRow, benchmarkRow, comparisonRow, followerRow, portfolioRows, experimentRows, savedRows, semanticRows] = await Promise.all([
    getLatestManifestStrategyVersion(db, brandKey),
    db.prepare(`SELECT * FROM operator_manifest_learning_briefs WHERE brand_key = ?
      ORDER BY datetime(updated_at) DESC LIMIT 1`).bind(brandKey).first<JsonRecord>(),
    db.prepare(`SELECT * FROM operator_manifest_benchmark_snapshots WHERE brand_key = ?
      ORDER BY datetime(updated_at) DESC LIMIT 1`).bind(brandKey).first<JsonRecord>(),
    db.prepare(`SELECT * FROM operator_manifest_run_comparisons WHERE brand_key = ?
      ORDER BY datetime(updated_at) DESC LIMIT 1`).bind(brandKey).first<JsonRecord>(),
    db.prepare(`SELECT * FROM operator_manifest_follower_checkpoints WHERE brand_key = ?
      ORDER BY datetime(updated_at) DESC LIMIT 1`).bind(brandKey).first<JsonRecord>(),
    db.prepare(`SELECT family_key, role, recommended_role, previous_role, confidence_score,
        confidence_label, allocation_weight, actual_decay, reason, evidence_json, updated_at
      FROM operator_manifest_portfolio_states WHERE brand_key = ?
            ORDER BY allocation_weight DESC, confidence_score DESC LIMIT 10`).bind(brandKey).all<JsonRecord>(),
    db.prepare(`SELECT id, experiment_key, family_key, status, follow_up_decision,
        hypothesis_json, comparison_group_json, latest_result_json, updated_at
      FROM operator_manifest_experiments WHERE brand_key = ?
            ORDER BY datetime(updated_at) DESC LIMIT 8`).bind(brandKey).all<JsonRecord>(),
    db.prepare(`SELECT pattern_identity_key, source_identity_key, mechanism_json,
        adaptation_options_json, confidence_json, reuse_state, results_json, updated_at
      FROM operator_manifest_saved_pattern_intelligence WHERE brand_key = ?
        AND exclusion_state = 'active'
      ORDER BY CASE reuse_state WHEN 'proven' THEN 1 WHEN 'ready' THEN 2 WHEN 'monitor' THEN 3 ELSE 4 END,
                datetime(updated_at) DESC LIMIT 8`).bind(brandKey).all<JsonRecord>(),
    db.prepare(`SELECT signature_json, observed_at FROM operator_manifest_semantic_signatures
            WHERE brand_key = ? ORDER BY datetime(observed_at) DESC LIMIT 24`).bind(brandKey).all<JsonRecord>(),
  ]);
  const learningBrief = serializeLearningBrief(briefRow);
  const benchmark = serializeBenchmark(benchmarkRow);
  const runComparison = serializeRunComparison(comparisonRow);
  const briefPayload = record(learningBrief?.brief);
  const strategyChange = record(learningBrief?.strategy_change ?? briefPayload.strategy_change);
  const directives = uniqueStrings([
    ...array(strategyChange.directives),
    ...array(briefPayload.next_run_tests),
  ], 24);
  const familyPriorities = (portfolioRows.results ?? []).map((row) => ({
    family_key: row.family_key,
    role: row.role,
    recommended_role: row.recommended_role,
    previous_role: row.previous_role ?? null,
    confidence_score: number(row.confidence_score),
    confidence_label: row.confidence_label,
    allocation_weight: number(row.allocation_weight, 1),
    actual_decay: number(row.actual_decay) === 1,
        reason: row.reason ?? null,
    updated_at: row.updated_at ?? null,
  }));
  const experiments = (experimentRows.results ?? []).map((row) => ({
    id: row.id,
    experiment_key: row.experiment_key,
    family_key: row.family_key ?? null,
    status: row.status,
    follow_up_decision: row.follow_up_decision ?? null,
        hypothesis: compact(parseJson(row.hypothesis_json, {}), 4),
    comparison_group: compact(parseJson(row.comparison_group_json, {}), 4),
    latest_result: compact(parseJson(row.latest_result_json, {}), 4),
    updated_at: row.updated_at ?? null,
  }));
  const savedPatterns = (savedRows.results ?? []).map((row) => ({
    pattern_identity_key: row.pattern_identity_key,
    source_identity_key: row.source_identity_key,
        mechanism: compact(parseJson(row.mechanism_json, {}), 4),
    adaptation_options: compact(parseJson(row.adaptation_options_json, {}), 4),
    confidence: compact(parseJson(row.confidence_json, {}), 4),
    reuse_state: row.reuse_state,
    results: compact(parseJson(row.results_json, {}), 4),
    updated_at: row.updated_at ?? null,
  }));
  const premiseCounts = new Map<string, number>();
  const architectureCounts = new Map<string, number>();
  const scenarioCounts = new Map<string, number>();
  for (const row of semanticRows.results ?? []) {
    const signature = record(parseJson(row.signature_json, {}));
    for (const [target, key] of [
      [premiseCounts, machine(signature.premise_key)],
      [architectureCounts, machine(signature.sentence_architecture)],
      [scenarioCounts, machine(signature.financial_scenario_key)],
    ] as Array<[Map<string, number>, string]>) {
      if (key !== "none") target.set(key, (target.get(key) ?? 0) + 1);
    }
  }
  const repetition = {
    premise_clusters: Array.from(premiseCounts.entries()).map(([key, count]) => ({ key, count })).sort((left, right) => right.count - left.count).slice(0, 12),
    architecture_clusters: Array.from(architectureCounts.entries()).map(([key, count]) => ({ key, count })).sort((left, right) => right.count - left.count).slice(0, 12),
    scenario_clusters: Array.from(scenarioCounts.entries()).map(([key, count]) => ({ key, count })).sort((left, right) => right.count - left.count).slice(0, 12),
    recent_signature_count: (semanticRows.results ?? []).length,
  };
  const follower = followerRow ? {
    snapshot_date: followerRow.snapshot_date ?? null,
    followers_count: number(followerRow.followers_count),
    follower_goal: number(followerRow.follower_goal, 1_000_000),
    distance_to_goal: number(followerRow.distance_to_goal),
    trajectory: compact(parseJson(followerRow.trajectory_json, {}), 30),
    account_level_only: true,
    attribution_policy: followerRow.attribution_policy,
  } : null;
  const strategyChangeWarranted = strategyChange.warranted === true;
  const comparisonPayload = record(runComparison?.comparison);
  const benchmarkPayload = record(benchmark?.metrics);
  const decisionIntelligence = {
    version: MANIFEST_DECISION_INTELLIGENCE_VERSION,
    generated_at: new Date().toISOString(),
    brand_key: brandKey,
    latest_strategy: serializeStrategy(strategy),
    learning_brief: learningBrief,
    required_directives: directives,
    strategy_change_warranted: strategyChangeWarranted,
    family_priorities: familyPriorities,
    experiments,
    saved_pattern_candidates: savedPatterns,
    repetition,
    benchmark_response: {
      latest: benchmark,
      latest_run_comparison: runComparison,
      repeated_mistakes: array(comparisonPayload.repeated_mistakes).slice(0, 20),
      actual_strategy_influence: comparisonPayload.actual_strategy_influence === true,
      prediction_accuracy: record(benchmarkPayload.prediction_accuracy),
      engagement_floor: record(benchmarkPayload.engagement_floor),
      mature_performance: record(benchmarkPayload.mature_performance),
    },
    follower_checkpoint: follower,
    consumption_contract: {
      required: true,
      inputs_that_must_be_considered: [
        "latest_strategy",
        "learning_brief",
        "required_directives",
        "family_priorities",
        "experiments",
        "saved_pattern_candidates",
        "repetition",
        "benchmark_response",
        "follower_checkpoint",
      ],
      required_decision_outputs: [
        "family selection",
        "generation mode",
        "source or hypothesis selection",
        "premise and audience reward",
        "slot placement",
        "experiment assignment when warranted",
        "novelty and repetition response",
        "strategy change or explicit evidence-based preservation",
      ],
      follower_boundary: "Follower data may affect account-level urgency only and must never be attributed to a post, family, experiment, cycle, day, or posting period.",
      proof_requirement: "Each persisted post receives a server-derived decision-influence receipt linking the chosen move to the exact strategy, learning brief, benchmark, portfolio, experiment, Saved Pattern, and repetition evidence available at preparation time.",
    },
  };
  return {
    ...decisionIntelligence,
        source_fingerprint: fnv1a(stable(stableEvidence(decisionIntelligence))),
  };
}

export async function recordManifestDecisionInfluence(db: D1Database, input: {
  brand_key: string;
  cycle_id: string;
  slot_key: string;
  scheduled_post_id: number;
  hypothesis_id?: string | null;
  input_strategy_version_id?: string | null;
  output_strategy_version_id?: string | null;
  family_key: string;
  generation_mode: string;
  source_context?: JsonRecord | null;
  strategic_thesis?: JsonRecord | null;
  model_evaluation?: JsonRecord | null;
  semantic_repetition?: JsonRecord | null;
  experiment_assignment?: JsonRecord | null;
}): Promise<JsonRecord> {
  await ensureManifestProductIntegrationTables(db);
  const intelligence = await buildManifestDecisionIntelligence(db, input.brand_key);
  const learningBrief = record(intelligence.learning_brief);
  const learningBriefKey = text(learningBrief.brief_key, 200) || null;
  const benchmark = record(record(intelligence.benchmark_response).latest);
  const benchmarkSnapshotKey = text(benchmark.snapshot_key, 200) || null;
  const familyKey = machine(input.family_key);
  const selectedPortfolio = array(intelligence.family_priorities)
    .map(record)
    .find((item) => machine(item.family_key) === familyKey) ?? null;
  const experiment = record(input.experiment_assignment);
  const sourceContext = record(input.source_context);
  const strategicThesis = record(input.strategic_thesis);
  const modelEvaluation = record(input.model_evaluation);
  const semantic = record(input.semantic_repetition);
  const changeTypes: string[] = [];
  const evidence: JsonRecord = {
    decision_intelligence_version: intelligence.version,
    decision_intelligence_fingerprint: intelligence.source_fingerprint,
    input_strategy_version_id: input.input_strategy_version_id ?? null,
    output_strategy_version_id: input.output_strategy_version_id ?? null,
    learning_brief_key: learningBriefKey,
    benchmark_snapshot_key: benchmarkSnapshotKey,
    selected_family: familyKey,
    selected_generation_mode: machine(input.generation_mode),
    selected_portfolio: selectedPortfolio,
    experiment_assignment: compact(experiment, 10),
    source_context: compact(sourceContext, 10),
    semantic_repetition: compact(semantic, 10),
    strategic_thesis_change_summary: strategicThesis.change_summary ?? null,
    intelligence_application_assessment: modelEvaluation.intelligence_application_assessment ?? null,
  };
  if (input.output_strategy_version_id && input.output_strategy_version_id !== input.input_strategy_version_id) {
    changeTypes.push("strategy_version_changed");
  }
  if (record(learningBrief.strategy_change).warranted === true || intelligence.strategy_change_warranted === true) {
    changeTypes.push("learning_brief_directive_applied");
  }
  if (selectedPortfolio && (number(selectedPortfolio.allocation_weight, 1) !== 1
    || ["franchise", "core", "emerging", "cooling", "dormant"].includes(machine(selectedPortfolio.role)))) {
    changeTypes.push("portfolio_allocation_applied");
  }
  if (text(experiment.experiment_key, 200)) changeTypes.push("controlled_experiment_applied");
  const savedPatternIdentity = text(sourceContext.pattern_identity_key ?? sourceContext.saved_pattern_identity_key, 300) || null;
  if (savedPatternIdentity || machine(sourceContext.kind) === "saved_pattern") changeTypes.push("saved_pattern_intelligence_applied");
  const highestSemanticScore = number(semantic.highest_score ?? record(semantic.collision).score);
  if (highestSemanticScore >= 0.45
    || text(modelEvaluation.novelty_assessment, 4000)
    || text(modelEvaluation.recent_exposure_assessment, 4000)) {
    changeTypes.push("repetition_evidence_applied");
  }
  const repeatedMistakes = array(record(intelligence.benchmark_response).repeated_mistakes);
  if (repeatedMistakes.length && (strategicThesis.benchmark_response || modelEvaluation.intelligence_application_assessment)) {
    changeTypes.push("benchmark_weakness_response_applied");
  }
  const uniqueChangeTypes = uniqueStrings(changeTypes, 20);
  const decisionChanged = uniqueChangeTypes.length > 0;
  const decisionSummary = decisionChanged
    ? `Learned intelligence changed or constrained this move through ${uniqueChangeTypes.join(", ")}.`
    : "No mature learned directive changed this move; the current strategy was preserved under insufficient or noncontradictory evidence.";
  const influenceKey = fnv1a(stable({
    brand_key: input.brand_key,
    cycle_id: input.cycle_id,
    slot_key: input.slot_key,
    scheduled_post_id: input.scheduled_post_id,
    decision_change_types: uniqueChangeTypes,
    evidence,
  }));
  await db.prepare(`INSERT INTO operator_manifest_decision_influences (
      id, influence_key, brand_key, cycle_id, slot_key, scheduled_post_id, hypothesis_id,
      strategy_version_id, learning_brief_key, benchmark_snapshot_key, family_key,
      portfolio_role, experiment_key, saved_pattern_identity_key, decision_changed,
      decision_change_types_json, decision_summary, evidence_json, influence_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(brand_key, cycle_id, slot_key) DO UPDATE SET
      influence_key = excluded.influence_key,
      scheduled_post_id = excluded.scheduled_post_id,
      hypothesis_id = excluded.hypothesis_id,
      strategy_version_id = excluded.strategy_version_id,
      learning_brief_key = excluded.learning_brief_key,
      benchmark_snapshot_key = excluded.benchmark_snapshot_key,
      family_key = excluded.family_key,
      portfolio_role = excluded.portfolio_role,
      experiment_key = excluded.experiment_key,
      saved_pattern_identity_key = excluded.saved_pattern_identity_key,
      decision_changed = excluded.decision_changed,
      decision_change_types_json = excluded.decision_change_types_json,
      decision_summary = excluded.decision_summary,
      evidence_json = excluded.evidence_json,
      influence_version = excluded.influence_version,
      updated_at = CURRENT_TIMESTAMP`).bind(
      crypto.randomUUID(),
      influenceKey,
      input.brand_key,
      input.cycle_id,
      input.slot_key,
      input.scheduled_post_id,
      input.hypothesis_id ?? null,
      input.output_strategy_version_id ?? input.input_strategy_version_id ?? null,
      learningBriefKey,
      benchmarkSnapshotKey,
      familyKey,
      selectedPortfolio?.role ?? null,
      text(experiment.experiment_key, 200) || null,
      savedPatternIdentity,
      decisionChanged ? 1 : 0,
      stable(uniqueChangeTypes),
      decisionSummary,
      stable(evidence),
      MANIFEST_DECISION_INFLUENCE_VERSION,
    ).run();
  return {
    version: MANIFEST_DECISION_INFLUENCE_VERSION,
    influence_key: influenceKey,
    brand_key: input.brand_key,
    cycle_id: input.cycle_id,
    slot_key: input.slot_key,
    scheduled_post_id: input.scheduled_post_id,
    hypothesis_id: input.hypothesis_id ?? null,
    strategy_version_id: input.output_strategy_version_id ?? input.input_strategy_version_id ?? null,
    learning_brief_key: learningBriefKey,
    benchmark_snapshot_key: benchmarkSnapshotKey,
    family_key: familyKey,
    portfolio_role: selectedPortfolio?.role ?? null,
    experiment_key: text(experiment.experiment_key, 200) || null,
    saved_pattern_identity_key: savedPatternIdentity,
    decision_changed: decisionChanged,
    decision_change_types: uniqueChangeTypes,
    decision_summary: decisionSummary,
    evidence,
  };
}

function serializeInfluence(row: JsonRecord): JsonRecord {
  return {
    influence_key: row.influence_key,
    cycle_id: row.cycle_id ?? null,
    slot_key: row.slot_key ?? null,
    scheduled_post_id: row.scheduled_post_id == null ? null : number(row.scheduled_post_id),
    hypothesis_id: row.hypothesis_id ?? null,
    strategy_version_id: row.strategy_version_id ?? null,
    learning_brief_key: row.learning_brief_key ?? null,
    benchmark_snapshot_key: row.benchmark_snapshot_key ?? null,
    family_key: row.family_key ?? null,
    portfolio_role: row.portfolio_role ?? null,
    experiment_key: row.experiment_key ?? null,
    saved_pattern_identity_key: row.saved_pattern_identity_key ?? null,
    decision_changed: number(row.decision_changed) === 1,
    decision_change_types: parseJson(row.decision_change_types_json, []),
    decision_summary: row.decision_summary,
    evidence: compact(parseJson(row.evidence_json, {}), 12),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function benchmarkSeries(records: unknown[]): JsonRecord[] {
  return records.map(record).map((item) => {
    const metrics = record(item.metrics);
    return {
      snapshot_key: item.snapshot_key,
      cycle_id: item.cycle_id ?? null,
      window_end: item.window_end ?? null,
      completion_rate: record(metrics.completion).completion_rate ?? null,
      candidate_efficiency: record(metrics.candidate_efficiency).acceptance_rate ?? null,
      duplicate_rejections: record(metrics.repeated_mistakes).duplicate_rejection_count ?? null,
      semantic_collisions: record(metrics.repeated_mistakes).semantic_collision_count ?? null,
      prediction_accuracy: record(metrics.prediction_accuracy).calibration_rate ?? null,
      engagement_floor: record(metrics.engagement_floor).floor ?? record(metrics.mature_performance).median_overall ?? null,
      strategy_influence: record(metrics.strategy_influence).value ?? null,
    };
  });
}

export async function buildManifestIntelligenceDashboard(db: D1Database, input: {
  brand_key: string;
  limit?: number;
}): Promise<JsonRecord> {
  await ensureManifestProductIntegrationTables(db);
  const limit = Math.max(5, Math.min(30, Math.trunc(input.limit ?? 20)));
  const [summaryRead, benchmarkRead, comparisonRead, savedRead, transitionRead, portfolioRead, experimentRead, engineState, decisionIntelligence, influenceRows, influenceCount, cycleRows, lineageRows] = await Promise.all([
    buildManifestMeasurementAuditRead(db, { brand_key: input.brand_key, section: "summary", limit: 1 }),
    buildManifestMeasurementAuditRead(db, { brand_key: input.brand_key, section: "benchmarks", limit }),
    buildManifestMeasurementAuditRead(db, { brand_key: input.brand_key, section: "run_comparisons", limit }),
    buildManifestMeasurementAuditRead(db, { brand_key: input.brand_key, section: "saved_patterns", limit }),
    buildManifestMeasurementAuditRead(db, { brand_key: input.brand_key, section: "strategy_transitions", limit }),
    buildManifestMeasurementAuditRead(db, { brand_key: input.brand_key, section: "portfolio", limit }),
    buildManifestMeasurementAuditRead(db, { brand_key: input.brand_key, section: "experiments", limit }),
    getManifestIntelligenceEngineState(db, input.brand_key),
    buildManifestDecisionIntelligence(db, input.brand_key),
    db.prepare(`SELECT * FROM operator_manifest_decision_influences WHERE brand_key = ?
      ORDER BY datetime(created_at) DESC LIMIT ?`).bind(input.brand_key, limit).all<JsonRecord>(),
    db.prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN decision_changed = 1 THEN 1 ELSE 0 END) AS changed
      FROM operator_manifest_decision_influences WHERE brand_key = ?`).bind(input.brand_key).first<JsonRecord>(),
    db.prepare(`SELECT c.id AS cycle_id, c.operation_id, c.status, c.horizon_start_local,
        c.horizon_end_local, c.scheduled_post_ids_json, c.missing_slots_json,
        c.created_at, c.updated_at, r.id AS receipt_id, r.status AS receipt_status,
        r.input_strategy_version_id, r.output_strategy_version_id, r.completed_at
      FROM operator_autonomous_growth_cycles c
      LEFT JOIN operator_manifest_cycle_receipts r ON r.brand_key = c.brand_key AND r.cycle_id = c.id
      WHERE c.brand_key = ? ORDER BY datetime(c.updated_at) DESC LIMIT ?`).bind(input.brand_key, limit).all<JsonRecord>(),
    db.prepare(`SELECT l.cycle_id,
        COUNT(*) AS total,
        SUM(CASE WHEN l.scheduled_post_id IS NOT NULL THEN 1 ELSE 0 END) AS scheduled,
        SUM(CASE WHEN l.hypothesis_id IS NOT NULL AND l.generation_run_id IS NOT NULL
          AND l.draft_id IS NOT NULL AND l.scheduled_post_id IS NOT NULL
          AND (l.source_card_id IS NOT NULL OR l.source_selection_id IS NOT NULL)
          THEN 1 ELSE 0 END) AS complete
      FROM operator_autonomous_lineup_items l WHERE l.brand_key = ?
      GROUP BY l.cycle_id ORDER BY MAX(datetime(l.updated_at)) DESC LIMIT ?`).bind(input.brand_key, limit).all<JsonRecord>(),
  ]);
  const summary = record(summaryRead.summary);
  const benchmarks = array(benchmarkRead.records);
  const influences = (influenceRows.results ?? []).map(serializeInfluence);
  const lineageByCycle = new Map((lineageRows.results ?? []).map((row) => [text(row.cycle_id, 160), row]));
  const runReceipts = (cycleRows.results ?? []).map((row) => {
    const lineage = lineageByCycle.get(text(row.cycle_id, 160));
    const total = number(lineage?.total);
    const complete = number(lineage?.complete);
    return {
      cycle_id: row.cycle_id,
      operation_id: row.operation_id,
      status: row.status,
      horizon_start_local: row.horizon_start_local,
      horizon_end_local: row.horizon_end_local,
      scheduled_post_ids: parseJson(row.scheduled_post_ids_json, []),
      remaining_missing_slots: parseJson(row.missing_slots_json, []),
      receipt_id: row.receipt_id ?? null,
      receipt_status: row.receipt_status ?? null,
      input_strategy_version_id: row.input_strategy_version_id ?? null,
      output_strategy_version_id: row.output_strategy_version_id ?? null,
      strategy_changed: Boolean(row.output_strategy_version_id && row.output_strategy_version_id !== row.input_strategy_version_id),
      completed_at: row.completed_at ?? null,
      lineage: {
        total,
        scheduled: number(lineage?.scheduled),
        complete,
        completion_rate: total > 0 ? complete / total : null,
      },
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
  const changedCount = number(influenceCount?.changed);
  const totalInfluences = number(influenceCount?.total);
  const latestInfluence = influences[0] ?? null;
  const dashboard = {
    version: MANIFEST_INTELLIGENCE_DASHBOARD_VERSION,
    product_integration_version: MANIFEST_PRODUCT_INTEGRATION_VERSION,
    generated_at: new Date().toISOString(),
    brand_key: input.brand_key,
    strategy: summary.latest_strategy ?? decisionIntelligence.latest_strategy ?? null,
    beliefs_and_confidence: {
      learning_observations: array(engineState.learning_observations).slice(0, limit),
      transition_count: summary.transition_count ?? 0,
      strategy_transitions: array(transitionRead.records),
    },
    family_states: array(portfolioRead.records),
    experiments: array(experimentRead.records),
    learning_brief: summary.learning_brief ?? decisionIntelligence.learning_brief ?? null,
    benchmark_history: benchmarks,
    benchmark_series: benchmarkSeries(benchmarks),
    latest_run_comparison: summary.latest_run_comparison ?? array(comparisonRead.records)[0] ?? null,
    engagement_floor_trajectory: benchmarkSeries(benchmarks).map((item) => ({
      snapshot_key: item.snapshot_key,
      cycle_id: item.cycle_id,
      value: item.engagement_floor,
      window_end: item.window_end,
    })),
    prediction_accuracy_trajectory: benchmarkSeries(benchmarks).map((item) => ({
      snapshot_key: item.snapshot_key,
      cycle_id: item.cycle_id,
      value: item.prediction_accuracy,
      window_end: item.window_end,
    })),
    repetition_trends: {
      current: decisionIntelligence.repetition,
      benchmark_series: benchmarkSeries(benchmarks).map((item) => ({
        snapshot_key: item.snapshot_key,
        duplicate_rejections: item.duplicate_rejections,
        semantic_collisions: item.semantic_collisions,
      })),
    },
    saved_patterns: array(savedRead.records),
    run_receipts: runReceipts,
    lineage: {
      latest_cycles: runReceipts.map((item) => ({ cycle_id: item.cycle_id, ...record(item.lineage) })),
      all_latest_complete: runReceipts.length > 0 && runReceipts.every((item) => number(record(item.lineage).total) === number(record(item.lineage).complete)),
    },
    follower_checkpoint: summary.follower_checkpoint ?? decisionIntelligence.follower_checkpoint ?? null,
    decision_intelligence: decisionIntelligence,
    decision_influence: {
      total_receipts: totalInfluences,
      changed_decision_count: changedCount,
      changed_decision_rate: totalInfluences > 0 ? changedCount / totalInfluences : null,
      learned_strategy_changed_decisions: changedCount > 0,
      latest: latestInfluence,
      recent: influences,
    },
    product_proof: {
      dashboard_complete: true,
      scheduled_task_contract_available: record(decisionIntelligence.consumption_contract).required === true,
      automatic_operator_decision_change_proven: changedCount > 0,
      complete_receipt_retrieval_available: runReceipts.some((item) => Boolean(item.receipt_id)),
      complete_lineage_available: runReceipts.some((item) => number(record(item.lineage).total) > 0 && number(record(item.lineage).total) === number(record(item.lineage).complete)),
      noninterference_preserved: summary.noninterference_preserved !== false,
      owner_dependency: false,
      production_verification_pending: true,
    },
    capability_status: summary.capability_status ?? {},
    capability_gaps: summary.capability_gaps ?? [],
  };
  return {
    ...dashboard,
    source_fingerprint: fnv1a(stable(dashboard)),
  };
}
