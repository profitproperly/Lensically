export const MANIFEST_INTELLIGENCE_FOUNDATION_VERSION = "manifest-intelligence-foundation-v3";
export const MANIFEST_CYCLE_RECEIPT_VERSION = "manifest-cycle-receipt-v3";
export const MANIFEST_STRATEGY_VERSION_CONTRACT = "manifest-strategy-version-v1";
export const MANIFEST_CYCLE_STRATEGY_CONTRACT = "manifest-cycle-strategy-v1";
export const MANIFEST_EXPOSURE_LEDGER_VERSION = "manifest-exposure-ledger-v3";
export const MANIFEST_EVIDENCE_SNAPSHOT_VERSION = "manifest-evidence-snapshot-v2";
export const MANIFEST_EVIDENCE_PAGE_CONTRACT_VERSION = "manifest-evidence-page-v1";
export const MANIFEST_CANDIDATE_GATE_RECEIPT_VERSION = "manifest-candidate-gate-receipt-v1";
export const MANIFEST_POST_HYPOTHESIS_VERSION = "manifest-post-hypothesis-v3";
export const MANIFEST_CYCLE_RECEIPT_READ_VERSION = "manifest-cycle-receipt-read-v2";
export const MANIFEST_ANALYSIS_WINDOW_DAYS = 28;
export const MANIFEST_RECENT_EXPOSURE_HOURS = 72;
export const MANIFEST_EVIDENCE_PAGE_SIZE = 12;
export const MANIFEST_EVIDENCE_PAGE_MAX_BYTES = 12000;
export const MANIFEST_EVIDENCE_RESPONSE_MAX_BYTES = 20000;
export const MANIFEST_EVIDENCE_WRITE_MAX_ROWS = 100;
export const MANIFEST_EVIDENCE_WRITE_MAX_BYTES = 240000;


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
  kind: "saved_pattern" | "source_card";
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

