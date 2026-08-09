type JsonRecord = Record<string, unknown>;

const MANIFEST_BATCH_RESPONSE_SLICE_MS = 6000;

export type OperatorManifestBatchCandidateResult = JsonRecord & {
  success?: boolean;
  slot_key?: unknown;
  scheduled_post_id?: unknown;
  error?: unknown;
  outcome?: unknown;
  batch_reconciliation_context?: unknown;
};

export interface OperatorManifestBatchPersistenceDependencies {
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  nowMs(): number;
  persistCandidate(
    payload: JsonRecord,
    options: {
      deferCoverageReconciliation: true;
      batchOperationId: string;
    },
  ): Promise<OperatorManifestBatchCandidateResult>;
  reconcileBatch(input: {
    brandKey: string;
    cycleId: string;
    batchOperationId: string;
    persistedCandidates: Array<{
      operation_id: string;
      slot_key: string;
      scheduled_post_id: number;
    }>;
    strategicThesis: JsonRecord;
    outputStrategyVersionId: string | null;
    fallbackCycle: JsonRecord;
    fallbackTimezone: string;
  }): Promise<JsonRecord>;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function candidateRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((candidate): candidate is JsonRecord => (
      Boolean(candidate) && typeof candidate === "object" && !Array.isArray(candidate)
    ))
    : [];
}

function publicCandidateResult(
  index: number,
  result: OperatorManifestBatchCandidateResult,
): JsonRecord {
  const { batch_reconciliation_context: _internalContext, ...publicResult } = result;
  if (result.success !== true) {
    return { index, ...publicResult };
  }
  const lineage = record(result.lineage);
  return {
    index,
    success: true,
    reused: result.reused === true,
    operation_id: result.operation_id ?? null,
    slot_key: result.slot_key ?? null,
    scheduled_post_id: Number(result.scheduled_post_id ?? 0),
    scheduled_time_utc: result.scheduled_time_utc ?? null,
    publish_lineage_complete: result.publish_lineage_complete === true,
    intelligence_lineage_complete: result.intelligence_lineage_complete === true,
    lineage: {
      source_selection_id: lineage.source_selection_id ?? null,
      source_card_id: lineage.source_card_id ?? null,
      source_card_family_id: lineage.source_card_family_id ?? null,
      generation_run_id: lineage.generation_run_id ?? null,
      draft_id: lineage.draft_id ?? null,
      hypothesis_id: lineage.hypothesis_id ?? null,
      strategy_version_id: lineage.strategy_version_id ?? result.strategy_version_id ?? null,
    },
    coverage_reconciliation_deferred: result.coverage_reconciliation_deferred === true,
  };
}

