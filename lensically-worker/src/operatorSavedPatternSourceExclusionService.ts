type JsonRecord = Record<string, unknown>;

export interface OperatorSavedPatternSourceExclusionDependencies {
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  createId(): string;
  getPattern(patternId: number): Promise<{
    id: number;
    post_id: string | null;
    source_url: string | null;
  } | null>;
  canonicalizeSourceUrl(value: string | null): string | null;
  extractThreadsPostId(value: string | null): string | null;
  upsertExclusion(input: {
    id: string;
    brandKey: string;
    sourceIdentityKey: string;
    patternId: number;
    reason: string;
  }): Promise<unknown>;
  skipActiveSelections(input: {
    brandKey: string;
    patternId: number;
  }): Promise<number>;
  markActiveClaimsDeleted(input: {
    brandKey: string;
    patternId: number;
  }): Promise<unknown>;
}

export async function excludeOperatorSavedPatternSource(
  input: { brandKey: string; payload: JsonRecord },
  dependencies: OperatorSavedPatternSourceExclusionDependencies,
): Promise<{ status: number; body: JsonRecord }> {
  const patternId = Math.trunc(Number(input.payload.pattern_id ?? 0));
  const ownerApproval = dependencies.normalizeText(
    input.payload.owner_approval,
    500,
    true,
  ) ?? "";
  if (!Number.isInteger(patternId) || patternId <= 0 || !/delete/i.test(ownerApproval)) {
    return {
      status: 400,
      body: {
        success: false,
        error: "pattern_id and explicit owner_approval containing delete are required",
      },
    };
  }

  const pattern = await dependencies.getPattern(patternId);
  if (!pattern) {
    return {
      status: 200,
      body: {
        excluded_source_count: 0,
        preserved_pattern_count: 0,
        status: "not_found",
      },
    };
  }

  const canonicalUrl = dependencies.canonicalizeSourceUrl(pattern.source_url);
  const threadsPostId = String(
    pattern.post_id ?? dependencies.extractThreadsPostId(canonicalUrl) ?? "",
  ).trim();
  const sourceIdentityKey = threadsPostId
    ? `threads:${threadsPostId}`
    : canonicalUrl
      ? `url:${canonicalUrl}`
      : `saved_pattern:${patternId}`;

  await dependencies.upsertExclusion({
    id: dependencies.createId(),
    brandKey: input.brandKey,
    sourceIdentityKey,
    patternId,
    reason: ownerApproval,
  });
  const skippedActiveSelectionCount = await dependencies.skipActiveSelections({
    brandKey: input.brandKey,
    patternId,
  });
  await dependencies.markActiveClaimsDeleted({
    brandKey: input.brandKey,
    patternId,
  });

  return {
    status: 200,
    body: {
      status: "excluded_from_future_sources",
      pattern_id: patternId,
      source_identity_key: sourceIdentityKey,
      excluded_source_count: 1,
      preserved_pattern_count: 1,
      preserved_historical_data: true,
      skipped_active_selection_count: skippedActiveSelectionCount,
    },
  };
}
