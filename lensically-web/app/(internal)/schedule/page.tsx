"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { buildWorkerUrl } from "@/lib/apiClient";
import {
  formatScheduledLocalTime,
  resolveClockFormatPreference,
  resolveTimezonePreference,
} from "@/lib/scheduledTimeDisplay";

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

function padTwoDigits(value: number): string {
  return value.toString().padStart(2, "0");
}

function getCurrentDateTimeForTimezone(
  timezone: string,
  now: Date,
): { currentDate: string; currentTime: string } {
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

function parseHourMinute(value: string): { hour: number; minute: number } | null {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

function toMinutesOfDay(value: string): number | null {
  const parsed = parseHourMinute(value);
  if (!parsed) {
    return null;
  }
  return (parsed.hour * 60) + parsed.minute;
}

function formatPickerTime(value: string, clockFormat: "12h" | "24h"): string {
  const parsed = parseHourMinute(value);
  if (!parsed) {
    return value;
  }
  if (clockFormat === "24h") {
    return `${padTwoDigits(parsed.hour)}:${padTwoDigits(parsed.minute)}`;
  }
  const hour12 = parsed.hour % 12 || 12;
  const period = parsed.hour >= 12 ? "PM" : "AM";
  return `${hour12}:${padTwoDigits(parsed.minute)} ${period}`;
}

export default function SchedulePage() {
  const { user, loading } = useAuth();
  const appUserId = user?.id?.trim() ?? "";
  const timezone = resolveTimezonePreference(user?.timezone);
  const clockFormatPreference = resolveClockFormatPreference(user?.clock_format);
  const clockFormatLabel = clockFormatPreference === "24h" ? "24-hour" : "12-hour";

  const [postText, setPostText] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [threadsUserId, setThreadsUserId] = useState<string>("");
  const [loadingConnection, setLoadingConnection] = useState(true);
  const [isPostingNow, setIsPostingNow] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isScheduleComposerOpen, setIsScheduleComposerOpen] = useState(false);
  const [showPostNowConfirmation, setShowPostNowConfirmation] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loadingScheduledPosts, setLoadingScheduledPosts] = useState(false);
  const [scheduledPostsError, setScheduledPostsError] = useState("");
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());

  const { currentDate: minScheduleDate, currentTime: minScheduleTime } = getCurrentDateTimeForTimezone(
    timezone,
    new Date(currentTimestamp),
  );
  const isSchedulingForToday = scheduleDate === minScheduleDate;
  const hasPastTimeSelection = isSchedulingForToday && Boolean(scheduleTime) && scheduleTime < minScheduleTime;
  const minScheduleMinutes = toMinutesOfDay(minScheduleTime);

  const scheduleTimeOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const effectiveMinMinutes = isSchedulingForToday && Number.isInteger(minScheduleMinutes)
      ? Number(minScheduleMinutes)
      : 0;

    for (let minutes = effectiveMinMinutes; minutes < 24 * 60; minutes += 1) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const value = `${padTwoDigits(hour)}:${padTwoDigits(minute)}`;
      options.push({
        value,
        label: formatPickerTime(value, clockFormatPreference),
      });
    }

    return options;
  }, [clockFormatPreference, isSchedulingForToday, minScheduleMinutes]);

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
    const intervalId = window.setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!scheduleDate) {
      return;
    }
    if (scheduleDate >= minScheduleDate) {
      return;
    }

    setScheduleDate(minScheduleDate);
    setScheduleTime("");
    setErrorMessage("Scheduling date cannot be in the past.");
    setSuccessMessage("");
  }, [minScheduleDate, scheduleDate]);

  useEffect(() => {
    if (!isSchedulingForToday || !scheduleTime || scheduleTime >= minScheduleTime) {
      return;
    }

    setScheduleTime("");
    setErrorMessage("Select a future time when scheduling for today.");
    setSuccessMessage("");
  }, [isSchedulingForToday, minScheduleTime, scheduleTime]);

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

      setScheduledPosts(Array.isArray(data?.scheduled_posts) ? data.scheduled_posts : []);
    } catch {
      setScheduledPostsError("Could not load scheduled posts.");
    } finally {
      setLoadingScheduledPosts(false);
    }
  }

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

  function handleRequestPostNowConfirmation() {
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
    setShowPostNowConfirmation(true);
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
    if (scheduleDate < minScheduleDate) {
      setErrorMessage("Scheduling date cannot be in the past.");
      return;
    }
    if (scheduleDate === minScheduleDate && scheduleTime < minScheduleTime) {
      setErrorMessage("Select a future time when scheduling for today.");
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

      const scheduledUtc = data?.scheduled_post?.scheduled_time_utc;
      const localScheduledTime = scheduledUtc
        ? formatScheduledLocalTime(
          scheduledUtc,
          timezone,
          clockFormatPreference,
        )
        : null;

      setSuccessMessage(
        localScheduledTime
          ? `Post scheduled for ${localScheduledTime} (${timezone}).`
          : "Post scheduled successfully.",
      );
      setPostText("");
      setScheduleDate("");
      setScheduleTime("");
      setIsScheduleComposerOpen(false);
      await loadScheduledPosts();
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

          {isScheduleComposerOpen ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="schedule-date" className="block text-sm font-medium text-slate-900">
                    Date
                  </label>
                  <input
                    id="schedule-date"
                    type="date"
                    value={scheduleDate}
                    min={minScheduleDate}
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
                    Time ({timezone}, {clockFormatLabel})
                  </label>
                  <select
                    id="schedule-time"
                    value={scheduleTime}
                    onChange={(event) => {
                      setScheduleTime(event.target.value);
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    disabled={isSubmitting}
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Select time</option>
                    {scheduleTimeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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
            </>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRequestPostNowConfirmation}
              disabled={isSubmitting || !postText.trim()}
              className="inline-flex cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPostingNow ? "Posting..." : "Post Now"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsScheduleComposerOpen(true);
                setErrorMessage("");
                setSuccessMessage("");
              }}
              disabled={isSubmitting || isScheduleComposerOpen || !postText.trim()}
              className="inline-flex cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Schedule Post
            </button>
            {isScheduleComposerOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleSchedulePost()}
                  disabled={isSubmitting || !postText.trim() || !scheduleDate || !scheduleTime || hasPastTimeSelection}
                  className="inline-flex cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isScheduling ? "Scheduling..." : "Confirm Scheduled Post"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isSubmitting) {
                      return;
                    }
                    setIsScheduleComposerOpen(false);
                    setScheduleDate("");
                    setScheduleTime("");
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                  disabled={isSubmitting}
                  className="inline-flex cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel Scheduling
                </button>
              </>
            ) : null}
          </div>

          {errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : null}
          {successMessage ? (
            <p className="text-sm text-green-700">{successMessage}</p>
          ) : null}
        </div>
      </section>

      <section className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Upcoming Scheduled Posts</h2>
          <button
            type="button"
            onClick={() => void loadScheduledPosts()}
            disabled={loadingScheduledPosts}
            className="inline-flex cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingScheduledPosts ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loadingScheduledPosts ? (
          <p className="text-sm text-slate-700">Loading scheduled posts...</p>
        ) : scheduledPostsError ? (
          <p className="text-sm text-red-600">{scheduledPostsError}</p>
        ) : !scheduledPosts.length ? (
          <p className="text-sm text-slate-600">No upcoming scheduled posts.</p>
        ) : (
          <ul className="space-y-3">
            {scheduledPosts.map((post) => {
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

      {showPostNowConfirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Publish post now?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              This will immediately publish your post to Threads and cannot be undone.
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (isPostingNow) {
                    return;
                  }
                  setShowPostNowConfirmation(false);
                }}
                disabled={isPostingNow}
                className="inline-flex cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handlePostNow();
                  setShowPostNowConfirmation(false);
                }}
                disabled={isPostingNow}
                className="inline-flex cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPostingNow ? "Posting..." : "Confirm and Post Now"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
