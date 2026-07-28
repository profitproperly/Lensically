type JsonRecord = Record<string, unknown>;

export interface OperatorSourceCandidateListDependencies {
  manifestBrandKey: string;
  manifestSourceMinVerifiedLikes: number;
  listCandidates(input: {
    brandKey: string;
    sourceTypes: string[];
    limit: number;
    offset: number;
  }): Promise<{ candidates: unknown[]; totalCount: number }>;
}

export async function listOperatorSourceCandidates(
  input: { brandKey: string; payload: JsonRecord },
  dependencies: OperatorSourceCandidateListDependencies,
): Promise<JsonRecord> {
  const sourceTypes = Array.isArray(input.payload.source_types)
    ? input.payload.source_types.map((value) => String(value))
    : [];
  const limit = Number(input.payload.limit ?? 50);
  const offset = Number(input.payload.offset ?? 0);
  const { candidates, totalCount } = await dependencies.listCandidates({
    brandKey: input.brandKey,
    sourceTypes,
    limit,
    offset,
  });
  return {
    candidates,
    returned_count: candidates.length,
    total_count: totalCount,
    has_more: offset + candidates.length < totalCount,
    eligibility_min_likes: input.brandKey === dependencies.manifestBrandKey
      ? dependencies.manifestSourceMinVerifiedLikes
      : null,
  };
}
