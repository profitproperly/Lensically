"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";
import { useAuth } from "@/lib/AuthProvider";
import {
  formatTimezoneLabel,
  formatScheduledLocalTime,
  resolveClockFormatPreference,
  resolveTimezonePreference,
} from "@/lib/scheduledTimeDisplay";
import { subscribeScheduledPostsUpdated } from "@/lib/scheduledPostsRefresh";

type ThreadsMeResponse = {
  active_threads_user_id?: string | null;
  accounts?: Array<{
    threads_user_id?: string | null;
    is_active?: boolean;
  }> | null;
  account?: {
    threads_user_id?: string | null;
  } | null;
  threads_user_id?: string | null;
  error?: string;
};

type ScheduledPost = {
  id: number;
  text: string;
  status: "approved" | "posting" | "posted";
  scheduled_time_utc: string;
  spoiler_all_text?: boolean;
  spoiler_phrases?: string[];
  publish_error_message?: string | null;
  last_attempted_at?: string | null;
  processing_started_at?: string | null;
};

type ScheduledPostsResponse = {
  success?: boolean;
  scheduled_posts?: ScheduledPost[];
  error?: string;
};

const THREADS_ACCOUNTS_URL = buildWorkerUrl("/api/threads/accounts");
const THREADS_ME_URL = buildWorkerUrl("/api/threads/me");
const THREADS_SCHEDULE_URL = buildWorkerUrl("/api/threads/schedule");
const THREADS_SCHEDULE_UPDATE_URL = buildWorkerUrl("/api/threads/schedule/update");
const THREADS_SCHEDULE_RETRY_URL = buildWorkerUrl("/api/threads/schedule/retry");
const THREADS_SCHEDULE_DELETE_URL = buildWorkerUrl("/api/threads/schedule/delete");
const FALLBACK_TIMEZONE = "America/New_York";
const FALLBACK_CLOCK_FORMAT = "12h";

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

function parseSpoilerPhraseLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function formatPublishErrorMessage(raw: string | null | undefined): string {
  const normalizedRaw = typeof raw === "string" ? raw.trim() : "";
  if (!normalizedRaw) {
    return "Publishing failed. Please try again.";
  }

  const segments = normalizedRaw.split(":");
  const code = (segments[0] ?? "").trim();
  const maybeStatus = (segments[1] ?? "").trim();
  const statusCode = maybeStatus.match(/^\d+$/) ? maybeStatus : "";
  const providerDetail = statusCode
    ? segments.slice(2).join(":").trim()
    : segments.slice(1).join(":").trim();
  const providerSuffix = providerDetail ? ` ${providerDetail}` : "";
  const providerDetailLower = providerDetail.toLowerCase();
  const needsReconnect = providerDetailLower.includes("does not have permission")
    || providerDetailLower.includes("missing permission")
    || providerDetailLower.includes("permission");

  switch (code) {
    case "threads_publish_create_failed":
      if (needsReconnect) {
        return "Threads publish permission is missing for the configured account. Update the account token, then retry.";
      }
      return statusCode
        ? `Threads rejected post creation (HTTP ${statusCode}). Please retry.${providerSuffix}`
        : `Threads rejected post creation. Please retry.${providerSuffix}`;
    case "threads_publish_create_invalid_response":
      return "Threads returned an invalid response while creating the post. Please retry.";
    case "threads_publish_create_exception":
      return "Could not reach Threads while creating the post. Please retry.";
    case "threads_publish_status_check_failed":
      return statusCode
        ? `Threads status check failed (HTTP ${statusCode}). Please retry.${providerSuffix}`
        : `Threads status check failed. Please retry.${providerSuffix}`;
    case "threads_publish_status_check_exception":
      return "Could not confirm publish status from Threads. Please retry.";
    case "threads_publish_status_invalid_response":
      return "Threads returned an invalid publish status response. Please retry.";
    case "threads_publish_status_not_ready":
      return "Threads did not finish publishing in time. Please retry.";
    case "threads_publish_commit_failed":
      return statusCode
        ? `Threads publish commit failed (HTTP ${statusCode}). Please retry.${providerSuffix}`
        : `Threads publish commit failed. Please retry.${providerSuffix}`;
    case "threads_publish_commit_invalid_response":
      return "Threads returned an invalid publish confirmation response. Please retry.";
    case "threads_publish_commit_exception":
      return "Could not finalize publishing with Threads. Please retry.";
    case "threads_account_not_connected":
      return "The configured Threads account token is not available. Update the account token, then retry.";
    case "threads_publish_exception":
      return "Could not reach Threads to publish this post. Please retry.";
    case "publish_interrupted_retry":
      return "Publishing was interrupted before completion. Retry now.";
    case "status_transition_failed":
      return "Post publish state could not be finalized. Retry now.";
    case "scheduled_publish_retry_failed":
      return "Retry attempt did not complete successfully. Please try again.";
    default:
      return "Publishing failed. Please try again.";
  }
}

