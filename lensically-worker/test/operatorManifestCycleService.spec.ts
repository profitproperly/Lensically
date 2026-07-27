import { beforeEach, describe, expect, it, vi } from "vitest";

const manifestMocks = vi.hoisted(() => ({
  appendManifestCycleEvent: vi.fn(),
  commitManifestCycleStrategy: vi.fn(),
  finalizeManifestCycleReceipt: vi.fn(),
  getManifestCycleReceipt: vi.fn(),
  readManifestEvidencePage: vi.fn(),
  recordManifestCycleDefect: vi.fn(),
  resolveManifestCycleDefect: vi.fn(),
}));

const selectionMocks = vi.hoisted(() => ({
  validateLineupAgainstLockedSourceSelectionPlan: vi.fn(),
}));

vi.mock("../src/manifestIntelligence", () => manifestMocks);
vi.mock("../src/sourceFamilySelection", () => ({
  SOURCE_SELECTION_ENGINE_VERSION: "source-selection-test-v1",
  validateLineupAgainstLockedSourceSelectionPlan: selectionMocks.validateLineupAgainstLockedSourceSelectionPlan,
}));

import {
  handleOperatorManifestCycleServiceTool,
  type OperatorManifestCycleServiceDependencies,
} from "../src/operatorManifestCycleService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number, allowEmpty = false): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || (allowEmpty ? null : null);
}

function createDb() {
  const run = vi.fn(async () => ({ success: true }));
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  return {
    db: { prepare } as unknown as D1Database,
    prepare,
    bind,
    run,
  };
}

