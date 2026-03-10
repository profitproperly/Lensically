const THREADS_OAUTH_PENDING_KEY = "lensically_threads_oauth_pending";
const THREADS_OAUTH_PENDING_WINDOW_MS = 15_000;

export function markThreadsOauthPending() {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(THREADS_OAUTH_PENDING_KEY, String(Date.now()));
}

export function clearThreadsOauthPending() {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(THREADS_OAUTH_PENDING_KEY);
}

export function hasRecentThreadsOauthPending() {
  if (typeof window === "undefined") {
    return false;
  }

  const rawValue = sessionStorage.getItem(THREADS_OAUTH_PENDING_KEY);
  const timestamp = Number(rawValue);

  if (!rawValue || !Number.isFinite(timestamp)) {
    return false;
  }

  if (Date.now() - timestamp > THREADS_OAUTH_PENDING_WINDOW_MS) {
    sessionStorage.removeItem(THREADS_OAUTH_PENDING_KEY);
    return false;
  }

  return true;
}
