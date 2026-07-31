import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleOperatorManifestShadowTool,
  type ManifestShadowEvidence,
  type ManifestShadowTestCase,
  type OperatorManifestShadowRuntimeDependencies,
} from "../src/operatorManifestShadowRuntimeService";
import {
  buildManifestShadowScenarioSlots,
  resolveManifestShadowSourceCandidates,
} from "../src/operatorManifestShadowEvidenceService";
import {
  resetManifestShadowWorkspace,
  verifyManifestShadowOrphans,
} from "../src/operatorManifestShadowService";
import {
  hashManifestDecisionValue,
  type ManifestDecisionSnapshot,
} from "../src/operatorManifestDecisionSnapshotService";
import { selectSourceFamilyLineup, type SourceSelectionCandidate } from "../src/sourceFamilySelection";

type JsonRecord = Record<string, unknown>;
type Scenario = "noop" | "normal_24" | "recovery_48" | "custom";

vi.setConfig({ testTimeout: 300_000, hookTimeout: 60_000 });


const identity = {
  brandKey: "manifest_mental",
  accountId: "shadow-test-user",
  threadsUserId: "shadow-test-threads",
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function rows(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function parseJsonRecord(value: unknown): JsonRecord {
  try {
    return record(JSON.parse(String(value ?? "{}")));
  } catch {
    return {};
  }
}

function candidates(count = 120): SourceSelectionCandidate[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    source_candidate_id: `candidate-${index}`,
    source_identity_key: `identity-${index}`,
    source_card_family_id: `family-${index}`,
    source_card_id: `card-${index}`,
    source_type: "source_card",
    internal_source_id: `card-${index}`,
    source_mechanism: "direct_reader_wealth_utility",
    required_product: "concrete outcome",
    recommended_direction: "Preserve the source hook and payoff.",
    text: `The Universe is preparing financial breakthrough ${index + 1} for the person reading this.`,
    metrics: { likes: 1000 + index },
    primary_source: { post_text: `Frozen source ${index + 1}` },
    lifetime_label: index < 16 ? "proven" : "promising",
    recent_label: "stable",
    confidence_label: "high",
    lifetime_sample_size: 3 + index,
    recent_sample_size: 2,
    lifetime_index: 1.2 + index / 100,
    recent_index: 1.05,
    uses_24h: 0,
    uses_7d: 0,
    uses_28d: 0,
    hours_since_last_use: 100 + index,
    semantic_key: `mechanism-${index}`,
  }));
}

function evidence(): ManifestShadowEvidence {
  return {
    captured_at: "2026-07-30T18:30:00.000Z",
    strategy: { id: "strategy-frozen", directives: ["preserve winners"] },
    learning_brief: { brief_key: "brief-frozen", primary_metric: "24_hour_likes" },
    content_focus: { emphasize: ["concrete wealth utility"] },
    hard_bans: [{ rule_key: "ban-1", phrase: "I bet having" }],
    strongest_posts: [{ post_id: "winner-1", likes: 1993 }],
    weakest_posts: [{ post_id: "weak-1", likes: 0 }],
    recent_published: [],
    future_scheduled: [],
    evidence_gaps: [],
    production_fingerprint: { frozen_fixture: { row_count: 1, captured_at: "2026-07-30T18:00:00Z" } },
    freshness: { stale: false, bounded_delta_refresh_required: false },
  };
}

async function frozenDecisionSnapshot(): Promise<ManifestDecisionSnapshot> {
  const sourceCandidates = candidates(120);
  const frozenEvidence = evidence();
  const withoutHash: Omit<ManifestDecisionSnapshot, "snapshot_hash"> = {
    contract_version: "manifest-decision-snapshot-v1",
    provider_version: "manifest-decision-provider-v1",
    brand_key: identity.brandKey,
    account_id: identity.accountId,
    threads_user_id: identity.threadsUserId,
    captured_at: frozenEvidence.captured_at,
    timezone: "America/New_York",
    coverage_rules: { exact_hourly_slots: true, preserve_existing_schedule: true },
    source_candidates: sourceCandidates,
    saved_patterns: [],
    source_cards: [],
    source_families: [],
    source_selections: [],
    source_exclusions: [],
    mature_metric_windows: [],
    source_exposure_history: [],
    strategy: frozenEvidence.strategy,
    learning_brief: frozenEvidence.learning_brief,
    content_focus: frozenEvidence.content_focus,
    portfolio_state: null,
    experiments: [],
    hypotheses: [],
    repetition_evidence: [],
    follower_checkpoint: null,
    hard_bans: frozenEvidence.hard_bans,
    recent_performance: { strongest_count: 1, weakest_count: 1 },
    strongest_posts: frozenEvidence.strongest_posts,
    weakest_posts: frozenEvidence.weakest_posts,
    recent_published: frozenEvidence.recent_published,
    future_scheduled: frozenEvidence.future_scheduled,
    eligibility_state: {
      candidate_count: sourceCandidates.length,
      eligible_candidate_count: sourceCandidates.length,
      eligible_family_count: sourceCandidates.length,
      excluded_candidate_count: 0,
      excluded_candidates: [],
    },
    evidence_gaps: frozenEvidence.evidence_gaps,
    freshness: frozenEvidence.freshness,
    query_receipts: [{ query_key: "frozen_test_snapshot", row_count: sourceCandidates.length, read_only: true }],
    production_fingerprint_before: frozenEvidence.production_fingerprint,
    production_fingerprint_after: frozenEvidence.production_fingerprint,
    zero_write_proof: { passed: true, main_write_count: 0, select_only_enforced: true },
  };
  return { ...withoutHash, snapshot_hash: await hashManifestDecisionValue(withoutHash) };
}


