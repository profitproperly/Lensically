type JsonRecord = Record<string, unknown>;

export interface OperatorSourceCardAdmissionInput {
  brandKey: string;
  payload: JsonRecord;
  sourceCardId: string;
  defaultSequenceTimestamp: number;
  selectedAt: string;
}

export interface OperatorSavedPatternSelectionPersistenceInput {
  brandKey: string;
  savedPatternId: number;
  backfillSessionId: string;
  batchId: string;
  selectionId: string;
  selectedAt: string;
  sourceIdentityKey: string;
  threadsPostId: string | null;
  canonicalSourceUrl: string | null;
  metrics: JsonRecord;
  sourceSnapshot: JsonRecord;
  pattern: JsonRecord;
}

export interface OperatorSourceCardAdmissionDependencies {
  manifestBrandKey: string;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  getWorkflowConflict(payload: JsonRecord): string | null;
  normalizeTransformationContract(value: unknown): JsonRecord;
  canonicalizeSourceUrl(value: string | null): string | null;
  extractPostIdFromUrl(value: string | null): string | null;
  parseJson(value: string): unknown;
  runBackfillBridge(operationId: string): Promise<JsonRecord>;
  loadSavedPattern(savedPatternId: number): Promise<JsonRecord | null>;
  persistSavedPatternSelection(input: OperatorSavedPatternSelectionPersistenceInput): Promise<void>;
  loadSelection(sourceSelectionId: string): Promise<JsonRecord | null>;
  loadSourceCard(sourceCardId: string): Promise<JsonRecord | null>;
  validateSourceCard(sourceCard: JsonRecord): unknown;
}

export interface OperatorSourceCardAdmissionContext {
  sourceCardId: string;
  sourceMechanism: string | null;
  requiredProduct: string | null;
  workflowSessionId: string | null;
  sequenceLabel: string;
  primarySource: unknown;
  metricsSnapshot: unknown;
  sourceSelectionId: string | null;
  savedPatternId: number | null;
  versionReason: string | null;
  createNewVersion: boolean;
  transformationContract: JsonRecord;
  selection: JsonRecord | null;
}

