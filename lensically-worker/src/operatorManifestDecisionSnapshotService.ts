import {
    loadLockedSourceCardDecisionCandidates,
  normalizeSourceFamilyLifetimeLabel,
  type SourceSelectionCandidate,

  type SourceSelectionReceipt,
} from "./sourceFamilySelection";
import {
  readManifestShadowEvidence,
  readManifestShadowProductionFingerprint,
} from "./operatorManifestShadowEvidenceService";

type JsonRecord = Record<string, unknown>;

export const MANIFEST_DECISION_SNAPSHOT_VERSION = "manifest-decision-snapshot-v1";
export const MANIFEST_DECISION_PROVIDER_VERSION = "manifest-decision-provider-v1";
export const MANIFEST_DECISION_PARITY_VERSION = "manifest-decision-parity-v1";
export const MANIFEST_DECISION_SCENARIO_OVERLAY_VERSION = "manifest-decision-scenario-overlay-v1";

export type ManifestDecisionQueryReceipt = {
  query_key: string;
  row_count: number;
  read_only: true;
};

export type ManifestDecisionSnapshot = {
  contract_version: string;
  provider_version: string;
  brand_key: string;
  account_id: string;
  threads_user_id: string;
  captured_at: string;
  timezone: string;
  coverage_rules: JsonRecord;
  source_candidates: SourceSelectionCandidate[];
  saved_patterns: JsonRecord[];
  source_cards: JsonRecord[];
  source_families: JsonRecord[];
  source_selections: JsonRecord[];
  source_exclusions: JsonRecord[];
  mature_metric_windows: JsonRecord[];
  source_exposure_history: JsonRecord[];
  strategy: JsonRecord | null;
  learning_brief: JsonRecord | null;
  content_focus: JsonRecord | null;
  portfolio_state: JsonRecord | null;
  experiments: JsonRecord[];
  hypotheses: JsonRecord[];
  repetition_evidence: JsonRecord[];
  follower_checkpoint: JsonRecord | null;
  hard_bans: JsonRecord[];
  recent_performance: JsonRecord;
  strongest_posts: JsonRecord[];
  weakest_posts: JsonRecord[];
  recent_published: JsonRecord[];
  future_scheduled: JsonRecord[];
  eligibility_state: JsonRecord;
  evidence_gaps: JsonRecord[];
  freshness: JsonRecord;
  query_receipts: ManifestDecisionQueryReceipt[];
  production_fingerprint_before: JsonRecord;
  production_fingerprint_after: JsonRecord;
  zero_write_proof: JsonRecord;
  snapshot_hash: string;
};

export type ManifestDecisionScenarioOverlay = {
  contract_version: string;
  snapshot_hash: string;
  target_slots: JsonRecord[];
  occupied_slot_keys: string[];
  missing_slot_keys: string[];
  diff_manifest: {
    changed_paths: string[];
    forbidden_changed_paths: string[];
    evidence_unchanged: boolean;
  };
  overlay_hash: string;
};

export type ManifestDecisionParityReceipt = {
  contract_version: string;
  snapshot_hash: string;
  selector_seed: string;
  requested_slot_count: number;
  eligible_family_count: number;
  minimum_eligible_family_count: number;
  candidate_pool_requirement_passed: boolean;
  eligible_pool_hash: string;
  exclusions_hash: string;
  ranked_order_hash: string;
  selected_lineup_hash: string;
  main_equivalent_output_hash: string;
  innovation_output_hash: string;
  eligible_pool_match: boolean;
  exclusions_match: boolean;
  ranked_order_match: boolean;
  selected_lineup_match: boolean;
  parity_passed: boolean;
  selected_source_to_slot: JsonRecord[];
  main_equivalent: {
    selected: SourceSelectionCandidate[];
    receipts: SourceSelectionReceipt[];
    summary: JsonRecord;
    parity_trace?: JsonRecord;
  };
  innovation: {
    selected: SourceSelectionCandidate[];
    receipts: SourceSelectionReceipt[];
    summary: JsonRecord;
    parity_trace?: JsonRecord;
  };
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]),
  );
}

