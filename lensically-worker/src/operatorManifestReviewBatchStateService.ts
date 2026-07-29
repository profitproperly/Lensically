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

export interface OperatorManifestReviewSourceBatch {
  batch: JsonRecord;
  reused_existing: boolean;
}

export interface OperatorManifestReviewBatchClaimDependencies {
  maxReviewBatchSize: number;
  defaultTimezone: string;
  workflowTemplateKey: string;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  isValidIsoDate(value: string): boolean;
  createId(): string;
  getActiveSession(brandKey: string): Promise<JsonRecord | null>;
  insertSession(input: {
    sessionId: string;
    brandKey: string;
    workflowTemplateKey: string;
    notes: string;
  }): Promise<unknown>;
  retireActiveReviewBatches(brandKey: string): Promise<unknown>;
  findExistingReviewBatch(brandKey: string, productionDate: string): Promise<{ id: string } | null>;
  completeReviewBatch(reviewBatchId: string): Promise<unknown>;
  ensureSourceBatch(input: {
    workflowSessionId: string;
    productionDate: string;
    sourceTypes: string[];
    freshDraw: boolean;
  }): Promise<OperatorManifestReviewSourceBatch>;
  insertReviewBatch(input: {
    reviewBatchId: string;
    brandKey: string;
    workflowSessionId: string;
    sourceBatchId: unknown;
    productionDate: string;
    timezone: string;
    batchSize: number;
  }): Promise<unknown>;
  listAvailableSelections(input: {
    brandKey: string;
    productionDate: string;
    sourceBatchId: string;
  }): Promise<JsonRecord[]>;
  updateReviewBatchSourceBatch(reviewBatchId: string, sourceBatchId: string): Promise<unknown>;
  markReviewBatchEmpty(reviewBatchId: string): Promise<unknown>;
  insertDailyClaim(input: {
    claimId: string;
    brandKey: string;
    productionDate: string;
    timezone: string;
    sourceIdentityKey: string;
    sourceType: string;
    internalSourceId: string;
    sourceBatchId: string;
    sourceSelectionId: string;
    workflowSessionId: string;
    reviewBatchId: string;
    reviewItemNumber: number;
    sourceCardId: unknown;
  }): Promise<boolean>;
  markSelectionClaimed(input: {
    selectionId: string;
    brandKey: string;
    productionDate: string;
  }): Promise<unknown>;
  advanceWorkflowSession(workflowSessionId: string, brandKey: string): Promise<unknown>;
  serializeReviewBatch(reviewBatchId: string): Promise<JsonRecord | null>;
}

const TERMINAL_REVIEW_ITEM_STATUSES = new Set([
  "scheduled",
  "published",
  "source_skipped",
  "source_deleted",
]);

