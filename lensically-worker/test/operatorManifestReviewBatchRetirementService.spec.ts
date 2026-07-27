import { describe, expect, it, vi } from "vitest";
import {
  retireOperatorManifestReviewBatch,
  type OperatorManifestReviewBatchRetirementDependencies,
} from "../src/operatorManifestReviewBatchRetirementService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function createHarness() {
  const mocks = {
    findBatch: vi.fn(async () => ({
      id: "batch-1",
      workflow_session_id: "session-1",
      source_batch_id: "source-batch-1",
      production_date: "2026-07-28",
      status: "owner_review",
    } as JsonRecord)),
    retireBatch: vi.fn(async () => undefined),
  };
  const dependencies: OperatorManifestReviewBatchRetirementDependencies = {
    normalizeText,
    findBatch: mocks.findBatch,
    retireBatch: mocks.retireBatch,
  };
  return { mocks, dependencies };
}

describe("operatorManifestReviewBatchRetirementService", () => {
  it("admits only Manifest review-batch retirement", async () => {
    const harness = createHarness();
    expect(await retireOperatorManifestReviewBatch({
      brandKey: "vectrix",
      payload: { reason: "Retire duplicate batch" },
    }, harness.dependencies)).toEqual({
      status: 400,
      body: { success: false, error: "review_batch_not_configured_for_brand" },
    });
    expect(harness.mocks.findBatch).not.toHaveBeenCalled();
  });

  it("requires a nonempty discard reason before lookup", async () => {
    const harness = createHarness();
    expect(await retireOperatorManifestReviewBatch({
      brandKey: "manifest_mental",
      payload: { reason: "   " },
    }, harness.dependencies)).toEqual({
      status: 400,
      body: { success: false, error: "discard_reason_required" },
    });
    expect(harness.mocks.findBatch).not.toHaveBeenCalled();
  });

  it("returns an idempotent preserved-source result when no active batch exists", async () => {
    const harness = createHarness();
    harness.mocks.findBatch.mockResolvedValue(null);
    expect(await retireOperatorManifestReviewBatch({
      brandKey: "manifest_mental",
      payload: { reason: "Reset guided review" },
    }, harness.dependencies)).toEqual({
      status: 200,
      body: {
        success: true,
        brand_key: "manifest_mental",
        retired: false,
        reason: "no_active_review_batch",
        source_records_preserved: true,
      },
    });
    expect(harness.mocks.findBatch).toHaveBeenCalledWith("manifest_mental", null);
    expect(harness.mocks.retireBatch).not.toHaveBeenCalled();
  });

  it("retires an active batch while preserving source records and lineage", async () => {
    const harness = createHarness();
    const result = await retireOperatorManifestReviewBatch({
      brandKey: "manifest_mental",
      payload: { review_batch_id: "batch-1", reason: "Replace stale review batch" },
    }, harness.dependencies);

    expect(harness.mocks.findBatch).toHaveBeenCalledWith("manifest_mental", "batch-1");
    expect(harness.mocks.retireBatch).toHaveBeenCalledWith("batch-1", "manifest_mental");
    expect(result).toEqual({
      status: 200,
      body: {
        success: true,
        brand_key: "manifest_mental",
        review_batch_id: "batch-1",
        workflow_session_id: "session-1",
        source_batch_id: "source-batch-1",
        production_date: "2026-07-28",
        previous_status: "owner_review",
        status: "retired",
        retired: true,
        source_records_preserved: true,
        source_lineage_preserved: true,
        reason: "Replace stale review batch",
      },
    });
  });

  it("preserves terminal batch status without issuing another mutation", async () => {
    const harness = createHarness();
    harness.mocks.findBatch.mockResolvedValue({ id: "batch-1", status: "retired" });
    const result = await retireOperatorManifestReviewBatch({
      brandKey: "manifest_mental",
      payload: { reason: "Confirm retirement" },
    }, harness.dependencies);

    expect(harness.mocks.retireBatch).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 200,
      body: {
        previous_status: "retired",
        status: "retired",
        retired: false,
        source_records_preserved: true,
        source_lineage_preserved: true,
      },
    });
  });
});
