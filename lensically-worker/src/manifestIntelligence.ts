export const MANIFEST_INTELLIGENCE_FOUNDATION_VERSION = "manifest-intelligence-foundation-v2";
export const MANIFEST_CYCLE_RECEIPT_VERSION = "manifest-cycle-receipt-v2";
export const MANIFEST_STRATEGY_VERSION_CONTRACT = "manifest-strategy-version-v1";
export const MANIFEST_EXPOSURE_LEDGER_VERSION = "manifest-exposure-ledger-v2";
export const MANIFEST_POST_HYPOTHESIS_VERSION = "manifest-post-hypothesis-v2";
export const MANIFEST_CYCLE_RECEIPT_READ_VERSION = "manifest-cycle-receipt-read-v1";

export const MANIFEST_NONINTERFERENCE_POLICY = {
  version: "manifest-owner-noninterference-v1",
  owner_default_role: "system_auditor_and_saved_pattern_curator",
  scheduled_content_policy: "Allow autonomous scheduled content to publish and mature without routine owner deletion, rewriting, approval, rejection, or taste intervention.",
  learning_source: "observable_post_engagement",
  permitted_owner_actions: [
    "add qualified Saved Patterns",
    "audit the intelligence system",
    "improve schemas, evaluation, strategy, benchmarks, and safety",
    "intervene for account safety, legal risk, credentials, ownership, spending, irreversible deletion, or a fundamental mission change",
  ],
  prohibited_inference: "Do not interpret the absence of owner intervention as post approval or performance evidence.",
  protected_boundaries_preserved: true,
} as const;

export const MANIFEST_FOLLOWER_ATTRIBUTION_POLICY = {
    version: "manifest-follower-attribution-boundary-v2",
  account_level_only: true,
  post_level_attribution: "forbidden",
  day_level_attribution: "forbidden",
  family_level_attribution: "forbidden",
  experiment_level_attribution: "forbidden",
  posting_period_attribution: "forbidden",
  allowed_use: "Account-level checkpoint and long-horizon trajectory only until Threads exposes direct attribution.",
  post_evaluation_metrics: [
    "views", "likes", "replies", "reposts", "quotes", "shares", "engagement_rate",
    "conversation_rate", "propagation_rate", "velocity", "maturity", "comparable_post_evidence",
  ],
} as const;

type JsonRecord = Record<string, unknown>;

export type ManifestControlledExperimentSpec = {
  experiment_key: string;
  hypothesis: JsonRecord;
  comparison_group: JsonRecord;
  maturity_windows: number[];
  result_criteria: JsonRecord;
  variant_key: string;
};

export type ManifestPostHypothesis = {
  expected_response_type: "reach" | "likes" | "replies" | "reposts" | "shares" | "engagement_rate" | "balanced_engagement";
  expected_audience_reward: string;
  hook_rationale: string;
  premise_rationale: string;
  exploration_mode: "exploit" | "explore" | "hybrid";
  comparable_post_ids: string[];
  expected_performance_range: JsonRecord;
  uncertainty: string;
  falsification_conditions: string[];
  experiment: ManifestControlledExperimentSpec | null;
};

export type ManifestSourceContext = {
  kind: "saved_pattern" | "source_card" | "operator_hypothesis" | "market_signal";
  source_type: string;
  source_identity_key: string | null;
  source_card_id: string | null;
  source_selection_id: string | null;
  internal_source_id: string | null;
  source_url: string | null;
};

function parseJson(value: unknown, fallback: unknown): unknown {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function strings(value: unknown, maxItems = 50, maxLength = 500): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as JsonRecord)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, stableValue(child)]));
}

export function stableManifestJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

async function hash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableManifestJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const MANIFEST_ACCOUNT_LEVEL_FOLLOWER_KEYS = new Set([
  "accountfollowers", "currentfollowers", "followerattributionpolicy", "followercheckpoint",
  "followercount", "followersaccountlevelonly", "followersremaining", "followertrajectory",
  "latestfollowersnapshot", "longhorizonfollowertrajectory", "targetfollowers",
]);

const MANIFEST_FORBIDDEN_FOLLOWER_SCOPES = [
  "post", "slot", "hour", "day", "date", "family", "experiment", "campaign", "cycle",
  "schedule", "postingperiod", "content", "candidate", "draft", "source",
];

function followerAttributionViolations(
  value: unknown,
  path = "root",
  allowAccountLevelCheckpoint = true,
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => followerAttributionViolations(item, `${path}[${index}]`, allowAccountLevelCheckpoint));
  }
  if (typeof value === "string") {
    const normalized = value.toLowerCase().replace(/\s+/g, " ");
    const scopedFollowerClaim = /\b(?:this|that|the|each|a)\s+(?:post|slot|family|experiment|day|period|campaign|cycle|schedule)\b.{0,120}\bfollowers?\b/.test(normalized)
      || /\bfollowers?\b.{0,120}\b(?:from|caused by|because of|attribut(?:e|ed|ion)|generated by)\b/.test(normalized);
    return scopedFollowerClaim ? [`${path}:text_claim`] : [];
  }
  if (!value || typeof value !== "object") return [];
  const hits: string[] = [];
  for (const [key, child] of Object.entries(value as JsonRecord)) {
    const next = `${path}.${key}`;
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normalized.includes("follower")) {
      const normalizedPath = next.toLowerCase().replace(/[^a-z0-9]/g, "");
      const scoped = MANIFEST_FORBIDDEN_FOLLOWER_SCOPES.some((scope) => normalizedPath.includes(scope));
      const allowedAccountLevel = allowAccountLevelCheckpoint && MANIFEST_ACCOUNT_LEVEL_FOLLOWER_KEYS.has(normalized) && !scoped;
      const allowedPolicy = normalized === "followerattributionpolicy" || normalized === "followersaccountlevelonly";
      if (!allowedAccountLevel && !allowedPolicy) hits.push(next);
    }
    hits.push(...followerAttributionViolations(child, next, allowAccountLevelCheckpoint));
  }
  return hits;
}

