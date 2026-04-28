"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { buildWorkerUrl } from "@/lib/apiClient";

type DiscoveredProfile = {
  id: string | null;
  username: string | null;
  name: string | null;
  biography: string | null;
  profile_picture_url: string | null;
  is_verified: boolean;
  follower_count: number | null;
  likes_count: number | null;
  quotes_count: number | null;
  replies_count: number | null;
  reposts_count: number | null;
  views_count: number | null;
};

type DiscoveredPost = {
  id: string | null;
  username: string | null;
  text: string | null;
  timestamp: string | null;
  permalink: string | null;
  media_type: string | null;
  media_url: string | null;
  has_replies: boolean;
};

type ProfileDiscoveryResponse = DiscoveredProfile & {
  error?: string;
};

type ProfilePostsDiscoveryResponse = {
  posts?: DiscoveredPost[];
  next_cursor?: string | null;
  error?: string;
};

const THREADS_DISCOVERY_PROFILE_URL = buildWorkerUrl("/api/threads/discovery/profile");
const THREADS_DISCOVERY_PROFILE_POSTS_URL = buildWorkerUrl("/api/threads/discovery/profile_posts");

function formatPostTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return "";
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export default function DiscoveryPage() {
  const { user, loading } = useAuth();
  const appUserId = user?.id?.trim() ?? "";

  const [username, setUsername] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [discoveredProfile, setDiscoveredProfile] = useState<DiscoveredProfile | null>(null);
  const [discoveredPosts, setDiscoveredPosts] = useState<DiscoveredPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [activeUsername, setActiveUsername] = useState<string | null>(null);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const [postsErrorMessage, setPostsErrorMessage] = useState("");
  const [postsSuccessMessage, setPostsSuccessMessage] = useState("");
  const [authGateTimedOut, setAuthGateTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setAuthGateTimedOut(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAuthGateTimedOut(true);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loading]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    console.log("DISCOVERY_SUBMIT_HANDLER_EXECUTED", {
      message: "Discovery request is about to execute.",
      enteredUsername: username,
    });
    setErrorMessage("");
    setSuccessMessage("");
    setPostsErrorMessage("");
    setPostsSuccessMessage("");

    const normalizedUsername = username.trim().replace(/^@+/, "");
    if (!normalizedUsername) {
      console.log("DISCOVERY_EARLY_EXIT_MISSING_USERNAME", {
        enteredUsername: username,
      });
      setErrorMessage("Please enter a Threads username.");
      return;
    }

    setIsSearching(true);
    setDiscoveredProfile(null);
    setDiscoveredPosts([]);
    setNextCursor(null);
    setActiveUsername(null);
    setIsLoadingMorePosts(false);

    try {
      const profileParams = new URLSearchParams({ username: normalizedUsername });
      if (appUserId) {
        profileParams.set("app_user_id", appUserId);
      }
      console.log("DISCOVERY_FETCH_PROFILE_START", {
        username: normalizedUsername,
        url: `${THREADS_DISCOVERY_PROFILE_URL}?${profileParams.toString()}`,
      });
      const profileResponse = await fetch(
        `${THREADS_DISCOVERY_PROFILE_URL}?${profileParams.toString()}`,
        {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        },
      );

      const profileData = (await profileResponse.json()) as ProfileDiscoveryResponse;
      if (!profileResponse.ok) {
        console.log("DISCOVERY_FETCH_PROFILE_NON_OK", {
          status: profileResponse.status,
          error: profileData.error ?? null,
        });
        setErrorMessage(profileData.error || "Unable to discover profile.");
        return;
      }

      setDiscoveredProfile(profileData);

      const postsParams = new URLSearchParams({ username: normalizedUsername });
      if (appUserId) {
        postsParams.set("app_user_id", appUserId);
      }
      console.log("DISCOVERY_FETCH_POSTS_START", {
        username: normalizedUsername,
        url: `${THREADS_DISCOVERY_PROFILE_POSTS_URL}?${postsParams.toString()}`,
      });
      const postsResponse = await fetch(
        `${THREADS_DISCOVERY_PROFILE_POSTS_URL}?${postsParams.toString()}`,
        {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        },
      );

      const postsData = (await postsResponse.json()) as ProfilePostsDiscoveryResponse;
      if (!postsResponse.ok) {
        console.log("DISCOVERY_FETCH_POSTS_NON_OK", {
          status: postsResponse.status,
          error: postsData.error ?? null,
        });
        setErrorMessage(postsData.error || "Profile found, but posts could not be loaded.");
        return;
      }

      const normalizedPosts = Array.isArray(postsData.posts) ? postsData.posts : [];
      setDiscoveredPosts(normalizedPosts);
      setNextCursor(postsData.next_cursor ?? null);
      setActiveUsername(normalizedUsername);
      setSuccessMessage(
        `Loaded @${normalizedUsername} with ${normalizedPosts.length} post${normalizedPosts.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      console.log("DISCOVERY_SUBMIT_HANDLER_EXCEPTION", {
        error: error instanceof Error ? error.message : String(error),
      });
      setErrorMessage("Unexpected error while loading profile discovery results.");
    } finally {
      setIsSearching(false);
    }
  }

  const isAuthGateActive = loading && !authGateTimedOut;

  async function handleLoadMorePosts(): Promise<void> {
    const cursor = nextCursor?.trim() ?? "";
    const normalizedUsername = activeUsername?.trim().replace(/^@+/, "") ?? "";

    setPostsErrorMessage("");
    setPostsSuccessMessage("");

    if (!cursor) {
      setPostsErrorMessage("No additional posts are available.");
      return;
    }
    if (!normalizedUsername) {
      setPostsErrorMessage("Profile username is missing for pagination.");
      return;
    }

    setIsLoadingMorePosts(true);
    try {
      const params = new URLSearchParams({
        username: normalizedUsername,
        cursor,
      });
      if (appUserId) {
        params.set("app_user_id", appUserId);
      }
      const postsResponse = await fetch(
        `${THREADS_DISCOVERY_PROFILE_POSTS_URL}?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        },
      );

      const postsData = (await postsResponse.json()) as ProfilePostsDiscoveryResponse;
      if (!postsResponse.ok) {
        setPostsErrorMessage(postsData.error || "Unable to load more posts.");
        return;
      }

      const nextPosts = Array.isArray(postsData.posts) ? postsData.posts : [];
      setDiscoveredPosts((previousPosts) => [...previousPosts, ...nextPosts]);
      setNextCursor(postsData.next_cursor ?? null);
      setPostsSuccessMessage(
        `Loaded ${nextPosts.length} additional post${nextPosts.length === 1 ? "" : "s"}.`,
      );
    } catch {
      setPostsErrorMessage("Unexpected error while loading more posts.");
    } finally {
      setIsLoadingMorePosts(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">Profile Discovery</h1>

      <form
        onSubmit={handleSearch}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <label htmlFor="discovery-username" className="mb-2 block text-sm font-medium text-slate-700">
          Threads username
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="discovery-username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="e.g. zuck"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-slate-900/20 placeholder:text-slate-400 focus:ring-2"
            disabled={isSearching}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={isSearching || isAuthGateActive}
            className="inline-flex cursor-pointer items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAuthGateActive ? "Loading session..." : (isSearching ? "Searching..." : "Discover")}
          </button>
        </div>
      </form>

      {errorMessage ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      {successMessage ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      {discoveredProfile ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Discovered Profile</h2>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              {discoveredProfile.profile_picture_url ? (
                <img
                  src={discoveredProfile.profile_picture_url}
                  alt={`${discoveredProfile.username || "Threads"} avatar`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-500">
                  No Photo
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold text-slate-900">
                  {discoveredProfile.name || "Unknown name"}
                </h3>
                {discoveredProfile.is_verified ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Verified
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-sm text-slate-600">
                {discoveredProfile.username ? `@${discoveredProfile.username}` : "No username"}
              </p>

              {discoveredProfile.biography ? (
                <p className="mt-3 text-sm leading-6 text-slate-700">{discoveredProfile.biography}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {discoveredProfile.follower_count !== null ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Followers</p>
                <p className="text-sm font-semibold text-slate-900">{discoveredProfile.follower_count.toLocaleString()}</p>
              </div>
            ) : null}
            {discoveredProfile.likes_count !== null ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Likes</p>
                <p className="text-sm font-semibold text-slate-900">{discoveredProfile.likes_count.toLocaleString()}</p>
              </div>
            ) : null}
            {discoveredProfile.quotes_count !== null ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Quotes</p>
                <p className="text-sm font-semibold text-slate-900">{discoveredProfile.quotes_count.toLocaleString()}</p>
              </div>
            ) : null}
            {discoveredProfile.replies_count !== null ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Replies</p>
                <p className="text-sm font-semibold text-slate-900">{discoveredProfile.replies_count.toLocaleString()}</p>
              </div>
            ) : null}
            {discoveredProfile.reposts_count !== null ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Reposts</p>
                <p className="text-sm font-semibold text-slate-900">{discoveredProfile.reposts_count.toLocaleString()}</p>
              </div>
            ) : null}
            {discoveredProfile.views_count !== null ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Views</p>
                <p className="text-sm font-semibold text-slate-900">{discoveredProfile.views_count.toLocaleString()}</p>
              </div>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Posts loaded: {discoveredPosts.length}
            {nextCursor ? " - More posts available" : ""}
          </p>
        </section>
      ) : null}

      {discoveredProfile ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Profile Posts</h2>
            {nextCursor ? (
              <button
                type="button"
                onClick={() => {
                  void handleLoadMorePosts();
                }}
                disabled={isLoadingMorePosts}
                className="inline-flex cursor-pointer items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingMorePosts ? "Loading more..." : "Load more"}
              </button>
            ) : null}
          </div>

          {postsErrorMessage ? (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {postsErrorMessage}
            </p>
          ) : null}

          {postsSuccessMessage ? (
            <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {postsSuccessMessage}
            </p>
          ) : null}

          {discoveredPosts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No posts found for this profile.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {discoveredPosts.map((post, index) => (
                <article
                  key={`${post.id ?? "post"}-${index}`}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      {post.username ? `@${post.username}` : ""}
                    </p>
                    {formatPostTimestamp(post.timestamp) ? (
                      <p className="text-xs text-slate-500">{formatPostTimestamp(post.timestamp)}</p>
                    ) : null}
                  </div>

                  {post.text ? (
                    <p className="mt-2 text-sm text-slate-700">{post.text}</p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No text content.</p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>Type: {post.media_type || "N/A"}</span>
                    <span>{post.has_replies ? "Has replies" : "No replies"}</span>
                    {post.media_url ? (
                      <a
                        href={post.media_url}
                        target="_blank"
                        rel="noreferrer"
                        className="cursor-pointer text-slate-700 underline hover:text-slate-900"
                      >
                        Open media
                      </a>
                    ) : null}
                    {post.permalink ? (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="cursor-pointer text-slate-700 underline hover:text-slate-900"
                      >
                        View on Threads
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
