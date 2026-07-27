import { describe, expect, it, vi } from "vitest";
import {
  scheduleOperatorManifestReviewBatch,
  type OperatorManifestReviewBatchSchedulingDependencies,
} from "../src/operatorManifestReviewBatchSchedulingService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function createHarness() {
  const batch: JsonRecord = {
    id: "batch-1",
    production_date: "2026-07-28",
    timezone: "America/New_York",
  };
  const claims: JsonRecord[] = [
    { id: "claim-1", review_item_number: 1, draft_id: "draft-1" },
    { id: "claim-2", review_item_number: 2, draft_id: "draft-2" },
  ];
  const draft: JsonRecord = {
    id: "draft-1",
    text: "Scheduled text",
    source_card_id: "card-1",
    strategy: { pillar: "mindset" },
  };
  const mocks = {
    getReviewBatch: vi.fn(async () => batch as JsonRecord | null),
    listScheduledPosts: vi.fn(async () => [] as JsonRecord[]),
    listApprovedClaims: vi.fn(async () => claims as JsonRecord[]),
    getDraft: vi.fn(async () => draft as JsonRecord | null),
    runSchedulingGates: vi.fn(async () => ({ showable: true, gate_results: [] as unknown[] })),
    createScheduledPost: vi.fn(async () => ({ success: true, scheduledPostId: "post-1" })),
    persistScheduledState: vi.fn(async () => undefined),
    saveStrategyTag: vi.fn(async () => undefined),
    insertInventory: vi.fn(async () => undefined),
    countUnresolved: vi.fn(async () => 1),
    updateReviewBatchStatus: vi.fn(async () => undefined),
    serializeReviewBatch: vi.fn(async () => ({ success: true, review_batch_id: "batch-1" } as JsonRecord | null)),
  };
  const dependencies: OperatorManifestReviewBatchSchedulingDependencies = {
    defaultTimezone: "America/New_York",
    normalizeText,
    now: () => new Date("2026-07-28T12:00:00Z"),
    localDateTimeParts: () => ({ date: "2026-07-28", hour: 8 }),
    hourlySlot: (hour) => `${String(hour).padStart(2, "0")}:00`,
    getReviewBatch: mocks.getReviewBatch,
    listScheduledPosts: mocks.listScheduledPosts,
    listApprovedClaims: mocks.listApprovedClaims,
    getDraft: mocks.getDraft,
    runSchedulingGates: mocks.runSchedulingGates,
    createScheduledPost: mocks.createScheduledPost,
    persistScheduledState: mocks.persistScheduledState,
    saveStrategyTag: mocks.saveStrategyTag,
    insertInventory: mocks.insertInventory,
    countUnresolved: mocks.countUnresolved,
    updateReviewBatchStatus: mocks.updateReviewBatchStatus,
    serializeReviewBatch: mocks.serializeReviewBatch,
  };
  return { batch, claims, draft, mocks, dependencies };
}

function input(payload: JsonRecord = { review_batch_id: "batch-1" }) {
  return {
    brandKey: "manifest_mental",
    accountId: "account-1",
    threadsUserId: "threads-1",
    payload,
  };
}

