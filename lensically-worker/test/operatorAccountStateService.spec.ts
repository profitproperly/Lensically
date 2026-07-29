import { describe, expect, it, vi } from "vitest";
import {
    readOperatorAccountState,
  readOperatorPostResults,
  type OperatorAccountStateDependencies,
  type OperatorPostResultsDependencies,
} from "../src/operatorAccountStateService";

type JsonRecord = Record<string, unknown>;

function createHarness() {
  const mocks = {
    getActiveSession: vi.fn(async () => ({ id: "session-1", active_source_card_id: "card-1" } as JsonRecord)),
    getSourceCard: vi.fn(async () => ({ id: "card-1", title: "Source" } as JsonRecord)),
    listDraftsByStatus: vi.fn(async (_accountId: string, statuses: string[]) => statuses[0] === "approved"
      ? [{ id: "draft-approved" }]
      : [{ id: "draft-rejected" }]),
    countScheduledPosts: vi.fn(async () => 7),
    listActiveGates: vi.fn(async () => [{ id: "gate-1" }, { id: "gate-2" }]),
  };
  const dependencies: OperatorAccountStateDependencies = {
    getActiveSession: mocks.getActiveSession,
    getSourceCard: mocks.getSourceCard,
    listDraftsByStatus: mocks.listDraftsByStatus,
    countScheduledPosts: mocks.countScheduledPosts,
    listActiveGates: mocks.listActiveGates,
  };
  return { mocks, dependencies };
}

describe("operatorAccountStateService", () => {
  it("reads the selected account state and resolves its active source card", async () => {
    const harness = createHarness();
    const result = await readOperatorAccountState({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
    }, harness.dependencies);

    expect(harness.mocks.getSourceCard).toHaveBeenCalledWith("manifest_mental", "card-1");
    expect(harness.mocks.listDraftsByStatus).toHaveBeenNthCalledWith(1, "account-1", ["approved"], 5);
    expect(harness.mocks.listDraftsByStatus).toHaveBeenNthCalledWith(2, "account-1", ["rejected"], 5);
    expect(harness.mocks.countScheduledPosts).toHaveBeenCalledWith("threads-1");
    expect(result).toEqual({
      brand_key: "manifest_mental",
      active_workflow_session: { id: "session-1", active_source_card_id: "card-1" },
      active_source_card: { id: "card-1", title: "Source" },
      latest_approved_drafts: [{ id: "draft-approved" }],
      latest_rejected_drafts: [{ id: "draft-rejected" }],
      scheduled_posts_count: 7,
      active_gates_count: 2,
      warnings: [],
    });
  });

  it("does not read a source card when the active session has no source identity", async () => {
    const harness = createHarness();
    harness.mocks.getActiveSession.mockResolvedValue({ id: "session-1", active_source_card_id: null });

    const result = await readOperatorAccountState({
      brandKey: "vectrix",
      accountId: "account-2",
      threadsUserId: "threads-2",
    }, harness.dependencies);

    expect(harness.mocks.getSourceCard).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      brand_key: "vectrix",
      active_source_card: null,
    });
  });

    it("normalizes an unavailable scheduled count without changing the response contract", async () => {
    const harness = createHarness();
    harness.mocks.countScheduledPosts.mockResolvedValue(Number.NaN);
    const result = await readOperatorAccountState({
      brandKey: "opmg_deadman",
      accountId: "account-3",
      threadsUserId: "threads-3",
    }, harness.dependencies);

    expect(result).toMatchObject({
      brand_key: "opmg_deadman",
      scheduled_posts_count: Number.NaN,
      warnings: [],
    });
  });
});