export async function persistOperatorManifestBatch(
  input: {
    brandKey: string;
    defaultTimezone: string;
    payload: JsonRecord;
  },
  dependencies: OperatorManifestBatchPersistenceDependencies,
): Promise<JsonRecord> {
  const batchOperationId = dependencies.normalizeText(input.payload.batch_operation_id, 160, true);
  const cycleId = dependencies.normalizeText(input.payload.cycle_id, 160, true);
  const cycleStrategyId = dependencies.normalizeText(input.payload.cycle_strategy_id, 160, true);
  const candidates = candidateRecords(input.payload.candidates);

  if (!batchOperationId || !cycleId || !cycleStrategyId) {
    return {
      success: false,
      error: "batch_operation_cycle_and_strategy_required",
      retryable: false,
    };
  }
        if (candidates.length < 1 || candidates.length > 2) {
    return {
      success: false,
      error: "main_manifest_persistence_batch_size_must_be_1_to_2",
      candidate_count: candidates.length,
      maximum_safe_candidate_count: 2,
      prevention_reason: "Cloudflare Worker subrequest budget for production gate, lineage, schedule, and reconciliation writes.",
      retryable: false,
    };
  }


  const startedAtMs = dependencies.nowMs();
    const itemResults: JsonRecord[] = [];
  const persistedCandidates: Array<{
    operation_id: string;
    slot_key: string;
    scheduled_post_id: number;
  }> = [];
  const deferredCandidates: JsonRecord[] = [];
  const reconciliationContexts: JsonRecord[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const operationId = dependencies.normalizeText(candidate.operation_id, 160, true);
    if (!operationId) {
      itemResults.push({
        index,
        success: false,
        error: "candidate_operation_id_required",
        slot_key: null,
        retryable: false,
      });
      continue;
    }

    const result = await dependencies.persistCandidate({
      ...candidate,
      operation_id: operationId,
      cycle_id: cycleId,
      cycle_strategy_id: cycleStrategyId,
    }, {
      deferCoverageReconciliation: true,
      batchOperationId,
    });
    const reconciliationContext = record(result.batch_reconciliation_context);
    itemResults.push(publicCandidateResult(index, result));

    const scheduledPostId = Number(result.scheduled_post_id ?? 0);
    const slotKey = dependencies.normalizeText(
      result.slot_key ?? reconciliationContext.slot_key,
      160,
      true,
    );
        if (result.success === true && scheduledPostId > 0 && slotKey && Object.keys(reconciliationContext).length) {
      persistedCandidates.push({
        operation_id: operationId,
        slot_key: slotKey,
        scheduled_post_id: scheduledPostId,
      });
      reconciliationContexts.push(reconciliationContext);
    }

    if (index < candidates.length - 1) {
      const batchElapsedMs = Math.max(0, dependencies.nowMs() - startedAtMs);
      if (batchElapsedMs >= MANIFEST_BATCH_RESPONSE_SLICE_MS) {
        for (let deferredIndex = index + 1; deferredIndex < candidates.length; deferredIndex += 1) {
          const deferredCandidate = candidates[deferredIndex];
          const deferredPost = record(deferredCandidate.post);
          const deferredDate = dependencies.normalizeText(deferredPost.date, 20, true);
          const deferredTime = dependencies.normalizeText(deferredPost.time, 20, true);
          deferredCandidates.push({
            index: deferredIndex,
            operation_id: dependencies.normalizeText(deferredCandidate.operation_id, 160, true),
            cycle_plan_item_id: dependencies.normalizeText(deferredCandidate.cycle_plan_item_id, 160, true),
            slot_key: deferredDate && deferredTime ? `${deferredDate}T${deferredTime}` : null,
            reason: "batch_response_time_slice_exhausted",
            retryable: true,
          });
        }
        break;
      }
    }
  }

    const persistenceCompletedAtMs = dependencies.nowMs();
  const candidatePersistenceMs = Math.max(0, persistenceCompletedAtMs - startedAtMs);
  const rejected = itemResults.filter((result) => !(
    result.success === true && Number(result.scheduled_post_id ?? 0) > 0
  ));
  const rejectedSlots = rejected.map((result) => ({
    index: result.index,
    slot_key: result.slot_key ?? null,
    error: result.error ?? result.outcome ?? "candidate_not_persisted",
  }));

  if (!persistedCandidates.length) {
    return {
      success: false,
      partial_success: false,
      batch_operation_id: batchOperationId,
      cycle_id: cycleId,
      requested_count: candidates.length,
      accepted_count: 0,
      rejected_count: rejected.length,
      results: itemResults,
      rejected_slots: rejectedSlots,
            reconciliation: null,
      reconciliation_count: 0,
      timing: {
        policy: "telemetry_only",
        candidate_persistence_ms: candidatePersistenceMs,
        reconciliation_ms: 0,
        total_elapsed_ms: candidatePersistenceMs,
      },
      retryable: true,
    };
  }

  const lastContext = reconciliationContexts[reconciliationContexts.length - 1] ?? {};
    const reconciliation = await dependencies.reconcileBatch({
    brandKey: input.brandKey,
    cycleId,
    batchOperationId,
    persistedCandidates,
    strategicThesis: record(lastContext.strategic_thesis),
    outputStrategyVersionId: dependencies.normalizeText(
      lastContext.output_strategy_version_id,
      160,
      true,
    ),
    fallbackCycle: record(lastContext.fallback_cycle),
        fallbackTimezone: dependencies.normalizeText(lastContext.fallback_timezone, 100, true)
      ?? input.defaultTimezone,
  });
  const completedAtMs = dependencies.nowMs();
  const reconciliationMs = Math.max(0, completedAtMs - persistenceCompletedAtMs);

    return {
    success: rejected.length === 0 && deferredCandidates.length === 0 && itemResults.length === candidates.length,
    partial_success: persistedCandidates.length > 0 && (rejected.length > 0 || deferredCandidates.length > 0),
    batch_operation_id: batchOperationId,
    cycle_id: cycleId,
    requested_count: candidates.length,
    processed_count: itemResults.length,
    accepted_count: persistedCandidates.length,
    rejected_count: rejected.length,
    deferred_count: deferredCandidates.length,
    continuation_required: deferredCandidates.length > 0,
    deferred_candidates: deferredCandidates,
    results: itemResults,
    accepted_slots: persistedCandidates.map((candidate) => candidate.slot_key),
    rejected_slots: rejectedSlots,
        reconciliation,
    reconciliation_count: 1,
    timing: {
      policy: "telemetry_only",
      candidate_persistence_ms: candidatePersistenceMs,
      reconciliation_ms: reconciliationMs,
      total_elapsed_ms: Math.max(0, completedAtMs - startedAtMs),
    },
    retryable: rejected.length > 0,
    next_action: rejected.length
      ? "Regenerate only the rejected slots using their exact server reasons, then submit one bounded batch containing only those replacements."
      : reconciliation.next_action,
  };
}
