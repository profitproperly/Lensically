import { describe, expect, it, vi } from "vitest";
import {
  handleOperatorHourlyCoverageService,
  type OperatorCoverageSlot,
  type OperatorHourlyCoverageServiceDependencies,
} from "../src/operatorHourlyCoverageService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function createHarness() {
  const mocks = {
    getCoverage: vi.fn(async () => ({
      success: true,
      current_local_date: "2026-07-27",
      current_local_time: "18:15:00",
    } as JsonRecord)),
    readCycle: vi.fn(async () => null as JsonRecord | null),
    occupiedSlots: vi.fn(async () => new Map<string, JsonRecord>()),
    localDateTimeParts: vi.fn(() => ({ date: "2026-07-27", time: "18:15:00" })),
    reconcileCoverage: vi.fn(() => ({
      remaining_missing_slots: [] as OperatorCoverageSlot[],
      elapsed_unfilled_slots: [] as OperatorCoverageSlot[],
      scheduled_post_ids: [] as unknown[],
    })),
    recordDefect: vi.fn(async () => ({ id: "defect-1" })),
    resolveDefect: vi.fn(async () => ({ id: "defect-1", status: "resolved" })),
    updateCycleCoverage: vi.fn(async () => ({ success: true })),
                readNextPlanItem: vi.fn(async () => null as JsonRecord | null),
    repairMissingPlanItem: vi.fn(async () => null as JsonRecord | null),
    readLockedSourcePlan: vi.fn(async () => [] as JsonRecord[]),
    readPlanItems: vi.fn(async () => [] as JsonRecord[]),

    getCycleReceipt: vi.fn(async () => null as JsonRecord | null),
    finalizeCycleReceipt: vi.fn(async () => ({ completed: true } as JsonRecord)),
    appendCycleEvent: vi.fn(async () => undefined),
    markCycleCompleted: vi.fn(async () => ({ success: true })),
    parseJson: vi.fn((value: string) => JSON.parse(value) as unknown),
    observe: vi.fn(async (_payload: JsonRecord, result: JsonRecord) => ({ observed: true, ...result })),
    now: vi.fn(() => "2026-07-27T22:30:00.000Z"),
  };
  const dependencies: OperatorHourlyCoverageServiceDependencies = {
    defaultTimezone: "America/New_York",
    commitSha: "fbb7c415689d0d2d02cb8eefed75e692282bde18",
    normalizeText,
    getCoverage: mocks.getCoverage,
    readCycle: mocks.readCycle,
    occupiedSlots: mocks.occupiedSlots,
    localDateTimeParts: mocks.localDateTimeParts,
    reconcileCoverage: mocks.reconcileCoverage,
    recordDefect: mocks.recordDefect,
    resolveDefect: mocks.resolveDefect,
    updateCycleCoverage: mocks.updateCycleCoverage,
                readNextPlanItem: mocks.readNextPlanItem,
    repairMissingPlanItem: mocks.repairMissingPlanItem,
    readLockedSourcePlan: mocks.readLockedSourcePlan,
    readPlanItems: mocks.readPlanItems,

    getCycleReceipt: mocks.getCycleReceipt,
    finalizeCycleReceipt: mocks.finalizeCycleReceipt,
    appendCycleEvent: mocks.appendCycleEvent,
    markCycleCompleted: mocks.markCycleCompleted,
    parseJson: mocks.parseJson,
    observe: mocks.observe,
    now: mocks.now,
  };
  return { dependencies, mocks };
}

