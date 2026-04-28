const THREADS_GRAPH_BASE_URL = "https://graph.threads.net";
const DEFAULT_THREADS_API_VERSION = "v1.0";
const PROFILE_POSTS_FIELDS = "id,username,text,timestamp,permalink,media_type,media_url,has_replies";

export type ThreadsProfilePostsParams = {
  accessToken: string;
  username: string;
  cursor?: string | null;
  apiVersion?: string | null;
};

export type ThreadsProfilePostsRequestConfig = {
  url: string;
  requestInit: RequestInit;
};

export type NormalizedThreadsProfilePost = {
  id: string | null;
  username: string | null;
  text: string | null;
  timestamp: string | null;
  permalink: string | null;
  media_type: string | null;
  media_url: string | null;
  has_replies: boolean;
};

type ThreadsProfilePostsServiceErrorCode =
  | "threads_profile_posts_invalid_token"
  | "threads_profile_posts_provider_failed"
  | "threads_profile_posts_invalid_response"
  | "threads_profile_posts_exception";

export type ThreadsProfilePostsServiceResult =
  | {
    success: true;
    data: {
      posts: NormalizedThreadsProfilePost[];
      next_cursor: string | null;
    };
  }
  | {
    success: false;
    errorCode: ThreadsProfilePostsServiceErrorCode;
    status?: number;
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

function normalizePost(raw: unknown): NormalizedThreadsProfilePost | null {
  if (!isRecord(raw)) {
    return null;
  }

  const nestedPost = isRecord(raw.post)
    ? raw.post
    : null;

  const id = normalizeString(raw.id) ?? (nestedPost ? normalizeString(nestedPost.id) : null);
  const username = normalizeString(raw.username) ?? (nestedPost ? normalizeString(nestedPost.username) : null);
  const text = normalizeString(raw.text) ?? (nestedPost ? normalizeString(nestedPost.text) : null);
  const timestamp = normalizeString(raw.timestamp) ?? (nestedPost ? normalizeString(nestedPost.timestamp) : null);
  const permalink = normalizeString(raw.permalink) ?? (nestedPost ? normalizeString(nestedPost.permalink) : null);
  const mediaType = normalizeString(raw.media_type) ?? (nestedPost ? normalizeString(nestedPost.media_type) : null);
  const mediaUrl = normalizeString(raw.media_url) ?? (nestedPost ? normalizeString(nestedPost.media_url) : null);
  const hasReplies = raw.has_replies !== undefined
    ? normalizeBoolean(raw.has_replies)
    : nestedPost
      ? normalizeBoolean(nestedPost.has_replies)
      : false;

  return {
    id,
    username,
    text,
    timestamp,
    permalink,
    media_type: mediaType,
    media_url: mediaUrl,
    has_replies: hasReplies,
  };
}

export function normalizeThreadsProfilePostsResponse(payload: unknown): {
  posts: NormalizedThreadsProfilePost[];
  next_cursor: string | null;
} {
  if (!isRecord(payload)) {
    return { posts: [], next_cursor: null };
  }

  const rawPosts = Array.isArray(payload.data)
    ? payload.data
    : (Array.isArray(payload.posts) ? payload.posts : []);
  const posts: NormalizedThreadsProfilePost[] = [];
  for (const rawPost of rawPosts) {
    const normalizedPost = normalizePost(rawPost);
    if (!normalizedPost) {
      continue;
    }
    posts.push(normalizedPost);
  }

  let nextCursor = null as string | null;
  if (isRecord(payload.paging) && isRecord(payload.paging.cursors)) {
    nextCursor = normalizeString(payload.paging.cursors.after);
  }
  if (!nextCursor && isRecord(payload.paging)) {
    const nextUrl = normalizeString(payload.paging.next);
    if (nextUrl) {
      try {
        nextCursor = new URL(nextUrl).searchParams.get("after");
      } catch {
        nextCursor = null;
      }
    }
  }

  return {
    posts,
    next_cursor: nextCursor,
  };
}

export function createThreadsProfilePostsRequestConfig({
  accessToken,
  username,
  cursor,
  apiVersion,
}: ThreadsProfilePostsParams): ThreadsProfilePostsRequestConfig {
  const resolvedApiVersion = apiVersion?.trim() || DEFAULT_THREADS_API_VERSION;
  const params = new URLSearchParams({
    username: username.trim(),
    fields: PROFILE_POSTS_FIELDS,
  });
  const normalizedCursor = cursor?.trim() ?? "";
  if (normalizedCursor) {
    params.set("after", normalizedCursor);
  }

  return {
    url: `${THREADS_GRAPH_BASE_URL}/${encodeURIComponent(resolvedApiVersion)}/profile_posts?${params.toString()}`,
    requestInit: {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  };
}

export async function executeThreadsProfilePosts(
  params: ThreadsProfilePostsParams,
): Promise<ThreadsProfilePostsServiceResult> {
  const requestConfig = createThreadsProfilePostsRequestConfig(params);

  let response: Response;
  try {
    response = await fetch(requestConfig.url, requestConfig.requestInit);
  } catch {
    return {
      success: false,
      errorCode: "threads_profile_posts_exception",
    };
  }

  if (!response.ok) {
    const failedPayload = await readJsonSafe(response);
    if (isInvalidTokenProviderError(failedPayload)) {
      return {
        success: false,
        errorCode: "threads_profile_posts_invalid_token",
        status: response.status,
      };
    }

    return {
      success: false,
      errorCode: "threads_profile_posts_provider_failed",
      status: response.status,
    };
  }

  const payload = await readJsonSafe(response);
  if (payload === null) {
    return {
      success: false,
      errorCode: "threads_profile_posts_invalid_response",
    };
  }

  return {
    success: true,
    data: normalizeThreadsProfilePostsResponse(payload),
  };
}
