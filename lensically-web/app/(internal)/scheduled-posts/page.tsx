"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { buildWorkerUrl } from "@/lib/apiClient";

type ThreadsMeResponse = {
  connected?: boolean;
  account?: {
    threads_user_id?: string | null;
  } | null;
  threads_user_id?: string | null;
};

type ScheduledPost = {
  id: number;
  text: string;
  status: "approved" | "posting" | "posted";
  scheduled_time_utc: string;
};

type ScheduledPostsResponse = {
  scheduled_posts?: ScheduledPost[];
  error?: string;
};

const THREADS_ME_URL = buildWorkerUrl("/api/threads/me");
const THREADS_SCHEDULE_URL = buildWorkerUrl("/api/threads/schedule");

function resolveTimezonePreference(rawTimezone: string | null | undefined): string {
  const candidate = rawTimezone?.trim();
  if (!candidate) {
    return "UTC";
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return "UTC";
  }
}

function formatScheduledLocalTime(
  scheduledUtc: string,
  timezone: string,
  clockFormat: "12h" | "24h",
): string | null {
  const date = new Date(scheduledUtc);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: clockFormat !== "24h",
    });
    return formatter.format(date);
  } catch {
    return null;
  }
}

function parseScheduledTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

export default function ScheduledPostsPage() {
  const { user, loading } = useAuth();
  const appUserId = user?.id?.trim() ?? "";
  const timezone = resolveTimezonePreference(user?.timezone);
  const clockFormatPreference: "12h" | "24h" = user?.clock_format === "24h" ? "24h" : "12h";
  const [threadsUserId, setThreadsUserId] = useState<string>("");
  const [loadingConnection, setLoadingConnection] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loadingScheduledPosts, setLoadingScheduledPosts] = useState(false);
  const [scheduledPostsError, setScheduledPostsError] = useState("");

  const orderedScheduledPosts = useMemo(() => {
    return [...scheduledPosts].sort((left, right) => {
      const leftTs = parseScheduledTimestamp(left.scheduled_time_utc);
      const rightTs = parseScheduledTimestamp(right.scheduled_time_utc);
      if (leftTs !== rightTs) {
        return leftTs - rightTs;
      }
      return left.id - right.id;
    });
  }, [scheduledPosts]);

  useEffect(() => {
    if (!appUserId) {
      setThreadsUserId("");
      setLoadingConnection(false);
      setConnectionError("");
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    async function loadThreadsConnection() {
      setLoadingConnection(true);
      setConnectionError("");

      try {
        const response = await fetch(
          `${THREADS_ME_URL}?app_user_id=${encodeURIComponent(appUserId)}`,
          {
            cache: "no-store",
            credentials: "include",
            signal: controller.signal,
          },
        );

        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          setThreadsUserId("");
          setConnectionError("Could not load Threads connection.");
          return;
        }

        const data = (await response.json()) as ThreadsMeResponse;
        const resolvedThreadsUserId =
          data.account?.threads_user_id?.trim()
          || data.threads_user_id?.trim()
          || "";

        if (!resolvedThreadsUserId) {
          setThreadsUserId("");
          setConnectionError("Threads account is not connected.");
          return;
        }

        setThreadsUserId(resolvedThreadsUserId);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (isMounted) {
          setThreadsUserId("");
          setConnectionError("Could not load Threads connection.");
        }
      } finally {
        if (isMounted) {
          setLoadingConnection(false);
        }
      }
    }

    void loadThreadsConnection();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [appUserId]);

  useEffect(() => {
    if (!appUserId || !threadsUserId) {
      setScheduledPosts([]);
      setScheduledPostsError("");
      setLoadingScheduledPosts(false);
      return;
    }

    void loadScheduledPosts();
    // appUserId/threadsUserId changes should refresh upcoming posts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUserId, threadsUserId]);

  async function loadScheduledPosts() {
    if (!appUserId || !threadsUserId) {
      return;
    }

    setLoadingScheduledPosts(true);
    setScheduledPostsError("");

    try {
      const response = await fetch(
        `${THREADS_SCHEDULE_URL}?app_user_id=${encodeURIComponent(appUserId)}`,
        {
          cache: "no-store",
          credentials: "include",
        },
      );

      const data = (await response.json().catch(() => null)) as ScheduledPostsResponse | null;
      if (!response.ok) {
        setScheduledPostsError(data?.error || "Could not load scheduled posts.");
        return;
      }

      const nextPosts = Array.isArray(data?.scheduled_posts) ? data.scheduled_posts : [];
      setScheduledPosts(nextPosts);
    } catch {
      setScheduledPostsError("Could not load scheduled posts.");
    } finally {
      setLoadingScheduledPosts(false);
    }
  }

  if (loading || loadingConnection) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900">Scheduled Posts (0)</h1>
        <p className="text-sm text-slate-700">Loading scheduled posts...</p>
      </div>
    );
  }

  if (!threadsUserId) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900">Scheduled Posts (0)</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">
            Connect your Threads account to view and manage scheduled posts.
          </p>
          <Link
            href="/connect"
            className="mt-4 inline-flex cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Connect Threads
          </Link>
          {connectionError ? (
            <p className="mt-4 text-sm text-red-600">{connectionError}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-slate-900">
          Scheduled Posts ({orderedScheduledPosts.length})
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/schedule"
            className="inline-flex cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Create Scheduled Post
          </Link>
          <button
            type="button"
            onClick={() => void loadScheduledPosts()}
            disabled={loadingScheduledPosts}
            className="inline-flex cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingScheduledPosts ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <section className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loadingScheduledPosts ? (
          <p className="text-sm text-slate-700">Loading scheduled posts...</p>
        ) : scheduledPostsError ? (
          <p className="text-sm text-red-600">{scheduledPostsError}</p>
        ) : !orderedScheduledPosts.length ? (
          <p className="text-sm text-slate-600">No upcoming scheduled posts.</p>
        ) : (
          <ul className="space-y-3">
            {orderedScheduledPosts.map((post) => {
              const localTime = formatScheduledLocalTime(
                post.scheduled_time_utc,
                timezone,
                clockFormatPreference,
              );
              const statusLabel = post.status === "posting" ? "Publishing" : "Scheduled";

              return (
                <li
                  key={post.id}
                  className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <p className="line-clamp-3 text-sm text-slate-900">{post.text}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-700">
                      {statusLabel}
                    </span>
                    <span className="text-slate-600">
                      {localTime
                        ? `${localTime} (${timezone})`
                        : "Invalid scheduled timestamp"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