function createPostResultsHarness() {
  const mocks = {
    ensureArchiveTable: vi.fn(async () => undefined),
    ensureMetricSnapshotsTable: vi.fn(async () => undefined),
    normalizeText: vi.fn((value: unknown, maxLength: number) => {
      if (typeof value !== "string") return null;
      const normalized = value.trim().slice(0, maxLength);
      return normalized || null;
    }),
    loadScheduledLineage: vi.fn(async (): Promise<JsonRecord | null> => ({
      scheduled_post_id: 44,
      post_text: "Scheduled text",
      published_at: "2026-07-28T12:00:00.000Z",
      draft_id: "draft-1",
      run_id: "run-1",
      source_card_id: "card-1",
    })),
    loadDraftFallback: vi.fn(async (): Promise<JsonRecord | null> => null),
    loadArchivePost: vi.fn(async (): Promise<JsonRecord | null> => ({
      post_text: "Published text",
      post_timestamp: "2026-07-28T12:00:00.000Z",
      post_permalink: "https://threads.example/post-1",
      post_username: "manifestmental",
      views: 100,
      likes: 20,
      replies: 3,
      reposts: 2,
      quotes: 1,
      shares: 4,
      engagement_total: 30,
      last_synced_at: "2026-07-28T13:00:00.000Z",
    })),
    loadSourceCard: vi.fn(async (): Promise<JsonRecord | null> => ({
      id: "card-1",
      family_id: "family-1",
      version_number: 2,
      is_current: 1,
      title: "Money source",
      transformation_contract: { audience_reward: "possibility" },
      primary_source: { text: "Primary source text" },
    })),
    loadSourceSelection: vi.fn(async (): Promise<JsonRecord | null> => ({
      id: "selection-1",
      batch_id: "batch-1",
      draw_order: 2,
      source_identity_key: "source-key",
      source_type: "saved_pattern",
      internal_source_id: "91",
      post_text: "Saved source text",
      threads_post_id: "source-post-1",
      canonical_source_url: "https://threads.example/source-1",
      metrics_snapshot_json: "{\"likes\":1200}",
      selected_at: "2026-07-27T10:00:00.000Z",
    })),
    evaluateMetrics: vi.fn(() => ({
      metrics: { views: 100, likes: 20, engagement_total: 30 },
      validForLearning: true,
      anomalyReason: null,
    })),
    loadGenerationRun: vi.fn(async (): Promise<JsonRecord | null> => ({
      id: "run-1",
      source_card_id: "card-1",
      source_card_family_id: "family-1",
      source_card_version_number: 2,
      objective: "adapt",
      prompt_summary: "close mimicry",
      status: "completed",
      metadata_json: "{\"mode\":\"test\"}",
      adaptation_plan_json: "{\"goal\":\"preserve\"}",
    })),
    loadDraftDetail: vi.fn(async (): Promise<JsonRecord | null> => ({
      id: "draft-1",
      run_id: "run-1",
      source_card_id: "card-1",
      status: "published",
      scheduled_post_id: 44,
      published_post_id: "post-1",
      strategy_json: "{\"pillar\":\"money\"}",
      metadata_json: "{\"gate\":\"pass\"}",
    })),
    parseJson: vi.fn((value: string) => JSON.parse(value)),
    serializeJson: vi.fn((value: unknown) => JSON.stringify(value)),
    loadLatestMetricSnapshot: vi.fn(async (): Promise<{ metrics_json: string } | null> => null),
    insertMetricSnapshot: vi.fn(async () => undefined),
    ensurePerformanceTables: vi.fn(async () => undefined),
    loadFingerprint: vi.fn(async (): Promise<JsonRecord | null> => ({
      fingerprint_json: "{\"family\":\"money\"}",
      fingerprint_version: "v2",
    })),
    listPerformanceScores: vi.fn(async (): Promise<JsonRecord[]> => [{
      checkpoint_hours: 24,
      post_age_hours: 26,
      metrics_json: "{\"likes\":20}",
      rates_json: "{\"like_rate\":0.2}",
      velocity_json: "{\"likes_per_hour\":0.8}",
      scores_json: "{\"quality\":0.9}",
      distribution_state: "mature",
      captured_at: "2026-07-29T14:00:00.000Z",
    }]),
    listMetricHistory: vi.fn(async (): Promise<JsonRecord[]> => [{
      metrics_json: "{\"likes\":10}",
      captured_at: "2026-07-28T18:00:00.000Z",
      valid_for_learning: 1,
      anomaly_reason: null,
      collection_source: "insights",
    }]),
    randomUuid: vi.fn(() => "snapshot-1"),
    now: vi.fn(() => "2026-07-28T13:30:00.000Z"),
  };
  const dependencies: OperatorPostResultsDependencies = mocks;
  return { mocks, dependencies };
}

