"use client";

import { buildWorkerUrl } from "./apiClient";
import {
  writeThreadsConnectionCache,
} from "./threadsConnectionCache";
import {
  clearThreadsProfileCache,
  writeThreadsProfileCache,
  readThreadsProfileCache,
} from "./threadsProfileCache";

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
const PROFILE_REQUIRED_ROUTES = new Set([
  "/dashboard",
  "/insights",
  "/saved-patterns",
  "/followers",
  "/post-archive",
  "/schedule",
  "/scheduled-posts",
]);

function isPreloadSupported(appUserId: string) {
  return typeof window !== "undefined" && appUserId.length > 0;
}

function buildInsightsCacheKey(appUserId: string) {
  return `lensically_insights_cache_${appUserId}`;
}

async function preloadThreadsStatus(appUserId: string) {
  const cachedProfile = readThreadsProfileCache(appUserId);
  const cachedUsername = cachedProfile?.account?.username;
  if (typeof cachedUsername === "string" && cachedUsername.trim().length > 0) {
    return true;
  }

  const response = await fetch(
    THREADS_ME_URL,
    { cache: "no-store", credentials: "include" },
  );

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as ThreadsMeResponse;
  const hasConnectedThreads = Boolean(data.connected && data.account);
  writeThreadsConnectionCache(appUserId, hasConnectedThreads);

  if (!hasConnectedThreads) {
    clearThreadsProfileCache(appUserId);
    return false;
  }

  writeThreadsProfileCache(appUserId, data.account ?? null);
  const nextCachedProfile = readThreadsProfileCache(appUserId);
  const nextUsername = nextCachedProfile?.account?.username;
  return typeof nextUsername === "string" && nextUsername.trim().length > 0;
}

async function preloadInsights(appUserId: string) {
  try {
    const cachedRaw = sessionStorage.getItem(buildInsightsCacheKey(appUserId));
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw) as { posts?: unknown[] };
      if (Array.isArray(cached.posts)) {
        return;
      }
    }
  } catch {
    // Ignore cache read errors and continue with preload fetch.
  }

  const response = await fetch(
    THREADS_POSTS_URL,
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
    return route;
  }

  try {
    if (PROFILE_REQUIRED_ROUTES.has(route)) {
      const hasReadyProfile = await preloadThreadsStatus(appUserId);
      if (!hasReadyProfile) {
        return route;
      }
    }

    if (route === "/insights") {
      await preloadInsights(appUserId);
    }
  } catch {
    // Ignore preload failures so navigation always continues.
  }

  return route;
}
