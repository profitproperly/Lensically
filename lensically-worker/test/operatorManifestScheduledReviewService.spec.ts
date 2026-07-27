import { describe, expect, it, vi } from "vitest";
import {
  reviewOperatorManifestScheduledPost,
  type OperatorManifestScheduledReviewDependencies,
} from "../src/operatorManifestScheduledReviewService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function createHarness() {
  const mocks = {
    readScheduledPost: vi.fn(async () => ({
      id: 41,
      status: "approved",
      scheduled_time: "2026-07-28T00:00:00.000Z",
      post_text: "Original post",
    } as JsonRecord)),
    readLinkedDraft: vi.fn(async () => ({ id: "draft-1", source_card_id: "card-1" } as JsonRecord)),
    runGenerationGates: vi.fn(async () => ({ showable: true, blocking_failures: [] })),
    runSchedulingGates: vi.fn(async () => ({ showable: true, blocking_failures: [] })),
    updateScheduledPost: vi.fn(async () => ({
      success: true,
      scheduledPost: {
        id: 41,
        scheduled_time: "2026-07-28T00:00:00.000Z",
        post_text: "Replacement post",
      },
    })),
    updateLineup: vi.fn(async () => undefined),
    saveStrategyMemory: vi.fn(async () => undefined),
  };
  const dependencies: OperatorManifestScheduledReviewDependencies = {
    approvedStatus: "approved",
    workspaceDefaultTimezone: "America/New_York",
    normalizeText,
    normalizeMachineKey: (value, fallback) => typeof value === "string" && value.trim() ? value.trim() : fallback,
    readScheduledPost: mocks.readScheduledPost,
    readLinkedDraft: mocks.readLinkedDraft,
    runGenerationGates: mocks.runGenerationGates,
    getPartsInTimeZone: () => ({ year: 2026, month: 7, day: 27, hour: 20, minute: 0 }),
    formatIsoDateParts: (year, month, day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    runSchedulingGates: mocks.runSchedulingGates,
    updateScheduledPost: mocks.updateScheduledPost,
    updateLineup: mocks.updateLineup,
    saveStrategyMemory: mocks.saveStrategyMemory,
  };
  const payload: JsonRecord = {
    scheduled_post_id: 41,
    action: "rewrite",
    feedback: "Use a cleaner ending and preserve the hook.",
    lesson_scope: "family_strategy",
    replacement_text: "Replacement post",
    timezone: "America/New_York",
  };
  return { mocks, dependencies, payload };
}

describe("operatorManifestScheduledReviewService", () => {
  it("requires a valid scheduled-post action and feedback", async () => {
    const harness = createHarness();
    const result = await reviewOperatorManifestScheduledPost({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      payload: { scheduled_post_id: 0, action: "unknown", feedback: "" },
    }, harness.dependencies);

    expect(result).toEqual({ success: false, error: "scheduled_post_action_required" });
    expect(harness.mocks.readScheduledPost).not.toHaveBeenCalled();
  });

  it("allows review only for approved unpublished scheduled posts", async () => {
    const harness = createHarness();
    harness.mocks.readScheduledPost.mockResolvedValue({ id: 41, status: "posted" });

    const result = await reviewOperatorManifestScheduledPost({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      payload: harness.payload,
    }, harness.dependencies);

    expect(result).toEqual({
      success: false,
      error: "only_unpublished_approved_post_reviewable",
      status: "posted",
    });
    expect(harness.mocks.updateScheduledPost).not.toHaveBeenCalled();
  });

  it("blocks a replacement when generation gates fail", async () => {
    const harness = createHarness();
    harness.mocks.runGenerationGates.mockResolvedValue({
      showable: false,
      blocking_failures: [{ gate_key: "source_fidelity" }],
    });

    const result = await reviewOperatorManifestScheduledPost({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      payload: harness.payload,
    }, harness.dependencies);

    expect(result).toEqual({
      success: false,
      error: "replacement_generation_gates_failed",
      blocking_failures: [{ gate_key: "source_fidelity" }],
    });
    expect(harness.mocks.runSchedulingGates).not.toHaveBeenCalled();
    expect(harness.mocks.updateScheduledPost).not.toHaveBeenCalled();
  });

  it("rewrites the same scheduled slot after generation and scheduling gates pass", async () => {
    const harness = createHarness();

    const result = await reviewOperatorManifestScheduledPost({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      payload: harness.payload,
    }, harness.dependencies);

    expect(harness.mocks.runSchedulingGates).toHaveBeenCalledWith({
      draftId: "draft-1",
      sourceCardId: "card-1",
      replacementText: "Replacement post",
      date: "2026-07-27",
      time: "20:00",
      timezone: "America/New_York",
    });
    expect(harness.mocks.updateScheduledPost).toHaveBeenCalledWith({
      scheduledPostId: 41,
      threadsUserId: "threads-1",
      replacementText: "Replacement post",
      timezone: "America/New_York",
    });
    expect(harness.mocks.updateLineup).toHaveBeenCalledWith(expect.objectContaining({
      scheduledPostId: 41,
      replacementText: "Replacement post",
      status: "owner_revised",
    }));
    expect(result).toMatchObject({
      success: true,
      scheduled_post_id: 41,
      action: "rewrite",
      operational_effect: "The same scheduled slot was updated and remains covered.",
    });
  });

  it("records keep feedback without a production mutation and maps permanent rules", async () => {
    const harness = createHarness();
    const result = await reviewOperatorManifestScheduledPost({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
      payload: {
        scheduled_post_id: 41,
        action: "keep",
        feedback: "Never use this phrase again.",
        lesson_scope: "permanent_rule",
      },
    }, harness.dependencies);

    expect(harness.mocks.updateScheduledPost).not.toHaveBeenCalled();
    expect(harness.mocks.updateLineup).toHaveBeenCalledWith(expect.objectContaining({
      replacementText: null,
      status: "owner_kept",
    }));
    expect(harness.mocks.saveStrategyMemory).toHaveBeenCalledWith(expect.objectContaining({
      kind: "approved_rule",
      metadata: expect.objectContaining({ permanent: true, action: "keep" }),
    }));
    expect(result).toMatchObject({
      success: true,
      updated_post: null,
      operational_effect: "No production change; feedback recorded.",
    });
  });
});
