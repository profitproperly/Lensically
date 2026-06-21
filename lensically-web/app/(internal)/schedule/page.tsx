"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BatchSchedulePanel from "@/components/BatchSchedulePanel";
import { buildWorkerUrl } from "@/lib/apiClient";
import { useAuth } from "@/lib/AuthProvider";
import {
  appendAppUserId,
  appendThreadsUserId,
  readSelectedThreadsUserId,
  SELECTED_THREADS_ACCOUNT_EVENT,
  writeSelectedThreadsUserId,
} from "@/lib/selectedThreadsAccount";
import {
  formatTimezoneLabel,
  formatScheduledLocalTime,
  resolveClockFormatPreference,
  resolveTimezonePreference,
} from "@/lib/scheduledTimeDisplay";
import { notifyScheduledPostsUpdated } from "@/lib/scheduledPostsRefresh";

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

type BatchSchedulePreset = {
  id: string;
  name: string;
  times: string[];
  is_favorite: boolean;
};

const THREADS_ACCOUNTS_URL = buildWorkerUrl("/api/threads/accounts");
const THREADS_ME_URL = buildWorkerUrl("/api/threads/me");
const APP_USER_ID = "workspace-owner";
const HERMES_GENERATE_POSTS_URL = buildWorkerUrl("/api/hermes/generate-posts");
const BATCH_PRESETS_URL = buildWorkerUrl("/api/batch-schedule/presets");
const THREADS_POST_NOW_URL = buildWorkerUrl("/api/threads/post-now");
const THREADS_SCHEDULE_URL = buildWorkerUrl("/api/threads/schedule");
const FALLBACK_TIMEZONE = "America/New_York";
const FALLBACK_CLOCK_FORMAT = "12h";

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

function normalizeTimePayload(value: string): string | null {
  const trimmed = value.trim();
  const direct = parseHourMinute(trimmed);
  if (direct) {
    return `${padTwoDigits(direct.hour)}:${padTwoDigits(direct.minute)}`;
  }

  const meridiemMatch = trimmed.match(/^(\d{1,2}):([0-5]\d)\s*([AaPp][Mm])$/);
  if (!meridiemMatch) {
    return null;
  }

  const hour12 = Number(meridiemMatch[1]);
  const minute = Number(meridiemMatch[2]);
  const period = meridiemMatch[3].toUpperCase();
  if (!Number.isInteger(hour12) || hour12 < 1 || hour12 > 12 || !Number.isInteger(minute)) {
    return null;
  }

  const hour24 = period === "PM"
    ? (hour12 % 12) + 12
    : hour12 % 12;
  return `${padTwoDigits(hour24)}:${padTwoDigits(minute)}`;
}