export function stableManifestDecisionJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export async function hashManifestDecisionValue(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableManifestDecisionJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function rowsOrEmpty(
  db: D1Database,
  receipts: ManifestDecisionQueryReceipt[],
  queryKey: string,
  sql: string,
  bindings: unknown[] = [],
): Promise<JsonRecord[]> {
  try {
    const result = await db.prepare(sql).bind(...bindings).all<JsonRecord>();
    const rows = result.results ?? [];
    receipts.push({ query_key: queryKey, row_count: rows.length, read_only: true });
    return rows;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table|no such column/i.test(message)) {
      receipts.push({ query_key: queryKey, row_count: 0, read_only: true });
      return [];
    }
    throw error;
  }
}

async function firstOrNull(
  db: D1Database,
  receipts: ManifestDecisionQueryReceipt[],
  queryKey: string,
  sql: string,
  bindings: unknown[] = [],
): Promise<JsonRecord | null> {
  try {
    const row = await db.prepare(sql).bind(...bindings).first<JsonRecord>();
    receipts.push({ query_key: queryKey, row_count: row ? 1 : 0, read_only: true });
    return row ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table|no such column/i.test(message)) {
      receipts.push({ query_key: queryKey, row_count: 0, read_only: true });
      return null;
    }
    throw error;
  }
}

function parseJsonField(value: unknown): unknown {
  if (typeof value !== "string" || !value.trim()) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeRows(rows: JsonRecord[]): JsonRecord[] {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_json$/, ""),
      key.endsWith("_json") ? parseJsonField(value) : value,
    ]),
  ));
}

