import { describe, expect, it, vi } from "vitest";
import {
  readOperatorManifestReviewBatchState,
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