export function chunkManifestEvidenceWriteRows<T>(
  rows: T[],
  maxRows = MANIFEST_EVIDENCE_WRITE_MAX_ROWS,
  maxBytes = MANIFEST_EVIDENCE_WRITE_MAX_BYTES,
): T[][] {
  const boundedRows = Math.max(1, Math.trunc(maxRows));
  const boundedBytes = Math.max(1024, Math.trunc(maxBytes));
  const chunks: T[][] = [];
  let current: T[] = [];
  let currentBytes = 2;
  for (const row of rows) {
    const rowBytes = new TextEncoder().encode(stableManifestJson(row)).length + (current.length ? 1 : 0);
    if (current.length && (current.length >= boundedRows || currentBytes + rowBytes > boundedBytes)) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(row);
    currentBytes += rowBytes;
  }
  if (current.length) chunks.push(current);
  return chunks;
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
    const explicitPositiveAttribution = /\b(?:this|that|the|each|a)\s+(?:post|slot|family|experiment|day|period|campaign|cycle|schedule)\b.{0,120}\b(?:generated|gained|added|drove|produced|brought|converted|caused)\b.{0,80}\bfollowers?\b/.test(normalized)
      || /\bfollowers?\b.{0,120}\b(?:came|come|coming|generated|gained|added|driven|produced|brought|converted)\s+(?:from|by)\b/.test(normalized);
    const explicitPolicyBoundary = /\b(?:do not|don't|never|must not|should not|cannot|can't)\s+(?:infer|claim|attribute|connect|tie)\b.{0,120}\bfollowers?\b/.test(normalized)
      || /\bfollowers?\b.{0,120}\b(?:cannot|can't|must not|should not)\s+be\s+(?:attributed|connected|tied)\b/.test(normalized)
      || /\bfollowers?\b.{0,120}\b(?:are|is)\s+not\s+(?:attributed|attributable|connected|tied)\b/.test(normalized)
      || /\bfollowers?\b.{0,120}\baccount[- ]level(?: context)? only\b/.test(normalized)
      || /\baccount[- ]level(?: follower)? (?:context|checkpoint|trajectory|tracking) only\b/.test(normalized);
    const scopedFollowerClaim = /\b(?:this|that|the|each|a)\s+(?:post|slot|family|experiment|day|period|campaign|cycle|schedule)\b.{0,120}\bfollowers?\b/.test(normalized)
      || /\bfollowers?\b.{0,120}\b(?:from|caused by|because of|attribut(?:e|ed|ion)|generated by)\b/.test(normalized);
    return explicitPositiveAttribution || (scopedFollowerClaim && !explicitPolicyBoundary)
      ? [`${path}:text_claim`]
      : [];
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
            const allowedPolicy = new Set([
        "followerattributionpolicy",
        "followerattributionboundary",
        "followerboundary",
        "followerpolicy",
        "followersaccountlevelonly",
      ]).has(normalized);
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
  const allowed = new Set(["saved_pattern", "source_card"]);
  const errors: string[] = [];
  if (!allowed.has(kind)) errors.push("source_context_kind_invalid_source_backed_only");
  const value: ManifestSourceContext = {
    kind,
    source_type: text(source.source_type, 120) || kind,
    source_identity_key: text(source.source_identity_key, 500) || null,
    source_card_id: text(source.source_card_id, 160) || null,
    source_selection_id: text(source.source_selection_id, 160) || null,
    internal_source_id: text(source.internal_source_id, 500) || null,
    source_url: text(source.source_url, 2000) || null,
  };
  if (!value.source_card_id && !value.source_selection_id && !value.source_identity_key && !value.internal_source_id) {
    errors.push("source_context_identity_required");
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

function count(map: Record<string, number>, key: unknown): void {
  const normalized = text(key, 500).toLowerCase();
  if (normalized) map[normalized] = (map[normalized] ?? 0) + 1;
}

function closingPhrase(value: string): string {
  const sentences = value.split(/(?<=[.!?])\s+|\n+/).map((item) => item.trim()).filter(Boolean);
  return (sentences.at(-1) ?? "").slice(0, 240);
}

export function buildManifestExposureDimensions(records: JsonRecord[]): JsonRecord {
  const families: Record<string, number> = {};
  const sourceFamilies: Record<string, number> = {};
  const hooks: Record<string, number> = {};
  const premises: Record<string, number> = {};
  const topics: Record<string, number> = {};
  const formats: Record<string, number> = {};
  const participationMechanisms: Record<string, number> = {};
  const rewards: Record<string, number> = {};
  const emotionalProducts: Record<string, number> = {};
  const openings: Record<string, number> = {};
  const closings: Record<string, number> = {};
  const architectures: Record<string, number> = {};
  const modes: Record<string, number> = {};
  const repeatedEntities: Record<string, number> = {};
  let questions = 0;
  for (const record of records) {
    const strategy = record.strategy && typeof record.strategy === "object" && !Array.isArray(record.strategy)
      ? record.strategy as JsonRecord : {};
    const value = text(record.text, 20000);
    const opening = text(record.opening_phrase ?? strategy.opening_phrase, 240)
      || value.split(/\n|(?<=[.!?])\s+/)[0]?.trim().slice(0, 240)
      || "";
    count(families, strategy.family_key ?? record.family_key);
    count(sourceFamilies, strategy.source_family_key ?? strategy.source_identity_key ?? record.source_identity_key);
    count(hooks, strategy.hook_style ?? record.hook_style);
    count(premises, strategy.premise_key ?? strategy.premise ?? record.premise_key);
    count(topics, strategy.topic ?? strategy.pillar ?? record.topic ?? record.lane_key);
    count(formats, strategy.format ?? record.format);
    count(participationMechanisms, strategy.participation_mechanism ?? strategy.question_type ?? record.participation_mechanism);
    count(rewards, strategy.audience_reward ?? record.audience_reward);
    count(emotionalProducts, strategy.emotional_product ?? strategy.required_product ?? record.emotional_product);
    count(openings, opening);
    count(closings, closingPhrase(value));
    count(architectures, strategy.sentence_architecture ?? record.sentence_architecture);
    count(modes, strategy.generation_mode ?? record.generation_mode);
    for (const match of value.matchAll(/\$\s?[0-9][0-9,]*(?:\.[0-9]+)?(?:\s?(?:million|billion|thousand|k|m|b))?/gi)) {
      count(repeatedEntities, match[0].replace(/\s+/g, " "));
    }
    if (value.includes("?")) questions += 1;
  }
  return {
    version: MANIFEST_EXPOSURE_LEDGER_VERSION,
    purpose: "Use these dimensions only for recent clustering, comparable-post discovery, experiment evaluation, or repeated strong/weak execution. Counts alone never prove fatigue.",
    record_count: records.length,
    family_counts: families,
    source_family_counts: sourceFamilies,
    hook_counts: hooks,
    premise_counts: premises,
    topic_counts: topics,
    format_counts: formats,
    participation_mechanism_counts: participationMechanisms,
    audience_reward_counts: rewards,
    emotional_product_counts: emotionalProducts,
    opening_counts: openings,
    closing_counts: closings,
    sentence_architecture_counts: architectures,
    generation_mode_counts: modes,
    repeated_entity_counts: repeatedEntities,
    question_count: questions,
  };
}

async function ensureColumns(db: D1Database, columns: Array<{
  table: string;
  column: string;
  definition: string;
}>): Promise<void> {
  const tableInfo = await db.batch(columns.map(({ table }) => db.prepare(`PRAGMA table_info(${table})`)));
    const missing = columns.filter(({ column }, index) => {
    const rows = (tableInfo[index]?.results ?? []) as Array<{ name?: string }>;
    return rows.length > 0 && !rows.some((row) => row.name === column);
  });
  if (missing.length > 0) {
    await db.batch(missing.map(({ table, column, definition }) =>
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)));
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
        `CREATE TABLE IF NOT EXISTS operator_manifest_evidence_snapshots (
      id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL UNIQUE, brand_key TEXT NOT NULL,
      snapshot_version TEXT NOT NULL, as_of TEXT NOT NULL, timezone TEXT NOT NULL,
      window_days INTEGER NOT NULL DEFAULT 28, window_start TEXT NOT NULL, window_end TEXT NOT NULL,
      post_count INTEGER NOT NULL DEFAULT 0, mature_count INTEGER NOT NULL DEFAULT 0,
      immature_count INTEGER NOT NULL DEFAULT 0, incomplete_count INTEGER NOT NULL DEFAULT 0,
            page_size INTEGER NOT NULL DEFAULT 12, page_count INTEGER NOT NULL DEFAULT 0,
      page_byte_budget INTEGER NOT NULL DEFAULT 12000,
      benchmarks_json TEXT NOT NULL DEFAULT '{}', previous_benchmarks_json TEXT NOT NULL DEFAULT '{}',
      recent_exposure_json TEXT NOT NULL DEFAULT '{}', future_schedule_json TEXT NOT NULL DEFAULT '[]',
      hard_bans_json TEXT NOT NULL DEFAULT '[]', experiments_json TEXT NOT NULL DEFAULT '[]',
      source_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS operator_manifest_evidence_posts (
      id TEXT PRIMARY KEY, snapshot_id TEXT NOT NULL, brand_key TEXT NOT NULL,
      published_post_id TEXT NOT NULL, scheduled_post_id INTEGER, text TEXT NOT NULL,
      published_at TEXT NOT NULL, age_hours REAL NOT NULL, maturity_state TEXT NOT NULL,
      primary_likes INTEGER, like_rate REAL, metrics_json TEXT NOT NULL DEFAULT '{}',
      maturity_snapshots_json TEXT NOT NULL DEFAULT '[]', lineage_json TEXT NOT NULL DEFAULT '{}',
      classification_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(snapshot_id, published_post_id))`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_evidence_pages (
      id TEXT PRIMARY KEY, snapshot_id TEXT NOT NULL, cycle_id TEXT NOT NULL, brand_key TEXT NOT NULL,
      page_index INTEGER NOT NULL, page_contract_version TEXT NOT NULL, item_count INTEGER NOT NULL,
      byte_count INTEGER NOT NULL, evidence_types_json TEXT NOT NULL DEFAULT '[]',
      items_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(snapshot_id, page_index))`,
    `CREATE INDEX IF NOT EXISTS idx_manifest_evidence_pages_snapshot
      ON operator_manifest_evidence_pages (snapshot_id, page_index ASC)`,
    `CREATE INDEX IF NOT EXISTS idx_manifest_evidence_posts_page
      ON operator_manifest_evidence_posts (snapshot_id, published_at DESC, published_post_id DESC)`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_analysis_page_reads (
      id TEXT PRIMARY KEY, snapshot_id TEXT NOT NULL, cycle_id TEXT NOT NULL, brand_key TEXT NOT NULL,
      page_index INTEGER NOT NULL, read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(snapshot_id, page_index))`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_cycle_strategies (
      id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL UNIQUE, brand_key TEXT NOT NULL, snapshot_id TEXT NOT NULL,
      contract_version TEXT NOT NULL, account_conclusion_json TEXT NOT NULL,
      content_focus_json TEXT NOT NULL, benchmarks_json TEXT NOT NULL,
      strongest_json TEXT NOT NULL DEFAULT '[]', weakest_json TEXT NOT NULL DEFAULT '[]',
      directives_json TEXT NOT NULL, experiments_json TEXT NOT NULL DEFAULT '[]',
      risks_json TEXT NOT NULL DEFAULT '[]', lineup_json TEXT NOT NULL,
      strategy_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'locked',
      locked_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(brand_key, strategy_hash))`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_cycle_plan_items (
      id TEXT PRIMARY KEY, strategy_id TEXT NOT NULL, cycle_id TEXT NOT NULL, brand_key TEXT NOT NULL,
      slot_key TEXT NOT NULL, slot_date TEXT NOT NULL, slot_time TEXT NOT NULL,
      family_key TEXT NOT NULL, strategic_role TEXT NOT NULL, generation_mode TEXT NOT NULL,
      source_kind TEXT NOT NULL, source_card_id TEXT, source_selection_id TEXT,
      audience_reward TEXT NOT NULL, hook_direction TEXT NOT NULL, placement_reason TEXT NOT NULL,
      nearby_avoid_json TEXT NOT NULL DEFAULT '[]', exploration_mode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned', revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cycle_id, slot_key))`,
    `CREATE INDEX IF NOT EXISTS idx_manifest_cycle_plan_items_strategy
      ON operator_manifest_cycle_plan_items (strategy_id, slot_key ASC)`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_candidate_gate_receipts (
      id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL, strategy_id TEXT NOT NULL,
      plan_item_id TEXT NOT NULL, brand_key TEXT NOT NULL, slot_key TEXT NOT NULL,
      candidate_hash TEXT NOT NULL, receipt_version TEXT NOT NULL, results_json TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cycle_id, slot_key, candidate_hash))`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_hard_bans (
      id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, rule_key TEXT NOT NULL,
      description TEXT NOT NULL, rule_type TEXT NOT NULL, pattern TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'manifest_generation', pass_examples_json TEXT NOT NULL DEFAULT '[]',
      fail_examples_json TEXT NOT NULL DEFAULT '[]', source_authority TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(brand_key, rule_key))`,
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
    await db.batch(statements.map((sql) => db.prepare(sql)));
  await ensureColumns(db, [
    { table: "operator_autonomous_growth_cycles", column: "receipt_id", definition: "TEXT" },
    { table: "operator_autonomous_growth_cycles", column: "strategy_version_id", definition: "TEXT" },
        { table: "operator_autonomous_growth_cycles", column: "exposure_snapshot_id", definition: "TEXT" },
    { table: "operator_autonomous_growth_cycles", column: "evidence_snapshot_id", definition: "TEXT" },
    { table: "operator_autonomous_growth_cycles", column: "cycle_strategy_id", definition: "TEXT" },
        { table: "operator_autonomous_lineup_items", column: "hypothesis_id", definition: "TEXT" },
    { table: "operator_autonomous_lineup_items", column: "cycle_strategy_id", definition: "TEXT" },
    { table: "operator_autonomous_lineup_items", column: "cycle_plan_item_id", definition: "TEXT" },
    { table: "operator_autonomous_lineup_items", column: "gate_receipt_id", definition: "TEXT" },
        { table: "operator_autonomous_lineup_items", column: "source_selection_id", definition: "TEXT" },
    { table: "operator_manifest_evidence_snapshots", column: "page_byte_budget", definition: "INTEGER NOT NULL DEFAULT 12000" },
    { table: "operator_manifest_exposure_snapshots", column: "revision", definition: "INTEGER NOT NULL DEFAULT 1" },
    { table: "operator_manifest_exposure_snapshots", column: "updated_at", definition: "TEXT" },
    { table: "operator_manifest_post_hypotheses", column: "revision", definition: "INTEGER NOT NULL DEFAULT 1" },
    { table: "operator_manifest_post_hypotheses", column: "locked_at", definition: "TEXT" },
  ]);
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

function numeric(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = Math.max(0, Math.min(sorted.length - 1, (sorted.length - 1) * fraction));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower] ?? null;
  const weight = position - lower;
  return Number(((sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight).toFixed(4));
}

export function buildManifestLikesBenchmarks(posts: JsonRecord[]): JsonRecord {
  const mature = posts.filter((post) => String(post.maturity_state) === "mature" && Number.isFinite(Number(post.primary_likes)));
  const likes = mature.map((post) => Number(post.primary_likes));
  const total = posts.length;
  return {
    version: "manifest-likes-first-benchmarks-v1",
    primary_metric: "24_hour_likes",
    mature_sample_size: mature.length,
    total_post_count: total,
    evidence_completeness: total > 0 ? Number((mature.length / total).toFixed(6)) : 0,
    minimum_likes: percentile(likes, 0),
    p25_likes: percentile(likes, 0.25),
    median_likes: percentile(likes, 0.5),
    p75_likes: percentile(likes, 0.75),
    p90_likes: percentile(likes, 0.9),
    maximum_likes: percentile(likes, 1),
    interpretation: "Rank mature posts primarily by 24-hour likes. Use like rate and other engagement only to diagnose distribution and response quality.",
  };
}

function manifestEvidenceJsonBytes(value: unknown): number {
  return new TextEncoder().encode(stableManifestJson(value)).byteLength;
}

function manifestEvidenceCollectionItems(evidenceType: string, value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({ evidence_type: evidenceType, item_index: index, data: item }));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as JsonRecord).flatMap(([key, child]) => {
      if (Array.isArray(child)) {
        return child.map((item, index) => ({ evidence_type: evidenceType, section_key: key, item_index: index, data: item }));
      }
      return [{ evidence_type: evidenceType, section_key: key, data: child }];
    });
  }
  return [{ evidence_type: evidenceType, data: value }];
}

