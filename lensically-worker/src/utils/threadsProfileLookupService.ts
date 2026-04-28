const THREADS_GRAPH_BASE_URL = "https://graph.threads.net";
const DEFAULT_THREADS_API_VERSION = "v1.0";

export type ThreadsProfileLookupParams = {
  accessToken: string;
  username: string;
  apiVersion?: string | null;
};

export type ThreadsProfileLookupRequestConfig = {
  url: string;
  requestInit: RequestInit;
};

export type NormalizedThreadsProfile = {
  id: string | null;
  username: string | null;
  name: string | null;
  biography: string | null;
  profile_picture_url: string | null;
  is_verified: boolean;
  follower_count: number | null;
  likes_count: number | null;
  quotes_count: number | null;
  replies_count: number | null;
  reposts_count: number | null;
  views_count: number | null;
};

type ThreadsProfileLookupServiceErrorCode =
  | "threads_profile_lookup_invalid_token"
  | "threads_profile_lookup_provider_failed"
  | "threads_profile_lookup_invalid_response"
  | "threads_profile_lookup_exception";

export type ThreadsProfileLookupServiceResult =
  | {
    success: true;
    data: NormalizedThreadsProfile;
  }
  | {
    success: false;
    errorCode: ThreadsProfileLookupServiceErrorCode;
    status?: number;
    responseBody?: unknown;
    errorMessage?: string;
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  return false;
}

function normalizeNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

async function readJsonSafe(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function parseJsonSafe(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function readResponseBodyForLogging(response: Response): Promise<unknown> {
  try {
    const rawText = await response.text();
    if (!rawText) {
      return null;
    }
    return parseJsonSafe(rawText) ?? rawText;
  } catch {
    return null;
  }
}

function toStructuredErrorLog(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isInvalidTokenProviderError(payload: unknown): boolean {
  if (!isRecord(payload)) {
    return false;
  }

  const errorValue = payload.error;
  if (!isRecord(errorValue)) {
    return false;
  }

  const code = errorValue.code;
  if (typeof code === "number" && code === 190) {
    return true;
  }

  const type = errorValue.type;
  return typeof type === "string" && type.trim().toLowerCase() === "oauthexception";
}

export function normalizeThreadsProfileLookupResponse(payload: unknown): NormalizedThreadsProfile | null {
  if (!isRecord(payload)) {
    return null;
  }

  const sourceCandidate = Array.isArray(payload.data)
    ? payload.data[0]
    : payload;

  if (!isRecord(sourceCandidate)) {
    return null;
  }

  return {
    id: normalizeString(sourceCandidate.id),
    username: normalizeString(sourceCandidate.username),
    name: normalizeString(sourceCandidate.name),
    biography: normalizeString(sourceCandidate.biography)
      ?? normalizeString(sourceCandidate.threads_biography),
    profile_picture_url: normalizeString(sourceCandidate.profile_picture_url)
      ?? normalizeString(sourceCandidate.threads_profile_picture_url),
    is_verified: normalizeBoolean(sourceCandidate.is_verified)
      || normalizeBoolean(sourceCandidate.verified),
    follower_count: normalizeNullableNumber(sourceCandidate.follower_count),
    likes_count: normalizeNullableNumber(sourceCandidate.likes_count),
    quotes_count: normalizeNullableNumber(sourceCandidate.quotes_count),
    replies_count: normalizeNullableNumber(sourceCandidate.replies_count),
    reposts_count: normalizeNullableNumber(sourceCandidate.reposts_count),
    views_count: normalizeNullableNumber(sourceCandidate.views_count),
  };
}

export function createThreadsProfileLookupRequestConfig({
  accessToken,
  username,
  apiVersion,
}: ThreadsProfileLookupParams): ThreadsProfileLookupRequestConfig {
  const resolvedApiVersion = apiVersion?.trim() || DEFAULT_THREADS_API_VERSION;
  const params = new URLSearchParams({
    username: username.trim(),
  });

  return {
    url: `${THREADS_GRAPH_BASE_URL}/${encodeURIComponent(resolvedApiVersion)}/profile_lookup?${params.toString()}`,
    requestInit: {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  };
}

export async function executeThreadsProfileLookup(
  params: ThreadsProfileLookupParams,
): Promise<ThreadsProfileLookupServiceResult> {
  const requestConfig = createThreadsProfileLookupRequestConfig(params);

  let response: Response;
  try {
    response = await fetch(requestConfig.url, requestConfig.requestInit);
  } catch (error) {
    const errorMessage = toStructuredErrorLog(error);
    console.error("THREADS_PROFILE_LOOKUP_SERVICE_FETCH_EXCEPTION", {
      error_code: "threads_profile_lookup_exception",
      username: params.username,
      error_message: errorMessage,
    });
    return {
      success: false,
      errorCode: "threads_profile_lookup_exception",
      errorMessage,
    };
  }

  if (!response.ok) {
    const failedPayload = await readResponseBodyForLogging(response);
    const errorMessage = `Threads profile lookup failed with status ${response.status}`;
    console.error("THREADS_PROFILE_LOOKUP_SERVICE_UPSTREAM_FAILED", {
      error_code: "threads_profile_lookup_provider_failed",
      username: params.username,
      status: response.status,
      response_body: failedPayload,
      error_message: errorMessage,
    });
    if (isInvalidTokenProviderError(failedPayload)) {
      return {
        success: false,
        errorCode: "threads_profile_lookup_invalid_token",
        status: response.status,
        responseBody: failedPayload,
        errorMessage,
      };
    }

    return {
      success: false,
      errorCode: "threads_profile_lookup_provider_failed",
      status: response.status,
      responseBody: failedPayload,
      errorMessage,
    };
  }

  const payload = await readJsonSafe(response);
  if (payload === null) {
    const errorMessage = "Threads profile lookup returned a non-JSON payload.";
    console.error("THREADS_PROFILE_LOOKUP_SERVICE_INVALID_RESPONSE", {
      error_code: "threads_profile_lookup_invalid_response",
      username: params.username,
      status: response.status,
      response_body: null,
      error_message: errorMessage,
    });
    return {
      success: false,
      errorCode: "threads_profile_lookup_invalid_response",
      status: response.status,
      responseBody: null,
      errorMessage,
    };
  }

  const normalizedProfile = normalizeThreadsProfileLookupResponse(payload);
  if (normalizedProfile === null) {
    const errorMessage = "Threads profile lookup payload shape was invalid.";
    console.error("THREADS_PROFILE_LOOKUP_SERVICE_INVALID_SHAPE", {
      error_code: "threads_profile_lookup_invalid_response",
      username: params.username,
      status: response.status,
      response_body: payload,
      error_message: errorMessage,
    });
    return {
      success: false,
      errorCode: "threads_profile_lookup_invalid_response",
      status: response.status,
      responseBody: payload,
      errorMessage,
    };
  }

  return {
    success: true,
    data: normalizedProfile,
  };
}
