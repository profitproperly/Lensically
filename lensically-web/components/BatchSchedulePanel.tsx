"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";
import { notifyScheduledPostsUpdated } from "@/lib/scheduledPostsRefresh";
import { appendThreadsUserId } from "@/lib/selectedThreadsAccount";
import {
  formatPickerTime,
  getLocalDateTimeParts,
  getTomorrowDateForTimezone,
  normalizeTimeValue,
  parseNumberedBatchPosts,
} from "@/lib/batchSchedule";

type BatchSchedulePreset = {
  id: string;
  threads_user_id?: string;
  name: string;
  times: string[];
  is_favorite: boolean;
};

type ScheduledPost = {
  id: number;
  text: string;
  status: "approved" | "posting" | "posted";
  scheduled_time_utc: string;
};

type BatchSchedulePanelProps = {
  threadsUserId: string;
  timezone: string;
  timezoneLabel: string;
  clockFormatPreference: "12h" | "24h";
  importedPostsText?: string;
  importedTimes?: string[];
  importSignal?: number;
  openSignal?: number;
};

type BatchPreviewRow = {
  index: number;
  date: string;
  time: string;
  text: string;
  warning: string;
};

const BATCH_PRESETS_URL = buildWorkerUrl("/api/batch-schedule/presets");
const THREADS_SCHEDULE_BATCH_URL = buildWorkerUrl("/api/threads/schedule/batch");
const THREADS_SCHEDULE_URL = buildWorkerUrl("/api/threads/schedule");
const MAX_BATCH_SLOTS = 50;

function buildDuplicateKey(date: string, time: string, text: string): string {
  return `${date}|${time}|${text.trim()}`;
}

