type JsonRecord = Record<string, unknown>;

export interface OperatorManifestReviewSourceResolutionDependencies {
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  normalizeMachineKey(value: unknown, fallback: string): string;
  createId(): string;
  getClaim(reviewBatchId: string | null, itemNumber: number, brandKey: string): Promise<JsonRecord | null>;
  upsertSourceExclusion(input: {
    id: string;
    brandKey: string;
    sourceIdentityKey: unknown;
    sourceType: unknown;
    internalSourceId: unknown;
    reason: string;
  }): Promise<unknown>;
  updateClaim(input: { claimId: string; status: "source_deleted" | "source_skipped"; reason: string }): Promise<unknown>;
  updateSourceSelection(input: { sourceSelectionId: unknown; brandKey: string; dispositionReason: string }): Promise<unknown>;
  countUnresolved(reviewBatchId: string): Promise<number>;
  updateReviewBatchStatus(reviewBatchId: string, status: "completed" | "partially_resolved"): Promise<unknown>;
  serializeReviewBatch(reviewBatchId: string): Promise<JsonRecord | null>;
}

export interface OperatorManifestReviewSourceResolutionResult {
  status: number;
  body: JsonRecord;
}

export async function resolveOperatorManifestReviewSource(
  input: { brandKey: string; payload: JsonRecord },
  dependencies: OperatorManifestReviewSourceResolutionDependencies,
): Promise<OperatorManifestReviewSourceResolutionResult> {
  const reviewBatchId = dependencies.normalizeText(input.payload.review_batch_id, 120);
  const itemNumber = Math.trunc(Number(input.payload.item_number));
  const scope = dependencies.normalizeMachineKey(input.payload.scope, "current_day");
  const reason = dependencies.normalizeText(input.payload.reason, 2000, true)
    ?? "Owner rejected source for production use.";
  const claim = await dependencies.getClaim(reviewBatchId, itemNumber, input.brandKey);
  if (!claim) {
    return { status: 404, body: { success: false, error: "review_batch_item_not_found" } };
  }
  const resolvedReviewBatchId = String(claim.review_batch_id ?? reviewBatchId);
  if (scope === "delete_source") {
    if (claim.source_type !== "saved_pattern") {
      return {
        status: 400,
        body: { success: false, error: "only_saved_patterns_can_be_deleted_as_sources" },
      };
    }
    await dependencies.upsertSourceExclusion({
      id: dependencies.createId(),
      brandKey: input.brandKey,
      sourceIdentityKey: claim.source_identity_key,
      sourceType: claim.source_type,
      internalSourceId: claim.internal_source_id,
      reason,
    });
  }
  const nextStatus = scope === "delete_source" ? "source_deleted" : "source_skipped";
  await dependencies.updateClaim({
    claimId: String(claim.id),
    status: nextStatus,
    reason,
  });
  await dependencies.updateSourceSelection({
    sourceSelectionId: claim.source_selection_id,
    brandKey: input.brandKey,
    dispositionReason: nextStatus,
  });
  const unresolved = await dependencies.countUnresolved(resolvedReviewBatchId);
  await dependencies.updateReviewBatchStatus(
    resolvedReviewBatchId,
    unresolved === 0 ? "completed" : "partially_resolved",
  );
  return {
    status: 200,
    body: (await dependencies.serializeReviewBatch(resolvedReviewBatchId)) ?? {},
  };
}
