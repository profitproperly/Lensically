"use client";

import { useEffect, useState } from "react";

const BRIDGE_ORIGIN = "http://127.0.0.1:4127";

type AgentPost = {
  slot: string;
  text: string;
  objective?: string;
  bet_type?: string;
  fatigue_check?: string;
  expected_win_condition?: string;
};

type AgentMetrics = {
  current_followers?: number;
  followers_to_1m?: number;
  progress_to_1m_percent?: number;
  top_post?: {
    text?: string;
    likes?: number;
    views?: number;
    replies?: number;
    reposts?: number;
    permalink?: string | null;
  } | null;
  goals?: {
    top_post_likes_2x?: number;
    average_likes_2x?: number;
    average_views_2x?: number;
  };
  baselines?: {
    average_likes?: number;
    average_views?: number;
    recent_sample_size?: number;
    archive_total_seen?: number;
    follower_snapshots_seen?: number;
  };
};

type AgentRun = {
  id?: string;
  status?: string;
  generated_at?: string;
  target_date?: string;
  metrics?: AgentMetrics;
  strategy_summary?: string;
  fatigue_summary?: string;
  posts?: AgentPost[];
  last_regen?: {
    slot?: string;
    learned_response?: string;
  };
  schedule_result?: unknown;
};

type BridgeStatus = {
  ok?: boolean;
  active_run?: {
    id?: string;
    phase?: string;
    started_at?: string;
  } | null;
  latest_run?: AgentRun | null;
  error?: string;
};

function formatMetric(value: number | null | undefined): string {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US").format(Math.round(safeValue));
}

