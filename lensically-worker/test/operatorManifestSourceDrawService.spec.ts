import { describe, expect, it, vi } from "vitest";
import {
  drawOperatorManifestSourceBatch,
  type OperatorManifestSourceDrawDependencies,
} from "../src/operatorManifestSourceDrawService";

type JsonRecord = Record<string, unknown>;

function createDependencies(
  overrides: Partial<OperatorManifestSourceDrawDependencies> = {},
): OperatorManifestSourceDrawDependencies {
  let id = 0;
  return {
    manifestBrandKey: "manifest_mental",
    eligibilityMinLikes: 1_000,
    dailyDrawSize: 2,
    normalizeText: (value) => {
      const text = String(value ?? "").trim();
      return text || null;
    },
    createId: () => `id-${++id}`,
    nowIso: () => "2026-07-28T02:00:00.000Z",
    getActiveSession: vi.fn(async () => true),
    getExistingBatch: vi.fn(async () => null),
    listExistingSelections: vi.fn(async () => []),
    parseJsonString: (value) => JSON.parse(value),
    buildQualifiedPool: vi.fn(async () => []),
    shuffleCandidates: vi.fn((candidates) => [...candidates].reverse()),
    persistDraw: vi.fn(async () => undefined),
    updateWorkflowStage: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("drawOperatorManifestSourceBatch", () => {
  it("rejects unsupported brands without mutation", async () => {
    const dependencies = createDependencies();

    const result = await drawOperatorManifestSourceBatch({
      brandKey: "vectrix",
      payload: { workflow_session_id: "session-1" },
    }, dependencies);

    expect(result).toEqual({
      status: 400,
      body: { success: false, error: "source_draw_not_configured_for_brand" },
    });
    expect(dependencies.getActiveSession).not.toHaveBeenCalled();
    expect(dependencies.persistDraw).not.toHaveBeenCalled();
    expect(dependencies.updateWorkflowStage).not.toHaveBeenCalled();
  });

  it("requires a normalized active workflow session before reading batches", async () => {
    const missingDependencies = createDependencies();
    const missing = await drawOperatorManifestSourceBatch({
      brandKey: "manifest_mental",
      payload: { workflow_session_id: "   " },
    }, missingDependencies);

    expect(missing).toEqual({
      status: 400,
      body: { success: false, error: "workflow_session_id is required" },
    });
    expect(missingDependencies.getActiveSession).not.toHaveBeenCalled();

    const inactiveDependencies = createDependencies({
      getActiveSession: vi.fn(async () => false),
    });
    const inactive = await drawOperatorManifestSourceBatch({
      brandKey: "manifest_mental",
      payload: { workflow_session_id: " session-2 " },
    }, inactiveDependencies);

    expect(inactive).toEqual({
      status: 400,
      body: { success: false, error: "active_workflow_session_required" },
    });
    expect(inactiveDependencies.getActiveSession).toHaveBeenCalledWith({
      workflowSessionId: "session-2",
      brandKey: "manifest_mental",
    });
    expect(inactiveDependencies.getExistingBatch).not.toHaveBeenCalled();
    expect(inactiveDependencies.persistDraw).not.toHaveBeenCalled();
  });

  it("reuses the latest existing batch without pool or persistence work", async () => {
    const dependencies = createDependencies({
      getExistingBatch: vi.fn(async () => ({
        id: "batch-1",
        selection_method: "uniform_random_without_replacement",
        eligibility_min_likes: 1_500,
        qualified_pool_count: 9,
        selected_count: 1,
      })),
      listExistingSelections: vi.fn(async () => [{
        id: "selection-1",
        batch_id: "batch-1",
        draw_order: 1,
        source_identity_key: "threads:abc",
        source_type: "saved_pattern",
        internal_source_id: "42",
        threads_post_id: "abc",
        canonical_source_url: "https://www.threads.net/@x/post/abc",
        post_text: "Existing source",
        metrics_snapshot_json: "{\"likes\":2200}",
        source_card_id: "card-1",
      }]),
    });

    const result = await drawOperatorManifestSourceBatch({
      brandKey: "manifest_mental",
      payload: { workflow_session_id: "session-3" },
    }, dependencies);

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      source_batch_id: "batch-1",
      workflow_session_id: "session-3",
      eligibility_min_likes: 1_500,
      qualified_pool_count: 9,
      selected_count: 1,
      reused_existing: true,
      idempotency_reason: "workflow_source_batch_already_exists",
      selections: [{
        source_selection_id: "selection-1",
        metrics_snapshot: { likes: 2_200 },
        source_card_id: "card-1",
      }],
    });
    expect(dependencies.buildQualifiedPool).not.toHaveBeenCalled();
    expect(dependencies.shuffleCandidates).not.toHaveBeenCalled();
    expect(dependencies.persistDraw).not.toHaveBeenCalled();
    expect(dependencies.updateWorkflowStage).not.toHaveBeenCalled();
  });

  it("rejects an insufficient qualified source pool without mutation", async () => {
    const buildQualifiedPool = vi.fn(async () => [{ source_id: 1 }]);
    const dependencies = createDependencies({ buildQualifiedPool });

    const result = await drawOperatorManifestSourceBatch({
      brandKey: "manifest_mental",
      payload: { workflow_session_id: "session-4", source_types: ["saved_pattern", 7] },
    }, dependencies);

    expect(buildQualifiedPool).toHaveBeenCalledWith(["saved_pattern", "7"]);
    expect(result).toEqual({
      status: 400,
      body: {
        success: false,
        error: "insufficient_qualified_sources",
        eligibility_min_likes: 1_000,
        qualified_pool_count: 1,
        required_count: 2,
      },
    });
    expect(dependencies.persistDraw).not.toHaveBeenCalled();
    expect(dependencies.updateWorkflowStage).not.toHaveBeenCalled();
  });

  it("persists one uniform random batch and advances the workflow stage", async () => {
    const pool: JsonRecord[] = [
      {
        source_identity_key: "threads:first",
        source_type: "saved_pattern",
        internal_source_id: "11",
        threads_post_id: "first",
        canonical_source_url: "https://www.threads.net/@x/post/first",
        text: "First source",
        posted_at: "2026-07-01T00:00:00.000Z",
        metrics: { likes: 1_500, replies: 5 },
      },
      {
        source_identity_key: "threads:second",
        source_type: "archive_winner",
        source_id: 22,
        text: "Second source",
        metrics: { likes: 2_500 },
      },
      {
        source_identity_key: "threads:third",
        source_type: "saved_pattern",
        source_id: 33,
        text: "Third source",
      },
    ];
    const persistDraw = vi.fn(async () => undefined);
    const updateWorkflowStage = vi.fn(async () => undefined);
    const dependencies = createDependencies({
      buildQualifiedPool: vi.fn(async () => pool),
      persistDraw,
      updateWorkflowStage,
    });

    const result = await drawOperatorManifestSourceBatch({
      brandKey: "manifest_mental",
      payload: { workflow_session_id: "session-5", source_types: ["saved_pattern"] },
    }, dependencies);

    expect(persistDraw).toHaveBeenCalledTimes(1);
    expect(persistDraw).toHaveBeenCalledWith({
      batch: {
        id: "id-1",
        brandKey: "manifest_mental",
        workflowSessionId: "session-5",
        eligibilityMinLikes: 1_000,
        qualifiedPoolCount: 3,
        requestedCount: 2,
        selectedCount: 2,
        selectedAt: "2026-07-28T02:00:00.000Z",
        metadata: {
          cross_day_cooldown_applied: false,
          cross_day_repetition_allowed: true,
          posting_order_source: "draw_order",
          performance_weighting_applied: false,
          dynamic_rank_recorded: false,
        },
      },
      selections: [
        expect.objectContaining({
          id: "id-2",
          batchId: "id-1",
          drawOrder: 1,
          sourceIdentityKey: "threads:third",
          internalSourceId: "33",
          metricsSnapshot: {
            captured_at: "2026-07-28T02:00:00.000Z",
            eligibility_min_likes: 1_000,
          },
        }),
        expect.objectContaining({
          id: "id-3",
          batchId: "id-1",
          drawOrder: 2,
          sourceIdentityKey: "threads:second",
          internalSourceId: "22",
          metricsSnapshot: {
            likes: 2_500,
            captured_at: "2026-07-28T02:00:00.000Z",
            eligibility_min_likes: 1_000,
          },
        }),
      ],
    });
    expect(updateWorkflowStage).toHaveBeenCalledWith({
      workflowSessionId: "session-5",
      brandKey: "manifest_mental",
    });
    expect(result).toEqual({
      status: 200,
      body: {
        source_batch_id: "id-1",
        workflow_session_id: "session-5",
        selection_method: "uniform_random_without_replacement",
        eligibility_min_likes: 1_000,
        qualified_pool_count: 3,
        selected_count: 2,
        cross_day_repetition_allowed: true,
        cross_day_cooldown_applied: false,
        posting_order_source: "draw_order",
        selections: [
          expect.objectContaining({
            source_selection_id: "id-2",
            source_batch_id: "id-1",
            draw_order: 1,
            source_identity_key: "threads:third",
          }),
          expect.objectContaining({
            source_selection_id: "id-3",
            source_batch_id: "id-1",
            draw_order: 2,
            source_identity_key: "threads:second",
          }),
        ],
      },
    });
  });
});
