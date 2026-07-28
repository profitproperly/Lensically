type JsonRecord = Record<string, unknown>;

export interface OperatorManifestSourceCardBackfillPreparationDependencies {
  manifestBrandKey: string;
  loadState(input: { limit: number }): Promise<{
    savedPatternTotal: unknown;
    alreadyCardedCount: unknown;
    rows: JsonRecord[];
  }>;
  canonicalizeThreadsSourceUrl(value: string | null): string | null;
  extractThreadsPostIdFromUrl(value: string | null): string | null;
}

export async function prepareOperatorManifestSourceCardBackfill(
  input: { brandKey: string; payload: JsonRecord },
  dependencies: OperatorManifestSourceCardBackfillPreparationDependencies,
): Promise<{ status: number; body: JsonRecord }> {
  if (input.brandKey !== dependencies.manifestBrandKey) {
    return {
      status: 400,
      body: { success: false, error: "manifest_mental_required" },
    };
  }

  const limit = Math.min(Math.max(Math.trunc(Number(input.payload.limit ?? 8)), 1), 25);
  const state = await dependencies.loadState({ limit });
  const savedPatternTotal = Number(state.savedPatternTotal ?? 0);
  const alreadyCardedCount = Number(state.alreadyCardedCount ?? 0);
  const uncardedCount = Math.max(0, savedPatternTotal - alreadyCardedCount);
  const patterns = state.rows.map((row) => {
    const canonicalSourceUrl = dependencies.canonicalizeThreadsSourceUrl(
      typeof row.source_url === "string" ? row.source_url : null,
    );
    const threadsPostId = String(
      row.post_id ?? dependencies.extractThreadsPostIdFromUrl(canonicalSourceUrl) ?? "",
    ).trim() || null;
    const savedPatternId = Number(row.id);
    return {
      saved_pattern_id: savedPatternId,
      source_identity_key: threadsPostId
        ? `threads:${threadsPostId}`
        : canonicalSourceUrl
          ? `url:${canonicalSourceUrl}`
          : `saved_pattern:${savedPatternId}`,
      threads_post_id: threadsPostId,
      canonical_source_url: canonicalSourceUrl,
      post_text: row.post_text,
      posted_at: row.posted_at ?? null,
      capture_confidence: row.capture_confidence ?? null,
      source_updated_at: row.updated_at ?? null,
      metrics: {
        views: Number(row.views ?? 0),
        likes: Number(row.likes ?? 0),
        replies: Number(row.replies ?? 0),
        reposts: Number(row.reposts ?? 0),
        shares: Number(row.shares ?? 0),
        engagement_total: Number(row.likes ?? 0)
          + Number(row.replies ?? 0)
          + Number(row.reposts ?? 0)
          + Number(row.shares ?? 0),
      },
    };
  });

  return {
    status: 200,
    body: {
      success: true,
      brand_key: input.brandKey,
      status: uncardedCount === 0 ? "complete" : "ready",
      saved_pattern_total: savedPatternTotal,
      already_carded_count: alreadyCardedCount,
      uncarded_count: uncardedCount,
      batch_limit: limit,
      returned_count: patterns.length,
      patterns,
      completion_rule: "Complete only when every Saved Pattern has a linked source card.",
      interruption_rule: "Report an uncarded count only when execution is forced to stop before completion.",
    },
  };
}