function formatDebugTimestamp(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.includes("T") ? trimmed : `${trimmed.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getNeedsAssistanceReason(post: ScheduledPost, isOverdue: boolean): string | null {
  if (post.status === "posting") {
    return "This post is still marked as publishing.";
  }
  if (!isOverdue && !post.publish_error_message) {
    return null;
  }
  if (post.publish_error_message) {
    return formatPublishErrorMessage(post.publish_error_message);
  }
  if (!post.last_attempted_at) {
    return "The scheduled time passed, but no publish attempt was recorded. This points to the automatic scheduler not picking it up.";
  }
  return "The scheduled time passed and the post still needs a manual retry.";
}

export default function ScheduledPostsPage() {
  const { user } = useAuth();
  const timezone = resolveTimezonePreference(user?.timezone ?? FALLBACK_TIMEZONE);
  const timezoneLabel = formatTimezoneLabel(timezone);
  const clockFormatPreference = resolveClockFormatPreference(user?.clock_format ?? FALLBACK_CLOCK_FORMAT);
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
  const [selectedScheduledPostIds, setSelectedScheduledPostIds] = useState<number[]>([]);
  const [isBulkSelectionMode, setIsBulkSelectionMode] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [editingScheduledPostId, setEditingScheduledPostId] = useState<number | null>(null);
  const [editPostText, setEditPostText] = useState("");
  const [editSpoilerAllText, setEditSpoilerAllText] = useState(false);
  const [editSpoilerPhrasesInput, setEditSpoilerPhrasesInput] = useState("");
  const [editScheduleDate, setEditScheduleDate] = useState("");
  const [editScheduleTime, setEditScheduleTime] = useState("");
  const [savingScheduledPostId, setSavingScheduledPostId] = useState<number | null>(null);
  const [retryingScheduledPostId, setRetryingScheduledPostId] = useState<number | null>(null);
  const [editScheduledPostError, setEditScheduledPostError] = useState("");
  const [editScheduledPostSuccess, setEditScheduledPostSuccess] = useState("");
  const [retryScheduledPostError, setRetryScheduledPostError] = useState("");
  const [retryScheduledPostSuccess, setRetryScheduledPostSuccess] = useState("");

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
    let isMounted = true;
    const controller = new AbortController();

    async function loadThreadsConnection() {
      setLoadingConnection(true);
      setConnectionError("");

      try {
        const fetchConnectionPayload = async (): Promise<ThreadsMeResponse | null> => {
          const accountsResponse = await fetch(
            THREADS_ACCOUNTS_URL,
            {
              cache: "no-store",
              credentials: "include",
              signal: controller.signal,
            },
          );
          if (accountsResponse.ok) {
            return (await accountsResponse.json()) as ThreadsMeResponse;
          }

          const meResponse = await fetch(
            THREADS_ME_URL,
            {
              cache: "no-store",
              credentials: "include",
              signal: controller.signal,
            },
          );
          if (!meResponse.ok) {
            return null;
          }
          return (await meResponse.json()) as ThreadsMeResponse;
        };
        const data = await fetchConnectionPayload();

        if (!isMounted) {
          return;
        }

        if (!data) {
          setThreadsUserId("");
          setConnectionError("Could not load Threads connection.");
          return;
        }
        const activeFromList = Array.isArray(data.accounts)
          ? data.accounts.find((account) => account?.is_active)?.threads_user_id?.trim()
          : "";
        const firstFromList = Array.isArray(data.accounts)
          ? data.accounts.find((account) => account?.threads_user_id)?.threads_user_id?.trim()
          : "";
        const resolvedThreadsUserId =
          data.active_threads_user_id?.trim()
          || activeFromList
          || firstFromList
          || data.account?.threads_user_id?.trim()
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
  }, []);

  useEffect(() => {
    if (!threadsUserId) {
      setScheduledPosts([]);
      setSelectedScheduledPostIds([]);
      setIsBulkSelectionMode(false);
      setScheduledPostsError("");
      setLoadingScheduledPosts(false);
      return;
    }

    void loadScheduledPosts();
    // appUserId/threadsUserId changes should refresh upcoming posts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadsUserId]);

  useEffect(() => {
    if (!threadsUserId) {
      return;
    }

    return subscribeScheduledPostsUpdated(() => {
      void loadScheduledPosts();
    });
    // appUserId/threadsUserId changes should resubscribe the refresh listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadsUserId]);

  async function loadScheduledPosts() {
    if (!threadsUserId) {
      return;
    }

    setLoadingScheduledPosts(true);
    setScheduledPostsError("");

    try {
      const response = await fetch(
        THREADS_SCHEDULE_URL,
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

  function handleToggleBulkSelectionMode() {
    setIsBulkSelectionMode((current) => {
      if (current) {
        setSelectedScheduledPostIds([]);
      }
      return !current;
    });
    setDeleteScheduledPostError("");
    setDeleteScheduledPostSuccess("");
  }

  function toggleSelectedScheduledPostId(scheduledPostId: number) {
    setSelectedScheduledPostIds((currentIds) => (
      currentIds.includes(scheduledPostId)
        ? currentIds.filter((id) => id !== scheduledPostId)
        : [...currentIds, scheduledPostId]
    ));
    setDeleteScheduledPostError("");
    setDeleteScheduledPostSuccess("");
  }

  function selectAllScheduledPosts() {
    setSelectedScheduledPostIds(
      orderedScheduledPosts
        .filter((post) => post.status === "approved")
        .map((post) => post.id),
    );
    setDeleteScheduledPostError("");
    setDeleteScheduledPostSuccess("");
  }

  function clearSelectedScheduledPosts() {
    setSelectedScheduledPostIds([]);
    setDeleteScheduledPostError("");
    setDeleteScheduledPostSuccess("");
  }

  async function deleteScheduledPostRequest(scheduledPostId: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(THREADS_SCHEDULE_DELETE_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scheduled_post_id: scheduledPostId,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string; deleted?: boolean }
        | null;

      if (!response.ok || data?.success === false || data?.deleted !== true) {
        return {
          success: false,
          error: data?.error || "Could not delete scheduled post.",
        };
      }

      return { success: true };
    } catch {
      return {
        success: false,
        error: "Could not delete scheduled post.",
      };
    }
  }

  async function handleBulkDeleteSelectedPosts() {
    const selectedIds = [...selectedScheduledPostIds];
    if (!selectedIds.length) {
      setDeleteScheduledPostError("Select at least one scheduled post to delete.");
      setDeleteScheduledPostSuccess("");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedIds.length} scheduled post${selectedIds.length === 1 ? "" : "s"}? This action cannot be undone and the selected posts will not be published.`,
    );
    if (!confirmed) {
      return;
    }

    setIsBulkDeleting(true);
    setDeleteScheduledPostError("");
    setDeleteScheduledPostSuccess("");

    const deletedIds: number[] = [];
    const failedIds: number[] = [];
    let lastError = "";

    for (const scheduledPostId of selectedIds) {
      const result = await deleteScheduledPostRequest(scheduledPostId);
      if (result.success) {
        deletedIds.push(scheduledPostId);
      } else {
        failedIds.push(scheduledPostId);
        lastError = result.error || "Could not delete scheduled post.";
      }
    }

    if (deletedIds.length > 0) {
      setScheduledPosts((currentPosts) =>
        currentPosts.filter((post) => !deletedIds.includes(post.id)),
      );
      setSelectedScheduledPostIds((currentIds) =>
        currentIds.filter((id) => !deletedIds.includes(id)),
      );
      setScheduledPostsError("");
    }

    if (failedIds.length > 0) {
      setDeleteScheduledPostError(
        deletedIds.length > 0
          ? `Deleted ${deletedIds.length} scheduled post${deletedIds.length === 1 ? "" : "s"}, but ${failedIds.length} failed. ${lastError}`
          : lastError || `Could not delete ${failedIds.length} scheduled post${failedIds.length === 1 ? "" : "s"}.`,
      );
      setDeleteScheduledPostSuccess("");
    } else {
      setDeleteScheduledPostSuccess(
        `Deleted ${deletedIds.length} scheduled post${deletedIds.length === 1 ? "" : "s"}.`,
      );
      setDeleteScheduledPostError("");
      setIsBulkSelectionMode(false);
      setSelectedScheduledPostIds([]);
    }

    setIsBulkDeleting(false);
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
    setEditSpoilerAllText(post.spoiler_all_text === true);
    setEditSpoilerPhrasesInput(Array.isArray(post.spoiler_phrases) ? post.spoiler_phrases.join("\n") : "");
    setEditScheduleDate(localInput.date);
    setEditScheduleTime(localInput.time);
    setEditScheduledPostError("");
    setEditScheduledPostSuccess("");
    setDeleteScheduledPostError("");
    setDeleteScheduledPostSuccess("");
    setRetryScheduledPostError("");
    setRetryScheduledPostSuccess("");
  }

  function cancelEditingScheduledPost() {
    setEditingScheduledPostId(null);
    setEditPostText("");
    setEditSpoilerAllText(false);
    setEditSpoilerPhrasesInput("");
    setEditScheduleDate("");
    setEditScheduleTime("");
    setEditScheduledPostError("");
    setRetryScheduledPostError("");
  }

  async function retryScheduledPost(scheduledPostId: number) {
    setRetryingScheduledPostId(scheduledPostId);
    setRetryScheduledPostError("");
    setRetryScheduledPostSuccess("");
    setDeleteScheduledPostError("");
    setDeleteScheduledPostSuccess("");
    setEditScheduledPostError("");
    setEditScheduledPostSuccess("");

    try {
      const response = await fetch(THREADS_SCHEDULE_RETRY_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scheduled_post_id: scheduledPostId,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
          success?: boolean;
          error?: string;
          posted?: boolean;
          published_post_id?: string;
          publish_error_message?: string | null;
        }
        | null;

      if (!response.ok || data?.success === false || data?.posted !== true) {
        const rawError = data?.publish_error_message ?? data?.error ?? null;
        setRetryScheduledPostError(formatPublishErrorMessage(rawError));
        setScheduledPosts((currentPosts) =>
          currentPosts.map((post) => {
            if (post.id !== scheduledPostId) {
              return post;
            }
            return {
              ...post,
              publish_error_message: typeof rawError === "string" ? rawError : post.publish_error_message ?? null,
            };
          }),
        );
        return;
      }

      setScheduledPosts((currentPosts) => currentPosts.filter((post) => post.id !== scheduledPostId));
      setRetryScheduledPostSuccess(
        data.published_post_id
          ? `Post published successfully (${data.published_post_id}).`
          : "Post published successfully.",
      );
    } catch {
      setRetryScheduledPostError("Could not retry publishing this scheduled post.");
    } finally {
      setRetryingScheduledPostId(null);
    }
  }

  async function saveEditedScheduledPost(scheduledPostId: number) {
    const trimmedText = editPostText.trim();
    const normalizedTime = normalizeTimePayload(editScheduleTime);
    const spoilerPhrases = parseSpoilerPhraseLines(editSpoilerPhrasesInput);
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
          scheduled_post_id: scheduledPostId,
          text: trimmedText,
          date: editScheduleDate,
          time: normalizedTime,
          timezone,
          spoiler_all_text: editSpoilerAllText,
          spoiler_phrases: spoilerPhrases,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
          success?: boolean;
          error?: string;
          scheduled_post?: {
            id?: number;
            text?: string;
            status?: "approved" | "posting" | "posted";
            scheduled_time_utc?: string;
            spoiler_all_text?: boolean;
            spoiler_phrases?: string[];
          };
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
            spoiler_all_text: updatedPost.spoiler_all_text === true,
            spoiler_phrases: Array.isArray(updatedPost.spoiler_phrases) ? updatedPost.spoiler_phrases : [],
          };
        }),
      );
      setEditingScheduledPostId(null);
      setEditPostText("");
      setEditSpoilerAllText(false);
      setEditSpoilerPhrasesInput("");
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

  if (loadingConnection) {
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
            The configured Threads account could not be loaded.
          </p>
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
        {retryScheduledPostSuccess ? (
          <p className="mb-3 text-sm text-emerald-700">{retryScheduledPostSuccess}</p>
        ) : null}
        {retryScheduledPostError ? (
          <p className="mb-3 text-sm text-red-600">{retryScheduledPostError}</p>
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
          <>
            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="text-sm text-slate-700">
                {isBulkSelectionMode
                  ? `${selectedScheduledPostIds.length} selected`
                  : "Use selection mode to delete multiple scheduled posts at once."}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={handleToggleBulkSelectionMode}
                  disabled={isBulkDeleting}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBulkSelectionMode ? "Cancel Selection" : "Select Posts"}
                </button>
                {isBulkSelectionMode ? (
                  <>
                    <button
                      type="button"
                      onClick={selectAllScheduledPosts}
                      disabled={isBulkDeleting}
                      className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={clearSelectedScheduledPosts}
                      disabled={isBulkDeleting || selectedScheduledPostIds.length === 0}
                      className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleBulkDeleteSelectedPosts()}
                      disabled={isBulkDeleting || selectedScheduledPostIds.length === 0}
                      className="inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBulkDeleting ? "Deleting..." : `Delete Selected (${selectedScheduledPostIds.length})`}
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <ul className="space-y-3">
            {orderedScheduledPosts.map((post) => {
              const localTime = formatScheduledLocalTime(
                post.scheduled_time_utc,
                timezone,
                clockFormatPreference,
              );
              const scheduledTimestamp = Date.parse(post.scheduled_time_utc);
              const isOverdue = Number.isFinite(scheduledTimestamp) && scheduledTimestamp < Date.now();
              const needsAssistanceReason = getNeedsAssistanceReason(post, isOverdue);
              const lastAttemptedLabel = formatDebugTimestamp(post.last_attempted_at);
              const processingStartedLabel = formatDebugTimestamp(post.processing_started_at);
              const statusLabel = post.status === "posting"
                ? "Publishing"
                : isOverdue
                  ? "Needs Attention"
                  : "Scheduled";
              const isSelected = selectedScheduledPostIds.includes(post.id);
              const canSelectPost = post.status === "approved";

              return (
                <li
                  key={post.id}
                  className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  {isBulkSelectionMode ? (
                    <label className={`mb-3 flex items-center gap-2 text-xs font-medium ${
                      canSelectPost ? "cursor-pointer text-slate-700" : "cursor-not-allowed text-slate-400"
                    }`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!canSelectPost || isBulkDeleting}
                        onChange={() => toggleSelectedScheduledPostId(post.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {canSelectPost ? "Select for bulk delete" : "Only approved posts can be bulk deleted"}
                    </label>
                  ) : null}
                  <p className="line-clamp-3 text-sm text-slate-900">{post.text}</p>
                  {post.spoiler_all_text || (post.spoiler_phrases?.length ?? 0) > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {post.spoiler_all_text ? (
                        <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-700">
                          Full-text spoiler
                        </span>
                      ) : null}
                      {(post.spoiler_phrases?.length ?? 0) > 0 ? (
                        <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-700">
                          {post.spoiler_phrases?.length} spoiler phrase{post.spoiler_phrases?.length === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
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
                    {post.status === "approved" && !isBulkSelectionMode ? (
                      <div className="flex items-center gap-2">
                        {isOverdue || post.publish_error_message ? (
                          <button
                            type="button"
                            onClick={() => void retryScheduledPost(post.id)}
                            disabled={
                              retryingScheduledPostId === post.id
                              || deletingScheduledPostId === post.id
                              || savingScheduledPostId === post.id
                            }
                            className={`rounded-md border px-3 py-1 text-xs font-medium ${
                              retryingScheduledPostId === post.id
                                ? "cursor-not-allowed border-emerald-200 bg-emerald-50 text-emerald-400"
                                : "cursor-pointer border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                            }`}
                            aria-label={`Retry publishing scheduled post ${post.id}`}
                          >
                            {retryingScheduledPostId === post.id ? "Retrying..." : "Retry Now"}
                          </button>
                        ) : null}
                        {editingScheduledPostId === post.id ? null : (
                          <button
                            type="button"
                            onClick={() => startEditingScheduledPost(post)}
                            disabled={deletingScheduledPostId === post.id || retryingScheduledPostId === post.id}
                            className={`rounded-md border px-3 py-1 text-xs font-medium ${
                              deletingScheduledPostId === post.id || retryingScheduledPostId === post.id
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
                          disabled={
                            deletingScheduledPostId === post.id
                            || savingScheduledPostId === post.id
                            || retryingScheduledPostId === post.id
                          }
                          className={`rounded-md border px-3 py-1 text-xs font-medium ${
                            deletingScheduledPostId === post.id || retryingScheduledPostId === post.id
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
                  {post.publish_error_message ? (
                    <p className="mt-2 text-xs text-red-700">
                      Last publish error: {formatPublishErrorMessage(post.publish_error_message)}
                    </p>
                  ) : null}
                  {needsAssistanceReason ? (
                    <details className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <summary className="cursor-pointer font-medium">
                        Why this needs assistance
                      </summary>
                      <div className="mt-2 space-y-2">
                        <p>{needsAssistanceReason}</p>
                        <p>
                          Scheduled for: {localTime ? `${localTime} (${timezoneLabel})` : post.scheduled_time_utc}
                        </p>
                        <p>
                          Last attempted: {lastAttemptedLabel ?? "No publish attempt recorded"}
                        </p>
                        <p>
                          Processing started: {processingStartedLabel ?? "No processing start recorded"}
                        </p>
                        {!post.last_attempted_at && isOverdue ? (
                          <p>
                            Debug hint: this usually means the automatic scheduler did not pick up the post after its scheduled time.
                          </p>
                        ) : null}
                      </div>
                    </details>
                  ) : null}
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
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        <label className="flex items-start gap-2 text-xs font-medium text-slate-700" htmlFor={`edit-spoiler-all-${post.id}`}>
                          <input
                            id={`edit-spoiler-all-${post.id}`}
                            type="checkbox"
                            checked={editSpoilerAllText}
                            onChange={(event) => setEditSpoilerAllText(event.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                          />
                          <span>Mark the full post as a spoiler</span>
                        </label>
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-slate-700" htmlFor={`edit-spoiler-phrases-${post.id}`}>
                            Spoiler phrases
                          </label>
                          <textarea
                            id={`edit-spoiler-phrases-${post.id}`}
                            value={editSpoilerPhrasesInput}
                            onChange={(event) => setEditSpoilerPhrasesInput(event.target.value)}
                            rows={3}
                            disabled={editSpoilerAllText}
                            placeholder={"One exact phrase per line\nExample ending\nWinner reveal"}
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </div>
                      </div>
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
          </>
        )}
      </section>
    </div>
  );
}
