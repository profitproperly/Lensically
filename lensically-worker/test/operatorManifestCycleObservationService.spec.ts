import { describe, expect, it, vi } from "vitest";
import {
  manifestCycleFailureIsDefect,
  manifestCycleToolScope,
  observeOperatorManifestCycleToolResult,
  type OperatorManifestCycleObservationDependencies,
} from "../src/operatorManifestCycleObservationService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function normalizeMachineKey(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

function createHarness() {
  const mocks = {
    resolveDefectsByScope: vi.fn(async () => [] as JsonRecord[]),
    recordDefect: vi.fn(async () => ({ id: "defect-1", defect_key: "persist:failure" } as JsonRecord)),
  };
  const dependencies: OperatorManifestCycleObservationDependencies = {
    normalizeText,
    normalizeMachineKey,
    resolveDefectsByScope: mocks.resolveDefectsByScope,
    recordDefect: mocks.recordDefect,
  };
  return { mocks, dependencies };
}

describe("operatorManifestCycleObservationService", () => {
  it("classifies expected autonomous control outcomes without defect receipts", () => {
    expect(manifestCycleFailureIsDefect("candidate_gate_suite_failed")).toBe(false);
    expect(manifestCycleFailureIsDefect("prior_operation_in_progress")).toBe(false);
    expect(manifestCycleFailureIsDefect("Too many API requests by single Worker invocation")).toBe(true);
    expect(manifestCycleFailureIsDefect("manifest_learning_brief_schema_column_missing")).toBe(true);
  });

  it("maps persistence and evaluator tools to deterministic cycle scopes", () => {
    const harness = createHarness();
    expect(manifestCycleToolScope(
      "persist_manifest_autonomous_post",
      { post: { date: "2026-07-28", time: "14:00" } },
      {},
      harness.dependencies,
    )).toEqual({
      stageNumber: 5,
      stageKey: "persistence_and_scheduling",
      phase: "single_slot_persist",
      slotKey: "2026-07-28T14:00",
    });
    expect(manifestCycleToolScope(
      "prepare_manifest_autonomous_cycle",
      {},
      { stage: "learning_refresh" },
      harness.dependencies,
    )).toEqual({
      stageNumber: 7,
      stageKey: "post_publication_evaluator",
      phase: "learning_refresh",
      slotKey: null,
    });
  });

  it("resolves matching open defects after a successful scoped retry", async () => {
    const harness = createHarness();
    harness.mocks.resolveDefectsByScope.mockResolvedValue([
      { id: "defect-1" },
      { id: "defect-2" },
    ]);
    const result = await observeOperatorManifestCycleToolResult({
      brandKey: "manifest_mental",
      toolName: "persist_manifest_autonomous_post",
      payload: { cycle_id: "cycle-1", operation_id: "persist-1", post: { date: "2026-07-28", time: "14:00" } },
      result: { success: true, scheduled_post_id: 41, remaining_missing_count: 3 },
    }, harness.dependencies);

    expect(harness.mocks.resolveDefectsByScope).toHaveBeenCalledWith(expect.objectContaining({
      cycleId: "cycle-1",
      stageKey: "persistence_and_scheduling",
      phase: "single_slot_persist",
      slotKey: "2026-07-28T14:00",
      verification: expect.objectContaining({
        resolution_mode: "successful_scoped_retry_or_reconciliation",
        tool_name: "persist_manifest_autonomous_post",
      }),
    }));
    expect(result).toEqual({
      success: true,
      scheduled_post_id: 41,
      remaining_missing_count: 3,
      auto_resolved_defect_count: 2,
    });
    expect(harness.mocks.recordDefect).not.toHaveBeenCalled();
  });

  it("does not record expected gate or continuation failures", async () => {
    const harness = createHarness();
    const result = await observeOperatorManifestCycleToolResult({
      brandKey: "manifest_mental",
      toolName: "persist_manifest_autonomous_post",
      payload: { cycle_id: "cycle-1", post: { date: "2026-07-28", time: "14:00" } },
      result: { success: false, error: "candidate_gate_suite_failed" },
    }, harness.dependencies);

    expect(result).toEqual({ success: false, error: "candidate_gate_suite_failed" });
    expect(harness.mocks.recordDefect).not.toHaveBeenCalled();
  });

  it("records unexpected partially successful failures with deterministic metadata", async () => {
    const harness = createHarness();
    const result = await observeOperatorManifestCycleToolResult({
      brandKey: "manifest_mental",
      toolName: "persist_manifest_autonomous_post",
      payload: {
        cycle_id: "cycle-1",
        operation_id: "persist-1",
        post: { date: "2026-07-28", time: "14:00" },
      },
      result: {
        success: false,
        error: "manifest_lineage_write_failed",
        scheduled_post_id: 41,
        retryable: true,
        next_action: "repair lineage",
        reconciliation: { scheduled_post_id: 41 },
      },
    }, harness.dependencies);

    expect(harness.mocks.recordDefect).toHaveBeenCalledWith(expect.objectContaining({
      cycleId: "cycle-1",
      defectKey: "persist_manifest_autonomous_post:single_slot_persist:2026-07-28T14:00:manifest_lineage_write_failed",
      stageNumber: 5,
      impactState: "partially_succeeded",
      retryable: true,
      reconciliation: { scheduled_post_id: 41 },
      metadata: expect.objectContaining({
        tool_name: "persist_manifest_autonomous_post",
        next_action: "repair lineage",
      }),
    }));
    expect(result).toEqual(expect.objectContaining({
      success: false,
      defect_receipt_id: "defect-1",
      defect_key: "persist:failure",
    }));
  });
});
