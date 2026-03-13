"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { buildWorkerUrl } from "@/lib/apiClient";
import {
  formatTimezoneLabel,
  formatScheduledLocalTime,
  resolveClockFormatPreference,
  resolveTimezonePreference,
} from "@/lib/scheduledTimeDisplay";
import { subscribeScheduledPostsUpdated } from "@/lib/scheduledPostsRefresh";

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
  success?: boolean;
  scheduled_posts?: ScheduledPost[];
  error?: string;
};

const THREADS_ME_URL = buildWorkerUrl("/api/threads/me");
const THREADS_SCHEDULE_URL = buildWorkerUrl("/api/threads/schedule");
const THREADS_SCHEDULE_UPDATE_URL = buildWorkerUrl("/api/threads/schedule/update");
const THREADS_SCHEDULE_DELETE_URL = buildWorkerUrl("/api/threads/schedule/delete");

function parseScheduledTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function padTwoDigits(value: number): string {
  return value.toString().padStart(2, "0");
}

function getCurrentDateTimeForTimezone(timezone: string, now: Date): { currentDate: string; currentTime: string } {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;
    if (!year || !month || !day || !hour || !minute) {
      throw new Error("Missing date time parts");
    }
    return {
      currentDate: `${year}-${month}-${day}`,
      currentTime: `${hour}:${minute}`,
    };
  } catch {
    return {
      currentDate: `${now.getFullYear()}-${padTwoDigits(now.getMonth() + 1)}-${padTwoDigits(now.getDate())}`,
      currentTime: `${padTwoDigits(now.getHours())}:${padTwoDigits(now.getMinutes())}`,
    };
  }
}

function getInputDateTimeForTimezone(
  scheduledUtc: string,
  timezone: string,
): { date: string; time: string } | null {
  const date = new Date(scheduledUtc);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;
    if (!year || !month || !day || !hour || !minute) {
      return null;
    }
    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
    };
  } catch {
    return null;
  }
}

function normalizeTimePayload(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }
  return `${padTwoDigits(hour)}:${padTwoDigits(minute)}`;
}

