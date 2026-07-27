import { describe, expect, it, vi } from "vitest";
import type { OperatorManifestPersistenceAdmissionContext } from "../src/operatorManifestPersistenceAdmissionService";
import {
  persistOperatorManifestCandidate,
  type OperatorManifestPersistenceDependencies,
} from "../src/operatorManifestPersistenceService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function createHarness() {
  const slots = [
    { key: "2026-07-27T19:00", date: "2026-07-27", time: "19:00" },
    { key: "2026-07-27T20:00", date: "2026-07-27", time: "20:00" },
  ];
  const rejectPersist = vi.fn(async (error: string, details: JsonRecord = {}) => ({
    success: false,
    error,
    ...details,
  }));
  const reconcileNonfatalSlot = vi.fn(async (outcome: string, evidence: JsonRecord | null) => ({
    success: true,
    persisted: false,
    outcome,
    occupied_evidence: evidence,
  }));
  const context: OperatorManifestPersistenceAdmissionContext = {
    cycle: {
      id: "cycle-1",
      strategy_version_id: "input-strategy-1",
      target_slots: slots,
      scheduled_post_ids: [],
    },
    operationId: "persist-1",
    cycleId: "cycle-1",
    requestedCycleStrategyId: "strategy-1",
    requestedCyclePlanItemId: "plan-1",
    post: {
      score: { quality: 1 },
      preserved_functions: ["preserve hook"],
      transformed_elements: ["slight wording"],
      intentionally_different_from_prior: "Different closing wording.",
    },
    postStrategy: {
      pillar: "manifestation",
      hook_style: "universe",
      format: "short",
    },
    modelEvaluation: {
      gate_summary: {
        results: [{
          rule_key: "no-profanity",
          executed: true,
          status: "pass",
          evidence: "Candidate contains no profanity.",
        }],
      },
    },
    hypothesis: {
      expected_response_type: "likes",
      expected_audience_reward: "hope",
      hook_rationale: "Proven invocation hook.",
      premise_rationale: "Source-backed reassurance.",
      exploration_mode: "exploit",
      expected_performance_range: { likes: [100, 500] },
      uncertainty: "Audience timing may vary.",
      experiment: { experiment_key: "experiment-1" },
    },
    sourceContext: {
      kind: "source_card",
      source_card_id: "card-1",
      source_selection_id: "selection-1",
    },
    candidateTrace: [{ candidate: "selected" }],
    noveltyAssessment: "Distinct nearby execution.",
    winnerPreservationAssessment: "Preserves winner structure.",
    slotPlacementAssessment: "Fits the first evening slot.",
    recentExposureAssessment: "No clustered equivalent.",
    intelligenceApplicationAssessment: "Evidence supports preservation.",
    effectiveStrategicThesis: { directives: ["preserve winners"] },
    cycleStrategicThesisReused: true,
    outputStrategyVersion: { id: "strategy-1" },
    date: "2026-07-27",
    time: "19:00",
    text: "Universe, let this be the sign you needed.",
    generationMode: "franchise_deployment",
    familyKey: "franchise",
    sourceMechanism: "universe invocation",
    audienceReward: "hope",
    strategicPurpose: "deploy a proven franchise",
    slotKey: "2026-07-27T19:00",
    targetSlots: slots,
    cyclePlanItem: { id: "plan-1" },
    postHypothesis: { id: "hypothesis-admitted" },
    timezone: "America/New_York",
    reconciliationNowMs: Date.parse("2026-07-27T18:05:00.000Z"),
    existingLineup: null,
    existingScheduledPostId: null,
    scheduledUtc: "2026-07-27T19:00:00.000Z",
    rejectPersist,
    reconcileNonfatalSlot,
  };
  const completeLineage: JsonRecord = {
    source_selection_id: "selection-1",
    source_batch_id: "batch-1",
    source_card_id: "card-1",
    generation_run_id: "run-1",
    draft_id: "draft-1",
    cycle_strategy_id: "strategy-1",
    stored_cycle_strategy_id: "strategy-1",
    lineup_source_selection_id: "selection-1",
    cycle_plan_item_id: "plan-1",
    stored_plan_item_id: "plan-1",
    plan_status: "scheduled",
    gate_receipt_id: "gate-1",
    stored_gate_receipt_id: "gate-1",
    gate_passed: 1,
    hypothesis_id: "hypothesis-locked",
    stored_hypothesis_id: "hypothesis-locked",
    hypothesis_scheduled_post_id: 91,
    hypothesis_status: "scheduled",
    hypothesis_locked_at: "2026-07-27T18:10:00Z",
  };
  const mocks = {
    ensureScheduledPosts: vi.fn(async () => undefined),
    buildScheduleIdempotencyKey: vi.fn(async () => "schedule-key-1"),
    readExactScheduledByKey: vi.fn(async () => null),
    readScheduledById: vi.fn(async () => null),
    buildCoverage: vi.fn(async () => ({ occupied: new Map<string, JsonRecord>() })),
    findExactDuplicate: vi.fn(async () => null as JsonRecord | null),
    analyzeRepetition: vi.fn(async () => ({
      semantic_repetition_blocked: false,
      highest_score: 0.2,
      signature: { opening: "universe" },
    } as JsonRecord)),
    ensureSourceCard: vi.fn(async () => ({
      id: "card-1",
      family_id: "family-1",
      source_selection_id: "selection-1",
      status: "locked",
      version_number: 1,
    } as JsonRecord)),
    linkHypothesisResult: vi.fn(async () => undefined),
    listHardBans: vi.fn(async () => [{
      rule_key: "no-profanity",
      source_authority: "owner",
    }] as JsonRecord[]),
    runGateSuite: vi.fn(async () => ({
      showable: true,
      gate_results: [{ gate_key: "source_fidelity", status: "pass" }],
      blocking_failures: [],
      warnings: [],
    })),
    recordGateReceipt: vi.fn(async () => ({
      id: "gate-1",
      receipt_version: "gate-v1",
      passed: true,
      results: [],
    } as JsonRecord)),
    recordHypothesis: vi.fn(async () => ({ id: "hypothesis-locked" } as JsonRecord)),
    createScheduledPost: vi.fn(async () => ({
      success: true,
      scheduledPostId: 91,
      scheduledTimeUtc: "2026-07-27T19:00:00.000Z",
      reused: false,
    })),
    ensurePersistenceSchemas: vi.fn(async () => undefined),
    persistLineageRecords: vi.fn(async () => undefined),
    upsertSemanticSignature: vi.fn(async () => undefined),
    readLineageStatus: vi.fn(async () => completeLineage),
    markLineageFailure: vi.fn(async () => undefined),
    registerExperimentAssignment: vi.fn(async () => ({ id: "assignment-1" } as JsonRecord)),
    recordDecisionInfluence: vi.fn(async () => ({ id: "influence-1" } as JsonRecord)),
    appendCycleEvent: vi.fn(async () => undefined),
    readCurrentCycle: vi.fn(async () => ({
      id: "cycle-1",
      timezone: "America/New_York",
      target_slots: slots,
      scheduled_post_ids: [],
    } as JsonRecord)),
    occupiedSlots: vi.fn(async () => new Map<string, JsonRecord>([
      [slots[0].key, { scheduled_post_id: 91 }],
    ])),
    reconcileCoverageState: vi.fn(() => ({
      remaining_missing_slots: [slots[1]],
      elapsed_unfilled_slots: [],
      scheduled_post_ids: [91],
    })),
    updateCycleAfterPersist: vi.fn(async () => undefined),
    finalizeCycleReceipt: vi.fn(async () => ({ completed: true } as JsonRecord)),
    setCycleStatus: vi.fn(async () => undefined),
  };
  const dependencies: OperatorManifestPersistenceDependencies = {
    growthEngineVersion: "growth-v1",
    normalizeText,
    normalizeMachineKey: (value, fallback) => typeof value === "string" && value.trim() ? value.trim() : fallback,
    normalizeJson: JSON.stringify,
    ensureScheduledPosts: mocks.ensureScheduledPosts,
    buildScheduleIdempotencyKey: mocks.buildScheduleIdempotencyKey,
    readExactScheduledByKey: mocks.readExactScheduledByKey,
    readScheduledById: mocks.readScheduledById,
    buildCoverage: mocks.buildCoverage,
    findExactDuplicate: mocks.findExactDuplicate,
    analyzeRepetition: mocks.analyzeRepetition,
    ensureSourceCard: mocks.ensureSourceCard,
    linkHypothesisResult: mocks.linkHypothesisResult,
    extractOpeningPhrase: (text) => text.split(/[,.!?]/)[0]?.trim() ?? "",
    listHardBans: mocks.listHardBans,
    runGateSuite: mocks.runGateSuite,
    recordGateReceipt: mocks.recordGateReceipt,
    recordHypothesis: mocks.recordHypothesis,
    sha256: async () => "a".repeat(64),
    createScheduledPost: mocks.createScheduledPost,
    ensurePersistenceSchemas: mocks.ensurePersistenceSchemas,
    normalizeStrategy: (value) => value,
    inferRealmEntranceKey: () => "universe",
    persistLineageRecords: mocks.persistLineageRecords,
    upsertSemanticSignature: mocks.upsertSemanticSignature,
    readLineageStatus: mocks.readLineageStatus,
    markLineageFailure: mocks.markLineageFailure,
    registerExperimentAssignment: mocks.registerExperimentAssignment,
    recordDecisionInfluence: mocks.recordDecisionInfluence,
    appendCycleEvent: mocks.appendCycleEvent,
    readCurrentCycle: mocks.readCurrentCycle,
    occupiedSlots: mocks.occupiedSlots,
    localDateTimeParts: () => ({ date: "2026-07-27", hour: 18 }),
    hourlySlot: (hour) => `${String(hour).padStart(2, "0")}:00`,
    reconcileCoverageState: mocks.reconcileCoverageState,
    updateCycleAfterPersist: mocks.updateCycleAfterPersist,
    finalizeCycleReceipt: mocks.finalizeCycleReceipt,
    setCycleStatus: mocks.setCycleStatus,
    now: () => new Date("2026-07-27T18:10:00.000Z"),
  };
  return { slots, context, completeLineage, rejectPersist, reconcileNonfatalSlot, mocks, dependencies };
}