describe("Operator hourly coverage product service", () => {
  it("preserves generic bounded hourly coverage reads for every brand", async () => {
    const { dependencies, mocks } = createHarness();
    const result = await handleOperatorHourlyCoverageService({
      brandKey: "vectrix",
      payload: {
        timezone: " Europe/London ",
        start_date: " 2026-07-30 ",
        horizon_days: 999,
      },
    }, dependencies);

    expect(mocks.getCoverage).toHaveBeenCalledWith("Europe/London", 60, "2026-07-30");
    expect(mocks.readCycle).not.toHaveBeenCalled();
    expect(result).toMatchObject({ observed: true, success: true });
  });

  it("repairs authoritative Manifest ledger drift and selects the next locked plan item", async () => {
    const { dependencies, mocks } = createHarness();
    const occupiedSlot = { key: "2026-07-27T18:00", date: "2026-07-27", time: "18:00" };
    const nextSlot = { key: "2026-07-27T19:00", date: "2026-07-27", time: "19:00" };
    mocks.readCycle.mockResolvedValueOnce({
      target_slots: [occupiedSlot, nextSlot],
      missing_slots: [occupiedSlot, nextSlot],
      scheduled_post_ids: [101],
    });
    const occupied = new Map<string, JsonRecord>([[occupiedSlot.key, { scheduled_post_id: 101 }]]);
    mocks.occupiedSlots.mockResolvedValueOnce(occupied);
    mocks.reconcileCoverage.mockReturnValueOnce({
      remaining_missing_slots: [nextSlot],
      elapsed_unfilled_slots: [],
      scheduled_post_ids: [101],
    });
        mocks.readNextPlanItem.mockResolvedValueOnce({
      id: "plan-2",
      slot_key: nextSlot.key,
      nearby_avoid_json: "[\"money-question\"]",
      status: "planned",
    });
    mocks.readLockedSourcePlan.mockResolvedValueOnce([
      {
        slot_key: nextSlot.key,
        selection_order: 1,
        source_identity_key: "threads:source-1",
        source_card_family_id: "family-1",
        source_card_id: "card-1",
        status: "locked",
      },
    ]);

    const result = await handleOperatorHourlyCoverageService({

      brandKey: "manifest_mental",
      payload: { cycle_id: "cycle-1", operation_id: "coverage-op-1" },
    }, dependencies);

    expect(mocks.occupiedSlots).toHaveBeenCalledWith([occupiedSlot, nextSlot], "America/New_York");
    expect(mocks.reconcileCoverage).toHaveBeenCalledWith(
      [occupiedSlot, nextSlot],
      occupied,
      "2026-07-27T18:00",
      [101],
    );
    expect(mocks.recordDefect).toHaveBeenCalledWith(expect.objectContaining({
      cycleId: "cycle-1",
      defectKey: "coverage-ledger-drift:cycle-1",
      stageNumber: 6,
      errorCode: "manifest_cycle_missing_slot_ledger_drift",
      blocking: true,
    }));
    expect(mocks.updateCycleCoverage).toHaveBeenCalledWith({
      cycleId: "cycle-1",
      brandKey: "manifest_mental",
      status: "partially_committed",
      missingSlots: [nextSlot],
      scheduledPostIds: [101],
    });
    expect(mocks.resolveDefect).toHaveBeenCalledWith(expect.objectContaining({
      repairCommitSha: "fbb7c415689d0d2d02cb8eefed75e692282bde18",
      deployedSha: "fbb7c415689d0d2d02cb8eefed75e692282bde18",
      verification: expect.objectContaining({
        authoritative_occupied_count: 1,
        authoritative_remaining_missing_count: 1,
        past_slots_backfilled: false,
      }),
    }));
    expect(mocks.readNextPlanItem).toHaveBeenCalledWith("cycle-1", "manifest_mental", nextSlot.key);
    expect(result).toMatchObject({
      observed: true,
      cycle_id: "cycle-1",
      cycle_authoritative_remaining_missing_count: 1,
            coverage_ledger_drift_repaired: true,
      cycle_locked_source_plan_count: 1,
      cycle_locked_source_plan: [{
        slot_key: nextSlot.key,
        source_card_id: "card-1",
        source_card_family_id: "family-1",
      }],
      next_cycle_plan_item: { id: "plan-2", nearby_avoid: ["money-question"] },
    });

        expect(mocks.appendCycleEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventKey: "coverage:coverage-op-1",
      eventType: "coverage_reconciled",
      payload: expect.not.objectContaining({ cycle_locked_source_plan: expect.anything() }),
    }));

  });

    it("repairs a displaced scheduled plan item before returning the next executable slot", async () => {
    const { dependencies, mocks } = createHarness();
    const displacedSlot = { key: "2026-07-30T19:00", date: "2026-07-30", time: "19:00" };
    mocks.readCycle.mockResolvedValueOnce({
      target_slots: [displacedSlot],
      missing_slots: [],
      scheduled_post_ids: [771],
    });
    mocks.reconcileCoverage.mockReturnValueOnce({
      remaining_missing_slots: [displacedSlot],
      elapsed_unfilled_slots: [],
      scheduled_post_ids: [],
    });
    mocks.readNextPlanItem.mockResolvedValueOnce(null);
    mocks.repairMissingPlanItem.mockResolvedValueOnce({
      id: "replacement-plan",
      slot_key: displacedSlot.key,
      nearby_avoid_json: "[]",
      status: "planned",
    });

    const result = await handleOperatorHourlyCoverageService({
      brandKey: "manifest_mental",
      payload: { cycle_id: "cycle-displaced", operation_id: "coverage-displaced" },
    }, dependencies);

    expect(mocks.repairMissingPlanItem).toHaveBeenCalledWith({
      cycleId: "cycle-displaced",
      brandKey: "manifest_mental",
      slotKey: displacedSlot.key,
      operationId: "coverage-displaced",
      asOf: "2026-07-27T22:30:00.000Z",
    });
    expect(result).toMatchObject({
      cycle_displaced_plan_item_repaired: true,
      cycle_scheduled_post_ids: [],
      next_cycle_plan_item: { id: "replacement-plan", status: "planned" },
    });
  });

  it("finalizes complete coverage while ignoring elapsed unfilled slots", async () => {
    const { dependencies, mocks } = createHarness();
    const elapsedSlot = { key: "2026-07-27T17:00", date: "2026-07-27", time: "17:00" };
    const occupiedSlot = { key: "2026-07-27T18:00", date: "2026-07-27", time: "18:00" };
    mocks.readCycle.mockResolvedValueOnce({
      target_slots: [elapsedSlot, occupiedSlot],
      missing_slots: [],
      scheduled_post_ids: [202],
    });
    mocks.occupiedSlots.mockResolvedValueOnce(new Map([[occupiedSlot.key, { scheduled_post_id: 202 }]]));
    mocks.reconcileCoverage.mockReturnValueOnce({
      remaining_missing_slots: [],
      elapsed_unfilled_slots: [elapsedSlot],
      scheduled_post_ids: [202],
    });
    mocks.readPlanItems.mockResolvedValueOnce([
      { slot_key: elapsedSlot.key, status: "planned" },
      { slot_key: occupiedSlot.key, status: "scheduled" },
    ]);
    mocks.getCycleReceipt.mockResolvedValueOnce({
      id: "receipt-1",
      completed_at: null,
      output_strategy_version_id: "strategy-v2",
    });
    mocks.finalizeCycleReceipt.mockResolvedValueOnce({ completed: true, status: "completed" });

    const result = await handleOperatorHourlyCoverageService({
      brandKey: "manifest_mental",
      payload: { cycle_id: "cycle-2", operation_id: "coverage-op-2" },
    }, dependencies);

    expect(mocks.updateCycleCoverage).toHaveBeenCalledWith(expect.objectContaining({
      cycleId: "cycle-2",
      status: "coverage_complete",
      missingSlots: [],
      scheduledPostIds: [202],
    }));
    expect(mocks.finalizeCycleReceipt).toHaveBeenCalledWith(expect.objectContaining({
      cycleId: "cycle-2",
      status: "completed",
      completion: expect.objectContaining({
        completion_trigger: "authoritative_coverage_reconciliation",
        scheduled_post_ids: [202],
        scheduled_count: 1,
        remaining_missing_count: 0,
        elapsed_unfilled_slots_ignored: [elapsedSlot],
        past_slots_backfilled: false,
        authoritative_target_slot_count: 2,
        authoritative_occupied_slot_count: 1,
        output_strategy_version_id: "strategy-v2",
      }),
    }));
    expect(mocks.markCycleCompleted).toHaveBeenCalledWith("cycle-2", "manifest_mental");
    expect(result).toMatchObject({
      observed: true,
      cycle_authoritative_remaining_missing_count: 0,
      cycle_elapsed_unfilled_count: 1,
      cycle_completion: { completed: true, status: "completed" },
    });
  });
});
