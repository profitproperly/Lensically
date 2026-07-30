import { assertDatabaseIntegrity } from "./databaseIntegrity";

type JsonRecord = Record<string, unknown>;

export const MANIFEST_DECISION_BUNDLE_CONTRACT_VERSION = "manifest-decision-bundle-v1";
export const MANIFEST_DECISION_BUNDLE_MAX_BYTES = 24_000;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function parseJson(value: unknown, fallback: unknown): unknown {
  try {
    return JSON.parse(String(value ?? ""));
  } catch {
    return fallback;
  }
}

function finite(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function compactText(value: unknown, maxLength = 1200): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stable(nested)]),
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(stable(value));
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureDecisionBundleTable(db: D1Database): Promise<void> {
  await assertDatabaseIntegrity(db, {
    table: "operator_manifest_decision_bundles",
    columns: [
      "id",
      "cycle_id",
      "brand_key",
      "snapshot_id",
      "contract_version",
      "bundle_hash",
      "page_hashes_json",
      "bundle_json",
      "payload_bytes",
      "requires_detail_read",
      "detail_reason",
      "consumed_at",
      "created_at",
      "updated_at",
    ],
  });
}

function serializeBundleRow(row: JsonRecord): JsonRecord {
  return {
    id: row.id,
    cycle_id: row.cycle_id,
    brand_key: row.brand_key,
    snapshot_id: row.snapshot_id,
    contract_version: row.contract_version,
    bundle_hash: row.bundle_hash,
    page_hashes: parseJson(row.page_hashes_json, []),
    bundle: parseJson(row.bundle_json, {}),
    payload_bytes: finite(row.payload_bytes),
    requires_detail_read: finite(row.requires_detail_read) === 1,
    detail_reason: row.detail_reason ?? null,
    consumed_at: row.consumed_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function buildManifestDecisionBundle(
  db: D1Database,
  input: {
    brandKey: string;
    cycleId: string;
    snapshotId: string;
  },
): Promise<JsonRecord> {
  await ensureDecisionBundleTable(db);
  const existing = await db.prepare(
    `SELECT * FROM operator_manifest_decision_bundles
     WHERE cycle_id = ? AND brand_key = ? LIMIT 1`,
  ).bind(input.cycleId, input.brandKey).first<JsonRecord>();
  if (existing) {
    if (String(existing.snapshot_id ?? "") !== input.snapshotId) {
      throw new Error("manifest_decision_bundle_snapshot_conflict");
    }
    return { ...serializeBundleRow(existing), replayed: true };
  }

  const snapshot = await db.prepare(
    `SELECT id, cycle_id, brand_key, source_hash, page_count, post_count,
            mature_count, immature_count, incomplete_count, benchmarks_json,
            evidence_contract_version, created_at
     FROM operator_manifest_evidence_snapshots
     WHERE id = ? AND cycle_id = ? AND brand_key = ? LIMIT 1`,
  ).bind(input.snapshotId, input.cycleId, input.brandKey).first<JsonRecord>();
  if (!snapshot) throw new Error("manifest_evidence_snapshot_not_found");

  const [pageRows, strongestRows, weakestRows, familyRows, planRows, hardBanRows, experimentRows, strategyRows, cycle] = await Promise.all([
    db.prepare(
      `SELECT page_index, page_contract_version, item_count, byte_count,
              evidence_types_json, items_json
       FROM operator_manifest_evidence_pages
       WHERE snapshot_id = ? AND cycle_id = ? AND brand_key = ?
       ORDER BY page_index ASC`,
    ).bind(input.snapshotId, input.cycleId, input.brandKey).all<JsonRecord>(),
    db.prepare(
      `SELECT published_post_id, scheduled_post_id, text, published_at,
              primary_likes, like_rate, metrics_json, lineage_json, classification_json
       FROM operator_manifest_evidence_posts
       WHERE snapshot_id = ? AND maturity_state = 'mature'
       ORDER BY primary_likes DESC, datetime(published_at) DESC LIMIT 8`,
    ).bind(input.snapshotId).all<JsonRecord>(),
    db.prepare(
      `SELECT published_post_id, scheduled_post_id, text, published_at,
              primary_likes, like_rate, metrics_json, lineage_json, classification_json
       FROM operator_manifest_evidence_posts
       WHERE snapshot_id = ? AND maturity_state = 'mature'
       ORDER BY primary_likes ASC, datetime(published_at) ASC LIMIT 8`,
    ).bind(input.snapshotId).all<JsonRecord>(),
    db.prepare(
      `SELECT source_card_family_id, source_identity_key, lifetime_label, recent_label,
              confidence_label, lifetime_sample_size, recent_sample_size,
              lifetime_index, recent_index, probability_above_median,
              probability_above_franchise_floor, probability_below_underperformance_floor,
              updated_at
       FROM operator_source_family_evidence_states
       WHERE brand_key = ?
       ORDER BY confidence_label DESC, lifetime_index DESC LIMIT 40`,
    ).bind(input.brandKey).all<JsonRecord>(),
    db.prepare(
      `SELECT slot_key, selection_order, source_identity_key, source_card_family_id,
              source_card_id, engine_version, receipt_json, status
       FROM operator_source_selection_plans
       WHERE brand_key = ? AND cycle_id = ? AND status = 'locked'
       ORDER BY selection_order ASC`,
    ).bind(input.brandKey, input.cycleId).all<JsonRecord>(),
    db.prepare(
      `SELECT rule_key, description, rule_type, pattern, scope, source_authority, updated_at
       FROM operator_manifest_hard_bans
       WHERE brand_key = ? AND active = 1
       ORDER BY rule_key ASC LIMIT 32`,
    ).bind(input.brandKey).all<JsonRecord>(),
    db.prepare(
      `SELECT id, experiment_key, family_key, hypothesis_json, comparison_group_json,
              maturity_windows_json, result_criteria_json, status, latest_result_json,
              follow_up_decision, updated_at
       FROM operator_manifest_experiments
       WHERE brand_key = ? AND status NOT IN ('completed', 'stopped')
       ORDER BY datetime(updated_at) DESC LIMIT 20`,
    ).bind(input.brandKey).all<JsonRecord>(),
    db.prepare(
      `SELECT id, version, strategy_hash, status, effective_from, created_at
       FROM operator_manifest_strategy_versions
       WHERE brand_key = ? AND status = 'active'
       ORDER BY version DESC LIMIT 1`,
    ).bind(input.brandKey).all<JsonRecord>(),
    db.prepare(
      `SELECT missing_slots_json, account_position_json, input_strategy_version_id,
              exposure_snapshot_id, timezone, horizon_hours, updated_at
       FROM operator_autonomous_growth_cycles
       WHERE id = ? AND brand_key = ? LIMIT 1`,
    ).bind(input.cycleId, input.brandKey).first<JsonRecord>(),
  ]);
  if (!cycle) throw new Error("manifest_cycle_not_found");

  const pages = pageRows.results ?? [];
  if (pages.length !== finite(snapshot.page_count)) {
    throw new Error("manifest_decision_bundle_page_count_mismatch");
  }
  const pageHashes = await Promise.all(pages.map(async (page) => ({
    page_index: finite(page.page_index),
    page_contract_version: page.page_contract_version,
    item_count: finite(page.item_count),
    byte_count: finite(page.byte_count),
    evidence_types: parseJson(page.evidence_types_json, []),
    page_hash: await sha256({
      page_index: finite(page.page_index),
      page_contract_version: page.page_contract_version,
      item_count: finite(page.item_count),
      byte_count: finite(page.byte_count),
      evidence_types: parseJson(page.evidence_types_json, []),
      items: parseJson(page.items_json, []),
    }),
  })));

  const compactPost = (row: JsonRecord): JsonRecord => ({
    published_post_id: String(row.published_post_id ?? ""),
    scheduled_post_id: row.scheduled_post_id ?? null,
    text: compactText(row.text, 1800),
    published_at: row.published_at,
    primary_likes: finite(row.primary_likes),
    like_rate: row.like_rate === null || row.like_rate === undefined ? null : finite(row.like_rate),
    metrics: parseJson(row.metrics_json, {}),
    lineage: parseJson(row.lineage_json, {}),
    classification: parseJson(row.classification_json, {}),
  });

  const selectedFamilyIds = new Set((planRows.results ?? []).map((row) => String(row.source_card_family_id ?? "")));
  const familyStates = (familyRows.results ?? [])
    .sort((left, right) => Number(selectedFamilyIds.has(String(right.source_card_family_id ?? "")))
      - Number(selectedFamilyIds.has(String(left.source_card_family_id ?? ""))))
    .slice(0, 32)
    .map((row) => ({
      source_card_family_id: row.source_card_family_id,
      source_identity_key: row.source_identity_key,
      lifetime_label: row.lifetime_label,
      recent_label: row.recent_label,
      confidence_label: row.confidence_label,
      lifetime_sample_size: finite(row.lifetime_sample_size),
      recent_sample_size: finite(row.recent_sample_size),
      lifetime_index: finite(row.lifetime_index, 1),
      recent_index: row.recent_index === null || row.recent_index === undefined ? null : finite(row.recent_index, 1),
      probability_above_median: finite(row.probability_above_median, 0.5),
      probability_above_franchise_floor: finite(row.probability_above_franchise_floor, 0.5),
      probability_below_underperformance_floor: finite(row.probability_below_underperformance_floor, 0.5),
      selected_for_cycle: selectedFamilyIds.has(String(row.source_card_family_id ?? "")),
    }));

  const lockedSourcePlan = (planRows.results ?? []).map((row) => {
    const receipt = record(parseJson(row.receipt_json, {}));
    return {
      slot_key: row.slot_key,
      selection_order: finite(row.selection_order),
      source_identity_key: row.source_identity_key,
      source_card_family_id: row.source_card_family_id,
      source_card_id: row.source_card_id,
      engine_version: row.engine_version,
      lifetime_label: receipt.lifetime_label ?? null,
      recent_label: receipt.recent_label ?? null,
      score: receipt.score ?? null,
      cooldown_relaxation: receipt.cooldown_relaxation ?? null,
    };
  });

  const activeExperiments = (experimentRows.results ?? []).map((row) => ({
    id: row.id,
    experiment_key: row.experiment_key,
    family_key: row.family_key,
    status: row.status,
    hypothesis: parseJson(row.hypothesis_json, {}),
    comparison_group: parseJson(row.comparison_group_json, {}),
    maturity_windows: parseJson(row.maturity_windows_json, []),
    result_criteria: parseJson(row.result_criteria_json, {}),
    latest_result: parseJson(row.latest_result_json, {}),
    follow_up_decision: row.follow_up_decision ?? null,
    updated_at: row.updated_at,
  }));

  const incompleteCount = finite(snapshot.incomplete_count);
  const matureCount = finite(snapshot.mature_count);
  const lowConfidenceSelected = familyStates.filter((family) =>
    family.selected_for_cycle === true && ["low", "developing"].includes(String(family.confidence_label ?? ""))
  );
  const unresolvedEvidenceGaps: JsonRecord[] = [];
  if (incompleteCount > 0) unresolvedEvidenceGaps.push({
    gap_key: "incomplete_post_evidence",
    count: incompleteCount,
    required_action: "Do not cite incomplete posts as mature evidence.",
  });
  if (matureCount < 2) unresolvedEvidenceGaps.push({
    gap_key: "limited_mature_evidence",
    count: matureCount,
    required_action: "Keep account conclusions narrow and explicitly uncertainty-aware.",
  });
  if (lowConfidenceSelected.length) unresolvedEvidenceGaps.push({
    gap_key: "selected_low_confidence_families",
    source_card_family_ids: lowConfidenceSelected.map((family) => family.source_card_family_id),
    required_action: "Treat these slots as bounded exploration, not proven deployment.",
  });

  const currentStrategyAuthority = strategyRows.results?.[0] ?? null;
  const bundle: JsonRecord = {
    contract_version: MANIFEST_DECISION_BUNDLE_CONTRACT_VERSION,
    cycle_id: input.cycleId,
    snapshot_id: input.snapshotId,
    snapshot: {
      source_hash: snapshot.source_hash,
      evidence_contract_version: snapshot.evidence_contract_version,
      page_count: finite(snapshot.page_count),
      post_count: finite(snapshot.post_count),
      mature_count: matureCount,
      immature_count: finite(snapshot.immature_count),
      incomplete_count: incompleteCount,
      benchmarks: parseJson(snapshot.benchmarks_json, {}),
      page_hashes: pageHashes,
    },
    strongest_mature_posts: (strongestRows.results ?? []).map(compactPost),
    weakest_mature_posts: (weakestRows.results ?? []).map(compactPost),
    family_performance_and_confidence: familyStates,
    recent_and_future_exposure: {
      exposure_snapshot_id: cycle.exposure_snapshot_id ?? null,
      account_position: parseJson(cycle.account_position_json, {}),
      authoritative_missing_slots: records(parseJson(cycle.missing_slots_json, [])),
    },
    locked_source_plan: lockedSourcePlan,
    active_experiments: activeExperiments,
    unresolved_evidence_gaps: unresolvedEvidenceGaps,
    hard_bans: (hardBanRows.results ?? []).map((row) => ({
      rule_key: row.rule_key,
      description: compactText(row.description, 600),
      rule_type: row.rule_type,
      pattern: compactText(row.pattern, 800),
      scope: row.scope,
      source_authority: row.source_authority,
    })),
    required_directives: {
      primary_metric: "24_hour_likes",
      source_backed_generation_only: true,
      original_model_sources_forbidden: true,
      exact_locked_plan_required: true,
      deterministic_hard_bans_server_owned: true,
      deterministic_duplicate_and_slot_checks_server_owned: true,
      model_judgment_retained: [
        "account strategy",
        "wording",
        "adaptation fidelity",
        "novelty judgment",
        "audience reward",
        "slot placement rationale",
        "response to genuine candidate failures",
      ],
    },
    current_strategy_authority: currentStrategyAuthority,
    strategy_change_threshold: {
      change_only_when: [
        "new mature evidence materially changes the account conclusion",
        "family confidence or recent state materially changes",
        "an active experiment reaches its result threshold",
        "a hard ban or source eligibility change invalidates the current plan",
      ],
      otherwise: "Preserve the latest active account strategy and adapt only the cycle lineup and wording.",
    },
  };

  let bundleJson = stableJson(bundle);
  let payloadBytes = new TextEncoder().encode(bundleJson).byteLength;
  if (payloadBytes > MANIFEST_DECISION_BUNDLE_MAX_BYTES) {
    bundle.strongest_mature_posts = records(bundle.strongest_mature_posts).slice(0, 5);
    bundle.weakest_mature_posts = records(bundle.weakest_mature_posts).slice(0, 5);
    bundle.family_performance_and_confidence = records(bundle.family_performance_and_confidence).slice(0, 20);
    bundle.active_experiments = records(bundle.active_experiments).slice(0, 10);
    bundle.hard_bans = records(bundle.hard_bans).map((ban) => ({
      rule_key: ban.rule_key,
      rule_type: ban.rule_type,
      scope: ban.scope,
      description: compactText(ban.description, 240),
    }));
    bundleJson = stableJson(bundle);
    payloadBytes = new TextEncoder().encode(bundleJson).byteLength;
  }
  if (payloadBytes > MANIFEST_DECISION_BUNDLE_MAX_BYTES) {
    throw new Error(`manifest_decision_bundle_too_large:${payloadBytes}`);
  }

  const bundleHash = await sha256(bundle);
  const id = crypto.randomUUID();
  const requiresDetailRead = unresolvedEvidenceGaps.some((gap) =>
    ["incomplete_post_evidence", "limited_mature_evidence"].includes(String(gap.gap_key ?? ""))
  );
  const detailReason = requiresDetailRead
    ? unresolvedEvidenceGaps.map((gap) => String(gap.gap_key ?? "")).join(",")
    : null;
  await db.prepare(
    `INSERT INTO operator_manifest_decision_bundles (
       id, cycle_id, brand_key, snapshot_id, contract_version, bundle_hash,
       page_hashes_json, bundle_json, payload_bytes, requires_detail_read, detail_reason
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    input.cycleId,
    input.brandKey,
    input.snapshotId,
    MANIFEST_DECISION_BUNDLE_CONTRACT_VERSION,
    bundleHash,
    stableJson(pageHashes),
    bundleJson,
    payloadBytes,
    requiresDetailRead ? 1 : 0,
    detailReason,
  ).run();
  const created = await db.prepare(
    `SELECT * FROM operator_manifest_decision_bundles WHERE id = ? LIMIT 1`,
  ).bind(id).first<JsonRecord>();
  return { ...serializeBundleRow(created ?? { id }), replayed: false };
}

export async function consumeManifestDecisionBundle(
  db: D1Database,
  input: {
    brandKey: string;
    cycleId: string;
    snapshotId: string;
    bundleId: string;
    bundleHash?: string | null;
  },
): Promise<JsonRecord> {
  await ensureDecisionBundleTable(db);
  const row = await db.prepare(
    `SELECT * FROM operator_manifest_decision_bundles
     WHERE id = ? AND cycle_id = ? AND brand_key = ? AND snapshot_id = ? LIMIT 1`,
  ).bind(input.bundleId, input.cycleId, input.brandKey, input.snapshotId).first<JsonRecord>();
  if (!row) throw new Error("manifest_decision_bundle_not_found");
  if (input.bundleHash && String(row.bundle_hash ?? "") !== input.bundleHash) {
    throw new Error("manifest_decision_bundle_hash_mismatch");
  }
  await db.prepare(
    `UPDATE operator_manifest_decision_bundles
     SET consumed_at = COALESCE(consumed_at, CURRENT_TIMESTAMP)
     WHERE id = ?`,
  ).bind(input.bundleId).run();
  const consumed = await db.prepare(
    `SELECT * FROM operator_manifest_decision_bundles WHERE id = ? LIMIT 1`,
  ).bind(input.bundleId).first<JsonRecord>();
  return serializeBundleRow(consumed ?? row);
}

export async function getManifestDecisionBundleConsumptionState(
  db: D1Database,
  input: {
    brandKey: string;
    cycleId: string;
    snapshotId: string;
    bundleId?: string | null;
  },
): Promise<JsonRecord> {
  await ensureDecisionBundleTable(db);
  const row = input.bundleId
    ? await db.prepare(
      `SELECT * FROM operator_manifest_decision_bundles
       WHERE id = ? AND cycle_id = ? AND brand_key = ? AND snapshot_id = ? LIMIT 1`,
    ).bind(input.bundleId, input.cycleId, input.brandKey, input.snapshotId).first<JsonRecord>()
    : await db.prepare(
      `SELECT * FROM operator_manifest_decision_bundles
       WHERE cycle_id = ? AND brand_key = ? AND snapshot_id = ? LIMIT 1`,
    ).bind(input.cycleId, input.brandKey, input.snapshotId).first<JsonRecord>();
  if (!row) return { complete: false, error: "manifest_decision_bundle_not_found" };
  return {
    bundle_id: row.id,
    bundle_hash: row.bundle_hash,
    snapshot_id: row.snapshot_id,
    contract_version: row.contract_version,
    payload_bytes: finite(row.payload_bytes),
    requires_detail_read: finite(row.requires_detail_read) === 1,
    detail_reason: row.detail_reason ?? null,
    consumed_at: row.consumed_at ?? null,
    complete: Boolean(row.consumed_at),
  };
}