export default function ScheduledPostsPage() {
  const { user, loading } = useAuth();
  const appUserId = user?.id?.trim() ?? "";
  const timezone = resolveTimezonePreference(user?.timezone);
  const timezoneLabel = formatTimezoneLabel(timezone);
  const clockFormatPreference = resolveClockFormatPreference(user?.clock_format);
  const { currentDate: minScheduleDate, currentTime: minScheduleTime } = useMemo(
    () => getCurrentDateTimeForTimezone(timezone, new Date()),
    [timezone],
  );
  const [threadsUserId, setThreadsUserId] = useState<string>("");
  const [loadingConnection, setLoadingConnection] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loadingScheduledPosts, setLoadingScheduledPosts] = useState(false);
  const [scheduledPostsError, setScheduledPostsError] = useState("");
  const [deleteScheduledPostError, setDeleteScheduledPostError] = useState("");
  const [deleteScheduledPostSuccess, setDeleteScheduledPostSuccess] = useState("");
  const [deletingScheduledPostId, setDeletingScheduledPostId] = useState<number | null>(null);
  const [editingScheduledPostId, setEditingScheduledPostId] = useState<number | null>(null);
  const [editPostText, setEditPostText] = useState("");
  const [editScheduleDate, setEditScheduleDate] = useState("");
  const [editScheduleTime, setEditScheduleTime] = useState("");
  const [savingScheduledPostId, setSavingScheduledPostId] = useState<number | null>(null);
  const [editScheduledPostError, setEditScheduledPostError] = useState("");
  const [editScheduledPostSuccess, setEditScheduledPostSuccess] = useState("");

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

  useEffect(() => {
    if (!appUserId || !threadsUserId) {
      return;
    }

    return subscribeScheduledPostsUpdated(() => {
      void loadScheduledPosts();
    });
    // appUserId/threadsUserId changes should resubscribe the refresh listener.
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
      if (Array.isArray(data?.scheduled_posts)) {
        setScheduledPosts(data.scheduled_posts);
        setScheduledPostsError("");
        return;
      }

      if (!response.ok) {
        setScheduledPostsError(data?.error || "Could not load scheduled posts.");
        return;
      }

      if (data?.success === false) {
        setScheduledPostsError(data.error || "Could not load scheduled posts.");
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

  async function deleteScheduledPost(scheduledPostId: number) {
    if (!appUserId) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this scheduled post? This action cannot be undone and the post will not be published.",
    );
    if (!confirmed) {
      return;
    }

    setDeletingScheduledPostId(scheduledPostId);
    setDeleteScheduledPostError("");
    setDeleteScheduledPostSuccess("");

    try {
      const response = await fetch(THREADS_SCHEDULE_DELETE_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_user_id: appUserId,
          scheduled_post_id: scheduledPostId,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string; deleted?: boolean }
        | null;

      if (!response.ok || data?.success === false || data?.deleted !== true) {
        setDeleteScheduledPostError(data?.error || "Could not delete scheduled post.");
        return;
      }

      setScheduledPosts((currentPosts) =>
        currentPosts.filter((post) => post.id !== scheduledPostId),
      );
      setDeleteScheduledPostSuccess("Scheduled post deleted.");
      setScheduledPostsError("");
    } catch {
      setDeleteScheduledPostError("Could not delete scheduled post.");
    } finally {
      setDeletingScheduledPostId(null);
    }
  }

  function startEditingScheduledPost(post: ScheduledPost) {
    const localInput = getInputDateTimeForTimezone(post.scheduled_time_utc, timezone);
    if (!localInput) {
      setEditScheduledPostError("Could not load this scheduled time for editing.");
      setEditScheduledPostSuccess("");
      return;
    }

    setEditingScheduledPostId(post.id);
    setEditPostText(post.text);
    setEditScheduleDate(localInput.date);
    setEditScheduleTime(localInput.time);
    setEditScheduledPostError("");
    setEditScheduledPostSuccess("");
    setDeleteScheduledPostError("");
    setDeleteScheduledPostSuccess("");
  }

  function cancelEditingScheduledPost() {
    setEditingScheduledPostId(null);
    setEditPostText("");
    setEditScheduleDate("");
    setEditScheduleTime("");
    setEditScheduledPostError("");
  }

  async function saveEditedScheduledPost(scheduledPostId: number) {
    if (!appUserId) {
      return;
    }

    const trimmedText = editPostText.trim();
    const normalizedTime = normalizeTimePayload(editScheduleTime);
    if (!trimmedText) {
      setEditScheduledPostError("Enter post text before saving.");
      setEditScheduledPostSuccess("");
      return;
    }
    if (!editScheduleDate || !normalizedTime) {
      setEditScheduledPostError("Select both date and time before saving.");
      setEditScheduledPostSuccess("");
      return;
    }
    if (editScheduleDate < minScheduleDate || (editScheduleDate === minScheduleDate && normalizedTime < minScheduleTime)) {
      setEditScheduledPostError("Scheduled time must be in the future.");
      setEditScheduledPostSuccess("");
      return;
    }

    setSavingScheduledPostId(scheduledPostId);
    setEditScheduledPostError("");
    setEditScheduledPostSuccess("");

    try {
      const response = await fetch(THREADS_SCHEDULE_UPDATE_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_user_id: appUserId,
          scheduled_post_id: scheduledPostId,
          text: trimmedText,
          date: editScheduleDate,
          time: normalizedTime,
          timezone,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
          success?: boolean;
          error?: string;
          scheduled_post?: { id?: number; text?: string; status?: "approved" | "posting" | "posted"; scheduled_time_utc?: string };
        }
        | null;

      if (!response.ok || data?.success === false || !data?.scheduled_post?.scheduled_time_utc) {
        setEditScheduledPostError(data?.error || "Could not update scheduled post.");
        return;
      }

      const updatedPost = data.scheduled_post;
      const updatedText = updatedPost.text?.trim() || trimmedText;
      const updatedStatus = updatedPost.status === "posting" || updatedPost.status === "posted"
        ? updatedPost.status
        : "approved";

      setScheduledPosts((currentPosts) =>
        currentPosts.map((post) => {
          if (post.id !== scheduledPostId) {
            return post;
          }
          return {
            ...post,
            text: updatedText,
            status: updatedStatus,
            scheduled_time_utc: updatedPost.scheduled_time_utc ?? post.scheduled_time_utc,
          };
        }),
      );
      setEditingScheduledPostId(null);
      setEditPostText("");
      setEditScheduleDate("");
      setEditScheduleTime("");
      setEditScheduledPostError("");
      setEditScheduledPostSuccess("Scheduled post updated.");
      setScheduledPostsError("");
    } catch {
      setEditScheduledPostError("Could not update scheduled post.");
    } finally {
      setSavingScheduledPostId(null);
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
        <Link
          href="/schedule"
          className="inline-flex cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Create Scheduled Post
        </Link>
      </div>
      <p className="text-sm text-slate-600">
        Times are shown in <span className="font-medium text-slate-800">{timezoneLabel}</span>.
      </p>

      <section className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {deleteScheduledPostSuccess ? (
          <p className="mb-3 text-sm text-emerald-700">{deleteScheduledPostSuccess}</p>
        ) : null}
        {deleteScheduledPostError ? (
          <p className="mb-3 text-sm text-red-600">{deleteScheduledPostError}</p>
        ) : null}
        {editScheduledPostSuccess ? (
          <p className="mb-3 text-sm text-emerald-700">{editScheduledPostSuccess}</p>
        ) : null}
        {editScheduledPostError ? (
          <p className="mb-3 text-sm text-red-600">{editScheduledPostError}</p>
        ) : null}
        {loadingScheduledPosts ? (
          <p className="text-sm text-slate-700">Loading scheduled posts...</p>
        ) : scheduledPostsError ? (
          <p className="text-sm text-red-600">{scheduledPostsError}</p>
        ) : !orderedScheduledPosts.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <h2 className="text-base font-semibold text-slate-900">No scheduled posts yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              You have no scheduled posts yet. Create your first post to start building your schedule.
            </p>
            <div className="mt-4">
              <Link
                href="/schedule"
                className="inline-flex cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Create Post
              </Link>
            </div>
          </div>
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
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-700">
                        {statusLabel}
                      </span>
                      <span className="text-slate-600">
                        {localTime
                          ? `${localTime} (${timezoneLabel})`
                          : "Invalid scheduled timestamp"}
                      </span>
                    </div>
                    {post.status === "approved" ? (
                      <div className="flex items-center gap-2">
                        {editingScheduledPostId === post.id ? null : (
                          <button
                            type="button"
                            onClick={() => startEditingScheduledPost(post)}
                            disabled={deletingScheduledPostId === post.id}
                            className={`rounded-md border px-3 py-1 text-xs font-medium ${
                              deletingScheduledPostId === post.id
                                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                : "cursor-pointer border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                            }`}
                            aria-label={`Edit scheduled post ${post.id}`}
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void deleteScheduledPost(post.id)}
                          disabled={deletingScheduledPostId === post.id || savingScheduledPostId === post.id}
                          className={`rounded-md border px-3 py-1 text-xs font-medium ${
                            deletingScheduledPostId === post.id
                              ? "cursor-not-allowed border-red-200 bg-red-50 text-red-400"
                              : "cursor-pointer border-red-300 bg-white text-red-700 hover:bg-red-50"
                          }`}
                          aria-label={`Delete scheduled post ${post.id}`}
                        >
                          {deletingScheduledPostId === post.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {editingScheduledPostId === post.id ? (
                    <form
                      className="mt-3 space-y-3 rounded-md border border-slate-200 bg-white p-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveEditedScheduledPost(post.id);
                      }}
                    >
                      <label className="block text-xs font-medium text-slate-700" htmlFor={`edit-post-text-${post.id}`}>
                        Post text
                      </label>
                      <textarea
                        id={`edit-post-text-${post.id}`}
                        value={editPostText}
                        onChange={(event) => setEditPostText(event.target.value)}
                        rows={3}
                        maxLength={500}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-slate-700" htmlFor={`edit-post-date-${post.id}`}>
                            Date
                          </label>
                          <input
                            id={`edit-post-date-${post.id}`}
                            type="date"
                            value={editScheduleDate}
                            min={minScheduleDate}
                            onChange={(event) => setEditScheduleDate(event.target.value)}
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700" htmlFor={`edit-post-time-${post.id}`}>
                            Time ({timezoneLabel})
                          </label>
                          <input
                            id={`edit-post-time-${post.id}`}
                            type="time"
                            value={editScheduleTime}
                            min={editScheduleDate === minScheduleDate ? minScheduleTime : undefined}
                            onChange={(event) => setEditScheduleTime(event.target.value)}
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="submit"
                          disabled={savingScheduledPostId === post.id}
                          className={`rounded-md px-3 py-1 text-xs font-medium text-white ${
                            savingScheduledPostId === post.id
                              ? "cursor-not-allowed bg-slate-400"
                              : "cursor-pointer bg-slate-900 hover:bg-slate-800"
                          }`}
                        >
                          {savingScheduledPostId === post.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingScheduledPost}
                          disabled={savingScheduledPostId === post.id}
                          className={`rounded-md border px-3 py-1 text-xs font-medium ${
                            savingScheduledPostId === post.id
                              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                              : "cursor-pointer border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
