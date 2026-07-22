"use client";

import { useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";
import {
  appendThreadsUserId,
  readSelectedThreadsUserId,
  SELECTED_THREADS_ACCOUNT_EVENT,
} from "@/lib/selectedThreadsAccount";

type JsonRecord = Record<string, unknown>;

type IntelligenceDashboard = {
  version?: string;
  generated_at?: string;
  source_fingerprint?: string;
  strategy?: JsonRecord | null;
  beliefs_and_confidence?: {
    learning_observations?: JsonRecord[];
    transition_count?: number;
    strategy_transitions?: JsonRecord[];
  };
  family_states?: JsonRecord[];
  experiments?: JsonRecord[];
  learning_brief?: JsonRecord | null;
  benchmark_history?: JsonRecord[];
  benchmark_series?: JsonRecord[];
  latest_run_comparison?: JsonRecord | null;
  engagement_floor_trajectory?: JsonRecord[];
  prediction_accuracy_trajectory?: JsonRecord[];
  repetition_trends?: JsonRecord;
  saved_patterns?: JsonRecord[];
  run_receipts?: JsonRecord[];
  lineage?: JsonRecord;
  follower_checkpoint?: JsonRecord | null;
  decision_intelligence?: JsonRecord;
  decision_influence?: JsonRecord;
  product_proof?: JsonRecord;
  capability_status?: JsonRecord;
  capability_gaps?: unknown[];
  error?: string;
};

const INTELLIGENCE_URL = buildWorkerUrl("/api/threads/intelligence-dashboard");

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numeric(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value: unknown): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(numeric(value));
}

function formatPercent(value: unknown): string {
  const number = numeric(value, Number.NaN);
  if (!Number.isFinite(number)) return "—";
  const normalized = Math.abs(number) <= 1 ? number * 100 : number;
  return `${normalized.toFixed(normalized >= 10 ? 0 : 1)}%`;
}

function formatTime(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(parsed));
}

function titleCase(value: unknown): string {
  return text(value, "unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusClass(active: boolean): string {
  return active
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-800";
}

function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-600">{hint}</p> : null}
    </div>
  );
}

