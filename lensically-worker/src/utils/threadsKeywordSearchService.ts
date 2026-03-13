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
const ALLOWED_SEARCH_MODES = new Set(["KEYWORD"]);
const ALLOWED_SEARCH_TYPES = new Set(["TOP", "RECENT"]);

type ThreadsKeywordSearchFilterValue = string | number | boolean | null | undefined;

export type ThreadsKeywordSearchFilters = {
  mediaType?: string | null;
  fields?: string | null;
  queryParams?: Record<string, ThreadsKeywordSearchFilterValue>;
};

export type ThreadsKeywordSearchParams = {
  accessToken: string;
  query: string;
  searchMode?: string | null;
  searchType?: string | null;
  limit?: number | string | null;
  filters?: ThreadsKeywordSearchFilters | null;
  apiVersion?: string | null;
};

export type ThreadsKeywordSearchRequestConfig = {
  url: string;
  requestInit: RequestInit;
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

function appendFilterParam(
  params: URLSearchParams,
  key: string,
  value: ThreadsKeywordSearchFilterValue,
): void {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    params.set(key, trimmed);
    return;
  }

  params.set(key, String(value));
}

export function createThreadsKeywordSearchRequestConfig({
  accessToken,
  query,
  searchMode,
  searchType,
  limit,
  filters,
  apiVersion,
}: ThreadsKeywordSearchParams): ThreadsKeywordSearchRequestConfig {
  const resolvedApiVersion = apiVersion?.trim() || DEFAULT_THREADS_API_VERSION;
  const resolvedQuery = query.trim();
  const resolvedSearchMode = searchMode?.trim() || DEFAULT_SEARCH_MODE;
  const resolvedSearchType = searchType?.trim() || DEFAULT_SEARCH_TYPE;
  const resolvedLimit = normalizeLimit(limit);
  const resolvedFields = filters?.fields?.trim() || DEFAULT_FIELDS;

  const params = new URLSearchParams({
    q: resolvedQuery,
    search_type: resolvedSearchType,
    search_mode: resolvedSearchMode,
    limit: resolvedLimit,
    fields: resolvedFields,
  });

  const mediaType = filters?.mediaType?.trim();
  if (mediaType) {
    params.set("media_type", mediaType);
  }

  const queryParams = filters?.queryParams;
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      appendFilterParam(params, key, value);
    }
  }

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
