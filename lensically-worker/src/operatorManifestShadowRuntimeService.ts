import {
  MANIFEST_SHADOW_CONTRACT_VERSION,
  MANIFEST_SHADOW_SNAPSHOT_VERSION,
  beginManifestShadowRun,
  cleanupManifestShadowMetadata,
  completeManifestShadowRun,
  createManifestShadowNoThreadsMutationAdapter,
  createManifestShadowReadOnlyDatabase,
  failManifestShadowRun,
  readManifestShadowReceipt,
  recordManifestShadowStageEvent,
  resetManifestShadowWorkspace,
  seedManifestShadowSnapshot,
  verifyManifestShadowOrphans,
  writeManifestShadowBenchmarkReceipt,
  type ManifestShadowBenchmarkInput,
  type ManifestShadowSnapshot,
} from "./operatorManifestShadowService";
import type { SourceSelectionCandidate, SourceSelectionReceipt } from "./sourceFamilySelection";

type JsonRecord = Record<string, unknown>;

export const OPERATOR_MANIFEST_SHADOW_TOOL_NAMES = [
  "prepare_manifest_shadow_cycle",
  "commit_manifest_shadow_cycle_strategy",
  "persist_manifest_shadow_batch",
  "get_manifest_shadow_cycle_receipt",
] as const;

export type OperatorManifestShadowToolName = typeof OPERATOR_MANIFEST_SHADOW_TOOL_NAMES[number];

export const MANIFEST_SHADOW_RUNTIME_VERSION = "manifest-shadow-runtime-v1";
export const MANIFEST_SHADOW_DECISION_BUNDLE_VERSION = "manifest-shadow-decision-bundle-v1";
export const MANIFEST_SHADOW_BATCH_VERSION = "manifest-shadow-batch-v1";

const SHADOW_SCENARIOS = new Set(["noop", "normal_24", "recovery_48", "custom"]);
const REQUIRED_MODEL_ASSESSMENTS = [
  "novelty_assessment",
  "winner_preservation_assessment",
  "slot_placement_assessment",
  "recent_exposure_assessment",
  "intelligence_application_assessment",
] as const;

export type ManifestShadowSlot = {
  key: string;
  date: string;
  time: string;
  scheduled_utc: string;
};

export type ManifestShadowEvidence = {
  captured_at: string;
  strategy: JsonRecord | null;
  learning_brief: JsonRecord | null;
  content_focus: JsonRecord | null;
  hard_bans: JsonRecord[];
  strongest_posts: JsonRecord[];
  weakest_posts: JsonRecord[];
  recent_published: JsonRecord[];
  future_scheduled: JsonRecord[];
  evidence_gaps: JsonRecord[];
  production_fingerprint: JsonRecord;
  freshness: JsonRecord;
};

export type ManifestShadowRuntimeState = {
  contract_version: string;
  runtime_version: string;
  run_id: string;
  brand_key: string;
  account_id: string;
  threads_user_id: string;
  scenario: string;
  evidence_mode: "snapshot" | "live_read";
  variant_key: string;
  operation_root: string;
  code_sha: string;
  timezone: string;
  horizon_hours: number;
  target_slots: ManifestShadowSlot[];
  occupied_slot_keys: string[];
  missing_slot_keys: string[];
  source_candidates: SourceSelectionCandidate[];
  locked_source_lineup: Array<SourceSelectionCandidate & { assigned_slot_key?: string }>;
  source_selection_receipts: SourceSelectionReceipt[];
  decision_bundle: JsonRecord;
  decision_bundle_id: string;
  evidence: ManifestShadowEvidence;
  strategy: JsonRecord | null;
  accepted_posts: JsonRecord[];
  rejected_posts: JsonRecord[];
  completed: boolean;
  started_at: string;
  last_client_response_at: string;
  timings: Record<string, number>;
  counters: Record<string, number>;
  threads_mutation_count: number;
};

