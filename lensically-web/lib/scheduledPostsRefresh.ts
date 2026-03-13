const SCHEDULED_POSTS_UPDATED_EVENT = "lensically:scheduled-posts-updated";
const SCHEDULED_POSTS_UPDATED_STORAGE_KEY = "lensically_scheduled_posts_updated_at";

export function notifyScheduledPostsUpdated(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(SCHEDULED_POSTS_UPDATED_EVENT));

  try {
    window.localStorage.setItem(SCHEDULED_POSTS_UPDATED_STORAGE_KEY, Date.now().toString());
  } catch {
    // Ignore storage errors; in-tab event dispatch is enough for core behavior.
  }
}

export function subscribeScheduledPostsUpdated(onUpdate: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleCustomEvent = () => {
    onUpdate();
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== SCHEDULED_POSTS_UPDATED_STORAGE_KEY) {
      return;
    }
    onUpdate();
  };

  window.addEventListener(SCHEDULED_POSTS_UPDATED_EVENT, handleCustomEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener(SCHEDULED_POSTS_UPDATED_EVENT, handleCustomEvent);
    window.removeEventListener("storage", handleStorageEvent);
  };
}
