"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";
import {
  appendThreadsUserId,
  readSelectedThreadsUserId,
  SELECTED_THREADS_ACCOUNT_EVENT,
} from "@/lib/selectedThreadsAccount";

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

type OwnerLearningSummary = {
  scheduled_post_count?: number;
  untouched_model_count?: number;
  owner_edited_count?: number;
  substantial_owner_rewrite_count?: number;
  owner_notes_count?: number;
  owner_intervention_rate?: number;
  published_24h?: {
    owner_edited_sample_size?: number;
    owner_edited_median_overall?: number | null;
    untouched_model_sample_size?: number;
    untouched_model_median_overall?: number | null;
    evidence_type?: string;
  };
};

type SourceCardRevision = {
  id?: string;
  scheduled_post_id?: number;
  revision_number?: number;
  editor_type?: string;
  previous_text?: string | null;
  revised_text?: string;
  owner_note?: string | null;
  change_magnitude?: string;
  became_published?: boolean;
  published_post_id?: string | null;
  performance_24h?: { scores?: Record<string, unknown> | null; metrics?: Record<string, unknown> | null } | null;
  created_at?: string;
};

type SourceCardDetail = {
  id: string;
  title?: string;
  status?: string;
  primary_source?: {
    text?: string;
    canonical_source_url?: string;
    metrics?: {
      views?: number;
      likes?: number;
      replies?: number;
      reposts?: number;
      shares?: number;
    };
  } | null;
  generation_direction?: string;
  owner_guidance?: { text?: string; version_number?: number; updated_at?: string; active?: boolean } | null;
  owner_learning?: {
    owner_edit_notes?: SourceCardRevision[];
    revision_history?: SourceCardRevision[];
  };
};

type SavedPatternsResponse = {
  order?: "newest" | "likes";
  patterns?: SavedPatternRow[];
  total?: number;
  owner_learning_summary?: OwnerLearningSummary | null;
  error?: string;
};

const SAVED_PATTERNS_URL = buildWorkerUrl("/api/patterns/list");
const DELETE_PATTERNS_URL = buildWorkerUrl("/api/patterns/delete");
const SOURCE_CARD_URL = buildWorkerUrl("/api/patterns/source-card");
const SOURCE_CARD_GUIDANCE_URL = buildWorkerUrl("/api/patterns/source-card/guidance");
const UPDATE_PATTERN_URL = buildWorkerUrl("/api/patterns/update");
const REVIEW_PATTERN_URL = buildWorkerUrl("/api/gpt-memory/saved-patterns/review");
const APP_USER_ID = "lensically";
const DEFAULT_LIMIT = 200;

function formatMetric(value: number | null | undefined): string {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US").format(safeValue);
}