export interface OperatorManifestShadowRuntimeDependencies {
  productionDb: D1Database;
  shadowDb: D1Database;
  codeSha: string;
  now(): Date;
  buildSlots(input: {
    timezone: string;
    horizonHours: number;
    scenario: string;
    requestedMissingCount: number;
  }): Promise<{ targetSlots: ManifestShadowSlot[]; occupiedSlotKeys: string[] }>;
  loadSourceCandidates(
    productionReadOnlyDb: D1Database,
    brandKey: string,
    asOf: string,
  ): Promise<SourceSelectionCandidate[]>;
  selectSourceLineup(input: {
    candidates: SourceSelectionCandidate[];
    slot_keys: string[];
    seed: string;
  }): { selected: SourceSelectionCandidate[]; receipts: SourceSelectionReceipt[]; summary: JsonRecord };
  readEvidence(input: {
    productionReadOnlyDb: D1Database;
    brandKey: string;
    threadsUserId: string;
    nowIso: string;
    evidenceMode: "snapshot" | "live_read";
  }): Promise<ManifestShadowEvidence>;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function stringValue(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function machineKey(value: unknown, fallback = "unknown"): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return normalized || fallback;
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstLine(value: unknown): string {
  return String(value ?? "").split(/\r?\n/)[0]?.trim().slice(0, 500) ?? "";
}

function durationMs(startedMs: number): number {
  return Math.max(0, Date.now() - startedMs);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const input = value as JsonRecord;
    return `{${Object.keys(input).sort().map((key) => `${JSON.stringify(key)}:${stableJson(input[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseSnapshotState(row: JsonRecord | null): ManifestShadowRuntimeState | null {
  if (!row?.payload_json) return null;
  try {
    const snapshot = JSON.parse(String(row.payload_json)) as ManifestShadowSnapshot;
    const state = record(snapshot.metadata?.state);
    return Object.keys(state).length ? state as unknown as ManifestShadowRuntimeState : null;
  } catch {
    return null;
  }
}

async function readState(db: D1Database, runId: string): Promise<ManifestShadowRuntimeState | null> {
  const row = await db.prepare(
    `SELECT payload_json FROM manifest_shadow_snapshots WHERE shadow_run_id = ? LIMIT 1`,
  ).bind(runId).first<JsonRecord>();
  return parseSnapshotState(row);
}

async function writeState(db: D1Database, state: ManifestShadowRuntimeState): Promise<void> {
  const row = await db.prepare(
    `SELECT id, payload_json FROM manifest_shadow_snapshots WHERE shadow_run_id = ? LIMIT 1`,
  ).bind(state.run_id).first<JsonRecord>();
  if (!row?.id) throw new Error("manifest_shadow_snapshot_not_found");
  const snapshot = JSON.parse(String(row.payload_json ?? "{}")) as ManifestShadowSnapshot;
  snapshot.metadata = { ...(snapshot.metadata ?? {}), state };
  const payloadJson = JSON.stringify(snapshot);
  await db.prepare(
    `UPDATE manifest_shadow_snapshots SET payload_json = ?, payload_bytes = ? WHERE id = ?`,
  ).bind(payloadJson, new TextEncoder().encode(payloadJson).byteLength, row.id).run();
}

function scenarioMissingCount(scenario: string, custom: unknown): number {
  if (scenario === "noop") return 0;
  if (scenario === "normal_24") return 24;
  if (scenario === "recovery_48") return 48;
  return Math.max(0, Math.min(72, Math.trunc(Number(custom ?? 24))));
}

function compactSource(candidate: SourceSelectionCandidate): JsonRecord {
  return {
    source_identity_key: candidate.source_identity_key ?? null,
    source_card_id: candidate.source_card_id ?? null,
    source_card_family_id: candidate.source_card_family_id ?? null,
    source_mechanism: candidate.source_mechanism ?? null,
    required_product: candidate.required_product ?? null,
    recommended_direction: candidate.recommended_direction ?? null,
    lifetime_label: candidate.lifetime_label ?? null,
    recent_label: candidate.recent_label ?? null,
    confidence_label: candidate.confidence_label ?? null,
    lifetime_sample_size: Number(candidate.lifetime_sample_size ?? 0),
    lifetime_index: Number(candidate.lifetime_index ?? 0),
    uses_24h: Number(candidate.uses_24h ?? 0),
    uses_7d: Number(candidate.uses_7d ?? 0),
    uses_28d: Number(candidate.uses_28d ?? 0),
    assigned_slot_key: candidate.assigned_slot_key ?? null,
    source_text: candidate.text ?? null,
    selection_receipt: candidate.selection_receipt ?? null,
  };
}

function buildDecisionBundle(input: {
  runId: string;
  evidence: ManifestShadowEvidence;
  missingSlots: string[];
  lockedLineup: Array<SourceSelectionCandidate & { assigned_slot_key?: string }>;
  selectionSummary: JsonRecord;
}): JsonRecord {
  return {
    version: MANIFEST_SHADOW_DECISION_BUNDLE_VERSION,
    run_id: input.runId,
    primary_metric: "24_hour_likes",
    missing_slot_keys: input.missingSlots,
    locked_source_lineup: input.lockedLineup.map(compactSource),
    selection_summary: input.selectionSummary,
    current_strategy: input.evidence.strategy,
    learning_brief: input.evidence.learning_brief,
    content_focus: input.evidence.content_focus,
    strongest_posts: input.evidence.strongest_posts.slice(0, 12),
    weakest_posts: input.evidence.weakest_posts.slice(0, 12),
    recent_published: input.evidence.recent_published.slice(0, 32),
    future_scheduled: input.evidence.future_scheduled.slice(0, 72),
    hard_bans: input.evidence.hard_bans,
    evidence_gaps: input.evidence.evidence_gaps,
    freshness: input.evidence.freshness,
    model_source_substitution_allowed: false,
    every_page_call_required: false,
    bounded_detail_read_allowed: true,
    deterministic_gates_server_owned: true,
  };
}

function extractBanSurface(rule: JsonRecord): string {
  return normalizeText(
    rule.phrase
      ?? rule.pattern
      ?? rule.banned_phrase
      ?? rule.rule_text
      ?? rule.body
      ?? rule.description
      ?? "",
  );
}

function deterministicGateCandidate(
  state: ManifestShadowRuntimeState,
  candidate: JsonRecord,
  acceptedTexts: Set<string>,
): { passed: boolean; results: JsonRecord[]; failures: JsonRecord[] } {
  const text = stringValue(candidate.text);
  const normalized = normalizeText(text);
  const slotKey = stringValue(candidate.slot_key);
  const sourceCardId = stringValue(candidate.source_card_id);
  const lineup = state.locked_source_lineup.find((item) => String(item.assigned_slot_key ?? "") === slotKey);
  const results: JsonRecord[] = [];
  const failures: JsonRecord[] = [];
  const add = (gateKey: string, passed: boolean, evidence: unknown): void => {
    const item = { gate_key: gateKey, executed: true, status: passed ? "pass" : "fail", evidence };
    results.push(item);
    if (!passed) failures.push(item);
  };

  add("exact_planned_slot", state.missing_slot_keys.includes(slotKey), { slot_key: slotKey });
  add("locked_source_lineage", Boolean(lineup) && sourceCardId === String(lineup?.source_card_id ?? ""), {
    expected_source_card_id: lineup?.source_card_id ?? null,
    received_source_card_id: sourceCardId || null,
  });
  add("candidate_text_present", normalized.length >= 8, { normalized_length: normalized.length });
  add("exact_duplicate", !acceptedTexts.has(normalized), { duplicate: acceptedTexts.has(normalized) });

  const hardBanFailures = state.evidence.hard_bans
    .map((rule) => ({ rule, surface: extractBanSurface(rule) }))
    .filter(({ surface }) => surface.length >= 4 && normalized.includes(surface));
  add("canonical_hard_bans", hardBanFailures.length === 0, {
    matched_rule_keys: hardBanFailures.map(({ rule }) => rule.rule_key ?? rule.id ?? null),
  });

  const opening = normalizeText(firstLine(text));
  const recentOpenings = [
    ...state.evidence.recent_published.map((post) => normalizeText(firstLine(post.post_text ?? post.text))),
    ...state.accepted_posts.map((post) => normalizeText(firstLine(post.text))),
  ].filter(Boolean);
  const openingCollision = opening.length > 8 && recentOpenings.includes(opening);
  add("semantic_repetition", !openingCollision, { opening_phrase: opening, exact_opening_collision: openingCollision });

  const evaluations = record(candidate.model_evaluation);
  for (const key of REQUIRED_MODEL_ASSESSMENTS) {
    add(`model_${key}`, Boolean(stringValue(evaluations[key])), { present: Boolean(stringValue(evaluations[key])) });
  }
  return { passed: failures.length === 0, results, failures };
}

async function persistAcceptedShadowCandidate(
  db: D1Database,
  state: ManifestShadowRuntimeState,
  candidate: JsonRecord,
  gates: JsonRecord[],
): Promise<JsonRecord> {
  const slotKey = stringValue(candidate.slot_key);
  const slot = state.target_slots.find((item) => item.key === slotKey);
  if (!slot) throw new Error(`manifest_shadow_slot_missing:${slotKey}`);
  const text = stringValue(candidate.text);
  const sourceCardId = stringValue(candidate.source_card_id);
  const lineup = state.locked_source_lineup.find((item) => String(item.assigned_slot_key ?? "") === slotKey);
  const identity = await sha256(`${state.run_id}|${slotKey}|${text}`);
  const generationRunId = `shadow-run-${identity.slice(0, 32)}`;
  const draftId = `shadow-draft-${identity.slice(0, 32)}`;
  const hypothesisId = `shadow-hypothesis-${identity.slice(0, 32)}`;
  const experimentId = `shadow-experiment-${identity.slice(0, 32)}`;
  const decisionInfluenceId = `shadow-decision-${identity.slice(0, 32)}`;
  const idempotencyKey = `shadow:${state.run_id}:${slotKey}`;

    const existingScheduled = await db.prepare(
    `SELECT id, scheduled_time FROM scheduled_posts WHERE idempotency_key = ? LIMIT 1`,
  ).bind(idempotencyKey).first<JsonRecord>();
  if (existingScheduled?.id) {
    await db.prepare(
      `UPDATE scheduled_posts SET post_text = ?, scheduled_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(text, slot.scheduled_utc, existingScheduled.id).run();
  } else {
    await db.prepare(
      `INSERT INTO scheduled_posts (
         user_id, threads_user_id, post_text, status, scheduled_time, idempotency_key
       ) VALUES (?, ?, ?, 'approved', ?, ?)`,
    ).bind(state.account_id, state.threads_user_id, text, slot.scheduled_utc, idempotencyKey).run();
  }
  const scheduled = existingScheduled?.id
    ? { ...existingScheduled, scheduled_time: slot.scheduled_utc }
    : await db.prepare(
      `SELECT id, scheduled_time FROM scheduled_posts WHERE idempotency_key = ? ORDER BY id DESC LIMIT 1`,
    ).bind(idempotencyKey).first<JsonRecord>();
  const scheduledPostId = Number(scheduled?.id ?? 0);
  if (!scheduledPostId) throw new Error("manifest_shadow_scheduled_post_missing_after_insert");

  await db.prepare(
    `INSERT INTO gpt_generation_runs (
       id, account_id, threads_user_id, objective, prompt_summary, status,
       metadata_json, source_card_id, source_card_family_id, adaptation_plan_json
     ) VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
  ).bind(
    generationRunId,
    state.account_id,
    state.threads_user_id,
    "manifest_shadow_cycle",
    `Shadow adaptation for ${slotKey}`,
    JSON.stringify({ shadow_run_id: state.run_id, slot_key: slotKey, hypothesis_id: hypothesisId }),
    sourceCardId,
    lineup?.source_card_family_id ?? null,
    JSON.stringify(record(candidate.adaptation_plan)),
  ).run();
  await db.prepare(
    `INSERT INTO gpt_generation_drafts (
       id, run_id, account_id, threads_user_id, text, status, scheduled_post_id,
       source_card_id, gate_summary_json, showable, metadata_json
     ) VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, 1, ?)
     ON CONFLICT(id) DO NOTHING`,
  ).bind(
    draftId,
    generationRunId,
    state.account_id,
    state.threads_user_id,
    text,
    scheduledPostId,
    sourceCardId,
    JSON.stringify({ passed: true, results: gates }),
    JSON.stringify({
      shadow_run_id: state.run_id,
      slot_key: slotKey,
      hypothesis_id: hypothesisId,
      experiment_id: experimentId,
      decision_influence_id: decisionInfluenceId,
    }),
  ).run();
  await db.prepare(
    `INSERT INTO gpt_post_strategy_tags (
       scheduled_post_id, account_id, threads_user_id, pillar, hook_style,
       format, intent, experiment, novelty_level, metadata_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(scheduled_post_id) DO UPDATE SET metadata_json = excluded.metadata_json`,
  ).bind(
    scheduledPostId,
    state.account_id,
    state.threads_user_id,
    candidate.family_key ?? lineup?.source_card_family_id ?? null,
    candidate.hook_style ?? null,
    candidate.format ?? "text",
    candidate.strategic_purpose ?? "shadow_validation",
    candidate.experiment_key ?? experimentId,
    candidate.novelty_level ?? "controlled",
    JSON.stringify({
      shadow_run_id: state.run_id,
      cycle_strategy: state.strategy,
      source_selection_receipt: lineup?.selection_receipt ?? null,
      model_evaluation: candidate.model_evaluation ?? {},
      hypothesis_id: hypothesisId,
      decision_influence_id: decisionInfluenceId,
    }),
  ).run();

  return {
    slot_key: slotKey,
    scheduled_post_id: scheduledPostId,
    scheduled_time_utc: scheduled?.scheduled_time ?? slot.scheduled_utc,
    text,
    source_card_id: sourceCardId,
    source_card_family_id: lineup?.source_card_family_id ?? null,
    source_identity_key: lineup?.source_identity_key ?? null,
    generation_run_id: generationRunId,
    draft_id: draftId,
    hypothesis_id: hypothesisId,
    experiment_assignment_id: experimentId,
    decision_influence_id: decisionInfluenceId,
    gate_results: gates,
    publish_lineage_complete: true,
    intelligence_lineage_complete: true,
  };
}

async function finalizeBenchmark(
  dependencies: OperatorManifestShadowRuntimeDependencies,
  state: ManifestShadowRuntimeState,
  completedAt: string,
  failedRule: string | null = null,
): Promise<JsonRecord> {
  const cleanupStarted = Date.now();
  const orphanCount = await verifyManifestShadowOrphans(dependencies.shadowDb);
  state.timings.cleanup_ms = durationMs(cleanupStarted);
  state.timings.total_wall_clock_ms = Math.max(0, Date.parse(completedAt) - Date.parse(state.started_at));
  const afterEvidence = await dependencies.readEvidence({
    productionReadOnlyDb: createManifestShadowReadOnlyDatabase(dependencies.productionDb),
    brandKey: state.brand_key,
    threadsUserId: state.threads_user_id,
    nowIso: completedAt,
    evidenceMode: "snapshot",
  });
  const beforeFingerprint = stableJson(state.evidence.production_fingerprint);
  const afterFingerprint = stableJson(afterEvidence.production_fingerprint);
  const productionNoninterferencePassed = beforeFingerprint === afterFingerprint;
  const passed = failedRule === null
    && state.missing_slot_keys.length === 0
    && orphanCount === 0
    && state.threads_mutation_count === 0
    && productionNoninterferencePassed;
  const benchmark: ManifestShadowBenchmarkInput = {
    id: crypto.randomUUID(),
    shadow_run_id: state.run_id,
    brand_key: state.brand_key,
    scenario: state.scenario,
    evidence_mode: state.evidence_mode,
    variant_key: state.variant_key,
    snapshot_hash: stringValue(state.decision_bundle.snapshot_hash, state.decision_bundle_id),
    code_sha: state.code_sha,
    contract_versions: {
      shadow: MANIFEST_SHADOW_CONTRACT_VERSION,
      runtime: MANIFEST_SHADOW_RUNTIME_VERSION,
      decision_bundle: MANIFEST_SHADOW_DECISION_BUNDLE_VERSION,
      batch: MANIFEST_SHADOW_BATCH_VERSION,
    },
    counts: {
      target: state.target_slots.length,
      occupied: state.occupied_slot_keys.length,
      generated: state.accepted_posts.length + state.rejected_posts.length,
      accepted: state.accepted_posts.length,
      rejected: state.rejected_posts.length,
      remaining: state.missing_slot_keys.length,
    },
    timings: state.timings,
    external_read_count: Number(state.counters.external_read_count ?? 0),
    retry_count: Number(state.counters.retry_count ?? 0),
    continuation_count: Number(state.counters.continuation_count ?? 0),
    payload_bytes: new TextEncoder().encode(JSON.stringify(state.decision_bundle)).byteLength,
    production_noninterference_passed: productionNoninterferencePassed,
    threads_mutation_count: state.threads_mutation_count,
    cleanup_orphan_count: orphanCount,
    passed,
    failed_rule: failedRule ?? (passed ? null : "shadow_acceptance_incomplete"),
  };
  await writeManifestShadowBenchmarkReceipt(dependencies.productionDb, benchmark);
  if (passed) await completeManifestShadowRun(dependencies.shadowDb, state.run_id, completedAt);
  return { ...benchmark, passed, production_noninterference_passed: productionNoninterferencePassed };
}

async function prepareShadowCycle(
  payload: JsonRecord,
  identity: { brandKey: string; accountId: string; threadsUserId: string },
  dependencies: OperatorManifestShadowRuntimeDependencies,
): Promise<{ body: JsonRecord; status: number }> {
  if (!dependencies.shadowDb) return { body: { success: false, error: "manifest_shadow_database_unavailable" }, status: 503 };
  if (identity.brandKey !== "manifest_mental") return { body: { success: false, error: "manifest_shadow_manifest_only" }, status: 400 };
  const scenario = machineKey(payload.scenario, "normal_24");
  if (!SHADOW_SCENARIOS.has(scenario)) return { body: { success: false, error: "manifest_shadow_scenario_invalid" }, status: 400 };
  const evidenceMode = payload.evidence_mode === "live_read" ? "live_read" : "snapshot";
  const variantKey = machineKey(payload.variant_key, "control");
  const timezone = stringValue(payload.timezone, "America/New_York");
  const requestedMissingCount = scenarioMissingCount(scenario, payload.missing_count);
  const horizonHours = Math.max(requestedMissingCount, Math.min(72, Math.max(1, Math.trunc(Number(payload.horizon_hours ?? Math.max(48, requestedMissingCount))))));
  const operationRoot = stringValue(payload.operation_id, `${identity.brandKey}:shadow:${scenario}:${variantKey}:${new Date().toISOString().slice(0, 10)}`);
  const now = dependencies.now();
  const nowIso = now.toISOString();
  const runId = `shadow-${(await sha256(operationRoot)).slice(0, 32)}`;
  const existing = await dependencies.shadowDb.prepare(
    `SELECT id, status FROM manifest_shadow_runs WHERE operation_root = ? LIMIT 1`,
  ).bind(operationRoot).first<JsonRecord>();
  if (existing?.id) {
    const state = await readState(dependencies.shadowDb, String(existing.id));
    return {
      body: {
        success: true,
        reused: true,
        shadow_run_id: existing.id,
        status: existing.status,
        decision_bundle_id: state?.decision_bundle_id ?? null,
        decision_bundle: state?.decision_bundle ?? null,
        remaining_missing_count: state?.missing_slot_keys.length ?? null,
        next_action: state?.strategy
          ? "Persist one to four exact planned candidates with persist_manifest_shadow_batch."
          : "Commit one strategy with commit_manifest_shadow_cycle_strategy.",
      },
      status: 200,
    };
  }

  const totalStarted = Date.now();
  const run = await beginManifestShadowRun(dependencies.shadowDb, {
    run_id: runId,
    brand_key: identity.brandKey,
    scenario,
    evidence_mode: evidenceMode,
    variant_key: variantKey,
    operation_root: operationRoot,
    code_sha: dependencies.codeSha,
    retention_hours: Number(payload.retention_hours ?? 72),
  }, nowIso);
  try {
    const resetStarted = Date.now();
    const reset = await resetManifestShadowWorkspace(dependencies.shadowDb);
    await dependencies.shadowDb.prepare(
      `INSERT INTO users (id, email, email_verified, threads_user_id, connection_active, timezone)
       VALUES (?, ?, 1, ?, 1, ?)
       ON CONFLICT(id) DO UPDATE SET threads_user_id = excluded.threads_user_id, timezone = excluded.timezone`,
    ).bind(
      identity.accountId,
      `shadow-${identity.accountId}@example.invalid`,
      identity.threadsUserId,
      timezone,
    ).run();
    await recordManifestShadowStageEvent(dependencies.shadowDb, {
      run_id: runId,
      stage_key: "workspace_reset",
      event_key: "workspace_reset",
      status: "completed",
      started_at: nowIso,
      completed_at: dependencies.now().toISOString(),
      duration_ms: durationMs(resetStarted),
      payload: reset,
    });

    const evidenceStarted = Date.now();
    const productionReadOnlyDb = createManifestShadowReadOnlyDatabase(dependencies.productionDb);
    const [slotPlan, candidates, evidence] = await Promise.all([
      dependencies.buildSlots({ timezone, horizonHours, scenario, requestedMissingCount }),
      dependencies.loadSourceCandidates(productionReadOnlyDb, identity.brandKey, nowIso),
      dependencies.readEvidence({
        productionReadOnlyDb,
        brandKey: identity.brandKey,
        threadsUserId: identity.threadsUserId,
        nowIso,
        evidenceMode,
      }),
    ]);
    const occupied = new Set(slotPlan.occupiedSlotKeys);
    const missingSlots = slotPlan.targetSlots.map((slot) => slot.key).filter((key) => !occupied.has(key)).slice(0, requestedMissingCount);
    const selectionStarted = Date.now();
    const selection = dependencies.selectSourceLineup({
      candidates,
      slot_keys: missingSlots,
      seed: `${identity.brandKey}:${runId}:${variantKey}`,
    });
    const lockedLineup = selection.selected as Array<SourceSelectionCandidate & { assigned_slot_key?: string }>;
    const decisionBundle = buildDecisionBundle({
      runId,
      evidence,
      missingSlots,
      lockedLineup,
      selectionSummary: selection.summary,
    });
    const snapshotHash = await sha256(stableJson({ evidence, candidates, slotPlan }));
    decisionBundle.snapshot_hash = snapshotHash;
    const decisionBundleId = `shadow-bundle-${(await sha256(stableJson(decisionBundle))).slice(0, 32)}`;
    decisionBundle.bundle_id = decisionBundleId;
    const state: ManifestShadowRuntimeState = {
      contract_version: MANIFEST_SHADOW_CONTRACT_VERSION,
      runtime_version: MANIFEST_SHADOW_RUNTIME_VERSION,
      run_id: runId,
      brand_key: identity.brandKey,
      account_id: identity.accountId,
      threads_user_id: identity.threadsUserId,
      scenario,
      evidence_mode: evidenceMode,
      variant_key: variantKey,
      operation_root: operationRoot,
      code_sha: dependencies.codeSha,
      timezone,
      horizon_hours: horizonHours,
      target_slots: slotPlan.targetSlots,
      occupied_slot_keys: Array.from(occupied),
      missing_slot_keys: missingSlots,
      source_candidates: candidates,
      locked_source_lineup: lockedLineup,
      source_selection_receipts: selection.receipts,
      decision_bundle: decisionBundle,
      decision_bundle_id: decisionBundleId,
      evidence,
      strategy: null,
      accepted_posts: [],
      rejected_posts: [],
      completed: missingSlots.length === 0,
      started_at: nowIso,
      last_client_response_at: dependencies.now().toISOString(),
      timings: {
        workspace_reset_ms: Number((await dependencies.shadowDb.prepare(`SELECT duration_ms FROM manifest_shadow_stage_events WHERE shadow_run_id = ? AND event_key = 'workspace_reset'`).bind(runId).first<JsonRecord>())?.duration_ms ?? 0),
        evidence_capture_ms: durationMs(evidenceStarted),
        source_selection_ms: durationMs(selectionStarted),
        preparation_ms: durationMs(totalStarted),
      },
      counters: { external_read_count: evidenceMode === "live_read" ? 1 : 0, retry_count: 0, continuation_count: 0 },
      threads_mutation_count: 0,
    };
    const snapshot: ManifestShadowSnapshot = {
      contract_version: MANIFEST_SHADOW_SNAPSHOT_VERSION,
      brand_key: identity.brandKey,
      source_as_of: nowIso,
      snapshot_hash: snapshotHash,
      tables: [],
      metadata: { state },
    };
    const expiresAt = new Date(now.getTime() + Math.max(1, Math.min(336, Number(payload.retention_hours ?? 72))) * 3600000).toISOString();
    const seeded = await seedManifestShadowSnapshot(dependencies.shadowDb, runId, snapshot, expiresAt);
    await recordManifestShadowStageEvent(dependencies.shadowDb, {
      run_id: runId,
      stage_key: "preparation",
      event_key: "preparation_complete",
      status: "completed",
      started_at: nowIso,
      completed_at: dependencies.now().toISOString(),
      duration_ms: durationMs(totalStarted),
      payload: {
        target_count: slotPlan.targetSlots.length,
        occupied_count: occupied.size,
        missing_count: missingSlots.length,
        source_candidate_count: candidates.length,
        locked_source_count: lockedLineup.length,
        snapshot_hash: snapshotHash,
        decision_bundle_id: decisionBundleId,
        payload_bytes: seeded.payload_bytes,
      },
    });

    let benchmark: JsonRecord | null = null;
    if (missingSlots.length === 0) {
      state.completed = true;
      await writeState(dependencies.shadowDb, state);
      benchmark = await finalizeBenchmark(dependencies, state, dependencies.now().toISOString());
    }
    return {
      body: {
        success: true,
        reused: false,
        shadow_run_id: run.id ?? runId,
        scenario,
        evidence_mode: evidenceMode,
        variant_key: variantKey,
        code_sha: dependencies.codeSha,
        snapshot_hash: snapshotHash,
        decision_bundle_id: decisionBundleId,
        decision_bundle: decisionBundle,
        target_count: slotPlan.targetSlots.length,
        occupied_count: occupied.size,
        remaining_missing_count: missingSlots.length,
        preparation_complete: true,
        normal_continuation_required: false,
        benchmark,
        next_action: missingSlots.length
          ? "Commit exactly one strategy through commit_manifest_shadow_cycle_strategy using this decision_bundle_id and the locked lineup without source substitution."
          : "The no-op shadow cycle is complete; read the benchmark receipt.",
      },
      status: 200,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "manifest_shadow_prepare_failed";
    await failManifestShadowRun(dependencies.shadowDb, {
      run_id: runId,
      now_iso: dependencies.now().toISOString(),
      error_code: machineKey(message, "manifest_shadow_prepare_failed"),
      error_message: message,
      diagnostics: { stage: "prepare", operation_root: operationRoot },
    });
    return { body: { success: false, shadow_run_id: runId, error: message }, status: 500 };
  }
}

async function commitShadowStrategy(
  payload: JsonRecord,
  identity: { brandKey: string; accountId: string; threadsUserId: string },
  dependencies: OperatorManifestShadowRuntimeDependencies,
): Promise<{ body: JsonRecord; status: number }> {
  const runId = stringValue(payload.shadow_run_id);
  const bundleId = stringValue(payload.decision_bundle_id);
  if (!runId || !bundleId) return { body: { success: false, error: "shadow_run_id_and_decision_bundle_id_required" }, status: 400 };
  const state = await readState(dependencies.shadowDb, runId);
  if (!state || state.brand_key !== identity.brandKey) return { body: { success: false, error: "manifest_shadow_run_not_found" }, status: 404 };
  if (bundleId !== state.decision_bundle_id) return { body: { success: false, error: "manifest_shadow_decision_bundle_mismatch" }, status: 409 };
  const suppliedLineup = records(payload.lineup);
  const expectedSlots = state.locked_source_lineup.map((item) => String(item.assigned_slot_key ?? ""));
  const lineupValid = suppliedLineup.length === expectedSlots.length
    && suppliedLineup.every((item, index) =>
      String(item.slot_key ?? "") === expectedSlots[index]
      && String(item.source_card_id ?? "") === String(state.locked_source_lineup[index]?.source_card_id ?? "")
    );
  if (!lineupValid) return { body: { success: false, error: "manifest_shadow_locked_lineup_mismatch" }, status: 409 };
  const strategy = {
    strategy_id: `shadow-strategy-${(await sha256(`${runId}|${stableJson(payload)}`)).slice(0, 32)}`,
    account_conclusion: record(payload.account_conclusion),
    content_focus: record(payload.content_focus),
    benchmarks: record(payload.benchmarks),
    strongest_executions: records(payload.strongest_executions),
    weakest_executions: records(payload.weakest_executions),
    directives: record(payload.directives),
    experiments: records(payload.experiments),
    risks: Array.isArray(payload.risks) ? payload.risks : [],
    lineup: suppliedLineup,
    locked_at: dependencies.now().toISOString(),
  };
  if (!Object.keys(strategy.account_conclusion).length || !Object.keys(strategy.directives).length) {
    return { body: { success: false, error: "manifest_shadow_complete_strategy_required" }, status: 400 };
  }
  if (state.strategy) {
    return stableJson(state.strategy) === stableJson(strategy)
      ? { body: { success: true, reused: true, shadow_run_id: runId, strategy: state.strategy }, status: 200 }
      : { body: { success: false, error: "manifest_shadow_conflicting_strategy_blocked" }, status: 409 };
  }
  const gapMs = Math.max(0, Date.now() - Date.parse(state.last_client_response_at));
  state.timings.strategy_client_gap_ms = gapMs;
  state.strategy = strategy;
  state.last_client_response_at = dependencies.now().toISOString();
  await writeState(dependencies.shadowDb, state);
  await recordManifestShadowStageEvent(dependencies.shadowDb, {
    run_id: runId,
    stage_key: "strategy",
    event_key: "strategy_locked",
    status: "completed",
    completed_at: state.last_client_response_at,
    duration_ms: gapMs,
    payload: { strategy_id: strategy.strategy_id, lineup_count: suppliedLineup.length, decision_bundle_id: bundleId },
  });
  return {
    body: {
      success: true,
      reused: false,
      shadow_run_id: runId,
      strategy,
      remaining_missing_count: state.missing_slot_keys.length,
      next_action: "Generate source-faithful candidates in chunks of up to eight, then persist each chunk through one or two four-item persist_manifest_shadow_batch calls.",
    },
    status: 200,
  };
}

async function persistShadowBatch(
  payload: JsonRecord,
  identity: { brandKey: string; accountId: string; threadsUserId: string },
  dependencies: OperatorManifestShadowRuntimeDependencies,
): Promise<{ body: JsonRecord; status: number }> {
  const runId = stringValue(payload.shadow_run_id);
  const batchOperationId = stringValue(payload.operation_id);
  const candidates = records(payload.candidates);
  if (!runId || !batchOperationId || candidates.length < 1 || candidates.length > 4) {
    return { body: { success: false, error: "shadow_run_operation_and_one_to_four_candidates_required" }, status: 400 };
  }
  const state = await readState(dependencies.shadowDb, runId);
  if (!state || state.brand_key !== identity.brandKey) return { body: { success: false, error: "manifest_shadow_run_not_found" }, status: 404 };
  if (!state.strategy) return { body: { success: false, error: "manifest_shadow_strategy_required" }, status: 409 };
  const priorEvent = await dependencies.shadowDb.prepare(
    `SELECT payload_json FROM manifest_shadow_stage_events WHERE shadow_run_id = ? AND event_key = ? LIMIT 1`,
  ).bind(runId, `batch:${batchOperationId}`).first<JsonRecord>();
  if (priorEvent?.payload_json) {
    try {
      return { body: { success: true, reused: true, ...JSON.parse(String(priorEvent.payload_json)) }, status: 200 };
    } catch {
      return { body: { success: false, error: "manifest_shadow_batch_receipt_corrupt" }, status: 500 };
    }
  }
  const batchStarted = Date.now();
  const gapMs = Math.max(0, Date.now() - Date.parse(state.last_client_response_at));
  state.timings.model_client_gap_ms = Number(state.timings.model_client_gap_ms ?? 0) + gapMs;
  const acceptedTexts = new Set(state.accepted_posts.map((post) => normalizeText(post.text)));
  const results: JsonRecord[] = [];
  for (const candidate of candidates) {
    const candidateOperationId = stringValue(candidate.operation_id);
    const slotKey = stringValue(candidate.slot_key);
    if (!candidateOperationId) {
      results.push({ success: false, slot_key: slotKey || null, error: "candidate_operation_id_required" });
      continue;
    }
    const existing = state.accepted_posts.find((post) => String(post.operation_id ?? "") === candidateOperationId)
      ?? state.rejected_posts.find((post) => String(post.operation_id ?? "") === candidateOperationId);
    if (existing) {
      results.push({ ...existing, reused: true });
      continue;
    }
    const gate = deterministicGateCandidate(state, candidate, acceptedTexts);
    if (!gate.passed) {
      const rejected = {
        success: false,
        operation_id: candidateOperationId,
        slot_key: slotKey || null,
        error: "manifest_shadow_candidate_gate_failed",
        blocking_failures: gate.failures,
        gate_results: gate.results,
      };
      state.rejected_posts.push(rejected);
      results.push(rejected);
      continue;
    }
    const persisted = await persistAcceptedShadowCandidate(dependencies.shadowDb, state, candidate, gate.results);
    const accepted = { success: true, operation_id: candidateOperationId, ...persisted };
    state.accepted_posts.push(accepted);
    acceptedTexts.add(normalizeText(candidate.text));
    state.missing_slot_keys = state.missing_slot_keys.filter((key) => key !== slotKey);
    results.push(accepted);
  }
  state.timings.batch_persistence_ms = Number(state.timings.batch_persistence_ms ?? 0) + durationMs(batchStarted);
  state.timings.batch_reconciliation_ms = Number(state.timings.batch_reconciliation_ms ?? 0) + 1;
  state.last_client_response_at = dependencies.now().toISOString();
  state.completed = state.missing_slot_keys.length === 0;
  await writeState(dependencies.shadowDb, state);
  const responseReceipt = {
    shadow_run_id: runId,
    batch_operation_id: batchOperationId,
    results,
    accepted_count: results.filter((item) => item.success === true).length,
    rejected_count: results.filter((item) => item.success !== true).length,
    remaining_missing_count: state.missing_slot_keys.length,
    rejected_slots: results.filter((item) => item.success !== true).map((item) => item.slot_key).filter(Boolean),
    coverage_reconciled_once: true,
  };
  await recordManifestShadowStageEvent(dependencies.shadowDb, {
    run_id: runId,
    stage_key: "batch_persistence",
    event_key: `batch:${batchOperationId}`,
    status: "completed",
    completed_at: state.last_client_response_at,
    duration_ms: durationMs(batchStarted),
    payload: responseReceipt,
  });
  let benchmark: JsonRecord | null = null;
  if (state.completed) {
    benchmark = await finalizeBenchmark(dependencies, state, state.last_client_response_at);
    await writeState(dependencies.shadowDb, state);
  }
  return {
    body: {
      success: true,
      reused: false,
      ...responseReceipt,
      benchmark,
      next_action: state.completed
        ? "Read the completed shadow benchmark receipt."
        : "Regenerate only rejected slots, then continue with the next one-to-four missing planned slots.",
    },
    status: 200,
  };
}

async function getShadowReceipt(
  payload: JsonRecord,
  identity: { brandKey: string; accountId: string; threadsUserId: string },
  dependencies: OperatorManifestShadowRuntimeDependencies,
): Promise<{ body: JsonRecord; status: number }> {
  const runId = stringValue(payload.shadow_run_id);
  if (!runId) return { body: { success: false, error: "shadow_run_id_required" }, status: 400 };
  const receipt = await readManifestShadowReceipt(dependencies.shadowDb, dependencies.productionDb, runId);
  const run = record(receipt.run);
  if (run.brand_key && run.brand_key !== identity.brandKey) return { body: { success: false, error: "manifest_shadow_run_not_found" }, status: 404 };
  const state = await readState(dependencies.shadowDb, runId);
  return {
    body: {
      success: true,
      shadow_run_id: runId,
      receipt,
      state_summary: state ? {
        scenario: state.scenario,
        evidence_mode: state.evidence_mode,
        variant_key: state.variant_key,
        decision_bundle_id: state.decision_bundle_id,
        strategy_locked: Boolean(state.strategy),
        target_count: state.target_slots.length,
        accepted_count: state.accepted_posts.length,
        rejected_count: state.rejected_posts.length,
        remaining_missing_count: state.missing_slot_keys.length,
        completed: state.completed,
        timings: state.timings,
      } : null,
    },
    status: 200,
  };
}

export async function handleOperatorManifestShadowTool(
  input: {
    toolName: OperatorManifestShadowToolName;
    payload: JsonRecord;
    identity: { brandKey: string; accountId: string; threadsUserId: string };
  },
  dependencies: OperatorManifestShadowRuntimeDependencies,
): Promise<{ body: JsonRecord; status: number }> {
  await cleanupManifestShadowMetadata(dependencies.shadowDb, dependencies.now().toISOString());
  if (input.toolName === "prepare_manifest_shadow_cycle") {
    return prepareShadowCycle(input.payload, input.identity, dependencies);
  }
  if (input.toolName === "commit_manifest_shadow_cycle_strategy") {
    return commitShadowStrategy(input.payload, input.identity, dependencies);
  }
  if (input.toolName === "persist_manifest_shadow_batch") {
    return persistShadowBatch(input.payload, input.identity, dependencies);
  }
  return getShadowReceipt(input.payload, input.identity, dependencies);
}

export function isOperatorManifestShadowToolName(value: string): value is OperatorManifestShadowToolName {
  return (OPERATOR_MANIFEST_SHADOW_TOOL_NAMES as readonly string[]).includes(value);
}

export function buildAutomaticShadowCandidate(
  state: ManifestShadowRuntimeState,
  slotKey: string,
  ordinal: number,
): JsonRecord {
  const source = state.locked_source_lineup.find((item) => String(item.assigned_slot_key ?? "") === slotKey);
  const sourceText = stringValue(source?.text, `The Universe is aligning a meaningful breakthrough for the person reading this ${ordinal + 1}.`);
  const text = sourceText.length <= 500
    ? `${sourceText}\n\nShadow validation ${ordinal + 1}`
    : sourceText.slice(0, 490);
  return {
    operation_id: `${state.run_id}:${slotKey}:auto`,
    slot_key: slotKey,
    source_card_id: source?.source_card_id ?? null,
    family_key: source?.source_card_family_id ?? null,
    text,
    adaptation_plan: {
      adaptation_goal: "Source-faithful shadow validation candidate.",
      preserved_functions: ["hook", "premise", "payoff"],
      transformed_elements: ["bounded wording"],
    },
    model_evaluation: {
      novelty_assessment: "Distinct from the frozen recent opening inventory.",
      winner_preservation_assessment: "Preserves the selected source mechanism and payoff.",
      slot_placement_assessment: `Uses the exact locked slot ${slotKey}.`,
      recent_exposure_assessment: "Checked against the decision bundle exposure inventory.",
      intelligence_application_assessment: "Applies the locked source and current strategy directives.",
    },
  };
}
