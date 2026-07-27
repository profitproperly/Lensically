type JsonRecord = Record<string, unknown>;

export interface OperatorManifestReviewBatchRetirementDependencies {
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  findBatch(brandKey: string, reviewBatchId: string | null): Promise<JsonRecord | null>;
  retireBatch(reviewBatchId: string, brandKey: string): Promise<unknown>;
}

export interface OperatorManifestReviewBatchRetirementResult {
  status: number;
  body: JsonRecord;
}

export async function retireOperatorManifestReviewBatch(
  input: {
    brandKey: string;
    payload: JsonRecord;
  },
  dependencies: OperatorManifestReviewBatchRetirementDependencies,
): Promise<OperatorManifestReviewBatchRetirementResult> {
  if (input.brandKey !== "manifest_mental") {
    return {
      status: 400,
      body: { success: false, error: "review_batch_not_configured_for_brand" },
    };
  }
  const reviewBatchId = dependencies.normalizeText(input.payload.review_batch_id, 120, true);
  const reason = dependencies.normalizeText(input.payload.reason, 2000);
  if (!reason) {
    return {
      status: 400,
      body: { success: false, error: "discard_reason_required" },
    };
  }
  const batch = await dependencies.findBatch(input.brandKey, reviewBatchId);
  if (!batch) {
    return {
      status: 200,
      body: {
        success: true,
        brand_key: input.brandKey,
        retired: false,
        reason: "no_active_review_batch",
        source_records_preserved: true,
      },
    };
  }
  const priorStatus = String(batch.status ?? "");
  if (!["retired", "completed"].includes(priorStatus)) {
    await dependencies.retireBatch(String(batch.id), input.brandKey);
  }
  return {
    status: 200,
    body: {
      success: true,
      brand_key: input.brandKey,
      review_batch_id: batch.id,
      workflow_session_id: batch.workflow_session_id ?? null,
      source_batch_id: batch.source_batch_id ?? null,
      production_date: batch.production_date ?? null,
      previous_status: priorStatus,
      status: "retired",
      retired: priorStatus !== "retired",
      source_records_preserved: true,
      source_lineage_preserved: true,
      reason,
    },
  };
}
