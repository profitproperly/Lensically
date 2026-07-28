type JsonRecord = Record<string, unknown>;

export interface OperatorManifestSourceDrawDependencies {
  manifestBrandKey: string;
  eligibilityMinLikes: number;
  dailyDrawSize: number;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  createId(): string;
  nowIso(): string;
  getActiveSession(input: { workflowSessionId: string; brandKey: string }): Promise<boolean>;
  getExistingBatch(input: { workflowSessionId: string; brandKey: string }): Promise<JsonRecord | null>;
  listExistingSelections(input: { batchId: string; brandKey: string }): Promise<JsonRecord[]>;
  parseJsonString(value: string): unknown;
  buildQualifiedPool(sourceTypes: string[]): Promise<JsonRecord[]>;
  shuffleCandidates(candidates: JsonRecord[]): JsonRecord[];
  persistDraw(input: {
    batch: {
      id: string;
      brandKey: string;
      workflowSessionId: string;
      eligibilityMinLikes: number;
      qualifiedPoolCount: number;
      requestedCount: number;
      selectedCount: number;
      selectedAt: string;
      metadata: JsonRecord;
    };
    selections: Array<{
      id: string;
      batchId: string;
      brandKey: string;
      workflowSessionId: string;
      drawOrder: number;
      sourceIdentityKey: string;
      sourceType: string;
      internalSourceId: string;
      threadsPostId: string | null;
      canonicalSourceUrl: string | null;
      text: string;
      originalPostedAt: string | null;
      metricsSnapshot: JsonRecord;
      sourceSnapshot: JsonRecord;
      selectedAt: string;
    }>;
  }): Promise<unknown>;
  updateWorkflowStage(input: { workflowSessionId: string; brandKey: string }): Promise<unknown>;
}