function Badge({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(active)}`}>
      {children}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">{children}</p>;
}

function ProgressBar({ value }: { value: unknown }) {
  const raw = numeric(value);
  const percentage = Math.max(0, Math.min(100, Math.abs(raw) <= 1 ? raw * 100 : raw));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full bg-slate-900" style={{ width: `${percentage}%` }} />
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className="max-w-[70%] text-right text-sm text-slate-800">{value}</span>
    </div>
  );
}
export default function IntelligencePage() {
  const [dashboard, setDashboard] = useState<IntelligenceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          appendThreadsUserId(INTELLIGENCE_URL, readSelectedThreadsUserId()),
          { cache: "no-store", credentials: "include", signal: controller.signal },
        );
        const data = (await response.json().catch(() => null)) as IntelligenceDashboard | null;
        if (!response.ok) throw new Error(data?.error || "Could not load intelligence dashboard.");
        if (active) setDashboard(data);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        if (active) {
          setDashboard(null);
          setError(loadError instanceof Error ? loadError.message : "Could not load intelligence dashboard.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    const handleAccount = () => void load();
    window.addEventListener(SELECTED_THREADS_ACCOUNT_EVENT, handleAccount);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener(SELECTED_THREADS_ACCOUNT_EVENT, handleAccount);
    };
  }, []);

  const view = useMemo(() => {
    const strategy = record(dashboard?.strategy);
    const decisionInfluence = record(dashboard?.decision_influence);
    const proof = record(dashboard?.product_proof);
    const follower = record(dashboard?.follower_checkpoint);
    const followerTrajectory = record(follower.trajectory);
    const learning = record(dashboard?.learning_brief);
    const brief = record(learning.brief);
    const strategyChange = record(learning.strategy_change ?? brief.strategy_change);
    const comparison = record(record(dashboard?.latest_run_comparison).comparison ?? dashboard?.latest_run_comparison);
    const lineage = record(dashboard?.lineage);
    return {
      strategy,
      decisionInfluence,
      proof,
      follower,
      followerTrajectory,
      learning,
      brief,
      strategyChange,
      comparison,
      lineage,
      families: list(dashboard?.family_states).map(record),
      experiments: list(dashboard?.experiments).map(record),
      savedPatterns: list(dashboard?.saved_patterns).map(record),
      influences: list(decisionInfluence.recent).map(record),
      benchmarks: list(dashboard?.benchmark_series).map(record),
      receipts: list(dashboard?.run_receipts).map(record),
      gaps: list(dashboard?.capability_gaps),
      observations: list(dashboard?.beliefs_and_confidence?.learning_observations).map(record),
    };
  }, [dashboard]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-slate-950">Manifest Intelligence</h1>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading strategy, learning, benchmarks, and proof receipts...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-slate-950">Manifest Intelligence</h1>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <p className="text-sm text-rose-700">{error || "Could not load intelligence dashboard."}</p>
        </div>
      </div>
    );
  }

  const latestStrategyVersion = view.strategy.version ?? view.strategy.id;
  const latestDirective = list(view.strategyChange.directives)[0] ?? list(view.brief.next_run_tests)[0];
  const decisionChangedCount = numeric(view.decisionInfluence.changed_decision_count);
  const totalDecisionReceipts = numeric(view.decisionInfluence.total_receipts);
  const followerGoal = numeric(view.follower.follower_goal, 1_000_000);
  const followerCount = numeric(view.follower.followers_count);
  const followerProgress = followerGoal > 0 ? followerCount / followerGoal : 0;
  const allLineageComplete = view.lineage.all_latest_complete === true;

  return (
    <div className="space-y-8 pb-12">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="grid gap-7 xl:grid-cols-[1.35fr_0.65fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">Autonomous Business Operator</p>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Manifest Intelligence Control Room</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
              One operating view for learned strategy, evidence confidence, portfolio allocation, experiments, repetition control, cycle receipts, lineage, and account-level growth.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge active={view.proof.dashboard_complete === true}>Dashboard integrated</Badge>
              <Badge active={view.proof.scheduled_task_contract_available === true}>Task intelligence contract</Badge>
              <Badge active={view.proof.automatic_operator_decision_change_proven === true}>Decision change proof</Badge>
              <Badge active={allLineageComplete}>Lineage complete</Badge>
            </div>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Current Proof State</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-slate-400">Learned changes</span><strong>{formatNumber(decisionChangedCount)}</strong></div>
              <div className="flex items-center justify-between gap-3"><span className="text-slate-400">Influence receipts</span><strong>{formatNumber(totalDecisionReceipts)}</strong></div>
              <div className="flex items-center justify-between gap-3"><span className="text-slate-400">Strategy version</span><strong className="max-w-[55%] truncate">{text(latestStrategyVersion)}</strong></div>
              <div className="flex items-center justify-between gap-3"><span className="text-slate-400">Refreshed</span><strong>{formatTime(dashboard.generated_at)}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Followers" value={formatNumber(followerCount)} hint={`${formatNumber(numeric(view.follower.distance_to_goal))} remaining to one million`} />
        <Stat label="Goal Progress" value={formatPercent(followerProgress)} hint={titleCase(view.followerTrajectory.trend)} />
        <Stat label="Decision Influence" value={formatPercent(view.decisionInfluence.changed_decision_rate)} hint={`${decisionChangedCount} of ${totalDecisionReceipts} decisions changed or constrained`} />
        <Stat label="Confidence Transitions" value={formatNumber(dashboard.beliefs_and_confidence?.transition_count)} hint={`${view.observations.length} active learning observations shown`} />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <Card title="Strategy and Learning Brief" subtitle="The current strategy version and the mature evidence allowed to change it.">
          <KeyValue label="Version" value={text(latestStrategyVersion)} />
          <KeyValue label="Parent" value={text(view.strategy.parent_version_id)} />
          <KeyValue label="Source cycle" value={text(view.strategy.source_cycle_id)} />
          <KeyValue label="Change summary" value={text(view.strategy.change_summary, "No strategy change recorded.")} />
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">Evidence gate</p>
              <Badge active={view.strategyChange.warranted === true}>
                {view.strategyChange.warranted === true ? "Change warranted" : "Preserve strategy"}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{text(view.strategyChange.reason, "No mature change directive is active.")}</p>
            {latestDirective ? (
              <p className="mt-3 rounded-xl bg-white px-3 py-3 text-sm font-medium text-slate-900">Next directive: {String(latestDirective)}</p>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Stat label="Authoritative Posts" value={formatNumber(view.learning.authoritative_post_count)} />
            <Stat label="Brief Updated" value={formatTime(view.learning.updated_at)} />
          </div>
        </Card>

        <Card title="Run-to-Run Comparison" subtitle="Whether the operator improved, weakened, repeated mistakes, or changed strategy between cycles.">
          <div className="flex flex-wrap gap-2">
            <Badge active={view.comparison.comparable === true}>{view.comparison.comparable === true ? "Comparable" : "Insufficient prior run"}</Badge>
            <Badge active={view.comparison.actual_strategy_influence === true}>{view.comparison.actual_strategy_influence === true ? "Strategy influenced run" : "No strategy change measured"}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {Object.entries(record(view.comparison.dimensions)).length ? Object.entries(record(view.comparison.dimensions)).map(([key, value]) => {
              const dimension = record(value);
              return (
                <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-900">{titleCase(key)}</span>
                    <Badge active={dimension.status === "improved"}>{titleCase(dimension.status)}</Badge>
                  </div>
                </div>
              );
            }) : <Empty>No prior benchmark is available for comparison yet.</Empty>}
          </div>
          {list(view.comparison.repeated_mistakes).length ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Repeated mistakes</p>
              <p className="mt-2 text-sm text-rose-800">{list(view.comparison.repeated_mistakes).map(String).join(", ")}</p>
            </div>
          ) : null}
        </Card>
      </section>

      <Card title="Benchmark Trajectory" subtitle="Completion, efficiency, prediction calibration, engagement floor, repetition prevention, and strategy influence across cycles.">
        {!view.benchmarks.length ? <Empty>No benchmark history is available yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-medium">Cycle</th>
                  <th className="px-3 py-3 font-medium">Completion</th>
                  <th className="px-3 py-3 font-medium">Efficiency</th>
                  <th className="px-3 py-3 font-medium">Prediction</th>
                  <th className="px-3 py-3 font-medium">Engagement floor</th>
                  <th className="px-3 py-3 font-medium">Semantic blocks</th>
                  <th className="px-3 py-3 font-medium">Strategy</th>
                </tr>
              </thead>
              <tbody>
                {view.benchmarks.map((item, index) => (
                  <tr key={`${text(item.snapshot_key)}-${index}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-4 font-medium text-slate-900">{text(item.cycle_id ?? item.snapshot_key)}</td>
                    <td className="px-3 py-4 text-slate-700">{formatPercent(item.completion_rate)}</td>
                    <td className="px-3 py-4 text-slate-700">{formatPercent(item.candidate_efficiency)}</td>
                    <td className="px-3 py-4 text-slate-700">{formatPercent(item.prediction_accuracy)}</td>
                    <td className="px-3 py-4 text-slate-700">{formatNumber(item.engagement_floor)}</td>
                    <td className="px-3 py-4 text-slate-700">{formatNumber(item.semantic_collisions)}</td>
                    <td className="px-3 py-4"><Badge active={numeric(item.strategy_influence) === 1}>{numeric(item.strategy_influence) === 1 ? "Changed" : "Held"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Adaptive Family Portfolio" subtitle="No fixed quotas. Allocation follows mature comparable performance, confidence, and verified decay.">
        {!view.families.length ? <Empty>No family portfolio states exist yet.</Empty> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {view.families.map((family, index) => (
              <article key={`${text(family.family_key)}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{titleCase(family.family_key)}</p>
                    <p className="mt-1 text-xs text-slate-500">{titleCase(family.confidence_label)}</p>
                  </div>
                  <Badge active={["franchise", "core", "emerging"].includes(String(family.role))}>{titleCase(family.role)}</Badge>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Confidence</span><span>{formatNumber(family.confidence_score)}</span></div>
                    <ProgressBar value={family.confidence_score} />
                  </div>
                  <KeyValue label="Weight" value={formatNumber(family.allocation_weight)} />
                  <KeyValue label="Recommended" value={titleCase(family.recommended_role)} />
                  <KeyValue label="Decay" value={family.actual_decay === true ? "Verified" : "Not verified"} />
                </div>
                {family.reason ? <p className="mt-3 text-xs leading-5 text-slate-600">{String(family.reason)}</p> : null}
              </article>
            ))}
          </div>
        )}
      </Card>
      <section className="grid gap-6 xl:grid-cols-2">
        <Card title="Learned Decision Influence" subtitle="Durable receipts proving which intelligence changed or constrained each autonomous move.">
          {!view.influences.length ? <Empty>No decision-influence receipt has been persisted yet.</Empty> : (
            <div className="space-y-3">
              {view.influences.slice(0, 10).map((influence, index) => (
                <article key={`${text(influence.influence_key)}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{titleCase(influence.family_key)}</p>
                      <p className="mt-1 text-xs text-slate-500">{text(influence.slot_key)} · post {text(influence.scheduled_post_id)}</p>
                    </div>
                    <Badge active={influence.decision_changed === true}>{influence.decision_changed === true ? "Changed" : "Preserved"}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{text(influence.decision_summary)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {list(influence.decision_change_types).map((item) => (
                      <span key={String(item)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700">{titleCase(item)}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{formatTime(influence.created_at)}</p>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card title="Controlled Experiments" subtitle="Exact hypotheses, comparison groups, maturity, and follow-up decisions.">
          {!view.experiments.length ? <Empty>No controlled experiments are active or completed.</Empty> : (
            <div className="space-y-3">
              {view.experiments.slice(0, 10).map((experiment, index) => (
                <article key={`${text(experiment.experiment_key)}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{titleCase(experiment.experiment_key)}</p>
                      <p className="mt-1 text-xs text-slate-500">{titleCase(experiment.family_key)}</p>
                    </div>
                    <Badge active={["expand", "continue", "running"].includes(String(experiment.follow_up_decision ?? experiment.status))}>
                      {titleCase(experiment.follow_up_decision ?? experiment.status)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Updated {formatTime(experiment.updated_at)}</p>
                </article>
              ))}
            </div>
          )}
        </Card>
      </section>

      <Card title="Saved Pattern Intelligence" subtitle="Qualified sources with adaptation boundaries, mature results, confidence, and reuse state.">
        {!view.savedPatterns.length ? <Empty>No enriched Saved Pattern intelligence is available.</Empty> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {view.savedPatterns.slice(0, 12).map((pattern, index) => {
              const mechanism = record(pattern.mechanism);
              const confidence = record(pattern.confidence);
              const results = record(pattern.results);
              return (
                <article key={`${text(pattern.pattern_identity_key)}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="max-w-[70%] truncate font-medium text-slate-950">{text(pattern.source_identity_key ?? pattern.pattern_identity_key)}</p>
                    <Badge active={["proven", "ready"].includes(String(pattern.reuse_state))}>{titleCase(pattern.reuse_state)}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{text(mechanism.mechanism ?? mechanism.reward ?? mechanism.topic, "Mechanism recorded in the source contract.")}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-white p-3"><span className="text-slate-500">Confidence</span><p className="mt-1 font-semibold text-slate-900">{formatNumber(confidence.score)}</p></div>
                    <div className="rounded-xl bg-white p-3"><span className="text-slate-500">Mature uses</span><p className="mt-1 font-semibold text-slate-900">{formatNumber(results.mature_result_count)}</p></div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Run Receipts and Lineage" subtitle="Reconstructable cycle receipts, strategy changes, coverage, and complete source-to-published lineage.">
        {!view.receipts.length ? <Empty>No autonomous cycle receipt is available.</Empty> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-medium">Cycle</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Receipt</th>
                  <th className="px-3 py-3 font-medium">Scheduled</th>
                  <th className="px-3 py-3 font-medium">Lineage</th>
                  <th className="px-3 py-3 font-medium">Strategy</th>
                  <th className="px-3 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {view.receipts.map((receipt, index) => {
                  const receiptLineage = record(receipt.lineage);
                  return (
                    <tr key={`${text(receipt.cycle_id)}-${index}`} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-4 font-medium text-slate-900">{text(receipt.cycle_id)}</td>
                      <td className="px-3 py-4"><Badge active={receipt.status === "completed"}>{titleCase(receipt.status)}</Badge></td>
                      <td className="px-3 py-4 text-slate-700">{titleCase(receipt.receipt_status)}</td>
                      <td className="px-3 py-4 text-slate-700">{formatNumber(receiptLineage.scheduled)}</td>
                      <td className="px-3 py-4 text-slate-700">{formatPercent(receiptLineage.completion_rate)}</td>
                      <td className="px-3 py-4"><Badge active={receipt.strategy_changed === true}>{receipt.strategy_changed === true ? "Changed" : "Held"}</Badge></td>
                      <td className="px-3 py-4 text-slate-500">{formatTime(receipt.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card title="Follower Trajectory" subtitle="Account-level progress only. No post, family, experiment, cycle, or posting-period attribution.">
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm"><span className="text-slate-600">Progress to one million</span><strong>{formatPercent(followerProgress)}</strong></div>
              <ProgressBar value={followerProgress} />
            </div>
            <KeyValue label="Current" value={formatNumber(followerCount)} />
            <KeyValue label="Remaining" value={formatNumber(view.follower.distance_to_goal)} />
            <KeyValue label="7-day velocity" value={formatNumber(view.followerTrajectory.average_daily_change_7d)} />
            <KeyValue label="30-day velocity" value={formatNumber(view.followerTrajectory.average_daily_change_30d)} />
            <KeyValue label="Observed ETA" value={view.followerTrajectory.estimated_days_to_goal_at_observed_velocity == null ? "Uncertain" : `${formatNumber(view.followerTrajectory.estimated_days_to_goal_at_observed_velocity)} days`} />
          </div>
          <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">{text(view.follower.attribution_policy)}</p>
        </Card>

        <Card title="Capability Gaps" subtitle="What still lacks enough evidence or production proof.">
          {!view.gaps.length ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">No current capability gaps are reported.</div>
          ) : (
            <div className="space-y-3">
              {view.gaps.map((gap, index) => (
                <div key={`${String(gap)}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{String(gap)}</div>
              ))}
            </div>
          )}
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payload identity</p>
            <p className="mt-2 break-all font-mono text-xs text-slate-700">{text(dashboard.source_fingerprint)}</p>
          </div>
        </Card>
      </section>
    </div>
  );
}
