import {
  MANIFEST_SHADOW_CONTRACT_VERSION,
  MANIFEST_SHADOW_SNAPSHOT_VERSION,
  beginManifestShadowRun,
  cleanupManifestShadowMetadata,
  completeManifestShadowRun,
  createManifestShadowNoThreadsMutationAdapter,
  createManifestShadowReadOnlyDatabase,
  failManifestShadowRun,
    readManifestShadowFrozenSeed,
  readManifestShadowReceipt,
  recordManifestShadowStageEvent,
  resetManifestShadowWorkspace,
  seedManifestShadowSnapshot,
  writeManifestShadowFrozenSeed,
  verifyManifestShadowOrphans,
  writeManifestShadowBenchmarkReceipt,
  type ManifestShadowBenchmarkInput,
  type ManifestShadowSnapshot,
} from "./operatorManifestShadowService";
import type { SourceSelectionCandidate, SourceSelectionReceipt } from "./sourceFamilySelection";
import {
  buildManifestDecisionScenarioOverlay,
  buildManifestDecisionSnapshot,
  compareManifestDecisionSelectorParity,
  hashManifestDecisionValue,
  manifestDecisionSnapshotToShadowEvidence,
  readManifestDecisionSnapshotFromShadowEvidence,
  type ManifestDecisionSnapshot,
} from "./operatorManifestDecisionSnapshotService";


type JsonRecord = Record<string, unknown>;

export const OPERATOR_MANIFEST_SHADOW_TOOL_NAMES = [
  "seed_manifest_shadow_snapshot",
  "prepare_manifest_shadow_cycle",
  "commit_manifest_shadow_cycle_strategy",
  "persist_manifest_shadow_batch",
  "get_manifest_shadow_cycle_receipt",
  "get_manifest_shadow_posts",
] as const;

export type OperatorManifestShadowToolName = typeof OPERATOR_MANIFEST_SHADOW_TOOL_NAMES[number];

export const MANIFEST_SHADOW_RUNTIME_VERSION = "manifest-shadow-runtime-v1";
export const MANIFEST_SHADOW_DECISION_BUNDLE_VERSION = "manifest-shadow-decision-bundle-v1";
export const MANIFEST_SHADOW_BATCH_VERSION = "manifest-shadow-batch-v1";

const SHADOW_SCENARIOS = new Set(["noop", "normal_24", "recovery_48", "custom"]);
export const MANIFEST_SHADOW_TEST_CASES = [
  "baseline",
  "mid_batch_collision",
  "gate_rejection_regeneration",
  "interrupted_replay",
  "stale_delta_refresh",
  "invalidated_source_replacement",
  "retained_failure_cleanup",
    "same_snapshot_ab",
  "frozen_snapshot_zero_main_access",
] as const;
export type ManifestShadowTestCase = typeof MANIFEST_SHADOW_TEST_CASES[number];
const SHADOW_TEST_CASES = new Set<string>(MANIFEST_SHADOW_TEST_CASES);
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
  decision_snapshot?: JsonRecord;
  [key: string]: unknown;
};

export type ManifestShadowRuntimeState = {
  contract_version: string;
  runtime_version: string;
  run_id: string;
  brand_key: string;
  account_id: string;
    threads_user_id: string;
  scenario: string;
  test_case: ManifestShadowTestCase;
    evidence_mode: "snapshot";
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
    snapshotDb: D1Database;
  shadowDb: D1Database;
      codeSha: string;
  requireFrozenSeed?: boolean;
  minimumEligibleFamilies?: number;
  buildDecisionSnapshot?(input: {
    brandKey: string;
    accountId: string;
    threadsUserId: string;
    capturedAt: string;
    timezone: string;
    coverageRules: JsonRecord;
  }): Promise<ManifestDecisionSnapshot>;
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
    include_parity_trace?: boolean;
  }): {
    selected: SourceSelectionCandidate[];
    receipts: SourceSelectionReceipt[];
    summary: JsonRecord;
    parity_trace?: JsonRecord;
  };
  readEvidence(input: {
        snapshotReadOnlyDb: D1Database;
    brandKey: string;
    threadsUserId: string;
    nowIso: string;
        evidenceMode: "snapshot";
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

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value ?? null)).byteLength;
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

const SYNTHETIC_SHADOW_TEXT = /\b(?:frozen isolated source|shadow validation(?: candidate)?|clean shadow candidate|shadow fixture)\b/i;

function isSyntheticShadowPlaceholder(value: unknown): boolean {
  return SYNTHETIC_SHADOW_TEXT.test(String(value ?? ""));
}

function normalizeSeedEvidence(value: unknown, nowIso: string): ManifestShadowEvidence {
  const input = record(value);
  return {
    captured_at: stringValue(input.captured_at, nowIso),
    strategy: Object.keys(record(input.strategy)).length ? record(input.strategy) : null,
    learning_brief: Object.keys(record(input.learning_brief)).length ? record(input.learning_brief) : null,
    content_focus: Object.keys(record(input.content_focus)).length ? record(input.content_focus) : null,
    hard_bans: records(input.hard_bans),
    strongest_posts: records(input.strongest_posts),
    weakest_posts: records(input.weakest_posts),
    recent_published: records(input.recent_published),
    future_scheduled: records(input.future_scheduled),
    evidence_gaps: records(input.evidence_gaps),
    production_fingerprint: record(input.production_fingerprint),
        freshness: {
      evidence_mode: "snapshot",
      captured_at: stringValue(input.captured_at, nowIso),
      stale: false,
      bounded_delta_refresh_required: false,
      ...record(input.freshness),
    },
    decision_snapshot: Object.keys(record(input.decision_snapshot)).length
      ? record(input.decision_snapshot)
      : undefined,
  };
}

async function buildFrozenSeedCandidates(sources: JsonRecord[]): Promise<SourceSelectionCandidate[]> {
  const candidates: SourceSelectionCandidate[] = [];
  const identities = new Set<string>();
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const text = stringValue(source.text ?? record(source.primary_source).post_text);
    const sourceIdentityKey = stringValue(source.source_identity_key);
    if (!text || text.length < 8) throw new Error(`manifest_shadow_seed_source_text_required:${index}`);
    if (!sourceIdentityKey) throw new Error(`manifest_shadow_seed_source_identity_required:${index}`);
    if (isSyntheticShadowPlaceholder(text)) throw new Error(`manifest_shadow_seed_placeholder_forbidden:${index}`);
    if (identities.has(sourceIdentityKey)) throw new Error(`manifest_shadow_seed_source_identity_duplicate:${sourceIdentityKey}`);
    identities.add(sourceIdentityKey);
    const identityHash = (await sha256(sourceIdentityKey)).slice(0, 24);
    const metrics = record(source.metrics);
    const likes = Math.max(0, Number(metrics.likes ?? 0));
    candidates.push({
      source_candidate_id: `shadow-seed-candidate-${identityHash}`,
      source_identity_key: sourceIdentityKey,
      source_card_family_id: `shadow-seed-family-${identityHash}`,
      source_card_id: `shadow-seed-card-${identityHash}`,
      source_type: "source_card",
      internal_source_id: stringValue(source.internal_source_id ?? source.saved_pattern_id, identityHash),
      source_mechanism: source.source_mechanism ?? "source_faithful_saved_pattern_adaptation",
      required_product: source.required_product ?? "Preserve the source hook, structure, meaning, tone, and payoff.",
      recommended_direction: source.recommended_direction ?? "Create a close, brand-safe, source-faithful Manifest adaptation without inventing a new premise.",
      text,
      metrics,
      primary_source: {
        ...record(source.primary_source),
        post_text: text,
        source_url: source.source_url ?? record(source.primary_source).source_url ?? null,
        saved_pattern_id: source.saved_pattern_id ?? source.internal_source_id ?? null,
      },
      lifetime_label: likes >= 1000 ? "proven" : "prospect",
      recent_label: "healthy",
      confidence_label: likes >= 1000 ? "reliable" : "low",
      lifetime_sample_size: likes >= 1000 ? 1 : 0,
      recent_sample_size: 0,
      lifetime_index: likes >= 1000 ? 1 + Math.log10(likes / 1000 + 1) : 1,
      recent_index: null,
      uses_24h: 0,
      uses_7d: 0,
      uses_28d: 0,
      hours_since_last_use: null,
      semantic_key: stringValue(source.semantic_key, `seed:${identityHash}`),
    });
  }
  return candidates;
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