export function buildManifestEvidencePages(input: {
  summary: JsonRecord;
  posts: JsonRecord[];
  benchmarks: JsonRecord;
  previousBenchmarks?: JsonRecord;
  recentExposure: JsonRecord;
  futureSchedule: JsonRecord[];
  hardBans: JsonRecord[];
  experiments: JsonRecord[];
  maxItems?: number;
  maxBytes?: number;
}): JsonRecord[] {
  const maxItems = Math.max(1, Math.min(25, Math.trunc(input.maxItems ?? MANIFEST_EVIDENCE_PAGE_SIZE)));
  const maxBytes = Math.max(4000, Math.min(18000, Math.trunc(input.maxBytes ?? MANIFEST_EVIDENCE_PAGE_MAX_BYTES)));
  const items: JsonRecord[] = [
    { evidence_type: "snapshot_summary", data: input.summary },
    { evidence_type: "likes_first_benchmarks", data: input.benchmarks },
    { evidence_type: "previous_likes_first_benchmarks", data: input.previousBenchmarks ?? {} },
    ...manifestEvidenceCollectionItems("recent_exposure", input.recentExposure),
    ...manifestEvidenceCollectionItems("future_schedule", input.futureSchedule),
    ...manifestEvidenceCollectionItems("hard_ban", input.hardBans),
    ...manifestEvidenceCollectionItems("experiment", input.experiments),
    ...input.posts.map((post, index) => ({ evidence_type: "published_post", item_index: index, data: post })),
  ];
  const pages: JsonRecord[] = [];
  let current: JsonRecord[] = [];
  const flush = (): void => {
    if (!current.length) return;
    const payload = { page_contract_version: MANIFEST_EVIDENCE_PAGE_CONTRACT_VERSION, items: current };
    const evidenceTypes = Array.from(new Set(current.map((item) => text(item.evidence_type, 120)).filter(Boolean)));
    pages.push({
      page_index: pages.length,
      item_count: current.length,
      byte_count: manifestEvidenceJsonBytes(payload),
      evidence_types: evidenceTypes,
      items: current,
    });
    current = [];
  };
  for (const item of items) {
    const singleBytes = manifestEvidenceJsonBytes({ page_contract_version: MANIFEST_EVIDENCE_PAGE_CONTRACT_VERSION, items: [item] });
    if (singleBytes > maxBytes) throw new Error("manifest_evidence_item_exceeds_page_budget");
    const candidate = [...current, item];
    const candidateBytes = manifestEvidenceJsonBytes({ page_contract_version: MANIFEST_EVIDENCE_PAGE_CONTRACT_VERSION, items: candidate });
    if (current.length && (candidate.length > maxItems || candidateBytes > maxBytes)) flush();
    current.push(item);
  }
  flush();
  return pages;
}

