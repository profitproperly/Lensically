const THREADS_GRAPH_BASE_URL = "https://graph.threads.net";
const DEFAULT_THREADS_API_VERSION = "v1.0";
const DEFAULT_SEARCH_MODE = "KEYWORD";
const DEFAULT_SEARCH_TYPE = "TOP";
const DEFAULT_LIMIT = 25;
const DEFAULT_LIMIT_STRING = String(DEFAULT_LIMIT);
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const MAX_QUERY_LENGTH = 100;
const DEFAULT_FIELDS = "id,text,media_type,permalink,timestamp,username,has_replies,is_quote_post,is_reply";
const ENFORCED_MEDIA_TYPE = "TEXT";
const ALLOWED_SEARCH_MODES = new Set(["KEYWORD"]);
const ALLOWED_SEARCH_TYPES = new Set(["TOP", "RECENT"]);

export type ThreadsKeywordSearchParams = {
  accessToken: string;
  query: string;
  searchMode?: string | null;
  searchType?: string | null;
  limit?: number | string | null;
  apiVersion?: string | null;
};

export type ThreadsKeywordSearchRequestConfig = {
  url: string;
  requestInit: RequestInit;
};

type ThreadsKeywordSearchServiceErrorCode =
  | "threads_keyword_search_invalid_token"
  | "threads_keyword_search_provider_failed"
  | "threads_keyword_search_invalid_response"
  | "threads_keyword_search_exception";

export type ThreadsKeywordSearchPost = {
  id: string | null;
  text: string | null;
  username: string | null;
  timestamp: string | null;
  permalink: string | null;
  media_type: string | null;
  has_replies: boolean;
  is_quote_post: boolean;
  is_reply: boolean;
};

export type ThreadsKeywordSearchNormalizedResponse = {
  posts: ThreadsKeywordSearchPost[];
};

export type ThreadsKeywordSearchServiceResult =
  | {
    success: true;
    data: ThreadsKeywordSearchNormalizedResponse;
  }
  | {
    success: false;
    errorCode: ThreadsKeywordSearchServiceErrorCode;
    status?: number;
  };

export type ThreadsKeywordSearchValidatedParams = {
  query: string;
  searchMode: string;
  searchType: string;
  limit: string;
};

export type ThreadsKeywordSearchValidationResult =
  | {
    valid: true;
    value: ThreadsKeywordSearchValidatedParams;
  }
  | {
    valid: false;
    errors: string[];
  };

function normalizeLimit(limit: number | string | null | undefined): string {
  if (typeof limit === "number" && Number.isFinite(limit)) {
    const bounded = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, Math.floor(limit)));
    return String(bounded);
  }

  if (typeof limit === "string") {
    const parsed = Number(limit.trim());
    if (Number.isFinite(parsed)) {
      const bounded = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, Math.floor(parsed)));
      return String(bounded);
    }
  }

  return String(DEFAULT_LIMIT);
}

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

function normalizePost(raw: unknown): ThreadsKeywordSearchPost | null {
  if (!isRecord(raw)) {
    return null;
  }

  return {
    id: normalizeString(raw.id),
    text: normalizeString(raw.text),
    username: normalizeString(raw.username),
    timestamp: normalizeString(raw.timestamp),
    permalink: normalizeString(raw.permalink),
    media_type: normalizeString(raw.media_type),
    has_replies: normalizeBoolean(raw.has_replies),
    is_quote_post: normalizeBoolean(raw.is_quote_post),
    is_reply: normalizeBoolean(raw.is_reply),
  };
}

export function normalizeThreadsKeywordSearchResponse(
  payload: unknown,
): ThreadsKeywordSearchNormalizedResponse {
  if (!isRecord(payload)) {
    return { posts: [] };
  }

  const rawPosts = Array.isArray(payload.data) ? payload.data : [];
  const posts: ThreadsKeywordSearchPost[] = [];

  for (const rawPost of rawPosts) {
    const normalizedPost = normalizePost(rawPost);
    if (!normalizedPost) {
      continue;
    }
    posts.push(normalizedPost);
  }

  return { posts };
}