export async function buildManifestDecisionSnapshot(
  db: D1Database,
  input: {
    brandKey: string;
    accountId: string;
    threadsUserId: string;
    capturedAt: string;
    timezone: string;
    coverageRules?: JsonRecord;
  },
): Promise<ManifestDecisionSnapshot> {
  const queryReceipts: ManifestDecisionQueryReceipt[] = [];
  const fingerprintBefore = await readManifestShadowProductionFingerprint(db);
  queryReceipts.push({ query_key: "production_fingerprint_before", row_count: Object.keys(fingerprintBefore).length, read_only: true });

    const sourceCandidates = await loadLockedSourceCardDecisionCandidates(db, input.brandKey, input.capturedAt);
  queryReceipts.push({ query_key: "locked_source_candidates", row_count: sourceCandidates.length, read_only: true });

  const evidence = await readManifestShadowEvidence(db, {
    brandKey: input.brandKey,
    threadsUserId: input.threadsUserId,
    nowIso: input.capturedAt,
    evidenceMode: "snapshot",
  });
  queryReceipts.push({ query_key: "canonical_decision_evidence", row_count: 1, read_only: true });

  const [
    savedPatterns,
    sourceCards,
    sourceFamilies,
    sourceSelections,
    sourceExclusions,
    matureMetricWindows,
    sourceExposureHistory,
    portfolioState,
    experiments,
    hypotheses,
    repetitionEvidence,
    followerCheckpoint,
  ] = await Promise.all([
    rowsOrEmpty(db, queryReceipts, "saved_patterns", `SELECT * FROM external_patterns WHERE account_id = ? AND likes >= 1000 ORDER BY likes DESC, updated_at DESC LIMIT 5000`, [input.accountId]),
    rowsOrEmpty(db, queryReceipts, "source_cards", `SELECT * FROM operator_source_cards WHERE brand_key = ? ORDER BY family_id, version DESC, created_at DESC LIMIT 5000`, [input.brandKey]),
    rowsOrEmpty(db, queryReceipts, "source_families", `SELECT * FROM operator_source_card_families WHERE brand_key = ? ORDER BY source_identity_key LIMIT 5000`, [input.brandKey]),
    rowsOrEmpty(db, queryReceipts, "source_selections", `SELECT * FROM operator_source_selections WHERE brand_key = ? ORDER BY datetime(selected_at) DESC LIMIT 5000`, [input.brandKey]),
    rowsOrEmpty(db, queryReceipts, "source_exclusions", `SELECT * FROM operator_source_exclusions WHERE brand_key = ? ORDER BY source_identity_key LIMIT 5000`, [input.brandKey]),
    rowsOrEmpty(db, queryReceipts, "mature_metric_windows", `SELECT * FROM operator_post_performance_scores WHERE brand_key = ? AND checkpoint_hours IN (6, 12, 18, 24) ORDER BY published_post_id, checkpoint_hours LIMIT 5000`, [input.brandKey]),
    rowsOrEmpty(db, queryReceipts, "source_exposure_history", `SELECT * FROM operator_source_selection_receipts WHERE brand_key = ? ORDER BY datetime(created_at) DESC LIMIT 5000`, [input.brandKey]),
    firstOrNull(db, queryReceipts, "portfolio_state", `SELECT * FROM operator_manifest_portfolio_states WHERE brand_key = ? ORDER BY datetime(created_at) DESC LIMIT 1`, [input.brandKey]),
    rowsOrEmpty(db, queryReceipts, "experiments", `SELECT * FROM operator_manifest_experiments WHERE brand_key = ? ORDER BY datetime(updated_at) DESC LIMIT 500`, [input.brandKey]),
    rowsOrEmpty(db, queryReceipts, "hypotheses", `SELECT * FROM operator_manifest_post_hypotheses WHERE brand_key = ? ORDER BY datetime(created_at) DESC LIMIT 1000`, [input.brandKey]),
    rowsOrEmpty(db, queryReceipts, "repetition_evidence", `SELECT * FROM operator_manifest_semantic_signatures WHERE brand_key = ? ORDER BY datetime(updated_at) DESC LIMIT 2000`, [input.brandKey]),
    firstOrNull(db, queryReceipts, "follower_checkpoint", `SELECT * FROM operator_manifest_follower_checkpoints WHERE brand_key = ? ORDER BY datetime(captured_at) DESC LIMIT 1`, [input.brandKey]),
  ]);

    const activeCandidates = sourceCandidates.filter((candidate) =>
    normalizeSourceFamilyLifetimeLabel(candidate.lifetime_label) !== "underperforming"
    && Boolean(candidate.source_identity_key)

    && Boolean(candidate.source_card_id)
    && Boolean(candidate.source_card_family_id)
  );
  const excludedCandidates = sourceCandidates.filter((candidate) => !activeCandidates.includes(candidate)).map((candidate) => ({
    source_identity_key: candidate.source_identity_key ?? null,
    source_card_id: candidate.source_card_id ?? null,
        reason: normalizeSourceFamilyLifetimeLabel(candidate.lifetime_label) === "underperforming"
      ? "lifetime_underperforming"

      : !candidate.source_identity_key
        ? "source_identity_missing"
        : !candidate.source_card_id
          ? "source_card_missing"
          : "source_family_missing",
  }));
  const recentPerformance = {
    strongest_count: evidence.strongest_posts.length,
    weakest_count: evidence.weakest_posts.length,
    recent_published_count: evidence.recent_published.length,
    future_scheduled_count: evidence.future_scheduled.length,
  };

  const fingerprintAfter = await readManifestShadowProductionFingerprint(db);
  queryReceipts.push({ query_key: "production_fingerprint_after", row_count: Object.keys(fingerprintAfter).length, read_only: true });
  const zeroWritePassed = stableManifestDecisionJson(fingerprintBefore) === stableManifestDecisionJson(fingerprintAfter);
  if (!zeroWritePassed) throw new Error("manifest_decision_snapshot_zero_write_proof_failed");

  const withoutHash = {
    contract_version: MANIFEST_DECISION_SNAPSHOT_VERSION,
    provider_version: MANIFEST_DECISION_PROVIDER_VERSION,
    brand_key: input.brandKey,
    account_id: input.accountId,
    threads_user_id: input.threadsUserId,
    captured_at: input.capturedAt,
    timezone: input.timezone,
    coverage_rules: {
      past_slots_ignored: true,
      exact_hourly_slots: true,
      preserve_existing_schedule: true,
      occupancy_sources: ["threads_posts_archive", "scheduled_posts_all_statuses"],
      ...record(input.coverageRules),
    },
    source_candidates: cloneValue(sourceCandidates),
    saved_patterns: normalizeRows(savedPatterns),
    source_cards: normalizeRows(sourceCards),
    source_families: normalizeRows(sourceFamilies),
    source_selections: normalizeRows(sourceSelections),
    source_exclusions: normalizeRows(sourceExclusions),
    mature_metric_windows: normalizeRows(matureMetricWindows),
    source_exposure_history: normalizeRows(sourceExposureHistory),
    strategy: evidence.strategy,
    learning_brief: evidence.learning_brief,
    content_focus: evidence.content_focus,
    portfolio_state: portfolioState ? normalizeRows([portfolioState])[0] : null,
    experiments: normalizeRows(experiments),
    hypotheses: normalizeRows(hypotheses),
    repetition_evidence: normalizeRows(repetitionEvidence),
    follower_checkpoint: followerCheckpoint ? normalizeRows([followerCheckpoint])[0] : null,
    hard_bans: cloneValue(evidence.hard_bans),
    recent_performance: recentPerformance,
    strongest_posts: cloneValue(evidence.strongest_posts),
    weakest_posts: cloneValue(evidence.weakest_posts),
    recent_published: cloneValue(evidence.recent_published),
    future_scheduled: cloneValue(evidence.future_scheduled),
    eligibility_state: {
      candidate_count: sourceCandidates.length,
      eligible_candidate_count: activeCandidates.length,
      eligible_family_count: new Set(activeCandidates.map((candidate) => String(candidate.source_card_family_id))).size,
      excluded_candidate_count: excludedCandidates.length,
      excluded_candidates: excludedCandidates,
    },
    evidence_gaps: cloneValue(evidence.evidence_gaps),
    freshness: cloneValue(evidence.freshness),
    query_receipts: queryReceipts,
    production_fingerprint_before: fingerprintBefore,
    production_fingerprint_after: fingerprintAfter,
    zero_write_proof: {
      passed: zeroWritePassed,
      main_write_count: 0,
      query_count: queryReceipts.length,
      select_only_enforced: true,
    },
  };
  const snapshotHash = await hashManifestDecisionValue(withoutHash);
  return { ...withoutHash, snapshot_hash: snapshotHash };
}

