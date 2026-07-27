import { describe, expect, it, vi } from "vitest";
import {
  admitOperatorManifestPersistence,
  type OperatorManifestPersistenceAdmissionDependencies,
  type OperatorManifestPersistenceSlot,
} from "../src/operatorManifestPersistenceAdmissionService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function createHarness() {
  const slots: OperatorManifestPersistenceSlot[] = [
    { key: "2026-07-27T19:00", date: "2026-07-27", time: "19:00" },
    { key: "2026-07-27T20:00", date: "2026-07-27", time: "20:00" },
  ];
  const cycle: JsonRecord = {
    id: "cycle-1",
    timezone: "America/New_York",
    target_slots: slots,
    strategy_version_id: "input-strategy-1",
    account_position: { clock: { effective_now_iso: "2026-07-27T18:00:00.000Z" } },
  };
  const planItem: JsonRecord = {
    id: "plan-1",
    strategy_id: "strategy-1",
    source_card_id: "card-1",
    family_key: "franchise",
    generation_mode: "franchise_deployment",
  };
  const mocks = {
    getAutonomyProfile: vi.fn(async () => ({ mode: "autonomous_operator" } as JsonRecord)),
    readCycle: vi.fn(async () => cycle),
    appendCycleEvent: vi.fn(async () => undefined),
    getCycleStrategy: vi.fn(async () => ({ id: "strategy-1", directives: ["preserve"] } as JsonRecord)),
    getEvidenceConsumption: vi.fn(async () => ({ complete: true, consumed: 3 } as JsonRecord)),
    getCyclePlanItem: vi.fn(async () => planItem),
    recordHypothesis: vi.fn(async () => ({ id: "hypothesis-1" } as JsonRecord)),
    buildCoverage: vi.fn(async () => ({ occupied: new Map<string, JsonRecord>() })),
    updateCycleCoverage: vi.fn(async () => undefined),
    readExistingLineup: vi.fn(async () => null as JsonRecord | null),
    readScheduledPost: vi.fn(async () => null as JsonRecord | null),
    markLineupStale: vi.fn(async () => undefined),
    getPublishLineage: vi.fn(async () => ({ complete: false } as JsonRecord)),
    readPersistEvent: vi.fn(async () => null as JsonRecord | null),
    linkHypothesisResult: vi.fn(async () => undefined),
    upsertSemanticSignature: vi.fn(async () => undefined),
    registerExperimentAssignment: vi.fn(async () => ({ id: "experiment-assignment-1" } as JsonRecord)),
    recordDecisionInfluence: vi.fn(async () => ({ id: "decision-influence-1" } as JsonRecord)),
  };
  const dependencies: OperatorManifestPersistenceAdmissionDependencies = {
    autonomyMode: "autonomous_operator",
    workspaceDefaultTimezone: "America/New_York",
    allowedGenerationModes: [
      "franchise_deployment",
      "controlled_variation",
      "mechanism_expansion",
      "adjacent_experiment",
    ],
    getAutonomyProfile: mocks.getAutonomyProfile,
    normalizeText,
    normalizeMachineKey: (value, fallback) => typeof value === "string" && value.trim() ? value.trim() : fallback,
    readCycle: mocks.readCycle,
    appendCycleEvent: mocks.appendCycleEvent,
    getCycleStrategy: mocks.getCycleStrategy,
    getEvidenceConsumption: mocks.getEvidenceConsumption,
    validateHypothesis: () => ({
      ok: true,
      value: {
        expected_audience_reward: "hope",
        expected_response_type: "likes",
        experiment: { experiment_key: "experiment-1" },
      },
    }),
    normalizeSourceContext: () => ({
      ok: true,
      value: {
        kind: "source_card",
        source_card_id: "card-1",
        source_selection_id: "selection-1",
      },
    }),
    validateFollowerBoundary: () => ({ ok: true }),
    getCyclePlanItem: mocks.getCyclePlanItem,
    recordHypothesis: mocks.recordHypothesis,
    parseTimestampMs: (value) => {
      const parsed = Date.parse(String(value ?? ""));
      return Number.isFinite(parsed) ? parsed : null;
    },
    nowMs: () => Date.parse("2026-07-27T18:05:00.000Z"),
    buildCoverage: mocks.buildCoverage,
    convertLocalDateTimeToUtcIso: (date, time) => `${date}T${time}:00.000Z`,
    updateCycleCoverage: mocks.updateCycleCoverage,
    readExistingLineup: mocks.readExistingLineup,
    readScheduledPost: mocks.readScheduledPost,
    markLineupStale: mocks.markLineupStale,
    getPublishLineage: mocks.getPublishLineage,
    readPersistEvent: mocks.readPersistEvent,
    parseJson: JSON.parse,
    linkHypothesisResult: mocks.linkHypothesisResult,
    upsertSemanticSignature: mocks.upsertSemanticSignature,
    registerExperimentAssignment: mocks.registerExperimentAssignment,
    recordDecisionInfluence: mocks.recordDecisionInfluence,
  };
  const payload: JsonRecord = {
    operation_id: "persist-1",
    cycle_id: "cycle-1",
    cycle_strategy_id: "strategy-1",
    cycle_plan_item_id: "plan-1",
    post: {
      date: "2026-07-27",
      time: "19:00",
      text: "Universe, let this be the sign you needed.",
      generation_mode: "franchise_deployment",
      family_key: "franchise",
      source_mechanism: "universe invocation",
      audience_reward: "hope",
      strategic_purpose: "deploy a proven franchise",
      hypothesis: { expected_response_type: "likes" },
      source_context: { kind: "source_card", source_card_id: "card-1" },
      strategy: { pillar: "manifestation" },
    },
    model_evaluation: {
      generation_passed: true,
      scheduling_passed: true,
      novelty_assessment: "Distinct from nearby execution.",
      winner_preservation_assessment: "Preserves the proven hook.",
      slot_placement_assessment: "Fits the first open evening slot.",
      recent_exposure_assessment: "No clustered equivalent is scheduled.",
      intelligence_application_assessment: "Current evidence supports preserving the strategy.",
      candidate_trace: [{ candidate: "selected" }],
    },
  };
  return { slots, cycle, planItem, mocks, dependencies, payload };
}