function compactEvidenceSnapshotManifest(snapshot: JsonRecord): JsonRecord {
  return {
    id: snapshot.id ?? null,
    cycle_id: snapshot.cycle_id ?? null,
    brand_key: snapshot.brand_key ?? null,
    snapshot_version: snapshot.snapshot_version ?? MANIFEST_EVIDENCE_SNAPSHOT_VERSION,
    as_of: snapshot.as_of ?? null,
    timezone: snapshot.timezone ?? null,
    window_days: numeric(snapshot.window_days, MANIFEST_ANALYSIS_WINDOW_DAYS),
    window_start: snapshot.window_start ?? null,
    window_end: snapshot.window_end ?? null,
    post_count: numeric(snapshot.post_count),
    mature_count: numeric(snapshot.mature_count),
    immature_count: numeric(snapshot.immature_count),
    incomplete_count: numeric(snapshot.incomplete_count),
    page_size: numeric(snapshot.page_size, MANIFEST_EVIDENCE_PAGE_SIZE),
    page_count: numeric(snapshot.page_count),
    page_byte_budget: numeric(snapshot.page_byte_budget, MANIFEST_EVIDENCE_PAGE_MAX_BYTES),
    source_hash: snapshot.source_hash ?? null,
  };
}

function serializeEvidenceSnapshot(row: JsonRecord): JsonRecord {
  return {
    ...row,
    window_days: numeric(row.window_days, MANIFEST_ANALYSIS_WINDOW_DAYS),
    post_count: numeric(row.post_count),
    mature_count: numeric(row.mature_count),
    immature_count: numeric(row.immature_count),
    incomplete_count: numeric(row.incomplete_count),
        page_size: numeric(row.page_size, MANIFEST_EVIDENCE_PAGE_SIZE),
    page_count: numeric(row.page_count),
    page_byte_budget: numeric(row.page_byte_budget, MANIFEST_EVIDENCE_PAGE_MAX_BYTES),
    benchmarks: parseJson(row.benchmarks_json, {}),
    previous_benchmarks: parseJson(row.previous_benchmarks_json, {}),
    recent_exposure: parseJson(row.recent_exposure_json, {}),
    future_schedule: parseJson(row.future_schedule_json, []),
    hard_bans: parseJson(row.hard_bans_json, []),
    experiments: parseJson(row.experiments_json, []),
  };
}

export async function createManifestEvidenceSnapshot(db: D1Database, input: {
  cycleId: string; brandKey: string; asOf: string; timezone: string;
  windowStart: string; windowEnd: string; posts: JsonRecord[];
  benchmarks: JsonRecord; previousBenchmarks?: JsonRecord;
  recentExposure: JsonRecord; futureSchedule: JsonRecord[];
  hardBans: JsonRecord[]; experiments: JsonRecord[]; pageSize?: number;
}): Promise<JsonRecord> {
  await ensureManifestIntelligenceTables(db);
    const pageSize = Math.max(1, Math.min(25, Math.trunc(input.pageSize ?? MANIFEST_EVIDENCE_PAGE_SIZE)));
  const pageByteBudget = MANIFEST_EVIDENCE_PAGE_MAX_BYTES;
  const postCount = input.posts.length;
  const matureCount = input.posts.filter((post) => post.maturity_state === "mature").length;
  const immatureCount = input.posts.filter((post) => post.maturity_state === "immature").length;
  const incompleteCount = input.posts.filter((post) => post.maturity_state === "evidence_incomplete").length;
  const pagePlan = buildManifestEvidencePages({
    summary: {
      as_of: input.asOf,
      timezone: input.timezone,
      window_days: MANIFEST_ANALYSIS_WINDOW_DAYS,
      window_start: input.windowStart,
      window_end: input.windowEnd,
      post_count: postCount,
      mature_count: matureCount,
      immature_count: immatureCount,
      incomplete_count: incompleteCount,
      primary_metric: "24_hour_likes",
      source_backed_generation_only: true,
    },
    posts: input.posts,
    benchmarks: input.benchmarks,
    previousBenchmarks: input.previousBenchmarks,
    recentExposure: input.recentExposure,
    futureSchedule: input.futureSchedule,
    hardBans: input.hardBans,
    experiments: input.experiments,
    maxItems: pageSize,
    maxBytes: pageByteBudget,
  });
  const pageCount = pagePlan.length;
  const sourceHash = await hash({
    page_contract_version: MANIFEST_EVIDENCE_PAGE_CONTRACT_VERSION,
    page_size: pageSize,
    page_byte_budget: pageByteBudget,
    posts: input.posts,
    benchmarks: input.benchmarks,
    previous_benchmarks: input.previousBenchmarks ?? {},
    recent_exposure: input.recentExposure,
    future_schedule: input.futureSchedule,
    hard_bans: input.hardBans,
    experiments: input.experiments,
  });
  const existing = await db.prepare(`SELECT * FROM operator_manifest_evidence_snapshots WHERE cycle_id = ? LIMIT 1`)
    .bind(input.cycleId).first<JsonRecord>();
  const snapshotId = text(existing?.id, 160) || crypto.randomUUID();
  if (existing && String(existing.brand_key) !== input.brandKey) throw new Error("manifest_evidence_cycle_brand_conflict");
  await db.prepare(`INSERT INTO operator_manifest_evidence_snapshots (
      id, cycle_id, brand_key, snapshot_version, as_of, timezone, window_days,
            window_start, window_end, post_count, mature_count, immature_count, incomplete_count,
      page_size, page_count, page_byte_budget, benchmarks_json, previous_benchmarks_json, recent_exposure_json,
      future_schedule_json, hard_bans_json, experiments_json, source_hash, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(cycle_id) DO UPDATE SET
      snapshot_version = excluded.snapshot_version, as_of = excluded.as_of, timezone = excluded.timezone,
      window_days = excluded.window_days, window_start = excluded.window_start, window_end = excluded.window_end,
            post_count = excluded.post_count, mature_count = excluded.mature_count,
      immature_count = excluded.immature_count, incomplete_count = excluded.incomplete_count,
      page_size = excluded.page_size, page_count = excluded.page_count,
      page_byte_budget = excluded.page_byte_budget,
      benchmarks_json = excluded.benchmarks_json, previous_benchmarks_json = excluded.previous_benchmarks_json,
      recent_exposure_json = excluded.recent_exposure_json, future_schedule_json = excluded.future_schedule_json,
      hard_bans_json = excluded.hard_bans_json, experiments_json = excluded.experiments_json,
      source_hash = excluded.source_hash, updated_at = CURRENT_TIMESTAMP`).bind(
      snapshotId, input.cycleId, input.brandKey, MANIFEST_EVIDENCE_SNAPSHOT_VERSION,
            input.asOf, input.timezone, MANIFEST_ANALYSIS_WINDOW_DAYS, input.windowStart, input.windowEnd,
      postCount, matureCount, immatureCount, incompleteCount, pageSize, pageCount, pageByteBudget,
      stableManifestJson(input.benchmarks), stableManifestJson(input.previousBenchmarks ?? {}),
      stableManifestJson(input.recentExposure), stableManifestJson(input.futureSchedule),
      stableManifestJson(input.hardBans), stableManifestJson(input.experiments), sourceHash,
    ).run();
  if (!existing || String(existing.source_hash) !== sourceHash) {
        await db.batch([
      db.prepare(`DELETE FROM operator_manifest_evidence_posts WHERE snapshot_id = ?`).bind(snapshotId),
      db.prepare(`DELETE FROM operator_manifest_evidence_pages WHERE snapshot_id = ?`).bind(snapshotId),
      db.prepare(`DELETE FROM operator_manifest_analysis_page_reads WHERE snapshot_id = ?`).bind(snapshotId),
    ]);
            const pageWriteRows = pagePlan.map((page) => ({
      id: crypto.randomUUID(),
      snapshot_id: snapshotId,
      cycle_id: input.cycleId,
      brand_key: input.brandKey,
      page_index: numeric(page.page_index),
      page_contract_version: MANIFEST_EVIDENCE_PAGE_CONTRACT_VERSION,
      item_count: numeric(page.item_count),
      byte_count: numeric(page.byte_count),
      evidence_types_json: stableManifestJson(page.evidence_types ?? []),
      items_json: stableManifestJson(page.items ?? []),
    }));
    for (const chunk of chunkManifestEvidenceWriteRows(pageWriteRows)) {
      await db.prepare(`INSERT INTO operator_manifest_evidence_pages (
          id, snapshot_id, cycle_id, brand_key, page_index, page_contract_version,
          item_count, byte_count, evidence_types_json, items_json
        )
        SELECT
          json_extract(value, '$.id'),
          json_extract(value, '$.snapshot_id'),
          json_extract(value, '$.cycle_id'),
          json_extract(value, '$.brand_key'),
          CAST(json_extract(value, '$.page_index') AS INTEGER),
          json_extract(value, '$.page_contract_version'),
          CAST(json_extract(value, '$.item_count') AS INTEGER),
          CAST(json_extract(value, '$.byte_count') AS INTEGER),
          json_extract(value, '$.evidence_types_json'),
          json_extract(value, '$.items_json')
        FROM json_each(?)`)
        .bind(stableManifestJson(chunk)).run();
    }
    const postWriteRows = input.posts.map((post) => ({
      id: crypto.randomUUID(),
      snapshot_id: snapshotId,
      brand_key: input.brandKey,
      published_post_id: String(post.published_post_id ?? post.post_id ?? ""),
      scheduled_post_id: post.scheduled_post_id === null || post.scheduled_post_id === undefined
        ? null
        : numeric(post.scheduled_post_id),
      text: text(post.text ?? post.post_text, 20000),
      published_at: text(post.published_at ?? post.post_timestamp, 100),
      age_hours: numeric(post.age_hours),
      maturity_state: text(post.maturity_state, 80),
      primary_likes: post.primary_likes === null || post.primary_likes === undefined
        ? null
        : numeric(post.primary_likes),
      like_rate: post.like_rate === null || post.like_rate === undefined
        ? null
        : numeric(post.like_rate),
      metrics_json: stableManifestJson(post.metrics ?? {}),
      maturity_snapshots_json: stableManifestJson(post.maturity_snapshots ?? []),
      lineage_json: stableManifestJson(post.lineage ?? {}),
      classification_json: stableManifestJson(post.classification ?? {}),
    }));
    for (const chunk of chunkManifestEvidenceWriteRows(postWriteRows)) {
      await db.prepare(`INSERT INTO operator_manifest_evidence_posts (
          id, snapshot_id, brand_key, published_post_id, scheduled_post_id, text, published_at,
          age_hours, maturity_state, primary_likes, like_rate, metrics_json,
          maturity_snapshots_json, lineage_json, classification_json
        )
        SELECT
          json_extract(value, '$.id'),
          json_extract(value, '$.snapshot_id'),
          json_extract(value, '$.brand_key'),
          json_extract(value, '$.published_post_id'),
          CAST(json_extract(value, '$.scheduled_post_id') AS INTEGER),
          json_extract(value, '$.text'),
          json_extract(value, '$.published_at'),
          CAST(json_extract(value, '$.age_hours') AS REAL),
          json_extract(value, '$.maturity_state'),
          CAST(json_extract(value, '$.primary_likes') AS INTEGER),
          CAST(json_extract(value, '$.like_rate') AS REAL),
          json_extract(value, '$.metrics_json'),
          json_extract(value, '$.maturity_snapshots_json'),
          json_extract(value, '$.lineage_json'),
          json_extract(value, '$.classification_json')
        FROM json_each(?)`)
        .bind(stableManifestJson(chunk)).run();
    }

  }
  const row = await db.prepare(`SELECT * FROM operator_manifest_evidence_snapshots WHERE id = ?`).bind(snapshotId).first<JsonRecord>();
  return { ...serializeEvidenceSnapshot(row ?? { id: snapshotId }), refreshed: Boolean(existing), source_changed: !existing || String(existing.source_hash) !== sourceHash };
}