type DependencyHarness = {
  deps: OperatorManifestShadowRuntimeDependencies;
  audit: {
    snapshot_db_calls: number;
    evidence_provider_reads: number;
    source_provider_reads: number;
  };
};

function dependencyHarness(now = new Date("2026-07-30T18:30:00.000Z")): DependencyHarness {
  const audit = {
    snapshot_db_calls: 0,
    evidence_provider_reads: 0,
    source_provider_reads: 0,
  };
  const forbiddenSnapshotDb = new Proxy({} as D1Database, {
    get: (_target, property) => {
      if (["prepare", "batch", "exec", "dump"].includes(String(property))) {
        return () => {
          audit.snapshot_db_calls += 1;
          throw new Error("main_or_external_snapshot_database_access_forbidden");
        };
      }
      return undefined;
    },
  });
    const deps: OperatorManifestShadowRuntimeDependencies = {
    snapshotDb: forbiddenSnapshotDb,
    shadowDb: env.DB,
    codeSha: "a".repeat(40),
    minimumEligibleFamilies: 100,
    buildDecisionSnapshot: async () => {
      audit.source_provider_reads += 1;
      audit.evidence_provider_reads += 1;
      return frozenDecisionSnapshot();
    },
    now: () => new Date(now.getTime()),
    buildSlots: async (input) => buildManifestShadowScenarioSlots({ now, ...input }),
    loadSourceCandidates: async () => {
      audit.source_provider_reads += 1;
      return candidates();
    },
    selectSourceLineup: (input) => selectSourceFamilyLineup(input),
    readEvidence: async () => {
      audit.evidence_provider_reads += 1;
      return evidence();
    },
  };
  return { deps, audit };
}

function strategyPayload(prepared: JsonRecord): JsonRecord {
  const bundle = record(prepared.decision_bundle);
  const locked = rows(bundle.locked_source_lineup);
  return {
    shadow_run_id: prepared.shadow_run_id,
    decision_bundle_id: prepared.decision_bundle_id,
    account_conclusion: { conclusion: "Preserve proven wealth utility while testing the locked broader portfolio." },
    content_focus: { emphasize: ["concrete outcomes"], reduce: ["generic filler"] },
    benchmarks: { primary_metric: "24_hour_likes", winner_post_id: "winner-1" },
    strongest_executions: [{ published_post_id: "winner-1", reason: "highest mature likes" }],
    weakest_executions: [{ published_post_id: "weak-1", reason: "zero mature likes" }],
    directives: { generation: ["preserve source hook and payoff"], source_authority: "locked" },
    experiments: [{ experiment_key: "shadow-portfolio" }],
    risks: ["execution sameness"],
    lineup: locked.map((item) => ({
      slot_key: item.assigned_slot_key,
      source_card_id: item.source_card_id,
      family_key: item.source_card_family_id,
      strategic_role: item.lifetime_label === "proven" ? "franchise" : "prospect",
      generation_mode: item.lifetime_label === "proven" ? "franchise_deployment" : "adjacent_experiment",
      audience_reward: "Concrete reader-directed outcome.",
      hook_direction: "Preserve the source hook function.",
      placement_reason: "Exact locked source-selection order.",
      exploration_mode: item.lifetime_label === "proven" ? "exploit" : "explore",
    })),
  };
}

function candidateFor(item: JsonRecord, ordinal: number, operationId: string, text?: string): JsonRecord {
  const slot = String(item.assigned_slot_key ?? "");
  return {
    operation_id: operationId,
    slot_key: slot,
    source_card_id: item.source_card_id,
    family_key: item.source_card_family_id,
    text: text ?? `The Universe is aligning breakthrough ${ordinal + 1} for the person reading this at ${slot}.`,
    hook_style: "direct_reader",
    format: "text",
    strategic_purpose: "shadow_validation",
    experiment_key: `experiment-${operationId}`,
    novelty_level: "controlled",
    adaptation_plan: {
      adaptation_goal: "Preserve the frozen source mechanism and payoff.",
      preserved_functions: ["hook", "premise", "payoff"],
      transformed_elements: ["bounded wording"],
    },
    model_evaluation: {
      novelty_assessment: "Distinct opening and bounded wording.",
      winner_preservation_assessment: "Preserves the selected source mechanism.",
      slot_placement_assessment: `Exact locked slot ${slot}.`,
      recent_exposure_assessment: "Compared with the frozen exposure bundle.",
      intelligence_application_assessment: "Applies the strategy and locked source directive.",
    },
  };
}

async function prepareRun(input: {
  deps: OperatorManifestShadowRuntimeDependencies;
  scenario?: Scenario;
  testCase?: ManifestShadowTestCase;
  suffix: string;
  missingCount?: number;
  horizonHours?: number;
  variantKey?: string;
}): Promise<{ status: number; body: JsonRecord }> {
  return handleOperatorManifestShadowTool({
    toolName: "prepare_manifest_shadow_cycle",
    payload: {
      scenario: input.scenario ?? "custom",
      test_case: input.testCase ?? "baseline",
      evidence_mode: "snapshot",
      variant_key: input.variantKey ?? `control-${input.suffix}`,
      operation_id: `innovation-test:${input.suffix}`,
      horizon_hours: input.horizonHours ?? Math.max(2, input.missingCount ?? 2),
      ...(input.missingCount === undefined ? {} : { missing_count: input.missingCount }),
    },
    identity,
  }, input.deps);
}

