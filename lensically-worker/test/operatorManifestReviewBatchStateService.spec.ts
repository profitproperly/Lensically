import { describe, expect, it, vi } from "vitest";
import {
  claimOperatorManifestReviewBatch,
  readOperatorManifestReviewBatchState,
  type OperatorManifestReviewBatchClaimDependencies,
  type OperatorManifestReviewBatchStateDependencies,
} from "../src/operatorManifestReviewBatchStateService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function createHarness() {
  const mocks = {
    ensureWorkflowTables: vi.fn(async () => undefined),
    findActiveReviewBatchId: vi.fn(async () => "batch-1" as string | null),
    findActiveAutonomousCycle: vi.fn(async () => null as JsonRecord | null),
    serializeReviewBatch: vi.fn(async () => ({ success: true, review_batch_id: "batch-1" } as JsonRecord | null)),
  };
  const dependencies: OperatorManifestReviewBatchStateDependencies = {
    normalizeText,
    ensureWorkflowTables: mocks.ensureWorkflowTables,
    findActiveReviewBatchId: mocks.findActiveReviewBatchId,
    findActiveAutonomousCycle: mocks.findActiveAutonomousCycle,
    serializeReviewBatch: mocks.serializeReviewBatch,
  };
  return { mocks, dependencies };
}

describe("operatorManifestReviewBatchStateService", () => {
  it("ensures workflow readiness before enforcing Manifest-only admission", async () => {
    const harness = createHarness();
    const result = await readOperatorManifestReviewBatchState({
      brandKey: "vectrix",
      payload: {},
    }, harness.dependencies);

    expect(harness.mocks.ensureWorkflowTables).toHaveBeenCalledOnce();
    expect(result).toEqual({
      status: 400,
      body: { success: false, error: "review_batch_not_configured_for_brand" },
    });
    expect(harness.mocks.findActiveReviewBatchId).not.toHaveBeenCalled();
  });

  it("serializes an explicitly identified review batch without discovery", async () => {
    const harness = createHarness();
    const result = await readOperatorManifestReviewBatchState({
      brandKey: "manifest_mental",
      payload: { review_batch_id: "batch-9" },
    }, harness.dependencies);

    expect(harness.mocks.findActiveReviewBatchId).not.toHaveBeenCalled();
    expect(harness.mocks.serializeReviewBatch).toHaveBeenCalledWith("batch-9");
    expect(result).toEqual({
      status: 200,
      body: { success: true, review_batch_id: "batch-1" },
    });
  });

  it("discovers the latest active batch with optional production-date scope", async () => {
    const harness = createHarness();
    await readOperatorManifestReviewBatchState({
      brandKey: "manifest_mental",
      payload: { production_date: "2026-07-28" },
    }, harness.dependencies);

    expect(harness.mocks.findActiveReviewBatchId).toHaveBeenCalledWith("manifest_mental", "2026-07-28");
    expect(harness.mocks.serializeReviewBatch).toHaveBeenCalledWith("batch-1");
  });

  it("returns autonomous-cycle continuation guidance when no review batch is active", async () => {
    const harness = createHarness();
    harness.mocks.findActiveReviewBatchId.mockResolvedValue(null);
    harness.mocks.findActiveAutonomousCycle.mockResolvedValue({
      id: "cycle-1",
      status: "prepared",
      timezone: "America/New_York",
      horizon_hours: 48,
      updated_at: "2026-07-27T22:00:00Z",
    });
    const result = await readOperatorManifestReviewBatchState({
      brandKey: "manifest_mental",
      payload: {},
    }, harness.dependencies);

    expect(result).toEqual({
      status: 200,
      body: {
        success: true,
        active: false,
        state: "no_active_review_batch",
        normal_work_blocked: false,
        autonomous_cycle_active: true,
        autonomous_cycle: {
          cycle_id: "cycle-1",
          status: "prepared",
          timezone: "America/New_York",
          horizon_hours: 48,
          updated_at: "2026-07-27T22:00:00Z",
        },
        required_tool: "persist_manifest_autonomous_post",
        required_route: "Continue the prepared autonomous cycle with exactly one model-evaluated post per persistence call. Do not create, claim, read, attach, or schedule a guided review batch.",
      },
    });
    expect(harness.mocks.serializeReviewBatch).not.toHaveBeenCalled();
  });

    it("returns the exact not-found response when an identified batch cannot serialize", async () => {
    const harness = createHarness();
    harness.mocks.serializeReviewBatch.mockResolvedValue(null);
    expect(await readOperatorManifestReviewBatchState({
      brandKey: "manifest_mental",
      payload: { review_batch_id: "missing-batch" },
    }, harness.dependencies)).toEqual({
      status: 404,
      body: { success: false, error: "review_batch_not_found" },
    });
  });
});