describe("operator account post-results service", () => {
  it("prepares schemas before exact published-post admission", async () => {
    const { mocks, dependencies } = createPostResultsHarness();
    const result = await readOperatorPostResults({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      payload: {},
    }, dependencies);

    expect(mocks.ensureArchiveTable).toHaveBeenCalledOnce();
    expect(mocks.ensureMetricSnapshotsTable).toHaveBeenCalledOnce();
    expect(mocks.loadScheduledLineage).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 400,
      body: { success: false, error: "published_post_id is required" },
    });
  });

  it("preserves the compact lineage and generation evidence response", async () => {
    const { mocks, dependencies } = createPostResultsHarness();
    const result = await readOperatorPostResults({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      payload: { published_post_id: " post-1 ", compact: true },
    }, dependencies);

    expect(mocks.loadDraftFallback).not.toHaveBeenCalled();
    expect(mocks.ensurePerformanceTables).not.toHaveBeenCalled();
    expect(mocks.insertMetricSnapshot).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 200,
      body: {
        post: {
          published_post_id: "post-1",
          text: "Published text",
          posted_at: "2026-07-28T12:00:00.000Z",
        },
        metrics: {
          views: 100,
          likes: 20,
          replies: 3,
          reposts: 2,
          quotes: 1,
          shares: 4,
          engagement_total: 30,
          captured_at: "2026-07-28T13:00:00.000Z",
          valid_for_learning: true,
          anomaly_reason: null,
        },
        lineage: {
          source_selection_id: "selection-1",
          source_batch_id: "batch-1",
          source_identity_key: "source-key",
          source_card_id: "card-1",
          generation_run_id: "run-1",
          draft_id: "draft-1",
          scheduled_post_id: 44,
          published_post_id: "post-1",
        },
        source: {
          saved_pattern_id: 91,
          source_type: "saved_pattern",
          source_identity_key: "source-key",
          source_text: "Saved source text",
          source_likes: 1200,
        },
        source_card: {
          id: "card-1",
          family_id: "family-1",
          version_number: 2,
          is_current: 1,
          title: "Money source",
          transformation_contract: { audience_reward: "possibility" },
        },
        generation_run: {
          id: "run-1",
          source_card_id: "card-1",
          source_card_family_id: "family-1",
          source_card_version_number: 2,
          objective: "adapt",
          prompt_summary: "close mimicry",
          status: "completed",
          metadata: { mode: "test" },
          adaptation_plan: { goal: "preserve" },
        },
        draft: {
          id: "draft-1",
          run_id: "run-1",
          source_card_id: "card-1",
          status: "published",
          scheduled_post_id: 44,
          published_post_id: "post-1",
          strategy: { pillar: "money" },
          metadata: { gate: "pass" },
        },
        warning: null,
        response_mode: "compact",
      },
    });
  });

  it("persists changed metrics and returns full maturity evidence with optional history", async () => {
    const { mocks, dependencies } = createPostResultsHarness();
    const result = await readOperatorPostResults({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      payload: { published_post_id: "post-1", include_history: true },
    }, dependencies);

    expect(mocks.insertMetricSnapshot).toHaveBeenCalledWith({
      id: "snapshot-1",
      publishedPostId: "post-1",
      scheduledPostId: 44,
      draftId: "draft-1",
      generationRunId: "run-1",
      sourceCardId: "card-1",
      sourceSelectionId: "selection-1",
      metricsJson: "{\"views\":100,\"likes\":20,\"engagement_total\":30}",
      capturedAt: "2026-07-28T13:00:00.000Z",
      validForLearning: true,
      anomalyReason: null,
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      post: {
        published_post_id: "post-1",
        permalink: "https://threads.example/post-1",
        username: "manifestmental",
      },
      lineage: {
        source_selection_id: "selection-1",
        source_card_id: "card-1",
        scheduled_post_id: 44,
      },
      source_selection: {
        id: "selection-1",
        metrics_snapshot: { likes: 1200 },
      },
      performance_evaluation: {
        follower_attribution_policy: {
          post_level_attribution: "forbidden",
          day_or_period_post_attribution: "forbidden",
          account_level_tracking_only: true,
        },
        fingerprint: { family: "money" },
        fingerprint_version: "v2",
        maturity_scores: [{
          checkpoint_hours: 24,
          post_age_hours: 26,
          metrics: { likes: 20 },
          distribution_state: "mature",
        }],
      },
      metric_history: [{
        metrics: { likes: 10 },
        valid_for_learning: true,
        collection_source: "insights",
      }],
      warning: null,
    });
  });

  it("skips duplicate metric persistence and omitted history reads", async () => {
    const { mocks, dependencies } = createPostResultsHarness();
    mocks.loadLatestMetricSnapshot.mockResolvedValue({
      metrics_json: "{\"views\":100,\"likes\":20,\"engagement_total\":30}",
    });
    const result = await readOperatorPostResults({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      payload: { published_post_id: "post-1" },
    }, dependencies);

    expect(result.status).toBe(200);
    expect(mocks.insertMetricSnapshot).not.toHaveBeenCalled();
    expect(mocks.listMetricHistory).not.toHaveBeenCalled();
    expect(result.body.metric_history).toEqual([]);
  });
});

