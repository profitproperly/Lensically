type JsonRecord = Record<string, unknown>;

export interface OperatorManifestReviewDraftAttachmentDependencies {
  maxReviewBatchSize: number;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  getDraft(draftId: string): Promise<JsonRecord | null>;
  getClaim(reviewBatchId: string, itemNumber: number, brandKey: string): Promise<JsonRecord | null>;
  getReplacement(sourceCardId: string, brandKey: string): Promise<JsonRecord | null>;
  findDuplicateClaim(input: {
    brandKey: string;
    productionDate: string;
    sourceIdentityKey: string;
    excludeClaimId: string;
  }): Promise<string | null>;
  applyAttachment(input: {
    brandKey: string;
    claimId: string;
    productionDate: string;
    replacingSource: boolean;
    sourceIdentityKey: string;
    sourceType: string;
    internalSourceId: string;
    sourceBatchId: string;
    sourceSelectionId: string;
    sourceCardId: string;
    generationRunId: string;
    draftId: string;
    scheduledPostId: unknown;
    claimStatus: string;
  }): Promise<unknown>;
  countUnresolved(reviewBatchId: string): Promise<number>;
  updateReviewBatchStatus(reviewBatchId: string, status: "completed" | "owner_review"): Promise<unknown>;
  serializeReviewBatch(reviewBatchId: string): Promise<JsonRecord | null>;
}

export interface OperatorManifestReviewDraftAttachmentResult {
  status: number;
  body: JsonRecord;
}

export async function attachOperatorManifestReviewDraft(
  input: { brandKey: string; payload: JsonRecord },
  dependencies: OperatorManifestReviewDraftAttachmentDependencies,
): Promise<OperatorManifestReviewDraftAttachmentResult> {
  const reviewBatchId = dependencies.normalizeText(input.payload.review_batch_id, 120);
  const itemNumber = Math.trunc(Number(input.payload.item_number));
  const draftId = dependencies.normalizeText(input.payload.draft_id, 120);
  const draft = draftId ? await dependencies.getDraft(draftId) : null;
  if (!reviewBatchId
      || !Number.isInteger(itemNumber)
      || itemNumber < 1
      || itemNumber > dependencies.maxReviewBatchSize
      || !draft
      || !draftId) {
    return { status: 400, body: { success: false, error: "review_batch_item_and_draft_required" } };
  }
  const draftStatus = String(draft.status ?? "");
  if (draft.showable !== true || !["shown", "approved", "scheduled", "published"].includes(draftStatus)) {
    return {
      status: 400,
      body: { success: false, error: "passing_shown_draft_required", draft_status: draft.status },
    };
  }

  const requestedSourceCardId = dependencies.normalizeText(input.payload.source_card_id, 120, true)
    ?? (typeof draft.source_card_id === "string" ? draft.source_card_id : null);
  const requestedGenerationRunId = dependencies.normalizeText(input.payload.generation_run_id, 120, true)
    ?? (typeof draft.run_id === "string" ? draft.run_id : null);
  if (!requestedSourceCardId
      || !requestedGenerationRunId
      || draft.source_card_id !== requestedSourceCardId
      || draft.run_id !== requestedGenerationRunId) {
    return { status: 409, body: { success: false, error: "draft_lineage_mismatch" } };
  }

  const claim = await dependencies.getClaim(reviewBatchId, itemNumber, input.brandKey);
  if (!claim) {
    return { status: 404, body: { success: false, error: "review_batch_item_not_found" } };
  }
  const replacement = await dependencies.getReplacement(requestedSourceCardId, input.brandKey);
  if (!replacement?.source_selection_id) {
    return { status: 409, body: { success: false, error: "manifest_source_card_selection_required" } };
  }

  const replacementSelectionId = String(replacement.source_selection_id);
  const replacementSourceIdentityKey = String(replacement.source_identity_key ?? "");
  const claimSourceIdentityKey = String(claim.source_identity_key ?? "");
  const sameSourceIdentity = replacementSourceIdentityKey === claimSourceIdentityKey;
  const productionDate = String(claim.production_date ?? "");
  if (!sameSourceIdentity && String(replacement.source_production_date ?? "") !== productionDate) {
    return { status: 409, body: { success: false, error: "replacement_source_production_date_mismatch" } };
  }

  const replacingSource = !sameSourceIdentity && replacementSelectionId !== String(claim.source_selection_id ?? "");
  if (replacingSource && !["source_skipped", "source_deleted"].includes(String(claim.status ?? ""))) {
    return { status: 409, body: { success: false, error: "review_source_replacement_requires_skip" } };
  }
  if (replacingSource) {
    const duplicateClaimId = await dependencies.findDuplicateClaim({
      brandKey: input.brandKey,
      productionDate,
      sourceIdentityKey: replacementSourceIdentityKey,
      excludeClaimId: String(claim.id ?? ""),
    });
    if (duplicateClaimId) {
      return { status: 409, body: { success: false, error: "replacement_source_already_claimed_for_day" } };
    }
  }

  const nextClaimStatus = draftStatus === "approved"
    ? "approved"
    : draftStatus === "scheduled" || draftStatus === "published"
      ? draftStatus
      : "shown";
  await dependencies.applyAttachment({
    brandKey: input.brandKey,
    claimId: String(claim.id ?? ""),
    productionDate,
    replacingSource,
    sourceIdentityKey: replacementSourceIdentityKey,
    sourceType: String(replacement.source_type ?? ""),
    internalSourceId: String(replacement.internal_source_id ?? ""),
    sourceBatchId: String(replacement.source_batch_id ?? ""),
    sourceSelectionId: replacementSelectionId,
    sourceCardId: requestedSourceCardId,
    generationRunId: requestedGenerationRunId,
    draftId,
    scheduledPostId: draft.scheduled_post_id ?? null,
    claimStatus: nextClaimStatus,
  });
  const unresolved = await dependencies.countUnresolved(reviewBatchId);
  await dependencies.updateReviewBatchStatus(reviewBatchId, unresolved === 0 ? "completed" : "owner_review");
  return {
    status: 200,
    body: (await dependencies.serializeReviewBatch(reviewBatchId)) ?? {},
  };
}
