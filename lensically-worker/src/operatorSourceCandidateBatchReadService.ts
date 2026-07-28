type JsonRecord = Record<string, unknown>;

export interface OperatorSourceCandidateBatchReadDependencies {
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  loadBatch(batchId: string): Promise<JsonRecord | null>;
  listSelections(batchId: string): Promise<JsonRecord[]>;
  parseJson(value: string): unknown;
}

export async function readOperatorSourceCandidateBatch(
  payload: JsonRecord,
  dependencies: OperatorSourceCandidateBatchReadDependencies,
): Promise<{ status: number; body: JsonRecord }> {
  const batchId = dependencies.normalizeText(payload.source_batch_id, 120);
  if (!batchId) {
    return {
      status: 400,
      body: { success: false, error: "source_batch_id is required" },
    };
  }

  const batch = await dependencies.loadBatch(batchId);
  if (!batch) {
    return {
      status: 404,
      body: { success: false, error: "source_batch_not_found" },
    };
  }

  const rows = await dependencies.listSelections(batchId);
  return {
    status: 200,
    body: {
      source_batch: {
        ...batch,
        metadata: dependencies.parseJson(String(batch.metadata_json ?? "{}")) ?? {},
      },
      selections: rows.map((row) => ({
        source_selection_id: row.id,
        source_batch_id: row.batch_id,
        draw_order: Number(row.draw_order ?? 0),
        source_identity_key: row.source_identity_key,
        source_type: row.source_type,
        internal_source_id: row.internal_source_id,
        threads_post_id: row.threads_post_id ?? null,
        canonical_source_url: row.canonical_source_url ?? null,
        post_text: row.post_text,
        original_posted_at: row.original_posted_at ?? null,
        metrics_snapshot: dependencies.parseJson(String(row.metrics_snapshot_json ?? "{}")) ?? {},
        source_snapshot: dependencies.parseJson(String(row.source_snapshot_json ?? "{}")) ?? {},
        source_card_id: row.source_card_id ?? null,
        canonical_family_id: row.canonical_family_id ?? null,
        canonical_source_card_id: row.canonical_source_card_id ?? null,
        canonical_source_card_version: row.canonical_source_card_version === null
          || row.canonical_source_card_version === undefined
          ? null
          : Number(row.canonical_source_card_version),
        canonical_source_card_status: row.canonical_source_card_status ?? null,
        disposition: row.disposition ?? "pending",
        disposition_reason: row.disposition_reason ?? null,
        disposition_at: row.disposition_at ?? null,
        workflow_sequence: row.workflow_sequence === null || row.workflow_sequence === undefined
          ? null
          : Number(row.workflow_sequence),
        selected_at: row.selected_at,
      })),
    },
  };
}
