"use client";

import { useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";

type SavedPatternRow = {
  id: number;
  app_user_id: string;
  platform: string;
  source_url: string;
  post_id?: string | null;
  author_handle?: string | null;
  author_display_name?: string | null;
  post_text: string;
  likes: number;
  replies: number;
  reposts: number;
  shares: number;
  views?: number | null;
  posted_at?: string | null;
  saved_at: string;
  updated_at: string;
};

type SavedPatternsResponse = {
  success?: boolean;
  app_user_id?: string;
  total?: number;
  patterns?: SavedPatternRow[];
  error?: string;
};

const SAVED_PATTERNS_URL = buildWorkerUrl("/api/patterns/list");
const DEFAULT_APP_USER_ID = "lensically";
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

function truncateText(value: string, maxLength = 220): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export default function SavedPatternsPage() {
  const [inputAppUserId, setInputAppUserId] = useState(DEFAULT_APP_USER_ID);
  const [activeAppUserId, setActiveAppUserId] = useState(DEFAULT_APP_USER_ID);
  const [patterns, setPatterns] = useState<SavedPatternRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadPatterns() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${SAVED_PATTERNS_URL}?app_user_id=${encodeURIComponent(activeAppUserId)}&limit=${DEFAULT_LIMIT}`,
          {
            cache: "no-store",
            credentials: "include",
            signal: controller.signal,
          },
        );

        const data = (await response.json().catch(() => null)) as SavedPatternsResponse | null;
        if (!response.ok) {
          throw new Error(data?.error || "Could not load saved patterns.");
        }

        if (!isMounted) {
          return;
        }

        const nextPatterns = Array.isArray(data?.patterns) ? data.patterns : [];
        setPatterns(nextPatterns);
        setTotal(typeof data?.total === "number" ? data.total : nextPatterns.length);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }
        if (!isMounted) {
          return;
        }
        setPatterns([]);
        setTotal(0);
        setError(fetchError instanceof Error ? fetchError.message : "Could not load saved patterns.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadPatterns();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [activeAppUserId]);

  const summaryLabel = useMemo(() => {
    if (!patterns.length) {
      return `No saved patterns loaded for ${activeAppUserId}`;
    }
    return `Showing ${formatMetric(patterns.length)} of ${formatMetric(total)} saved patterns for ${activeAppUserId}`;
  }, [activeAppUserId, patterns.length, total]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = inputAppUserId.trim().toLowerCase();
    if (!normalized || normalized === activeAppUserId) {
      return;
    }
    setActiveAppUserId(normalized);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Saved Patterns</h1>
        <p className="mt-2 text-sm text-slate-600">
          Competitor and reference posts captured by the Threads save extension.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={handleSubmit}>
          <label className="block flex-1">
            <span className="mb-2 block text-sm font-medium text-slate-700">App User ID</span>
            <input
              type="text"
              value={inputAppUserId}
              onChange={(event) => setInputAppUserId(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              placeholder="lensically"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || inputAppUserId.trim().length === 0}
          >
            Load Patterns
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700">{summaryLabel}</p>
          <span className="text-xs text-slate-500">Default extension bucket: {DEFAULT_APP_USER_ID}</span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-700">Loading saved patterns...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !patterns.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <h2 className="text-base font-semibold text-slate-900">No saved patterns yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              Save a Threads post with the extension and it will appear here under the matching app user ID.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {patterns.map((pattern) => (
              <article key={pattern.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6">
                <div className="space-y-5">
                  <div className="max-w-4xl space-y-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <h2 className="text-sm font-semibold text-slate-900">
                        {pattern.author_display_name || pattern.author_handle || "Unknown author"}
                      </h2>
                      {pattern.author_handle ? (
                        <span className="text-xs text-slate-500">@{pattern.author_handle}</span>
                      ) : null}
                    </div>
                    <p className="whitespace-pre-wrap text-base leading-7 text-slate-800">
                      {truncateText(pattern.post_text)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Likes</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{formatMetric(pattern.likes)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Replies</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{formatMetric(pattern.replies)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Reposts</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{formatMetric(pattern.reposts)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Shares</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{formatMetric(pattern.shares)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Views</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{formatMetric(pattern.views)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Captured</p>
                      <p className="mt-2 text-sm font-semibold leading-5 text-slate-900">{formatDateTime(pattern.updated_at)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-500">
                  <div className="flex flex-col gap-2">
                    <span>
                      Source:{" "}
                      <a className="break-all text-slate-700 underline" href={pattern.source_url} target="_blank" rel="noopener noreferrer">
                        {pattern.source_url}
                      </a>
                    </span>
                  {pattern.posted_at ? <span>Posted: {formatDateTime(pattern.posted_at)}</span> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