describe("operatorManifestReviewBatchSchedulingService", () => {
  it("returns the exact missing-batch response before schedule reads", async () => {
    const harness = createHarness();
    harness.mocks.getReviewBatch.mockResolvedValue(null);

    expect(await scheduleOperatorManifestReviewBatch(input(), harness.dependencies)).toEqual({
      status: 404,
      body: { success: false, error: "review_batch_not_found" },
    });
    expect(harness.mocks.listScheduledPosts).not.toHaveBeenCalled();
    expect(harness.mocks.listApprovedClaims).not.toHaveBeenCalled();
  });

  it("reconciles occupied hours and preserves one-post continuation fields", async () => {
    const harness = createHarness();
    harness.mocks.listScheduledPosts.mockResolvedValue([
      { local_time: "9:00" },
      { scheduled_time_local: "2026-07-28 10:00" },
    ]);

    const result = await scheduleOperatorManifestReviewBatch(input(), harness.dependencies);

    expect(harness.mocks.createScheduledPost).toHaveBeenCalledWith({
      threadsUserId: "threads-1",
      text: "Scheduled text",
      productionDate: "2026-07-28",
      time: "11:00",
      timezone: "America/New_York",
    });
    expect(result.body).toMatchObject({
      review_batch_id: "batch-1",
      invocation_item_limit: 1,
      remaining_approved_item_numbers: [2],
      continuation_required: true,
      results: [{ item_number: 1, success: true, scheduled_post_id: "post-1", time: "11:00" }],
    });
  });

  it("returns insufficient slots without reading or mutating a draft", async () => {
    const harness = createHarness();
    harness.dependencies.localDateTimeParts = () => ({ date: "2026-07-28", hour: 23 });

    expect(await scheduleOperatorManifestReviewBatch(input(), harness.dependencies)).toEqual({
      status: 409,
      body: {
        success: false,
        error: "insufficient_open_hourly_slots",
        open_slots: [],
        approved_items: 1,
      },
    });
    expect(harness.mocks.getDraft).not.toHaveBeenCalled();
    expect(harness.mocks.persistScheduledState).not.toHaveBeenCalled();
  });

  it("isolates scheduling gate failures without scheduler or lineage writes", async () => {
    const harness = createHarness();
    harness.mocks.runSchedulingGates.mockResolvedValue({ showable: false, gate_results: [{ gate: "brand", passed: false }] });

    const result = await scheduleOperatorManifestReviewBatch(input(), harness.dependencies);

    expect(harness.mocks.createScheduledPost).not.toHaveBeenCalled();
    expect(harness.mocks.persistScheduledState).not.toHaveBeenCalled();
    expect(harness.mocks.saveStrategyTag).not.toHaveBeenCalled();
    expect(harness.mocks.insertInventory).not.toHaveBeenCalled();
    expect(result.body.results).toEqual([{
      item_number: 1,
      success: false,
      error: "scheduling_gates_failed",
      gate_results: [{ gate: "brand", passed: false }],
    }]);
    expect(harness.mocks.updateReviewBatchStatus).toHaveBeenCalledWith("batch-1", "partially_resolved");
  });

  it("isolates scheduler failures and keeps continuation state deterministic", async () => {
    const harness = createHarness();
    harness.mocks.createScheduledPost.mockResolvedValue({ success: false, error: "upstream_unavailable" });

    const result = await scheduleOperatorManifestReviewBatch(input({
      review_batch_id: "batch-1",
      item_numbers: [2],
    }), harness.dependencies);

    expect(harness.mocks.getDraft).toHaveBeenCalledWith("draft-2");
    expect(harness.mocks.persistScheduledState).not.toHaveBeenCalled();
    expect(result.body).toMatchObject({
      results: [{ item_number: 2, success: false, error: "upstream_unavailable" }],
      remaining_approved_item_numbers: [],
      continuation_required: false,
    });
  });

  it("persists scheduled state, strategy lineage, inventory, and completed review status", async () => {
    const harness = createHarness();
    harness.mocks.countUnresolved.mockResolvedValue(0);

    await scheduleOperatorManifestReviewBatch(input(), harness.dependencies);

    expect(harness.mocks.persistScheduledState).toHaveBeenCalledWith({
      accountId: "account-1",
      draftId: "draft-1",
      claimId: "claim-1",
      scheduledPostId: "post-1",
    });
    expect(harness.mocks.saveStrategyTag).toHaveBeenCalledWith({
      accountId: "account-1",
      threadsUserId: "threads-1",
      scheduledPostId: "post-1",
      strategy: { pillar: "mindset" },
    });
    expect(harness.mocks.insertInventory).toHaveBeenCalledWith({
      brandKey: "manifest_mental",
      scheduledPostId: "post-1",
      text: "Scheduled text",
      sourceCardId: "card-1",
      strategy: { pillar: "mindset" },
    });
    expect(harness.mocks.updateReviewBatchStatus).toHaveBeenCalledWith("batch-1", "completed");
    expect(harness.mocks.serializeReviewBatch).toHaveBeenCalledWith("batch-1");
  });
});