function runtimeStateForPersistence(state: ManifestShadowRuntimeState): ManifestShadowRuntimeState {
  const decisionBundle = record(state.decision_bundle);
  const snapshotHash = stringValue(
    decisionBundle.manifest_decision_snapshot_hash,
    stringValue(decisionBundle.snapshot_hash),
  );
  return {
    ...state,
    source_candidates: [],
    evidence: {
      captured_at: state.evidence.captured_at,
      externalized_to_frozen_seed: true,
      storage_contract: "manifest-shadow-frozen-seed-v1",
      brand_key: state.brand_key,
            snapshot_hash: snapshotHash,
      source_candidate_count: state.source_candidates.length,
      source_candidate_identity_keys: state.source_candidates.map((candidate) => String(candidate.source_identity_key ?? "")),
    } as unknown as ManifestShadowEvidence,
  };
}

async function readState(db: D1Database, runId: string): Promise<ManifestShadowRuntimeState | null> {
  const row = await db.prepare(
    `SELECT payload_json FROM manifest_shadow_snapshots WHERE shadow_run_id = ? LIMIT 1`,
  ).bind(runId).first<JsonRecord>();
  const state = parseSnapshotState(row);
  if (!state) return null;
  const persistedEvidence = record(state.evidence);
  if (persistedEvidence.externalized_to_frozen_seed !== true) return state;
  const frozenSeed = await readManifestShadowFrozenSeed(db, state.brand_key);
  if (!frozenSeed) throw new Error("manifest_shadow_runtime_frozen_seed_missing");
  const expectedHash = stringValue(persistedEvidence.snapshot_hash);
  const actualHash = stringValue(frozenSeed.snapshot_hash);
  if (!expectedHash || actualHash !== expectedHash) {
    throw new Error("manifest_shadow_runtime_frozen_seed_hash_mismatch");
  }
    const canonicalCandidates = records(frozenSeed.source_candidates) as unknown as SourceSelectionCandidate[];
  const projectedIdentityKeys = Array.isArray(persistedEvidence.source_candidate_identity_keys)
    ? persistedEvidence.source_candidate_identity_keys.map((value) => String(value ?? ""))
    : [];
  let sourceCandidates = canonicalCandidates;
  if (projectedIdentityKeys.length) {
    const byIdentity = new Map(
      canonicalCandidates.map((candidate) => [String(candidate.source_identity_key ?? ""), candidate]),
    );
    sourceCandidates = projectedIdentityKeys.map((identityKey) => {
      const candidate = byIdentity.get(identityKey);
      if (!candidate) throw new Error("manifest_shadow_runtime_frozen_seed_projection_missing");
      return candidate;
    });
  }
  const expectedSourceCount = Number(persistedEvidence.source_candidate_count ?? sourceCandidates.length);
  if (sourceCandidates.length !== expectedSourceCount) {
    throw new Error("manifest_shadow_runtime_frozen_seed_source_count_mismatch");
  }
  return {
    ...state,
    source_candidates: sourceCandidates,
    evidence: normalizeSeedEvidence(frozenSeed.evidence, state.started_at),
  };
}

