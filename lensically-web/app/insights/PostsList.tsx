"use client";

import { useEffect, useState } from "react";

type ThreadsPost = {
  id?: string;
  text?: string;
  timestamp?: string;
  username?: string;
  profile_picture_url?: string;
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
  const [sortMetric, setSortMetric] = useState<
    "views" | "likes" | "replies" | "reposts" | "quotes" | "shares" | "timestamp" | null
  >(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

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

  const sortedPosts = [...posts].sort((a, b) => {
    if (!sortMetric) {
      return new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime();
    }

    if (sortMetric === "timestamp") {
      const av = new Date(a.timestamp ?? 0).getTime();
      const bv = new Date(b.timestamp ?? 0).getTime();
      return sortDirection === "desc" ? bv - av : av - bv;
    }

    const av = a[sortMetric] ?? 0;
    const bv = b[sortMetric] ?? 0;
    return sortDirection === "desc" ? bv - av : av - bv;
  });

  const handleMetricSort = (
    metric: "views" | "likes" | "replies" | "reposts" | "quotes" | "shares",
  ) => {
    if (sortMetric === metric) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
      return;
    }

    setSortMetric(metric);
    setSortDirection("desc");
  };

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
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse">
          <thead className="bg-white border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th
                className="px-4 py-3 text-left font-semibold cursor-pointer select-none"
                onClick={() => {
                  setSortMetric(null);
                  setSortDirection("desc");
                }}
              >
                <span className="inline-flex items-center gap-1">Post</span>
              </th>
              <th
                className="px-4 py-3 text-center font-semibold cursor-pointer select-none"
                onClick={() => handleMetricSort("views")}
              >
                <span className="inline-flex items-center gap-1">
                  Views
                  {sortMetric === "views" ? (sortDirection === "desc" ? "▼" : "▲") : ""}
                </span>
              </th>
              <th
                className="px-4 py-3 text-center font-semibold cursor-pointer select-none"
                onClick={() => handleMetricSort("likes")}
              >
                <span className="inline-flex items-center gap-1">
                  Likes
                  {sortMetric === "likes" ? (sortDirection === "desc" ? "▼" : "▲") : ""}
                </span>
              </th>
              <th
                className="px-4 py-3 text-center font-semibold cursor-pointer select-none"
                onClick={() => handleMetricSort("replies")}
              >
                <span className="inline-flex items-center gap-1">
                  Replies
                  {sortMetric === "replies" ? (sortDirection === "desc" ? "▼" : "▲") : ""}
                </span>
              </th>
              <th
                className="px-4 py-3 text-center font-semibold cursor-pointer select-none"
                onClick={() => handleMetricSort("reposts")}
              >
                <span className="inline-flex items-center gap-1">
                  Reposts
                  {sortMetric === "reposts" ? (sortDirection === "desc" ? "▼" : "▲") : ""}
                </span>
              </th>
              <th
                className="px-4 py-3 text-center font-semibold cursor-pointer select-none"
                onClick={() => handleMetricSort("quotes")}
              >
                <span className="inline-flex items-center gap-1">
                  Quotes
                  {sortMetric === "quotes" ? (sortDirection === "desc" ? "▼" : "▲") : ""}
                </span>
              </th>
              <th
                className="px-4 py-3 text-center font-semibold cursor-pointer select-none"
                onClick={() => handleMetricSort("shares")}
              >
                <span className="inline-flex items-center gap-1">
                  Shares
                  {sortMetric === "shares" ? (sortDirection === "desc" ? "▼" : "▲") : ""}
                </span>
              </th>
              <th
                className="px-4 py-3 text-left font-semibold cursor-pointer select-none"
                onClick={() => {
                  if (sortMetric === "timestamp") {
                    setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
                  } else {
                    setSortMetric("timestamp");
                    setSortDirection("desc");
                  }
                }}
              >
                <span className="inline-flex items-center gap-1">
                  Posted
                  {sortMetric === "timestamp" ? (sortDirection === "desc" ? "▼" : "▲") : ""}
                </span>
              </th>
            </tr>
          </thead>
        </table>

        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full border-collapse">
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