export default function BatchSchedulePanel({
  threadsUserId,
  timezone,
  timezoneLabel,
  clockFormatPreference,
  importedPostsText = "",
  importedTimes = [],
  importSignal = 0,
  openSignal = 0,
}: BatchSchedulePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [presets, setPresets] = useState<BatchSchedulePreset[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [draftTimes, setDraftTimes] = useState<string[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [rawPosts, setRawPosts] = useState("");
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [loadingScheduledPosts, setLoadingScheduledPosts] = useState(false);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [favoritingPresetId, setFavoritingPresetId] = useState<string | null>(null);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function buildHourlySlots(count: number): string[] {
    const base = new Date();
    base.setMinutes(0, 0, 0);
    base.setHours(base.getHours() + 1);
    return Array.from({ length: Math.min(count, MAX_BATCH_SLOTS) }, (_, index) => {
      const slot = new Date(base.getTime() + index * 60 * 60 * 1000);
      return `${slot.getHours().toString().padStart(2, "0")}:00`;
    });
  }

  useEffect(() => {
    if (!isOpen || scheduleDate) {
      return;
    }
    setScheduleDate(getTomorrowDateForTimezone(timezone));
  }, [isOpen, scheduleDate, timezone]);

  useEffect(() => {
    if (!importSignal || !importedPostsText.trim()) {
      return;
    }
    const importedPosts = parseNumberedBatchPosts(importedPostsText);
    const normalizedImportedTimes = importedTimes
      .map((time) => normalizeTimeValue(time))
      .filter((time): time is string => Boolean(time));
    setIsOpen(true);
    setRawPosts(importedPostsText);
    setDraftTimes(
      normalizedImportedTimes.length === importedPosts.length
        ? normalizedImportedTimes
        : buildHourlySlots(importedPosts.length),
    );
    setSelectedPresetId(null);
    setPresetName("");
    setSaveAsFavorite(false);
    setScheduleDate((currentDate) => currentDate || getTomorrowDateForTimezone(timezone));
    setErrorMessage("");
    setSuccessMessage(`Loaded ${importedPosts.length} Hermes post${importedPosts.length === 1 ? "" : "s"} into Batch Schedule.`);
  }, [importSignal, importedPostsText, importedTimes, timezone]);

  useEffect(() => {
    if (!openSignal) {
      return;
    }
    setIsOpen(true);
  }, [openSignal]);

  const normalizedTimes = useMemo(
    () => draftTimes.map((entry) => normalizeTimeValue(entry)),
    [draftTimes],
  );
  const parsedPosts = useMemo(() => parseNumberedBatchPosts(rawPosts), [rawPosts]);
  const hasAnyStructure = draftTimes.length > 0;
  const isStructureReady = normalizedTimes.length > 0 && normalizedTimes.every((entry) => Boolean(entry));
  const hasEmptyPost = parsedPosts.some((post) => post.isEmpty);
  const hasCountMismatch = rawPosts.trim().length > 0 && parsedPosts.length !== normalizedTimes.length;

  const duplicateKeys = useMemo(() => {
    const nextKeys = new Set<string>();
    for (const post of scheduledPosts) {
      const localParts = getLocalDateTimeParts(post.scheduled_time_utc, timezone);
      if (!localParts) {
        continue;
      }
      nextKeys.add(buildDuplicateKey(localParts.date, localParts.time, post.text));
    }
    return nextKeys;
  }, [scheduledPosts, timezone]);

  const previewRows = useMemo<BatchPreviewRow[]>(() => {
    const rowCount = Math.max(normalizedTimes.length, parsedPosts.length);
    return Array.from({ length: rowCount }, (_, index) => {
      const time = normalizedTimes[index] ?? "";
      const post = parsedPosts[index];
      const text = post?.text ?? "";
      let warning = "";

      if (!time) {
        warning = "Missing time slot.";
      } else if (!post) {
        warning = "Missing post for this slot.";
      } else if (post.isEmpty) {
        warning = "Parsed post is empty.";
      } else if (scheduleDate && duplicateKeys.has(buildDuplicateKey(scheduleDate, time, text))) {
        warning = "Exact duplicate already scheduled; scheduling will reuse it.";
      }

      return {
        index: index + 1,
        date: scheduleDate,
        time,
        text,
        warning,
      };
    });
  }, [duplicateKeys, normalizedTimes, parsedPosts, scheduleDate]);

  const canSavePreset = Boolean(
    threadsUserId
    && isStructureReady
    && presetName.trim()
    && !isSavingPreset,
  );
  const canScheduleAll = Boolean(
    threadsUserId
    && isStructureReady
    && scheduleDate
    && parsedPosts.length > 0
    && !hasCountMismatch
    && !hasEmptyPost
    && !isSubmittingBatch,
  );

  const loadPresets = useCallback(async () => {
    if (!threadsUserId) {
      setPresets([]);
      return;
    }

    setLoadingPresets(true);
    try {
      const response = await fetch(appendThreadsUserId(BATCH_PRESETS_URL, threadsUserId), {
        cache: "no-store",
        credentials: "include",
      });
      const data = (await response.json().catch(() => null)) as {
        presets?: BatchSchedulePreset[];
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not load batch presets.");
      }
      setPresets(Array.isArray(data?.presets) ? data.presets : []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load batch presets.");
    } finally {
      setLoadingPresets(false);
    }
  }, [threadsUserId]);

  const loadScheduledPosts = useCallback(async () => {
    if (!threadsUserId) {
      setScheduledPosts([]);
      return;
    }

    setLoadingScheduledPosts(true);
    try {
      const response = await fetch(appendThreadsUserId(THREADS_SCHEDULE_URL, threadsUserId), {
        cache: "no-store",
        credentials: "include",
      });
      const data = (await response.json().catch(() => null)) as {
        scheduled_posts?: ScheduledPost[];
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not load scheduled posts.");
      }
      setScheduledPosts(Array.isArray(data?.scheduled_posts) ? data.scheduled_posts : []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load scheduled posts.");
    } finally {
      setLoadingScheduledPosts(false);
    }
  }, [threadsUserId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void loadPresets();
    void loadScheduledPosts();
  }, [isOpen, loadPresets, loadScheduledPosts]);

  useEffect(() => {
    setPresets([]);
    setScheduledPosts([]);
    setSelectedPresetId(null);
    setSaveAsFavorite(false);
    setErrorMessage("");
    setSuccessMessage("");
  }, [threadsUserId]);

  function updateSlotCount(nextCount: number) {
    const clampedCount = Math.max(0, Math.min(MAX_BATCH_SLOTS, nextCount));
    setSelectedPresetId(null);
    setDraftTimes((current) => {
      if (clampedCount === 0) {
        return [];
      }
      const nextTimes = [...current];
      if (clampedCount > nextTimes.length) {
        while (nextTimes.length < clampedCount) {
          nextTimes.push("");
        }
      } else {
        nextTimes.length = clampedCount;
      }
      return nextTimes;
    });
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleUsePreset(preset: BatchSchedulePreset) {
    setSelectedPresetId(preset.id);
    setDraftTimes([...preset.times]);
    setPresetName(preset.name);
    setSaveAsFavorite(preset.is_favorite);
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleSavePreset() {
    if (!canSavePreset) {
      return;
    }

    setIsSavingPreset(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await fetch(BATCH_PRESETS_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threads_user_id: threadsUserId,
          name: presetName.trim(),
          times: normalizedTimes,
          is_favorite: saveAsFavorite,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        preset?: BatchSchedulePreset;
      } | null;
      if (!response.ok || !data?.preset) {
        throw new Error(data?.error || "Could not save batch preset.");
      }
      await loadPresets();
      setSelectedPresetId(data.preset.id);
      setSuccessMessage(
        data.preset.is_favorite
          ? `Saved "${data.preset.name}" and marked it as favorite.`
          : `Saved "${data.preset.name}".`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save batch preset.");
    } finally {
      setIsSavingPreset(false);
    }
  }

  async function handleFavoritePreset(presetId: string) {
    if (!threadsUserId) {
      setErrorMessage("Threads account is not connected.");
      return;
    }

    setFavoritingPresetId(presetId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await fetch(appendThreadsUserId(`${BATCH_PRESETS_URL}/${presetId}/favorite`, threadsUserId), {
        method: "POST",
        credentials: "include",
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        preset?: BatchSchedulePreset;
      } | null;
      if (!response.ok || !data?.preset) {
        throw new Error(data?.error || "Could not favorite this preset.");
      }
      await loadPresets();
      setSelectedPresetId(data.preset.id);
      setSaveAsFavorite(true);
      setSuccessMessage(`Favorited "${data.preset.name}".`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not favorite this preset.");
    } finally {
      setFavoritingPresetId(null);
    }
  }

  async function handleDeletePreset(presetId: string) {
    if (!threadsUserId) {
      setErrorMessage("Threads account is not connected.");
      return;
    }

    if (!window.confirm("Delete this saved batch preset?")) {
      return;
    }

    setDeletingPresetId(presetId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await fetch(appendThreadsUserId(`${BATCH_PRESETS_URL}/${presetId}`, threadsUserId), {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not delete this preset.");
      }
      if (selectedPresetId === presetId) {
        setSelectedPresetId(null);
      }
      await loadPresets();
      setSuccessMessage("Deleted saved batch preset.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not delete this preset.");
    } finally {
      setDeletingPresetId(null);
    }
  }

  async function handleScheduleAll() {
    if (!canScheduleAll) {
      return;
    }

    setIsSubmittingBatch(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await fetch(THREADS_SCHEDULE_BATCH_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threads_user_id: threadsUserId,
          timezone,
          date: scheduleDate,
          entries: parsedPosts.map((post, index) => ({
            text: post.text,
            time: normalizedTimes[index],
          })),
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        results?: Array<{ success?: boolean; reused?: boolean; error?: string | null }>;
      } | null;
      if (!response.ok || !Array.isArray(data?.results)) {
        throw new Error(data?.error || "Could not schedule batch posts.");
      }

      const successCount = data.results.filter((entry) => entry.success).length;
      const reusedCount = data.results.filter((entry) => entry.reused).length;
      const failureCount = data.results.length - successCount;

      if (failureCount > 0) {
        setErrorMessage(`Scheduled ${successCount} posts, but ${failureCount} row${failureCount === 1 ? "" : "s"} failed.`);
      } else {
        const reuseSuffix = reusedCount > 0
          ? ` ${reusedCount} exact duplicate${reusedCount === 1 ? " was" : "s were"} reused.`
          : "";
        setSuccessMessage(`Scheduled ${successCount} post${successCount === 1 ? "" : "s"}.${reuseSuffix}`);
      }

      setRawPosts("");
      notifyScheduledPostsUpdated();
      await loadScheduledPosts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not schedule batch posts.");
    } finally {
      setIsSubmittingBatch(false);
    }
  }

  return (
    <section className="w-full max-w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:max-w-4xl sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Batch Schedule</h2>
          <p className="mt-1 text-sm text-slate-600">
            Build a manual batch, paste numbered posts, preview every slot, and schedule them for later.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsOpen((current) => !current);
            setErrorMessage("");
            setSuccessMessage("");
          }}
          className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
        >
          {isOpen ? "Hide Batch Schedule" : "Open Batch Schedule"}
        </button>
      </div>

      {isOpen ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">1. Build Your Batch Structure</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Start blank, create one-off slots, or reuse a saved preset. Favorites stay at the top, but nothing is auto-selected.
                </p>
              </div>

              <div className="space-y-3">
                <label htmlFor="batch-slot-count" className="block text-sm font-medium text-slate-900">
                  Number of slots
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="batch-slot-count"
                    type="number"
                    min={0}
                    max={MAX_BATCH_SLOTS}
                    value={draftTimes.length}
                    onChange={(event) => updateSlotCount(Number(event.target.value))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 sm:max-w-32"
                  />
                  <button
                    type="button"
                    onClick={() => updateSlotCount(draftTimes.length + 1)}
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Add Slot
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSlotCount(Math.max(0, draftTimes.length - 1))}
                    disabled={draftTimes.length === 0}
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remove Slot
                  </button>
                </div>
              </div>

              {hasAnyStructure ? (
                <div className="space-y-3">
                  {draftTimes.map((value, index) => (
                    <div key={`batch-slot-${index + 1}`} className="flex items-center gap-3">
                      <div className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Slot {index + 1}
                      </div>
                      <input
                        type="time"
                        value={value}
                        step={60}
                        onChange={(event) => {
                          setSelectedPresetId(null);
                          setDraftTimes((current) => current.map((entry, entryIndex) => (
                            entryIndex === index ? event.target.value : entry
                          )));
                          setErrorMessage("");
                          setSuccessMessage("");
                        }}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      />
                      <div className="hidden min-w-24 text-right text-xs text-slate-500 sm:block">
                        {normalizeTimeValue(value) ? formatPickerTime(normalizeTimeValue(value), clockFormatPreference) : "Choose time"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">
                  Add the number of slots you want, then choose a time for each slot.
                </p>
              )}

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3">
                  <label htmlFor="batch-preset-name" className="text-sm font-medium text-slate-900">
                    Save this setup (optional)
                  </label>
                  <input
                    id="batch-preset-name"
                    type="text"
                    maxLength={80}
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                    placeholder="Preset name, for example Daily 17"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={saveAsFavorite}
                      onChange={(event) => setSaveAsFavorite(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Save as favorite
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleSavePreset()}
                    disabled={!canSavePreset}
                    className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingPreset ? "Saving..." : "Save Batch Preset"}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Saved Batches</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Reuse a saved batch or favorite one to keep it at the top of the list.
                  </p>
                </div>
                {loadingPresets ? (
                  <span className="text-xs text-slate-500">Loading...</span>
                ) : null}
              </div>

              {presets.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">
                  No saved batches yet. You can use this flow one time without saving, or save a setup after you build it.
                </p>
              ) : (
                <div className="space-y-3">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className={`rounded-lg border px-4 py-3 ${
                        selectedPresetId === preset.id
                          ? "border-slate-900 bg-white"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-semibold text-slate-900">{preset.name}</h4>
                              {preset.is_favorite ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                  Favorite
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {preset.times.length} slot{preset.times.length === 1 ? "" : "s"}: {preset.times.map((time) => (
                                formatPickerTime(time, clockFormatPreference)
                              )).join(", ")}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleUsePreset(preset)}
                            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                          >
                            Use This Batch
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleFavoritePreset(preset.id)}
                            disabled={preset.is_favorite || favoritingPresetId === preset.id}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {favoritingPresetId === preset.id ? "Saving..." : preset.is_favorite ? "Favorited" : "Favorite"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeletePreset(preset.id)}
                            disabled={deletingPresetId === preset.id}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingPresetId === preset.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {isStructureReady ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">2. Pick Date And Paste Posts</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Date defaults to tomorrow. Then paste your numbered list exactly as you got it from ChatGPT.
                  </p>
                </div>

                <div>
                  <label htmlFor="batch-schedule-date" className="block text-sm font-medium text-slate-900">
                    Date
                  </label>
                  <input
                    id="batch-schedule-date"
                    type="date"
                    value={scheduleDate}
                    onChange={(event) => setScheduleDate(event.target.value)}
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Times are scheduled in {timezoneLabel}.
                  </p>
                </div>

                <div>
                  <label htmlFor="batch-posts-textarea" className="block text-sm font-medium text-slate-900">
                    Numbered posts
                  </label>
                  <textarea
                    id="batch-posts-textarea"
                    value={rawPosts}
                    onChange={(event) => {
                      setRawPosts(event.target.value);
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    rows={12}
                    placeholder={"1. First post\n2. Second post\n\n3) Third post"}
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">3. Preview And Schedule</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Review every mapped row before scheduling. Exact duplicates are warned and safely reused.
                    </p>
                  </div>
                  {loadingScheduledPosts ? (
                    <span className="text-xs text-slate-500">Checking scheduled posts...</span>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {rawPosts.trim().length > 0 && hasCountMismatch ? (
                    <p className="text-sm text-amber-700">
                      Post count does not match slot count. You have {parsedPosts.length} parsed post{parsedPosts.length === 1 ? "" : "s"} and {normalizedTimes.length} time slot{normalizedTimes.length === 1 ? "" : "s"}.
                    </p>
                  ) : null}
                  {hasEmptyPost ? (
                    <p className="text-sm text-amber-700">
                      One or more parsed posts are empty. Fill or remove the empty numbered entry before scheduling.
                    </p>
                  ) : null}
                  {!rawPosts.trim().length ? (
                    <p className="text-sm text-slate-500">
                      Paste your numbered posts to generate the preview.
                    </p>
                  ) : null}
                </div>

                {previewRows.length > 0 ? (
                  <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    <div className="divide-y divide-slate-200">
                      {previewRows.map((row) => (
                        <div key={`preview-row-${row.index}`} className="space-y-2 px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                              Post {row.index}
                            </span>
                            <span className="text-xs text-slate-500">
                              {row.date || "No date"} {row.time ? `at ${formatPickerTime(row.time, clockFormatPreference)}` : ""}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-slate-800">
                            {row.text || "No post text mapped yet."}
                          </p>
                          <p className={`text-xs ${row.warning ? "text-amber-700" : "text-emerald-700"}`}>
                            {row.warning || "Ready to schedule."}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleScheduleAll()}
                  disabled={!canScheduleAll}
                  className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingBatch ? "Scheduling..." : "Schedule All"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              Finish your batch structure first by choosing a time for each slot. After that, the date picker, paste box, and preview will unlock.
            </div>
          )}

          {errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : null}
          {successMessage ? (
            <p className="text-sm text-green-700">{successMessage}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
