type ThreadsPublishErrorCode =
  | "threads_publish_create_failed"
  | "threads_publish_create_invalid_response"
  | "threads_publish_create_exception"
  | "threads_publish_status_check_failed"
  | "threads_publish_status_check_exception"
  | "threads_publish_status_invalid_response"
  | "threads_publish_status_not_ready"
  | "threads_publish_commit_failed"
  | "threads_publish_commit_invalid_response"
  | "threads_publish_commit_exception";

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
    errorMessage?: string;
    responseBody?: string;
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
  spoilerAllText?: boolean;
  spoilerPhrases?: string[];
  readinessMaxChecks?: number;
  autoPublishText?: boolean;
  readinessDelayMs?: number;
  publishMaxAttempts?: number;
};

export type ThreadsTextSpoilerEntity = {
  entity_type: "SPOILER";
  offset: number;
  length: number;
};

const DEFAULT_READINESS_MAX_CHECKS = 10;
const DEFAULT_READINESS_DELAY_MS = 1000;
const DEFAULT_PUBLISH_MAX_ATTEMPTS = 3;
const THREADS_READY_STATUSES = new Set(["FINISHED", "PUBLISHED"]);
const THREADS_PENDING_STATUSES = new Set(["IN_PROGRESS", "PROCESSING"]);
const MAX_PROVIDER_ERROR_BODY_LENGTH = 400;
const MAX_PROVIDER_ERROR_MESSAGE_LENGTH = 220;
const MAX_TEXT_SPOILER_ENTITIES = 10;

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

async function readTextSafe(response: Response): Promise<string | null> {
  try {
    return await response.text();
  } catch {
    return null;
  }
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function normalizeMessage(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return truncate(trimmed, MAX_PROVIDER_ERROR_MESSAGE_LENGTH);
}

function extractProviderErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const root = payload as Record<string, unknown>;
  const nestedError = root.error;
  if (nestedError && typeof nestedError === "object" && !Array.isArray(nestedError)) {
    const nestedErrorMessage = normalizeMessage((nestedError as Record<string, unknown>).message);
    if (nestedErrorMessage) {
      return nestedErrorMessage;
    }
  }

  const directErrorMessage = normalizeMessage(root.error_message);
  if (directErrorMessage) {
    return directErrorMessage;
  }

  const directMessage = normalizeMessage(root.message);
  if (directMessage) {
    return directMessage;
  }

  return null;
}

