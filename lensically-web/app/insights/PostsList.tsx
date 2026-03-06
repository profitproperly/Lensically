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
        { cache: "no-store" },
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

  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime(),
  );

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
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="table-auto w-full border-collapse">
          <thead>
            <tr className="text-xs uppercase text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 text-left font-semibold">Post</th>
              <th className="px-4 py-3 text-center font-semibold">Views</th>
              <th className="px-4 py-3 text-center font-semibold">Likes</th>
              <th className="px-4 py-3 text-center font-semibold">Replies</th>
              <th className="px-4 py-3 text-center font-semibold">Reposts</th>
              <th className="px-4 py-3 text-center font-semibold">Quotes</th>
              <th className="px-4 py-3 text-center font-semibold">Shares</th>
              <th className="px-4 py-3 text-left font-semibold">Posted</th>
            </tr>
          </thead>
          <tbody>
            {sortedPosts.map((post) => {
              const formattedTime = post.timestamp
                ? new Date(post.timestamp).toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })
                : "Unknown time";

              return (
                <tr
                  key={post.id ?? post.permalink ?? `${post.username}-${post.timestamp}`}
                  className="border-b border-slate-100 align-top last:border-b-0"
                >
                  <td className="px-4 py-3 text-sm text-slate-900">
                    <div className="max-w-xl whitespace-normal break-words">
                      {post.text || "No text content."}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-slate-700">{post.views ?? 0}</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-700">{post.likes ?? 0}</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-700">{post.replies ?? 0}</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-700">{post.reposts ?? 0}</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-700">{post.quotes ?? 0}</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-700">{post.shares ?? 0}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formattedTime}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
