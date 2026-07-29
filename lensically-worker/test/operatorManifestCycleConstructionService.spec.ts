import { describe, expect, it, vi } from "vitest";
import {
  constructOperatorManifestAutonomousCycle,
  type OperatorManifestConstructionSlot,
  type OperatorManifestCycleConstructionDependencies,
} from "../src/operatorManifestCycleConstructionService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function createHarness() {
  const slots: OperatorManifestConstructionSlot[] = [
    { key: "2026-07-27T19:00", date: "2026-07-27", time: "19:00" },
    { key: "2026-07-27T20:00", date: "2026-07-27", time: "20:00" },
  ];
  const mocks = {
    refreshTrustedUtcClock: vi.fn(async () => "2026-07-27T18:05:00.000Z"),
    readDatabaseClock: vi.fn(async () => "2026-07-27 18:04:59"),
            resolveClock: vi.fn(() => ({ effective_now_iso: "2026-07-27T18:05:00.000Z", source: "trusted_utc" })),
    parseTimestampMs: vi.fn(() => Date.parse("2026-07-27T18:05:00.000Z")),
    localDateTimeParts: vi.fn(() => ({ date: "2026-07-27", hour: 18 })),
    buildTargetSlots: vi.fn(() => slots),
    buildCoverage: vi.fn(async () => ({
      occupied: new Map<string, JsonRecord>(),
      scheduled_records: [] as JsonRecord[],
    })),
        reconcileDelivery: vi.fn(async () => ({
      repaired: 0,
      unresolved_incidents: [],
      required_recovery_actions: [],
    })),
    ensureRequiredSchemas: vi.fn(async () => undefined),
    readSavedPatternStates: vi.fn(async () => ({
      qualified: { total: 2, latest_updated_at: "2026-07-27T18:00:00Z" },
      derived: { total: 1, latest_source_updated_at: "2026-07-26T18:00:00Z" },
    })),
    refreshSavedPatternIntelligence: vi.fn(async () => ({ recomputed: true })),
    buildDecisionIntelligence: vi.fn(async () => ({
      version: "decision-v1",
      source_fingerprint: "fingerprint-1",
      latest_strategy: { id: "strategy-v1" },
      learning_brief: { brief_key: "brief-v1" },
      benchmark_response: { latest: { snapshot_key: "benchmark-v1" } },
      required_directives: ["preserve winners"],
      strategy_change_warranted: true,
      consumption_contract: { required: true },
    } as JsonRecord)),
        buildAccountPosition: vi.fn(async () => ({ follower_count: 900 } as JsonRecord)),
    compactPersistedValue: vi.fn((value: unknown) => {
      const candidate = value && typeof value === "object" && !Array.isArray(value)
        ? value as JsonRecord
        : {};
      if (typeof candidate.oversized_payload === "string") {
        return { follower_count: candidate.follower_count, compacted: true };
      }
      return candidate;
    }),
    readExistingCycle: vi.fn(async () => null as { id: string } | null),
    writeCycle: vi.fn(async () => undefined),
    readLockedSourceSelectionPlan: vi.fn(async () => [] as JsonRecord[]),
    loadLockedSourceCards: vi.fn(async () => [
      { id: "card-allowed", source_identity_key: "allowed", lifetime_label: "proven" },
      { id: "card-excluded", source_identity_key: "excluded", lifetime_label: "proven" },
      { id: "card-disproven", source_identity_key: "weak", lifetime_label: "disproven" },
    ] as JsonRecord[]),
    loadSourceExclusions: vi.fn(async () => ["excluded"]),
    selectSourceLineup: vi.fn(() => ({ receipts: [{ source_card_id: "card-allowed" }] })),
    persistLockedSourceSelectionPlan: vi.fn(async () => [{ id: "selection-1", source_card_id: "card-allowed" }] as JsonRecord[]),
    buildRollingEvidence: vi.fn(async () => ({
      snapshot: {
        id: "evidence-1",
        page_count: 3,
        recent_exposure: { posts: [{ id: "published-1" }] },
      },
      maturity_refresh: { refreshed: true },
    } as JsonRecord)),
    attachEvidenceSnapshot: vi.fn(async () => undefined),
    ensureIntelligencePolicy: vi.fn(async () => ({ policy: "active" })),
    getLatestStrategyVersion: vi.fn(async () => ({ id: "strategy-v1" } as JsonRecord)),
    createExposureSnapshot: vi.fn(async () => ({
      id: "exposure-1",
      revision: 2,
      refreshed: true,
      ledger_version: "ledger-v1",
      dimensions: { family: true },
    } as JsonRecord)),
    beginCycleReceipt: vi.fn(async () => ({ id: "receipt-1", receipt_version: "receipt-v1", status: "prepared" } as JsonRecord)),
    appendCycleEvent: vi.fn(async () => undefined),
    clearPrepareCheckpoint: vi.fn(async () => undefined),
    readPreparedCycle: vi.fn(async () => ({ id: "cycle-1", status: "prepared" } as JsonRecord)),
  };
  const dependencies: OperatorManifestCycleConstructionDependencies = {
    growthEngineVersion: "growth-v1",
    sourceSelectionEngineVersion: "source-selection-v1",
    savedPatternsAppUserId: "app-user-1",
    sourceMinimumVerifiedLikes: 1000,
    humanFreeAutonomyContract: { active: true },
    followerAttributionPolicy: { account_only: true },
    noninterferencePolicy: { active: true },
    analysisWindowDays: 28,
    recentExposureHours: 72,
            normalizeText,
    refreshTrustedUtcClock: mocks.refreshTrustedUtcClock,
    readDatabaseClock: mocks.readDatabaseClock,
    resolveClock: mocks.resolveClock,
    parseTimestampMs: mocks.parseTimestampMs,
    nowMs: () => Date.parse("2026-07-27T18:05:00.000Z"),
    localDateTimeParts: mocks.localDateTimeParts,
    hourlySlot: (hour) => `${String(hour % 24).padStart(2, "0")}:00`,
    buildTargetSlots: mocks.buildTargetSlots,
    buildCoverage: mocks.buildCoverage,
    reconcileDelivery: mocks.reconcileDelivery,
    ensureRequiredSchemas: mocks.ensureRequiredSchemas,
    readSavedPatternStates: mocks.readSavedPatternStates,
    refreshSavedPatternIntelligence: mocks.refreshSavedPatternIntelligence,
        buildDecisionIntelligence: mocks.buildDecisionIntelligence,
    compactPersistedValue: mocks.compactPersistedValue,
    buildAccountPosition: mocks.buildAccountPosition,
    readExistingCycle: mocks.readExistingCycle,
    createId: () => "cycle-1",
    writeCycle: mocks.writeCycle,
    readLockedSourceSelectionPlan: mocks.readLockedSourceSelectionPlan,
    loadLockedSourceCards: mocks.loadLockedSourceCards,
    loadSourceExclusions: mocks.loadSourceExclusions,
    selectSourceLineup: mocks.selectSourceLineup,
    persistLockedSourceSelectionPlan: mocks.persistLockedSourceSelectionPlan,
    buildRollingEvidence: mocks.buildRollingEvidence,
    attachEvidenceSnapshot: mocks.attachEvidenceSnapshot,
    ensureIntelligencePolicy: mocks.ensureIntelligencePolicy,
    getLatestStrategyVersion: mocks.getLatestStrategyVersion,
    createExposureSnapshot: mocks.createExposureSnapshot,
    beginCycleReceipt: mocks.beginCycleReceipt,
    appendCycleEvent: mocks.appendCycleEvent,
    clearPrepareCheckpoint: mocks.clearPrepareCheckpoint,
    readPreparedCycle: mocks.readPreparedCycle,
  };
  return { dependencies, mocks, slots };
}