export async function readManifestEvidencePage(db: D1Database, input: {
  brandKey: string; cycleId: string; snapshotId?: string | null; pageIndex: number;
}): Promise<JsonRecord> {
  const snapshot = input.snapshotId
    ? await db.prepare(`SELECT * FROM operator_manifest_evidence_snapshots WHERE id = ? AND cycle_id = ? AND brand_key = ? LIMIT 1`)
      .bind(input.snapshotId, input.cycleId, input.brandKey).first<JsonRecord>()
    : await db.prepare(`SELECT * FROM operator_manifest_evidence_snapshots WHERE cycle_id = ? AND brand_key = ? LIMIT 1`)
      .bind(input.cycleId, input.brandKey).first<JsonRecord>();
  if (!snapshot) throw new Error("manifest_evidence_snapshot_not_found");
    const serialized = serializeEvidenceSnapshot(snapshot);
  const pageCount = numeric(serialized.page_count);
  const pageIndex = Math.trunc(input.pageIndex);
  if (pageIndex < 0 || pageIndex >= pageCount) throw new Error("manifest_evidence_page_out_of_range");
  const pageRow = await db.prepare(`SELECT * FROM operator_manifest_evidence_pages
      WHERE snapshot_id = ? AND cycle_id = ? AND brand_key = ? AND page_index = ? LIMIT 1`)
    .bind(snapshot.id, input.cycleId, input.brandKey, pageIndex).first<JsonRecord>();
  if (!pageRow) throw new Error("manifest_evidence_page_missing");
  const items = parseJson(pageRow.items_json, []) as JsonRecord[];
  if (!Array.isArray(items) || items.length !== numeric(pageRow.item_count)) {
    throw new Error("manifest_evidence_page_integrity_failed");
  }
  const storedPageBytes = numeric(pageRow.byte_count);
  const actualPageBytes = manifestEvidenceJsonBytes({
    page_contract_version: pageRow.page_contract_version,
    items,
  });
  if (actualPageBytes !== storedPageBytes || actualPageBytes > MANIFEST_EVIDENCE_PAGE_MAX_BYTES) {
    throw new Error("manifest_evidence_page_integrity_failed");
  }
  const consumedRow = await db.prepare(`SELECT COUNT(*) AS total FROM operator_manifest_analysis_page_reads WHERE snapshot_id = ?`)
    .bind(snapshot.id).first<JsonRecord>();
  const currentRead = await db.prepare(`SELECT id FROM operator_manifest_analysis_page_reads
      WHERE snapshot_id = ? AND page_index = ? LIMIT 1`)
    .bind(snapshot.id, pageIndex).first<JsonRecord>();
  const consumedPageCount = numeric(consumedRow?.total) + (currentRead ? 0 : 1);
  const response: JsonRecord = {
    success: true,
    complete_page: true,
    snapshot: compactEvidenceSnapshotManifest(serialized),
    page_contract_version: pageRow.page_contract_version,
    page_index: pageIndex,
    page_byte_count: storedPageBytes,
    evidence_types: parseJson(pageRow.evidence_types_json, []),
    items,
    pagination: {
      page_size: numeric(serialized.page_size, MANIFEST_EVIDENCE_PAGE_SIZE),
      page_count: pageCount,
      returned: items.length,
      has_more: pageIndex + 1 < pageCount,
      next_page_index: pageIndex + 1 < pageCount ? pageIndex + 1 : null,
    },
    consumption: {
      consumed_page_count: consumedPageCount,
      required_page_count: pageCount,
      complete: consumedPageCount >= pageCount,
    },
    response_bytes: 0,
  };
  response.response_bytes = manifestEvidenceJsonBytes(response);
  if (numeric(response.response_bytes) > MANIFEST_EVIDENCE_RESPONSE_MAX_BYTES) {
    throw new Error("manifest_evidence_response_exceeds_payload_budget");
  }
  await db.prepare(`INSERT INTO operator_manifest_analysis_page_reads (
      id, snapshot_id, cycle_id, brand_key, page_index
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(snapshot_id, page_index) DO UPDATE SET read_at = CURRENT_TIMESTAMP`)
    .bind(crypto.randomUUID(), snapshot.id, input.cycleId, input.brandKey, pageIndex).run();
  return response;
}

