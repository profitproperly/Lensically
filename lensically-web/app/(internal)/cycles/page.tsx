"use client";

import { useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";

type Rail = "main" | "innovation";
type JsonRecord = Record<string, unknown>;

type MainState = {
  state?: string | null;
  display_state?: string | null;
  semantic_version?: string | null;
  source_sha?: string | null;
  selector_version?: string | null;
  preselection_policy_version?: string | null;
  component_versions?: JsonRecord;
  promoted_from_innovation_run_id?: string | null;
  promotion_classification?: string | null;
  promoted_at?: string | null;
};

type InnovationRun = {
  run_id?: string | null;
  state?: string | null;
  challenged_main_version?: string | null;
  candidate_version?: string | null;
  tested_sha?: string | null;
  snapshot_hash?: string | null;
  selector_version?: string | null;
  preselection_policy_version?: string | null;
  control_or_challenger?: string | null;
  passed?: boolean | null;
  promotion_eligible?: boolean | null;
  promotion_destination_version?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

type RailStateResponse = {
  success?: boolean;
  error?: string;
  main?: MainState;
  innovation?: {
    state?: string | null;
    display_state?: string | null;
    active_run?: InnovationRun | null;
    latest_run?: InnovationRun | null;
  };
  promotion_history?: JsonRecord[];
  updated_at?: string | null;
};

type HistoryRow = {
  id?: string | null;
  operation_id?: string | null;
  receipt_version?: string | null;
  status?: string | null;
  display_state?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  selected_count?: number;
  gate_receipt_count?: number;
  defect_count?: number;
  scenario?: string | null;
  variant_key?: string | null;
  tested_sha?: string | null;
  snapshot_hash?: string | null;
  challenged_main_version?: string | null;
  promotion_destination_version?: string | null;
  benchmark_passed?: boolean | null;
  accepted_count?: number;
  target_count?: number;
  gate_count?: number;
  lineage_count?: number;
  source_replacement_count?: number;
  total_wall_clock_ms?: number;
  production_noninterference_passed?: boolean | null;
  failure_code?: string | null;
  failure_message?: string | null;
};

type HistoryResponse = {
  success?: boolean;
  error?: string;
  rows?: HistoryRow[];
  page_size?: number;
  has_more?: boolean;
  next_cursor?: string | null;
};

type SummaryResponse = JsonRecord & {
  success?: boolean;
  error?: string;
  rail?: Rail;
  id?: string;
  status?: string | null;
  selected_count?: number;
  gate_receipt_count?: number;
  passed_gate_receipt_count?: number;
  defect_count?: number;
  open_defect_count?: number;
  selector_version?: string | null;
  preselection_policy_version?: string | null;
  preselection_policy_hash?: string | null;
  snapshot_hash?: string | null;
  counts?: JsonRecord;
  timings?: JsonRecord;
  production_noninterference_passed?: boolean | null;
  threads_mutation_count?: number;
  cleanup_orphan_count?: number;
  benchmark_passed?: boolean | null;
  stage_event_count?: number;
  tested_sha?: string | null;
  challenged_main_version?: string | null;
  promotion_destination_version?: string | null;
  scenario?: string | null;
  variant_key?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

type SelectionRow = {
  slot_key?: string | null;
  selection_order?: number;
  source_identity_key?: string | null;
  source_card_id?: string | null;
  source_card_family_id?: string | null;
    source_title?: string | null;
  source_shorthand?: string | null;
  scheduled_post_text?: string | null;
  scheduled_generation_mode?: string | null;
  scheduled_strategic_purpose?: string | null;
  scheduled_post_id?: number | null;
  scheduled_post_status?: string | null;
  source_history_scope?: string | null;
    family_state?: string | null;
  lifecycle_label?: string | null;
  audition_state?: string | null;
  allocation_tier?: string | null;
  selection_lane?: string | null;
  lifetime_label?: string | null;
  recent_label?: string | null;
  confidence_label?: string | null;
  matured_result_count?: number | null;
  unified_rating?: number | null;
  ranking_score?: number | null;
  global_rank?: number | null;
  score?: number | null;
  engine_version?: string | null;
  preselection_policy_version?: string | null;
  preselection_policy_hash?: string | null;
  persisted_reason?: string | null;
};

type SelectionsResponse = {
  success?: boolean;
  error?: string;
  rows?: SelectionRow[];
  selected_count?: number;
  filtered_count?: number;
  returned_count?: number;
  hidden_count?: number;
  supported_filters?: string[];
  audit_status?: string;
  unavailable_reason?: string;
  snapshot_payload_bytes?: number;
};

type SelectionDetail = SelectionRow & {
  source_text?: string | null;
  source_mechanism?: string | null;
  required_product?: string | null;
  recommended_direction?: string | null;
  score_factors?: JsonRecord;
  exposure_checks?: JsonRecord;
  audition?: JsonRecord;
  hard_exclusions?: unknown;
  causal_signals?: unknown;
  persisted_receipt?: {
    available?: boolean;
    value?: unknown;
    bytes?: number;
    reason?: string;
  };
  receipt_reference?: JsonRecord;
};

type DetailResponse = {
  success?: boolean;
  error?: string;
  selection?: SelectionDetail | null;
  audit_status?: string;
  unavailable_reason?: string;
  explanation_source?: string;
  recalculated?: boolean;
};

const STATE_URL = buildWorkerUrl("/api/cycles/state");
const HISTORY_URL = buildWorkerUrl("/api/cycles/history");
const SUMMARY_URL = buildWorkerUrl("/api/cycles/summary");
const SELECTIONS_URL = buildWorkerUrl("/api/cycles/selections");
const SELECTION_DETAIL_URL = buildWorkerUrl("/api/cycles/selection-detail");

function withQuery(base: string, values: Record<string, string | number | boolean | null | undefined>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
  return url.toString();
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    signal,
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(data?.error || "Could not load cycle data.");
  }
  if (!data) throw new Error("Cycle response was empty.");
  return data;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Unavailable";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(parsed));
}

function formatNumber(value: unknown): string {
  const number = Number(value);
  return new Intl.NumberFormat("en-US").format(Number.isFinite(number) ? number : 0);
}

function formatDuration(value: unknown): string {
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "Unavailable";
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function compactSha(value: string | null | undefined): string {
  if (!value) return "Unavailable";
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
}

function titleCase(value: string | null | undefined): string {
  if (!value) return "Unavailable";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const EXECUTION_MODE_COPY: Record<string, { label: string; description: string }> = {
  controlled_variation: {
    label: "Controlled variation",
    description: "A close, source-backed rewrite that preserves the source mechanism and payoff while changing only what is necessary.",
  },
  franchise_deployment: {
    label: "Franchise deployment",
    description: "An intentional deployment of a hook or mechanism the account-level strategy already considers strong.",
  },
  mechanism_expansion: {
    label: "Mechanism expansion",
    description: "A source-backed use of a known mechanism with a meaningfully different payoff, angle, or structure.",
  },
  adjacent_experiment: {
    label: "Adjacent experiment",
    description: "A deliberate test of a nearby source-backed variation. This is the clearest true experiment label.",
  },
};

const ALLOCATION_COPY: Record<string, { label: string; description: string }> = {
  exploit: {
    label: "Exploit",
    description: "Proven and Franchise source families compete for engagement-focused distribution and may earn repeated placements.",
  },
  winner: {
    label: "Exploit",
    description: "Legacy receipt name for the Exploit lane.",
  },
  develop: {
    label: "Develop",
    description: "Probation, Tiebreaker, Prospect, and Emerging families receive evidence-resolving opportunities.",
  },
  development: {
    label: "Develop",
    description: "Legacy receipt name for the Develop lane.",
  },
  explore: {
    label: "Explore",
    description: "Untested source families receive their first fair opportunity to produce account evidence.",
  },
  exploration: {
    label: "Explore",
    description: "Legacy receipt name for the Explore lane.",
  },
  bench: {
    label: "Bench",
    description: "Underperforming source families receive no normal distribution.",
  },
};

const LIFECYCLE_COPY: Record<string, { label: string; description: string }> = {
  untested: {
    label: "Untested",
    description: "No matured Manifest Mental result is linked to this exact source-card family yet.",
  },
  probation: {
    label: "Probation",
    description: "One weak matured result. One evidence opportunity remains before normal distribution is removed.",
  },
  tiebreaker: {
    label: "Tiebreaker",
    description: "The early evidence is mixed and one more matured result is needed to resolve it.",
  },
  prospect: {
    label: "Prospect",
    description: "Early positive or inconclusive evidence deserves continued development but is not yet reliable.",
  },
  emerging: {
    label: "Emerging",
    description: "Repeated positive evidence is building, but the family has not yet reached Proven reliability.",
  },
  proven: {
    label: "Proven",
    description: "The family has reliable evidence that it outperforms the account baseline.",
  },
  franchise: {
    label: "Franchise",
    description: "The family currently has elite, reliable performance and competes near the top of the source pool.",
  },
  underperforming: {
    label: "Underperforming",
    description: "The family has resolved negative evidence and is benched from normal selection.",
  },
};

function executionModeCopy(value: string | null | undefined) {
  return EXECUTION_MODE_COPY[String(value ?? "")] ?? {
    label: titleCase(value),
    description: "The persisted generation method used for the scheduled output.",
  };
}

function allocationCopy(value: string | null | undefined) {
  return ALLOCATION_COPY[String(value ?? "")] ?? {
    label: titleCase(value),
    description: "The selector lane assigned to this exact source identity.",
  };
}

function lifecycleCopy(value: string | null | undefined) {
  return LIFECYCLE_COPY[String(value ?? "")] ?? {
    label: titleCase(value),
    description: "The current lifecycle classification of this exact source-card family.",
  };
}

function filterLabel(value: string): string {
  return EXECUTION_MODE_COPY[value]?.label
    ?? ALLOCATION_COPY[value]?.label
    ?? LIFECYCLE_COPY[value]?.label
    ?? titleCase(value);
}


function slotLabel(value: string | null | undefined): string {
  if (!value) return "Unknown slot";
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    }).format(new Date(parsed));
  }
  return value.replace("T", " ");
}

function statusClass(value: string | null | undefined): string {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("fail") || normalized.includes("behind")) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (normalized.includes("candidate") || normalized.includes("challenger")) {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }
  if (normalized.includes("champion") || normalized.includes("passed") || normalized.includes("promoted") || normalized.includes("standby")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function Badge({ children, title }: { children: React.ReactNode; title?: string }) {
  return <span title={title} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">{children}</span>;
}


function StateBadge({ value }: { value: string | null | undefined }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(value)}`}>{value || "Unavailable"}</span>;
}

function MetricCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <div className="mt-2 text-xl font-semibold text-slate-950">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="break-words text-sm text-slate-800">{value ?? "Unavailable"}</dd>
    </div>
  );
}

function GlossaryTerm({ term, meaning }: { term: string; meaning: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <dt className="text-sm font-semibold text-slate-950">{term}</dt>
      <dd className="mt-1 text-sm leading-6 text-slate-600">{meaning}</dd>
    </div>
  );
}

function CycleGlossary() {
  return (
    <details open className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:p-5">
      <summary className="cursor-pointer text-sm font-semibold text-sky-950">How to read this page</summary>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-sky-900">
        Every slot contains two separate objects: the actual scheduled post and the exact Saved Pattern source used to create it. Labels about the exact source do not automatically describe the broader hook or mechanism.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <GlossaryTerm term="Scheduled output" meaning="The exact post text that was scheduled for the displayed hour." />
        <GlossaryTerm term="Source used" meaning="The Saved Pattern or source card that supplied the premise, structure, hook, or payoff." />
        <GlossaryTerm term="Mechanism" meaning="The broader repeatable idea, such as a finger-touch activation, Universe request, money question, or reader-address hook." />
        <GlossaryTerm term="Exact source identity" meaning="One specific Saved Pattern record. Two similar finger-touch sources can have different exact-source histories." />
        <GlossaryTerm term="Execution mode" meaning="How the model adapted the source for the scheduled post. Controlled variation is not automatically an experiment." />
        <GlossaryTerm term="Selection lane" meaning="How much evidence the selector has for the exact source identity: Winner, Development, or Evidence-building." />
        <GlossaryTerm term="Experimental / exploration" meaning="The exact source is being used to gather evidence. It does not mean the account has never used or proven the broader mechanism." />
        <GlossaryTerm term="Exact-source status" meaning="The audition record for this exact source only: no results, one pass, one fail, tiebreaker, graduated, or underperforming." />
        <GlossaryTerm term="Lifetime label" meaning="Long-run exact-source performance: Untested, Prospect, Emerging, Proven, Franchise, or Underperforming." />
        <GlossaryTerm term="Recent label" meaning="Recent exact-source direction: No recent data, Hot, Healthy, Cooling, Cold, or Recovering." />
        <GlossaryTerm term="Confidence" meaning="How dependable the exact-source classification is: Low, Developing, Directional, or Reliable." />
        <GlossaryTerm term="Score" meaning="A selector ranking used within that cycle. It is not a predicted like count or an overall quality grade." />
        <GlossaryTerm term="72-hour cooldown" meaning="The same exact source cannot be reused too soon. Separate semantic checks can also block a different source that produces a very similar post." />
        <GlossaryTerm term="Proven mechanism, untested source" meaning="A valid combination: the account may have proven the broader hook while this particular Saved Pattern identity has no linked matured results." />
        <GlossaryTerm term="Franchise deployment" meaning="The strategy intentionally uses an account-level mechanism it already considers strong. This is different from an exact source receiving the Franchise lifetime label." />
      </div>
    </details>
  );
}

export default function CyclesPage() {

  const [rail, setRail] = useState<Rail>("main");
  const [railState, setRailState] = useState<RailStateResponse | null>(null);
  const [stateLoading, setStateLoading] = useState(true);
  const [stateError, setStateError] = useState("");
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [previousCursors, setPreviousCursors] = useState<Array<string | null>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [selections, setSelections] = useState<SelectionsResponse | null>(null);
  const [selectionsLoading, setSelectionsLoading] = useState(false);
  const [selectionsError, setSelectionsError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState("");
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, DetailResponse>>({});
  const [detailLoadingSlot, setDetailLoadingSlot] = useState<string | null>(null);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadState() {
      setStateLoading(true);
      setStateError("");
      try {
        const data = await fetchJson<RailStateResponse>(STATE_URL, controller.signal);
        setRailState(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStateError(error instanceof Error ? error.message : "Could not load cycle state.");
      } finally {
        setStateLoading(false);
      }
    }
    void loadState();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError("");
      try {
        const data = await fetchJson<HistoryResponse>(withQuery(HISTORY_URL, {
          rail,
          cursor: historyCursor,
          limit: 10,
        }), controller.signal);
        setHistory(data);
        const firstAvailableId = data.rows?.find((row) => row.id)?.id ?? null;
        setSelectedId((current) => {
          if (current && data.rows?.some((row) => row.id === current)) return current;
          return firstAvailableId;
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setHistory(null);
        setSelectedId(null);
        setHistoryError(error instanceof Error ? error.message : "Could not load cycle history.");
      } finally {
        setHistoryLoading(false);
      }
    }
    void loadHistory();
    return () => controller.abort();
  }, [rail, historyCursor]);

  useEffect(() => {
    if (!selectedId) {
      setSummary(null);
      return;
    }
    const controller = new AbortController();
    async function loadSummary() {
      setSummaryLoading(true);
      setSummaryError("");
      try {
        const data = await fetchJson<SummaryResponse>(withQuery(SUMMARY_URL, {
          rail,
          id: selectedId,
        }), controller.signal);
        setSummary(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSummary(null);
        setSummaryError(error instanceof Error ? error.message : "Could not load cycle summary.");
      } finally {
        setSummaryLoading(false);
      }
    }
    void loadSummary();
    return () => controller.abort();
  }, [rail, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setSelections(null);
      return;
    }
    const controller = new AbortController();
    async function loadSelections() {
      setSelectionsLoading(true);
      setSelectionsError("");
      try {
        const data = await fetchJson<SelectionsResponse>(withQuery(SELECTIONS_URL, {
          rail,
          id: selectedId,
          show_all: showAll,
          filter: filter || null,
        }), controller.signal);
        setSelections(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSelections(null);
        setSelectionsError(error instanceof Error ? error.message : "Could not load source-selection audit.");
      } finally {
        setSelectionsLoading(false);
      }
    }
    void loadSelections();
    return () => controller.abort();
  }, [rail, selectedId, showAll, filter]);

  function switchRail(nextRail: Rail) {
    if (nextRail === rail) return;
    setRail(nextRail);
    setHistoryCursor(null);
    setPreviousCursors([]);
    setSelectedId(null);
    setSummary(null);
    setSelections(null);
    setShowAll(false);
    setFilter("");
    setExpandedSlot(null);
    setDetailError("");
  }

  function selectCycle(id: string) {
    if (!id || id === selectedId) return;
    setSelectedId(id);
    setShowAll(false);
    setFilter("");
    setExpandedSlot(null);
    setDetailError("");
  }

  function goNextPage() {
    const nextCursor = history?.next_cursor ?? null;
    if (!nextCursor) return;
    setPreviousCursors((current) => [...current, historyCursor]);
    setHistoryCursor(nextCursor);
    setSelectedId(null);
  }

  function goPreviousPage() {
    if (!previousCursors.length) return;
    const nextStack = [...previousCursors];
    const previous = nextStack.pop() ?? null;
    setPreviousCursors(nextStack);
    setHistoryCursor(previous);
    setSelectedId(null);
  }

  async function toggleSelectionDetail(slotKey: string) {
    if (expandedSlot === slotKey) {
      setExpandedSlot(null);
      return;
    }
    setExpandedSlot(slotKey);
    setDetailError("");
    if (!selectedId) return;
    const cacheKey = `${rail}:${selectedId}:${slotKey}`;
    if (detailCache[cacheKey]) return;
    setDetailLoadingSlot(slotKey);
    try {
      const detail = await fetchJson<DetailResponse>(withQuery(SELECTION_DETAIL_URL, {
        rail,
        id: selectedId,
        slot_key: slotKey,
      }));
      setDetailCache((current) => ({ ...current, [cacheKey]: detail }));
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Could not load source-selection detail.");
    } finally {
      setDetailLoadingSlot(null);
    }
  }

  const selectedHistoryRow = useMemo(
    () => history?.rows?.find((row) => row.id === selectedId) ?? null,
    [history, selectedId],
  );
  const currentMain = railState?.main;
  const currentInnovation = railState?.innovation;
  const innovationRun = currentInnovation?.active_run ?? currentInnovation?.latest_run ?? null;
  const supportedFilters = selections?.supported_filters ?? [];

  return (
    <div className="mx-auto w-full max-w-[96rem] space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Operational history and source audit</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Cycles</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Inspect what Main ran, what Innovation tested, and the exact persisted Stage 4 reason behind every supported source selection.
            </p>
          </div>
          <div className="inline-flex w-full rounded-2xl border border-slate-200 bg-slate-100 p-1 sm:w-auto" role="tablist" aria-label="Cycle rail">
            {(["main", "innovation"] as Rail[]).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={rail === value}
                onClick={() => switchRail(value)}
                className={[
                  "flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold transition sm:flex-none",
                  rail === value ? "bg-black text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-950",
                ].join(" ")}
              >
                {value === "main" ? "Main" : "Innovation"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {stateLoading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading Champion and challenger state...</p>
        </section>
      ) : stateError ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <p className="text-sm text-rose-700">{stateError}</p>
        </section>
      ) : rail === "main" ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-slate-950">Main Cycle {currentMain?.semantic_version || "Unavailable"}</h2>
                <StateBadge value={currentMain?.display_state} />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Main remains the production authority. Its semantic version advances only through a recorded Champion release.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>SHA {compactSha(currentMain?.source_sha)}</Badge>
              <Badge>{currentMain?.selector_version || "Selector unavailable"}</Badge>
              <Badge>{currentMain?.preselection_policy_version || "Policy unavailable"}</Badge>
            </div>
          </div>
          <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">Technical version and promotion lineage</summary>
            <dl className="mt-3">
              <KeyValue label="Semantic version" value={currentMain?.semantic_version} />
              <KeyValue label="Exact source SHA" value={<code className="break-all text-xs">{currentMain?.source_sha || "Unavailable"}</code>} />
              <KeyValue label="Selector" value={currentMain?.selector_version} />
              <KeyValue label="Preselection policy" value={currentMain?.preselection_policy_version} />
              <KeyValue label="Promoted from Innovation" value={currentMain?.promoted_from_innovation_run_id || "Baseline registration unavailable"} />
              <KeyValue label="Release classification" value={titleCase(currentMain?.promotion_classification)} />
              <KeyValue label="Promoted at" value={formatDate(currentMain?.promoted_at)} />
              <KeyValue label="Component versions" value={<pre className="overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(currentMain?.component_versions ?? {}, null, 2)}</pre>} />
            </dl>
          </details>
        </section>
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-slate-950">Innovation Cycle</h2>
                <StateBadge value={currentInnovation?.display_state} />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Innovation is an isolated run-based rail. It receives no semantic version until a proven candidate is promoted into Main.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{innovationRun?.run_id || "No active challenger"}</Badge>
              {innovationRun?.promotion_destination_version ? <Badge>Promoted to Main {innovationRun.promotion_destination_version}</Badge> : null}
            </div>
          </div>
          <dl className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4">
            <KeyValue label="Active relationship" value={currentInnovation?.display_state || "Standby"} />
            <KeyValue label="Challenging Main" value={innovationRun?.challenged_main_version || (currentInnovation?.state === "standby" ? "No active challenge" : "Unavailable")} />
            <KeyValue label="Run ID" value={innovationRun?.run_id || "No active challenger"} />
            <KeyValue label="Tested SHA" value={<code className="break-all text-xs">{innovationRun?.tested_sha || "Unavailable"}</code>} />
            <KeyValue label="Snapshot" value={<code className="break-all text-xs">{innovationRun?.snapshot_hash || "Unavailable"}</code>} />
            <KeyValue label="Role" value={titleCase(innovationRun?.control_or_challenger)} />
            <KeyValue label="Promotion eligibility" value={innovationRun?.promotion_eligible === true ? "Eligible" : innovationRun?.promotion_eligible === false ? "Not eligible" : "Unavailable"} />
          </dl>
        </section>
      )}

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)]">
        <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">{rail === "main" ? "Main cycle history" : "Innovation run history"}</h2>
              <p className="mt-1 text-sm text-slate-600">Ten records per server-bounded page.</p>
            </div>
            <Badge>{rail === "main" ? "Production" : "Isolated"}</Badge>
          </div>

          <div className="mt-5 space-y-3">
            {historyLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Loading history...</div>
            ) : historyError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{historyError}</div>
            ) : !history?.rows?.length ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No cycle records are available.</div>
            ) : (
              history.rows.map((row) => {
                const id = row.id || "";
                const selected = id === selectedId;
                const status = rail === "innovation" ? row.display_state || row.status : row.status;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectCycle(id)}
                    className={[
                      "block w-full rounded-2xl border p-4 text-left transition",
                      selected
                        ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{rail === "main" ? row.operation_id || id : row.display_state || row.variant_key || id}</p>
                        <p className={`mt-1 truncate text-xs ${selected ? "text-slate-300" : "text-slate-500"}`}>{id}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${selected ? "bg-white/15 text-white" : statusClass(status)}`}>
                        {status || "Unknown"}
                      </span>
                    </div>
                    <div className={`mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs ${selected ? "text-slate-300" : "text-slate-500"}`}>
                      <span>{formatDate(row.completed_at || row.started_at)}</span>
                      {rail === "main" ? (
                        <>
                          <span>{formatNumber(row.selected_count)} selected</span>
                          <span>{formatNumber(row.defect_count)} defects</span>
                        </>
                      ) : (
                        <>
                          <span>{formatNumber(row.accepted_count)}/{formatNumber(row.target_count)} accepted</span>
                          <span>{formatDuration(row.total_wall_clock_ms)}</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={goPreviousPage}
              disabled={!previousCursors.length || historyLoading}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">Page {previousCursors.length + 1}</span>
            <button
              type="button"
              onClick={goNextPage}
              disabled={!history?.has_more || historyLoading}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Selected record</p>
                <h2 className="mt-2 break-words text-xl font-semibold text-slate-950">
                  {selectedHistoryRow?.operation_id || selectedHistoryRow?.display_state || selectedId || "Select a cycle"}
                </h2>
                {selectedId ? <p className="mt-1 break-all text-xs text-slate-500">{selectedId}</p> : null}
              </div>
              {selectedHistoryRow ? <StateBadge value={rail === "innovation" ? selectedHistoryRow.display_state || selectedHistoryRow.status : selectedHistoryRow.status} /> : null}
            </div>

            {summaryLoading ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Loading cycle summary...</div>
            ) : summaryError ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{summaryError}</div>
            ) : !summary || !selectedId ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Choose a history record to inspect it.</div>
            ) : rail === "main" ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Sources selected" value={formatNumber(summary.selected_count)} />
                  <MetricCard label="Gate receipts" value={formatNumber(summary.gate_receipt_count)} hint={`${formatNumber(summary.passed_gate_receipt_count)} passed`} />
                  <MetricCard label="Defects" value={formatNumber(summary.defect_count)} hint={`${formatNumber(summary.open_defect_count)} open`} />
                  <MetricCard label="Status" value={titleCase(summary.status)} />
                </div>
                <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">Cycle technical identity</summary>
                  <dl className="mt-3">
                    <KeyValue label="Selector" value={summary.selector_version || "Unavailable"} />
                    <KeyValue label="Preselection policy" value={summary.preselection_policy_version || "Unavailable"} />
                    <KeyValue label="Policy hash" value={<code className="break-all text-xs">{summary.preselection_policy_hash || "Unavailable"}</code>} />
                    <KeyValue label="Snapshot hash" value={<code className="break-all text-xs">{summary.snapshot_hash || "Unavailable"}</code>} />
                    <KeyValue label="Started" value={formatDate(summary.started_at)} />
                    <KeyValue label="Completed" value={formatDate(summary.completed_at)} />
                  </dl>
                </details>
              </>
            ) : (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Accepted" value={`${formatNumber(summary.counts?.accepted ?? summary.counts?.generated)}/${formatNumber(summary.counts?.target)}`} />
                  <MetricCard label="Gates" value={formatNumber(summary.counts?.gates_executed)} />
                  <MetricCard label="Lineages" value={formatNumber(summary.counts?.lineage_verified)} />
                  <MetricCard label="Wall clock" value={formatDuration(summary.timings?.total_wall_clock_ms)} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Main noninterference" value={summary.production_noninterference_passed === true ? "Passed" : summary.production_noninterference_passed === false ? "Failed" : "Unavailable"} />
                  <MetricCard label="Threads mutations" value={formatNumber(summary.threads_mutation_count)} />
                  <MetricCard label="Source replacements" value={formatNumber(summary.counts?.source_replacements)} />
                  <MetricCard label="Benchmark" value={summary.benchmark_passed === true ? "Passed" : summary.benchmark_passed === false ? "Failed" : "Unavailable"} />
                </div>
                <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">Innovation technical identity</summary>
                  <dl className="mt-3">
                    <KeyValue label="Scenario" value={titleCase(summary.scenario)} />
                    <KeyValue label="Variant" value={titleCase(summary.variant_key)} />
                    <KeyValue label="Challenged Main" value={summary.challenged_main_version || "Unavailable"} />
                    <KeyValue label="Promotion destination" value={summary.promotion_destination_version || "Not promoted"} />
                    <KeyValue label="Tested SHA" value={<code className="break-all text-xs">{summary.tested_sha || "Unavailable"}</code>} />
                    <KeyValue label="Snapshot hash" value={<code className="break-all text-xs">{summary.snapshot_hash || "Unavailable"}</code>} />
                    <KeyValue label="Stage events" value={formatNumber(summary.stage_event_count)} />
                    <KeyValue label="Started" value={formatDate(summary.started_at)} />
                    <KeyValue label="Completed" value={formatDate(summary.completed_at)} />
                  </dl>
                </details>
              </>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Cycle slot audit</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">Scheduled output and source evidence</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Each Main slot separates the generated scheduled post from the locked source that informed it. Exact-source history describes that specific Saved Pattern identity, not the broader hook or mechanism across the account.
                </p>
              </div>
              {selections?.selected_count !== undefined ? (
                <div className="flex flex-wrap gap-2">
                  <Badge>{formatNumber(selections.selected_count)} selected</Badge>
                  <Badge>{formatNumber(selections.filtered_count ?? selections.selected_count)} in view</Badge>
                </div>
              ) : null}
            </div>

                        <CycleGlossary />

            {supportedFilters.length ? (

              <div className="mt-5 flex flex-wrap gap-2" aria-label="Source-selection filters">
                <button
                  type="button"
                  onClick={() => setFilter("")}
                  className={[
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    !filter ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-500",
                  ].join(" ")}
                >
                  All
                </button>
                {supportedFilters.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      filter === value ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-500",
                    ].join(" ")}
                                    >
                    {filterLabel(value)}
                  </button>

                ))}
              </div>
            ) : null}

            {selectionsLoading ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Loading source-selection receipts...</div>
            ) : selectionsError ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{selectionsError}</div>
            ) : selections?.audit_status === "unavailable" ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Selection audit unavailable</p>
                <p className="mt-1 text-sm text-amber-800">{titleCase(selections.unavailable_reason)}. No explanation was inferred.</p>
              </div>
            ) : !selections?.rows?.length ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                {selectedId ? "No persisted source-selection rows match this view." : "Select a cycle to inspect its source selections."}
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {selections.rows.map((row, index) => {
                  const slotKey = row.slot_key || `selection-${index}`;
                  const detailKey = selectedId ? `${rail}:${selectedId}:${slotKey}` : "";
                  const detailResponse = detailKey ? detailCache[detailKey] : null;
                  const detail = detailResponse?.selection ?? null;
                  const expanded = expandedSlot === slotKey;
                  const score = typeof row.score === "number" && Number.isFinite(row.score) ? row.score.toFixed(2) : "Unavailable";
                  return (
                    <article key={`${slotKey}-${row.source_card_id || index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <button
                        type="button"
                        onClick={() => void toggleSelectionDetail(slotKey)}
                        aria-expanded={expanded}
                        className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-slate-50 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-sm font-semibold text-slate-950">{slotLabel(row.slot_key)}</span>
                                                        {row.scheduled_generation_mode ? (
                              <Badge title={executionModeCopy(row.scheduled_generation_mode).description}>
                                Execution mode: {executionModeCopy(row.scheduled_generation_mode).label}
                              </Badge>
                            ) : null}
                            <Badge title={allocationCopy(row.allocation_tier).description}>
                              Selection lane: {allocationCopy(row.allocation_tier).label}
                            </Badge>
                            <Badge title={exactSourceStatusCopy(row.audition_state || row.family_state).description}>
                              Exact-source status: {exactSourceStatusCopy(row.audition_state || row.family_state).label}
                            </Badge>

                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-900">
                            {row.scheduled_post_text || row.source_shorthand || row.source_title || "Scheduled output unavailable"}
                          </p>
                          {row.scheduled_post_text ? (
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                              <span className="font-semibold text-slate-600">Source used:</span> {row.source_shorthand || row.source_title || "Source text unavailable"}
                            </p>
                          ) : null}
                          {row.persisted_reason ? <p className="mt-2 text-xs text-slate-500">{row.persisted_reason}</p> : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                          <div className="text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Score</p>
                            <p className="mt-1 text-lg font-semibold text-slate-950">{score}</p>
                          </div>
                          <span className="text-xs font-semibold text-slate-600">{expanded ? "Hide details" : "Open details"}</span>
                        </div>
                      </button>

                      {expanded ? (
                        <div className="border-t border-slate-200 bg-slate-50 p-4 sm:p-5">
                          {detailLoadingSlot === slotKey ? (
                            <p className="text-sm text-slate-600">Loading exact persisted receipt...</p>
                          ) : detailError && !detail ? (
                            <p className="text-sm text-rose-700">{detailError}</p>
                          ) : detailResponse?.audit_status === "unavailable" || !detail ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                              Detailed receipt unavailable. No replacement explanation was generated.
                            </div>
                          ) : (
                                                        <div className="space-y-5">
                              {detail.scheduled_post_text ? (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Scheduled output</p>
                                  <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-7 text-slate-950">{detail.scheduled_post_text}</p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                                                        <Badge title={executionModeCopy(detail.scheduled_generation_mode).description}>
                                      Execution mode: {executionModeCopy(detail.scheduled_generation_mode).label}
                                    </Badge>

                                    <Badge>Status: {titleCase(detail.scheduled_post_status)}</Badge>
                                    {detail.scheduled_post_id ? <Badge>Post #{formatNumber(detail.scheduled_post_id)}</Badge> : null}
                                  </div>
                                </div>
                              ) : null}

                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Exact source used</p>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-900">{detail.source_text || "Unavailable"}</p>
                              </div>

                              <div className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <h3 className="text-sm font-semibold text-slate-950">Why it qualified</h3>
                                  <p className="mt-3 text-sm leading-6 text-slate-700">{detail.persisted_reason || "A concise persisted reason is unavailable for this historical receipt."}</p>
                                  <dl className="mt-3">
                                                                                                            <KeyValue label="Exact-source status" value={exactSourceStatusCopy(detail.audition_state || detail.family_state).label} />
                                    <KeyValue label="What that means" value={exactSourceStatusCopy(detail.audition_state || detail.family_state).description} />
                                    <KeyValue label="History scope" value="This exact Saved Pattern identity only, not the broader hook or mechanism" />
                                    <KeyValue label="Selection lane" value={allocationCopy(detail.allocation_tier).label} />
                                    <KeyValue label="Why that lane" value={allocationCopy(detail.allocation_tier).description} />

                                    <KeyValue label="Selector" value={detail.engine_version || "Unavailable"} />
                                    <KeyValue label="Policy" value={detail.preselection_policy_version || "Unavailable"} />
                                    <KeyValue label="Policy hash" value={<code className="break-all text-xs">{detail.preselection_policy_hash || "Unavailable"}</code>} />
                                  </dl>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <h3 className="text-sm font-semibold text-slate-950">Source contract</h3>
                                  <dl className="mt-3">
                                    <KeyValue label="Mechanism" value={detail.source_mechanism || "Unavailable"} />
                                    <KeyValue label="Required product" value={detail.required_product || "Unavailable"} />
                                    <KeyValue label="Direction" value={detail.recommended_direction || "Unavailable"} />
                                    <KeyValue label="Source card" value={<code className="break-all text-xs">{detail.source_card_id || "Unavailable"}</code>} />
                                    <KeyValue label="Family" value={<code className="break-all text-xs">{detail.source_card_family_id || "Unavailable"}</code>} />
                                  </dl>
                                </div>
                              </div>

                              <div className="grid gap-4 lg:grid-cols-3">
                                <details className="rounded-2xl border border-slate-200 bg-white p-4" open>
                                  <summary className="cursor-pointer text-sm font-semibold text-slate-950">Score factors</summary>
                                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-700">{JSON.stringify(detail.score_factors ?? {}, null, 2)}</pre>
                                </details>
                                <details className="rounded-2xl border border-slate-200 bg-white p-4" open>
                                  <summary className="cursor-pointer text-sm font-semibold text-slate-950">Exposure checks</summary>
                                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-700">{JSON.stringify(detail.exposure_checks ?? {}, null, 2)}</pre>
                                </details>
                                <details className="rounded-2xl border border-slate-200 bg-white p-4" open>
                                  <summary className="cursor-pointer text-sm font-semibold text-slate-950">Audition state</summary>
                                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-700">{JSON.stringify(detail.audition ?? {}, null, 2)}</pre>
                                </details>
                              </div>

                              <details className="rounded-2xl border border-slate-200 bg-white p-4">
                                <summary className="cursor-pointer text-sm font-semibold text-slate-950">Causal signals and exclusions</summary>
                                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-700">{JSON.stringify(detail.causal_signals ?? "Unavailable", null, 2)}</pre>
                                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-700">{JSON.stringify(detail.hard_exclusions ?? "Unavailable", null, 2)}</pre>
                                </div>
                              </details>

                              <details className="rounded-2xl border border-slate-200 bg-white p-4">
                                <summary className="cursor-pointer text-sm font-semibold text-slate-950">Exact persisted receipt</summary>
                                {detail.persisted_receipt?.available ? (
                                  <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{JSON.stringify(detail.persisted_receipt.value ?? {}, null, 2)}</pre>
                                ) : (
                                  <p className="mt-3 text-sm text-amber-700">Receipt unavailable: {titleCase(detail.persisted_receipt?.reason)}</p>
                                )}
                                <p className="mt-3 text-xs text-slate-500">Receipt bytes: {formatNumber(detail.persisted_receipt?.bytes)}</p>
                              </details>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}

            {selections?.hidden_count ? (
              <div className="mt-5 flex justify-center border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Show all {formatNumber(selections.filtered_count ?? selections.selected_count)}
                </button>
              </div>
            ) : showAll && (selections?.selected_count ?? 0) > 6 ? (
              <div className="mt-5 flex justify-center border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAll(false);
                    setExpandedSlot(null);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-500"
                >
                  Show first 6
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
}