describe("operatorManifestPersistenceAdmissionService", () => {
  it("rejects candidates that do not match the locked cycle plan", async () => {
    const harness = createHarness();
    harness.mocks.getCyclePlanItem.mockResolvedValue({
      ...harness.planItem,
      source_card_id: "card-other",
    });

    const result = await admitOperatorManifestPersistence({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      payload: harness.payload,
    }, harness.dependencies);

    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error("expected handled rejection");
    expect(result.response.error).toBe("candidate_does_not_match_locked_cycle_plan");
    expect(harness.mocks.appendCycleEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "candidate_rejected",
      slotKey: "2026-07-27T19:00",
    }));
  });

  it("returns a typed continuation only after every admission check passes", async () => {
    const harness = createHarness();

    const result = await admitOperatorManifestPersistence({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      payload: harness.payload,
    }, harness.dependencies);

    expect(result.handled).toBe(false);
    if (result.handled) throw new Error("expected persistence continuation");
    expect(result.context.slotKey).toBe("2026-07-27T19:00");
    expect(result.context.scheduledUtc).toBe("2026-07-27T19:00:00.000Z");
    expect(result.context.postHypothesis.id).toBe("hypothesis-1");
    expect(harness.mocks.recordHypothesis).toHaveBeenCalledTimes(1);
    expect(harness.mocks.appendCycleEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "candidate_evaluated",
    }));
  });

  it("reconciles an elapsed slot without treating it as a fatal persistence failure", async () => {
    const harness = createHarness();
    harness.dependencies.nowMs = () => Date.parse("2026-07-27T19:30:00.000Z");

    const result = await admitOperatorManifestPersistence({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      payload: harness.payload,
    }, harness.dependencies);

    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error("expected elapsed-slot response");
    expect(result.response).toMatchObject({
      success: true,
      persisted: false,
      outcome: "slot_elapsed",
      candidate_requires_reslot: true,
      next_missing_slot: harness.slots[1],
    });
    expect(harness.mocks.updateCycleCoverage).toHaveBeenCalledWith(expect.objectContaining({
      status: "partially_committed",
      missingSlots: [harness.slots[1]],
    }));
  });

  it("replays an exact prior persistence receipt without duplicating lineage mutations", async () => {
    const harness = createHarness();
    harness.mocks.readExistingLineup.mockResolvedValue({
      status: "scheduled",
      scheduled_post_id: 91,
      source_card_id: "card-1",
      source_selection_id: "selection-1",
      generation_run_id: "run-1",
      draft_id: "draft-1",
    });
    harness.mocks.readScheduledPost.mockResolvedValue({ id: 91, scheduled_time: "2026-07-27T23:00:00.000Z" });
    harness.mocks.getPublishLineage.mockResolvedValue({ complete: true, lineage: { source_card_id: "card-1" } });
    harness.mocks.readPersistEvent.mockResolvedValue({
      event_type: "post_persisted",
      payload_json: JSON.stringify({
        scheduled_post_id: 91,
        hypothesis_id: "hypothesis-prior",
        strategy_version_id: "strategy-1",
      }),
    });

    const result = await admitOperatorManifestPersistence({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      payload: harness.payload,
    }, harness.dependencies);

    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error("expected replay response");
    expect(result.response).toMatchObject({
      success: true,
      reused: true,
      replayed_persist_event: true,
      scheduled_post_id: 91,
      hypothesis_id: "hypothesis-prior",
    });
    expect(harness.mocks.linkHypothesisResult).not.toHaveBeenCalled();
    expect(harness.mocks.registerExperimentAssignment).not.toHaveBeenCalled();
  });

  it("repairs and receipts an existing complete scheduled lineage", async () => {
    const harness = createHarness();
    harness.mocks.readExistingLineup.mockResolvedValue({
      status: "scheduled",
      scheduled_post_id: 92,
      source_card_id: "card-1",
      source_selection_id: "selection-1",
      generation_run_id: "run-1",
      draft_id: "draft-1",
    });
    harness.mocks.readScheduledPost.mockResolvedValue({ id: 92, scheduled_time: "2026-07-27T23:00:00.000Z" });
    harness.mocks.getPublishLineage.mockResolvedValue({ complete: true, lineage: { source_card_id: "card-1" } });

    const result = await admitOperatorManifestPersistence({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      payload: harness.payload,
    }, harness.dependencies);

    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error("expected reuse response");
    expect(result.response).toMatchObject({
      success: true,
      reused: true,
      scheduled_post_id: 92,
      experiment_assignment: { id: "experiment-assignment-1" },
      decision_influence: { id: "decision-influence-1" },
    });
    expect(harness.mocks.linkHypothesisResult).toHaveBeenCalledWith(expect.objectContaining({
      scheduledPostId: 92,
      status: "reused",
    }));
    expect(harness.mocks.upsertSemanticSignature).toHaveBeenCalledTimes(1);
    expect(harness.mocks.appendCycleEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "post_reused",
      eventKey: "persist:persist-1",
    }));
  });
});