function createClaimHarness() {
  let id = 0;
  let existingReview: { id: string } | null = null;
  const mocks = {
    getActiveSession: vi.fn(async () => ({ id: "session-1" } as JsonRecord | null),
    insertSession: vi.fn(async () => undefined),
    retireActiveReviewBatches: vi.fn(async () => undefined),
            findExistingReviewBatch: vi.fn(async () => existingReview),
    completeReviewBatch: vi.fn(async () => undefined),
    ensureSourceBatch: vi.fn(async () => ({
      batch: { id: "source-batch-1" },
      reused_existing: true,
    })),
    insertReviewBatch: vi.fn(async () => undefined),
    listAvailableSelections: vi.fn(async () => [{
      id: "selection-1",
      source_identity_key: "saved:1",
      source_type: "saved_pattern",
      internal_source_id: "pattern-1",
      batch_id: "source-batch-1",
      source_card_id: "card-1",
    }] as JsonRecord[]),
    updateReviewBatchSourceBatch: vi.fn(async () => undefined),
    markReviewBatchEmpty: vi.fn(async () => undefined),
    insertDailyClaim: vi.fn(async () => true),
    markSelectionClaimed: vi.fn(async () => undefined),
    advanceWorkflowSession: vi.fn(async () => undefined),
    serializeReviewBatch: vi.fn(async (reviewBatchId: string) => ({
      success: true,
      review_batch_id: reviewBatchId,
      items: [{ status: "claimed" }],
    } as JsonRecord | null)),
  };
  const dependencies: OperatorManifestReviewBatchClaimDependencies = {
    maxReviewBatchSize: 4,
    defaultTimezone: "America/New_York",
    workflowTemplateKey: "manifest-production-v1",
    normalizeText,
    isValidIsoDate: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
    createId: () => `id-${++id}`,
    getActiveSession: mocks.getActiveSession,
    insertSession: mocks.insertSession,
    retireActiveReviewBatches: mocks.retireActiveReviewBatches,
    findExistingReviewBatch: mocks.findExistingReviewBatch,
    completeReviewBatch: mocks.completeReviewBatch,
    ensureSourceBatch: mocks.ensureSourceBatch,
    insertReviewBatch: mocks.insertReviewBatch,
    listAvailableSelections: mocks.listAvailableSelections,
    updateReviewBatchSourceBatch: mocks.updateReviewBatchSourceBatch,
    markReviewBatchEmpty: mocks.markReviewBatchEmpty,
    insertDailyClaim: mocks.insertDailyClaim,
    markSelectionClaimed: mocks.markSelectionClaimed,
    advanceWorkflowSession: mocks.advanceWorkflowSession,
    serializeReviewBatch: mocks.serializeReviewBatch,
  };
  return { mocks, dependencies };
}

describe("operatorManifestReviewBatchStateService claim workflow", () => {
  it("rejects non-Manifest and invalid production dates before claim mutations", async () => {
    const harness = createClaimHarness();
    expect(await claimOperatorManifestReviewBatch({
      brandKey: "vectrix",
      payload: { production_date: "2026-07-29" },
    }, harness.dependencies)).toEqual({
      status: 400,
      body: { success: false, error: "review_batch_not_configured_for_brand" },
    });
    expect(await claimOperatorManifestReviewBatch({
      brandKey: "manifest_mental",
      payload: { production_date: "not-a-date" },
    }, harness.dependencies)).toEqual({
      status: 400,
      body: { success: false, error: "valid_production_date_required" },
    });
    expect(harness.mocks.getActiveSession).not.toHaveBeenCalled();
  });

  it("reuses an active nonterminal review batch idempotently", async () => {
    const harness = createClaimHarness();
    harness.mocks.findExistingReviewBatch.mockResolvedValue({ id: "existing-1" });
    harness.mocks.serializeReviewBatch.mockResolvedValue({
      review_batch_id: "existing-1",
      items: [{ status: "approved" }],
    });

    const result = await claimOperatorManifestReviewBatch({
      brandKey: "manifest_mental",
      payload: { production_date: "2026-07-29" },
    }, harness.dependencies);

    expect(result).toEqual({
      status: 200,
      body: {
        review_batch_id: "existing-1",
        items: [{ status: "approved" }],
        reused_existing: true,
        idempotency_reason: "active_review_batch_already_exists",
      },
    });
    expect(harness.mocks.ensureSourceBatch).not.toHaveBeenCalled();
    expect(harness.mocks.completeReviewBatch).not.toHaveBeenCalled();
  });

  it("completes terminal batches and claims a bounded new source lineup", async () => {
    const harness = createClaimHarness();
    harness.mocks.findExistingReviewBatch.mockResolvedValue({ id: "terminal-1" });
    harness.mocks.serializeReviewBatch
      .mockResolvedValueOnce({ items: [{ status: "scheduled" }, { status: "source_skipped" }] })
      .mockResolvedValueOnce({ review_batch_id: "id-1", items: [{ status: "claimed" }] });
    harness.mocks.listAvailableSelections.mockResolvedValue([
      { id: "selection-1", source_identity_key: "one", source_type: "saved_pattern", internal_source_id: "1" },
      { id: "selection-2", source_identity_key: "two", source_type: "saved_pattern", internal_source_id: "2" },
    ]);

    const result = await claimOperatorManifestReviewBatch({
      brandKey: "manifest_mental",
      payload: { production_date: "2026-07-29", batch_size: 1 },
    }, harness.dependencies);

    expect(harness.mocks.completeReviewBatch).toHaveBeenCalledWith("terminal-1");
    expect(harness.mocks.insertDailyClaim).toHaveBeenCalledTimes(1);
    expect(harness.mocks.markSelectionClaimed).toHaveBeenCalledTimes(1);
    expect(harness.mocks.advanceWorkflowSession).toHaveBeenCalledWith("session-1", "manifest_mental");
    expect(result).toMatchObject({
      status: 200,
      body: {
        source_batch_reused: true,
        fresh_draw: false,
        source_batch_rollover: false,
      },
    });
  });

  it("rolls to a fresh source batch when the first draw has no available selections", async () => {
    const harness = createClaimHarness();
    harness.mocks.ensureSourceBatch
      .mockResolvedValueOnce({ batch: { id: "source-batch-1" }, reused_existing: true })
      .mockResolvedValueOnce({ batch: { id: "source-batch-2" }, reused_existing: false });
    harness.mocks.listAvailableSelections
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "selection-2", source_identity_key: "two" }]);

    const result = await claimOperatorManifestReviewBatch({
      brandKey: "manifest_mental",
      payload: { production_date: "2026-07-29", source_types: ["saved_pattern"] },
    }, harness.dependencies);

    expect(harness.mocks.ensureSourceBatch).toHaveBeenNthCalledWith(2, expect.objectContaining({ freshDraw: true }));
    expect(harness.mocks.updateReviewBatchSourceBatch).toHaveBeenCalledWith("id-1", "source-batch-2");
    expect(result).toMatchObject({
      status: 200,
      body: { source_batch_reused: false, source_batch_rollover: true },
    });
  });

  it("returns exact source-batch and empty-claim failure states", async () => {
    const sourceFailure = createClaimHarness();
    sourceFailure.mocks.ensureSourceBatch.mockRejectedValueOnce(new Error("source unavailable"));
    expect(await claimOperatorManifestReviewBatch({
      brandKey: "manifest_mental",
      payload: { production_date: "2026-07-29" },
    }, sourceFailure.dependencies)).toEqual({
      status: 400,
      body: { success: false, error: "source unavailable" },
    });

    const emptyClaims = createClaimHarness();
    emptyClaims.mocks.insertDailyClaim.mockResolvedValue(false);
    expect(await claimOperatorManifestReviewBatch({
      brandKey: "manifest_mental",
      payload: { production_date: "2026-07-29" },
    }, emptyClaims.dependencies)).toEqual({
      status: 409,
      body: {
        success: false,
        error: "no_unclaimed_sources_available",
        production_date: "2026-07-29",
      },
    });
    expect(emptyClaims.mocks.markReviewBatchEmpty).toHaveBeenCalledOnce();
  });
});