export type OperatorSourceCardAdmissionResult =
  | { kind: "response"; status: number; body: JsonRecord }
  | { kind: "continue"; context: OperatorSourceCardAdmissionContext };

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function admitOperatorSourceCardCreation(
  input: OperatorSourceCardAdmissionInput,
  dependencies: OperatorSourceCardAdmissionDependencies,
): Promise<OperatorSourceCardAdmissionResult> {
  const { brandKey, payload } = input;
  const compatibilitySequenceLabel = dependencies.normalizeText(payload.sequence_label, 120, true);
  if (brandKey === dependencies.manifestBrandKey
      && compatibilitySequenceLabel === "all_missing_manifest_source_cards") {
    const bridgeOperationId = dependencies.normalizeText(payload.operation_id, 160, true)
      ?? `manifest-source-card-backfill-bridge-${input.defaultSequenceTimestamp}`;
    const backfill = await dependencies.runBackfillBridge(`${bridgeOperationId}-batch`);
    const backfillHttpStatus = Math.trunc(Number(backfill.http_status ?? 200));
    return {
      kind: "response",
      status: backfillHttpStatus >= 100 && backfillHttpStatus <= 599 ? backfillHttpStatus : 200,
      body: {
        ...backfill,
        compatibility_bridge: "create_source_card.sequence_label",
      },
    };
  }

  const workflowConflict = dependencies.getWorkflowConflict(payload);
  if (workflowConflict) {
    return {
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "lensically_saved_workflow_required",
        reason: workflowConflict,
        required_workflow: "Use the selected account's saved workflow before creating source cards. Do not create batch or multi-post source cards unless a backend-supported override exists for that account.",
      },
    };
  }

  const sourceMechanism = dependencies.normalizeText(payload.source_mechanism, 4000);
  const requiredProduct = dependencies.normalizeText(payload.required_product, 4000);
  let workflowSessionId = dependencies.normalizeText(payload.workflow_session_id, 120, true);
  let sequenceLabel = dependencies.normalizeText(payload.sequence_label, 120)
    || `source_card_${input.defaultSequenceTimestamp}`;
  let primarySource: unknown = payload.primary_source ?? {};
  let metricsSnapshot: unknown = payload.metrics_snapshot ?? null;
  let sourceSelectionId: string | null = null;
  const parsedSavedPatternId = Number(payload.saved_pattern_id);
  const savedPatternId = Number.isInteger(parsedSavedPatternId) && parsedSavedPatternId > 0
    ? parsedSavedPatternId
    : null;
  const versionReason = dependencies.normalizeText(payload.version_reason, 2000, true);
  const createNewVersion = payload.create_new_version === true;
  const transformationContract = dependencies.normalizeTransformationContract(payload.transformation_contract);
  let selection: JsonRecord | null = null;

  if (brandKey === dependencies.manifestBrandKey) {
    sourceSelectionId = dependencies.normalizeText(payload.source_selection_id, 120);
    if (!sourceSelectionId && savedPatternId !== null) {
      const pattern = await dependencies.loadSavedPattern(savedPatternId);
      if (!pattern) {
        return {
          kind: "response",
          status: 404,
          body: { success: false, error: "saved_pattern_not_found", saved_pattern_id: savedPatternId },
        };
      }

      const backfillSessionId = `${brandKey}-source-card-backfill-session`;
      const batchId = `manifest-source-card-backfill-${savedPatternId}`;
      const selectionId = `manifest-source-card-selection-${savedPatternId}`;
      const canonicalSourceUrl = dependencies.canonicalizeSourceUrl(
        typeof pattern.source_url === "string" ? pattern.source_url : null,
      );
      const threadsPostId = String(
        pattern.post_id ?? dependencies.extractPostIdFromUrl(canonicalSourceUrl) ?? "",
      ).trim() || null;
      const sourceIdentityKey = threadsPostId
        ? `threads:${threadsPostId}`
        : canonicalSourceUrl
          ? `url:${canonicalSourceUrl}`
          : `saved_pattern:${savedPatternId}`;
      const metrics = {
        views: Number(pattern.views ?? 0),
        likes: Number(pattern.likes ?? 0),
        replies: Number(pattern.replies ?? 0),
        reposts: Number(pattern.reposts ?? 0),
        quotes: 0,
        shares: Number(pattern.shares ?? 0),
        engagement_total: Number(pattern.likes ?? 0)
          + Number(pattern.replies ?? 0)
          + Number(pattern.reposts ?? 0)
          + Number(pattern.shares ?? 0),
        captured_at: input.selectedAt,
      };
      const sourceSnapshot = {
        source_candidate_id: `saved_pattern:${savedPatternId}`,
        source_identity_key: sourceIdentityKey,
        source_type: "saved_pattern",
        source_id: savedPatternId,
        internal_source_id: String(savedPatternId),
        threads_post_id: threadsPostId,
        canonical_source_url: canonicalSourceUrl,
        text: pattern.post_text,
        metrics,
        posted_at: pattern.posted_at ?? null,
        capture_confidence: pattern.capture_confidence ?? null,
        source_updated_at: pattern.updated_at ?? null,
        evidence_role: "market_evidence",
      };

      await dependencies.persistSavedPatternSelection({
        brandKey,
        savedPatternId,
        backfillSessionId,
        batchId,
        selectionId,
        selectedAt: input.selectedAt,
        sourceIdentityKey,
        threadsPostId,
        canonicalSourceUrl,
        metrics,
        sourceSnapshot,
        pattern,
      });
      sourceSelectionId = selectionId;
    }

    if (!sourceSelectionId) {
      return {
        kind: "response",
        status: 400,
        body: { success: false, error: "manifest_source_selection_id_or_saved_pattern_id_required" },
      };
    }

    selection = await dependencies.loadSelection(sourceSelectionId);
    if (!selection) {
      return {
        kind: "response",
        status: 404,
        body: { success: false, error: "source_selection_not_found" },
      };
    }

    if (selection.source_card_id && !createNewVersion) {
      const linkedCard = await dependencies.loadSourceCard(String(selection.source_card_id));
      return {
        kind: "response",
        status: 200,
        body: {
          source_card_id: selection.source_card_id,
          source_selection_id: sourceSelectionId,
          family_id: linkedCard?.family_id ?? null,
          version_number: linkedCard?.version_number ?? 1,
          status: linkedCard?.status ?? "unknown",
          reused_existing: true,
          reason: "selection_already_resolved",
          validation: linkedCard ? dependencies.validateSourceCard(linkedCard) : null,
        },
      };
    }

    const selectionWorkflowSessionId = String(selection.workflow_session_id ?? "");
    if (workflowSessionId && workflowSessionId !== selectionWorkflowSessionId) {
      return {
        kind: "response",
        status: 400,
        body: { success: false, error: "source_selection_workflow_mismatch" },
      };
    }

    workflowSessionId = selectionWorkflowSessionId || null;
    const sourceSnapshot = dependencies.parseJson(String(selection.source_snapshot_json ?? "{}")) ?? {};
    primarySource = {
      ...(isRecord(sourceSnapshot) ? sourceSnapshot : {}),
      source_selection_id: sourceSelectionId,
      source_batch_id: selection.batch_id,
      draw_order: Number(selection.draw_order ?? 0),
      source_identity_key: selection.source_identity_key,
      threads_post_id: selection.threads_post_id ?? null,
      canonical_source_url: selection.canonical_source_url ?? null,
    };
    metricsSnapshot = dependencies.parseJson(String(selection.metrics_snapshot_json ?? "{}")) ?? {};
    sequenceLabel = dependencies.normalizeText(payload.sequence_label, 120)
      || `daily_draw_${String(selection.batch_id ?? "batch")}_slot_${String(selection.draw_order ?? "")}`;
  } else if (!isRecord(payload.primary_source)) {
    return {
      kind: "response",
      status: 400,
      body: { success: false, error: "primary_source is required" },
    };
  }

  return {
    kind: "continue",
    context: {
      sourceCardId: input.sourceCardId,
      sourceMechanism,
      requiredProduct,
      workflowSessionId,
      sequenceLabel,
      primarySource,
      metricsSnapshot,
      sourceSelectionId,
      savedPatternId,
      versionReason,
      createNewVersion,
      transformationContract,
      selection,
    },
  };
}
