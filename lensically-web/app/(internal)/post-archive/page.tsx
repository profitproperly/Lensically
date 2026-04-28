"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";

type ArchiveOrder = "recent" | "top";

type ArchivedPost = {
  id: string;
  text: string;
  timestamp: string;
  permalink?: string | null;
  username?: string | null;
  profile_picture_url?: string | null;
  views?: number;
  likes?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
  shares?: number;
  engagement_total?: number;
};

type ArchiveResponse = {
  posts?: ArchivedPost[];
  total_count?: number;
  order?: ArchiveOrder;
  page?: number;
  page_size?: number;
  total_pages?: number;
  error?: string;
};

const WORKSPACE_APP_USER_ID = "workspace-owner";
const THREADS_POSTS_ARCHIVE_URL = buildWorkerUrl("/api/threads/posts/archive");
const ARCHIVE_PAGE_SIZE = 100;

function formatArchiveTimestamp(timestamp: string) {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(parsed));
}

function formatMetric(value: number | undefined) {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US").format(safeValue);
}

function escapeCsvCell(value: string | number | null | undefined) {
  const stringValue = typeof value === "number" ? String(value) : value ?? "";
  const escapedValue = stringValue.replace(/"/g, "\"\"");
  return `"${escapedValue}"`;
}

function buildCsvExport(posts: ArchivedPost[]) {
  const header = [
    "post_id",
    "timestamp",
    "username",
    "text",
    "permalink",
    "views",
    "likes",
    "replies",
    "reposts",
    "quotes",
    "shares",
    "engagement_total",
  ];

  const rows = posts.map((post) => [
    post.id,
    post.timestamp,
    post.username ?? "",
    post.text ?? "",
    post.permalink ?? "",
    post.views ?? 0,
    post.likes ?? 0,
    post.replies ?? 0,
    post.reposts ?? 0,
    post.quotes ?? 0,
    post.shares ?? 0,
    post.engagement_total ?? 0,
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function buildTxtExport(posts: ArchivedPost[]) {
  return posts.map((post, index) => {
    const lines = [
      `Post ${index + 1}`,
      `ID: ${post.id}`,
      `Timestamp: ${post.timestamp}`,
      `Username: ${post.username ?? ""}`,
      `Permalink: ${post.permalink ?? ""}`,
      `Views: ${post.views ?? 0}`,
      `Likes: ${post.likes ?? 0}`,
      `Replies: ${post.replies ?? 0}`,
      `Reposts: ${post.reposts ?? 0}`,
      `Quotes: ${post.quotes ?? 0}`,
      `Shares: ${post.shares ?? 0}`,
      `Engagement Total: ${post.engagement_total ?? 0}`,
      "Text:",
      post.text ?? "",
    ];
    return lines.join("\n");
  }).join("\n\n---\n\n");
}

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export default function PostArchivePage() {
  const [order, setOrder] = useState<ArchiveOrder>("recent");
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<ArchivedPost[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(1);
  }, [order]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadArchive() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${THREADS_POSTS_ARCHIVE_URL}?app_user_id=${encodeURIComponent(WORKSPACE_APP_USER_ID)}&order=${encodeURIComponent(order)}&limit=${ARCHIVE_PAGE_SIZE}&page=${page}`,
          {
            cache: "no-store",
            credentials: "include",
            signal: controller.signal,
          },
        );

        const data = (await response.json().catch(() => null)) as ArchiveResponse | null;
        if (!response.ok) {
          throw new Error(data?.error || "Could not load post archive.");
        }

        if (!isMounted) {
          return;
        }

        setPosts(Array.isArray(data?.posts) ? data.posts : []);
        setTotalCount(typeof data?.total_count === "number" ? data.total_count : 0);
        setTotalPages(typeof data?.total_pages === "number" && data.total_pages > 0 ? data.total_pages : 1);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }
        if (!isMounted) {
          return;
        }
        setPosts([]);
        setTotalCount(0);
        setTotalPages(1);
        setError(fetchError instanceof Error ? fetchError.message : "Could not load post archive.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadArchive();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [order, page]);

  const summaryLabel = useMemo(() => {
    if (!posts.length) {
      return "No stored posts loaded";
    }
    const startIndex = (page - 1) * ARCHIVE_PAGE_SIZE + 1;
    const endIndex = Math.min(page * ARCHIVE_PAGE_SIZE, totalCount);
    return `Showing ${formatMetric(startIndex)}-${formatMetric(endIndex)} of ${formatMetric(totalCount)} stored posts`;
  }, [page, posts.length, totalCount]);

  function handleDownload(format: "csv" | "txt") {
    if (!posts.length) {
      return;
    }

    const dateStamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      triggerDownload(
        `lensically-post-archive-${order}-${dateStamp}.csv`,
        buildCsvExport(posts),
        "text/csv;charset=utf-8",
      );
      return;
    }

    triggerDownload(
      `lensically-post-archive-${order}-${dateStamp}.txt`,
      buildTxtExport(posts),
      "text/plain;charset=utf-8",
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Post Archive</h1>
          <p className="mt-2 text-sm text-slate-600">
            Stored DB posts for the current Threads account. This is the saved account archive, separate from live Insights.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-700" htmlFor="archive-order">
            Sort
          </label>
          <select
            id="archive-order"
            value={order}
            onChange={(event) => setOrder(event.target.value === "top" ? "top" : "recent")}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="recent">Most Recent</option>
            <option value="top">Top Performing</option>
          </select>
          <button
            type="button"
            onClick={() => handleDownload("csv")}
            disabled={!posts.length || loading}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => handleDownload("txt")}
            disabled={!posts.length || loading}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Download TXT
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700">{summaryLabel}</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600">
              Page {formatMetric(page)} of {formatMetric(totalPages)}
            </span>
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={loading || page <= 1}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Previous Page
            </button>
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
              disabled={loading || page >= totalPages}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next Page
            </button>
            <Link
              href="/insights"
              className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Open Live Insights
            </Link>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-700">Loading stored posts...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !posts.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <h2 className="text-base font-semibold text-slate-900">No archived posts yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              Pull posts from Insights first, then the stored archive will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => (
              <li
                key={post.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-900">
                      {post.text || "(No post text)"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                      <span>{formatArchiveTimestamp(post.timestamp)}</span>
                      {post.username ? <span>@{post.username}</span> : null}
                      <span>ID {post.id}</span>
                    </div>
                  </div>
                  {post.permalink ? (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Open Post
                    </a>
                  ) : null}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Views</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{formatMetric(post.views)}</dd>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Likes</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{formatMetric(post.likes)}</dd>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Replies</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{formatMetric(post.replies)}</dd>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Reposts</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{formatMetric(post.reposts)}</dd>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Quotes</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{formatMetric(post.quotes)}</dd>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Shares</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{formatMetric(post.shares)}</dd>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Engagement</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{formatMetric(post.engagement_total)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