export function validateManifestFollowerAttributionBoundary(
  input: unknown,
  options: { allowAccountLevelCheckpoint?: boolean } = {},
): { ok: true } | { ok: false; errors: string[] } {
  const violations = followerAttributionViolations(input, "root", options.allowAccountLevelCheckpoint !== false);
  return violations.length
    ? { ok: false, errors: [`follower_attribution_forbidden:${violations.join(",")}`] }
    : { ok: true };
}

export function validateManifestPostHypothesis(input: unknown): { ok: true; value: ManifestPostHypothesis } | { ok: false; errors: string[] } {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as JsonRecord : {};
  const errors: string[] = [];
    const followerBoundary = validateManifestFollowerAttributionBoundary(source, { allowAccountLevelCheckpoint: false });
  if (!followerBoundary.ok) errors.push(...followerBoundary.errors);
  const response = text(source.expected_response_type, 80) as ManifestPostHypothesis["expected_response_type"];
  const allowed = new Set(["reach", "likes", "replies", "reposts", "shares", "engagement_rate", "balanced_engagement"]);
  if (!allowed.has(response)) errors.push("expected_response_type_invalid");
  const reward = text(source.expected_audience_reward);
  const hookRationale = text(source.hook_rationale);
  const premiseRationale = text(source.premise_rationale);
  const explorationMode = text(source.exploration_mode, 40) as ManifestPostHypothesis["exploration_mode"];
  if (!new Set(["exploit", "explore", "hybrid"]).has(explorationMode)) errors.push("exploration_mode_invalid");
  if (!reward) errors.push("expected_audience_reward_required");
  if (!hookRationale) errors.push("hook_rationale_required");
  if (!premiseRationale) errors.push("premise_rationale_required");
  const uncertainty = text(source.uncertainty);
  if (!uncertainty) errors.push("uncertainty_required");
    const expectedRange = source.expected_performance_range && typeof source.expected_performance_range === "object" && !Array.isArray(source.expected_performance_range)
    ? source.expected_performance_range as JsonRecord : {};
  if (!Object.keys(expectedRange).length) errors.push("expected_performance_range_required");
  const experimentSource = source.experiment && typeof source.experiment === "object" && !Array.isArray(source.experiment)
    ? source.experiment as JsonRecord : null;
  let experiment: ManifestControlledExperimentSpec | null = null;
  if (experimentSource) {
    const experimentKey = text(experimentSource.experiment_key, 160);
    const experimentHypothesis = experimentSource.hypothesis && typeof experimentSource.hypothesis === "object" && !Array.isArray(experimentSource.hypothesis)
      ? experimentSource.hypothesis as JsonRecord : {};
    const comparisonGroup = experimentSource.comparison_group && typeof experimentSource.comparison_group === "object" && !Array.isArray(experimentSource.comparison_group)
      ? experimentSource.comparison_group as JsonRecord : {};
    const maturityWindows = Array.isArray(experimentSource.maturity_windows)
      ? experimentSource.maturity_windows.map(Number).filter((value) => [6, 12, 18, 24].includes(value))
      : [6, 12, 18, 24];
    const resultCriteria = experimentSource.result_criteria && typeof experimentSource.result_criteria === "object" && !Array.isArray(experimentSource.result_criteria)
      ? experimentSource.result_criteria as JsonRecord : {};
    const variantKey = text(experimentSource.variant_key, 120) || "variant";
    if (!experimentKey) errors.push("experiment_key_required");
    if (!Object.keys(experimentHypothesis).length) errors.push("experiment_hypothesis_required");
    if (!Object.keys(comparisonGroup).length) errors.push("experiment_comparison_group_required");
    if (!maturityWindows.includes(24)) errors.push("experiment_24_hour_maturity_required");
    if (!Object.keys(resultCriteria).length) errors.push("experiment_result_criteria_required");
    experiment = {
      experiment_key: experimentKey,
      hypothesis: experimentHypothesis,
      comparison_group: comparisonGroup,
      maturity_windows: Array.from(new Set(maturityWindows)).sort((left, right) => left - right),
      result_criteria: resultCriteria,
      variant_key: variantKey,
    };
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: {
    expected_response_type: response,
    expected_audience_reward: reward,
    hook_rationale: hookRationale,
    premise_rationale: premiseRationale,
    exploration_mode: explorationMode,
    comparable_post_ids: strings(source.comparable_post_ids, 25, 120),
    expected_performance_range: expectedRange,
    uncertainty,
    falsification_conditions: strings(source.falsification_conditions, 20, 1000),
    experiment,
  } };
}

