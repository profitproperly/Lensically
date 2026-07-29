import { describe, expect, it, vi } from "vitest";
import { retryOperatorScheduledPost } from "../src/operatorScheduledPostRetryService";

const nowMs = Date.parse("2026-07-29T12:00:00.000Z");

function createDependencies() {
  return {
    approvedStatus: "approved",
    postedStatus: "posted",
    nowMs,
    getRetryable: vi.fn(async () => ({
      id: 42,
      status: "approved",
      scheduled_time: "2026-07-29T11:00:00.000Z",
      published_post_id: null,
    })),
    processScheduledPost: vi.fn(async () => undefined),
    getRefreshed: vi.fn(async () => ({
      id: 42,
      status: "posted",
      scheduled_time: "2026-07-29T11:00:00.000Z",
      published_post_id: "threads-42",
      publish_error_message: null,
    })),
  };
}

describe("operator scheduled-post retry", () => {
  it("returns the exact not-found response before processing", async () => {
    const dependencies = createDependencies();
    dependencies.getRetryable.mockResolvedValueOnce(null);

    const result = await retryOperatorScheduledPost({ scheduledPostId: 42 }, dependencies);

    expect(result).toEqual({
      statusCode: 404,
      body: { success: false, error: "scheduled_post_not_found" },
    });
    expect(dependencies.processScheduledPost).not.toHaveBeenCalled();
  });

  it.each([
    [{ published_post_id: "threads-42", status: "approved" }],
    [{ published_post_id: null, status: "posted" }],
  ])("rejects an already-published record", async ([override]) => {
    const dependencies = createDependencies();
    dependencies.getRetryable.mockResolvedValueOnce({
      id: 42,
      scheduled_time: "2026-07-29T11:00:00.000Z",
      ...override,
    });

    const result = await retryOperatorScheduledPost({ scheduledPostId: 42 }, dependencies);

    expect(result).toEqual({
      statusCode: 409,
      body: { success: false, error: "scheduled_post_already_published" },
    });
    expect(dependencies.processScheduledPost).not.toHaveBeenCalled();
  });

  it("rejects a non-approved record with its current status", async () => {
    const dependencies = createDependencies();
    dependencies.getRetryable.mockResolvedValueOnce({
      id: 42,
      status: "failed",
      scheduled_time: "2026-07-29T11:00:00.000Z",
      published_post_id: null,
    });

    const result = await retryOperatorScheduledPost({ scheduledPostId: 42 }, dependencies);

    expect(result).toEqual({
      statusCode: 409,
      body: {
        success: false,
        error: "scheduled_post_not_retryable",
        status: "failed",
      },
    });
    expect(dependencies.processScheduledPost).not.toHaveBeenCalled();
  });

  it("uses the injected clock to reject a future approved record", async () => {
    const dependencies = createDependencies();
    dependencies.getRetryable.mockResolvedValueOnce({
      id: 42,
      status: "approved",
      scheduled_time: "2026-07-29T13:00:00.000Z",
      published_post_id: null,
    });

    const result = await retryOperatorScheduledPost({ scheduledPostId: 42 }, dependencies);

    expect(result).toEqual({
      statusCode: 409,
      body: {
        success: false,
        error: "scheduled_post_not_due",
        scheduled_time: "2026-07-29T13:00:00.000Z",
      },
    });
    expect(dependencies.processScheduledPost).not.toHaveBeenCalled();
  });

  it("processes once and returns exact refreshed publication success", async () => {
    const dependencies = createDependencies();
    const result = await retryOperatorScheduledPost({ scheduledPostId: 42 }, dependencies);

    expect(dependencies.getRetryable).toHaveBeenCalledWith(42);
    expect(dependencies.processScheduledPost).toHaveBeenCalledTimes(1);
    expect(dependencies.getRefreshed).toHaveBeenCalledWith(42);
    expect(result).toEqual({
      statusCode: 200,
      body: {
        success: true,
        retry_attempted: true,
        scheduled_post: {
          id: 42,
          status: "posted",
          scheduled_time: "2026-07-29T11:00:00.000Z",
          published_post_id: "threads-42",
          publish_error_message: null,
        },
        error: null,
      },
    });
  });

  it("returns the refreshed publish error with a 502 response", async () => {
    const dependencies = createDependencies();
    dependencies.getRefreshed.mockResolvedValueOnce({
      id: 42,
      status: "approved",
      scheduled_time: "2026-07-29T11:00:00.000Z",
      published_post_id: null,
      publish_error_message: "threads_unavailable",
    });

    const result = await retryOperatorScheduledPost({ scheduledPostId: 42 }, dependencies);

    expect(result).toEqual({
      statusCode: 502,
      body: {
        success: false,
        retry_attempted: true,
        scheduled_post: {
          id: 42,
          status: "approved",
          scheduled_time: "2026-07-29T11:00:00.000Z",
          published_post_id: null,
          publish_error_message: "threads_unavailable",
        },
        error: "threads_unavailable",
      },
    });
  });

  it("uses the exact fallback when refreshed state is unavailable", async () => {
    const dependencies = createDependencies();
    dependencies.getRefreshed.mockResolvedValueOnce(null);

    const result = await retryOperatorScheduledPost({ scheduledPostId: 42 }, dependencies);

    expect(result).toEqual({
      statusCode: 502,
      body: {
        success: false,
        retry_attempted: true,
        scheduled_post: null,
        error: "scheduled_post_retry_failed",
      },
    });
  });
});
