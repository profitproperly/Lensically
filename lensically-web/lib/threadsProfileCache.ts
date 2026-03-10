const THREADS_PROFILE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type CachedThreadsProfile = {
  account: {
    threads_profile_picture_url?: string | null;
    name?: string | null;
    username?: string | null;
    threads_biography?: string | null;
    is_verified?: boolean;
  } | null;
  timestamp: number;
};

function getCacheKey(appUserId: string) {
  return `lensically_threads_profile_${appUserId}`;
}

export function readThreadsProfileCache(appUserId: string): CachedThreadsProfile | null {
  if (typeof window === "undefined" || !appUserId) {
    return null;
  }

  try {
    const raw = localStorage.getItem(getCacheKey(appUserId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedThreadsProfile;
    if (!parsed?.timestamp || Date.now() - parsed.timestamp > THREADS_PROFILE_CACHE_TTL_MS) {
      localStorage.removeItem(getCacheKey(appUserId));
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeThreadsProfileCache(
  appUserId: string,
  account: CachedThreadsProfile["account"],
) {
  if (typeof window === "undefined" || !appUserId) {
    return;
  }

  const payload: CachedThreadsProfile = {
    account,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(getCacheKey(appUserId), JSON.stringify(payload));
  } catch {
    // Ignore storage errors and fall back to network-only behavior.
  }
}

export function clearThreadsProfileCache(appUserId: string) {
  if (typeof window === "undefined" || !appUserId) {
    return;
  }

  localStorage.removeItem(getCacheKey(appUserId));
}