export async function claimOperatorManifestReviewBatch(
  input: {
    brandKey: string;
    payload: JsonRecord;
  },
  dependencies: OperatorManifestReviewBatchClaimDependencies,
): Promise<OperatorManifestReviewBatchStateResult> {
  if (input.brandKey !== "manifest_mental") {
    return {
      status: 400,
      body: { success: false, error: "review_batch_not_configured_for_brand" },
    };
  }

  const productionDate = dependencies.normalizeText(input.payload.production_date, 20);
  const timezone = dependencies.normalizeText(input.payload.timezone, 100, true)
    ?? dependencies.defaultTimezone;
  if (!productionDate || !dependencies.isValidIsoDate(productionDate)) {
    return {
      status: 400,
      body: { success: false, error: "valid_production_date_required" },
    };
  }

  let session = await dependencies.getActiveSession(input.brandKey);
  if (!session) {
    const sessionId = dependencies.createId();
    await dependencies.insertSession({
      sessionId,
      brandKey: input.brandKey,
      workflowTemplateKey: dependencies.workflowTemplateKey,
      notes: "Created automatically by calendar-first production workflow.",
    });
    session = await dependencies.getActiveSession(input.brandKey);
  }
  const workflowSessionId = dependencies.normalizeText(input.payload.workflow_session_id, 120, true)
    ?? dependencies.normalizeText(session?.id, 120, true);
  if (!workflowSessionId) {
    return {
      status: 400,
      body: { success: false, error: "workflow_session_unavailable" },
    };
  }

  const freshDraw = input.payload.fresh_draw === true;
  if (freshDraw) {
    await dependencies.retireActiveReviewBatches(input.brandKey);
  } else {
    const existingReview = await dependencies.findExistingReviewBatch(input.brandKey, productionDate);
    if (existingReview?.id) {
      const serialized = await dependencies.serializeReviewBatch(existingReview.id);
      const existingItems = serialized && Array.isArray(serialized.items)
        ? serialized.items.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
        : [];
      const terminalExistingReview = existingItems.length > 0
        && existingItems.every((item) => TERMINAL_REVIEW_ITEM_STATUSES.has(String(item.status ?? "")));
      if (!terminalExistingReview) {
        return {
          status: 200,
          body: {
            ...(serialized ?? {}),
            reused_existing: true,
            idempotency_reason: "active_review_batch_already_exists",
          },
        };
      }
      await dependencies.completeReviewBatch(existingReview.id);
    }
  }

  const sourceTypes = Array.isArray(input.payload.source_types)
    ? input.payload.source_types.map(String)
    : [];
  let sourceBatch: OperatorManifestReviewSourceBatch;
  try {
    sourceBatch = await dependencies.ensureSourceBatch({
      workflowSessionId,
      productionDate,
      sourceTypes,
      freshDraw,
    });
  } catch (error) {
    return {
      status: 400,
      body: {
        success: false,
        error: error instanceof Error ? error.message : "source_batch_failed",
      },
    };
  }

  const reviewBatchId = dependencies.createId();
  const requestedSize = Math.min(
    Math.max(Math.trunc(Number(input.payload.batch_size ?? dependencies.maxReviewBatchSize)), 1),
    dependencies.maxReviewBatchSize,
  );
  await dependencies.insertReviewBatch({
    reviewBatchId,
    brandKey: input.brandKey,
    workflowSessionId,
    sourceBatchId: sourceBatch.batch.id,
    productionDate,
    timezone,
    batchSize: requestedSize,
  });

  let available = await dependencies.listAvailableSelections({
    brandKey: input.brandKey,
    productionDate,
    sourceBatchId: String(sourceBatch.batch.id),
  });
  let sourceBatchRollover = false;
  if (!available.length) {
    try {
      sourceBatch = await dependencies.ensureSourceBatch({
        workflowSessionId,
        productionDate,
        sourceTypes,
        freshDraw: true,
      });
      sourceBatchRollover = true;
      await dependencies.updateReviewBatchSourceBatch(reviewBatchId, String(sourceBatch.batch.id));
      available = await dependencies.listAvailableSelections({
        brandKey: input.brandKey,
        productionDate,
        sourceBatchId: String(sourceBatch.batch.id),
      });
    } catch (error) {
      await dependencies.markReviewBatchEmpty(reviewBatchId);
      return {
        status: 409,
        body: {
          success: false,
          error: error instanceof Error ? error.message : "source_batch_rollover_failed",
          production_date: productionDate,
        },
      };
    }
  }

  let itemNumber = 1;
  for (const selection of available) {
    if (itemNumber > requestedSize) break;
    const inserted = await dependencies.insertDailyClaim({
      claimId: dependencies.createId(),
      brandKey: input.brandKey,
      productionDate,
      timezone,
      sourceIdentityKey: String(selection.source_identity_key ?? ""),
      sourceType: String(selection.source_type ?? ""),
      internalSourceId: String(selection.internal_source_id ?? ""),
      sourceBatchId: String(selection.batch_id ?? sourceBatch.batch.id),
      sourceSelectionId: String(selection.id),
      workflowSessionId,
      reviewBatchId,
      reviewItemNumber: itemNumber,
      sourceCardId: selection.source_card_id ?? null,
    });
    if (!inserted) continue;
    await dependencies.markSelectionClaimed({
      selectionId: String(selection.id),
      brandKey: input.brandKey,
      productionDate,
    });
    itemNumber += 1;
  }

  if (itemNumber === 1) {
    await dependencies.markReviewBatchEmpty(reviewBatchId);
    return {
      status: 409,
      body: {
        success: false,
        error: "no_unclaimed_sources_available",
        production_date: productionDate,
      },
    };
  }

  await dependencies.advanceWorkflowSession(workflowSessionId, input.brandKey);
  const serialized = await dependencies.serializeReviewBatch(reviewBatchId);
  return {
    status: 200,
    body: {
      ...(serialized ?? {}),
      source_batch_reused: sourceBatch.reused_existing,
      fresh_draw: freshDraw,
      source_batch_rollover: sourceBatchRollover,
    },
  };
}

