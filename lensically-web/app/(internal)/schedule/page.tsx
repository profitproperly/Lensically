"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { buildWorkerUrl } from "@/lib/apiClient";

type ThreadsMeResponse = {
  connected?: boolean;
  account?: {
    threads_user_id?: string | null;
  } | null;
  threads_user_id?: string | null;
  error?: string;
};

const THREADS_ME_URL = buildWorkerUrl("/api/threads/me");
const THREADS_POST_NOW_URL = buildWorkerUrl("/api/threads/post-now");
const THREADS_SCHEDULE_URL = buildWorkerUrl("/api/threads/schedule");

export default function SchedulePage() {
  const { user, loading } = useAuth();
  const appUserId = user?.id?.trim() ?? "";
  const timezone = user?.timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const clockFormatLabel = user?.clock_format === "24h" ? "24-hour" : "12-hour";

  const [postText, setPostText] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [threadsUserId, setThreadsUserId] = useState<string>("");
  const [loadingConnection, setLoadingConnection] = useState(true);
  const [isPostingNow, setIsPostingNow] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!appUserId) {
      setThreadsUserId("");
      setLoadingConnection(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    async function loadThreadsConnection() {
      setLoadingConnection(true);
      setErrorMessage("");

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
          setErrorMessage("Could not load Threads connection.");
          return;
        }

        const data = (await response.json()) as ThreadsMeResponse;
        const resolvedThreadsUserId =
          data.account?.threads_user_id?.trim()
          || data.threads_user_id?.trim()
          || "";

        if (!resolvedThreadsUserId) {
          setThreadsUserId("");
          setErrorMessage("Threads account is not connected.");
          return;
        }

        setThreadsUserId(resolvedThreadsUserId);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (isMounted) {
          setThreadsUserId("");
          setErrorMessage("Could not load Threads connection.");
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

  async function handlePostNow() {
    const trimmedText = postText.trim();
    if (!trimmedText) {
      setErrorMessage("Enter post text before publishing.");
      return;
    }
    if (!appUserId || !threadsUserId) {
      setErrorMessage("Threads account is not connected.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsPostingNow(true);

    try {
      const response = await fetch(THREADS_POST_NOW_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_user_id: appUserId,
          threads_user_id: threadsUserId,
          text: trimmedText,
        }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string; published_post_id?: string } | null;
      if (!response.ok) {
        setErrorMessage(data?.error || "Could not publish post.");
        return;
      }

      setSuccessMessage(
        data?.published_post_id
          ? `Post published successfully (${data.published_post_id}).`
          : "Post published successfully.",
      );
      setPostText("");
    } catch {
      setErrorMessage("Could not publish post.");
    } finally {
      setIsPostingNow(false);
    }
  }

  async function handleSchedulePost() {
    const trimmedText = postText.trim();
    if (!trimmedText) {
      setErrorMessage("Enter post text before scheduling.");
      return;
    }
    if (!scheduleDate || !scheduleTime) {
      setErrorMessage("Select both date and time to schedule a post.");
      return;
    }
    if (!appUserId || !threadsUserId) {
      setErrorMessage("Threads account is not connected.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsScheduling(true);

    try {
      const response = await fetch(THREADS_SCHEDULE_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_user_id: appUserId,
          threads_user_id: threadsUserId,
          text: trimmedText,
          date: scheduleDate,
          time: scheduleTime,
          timezone,
        }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string; scheduled_post?: { scheduled_time_utc?: string } } | null;
      if (!response.ok) {
        setErrorMessage(data?.error || "Could not schedule post.");
        return;
      }

      setSuccessMessage(
        data?.scheduled_post?.scheduled_time_utc
          ? `Post scheduled for ${data.scheduled_post.scheduled_time_utc} UTC.`
          : "Post scheduled successfully.",
      );
      setPostText("");
      setScheduleDate("");
      setScheduleTime("");
    } catch {
      setErrorMessage("Could not schedule post.");
    } finally {
      setIsScheduling(false);
    }
  }

  const isSubmitting = isPostingNow || isScheduling;

  if (loading || loadingConnection) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900">Schedule Posts</h1>
        <p className="text-sm text-slate-700">Loading composer...</p>
      </div>
    );
  }

  if (!threadsUserId) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900">Schedule Posts</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">
            Connect your Threads account to publish or schedule posts.
          </p>
          <Link
            href="/connect"
            className="mt-4 inline-flex cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Connect Threads
          </Link>
          {errorMessage ? (
            <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">Schedule Posts</h1>

      <section className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-5">
          <div>
            <label htmlFor="post-text" className="block text-sm font-medium text-slate-900">
              Post Text
            </label>
            <textarea
              id="post-text"
              value={postText}
              onChange={(event) => {
                setPostText(event.target.value);
                setErrorMessage("");
                setSuccessMessage("");
              }}
              rows={5}
              maxLength={500}
              disabled={isSubmitting}
              placeholder="Write your Threads post..."
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-1 text-xs text-slate-500">{postText.length}/500</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="schedule-date" className="block text-sm font-medium text-slate-900">
                Date
              </label>
              <input
                id="schedule-date"
                type="date"
                value={scheduleDate}
                onChange={(event) => {
                  setScheduleDate(event.target.value);
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                disabled={isSubmitting}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="schedule-time" className="block text-sm font-medium text-slate-900">
                Time
              </label>
              <input
                id="schedule-time"
                type="time"
                value={scheduleTime}
                onChange={(event) => {
                  setScheduleTime(event.target.value);
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                disabled={isSubmitting}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-600">
              Scheduling preferences: timezone <span className="font-medium text-slate-800">{timezone}</span>, clock format{" "}
              <span className="font-medium text-slate-800">{clockFormatLabel}</span>.
            </p>
            <Link
              href="/account"
              className="inline-flex cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Change in Account Settings
            </Link>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handlePostNow()}
              disabled={isSubmitting || !postText.trim()}
              className="inline-flex cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPostingNow ? "Posting..." : "Post Now"}
            </button>
            <button
              type="button"
              onClick={() => void handleSchedulePost()}
              disabled={isSubmitting || !postText.trim() || !scheduleDate || !scheduleTime}
              className="inline-flex cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isScheduling ? "Scheduling..." : "Schedule Post"}
            </button>
          </div>

          {errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : null}
          {successMessage ? (
            <p className="text-sm text-green-700">{successMessage}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