const input = {
  brandKey: "manifest_mental",
  accountId: "account-1",
  threadsUserId: "threads-1",
  timezone: "America/New_York",
  horizonHours: 48,
  explicitOperationId: "prepare-op-1",
  phasedPreparation: true,
  runtimeNowIso: "2026-07-27T18:00:00.000Z",
  threadsSnapshot: {
    threads_server_time_iso: "2026-07-27T18:04:58.000Z",
    latest_published_at: "2026-07-27T17:00:00.000Z",
    due_checkpoint_post_count: 4,
    due_checkpoint_count: 8,
    processed_due_checkpoint_count: 8,
    remaining_due_checkpoint_count: 0,
    list_metrics_complete: true,
    max_insight_calls_per_invocation: 12,
        metric_snapshots: [{ id: "metric-1" }],
    performance_evaluation: { evaluator_version: "eval-v1", maturity_scores_upserted: 4, evidence_records: 8 },
    raw_posts: [{ text: "x".repeat(2_000_000) }],
  },
};

describe("Operator Manifest cycle construction service", () => {
  it("constructs a new authoritative cycle and locks only eligible source cards", async () => {
    const { dependencies, mocks, slots } = createHarness();
    const result = await constructOperatorManifestAutonomousCycle(input, dependencies);

    expect(mocks.resolveClock).toHaveBeenCalledWith(
      "2026-07-27T18:00:00.000Z",
      "2026-07-27T18:04:58.000Z",
      "2026-07-27T18:04:59Z",
      "2026-07-27T17:00:00.000Z",
      "2026-07-27T18:05:00.000Z",
    );
        expect(mocks.refreshSavedPatternIntelligence).toHaveBeenCalledWith({
      brand_key: "manifest_mental",
      account_id: "account-1",
      app_user_id: "app-user-1",
    });
        expect(mocks.buildAccountPosition).toHaveBeenCalledWith(expect.objectContaining({
      threadsSnapshot: expect.not.objectContaining({ raw_posts: expect.anything() }),
    }));
    expect(mocks.writeCycle).toHaveBeenCalledWith(expect.objectContaining({
      existing: false,
      cycleId: "cycle-1",
      operationId: "prepare-op-1",
      status: "prepared",
      targetSlots: slots,
      missingSlots: slots,
    }));
    expect(mocks.selectSourceLineup).toHaveBeenCalledWith({
      candidates: [{ id: "card-allowed", source_identity_key: "allowed", lifetime_label: "proven" }],
      slot_keys: slots.map((slot) => slot.key),
      seed: "manifest_mental:cycle-1:prepare-op-1",
    });
    expect(mocks.persistLockedSourceSelectionPlan).toHaveBeenCalledWith({
      brand_key: "manifest_mental",
      cycle_id: "cycle-1",
      receipts: [{ source_card_id: "card-allowed" }],
    });
    expect(mocks.attachEvidenceSnapshot).toHaveBeenCalledWith("cycle-1", "manifest_mental", "evidence-1");
    expect(mocks.beginCycleReceipt).toHaveBeenCalledWith(expect.objectContaining({
      cycleId: "cycle-1",
      operationId: "prepare-op-1",
      startupState: expect.objectContaining({
        evidence_snapshot_id: "evidence-1",
        evidence_page_count: 3,
        maturity_refresh: expect.objectContaining({
          collection_source: "autonomous_prepare",
          evaluator_version: "eval-v1",
          maturity_scores_upserted: 4,
        }),
      }),
      horizonPlan: expect.objectContaining({
        authoritative_missing_slots: slots,
        backend_source_selection_locked: true,
        source_selection_plan_status: "locked",
      }),
    }));
    expect(mocks.appendCycleEvent).toHaveBeenCalledWith(expect.objectContaining({
      cycleId: "cycle-1",
      eventType: "cycle_prepared",
      payload: expect.objectContaining({ receipt_id: "receipt-1" }),
    }));
    expect(mocks.clearPrepareCheckpoint).toHaveBeenCalledWith("manifest_mental", "prepare-op-1");
    expect(result).toMatchObject({
      success: true,
      reused_existing: false,
      strategy_required: true,
      source_selection_plan_status: "locked",
      remaining_missing_count: 2,
      next_missing_slot: slots[0],
      intelligence_foundation: {
        exposure_snapshot: { id: "exposure-1", ledger_version: "ledger-v1" },
        cycle_receipt: { id: "receipt-1", receipt_version: "receipt-v1", status: "prepared" },
      },
      strategy_contract: {
        analysis_window_days: 28,
        primary_performance_metric: "24_hour_likes",
        recent_exposure_window_hours: 72,
      },
      persistence_contract: {
        tool: "persist_manifest_autonomous_post",
        posts_per_call: 1,
      },
    });
  });

  it("refreshes an existing cycle with a compact cycle and decision reference", async () => {
    const { dependencies, mocks } = createHarness();
    mocks.readExistingCycle.mockResolvedValueOnce({ id: "cycle-existing" });
    mocks.readLockedSourceSelectionPlan.mockResolvedValueOnce([
      { id: "selection-existing", source_card_id: "card-existing" },
    ]);
    mocks.readPreparedCycle.mockResolvedValueOnce({
      id: "cycle-existing",
      brand_key: "manifest_mental",
      operation_id: "prepare-op-1",
      engine_version: "growth-v1",
      status: "prepared",
      timezone: "America/New_York",
      horizon_hours: 48,
      horizon_start_local: "2026-07-27T19:00",
      horizon_end_local: "2026-07-27T20:00",
      target_slots: [],
      missing_slots: [],
      scheduled_post_ids: [10],
      error: [],
      updated_at: "2026-07-27T18:05:00Z",
      account_position: { should_not_leak: true },
    });

    const result = await constructOperatorManifestAutonomousCycle(input, dependencies);

    expect(mocks.writeCycle).toHaveBeenCalledWith(expect.objectContaining({
      existing: true,
      cycleId: "cycle-existing",
    }));
    expect(mocks.loadLockedSourceCards).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      reused_existing: true,
      cycle: {
        id: "cycle-existing",
        scheduled_post_ids: [10],
      },
      decision_intelligence: {
        version: "decision-v1",
        source_fingerprint: "fingerprint-1",
        latest_strategy_version_id: "strategy-v1",
        learning_brief_key: "brief-v1",
        benchmark_snapshot_key: "benchmark-v1",
      },
      reconciliation_contract: {
        authoritative_clock_source: "trusted_utc",
        past_slots_ignored: true,
        stale_operation_refresh: true,
        coverage_reconciled: true,
      },
    });
    expect((result.cycle as JsonRecord).account_position).toBeUndefined();
  });

    it("completes a fully occupied horizon without source-plan work", async () => {
    const { dependencies, mocks, slots } = createHarness();
    mocks.buildCoverage.mockResolvedValueOnce({
      occupied: new Map(slots.map((slot, index) => [slot.key, { scheduled_post_id: index + 1 }])),
      scheduled_records: [{ id: 1 }, { id: 2 }],
    });
    mocks.readSavedPatternStates.mockResolvedValueOnce({
      qualified: { total: 2, latest_updated_at: "2026-07-27T18:00:00Z" },
      derived: { total: 2, latest_source_updated_at: "2026-07-27T18:00:00Z" },
    });

    const result = await constructOperatorManifestAutonomousCycle(input, dependencies);

    expect(mocks.writeCycle).toHaveBeenCalledWith(expect.objectContaining({
      status: "completed",
      missingSlots: [],
    }));
    expect(mocks.refreshSavedPatternIntelligence).not.toHaveBeenCalled();
    expect(mocks.loadLockedSourceCards).not.toHaveBeenCalled();
    expect(mocks.selectSourceLineup).not.toHaveBeenCalled();
    expect(mocks.beginCycleReceipt).toHaveBeenCalledWith(expect.objectContaining({
      horizonPlan: expect.objectContaining({
        authoritative_missing_slots: [],
        occupied_slots: expect.arrayContaining([
          expect.objectContaining({ key: slots[0].key, evidence: { scheduled_post_id: 1 } }),
          expect.objectContaining({ key: slots[1].key, evidence: { scheduled_post_id: 2 } }),
        ]),
        source_selection_plan_status: "not_required",
      }),
    }));
    expect(result).toMatchObject({
      success: true,
      strategy_required: false,
      source_selection_plan_status: "not_required",
      remaining_missing_count: 0,
      next_missing_slot: null,
      measurement_audit_refresh: {
        mode: "latest_persisted_measurement_state",
        recomputed: false,
      },
    });
    expect(String(result.next_action)).toContain("prepared horizon is covered");
  });

  it("bounds oversized cycle construction state before D1 persistence", async () => {
    const { dependencies, mocks, slots } = createHarness();
    mocks.buildAccountPosition.mockResolvedValueOnce({
      follower_count: 900,
      oversized_payload: "x".repeat(2_000_000),
    });
    mocks.persistLockedSourceSelectionPlan.mockResolvedValueOnce(slots.map((slot, index) => ({
      slot_key: slot.key,
      selection_order: index + 1,
      source_identity_key: `source-${index}`,
      source_card_family_id: `family-${index}`,
      source_card_id: `card-${index}`,
      engine_version: "source-selection-v1",
      status: "locked",
      receipt: {
        policy_version: "policy-v1",
        lifetime_label: "proven",
        recent_label: "healthy",
        score: 2.5,
        oversized_payload: "y".repeat(1_000_000),
      },
    })));

    await constructOperatorManifestAutonomousCycle(input, dependencies);

    expect(mocks.compactPersistedValue).toHaveBeenCalledWith(
      expect.objectContaining({ oversized_payload: expect.any(String) }),
      "manifest_cycle.account_position",
    );
    expect(mocks.writeCycle).toHaveBeenCalledWith(expect.objectContaining({
      accountPosition: { follower_count: 900, compacted: true },
    }));
    const receiptInput = mocks.beginCycleReceipt.mock.calls[0][0] as JsonRecord;
    const horizonPlan = receiptInput.horizonPlan as JsonRecord;
    const persistedPlan = horizonPlan.locked_source_selection_plan as JsonRecord[];
    expect(persistedPlan).toHaveLength(slots.length);
    expect(JSON.stringify(persistedPlan)).not.toContain("oversized_payload");
    expect(persistedPlan[0]).toMatchObject({
      slot_key: slots[0].key,
      source_card_id: "card-0",
      selection_evidence: {
        policy_version: "policy-v1",
        lifetime_label: "proven",
        recent_label: "healthy",
        score: 2.5,
      },
    });
  });
});
