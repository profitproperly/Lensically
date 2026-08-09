import { describe, expect, it, vi } from "vitest";
import {
  persistOperatorManifestBatch,
  type OperatorManifestBatchPersistenceDependencies,
} from "../src/operatorManifestBatchPersistenceService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function reconciliationContext(slotKey: string): JsonRecord {
  return {
    cycle_id: "cycle-1",
    slot_key: slotKey,
    strategic_thesis: { directive: "preserve winner" },
    output_strategy_version_id: "strategy-output-1",
    fallback_cycle: {
      id: "cycle-1",
      timezone: "America/New_York",
      target_slots: [],
      scheduled_post_ids: [],
    },
    fallback_timezone: "America/New_York",
  };
}

function createDependencies(): {
  dependencies: OperatorManifestBatchPersistenceDependencies;
  persistCandidate: ReturnType<typeof vi.fn>;
  reconcileBatch: ReturnType<typeof vi.fn>;
} {
    let clockMs = 1_000;
  const nowMs = vi.fn(() => {
    const current = clockMs;
    clockMs += 10;
    return current;
  });
  const persistCandidate = vi.fn(async (payload: JsonRecord) => {
    const operationId = String(payload.operation_id ?? "");
    if (operationId === "candidate-2") {
      return {
        success: false,
        slot_key: "2026-07-30T20:00",
        error: "semantic_repetition_collision",
        retryable: true,
      };
    }
    const suffix = operationId.endsWith("1") ? 1 : 3;
    const slotKey = `2026-07-30T${suffix === 1 ? "19" : "21"}:00`;
    return {
      success: true,
      operation_id: operationId,
      slot_key: slotKey,
      scheduled_post_id: 90 + suffix,
            publish_lineage_complete: true,
      intelligence_lineage_complete: true,
      lineage: {
        source_selection_id: `selection-${suffix}`,
        source_card_id: `card-${suffix}`,
        source_card_family_id: `family-${suffix}`,
        generation_run_id: `run-${suffix}`,
        draft_id: `draft-${suffix}`,
        hypothesis_id: `hypothesis-${suffix}`,
        strategy_version_id: "strategy-output-1",
      },
      semantic_repetition: { verbose: "persisted server evidence" },
      decision_influence: { verbose: "persisted server evidence" },
      server_checks: { verbose: "persisted server evidence" },
      coverage_reconciliation_deferred: true,
      batch_reconciliation_context: reconciliationContext(slotKey),
    };
  });
  const reconcileBatch = vi.fn(async (input: JsonRecord) => ({
    batch_operation_id: input.batchOperationId,
    reconciliation_count: 1,
    remaining_missing_count: 5,
    next_action: "Continue from the locked cycle plan.",
  }));
  return {
    persistCandidate,
    reconcileBatch,
        dependencies: {
      normalizeText,
      nowMs,
      persistCandidate,
      reconcileBatch,
    },
  };
}

