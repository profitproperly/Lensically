"use client";

import { buildWorkerUrl } from "./apiClient";
import { writeThreadsConnectionCache } from "./threadsConnectionCache";
import { writeThreadsProfileCache } from "./threadsProfileCache";

type ThreadsProfileAccount = {
  threads_profile_picture_url?: string | null;
  name?: string | null;
  username?: string | null;
  threads_biography?: string | null;
  is_verified?: boolean;
};

type ThreadsMeResponse = {
  connected?: boolean;
  account?: ThreadsProfileAccount | null;
};

type ThreadsPostsResponse = {
  posts?: unknown[];
  next_cursor?: string | null;
  has_more?: boolean;
};

const THREADS_ME_URL = buildWorkerUrl("/api/threads/me");
const THREADS_POSTS_URL = buildWorkerUrl("/api/threads/posts");

function isPreloadSupported(appUserId: string) {
  return typeof window !== "undefined" && appUserId.length > 0;
}

function buildInsightsCacheKey(appUserId: string) {
  return `lensically_insights_cache_${appUserId}`;
}

async function preloadThreadsStatus(appUserId: string) {
  const response = await fetch(
    `${THREADS_ME_URL}?app_user_id=${encodeURIComponent(appUserId)}`,
    { cache: "no-store", credentials: "include" },
  );

  if (!response.ok) {
    return;
  }

  const data = (await response.json()) as ThreadsMeResponse;
  const hasConnectedThreads = Boolean(data.connected && data.account);
  writeThreadsConnectionCache(appUserId, hasConnectedThreads);
  writeThreadsProfileCache(appUserId, hasConnectedThreads ? (data.account ?? null) : null);
}

async function preloadInsights(appUserId: string) {
  const response = await fetch(
    `${THREADS_POSTS_URL}?app_user_id=${encodeURIComponent(appUserId)}`,
    { cache: "no-store", credentials: "include" },
  );

  if (!response.ok) {
    return;
  }

  const data = (await response.json()) as ThreadsPostsResponse;
  const payload = {
    posts: Array.isArray(data.posts) ? data.posts : [],
    cursor: data.next_cursor ?? null,
    cursorDepth: 1,
    hasMore: Boolean(data.has_more),
    timestamp: Date.now(),
  };

  try {
    sessionStorage.setItem(buildInsightsCacheKey(appUserId), JSON.stringify(payload));
  } catch {
    // Ignore storage errors and keep runtime behavior unchanged.
  }
}

export async function preloadRouteDataForNavigation(route: string, appUserId: string) {
  if (!isPreloadSupported(appUserId)) {
    return;
  }

  try {
    if (route === "/dashboard" || route === "/account") {
      await preloadThreadsStatus(appUserId);
      return;
    }

    if (route === "/insights") {
      await preloadInsights(appUserId);
    }
  } catch {
    // Ignore preload failures so navigation always continues.
  }
}
