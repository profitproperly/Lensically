"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";

type SavedPatternRow = {
  id: number;
  author_handle?: string | null;
  author_display_name?: string | null;
  source_url: string;
  post_text: string;
  likes: number;
  replies: number;
  reposts: number;
  shares: number;
  views?: number | null;
  posted_at?: string | null;
  updated_at: string;
};

type SavedPatternsResponse = {
  order?: "newest" | "likes";
  patterns?: SavedPatternRow[];
  total?: number;
  error?: string;
};

const SAVED_PATTERNS_URL = buildWorkerUrl("/api/patterns/list");
const DELETE_PATTERNS_URL = buildWorkerUrl("/api/patterns/delete");
const APP_USER_ID = "lensically";
const DEFAULT_LIMIT = 200;

function formatMetric(value: number | null | undefined): string {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US").format(safeValue);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Unknown";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(parsed));
}

function truncateText(value: string, maxLength = 160): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export default function SavedPatternsPage() {
  const [patterns, setPatterns] = useState<SavedPatternRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [order, setOrder] = useState<"newest" | "likes">("newest");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);

  const loadPatterns = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${SAVED_PATTERNS_URL}?app_user_id=${encodeURIComponent(APP_USER_ID)}&limit=${DEFAULT_LIMIT}&order=${encodeURIComponent(order)}`,
        {
          cache: "no-store",
          credentials: "include",
        },
      );

      const data = (await response.json().catch(() => null)) as SavedPatternsResponse | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not load saved patterns.");
      }

      const nextPatterns = Array.isArray(data?.patterns) ? data.patterns : [];
      setPatterns(nextPatterns);
      setSelectedIds((current) => current.filter((id) => nextPatterns.some((pattern) => pattern.id === id)));
      setTotal(typeof data?.total === "number" ? data.total : nextPatterns.length);
    } catch (fetchError) {
      setPatterns([]);
      setSelectedIds([]);
      setTotal(0);
      setError(fetchError instanceof Error ? fetchError.message : "Could not load saved patterns.");
    } finally {
      setLoading(false);
    }
  }, [order]);

  useEffect(() => {
    void loadPatterns();
  }, [loadPatterns]);

  const allVisibleSelected = useMemo(
    () => patterns.length > 0 && patterns.every((pattern) => selectedIds.includes(pattern.id)),
    [patterns, selectedIds],
  );

  async function deletePatterns(ids: number[]) {
    if (!ids.length) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const response = await fetch(DELETE_PATTERNS_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_user_id: APP_USER_ID,
          ids,
        }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not delete saved patterns.");
      }

      await loadPatterns();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete saved patterns.");
    } finally {
      setDeleting(false);
    }
  }

  function toggleSelection(id: number) {
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    ));
  }

  function toggleSelectAll() {
    setSelectedIds(allVisibleSelected ? [] : patterns.map((pattern) => pattern.id));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Saved Patterns</h1>
          <p className="mt-2 text-sm text-slate-600">
            Competitor and reference posts captured by the Threads save extension.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-300 bg-white p-1">
            <button
              type="button"
              onClick={() => setOrder("newest")}
              disabled={loading || deleting}
              className={[
                "rounded-md px-3 py-2 text-sm font-medium",
                order === "newest" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              Newest
            </button>
            <button
              type="button"
              onClick={() => setOrder("likes")}
              disabled={loading || deleting}
              className={[
                "rounded-md px-3 py-2 text-sm font-medium",
                order === "likes" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              Likes
            </button>
          </div>
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={loading || deleting || !patterns.length}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {allVisibleSelected ? "Clear Selection" : "Select All"}
          </button>
          <button
            type="button"
            onClick={() => void deletePatterns(selectedIds)}
            disabled={loading || deleting || selectedIds.length === 0}
            className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete Selected
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-medium text-slate-700">
            {loading ? "Loading saved patterns..." : `${formatMetric(patterns.length)} of ${formatMetric(total)} saved patterns`}
          </p>
          <span className="text-slate-500">
            {selectedIds.length ? `${formatMetric(selectedIds.length)} selected` : order === "likes" ? "Ranked by likes" : "Newest first"}
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : loading ? (
          <p className="text-sm text-slate-700">Loading saved patterns...</p>
        ) : !patterns.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <h2 className="text-base font-semibold text-slate-900">No saved patterns yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              Save a Threads post with the extension and it will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {patterns.map((pattern) => {
              const isSelected = selectedIds.includes(pattern.id);

              return (
                <article
                  key={pattern.id}
                  className={[
                    "rounded-xl border bg-slate-50 p-4 transition",
                    isSelected ? "border-slate-900 ring-1 ring-slate-900/10" : "border-slate-200",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(pattern.id)}
                      className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      aria-label={`Select saved pattern ${pattern.id}`}
                    />

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h2 className="text-sm font-semibold text-slate-900">
                              {pattern.author_display_name || pattern.author_handle || "Unknown author"}
                            </h2>
                            {pattern.author_handle ? (
                              <span className="text-xs text-slate-500">@{pattern.author_handle}</span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-800">{truncateText(pattern.post_text)}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void deletePatterns([pattern.id])}
                          disabled={deleting}
                          className="shrink-0 rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="text-slate-500">Likes</p>
                          <p className="mt-1 text-base font-semibold text-slate-900">{formatMetric(pattern.likes)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="text-slate-500">Replies</p>
                          <p className="mt-1 text-base font-semibold text-slate-900">{formatMetric(pattern.replies)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="text-slate-500">Reposts</p>
                          <p className="mt-1 text-base font-semibold text-slate-900">{formatMetric(pattern.reposts)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="text-slate-500">Shares</p>
                          <p className="mt-1 text-base font-semibold text-slate-900">{formatMetric(pattern.shares)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="text-slate-500">Views</p>
                          <p className="mt-1 text-base font-semibold text-slate-900">{formatMetric(pattern.views)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="text-slate-500">Captured</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-slate-900">{formatDateTime(pattern.updated_at)}</p>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">
                        <div className="flex flex-col gap-1">
                          <span>
                            Source:{" "}
                            <a
                              className="break-all text-slate-700 underline"
                              href={pattern.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {pattern.source_url}
                            </a>
                          </span>
                          {pattern.posted_at ? <span>Posted: {formatDateTime(pattern.posted_at)}</span> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
