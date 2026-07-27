import { describe, expect, it, vi } from "vitest";
import {
  attachOperatorManifestReviewDraft,
  type OperatorManifestReviewDraftAttachmentDependencies,
} from "../src/operatorManifestReviewDraftAttachmentService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function createHarness() {
  const draft: JsonRecord = {
    id: "draft-1",
    showable: true,
    status: "shown",
    source_card_id: "card-1",
    run_id: "run-1",
    scheduled_post_id: null,
  };
  const claim: JsonRecord = {
    id: "claim-1",
    review_batch_id: "batch-1",
    production_date: "2026-07-28",
    source_identity_key: "source-a",
    source_selection_id: "selection-a",
    status: "claimed",
  };
  const replacement: JsonRecord = {
    source_card_id: "card-1",
    source_selection_id: "selection-a",
    source_batch_id: "source-batch-1",
    source_identity_key: "source-a",
    source_type: "saved_pattern",
    internal_source_id: "pattern-1",
    source_production_date: "2026-07-28",
  };
  const mocks = {
    getDraft: vi.fn(async () => draft as JsonRecord | null),
    getClaim: vi.fn(async () => claim as JsonRecord | null),
    getReplacement: vi.fn(async () => replacement as JsonRecord | null),
    findDuplicateClaim: vi.fn(async () => null as string | null),
    applyAttachment: vi.fn(async () => undefined),
    countUnresolved: vi.fn(async () => 1),
    updateReviewBatchStatus: vi.fn(async () => undefined),
    serializeReviewBatch: vi.fn(async () => ({ success: true, review_batch_id: "batch-1" } as JsonRecord | null)),
  };
  const dependencies: OperatorManifestReviewDraftAttachmentDependencies = {
    maxReviewBatchSize: 4,
    normalizeText,
    getDraft: mocks.getDraft,
    getClaim: mocks.getClaim,
    getReplacement: mocks.getReplacement,
    findDuplicateClaim: mocks.findDuplicateClaim,
    applyAttachment: mocks.applyAttachment,
    countUnresolved: mocks.countUnresolved,
    updateReviewBatchStatus: mocks.updateReviewBatchStatus,
    serializeReviewBatch: mocks.serializeReviewBatch,
  };
  return { draft, claim, replacement, mocks, dependencies };
}

function validPayload(): JsonRecord {
  return { review_batch_id: "batch-1", item_number: 1, draft_id: "draft-1" };
}

describe("operatorManifestReviewDraftAttachmentService", () => {
  it("rejects incomplete attachment identity before any mutation", async () => {
    const harness = createHarness();
    const result = await attachOperatorManifestReviewDraft({
      brandKey: "manifest_mental",
      payload: { review_batch_id: "batch-1", item_number: 9, draft_id: "draft-1" },
    }, harness.dependencies);

    expect(result).toEqual({
      status: 400,
      body: { success: false, error: "review_batch_item_and_draft_required" },
    });
    expect(harness.mocks.getClaim).not.toHaveBeenCalled();
    expect(harness.mocks.applyAttachment).not.toHaveBeenCalled();
  });

  it("enforces passing draft state and exact source-card generation lineage", async () => {
    const harness = createHarness();
    harness.draft.showable = false;
    expect(await attachOperatorManifestReviewDraft({
      brandKey: "manifest_mental",
      payload: validPayload(),
    }, harness.dependencies)).toEqual({
      status: 400,
      body: { success: false, error: "passing_shown_draft_required", draft_status: "shown" },
    });

    harness.draft.showable = true;
    expect(await attachOperatorManifestReviewDraft({
      brandKey: "manifest_mental",
      payload: { ...validPayload(), generation_run_id: "run-other" },
    }, harness.dependencies)).toEqual({
      status: 409,
      body: { success: false, error: "draft_lineage_mismatch" },
    });
    expect(harness.mocks.applyAttachment).not.toHaveBeenCalled();
  });

  it("requires selected same-day replacement authority and a skipped prior source", async () => {
    const harness = createHarness();
    harness.replacement.source_selection_id = null;
    expect(await attachOperatorManifestReviewDraft({ brandKey: "manifest_mental", payload: validPayload() }, harness.dependencies)).toEqual({
      status: 409,
      body: { success: false, error: "manifest_source_card_selection_required" },
    });

    harness.replacement.source_selection_id = "selection-b";
    harness.replacement.source_identity_key = "source-b";
    harness.replacement.source_production_date = "2026-07-29";
    expect(await attachOperatorManifestReviewDraft({ brandKey: "manifest_mental", payload: validPayload() }, harness.dependencies)).toEqual({
      status: 409,
      body: { success: false, error: "replacement_source_production_date_mismatch" },
    });

    harness.replacement.source_production_date = "2026-07-28";
    expect(await attachOperatorManifestReviewDraft({ brandKey: "manifest_mental", payload: validPayload() }, harness.dependencies)).toEqual({
      status: 409,
      body: { success: false, error: "review_source_replacement_requires_skip" },
    });
    expect(harness.mocks.applyAttachment).not.toHaveBeenCalled();
  });

  it("rejects a replacement source already claimed for the production day", async () => {
    const harness = createHarness();
    harness.replacement.source_selection_id = "selection-b";
    harness.replacement.source_identity_key = "source-b";
    harness.claim.status = "source_skipped";
    harness.mocks.findDuplicateClaim.mockResolvedValue("claim-duplicate");

    expect(await attachOperatorManifestReviewDraft({ brandKey: "manifest_mental", payload: validPayload() }, harness.dependencies)).toEqual({
      status: 409,
      body: { success: false, error: "replacement_source_already_claimed_for_day" },
    });
    expect(harness.mocks.findDuplicateClaim).toHaveBeenCalledWith({
      brandKey: "manifest_mental",
      productionDate: "2026-07-28",
      sourceIdentityKey: "source-b",
      excludeClaimId: "claim-1",
    });
    expect(harness.mocks.applyAttachment).not.toHaveBeenCalled();
  });

  it("persists attachment state and completes the batch when no unresolved items remain", async () => {
    const harness = createHarness();
    harness.draft.status = "scheduled";
    harness.draft.scheduled_post_id = "post-1";
    harness.replacement.source_selection_id = "selection-b";
    harness.replacement.source_identity_key = "source-b";
    harness.replacement.internal_source_id = "pattern-2";
    harness.claim.status = "source_deleted";
    harness.mocks.countUnresolved.mockResolvedValue(0);

    const result = await attachOperatorManifestReviewDraft({ brandKey: "manifest_mental", payload: validPayload() }, harness.dependencies);

    expect(harness.mocks.applyAttachment).toHaveBeenCalledWith({
      brandKey: "manifest_mental",
      claimId: "claim-1",
      productionDate: "2026-07-28",
      replacingSource: true,
      sourceIdentityKey: "source-b",
      sourceType: "saved_pattern",
      internalSourceId: "pattern-2",
      sourceBatchId: "source-batch-1",
      sourceSelectionId: "selection-b",
      sourceCardId: "card-1",
      generationRunId: "run-1",
      draftId: "draft-1",
      scheduledPostId: "post-1",
      claimStatus: "scheduled",
    });
    expect(harness.mocks.updateReviewBatchStatus).toHaveBeenCalledWith("batch-1", "completed");
    expect(result).toEqual({ status: 200, body: { success: true, review_batch_id: "batch-1" } });
  });
});
