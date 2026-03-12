type ThreadsPublishErrorCode =
  | "threads_publish_create_failed"
  | "threads_publish_create_invalid_response"
  | "threads_publish_status_check_failed"
  | "threads_publish_status_invalid_response"
  | "threads_publish_status_not_ready"
  | "threads_publish_commit_failed"
  | "threads_publish_commit_invalid_response";

export type ThreadsPublishServiceResult =
  | {
    success: true;
    publishRequestId: string;
    publishedPostId: string;
    publishResponse: unknown;
  }
  | {
    success: false;
    errorCode: ThreadsPublishErrorCode;
    status?: number;
  };

type ThreadsCreatePayload = {
  id?: unknown;
};

type ThreadsStatusPayload = {
  status?: unknown;
};

type ThreadsPublishOptions = {
  accessToken: string;
  threadsUserId: string;
  text: string;
  readinessMaxChecks?: number;
  readinessDelayMs?: number;
};

const DEFAULT_READINESS_MAX_CHECKS = 10;
const DEFAULT_READINESS_DELAY_MS = 1000;
const THREADS_READY_STATUSES = new Set(["FINISHED", "PUBLISHED"]);
const THREADS_PENDING_STATUSES = new Set(["IN_PROGRESS", "PROCESSING"]);

function getIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = (payload as ThreadsCreatePayload).id;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getNormalizedStatus(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const status = (payload as ThreadsStatusPayload).status;
  if (typeof status !== "string") {
    return null;
  }
  return status.trim().toUpperCase();
}

async function readJsonSafe(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForContainerReadiness(
  accessToken: string,
  publishRequestId: string,
  readinessMaxChecks: number,
  readinessDelayMs: number,
): Promise<{ success: true } | { success: false; errorCode: ThreadsPublishErrorCode; status?: number }> {
  for (let attempt = 0; attempt < readinessMaxChecks; attempt += 1) {
    const statusResponse = await fetch(
      `https://graph.threads.net/v1.0/${encodeURIComponent(publishRequestId)}?fields=status,error_message`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!statusResponse.ok) {
      return {
        success: false,
        errorCode: "threads_publish_status_check_failed",
        status: statusResponse.status,
      };
    }

    const statusPayload = await readJsonSafe(statusResponse);
    if (statusPayload === null) {
      return {
        success: false,
        errorCode: "threads_publish_status_invalid_response",
      };
    }

    const normalizedStatus = getNormalizedStatus(statusPayload);
    if (!normalizedStatus) {
      return {
        success: false,
        errorCode: "threads_publish_status_invalid_response",
      };
    }

    if (THREADS_READY_STATUSES.has(normalizedStatus)) {
      return { success: true };
    }

    if (!THREADS_PENDING_STATUSES.has(normalizedStatus)) {
      return {
        success: false,
        errorCode: "threads_publish_status_not_ready",
      };
    }

    if (attempt < readinessMaxChecks - 1) {
      await wait(readinessDelayMs);
    }
  }

  return {
    success: false,
    errorCode: "threads_publish_status_not_ready",
  };
}

async function publishContainer(
  accessToken: string,
  threadsUserId: string,
  publishRequestId: string,
): Promise<{ success: true; payload: unknown } | { success: false; status?: number }> {
  const publishCommitBody = new URLSearchParams({
    creation_id: publishRequestId,
  });
  const commitResponse = await fetch(
    `https://graph.threads.net/v1.0/${encodeURIComponent(threadsUserId)}/threads_publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: publishCommitBody,
    },
  );
  if (!commitResponse.ok) {
    return {
      success: false,
      status: commitResponse.status,
    };
  }

  const commitPayload = await readJsonSafe(commitResponse);
  if (commitPayload === null) {
    return {
      success: false,
    };
  }

  return {
    success: true,
    payload: commitPayload,
  };
}

export async function publishTextToThreads({
  accessToken,
  threadsUserId,
  text,
  readinessMaxChecks = DEFAULT_READINESS_MAX_CHECKS,
  readinessDelayMs = DEFAULT_READINESS_DELAY_MS,
}: ThreadsPublishOptions): Promise<ThreadsPublishServiceResult> {
  const publishCreateBody = new URLSearchParams({
    text,
    media_type: "TEXT",
  });
  const createResponse = await fetch(
    `https://graph.threads.net/v1.0/${encodeURIComponent(threadsUserId)}/threads`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: publishCreateBody,
    },
  );
  if (!createResponse.ok) {
    return {
      success: false,
      errorCode: "threads_publish_create_failed",
      status: createResponse.status,
    };
  }

  const createPayload = await readJsonSafe(createResponse);
  if (createPayload === null) {
    return {
      success: false,
      errorCode: "threads_publish_create_invalid_response",
    };
  }

  const publishRequestId = getIdFromPayload(createPayload);
  if (!publishRequestId) {
    return {
      success: false,
      errorCode: "threads_publish_create_invalid_response",
    };
  }

  // Attempt publish immediately; if container is not ready yet, wait and retry once.
  let commitResult = await publishContainer(accessToken, threadsUserId, publishRequestId);
  if (!commitResult.success) {
    const readinessResult = await waitForContainerReadiness(
      accessToken,
      publishRequestId,
      readinessMaxChecks,
      readinessDelayMs,
    );
    if (!readinessResult.success) {
      return readinessResult;
    }

    commitResult = await publishContainer(accessToken, threadsUserId, publishRequestId);
    if (!commitResult.success) {
      return {
        success: false,
        errorCode: "threads_publish_commit_failed",
        status: commitResult.status,
      };
    }
  }

  const commitPayload = commitResult.payload;

  const publishedPostId = getIdFromPayload(commitPayload);
  if (!publishedPostId) {
    return {
      success: false,
      errorCode: "threads_publish_commit_invalid_response",
    };
  }

  return {
    success: true,
    publishRequestId,
    publishedPostId,
    publishResponse: commitPayload,
  };
}