function dependencies(
  overrides: Partial<OperatorManifestCycleServiceDependencies> = {},
): OperatorManifestCycleServiceDependencies {
  const { db } = createDb();
  return {
    db,
    normalizeText,
    observe: vi.fn(async (_toolName, _payload, result) => ({ observed: true, ...result })),
    readAutonomousCycle: vi.fn(async () => null),
    now: vi.fn(() => "2026-07-27T16:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  manifestMocks.appendManifestCycleEvent.mockResolvedValue({});
  manifestMocks.commitManifestCycleStrategy.mockResolvedValue({ id: "strategy-1" });
  manifestMocks.finalizeManifestCycleReceipt.mockResolvedValue({ completed: true });
  manifestMocks.getManifestCycleReceipt.mockResolvedValue({ id: "receipt-1" });
  manifestMocks.readManifestEvidencePage.mockResolvedValue({ success: true, page_index: 0 });
  manifestMocks.recordManifestCycleDefect.mockResolvedValue({ id: "defect-1" });
  manifestMocks.resolveManifestCycleDefect.mockResolvedValue({ id: "defect-1", status: "resolved" });
  selectionMocks.validateLineupAgainstLockedSourceSelectionPlan.mockResolvedValue([{ id: "plan-1" }]);
});

describe("Operator Manifest cycle product service", () => {
  it("preserves bounded evidence-page validation and observed failures", async () => {
    const deps = dependencies();
    const missing = await handleOperatorManifestCycleServiceTool({
      toolName: "get_manifest_cycle_analysis_page",
      brandKey: "manifest_mental",
      payload: {},
    }, deps);
    expect(missing).toEqual({
      status: 400,
      body: { success: false, error: "autonomous_cycle_id_required" },
    });

    manifestMocks.readManifestEvidencePage.mockRejectedValueOnce(new Error("page_failed"));
    const failed = await handleOperatorManifestCycleServiceTool({
      toolName: "get_manifest_cycle_analysis_page",
      brandKey: "manifest_mental",
      payload: { cycle_id: "cycle-1", snapshot_id: "snapshot-1", page_index: -3 },
    }, deps);
    expect(failed.status).toBe(400);
    expect(failed.body).toMatchObject({
      observed: true,
      success: false,
      error: "page_failed",
    });
    expect(manifestMocks.readManifestEvidencePage).toHaveBeenCalledWith(
      deps.db,
      {
        brandKey: "manifest_mental",
        cycleId: "cycle-1",
        snapshotId: "snapshot-1",
        pageIndex: 0,
      },
    );
  });

  it("preserves complete strategy locking and source-selection metadata", async () => {
    const deps = dependencies();
    const incomplete = await handleOperatorManifestCycleServiceTool({
      toolName: "commit_manifest_cycle_strategy",
      brandKey: "manifest_mental",
      payload: { cycle_id: "cycle-1", snapshot_id: "snapshot-1" },
    }, deps);
    expect(incomplete).toEqual({
      status: 400,
      body: { success: false, error: "complete_cycle_strategy_required" },
    });

    const payload: JsonRecord = {
      cycle_id: "cycle-1",
      snapshot_id: "snapshot-1",
      account_conclusion: { trajectory: "rising" },
      content_focus: { family: "money" },
      benchmarks: { median_likes: 100 },
      directives: { explore: true },
      strongest_executions: [{ id: "strong-1" }],
      weakest_executions: [{ id: "weak-1" }],
      experiments: [{ id: "experiment-1" }],
      risks: ["repetition"],
      lineup: [{ slot_key: "2026-07-28-01", source_card_id: "card-1" }],
    };
    const completed = await handleOperatorManifestCycleServiceTool({
      toolName: "commit_manifest_cycle_strategy",
      brandKey: "manifest_mental",
      payload,
    }, deps);

    expect(completed.status).toBe(200);
    expect(completed.body).toMatchObject({
      observed: true,
      success: true,
      cycle_id: "cycle-1",
      strategy: { id: "strategy-1" },
    });
    expect(selectionMocks.validateLineupAgainstLockedSourceSelectionPlan).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({
        brand_key: "manifest_mental",
        cycle_id: "cycle-1",
      }),
    );
    expect(manifestMocks.appendManifestCycleEvent).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({
        eventKey: "cycle-strategy:strategy-1",
        eventType: "cycle_strategy_locked",
        payload: expect.objectContaining({
          primary_metric: "24_hour_likes",
          source_selection_engine_version: "source-selection-test-v1",
          locked_source_selection_count: 1,
          model_source_substitution_allowed: false,
        }),
      }),
    );
  });

  it("preserves seven-stage defect validation and receipt requirements", async () => {
    const deps = dependencies();
    manifestMocks.getManifestCycleReceipt.mockResolvedValueOnce(null);
    const missingReceipt = await handleOperatorManifestCycleServiceTool({
      toolName: "record_manifest_cycle_defect",
      brandKey: "manifest_mental",
      payload: { cycle_id: "cycle-1", defect_key: "delivery" },
    }, deps);
    expect(missingReceipt).toEqual({
      status: 404,
      body: { success: false, error: "manifest_cycle_receipt_not_found" },
    });

    const recorded = await handleOperatorManifestCycleServiceTool({
      toolName: "record_manifest_cycle_defect",
      brandKey: "manifest_mental",
      payload: {
        cycle_id: "cycle-1",
        defect_key: "delivery",
        stage_number: 99,
        status: "repairing",
        retryable: true,
        blocking: false,
      },
    }, deps);
    expect(recorded).toEqual({
      status: 200,
      body: { success: true, defect: { id: "defect-1" } },
    });
    expect(manifestMocks.recordManifestCycleDefect).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({
        cycleId: "cycle-1",
        brandKey: "manifest_mental",
        defectKey: "delivery",
        stageNumber: 7,
        stageKey: "unknown_stage",
        phase: "external_failure",
        errorCode: "external_cycle_failure",
        errorMessage: "External cycle failure",
        impactState: "definitely_failed",
        retryable: true,
        blocking: false,
        status: "repairing",
      }),
    );
  });

  it("preserves final defect resolution and cycle completion reconciliation", async () => {
    const dbState = createDb();
    const deps = dependencies({
      db: dbState.db,
      readAutonomousCycle: vi.fn(async () => ({
        missing_slots: [],
        scheduled_post_ids: [11, "12"],
      })),
      now: vi.fn(() => "2026-07-27T16:30:00.000Z"),
    });
    manifestMocks.getManifestCycleReceipt.mockResolvedValue({
      id: "receipt-1",
      completed_at: null,
      output_strategy_version_id: "strategy-v2",
    });
    manifestMocks.finalizeManifestCycleReceipt.mockResolvedValue({
      completed: true,
      status: "completed",
    });

    const resolved = await handleOperatorManifestCycleServiceTool({
      toolName: "resolve_manifest_cycle_defect",
      brandKey: "manifest_mental",
      payload: {
        cycle_id: "cycle-1",
        defect_key: "delivery",
        root_cause: "fixed",
        regression_tests: [{ name: "delivery regression" }],
        verification: { production: true },
      },
    }, deps);

    expect(resolved).toEqual({
      status: 200,
      body: {
        success: true,
        defect: { id: "defect-1", status: "resolved" },
        cycle_completion: { completed: true, status: "completed" },
      },
    });
    expect(manifestMocks.finalizeManifestCycleReceipt).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({
        cycleId: "cycle-1",
        status: "completed",
        completion: expect.objectContaining({
          completion_trigger: "last_blocking_defect_resolved",
          scheduled_post_ids: [11, 12],
          scheduled_count: 2,
          remaining_missing_count: 0,
          final_post_lineage_complete: true,
          output_strategy_version_id: "strategy-v2",
          completed_at: "2026-07-27T16:30:00.000Z",
        }),
      }),
    );
    expect(manifestMocks.appendManifestCycleEvent).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({
        eventKey: "cycle-completed",
        eventType: "cycle_completed",
      }),
    );
    expect(dbState.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE operator_autonomous_growth_cycles"));
    expect(dbState.bind).toHaveBeenCalledWith("cycle-1", "manifest_mental");
    expect(dbState.run).toHaveBeenCalledOnce();
  });
});
