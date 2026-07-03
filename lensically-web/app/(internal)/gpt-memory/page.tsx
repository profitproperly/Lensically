"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";
import {
  appendThreadsUserId,
  readSelectedThreadsUserId,
  SELECTED_THREADS_ACCOUNT_EVENT,
} from "@/lib/selectedThreadsAccount";

type StrategyMemory = {
  id: number;
  kind: string;
  title: string | null;
  body: string;
  metadata?: unknown;
  updated_at: string;
};

type GenerationDraft = {
  id: string;
  text: string;
  status: string;
  rejection_reason: string | null;
};

type GenerationRun = {
  id: string;
  objective: string | null;
  status: string;
  updated_at: string;
  drafts: GenerationDraft[];
};

type RuleSuggestion = {
  suggestion_type: string;
  title: string;
  proposed_rule: string;
  evidence_level: string;
  recommended_action: string;
  caution: string;
};

type GptMemoryDashboard = {
  success?: boolean;
  brand_key?: string;
  account?: {
    label?: string | null;
    username?: string | null;
    threads_user_id?: string | null;
  };
  memory_summary?: {
    total_count?: number;
    returned_count?: number;
    counts_by_kind?: Record<string, number>;
    has_more?: boolean;
  };
  memory_by_kind?: Record<string, StrategyMemory[]>;
  generation_runs?: GenerationRun[];
  growth_review?: {
    growth_summary?: Record<string, number | string | null>;
    recommendation_prompts?: string[];
  };
  rule_suggestions?: {
    rule_suggestions?: RuleSuggestion[];
  };
  novelty_fatigue?: {
    novelty_recommendation?: string;
    fatigue_signals?: string[];
    high_use_tags?: Array<Record<string, string | number>>;
  };
  error?: string;
};

type GenerationBrief = {
  success?: boolean;
  context_readiness?: {
    memory_count?: number;
    saved_patterns_count?: number;
    approved_drafts_count?: number;
    rejected_drafts_count?: number;
    should_ask_taste_question?: boolean;
    ask_taste_question_reasons?: string[];
  };
  candidate_pool?: {
    requested_batch_size?: number;
    minimum_internal_candidates?: number;
    show_after_self_rejection?: number;
    flexible_direction_prompts?: string[];
  };
  scoring_rubric?: {
    self_reject_when?: string[];
  };
  error?: string;
};

const DASHBOARD_URL = buildWorkerUrl("/api/gpt-memory/dashboard");
const RULE_REVIEW_URL = buildWorkerUrl("/api/gpt-memory/rule-review");
const DRAFT_UPDATE_URL = buildWorkerUrl("/api/gpt-memory/generation-drafts/update");
const EXPERIMENT_URL = buildWorkerUrl("/api/gpt-memory/experiment");
const TASTE_FEEDBACK_URL = buildWorkerUrl("/api/gpt-memory/taste-feedback");
const GENERATION_BRIEF_URL = buildWorkerUrl("/api/gpt-memory/generation-brief");
const STRATEGY_MEMORY_URL = buildWorkerUrl("/api/gpt-memory/strategy-memory");

const MEMORY_SECTIONS: Array<{ kind: string; label: string }> = [
  { kind: "current_belief", label: "Current Beliefs" },
  { kind: "approved_rule", label: "Approved Rules" },
  { kind: "rule_proposal", label: "Rule Proposals" },
  { kind: "cooldown", label: "Cooldowns" },
  { kind: "taste_profile", label: "Taste Notes" },
  { kind: "approval_feedback", label: "Approval Feedback" },
  { kind: "rejection_feedback", label: "Rejection Feedback" },
  { kind: "approved_pattern", label: "Approved Patterns" },
  { kind: "rejected_pattern", label: "Rejected Patterns" },
  { kind: "experiment", label: "Experiments" },
  { kind: "experiment_result", label: "Experiment Results" },
  { kind: "saved_pattern_note", label: "Pattern Adaptations" },
];

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(Number.isFinite(value ?? NaN) ? Number(value) : 0);
}