export async function getManifestEvidenceConsumptionState(db: D1Database, cycleId: string, brandKey: string): Promise<JsonRecord> {
  const snapshot = await db.prepare(`SELECT * FROM operator_manifest_evidence_snapshots WHERE cycle_id = ? AND brand_key = ? LIMIT 1`)
    .bind(cycleId, brandKey).first<JsonRecord>();
  if (!snapshot) return { complete: false, error: "manifest_evidence_snapshot_not_found" };
  const row = await db.prepare(`SELECT COUNT(*) AS total FROM operator_manifest_analysis_page_reads WHERE snapshot_id = ?`)
    .bind(snapshot.id).first<JsonRecord>();
  const required = numeric(snapshot.page_count);
  const consumed = numeric(row?.total);
  return { snapshot_id: snapshot.id, required_page_count: required, consumed_page_count: consumed, complete: consumed >= required };
}

export async function syncManifestHardBans(db: D1Database, brandKey: string, rules: JsonRecord[]): Promise<JsonRecord[]> {
  await ensureManifestIntelligenceTables(db);
  const writeRows = rules.map((rule) => {
    const ruleKey = text(rule.rule_key ?? rule.id, 240);
    const pattern = text(rule.pattern ?? rule.body ?? rule.description, 8000);
    if (!ruleKey || !pattern) return null;
    return {
      id: crypto.randomUUID(),
      brand_key: brandKey,
      rule_key: ruleKey,
      description: text(rule.description ?? rule.title, 2000) || ruleKey,
      rule_type: text(rule.rule_type, 80) || "semantic_rule",
      pattern,
      scope: text(rule.scope, 160) || "manifest_generation",
      pass_examples_json: stableManifestJson(rule.pass_examples ?? []),
      fail_examples_json: stableManifestJson(rule.fail_examples ?? []),
      source_authority: text(rule.source_authority ?? rule.source, 500) || "owner_memory",
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);
  for (const chunk of chunkManifestEvidenceWriteRows(writeRows)) {
    await db.prepare(`INSERT INTO operator_manifest_hard_bans (
        id, brand_key, rule_key, description, rule_type, pattern, scope,
        pass_examples_json, fail_examples_json, source_authority, active
      )
      SELECT
        json_extract(value, '$.id'),
        json_extract(value, '$.brand_key'),
        json_extract(value, '$.rule_key'),
        json_extract(value, '$.description'),
        json_extract(value, '$.rule_type'),
        json_extract(value, '$.pattern'),
        json_extract(value, '$.scope'),
        json_extract(value, '$.pass_examples_json'),
        json_extract(value, '$.fail_examples_json'),
        json_extract(value, '$.source_authority'),
        1
            FROM json_each(?)
      WHERE true
      ON CONFLICT(brand_key, rule_key) DO UPDATE SET

        description = excluded.description, rule_type = excluded.rule_type, pattern = excluded.pattern,
        scope = excluded.scope, pass_examples_json = excluded.pass_examples_json,
        fail_examples_json = excluded.fail_examples_json, source_authority = excluded.source_authority,
        active = 1, updated_at = CURRENT_TIMESTAMP`)
      .bind(stableManifestJson(chunk)).run();
  }
  return listManifestHardBans(db, brandKey);
}


export async function listManifestHardBans(db: D1Database, brandKey: string): Promise<JsonRecord[]> {
  await ensureManifestIntelligenceTables(db);
  const rows = await db.prepare(`SELECT rule_key, description, rule_type, pattern, scope,
      pass_examples_json, fail_examples_json, source_authority, updated_at
    FROM operator_manifest_hard_bans WHERE brand_key = ? AND active = 1
    ORDER BY datetime(updated_at) DESC, rule_key ASC`).bind(brandKey).all<JsonRecord>();
  return (rows.results ?? []).map((row) => ({
    rule_key: row.rule_key,
    description: row.description,
    rule_type: row.rule_type,
    pattern: row.pattern,
    scope: row.scope,
    pass_examples: parseJson(row.pass_examples_json, []),
    fail_examples: parseJson(row.fail_examples_json, []),
    source_authority: row.source_authority,
    updated_at: row.updated_at,
  }));
}

function serializeCycleStrategy(row: JsonRecord): JsonRecord {
  return {
    ...row,
    account_conclusion: parseJson(row.account_conclusion_json, {}),
    content_focus: parseJson(row.content_focus_json, {}),
    benchmarks: parseJson(row.benchmarks_json, {}),
    strongest_executions: parseJson(row.strongest_json, []),
    weakest_executions: parseJson(row.weakest_json, []),
    directives: parseJson(row.directives_json, {}),
    experiments: parseJson(row.experiments_json, []),
    risks: parseJson(row.risks_json, []),
    lineup: parseJson(row.lineup_json, []),
  };
}

export async function commitManifestCycleStrategy(db: D1Database, input: {
  cycleId: string; brandKey: string; snapshotId: string;
  accountConclusion: JsonRecord; contentFocus: JsonRecord; benchmarks: JsonRecord;
  strongestExecutions: JsonRecord[]; weakestExecutions: JsonRecord[];
  directives: JsonRecord; experiments: JsonRecord[]; risks: unknown[]; lineup: JsonRecord[];
}): Promise<JsonRecord> {
  const consumption = await getManifestEvidenceConsumptionState(db, input.cycleId, input.brandKey);
  if (consumption.complete !== true || String(consumption.snapshot_id ?? "") !== input.snapshotId) {
    throw new Error("manifest_analysis_pages_not_fully_consumed");
  }
    const followerBoundary = validateManifestFollowerAttributionBoundary({
    account_conclusion: input.accountConclusion,
    content_focus: input.contentFocus,
    directives: input.directives,
    lineup: input.lineup,
  });
  if (!followerBoundary.ok) throw new Error(followerBoundary.errors.join("|"));
  const snapshot = await db.prepare(`SELECT post_count, mature_count, immature_count, incomplete_count, benchmarks_json
    FROM operator_manifest_evidence_snapshots WHERE id = ? AND cycle_id = ? AND brand_key = ? LIMIT 1`)
    .bind(input.snapshotId, input.cycleId, input.brandKey).first<JsonRecord>();
  if (!snapshot) throw new Error("manifest_evidence_snapshot_not_found");
  const snapshotBenchmarks = parseJson(snapshot.benchmarks_json, {}) as JsonRecord;
  if (text(input.benchmarks.primary_metric, 100) !== "24_hour_likes"
    || text(snapshotBenchmarks.primary_metric, 100) !== "24_hour_likes") {
    throw new Error("manifest_cycle_strategy_likes_first_benchmark_required");
  }
  const matureRows = await db.prepare(`SELECT published_post_id FROM operator_manifest_evidence_posts
    WHERE snapshot_id = ? AND maturity_state = 'mature'`).bind(input.snapshotId).all<{ published_post_id: string }>();
  const allRows = await db.prepare(`SELECT published_post_id, maturity_state FROM operator_manifest_evidence_posts
    WHERE snapshot_id = ?`).bind(input.snapshotId).all<{ published_post_id: string; maturity_state: string }>();
  const maturePostIds = new Set((matureRows.results ?? []).map((row) => String(row.published_post_id)));
  const allPostIds = new Set((allRows.results ?? []).map((row) => String(row.published_post_id)));
  const citationIds = (value: JsonRecord): string[] => {
    const raw = value.published_post_ids ?? value.post_ids ?? value.evidence_post_ids
      ?? (value.published_post_id ? [value.published_post_id] : []);
    return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
  };
  const conclusionCitations = citationIds(input.accountConclusion);
  if (maturePostIds.size > 0 && conclusionCitations.length === 0) {
    throw new Error("manifest_account_conclusion_mature_evidence_citations_required");
  }
  for (const citedId of conclusionCitations) {
    if (!allPostIds.has(citedId)) throw new Error("manifest_account_conclusion_unknown_post_citation");
    if (!maturePostIds.has(citedId)) throw new Error("manifest_account_conclusion_immature_post_citation_forbidden");
  }
  const validateExecutionEvidence = (items: JsonRecord[], label: string): void => {
    for (const item of items) {
      const ids = citationIds(item);
      if (!ids.length) throw new Error(`manifest_${label}_mature_post_citations_required`);
      if (!text(item.reason ?? item.analysis ?? item.why ?? item.conclusion, 4000)) {
        throw new Error(`manifest_${label}_reason_required`);
      }
      for (const citedId of ids) {
        if (!allPostIds.has(citedId)) throw new Error(`manifest_${label}_unknown_post_citation`);
        if (!maturePostIds.has(citedId)) throw new Error(`manifest_${label}_immature_post_citation_forbidden`);
      }
    }
  };
  validateExecutionEvidence(input.strongestExecutions, "strongest_execution");
  validateExecutionEvidence(input.weakestExecutions, "weakest_execution");
  for (const key of ["emphasize", "preserve", "reduce", "avoid_clustering", "test", "unresolved_questions"]) {
    if (!Array.isArray(input.contentFocus[key])) throw new Error(`manifest_content_focus_${key}_array_required`);
  }
  const cycle = await db.prepare(`SELECT missing_slots_json FROM operator_autonomous_growth_cycles WHERE id = ? AND brand_key = ? LIMIT 1`)
    .bind(input.cycleId, input.brandKey).first<JsonRecord>();
  if (!cycle) throw new Error("manifest_cycle_not_found");
  const missingSlots = parseJson(cycle.missing_slots_json, []) as JsonRecord[];
  const requiredKeys = new Set(missingSlots.map((slot) => text(slot.key, 40)).filter(Boolean));
  const receivedKeys = new Set<string>();
  const allowedModes = new Set(["franchise_deployment", "controlled_variation", "mechanism_expansion", "adjacent_experiment"]);
  const sourceCardIds = Array.from(new Set(input.lineup
    .map((item) => text(item.source_card_id, 160))
    .filter(Boolean)));
  const sourceCardRows = sourceCardIds.length
    ? await db.prepare(`SELECT id, status, source_selection_id FROM operator_source_cards
        WHERE brand_key = ? AND id IN (SELECT value FROM json_each(?))`)
      .bind(input.brandKey, stableManifestJson(sourceCardIds)).all<JsonRecord>()
    : { results: [] as JsonRecord[] };
  const sourceCardsById = new Map((sourceCardRows.results ?? [])
    .map((row) => [String(row.id ?? ""), row] as const));
  for (const item of input.lineup) {
    const slotKey = text(item.slot_key, 40);
    const sourceKind = text(item.source_kind, 60);
    if (!slotKey || receivedKeys.has(slotKey) || !requiredKeys.has(slotKey)) throw new Error("manifest_cycle_lineup_slot_invalid");
    if (!["saved_pattern", "source_card"].includes(sourceKind)) throw new Error("manifest_cycle_lineup_source_backed_only");
    const sourceCardId = text(item.source_card_id, 160);
    if (!sourceCardId) throw new Error("manifest_cycle_lineup_source_card_required");
    const sourceCard = sourceCardsById.get(sourceCardId);
    if (!sourceCard || String(sourceCard.status) !== "locked" || !text(sourceCard.source_selection_id, 160)) {
      throw new Error("manifest_cycle_lineup_locked_source_card_lineage_required");
    }
    if (text(item.source_selection_id, 160) && text(item.source_selection_id, 160) !== text(sourceCard.source_selection_id, 160)) {
      throw new Error("manifest_cycle_lineup_source_selection_mismatch");
    }
    item.source_selection_id = text(sourceCard.source_selection_id, 160);
    if (!allowedModes.has(text(item.generation_mode, 80))) throw new Error("manifest_cycle_lineup_generation_mode_invalid");
    for (const requiredField of ["family_key", "strategic_role", "audience_reward", "hook_direction", "placement_reason", "exploration_mode"]) {
      if (!text(item[requiredField], 4000)) throw new Error(`manifest_cycle_lineup_${requiredField}_required`);
    }
    receivedKeys.add(slotKey);
  }
  if (receivedKeys.size !== requiredKeys.size || [...requiredKeys].some((key) => !receivedKeys.has(key))) {
    throw new Error("manifest_cycle_lineup_must_cover_every_authoritative_missing_slot");
  }
  const body = {
    account_conclusion: input.accountConclusion,
    content_focus: input.contentFocus,
    benchmarks: input.benchmarks,
    strongest_executions: input.strongestExecutions,
    weakest_executions: input.weakestExecutions,
    directives: input.directives,
    experiments: input.experiments,
    risks: input.risks,
    lineup: input.lineup,
  };
    const strategyHash = await hash({ cycle_id: input.cycleId, ...body });
  const existing = await db.prepare(`SELECT * FROM operator_manifest_cycle_strategies WHERE cycle_id = ? LIMIT 1`)
    .bind(input.cycleId).first<JsonRecord>();
  if (existing) {
    if (String(existing.strategy_hash) !== strategyHash) throw new Error("manifest_cycle_strategy_locked_conflict");
    return { ...serializeCycleStrategy(existing), replayed: true };
  }
  const strategyId = crypto.randomUUID();
  const lockedAt = new Date().toISOString();
  await db.prepare(`INSERT INTO operator_manifest_cycle_strategies (
      id, cycle_id, brand_key, snapshot_id, contract_version, account_conclusion_json,
      content_focus_json, benchmarks_json, strongest_json, weakest_json, directives_json,
      experiments_json, risks_json, lineup_json, strategy_hash, status, locked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'locked', ?)`)
    .bind(
      strategyId, input.cycleId, input.brandKey, input.snapshotId, MANIFEST_CYCLE_STRATEGY_CONTRACT,
      stableManifestJson(input.accountConclusion), stableManifestJson(input.contentFocus),
      stableManifestJson(input.benchmarks), stableManifestJson(input.strongestExecutions),
      stableManifestJson(input.weakestExecutions), stableManifestJson(input.directives),
      stableManifestJson(input.experiments), stableManifestJson(input.risks),
      stableManifestJson(input.lineup), strategyHash, lockedAt,
    ).run();
  for (let offset = 0; offset < input.lineup.length; offset += 50) {
    await db.batch(input.lineup.slice(offset, offset + 50).map((item) => {
      const slotKey = text(item.slot_key, 40);
      const [slotDate, slotTime] = slotKey.split("T");
      return db.prepare(`INSERT INTO operator_manifest_cycle_plan_items (
          id, strategy_id, cycle_id, brand_key, slot_key, slot_date, slot_time,
          family_key, strategic_role, generation_mode, source_kind, source_card_id,
          source_selection_id, audience_reward, hook_direction, placement_reason,
          nearby_avoid_json, exploration_mode, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned')`)
        .bind(
          crypto.randomUUID(), strategyId, input.cycleId, input.brandKey, slotKey, slotDate, slotTime,
          text(item.family_key, 240), text(item.strategic_role, 500), text(item.generation_mode, 80),
          text(item.source_kind, 60), text(item.source_card_id, 160), text(item.source_selection_id, 160) || null,
          text(item.audience_reward, 4000), text(item.hook_direction, 4000), text(item.placement_reason, 4000),
          stableManifestJson(item.nearby_avoid ?? []), text(item.exploration_mode, 80),
        );
    }));
  }
    await db.batch([
    db.prepare(`UPDATE operator_autonomous_growth_cycles
      SET cycle_strategy_id = ?, evidence_snapshot_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND brand_key = ?`).bind(strategyId, input.snapshotId, input.cycleId, input.brandKey),
    db.prepare(`UPDATE operator_manifest_cycle_receipts
      SET output_strategy_version_id = ?
      WHERE cycle_id = ? AND brand_key = ? AND output_strategy_version_id IS NULL`)
      .bind(strategyId, input.cycleId, input.brandKey),
  ]);
  const row = await db.prepare(`SELECT * FROM operator_manifest_cycle_strategies WHERE id = ?`).bind(strategyId).first<JsonRecord>();
  return { ...serializeCycleStrategy(row ?? { id: strategyId }), replayed: false };
}

export async function getManifestCycleStrategy(db: D1Database, cycleId: string, brandKey: string): Promise<JsonRecord | null> {
  await ensureManifestIntelligenceTables(db);
  const row = await db.prepare(`SELECT * FROM operator_manifest_cycle_strategies WHERE cycle_id = ? AND brand_key = ? LIMIT 1`)
    .bind(cycleId, brandKey).first<JsonRecord>();
  return row ? serializeCycleStrategy(row) : null;
}

export async function getManifestCyclePlanItem(db: D1Database, cycleId: string, brandKey: string, slotKey: string): Promise<JsonRecord | null> {
  await ensureManifestIntelligenceTables(db);
  const row = await db.prepare(`SELECT * FROM operator_manifest_cycle_plan_items
    WHERE cycle_id = ? AND brand_key = ? AND slot_key = ? LIMIT 1`).bind(cycleId, brandKey, slotKey).first<JsonRecord>();
  return row ? { ...row, nearby_avoid: parseJson(row.nearby_avoid_json, []) } : null;
}

export async function recordManifestCandidateGateReceipt(db: D1Database, input: {
  cycleId: string; strategyId: string; planItemId: string; brandKey: string;
  slotKey: string; candidateText: string; results: JsonRecord[];
}): Promise<JsonRecord> {
  await ensureManifestIntelligenceTables(db);
  if (!input.results.length) throw new Error("manifest_candidate_gate_receipt_empty");
  const passed = input.results.every((result) => result.executed === true && !["fail", "block", "blocked"].includes(text(result.status, 40).toLowerCase()));
  const candidateHash = await hash({ text: input.candidateText, slot_key: input.slotKey });
  const existing = await db.prepare(`SELECT * FROM operator_manifest_candidate_gate_receipts
    WHERE cycle_id = ? AND slot_key = ? AND candidate_hash = ? LIMIT 1`)
    .bind(input.cycleId, input.slotKey, candidateHash).first<JsonRecord>();
  if (existing) return { ...existing, results: parseJson(existing.results_json, []), passed: numeric(existing.passed) === 1, replayed: true };
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO operator_manifest_candidate_gate_receipts (
      id, cycle_id, strategy_id, plan_item_id, brand_key, slot_key,
      candidate_hash, receipt_version, results_json, passed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      id, input.cycleId, input.strategyId, input.planItemId, input.brandKey, input.slotKey,
      candidateHash, MANIFEST_CANDIDATE_GATE_RECEIPT_VERSION, stableManifestJson(input.results), passed ? 1 : 0,
    ).run();
  return { id, candidate_hash: candidateHash, receipt_version: MANIFEST_CANDIDATE_GATE_RECEIPT_VERSION, results: input.results, passed, replayed: false };
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
    const outputCycleStrategy = row.output_strategy_version_id
    ? await db.prepare(`SELECT * FROM operator_manifest_cycle_strategies WHERE id = ? AND brand_key = ? LIMIT 1`)
      .bind(row.output_strategy_version_id, input.brandKey).first<JsonRecord>()
    : null;
  const outputLegacyStrategy = row.output_strategy_version_id && !outputCycleStrategy
    ? await db.prepare(`SELECT * FROM operator_manifest_strategy_versions WHERE id = ? AND brand_key = ? LIMIT 1`)
      .bind(row.output_strategy_version_id, input.brandKey).first<JsonRecord>()
    : null;
  const exposure = row.exposure_snapshot_id
    ? await db.prepare(`SELECT * FROM operator_manifest_exposure_snapshots WHERE id = ?`).bind(row.exposure_snapshot_id).first<JsonRecord>()
    : null;
  return {
    ...serializeReceipt(row),
    input_strategy_version: inputStrategy ? serializeStrategy(inputStrategy) : null,
        output_strategy_version: outputCycleStrategy
      ? serializeCycleStrategy(outputCycleStrategy)
      : outputLegacyStrategy
        ? serializeStrategy(outputLegacyStrategy)
        : null,
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
  await ensureManifestIntelligenceTables(db);
  const policy = await ensureManifestIntelligencePolicy(db, brandKey);
  const cycleStrategyRow = await db.prepare(`SELECT * FROM operator_manifest_cycle_strategies
    WHERE brand_key = ? AND status = 'locked'
    ORDER BY datetime(locked_at) DESC, datetime(created_at) DESC LIMIT 1`)
    .bind(brandKey).first<JsonRecord>();
  const cycleStrategy = cycleStrategyRow ? serializeCycleStrategy(cycleStrategyRow) : null;
  const legacyStrategy = await getLatestManifestStrategyVersion(db, brandKey);
  const receipt = await getManifestCycleReceipt(db, { brandKey });
  const receiptRead = receipt ? buildManifestCycleReceiptRead(receipt, "summary") : null;
  return {
    foundation_version: MANIFEST_INTELLIGENCE_FOUNDATION_VERSION,
    policy,
    latest_strategy_version: cycleStrategy,
    latest_cycle_strategy: cycleStrategy,
    legacy_strategy_version: legacyStrategy,
    strategy_authority: "one_locked_model_led_strategy_per_cycle",
    latest_cycle_receipt: receiptRead?.summary ?? null,
  };
}
