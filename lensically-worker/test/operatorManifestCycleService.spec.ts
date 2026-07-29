import { describe, expect, it, vi } from "vitest";
import {
  handleOperatorManifestCycleServiceTool,
  type OperatorManifestCycleServiceDependencies,
} from "../src/operatorManifestCycleService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
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

function createHarness() {
  const dbState = createDb();
  const mocks = {
    observe: vi.fn(async (_toolName: string, _payload: JsonRecord, result: JsonRecord) => ({ observed: true, ...result })),
    readEvidencePage: vi.fn(async () => ({ success: true, page_index: 0 } as JsonRecord)),
    validateLockedLineup: vi.fn(async () => [{ id: "plan-1" }] as JsonRecord[]),
    commitStrategy: vi.fn(async () => ({ id: "strategy-1" } as JsonRecord)),
    appendCycleEvent: vi.fn(async () => undefined),
        getCycleReceipt: vi.fn(async () => ({ id: "receipt-1" } as JsonRecord)),
        buildCycleReceiptRead: vi.fn(() => ({
      summary: { id: "receipt-summary" },
      section: "events",
      items: [{ id: "event-1" }],
    } as JsonRecord)),
    normalizeMachineKey: vi.fn((value: unknown, fallback: string) => {
      if (typeof value !== "string") return fallback;
      return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_") || fallback;
    }),
    readIntelligenceFoundation: vi.fn(async () => ({ policy: "active" })),
    readPerformanceLearning: vi.fn(async () => ({ include_posts_applied: true })),
    readIntelligenceAudit: vi.fn(async () => ({ section: "portfolio", items: [] })),
    readContentFocus: vi.fn(async () => ({ daily: { family: "money" } })),
    recordCycleDefect: vi.fn(async () => ({ id: "defect-1" })),
    resolveCycleDefect: vi.fn(async () => ({ id: "defect-1", status: "resolved" })),
    finalizeCycleReceipt: vi.fn(async () => ({ completed: true } as JsonRecord)),
    readAutonomousCycle: vi.fn(async () => null as JsonRecord | null),
    now: vi.fn(() => "2026-07-27T16:00:00.000Z"),
  };
  const dependencies: OperatorManifestCycleServiceDependencies = {
    db: dbState.db,
    normalizeText,
    observe: mocks.observe,
    readEvidencePage: mocks.readEvidencePage,
    validateLockedLineup: mocks.validateLockedLineup,
    commitStrategy: mocks.commitStrategy,
    appendCycleEvent: mocks.appendCycleEvent,
        getCycleReceipt: mocks.getCycleReceipt,
        buildCycleReceiptRead: mocks.buildCycleReceiptRead,
    normalizeMachineKey: mocks.normalizeMachineKey,
    readIntelligenceFoundation: mocks.readIntelligenceFoundation,
    readPerformanceLearning: mocks.readPerformanceLearning,
    readIntelligenceAudit: mocks.readIntelligenceAudit,
    readContentFocus: mocks.readContentFocus,
    recordCycleDefect: mocks.recordCycleDefect,
    resolveCycleDefect: mocks.resolveCycleDefect,
    finalizeCycleReceipt: mocks.finalizeCycleReceipt,
    readAutonomousCycle: mocks.readAutonomousCycle,
    sourceSelectionEngineVersion: "source-selection-test-v1",
    now: mocks.now,
  };
  return { dependencies, mocks, dbState };
}

