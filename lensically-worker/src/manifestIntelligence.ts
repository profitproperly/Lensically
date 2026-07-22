export const MANIFEST_INTELLIGENCE_FOUNDATION_VERSION = "manifest-intelligence-foundation-v1";
export const MANIFEST_CYCLE_RECEIPT_VERSION = "manifest-cycle-receipt-v1";
export const MANIFEST_STRATEGY_VERSION_CONTRACT = "manifest-strategy-version-v1";
export const MANIFEST_EXPOSURE_LEDGER_VERSION = "manifest-exposure-ledger-v1";
export const MANIFEST_POST_HYPOTHESIS_VERSION = "manifest-post-hypothesis-v1";

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
  version: "manifest-follower-attribution-boundary-v1",
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

function followerAttributionKeys(value: unknown, path = "root"): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => followerAttributionKeys(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return [];
  const hits: string[] = [];
  for (const [key, child] of Object.entries(value as JsonRecord)) {
    const next = `${path}.${key}`;
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normalized.includes("follower") && !["followerattributionpolicy", "followersaccountlevelonly"].includes(normalized)) hits.push(next);
    hits.push(...followerAttributionKeys(child, next));
  }
  return hits;
}

export function validateManifestPostHypothesis(input: unknown): { ok: true; value: ManifestPostHypothesis } | { ok: false; errors: string[] } {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as JsonRecord : {};
  const errors: string[] = [];
  const forbidden = followerAttributionKeys(source);
  if (forbidden.length) errors.push(`follower_attribution_forbidden:${forbidden.join(",")}`);
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
      source_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
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
      scheduled_post_id INTEGER, status TEXT NOT NULL DEFAULT 'proposed', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  const existing = await db.prepare(
    `SELECT * FROM operator_manifest_exposure_snapshots WHERE cycle_id = ? LIMIT 1`,
  ).bind(input.cycleId).first<JsonRecord>();
  if (existing) return serializeExposure(existing);
  const dimensions = buildManifestExposureDimensions([...input.published, ...input.scheduled]);
  const sourceHash = await hash({ published: input.published, scheduled: input.scheduled, dimensions });
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO operator_manifest_exposure_snapshots (
      id, cycle_id, brand_key, ledger_version, as_of, timezone, horizon_start_local,
      horizon_end_local, published_json, scheduled_json, dimensions_json, source_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, input.cycleId, input.brandKey, MANIFEST_EXPOSURE_LEDGER_VERSION, input.asOf, input.timezone,
    input.horizonStartLocal ?? null, input.horizonEndLocal ?? null,
    stableManifestJson(input.published), stableManifestJson(input.scheduled), stableManifestJson(dimensions), sourceHash,
  ).run();
  const row = await db.prepare(`SELECT * FROM operator_manifest_exposure_snapshots WHERE id = ?`).bind(id).first<JsonRecord>();
  return serializeExposure(row ?? { id, dimensions_json: dimensions });
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
  if (existing) return serializeReceipt(existing);
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
  await db.prepare(
    `INSERT OR IGNORE INTO operator_manifest_cycle_receipt_events (
      id, cycle_id, brand_key, event_key, event_type, slot_key, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(), input.cycleId, input.brandKey, input.eventKey,
    input.eventType, input.slotKey ?? null, stableManifestJson(input.payload),
  ).run();
}

function serializeHypothesis(row: JsonRecord): JsonRecord {
  return {
    ...row,
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
       status = ?, updated_at = CURRENT_TIMESTAMP WHERE cycle_id = ? AND slot_key = ?`,
  ).bind(input.scheduledPostId ?? null, input.status, input.cycleId, input.slotKey).run();
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
  await db.prepare(
    `UPDATE operator_manifest_cycle_receipts SET status = ?, completion_json = COALESCE(completion_json, ?),
       unresolved_issues_json = ?, completed_at = COALESCE(completed_at, ?)
     WHERE cycle_id = ?`,
  ).bind(
    input.status, stableManifestJson(input.completion), stableManifestJson(input.unresolvedIssues ?? []),
    input.completedAt, input.cycleId,
  ).run();
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

export async function getManifestIntelligenceFoundation(db: D1Database, brandKey: string): Promise<JsonRecord> {
  const policy = await ensureManifestIntelligencePolicy(db, brandKey);
  const strategy = await getLatestManifestStrategyVersion(db, brandKey);
  const receipt = await getManifestCycleReceipt(db, { brandKey });
  return {
    foundation_version: MANIFEST_INTELLIGENCE_FOUNDATION_VERSION,
    policy,
    latest_strategy_version: strategy,
    latest_cycle_receipt: receipt,
  };
}