async function readProviderFailureDetails(response: Response): Promise<{ errorMessage: string | null; responseBody: string | null }> {
  const rawText = await readTextSafe(response);
  const trimmedRawText = rawText?.trim() ?? "";
  if (!trimmedRawText) {
    return { errorMessage: null, responseBody: null };
  }

  let parsedPayload: unknown = null;
  try {
    parsedPayload = JSON.parse(trimmedRawText);
  } catch {
    parsedPayload = null;
  }

  const errorMessage = extractProviderErrorMessage(parsedPayload);
  return {
    errorMessage,
    responseBody: truncate(trimmedRawText, MAX_PROVIDER_ERROR_BODY_LENGTH),
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeSpoilerPhrases(phrases: string[] | null | undefined): string[] {
  if (!Array.isArray(phrases)) {
    return [];
  }

  const normalized: string[] = [];
  for (const phrase of phrases) {
    if (typeof phrase !== "string") {
      continue;
    }
    const trimmed = phrase.trim();
    if (!trimmed) {
      continue;
    }
    normalized.push(trimmed);
  }
  return normalized.slice(0, MAX_TEXT_SPOILER_ENTITIES);
}

function rangesOverlap(
  leftStart: number,
  leftEndExclusive: number,
  rightStart: number,
  rightEndExclusive: number,
): boolean {
  return leftStart < rightEndExclusive && rightStart < leftEndExclusive;
}

export function buildTextSpoilerEntities(
  text: string,
  options: {
    spoilerAllText?: boolean;
    spoilerPhrases?: string[] | null;
  },
): {
  entities: ThreadsTextSpoilerEntity[];
  error?: string;
} {
  const normalizedPhrases = normalizeSpoilerPhrases(options.spoilerPhrases);

  if (options.spoilerAllText) {
    if (!text.length) {
      return { entities: [] };
    }
    return {
      entities: [{
        entity_type: "SPOILER",
        offset: 0,
        length: text.length,
      }],
    };
  }

  if (!normalizedPhrases.length) {
    return { entities: [] };
  }

  const entities: ThreadsTextSpoilerEntity[] = [];
  for (const phrase of normalizedPhrases) {
    let searchStart = 0;
    let matchedOffset = -1;

    while (searchStart <= text.length) {
      const offset = text.indexOf(phrase, searchStart);
      if (offset < 0) {
        break;
      }

      const endExclusive = offset + phrase.length;
      const overlapsExisting = entities.some((entity) =>
        rangesOverlap(offset, endExclusive, entity.offset, entity.offset + entity.length)
      );
      if (!overlapsExisting) {
        matchedOffset = offset;
        break;
      }

      searchStart = offset + 1;
    }

    if (matchedOffset < 0) {
      return {
        entities: [],
        error: `Spoiler phrase not found in post text: ${phrase}`,
      };
    }

    entities.push({
      entity_type: "SPOILER",
      offset: matchedOffset,
      length: phrase.length,
    });
  }

  if (entities.length > MAX_TEXT_SPOILER_ENTITIES) {
    return {
      entities: [],
      error: `Threads only allows up to ${MAX_TEXT_SPOILER_ENTITIES} text spoiler entities per post.`,
    };
  }

  entities.sort((left, right) => left.offset - right.offset);
  return { entities };
}

async function waitForContainerReadiness(
  accessToken: string,
  publishRequestId: string,
  readinessMaxChecks: number,
  readinessDelayMs: number,
): Promise<{
  success: true;
} | {
  success: false;
  errorCode: ThreadsPublishErrorCode;
  status?: number;
  errorMessage?: string;
  responseBody?: string;
}> {
  for (let attempt = 0; attempt < readinessMaxChecks; attempt += 1) {
    let statusResponse: Response;
    try {
      statusResponse = await fetch(
        `https://graph.threads.net/v1.0/${encodeURIComponent(publishRequestId)}?fields=status,error_message`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
    } catch {
      return {
        success: false,
        errorCode: "threads_publish_status_check_exception",
      };
    }

    if (!statusResponse.ok) {
      const details = await readProviderFailureDetails(statusResponse);
      return {
        success: false,
        errorCode: "threads_publish_status_check_failed",
        status: statusResponse.status,
        errorMessage: details.errorMessage ?? undefined,
        responseBody: details.responseBody ?? undefined,
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
): Promise<
  { success: true; payload: unknown }
  | {
    success: false;
    errorCode: "threads_publish_commit_failed" | "threads_publish_commit_invalid_response" | "threads_publish_commit_exception";
    status?: number;
    errorMessage?: string;
    responseBody?: string;
  }
> {
  const publishCommitBody = new URLSearchParams({
    creation_id: publishRequestId,
  });
  let commitResponse: Response;
  try {
    commitResponse = await fetch(
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
  } catch {
    return {
      success: false,
      errorCode: "threads_publish_commit_exception",
    };
  }
  if (!commitResponse.ok) {
    const details = await readProviderFailureDetails(commitResponse);
    return {
      success: false,
      errorCode: "threads_publish_commit_failed",
      status: commitResponse.status,
      errorMessage: details.errorMessage ?? undefined,
      responseBody: details.responseBody ?? undefined,
    };
  }

  const commitPayload = await readJsonSafe(commitResponse);
  if (commitPayload === null) {
    return {
      success: false,
      errorCode: "threads_publish_commit_invalid_response",
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
  spoilerAllText = false,
  spoilerPhrases = [],
  readinessMaxChecks = DEFAULT_READINESS_MAX_CHECKS,
  readinessDelayMs = DEFAULT_READINESS_DELAY_MS,
  publishMaxAttempts = DEFAULT_PUBLISH_MAX_ATTEMPTS,
}: ThreadsPublishOptions): Promise<ThreadsPublishServiceResult> {
  const publishCreateBody = new URLSearchParams({
    text,
    media_type: "TEXT",
  });
  const spoilerEntities = buildTextSpoilerEntities(text, {
    spoilerAllText,
    spoilerPhrases,
  });
  if (spoilerEntities.error) {
    return {
      success: false,
      errorCode: "threads_publish_create_invalid_response",
      errorMessage: spoilerEntities.error,
    };
  }
  if (spoilerEntities.entities.length > 0) {
    publishCreateBody.set("text_entities", JSON.stringify(spoilerEntities.entities));
  }
  let createResponse: Response;
  try {
    createResponse = await fetch(
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
  } catch {
    return {
      success: false,
      errorCode: "threads_publish_create_exception",
    };
  }
  if (!createResponse.ok) {
    const details = await readProviderFailureDetails(createResponse);
    return {
      success: false,
      errorCode: "threads_publish_create_failed",
      status: createResponse.status,
      errorMessage: details.errorMessage ?? undefined,
      responseBody: details.responseBody ?? undefined,
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

  void publishMaxAttempts;

  const readinessResult = await waitForContainerReadiness(
    accessToken,
    publishRequestId,
    readinessMaxChecks,
    readinessDelayMs,
  );
  if (!readinessResult.success) {
    return readinessResult;
  }

  // At-most-once external commit: readiness may be polled, but the publish
  // endpoint is called exactly once. An ambiguous commit remains quarantined
  // for explicit reconciliation instead of being retried automatically.
  const commitResult = await publishContainer(accessToken, threadsUserId, publishRequestId);
  if (!commitResult.success) {
    return {
      success: false,
      errorCode: commitResult.errorCode,
      status: commitResult.status,
      errorMessage: commitResult.errorMessage,
      responseBody: commitResult.responseBody,
    };
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