describe("operatorManifestPersistenceService", () => {
  it("blocks exact duplicate text before source and gate execution", async () => {
    const harness = createHarness();
    harness.mocks.findExactDuplicate.mockResolvedValue({ id: 44, status: "approved" });

    const result = await persistOperatorManifestCandidate({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      context: harness.context,
    }, harness.dependencies);

    expect(result).toMatchObject({
      success: false,
      error: "exact_duplicate_post",
      duplicate_scheduled_post_id: 44,
    });
    expect(harness.mocks.ensureSourceCard).not.toHaveBeenCalled();
    expect(harness.mocks.runGateSuite).not.toHaveBeenCalled();
  });

  it("requires explicit evidence for every canonical owner hard ban", async () => {
    const harness = createHarness();
    harness.context.modelEvaluation = { gate_summary: { results: [] } };

    const result = await persistOperatorManifestCandidate({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      context: harness.context,
    }, harness.dependencies);

    expect(result).toMatchObject({
      success: false,
      error: "canonical_hard_ban_evaluation_incomplete",
      missing_rule_keys: ["no-profanity"],
    });
    expect(harness.mocks.runGateSuite).not.toHaveBeenCalled();
    expect(harness.mocks.createScheduledPost).not.toHaveBeenCalled();
  });

  it("blocks publication and records exact missing lineage stages", async () => {
    const harness = createHarness();
    harness.mocks.readLineageStatus.mockResolvedValue({
      source_selection_id: "selection-1",
      source_batch_id: "batch-1",
      source_card_id: "card-1",
      generation_run_id: "run-1",
      cycle_strategy_id: "strategy-1",
      stored_cycle_strategy_id: "strategy-1",
      lineup_source_selection_id: "selection-1",
      cycle_plan_item_id: "plan-1",
      stored_plan_item_id: "plan-1",
      plan_status: "scheduled",
      gate_receipt_id: "gate-1",
      stored_gate_receipt_id: "gate-1",
      gate_passed: 1,
      hypothesis_id: "hypothesis-locked",
      stored_hypothesis_id: "hypothesis-locked",
      hypothesis_scheduled_post_id: 91,
      hypothesis_status: "scheduled",
      hypothesis_locked_at: "2026-07-27T18:10:00Z",
    });

    const result = await persistOperatorManifestCandidate({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      context: harness.context,
    }, harness.dependencies);

    expect(result).toMatchObject({
      success: false,
      error: "autonomous_lineage_incomplete_after_persist",
      scheduled_post_id: 91,
      missing_stages: ["draft"],
    });
    expect(harness.mocks.markLineageFailure).toHaveBeenCalledWith(expect.objectContaining({
      errorMessage: "manifest_lineage_incomplete:draft",
    }));
    expect(harness.mocks.appendCycleEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "lineage_failed",
    }));
  });

  it("persists complete lineage and leaves the next authoritative slot open", async () => {
    const harness = createHarness();

    const result = await persistOperatorManifestCandidate({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      context: harness.context,
    }, harness.dependencies);

    expect(result).toMatchObject({
      success: true,
      reused: false,
      scheduled_post_id: 91,
      publish_lineage_complete: true,
      intelligence_lineage_complete: true,
      remaining_missing_count: 1,
      experiment_assignment: { id: "assignment-1" },
      decision_influence: { id: "influence-1" },
    });
    expect(harness.mocks.persistLineageRecords).toHaveBeenCalledWith(expect.objectContaining({
      runId: `autonomous-run-${"a".repeat(32)}`,
      draftId: `autonomous-draft-${"a".repeat(32)}`,
      inventoryId: `autonomous-inventory-${"a".repeat(32)}`,
      scheduledPostId: 91,
    }));
    expect(harness.mocks.updateCycleAfterPersist).toHaveBeenCalledWith(expect.objectContaining({
      status: "partially_committed",
      remainingMissing: [harness.slots[1]],
    }));
    expect(harness.mocks.finalizeCycleReceipt).not.toHaveBeenCalled();
  });

  it("finalizes the cycle when authoritative coverage is complete", async () => {
    const harness = createHarness();
    harness.mocks.occupiedSlots.mockResolvedValue(new Map<string, JsonRecord>([
      [harness.slots[0].key, { scheduled_post_id: 91 }],
      [harness.slots[1].key, { scheduled_post_id: 92 }],
    ]));
    harness.mocks.reconcileCoverageState.mockReturnValue({
      remaining_missing_slots: [],
      elapsed_unfilled_slots: [],
      scheduled_post_ids: [91, 92],
    });
    harness.mocks.finalizeCycleReceipt.mockResolvedValue({
      completed: true,
      receipt_id: "receipt-1",
    });

    const result = await persistOperatorManifestCandidate({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      context: harness.context,
    }, harness.dependencies);

    expect(result).toMatchObject({
      success: true,
      remaining_missing_count: 0,
      cycle_completion: { completed: true, receipt_id: "receipt-1" },
    });
    expect(harness.mocks.finalizeCycleReceipt).toHaveBeenCalledWith(expect.objectContaining({
      cycleId: "cycle-1",
      status: "completed",
      completion: expect.objectContaining({
        completion_trigger: "final_post_persisted",
        remaining_missing_count: 0,
        authoritative_occupied_slot_count: 2,
      }),
    }));
    expect(harness.mocks.setCycleStatus).toHaveBeenCalledWith(
      "cycle-1",
      "manifest_mental",
      "completed",
    );
    expect(harness.mocks.appendCycleEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "cycle_completed",
      eventKey: "cycle-completed",
    }));
  });
});
