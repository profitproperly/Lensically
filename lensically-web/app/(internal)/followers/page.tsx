"use client";

import { useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";

type FollowerRow = {
  date: string;
  followers_count: number;
  gain: number;
  captured_at: string;
};

type FollowersResponse = {
  rows?: FollowerRow[];
  total_count?: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
  timezone?: string;
  error?: string;
};

const THREADS_FOLLOWERS_URL = buildWorkerUrl("/api/threads/followers");
const FOLLOWERS_PAGE_SIZE = 100;

function formatMetric(value: number | undefined | null): string {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US").format(safeValue);
}

function formatSignedMetric(value: number | undefined | null): string {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return safeValue > 0 ? `+${formatMetric(safeValue)}` : formatMetric(safeValue);
}

function formatSnapshotDate(value: string): string {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(parsed));
}

function formatTimestamp(value: string, timeZone: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(parsed));
}

export default function FollowersPage() {
  const [rows, setRows] = useState<FollowerRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [timeZone, setTimeZone] = useState("America/New_York");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadFollowers() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${THREADS_FOLLOWERS_URL}?limit=${FOLLOWERS_PAGE_SIZE}&page=${page}`,
          {
            cache: "no-store",
            credentials: "include",
            signal: controller.signal,
          },
        );

        const data = (await response.json().catch(() => null)) as FollowersResponse | null;
        if (!response.ok) {
          throw new Error(data?.error || "Could not load follower history.");
        }

        if (!isMounted) {
          return;
        }

        setRows(Array.isArray(data?.rows) ? data.rows : []);
        setTotalCount(typeof data?.total_count === "number" ? data.total_count : 0);
        setTotalPages(typeof data?.total_pages === "number" && data.total_pages > 0 ? data.total_pages : 1);
        setTimeZone(typeof data?.timezone === "string" && data.timezone ? data.timezone : "America/New_York");
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }
        if (!isMounted) {
          return;
        }
        setRows([]);
        setTotalCount(0);
        setTotalPages(1);
        setError(fetchError instanceof Error ? fetchError.message : "Could not load follower history.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadFollowers();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [page]);

  const summaryLabel = useMemo(() => {
    if (!rows.length) {
      return "No follower snapshots loaded";
    }

    const startIndex = (page - 1) * FOLLOWERS_PAGE_SIZE + 1;
    const endIndex = Math.min(page * FOLLOWERS_PAGE_SIZE, totalCount);
    return `Showing ${formatMetric(startIndex)}-${formatMetric(endIndex)} of ${formatMetric(totalCount)} daily snapshots`;
  }, [page, rows.length, totalCount]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Followers</h1>
        <p className="mt-2 text-sm text-slate-600">
          Daily follower counts and gains, stored automatically from the Threads refresh job.
        </p>
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
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-700">Loading follower history...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !rows.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <h2 className="text-base font-semibold text-slate-900">No follower history yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              Once the daily refresh runs, follower snapshots will appear here automatically.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 md:hidden">
              {rows.map((row) => (
                <article key={row.date} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{formatSnapshotDate(row.date)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Captured {formatTimestamp(row.captured_at, timeZone)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{formatSignedMetric(row.gain)}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Followers</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{formatMetric(row.followers_count)}</p>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Daily Gain</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{formatSignedMetric(row.gain)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] border-collapse">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Captured</th>
                    <th className="px-4 py-3 text-right font-semibold">Followers</th>
                    <th className="px-4 py-3 text-right font-semibold">Daily Gain</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.date} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-4 py-4 text-sm font-medium text-slate-900">{formatSnapshotDate(row.date)}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{formatTimestamp(row.captured_at, timeZone)}</td>
                      <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">
                        {formatMetric(row.followers_count)}
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">
                        {formatSignedMetric(row.gain)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