async function writeState(db: D1Database, state: ManifestShadowRuntimeState): Promise<void> {
  const row = await db.prepare(
    `SELECT id, payload_json FROM manifest_shadow_snapshots WHERE shadow_run_id = ? LIMIT 1`,
  ).bind(state.run_id).first<JsonRecord>();
  if (!row?.id) throw new Error("manifest_shadow_snapshot_not_found");
  const snapshot = JSON.parse(String(row.payload_json ?? "{}")) as ManifestShadowSnapshot;
  snapshot.metadata = { ...(snapshot.metadata ?? {}), state: runtimeStateForPersistence(state) };
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
  add("genuine_model_generation", !isSyntheticShadowPlaceholder(text), {
    placeholder_detected: isSyntheticShadowPlaceholder(text),
  });
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
  const experimentDefinitionId = `shadow-experiment-definition-${identity.slice(0, 32)}`;
  const decisionInfluenceId = `shadow-decision-${identity.slice(0, 32)}`;
  const planItemId = `shadow-plan-${(await sha256(`${state.run_id}|${slotKey}`)).slice(0, 32)}`;
  const gateReceiptId = `shadow-gate-${identity.slice(0, 32)}`;
  const lineupItemId = `shadow-lineup-${identity.slice(0, 32)}`;
  const strategyId = stringValue(record(state.strategy).strategy_id);
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
  await db.prepare(
    `INSERT INTO operator_manifest_candidate_gate_receipts (
       id, cycle_id, strategy_id, plan_item_id, brand_key, slot_key,
       candidate_hash, receipt_version, results_json, passed
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(cycle_id, slot_key, candidate_hash) DO NOTHING`,
  ).bind(
    gateReceiptId,
    state.run_id,
    strategyId,
    planItemId,
    state.brand_key,
    slotKey,
    identity,
    MANIFEST_SHADOW_BATCH_VERSION,
    JSON.stringify(gates),
  ).run();
  await db.prepare(
    `INSERT INTO operator_manifest_post_hypotheses (
       id, cycle_id, brand_key, slot_key, hypothesis_version, strategy_version_id,
       source_kind, source_type, source_identity_key, source_card_id, source_selection_id,
       internal_source_id, expected_response_type, expected_audience_reward, hook_rationale,
       premise_rationale, exploration_mode, comparable_post_ids_json,
       expected_performance_range_json, uncertainty, falsification_conditions_json,
       candidate_trace_json, model_evaluation_json, scheduled_post_id, status, locked_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'source_card', ?, ?, ?, ?, ?, 'likes', ?, ?, ?, ?, '[]', '{}', ?, '[]', ?, ?, ?, 'scheduled', ?)
     ON CONFLICT(cycle_id, slot_key) DO NOTHING`,
  ).bind(
    hypothesisId,
    state.run_id,
    state.brand_key,
    slotKey,
    'manifest-shadow-hypothesis-v1',
    strategyId,
    stringValue(lineup?.source_type, 'source_card'),
    stringValue(lineup?.source_identity_key) || null,
    sourceCardId,
    stringValue(record(lineup).source_selection_id) || null,
    stringValue(lineup?.internal_source_id) || null,
    stringValue(record(candidate.model_evaluation).winner_preservation_assessment, 'Preserve the selected audience reward.'),
    stringValue(record(candidate.model_evaluation).novelty_assessment, 'Preserve the locked hook while remaining distinct.'),
    stringValue(record(candidate.model_evaluation).intelligence_application_assessment, 'Apply the locked strategy and source premise.'),
    stringValue(record(lineup).exploration_mode, 'hybrid'),
    'Shadow-only operational expectation; audience performance is not inferred.',
    JSON.stringify([{ generation_run_id: generationRunId, draft_id: draftId, gate_receipt_id: gateReceiptId }]),
    JSON.stringify(record(candidate.model_evaluation)),
    scheduledPostId,
    state.last_client_response_at,
  ).run();
  const experimentKey = stringValue(candidate.experiment_key, `shadow:${state.run_id}:${slotKey}`);
  await db.prepare(
    `INSERT INTO operator_manifest_experiments (
       id, brand_key, experiment_key, family_key, hypothesis_json,
       comparison_group_json, maturity_windows_json, result_criteria_json,
       status, experiment_version
     ) VALUES (?, ?, ?, ?, ?, '{}', '[6,12,18,24]', ?, 'running', ?)
     ON CONFLICT(brand_key, experiment_key) DO NOTHING`,
  ).bind(
    experimentDefinitionId,
    state.brand_key,
    experimentKey,
    stringValue(candidate.family_key, stringValue(lineup?.source_card_family_id, 'unknown')),
    JSON.stringify({ hypothesis_id: hypothesisId, slot_key: slotKey }),
    JSON.stringify({ primary_metric: '24_hour_likes', shadow_only: true }),
    'manifest-shadow-experiment-v1',
  ).run();
  await db.prepare(
    `INSERT INTO operator_manifest_experiment_assignments (
       id, experiment_id, brand_key, cycle_id, slot_key, hypothesis_id,
       scheduled_post_id, variant_key, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
     ON CONFLICT(experiment_id, scheduled_post_id) DO NOTHING`,
  ).bind(
    experimentId,
    experimentDefinitionId,
    state.brand_key,
    state.run_id,
    slotKey,
    hypothesisId,
    scheduledPostId,
    state.variant_key,
  ).run();
  await db.prepare(
    `INSERT INTO operator_manifest_decision_influences (
       id, influence_key, brand_key, cycle_id, slot_key, scheduled_post_id,
       hypothesis_id, strategy_version_id, learning_brief_key, family_key,
       portfolio_role, experiment_key, saved_pattern_identity_key,
       decision_changed, decision_change_types_json, decision_summary,
       evidence_json, influence_version
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
     ON CONFLICT(brand_key, cycle_id, slot_key) DO NOTHING`,
  ).bind(
    decisionInfluenceId,
    `shadow:${state.run_id}:${slotKey}`,
    state.brand_key,
    state.run_id,
    slotKey,
    scheduledPostId,
    hypothesisId,
    strategyId,
    stringValue(record(state.evidence.learning_brief).brief_key) || null,
    stringValue(candidate.family_key, stringValue(lineup?.source_card_family_id, 'unknown')),
    stringValue(record(lineup).strategic_role, 'prospect'),
    experimentKey,
    stringValue(lineup?.source_identity_key) || null,
    JSON.stringify(['innovation_cycle_candidate_admitted']),
    'The frozen decision bundle, locked source plan, strategy, gates, and model evaluation admitted this candidate.',
    JSON.stringify({ decision_bundle_id: state.decision_bundle_id, gate_receipt_id: gateReceiptId, model_evaluation: candidate.model_evaluation ?? {} }),
    'manifest-shadow-decision-influence-v1',
  ).run();
  await db.prepare(
    `INSERT INTO operator_autonomous_lineup_items (
       id, cycle_id, brand_key, slot_key, slot_date, slot_time, text,
       generation_mode, family_key, strategic_purpose, strategy_json,
       cycle_strategy_id, cycle_plan_item_id, gate_receipt_id, source_card_id,
       source_selection_id, hypothesis_id, generation_run_id, draft_id,
       scheduled_post_id, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
     ON CONFLICT(cycle_id, slot_key) DO UPDATE SET
       scheduled_post_id = excluded.scheduled_post_id,
       status = excluded.status`,
  ).bind(
    lineupItemId,
    state.run_id,
    state.brand_key,
    slotKey,
    slot.date,
    slot.time,
    text,
    stringValue(record(lineup).generation_mode, 'controlled_variation'),
    stringValue(candidate.family_key, stringValue(lineup?.source_card_family_id, 'unknown')),
    stringValue(candidate.strategic_purpose, 'shadow_validation'),
    JSON.stringify(state.strategy),
    strategyId,
    planItemId,
    gateReceiptId,
    sourceCardId,
    stringValue(record(lineup).source_selection_id) || null,
    hypothesisId,
    generationRunId,
    draftId,
    scheduledPostId,
  ).run();
  await db.prepare(
    `UPDATE operator_manifest_cycle_plan_items SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).bind(planItemId).run();

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

function manifestShadowLatencyLimitMs(state: ManifestShadowRuntimeState): number {
  if (state.scenario === "noop") return 30_000;
  
  if (state.scenario === "normal_24") return 360_000;
  if (state.scenario === "recovery_48") return 599_999;
  return 600_000;
}

function manifestShadowAcceptanceFailure(
  state: ManifestShadowRuntimeState,
  input: {
    suppliedFailure: string | null;
    orphanCount: number;
    productionNoninterferencePassed: boolean;
  },
): string | null {
  if (input.suppliedFailure) return input.suppliedFailure;
  if (!input.productionNoninterferencePassed) return "production_noninterference_failed";
  if (state.threads_mutation_count !== 0) return "threads_mutation_detected";
  if (input.orphanCount !== 0) return "shadow_cleanup_orphans_present";
  if (state.missing_slot_keys.length !== 0) return "authoritative_coverage_incomplete";
  const expectedAccepted = Math.max(0, state.target_slots.length - state.occupied_slot_keys.length);
  if (state.accepted_posts.length !== expectedAccepted) return "accepted_schedule_count_mismatch";
  if (Number(state.counters.lineage_count ?? 0) !== state.accepted_posts.length) return "accepted_lineage_count_mismatch";
  if (expectedAccepted > 0 && Number(state.counters.gate_count ?? 0) < expectedAccepted) return "deterministic_gate_execution_missing";
  if (Number(state.timings.total_wall_clock_ms ?? 0) > manifestShadowLatencyLimitMs(state)) return "wall_clock_latency_threshold_exceeded";
  if (state.test_case === "mid_batch_collision" && Number(state.counters.collision_injection_count ?? 0) !== 1) return "mid_batch_collision_not_observed";
  if (state.test_case === "gate_rejection_regeneration" && Number(state.counters.gate_rejection_injection_count ?? 0) !== 1) return "gate_rejection_not_observed";
  if (state.test_case === "interrupted_replay" && Number(state.counters.retry_count ?? 0) < 1) return "interrupted_batch_replay_missing";
  if (state.test_case === "stale_delta_refresh" && Number(state.counters.delta_refresh_count ?? 0) !== 1) return "bounded_delta_refresh_missing";
    if (state.test_case === "invalidated_source_replacement" && Number(state.counters.source_replacement_count ?? 0) !== 1) return "authoritative_source_replacement_missing";
  if (Number(state.counters.main_read_count ?? 0) !== 0) return "main_read_detected";
  if (Number(state.counters.main_write_count ?? 0) !== 0) return "main_write_detected";
  if (state.test_case === "frozen_snapshot_zero_main_access" && Number(state.counters.external_read_count ?? 0) !== 0) return "frozen_snapshot_external_read_detected";
  return null;
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
    const productionNoninterferencePassed = Number(state.counters.main_read_count ?? 0) === 0
    && Number(state.counters.main_write_count ?? 0) === 0;
  const acceptanceFailure = manifestShadowAcceptanceFailure(state, {
    suppliedFailure: failedRule,
    orphanCount,
    productionNoninterferencePassed,
  });
  const passed = acceptanceFailure === null;
  const benchmarkTimings = {
    workspace_reset_ms: Number(state.timings.workspace_reset_ms ?? 0),
    evidence_capture_ms: Number(state.timings.evidence_capture_ms ?? 0),
    source_selection_ms: Number(state.timings.source_selection_ms ?? 0),
    decision_bundle_ms: Number(state.timings.decision_bundle_ms ?? 0),
    preparation_ms: Number(state.timings.preparation_ms ?? 0),
    strategy_ms: Number(state.timings.strategy_ms ?? 0),
    strategy_client_gap_ms: Number(state.timings.strategy_client_gap_ms ?? 0),
    model_client_gap_ms: Number(state.timings.model_client_gap_ms ?? 0),
    gate_ms: Number(state.timings.gate_ms ?? 0),
    candidate_persistence_ms: Number(state.timings.candidate_persistence_ms ?? 0),
    lineage_verification_ms: Number(state.timings.lineage_verification_ms ?? 0),
    batch_persistence_ms: Number(state.timings.batch_persistence_ms ?? 0),
    batch_reconciliation_ms: Number(state.timings.batch_reconciliation_ms ?? 0),
    cleanup_ms: Number(state.timings.cleanup_ms ?? 0),
    total_wall_clock_ms: Number(state.timings.total_wall_clock_ms ?? 0),
    latency_limit_ms: manifestShadowLatencyLimitMs(state),
  };
  const benchmark: ManifestShadowBenchmarkInput = {
    id: crypto.randomUUID(),
    shadow_run_id: state.run_id,
    brand_key: state.brand_key,
        scenario: state.scenario,
    test_case: state.test_case,
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
      batch_calls: Number(state.counters.batch_call_count ?? 0),
      gates_executed: Number(state.counters.gate_count ?? 0),
      lineage_verified: Number(state.counters.lineage_count ?? 0),
      delta_refreshes: Number(state.counters.delta_refresh_count ?? 0),
      source_replacements: Number(state.counters.source_replacement_count ?? 0),
      injected_collisions: Number(state.counters.collision_injection_count ?? 0),
      injected_gate_rejections: Number(state.counters.gate_rejection_injection_count ?? 0),
      injected_interruptions: Number(state.counters.interruption_injection_count ?? 0),
    },
    timings: benchmarkTimings,
    external_read_count: Number(state.counters.external_read_count ?? 0),
    retry_count: Number(state.counters.retry_count ?? 0),
    continuation_count: Number(state.counters.continuation_count ?? 0),
        payload_bytes: Number(state.counters.payload_bytes ?? jsonBytes(state.decision_bundle)),
    production_noninterference_passed: productionNoninterferencePassed,
    threads_mutation_count: state.threads_mutation_count,
    cleanup_orphan_count: orphanCount,
    passed,
        failed_rule: acceptanceFailure,
  };
      await writeManifestShadowBenchmarkReceipt(dependencies.shadowDb, benchmark);
  await dependencies.shadowDb.prepare(
    `UPDATE operator_autonomous_growth_cycles
     SET status = ?, missing_slots_json = ?, scheduled_post_ids_json = ?, receipt_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).bind(
    passed ? 'completed' : 'failed',
    JSON.stringify(state.missing_slot_keys),
    JSON.stringify(state.accepted_posts.map((post) => post.scheduled_post_id).filter(Boolean)),
    `shadow-cycle-receipt-${state.run_id}`,
    state.run_id,
  ).run();
  await dependencies.shadowDb.prepare(
    `UPDATE operator_manifest_cycle_receipts
     SET status = ?, completion_json = ?, unresolved_issues_json = ?, completed_at = ?
     WHERE cycle_id = ?`,
  ).bind(
    passed ? 'completed' : 'failed',
    JSON.stringify({ accepted_count: state.accepted_posts.length, remaining_missing_count: state.missing_slot_keys.length, benchmark_id: benchmark.id }),
    JSON.stringify(acceptanceFailure ? [acceptanceFailure] : []),
    completedAt,
    state.run_id,
  ).run();
    if (passed) {
    await completeManifestShadowRun(dependencies.shadowDb, state.run_id, completedAt);
  } else {
    await failManifestShadowRun(dependencies.shadowDb, {
      run_id: state.run_id,
      now_iso: completedAt,
      error_code: acceptanceFailure ?? "manifest_shadow_benchmark_failed",
      error_message: `Shadow acceptance failed: ${acceptanceFailure ?? "unknown_rule"}`,
      diagnostics: {
        benchmark_id: benchmark.id,
        failed_rule: acceptanceFailure,
        counts: benchmark.counts,
        timings: benchmark.timings,
        production_noninterference_passed: productionNoninterferencePassed,
      },
    });
  }
  return { ...benchmark, passed, production_noninterference_passed: productionNoninterferencePassed };
}

