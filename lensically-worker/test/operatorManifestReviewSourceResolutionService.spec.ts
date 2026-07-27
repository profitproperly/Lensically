import { describe, expect, it, vi } from "vitest";
import {
  resolveOperatorManifestReviewSource,
  type OperatorManifestReviewSourceResolutionDependencies,
} from "../src/operatorManifestReviewSourceResolutionService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function normalizeMachineKey(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : fallback;
}

function createHarness() {
  const claim: JsonRecord = {
    id: "claim-1",
    review_batch_id: "batch-resolved",
    source_identity_key: "source-1",
    source_type: "saved_pattern",
    internal_source_id: "pattern-1",
    source_selection_id: "selection-1",
  };
  const mocks = {
    getClaim: vi.fn(async () => claim as JsonRecord | null),
    upsertSourceExclusion: vi.fn(async () => undefined),
    updateClaim: vi.fn(async () => undefined),
    updateSourceSelection: vi.fn(async () => undefined),
    countUnresolved: vi.fn(async () => 1),
    updateReviewBatchStatus: vi.fn(async () => undefined),
    serializeReviewBatch: vi.fn(async () => ({ success: true, review_batch_id: "batch-resolved" } as JsonRecord | null)),
  };
  const dependencies: OperatorManifestReviewSourceResolutionDependencies = {
    normalizeText,
    normalizeMachineKey,
    createId: () => "exclusion-1",
    getClaim: mocks.getClaim,
    upsertSourceExclusion: mocks.upsertSourceExclusion,
    updateClaim: mocks.updateClaim,
    updateSourceSelection: mocks.updateSourceSelection,
    countUnresolved: mocks.countUnresolved,
    updateReviewBatchStatus: mocks.updateReviewBatchStatus,
    serializeReviewBatch: mocks.serializeReviewBatch,
  };
  return { claim, mocks, dependencies };
}

function payload(scope?: string): JsonRecord {
  return { review_batch_id: "batch-input", item_number: 2, ...(scope ? { scope } : {}) };
}

describe("operatorManifestReviewSourceResolutionService", () => {
  it("returns the exact missing-item response without any mutation", async () => {
    const harness = createHarness();
    harness.mocks.getClaim.mockResolvedValue(null);

    expect(await resolveOperatorManifestReviewSource({
      brandKey: "manifest_mental",
      payload: payload(),
    }, harness.dependencies)).toEqual({
      status: 404,
      body: { success: false, error: "review_batch_item_not_found" },
    });
    expect(harness.mocks.updateClaim).not.toHaveBeenCalled();
    expect(harness.mocks.upsertSourceExclusion).not.toHaveBeenCalled();
  });

  it("limits permanent source deletion to saved patterns", async () => {
    const harness = createHarness();
    harness.claim.source_type = "winner";

    expect(await resolveOperatorManifestReviewSource({
      brandKey: "manifest_mental",
      payload: payload("delete_source"),
    }, harness.dependencies)).toEqual({
      status: 400,
      body: { success: false, error: "only_saved_patterns_can_be_deleted_as_sources" },
    });
    expect(harness.mocks.upsertSourceExclusion).not.toHaveBeenCalled();
    expect(harness.mocks.updateClaim).not.toHaveBeenCalled();
  });

  it("uses the default owner reason for current-day source skips", async () => {
    const harness = createHarness();
    const result = await resolveOperatorManifestReviewSource({
      brandKey: "manifest_mental",
      payload: payload(),
    }, harness.dependencies);

    expect(harness.mocks.updateClaim).toHaveBeenCalledWith({
      claimId: "claim-1",
      status: "source_skipped",
      reason: "Owner rejected source for production use.",
    });
    expect(harness.mocks.updateSourceSelection).toHaveBeenCalledWith({
      sourceSelectionId: "selection-1",
      brandKey: "manifest_mental",
      dispositionReason: "source_skipped",
    });
    expect(harness.mocks.updateReviewBatchStatus).toHaveBeenCalledWith("batch-resolved", "partially_resolved");
    expect(result).toEqual({ status: 200, body: { success: true, review_batch_id: "batch-resolved" } });
  });

  it("upserts a durable exclusion and completes a deleted saved-pattern source", async () => {
    const harness = createHarness();
    harness.mocks.countUnresolved.mockResolvedValue(0);

    await resolveOperatorManifestReviewSource({
      brandKey: "manifest_mental",
      payload: { ...payload("delete_source"), reason: "Never use this source again." },
    }, harness.dependencies);

    expect(harness.mocks.upsertSourceExclusion).toHaveBeenCalledWith({
      id: "exclusion-1",
      brandKey: "manifest_mental",
      sourceIdentityKey: "source-1",
      sourceType: "saved_pattern",
      internalSourceId: "pattern-1",
      reason: "Never use this source again.",
    });
    expect(harness.mocks.updateClaim).toHaveBeenCalledWith({
      claimId: "claim-1",
      status: "source_deleted",
      reason: "Never use this source again.",
    });
    expect(harness.mocks.updateReviewBatchStatus).toHaveBeenCalledWith("batch-resolved", "completed");
  });

  it("uses the claim batch identity and preserves an empty serialized fallback", async () => {
    const harness = createHarness();
    harness.mocks.serializeReviewBatch.mockResolvedValue(null);

    expect(await resolveOperatorManifestReviewSource({
      brandKey: "manifest_mental",
      payload: payload(),
    }, harness.dependencies)).toEqual({ status: 200, body: {} });
    expect(harness.mocks.countUnresolved).toHaveBeenCalledWith("batch-resolved");
    expect(harness.mocks.serializeReviewBatch).toHaveBeenCalledWith("batch-resolved");
  });
});
