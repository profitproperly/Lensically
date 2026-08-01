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
            snapshot_version AS evidence_contract_version, created_at
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
            `SELECT id, version, contract_version, strategy_hash, status,
              source_cycle_id, created_at
       FROM operator_manifest_strategy_versions
       WHERE brand_key = ? AND status = 'active'
       ORDER BY version DESC LIMIT 1`,
    ).bind(input.brandKey).all<JsonRecord>(),
    db.prepare(
            `SELECT missing_slots_json, account_position_json,
              strategy_version_id AS input_strategy_version_id,
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
      audition_state: receipt.audition_state ?? null,
      recent_label: receipt.recent_label ?? null,
      score: receipt.score ?? null,
      cooldown_relaxation: receipt.cooldown_relaxation ?? null,
      preselection_policy_version: receipt.preselection_policy_version ?? null,
      preselection_policy_hash: receipt.preselection_policy_hash ?? null,
      preselection_score_multiplier: receipt.preselection_score_multiplier ?? 1,
      preselection_score_addend: receipt.preselection_score_addend ?? 0,
      preselection_signals: receipt.preselection_signals ?? [],
      experiment_reservation_key: receipt.experiment_reservation_key ?? null,
    };
  });
    const lockedSourcePlanHash = await sha256(lockedSourcePlan);
  const selectionCausalAuthority = {
    contract_version: "manifest-selection-causal-authority-v1",
    preselection_policy_versions: [...new Set(lockedSourcePlan.map((item) => item.preselection_policy_version).filter(Boolean))],
    preselection_policy_hashes: [...new Set(lockedSourcePlan.map((item) => item.preselection_policy_hash).filter(Boolean))],
    per_selection_trace_persisted: true,
    durable_receipt_authority: "operator_source_selection_plans.receipt_json",
    locked_source_plan_hash: lockedSourcePlanHash,
    stage_5_generation_and_audit_only: true,
  };

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
        locked_source_plan_hash: lockedSourcePlanHash,
    selection_causal_authority: selectionCausalAuthority,
    stage_authority: {

      stage_4: "selection_exclusion_reservation_weighting_ranking_and_source_to_slot_lock",
      stage_5: "generation_and_audit_context_only",
      stage_5_may_rerank: false,
      stage_5_may_substitute_sources: false,
      stage_5_may_change_slots: false,
    },
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
      stage_4_locked_source_plan_hash: lockedSourcePlanHash,
      stage_5_generation_and_audit_only: true,
      stage_5_source_or_slot_mutation_forbidden: true,
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

    let bundleCompactionLevel = 0;
  let bundleJson = stableJson(bundle);
  let payloadBytes = new TextEncoder().encode(bundleJson).byteLength;
  if (payloadBytes > MANIFEST_DECISION_BUNDLE_MAX_BYTES) {
    bundleCompactionLevel = 1;
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
    bundleCompactionLevel = 2;
    const compactPostForBundle = (post: JsonRecord, textLimit: number): JsonRecord => {
      const classification = record(post.classification);
      return {
        published_post_id: post.published_post_id,
        scheduled_post_id: post.scheduled_post_id ?? null,
        text: compactText(post.text, textLimit),
        published_at: post.published_at,
        primary_likes: finite(post.primary_likes),
        like_rate: post.like_rate ?? null,
        classification: {
          family_key: classification.family_key ?? classification.source_card_family_id ?? null,
          lifetime_label: classification.lifetime_label ?? null,
          recent_label: classification.recent_label ?? null,
          confidence_label: classification.confidence_label ?? null,
        },
      };
    };
    const compactAccountPosition = (value: unknown): JsonRecord => {
      const position = record(value);
      const scalarEntries = Object.entries(position)
        .filter(([, nested]) => nested === null || ["string", "number", "boolean"].includes(typeof nested))
        .slice(0, 24);
      const nestedSummaries = Object.entries(position)
        .filter(([, nested]) => Boolean(nested) && typeof nested === "object")
        .slice(0, 12)
        .map(([key, nested]) => {
          if (Array.isArray(nested)) return [key, { count: nested.length }];
          const child = record(nested);
          return [key, Object.fromEntries(
            Object.entries(child)
              .filter(([, childValue]) => childValue === null || ["string", "number", "boolean"].includes(typeof childValue))
              .slice(0, 12)
              .map(([childKey, childValue]) => [childKey, typeof childValue === "string" ? compactText(childValue, 240) : childValue]),
          )];
        });
      return Object.fromEntries([...scalarEntries, ...nestedSummaries]);
    };
    const exposure = record(bundle.recent_and_future_exposure);
    const missingSlots = records(exposure.authoritative_missing_slots);
    const familyStatesForBundle = records(bundle.family_performance_and_confidence);
    const selectedFamilies = familyStatesForBundle.filter((family) => family.selected_for_cycle === true);
    const remainingFamilies = familyStatesForBundle.filter((family) => family.selected_for_cycle !== true);
    bundle.strongest_mature_posts = records(bundle.strongest_mature_posts).slice(0, 5)
      .map((post) => compactPostForBundle(post, 480));
    bundle.weakest_mature_posts = records(bundle.weakest_mature_posts).slice(0, 5)
      .map((post) => compactPostForBundle(post, 480));
    bundle.family_performance_and_confidence = [...selectedFamilies, ...remainingFamilies]
      .slice(0, Math.max(16, selectedFamilies.length))
      .map((family) => ({
        source_card_family_id: family.source_card_family_id,
        source_identity_key: family.source_identity_key,
        lifetime_label: family.lifetime_label,
        recent_label: family.recent_label,
        confidence_label: family.confidence_label,
        lifetime_sample_size: family.lifetime_sample_size,
        recent_sample_size: family.recent_sample_size,
        lifetime_index: family.lifetime_index,
        recent_index: family.recent_index,
        selected_for_cycle: family.selected_for_cycle === true,
      }));
    bundle.recent_and_future_exposure = {
      exposure_snapshot_id: exposure.exposure_snapshot_id ?? null,
      account_position: compactAccountPosition(exposure.account_position),
      authoritative_missing_slots: missingSlots.map((slot) => ({
        key: slot.key ?? slot.slot_key,
        date: slot.date ?? null,
        time: slot.time ?? null,
      })),
    };
    bundle.locked_source_plan = records(bundle.locked_source_plan).map((plan) => ({
      slot_key: plan.slot_key,
      selection_order: plan.selection_order,
      source_identity_key: plan.source_identity_key,
      source_card_family_id: plan.source_card_family_id,
      source_card_id: plan.source_card_id,
      engine_version: plan.engine_version,
    }));
    bundle.active_experiments = records(bundle.active_experiments).slice(0, 5).map((experiment) => ({
      id: experiment.id,
      experiment_key: experiment.experiment_key,
      family_key: experiment.family_key,
      status: experiment.status,
      latest_result: experiment.latest_result,
      follow_up_decision: experiment.follow_up_decision,
    }));
    bundle.hard_bans = records(bundle.hard_bans).slice(0, 24).map((ban) => ({
      rule_key: ban.rule_key,
      rule_type: ban.rule_type,
      scope: ban.scope,
      description: compactText(ban.description, 160),
    }));
    bundleJson = stableJson(bundle);
    payloadBytes = new TextEncoder().encode(bundleJson).byteLength;
  }
  if (payloadBytes > MANIFEST_DECISION_BUNDLE_MAX_BYTES) {
    bundleCompactionLevel = 3;
    bundle.strongest_mature_posts = records(bundle.strongest_mature_posts).slice(0, 3).map((post) => ({
      ...post,
      text: compactText(post.text, 240),
    }));
    bundle.weakest_mature_posts = records(bundle.weakest_mature_posts).slice(0, 3).map((post) => ({
      ...post,
      text: compactText(post.text, 240),
    }));
    bundle.family_performance_and_confidence = records(bundle.family_performance_and_confidence)
      .filter((family, index) => family.selected_for_cycle === true || index < 8);
    const exposure = record(bundle.recent_and_future_exposure);
    bundle.recent_and_future_exposure = {
      exposure_snapshot_id: exposure.exposure_snapshot_id ?? null,
      account_position: record(exposure.account_position),
      authoritative_missing_slots: records(exposure.authoritative_missing_slots).map((slot) => ({ key: slot.key })),
    };
    bundle.active_experiments = records(bundle.active_experiments).slice(0, 3);
    bundle.hard_bans = records(bundle.hard_bans).slice(0, 16).map((ban) => ({
      rule_key: ban.rule_key,
      rule_type: ban.rule_type,
      scope: ban.scope,
    }));
    bundleJson = stableJson(bundle);
    payloadBytes = new TextEncoder().encode(bundleJson).byteLength;
  }
    if (payloadBytes > MANIFEST_DECISION_BUNDLE_MAX_BYTES) {
    bundleCompactionLevel = 4;
    const snapshotForBundle = record(bundle.snapshot);
    const benchmarkScalars = Object.fromEntries(
      Object.entries(record(snapshotForBundle.benchmarks))
        .filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value))
        .slice(0, 24)
        .map(([key, value]) => [key, typeof value === "string" ? compactText(value, 160) : value]),
    );
    const exposure = record(bundle.recent_and_future_exposure);
    const accountPosition = record(exposure.account_position);
    const accountScalars = Object.fromEntries(
      Object.entries(accountPosition)
        .filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value))
        .slice(0, 20)
        .map(([key, value]) => [key, typeof value === "string" ? compactText(value, 160) : value]),
    );
    const compactEvidencePost = (post: JsonRecord): JsonRecord => {
      const classification = record(post.classification);
      return {
        published_post_id: post.published_post_id,
        text: compactText(post.text, 160),
        published_at: post.published_at,
        primary_likes: finite(post.primary_likes),
        family_key: classification.family_key ?? classification.source_card_family_id ?? null,
        lifetime_label: classification.lifetime_label ?? null,
        recent_label: classification.recent_label ?? null,
      };
    };
    bundle.snapshot = {
      source_hash: snapshotForBundle.source_hash,
      evidence_contract_version: snapshotForBundle.evidence_contract_version,
      page_count: finite(snapshotForBundle.page_count),
      post_count: finite(snapshotForBundle.post_count),
      mature_count: finite(snapshotForBundle.mature_count),
      immature_count: finite(snapshotForBundle.immature_count),
      incomplete_count: finite(snapshotForBundle.incomplete_count),
      benchmarks: benchmarkScalars,
      page_hashes: records(snapshotForBundle.page_hashes).map((page) => ({
        page_index: finite(page.page_index),
        page_hash: page.page_hash,
      })),
    };
    bundle.strongest_mature_posts = records(bundle.strongest_mature_posts).slice(0, 3).map(compactEvidencePost);
    bundle.weakest_mature_posts = records(bundle.weakest_mature_posts).slice(0, 3).map(compactEvidencePost);
    bundle.family_performance_and_confidence = records(bundle.family_performance_and_confidence)
      .sort((left, right) => Number(right.selected_for_cycle === true) - Number(left.selected_for_cycle === true))
      .slice(0, 12)
      .map((family) => ({
        source_card_family_id: family.source_card_family_id,
        lifetime_label: family.lifetime_label,
        recent_label: family.recent_label,
        confidence_label: family.confidence_label,
        lifetime_index: family.lifetime_index,
        recent_index: family.recent_index,
        selected_for_cycle: family.selected_for_cycle === true,
      }));
    bundle.recent_and_future_exposure = {
      exposure_snapshot_id: exposure.exposure_snapshot_id ?? null,
      account_position: accountScalars,
      authoritative_missing_slots: records(exposure.authoritative_missing_slots).map((slot) => ({
        key: slot.key ?? slot.slot_key,
        date: slot.date ?? null,
        time: slot.time ?? null,
      })),
    };
    bundle.locked_source_plan = records(bundle.locked_source_plan).map((plan) => ({
      slot_key: plan.slot_key,
      selection_order: plan.selection_order,
      source_identity_key: plan.source_identity_key,
      source_card_family_id: plan.source_card_family_id,
      source_card_id: plan.source_card_id,
      engine_version: plan.engine_version,
    }));
    bundle.active_experiments = records(bundle.active_experiments).slice(0, 2).map((experiment) => ({
      id: experiment.id,
      experiment_key: experiment.experiment_key,
      family_key: experiment.family_key,
      status: experiment.status,
      follow_up_decision: compactText(experiment.follow_up_decision, 160) || null,
    }));
    bundle.unresolved_evidence_gaps = records(bundle.unresolved_evidence_gaps).map((gap) => ({
      gap_key: gap.gap_key,
      count: gap.count ?? null,
      source_card_family_ids: Array.isArray(gap.source_card_family_ids)
        ? gap.source_card_family_ids.slice(0, 12)
        : undefined,
    }));
    bundle.hard_bans = records(bundle.hard_bans).map((ban) => ({ rule_key: ban.rule_key }));
        bundle.required_directives = {
      primary_metric: "24_hour_likes",
      source_backed_generation_only: true,
      original_model_sources_forbidden: true,
      exact_locked_plan_required: true,
      stage_4_locked_source_plan_hash: bundle.locked_source_plan_hash,
      stage_5_generation_and_audit_only: true,
      stage_5_source_or_slot_mutation_forbidden: true,
      deterministic_gates_server_owned: true,
    };

    const strategyAuthority = record(bundle.current_strategy_authority);
    bundle.current_strategy_authority = Object.keys(strategyAuthority).length
      ? {
          id: strategyAuthority.id,
          version: strategyAuthority.version,
          contract_version: strategyAuthority.contract_version,
          strategy_hash: strategyAuthority.strategy_hash,
          status: strategyAuthority.status,
          source_cycle_id: strategyAuthority.source_cycle_id,
        }
      : null;
    bundle.bundle_compaction = {
      level: 4,
      reason: "payload_budget",
      complete_locked_source_plan_preserved: true,
      detail_pages_available_for_ambiguity: true,
    };
    bundleJson = stableJson(bundle);
    payloadBytes = new TextEncoder().encode(bundleJson).byteLength;
  }
  if (payloadBytes > MANIFEST_DECISION_BUNDLE_MAX_BYTES) {
    bundleCompactionLevel = 5;
    const snapshotForBundle = record(bundle.snapshot);
    const exposure = record(bundle.recent_and_future_exposure);
    bundle.snapshot = {
      source_hash: snapshotForBundle.source_hash,
      evidence_contract_version: snapshotForBundle.evidence_contract_version,
      page_count: finite(snapshotForBundle.page_count),
      post_count: finite(snapshotForBundle.post_count),
      mature_count: finite(snapshotForBundle.mature_count),
      immature_count: finite(snapshotForBundle.immature_count),
      incomplete_count: finite(snapshotForBundle.incomplete_count),
      page_hashes: records(snapshotForBundle.page_hashes).map((page) => page.page_hash),
    };
    const evidenceIdentityOnly = (post: JsonRecord): JsonRecord => ({
      published_post_id: post.published_post_id,
      primary_likes: finite(post.primary_likes),
      family_key: post.family_key ?? null,
      lifetime_label: post.lifetime_label ?? null,
      recent_label: post.recent_label ?? null,
    });
    bundle.strongest_mature_posts = records(bundle.strongest_mature_posts).slice(0, 3).map(evidenceIdentityOnly);
    bundle.weakest_mature_posts = records(bundle.weakest_mature_posts).slice(0, 3).map(evidenceIdentityOnly);
    bundle.family_performance_and_confidence = records(bundle.family_performance_and_confidence)
      .filter((family) => family.selected_for_cycle === true)
      .slice(0, 8);
    bundle.recent_and_future_exposure = {
      exposure_snapshot_id: exposure.exposure_snapshot_id ?? null,
      authoritative_missing_slots: records(exposure.authoritative_missing_slots).map((slot) => ({ key: slot.key })),
    };
    bundle.locked_source_plan = records(bundle.locked_source_plan).map((plan) => ({
      slot_key: plan.slot_key,
      selection_order: plan.selection_order,
      source_identity_key: plan.source_identity_key,
      source_card_family_id: plan.source_card_family_id,
      source_card_id: plan.source_card_id,
    }));
    bundle.active_experiments = [];
    bundle.hard_bans = records(bundle.hard_bans).map((ban) => ban.rule_key);
    bundle.bundle_compaction = {
      level: 5,
      reason: "payload_budget_essential_identity_only",
      complete_locked_source_plan_preserved: true,
      detail_pages_required_for_evidence_text: true,
    };
    bundleJson = stableJson(bundle);
    payloadBytes = new TextEncoder().encode(bundleJson).byteLength;
  }
  if (payloadBytes > MANIFEST_DECISION_BUNDLE_MAX_BYTES) {
    throw new Error(`manifest_decision_bundle_too_large_after_essential_compaction:${payloadBytes}`);
  }


  const bundleHash = await sha256(bundle);
  const id = crypto.randomUUID();
  const detailReasons = unresolvedEvidenceGaps
    .filter((gap) => ["incomplete_post_evidence", "limited_mature_evidence"].includes(String(gap.gap_key ?? "")))
    .map((gap) => String(gap.gap_key ?? ""));
  if (bundleCompactionLevel > 0) detailReasons.push(`bundle_size_compaction_level_${bundleCompactionLevel}`);
  const requiresDetailRead = detailReasons.length > 0;
  const detailReason = requiresDetailRead ? detailReasons.join(",") : null;
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
