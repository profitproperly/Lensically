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

export function appendThreadsUserId(url: string, threadsUserId: string): string {
  const normalizedThreadsUserId = threadsUserId.trim();
  if (!normalizedThreadsUserId) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}threads_user_id=${encodeURIComponent(normalizedThreadsUserId)}`;
}