async function commitPrepared(deps: OperatorManifestShadowRuntimeDependencies, prepared: JsonRecord): Promise<JsonRecord> {
  const committed = await handleOperatorManifestShadowTool({
    toolName: "commit_manifest_shadow_cycle_strategy",
    payload: strategyPayload(prepared),
    identity,
  }, deps);
  expect(committed.status).toBe(200);
  expect(committed.body.success).toBe(true);
  return committed.body;
}

async function persistBatch(
  deps: OperatorManifestShadowRuntimeDependencies,
  prepared: JsonRecord,
  operationId: string,
  batch: JsonRecord[],
): Promise<{ status: number; body: JsonRecord }> {
  return handleOperatorManifestShadowTool({
    toolName: "persist_manifest_shadow_batch",
    payload: {
      shadow_run_id: prepared.shadow_run_id,
      operation_id: operationId,
      candidates: batch,
    },
    identity,
  }, deps);
}

async function readReceipt(deps: OperatorManifestShadowRuntimeDependencies, runId: unknown): Promise<JsonRecord> {
  const result = await handleOperatorManifestShadowTool({
    toolName: "get_manifest_shadow_cycle_receipt",
    payload: { shadow_run_id: runId },
    identity,
  }, deps);
  expect(result.status).toBe(200);
  expect(result.body.success).toBe(true);
  return result.body;
}

function benchmarkFrom(receiptBody: JsonRecord): { raw: JsonRecord; counts: JsonRecord; timings: JsonRecord } {
  const receipt = record(receiptBody.receipt);
  const raw = record(receipt.benchmark);
  return {
    raw,
    counts: parseJsonRecord(raw.counts_json),
    timings: parseJsonRecord(raw.timings_json),
  };
}

async function completePrepared(
  deps: OperatorManifestShadowRuntimeDependencies,
  prepared: JsonRecord,
  suffix: string,
): Promise<JsonRecord> {
  await commitPrepared(deps, prepared);
  const locked = rows(record(prepared.decision_bundle).locked_source_lineup);
  for (let offset = 0; offset < locked.length; offset += 4) {
    const batch = locked.slice(offset, offset + 4).map((item, index) =>
      candidateFor(item, offset + index, `${prepared.shadow_run_id}:${offset + index}:candidate`));
    const persisted = await persistBatch(deps, prepared, `batch-${suffix}-${offset / 4}`, batch);
    expect(persisted.status).toBe(200);
    expect(persisted.body.success).toBe(true);
    expect(persisted.body.rejected_count).toBe(0);
  }
  return readReceipt(deps, prepared.shadow_run_id);
}

async function runScenario(
  scenario: "noop" | "normal_24" | "recovery_48",
  suffix: string,
  testCase: ManifestShadowTestCase = "baseline",
): Promise<{ duration: number; prepared: JsonRecord; receipt: JsonRecord; audit: DependencyHarness["audit"] }> {
  const started = Date.now();
  const harness = dependencyHarness();
  const preparedResult = await prepareRun({
    deps: harness.deps,
    scenario,
    testCase,
    suffix,
    horizonHours: 48,
  });
  expect(preparedResult.status).toBe(200);
  expect(preparedResult.body.success).toBe(true);
  const prepared = preparedResult.body;
  const receipt = scenario === "noop"
    ? await readReceipt(harness.deps, prepared.shadow_run_id)
    : await completePrepared(harness.deps, prepared, suffix);
  return { duration: Date.now() - started, prepared, receipt, audit: harness.audit };
}

