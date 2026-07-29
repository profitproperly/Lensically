type RetryableScheduledPost = {
  status: string;
  scheduled_time: string;
  published_post_id: unknown;
};

type RefreshedScheduledPost = {
  status?: unknown;
  published_post_id?: unknown;
  publish_error_message?: unknown;
  [key: string]: unknown;
};

export async function retryOperatorScheduledPost<
  TRetryable extends RetryableScheduledPost,
  TRefreshed extends RefreshedScheduledPost,
>(
  input: {
    scheduledPostId: number;
  },
  dependencies: {
    approvedStatus: string;
    postedStatus: string;
    nowMs: number;
    getRetryable: (scheduledPostId: number) => Promise<TRetryable | null>;
    processScheduledPost: (scheduledPost: TRetryable) => Promise<void>;
    getRefreshed: (scheduledPostId: number) => Promise<TRefreshed | null>;
  },
): Promise<{
  statusCode: number;
  body: Record<string, unknown>;
}> {
  const retryable = await dependencies.getRetryable(input.scheduledPostId);
  if (!retryable) {
    return {
      statusCode: 404,
      body: { success: false, error: "scheduled_post_not_found" },
    };
  }
  if (retryable.published_post_id || retryable.status === dependencies.postedStatus) {
    return {
      statusCode: 409,
      body: { success: false, error: "scheduled_post_already_published" },
    };
  }
  if (retryable.status !== dependencies.approvedStatus) {
    return {
      statusCode: 409,
      body: {
        success: false,
        error: "scheduled_post_not_retryable",
        status: retryable.status,
      },
    };
  }
  if (Date.parse(retryable.scheduled_time) > dependencies.nowMs) {
    return {
      statusCode: 409,
      body: {
        success: false,
        error: "scheduled_post_not_due",
        scheduled_time: retryable.scheduled_time,
      },
    };
  }

  await dependencies.processScheduledPost(retryable);
  const refreshed = await dependencies.getRefreshed(input.scheduledPostId);
  const published = refreshed?.status === dependencies.postedStatus
    && Boolean(refreshed?.published_post_id);

  return {
    statusCode: published ? 200 : 502,
    body: {
      success: published,
      retry_attempted: true,
      scheduled_post: refreshed ?? null,
      error: published
        ? null
        : refreshed?.publish_error_message ?? "scheduled_post_retry_failed",
    },
  };
}