export function validateThreadsKeywordSearchParams(input: {
  query: string | null | undefined;
  searchMode: string | null | undefined;
  searchType: string | null | undefined;
  limit: string | null | undefined;
}): ThreadsKeywordSearchValidationResult {
  const errors: string[] = [];

  const normalizedQuery = input.query?.trim() ?? "";
  if (!normalizedQuery) {
    errors.push("Query parameter q is required.");
  } else if (normalizedQuery.length > MAX_QUERY_LENGTH) {
    errors.push(`Query parameter q must be ${MAX_QUERY_LENGTH} characters or fewer.`);
  }

  const normalizedSearchMode = input.searchMode?.trim().toUpperCase() || DEFAULT_SEARCH_MODE;
  if (!ALLOWED_SEARCH_MODES.has(normalizedSearchMode)) {
    errors.push("search_mode must be KEYWORD.");
  }

  const normalizedSearchType = input.searchType?.trim().toUpperCase() || DEFAULT_SEARCH_TYPE;
  if (!ALLOWED_SEARCH_TYPES.has(normalizedSearchType)) {
    errors.push("search_type must be TOP or RECENT.");
  }

  let normalizedLimit = DEFAULT_LIMIT_STRING;
  const rawLimit = input.limit?.trim();
  if (rawLimit && !/^\d+$/.test(rawLimit)) {
    errors.push(`limit must be an integer between ${MIN_LIMIT} and ${MAX_LIMIT}.`);
  } else if (rawLimit) {
    const parsedLimit = Number(rawLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < MIN_LIMIT || parsedLimit > MAX_LIMIT) {
      errors.push(`limit must be an integer between ${MIN_LIMIT} and ${MAX_LIMIT}.`);
    } else {
      normalizedLimit = String(parsedLimit);
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return {
    valid: true,
    value: {
      query: normalizedQuery,
      searchMode: normalizedSearchMode,
      searchType: normalizedSearchType,
      limit: normalizedLimit,
    },
  };
}

export function createThreadsKeywordSearchRequestConfig({
  accessToken,
  query,
  searchMode,
  searchType,
  limit,
  apiVersion,
}: ThreadsKeywordSearchParams): ThreadsKeywordSearchRequestConfig {
  const resolvedApiVersion = apiVersion?.trim() || DEFAULT_THREADS_API_VERSION;
  const resolvedQuery = query.trim();
  const resolvedSearchMode = searchMode?.trim() || DEFAULT_SEARCH_MODE;
  const resolvedSearchType = searchType?.trim() || DEFAULT_SEARCH_TYPE;
  const resolvedLimit = normalizeLimit(limit);

  const params = new URLSearchParams({
    q: resolvedQuery,
    search_type: resolvedSearchType,
    search_mode: resolvedSearchMode,
    limit: resolvedLimit,
    media_type: ENFORCED_MEDIA_TYPE,
    fields: DEFAULT_FIELDS,
  });

  return {
    url: `${THREADS_GRAPH_BASE_URL}/${encodeURIComponent(resolvedApiVersion)}/keyword_search?${params.toString()}`,
    requestInit: {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  };
}

async function readJsonSafe(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
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

export async function executeThreadsKeywordSearch(
  params: ThreadsKeywordSearchParams,
): Promise<ThreadsKeywordSearchServiceResult> {
  const requestConfig = createThreadsKeywordSearchRequestConfig(params);

  let response: Response;
  try {
    response = await fetch(requestConfig.url, requestConfig.requestInit);
  } catch {
    return {
      success: false,
      errorCode: "threads_keyword_search_exception",
    };
  }

  if (!response.ok) {
    const failedPayload = await readJsonSafe(response);
    if (isInvalidTokenProviderError(failedPayload)) {
      return {
        success: false,
        errorCode: "threads_keyword_search_invalid_token",
        status: response.status,
      };
    }

    return {
      success: false,
      errorCode: "threads_keyword_search_provider_failed",
      status: response.status,
    };
  }

  const payload = await readJsonSafe(response);
  if (payload === null) {
    return {
      success: false,
      errorCode: "threads_keyword_search_invalid_response",
    };
  }

  return {
    success: true,
    data: normalizeThreadsKeywordSearchResponse(payload),
  };
}
