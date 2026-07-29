import { describe, expect, it, vi } from "vitest";
import { deleteOperatorScheduledPost } from "../src/operatorScheduledPostDeletionService";

const allowedReasonCodes = ["exact_duplicate", "technical_corruption"] as const;

function createDependencies(outcome: "deleted" | "not_found" | "not_deletable" | "reason_required" = "deleted") {
  return {
    normalizeReasonCode: vi.fn((value: unknown) => allowedReasonCodes.includes(value as typeof allowedReasonCodes[number])
      ? value as typeof allowedReasonCodes[number]
      : null),
    allowedReasonCodes,
    normalizeText: vi.fn((value: unknown) => {
      if (typeof value !== "string") return null;
      const normalized = value.trim();
      return normalized || null;
    }),
    deleteScheduledPost: vi.fn(async () => ({
      outcome,
      record: outcome === "deleted" ? { id: 42, reason_code: "exact_duplicate" } : null,
      replayed: outcome === "deleted",
    })),
  };
}

describe("operator scheduled-post deletion", () => {
  it("rejects a missing scheduled-post ID before protected deletion", async () => {
    const dependencies = createDependencies();
    const result = await deleteOperatorScheduledPost({
      payload: { reason_code: "exact_duplicate" },
    }, dependencies);

    expect(result).toEqual({
      statusCode: 400,
      body: { success: false, error: "scheduled_post_id is required" },
    });
    expect(dependencies.deleteScheduledPost).not.toHaveBeenCalled();
  });

  it("rejects an invalid deletion reason with the exact allowed codes", async () => {
    const dependencies = createDependencies();
    const result = await deleteOperatorScheduledPost({
      payload: { scheduled_post_id: 42, reason_code: "taste_feedback" },
    }, dependencies);

    expect(result).toEqual({
      statusCode: 400,
      body: {
        success: false,
        error: "scheduled_post_deletion_reason_code_required",
        allowed_reason_codes: ["exact_duplicate", "technical_corruption"],
      },
    });
    expect(dependencies.deleteScheduledPost).not.toHaveBeenCalled();
  });

  it("normalizes and forwards the protected deletion request", async () => {
    const dependencies = createDependencies();
    const result = await deleteOperatorScheduledPost({
      payload: {
        scheduled_post_id: "42.9",
        reason_code: "exact_duplicate",
        reason_detail: " Duplicate of post 41 ",
        operation_id: " delete-42 ",
      },
    }, dependencies);

    expect(dependencies.deleteScheduledPost).toHaveBeenCalledWith({
      scheduledPostId: 42,
      reasonCode: "exact_duplicate",
      reasonDetail: "Duplicate of post 41",
      operationId: "delete-42",
    });
    expect(result).toEqual({
      statusCode: 200,
      body: {
        success: true,
        deleted: true,
        deletion: { id: 42, reason_code: "exact_duplicate" },
        replayed: true,
        strategy_memory_written: false,
      },
    });
  });

  it.each([
    ["not_found", 404, "scheduled_post_not_found"],
    ["not_deletable", 409, "only_approved_scheduled_posts_can_be_deleted"],
    ["reason_required", 400, "scheduled_post_deletion_reason_required"],
  ] as const)("maps %s to the exact error response", async (outcome, statusCode, error) => {
    const dependencies = createDependencies(outcome);
    const result = await deleteOperatorScheduledPost({
      payload: { scheduled_post_id: 42, reason_code: "technical_corruption" },
    }, dependencies);

    expect(result).toEqual({
      statusCode,
      body: { success: false, error },
    });
  });

  it("returns null deletion and false replay for a fresh helper result", async () => {
    const dependencies = createDependencies();
    dependencies.deleteScheduledPost.mockResolvedValueOnce({
      outcome: "deleted",
      record: null,
      replayed: false,
    });

    const result = await deleteOperatorScheduledPost({
      payload: { scheduled_post_id: 7, reason_code: "technical_corruption" },
    }, dependencies);

    expect(result.body).toMatchObject({
      deletion: null,
      replayed: false,
      strategy_memory_written: false,
    });
  });
});