export async function buildManifestDecisionScenarioOverlay(input: {
  snapshotHash: string;
  targetSlots: JsonRecord[];
  occupiedSlotKeys: string[];
}): Promise<ManifestDecisionScenarioOverlay> {
  const occupied = new Set(input.occupiedSlotKeys);
  const missing = input.targetSlots
    .map((slot) => String(slot.key ?? ""))
    .filter((slotKey) => slotKey && !occupied.has(slotKey));
  const withoutHash = {
    contract_version: MANIFEST_DECISION_SCENARIO_OVERLAY_VERSION,
    snapshot_hash: input.snapshotHash,
    target_slots: cloneValue(input.targetSlots),
    occupied_slot_keys: [...input.occupiedSlotKeys],
    missing_slot_keys: missing,
    diff_manifest: {
      changed_paths: ["coverage.target_slots", "coverage.occupied_slot_keys", "coverage.missing_slot_keys"],
      forbidden_changed_paths: [],
      evidence_unchanged: true,
    },
  };
  return { ...withoutHash, overlay_hash: await hashManifestDecisionValue(withoutHash) };
}

export async function compareManifestDecisionSelectorParity(input: {
  snapshot: ManifestDecisionSnapshot;
  slotKeys: string[];
  seed: string;
  minimumEligibleFamilies: number;
  selectSourceLineup: (selectionInput: {
    candidates: SourceSelectionCandidate[];
    slot_keys: string[];
    seed: string;
    include_parity_trace?: boolean;
  }) => {
    selected: SourceSelectionCandidate[];
    receipts: SourceSelectionReceipt[];
    summary: JsonRecord;
    parity_trace?: JsonRecord;
  };
}): Promise<ManifestDecisionParityReceipt> {
  const runSelector = () => input.selectSourceLineup({
    candidates: cloneValue(input.snapshot.source_candidates),
    slot_keys: [...input.slotKeys],
    seed: input.seed,
    include_parity_trace: true,
  });
  const mainEquivalent = runSelector();
  const innovation = runSelector();
  const mainTrace = record(mainEquivalent.parity_trace);
  const innovationTrace = record(innovation.parity_trace);
  const eligibleFamilyCount = Number(record(input.snapshot.eligibility_state).eligible_family_count ?? 0);
  const candidatePoolRequirementPassed = eligibleFamilyCount >= input.minimumEligibleFamilies;
  const mainEligible = mainTrace.eligible_pool ?? [];
  const innovationEligible = innovationTrace.eligible_pool ?? [];
  const mainExclusions = mainTrace.exclusions ?? [];
  const innovationExclusions = innovationTrace.exclusions ?? [];
  const mainRankings = mainTrace.slot_rankings ?? [];
  const innovationRankings = innovationTrace.slot_rankings ?? [];
  const mainSelected = mainEquivalent.receipts.map((receipt) => ({
    slot_key: receipt.slot_key,
    source_identity_key: receipt.source_identity_key,
    source_card_id: receipt.source_card_id,
    source_card_family_id: receipt.source_card_family_id,
  }));
  const innovationSelected = innovation.receipts.map((receipt) => ({
    slot_key: receipt.slot_key,
    source_identity_key: receipt.source_identity_key,
    source_card_id: receipt.source_card_id,
    source_card_family_id: receipt.source_card_family_id,
  }));
  const [
    eligiblePoolHash,
    exclusionsHash,
    rankedOrderHash,
    selectedLineupHash,
    mainOutputHash,
    innovationOutputHash,
  ] = await Promise.all([
    hashManifestDecisionValue(mainEligible),
    hashManifestDecisionValue(mainExclusions),
    hashManifestDecisionValue(mainRankings),
    hashManifestDecisionValue(mainSelected),
    hashManifestDecisionValue(mainEquivalent),
    hashManifestDecisionValue(innovation),
  ]);
  const eligiblePoolMatch = stableManifestDecisionJson(mainEligible) === stableManifestDecisionJson(innovationEligible);
  const exclusionsMatch = stableManifestDecisionJson(mainExclusions) === stableManifestDecisionJson(innovationExclusions);
  const rankedOrderMatch = stableManifestDecisionJson(mainRankings) === stableManifestDecisionJson(innovationRankings);
  const selectedLineupMatch = stableManifestDecisionJson(mainSelected) === stableManifestDecisionJson(innovationSelected);
  const parityPassed = candidatePoolRequirementPassed
    && eligiblePoolMatch
    && exclusionsMatch
    && rankedOrderMatch
    && selectedLineupMatch
    && mainOutputHash === innovationOutputHash;
  return {
    contract_version: MANIFEST_DECISION_PARITY_VERSION,
    snapshot_hash: input.snapshot.snapshot_hash,
    selector_seed: input.seed,
    requested_slot_count: input.slotKeys.length,
    eligible_family_count: eligibleFamilyCount,
    minimum_eligible_family_count: input.minimumEligibleFamilies,
    candidate_pool_requirement_passed: candidatePoolRequirementPassed,
    eligible_pool_hash: eligiblePoolHash,
    exclusions_hash: exclusionsHash,
    ranked_order_hash: rankedOrderHash,
    selected_lineup_hash: selectedLineupHash,
    main_equivalent_output_hash: mainOutputHash,
    innovation_output_hash: innovationOutputHash,
    eligible_pool_match: eligiblePoolMatch,
    exclusions_match: exclusionsMatch,
    ranked_order_match: rankedOrderMatch,
    selected_lineup_match: selectedLineupMatch,
    parity_passed: parityPassed,
    selected_source_to_slot: innovationSelected,
    main_equivalent: mainEquivalent,
    innovation,
  };
}

export function manifestDecisionSnapshotToShadowEvidence(snapshot: ManifestDecisionSnapshot): JsonRecord {
  return {
    captured_at: snapshot.captured_at,
    strategy: snapshot.strategy,
    learning_brief: snapshot.learning_brief,
    content_focus: snapshot.content_focus,
    hard_bans: snapshot.hard_bans,
    strongest_posts: snapshot.strongest_posts,
    weakest_posts: snapshot.weakest_posts,
    recent_published: snapshot.recent_published,
    future_scheduled: snapshot.future_scheduled,
    evidence_gaps: snapshot.evidence_gaps,
    production_fingerprint: snapshot.production_fingerprint_after,
    freshness: snapshot.freshness,
    decision_snapshot: snapshot,
  };
}

export function readManifestDecisionSnapshotFromShadowEvidence(value: unknown): ManifestDecisionSnapshot | null {
  const snapshot = record(record(value).decision_snapshot);
  if (!snapshot.snapshot_hash || !Array.isArray(snapshot.source_candidates)) return null;
  return snapshot as unknown as ManifestDecisionSnapshot;
}