function formatPercent(value: number | null | undefined): string {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${safeValue.toFixed(4)}%`;
}

function metricCard(label: string, value: string, hint?: string) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate-600">{hint}</p> : null}
    </div>
  );
}

async function bridgeRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BRIDGE_ORIGIN}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => null) as T & { error?: string } | null;
  if (!response.ok) {
    throw new Error(data?.error || `Bridge request failed (${response.status})`);
  }
  return data as T;
}

export default function AgentControlPage() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [regenSlot, setRegenSlot] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  async function refreshStatus() {
    try {
      const nextStatus = await bridgeRequest<BridgeStatus>("/status");
      setStatus(nextStatus);
      setRun(nextStatus.latest_run ?? null);
      setError("");
    } catch (nextError) {
      setStatus(null);
      setError(nextError instanceof Error ? nextError.message : "Local agent bridge is not reachable.");
    }
  }

  useEffect(() => {
    void refreshStatus();
    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 7000);
    return () => window.clearInterval(interval);
  }, []);

  async function handleGenerate() {
    setIsGenerating(true);
    setError("");
    setSuccess("");
    try {
      const data = await bridgeRequest<{ run: AgentRun }>("/generate", { method: "POST", body: "{}" });
      setRun(data.run);
      setSuccess("Generated 17 posts from fresh account context.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Generate failed.");
    } finally {
      setIsGenerating(false);
      void refreshStatus();
    }
  }

  async function handleRegen(slot: string) {
    const reason = rejectionReasons[slot]?.trim() ?? "";
    if (!reason) {
      setError("Tell the agent why this slot needs to be regenerated.");
      return;
    }
    setRegenSlot(slot);
    setError("");
    setSuccess("");
    try {
      const data = await bridgeRequest<{ run: AgentRun; learned_response?: string }>("/regen", {
        method: "POST",
        body: JSON.stringify({ slot, reason }),
      });
      setRun(data.run);
      setRejectionReasons((current) => ({ ...current, [slot]: "" }));
      setSuccess(data.learned_response || "Regenerated slot and wrote rejection memory.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Regenerate failed.");
    } finally {
      setRegenSlot(null);
    }
  }

  async function handleSchedule() {
    setIsScheduling(true);
    setError("");
    setSuccess("");
    try {
      const data = await bridgeRequest<{ run: AgentRun }>("/schedule", { method: "POST", body: "{}" });
      setRun(data.run);
      setSuccess("Scheduled the latest 17-post slate through Lensically.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Schedule failed.");
    } finally {
      setIsScheduling(false);
    }
  }

  const metrics = run?.metrics;
  const posts = run?.posts ?? [];
  const activePhase = status?.active_run?.phase;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Manifest Mental Agent</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Generate tomorrow&apos;s 17-post slate</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              The local Hermes agent pulls fresh Lensically data, writes memory, generates the slate, and only schedules when you press schedule.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={isGenerating || Boolean(activePhase)}
              className="rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {isGenerating || activePhase ? "Generating..." : "Generate"}
            </button>
            <button
              type="button"
              onClick={() => void handleSchedule()}
              disabled={isScheduling || posts.length !== 17}
              className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-60"
            >
              {isScheduling ? "Scheduling..." : "Schedule 17 Posts"}
            </button>
          </div>
        </div>
        {activePhase ? <p className="mt-4 text-sm text-slate-700">Agent phase: {activePhase}</p> : null}
        {error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {success ? <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</p> : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCard("Current Followers", formatMetric(metrics?.current_followers), `${formatMetric(metrics?.followers_to_1m)} away from 1M`)}
        {metricCard("Progress To 1M", formatPercent(metrics?.progress_to_1m_percent), "North-star growth target")}
        {metricCard("2x Top Likes Goal", formatMetric(metrics?.goals?.top_post_likes_2x), `Top post likes: ${formatMetric(metrics?.top_post?.likes)}`)}
        {metricCard("2x Avg Views Goal", formatMetric(metrics?.goals?.average_views_2x), `Avg views: ${formatMetric(metrics?.baselines?.average_views)}`)}
        {metricCard("2x Avg Likes Goal", formatMetric(metrics?.goals?.average_likes_2x), `Avg likes: ${formatMetric(metrics?.baselines?.average_likes)}`)}
        {metricCard("Archive Seen", formatMetric(metrics?.baselines?.archive_total_seen), `${formatMetric(metrics?.baselines?.recent_sample_size)} recent sample`)}
        {metricCard("Follower Snapshots", formatMetric(metrics?.baselines?.follower_snapshots_seen), "Used in generate context")}
        {metricCard("Slate Status", `${posts.length}/17`, run?.target_date ? `Target ${run.target_date}` : "No generated slate")}
      </section>

      {run?.strategy_summary || run?.fatigue_summary ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Strategy</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{run.strategy_summary}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Audience Fatigue</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{run.fatigue_summary}</p>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">Generated Posts</h2>
        </div>
        {!posts.length ? (
          <p className="px-5 py-8 text-sm text-slate-500">No generated slate yet.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {posts.map((post) => (
              <article key={post.slot} className="grid gap-4 px-5 py-5 lg:grid-cols-[7rem_1fr_20rem]">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{post.slot}</p>
                  <p className="mt-1 text-xs text-slate-500">{post.bet_type || "Bet type pending"}</p>
                </div>
                <div>
                  <p className="text-base leading-7 text-slate-950">{post.text}</p>
                  <div className="mt-4 grid gap-3 text-xs text-slate-600 md:grid-cols-3">
                    <p><span className="font-semibold text-slate-800">Objective:</span> {post.objective || "None"}</p>
                    <p><span className="font-semibold text-slate-800">Fatigue:</span> {post.fatigue_check || "None"}</p>
                    <p><span className="font-semibold text-slate-800">Win:</span> {post.expected_win_condition || "None"}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <textarea
                    value={rejectionReasons[post.slot] ?? ""}
                    onChange={(event) => setRejectionReasons((current) => ({ ...current, [post.slot]: event.target.value }))}
                    placeholder="Why regenerate this post?"
                    className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => void handleRegen(post.slot)}
                    disabled={regenSlot === post.slot}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-60"
                  >
                    {regenSlot === post.slot ? "Regenerating..." : "Regenerate"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
