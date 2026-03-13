const THREADS_GRAPH_BASE_URL = "https://graph.threads.net";
const DEFAULT_THREADS_API_VERSION = "v1.0";
const DEFAULT_SEARCH_MODE = "KEYWORD";
const DEFAULT_SEARCH_TYPE = "TOP";
const DEFAULT_LIMIT = 25;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const DEFAULT_FIELDS = "id,text,media_type,permalink,timestamp,username,has_replies,is_quote_post,is_reply";

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
