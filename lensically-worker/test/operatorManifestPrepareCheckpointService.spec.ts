import { describe, expect, it, vi } from "vitest";
import {
  handleOperatorManifestPrepareCheckpoint,
  type OperatorManifestPrepareCheckpointDependencies,
} from "../src/operatorManifestPrepareCheckpointService";
import { orchestrateOperatorManifestPrepareCheckpoint } from "../src/operatorManifestPreparationOrchestratorService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function createHarness() {
  const mocks = {
    getAutonomyProfile: vi.fn(async () => ({ mode: "autonomous_operator" } as JsonRecord)),
    ensureCheckpointTable: vi.fn(async () => undefined),
    readCheckpoint: vi.fn(async () => null as JsonRecord | null),
    writeCheckpoint: vi.fn(async () => undefined),
    clearCheckpoint: vi.fn(async () => undefined),
    refreshThreadsSnapshot: vi.fn(async () => ({ refreshed: true, complete: true } as JsonRecord)),
    compactThreadsSnapshot: vi.fn((snapshot: JsonRecord) => ({ compact: true, ...snapshot })),
    refreshIntelligenceEngine: vi.fn(async () => ({ refreshed: true } as JsonRecord)),
    compactPayloadValue: vi.fn((value: unknown) => value),
    operatorRecord: vi.fn((value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}),
    refreshMeasurementAudit: vi.fn(async () => ({ refreshed: true } as JsonRecord)),
    refreshContentFocus: vi.fn(async () => ({ status: "repeat" })),
    readActiveLearningBrief: vi.fn(async () => null as JsonRecord | null),
    parseJson: vi.fn((value: string) => JSON.parse(value) as unknown),
    updateActiveLearningBrief: vi.fn(async () => undefined),
    now: vi.fn(() => "2026-07-27T18:00:00.000Z"),
  };
  const dependencies: OperatorManifestPrepareCheckpointDependencies = {
    autonomyMode: "autonomous_operator",
    defaultTimezone: "America/New_York",
    defaultRunwayHours: 48,
    checkpointVersion: "prepare-checkpoint-test-v1",
    savedPatternsAppUserId: "app-user-1",
    normalizeText,
    hasTestRuntimeTokens: () => false,
    getAutonomyProfile: mocks.getAutonomyProfile,
    ensureCheckpointTable: mocks.ensureCheckpointTable,
    readCheckpoint: mocks.readCheckpoint,
    writeCheckpoint: mocks.writeCheckpoint,
    clearCheckpoint: mocks.clearCheckpoint,
    refreshThreadsSnapshot: mocks.refreshThreadsSnapshot,
    compactThreadsSnapshot: mocks.compactThreadsSnapshot,
    refreshIntelligenceEngine: mocks.refreshIntelligenceEngine,
    compactPayloadValue: mocks.compactPayloadValue,
    operatorRecord: mocks.operatorRecord,
    refreshMeasurementAudit: mocks.refreshMeasurementAudit,
    refreshContentFocus: mocks.refreshContentFocus,
    readActiveLearningBrief: mocks.readActiveLearningBrief,
    parseJson: mocks.parseJson,
    updateActiveLearningBrief: mocks.updateActiveLearningBrief,
    now: mocks.now,
  };
  return { dependencies, mocks };
}

const input = {
  brandKey: "manifest_mental",
  accountId: "account-1",
  threadsUserId: "threads-1",
  payload: { operation_id: "prepare-op-1", timezone: "America/New_York", horizon_hours: 48 },
};