export async function drawOperatorManifestSourceBatch(
  input: { brandKey: string; payload: JsonRecord },
  dependencies: OperatorManifestSourceDrawDependencies,
): Promise<{ status: number; body: JsonRecord }> {
  if (input.brandKey !== dependencies.manifestBrandKey) {
    return {
      status: 400,
      body: { success: false, error: "source_draw_not_configured_for_brand" },
    };
  }
  const workflowSessionId = dependencies.normalizeText(
    input.payload.workflow_session_id,
    120,
  );
  if (!workflowSessionId) {
    return {
      status: 400,
      body: { success: false, error: "workflow_session_id is required" },
    };
  }
  if (!await dependencies.getActiveSession({ workflowSessionId, brandKey: input.brandKey })) {
    return {
      status: 400,
      body: { success: false, error: "active_workflow_session_required" },
    };
  }

  const existingBatch = await dependencies.getExistingBatch({
    workflowSessionId,
    brandKey: input.brandKey,
  });
  if (existingBatch?.id) {
    const batchId = String(existingBatch.id);
    const rows = await dependencies.listExistingSelections({
      batchId,
      brandKey: input.brandKey,
    });
    return {
      status: 200,
      body: {
        source_batch_id: existingBatch.id,
        workflow_session_id: workflowSessionId,
        selection_method: existingBatch.selection_method,
        eligibility_min_likes: Number(
          existingBatch.eligibility_min_likes ?? dependencies.eligibilityMinLikes,
        ),
        qualified_pool_count: Number(existingBatch.qualified_pool_count ?? 0),
        selected_count: Number(existingBatch.selected_count ?? rows.length),
        cross_day_repetition_allowed: true,
        cross_day_cooldown_applied: false,
        posting_order_source: "draw_order",
        selections: rows.map((row) => ({
          source_selection_id: row.id,
          source_batch_id: row.batch_id,
          draw_order: Number(row.draw_order ?? 0),
          source_identity_key: row.source_identity_key,
          source_type: row.source_type,
          internal_source_id: row.internal_source_id,
          threads_post_id: row.threads_post_id ?? null,
          canonical_source_url: row.canonical_source_url ?? null,
          text: row.post_text,
          metrics_snapshot: dependencies.parseJsonString(
            String(row.metrics_snapshot_json ?? "{}"),
          ) ?? {},
          source_card_id: row.source_card_id ?? null,
        })),
        reused_existing: true,
        idempotency_reason: "workflow_source_batch_already_exists",
      },
    };
  }

  const sourceTypes = Array.isArray(input.payload.source_types)
    ? input.payload.source_types.map((value) => String(value))
    : [];
  const qualifiedPool = await dependencies.buildQualifiedPool(sourceTypes);
  if (qualifiedPool.length < dependencies.dailyDrawSize) {
    return {
      status: 400,
      body: {
        success: false,
        error: "insufficient_qualified_sources",
        eligibility_min_likes: dependencies.eligibilityMinLikes,
        qualified_pool_count: qualifiedPool.length,
        required_count: dependencies.dailyDrawSize,
      },
    };
  }

  const selectedAt = dependencies.nowIso();
  const batchId = dependencies.createId();
  const selectedCandidates = dependencies.shuffleCandidates(qualifiedPool)
    .slice(0, dependencies.dailyDrawSize);
  const selections = selectedCandidates.map((candidate, index) => {
    const selectionId = dependencies.createId();
    const metrics = candidate.metrics && typeof candidate.metrics === "object"
      ? candidate.metrics as JsonRecord
      : {};
    const metricsSnapshot = {
      ...metrics,
      captured_at: selectedAt,
      eligibility_min_likes: dependencies.eligibilityMinLikes,
    };
    return {
      persistence: {
        id: selectionId,
        batchId,
        brandKey: input.brandKey,
        workflowSessionId,
        drawOrder: index + 1,
        sourceIdentityKey: String(candidate.source_identity_key ?? ""),
        sourceType: String(candidate.source_type ?? ""),
        internalSourceId: String(candidate.internal_source_id ?? candidate.source_id ?? ""),
        threadsPostId: candidate.threads_post_id ? String(candidate.threads_post_id) : null,
        canonicalSourceUrl: candidate.canonical_source_url
          ? String(candidate.canonical_source_url)
          : null,
        text: String(candidate.text ?? ""),
        originalPostedAt: candidate.posted_at ? String(candidate.posted_at) : null,
        metricsSnapshot,
        sourceSnapshot: candidate,
        selectedAt,
      },
      response: {
        source_selection_id: selectionId,
        source_batch_id: batchId,
        draw_order: index + 1,
        ...candidate,
        metrics_snapshot: metricsSnapshot,
      },
    };
  });

  await dependencies.persistDraw({
    batch: {
      id: batchId,
      brandKey: input.brandKey,
      workflowSessionId,
      eligibilityMinLikes: dependencies.eligibilityMinLikes,
      qualifiedPoolCount: qualifiedPool.length,
      requestedCount: dependencies.dailyDrawSize,
      selectedCount: selections.length,
      selectedAt,
      metadata: {
        cross_day_cooldown_applied: false,
        cross_day_repetition_allowed: true,
        posting_order_source: "draw_order",
        performance_weighting_applied: false,
        dynamic_rank_recorded: false,
      },
    },
    selections: selections.map((selection) => selection.persistence),
  });
  await dependencies.updateWorkflowStage({
    workflowSessionId,
    brandKey: input.brandKey,
  });

  return {
    status: 200,
    body: {
      source_batch_id: batchId,
      workflow_session_id: workflowSessionId,
      selection_method: "uniform_random_without_replacement",
      eligibility_min_likes: dependencies.eligibilityMinLikes,
      qualified_pool_count: qualifiedPool.length,
      selected_count: selections.length,
      cross_day_repetition_allowed: true,
      cross_day_cooldown_applied: false,
      posting_order_source: "draw_order",
      selections: selections.map((selection) => selection.response),
    },
  };
}
