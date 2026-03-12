"use client";

const THREADS_CONNECTION_KEY_PREFIX = "lensically_threads_connected_";

function buildThreadsConnectionKey(appUserId: string) {
  return `${THREADS_CONNECTION_KEY_PREFIX}${appUserId}`;
}

export function readThreadsConnectionCache(appUserId: string): boolean | null {
  if (!appUserId || typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(buildThreadsConnectionKey(appUserId));
    if (raw === "true") {
      return true;
    }
    if (raw === "false") {
      return false;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeThreadsConnectionCache(appUserId: string, isConnected: boolean) {
  if (!appUserId || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(buildThreadsConnectionKey(appUserId), String(isConnected));
  } catch {
    // Ignore localStorage write failures.
  }
}

export function clearThreadsConnectionCache(appUserId: string) {
  if (!appUserId || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(buildThreadsConnectionKey(appUserId));
  } catch {
    // Ignore localStorage remove failures.
  }
}
