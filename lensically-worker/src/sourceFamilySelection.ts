export const SOURCE_FAMILY_LABEL_POLICY_VERSION = "source-family-label-policy-v3";
export const SOURCE_SELECTION_ENGINE_VERSION = "source-selection-engine-v3";


export type SourceFamilyLifetimeLabel =
  | "untested"
  | "prospect"
  | "emerging"
  | "proven"
  | "franchise"
  | "underperforming"
  | "disproven";

export type SourceFamilyRecentLabel =
  | "no_recent_data"
  | "hot"
  | "healthy"
  | "cooling"
  | "cold"
  | "recovering";

export type SourceFamilyConfidenceLabel = "low" | "developing" | "directional" | "reliable";

export type SourceSelectionCandidate = Record<string, unknown> & {
  source_identity_key?: string;
  source_card_id?: string | null;
  source_card_family_id?: string | null;
  lifetime_label?: SourceFamilyLifetimeLabel;
  recent_label?: SourceFamilyRecentLabel;
  confidence_label?: SourceFamilyConfidenceLabel;
  lifetime_sample_size?: number;
  recent_sample_size?: number;
  lifetime_index?: number;
  recent_index?: number | null;
  uses_24h?: number;
  uses_7d?: number;
  uses_28d?: number;
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
  semantic_overlap_count: number;
  exposure_burden: number;
  negative_evidence_multiplier: number;
  cooldown_hours: number;
  cooldown_relaxation: number;
  score: number;
  deterministic_tiebreak: number;
};

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  let label: SourceFamilyLifetimeLabel = "prospect";
  if (medianIndex >= 1.5 && aboveFranchiseFloor >= 0.9) label = "franchise";
  else if (aboveMedian >= 0.8) label = "proven";
  else if (medianIndex >= 1.15) label = "emerging";
  else if (medianIndex < 0.85 && belowUnderperformanceFloor >= 0.9) label = "disproven";
  else if (medianIndex < 0.85) label = "underperforming";
  return {
    label,
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

function slotDistanceHours(left: string, right: string): number {
  const leftMs = Date.parse(`${left}:00Z`);
  const rightMs = Date.parse(`${right}:00Z`);
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return Number.POSITIVE_INFINITY;
  return Math.abs(leftMs - rightMs) / 3600000;
}

export async function ensureSourceFamilySelectionTables(db: D1Database): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS operator_source_family_evidence_states (
      id TEXT PRIMARY KEY,
      brand_key TEXT NOT NULL,
      source_card_family_id TEXT NOT NULL,
      source_identity_key TEXT NOT NULL,
      label_policy_version TEXT NOT NULL,
      lifetime_label TEXT NOT NULL,
      recent_label TEXT NOT NULL,
      confidence_label TEXT NOT NULL,
      lifetime_sample_size INTEGER NOT NULL DEFAULT 0,
      recent_sample_size INTEGER NOT NULL DEFAULT 0,
      account_lifetime_median_likes REAL NOT NULL DEFAULT 0,
      account_28d_median_likes REAL NOT NULL DEFAULT 0,
      family_lifetime_median_likes REAL,
      family_28d_median_likes REAL,
      lifetime_index REAL,
      recent_index REAL,
      latest_two_recent_index REAL,
      probability_above_median REAL NOT NULL DEFAULT 0.5,
      probability_above_franchise_floor REAL NOT NULL DEFAULT 0.5,
      probability_below_underperformance_floor REAL NOT NULL DEFAULT 0.5,
      state_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(brand_key, source_card_family_id)
    )`,
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_operator_source_family_evidence_labels
     ON operator_source_family_evidence_states (brand_key, lifetime_label, recent_label, updated_at DESC)`,
  ).run();
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS operator_source_family_label_transitions (
      id TEXT PRIMARY KEY,
      brand_key TEXT NOT NULL,
      source_card_family_id TEXT NOT NULL,
      source_identity_key TEXT NOT NULL,
      label_policy_version TEXT NOT NULL,
      previous_lifetime_label TEXT,
      lifetime_label TEXT NOT NULL,
      previous_recent_label TEXT,
      recent_label TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_operator_source_family_label_transitions
     ON operator_source_family_label_transitions (brand_key, source_card_family_id, created_at DESC)`,
  ).run();
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS operator_source_selection_receipts (
      id TEXT PRIMARY KEY,
      brand_key TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      slot_key TEXT NOT NULL,
      selection_order INTEGER NOT NULL,
      source_identity_key TEXT NOT NULL,
      source_card_family_id TEXT NOT NULL,
      source_card_id TEXT NOT NULL,
      engine_version TEXT NOT NULL,
      receipt_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(brand_key, scope_type, scope_id, slot_key)
    )`,
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_operator_source_selection_receipts_scope
     ON operator_source_selection_receipts (brand_key, scope_type, scope_id, selection_order)`,
  ).run();
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS operator_source_selection_plans (
      id TEXT PRIMARY KEY,
      brand_key TEXT NOT NULL,
      cycle_id TEXT NOT NULL,
      slot_key TEXT NOT NULL,
      selection_order INTEGER NOT NULL,
      source_identity_key TEXT NOT NULL,
      source_card_family_id TEXT NOT NULL,
      source_card_id TEXT NOT NULL,
      engine_version TEXT NOT NULL,
      receipt_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'locked',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(brand_key, cycle_id, slot_key)
    )`,
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_operator_source_selection_plans_cycle
     ON operator_source_selection_plans (brand_key, cycle_id, selection_order)`,
  ).run();
}

export async function refreshSourceFamilyLabels(
  db: D1Database,
  brandKey: string,
  nowIso = new Date().toISOString(),
): Promise<Record<string, unknown>> {
  await ensureSourceFamilySelectionTables(db);
    const familyRows = await db.prepare(
    `SELECT fam.id AS source_card_family_id, fam.source_identity_key
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
  for (const family of familyRows.results ?? []) {
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
    family_count: familyRows.results?.length ?? 0,
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
  const rows = await db.prepare(

    `SELECT fam.id AS source_card_family_id, fam.source_identity_key,
            card.id AS source_card_id, card.source_mechanism, card.required_product,
            card.metrics_snapshot_json, card.primary_source_json, card.recommended_direction
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
  const candidates = (rows.results ?? []).map((row) => {
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
            state.lifetime_index, state.recent_index
     FROM operator_source_card_families fam
     LEFT JOIN operator_source_cards card
       ON card.id = fam.current_source_card_id AND card.brand_key = fam.brand_key
     LEFT JOIN operator_source_family_evidence_states state
       ON state.brand_key = fam.brand_key AND state.source_card_family_id = fam.id
     WHERE fam.brand_key = ? AND fam.status = 'active'`,
  ).bind(brandKey).all<Record<string, unknown>>();
  const exposureRows = await db.prepare(
    `SELECT source_identity_key,
            MAX(selected_at) AS last_used_at,
            SUM(CASE WHEN datetime(selected_at) >= datetime(?, '-24 hours') THEN 1 ELSE 0 END) AS uses_24h,
            SUM(CASE WHEN datetime(selected_at) >= datetime(?, '-7 days') THEN 1 ELSE 0 END) AS uses_7d,
            SUM(CASE WHEN datetime(selected_at) >= datetime(?, '-28 days') THEN 1 ELSE 0 END) AS uses_28d
     FROM operator_source_selections
     WHERE brand_key = ? AND datetime(selected_at) >= datetime(?, '-28 days')
     GROUP BY source_identity_key`,
  ).bind(nowIso, nowIso, nowIso, brandKey, nowIso).all<Record<string, unknown>>();
  const stateByIdentity = new Map((stateRows.results ?? []).map((row) => [String(row.source_identity_key), row]));
  const exposureByIdentity = new Map((exposureRows.results ?? []).map((row) => [String(row.source_identity_key), row]));
  const nowMs = parseTimeMs(nowIso) ?? Date.now();
  return candidates.map((candidate) => {
    const identity = String(candidate.source_identity_key ?? "");
    const state = stateByIdentity.get(identity);
    const exposure = exposureByIdentity.get(identity);
    const lastUsedMs = parseTimeMs(exposure?.last_used_at);
    const sourceMechanism = state?.source_mechanism ?? candidate.source_mechanism;
    const requiredProduct = state?.required_product ?? candidate.required_product;
    return {
      ...candidate,
      source_card_family_id: state?.source_card_family_id ? String(state.source_card_family_id) : null,
      source_card_id: state?.current_source_card_id ? String(state.current_source_card_id) : null,
      lifetime_label: (state?.lifetime_label ?? "untested") as SourceFamilyLifetimeLabel,
      recent_label: (state?.recent_label ?? "no_recent_data") as SourceFamilyRecentLabel,
      confidence_label: (state?.confidence_label ?? "low") as SourceFamilyConfidenceLabel,
      lifetime_sample_size: finiteNumber(state?.lifetime_sample_size),
      recent_sample_size: finiteNumber(state?.recent_sample_size),
      lifetime_index: finiteNumber(state?.lifetime_index, 1),
      recent_index: state?.recent_index === null || state?.recent_index === undefined ? null : finiteNumber(state.recent_index, 1),
      uses_24h: finiteNumber(exposure?.uses_24h),
      uses_7d: finiteNumber(exposure?.uses_7d),
      uses_28d: finiteNumber(exposure?.uses_28d),
      hours_since_last_use: lastUsedMs === null ? null : Math.max(0, (nowMs - lastUsedMs) / 3600000),
      semantic_key: `${semanticToken(sourceMechanism)}:${semanticToken(requiredProduct)}`,
      source_mechanism: sourceMechanism ?? null,
      required_product: requiredProduct ?? null,
    };
  });
}

export function selectSourceFamilyLineup(input: {
  candidates: SourceSelectionCandidate[];
  slot_keys: string[];
  seed: string;
}): { selected: SourceSelectionCandidate[]; receipts: SourceSelectionReceipt[]; summary: Record<string, unknown> } {
  const active = input.candidates.filter((candidate) =>
    candidate.lifetime_label !== "disproven"
    && Boolean(candidate.source_identity_key)
    && Boolean(candidate.source_card_id)
    && Boolean(candidate.source_card_family_id)
  );
  if (!active.length && input.slot_keys.length) throw new Error("no_eligible_source_families");
  const eligibleFamilyCount = new Set(active.map((candidate) => String(candidate.source_card_family_id))).size;
  const cooldownHours = Math.min(24, Math.max(1, eligibleFamilyCount));
  const requireUniqueSource = new Set(active.map((candidate) => String(candidate.source_identity_key))).size >= input.slot_keys.length;
  const selected: SourceSelectionCandidate[] = [];
  const receipts: SourceSelectionReceipt[] = [];
  const usedSources = new Set<string>();
  const plannedCounts = new Map<string, number>();
  const plannedLastSlot = new Map<string, string>();
  const recentSemanticKeys: string[] = [];
  const relaxationCounts: Record<string, number> = { strict: 0, half: 0, exhausted: 0 };

  for (let slotIndex = 0; slotIndex < input.slot_keys.length; slotIndex += 1) {
    const slotKey = input.slot_keys[slotIndex];
    const available = active.filter((candidate) => !requireUniqueSource || !usedSources.has(String(candidate.source_identity_key)));
    if (!available.length) throw new Error(`insufficient_eligible_source_families:${slotIndex}`);
    let scored: Array<{ candidate: SourceSelectionCandidate; receipt: SourceSelectionReceipt }> = [];
    for (const relaxation of [1, 0.5, 0]) {
      scored = [];
      for (const candidate of available) {
        const identity = String(candidate.source_identity_key);
        const familyId = String(candidate.source_card_family_id);
        const sourceCardId = String(candidate.source_card_id);
        const plannedLast = plannedLastSlot.get(familyId);
        const historicalHours = candidate.hours_since_last_use === null || candidate.hours_since_last_use === undefined
          ? Number.POSITIVE_INFINITY
          : Math.max(0, finiteNumber(candidate.hours_since_last_use) + slotIndex);
        const hoursSinceLast = plannedLast ? slotDistanceHours(slotKey, plannedLast) : historicalHours;
        if (relaxation > 0 && hoursSinceLast < cooldownHours * relaxation) continue;
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
        const semanticOverlapCount = recentSemanticKeys.slice(-6).filter((value) => value === semanticKey).length;
        const exposureBurden = 1 + 2 * uses24h + 0.75 * uses7d + 0.25 * uses28d + 2 * plannedUses + 0.5 * semanticOverlapCount;
        const negativeEvidenceMultiplier = candidate.lifetime_label === "underperforming" ? 0.65 : 1;
        const score = ((shrunkPerformance * recentFactor + explorationBonus) / exposureBurden) * negativeEvidenceMultiplier;
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
            semantic_overlap_count: semanticOverlapCount,
            exposure_burden: exposureBurden,
            negative_evidence_multiplier: negativeEvidenceMultiplier,
            cooldown_hours: cooldownHours,
            cooldown_relaxation: relaxation,
            score,
            deterministic_tiebreak: deterministicTiebreak,
          },
        });
      }
      if (scored.length) break;
    }
    scored.sort((left, right) =>
      right.receipt.score - left.receipt.score
      || right.receipt.deterministic_tiebreak - left.receipt.deterministic_tiebreak
      || left.receipt.source_identity_key.localeCompare(right.receipt.source_identity_key)
    );
    const winner = scored[0];
    if (!winner) throw new Error(`source_selection_exhausted:${slotIndex}`);
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
    recentSemanticKeys.push(String(winner.candidate.semantic_key ?? "unknown"));
    const relaxationKey = receipt.cooldown_relaxation === 1 ? "strict" : receipt.cooldown_relaxation === 0.5 ? "half" : "exhausted";
    relaxationCounts[relaxationKey] += 1;
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
      eligible_family_count: eligibleFamilyCount,
      requested_slot_count: input.slot_keys.length,
      selected_count: selected.length,
      cooldown_hours: cooldownHours,
      unique_source_enforced: requireUniqueSource,
      cooldown_relaxations: relaxationCounts,
      selected_lifetime_labels: labelCounts,
    },
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
    if (existingSignature !== requestedSignature) throw new Error("locked_source_selection_plan_conflict");
    return existing;
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
    repeated_losers_disproven: repeatedLosers.label === "disproven",
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