describe("Operator Manifest cycle product service", () => {
  it("preserves bounded evidence-page validation and observed failures", async () => {
    const { dependencies, mocks } = createHarness();
    const missing = await handleOperatorManifestCycleServiceTool({
      toolName: "get_manifest_cycle_analysis_page",
      brandKey: "manifest_mental",
      payload: {},
    }, dependencies);
    expect(missing).toEqual({
      status: 400,
      body: { success: false, error: "autonomous_cycle_id_required" },
    });

    mocks.readEvidencePage.mockRejectedValueOnce(new Error("page_failed"));
    const failed = await handleOperatorManifestCycleServiceTool({
      toolName: "get_manifest_cycle_analysis_page",
      brandKey: "manifest_mental",
      payload: { cycle_id: "cycle-1", snapshot_id: "snapshot-1", page_index: -3 },
    }, dependencies);
    expect(failed.status).toBe(400);
    expect(failed.body).toMatchObject({
      observed: true,
      success: false,
      error: "page_failed",
    });
    expect(mocks.readEvidencePage).toHaveBeenCalledWith({
      brandKey: "manifest_mental",
      cycleId: "cycle-1",
      snapshotId: "snapshot-1",
      pageIndex: 0,
    });
  });

    it("preserves bounded cycle receipt reads and exact unavailable state", async () => {
    const { dependencies, mocks } = createHarness();
    const available = await handleOperatorManifestCycleServiceTool({
      toolName: "get_manifest_cycle_receipt",
      brandKey: "manifest_mental",
      payload: {
        cycle_id: " cycle-1 ",
        cycle_operation_id: " operation-1 ",
        receipt_section: "events",
        offset: 10,
        limit: 5,
      },
    }, dependencies);

    expect(mocks.getCycleReceipt).toHaveBeenCalledWith({
      brandKey: "manifest_mental",
      cycleId: "cycle-1",
      operationId: "operation-1",
    });
    expect(mocks.buildCycleReceiptRead).toHaveBeenCalledWith(
      { id: "receipt-1" },
      "events",
      10,
      5,
    );
    expect(available).toEqual({
      status: 200,
      body: {
        success: true,
        brand_key: "manifest_mental",
        available: true,
        cycle_receipt: { id: "receipt-summary" },
        receipt_section: {
          section: "events",
          items: [{ id: "event-1" }],
        },
      },
    });

    mocks.getCycleReceipt.mockResolvedValueOnce(null);
    const unavailable = await handleOperatorManifestCycleServiceTool({
      toolName: "get_manifest_cycle_receipt",
      brandKey: "manifest_mental",
      payload: {},
    }, dependencies);
    expect(unavailable).toEqual({
      status: 200,
      body: {
        success: true,
        brand_key: "manifest_mental",
        available: false,
        cycle_receipt: null,
        receipt_section: null,
      },
    });
    expect(mocks.buildCycleReceiptRead).toHaveBeenCalledOnce();
  });

    it("preserves adjacent Manifest intelligence reads and audit normalization", async () => {
    const { dependencies, mocks } = createHarness();

    const foundation = await handleOperatorManifestCycleServiceTool({
      toolName: "get_manifest_intelligence_foundation",
      brandKey: "manifest_mental",
      payload: {},
    }, dependencies);
    expect(foundation).toEqual({
      status: 200,
      body: {
        success: true,
        brand_key: "manifest_mental",
        intelligence_foundation: { policy: "active" },
      },
    });

    const performance = await handleOperatorManifestCycleServiceTool({
      toolName: "get_performance_learning",
      brandKey: "manifest_mental",
      payload: { include_posts: true },
    }, dependencies);
    expect(mocks.readPerformanceLearning).toHaveBeenCalledWith("manifest_mental", true);
    expect(performance.body).toEqual({
      success: true,
      brand_key: "manifest_mental",
      performance_learning: { include_posts_applied: true },
    });

    const audit = await handleOperatorManifestCycleServiceTool({
      toolName: "get_manifest_intelligence_audit",
      brandKey: "manifest_mental",
      payload: { audit_section: " Portfolio ", offset: "7", limit: "9" },
    }, dependencies);
    expect(mocks.readIntelligenceAudit).toHaveBeenCalledWith({
      brandKey: "manifest_mental",
      section: "portfolio",
      offset: 7,
      limit: 9,
    });
    expect(audit.body).toEqual({
      success: true,
      brand_key: "manifest_mental",
      intelligence_audit: { section: "portfolio", items: [] },
    });

    const contentFocus = await handleOperatorManifestCycleServiceTool({
      toolName: "get_content_focus",
      brandKey: "manifest_mental",
      payload: {},
    }, dependencies);
    expect(contentFocus.body).toEqual({
      success: true,
      brand_key: "manifest_mental",
      content_focus: { daily: { family: "money" } },
    });
  });

  it("preserves complete strategy locking and source-selection metadata", async () => {
    const { dependencies, mocks } = createHarness();
    const incomplete = await handleOperatorManifestCycleServiceTool({
      toolName: "commit_manifest_cycle_strategy",
      brandKey: "manifest_mental",
      payload: { cycle_id: "cycle-1", snapshot_id: "snapshot-1" },
    }, dependencies);
    expect(incomplete).toEqual({
      status: 400,
      body: { success: false, error: "complete_cycle_strategy_required" },
    });

    const completed = await handleOperatorManifestCycleServiceTool({
      toolName: "commit_manifest_cycle_strategy",
      brandKey: "manifest_mental",
      payload: {
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
      },
    }, dependencies);

    expect(completed.status).toBe(200);
    expect(completed.body).toMatchObject({
      observed: true,
      success: true,
      cycle_id: "cycle-1",
      strategy: { id: "strategy-1" },
    });
    expect(mocks.validateLockedLineup).toHaveBeenCalledWith(expect.objectContaining({
      brand_key: "manifest_mental",
      cycle_id: "cycle-1",
    }));
    expect(mocks.appendCycleEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventKey: "cycle-strategy:strategy-1",
      eventType: "cycle_strategy_locked",
      payload: expect.objectContaining({
        primary_metric: "24_hour_likes",
        source_selection_engine_version: "source-selection-test-v1",
        locked_source_selection_count: 1,
        model_source_substitution_allowed: false,
      }),
    }));
  });

  it("preserves seven-stage defect validation and receipt requirements", async () => {
    const { dependencies, mocks } = createHarness();
    mocks.getCycleReceipt.mockResolvedValueOnce(null);
    const missingReceipt = await handleOperatorManifestCycleServiceTool({
      toolName: "record_manifest_cycle_defect",
      brandKey: "manifest_mental",
      payload: { cycle_id: "cycle-1", defect_key: "delivery" },
    }, dependencies);
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
    }, dependencies);
    expect(recorded).toEqual({
      status: 200,
      body: { success: true, defect: { id: "defect-1" } },
    });
    expect(mocks.recordCycleDefect).toHaveBeenCalledWith(expect.objectContaining({
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
    }));
  });

  it("preserves final defect resolution and cycle completion reconciliation", async () => {
    const { dependencies, mocks, dbState } = createHarness();
    mocks.readAutonomousCycle.mockResolvedValueOnce({
      missing_slots: [],
      scheduled_post_ids: [11, "12"],
    });
    mocks.getCycleReceipt.mockResolvedValueOnce({
      id: "receipt-1",
      completed_at: null,
      output_strategy_version_id: "strategy-v2",
    });
    mocks.finalizeCycleReceipt.mockResolvedValueOnce({
      completed: true,
      status: "completed",
    });
    mocks.now.mockReturnValueOnce("2026-07-27T16:30:00.000Z");

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
    }, dependencies);

    expect(resolved).toEqual({
      status: 200,
      body: {
        success: true,
        defect: { id: "defect-1", status: "resolved" },
        cycle_completion: { completed: true, status: "completed" },
      },
    });
    expect(mocks.finalizeCycleReceipt).toHaveBeenCalledWith(expect.objectContaining({
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
    }));
    expect(mocks.appendCycleEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventKey: "cycle-completed",
      eventType: "cycle_completed",
    }));
    expect(dbState.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE operator_autonomous_growth_cycles"));
    expect(dbState.bind).toHaveBeenCalledWith("cycle-1", "manifest_mental");
    expect(dbState.run).toHaveBeenCalledOnce();
  });
});