describe("operatorManifestBatchPersistenceService", () => {
    it("preserves successful siblings and reconciles once for a safe two-post Main batch", async () => {
    const harness = createDependencies();
    const result = await persistOperatorManifestBatch({
      brandKey: "manifest_mental",
      defaultTimezone: "America/New_York",
      payload: {
        batch_operation_id: "batch-1",
        cycle_id: "cycle-1",
        cycle_strategy_id: "strategy-1",
        candidates: [
                    { operation_id: "candidate-1", cycle_plan_item_id: "plan-1", post: {}, model_evaluation: {} },
          { operation_id: "candidate-2", cycle_plan_item_id: "plan-2", post: {}, model_evaluation: {} },
        ],
      },
    }, harness.dependencies);

    expect(result).toMatchObject({
      success: false,
      partial_success: true,
            requested_count: 2,
      accepted_count: 1,
      rejected_count: 1,
      accepted_slots: ["2026-07-30T19:00"],
      rejected_slots: [{
        index: 1,
        slot_key: "2026-07-30T20:00",
        error: "semantic_repetition_collision",
      }],
      reconciliation_count: 1,
            reconciliation: {
        reconciliation_count: 1,
        remaining_missing_count: 5,
      },
      timing: {
        policy: "telemetry_only",
                candidate_persistence_ms: 20,
        reconciliation_ms: 10,
        total_elapsed_ms: 30,
      },
    });
        expect(harness.persistCandidate).toHaveBeenCalledTimes(2);
    for (const call of harness.persistCandidate.mock.calls) {
      expect(call[1]).toEqual({
        deferCoverageReconciliation: true,
        batchOperationId: "batch-1",
      });
    }
    expect(harness.reconcileBatch).toHaveBeenCalledTimes(1);
    expect(harness.reconcileBatch).toHaveBeenCalledWith(expect.objectContaining({
      brandKey: "manifest_mental",
      cycleId: "cycle-1",
      batchOperationId: "batch-1",
            persistedCandidates: [
        { operation_id: "candidate-1", slot_key: "2026-07-30T19:00", scheduled_post_id: 91 },
      ],
    }));
        for (const item of result.results as JsonRecord[]) {
      expect(item).not.toHaveProperty("batch_reconciliation_context");
    }
    const accepted = (result.results as JsonRecord[]).filter((item) => item.success === true);
        expect(accepted).toHaveLength(1);
    for (const item of accepted) {
      expect(item).not.toHaveProperty("semantic_repetition");
      expect(item).not.toHaveProperty("decision_influence");
      expect(item).not.toHaveProperty("server_checks");
      expect(item).toMatchObject({
        publish_lineage_complete: true,
        intelligence_lineage_complete: true,
        coverage_reconciliation_deferred: true,
        lineage: expect.objectContaining({
          source_card_id: expect.any(String),
          source_card_family_id: expect.any(String),
          generation_run_id: expect.any(String),
          draft_id: expect.any(String),
          hypothesis_id: expect.any(String),
          strategy_version_id: "strategy-output-1",
        }),
      });
    }
    expect((result.results as JsonRecord[])[1]).toMatchObject({
      success: false,
      error: "semantic_repetition_collision",
      retryable: true,
    });
  });

    it("defers an unstarted sibling when the first candidate consumes the response-time slice", async () => {
    const harness = createDependencies();
    const times = [1000, 7010, 7020, 7030, 7040];
    let timeIndex = 0;
    harness.dependencies.nowMs = vi.fn(() => times[Math.min(timeIndex++, times.length - 1)]);
    harness.persistCandidate.mockResolvedValue({
      success: true,
      operation_id: "candidate-1",
      slot_key: "2026-08-10T23:00",
      scheduled_post_id: 303,
      publish_lineage_complete: true,
      intelligence_lineage_complete: true,
      coverage_reconciliation_deferred: true,
      batch_reconciliation_context: reconciliationContext("2026-08-10T23:00"),
    });

    const result = await persistOperatorManifestBatch({
      brandKey: "manifest_mental",
      defaultTimezone: "America/New_York",
      payload: {
        batch_operation_id: "batch-slow",
        cycle_id: "cycle-1",
        cycle_strategy_id: "strategy-1",
        candidates: [
          { operation_id: "candidate-1", cycle_plan_item_id: "plan-1", post: { date: "2026-08-10", time: "23:00" }, model_evaluation: {} },
          { operation_id: "candidate-2", cycle_plan_item_id: "plan-2", post: { date: "2026-08-11", time: "00:00" }, model_evaluation: {} },
        ],
      },
    }, harness.dependencies);

    expect(harness.persistCandidate).toHaveBeenCalledTimes(1);
    expect(harness.reconcileBatch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: false,
      partial_success: true,
      requested_count: 2,
      processed_count: 1,
      accepted_count: 1,
      rejected_count: 0,
      deferred_count: 1,
      continuation_required: true,
      deferred_candidates: [{
        index: 1,
        operation_id: "candidate-2",
        cycle_plan_item_id: "plan-2",
        slot_key: "2026-08-11T00:00",
        reason: "batch_response_time_slice_exhausted",
        retryable: true,
      }],
    });
  });

  it("does not reconcile when every candidate is rejected", async () => {
    const harness = createDependencies();
    harness.persistCandidate.mockResolvedValue({
      success: false,
      slot_key: "2026-07-30T19:00",
      error: "candidate_gate_suite_failed",
    });

    const result = await persistOperatorManifestBatch({
      brandKey: "manifest_mental",
      defaultTimezone: "America/New_York",
      payload: {
        batch_operation_id: "batch-all-failed",
        cycle_id: "cycle-1",
        cycle_strategy_id: "strategy-1",
        candidates: [
          { operation_id: "candidate-1", cycle_plan_item_id: "plan-1", post: {}, model_evaluation: {} },
        ],
      },
    }, harness.dependencies);

    expect(result).toMatchObject({
      success: false,
      partial_success: false,
      accepted_count: 0,
      rejected_count: 1,
            reconciliation: null,
      reconciliation_count: 0,
      timing: {
        policy: "telemetry_only",
        candidate_persistence_ms: 10,
        reconciliation_ms: 0,
        total_elapsed_ms: 10,
      },
    });
    expect(harness.reconcileBatch).not.toHaveBeenCalled();
  });

    it("rejects Main batch sizes above two before item persistence", async () => {
    const harness = createDependencies();
    const result = await persistOperatorManifestBatch({
      brandKey: "manifest_mental",
      defaultTimezone: "America/New_York",
      payload: {
        batch_operation_id: "batch-too-large",
        cycle_id: "cycle-1",
        cycle_strategy_id: "strategy-1",
                candidates: Array.from({ length: 3 }, (_, index) => ({ operation_id: `candidate-${index}` })),
      },
    }, harness.dependencies);

    expect(result).toMatchObject({
      success: false,
            error: "main_manifest_persistence_batch_size_must_be_1_to_2",
      candidate_count: 3,
      maximum_safe_candidate_count: 2,
      retryable: false,
    });
    expect(harness.persistCandidate).not.toHaveBeenCalled();
    expect(harness.reconcileBatch).not.toHaveBeenCalled();
  });
});
