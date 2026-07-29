type JsonRecord = Record<string, unknown>;

export interface OperatorPublishedPostLineageAuditDependencies {
  listRows(input: {
    minimumLikes: number;
    days: number;
    limit: number;
  }): Promise<JsonRecord[]>;
}

export async function auditOperatorPublishedPostLineage(
  input: { brandKey: string; payload: JsonRecord },
  dependencies: OperatorPublishedPostLineageAuditDependencies,
): Promise<JsonRecord> {
  const minimumLikes = Math.max(1, Math.trunc(Number(input.payload.minimum_likes ?? 1000)));
  const days = Math.min(Math.max(Math.trunc(Number(input.payload.days ?? 30)), 1), 90);
  const limit = Math.min(Math.max(Math.trunc(Number(input.payload.limit ?? 25)), 1), 50);
  const rows = await dependencies.listRows({ minimumLikes, days, limit });

  const posts = rows.map((row) => {
    const missingStages: string[] = [];
    if (!row.source_selection_id || !row.source_batch_id) missingStages.push("source");
    if (!row.source_card_id) missingStages.push("source_card");
    if (!row.generation_run_id) missingStages.push("generation_run");
    if (!row.draft_id) missingStages.push("draft");
    if (!row.scheduled_post_id) missingStages.push("scheduled_post");
    if (Number(row.linked_metric_snapshot_count ?? 0) < 1) missingStages.push("metrics");
    return {
      published_post_id: row.post_id,
      post_text: row.post_text,
      posted_at: row.post_timestamp,
      post_permalink: row.post_permalink,
      metrics: {
        views: Number(row.views ?? 0),
        likes: Number(row.likes ?? 0),
        replies: Number(row.replies ?? 0),
        reposts: Number(row.reposts ?? 0),
        quotes: Number(row.quotes ?? 0),
        shares: Number(row.shares ?? 0),
        engagement_total: Number(row.engagement_total ?? 0),
        last_synced_at: row.last_synced_at ?? null,
      },
      lineage: {
        source_batch_id: row.source_batch_id ?? null,
        source_selection_id: row.source_selection_id ?? null,
        source_identity_key: row.source_identity_key ?? null,
        source_type: row.source_type ?? null,
        saved_pattern_id: row.source_type === "saved_pattern"
            && row.internal_source_id !== null
            && row.internal_source_id !== undefined
          ? Number(row.internal_source_id)
          : null,
        source_card_id: row.source_card_id ?? null,
        generation_run_id: row.generation_run_id ?? null,
        draft_id: row.draft_id ?? null,
        scheduled_post_id: row.scheduled_post_id === null || row.scheduled_post_id === undefined
          ? null
          : Number(row.scheduled_post_id),
        published_post_id: row.post_id,
        metric_snapshot_count: Number(row.metric_snapshot_count ?? 0),
        linked_metric_snapshot_count: Number(row.linked_metric_snapshot_count ?? 0),
      },
      complete: missingStages.length === 0,
      missing_stages: missingStages,
    };
  });

    return {
    success: true,
    brand_key: input.brandKey,
    criteria: { minimum_likes: minimumLikes, days, limit },
    audited_count: posts.length,
    complete_count: posts.filter((post) => post.complete).length,
    incomplete_count: posts.filter((post) => !post.complete).length,
    posts,
  };
}

export interface OperatorPublishedPostLineageRecoveryDependencies {
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  nowMillis(): number;
  callTool(toolName: string, payload: JsonRecord): Promise<JsonRecord>;
  recoverLineage(payload: JsonRecord, minimumVerifiedLikes: number): Promise<{
    payload: JsonRecord;
    status: number;
  }>;
}

export async function recoverOperatorPublishedPostLineage(
  input: {
    brandKey: string;
    payload: JsonRecord;
    manifestBrandKey: string;
    minimumVerifiedLikes: number;
  },
  dependencies: OperatorPublishedPostLineageRecoveryDependencies,
): Promise<{ status: number; body: JsonRecord }> {
  const compatibilityWorkflowSessionId = dependencies.normalizeText(
    input.payload.workflow_session_id,
    120,
    true,
  );
  const compatibilitySourceCard = input.payload.source_card
    && typeof input.payload.source_card === "object"
    && !Array.isArray(input.payload.source_card)
    ? input.payload.source_card as JsonRecord
    : {};
  const compatibilitySourceCardTitle = dependencies.normalizeText(
    compatibilitySourceCard.title,
    200,
    true,
  );

  if (input.brandKey === input.manifestBrandKey && (
    compatibilityWorkflowSessionId === "all_missing_manifest_source_cards"
    || compatibilitySourceCardTitle === "all_missing_manifest_source_cards"
  )) {
    const bridgeOperationId = dependencies.normalizeText(input.payload.operation_id, 160, true)
      ?? `manifest-source-card-backfill-recovery-bridge-${dependencies.nowMillis()}`;
    const backfill = await dependencies.callTool("create_all_missing_manifest_source_cards", {
      brand_key: input.brandKey,
      limit: 4,
      proceed_confirmed: true,
      operation_id: `${bridgeOperationId}-batch`,
    });
    const backfillHttpStatus = Math.trunc(Number(backfill.http_status ?? 200));
    return {
      status: backfillHttpStatus >= 100 && backfillHttpStatus <= 599
        ? backfillHttpStatus
        : 200,
      body: {
        ...backfill,
        compatibility_bridge: "recover_published_post_lineage.workflow_session_id",
      },
    };
  }

  const recovered = await dependencies.recoverLineage(
    input.payload,
    input.minimumVerifiedLikes,
  );
  return {
    status: recovered.status,
    body: recovered.payload,
  };
}