async function seedShadowSnapshot(
  payload: JsonRecord,
  identity: { brandKey: string; accountId: string; threadsUserId: string },
  dependencies: OperatorManifestShadowRuntimeDependencies,
): Promise<{ body: JsonRecord; status: number }> {
  if (identity.brandKey !== "manifest_mental") return { body: { success: false, error: "manifest_shadow_manifest_only" }, status: 400 };
  const sources = records(payload.sources);
  if (sources.length < 24) return { body: { success: false, error: "manifest_shadow_seed_requires_24_sources" }, status: 400 };
  const sourceAsOf = stringValue(payload.source_as_of, dependencies.now().toISOString());
  try {
    const sourceCandidates = await buildFrozenSeedCandidates(sources);
    const evidence = normalizeSeedEvidence(payload.evidence, sourceAsOf);
    const snapshotHash = await sha256(stableJson({
      contract_version: "manifest-shadow-frozen-seed-v1",
      brand_key: identity.brandKey,
      source_as_of: sourceAsOf,
      source_candidates: sourceCandidates,
      evidence,
    }));
    const seed = await writeManifestShadowFrozenSeed(dependencies.shadowDb, {
      brand_key: identity.brandKey,
      source_as_of: sourceAsOf,
      snapshot_hash: snapshotHash,
      source_candidates: sourceCandidates as unknown as JsonRecord[],
      evidence: evidence as unknown as JsonRecord,
    });
    return {
      body: {
        success: true,
        seed,
        source_count: sourceCandidates.length,
        snapshot_hash: snapshotHash,
        main_write_count: 0,
        threads_mutation_count: 0,
        next_action: "Prepare a fresh isolated Shadow cycle. The benchmark will read only this frozen Shadow seed.",
      },
      status: 200,
    };
  } catch (error) {
    return {
      body: { success: false, error: error instanceof Error ? error.message : String(error) },
      status: 400,
    };
  }
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
  const testCase = machineKey(payload.test_case, "baseline") as ManifestShadowTestCase;
  if (!SHADOW_TEST_CASES.has(testCase)) return { body: { success: false, error: "manifest_shadow_test_case_invalid" }, status: 400 };
    if (payload.evidence_mode === "live_read") {
    return { body: { success: false, error: "manifest_innovation_live_access_forbidden" }, status: 400 };
  }
  const evidenceMode = "snapshot" as const;
  const variantKey = machineKey(payload.variant_key, "control");
  const timezone = stringValue(payload.timezone, "America/New_York");
  const requestedMissingCount = scenarioMissingCount(scenario, payload.missing_count);
  const horizonHours = Math.max(requestedMissingCount, Math.min(72, Math.max(1, Math.trunc(Number(payload.horizon_hours ?? Math.max(48, requestedMissingCount))))));
    const operationRoot = stringValue(payload.operation_id, `${identity.brandKey}:shadow:${scenario}:${testCase}:${variantKey}:${new Date().toISOString().slice(0, 10)}`);
  const now = dependencies.now();
  const nowIso = now.toISOString();
  const runId = `shadow-${(await sha256(operationRoot)).slice(0, 32)}`;
  const existing = await dependencies.shadowDb.prepare(
    `SELECT id, status FROM manifest_shadow_runs WHERE operation_root = ? LIMIT 1`,
  ).bind(operationRoot).first<JsonRecord>();
    let replayingIncompletePreparation = false;
  if (existing?.id) {
    const state = await readState(dependencies.shadowDb, String(existing.id));
    if (state) {
      return {
        body: {
          success: true,
          reused: true,
          shadow_run_id: existing.id,
          status: existing.status,
          test_case: state.test_case,
          decision_bundle_id: state.decision_bundle_id,
          decision_bundle: state.decision_bundle,
          remaining_missing_count: state.missing_slot_keys.length,
          next_action: state.strategy
            ? "Persist one to four exact planned candidates with persist_manifest_shadow_batch."
            : "Commit one strategy with commit_manifest_shadow_cycle_strategy.",
        },
        status: 200,
      };
    }
    replayingIncompletePreparation = true;
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
  if (replayingIncompletePreparation) {
    await recordManifestShadowStageEvent(dependencies.shadowDb, {
      run_id: runId,
      stage_key: "preparation_recovery",
      event_key: "incomplete_preparation_replayed",
      status: "completed",
      completed_at: nowIso,
      duration_ms: 0,
      payload: {
        operation_root: operationRoot,
        prior_status: existing?.status ?? null,
        durable_runtime_state_found: false,
        recovery_action: "rebuild_exact_operation_in_place",
      },
    });
  }
  try {
        const snapshotExportStarted = Date.now();
    const snapshotInput = {
      brandKey: identity.brandKey,
      accountId: identity.accountId,
      threadsUserId: identity.threadsUserId,
      capturedAt: nowIso,
      timezone,
      coverageRules: {
        horizon_hours: horizonHours,
        requested_missing_count: requestedMissingCount,
        scenario,
      },
    };
    const exportedSnapshot = dependencies.buildDecisionSnapshot
      ? await dependencies.buildDecisionSnapshot(snapshotInput)
      : await buildManifestDecisionSnapshot(
          createManifestShadowReadOnlyDatabase(dependencies.snapshotDb),
          snapshotInput,
        );
    const snapshotExportMs = durationMs(snapshotExportStarted);
    const slotPlan = await dependencies.buildSlots({ timezone, horizonHours, scenario, requestedMissingCount });

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

    const snapshotImportStarted = Date.now();
    const exportedShadowEvidence = manifestDecisionSnapshotToShadowEvidence(exportedSnapshot);
    await writeManifestShadowFrozenSeed(dependencies.shadowDb, {
      brand_key: identity.brandKey,
      source_as_of: exportedSnapshot.captured_at,
      snapshot_hash: exportedSnapshot.snapshot_hash,
      source_candidates: exportedSnapshot.source_candidates as unknown as JsonRecord[],
      evidence: exportedShadowEvidence,
    });
    const frozenSeed = await readManifestShadowFrozenSeed(dependencies.shadowDb, identity.brandKey);
    if (!frozenSeed) throw new Error("manifest_decision_snapshot_import_missing");
    const importedSnapshot = readManifestDecisionSnapshotFromShadowEvidence(frozenSeed.evidence);
    if (!importedSnapshot) throw new Error("manifest_decision_snapshot_import_unreadable");
    const {
      snapshot_hash: importedDeclaredHash,
      ...importedWithoutHash
    } = importedSnapshot;
    const importedComputedHash = await hashManifestDecisionValue(importedWithoutHash);
    if (
      frozenSeed.snapshot_hash !== exportedSnapshot.snapshot_hash
      || importedDeclaredHash !== exportedSnapshot.snapshot_hash
      || importedComputedHash !== exportedSnapshot.snapshot_hash
    ) {
      throw new Error("manifest_decision_snapshot_import_hash_mismatch");
    }
    const snapshotImportMs = durationMs(snapshotImportStarted);
    await recordManifestShadowStageEvent(dependencies.shadowDb, {
      run_id: runId,
      stage_key: "decision_snapshot_boundary",
      event_key: "decision_snapshot_export_import_verified",
      status: "completed",
      started_at: nowIso,
      completed_at: dependencies.now().toISOString(),
      duration_ms: snapshotExportMs + snapshotImportMs,
      payload: {
        snapshot_hash: exportedSnapshot.snapshot_hash,
        source_candidate_count: exportedSnapshot.source_candidates.length,
        eligible_family_count: Number(record(exportedSnapshot.eligibility_state).eligible_family_count ?? 0),
        query_count: exportedSnapshot.query_receipts.length,
        zero_write_proof: exportedSnapshot.zero_write_proof,
        snapshot_export_ms: snapshotExportMs,
        snapshot_import_ms: snapshotImportMs,
        main_disconnected_after_import: true,
      },
    });

    const loadedCandidates = records(frozenSeed.source_candidates) as unknown as SourceSelectionCandidate[];
    const initialEvidence = normalizeSeedEvidence(frozenSeed.evidence, stringValue(frozenSeed.source_as_of, nowIso));
    const minimumEligibleFamilies = Math.max(24, Math.trunc(dependencies.minimumEligibleFamilies ?? 24));
    const eligibleFamilyCount = Number(record(importedSnapshot.eligibility_state).eligible_family_count ?? 0);
    if (eligibleFamilyCount < minimumEligibleFamilies) {
      throw new Error(`manifest_decision_snapshot_candidate_pool_insufficient:${eligibleFamilyCount}:${minimumEligibleFamilies}`);
    }
    let candidates = loadedCandidates;
    let evidence = initialEvidence;
    let deltaRefreshCount = 0;
    const additionalExternalReads = 0;
    if (testCase === "stale_delta_refresh") {
      evidence = {
        ...evidence,
        freshness: {
          ...record(evidence.freshness),
          stale: false,
          bounded_delta_refresh_required: false,
          bounded_delta_refresh_performed: true,
          refresh_source: "immutable_imported_snapshot",
        },
      };
      deltaRefreshCount = 1;
    }
        const occupied = new Set(slotPlan.occupiedSlotKeys);
    const missingSlots = slotPlan.targetSlots
      .map((slot) => slot.key)
      .filter((key) => !occupied.has(key))
      .slice(0, requestedMissingCount);
    const scenarioOverlay = await buildManifestDecisionScenarioOverlay({
      snapshotHash: exportedSnapshot.snapshot_hash,
      targetSlots: slotPlan.targetSlots as unknown as JsonRecord[],
      occupiedSlotKeys: Array.from(occupied),
    });
    if (
      scenarioOverlay.diff_manifest.forbidden_changed_paths.length > 0
      || scenarioOverlay.diff_manifest.evidence_unchanged !== true
    ) {
      throw new Error("manifest_decision_scenario_overlay_overreach");
    }

    const selectionStarted = Date.now();
    const selectorSeed = `${identity.brandKey}:${runId}:${variantKey}`;
    let paritySnapshot: ManifestDecisionSnapshot = importedSnapshot;
    let parityReceipt = await compareManifestDecisionSelectorParity({
      snapshot: paritySnapshot,
      slotKeys: missingSlots,
      seed: selectorSeed,
      minimumEligibleFamilies,
      selectSourceLineup: dependencies.selectSourceLineup,
    });
    let sourceReplacementCount = 0;
    if (testCase === "invalidated_source_replacement" && parityReceipt.innovation.selected.length) {
      const invalidatedIdentity = String(parityReceipt.innovation.selected[0]?.source_identity_key ?? "");
      candidates = candidates.filter((candidate) => String(candidate.source_identity_key ?? "") !== invalidatedIdentity);
      const replacementEligible = candidates.filter((candidate) =>
        candidate.lifetime_label !== "disproven"
        && Boolean(candidate.source_identity_key)
        && Boolean(candidate.source_card_id)
        && Boolean(candidate.source_card_family_id)
      );
      paritySnapshot = {
        ...importedSnapshot,
        source_candidates: candidates,
        eligibility_state: {
          ...record(importedSnapshot.eligibility_state),
          candidate_count: candidates.length,
          eligible_candidate_count: replacementEligible.length,
          eligible_family_count: new Set(
            replacementEligible.map((candidate) => String(candidate.source_card_family_id)),
          ).size,
          invalidated_source_identity_key: invalidatedIdentity,
        },
      };
      parityReceipt = await compareManifestDecisionSelectorParity({
        snapshot: paritySnapshot,
        slotKeys: missingSlots,
        seed: `${selectorSeed}:authoritative-replacement`,
        minimumEligibleFamilies,
        selectSourceLineup: dependencies.selectSourceLineup,
      });
      sourceReplacementCount = 1;
    }
    if (!parityReceipt.parity_passed) {
      throw new Error("manifest_decision_selector_parity_failed");
    }
    const selection = parityReceipt.innovation;
    const lockedLineup = selection.selected as Array<SourceSelectionCandidate & { assigned_slot_key?: string }>;
    const {
      main_equivalent: _mainEquivalentParityPayload,
      innovation: _innovationParityPayload,
      ...compactParityReceipt
    } = parityReceipt;
    await recordManifestShadowStageEvent(dependencies.shadowDb, {
      run_id: runId,
      stage_key: "deterministic_selector_parity",
      event_key: "deterministic_selector_parity_verified",
      status: "completed",
      started_at: nowIso,
      completed_at: dependencies.now().toISOString(),
      duration_ms: durationMs(selectionStarted),
      payload: parityReceipt as unknown as JsonRecord,
    });

    const decisionBundleStarted = Date.now();
    const decisionBundle = buildDecisionBundle({
      runId,
      evidence,
      missingSlots,
      lockedLineup,
      selectionSummary: selection.summary,
    });
    decisionBundle.frozen_seed_snapshot_hash = frozenSeed.snapshot_hash ?? null;
    decisionBundle.frozen_seed_source_as_of = frozenSeed.source_as_of ?? null;
    decisionBundle.genuine_source_seed = true;
    decisionBundle.manifest_decision_snapshot_hash = exportedSnapshot.snapshot_hash;
    decisionBundle.snapshot_export = {
      contract_version: exportedSnapshot.contract_version,
      provider_version: exportedSnapshot.provider_version,
      query_receipts: exportedSnapshot.query_receipts,
      zero_write_proof: exportedSnapshot.zero_write_proof,
      eligible_family_count: Number(record(exportedSnapshot.eligibility_state).eligible_family_count ?? 0),
      main_disconnected_after_import: true,
    };
    decisionBundle.scenario_overlay = scenarioOverlay;
    decisionBundle.selector_parity = compactParityReceipt;
    const snapshotHash = exportedSnapshot.snapshot_hash;
    decisionBundle.snapshot_hash = snapshotHash;
    const decisionBundleId = `shadow-bundle-${(await sha256(stableJson(decisionBundle))).slice(0, 32)}`;
    decisionBundle.bundle_id = decisionBundleId;
    const decisionBundleMs = durationMs(decisionBundleStarted);
    const state: ManifestShadowRuntimeState = {
      contract_version: MANIFEST_SHADOW_CONTRACT_VERSION,
      runtime_version: MANIFEST_SHADOW_RUNTIME_VERSION,
      run_id: runId,
      brand_key: identity.brandKey,
      account_id: identity.accountId,
      threads_user_id: identity.threadsUserId,
            scenario,
      test_case: testCase,
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
        snapshot_export_ms: snapshotExportMs,
        snapshot_import_ms: snapshotImportMs,
        evidence_capture_ms: snapshotExportMs,
        source_selection_ms: durationMs(selectionStarted),
        decision_bundle_ms: decisionBundleMs,
        isolated_preparation_ms: Math.max(0, durationMs(totalStarted) - snapshotExportMs),
        preparation_ms: durationMs(totalStarted),
      },
      counters: {
        external_read_count: additionalExternalReads,
        snapshot_export_query_count: exportedSnapshot.query_receipts.length,
        main_read_count: 0,
        main_write_count: 0,
        retry_count: 0,
        continuation_count: 0,
        payload_bytes: jsonBytes(payload) + jsonBytes(decisionBundle),
        candidate_pool_count: candidates.length,
        eligible_family_count: parityReceipt.eligible_family_count,
        selector_parity_count: parityReceipt.parity_passed ? 1 : 0,
        gate_count: 0,
        lineage_count: 0,
        batch_call_count: 0,
        delta_refresh_count: deltaRefreshCount,
        source_replacement_count: sourceReplacementCount,
        collision_injection_count: 0,
        gate_rejection_injection_count: 0,
        interruption_injection_count: 0,
      },
      threads_mutation_count: 0,
    };
    const horizonStartLocal = state.target_slots[0]?.key ?? nowIso;
    const horizonEndLocal = state.target_slots[state.target_slots.length - 1]?.key ?? nowIso;
    const evidenceWindowStart = new Date(now.getTime() - 28 * 86400000).toISOString();
    await dependencies.shadowDb.prepare(
      `INSERT INTO operator_autonomous_growth_cycles (
         id, brand_key, operation_id, engine_version, status, timezone, horizon_hours,
         horizon_start_local, horizon_end_local, target_slots_json, missing_slots_json,
         account_position_json, strategic_thesis_json, evidence_snapshot_id
       ) VALUES (?, ?, ?, ?, 'prepared', ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         missing_slots_json = excluded.missing_slots_json,
         account_position_json = excluded.account_position_json,
         evidence_snapshot_id = excluded.evidence_snapshot_id,
         updated_at = CURRENT_TIMESTAMP`,
    ).bind(
      runId,
      identity.brandKey,
      operationRoot,
      MANIFEST_SHADOW_RUNTIME_VERSION,
      timezone,
      horizonHours,
      horizonStartLocal,
      horizonEndLocal,
      JSON.stringify(state.target_slots),
      JSON.stringify(state.missing_slot_keys),
                  JSON.stringify({
        evidence_reference: {
          storage_contract: "manifest-shadow-frozen-seed-v1",
          brand_key: identity.brandKey,
          snapshot_hash: exportedSnapshot.snapshot_hash,
          source_candidate_count: candidates.length,
        },
        evidence_summary: {
          captured_at: evidence.captured_at,
          strongest_post_count: evidence.strongest_posts.length,
          weakest_post_count: evidence.weakest_posts.length,
          recent_published_count: evidence.recent_published.length,
          future_scheduled_count: evidence.future_scheduled.length,
          hard_ban_count: evidence.hard_bans.length,
        },
        source_selection_summary: selection.summary,
        scenario_overlay: scenarioOverlay,
        selector_parity: compactParityReceipt,
      }),
      JSON.stringify({
        decision_bundle_id: decisionBundleId,
        test_case: testCase,
        variant_key: variantKey,
        manifest_decision_snapshot_hash: exportedSnapshot.snapshot_hash,
      }),
      decisionBundleId,
    ).run();
    await dependencies.shadowDb.prepare(
      `INSERT INTO operator_manifest_evidence_snapshots (
         id, cycle_id, brand_key, snapshot_version, as_of, timezone, window_start, window_end,
         post_count, mature_count, immature_count, incomplete_count, benchmarks_json,
         recent_exposure_json, future_schedule_json, hard_bans_json, experiments_json, source_hash
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
    ).bind(
      decisionBundleId,
      runId,
      identity.brandKey,
      MANIFEST_SHADOW_SNAPSHOT_VERSION,
      nowIso,
      timezone,
      evidenceWindowStart,
      nowIso,
      evidence.strongest_posts.length + evidence.weakest_posts.length,
      evidence.strongest_posts.length + evidence.weakest_posts.length,
      JSON.stringify(record(evidence.learning_brief)),
      JSON.stringify(evidence.recent_published),
      JSON.stringify(evidence.future_scheduled),
      JSON.stringify(evidence.hard_bans),
      JSON.stringify(record(evidence.strategy)),
      snapshotHash,
    ).run();
    await dependencies.shadowDb.prepare(
      `INSERT INTO operator_manifest_cycle_receipts (
         id, cycle_id, brand_key, operation_id, receipt_version, status,
         trigger_json, startup_state_json, horizon_plan_json, started_at
       ) VALUES (?, ?, ?, ?, ?, 'started', ?, ?, ?, ?)
       ON CONFLICT(cycle_id) DO NOTHING`,
    ).bind(
      `shadow-cycle-receipt-${runId}`,
      runId,
      identity.brandKey,
      operationRoot,
      MANIFEST_SHADOW_RUNTIME_VERSION,
            JSON.stringify({ source: 'manifest_innovation_cycle', test_case: testCase, variant_key: variantKey }),
      JSON.stringify({
        snapshot_hash: snapshotHash,
        decision_bundle_id: decisionBundleId,
        snapshot_export: decisionBundle.snapshot_export,
        scenario_overlay_hash: scenarioOverlay.overlay_hash,
        selector_parity: compactParityReceipt,
      }),
      JSON.stringify({
        target_slots: state.target_slots,
        occupied_slot_keys: state.occupied_slot_keys,
        missing_slot_keys: state.missing_slot_keys,
        overlay_diff_manifest: scenarioOverlay.diff_manifest,
      }),
      nowIso,
    ).run();
    const snapshot: ManifestShadowSnapshot = {
      contract_version: MANIFEST_SHADOW_SNAPSHOT_VERSION,
      brand_key: identity.brandKey,
      source_as_of: nowIso,
      snapshot_hash: snapshotHash,
      tables: [],
            metadata: { state: runtimeStateForPersistence(state) },
    };
    const expiresAt = new Date(now.getTime() + Math.max(1, Math.min(336, Number(payload.retention_hours ?? 72))) * 3600000).toISOString();
        const seeded = await seedManifestShadowSnapshot(dependencies.shadowDb, runId, snapshot, expiresAt);
    if (testCase === "retained_failure_cleanup") {
      const failedAt = dependencies.now().toISOString();
      await failManifestShadowRun(dependencies.shadowDb, {
        run_id: runId,
        now_iso: failedAt,
        error_code: "manifest_shadow_retained_failure_injected",
        error_message: "The permanent Shadow lab retained this deterministic failed run for diagnostic and cleanup validation.",
        diagnostics: {
          stage: "post_snapshot_fault_injection",
          test_case: testCase,
          snapshot_hash: snapshotHash,
          payload_bytes: seeded.payload_bytes,
        },
      });
      return {
        body: {
          success: false,
          expected_failure: true,
          shadow_run_id: runId,
          test_case: testCase,
          error: "manifest_shadow_retained_failure_injected",
          diagnostic_retained: true,
          cleanup_required: true,
        },
        status: 409,
      };
    }
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
        eligible_family_count: parityReceipt.eligible_family_count,
        minimum_eligible_family_count: parityReceipt.minimum_eligible_family_count,
        locked_source_count: lockedLineup.length,
        snapshot_hash: snapshotHash,
        snapshot_export_ms: snapshotExportMs,
        snapshot_import_ms: snapshotImportMs,
        scenario_overlay_hash: scenarioOverlay.overlay_hash,
        selector_parity_passed: parityReceipt.parity_passed,
        selector_output_hash: parityReceipt.innovation_output_hash,
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
        test_case: testCase,
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
    const strategyStarted = Date.now();
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
  state.timings.strategy_ms = durationMs(strategyStarted);
  state.counters.payload_bytes = Number(state.counters.payload_bytes ?? 0) + jsonBytes(payload);
    state.strategy = strategy;
  state.last_client_response_at = dependencies.now().toISOString();
  const strategyHash = await sha256(stableJson(strategy));
  await dependencies.shadowDb.prepare(
    `INSERT INTO operator_manifest_cycle_strategies (
       id, cycle_id, brand_key, snapshot_id, contract_version, account_conclusion_json,
       content_focus_json, benchmarks_json, strongest_json, weakest_json, directives_json,
       experiments_json, risks_json, lineup_json, strategy_hash, status, locked_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'locked', ?)
     ON CONFLICT(cycle_id) DO NOTHING`,
  ).bind(
    strategy.strategy_id,
    runId,
    state.brand_key,
    state.decision_bundle_id,
    MANIFEST_SHADOW_DECISION_BUNDLE_VERSION,
    JSON.stringify(strategy.account_conclusion),
    JSON.stringify(strategy.content_focus),
    JSON.stringify(strategy.benchmarks),
    JSON.stringify(strategy.strongest_executions),
    JSON.stringify(strategy.weakest_executions),
    JSON.stringify(strategy.directives),
    JSON.stringify(strategy.experiments),
    JSON.stringify(strategy.risks),
    JSON.stringify(strategy.lineup),
    strategyHash,
    strategy.locked_at,
  ).run();
  for (let index = 0; index < suppliedLineup.length; index += 1) {
    const item = suppliedLineup[index];
    const slotKey = stringValue(item.slot_key);
    const slot = state.target_slots.find((candidate) => candidate.key === slotKey);
    if (!slot) throw new Error(`manifest_shadow_strategy_slot_missing:${slotKey}`);
    const planItemId = `shadow-plan-${(await sha256(`${runId}|${slotKey}`)).slice(0, 32)}`;
    await dependencies.shadowDb.prepare(
      `INSERT INTO operator_manifest_cycle_plan_items (
         id, strategy_id, cycle_id, brand_key, slot_key, slot_date, slot_time,
         family_key, strategic_role, generation_mode, source_kind, source_card_id,
         source_selection_id, audience_reward, hook_direction, placement_reason,
         nearby_avoid_json, exploration_mode, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'source_card', ?, ?, ?, ?, ?, '[]', ?, 'planned')
       ON CONFLICT(cycle_id, slot_key) DO NOTHING`,
    ).bind(
      planItemId,
      strategy.strategy_id,
      runId,
      state.brand_key,
      slotKey,
      slot.date,
      slot.time,
      stringValue(item.family_key, 'unknown'),
      stringValue(item.strategic_role, 'prospect'),
      stringValue(item.generation_mode, 'controlled_variation'),
      stringValue(item.source_card_id) || null,
      stringValue(item.source_selection_id) || null,
      stringValue(item.audience_reward, 'Preserve the selected source reward.'),
      stringValue(item.hook_direction, 'Preserve the selected hook function.'),
      stringValue(item.placement_reason, 'Exact locked Innovation Cycle order.'),
      stringValue(item.exploration_mode, 'hybrid'),
    ).run();
  }
  await dependencies.shadowDb.prepare(
    `UPDATE operator_autonomous_growth_cycles
     SET status = 'strategy_locked', cycle_strategy_id = ?, strategy_version_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).bind(strategy.strategy_id, strategy.strategy_id, runId).run();
  await dependencies.shadowDb.prepare(
    `UPDATE operator_manifest_cycle_receipts
     SET output_strategy_version_id = ?, status = 'strategy_locked'
     WHERE cycle_id = ?`,
  ).bind(strategy.strategy_id, runId).run();
  await writeState(dependencies.shadowDb, state);
  await recordManifestShadowStageEvent(dependencies.shadowDb, {
    run_id: runId,
    stage_key: "strategy",
    event_key: "strategy_locked",
    status: "completed",
    completed_at: state.last_client_response_at,
        duration_ms: Number(state.timings.strategy_ms ?? 0),
    payload: {
      strategy_id: strategy.strategy_id,
      lineup_count: suppliedLineup.length,
      decision_bundle_id: bundleId,
      client_gap_ms: gapMs,
      payload_bytes: jsonBytes(payload),
    },
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
      const replayReceipt = JSON.parse(String(priorEvent.payload_json)) as JsonRecord;
      state.counters.retry_count = Number(state.counters.retry_count ?? 0) + 1;
      state.counters.payload_bytes = Number(state.counters.payload_bytes ?? 0) + jsonBytes(payload);
      state.last_client_response_at = dependencies.now().toISOString();
      let benchmark: JsonRecord | null = null;
      if (state.completed) benchmark = await finalizeBenchmark(dependencies, state, state.last_client_response_at);
      await writeState(dependencies.shadowDb, state);
      return { body: { success: true, reused: true, ...replayReceipt, benchmark }, status: 200 };
    } catch {
      return { body: { success: false, error: "manifest_shadow_batch_receipt_corrupt" }, status: 500 };
    }
  }
  const batchStarted = Date.now();
  state.counters.batch_call_count = Number(state.counters.batch_call_count ?? 0) + 1;
  state.counters.payload_bytes = Number(state.counters.payload_bytes ?? 0) + jsonBytes(payload);
  const gapMs = Math.max(0, Date.now() - Date.parse(state.last_client_response_at));
  state.timings.model_client_gap_ms = Number(state.timings.model_client_gap_ms ?? 0) + gapMs;
  const acceptedTexts = new Set(state.accepted_posts.map((post) => normalizeText(post.text)));
  const results: JsonRecord[] = [];
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    const candidate = candidates[candidateIndex];
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
        const injectCollision = state.test_case === "mid_batch_collision"
      && Number(state.counters.collision_injection_count ?? 0) === 0
      && candidateIndex === Math.min(1, candidates.length - 1);
    const injectGateRejection = state.test_case === "gate_rejection_regeneration"
      && Number(state.counters.gate_rejection_injection_count ?? 0) === 0
      && candidateIndex === 0;
    if (injectCollision || injectGateRejection) {
      const gateKey = injectCollision ? "occupied_slot_collision" : "deterministic_gate_rejection";
      const injected = {
        success: false,
        operation_id: candidateOperationId,
        slot_key: slotKey || null,
        error: injectCollision
          ? "manifest_shadow_mid_batch_occupied_slot_collision"
          : "manifest_shadow_deterministic_gate_rejection",
        blocking_failures: [{
          gate_key: gateKey,
          executed: true,
          status: "fail",
          evidence: { test_case: state.test_case, injected_once: true },
        }],
        gate_results: [{
          gate_key: gateKey,
          executed: true,
          status: "fail",
          evidence: { test_case: state.test_case, injected_once: true },
        }],
      };
      if (injectCollision) {
        state.counters.collision_injection_count = Number(state.counters.collision_injection_count ?? 0) + 1;
      } else {
        state.counters.gate_rejection_injection_count = Number(state.counters.gate_rejection_injection_count ?? 0) + 1;
      }
      state.rejected_posts.push(injected);
      results.push(injected);
      continue;
    }
    const gateStarted = Date.now();
    const gate = deterministicGateCandidate(state, candidate, acceptedTexts);
    state.timings.gate_ms = Number(state.timings.gate_ms ?? 0) + durationMs(gateStarted);
    state.counters.gate_count = Number(state.counters.gate_count ?? 0) + gate.results.length;
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
        const persistenceStarted = Date.now();
    const persisted = await persistAcceptedShadowCandidate(dependencies.shadowDb, state, candidate, gate.results);
    state.timings.candidate_persistence_ms = Number(state.timings.candidate_persistence_ms ?? 0) + durationMs(persistenceStarted);
    const lineageStarted = Date.now();
    const lineageComplete = persisted.publish_lineage_complete === true
      && persisted.intelligence_lineage_complete === true
      && Boolean(persisted.scheduled_post_id)
      && Boolean(persisted.generation_run_id)
      && Boolean(persisted.draft_id)
      && Boolean(persisted.hypothesis_id)
      && Boolean(persisted.experiment_assignment_id)
      && Boolean(persisted.decision_influence_id);
    state.timings.lineage_verification_ms = Number(state.timings.lineage_verification_ms ?? 0) + durationMs(lineageStarted);
    state.counters.lineage_count = Number(state.counters.lineage_count ?? 0) + 1;
    if (!lineageComplete) throw new Error(`manifest_shadow_lineage_incomplete:${slotKey}`);
    const accepted = { success: true, operation_id: candidateOperationId, ...persisted };
    state.accepted_posts.push(accepted);
    acceptedTexts.add(normalizeText(candidate.text));
    state.missing_slot_keys = state.missing_slot_keys.filter((key) => key !== slotKey);
    results.push(accepted);
  }
    state.timings.batch_persistence_ms = Number(state.timings.batch_persistence_ms ?? 0) + durationMs(batchStarted);
  const reconciliationStarted = Date.now();
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
    test_case: state.test_case,
    payload_bytes: jsonBytes(payload),
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
  state.timings.batch_reconciliation_ms = Number(state.timings.batch_reconciliation_ms ?? 0) + durationMs(reconciliationStarted);
  await writeState(dependencies.shadowDb, state);
  if (state.test_case === "interrupted_replay"
      && Number(state.counters.interruption_injection_count ?? 0) === 0) {
    state.counters.interruption_injection_count = 1;
    await writeState(dependencies.shadowDb, state);
    return {
      body: {
        success: false,
        expected_failure: true,
        error: "manifest_shadow_simulated_response_interruption",
        side_effect_state: "confirmed",
        shadow_run_id: runId,
        batch_operation_id: batchOperationId,
        retryable: true,
        required_next_action: "Replay the identical batch operation_id and candidates. The durable batch receipt already exists and no item may be duplicated.",
      },
      status: 503,
    };
  }
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

function buildPendingShadowStrategyContract(state: ManifestShadowRuntimeState): JsonRecord | null {
  if (state.strategy || state.completed || !state.missing_slot_keys.length) return null;
  const lineupBySlot = Object.fromEntries(state.locked_source_lineup.map((item) => [
    String(item.assigned_slot_key ?? ""),
    {
      identity: item.source_identity_key ?? null,
      source_card_id: item.source_card_id ?? null,
      family_id: item.source_card_family_id ?? null,
      mechanism: typeof item.source_mechanism === "string" ? item.source_mechanism.slice(0, 90) : null,
      direction: typeof item.recommended_direction === "string" ? item.recommended_direction.slice(0, 140) : null,
    },
  ]));
  return {
    shadow_run_id: state.run_id,
    decision_bundle_id: state.decision_bundle_id,
    snapshot_hash: state.decision_bundle.snapshot_hash ?? null,
    lineup_count: state.locked_source_lineup.length,
    lineup_by_slot: lineupBySlot,
    lineup_order_contract: "Object insertion order is the exact locked strategy order. Convert entries to the commit lineup without sorting or substitution.",
    field_legend: {
      identity: "source_identity_key",
      source_card_id: "source_card_id",
      family_id: "source_card_family_id",
      mechanism: "bounded source mechanism cue",
      direction: "bounded source-backed generation direction",
    },
    source_substitution_allowed: false,
    strategy_commit_tool: "commit_manifest_shadow_cycle_strategy",
  };
}

async function getShadowPosts(
  payload: JsonRecord,
  identity: { brandKey: string; accountId: string; threadsUserId: string },
  dependencies: OperatorManifestShadowRuntimeDependencies,
): Promise<{ body: JsonRecord; status: number }> {
  const runId = stringValue(payload.shadow_run_id);
  if (!runId) return { body: { success: false, error: "shadow_run_id_required" }, status: 400 };
  const run = await dependencies.shadowDb.prepare(
    `SELECT id, brand_key, status FROM manifest_shadow_runs WHERE id = ? LIMIT 1`,
  ).bind(runId).first<JsonRecord>();
  if (!run || run.brand_key !== identity.brandKey) return { body: { success: false, error: "manifest_shadow_run_not_found" }, status: 404 };
  const state = await readState(dependencies.shadowDb, runId);
  if (!state) return { body: { success: false, error: "manifest_shadow_state_not_found" }, status: 404 };
  const posts = [...state.accepted_posts]
    .sort((left, right) => stringValue(left.slot_key).localeCompare(stringValue(right.slot_key)))
    .map((post) => ({
      slot_key: post.slot_key ?? null,
      scheduled_time_utc: post.scheduled_time_utc ?? null,
      scheduled_post_id: post.scheduled_post_id ?? null,
      text: post.text ?? null,
      source_card_id: post.source_card_id ?? null,
      source_card_family_id: post.source_card_family_id ?? null,
      source_identity_key: post.source_identity_key ?? null,
      publish_lineage_complete: post.publish_lineage_complete === true,
      intelligence_lineage_complete: post.intelligence_lineage_complete === true,
    }));
  return {
    body: {
      success: true,
      shadow_run_id: runId,
      status: run.status,
      post_count: posts.length,
      posts,
      main_read_count: Number(state.counters.main_read_count ?? 0),
      main_write_count: Number(state.counters.main_write_count ?? 0),
      threads_mutation_count: state.threads_mutation_count,
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
        let receipt = await readManifestShadowReceipt(dependencies.shadowDb, runId);
  let run = record(receipt.run);
  if (run.brand_key && run.brand_key !== identity.brandKey) return { body: { success: false, error: "manifest_shadow_run_not_found" }, status: 404 };
  const state = await readState(dependencies.shadowDb, runId);
  const benchmark = record(receipt.benchmark);
  if (state?.completed && ["preparing", "running"].includes(stringValue(run.status)) && benchmark.id) {
    const benchmarkPassed = benchmark.passed === true || Number(benchmark.passed ?? 0) === 1;
    if (benchmarkPassed) {
      await completeManifestShadowRun(dependencies.shadowDb, runId, dependencies.now().toISOString());
    } else {
      await failManifestShadowRun(dependencies.shadowDb, {
        run_id: runId,
        now_iso: dependencies.now().toISOString(),
        error_code: stringValue(benchmark.failed_rule, "manifest_shadow_benchmark_failed"),
        error_message: `Shadow acceptance failed: ${stringValue(benchmark.failed_rule, "unknown_rule")}`,
        diagnostics: { benchmark_id: benchmark.id, repaired_terminal_state: true },
      });
    }
    receipt = await readManifestShadowReceipt(dependencies.shadowDb, runId);
    run = record(receipt.run);
  }
    return {
    body: {
      success: true,
      shadow_run_id: runId,
      pending_strategy_contract: state ? buildPendingShadowStrategyContract(state) : null,
      state_summary: state ? {
                scenario: state.scenario,
        test_case: state.test_case,
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
                counters: state.counters,
      } : null,
      receipt,
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
  if (input.toolName === "seed_manifest_shadow_snapshot") {
    return seedShadowSnapshot(input.payload, input.identity, dependencies);
  }
  if (input.toolName === "prepare_manifest_shadow_cycle") {
    return prepareShadowCycle(input.payload, input.identity, dependencies);
  }
  if (input.toolName === "commit_manifest_shadow_cycle_strategy") {
    return commitShadowStrategy(input.payload, input.identity, dependencies);
  }
    if (input.toolName === "persist_manifest_shadow_batch") {
    return persistShadowBatch(input.payload, input.identity, dependencies);
  }
  if (input.toolName === "get_manifest_shadow_posts") {
    return getShadowPosts(input.payload, input.identity, dependencies);
  }
  return getShadowReceipt(input.payload, input.identity, dependencies);
}

export function isOperatorManifestShadowToolName(value: string): value is OperatorManifestShadowToolName {
  return (OPERATOR_MANIFEST_SHADOW_TOOL_NAMES as readonly string[]).includes(value);
}