function formatDate(value: string | null | undefined) {
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

function metricValue(summary: Record<string, number | string | null> | undefined, key: string) {
  const value = summary?.[key];
  return typeof value === "number" ? formatNumber(value) : value ?? "0";
}

function memoryPreview(memory: StrategyMemory) {
  return memory.body.length > 260 ? `${memory.body.slice(0, 260)}...` : memory.body;
}

export default function GptMemoryPage() {
  const [threadsUserId, setThreadsUserId] = useState("");
  const [dashboard, setDashboard] = useState<GptMemoryDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [tasteType, setTasteType] = useState("taste_profile");
  const [tasteLesson, setTasteLesson] = useState("");
  const [briefObjective, setBriefObjective] = useState("");
  const [briefBatchSize, setBriefBatchSize] = useState(8);
  const [generationBrief, setGenerationBrief] = useState<GenerationBrief | null>(null);

  const loadDashboard = useCallback(async (selectedThreadsUserId = threadsUserId) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(appendThreadsUserId(DASHBOARD_URL, selectedThreadsUserId), {
        cache: "no-store",
        credentials: "include",
      });
      const data = (await response.json().catch(() => null)) as GptMemoryDashboard | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not load GPT memory dashboard.");
      }
      setDashboard(data);
    } catch (loadError) {
      setDashboard(null);
      setError(loadError instanceof Error ? loadError.message : "Could not load GPT memory dashboard.");
    } finally {
      setLoading(false);
    }
  }, [threadsUserId]);

  useEffect(() => {
    const initialThreadsUserId = readSelectedThreadsUserId();
    setThreadsUserId(initialThreadsUserId);
    void loadDashboard(initialThreadsUserId);

    const handleSelectedAccount = (event: Event) => {
      const nextThreadsUserId = (event as CustomEvent<{ threadsUserId?: string }>).detail?.threadsUserId?.trim() ?? "";
      setThreadsUserId(nextThreadsUserId);
      void loadDashboard(nextThreadsUserId);
    };
    window.addEventListener(SELECTED_THREADS_ACCOUNT_EVENT, handleSelectedAccount);
    return () => window.removeEventListener(SELECTED_THREADS_ACCOUNT_EVENT, handleSelectedAccount);
  }, [loadDashboard]);

  const visibleSections = useMemo(() => (
    MEMORY_SECTIONS.map((section) => ({
      ...section,
      items: dashboard?.memory_by_kind?.[section.kind] ?? [],
    })).filter((section) => section.items.length > 0)
  ), [dashboard?.memory_by_kind]);

  async function saveRuleReview(memory: StrategyMemory, decision: string) {
    setSaving(`${memory.id}-${decision}`);
    setError("");
    try {
      const response = await fetch(RULE_REVIEW_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threads_user_id: threadsUserId,
          memory_id: memory.id,
          title: memory.title || `${memory.kind} review`,
          decision,
          reason: `Reviewed from Lensically GPT Memory dashboard. Decision: ${decision}.`,
          review_after_days: decision === "cooldown" || decision === "retest" ? 14 : 30,
          metadata: {
            dashboard_kind: memory.kind,
            dashboard_memory_updated_at: memory.updated_at,
          },
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not save rule review.");
      }
      await loadDashboard();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save rule review.");
    } finally {
      setSaving(null);
    }
  }

  async function updateDraft(draft: GenerationDraft, status: string) {
    const feedbackNote = window.prompt("Optional feedback for the GPT to remember about this draft:", "");
    if (feedbackNote === null) {
      return;
    }

    setSaving(`${draft.id}-${status}`);
    setError("");
    try {
      const response = await fetch(DRAFT_UPDATE_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threads_user_id: threadsUserId,
          draft_id: draft.id,
          status,
          rejection_reason: status === "rejected" || status === "self_rejected"
            ? feedbackNote || `Marked ${status.replace(/_/g, " ")} from Lensically GPT Memory dashboard.`
            : undefined,
          feedback_note: feedbackNote,
          metadata: {
            dashboard_previous_status: draft.status,
          },
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not update draft.");
      }
      await loadDashboard();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update draft.");
    } finally {
      setSaving(null);
    }
  }

  async function saveExperimentFromSuggestion(suggestion: RuleSuggestion) {
    const note = window.prompt("Optional test note or sample-size target:", "");
    if (note === null) {
      return;
    }

    setSaving(`suggestion-${suggestion.suggestion_type}-${suggestion.title}`);
    setError("");
    try {
      const response = await fetch(EXPERIMENT_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threads_user_id: threadsUserId,
          title: suggestion.title,
          hypothesis: suggestion.proposed_rule,
          status: "running",
          success_criteria: [
            "Compare engagement floor against recent account baseline.",
            "Watch follower movement near posts using this idea.",
            "Look for owner approval/rejection feedback before promoting to a rule.",
          ],
          sample_size_target: 5,
          review_after_days: 14,
          metadata: {
            source_suggestion_type: suggestion.suggestion_type,
            recommended_action: suggestion.recommended_action,
            evidence_level: suggestion.evidence_level,
            owner_note: note,
          },
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not save experiment.");
      }
      await loadDashboard();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save experiment.");
    } finally {
      setSaving(null);
    }
  }

  async function saveRuleProposalFromSuggestion(suggestion: RuleSuggestion) {
    const note = window.prompt("Optional note before saving this rule proposal:", "");
    if (note === null) {
      return;
    }

    setSaving(`proposal-${suggestion.suggestion_type}-${suggestion.title}`);
    setError("");
    try {
      const response = await fetch(STRATEGY_MEMORY_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threads_user_id: threadsUserId,
          kind: "rule_proposal",
          title: suggestion.title,
          body: suggestion.proposed_rule,
          metadata: {
            suggestion_type: suggestion.suggestion_type,
            recommended_action: suggestion.recommended_action,
            evidence_level: suggestion.evidence_level,
            caution: suggestion.caution,
            owner_note: note,
          },
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not save rule proposal.");
      }
      await loadDashboard();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save rule proposal.");
    } finally {
      setSaving(null);
    }
  }

  async function saveExperimentFromPrompt(prompt: string) {
    const note = window.prompt("Optional experiment note:", "");
    if (note === null) {
      return;
    }

    setSaving(`growth-prompt-${prompt}`);
    setError("");
    try {
      const response = await fetch(EXPERIMENT_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threads_user_id: threadsUserId,
          title: "Growth review experiment",
          hypothesis: prompt,
          status: "running",
          success_criteria: [
            "Compare follower movement and weak-post rate against recent baseline.",
            "Review with sample-size caution before turning into a durable rule.",
          ],
          sample_size_target: 5,
          review_after_days: 14,
          metadata: {
            source_prompt: prompt,
            owner_note: note,
          },
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not save growth experiment.");
      }
      await loadDashboard();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save growth experiment.");
    } finally {
      setSaving(null);
    }
  }

  async function saveExperimentDecision(memory: StrategyMemory, decision: string) {
    const note = window.prompt(`Optional result note for ${decision}:`, "");
    if (note === null) {
      return;
    }

    setSaving(`${memory.id}-experiment-${decision}`);
    setError("");
    try {
      const response = await fetch(EXPERIMENT_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threads_user_id: threadsUserId,
          title: memory.title || "Experiment decision",
          hypothesis: memory.body,
          status: decision === "retest" ? "retest" : "completed",
          decision,
          result_notes: note || `Marked ${decision} from Lensically GPT Memory dashboard.`,
          related_memory_id: memory.id,
          confidence: "low",
          review_after_days: decision === "retest" || decision === "explore" ? 14 : 30,
          metadata: {
            dashboard_kind: memory.kind,
            dashboard_memory_updated_at: memory.updated_at,
          },
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not save experiment decision.");
      }
      await loadDashboard();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save experiment decision.");
    } finally {
      setSaving(null);
    }
  }

  async function saveTasteFeedback() {
    const lesson = tasteLesson.trim();
    if (!lesson) {
      setError("Write a taste lesson before saving.");
      return;
    }

    setSaving("taste-feedback");
    setError("");
    try {
      const response = await fetch(TASTE_FEEDBACK_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threads_user_id: threadsUserId,
          feedback_type: tasteType,
          lesson,
          title: "Owner taste note",
          confidence: "medium",
          review_after_days: tasteType === "cooldown" ? 14 : 45,
          metadata: {
            entry_surface: "gpt_memory_dashboard",
          },
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not save taste feedback.");
      }
      setTasteLesson("");
      await loadDashboard();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save taste feedback.");
    } finally {
      setSaving(null);
    }
  }

  async function loadGenerationBrief() {
    setSaving("generation-brief");
    setError("");
    try {
      const response = await fetch(GENERATION_BRIEF_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threads_user_id: threadsUserId,
          objective: briefObjective,
          batch_size: briefBatchSize,
          create_run: false,
        }),
      });
      const data = (await response.json().catch(() => null)) as GenerationBrief | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not load generation brief.");
      }
      setGenerationBrief(data);
    } catch (saveError) {
      setGenerationBrief(null);
      setError(saveError instanceof Error ? saveError.message : "Could not load generation brief.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">GPT Memory</h1>
          <p className="mt-2 text-sm text-slate-600">
            Review brand-specific taste, rules, experiments, pattern adaptations, generation feedback, and growth signals.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          disabled={loading}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          Loading GPT memory...
        </section>
      ) : !dashboard ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          No dashboard data available.
        </section>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Brand</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{dashboard.account?.label ?? dashboard.brand_key}</p>
              <p className="text-sm text-slate-500">@{dashboard.account?.username ?? "unknown"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Memory</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{formatNumber(dashboard.memory_summary?.total_count)}</p>
              <p className="text-sm text-slate-500">{formatNumber(dashboard.memory_summary?.returned_count)} loaded</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Follower Change</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {metricValue(dashboard.growth_review?.growth_summary, "net_change_period")}
              </p>
              <p className="text-sm text-slate-500">30-day review window</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Weak Rate</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {metricValue(dashboard.growth_review?.growth_summary, "weak_post_rate")}
              </p>
              <p className="text-sm text-slate-500">Recent archive sample</p>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="lg:w-56">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="taste-type">
                  Taste Type
                </label>
                <select
                  id="taste-type"
                  value={tasteType}
                  onChange={(event) => setTasteType(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  <option value="taste_profile">Taste Profile</option>
                  <option value="approval_feedback">Approval Feedback</option>
                  <option value="rejection_feedback">Rejection Feedback</option>
                  <option value="brand_voice_note">Brand Voice Note</option>
                  <option value="current_belief">Current Belief</option>
                  <option value="banned_phrase">Banned Phrase</option>
                  <option value="cooldown">Cooldown</option>
                </select>
              </div>
              <div className="min-w-0 flex-1">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="taste-lesson">
                  Owner Taste Lesson
                </label>
                <textarea
                  id="taste-lesson"
                  value={tasteLesson}
                  onChange={(event) => setTasteLesson(event.target.value)}
                  rows={3}
                  className="mt-2 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-800"
                  placeholder="Example: I like this because it feels direct and earned, but avoid sounding like generic motivation."
                />
              </div>
              <button
                type="button"
                onClick={() => void saveTasteFeedback()}
                disabled={saving === "taste-feedback"}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving === "taste-feedback" ? "Saving..." : "Save Taste"}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="brief-objective">
                  Generation Objective
                </label>
                <input
                  id="brief-objective"
                  value={briefObjective}
                  onChange={(event) => setBriefObjective(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  placeholder="Example: 8 posts for next week focused on raising engagement floor."
                />
              </div>
              <div className="w-32">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="brief-batch-size">
                  Batch
                </label>
                <input
                  id="brief-batch-size"
                  type="number"
                  min={1}
                  max={30}
                  value={briefBatchSize}
                  onChange={(event) => setBriefBatchSize(Math.min(Math.max(Number(event.target.value) || 1, 1), 30))}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                />
              </div>
              <button
                type="button"
                onClick={() => void loadGenerationBrief()}
                disabled={saving === "generation-brief"}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving === "generation-brief" ? "Checking..." : "Check Brief"}
              </button>
            </div>
            {generationBrief ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Readiness</p>
                  <p className="mt-2 text-sm text-slate-700">
                    Memory {formatNumber(generationBrief.context_readiness?.memory_count)} · Saved patterns {formatNumber(generationBrief.context_readiness?.saved_patterns_count)}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Approved {formatNumber(generationBrief.context_readiness?.approved_drafts_count)} · Rejected {formatNumber(generationBrief.context_readiness?.rejected_drafts_count)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Candidate Pool</p>
                  <p className="mt-2 text-sm text-slate-700">
                    Generate at least {formatNumber(generationBrief.candidate_pool?.minimum_internal_candidates)} internally to show {formatNumber(generationBrief.candidate_pool?.show_after_self_rejection)}.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Taste Question</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {generationBrief.context_readiness?.should_ask_taste_question ? "Ask before generating." : "Enough signal to generate."}
                  </p>
                </div>
                <div className="md:col-span-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    {(generationBrief.candidate_pool?.flexible_direction_prompts ?? []).slice(0, 4).map((prompt) => (
                      <p key={prompt} className="rounded-md bg-slate-100 px-3 py-2 text-sm leading-6 text-slate-700">{prompt}</p>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Rule Suggestions</h2>
              <div className="mt-4 space-y-3">
                {(dashboard.rule_suggestions?.rule_suggestions ?? []).map((suggestion) => (
                  <article key={`${suggestion.suggestion_type}-${suggestion.title}`} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold uppercase text-white">
                        {suggestion.suggestion_type}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {suggestion.evidence_level} evidence
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-slate-950">{suggestion.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{suggestion.proposed_rule}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{suggestion.caution}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void saveExperimentFromSuggestion(suggestion)}
                        disabled={Boolean(saving)}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving === `suggestion-${suggestion.suggestion_type}-${suggestion.title}` ? "Saving..." : "Start Test"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveRuleProposalFromSuggestion(suggestion)}
                        disabled={Boolean(saving)}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving === `proposal-${suggestion.suggestion_type}-${suggestion.title}` ? "Saving..." : "Save Proposal"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Novelty / Fatigue</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {dashboard.novelty_fatigue?.novelty_recommendation ?? "No novelty report available."}
              </p>
              <div className="mt-4 space-y-2">
                {(dashboard.novelty_fatigue?.fatigue_signals ?? []).length ? (
                  dashboard.novelty_fatigue?.fatigue_signals?.map((signal) => (
                    <p key={signal} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{signal}</p>
                  ))
                ) : (
                  <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">No major fatigue signal.</p>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Growth Review</h2>
              <div className="mt-4 space-y-2">
                {(dashboard.growth_review?.recommendation_prompts ?? []).length ? (
                  dashboard.growth_review?.recommendation_prompts?.map((prompt) => (
                    <div key={prompt} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm leading-6 text-slate-700">{prompt}</p>
                      <button
                        type="button"
                        onClick={() => void saveExperimentFromPrompt(prompt)}
                        disabled={Boolean(saving)}
                        className="mt-3 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving === `growth-prompt-${prompt}` ? "Saving..." : "Start Experiment"}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">No growth prompts available yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">High-Use Tags</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {(dashboard.novelty_fatigue?.high_use_tags ?? []).length ? (
                  dashboard.novelty_fatigue?.high_use_tags?.slice(0, 8).map((tag, index) => (
                    <div key={`${String(tag.key ?? index)}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-semibold text-slate-900">{String(tag.key ?? "Unknown")}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Used {formatNumber(typeof tag.used === "number" ? tag.used : Number(tag.used))} · Risk {String(tag.fatigue_risk ?? "unknown")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:col-span-2">No high-use tags flagged.</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Memory Review</h2>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {visibleSections.length ? visibleSections.map((section) => (
                <div key={section.kind} className="rounded-lg border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-950">{section.label}</h3>
                    <p className="text-xs text-slate-500">{section.items.length} loaded</p>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {section.items.slice(0, 6).map((memory) => (
                      <article key={memory.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-950">{memory.title || memory.kind}</p>
                            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">{memoryPreview(memory)}</p>
                            <p className="mt-2 text-xs text-slate-500">Updated {formatDate(memory.updated_at)}</p>
                          </div>
                        </div>
                        {["current_belief", "approved_rule", "rule_proposal", "cooldown", "saved_pattern_note"].includes(memory.kind) ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {["keep", "cooldown", "retest", "retire"].map((decision) => (
                              <button
                                key={decision}
                                type="button"
                                onClick={() => void saveRuleReview(memory, decision)}
                                disabled={Boolean(saving)}
                                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {saving === `${memory.id}-${decision}` ? "Saving..." : decision}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {memory.kind === "experiment" ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {[
                              ["explore", "Explore"],
                              ["exploit", "Exploit"],
                              ["retest", "Retest"],
                              ["cooldown", "Cooldown"],
                              ["stop", "Stop"],
                            ].map(([decision, label]) => (
                              <button
                                key={decision}
                                type="button"
                                onClick={() => void saveExperimentDecision(memory, decision)}
                                disabled={Boolean(saving)}
                                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {saving === `${memory.id}-experiment-${decision}` ? "Saving..." : label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-600">No memory has been saved for this account yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Recent Generation Runs</h2>
            <div className="mt-4 space-y-3">
              {(dashboard.generation_runs ?? []).length ? dashboard.generation_runs?.map((run) => (
                <article key={run.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-950">{run.objective || "Generation run"}</p>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{run.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(run.updated_at)}</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {run.drafts.slice(0, 4).map((draft) => (
                      <div key={draft.id} className="rounded-md bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase text-slate-500">{draft.status}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">{draft.text}</p>
                        {draft.rejection_reason ? (
                          <p className="mt-2 text-xs text-rose-700">{draft.rejection_reason}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            ["approved", "Approve"],
                            ["rejected", "Reject"],
                            ["self_rejected", "Self Reject"],
                          ].map(([status, label]) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => void updateDraft(draft, status)}
                              disabled={Boolean(saving) || draft.status === status}
                              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {saving === `${draft.id}-${status}` ? "Saving..." : label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              )) : (
                <p className="text-sm text-slate-600">No generation runs saved yet.</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
