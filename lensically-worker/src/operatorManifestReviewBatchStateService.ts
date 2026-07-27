type JsonRecord = Record<string, unknown>;

export interface OperatorManifestReviewBatchStateDependencies {
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  ensureWorkflowTables(): Promise<unknown>;
  findActiveReviewBatchId(brandKey: string, productionDate: string | null): Promise<string | null>;
  findActiveAutonomousCycle(brandKey: string): Promise<JsonRecord | null>;
  serializeReviewBatch(reviewBatchId: string): Promise<JsonRecord | null>;
}

export interface OperatorManifestReviewBatchStateResult {
  status: number;
  body: JsonRecord;
}

export async function readOperatorManifestReviewBatchState(
  input: {
    brandKey: string;
    payload: JsonRecord;
  },
  dependencies: OperatorManifestReviewBatchStateDependencies,
): Promise<OperatorManifestReviewBatchStateResult> {
  await dependencies.ensureWorkflowTables();
  if (input.brandKey !== "manifest_mental") {
    return {
      status: 400,
      body: { success: false, error: "review_batch_not_configured_for_brand" },
    };
  }
  let reviewBatchId = dependencies.normalizeText(input.payload.review_batch_id, 120, true);
  if (!reviewBatchId) {
    const productionDate = dependencies.normalizeText(input.payload.production_date, 20, true);
    reviewBatchId = await dependencies.findActiveReviewBatchId(input.brandKey, productionDate);
  }
  if (!reviewBatchId) {
    const activeAutonomousCycle = await dependencies.findActiveAutonomousCycle(input.brandKey);
    return {
      status: 200,
      body: {
        success: true,
        active: false,
        state: "no_active_review_batch",
        normal_work_blocked: false,
        autonomous_cycle_active: Boolean(activeAutonomousCycle),
        autonomous_cycle: activeAutonomousCycle
          ? {
              cycle_id: activeAutonomousCycle.id,
              status: activeAutonomousCycle.status,
              timezone: activeAutonomousCycle.timezone,
              horizon_hours: activeAutonomousCycle.horizon_hours,
              updated_at: activeAutonomousCycle.updated_at,
            }
          : null,
        required_tool: activeAutonomousCycle ? "persist_manifest_autonomous_post" : null,
        required_route: activeAutonomousCycle
          ? "Continue the prepared autonomous cycle with exactly one model-evaluated post per persistence call. Do not create, claim, read, attach, or schedule a guided review batch."
          : null,
      },
    };
  }
  const serialized = await dependencies.serializeReviewBatch(reviewBatchId);
  return serialized
    ? { status: 200, body: serialized }
    : { status: 404, body: { success: false, error: "review_batch_not_found" } };
}
