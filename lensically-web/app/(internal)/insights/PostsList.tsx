"use client";

import { useCallback, useEffect, useState } from "react";
import { buildWorkerUrl } from "../../../lib/apiClient";

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

const THREADS_POSTS_URL = buildWorkerUrl("/api/threads/posts");

export default function PostsList() {
  const [posts, setPosts] = useState<ThreadsPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorDepth, setCursorDepth] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [needsConnection, setNeedsConnection] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [sortMetric, setSortMetric] = useState<
    "views" | "likes" | "replies" | "reposts" | "quotes" | "shares" | "timestamp" | null
  >(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const loadPosts = useCallback(async () => {
    try {
      setLoadingInitial(true);
      setNeedsConnection(false);
      setHasError(false);

      const res = await fetch(
        THREADS_POSTS_URL,
        { cache: "no-store", credentials: "include" },
      );
      const data = (await res.json()) as PostsResponse;
      console.log("THREADS API RESPONSE:", data);

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
  }, []);

  const loadMore = async () => {
    if (!cursor || !hasMore) return;

    setLoadingMore(true);

    const nextDepth = cursorDepth + 1;

    try {
      const res = await fetch(
        `${THREADS_POSTS_URL}?cursor=${encodeURIComponent(cursor)}&cursor_depth=${nextDepth}`,
        { credentials: "include" },
      );

      const data = (await res.json()) as PostsResponse;
      const newPosts = Array.isArray(data.posts) ? data.posts : [];
      const nextCursor = data.next_cursor || null;
      const nextHasMore = Boolean(data.has_more);

      setPosts((prev) => {
        const mergedPosts = [...prev, ...newPosts];
        const dedupedPosts = mergedPosts.filter((post, index, arr) => {
          if (!post.id) {
            return true;
          }
          return arr.findIndex((candidate) => candidate.id === post.id) === index;
        });
        return dedupedPosts;
      });
      setCursor(nextCursor);
      setHasMore(nextHasMore);
      setCursorDepth(nextDepth);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    setHasError(false);

    try {
      const res = await fetch(
        THREADS_POSTS_URL,
        { cache: "no-store", credentials: "include" },
      );

      const data = (await res.json()) as PostsResponse;

      if (!res.ok) {
        const errorMessage = (data.error || "").toLowerCase();
        setNeedsConnection(errorMessage.includes("account not connected"));
        setHasError(!errorMessage.includes("account not connected"));
        return;
      }

      const fetchedPosts = Array.isArray(data.posts) ? data.posts : [];
      const nextCursor = data.next_cursor || null;
      const nextHasMore = Boolean(data.has_more);
      setPosts(fetchedPosts);
      setCursor(nextCursor);
      setHasMore(nextHasMore);
      setCursorDepth(1);

      setNeedsConnection(false);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

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

  const getSortArrow = (
    metric: "post" | "views" | "likes" | "replies" | "reposts" | "quotes" | "shares" | "timestamp",
  ) => {
    if (metric === "post") {
      return "";
    }
    if (sortMetric === metric) {
      return sortDirection === "desc" ? "\u25BC" : "\u25B2";
    }
    return "";
  };

  const getSortHint = (
    metric: "post" | "views" | "likes" | "replies" | "reposts" | "quotes" | "shares" | "timestamp",
  ) => {
    if (metric === "post") {
      return sortMetric === null
        ? "Sorted newest to oldest. Click to reset."
        : "Click to sort by newest first.";
    }
    if (sortMetric === metric) {
      return sortDirection === "desc"
        ? "Sorted high to low. Click for low to high."
        : "Sorted low to high. Click for high to low.";
    }
    return "Click to sort.";
  };

  function formatMetricValue(value: number | undefined): string {
    return String(value ?? 0);
  }

  if (loadingInitial) return <p className="text-sm text-slate-700">Loading posts...</p>;

  if (needsConnection) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-700">
          The configured Threads account could not be loaded for Insights.
        </p>
      </div>
    );
  }

  if (hasError) return <p className="text-red-600">Unable to load posts.</p>;

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-medium text-slate-500">
          Showing {posts.length} {posts.length === 1 ? "post" : "posts"}
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex w-full items-center justify-center rounded border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="space-y-4 md:hidden">
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
            <article
              key={post.id ?? post.permalink ?? `${post.username}-${post.timestamp}`}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-sm leading-6 text-slate-900">
                {post.text || "No text content."}
              </p>

              <p className="mt-3 text-xs text-slate-500">{formattedTime}</p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { label: "Views", value: formatMetricValue(post.views) },
                  { label: "Likes", value: formatMetricValue(post.likes) },
                  { label: "Replies", value: formatMetricValue(post.replies) },
                  { label: "Reposts", value: formatMetricValue(post.reposts) },
                  { label: "Quotes", value: formatMetricValue(post.quotes) },
                  { label: "Shares", value: formatMetricValue(post.shares) },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      {metric.label}
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{metric.value}</p>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[920px] border-collapse table-fixed">
          <thead className="border-b border-slate-200 bg-white text-xs uppercase text-slate-500">
            <tr>
              <th
                className={[
                  "w-[50%] px-4 py-3 text-left font-semibold cursor-pointer select-none transition-colors text-slate-500",
                  sortMetric === null ? "text-black font-bold" : "hover:text-black",
                ].join(" ")}
                onClick={() => {
                  setSortMetric(null);
                  setSortDirection("desc");
                }}
              >
                <span className="group relative inline-flex items-center gap-1 text-black font-bold">
                  Post
                  <span className="pointer-events-none absolute -top-14 left-1/2 z-30 w-56 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-center text-[10px] font-medium normal-case leading-snug tracking-normal text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {getSortHint("post")} Scroll down and click Load More for more posts.
                  </span>
                </span>
              </th>
              <th
                className={[
                  "w-[7%] px-4 py-3 text-center font-semibold cursor-pointer select-none transition-colors text-slate-500",
                  sortMetric === "views" ? "text-black font-bold" : "hover:text-black",
                ].join(" ")}
                onClick={() => handleMetricSort("views")}
              >
                <span
                  className={[
                    "group relative inline-flex items-center gap-1",
                    sortMetric === "views" ? "text-black font-bold" : "text-slate-500",
                  ].join(" ")}
                >
                  Views
                  {sortMetric === "views" ? (
                    <span className="text-[11px] text-black">{getSortArrow("views")}</span>
                  ) : null}
                  <span className="pointer-events-none absolute -top-14 left-1/2 z-30 w-56 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-center text-[10px] font-medium normal-case leading-snug tracking-normal text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {getSortHint("views")} Scroll down and click Load More for more posts.
                  </span>
                </span>
              </th>
              <th
                className={[
                  "w-[6%] px-4 py-3 text-center font-semibold cursor-pointer select-none transition-colors text-slate-500",
                  sortMetric === "likes" ? "text-black font-bold" : "hover:text-black",
                ].join(" ")}
                onClick={() => handleMetricSort("likes")}
              >
                <span
                  className={[
                    "group relative inline-flex items-center gap-1",
                    sortMetric === "likes" ? "text-black font-bold" : "text-slate-500",
                  ].join(" ")}
                >
                  Likes
                  {sortMetric === "likes" ? (
                    <span className="text-[11px] text-black">{getSortArrow("likes")}</span>
                  ) : null}
                  <span className="pointer-events-none absolute -top-14 left-1/2 z-30 w-56 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-center text-[10px] font-medium normal-case leading-snug tracking-normal text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {getSortHint("likes")} Scroll down and click Load More for more posts.
                  </span>
                </span>
              </th>
              <th
                className={[
                  "w-[7%] px-4 py-3 text-center font-semibold cursor-pointer select-none transition-colors text-slate-500",
                  sortMetric === "replies" ? "text-black font-bold" : "hover:text-black",
                ].join(" ")}
                onClick={() => handleMetricSort("replies")}
              >
                <span
                  className={[
                    "group relative inline-flex items-center gap-1",
                    sortMetric === "replies" ? "text-black font-bold" : "text-slate-500",
                  ].join(" ")}
                >
                  Replies
                  {sortMetric === "replies" ? (
                    <span className="text-[11px] text-black">{getSortArrow("replies")}</span>
                  ) : null}
                  <span className="pointer-events-none absolute -top-14 left-1/2 z-30 w-56 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-center text-[10px] font-medium normal-case leading-snug tracking-normal text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {getSortHint("replies")} Scroll down and click Load More for more posts.
                  </span>
                </span>
              </th>
              <th
                className={[
                  "w-[7%] px-4 py-3 text-center font-semibold cursor-pointer select-none transition-colors text-slate-500",
                  sortMetric === "reposts" ? "text-black font-bold" : "hover:text-black",
                ].join(" ")}
                onClick={() => handleMetricSort("reposts")}
              >
                <span
                  className={[
                    "group relative inline-flex items-center gap-1",
                    sortMetric === "reposts" ? "text-black font-bold" : "text-slate-500",
                  ].join(" ")}
                >
                  Reposts
                  {sortMetric === "reposts" ? (
                    <span className="text-[11px] text-black">{getSortArrow("reposts")}</span>
                  ) : null}
                  <span className="pointer-events-none absolute -top-14 left-1/2 z-30 w-56 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-center text-[10px] font-medium normal-case leading-snug tracking-normal text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {getSortHint("reposts")} Scroll down and click Load More for more posts.
                  </span>
                </span>
              </th>
              <th
                className={[
                  "w-[7%] px-4 py-3 text-center font-semibold cursor-pointer select-none transition-colors text-slate-500",
                  sortMetric === "quotes" ? "text-black font-bold" : "hover:text-black",
                ].join(" ")}
                onClick={() => handleMetricSort("quotes")}
              >
                <span
                  className={[
                    "group relative inline-flex items-center gap-1",
                    sortMetric === "quotes" ? "text-black font-bold" : "text-slate-500",
                  ].join(" ")}
                >
                  Quotes
                  {sortMetric === "quotes" ? (
                    <span className="text-[11px] text-black">{getSortArrow("quotes")}</span>
                  ) : null}
                  <span className="pointer-events-none absolute -top-14 left-1/2 z-30 w-56 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-center text-[10px] font-medium normal-case leading-snug tracking-normal text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {getSortHint("quotes")} Scroll down and click Load More for more posts.
                  </span>
                </span>
              </th>
              <th
                className={[
                  "w-[7%] px-4 py-3 text-center font-semibold cursor-pointer select-none transition-colors text-slate-500",
                  sortMetric === "shares" ? "text-black font-bold" : "hover:text-black",
                ].join(" ")}
                onClick={() => handleMetricSort("shares")}
              >
                <span
                  className={[
                    "group relative inline-flex items-center gap-1",
                    sortMetric === "shares" ? "text-black font-bold" : "text-slate-500",
                  ].join(" ")}
                >
                  Shares
                  {sortMetric === "shares" ? (
                    <span className="text-[11px] text-black">{getSortArrow("shares")}</span>
                  ) : null}
                  <span className="pointer-events-none absolute -top-14 left-1/2 z-30 w-56 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-center text-[10px] font-medium normal-case leading-snug tracking-normal text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {getSortHint("shares")} Scroll down and click Load More for more posts.
                  </span>
                </span>
              </th>
              <th
                className={[
                  "w-[9%] px-4 py-3 text-left font-semibold cursor-pointer select-none transition-colors text-slate-500",
                  sortMetric === "timestamp" ? "text-black font-bold" : "hover:text-black",
                ].join(" ")}
                onClick={() => {
                  if (sortMetric === "timestamp") {
                    setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
                  } else {
                    setSortMetric("timestamp");
                    setSortDirection("desc");
                  }
                }}
              >
                <span
                  className={[
                    "group relative inline-flex items-center gap-1",
                    sortMetric === "timestamp" ? "text-black font-bold" : "text-slate-500",
                  ].join(" ")}
                >
                  Posted
                  {sortMetric === "timestamp" ? (
                    <span className="text-[11px] text-black">{getSortArrow("timestamp")}</span>
                  ) : null}
                  <span className="pointer-events-none absolute -top-14 left-1/2 z-30 w-56 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-center text-[10px] font-medium normal-case leading-snug tracking-normal text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {getSortHint("timestamp")} Scroll down and click Load More for more posts.
                  </span>
                </span>
              </th>
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
                  <td className="w-[50%] px-4 py-3 text-sm text-slate-900">
                    <div className="max-w-xl whitespace-normal break-words">
                      {post.text || "No text content."}
                    </div>
                  </td>
                  <td className="w-[7%] px-4 py-3 text-center text-sm text-slate-700">{post.views ?? 0}</td>
                  <td className="w-[6%] px-4 py-3 text-center text-sm text-slate-700">{post.likes ?? 0}</td>
                  <td className="w-[7%] px-4 py-3 text-center text-sm text-slate-700">{post.replies ?? 0}</td>
                  <td className="w-[7%] px-4 py-3 text-center text-sm text-slate-700">{post.reposts ?? 0}</td>
                  <td className="w-[7%] px-4 py-3 text-center text-sm text-slate-700">{post.quotes ?? 0}</td>
                  <td className="w-[7%] px-4 py-3 text-center text-sm text-slate-700">{post.shares ?? 0}</td>
                  <td className="w-[9%] px-4 py-3 text-sm text-slate-600">{formattedTime}</td>
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
          className="mt-6 inline-flex w-full items-center justify-center rounded bg-black px-4 py-2 text-white sm:w-auto"
        >
          {loadingMore ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );
}
