"use client";

export const SELECTED_THREADS_ACCOUNT_STORAGE_KEY = "lensically_selected_threads_user_id";
export const SELECTED_THREADS_ACCOUNT_EVENT = "lensically:selected-threads-account";

export function readSelectedThreadsUserId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(SELECTED_THREADS_ACCOUNT_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeSelectedThreadsUserId(threadsUserId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedThreadsUserId = threadsUserId.trim();
  const previousThreadsUserId = readSelectedThreadsUserId();
  try {
    if (normalizedThreadsUserId) {
      window.localStorage.setItem(SELECTED_THREADS_ACCOUNT_STORAGE_KEY, normalizedThreadsUserId);
    } else {
      window.localStorage.removeItem(SELECTED_THREADS_ACCOUNT_STORAGE_KEY);
    }
  } catch {
    // Ignore localStorage failures and still notify the current tab.
  }

  if (previousThreadsUserId !== normalizedThreadsUserId) {
    window.dispatchEvent(new CustomEvent(SELECTED_THREADS_ACCOUNT_EVENT, {
      detail: { threadsUserId: normalizedThreadsUserId },
    }));
  }
}

function appendQueryParam(url: string, key: string, value: string): string {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(normalizedValue)}`;
}

export function appendAppUserId(url: string, appUserId: string): string {
  return appendQueryParam(url, "app_user_id", appUserId);
}

export function appendThreadsUserId(url: string, threadsUserId: string): string {
  return appendQueryParam(url, "threads_user_id", threadsUserId);
}