function hasCapturedEngagement(pattern: SavedPatternRow): boolean {
  return [pattern.likes, pattern.replies, pattern.reposts, pattern.shares, pattern.views]
    .some((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
}

function formatCapturedMetric(pattern: SavedPatternRow, value: number | null | undefined): string {
  if (!hasCapturedEngagement(pattern)) {
    return "Unavailable";
  }
  return formatMetric(value);
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

export default function SavedPatternsPage() {
  const [patterns, setPatterns] = useState<SavedPatternRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [order, setOrder] = useState<"newest" | "likes">("newest");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEditId, setSavingEditId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [total, setTotal] = useState(0);
  const [threadsUserId, setThreadsUserId] = useState("");
  const [ownerLearningSummary, setOwnerLearningSummary] = useState<OwnerLearningSummary | null>(null);
  const [expandedPatternId, setExpandedPatternId] = useState<number | null>(null);
  const [loadingSourceCardId, setLoadingSourceCardId] = useState<number | null>(null);
  const [savingGuidanceId, setSavingGuidanceId] = useState<number | null>(null);
  const [sourceCards, setSourceCards] = useState<Record<number, SourceCardDetail | null>>({});
  const [guidanceDrafts, setGuidanceDrafts] = useState<Record<number, string>>({});

  const loadPatterns = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const baseUrl = `${SAVED_PATTERNS_URL}?app_user_id=${encodeURIComponent(APP_USER_ID)}&limit=${DEFAULT_LIMIT}&order=${encodeURIComponent(order)}`;
      const response = await fetch(appendThreadsUserId(baseUrl, threadsUserId), {
        cache: "no-store",
        credentials: "include",
      });

      const data = (await response.json().catch(() => null)) as SavedPatternsResponse | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not load saved patterns.");
      }

      const nextPatterns = Array.isArray(data?.patterns) ? data.patterns : [];
      setPatterns(nextPatterns);
      setSelectedIds((current) => current.filter((id) => nextPatterns.some((pattern) => pattern.id === id)));
      setTotal(typeof data?.total === "number" ? data.total : nextPatterns.length);
      setOwnerLearningSummary(data?.owner_learning_summary ?? null);
    } catch (fetchError) {
      setPatterns([]);
      setSelectedIds([]);
      setTotal(0);
      setError(fetchError instanceof Error ? fetchError.message : "Could not load saved patterns.");
    } finally {
      setLoading(false);
    }
  }, [order, threadsUserId]);

  useEffect(() => {
    setThreadsUserId(readSelectedThreadsUserId());
    const handleSelectedAccount = (event: Event) => {
      const nextThreadsUserId = (event as CustomEvent<{ threadsUserId?: string }>).detail?.threadsUserId?.trim() ?? "";
      setThreadsUserId(nextThreadsUserId);
    };
    window.addEventListener(SELECTED_THREADS_ACCOUNT_EVENT, handleSelectedAccount);
    return () => window.removeEventListener(SELECTED_THREADS_ACCOUNT_EVENT, handleSelectedAccount);
  }, []);

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
    setMessage("");

    try {
      const response = await fetch(DELETE_PATTERNS_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_user_id: APP_USER_ID,
          threads_user_id: threadsUserId,
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

  async function reviewPattern(
    pattern: SavedPatternRow,
    verdict: "approved" | "rejected" | "cooldown" | "watch",
  ) {
    const note = window.prompt("Optional note for the GPT to remember about this pattern:", "");
    if (note === null) {
      return;
    }

    setReviewingId(pattern.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(REVIEW_PATTERN_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_user_id: APP_USER_ID,
          threads_user_id: threadsUserId,
          saved_pattern_ids: [pattern.id],
          verdict,
          note,
          title: `Saved pattern review: ${verdict}`,
          metadata: {
            author_handle: pattern.author_handle ?? null,
            source_url: pattern.source_url,
            captured_likes: pattern.likes,
            captured_replies: pattern.replies,
            captured_reposts: pattern.reposts,
            captured_shares: pattern.shares,
            captured_views: pattern.views ?? null,
          },
          cooldown_days: verdict === "cooldown" ? 14 : 0,
        }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not save pattern review.");
      }

      setMessage(`Saved ${verdict} review for pattern ${pattern.id}.`);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not save pattern review.");
    } finally {
      setReviewingId(null);
    }
  }

  async function toggleSourceCard(patternId: number) {
    if (expandedPatternId === patternId) {
      setExpandedPatternId(null);
      return;
    }

    setExpandedPatternId(patternId);
    setError("");
    setMessage("");
    if (Object.prototype.hasOwnProperty.call(sourceCards, patternId)) {
      const existing = sourceCards[patternId];
      setGuidanceDrafts((current) => ({
        ...current,
        [patternId]: existing?.owner_guidance?.text ?? "",
      }));
      return;
    }

    setLoadingSourceCardId(patternId);
    try {
      const baseUrl = `${SOURCE_CARD_URL}?app_user_id=${encodeURIComponent(APP_USER_ID)}&saved_pattern_id=${patternId}`;
      const response = await fetch(appendThreadsUserId(baseUrl, threadsUserId), {
        cache: "no-store",
        credentials: "include",
      });
      const data = (await response.json().catch(() => null)) as
        | { source_card?: SourceCardDetail | null; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not load the linked source card.");
      }
      const sourceCard = data?.source_card ?? null;
      setSourceCards((current) => ({ ...current, [patternId]: sourceCard }));
      setGuidanceDrafts((current) => ({
        ...current,
        [patternId]: sourceCard?.owner_guidance?.text ?? "",
      }));
    } catch (sourceCardError) {
      setExpandedPatternId(null);
      setError(sourceCardError instanceof Error ? sourceCardError.message : "Could not load the linked source card.");
    } finally {
      setLoadingSourceCardId(null);
    }
  }

  function beginEdit(pattern: SavedPatternRow) {
    setEditingId(pattern.id);
    setEditText(pattern.post_text);
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  async function savePatternEdit(pattern: SavedPatternRow) {
    const nextText = editText.trim();
    if (!nextText) {
      setError("Saved pattern text cannot be blank.");
      return;
    }

    setSavingEditId(pattern.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(UPDATE_PATTERN_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_user_id: APP_USER_ID,
          threads_user_id: threadsUserId,
          id: pattern.id,
          post_text: nextText,
        }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string; pattern?: SavedPatternRow } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not update saved pattern.");
      }

      const updatedPattern = data?.pattern;
      setPatterns((current) => current.map((row) => (
        row.id === pattern.id && updatedPattern ? { ...row, ...updatedPattern } : row
      )));
      setEditingId(null);
      setEditText("");
      setMessage(`Updated saved pattern ${pattern.id}.`);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Could not update saved pattern.");
    } finally {
      setSavingEditId(null);
    }
  }

  async function reviewSelectedPatterns(verdict: "approved" | "rejected" | "cooldown" | "watch") {
    if (!selectedIds.length) {
      return;
    }

    const note = window.prompt("Optional note for the GPT to remember about these selected patterns:", "");
    if (note === null) {
      return;
    }

    setReviewingId(-1);
    setError("");
    setMessage("");

    try {
      const response = await fetch(REVIEW_PATTERN_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_user_id: APP_USER_ID,
          threads_user_id: threadsUserId,
          saved_pattern_ids: selectedIds,
          verdict,
          note,
          title: `Selected saved patterns review: ${verdict}`,
          metadata: {
            selected_count: selectedIds.length,
          },
          cooldown_days: verdict === "cooldown" ? 14 : 0,
        }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not save selected pattern review.");
      }

      setMessage(`Saved ${verdict} review for ${formatMetric(selectedIds.length)} selected patterns.`);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not save selected pattern review.");
    } finally {
      setReviewingId(null);
    }
  }

  async function saveSourceCardGuidance(patternId: number, active: boolean) {
    setSavingGuidanceId(patternId);
    setError("");
    setMessage("");
    try {
      const response = await fetch(SOURCE_CARD_GUIDANCE_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_user_id: APP_USER_ID,
          threads_user_id: threadsUserId,
          saved_pattern_id: patternId,
          guidance_text: guidanceDrafts[patternId] ?? "",
          active,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { source_card?: SourceCardDetail | null; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not save source-card guidance.");
      }
      const sourceCard = data?.source_card ?? null;
      setSourceCards((current) => ({ ...current, [patternId]: sourceCard }));
      setGuidanceDrafts((current) => ({
        ...current,
        [patternId]: sourceCard?.owner_guidance?.text ?? "",
      }));
      setMessage(active ? "Permanent source-card guidance saved." : "Source-card guidance disabled.");
    } catch (guidanceError) {
      setError(guidanceError instanceof Error ? guidanceError.message : "Could not save source-card guidance.");
    } finally {
      setSavingGuidanceId(null);
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700">
            {selectedIds.length ? `${formatMetric(selectedIds.length)} selected for GPT pattern memory` : "Select patterns to review them in bulk"}
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              ["approved", "Mark Useful"],
              ["watch", "Watch"],
              ["cooldown", "Cooldown"],
              ["rejected", "Reject"],
            ].map(([verdict, label]) => (
              <button
                key={verdict}
                type="button"
                onClick={() => void reviewSelectedPatterns(verdict as "approved" | "rejected" | "cooldown" | "watch")}
                disabled={loading || deleting || reviewingId === -1 || selectedIds.length === 0}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reviewingId === -1 ? "Saving..." : label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-slate-900">Owner learning</h2>
          <p className="text-xs text-slate-500">
            This separates untouched model work from the exact owner-edited versions that actually publish.
          </p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Intervention rate</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {Math.round((ownerLearningSummary?.owner_intervention_rate ?? 0) * 100)}%
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Owner-edited posts</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {formatMetric(ownerLearningSummary?.owner_edited_count ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Substantial rewrites</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {formatMetric(ownerLearningSummary?.substantial_owner_rewrite_count ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Untouched model posts</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {formatMetric(ownerLearningSummary?.untouched_model_count ?? 0)}
            </p>
          </div>
        </div>
        {(ownerLearningSummary?.published_24h?.owner_edited_sample_size ?? 0) > 0
          || (ownerLearningSummary?.published_24h?.untouched_model_sample_size ?? 0) > 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            24-hour observational comparison: owner-edited median overall {ownerLearningSummary?.published_24h?.owner_edited_median_overall ?? "pending"} across {formatMetric(ownerLearningSummary?.published_24h?.owner_edited_sample_size ?? 0)} posts; untouched model median overall {ownerLearningSummary?.published_24h?.untouched_model_median_overall ?? "pending"} across {formatMetric(ownerLearningSummary?.published_24h?.untouched_model_sample_size ?? 0)} posts.
          </p>
        ) : null}
      </section>

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

      {message ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm">
          {message}
        </section>
      ) : null}

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
              const isEditing = editingId === pattern.id;
              const isSavingEdit = savingEditId === pattern.id;

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
                          {isEditing ? (
                            <div className="mt-2 space-y-2">
                              <textarea
                                value={editText}
                                onChange={(event) => setEditText(event.target.value)}
                                rows={4}
                                className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void savePatternEdit(pattern)}
                                  disabled={isSavingEdit}
                                  className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isSavingEdit ? "Saving..." : "Save Text"}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={isSavingEdit}
                                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{pattern.post_text}</p>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => beginEdit(pattern)}
                            disabled={deleting || isSavingEdit}
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Edit Text
                          </button>
                          <button
                            type="button"
                            onClick={() => void deletePatterns([pattern.id])}
                            disabled={deleting || isSavingEdit}
                            className="rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void reviewPattern(pattern, "approved")}
                          disabled={reviewingId === pattern.id}
                          className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Mark Useful
                        </button>
                        <button
                          type="button"
                          onClick={() => void reviewPattern(pattern, "watch")}
                          disabled={reviewingId === pattern.id}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Watch
                        </button>
                        <button
                          type="button"
                          onClick={() => void reviewPattern(pattern, "cooldown")}
                          disabled={reviewingId === pattern.id}
                          className="rounded-md border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cooldown
                        </button>
                        <button
                          type="button"
                          onClick={() => void reviewPattern(pattern, "rejected")}
                          disabled={reviewingId === pattern.id}
                          className="rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reject Pattern
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleSourceCard(pattern.id)}
                          disabled={loadingSourceCardId === pattern.id}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {loadingSourceCardId === pattern.id
                            ? "Loading Source Card..."
                            : expandedPatternId === pattern.id
                              ? "Hide Source Card"
                              : "Source Card"}
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="text-slate-500">Likes</p>
                          <p className="mt-1 text-base font-semibold text-slate-900">{formatCapturedMetric(pattern, pattern.likes)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="text-slate-500">Replies</p>
                          <p className="mt-1 text-base font-semibold text-slate-900">{formatCapturedMetric(pattern, pattern.replies)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="text-slate-500">Reposts</p>
                          <p className="mt-1 text-base font-semibold text-slate-900">{formatCapturedMetric(pattern, pattern.reposts)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="text-slate-500">Shares</p>
                          <p className="mt-1 text-base font-semibold text-slate-900">{formatCapturedMetric(pattern, pattern.shares)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="text-slate-500">Views</p>
                          <p className="mt-1 text-base font-semibold text-slate-900">{formatCapturedMetric(pattern, pattern.views)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="text-slate-500">Captured</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-slate-900">{formatDateTime(pattern.updated_at)}</p>
                        </div>
                                            </div>

                      {expandedPatternId === pattern.id ? (
                        <div className="rounded-xl border border-slate-300 bg-white p-4">
                          {loadingSourceCardId === pattern.id ? (
                            <p className="text-sm text-slate-600">Loading linked source card...</p>
                          ) : sourceCards[pattern.id] ? (
                            <div className="space-y-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-sm font-semibold text-slate-900">
                                    {sourceCards[pattern.id]?.title || "Linked Source Card"}
                                  </h3>
                                  {sourceCards[pattern.id]?.status ? (
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                      {sourceCards[pattern.id]?.status}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-sm text-slate-700">
                                  {sourceCards[pattern.id]?.generation_direction}
                                </p>
                              </div>

                                                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                  <p className="text-xs font-medium text-slate-500">Original source</p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                                    {sourceCards[pattern.id]?.primary_source?.text || pattern.post_text}
                                  </p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                  <p className="text-xs font-medium text-slate-500">Source performance</p>
                                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                                    <span>Likes: {formatMetric(sourceCards[pattern.id]?.primary_source?.metrics?.likes ?? pattern.likes)}</span>
                                    <span>Views: {formatMetric(sourceCards[pattern.id]?.primary_source?.metrics?.views ?? pattern.views ?? 0)}</span>
                                    <span>Replies: {formatMetric(sourceCards[pattern.id]?.primary_source?.metrics?.replies ?? pattern.replies)}</span>
                                    <span>Reposts: {formatMetric(sourceCards[pattern.id]?.primary_source?.metrics?.reposts ?? pattern.reposts)}</span>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <label className="block text-sm font-semibold text-slate-900" htmlFor={`source-card-guidance-${pattern.id}`}>
                                  Permanent owner guidance
                                </label>
                                <p className="mt-1 text-xs text-slate-500">
                                  Tell Lensically what is repeatable, what needs to change, what it misunderstood, and how to use this source next time. Your full wording stays attached to this source card.
                                </p>
                                <textarea
                                  id={`source-card-guidance-${pattern.id}`}
                                  value={guidanceDrafts[pattern.id] ?? ""}
                                  onChange={(event) => setGuidanceDrafts((current) => ({
                                    ...current,
                                    [pattern.id]: event.target.value,
                                  }))}
                                  rows={9}
                                  maxLength={20000}
                                  placeholder="Write the full guidance you want Lensically to use whenever this source card is selected."
                                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                />
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void saveSourceCardGuidance(pattern.id, true)}
                                    disabled={savingGuidanceId === pattern.id || !(guidanceDrafts[pattern.id] ?? "").trim()}
                                    className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {savingGuidanceId === pattern.id ? "Saving..." : "Save Guidance"}
                                  </button>
                                  {sourceCards[pattern.id]?.owner_guidance?.active ? (
                                    <button
                                      type="button"
                                      onClick={() => void saveSourceCardGuidance(pattern.id, false)}
                                      disabled={savingGuidanceId === pattern.id}
                                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Disable Guidance
                                    </button>
                                  ) : null}
                                </div>
                              </div>

                              {(sourceCards[pattern.id]?.owner_learning?.owner_edit_notes?.length ?? 0) > 0 ? (
                                <div>
                                  <h4 className="text-sm font-semibold text-slate-900">Previous owner corrections</h4>
                                  <div className="mt-2 space-y-3">
                                    {sourceCards[pattern.id]?.owner_learning?.owner_edit_notes?.slice(0, 6).map((revision) => (
                                      <div key={revision.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                        <p className="whitespace-pre-wrap text-sm font-medium text-slate-900">{revision.owner_note}</p>
                                        {revision.previous_text ? (
                                          <div className="mt-3">
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Model version</p>
                                            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{revision.previous_text}</p>
                                          </div>
                                        ) : null}
                                        {revision.revised_text ? (
                                          <div className="mt-3">
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Owner version</p>
                                            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{revision.revised_text}</p>
                                          </div>
                                        ) : null}
                                        <p className="mt-3 text-xs text-slate-500">
                                          {revision.became_published
                                            ? revision.performance_24h
                                              ? "This exact owner-edited revision published and has a recorded 24-hour result."
                                              : "This exact owner-edited revision published; its 24-hour result is still pending."
                                            : "This correction is preserved as source-card learning evidence."}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                              <p className="text-sm font-medium text-slate-900">No linked source card yet</p>
                              <p className="mt-1 text-xs text-slate-600">
                                This Saved Pattern will show its source card here after Lensically creates or links one.
                              </p>
                            </div>
                          )}
                        </div>
                      ) : null}

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
