"use client";

import { useEffect, useState } from "react";

type ThreadsPost = {
  id?: string;
  text?: string;
  timestamp?: string;
  username?: string;
  permalink?: string;
  views?: number;
  likes?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
  shares?: number;
};

type PostsResponse = {
  posts?: ThreadsPost[];
  next_cursor?: string | null;
  has_more?: boolean;
  error?: string;
};

const CONNECT_THREADS_URL =
  "https://lensically-worker.lensically.workers.dev/api/auth/threads/start";

export default function PostsList() {
  const [posts, setPosts] = useState<ThreadsPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorDepth, setCursorDepth] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [needsConnection, setNeedsConnection] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [sortMetric, setSortMetric] = useState("likes");
  const [sortDirection, setSortDirection] = useState("desc");

  const loadPosts = async () => {
    try {
      setLoadingInitial(true);
      setNeedsConnection(false);
      setHasError(false);

      const res = await fetch(
        "https://lensically-worker.lensically.workers.dev/api/threads/posts",
      );
      const data = (await res.json()) as PostsResponse;

      if (!res.ok) {
        const errorMessage = (data.error || "").toLowerCase();
        setNeedsConnection(errorMessage.includes("account not connected"));
        setHasError(!errorMessage.includes("account not connected"));
        setLoadingInitial(false);
        return;
      }

      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setCursor(data.next_cursor || null);
      setHasMore(Boolean(data.has_more));
      setCursorDepth(1);
      setHasError(false);
      setLoadingInitial(false);
    } catch {
      setHasError(true);
      setNeedsConnection(false);
      setLoadingInitial(false);
    }
  };

  const loadMore = async () => {
    if (!cursor || !hasMore) return;

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

  const sortedPosts = [...posts].sort((a, b) => {
    const av = (a[sortMetric as keyof ThreadsPost] as number | undefined) ?? 0;
    const bv = (b[sortMetric as keyof ThreadsPost] as number | undefined) ?? 0;
    return sortDirection === "desc" ? bv - av : av - bv;
  });

  if (loadingInitial) return <p className="text-sm text-slate-700">Loading posts...</p>;

  if (needsConnection) {
    return (
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
    );
  }

  if (hasError) return <p className="text-red-600">Unable to load posts.</p>;

  return (
    <div>
      <div className="space-y-4">
        {sortedPosts.map((post) => (
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
            <div className="mt-3 flex gap-4 text-xs text-slate-600">
              <span>{"\u{1F441}"} {post.views ?? 0}</span>
              <span>{"\u2764\uFE0F"} {post.likes ?? 0}</span>
              <span>{"\u{1F4AC}"} {post.replies ?? 0}</span>
              <span>{"\u{1F501}"} {post.reposts ?? 0}</span>
              <span>{"\u270D\uFE0F"} {post.quotes ?? 0}</span>
              <span>{"\u{1F4E4}"} {post.shares ?? 0}</span>
            </div>
            {post.permalink && (
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-medium text-blue-700 hover:text-blue-800"
              >
                View on Threads
              </a>
            )}
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
  );
}