async function count(table: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

beforeEach(async () => {
  await resetManifestShadowWorkspace(env.DB);
  await env.DB.prepare(`DELETE FROM manifest_shadow_benchmark_receipts`).run();
  await env.DB.prepare(`DELETE FROM manifest_shadow_diagnostic_archives`).run();
  await env.DB.prepare(`DELETE FROM manifest_shadow_stage_events`).run();
  await env.DB.prepare(`DELETE FROM manifest_shadow_snapshots`).run();
      await env.DB.prepare(`DELETE FROM manifest_shadow_runs`).run();
  await env.DB.prepare(`DELETE FROM manifest_shadow_frozen_seed_chunks`).run();
  await env.DB.prepare(`DELETE FROM manifest_shadow_frozen_seeds`).run();
});

describe("operatorManifestShadowRuntimeService", () => {
  it("bootstraps a complete frozen source lineup when the disposable live shadow database is empty", () => {
    const fallback = resolveManifestShadowSourceCandidates([], "manifest_mental");
    expect(fallback).toHaveLength(96);
    expect(new Set(fallback.map((candidate) => candidate.source_card_family_id)).size).toBe(96);
    expect(fallback.every((candidate) => candidate.source_type === "source_card")).toBe(true);

    const existing = candidates(2);
    expect(resolveManifestShadowSourceCandidates(existing, "manifest_mental")).toBe(existing);
  });

  it("prepares isolated no-op, 24-slot, and 48-slot Innovation cycles without Main database access", async () => {
    for (const [scenario, expected] of [["noop", 0], ["normal_24", 24], ["recovery_48", 48]] as const) {
      const harness = dependencyHarness();
      const prepared = await prepareRun({ deps: harness.deps, scenario, suffix: `prepare-${scenario}`, horizonHours: 48 });
      expect(prepared.status).toBe(200);
      expect(prepared.body.remaining_missing_count).toBe(expected);
            expect(prepared.body.evidence_mode).toBe("snapshot");
      expect(harness.audit.snapshot_db_calls).toBe(0);
      expect(harness.audit.source_provider_reads).toBe(1);
      expect(harness.audit.evidence_provider_reads).toBe(1);
      if (scenario === "normal_24") {
        const pendingReceipt = await readReceipt(harness.deps, prepared.body.shadow_run_id);
        const pendingContract = record(pendingReceipt.pending_strategy_contract);
        expect(rows(pendingContract.locked_source_lineup)).toHaveLength(24);
        expect(rows(pendingContract.locked_source_lineup).every((item) => Boolean(item.assigned_slot_key && item.source_card_id && item.source_card_family_id))).toBe(true);
        expect(pendingContract.source_substitution_allowed).toBe(false);
      }
      if (scenario !== "noop") await completePrepared(harness.deps, prepared.body, `prepare-${scenario}`);
    }
  });

    it("rebuilds an exact interrupted preparation when no durable runtime state exists", async () => {
    const harness = dependencyHarness();
    const first = await prepareRun({
      deps: harness.deps,
      scenario: "normal_24",
      suffix: "incomplete-preparation-replay",
      horizonHours: 48,
    });
    expect(first.status).toBe(200);
    const runId = String(first.body.shadow_run_id);
    await env.DB.prepare(`DELETE FROM manifest_shadow_snapshots WHERE shadow_run_id = ?`).bind(runId).run();
    await env.DB.prepare(
      `UPDATE manifest_shadow_runs
       SET status = 'preparing', snapshot_hash = NULL, completed_at = NULL
       WHERE id = ?`,
    ).bind(runId).run();

    const replay = await prepareRun({
      deps: harness.deps,
      scenario: "normal_24",
      suffix: "incomplete-preparation-replay",
      horizonHours: 48,
    });
    expect(replay.status).toBe(200);
    expect(replay.body.success).toBe(true);
    expect(replay.body.reused).toBe(false);
    expect(replay.body.shadow_run_id).toBe(runId);
    expect(replay.body.decision_bundle_id).toBeTruthy();
    expect(record(replay.body.decision_bundle).locked_source_lineup).toHaveLength(24);
    expect(harness.audit.source_provider_reads).toBe(2);
    expect(harness.audit.evidence_provider_reads).toBe(2);
    const recoveryEvent = await env.DB.prepare(
      `SELECT status, payload_json FROM manifest_shadow_stage_events
       WHERE shadow_run_id = ? AND event_key = 'incomplete_preparation_replayed' LIMIT 1`,
    ).bind(runId).first<JsonRecord>();
    expect(recoveryEvent?.status).toBe("completed");
    expect(parseJsonRecord(recoveryEvent?.payload_json).recovery_action).toBe("rebuild_exact_operation_in_place");
  });

    it("retires an abandoned different-operation preparation but never bypasses durable active state", async () => {
    const harness = dependencyHarness();
    const abandoned = await prepareRun({
      deps: harness.deps,
      scenario: "normal_24",
      suffix: "abandoned-preparation",
      horizonHours: 48,
    });
    expect(abandoned.status).toBe(200);
    const abandonedRunId = String(abandoned.body.shadow_run_id);
    await env.DB.prepare(`DELETE FROM manifest_shadow_snapshots WHERE shadow_run_id = ?`).bind(abandonedRunId).run();
    await env.DB.prepare(
      `UPDATE manifest_shadow_runs SET status = 'preparing', snapshot_hash = NULL, completed_at = NULL WHERE id = ?`,
    ).bind(abandonedRunId).run();

    const replacement = await prepareRun({
      deps: harness.deps,
      scenario: "normal_24",
      suffix: "replacement-after-abandoned",
      horizonHours: 48,
    });
    expect(replacement.status).toBe(200);
    expect(replacement.body.success).toBe(true);
    expect(replacement.body.decision_bundle_id).toBeTruthy();
    const retired = await env.DB.prepare(
      `SELECT status, failure_code FROM manifest_shadow_runs WHERE id = ? LIMIT 1`,
    ).bind(abandonedRunId).first<JsonRecord>();
    expect(retired).toMatchObject({
      status: "failed",
      failure_code: "manifest_shadow_incomplete_preparation_abandoned",
    });

        await expect(prepareRun({
      deps: harness.deps,
      scenario: "normal_24",
      suffix: "must-not-bypass-durable-state",
      horizonHours: 48,
    })).rejects.toThrow("manifest_shadow_run_already_active");
  });

  it("forbids live evidence access before an Innovation run begins", async () => {
    const harness = dependencyHarness();
    const result = await handleOperatorManifestShadowTool({
      toolName: "prepare_manifest_shadow_cycle",
      payload: {
        scenario: "normal_24",
        test_case: "baseline",
        evidence_mode: "live_read",
        variant_key: "forbidden-live",
        operation_id: "innovation-test:forbidden-live",
        horizon_hours: 48,
      },
      identity,
    }, harness.deps);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe("manifest_innovation_live_access_forbidden");
    expect(harness.audit.snapshot_db_calls).toBe(0);
  });

  it("locks one complete strategy and blocks source substitution or conflicting strategy state", async () => {
    const harness = dependencyHarness();
    const prepared = await prepareRun({ deps: harness.deps, suffix: "strategy-lock", missingCount: 2 });
    expect(prepared.status).toBe(200);
    const payload = strategyPayload(prepared.body);
    const first = await handleOperatorManifestShadowTool({ toolName: "commit_manifest_shadow_cycle_strategy", payload, identity }, harness.deps);
    expect(first.status).toBe(200);
    expect(first.body.reused).toBe(false);
    const replay = await handleOperatorManifestShadowTool({ toolName: "commit_manifest_shadow_cycle_strategy", payload, identity }, harness.deps);
    expect(replay.status).toBe(200);
    expect(replay.body.reused).toBe(true);

    const substituted = structuredClone(payload);
    const substitutedLineup = rows(substituted.lineup);
    substitutedLineup[0].source_card_id = "forbidden-substitution";
    const substitutionResult = await handleOperatorManifestShadowTool({
      toolName: "commit_manifest_shadow_cycle_strategy",
      payload: substituted,
      identity,
    }, harness.deps);
    expect(substitutionResult.status).toBe(409);
    expect(substitutionResult.body.error).toBe("manifest_shadow_locked_lineup_mismatch");

    const conflicting = structuredClone(payload);
    conflicting.account_conclusion = { conclusion: "Conflicting replacement strategy." };
    const conflictResult = await handleOperatorManifestShadowTool({
      toolName: "commit_manifest_shadow_cycle_strategy",
      payload: conflicting,
      identity,
    }, harness.deps);
    expect(conflictResult.status).toBe(409);
    expect(conflictResult.body.error).toBe("manifest_shadow_conflicting_strategy_blocked");
    expect(await count("operator_manifest_cycle_strategies")).toBe(1);
    expect(await count("operator_manifest_cycle_plan_items")).toBe(2);
  });

  it("persists complete production-shaped lineage and one batch reconciliation inside SHADOW_DB", async () => {
    const harness = dependencyHarness();
    const prepared = await prepareRun({ deps: harness.deps, suffix: "lineage", missingCount: 2 });
    const receipt = await completePrepared(harness.deps, prepared.body, "lineage");
    const summary = record(receipt.state_summary);
    expect(summary.completed).toBe(true);
    expect(summary.accepted_count).toBe(2);
    for (const table of [
      "scheduled_posts",
      "gpt_generation_runs",
      "gpt_generation_drafts",
      "gpt_post_strategy_tags",
      "operator_manifest_candidate_gate_receipts",
      "operator_manifest_post_hypotheses",
      "operator_manifest_experiment_assignments",
      "operator_manifest_decision_influences",
      "operator_autonomous_lineup_items",
    ]) {
      expect(await count(table), table).toBe(2);
    }
    expect(await count("operator_autonomous_growth_cycles")).toBe(1);
    expect(await count("operator_manifest_evidence_snapshots")).toBe(1);
    expect(await count("operator_manifest_cycle_strategies")).toBe(1);
    expect(await count("operator_manifest_cycle_plan_items")).toBe(2);
    expect(await count("operator_manifest_cycle_receipts")).toBe(1);
    expect(await verifyManifestShadowOrphans(env.DB)).toBe(0);
    const benchmark = benchmarkFrom(receipt);
    expect(Number(benchmark.raw.passed)).toBe(1);
    expect(Number(benchmark.raw.production_noninterference_passed)).toBe(1);
    expect(harness.audit.snapshot_db_calls).toBe(0);
  });

  it("preserves successful siblings, rejects one deterministic hard ban, and replays the exact batch idempotently", async () => {
    const harness = dependencyHarness();
    const prepared = await prepareRun({ deps: harness.deps, suffix: "mixed-gate", missingCount: 2 });
    await commitPrepared(harness.deps, prepared.body);
    const locked = rows(record(prepared.body.decision_bundle).locked_source_lineup);
    const payload = [
      candidateFor(locked[0], 0, "mixed-valid"),
      candidateFor(locked[1], 1, "mixed-banned", "I bet having money would remove every problem."),
    ];
    const first = await persistBatch(harness.deps, prepared.body, "mixed-batch", payload);
    expect(first.status).toBe(200);
    expect(first.body.accepted_count).toBe(1);
    expect(first.body.rejected_count).toBe(1);
    expect(first.body.remaining_missing_count).toBe(1);
    expect(first.body.coverage_reconciled_once).toBe(true);
    const replay = await persistBatch(harness.deps, prepared.body, "mixed-batch", payload);
    expect(replay.status).toBe(200);
    expect(replay.body.reused).toBe(true);
    expect(await count("scheduled_posts")).toBe(1);
  });

  for (const testCase of ["mid_batch_collision", "gate_rejection_regeneration"] as const) {
    it(`survives ${testCase} with selective regeneration and complete final lineage`, async () => {
      const harness = dependencyHarness();
      const prepared = await prepareRun({ deps: harness.deps, suffix: testCase, testCase, missingCount: 2 });
      await commitPrepared(harness.deps, prepared.body);
      const locked = rows(record(prepared.body.decision_bundle).locked_source_lineup);
      const first = await persistBatch(
        harness.deps,
        prepared.body,
        `${testCase}-first`,
        locked.map((item, index) => candidateFor(item, index, `${testCase}-candidate-${index}`)),
      );
      expect(first.status).toBe(200);
      expect(first.body.accepted_count).toBe(1);
      expect(first.body.rejected_count).toBe(1);
      expect(first.body.remaining_missing_count).toBe(1);
      const rejectedSlot = String(rows(first.body.results).find((item) => item.success !== true)?.slot_key ?? "");
      const replacementSource = locked.find((item) => String(item.assigned_slot_key) === rejectedSlot);
      expect(replacementSource).toBeTruthy();
      const replacement = await persistBatch(
        harness.deps,
        prepared.body,
        `${testCase}-replacement`,
        [candidateFor(replacementSource!, 99, `${testCase}-replacement-candidate`)],
      );
      expect(replacement.status).toBe(200);
      expect(replacement.body.accepted_count).toBe(1);
      expect(replacement.body.remaining_missing_count).toBe(0);
      const receipt = await readReceipt(harness.deps, prepared.body.shadow_run_id);
      const benchmark = benchmarkFrom(receipt);
      expect(Number(benchmark.raw.passed)).toBe(1);
      expect(Number(benchmark.counts[testCase === "mid_batch_collision" ? "injected_collisions" : "injected_gate_rejections"])).toBe(1);
      expect(await count("scheduled_posts")).toBe(2);
      expect(await count("operator_manifest_post_hypotheses")).toBe(2);
      expect(await verifyManifestShadowOrphans(env.DB)).toBe(0);
    });
  }

  it("recovers an interrupted response through exact idempotent replay without duplicating side effects", async () => {
    const harness = dependencyHarness();
    const prepared = await prepareRun({ deps: harness.deps, suffix: "interrupted", testCase: "interrupted_replay", missingCount: 2 });
    await commitPrepared(harness.deps, prepared.body);
    const locked = rows(record(prepared.body.decision_bundle).locked_source_lineup);
    const batch = locked.map((item, index) => candidateFor(item, index, `interrupted-candidate-${index}`));
    const first = await persistBatch(harness.deps, prepared.body, "interrupted-batch", batch);
    expect(first.status).toBe(503);
    expect(first.body.side_effect_state).toBe("confirmed");
    expect(await count("scheduled_posts")).toBe(2);
    const replay = await persistBatch(harness.deps, prepared.body, "interrupted-batch", batch);
    expect(replay.status).toBe(200);
    expect(replay.body.reused).toBe(true);
    expect(await count("scheduled_posts")).toBe(2);
    const receipt = await readReceipt(harness.deps, prepared.body.shadow_run_id);
    const benchmark = benchmarkFrom(receipt);
    expect(Number(benchmark.raw.passed)).toBe(1);
    expect(Number(benchmark.raw.retry_count)).toBeGreaterThanOrEqual(1);
    expect(Number(benchmark.counts.injected_interruptions)).toBe(1);
  });

  it("performs exactly one bounded stale-delta refresh inside the frozen provider boundary", async () => {
    const harness = dependencyHarness();
    const prepared = await prepareRun({
      deps: harness.deps,
      scenario: "noop",
      suffix: "stale-delta",
      testCase: "stale_delta_refresh",
      horizonHours: 48,
    });
    expect(prepared.status).toBe(200);
    const receipt = await readReceipt(harness.deps, prepared.body.shadow_run_id);
    const benchmark = benchmarkFrom(receipt);
    expect(Number(benchmark.raw.passed)).toBe(1);
    expect(Number(benchmark.counts.delta_refreshes)).toBe(1);
        expect(Number(benchmark.raw.external_read_count)).toBe(0);
    expect(harness.audit.evidence_provider_reads).toBe(1);
    expect(harness.audit.snapshot_db_calls).toBe(0);
  });

  it("replaces one invalidated planned source authoritatively and completes", async () => {
    const harness = dependencyHarness();
    const prepared = await prepareRun({
      deps: harness.deps,
      suffix: "source-replacement",
      testCase: "invalidated_source_replacement",
      missingCount: 1,
    });
    expect(prepared.status).toBe(200);
    const receipt = await completePrepared(harness.deps, prepared.body, "source-replacement");
    const benchmark = benchmarkFrom(receipt);
    expect(Number(benchmark.raw.passed)).toBe(1);
    expect(Number(benchmark.counts.source_replacements)).toBe(1);
    expect(record(receipt.state_summary).accepted_count).toBe(1);
  });

  it("retains an injected failed run for diagnosis, then expires it without orphans", async () => {
    const harness = dependencyHarness();
    const failed = await prepareRun({
      deps: harness.deps,
      suffix: "retained-failure",
      testCase: "retained_failure_cleanup",
      missingCount: 1,
    });
    expect(failed.status).toBe(409);
    expect(failed.body.expected_failure).toBe(true);
    const runId = String(failed.body.shadow_run_id);
    expect(await count("manifest_shadow_diagnostic_archives")).toBe(1);
    const past = "2026-07-29T00:00:00.000Z";
    await env.DB.prepare(`UPDATE manifest_shadow_runs SET details_expires_at = ? WHERE id = ?`).bind(past, runId).run();
    await env.DB.prepare(`UPDATE manifest_shadow_diagnostic_archives SET expires_at = ? WHERE shadow_run_id = ?`).bind(past, runId).run();
    await env.DB.prepare(`UPDATE manifest_shadow_snapshots SET expires_at = ? WHERE shadow_run_id = ?`).bind(past, runId).run();

    const cleanupTrigger = await prepareRun({
      deps: harness.deps,
      scenario: "noop",
      suffix: "cleanup-trigger",
      testCase: "baseline",
      horizonHours: 48,
    });
    expect(cleanupTrigger.status).toBe(200);
    const oldRun = await env.DB.prepare(`SELECT id FROM manifest_shadow_runs WHERE id = ?`).bind(runId).first();
    const oldDiagnostic = await env.DB.prepare(`SELECT id FROM manifest_shadow_diagnostic_archives WHERE shadow_run_id = ?`).bind(runId).first();
    const oldSnapshot = await env.DB.prepare(`SELECT id FROM manifest_shadow_snapshots WHERE shadow_run_id = ?`).bind(runId).first();
    expect(oldRun).toBeNull();
    expect(oldDiagnostic).toBeNull();
    expect(oldSnapshot).toBeNull();
    expect(await verifyManifestShadowOrphans(env.DB)).toBe(0);
  });

  it("runs same-snapshot A/B variants sequentially with identical frozen snapshot hashes", async () => {
    const firstHarness = dependencyHarness();
    const first = await prepareRun({
      deps: firstHarness.deps,
      suffix: "ab-control",
      testCase: "same_snapshot_ab",
      missingCount: 1,
      variantKey: "control",
    });
    const firstReceipt = await completePrepared(firstHarness.deps, first.body, "ab-control");
    expect(Number(benchmarkFrom(firstReceipt).raw.passed)).toBe(1);

    const secondHarness = dependencyHarness();
    const second = await prepareRun({
      deps: secondHarness.deps,
      suffix: "ab-challenger",
      testCase: "same_snapshot_ab",
      missingCount: 1,
      variantKey: "challenger",
    });
    const secondReceipt = await completePrepared(secondHarness.deps, second.body, "ab-challenger");
    expect(Number(benchmarkFrom(secondReceipt).raw.passed)).toBe(1);
    expect(first.body.snapshot_hash).toBe(second.body.snapshot_hash);
    expect(first.body.decision_bundle_id).not.toBe(second.body.decision_bundle_id);
    expect(firstHarness.audit.snapshot_db_calls).toBe(0);
    expect(secondHarness.audit.snapshot_db_calls).toBe(0);
  });

  it("proves a frozen production-shaped cycle with zero Main, production, or Threads access", async () => {
    const result = await runScenario("normal_24", "zero-main", "frozen_snapshot_zero_main_access");
    const benchmark = benchmarkFrom(result.receipt);
    expect(Number(benchmark.raw.passed)).toBe(1);
    expect(Number(benchmark.raw.external_read_count)).toBe(0);
    expect(Number(benchmark.raw.production_noninterference_passed)).toBe(1);
    expect(Number(benchmark.raw.threads_mutation_count)).toBe(0);
    expect(result.audit.snapshot_db_calls).toBe(0);
  });

  it("returns compact receipts with generated and source text recursively redacted", async () => {
    const harness = dependencyHarness();
    const prepared = await prepareRun({ deps: harness.deps, suffix: "redaction", missingCount: 1 });
    await commitPrepared(harness.deps, prepared.body);
    const locked = rows(record(prepared.body.decision_bundle).locked_source_lineup);
    const secret = "UNIQUE_GENERATED_TEXT_MUST_NEVER_APPEAR_IN_RECEIPT";
    const persisted = await persistBatch(
      harness.deps,
      prepared.body,
      "redaction-batch",
      [candidateFor(locked[0], 0, "redaction-candidate", secret)],
    );
    expect(persisted.status).toBe(200);
    const receipt = await readReceipt(harness.deps, prepared.body.shadow_run_id);
    const serialized = JSON.stringify(receipt);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("\"post_text\"");
    expect(serialized).not.toContain("\"candidate_text\"");
    expect(serialized).not.toContain("\"primary_source\"");
    expect(Number(benchmarkFrom(receipt).raw.passed)).toBe(1);
  });

    it("terminalizes a failed latency benchmark and permits the next isolated run", async () => {
    const clock = new Date("2026-07-30T18:30:00.000Z");
    const harness = dependencyHarness(clock);
        const prepared = await prepareRun({ deps: harness.deps, scenario: "normal_24", suffix: "latency-terminal", horizonHours: 48 });
    expect(prepared.status).toBe(200);
    clock.setTime(clock.getTime() + 7 * 60_000);
    const failedReceipt = await completePrepared(harness.deps, prepared.body, "latency-terminal");
    expect(Number(benchmarkFrom(failedReceipt).raw.passed)).toBe(0);
    expect(record(record(failedReceipt.receipt).run).status).toBe("failed");

    const next = await prepareRun({ deps: harness.deps, suffix: "after-latency-terminal", missingCount: 1, horizonHours: 2 });
    expect(next.status).toBe(200);
    expect(next.body.success).toBe(true);
  });

  it("completes three no-op cycles at or below thirty seconds", async () => {
    for (let index = 0; index < 3; index += 1) {
      const result = await runScenario("noop", `noop-${index}`);
      expect(result.duration).toBeLessThanOrEqual(30_000);
      const summary = record(result.receipt.state_summary);
      expect(summary.completed).toBe(true);
      const benchmark = benchmarkFrom(result.receipt);
      expect(Number(benchmark.raw.passed)).toBe(1);
      expect(Number(benchmark.timings.total_wall_clock_ms)).toBeLessThanOrEqual(30_000);
      expect(result.audit.snapshot_db_calls).toBe(0);
    }
  });

  it("completes three 24-slot cycles at or below six minutes with complete lineage", async () => {
    for (let index = 0; index < 3; index += 1) {
      const result = await runScenario("normal_24", `normal-${index}`);
      expect(result.duration).toBeLessThanOrEqual(360_000);
      const summary = record(result.receipt.state_summary);
      expect(summary.accepted_count).toBe(24);
      expect(summary.remaining_missing_count).toBe(0);
      expect(summary.completed).toBe(true);
      const benchmark = benchmarkFrom(result.receipt);
      expect(Number(benchmark.raw.passed)).toBe(1);
      expect(Number(benchmark.counts.lineage_verified)).toBe(24);
      expect(Number(benchmark.timings.total_wall_clock_ms)).toBeLessThanOrEqual(360_000);
    }
  });

  it("completes three 48-slot recovery cycles below ten minutes with complete lineage", async () => {
    for (let index = 0; index < 3; index += 1) {
      const result = await runScenario("recovery_48", `recovery-${index}`);
      expect(result.duration).toBeLessThan(600_000);
      const summary = record(result.receipt.state_summary);
      expect(summary.accepted_count).toBe(48);
      expect(summary.remaining_missing_count).toBe(0);
      expect(summary.completed).toBe(true);
      const benchmark = benchmarkFrom(result.receipt);
      expect(Number(benchmark.raw.passed)).toBe(1);
      expect(Number(benchmark.counts.lineage_verified)).toBe(48);
      expect(Number(benchmark.timings.total_wall_clock_ms)).toBeLessThan(600_000);
    }
  });

      it("bootstraps the live composition from the immutable genuine bundled seed", async () => {
    const harness = dependencyHarness();
    const result = await prepareRun({
      deps: { ...harness.deps, requireFrozenSeed: true },
      scenario: "normal_24",
      suffix: "bundled-real-seed",
      horizonHours: 48,
    });
    expect(result.status).toBe(200);
    expect(record(result.body.decision_bundle).genuine_source_seed).toBe(true);
    expect(rows(record(result.body.decision_bundle).locked_source_lineup)).toHaveLength(24);
    expect(JSON.stringify(result.body)).not.toContain("Frozen isolated source");
    expect(harness.audit.snapshot_db_calls).toBe(0);
  });

  it("imports genuine source text by value and prepares from Shadow only", async () => {
    const harness = dependencyHarness();
    const deps = { ...harness.deps, requireFrozenSeed: true };
    const seeded = await handleOperatorManifestShadowTool({
      toolName: "seed_manifest_shadow_snapshot",
      payload: {
        source_as_of: "2026-07-30T18:30:00.000Z",
        sources: Array.from({ length: 24 }, (_, index) => ({
          source_identity_key: `real-saved-pattern-${index}`,
          saved_pattern_id: index + 1,
          text: `Universe, bring the person reading this a real financial breakthrough worth celebrating ${index + 1}.`,
          metrics: { likes: 1000 + index },
          source_url: `https://example.test/source/${index + 1}`,
        })),
        evidence: evidence(),
      },
      identity,
    }, deps);
    expect(seeded.status).toBe(200);
    expect(seeded.body.source_count).toBe(24);

    const prepared = await prepareRun({
      deps,
      scenario: "normal_24",
      suffix: "real-seeded-preparation",
      horizonHours: 48,
    });
    expect(prepared.status).toBe(200);
    expect(record(prepared.body.decision_bundle).genuine_source_seed).toBe(true);
    expect(rows(record(prepared.body.decision_bundle).locked_source_lineup)).toHaveLength(24);
    expect(harness.audit.snapshot_db_calls).toBe(0);
  });

  it("rejects synthetic placeholder text and exposes accepted post text through readback", async () => {
    const harness = dependencyHarness();
    const prepared = await prepareRun({ deps: harness.deps, suffix: "genuine-text-gate", missingCount: 1 });
    await commitPrepared(harness.deps, prepared.body);
    const locked = rows(record(prepared.body.decision_bundle).locked_source_lineup);
    const rejected = await persistBatch(
      harness.deps,
      prepared.body,
      "synthetic-placeholder-batch",
      [candidateFor(locked[0], 0, "synthetic-placeholder", "Frozen isolated source 1. Shadow validation candidate 1.")],
    );
    expect(rejected.body.rejected_count).toBe(1);
    expect(rejected.body.remaining_missing_count).toBe(1);

    const accepted = await persistBatch(
      harness.deps,
      prepared.body,
      "genuine-generated-batch",
      [candidateFor(locked[0], 0, "genuine-generated", "Universe, make the person reading this financially free enough to breathe again.")],
    );
    expect(accepted.body.accepted_count).toBe(1);
    const posts = await handleOperatorManifestShadowTool({
      toolName: "get_manifest_shadow_posts",
      payload: { shadow_run_id: prepared.body.shadow_run_id },
      identity,
    }, harness.deps);
    expect(posts.status).toBe(200);
    expect(posts.body.post_count).toBe(1);
    expect(rows(posts.body.posts)[0].text).toBe("Universe, make the person reading this financially free enough to breathe again.");
  });
});

