type JsonRecord = Record<string, unknown>;

export interface OperatorContextAdmissionDependencies {
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  normalizeMachineKey(value: unknown, fallback?: string): string;
  createId(): string;
  insertAdmission(input: {
    admissionId: string;
    brandKey: string;
    workflowSessionId: string | null;
    snapshotId: string | null;
    admissionScope: string;
    sections: JsonRecord[];
    freshnessStartedAt: string | null;
    freshnessCompletedAt: string | null;
    isPartial: boolean;
    notes: string | null;
  }): Promise<unknown>;
}

export async function admitOperatorContext(
  input: { brandKey: string; payload: JsonRecord },
  dependencies: OperatorContextAdmissionDependencies,
): Promise<JsonRecord> {
  const sectionsInput = Array.isArray(input.payload.sections)
    ? input.payload.sections as JsonRecord[]
    : [];
  const coverage = sectionsInput.map((section) => {
    const returnedCount = Number(section.returned_count ?? section.limit ?? 0);
    const totalCount = Number(section.total_count ?? returnedCount);
    const hasMore = Boolean(section.has_more ?? (totalCount > returnedCount));
    const offset = Number(section.offset ?? 0);
    return {
      section: dependencies.normalizeMachineKey(section.section, "unknown"),
      returned_count: returnedCount,
      total_count: totalCount,
      limit: Number(section.limit ?? returnedCount),
      offset,
      offsets_read: Array.isArray(section.offsets_read) ? section.offsets_read : [offset],
      has_more: hasMore,
      coverage_status: section.coverage_status ?? (hasMore ? "partial" : "complete"),
      source: section.source ?? "existing_db",
      snapshot_id: section.snapshot_id ?? input.payload.snapshot_id ?? null,
    };
  });
  const isPartial = coverage.some((section) => (
    section.coverage_status === "partial" || section.has_more === true
  ));
  const admissionId = dependencies.createId();
  await dependencies.insertAdmission({
    admissionId,
    brandKey: input.brandKey,
    workflowSessionId: dependencies.normalizeText(input.payload.workflow_session_id, 120, true),
    snapshotId: dependencies.normalizeText(input.payload.snapshot_id, 120, true),
    admissionScope: dependencies.normalizeMachineKey(
      input.payload.admission_scope,
      "source_card_selection",
    ),
    sections: coverage,
    freshnessStartedAt: dependencies.normalizeText(input.payload.freshness_started_at, 80, true),
    freshnessCompletedAt: dependencies.normalizeText(input.payload.freshness_completed_at, 80, true),
    isPartial,
    notes: dependencies.normalizeText(input.payload.notes, 2000, true),
  });
  return {
    context_admission_id: admissionId,
    coverage,
    is_partial: isPartial,
    warnings: isPartial ? ["Context admission is partial."] : [],
  };
}