describe("Operator Manifest prepare checkpoint service", () => {
  it("preserves admission and idempotency mismatch blocking", async () => {
    const { dependencies, mocks } = createHarness();
    mocks.readCheckpoint.mockResolvedValueOnce({ timezone: "UTC", horizon_hours: 24 });
    const result = await handleOperatorManifestPrepareCheckpoint(input, dependencies);
    expect(result).toEqual({
      handled: true,
      response: expect.objectContaining({
        success: false,
        error: "idempotency_key_payload_mismatch",
        stored_timezone: "UTC",
        requested_timezone: "America/New_York",
        stored_horizon_hours: 24,
        requested_horizon_hours: 48,
      }),
    });
  });

  it("checkpoints bounded live collection before evaluator recomputation", async () => {
    const { dependencies, mocks } = createHarness();
    mocks.refreshThreadsSnapshot.mockResolvedValueOnce({
      refreshed: true,
      complete: false,
      evaluator_deferred: true,
      collection_state: { cursor: "next" },
    });
    const result = await handleOperatorManifestPrepareCheckpoint(input, dependencies);
    expect(mocks.refreshThreadsSnapshot).toHaveBeenCalledWith({ defer_evaluator: true });
    expect(mocks.writeCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      operation_id: "prepare-op-1",
      phase: "live_evaluator",
      state: expect.objectContaining({ collection_state: { cursor: "next" } }),
    }));
    expect(result).toEqual({
      handled: true,
      response: expect.objectContaining({
        success: true,
        continuation_required: true,
        stage_completed: "live_collection",
        next_stage: "live_evaluator",
      }),
    });
  });

  it("persists bounded learning continuation offsets", async () => {
    const { dependencies, mocks } = createHarness();
    mocks.readCheckpoint.mockResolvedValueOnce({
      timezone: "America/New_York",
      horizon_hours: 48,
      phase: "manifest_intelligence_learning",
      state: { learning_offset: 180, intelligence_engine: { semantic: true } },
    });
    mocks.refreshIntelligenceEngine.mockResolvedValueOnce({
      continuation_required: true,
      next_offset: 360,
    });
    const result = await handleOperatorManifestPrepareCheckpoint(input, dependencies);
    expect(mocks.refreshIntelligenceEngine).toHaveBeenCalledWith({
      phase: "learning_observations",
      learning_offset: 180,
      learning_limit: 180,
    });
    expect(mocks.writeCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      phase: "manifest_intelligence_learning",
      state: expect.objectContaining({ learning_offset: 360 }),
    }));
    expect(result).toEqual({
      handled: true,
      response: expect.objectContaining({
        stage_completed: "manifest_intelligence_learning_batch",
        next_stage: "manifest_intelligence_learning",
      }),
    });
  });

    it("reuses a fresh finalized learning snapshot when no due maturity checkpoint changed", async () => {
    const { dependencies, mocks } = createHarness();
    mocks.readCheckpoint.mockResolvedValueOnce({
      timezone: "America/New_York",
      horizon_hours: 48,
      phase: "live_evaluator",
      state: {
        runtime_now_iso: "2026-07-27T17:00:00.000Z",
        collection_state: { cursor: "complete" },
      },
    });
    mocks.refreshThreadsSnapshot.mockResolvedValueOnce({
      refreshed: true,
      complete: true,
      processed_due_checkpoint_count: 0,
      performance_evaluation: { manifest_layers_deferred: true },
    });
    mocks.readActiveLearningBrief.mockResolvedValueOnce({
      id: "brief-fresh",
      generated_at: "2026-07-27T17:30:00.000Z",
      brief_json: "{\"manifest_layers_finalized\":true}",
    });

    const result = await handleOperatorManifestPrepareCheckpoint(input, dependencies);
    expect(result).toEqual({
      handled: true,
      response: expect.objectContaining({
        stage_completed: "delta_learning_reused",
        next_stage: "cycle_construction",
        delta_refresh_required: false,
      }),
    });
    expect(mocks.refreshIntelligenceEngine).not.toHaveBeenCalled();
    expect(mocks.writeCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      phase: "cycle_construction",
      state: expect.objectContaining({ durable_learning_snapshot_id: "brief-fresh" }),
    }));
  });

  it("advances routine durable phases server-side until cycle construction", async () => {
    const { dependencies, mocks } = createHarness();
    let checkpoint: JsonRecord | null = null;
    mocks.readCheckpoint.mockImplementation(async () => checkpoint);
    mocks.writeCheckpoint.mockImplementation(async (next: JsonRecord) => {
      checkpoint = {
        timezone: next.timezone,
        horizon_hours: next.horizon_hours,
        phase: next.phase,
        state: next.state,
      };
    });
    mocks.refreshThreadsSnapshot
      .mockResolvedValueOnce({
        refreshed: true,
        complete: false,
        evaluator_deferred: true,
        collection_state: { cursor: "complete" },
      })
      .mockResolvedValueOnce({
        refreshed: true,
        complete: true,
        processed_due_checkpoint_count: 0,
        performance_evaluation: { manifest_layers_deferred: true },
      });
    mocks.readActiveLearningBrief.mockResolvedValueOnce({
      id: "brief-fresh",
      generated_at: "2026-07-27T17:30:00.000Z",
      brief_json: "{\"manifest_layers_finalized\":true}",
    });

    const result = await orchestrateOperatorManifestPrepareCheckpoint(input, dependencies, {
      maxAdvances: 8,
      maxElapsedMs: 20_000,
      nowMs: () => 1_000,
    });
    expect(result).toEqual({
      handled: false,
      context: expect.objectContaining({
        explicitOperationId: "prepare-op-1",
        threadsSnapshot: expect.objectContaining({ refreshed: true, complete: true }),
        server_orchestration: expect.objectContaining({
          advances: 3,
          continuation_count: 2,
          safety_stop: false,
          phase_path: [
            "live_collection->live_evaluator",
            "delta_learning_reused->cycle_construction",
          ],
        }),
      }),
    });
  });

  it("finalizes Content Focus and returns cycle-construction context", async () => {
    const { dependencies, mocks } = createHarness();
    mocks.readCheckpoint
      .mockResolvedValueOnce({
        timezone: "America/New_York",
        horizon_hours: 48,
        phase: "manifest_content_focus",
        state: {
          runtime_now_iso: "2026-07-27T17:00:00.000Z",
          threads_snapshot: { refreshed: true, complete: true, performance_evaluation: { deferred: true } },
          intelligence_engine: { complete: true },
          measurement_audit: { complete: true },
        },
      })
      .mockResolvedValueOnce({
        timezone: "America/New_York",
        horizon_hours: 48,
        phase: "cycle_construction",
        state: {
          runtime_now_iso: "2026-07-27T17:00:00.000Z",
          threads_snapshot: { refreshed: true, complete: true },
        },
      });
    mocks.readActiveLearningBrief.mockResolvedValueOnce({ id: "brief-1", brief_json: "{\"existing\":true}" });

    const finalized = await handleOperatorManifestPrepareCheckpoint(input, dependencies);
    expect(mocks.updateActiveLearningBrief).toHaveBeenCalledWith(expect.objectContaining({
      id: "brief-1",
      brandKey: "manifest_mental",
      brief: expect.objectContaining({ manifest_layers_finalized: true }),
    }));
    expect(finalized).toEqual({
      handled: true,
      response: expect.objectContaining({
        stage_completed: "manifest_content_focus",
        next_stage: "cycle_construction",
      }),
    });

    const construction = await handleOperatorManifestPrepareCheckpoint(input, dependencies);
    expect(construction).toEqual({
      handled: false,
      context: expect.objectContaining({
        timezone: "America/New_York",
        horizonHours: 48,
        explicitOperationId: "prepare-op-1",
        phasedPreparation: true,
        runtimeNowIso: "2026-07-27T17:00:00.000Z",
        threadsSnapshot: { refreshed: true, complete: true },
      }),
    });
  });
});
