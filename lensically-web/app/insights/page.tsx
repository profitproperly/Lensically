"use client";

import { useEffect, useState } from "react";

type ThreadsPost = {
  id?: string;
  text?: string;
  timestamp?: string;
  username?: string;
  permalink?: string;
};

type PostsResponse = {
  posts?: ThreadsPost[];
  next_cursor?: string | null;
  has_more?: boolean;
  error?: string;
};

export const runtime = "edge";
const CONNECT_THREADS_URL =
  "https://lensically-worker.lensically.workers.dev/api/auth/threads/start";

export default function InsightsPage() {
  const [posts, setPosts] = useState<ThreadsPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorDepth, setCursorDepth] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [needsConnection, setNeedsConnection] = useState(false);
  const [hasError, setHasError] = useState(false);

  const loadPosts = async () => {
    try {
      setLoadingInitial(true);
      setHasError(false);
      setNeedsConnection(false);
      const res = await fetch(
        "https://lensically-worker.lensically.workers.dev/api/threads/posts",
      );
      const data = (await res.json()) as PostsResponse;

      if (!res.ok) {
        const errorMessage = (data.error || "").toLowerCase();
        setNeedsConnection(errorMessage.includes("account not connected"));
        setHasError(!errorMessage.includes("account not connected"));
        setPosts([]);
        setCursor(null);
        setHasMore(false);
        setCursorDepth(1);
        return;
      }

      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setCursor(data.next_cursor || null);
      setHasMore(Boolean(data.has_more));
      setCursorDepth(1);
    } catch {
      setHasError(true);
      setNeedsConnection(false);
      setPosts([]);
      setCursor(null);
      setHasMore(false);
      setCursorDepth(1);
    } finally {
      setLoadingInitial(false);
    }
  };

  const loadMore = async () => {
    if (!cursor || !hasMore) {
      return;
    }

    setLoadingMore(true);

    const nextDepth = cursorDepth + 1;

    try {
      const res = await fetch(
        `https://lensically-worker.lensically.workers.dev/api/threads/posts?cursor=${encodeURIComponent(cursor)}&cursor_depth=${nextDepth}`,
      );
      const data = (await res.json()) as PostsResponse;

      setPosts((prev) => [...prev, ...(Array.isArray(data.posts) ? data.posts : [])]);
      setCursor(data.next_cursor || null);
      setHasMore(Boolean(data.has_more));
      setCursorDepth(nextDepth);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void loadPosts();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">Insights</h1>

      {loadingInitial ? (
        <p className="text-sm text-slate-700">Loading posts...</p>
      ) : needsConnection ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">
            Connect your Threads account to view Insights.
          </p>
          <a
            href={CONNECT_THREADS_URL}
            className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Connect Threads
          </a>
        </div>
      ) : hasError ? (
        <p className="text-sm text-red-600">Unable to load posts.</p>
      ) : (
        <div>
          <div className="space-y-4">
            {posts.map((post) => (
              <article
                key={post.id ?? post.permalink ?? `${post.username}-${post.timestamp}`}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-900">
                  {post.text || "No text content."}
                </p>
                <p className="mt-3 text-xs text-slate-600">
                  @{post.username || "unknown"} • {post.timestamp || "unknown time"}
                </p>
                {post.permalink ? (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-sm font-medium text-blue-700 hover:text-blue-800"
                  >
                    View on Threads
                  </a>
                ) : null}
              </article>
            ))}
          </div>
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-6 rounded bg-black px-4 py-2 text-white"
            >
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