export function normalizeManifestSourceContext(input: unknown): { ok: true; value: ManifestSourceContext } | { ok: false; errors: string[] } {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as JsonRecord : {};
  const kind = text(source.kind, 60) as ManifestSourceContext["kind"];
  const allowed = new Set(["saved_pattern", "source_card", "operator_hypothesis", "market_signal"]);
  const errors: string[] = [];
  if (!allowed.has(kind)) errors.push("source_context_kind_invalid");
  const value: ManifestSourceContext = {
    kind,
    source_type: text(source.source_type, 120) || kind,
    source_identity_key: text(source.source_identity_key, 500) || null,
    source_card_id: text(source.source_card_id, 160) || null,
    source_selection_id: text(source.source_selection_id, 160) || null,
    internal_source_id: text(source.internal_source_id, 500) || null,
    source_url: text(source.source_url, 2000) || null,
  };
  if (kind !== "operator_hypothesis" && !value.source_card_id && !value.source_selection_id && !value.source_identity_key && !value.internal_source_id) {
    errors.push("source_context_identity_required");
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

function count(map: Record<string, number>, key: unknown): void {
  const normalized = text(key, 500).toLowerCase();
  if (normalized) map[normalized] = (map[normalized] ?? 0) + 1;
}

export function buildManifestExposureDimensions(records: JsonRecord[]): JsonRecord {
  const families: Record<string, number> = {};
  const hooks: Record<string, number> = {};
  const premises: Record<string, number> = {};
  const rewards: Record<string, number> = {};
  const modes: Record<string, number> = {};
  const dollarAmounts: Record<string, number> = {};
  let questions = 0;
  for (const record of records) {
    const strategy = record.strategy && typeof record.strategy === "object" && !Array.isArray(record.strategy)
      ? record.strategy as JsonRecord : {};
    const value = text(record.text, 20000);
    count(families, strategy.family_key ?? record.family_key);
    count(hooks, strategy.hook_style ?? record.hook_style);
    count(premises, strategy.premise_key ?? strategy.premise);
    count(rewards, strategy.audience_reward ?? record.audience_reward);
    count(modes, strategy.generation_mode ?? record.generation_mode);
    for (const match of value.matchAll(/\$\s?([0-9][0-9,]*(?:\.[0-9]+)?)(?:\s?(million|billion|thousand|k|m|b))?/gi)) {
      count(dollarAmounts, `${match[1]}${match[2] ? ` ${match[2].toLowerCase()}` : ""}`);
    }
    if (value.includes("?")) questions += 1;
  }
  return {
    version: MANIFEST_EXPOSURE_LEDGER_VERSION,
    record_count: records.length,
    family_counts: families,
    hook_counts: hooks,
    premise_counts: premises,
    audience_reward_counts: rewards,
    generation_mode_counts: modes,
    dollar_amount_counts: dollarAmounts,
    question_count: questions,
  };
}

async function ensureColumn(db: D1Database, table: string, column: string, definition: string): Promise<void> {
  const rows = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  if (!(rows.results ?? []).some((row) => row.name === column)) {
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

export async function ensureManifestIntelligenceTables(db: D1Database): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS operator_manifest_intelligence_policies (
      brand_key TEXT PRIMARY KEY, policy_version TEXT NOT NULL, policy_json TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_strategy_versions (
      id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, version INTEGER NOT NULL,
      contract_version TEXT NOT NULL, parent_version_id TEXT, status TEXT NOT NULL DEFAULT 'active',
      strategy_hash TEXT NOT NULL, strategy_json TEXT NOT NULL, evidence_json TEXT NOT NULL DEFAULT '{}',
      change_summary TEXT, reversal_conditions_json TEXT NOT NULL DEFAULT '[]', source_cycle_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(brand_key, version), UNIQUE(brand_key, strategy_hash))`,
        `CREATE TABLE IF NOT EXISTS operator_manifest_exposure_snapshots (
      id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL UNIQUE, brand_key TEXT NOT NULL,
      ledger_version TEXT NOT NULL, as_of TEXT NOT NULL, timezone TEXT NOT NULL,
      horizon_start_local TEXT, horizon_end_local TEXT, published_json TEXT NOT NULL DEFAULT '[]',
      scheduled_json TEXT NOT NULL DEFAULT '[]', dimensions_json TEXT NOT NULL DEFAULT '{}',
      source_hash TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`, 
    `CREATE TABLE IF NOT EXISTS operator_manifest_cycle_receipts (
      id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL UNIQUE, brand_key TEXT NOT NULL, operation_id TEXT NOT NULL,
      receipt_version TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'started', trigger_json TEXT NOT NULL,
      startup_state_json TEXT NOT NULL, input_strategy_version_id TEXT, output_strategy_version_id TEXT,
      exposure_snapshot_id TEXT, horizon_plan_json TEXT NOT NULL DEFAULT '{}', completion_json TEXT,
      unresolved_issues_json TEXT NOT NULL DEFAULT '[]', started_at TEXT NOT NULL,
      completed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_cycle_receipt_events (
      id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL, brand_key TEXT NOT NULL, event_key TEXT NOT NULL,
      event_type TEXT NOT NULL, slot_key TEXT, payload_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cycle_id, event_key))`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_post_hypotheses (
      id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL, brand_key TEXT NOT NULL, slot_key TEXT NOT NULL,
      hypothesis_version TEXT NOT NULL, strategy_version_id TEXT, source_kind TEXT NOT NULL,
      source_type TEXT NOT NULL, source_identity_key TEXT, source_card_id TEXT, source_selection_id TEXT,
      internal_source_id TEXT, expected_response_type TEXT NOT NULL, expected_audience_reward TEXT NOT NULL,
      hook_rationale TEXT NOT NULL, premise_rationale TEXT NOT NULL, exploration_mode TEXT NOT NULL,
      comparable_post_ids_json TEXT NOT NULL DEFAULT '[]', expected_performance_range_json TEXT NOT NULL,
      uncertainty TEXT NOT NULL, falsification_conditions_json TEXT NOT NULL DEFAULT '[]',
            candidate_trace_json TEXT NOT NULL DEFAULT '[]', model_evaluation_json TEXT NOT NULL DEFAULT '{}',
      scheduled_post_id INTEGER, status TEXT NOT NULL DEFAULT 'proposed', revision INTEGER NOT NULL DEFAULT 1,
      locked_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(cycle_id, slot_key))`,
    `CREATE INDEX IF NOT EXISTS idx_manifest_strategy_versions_brand ON operator_manifest_strategy_versions (brand_key, version DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_manifest_receipt_events_cycle ON operator_manifest_cycle_receipt_events (cycle_id, created_at ASC)`,
    `CREATE INDEX IF NOT EXISTS idx_manifest_hypotheses_cycle ON operator_manifest_post_hypotheses (cycle_id, slot_key ASC)`,
  ];
  for (const sql of statements) await db.prepare(sql).run();
  await ensureColumn(db, "operator_autonomous_growth_cycles", "receipt_id", "TEXT");
  await ensureColumn(db, "operator_autonomous_growth_cycles", "strategy_version_id", "TEXT");
  await ensureColumn(db, "operator_autonomous_growth_cycles", "exposure_snapshot_id", "TEXT");
    await ensureColumn(db, "operator_autonomous_lineup_items", "hypothesis_id", "TEXT");
  await ensureColumn(db, "operator_autonomous_lineup_items", "source_selection_id", "TEXT");
  await ensureColumn(db, "operator_manifest_exposure_snapshots", "revision", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "operator_manifest_exposure_snapshots", "updated_at", "TEXT");
  await ensureColumn(db, "operator_manifest_post_hypotheses", "revision", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "operator_manifest_post_hypotheses", "locked_at", "TEXT");
}

export async function ensureManifestIntelligencePolicy(db: D1Database, brandKey: string): Promise<JsonRecord> {
  await ensureManifestIntelligenceTables(db);
  const policy = {
    foundation_version: MANIFEST_INTELLIGENCE_FOUNDATION_VERSION,
    noninterference: MANIFEST_NONINTERFERENCE_POLICY,
    follower_attribution: MANIFEST_FOLLOWER_ATTRIBUTION_POLICY,
  };
  await db.prepare(
    `INSERT INTO operator_manifest_intelligence_policies (brand_key, policy_version, policy_json, active)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(brand_key) DO UPDATE SET policy_version = excluded.policy_version,
       policy_json = excluded.policy_json, active = 1, updated_at = CURRENT_TIMESTAMP`,
  ).bind(brandKey, MANIFEST_INTELLIGENCE_FOUNDATION_VERSION, stableManifestJson(policy)).run();
  return policy;
}

function serializeStrategy(row: JsonRecord): JsonRecord {
  return {
    ...row,
    version: Number(row.version ?? 0),
    strategy: parseJson(row.strategy_json, {}),
    evidence: parseJson(row.evidence_json, {}),
    reversal_conditions: parseJson(row.reversal_conditions_json, []),
  };
}

export async function ensureManifestStrategyVersion(db: D1Database, input: {
  brandKey: string; strategy: JsonRecord; evidence?: JsonRecord; changeSummary?: string;
  reversalConditions?: string[]; sourceCycleId?: string | null; parentVersionId?: string | null;
}): Promise<JsonRecord> {
  await ensureManifestIntelligenceTables(db);
  const strategyHash = await hash(input.strategy);
  const existing = await db.prepare(
    `SELECT * FROM operator_manifest_strategy_versions WHERE brand_key = ? AND strategy_hash = ? LIMIT 1`,
  ).bind(input.brandKey, strategyHash).first<JsonRecord>();
  if (existing) return serializeStrategy(existing);
  const latest = await db.prepare(
    `SELECT id, version FROM operator_manifest_strategy_versions WHERE brand_key = ? ORDER BY version DESC LIMIT 1`,
  ).bind(input.brandKey).first<{ id: string; version: number }>();
  const id = crypto.randomUUID();
  const version = Number(latest?.version ?? 0) + 1;
  await db.prepare(
    `INSERT INTO operator_manifest_strategy_versions (
      id, brand_key, version, contract_version, parent_version_id, strategy_hash,
      strategy_json, evidence_json, change_summary, reversal_conditions_json, source_cycle_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, input.brandKey, version, MANIFEST_STRATEGY_VERSION_CONTRACT,
    input.parentVersionId ?? latest?.id ?? null, strategyHash, stableManifestJson(input.strategy),
    stableManifestJson(input.evidence ?? {}), input.changeSummary ?? null,
    stableManifestJson(input.reversalConditions ?? []), input.sourceCycleId ?? null,
  ).run();
  const created = await db.prepare(`SELECT * FROM operator_manifest_strategy_versions WHERE id = ?`).bind(id).first<JsonRecord>();
  return serializeStrategy(created ?? { id, brand_key: input.brandKey, version, strategy_json: input.strategy });
}

export async function getLatestManifestStrategyVersion(db: D1Database, brandKey: string): Promise<JsonRecord | null> {
  await ensureManifestIntelligenceTables(db);
  const row = await db.prepare(
    `SELECT * FROM operator_manifest_strategy_versions WHERE brand_key = ? AND status = 'active' ORDER BY version DESC LIMIT 1`,
  ).bind(brandKey).first<JsonRecord>();
  return row ? serializeStrategy(row) : null;
}

function serializeExposure(row: JsonRecord): JsonRecord {
  return {
    ...row,
    revision: Number(row.revision ?? 1),
    published: parseJson(row.published_json, []),
    scheduled: parseJson(row.scheduled_json, []),
    dimensions: parseJson(row.dimensions_json, {}),
  };
}

export async function createManifestExposureSnapshot(db: D1Database, input: {
  cycleId: string; brandKey: string; asOf: string; timezone: string;
  horizonStartLocal?: string | null; horizonEndLocal?: string | null;
  published: JsonRecord[]; scheduled: JsonRecord[];
}): Promise<JsonRecord> {
  await ensureManifestIntelligenceTables(db);
  const dimensions = buildManifestExposureDimensions([...input.published, ...input.scheduled]);
  const sourceHash = await hash({ published: input.published, scheduled: input.scheduled, dimensions });
  const existing = await db.prepare(
    `SELECT * FROM operator_manifest_exposure_snapshots WHERE cycle_id = ? LIMIT 1`,
  ).bind(input.cycleId).first<JsonRecord>();
  if (existing) {
    if (String(existing.brand_key) !== input.brandKey) throw new Error("manifest_exposure_cycle_brand_conflict");
    if (String(existing.source_hash) === sourceHash) return { ...serializeExposure(existing), refreshed: false };
    await db.prepare(
      `UPDATE operator_manifest_exposure_snapshots SET ledger_version = ?, as_of = ?, timezone = ?,
         horizon_start_local = ?, horizon_end_local = ?, published_json = ?, scheduled_json = ?,
         dimensions_json = ?, source_hash = ?, revision = COALESCE(revision, 1) + 1,
         updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(
      MANIFEST_EXPOSURE_LEDGER_VERSION, input.asOf, input.timezone,
      input.horizonStartLocal ?? null, input.horizonEndLocal ?? null,
      stableManifestJson(input.published), stableManifestJson(input.scheduled),
      stableManifestJson(dimensions), sourceHash, existing.id,
    ).run();
    const refreshed = await db.prepare(`SELECT * FROM operator_manifest_exposure_snapshots WHERE id = ?`)
      .bind(existing.id).first<JsonRecord>();
    return { ...serializeExposure(refreshed ?? existing), refreshed: true };
  }
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO operator_manifest_exposure_snapshots (
      id, cycle_id, brand_key, ledger_version, as_of, timezone, horizon_start_local,
      horizon_end_local, published_json, scheduled_json, dimensions_json, source_hash, revision, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
  ).bind(
    id, input.cycleId, input.brandKey, MANIFEST_EXPOSURE_LEDGER_VERSION, input.asOf, input.timezone,
    input.horizonStartLocal ?? null, input.horizonEndLocal ?? null,
    stableManifestJson(input.published), stableManifestJson(input.scheduled), stableManifestJson(dimensions), sourceHash,
  ).run();
  const row = await db.prepare(`SELECT * FROM operator_manifest_exposure_snapshots WHERE id = ?`).bind(id).first<JsonRecord>();
  return { ...serializeExposure(row ?? { id, dimensions_json: dimensions, revision: 1 }), refreshed: false };
}

function serializeReceipt(row: JsonRecord): JsonRecord {
  return {
    ...row,
    trigger: parseJson(row.trigger_json, {}),
    startup_state: parseJson(row.startup_state_json, {}),
    horizon_plan: parseJson(row.horizon_plan_json, {}),
    completion: parseJson(row.completion_json, null),
    unresolved_issues: parseJson(row.unresolved_issues_json, []),
  };
}

export async function beginManifestCycleReceipt(db: D1Database, input: {
  cycleId: string; brandKey: string; operationId: string; trigger: JsonRecord;
  startupState: JsonRecord; inputStrategyVersionId?: string | null; exposureSnapshotId?: string | null;
  horizonPlan: JsonRecord; startedAt: string;
}): Promise<JsonRecord> {
  await ensureManifestIntelligenceTables(db);
    const existing = await db.prepare(`SELECT * FROM operator_manifest_cycle_receipts WHERE cycle_id = ? LIMIT 1`)
    .bind(input.cycleId).first<JsonRecord>();
  if (existing) {
    if (String(existing.brand_key) !== input.brandKey || String(existing.operation_id) !== input.operationId) {
      throw new Error("manifest_cycle_receipt_identity_conflict");
    }
    return serializeReceipt(existing);
  }
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO operator_manifest_cycle_receipts (
      id, cycle_id, brand_key, operation_id, receipt_version, status, trigger_json,
      startup_state_json, input_strategy_version_id, exposure_snapshot_id, horizon_plan_json, started_at
    ) VALUES (?, ?, ?, ?, ?, 'started', ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, input.cycleId, input.brandKey, input.operationId, MANIFEST_CYCLE_RECEIPT_VERSION,
    stableManifestJson(input.trigger), stableManifestJson(input.startupState),
    input.inputStrategyVersionId ?? null, input.exposureSnapshotId ?? null,
    stableManifestJson(input.horizonPlan), input.startedAt,
  ).run();
  await db.prepare(
    `UPDATE operator_autonomous_growth_cycles SET receipt_id = ?, strategy_version_id = ?, exposure_snapshot_id = ? WHERE id = ?`,
  ).bind(id, input.inputStrategyVersionId ?? null, input.exposureSnapshotId ?? null, input.cycleId).run();
  const row = await db.prepare(`SELECT * FROM operator_manifest_cycle_receipts WHERE id = ?`).bind(id).first<JsonRecord>();
  return serializeReceipt(row ?? { id, cycle_id: input.cycleId });
}

export async function appendManifestCycleEvent(db: D1Database, input: {
  cycleId: string; brandKey: string; eventKey: string; eventType: string;
  slotKey?: string | null; payload: JsonRecord;
}): Promise<void> {
  await ensureManifestIntelligenceTables(db);
  const payloadJson = stableManifestJson(input.payload);
  const existing = await db.prepare(
    `SELECT brand_key, event_type, slot_key, payload_json FROM operator_manifest_cycle_receipt_events
     WHERE cycle_id = ? AND event_key = ? LIMIT 1`,
  ).bind(input.cycleId, input.eventKey).first<JsonRecord>();
  if (existing) {
    const replayMatches = String(existing.brand_key) === input.brandKey
      && String(existing.event_type) === input.eventType
      && String(existing.slot_key ?? "") === String(input.slotKey ?? "")
      && String(existing.payload_json) === payloadJson;
    if (replayMatches) return;
    throw new Error("manifest_cycle_event_immutable_conflict");
  }
  await db.prepare(
    `INSERT INTO operator_manifest_cycle_receipt_events (
      id, cycle_id, brand_key, event_key, event_type, slot_key, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(), input.cycleId, input.brandKey, input.eventKey,
    input.eventType, input.slotKey ?? null, payloadJson,
  ).run();
}

function serializeHypothesis(row: JsonRecord): JsonRecord {
  return {
    ...row,
    revision: Number(row.revision ?? 1),
    comparable_post_ids: parseJson(row.comparable_post_ids_json, []),
    expected_performance_range: parseJson(row.expected_performance_range_json, {}),
    falsification_conditions: parseJson(row.falsification_conditions_json, []),
    candidate_trace: parseJson(row.candidate_trace_json, []),
    model_evaluation: parseJson(row.model_evaluation_json, {}),
  };
}

export async function recordManifestPostHypothesis(db: D1Database, input: {
  cycleId: string; brandKey: string; slotKey: string; strategyVersionId?: string | null;
  source: ManifestSourceContext; hypothesis: ManifestPostHypothesis; candidateTrace?: JsonRecord[];
  modelEvaluation?: JsonRecord;
}): Promise<JsonRecord> {
  await ensureManifestIntelligenceTables(db);
  const existing = await db.prepare(
    `SELECT * FROM operator_manifest_post_hypotheses WHERE cycle_id = ? AND slot_key = ? LIMIT 1`,
  ).bind(input.cycleId, input.slotKey).first<JsonRecord>();
  if (existing && ["scheduled", "reused", "published", "evaluated"].includes(String(existing.status))) {
    return serializeHypothesis(existing);
  }
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO operator_manifest_post_hypotheses (
      id, cycle_id, brand_key, slot_key, hypothesis_version, strategy_version_id,
      source_kind, source_type, source_identity_key, source_card_id, source_selection_id,
      internal_source_id, expected_response_type, expected_audience_reward, hook_rationale,
      premise_rationale, exploration_mode, comparable_post_ids_json,
      expected_performance_range_json, uncertainty, falsification_conditions_json,
      candidate_trace_json, model_evaluation_json, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed')
    ON CONFLICT(cycle_id, slot_key) DO UPDATE SET
      strategy_version_id = excluded.strategy_version_id, source_kind = excluded.source_kind,
      source_type = excluded.source_type, source_identity_key = excluded.source_identity_key,
      source_card_id = excluded.source_card_id, source_selection_id = excluded.source_selection_id,
      internal_source_id = excluded.internal_source_id, expected_response_type = excluded.expected_response_type,
      expected_audience_reward = excluded.expected_audience_reward, hook_rationale = excluded.hook_rationale,
      premise_rationale = excluded.premise_rationale, exploration_mode = excluded.exploration_mode,
      comparable_post_ids_json = excluded.comparable_post_ids_json,
      expected_performance_range_json = excluded.expected_performance_range_json,
      uncertainty = excluded.uncertainty, falsification_conditions_json = excluded.falsification_conditions_json,
            candidate_trace_json = excluded.candidate_trace_json, model_evaluation_json = excluded.model_evaluation_json,
      revision = COALESCE(operator_manifest_post_hypotheses.revision, 1) + 1,
      updated_at = CURRENT_TIMESTAMP`,
  ).bind(
    id, input.cycleId, input.brandKey, input.slotKey, MANIFEST_POST_HYPOTHESIS_VERSION,
    input.strategyVersionId ?? null, input.source.kind, input.source.source_type,
    input.source.source_identity_key, input.source.source_card_id, input.source.source_selection_id,
    input.source.internal_source_id, input.hypothesis.expected_response_type,
    input.hypothesis.expected_audience_reward, input.hypothesis.hook_rationale,
    input.hypothesis.premise_rationale, input.hypothesis.exploration_mode,
    stableManifestJson(input.hypothesis.comparable_post_ids),
    stableManifestJson(input.hypothesis.expected_performance_range), input.hypothesis.uncertainty,
    stableManifestJson(input.hypothesis.falsification_conditions),
    stableManifestJson(input.candidateTrace ?? []), stableManifestJson(input.modelEvaluation ?? {}),
  ).run();
  const row = await db.prepare(
    `SELECT * FROM operator_manifest_post_hypotheses WHERE cycle_id = ? AND slot_key = ? LIMIT 1`,
  ).bind(input.cycleId, input.slotKey).first<JsonRecord>();
  return serializeHypothesis(row ?? { id, cycle_id: input.cycleId, slot_key: input.slotKey });
}

export async function linkManifestHypothesisResult(db: D1Database, input: {
  cycleId: string; slotKey: string; scheduledPostId?: number | null; status: string;
  hypothesisId?: string | null; sourceSelectionId?: string | null;
}): Promise<void> {
  await ensureManifestIntelligenceTables(db);
    await db.prepare(
    `UPDATE operator_manifest_post_hypotheses SET scheduled_post_id = COALESCE(?, scheduled_post_id),
       status = ?, locked_at = CASE WHEN ? IN ('scheduled', 'reused', 'published', 'evaluated')
         THEN COALESCE(locked_at, CURRENT_TIMESTAMP) ELSE locked_at END,
       updated_at = CURRENT_TIMESTAMP WHERE cycle_id = ? AND slot_key = ?`,
  ).bind(input.scheduledPostId ?? null, input.status, input.status, input.cycleId, input.slotKey).run();
  await db.prepare(
    `UPDATE operator_autonomous_lineup_items SET hypothesis_id = COALESCE(?, hypothesis_id),
       source_selection_id = COALESCE(?, source_selection_id), updated_at = CURRENT_TIMESTAMP
     WHERE cycle_id = ? AND slot_key = ?`,
  ).bind(input.hypothesisId ?? null, input.sourceSelectionId ?? null, input.cycleId, input.slotKey).run();
}

export async function linkManifestCycleStrategy(db: D1Database, cycleId: string, strategyVersionId: string): Promise<void> {
  await ensureManifestIntelligenceTables(db);
  await db.prepare(`UPDATE operator_autonomous_growth_cycles SET strategy_version_id = ? WHERE id = ?`)
    .bind(strategyVersionId, cycleId).run();
  await db.prepare(
    `UPDATE operator_manifest_cycle_receipts SET output_strategy_version_id = ? WHERE cycle_id = ? AND output_strategy_version_id IS NULL`,
  ).bind(strategyVersionId, cycleId).run();
}

export async function finalizeManifestCycleReceipt(db: D1Database, input: {
  cycleId: string; status: string; completion: JsonRecord; unresolvedIssues?: JsonRecord[]; completedAt: string;
}): Promise<void> {
  await ensureManifestIntelligenceTables(db);
  const completionJson = stableManifestJson(input.completion);
  const unresolvedJson = stableManifestJson(input.unresolvedIssues ?? []);
  const existing = await db.prepare(
    `SELECT status, completion_json, unresolved_issues_json, completed_at
     FROM operator_manifest_cycle_receipts WHERE cycle_id = ? LIMIT 1`,
  ).bind(input.cycleId).first<JsonRecord>();
  if (!existing) throw new Error("manifest_cycle_receipt_not_found");
  if (existing.completed_at) {
    const replayMatches = String(existing.status) === input.status
      && String(existing.completion_json ?? "") === completionJson
      && String(existing.unresolved_issues_json ?? "[]") === unresolvedJson
      && String(existing.completed_at) === input.completedAt;
    if (replayMatches) return;
    throw new Error("manifest_cycle_receipt_immutable_conflict");
  }
  await db.prepare(
    `UPDATE operator_manifest_cycle_receipts SET status = ?, completion_json = ?,
       unresolved_issues_json = ?, completed_at = ? WHERE cycle_id = ? AND completed_at IS NULL`,
  ).bind(input.status, completionJson, unresolvedJson, input.completedAt, input.cycleId).run();
}

export async function getManifestCycleReceipt(db: D1Database, input: {
  brandKey: string; cycleId?: string | null; operationId?: string | null;
}): Promise<JsonRecord | null> {
  await ensureManifestIntelligenceTables(db);
  const row = input.cycleId
    ? await db.prepare(`SELECT * FROM operator_manifest_cycle_receipts WHERE brand_key = ? AND cycle_id = ? LIMIT 1`)
      .bind(input.brandKey, input.cycleId).first<JsonRecord>()
    : input.operationId
      ? await db.prepare(`SELECT * FROM operator_manifest_cycle_receipts WHERE brand_key = ? AND operation_id = ? ORDER BY created_at DESC LIMIT 1`)
        .bind(input.brandKey, input.operationId).first<JsonRecord>()
      : await db.prepare(`SELECT * FROM operator_manifest_cycle_receipts WHERE brand_key = ? ORDER BY created_at DESC LIMIT 1`)
        .bind(input.brandKey).first<JsonRecord>();
  if (!row) return null;
  const events = await db.prepare(
    `SELECT * FROM operator_manifest_cycle_receipt_events WHERE cycle_id = ? ORDER BY datetime(created_at) ASC, event_key ASC`,
  ).bind(String(row.cycle_id)).all<JsonRecord>();
  const hypotheses = await db.prepare(
    `SELECT * FROM operator_manifest_post_hypotheses WHERE cycle_id = ? ORDER BY slot_key ASC`,
  ).bind(String(row.cycle_id)).all<JsonRecord>();
  const inputStrategy = row.input_strategy_version_id
    ? await db.prepare(`SELECT * FROM operator_manifest_strategy_versions WHERE id = ?`).bind(row.input_strategy_version_id).first<JsonRecord>()
    : null;
  const outputStrategy = row.output_strategy_version_id
    ? await db.prepare(`SELECT * FROM operator_manifest_strategy_versions WHERE id = ?`).bind(row.output_strategy_version_id).first<JsonRecord>()
    : null;
  const exposure = row.exposure_snapshot_id
    ? await db.prepare(`SELECT * FROM operator_manifest_exposure_snapshots WHERE id = ?`).bind(row.exposure_snapshot_id).first<JsonRecord>()
    : null;
  return {
    ...serializeReceipt(row),
    input_strategy_version: inputStrategy ? serializeStrategy(inputStrategy) : null,
    output_strategy_version: outputStrategy ? serializeStrategy(outputStrategy) : null,
    exposure_snapshot: exposure ? serializeExposure(exposure) : null,
    events: (events.results ?? []).map((event) => ({ ...event, payload: parseJson(event.payload_json, {}) })),
    hypotheses: (hypotheses.results ?? []).map(serializeHypothesis),
    follower_attribution_policy: MANIFEST_FOLLOWER_ATTRIBUTION_POLICY,
    noninterference_policy: MANIFEST_NONINTERFERENCE_POLICY,
  };
}

type ManifestCycleReceiptReadSection =
  | "summary" | "events" | "hypotheses" | "exposure_published" | "exposure_scheduled"
  | "exposure_dimensions" | "startup_state" | "input_strategy" | "output_strategy"
  | "completion" | "unresolved_issues";

function compactManifestStrategyForReceipt(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as JsonRecord;
  const reversalConditions = Array.isArray(row.reversal_conditions) ? row.reversal_conditions : [];
  return {
    id: row.id ?? null,
    brand_key: row.brand_key ?? null,
    version: row.version ?? null,
    contract_version: row.contract_version ?? null,
    parent_version_id: row.parent_version_id ?? null,
    status: row.status ?? null,
    strategy_hash: row.strategy_hash ?? null,
    change_summary: row.change_summary ?? null,
    reversal_condition_count: reversalConditions.length,
    source_cycle_id: row.source_cycle_id ?? null,
    created_at: row.created_at ?? null,
  };
}

function manifestReceiptJsonChunks(value: unknown, chunkChars = 6000): { metadata: JsonRecord; items: JsonRecord[] } {
  const json = stableManifestJson(value ?? null);
  const items: JsonRecord[] = [];
  for (let start = 0, index = 0; start < json.length; start += chunkChars, index += 1) {
    const end = Math.min(json.length, start + chunkChars);
    items.push({ chunk_index: index, start_char: start, end_char: end, text: json.slice(start, end) });
  }
  if (!items.length) items.push({ chunk_index: 0, start_char: 0, end_char: 0, text: "" });
  return {
    metadata: {
      encoding: "stable-json-chunks",
      chunk_chars: chunkChars,
      character_count: json.length,
      chunk_count: items.length,
      reconstruction: "Concatenate item.text in chunk_index order, then parse as JSON.",
    },
    items,
  };
}

export function buildManifestCycleReceiptRead(
  receipt: unknown,
  requestedSection: unknown = "summary",
  requestedOffset: unknown = 0,
  requestedLimit: unknown = 10,
): JsonRecord {
  const source = receipt && typeof receipt === "object" && !Array.isArray(receipt) ? receipt as JsonRecord : {};
  const allowedSections = new Set<ManifestCycleReceiptReadSection>([
    "summary", "events", "hypotheses", "exposure_published", "exposure_scheduled",
    "exposure_dimensions", "startup_state", "input_strategy", "output_strategy",
    "completion", "unresolved_issues",
  ]);
  const normalizedSection = text(requestedSection, 80) as ManifestCycleReceiptReadSection;
  const section: ManifestCycleReceiptReadSection = allowedSections.has(normalizedSection) ? normalizedSection : "summary";
  const offsetNumber = Number(requestedOffset);
  const limitNumber = Number(requestedLimit);
  const offset = Number.isFinite(offsetNumber) ? Math.max(0, Math.trunc(offsetNumber)) : 0;
  const limit = Number.isFinite(limitNumber) ? Math.min(10, Math.max(1, Math.trunc(limitNumber))) : 10;
  const events = Array.isArray(source.events) ? source.events : [];
  const hypotheses = Array.isArray(source.hypotheses) ? source.hypotheses : [];
  const startupState = source.startup_state ?? {};
  const inputStrategy = source.input_strategy_version ?? null;
  const outputStrategy = source.output_strategy_version ?? null;
  const completion = source.completion ?? null;
  const unresolvedIssues = Array.isArray(source.unresolved_issues) ? source.unresolved_issues : [];
  const exposure = source.exposure_snapshot && typeof source.exposure_snapshot === "object" && !Array.isArray(source.exposure_snapshot)
    ? source.exposure_snapshot as JsonRecord : null;
  const published = exposure && Array.isArray(exposure.published) ? exposure.published : [];
  const scheduled = exposure && Array.isArray(exposure.scheduled) ? exposure.scheduled : [];
  const exposureDimensions = exposure?.dimensions ?? {};
  const startupRecord = startupState && typeof startupState === "object" && !Array.isArray(startupState)
    ? startupState as JsonRecord : {};
  const exposureSummary = exposure ? {
    id: exposure.id ?? null,
    cycle_id: exposure.cycle_id ?? null,
    brand_key: exposure.brand_key ?? null,
    ledger_version: exposure.ledger_version ?? null,
    as_of: exposure.as_of ?? null,
    timezone: exposure.timezone ?? null,
    horizon_start_local: exposure.horizon_start_local ?? null,
    horizon_end_local: exposure.horizon_end_local ?? null,
    source_hash: exposure.source_hash ?? null,
    revision: exposure.revision ?? 1,
    published_count: published.length,
    scheduled_count: scheduled.length,
    dimension_keys: exposureDimensions && typeof exposureDimensions === "object" && !Array.isArray(exposureDimensions)
      ? Object.keys(exposureDimensions as JsonRecord).sort() : [],
    created_at: exposure.created_at ?? null,
    updated_at: exposure.updated_at ?? null,
  } : null;
  const summary = {
    id: source.id ?? null,
    cycle_id: source.cycle_id ?? null,
    brand_key: source.brand_key ?? null,
    operation_id: source.operation_id ?? null,
    receipt_version: source.receipt_version ?? null,
    foundation_version: source.foundation_version ?? null,
    trigger_type: source.trigger_type ?? null,
    status: source.status ?? null,
    timezone: source.timezone ?? null,
    horizon_hours: source.horizon_hours ?? null,
    horizon_start_local: source.horizon_start_local ?? null,
    horizon_end_local: source.horizon_end_local ?? null,
    input_strategy_version_id: source.input_strategy_version_id ?? null,
    output_strategy_version_id: source.output_strategy_version_id ?? null,
    exposure_snapshot_id: source.exposure_snapshot_id ?? null,
    input_strategy_version: compactManifestStrategyForReceipt(inputStrategy),
    output_strategy_version: compactManifestStrategyForReceipt(outputStrategy),
    exposure_snapshot: exposureSummary,
    startup_state_summary: {
      top_level_keys: Object.keys(startupRecord).sort(),
      captured_at: startupRecord.captured_at ?? null,
      account_position_captured_at: (startupRecord.account_position && typeof startupRecord.account_position === "object" && !Array.isArray(startupRecord.account_position)
        ? (startupRecord.account_position as JsonRecord).captured_at : null) ?? null,
    },
    completion_present: completion !== null,
    unresolved_issue_count: unresolvedIssues.length,
    event_count: events.length,
    hypothesis_count: hypotheses.length,
    started_at: source.started_at ?? null,
    completed_at: source.completed_at ?? null,
    created_at: source.created_at ?? null,
    updated_at: source.updated_at ?? null,
    follower_attribution_policy: source.follower_attribution_policy ?? MANIFEST_FOLLOWER_ATTRIBUTION_POLICY,
    noninterference_policy: source.noninterference_policy ?? MANIFEST_NONINTERFERENCE_POLICY,
    read_contract: {
      version: MANIFEST_CYCLE_RECEIPT_READ_VERSION,
      canonical_receipt_preserved: true,
      payload_budget_truncation_forbidden: true,
      variable_size_sections_use_canonical_json_chunks: true,
      available_sections: Array.from(allowedSections),
      page_limit_max: 10,
      json_chunk_chars: 6000,
    },
  };
  let items: unknown[] = [];
  let sectionData: JsonRecord | null = null;
  if (section === "events") items = events;
  if (section === "hypotheses") items = hypotheses;
  if (section === "exposure_published") items = published;
  if (section === "exposure_scheduled") items = scheduled;
  const chunkSource = section === "exposure_dimensions" ? exposureDimensions
    : section === "startup_state" ? startupState
      : section === "input_strategy" ? inputStrategy
        : section === "output_strategy" ? outputStrategy
          : section === "completion" ? completion
            : section === "unresolved_issues" ? unresolvedIssues
              : undefined;
  if (chunkSource !== undefined) {
    const chunked = manifestReceiptJsonChunks(chunkSource);
    items = chunked.items;
    sectionData = chunked.metadata;
  }
  const total = items.length;
  const pageItems = items.slice(offset, offset + limit);
  return {
    receipt_read_version: MANIFEST_CYCLE_RECEIPT_READ_VERSION,
    section,
    summary,
    section_data: sectionData,
    items: pageItems,
    pagination: section === "summary" ? null : {
      offset,
      limit,
      returned: pageItems.length,
      total,
      has_more: offset + pageItems.length < total,
      next_offset: offset + pageItems.length < total ? offset + pageItems.length : null,
    },
  };
}

export async function getManifestIntelligenceFoundation(db: D1Database, brandKey: string): Promise<JsonRecord> {
  const policy = await ensureManifestIntelligencePolicy(db, brandKey);
  const strategy = await getLatestManifestStrategyVersion(db, brandKey);
  const receipt = await getManifestCycleReceipt(db, { brandKey });
  const receiptRead = receipt ? buildManifestCycleReceiptRead(receipt, "summary") : null;
  return {
    foundation_version: MANIFEST_INTELLIGENCE_FOUNDATION_VERSION,
    policy,
    latest_strategy_version: strategy,
    latest_cycle_receipt: receiptRead?.summary ?? null,
  };
}