function addDaysToIsoDate(date: string, days: number): string | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || !Number.isInteger(days)) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${padTwoDigits(shifted.getUTCMonth() + 1)}-${padTwoDigits(shifted.getUTCDate())}`;
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
    return "Could not publish post.";
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
    default:
      return normalizedRaw || "Could not publish post.";
  }
}

export default function SchedulePage() {
  const { user } = useAuth();
  const timezone = resolveTimezonePreference(user?.timezone ?? FALLBACK_TIMEZONE);
  const timezoneLabel = formatTimezoneLabel(timezone);
  const clockFormatPreference = resolveClockFormatPreference(user?.clock_format ?? FALLBACK_CLOCK_FORMAT);
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
  const [spoilerAllText, setSpoilerAllText] = useState(false);
  const [spoilerPhrasesInput, setSpoilerPhrasesInput] = useState("");
  const [hermesCount, setHermesCount] = useState(0);
  const [hermesTopic, setHermesTopic] = useState("");
  const [useHermesBatchPreset, setUseHermesBatchPreset] = useState(false);
  const [hermesBatchPresets, setHermesBatchPresets] = useState<BatchSchedulePreset[]>([]);
  const [selectedHermesPresetId, setSelectedHermesPresetId] = useState("");
  const [loadingHermesPresets, setLoadingHermesPresets] = useState(false);
  const [hermesPosts, setHermesPosts] = useState<string[]>([]);
  const [isGeneratingHermesPosts, setIsGeneratingHermesPosts] = useState(false);
  const [hermesMessage, setHermesMessage] = useState("");
  const [batchImportText, setBatchImportText] = useState("");
  const [batchImportTimes, setBatchImportTimes] = useState<string[]>([]);
  const [batchImportSignal, setBatchImportSignal] = useState(0);
  const [batchOpenSignal, setBatchOpenSignal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());

  const { currentDate: minScheduleDate, currentTime: minScheduleTime } = getCurrentDateTimeForTimezone(
    timezone,
    new Date(currentTimestamp),
  );
  const { currentDate: defaultScheduleDate, currentTime: defaultScheduleTime } = getCurrentDateTimeForTimezone(
    timezone,
    new Date(currentTimestamp + 60_000),
  );
  const isSchedulingForToday = scheduleDate === minScheduleDate;
  const hasPastTimeSelection = isSchedulingForToday && Boolean(scheduleTime) && scheduleTime < minScheduleTime;

  const quickTimeOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (let hour = 0; hour < 24; hour += 1) {
      const minute = 0;
      const value = `${padTwoDigits(hour)}:${padTwoDigits(minute)}`;
      options.push({
        value,
        label: formatPickerTime(value, clockFormatPreference),
      });
    }

    return options;
  }, [clockFormatPreference]);

  const selectedHermesPreset = useMemo(
    () => hermesBatchPresets.find((preset) => preset.id === selectedHermesPresetId) ?? null,
    [hermesBatchPresets, selectedHermesPresetId],
  );

  const hermesGenerationCount = useHermesBatchPreset
    ? selectedHermesPreset?.times.length ?? 0
    : Math.max(0, Math.min(50, Math.floor(Number(hermesCount) || 0)));

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadThreadsConnection() {
      setLoadingConnection(true);
      setErrorMessage("");

      try {
        const fetchConnectionPayload = async (): Promise<ThreadsMeResponse | null> => {
          const selectedThreadsUserId = readSelectedThreadsUserId();
          const accountsResponse = await fetch(
            appendThreadsUserId(appendAppUserId(THREADS_ACCOUNTS_URL, APP_USER_ID), selectedThreadsUserId),
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
            appendThreadsUserId(appendAppUserId(THREADS_ME_URL, APP_USER_ID), selectedThreadsUserId),
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
          setErrorMessage("Could not load Threads connection.");
          return;
        }
        const savedThreadsUserId = readSelectedThreadsUserId();
        const savedFromList = Array.isArray(data.accounts)
          ? data.accounts.find((account) => account?.threads_user_id?.trim() === savedThreadsUserId)?.threads_user_id?.trim()
          : "";
        const activeFromList = Array.isArray(data.accounts)
          ? data.accounts.find((account) => account?.is_active)?.threads_user_id?.trim()
          : "";
        const firstFromList = Array.isArray(data.accounts)
          ? data.accounts.find((account) => account?.threads_user_id)?.threads_user_id?.trim()
          : "";
        const resolvedThreadsUserId =
          savedFromList
          || data.active_threads_user_id?.trim()
          || activeFromList
          || firstFromList
          || data.account?.threads_user_id?.trim()
          || data.threads_user_id?.trim()
          || "";

        if (!resolvedThreadsUserId) {
          setThreadsUserId("");
          setErrorMessage("Threads account is not connected.");
          return;
        }

        setThreadsUserId(resolvedThreadsUserId);
        writeSelectedThreadsUserId(resolvedThreadsUserId);
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

    const handleSelectedAccount = () => {
      void loadThreadsConnection();
    };
    window.addEventListener(SELECTED_THREADS_ACCOUNT_EVENT, handleSelectedAccount);

    return () => {
      isMounted = false;
      controller.abort();
      window.removeEventListener(SELECTED_THREADS_ACCOUNT_EVENT, handleSelectedAccount);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadHermesBatchPresets() {
      if (!threadsUserId) {
        setHermesBatchPresets([]);
        setSelectedHermesPresetId("");
        return;
      }

      setLoadingHermesPresets(true);
      try {
        const response = await fetch(appendThreadsUserId(BATCH_PRESETS_URL, threadsUserId), {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as {
          presets?: BatchSchedulePreset[];
        } | null;
        if (!isMounted) {
          return;
        }
        const presets = Array.isArray(data?.presets) ? data.presets : [];
        setHermesBatchPresets(presets);
        setSelectedHermesPresetId((currentId) => (
          presets.some((preset) => preset.id === currentId)
            ? currentId
            : presets[0]?.id ?? ""
        ));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError") && isMounted) {
          setHermesBatchPresets([]);
          setSelectedHermesPresetId("");
        }
      } finally {
        if (isMounted) {
          setLoadingHermesPresets(false);
        }
      }
    }

    void loadHermesBatchPresets();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [threadsUserId, batchImportSignal, batchOpenSignal]);

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

  async function handlePostNow() {
    const trimmedText = postText.trim();
    const spoilerPhrases = parseSpoilerPhraseLines(spoilerPhrasesInput);
    if (!trimmedText) {
      setErrorMessage("Enter post text before publishing.");
      return;
    }
    if (!threadsUserId) {
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
          threads_user_id: threadsUserId,
          text: trimmedText,
          spoiler_all_text: spoilerAllText,
          spoiler_phrases: spoilerPhrases,
        }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string; published_post_id?: string } | null;
      if (!response.ok) {
        setErrorMessage(formatPublishErrorMessage(data?.error));
        return;
      }

      setSuccessMessage(
        data?.published_post_id
          ? `Post published successfully (${data.published_post_id}).`
          : "Post published successfully.",
      );
      setPostText("");
      setSpoilerAllText(false);
      setSpoilerPhrasesInput("");
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
    if (!threadsUserId) {
      setErrorMessage("Threads account is not connected.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setShowPostNowConfirmation(true);
  }

  async function handleSchedulePost() {
    const trimmedText = postText.trim();
    const machineTimezone = resolveTimezonePreference(timezone);
    const machineTime = normalizeTimePayload(scheduleTime);
    const spoilerPhrases = parseSpoilerPhraseLines(spoilerPhrasesInput);
    if (!trimmedText) {
      setErrorMessage("Enter post text before scheduling.");
      return;
    }
    if (!scheduleDate || !machineTime) {
      setErrorMessage("Select both date and time to schedule a post.");
      return;
    }
    if (!threadsUserId) {
      setErrorMessage("Threads account is not connected.");
      return;
    }
    if (scheduleDate < minScheduleDate) {
      setErrorMessage("Scheduling date cannot be in the past.");
      return;
    }
    if (scheduleDate === minScheduleDate && machineTime < minScheduleTime) {
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
          threads_user_id: threadsUserId,
          text: trimmedText,
          date: scheduleDate,
          time: machineTime,
          timezone: machineTimezone,
          spoiler_all_text: spoilerAllText,
          spoiler_phrases: spoilerPhrases,
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
          machineTimezone,
          clockFormatPreference,
        )
        : null;

      setSuccessMessage(
        localScheduledTime
          ? `Post scheduled for ${localScheduledTime} (${timezoneLabel}).`
          : "Post scheduled successfully.",
      );
      setPostText("");
      setSpoilerAllText(false);
      setSpoilerPhrasesInput("");
      setScheduleDate("");
      setScheduleTime("");
      setIsScheduleComposerOpen(false);
      notifyScheduledPostsUpdated();
    } catch {
      setErrorMessage("Could not schedule post.");
    } finally {
      setIsScheduling(false);
    }
  }

  function shiftScheduleDate(days: number) {
    const baseDate = scheduleDate || defaultScheduleDate;
    const shiftedDate = addDaysToIsoDate(baseDate, days);
    if (!shiftedDate) {
      return;
    }
    if (shiftedDate < minScheduleDate) {
      setScheduleDate(minScheduleDate);
      setErrorMessage("Scheduling date cannot be in the past.");
      setSuccessMessage("");
      return;
    }

    setScheduleDate(shiftedDate);
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleGenerateHermesPosts() {
    if (!threadsUserId) {
      setErrorMessage("Threads account is not connected.");
      return;
    }

    const count = hermesGenerationCount;
    if (count < 1) {
      setErrorMessage(
        useHermesBatchPreset
          ? "Choose a saved batch schedule before generating."
          : "Choose how many posts Hermes should generate.",
      );
      return;
    }

    setIsGeneratingHermesPosts(true);
    setHermesMessage("");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(HERMES_GENERATE_POSTS_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threads_user_id: threadsUserId,
          count,
          topic: hermesTopic.trim() || undefined,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        model?: string;
        posts?: string[];
        context_summary?: {
          archive_recent?: number;
          archive_top?: number;
          scheduled_posts?: number;
          saved_patterns?: number;
        };
      } | null;
      if (!response.ok || !Array.isArray(data?.posts)) {
        setHermesMessage("");
        setErrorMessage(data?.error || "Could not generate Hermes posts.");
        return;
      }

      setHermesPosts(data.posts);
      const summary = data.context_summary;
      setHermesMessage(
        `Generated ${data.posts.length} post${data.posts.length === 1 ? "" : "s"} with ${data.model || "Hermes"} using ${summary?.archive_recent ?? 0} recent archive posts, ${summary?.archive_top ?? 0} top archive posts, ${summary?.saved_patterns ?? 0} saved patterns, and ${summary?.scheduled_posts ?? 0} scheduled posts.`,
      );
    } catch {
      setErrorMessage("Could not generate Hermes posts.");
    } finally {
      setIsGeneratingHermesPosts(false);
    }
  }

  function updateHermesPost(index: number, text: string) {
    setHermesPosts((currentPosts) => currentPosts.map((post, postIndex) => (
      postIndex === index ? text : post
    )));
    setHermesMessage("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function removeHermesPost(index: number) {
    setHermesPosts((currentPosts) => currentPosts.filter((_, postIndex) => postIndex !== index));
    setHermesMessage("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function sendHermesPostsToBatch() {
    const numberedPosts = hermesPosts
      .map((post) => post.trim())
      .filter(Boolean)
      .map((post, index) => `${index + 1}. ${post}`)
      .join("\n");
    if (!numberedPosts) {
      setErrorMessage("Generate at least one Hermes post before sending to Batch Schedule.");
      return;
    }
    setBatchImportText(numberedPosts);
    setBatchImportTimes(useHermesBatchPreset && selectedHermesPreset ? selectedHermesPreset.times : []);
    setBatchImportSignal((currentSignal) => currentSignal + 1);
    setSuccessMessage("Loaded Hermes posts into Batch Schedule.");
    setErrorMessage("");
  }

  const isSubmitting = isPostingNow || isScheduling;
  const isHermesBusy = isGeneratingHermesPosts || isSubmitting;

  if (loadingConnection) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900">Create Post</h1>
        <p className="text-sm text-slate-700">Loading composer...</p>
      </div>
    );
  }

  if (!threadsUserId) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900">Create Post</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">
            The configured Threads account could not be loaded.
          </p>
          {errorMessage ? (
            <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full space-y-6 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-3xl font-semibold text-slate-900">Create Post</h1>
        <Link
          href="/scheduled-posts"
          className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
        >
          Scheduled Posts
        </Link>
      </div>

      <section className="w-full max-w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:max-w-2xl sm:p-6">
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
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">{postText.length}/500</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start gap-3">
              <input
                id="spoiler-all-text"
                type="checkbox"
                checked={spoilerAllText}
                onChange={(event) => {
                  setSpoilerAllText(event.target.checked);
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                disabled={isSubmitting}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
              />
              <div className="min-w-0">
                <label htmlFor="spoiler-all-text" className="block text-sm font-medium text-slate-900">
                  Mark the full post as a spoiler
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Threads will blur the entire text until someone taps to reveal it.
                </p>
              </div>
            </div>
            <div className="mt-3">
              <label htmlFor="spoiler-phrases" className="block text-sm font-medium text-slate-900">
                Spoiler phrases
              </label>
              <textarea
                id="spoiler-phrases"
                value={spoilerPhrasesInput}
                onChange={(event) => {
                  setSpoilerPhrasesInput(event.target.value);
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                rows={3}
                disabled={isSubmitting || spoilerAllText}
                placeholder={"One exact phrase per line\nExample ending\nWinner reveal"}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p className="mt-1 text-xs text-slate-500">
                Optional. We will hide the first matching occurrence of each phrase in the post text, up to 10 phrases.
              </p>
            </div>
          </div>

          {isScheduleComposerOpen ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="schedule-date" className="block text-sm font-medium text-slate-900">
                    Date
                  </label>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => shiftScheduleDate(-1)}
                      disabled={isSubmitting || (scheduleDate || defaultScheduleDate) <= minScheduleDate}
                      className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Previous Day
                    </button>
                    <button
                      type="button"
                      onClick={() => shiftScheduleDate(1)}
                      disabled={isSubmitting}
                      className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Next Day
                    </button>
                  </div>
                  <div className="mt-2 w-full overflow-hidden rounded-md border border-slate-300 bg-white">
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
                      className="block w-full min-w-0 appearance-none border-0 bg-transparent px-3 py-2 text-base text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <label htmlFor="schedule-time" className="block text-sm font-medium text-slate-900">
                    Time ({timezoneLabel}, {clockFormatLabel})
                  </label>
                  <div className="mt-2 w-full overflow-hidden rounded-md border border-slate-300 bg-white">
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
                      step={60}
                      className="block w-full min-w-0 appearance-none border-0 bg-transparent px-3 py-2 text-base text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="block text-sm font-medium text-slate-900">Quick Times</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {quickTimeOptions.map((option) => {
                    const isPastQuickTime = isSchedulingForToday && option.value < minScheduleTime;
                    const isSelected = scheduleTime === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setScheduleTime(option.value);
                          setErrorMessage("");
                          setSuccessMessage("");
                        }}
                        disabled={isSubmitting || isPastQuickTime}
                        className={`inline-flex min-h-10 items-center justify-center rounded-md border px-3 py-2 text-xs font-medium ${
                          isSelected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-600">
                  Scheduling preferences: timezone <span className="font-medium text-slate-800">{timezoneLabel}</span>, clock format{" "}
                  <span className="font-medium text-slate-800">{clockFormatLabel}</span>.
                </p>
                <span className="inline-flex w-full items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500 sm:w-auto">
                  Workspace timezone is managed in this private build.
                </span>
              </div>
            </>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {!isScheduleComposerOpen ? (
              <button
                type="button"
                onClick={handleRequestPostNowConfirmation}
                disabled={isSubmitting || !postText.trim()}
                className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isPostingNow ? "Posting..." : "Post Now"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (!isScheduleComposerOpen) {
                  setScheduleDate(defaultScheduleDate);
                  setScheduleTime(defaultScheduleTime);
                  setIsScheduleComposerOpen(true);
                  setErrorMessage("");
                  setSuccessMessage("");
                  return;
                }
                void handleSchedulePost();
              }}
              disabled={
                isSubmitting
                || !postText.trim()
                || (isScheduleComposerOpen && (!scheduleDate || !scheduleTime || hasPastTimeSelection))
              }
              className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isScheduling ? "Scheduling..." : "Schedule Post"}
            </button>
            {isScheduleComposerOpen ? (
              <>
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
                  className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  Cancel Schedule
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

      <section className="w-full max-w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:max-w-4xl sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Hermes Generator</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Generate post candidates from the selected account&apos;s archive, saved patterns, and current schedule.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleGenerateHermesPosts()}
            disabled={isHermesBusy || !threadsUserId || hermesGenerationCount < 1}
            className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isGeneratingHermesPosts ? "Generating..." : "Generate with Hermes"}
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
            <input
              type="checkbox"
              checked={useHermesBatchPreset}
              onChange={(event) => {
                setUseHermesBatchPreset(event.target.checked);
                setHermesMessage("");
                setErrorMessage("");
              }}
              disabled={isHermesBusy}
              className="h-4 w-4 rounded border-slate-300"
            />
            Match an existing batch schedule
          </label>

          {useHermesBatchPreset ? (
            <div className="mt-4 space-y-3">
              {loadingHermesPresets ? (
                <p className="text-sm text-slate-500">Loading saved batch schedules...</p>
              ) : hermesBatchPresets.length > 0 ? (
                <>
                  <label htmlFor="hermes-batch-preset" className="block text-sm font-medium text-slate-900">
                    Batch schedule
                  </label>
                  <select
                    id="hermes-batch-preset"
                    value={selectedHermesPresetId}
                    onChange={(event) => {
                      setSelectedHermesPresetId(event.target.value);
                      setHermesMessage("");
                      setErrorMessage("");
                    }}
                    disabled={isHermesBusy}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {hermesBatchPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} ({preset.times.length} slot{preset.times.length === 1 ? "" : "s"})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-600">
                    Hermes will generate {hermesGenerationCount} post{hermesGenerationCount === 1 ? "" : "s"} to match this batch schedule.
                  </p>
                </>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">No saved batch schedules exist for this account yet.</p>
                  <button
                    type="button"
                    onClick={() => setBatchOpenSignal((currentSignal) => currentSignal + 1)}
                    className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
                  >
                    Create Batch Schedule
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
          <div>
            <label htmlFor="hermes-count" className="block text-sm font-medium text-slate-900">
              Number of posts
            </label>
            <input
              id="hermes-count"
              type="number"
              min={0}
              max={50}
              value={useHermesBatchPreset ? hermesGenerationCount : hermesCount}
              onChange={(event) => {
                setHermesCount(Number(event.target.value));
                setHermesMessage("");
                setErrorMessage("");
              }}
              disabled={isHermesBusy || useHermesBatchPreset}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="hermes-topic" className="block text-sm font-medium text-slate-900">
              Optional prompt or direction
            </label>
            <textarea
              id="hermes-topic"
              value={hermesTopic}
              onChange={(event) => {
                setHermesTopic(event.target.value);
                setHermesMessage("");
                setErrorMessage("");
              }}
              disabled={isHermesBusy}
              rows={4}
              placeholder={"Example: Write practical posts for Vectrix about online income systems.\nAvoid hype, scams, guaranteed results, or direct financial advice.\nMake each post feel specific and non-repetitive."}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>

        {hermesMessage ? (
          <p className="mt-4 text-sm text-green-700">{hermesMessage}</p>
        ) : null}

        {hermesPosts.length > 0 ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Generated Candidates</h3>
              <button
                type="button"
                onClick={sendHermesPostsToBatch}
                disabled={isSubmitting || hermesPosts.every((post) => !post.trim())}
                className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Send All to Batch Schedule
              </button>
            </div>

            <div className="space-y-3">
              {hermesPosts.map((post, index) => (
                <div key={`hermes-post-${index + 1}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase text-slate-500">Post {index + 1}</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPostText(post);
                          setSuccessMessage("Loaded Hermes post into the composer.");
                          setErrorMessage("");
                        }}
                        disabled={isSubmitting || !post.trim()}
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Use in Composer
                      </button>
                      <button
                        type="button"
                        onClick={() => removeHermesPost(index)}
                        disabled={isSubmitting}
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={post}
                    onChange={(event) => updateHermesPost(index, event.target.value)}
                    rows={3}
                    maxLength={500}
                    disabled={isSubmitting}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <p className="mt-1 text-xs text-slate-500">{post.length}/500</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <BatchSchedulePanel
        threadsUserId={threadsUserId}
        timezone={timezone}
        timezoneLabel={timezoneLabel}
        clockFormatPreference={clockFormatPreference}
        importedPostsText={batchImportText}
        importedTimes={batchImportTimes}
        importSignal={batchImportSignal}
        openSignal={batchOpenSignal}
      />

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
