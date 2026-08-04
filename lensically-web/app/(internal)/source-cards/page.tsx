"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";
import {
  appendThreadsUserId,
  readSelectedThreadsUserId,
  SELECTED_THREADS_ACCOUNT_EVENT,
} from "@/lib/selectedThreadsAccount";

type SourceCardRow = {
  id: string;
  family_id?: string | null;
  lane_key?: string | null;
  title?: string;
  status?: string;
  source_text?: string;
  source_mechanism?: string | null;
  required_product?: string | null;
  recommended_direction?: string | null;
  created_by?: string | null;
  version_number?: number;
  is_current?: boolean;
  locked_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  source_origin?: {
    type?: string;
    internal_source_id?: string | null;
    source_identity_key?: string | null;
    canonical_source_url?: string | null;
  } | null;
  lifecycle?: {
    label?: string;
    confidence?: string;
    sample_size?: number;
    lifetime_index?: number;
    probability_above_median?: number;
  } | null;
  transformation_contract?: {
    must_preserve_exact?: string[];
    must_preserve_function?: string[];
    may_reuse?: string[];
    should_transform?: string[];
    must_transform?: string[];
    audience_reward?: string;
    notes?: string | null;
  } | null;
  owner_guidance?: { text?: string; active?: boolean } | null;
  generation_run_count?: number;
};

type SourceCardsResponse = {
  cards?: SourceCardRow[];
  total?: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
  error?: string;
};

type CreateForm = {
  title: string;
  sourceText: string;
  sourceUrl: string;
  sourceMechanism: string;
  requiredProduct: string;
  audienceReward: string;
  recommendedDirection: string;
  preserveRules: string;
  mustTransform: string;
  forbiddenSurfaces: string;
  ownerGuidance: string;
};

const SOURCE_CARDS_URL = buildWorkerUrl("/api/source-cards/list");
const CREATE_SOURCE_CARD_URL = buildWorkerUrl("/api/source-cards/create");
const SOURCE_CARD_GUIDANCE_URL = buildWorkerUrl("/api/source-cards/guidance");
const APP_USER_ID = "lensically";
const PAGE_SIZE = 20;

const EMPTY_FORM: CreateForm = {
  title: "",
  sourceText: "",
  sourceUrl: "",
  sourceMechanism: "",
  requiredProduct: "",
  audienceReward: "",
  recommendedDirection: "",
  preserveRules: "",
  mustTransform: "",
  forbiddenSurfaces: "",
  ownerGuidance: "",
};

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(parsed));
}

function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    typeof value === "number" && Number.isFinite(value) ? value : 0,
  );
}

function originLabel(value: string | undefined): string {
  switch (value) {
    case "saved_pattern":
      return "Saved Pattern";
    case "owner_source_card":
      return "Owner Created";
    case "operator_hypothesis":
      return "Model Created";
    default:
      return value ? value.replaceAll("_", " ") : "Source Card";
  }
}

export default function SourceCardsPage() {
  const [cards, setCards] = useState<SourceCardRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentOnly, setCurrentOnly] = useState(false);
  const [threadsUserId, setThreadsUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [guidanceDrafts, setGuidanceDrafts] = useState<Record<string, string>>({});
  const [savingGuidanceId, setSavingGuidanceId] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const baseUrl = `${SOURCE_CARDS_URL}?app_user_id=${encodeURIComponent(APP_USER_ID)}&page=${page}&limit=${PAGE_SIZE}&current_only=${currentOnly}`;
      const response = await fetch(appendThreadsUserId(baseUrl, threadsUserId), {
        cache: "no-store",
        credentials: "include",
      });
      const data = (await response.json().catch(() => null)) as SourceCardsResponse | null;
      if (!response.ok) throw new Error(data?.error || "Could not load source cards.");
      const nextCards = Array.isArray(data?.cards) ? data.cards : [];
      setCards(nextCards);
      setTotal(typeof data?.total === "number" ? data.total : nextCards.length);
      setTotalPages(Math.max(1, Number(data?.total_pages ?? 1)));
      setGuidanceDrafts((current) => {
        const next = { ...current };
        for (const card of nextCards) {
          if (!(card.id in next)) next[card.id] = card.owner_guidance?.text ?? "";
        }
        return next;
      });
    } catch (loadError) {
      setCards([]);
      setTotal(0);
      setTotalPages(1);
      setError(loadError instanceof Error ? loadError.message : "Could not load source cards.");
    } finally {
      setLoading(false);
    }
  }, [currentOnly, page, threadsUserId]);

  useEffect(() => {
    setThreadsUserId(readSelectedThreadsUserId());
    const handleSelectedAccount = (event: Event) => {
      const nextId = (event as CustomEvent<{ threadsUserId?: string }>).detail?.threadsUserId?.trim() ?? "";
      setThreadsUserId(nextId);
      setPage(1);
      setExpandedId(null);
    };
    window.addEventListener(SELECTED_THREADS_ACCOUNT_EVENT, handleSelectedAccount);
    return () => window.removeEventListener(SELECTED_THREADS_ACCOUNT_EVENT, handleSelectedAccount);
  }, []);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const pageLabel = useMemo(() => {
    if (!total) return "No source cards";
    const first = (page - 1) * PAGE_SIZE + 1;
    const last = Math.min(total, first + cards.length - 1);
    return `${formatNumber(first)}–${formatNumber(last)} of ${formatNumber(total)}`;
  }, [cards.length, page, total]);

  function updateForm<K extends keyof CreateForm>(field: K, value: CreateForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createSourceCard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(CREATE_SOURCE_CARD_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_user_id: APP_USER_ID,
          threads_user_id: threadsUserId,
          title: form.title,
          source_text: form.sourceText,
          source_url: form.sourceUrl || null,
          source_mechanism: form.sourceMechanism,
          required_product: form.requiredProduct,
          audience_reward: form.audienceReward,
          recommended_direction: form.recommendedDirection || null,
          must_preserve_function: splitLines(form.preserveRules),
          must_transform: splitLines(form.mustTransform),
          forbidden_surfaces: splitLines(form.forbiddenSurfaces),
          owner_guidance: form.ownerGuidance || null,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Could not create source card.");
      setForm(EMPTY_FORM);
      setShowCreate(false);
      setCurrentOnly(false);
      setPage(1);
      setMessage("Source card created, locked, and available to selection.");
      await loadCards();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create source card.");
    } finally {
      setCreating(false);
    }
  }

  async function saveGuidance(cardId: string, active: boolean) {
    setSavingGuidanceId(cardId);
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
          source_card_id: cardId,
          guidance_text: guidanceDrafts[cardId] ?? "",
          active,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Could not save source-card guidance.");
      setMessage(active ? "Permanent source-card guidance saved." : "Source-card guidance disabled.");
      await loadCards();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save source-card guidance.");
    } finally {
      setSavingGuidanceId(null);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950">Source Cards</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Every source card is a first-class reusable source. Its origin can be a Saved Pattern, an owner-created concept, or a previously permitted model-created source; performance stays attached only to its exact family.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
            <button
              type="button"
              onClick={() => { setCurrentOnly(false); setPage(1); }}
              className={`rounded-md px-3 py-2 text-sm font-medium ${!currentOnly ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              All Versions
            </button>
            <button
              type="button"
              onClick={() => { setCurrentOnly(true); setPage(1); }}
              className={`rounded-md px-3 py-2 text-sm font-medium ${currentOnly ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              Current Only
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((value) => !value)}
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {showCreate ? "Close Creator" : "Create Source Card"}
          </button>
        </div>
      </header>

      {showCreate ? (
        <form onSubmit={createSourceCard} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Create an owner source card</h2>
            <p className="mt-1 text-sm text-slate-600">
              This creates a locked, selectable exact source family. It does not generate or schedule a post.
            </p>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-medium text-slate-800">
              Title
              <input required value={form.title} onChange={(event) => updateForm("title", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" placeholder="Finger-touch money news" />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Optional reference URL
              <input value={form.sourceUrl} onChange={(event) => updateForm("sourceUrl", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" placeholder="https://..." />
            </label>
            <label className="lg:col-span-2 text-sm font-medium text-slate-800">
              Source or concept
              <textarea required rows={4} value={form.sourceText} onChange={(event) => updateForm("sourceText", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" placeholder="Write the original source, concept, format, or idea this card represents." />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Why it works
              <textarea required rows={4} value={form.sourceMechanism} onChange={(event) => updateForm("sourceMechanism", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" placeholder="Explain the mechanism that makes this source effective." />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Required output
              <textarea required rows={4} value={form.requiredProduct} onChange={(event) => updateForm("requiredProduct", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" placeholder="Describe what a generated post must deliver." />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Audience reward
              <textarea required rows={3} value={form.audienceReward} onChange={(event) => updateForm("audienceReward", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" placeholder="What does the reader feel or receive?" />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Recommended direction
              <textarea rows={3} value={form.recommendedDirection} onChange={(event) => updateForm("recommendedDirection", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" placeholder="Optional execution direction." />
            </label>
            <label className="text-sm font-medium text-slate-800">
              What must remain
              <textarea rows={4} value={form.preserveRules} onChange={(event) => updateForm("preserveRules", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" placeholder="One preservation rule per line. The mechanism is preserved by default." />
            </label>
            <label className="text-sm font-medium text-slate-800">
              What must change
              <textarea rows={4} value={form.mustTransform} onChange={(event) => updateForm("mustTransform", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" placeholder="One transformation rule per line." />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Forbidden surfaces
              <textarea rows={4} value={form.forbiddenSurfaces} onChange={(event) => updateForm("forbiddenSurfaces", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" placeholder="One prohibited surface per line." />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Permanent owner guidance
              <textarea rows={4} value={form.ownerGuidance} onChange={(event) => updateForm("ownerGuidance", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" placeholder="Optional instructions that should always accompany this source card." />
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <button disabled={creating} type="submit" className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
              {creating ? "Creating..." : "Create and Lock Source Card"}
            </button>
          </div>
        </form>
      ) : null}

      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</div> : null}

      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-slate-800">{loading ? "Loading source cards..." : pageLabel}</span>
          <span className="text-slate-500">Page {page} of {totalPages}</span>
        </div>
      </section>

      <section className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading source cards...</div>
        ) : cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <h2 className="font-semibold text-slate-950">No source cards found</h2>
            <p className="mt-2 text-sm text-slate-600">Create one here or generate one from a Saved Pattern.</p>
          </div>
        ) : cards.map((card) => {
          const expanded = expandedId === card.id;
          const lifecycleLabel = String(card.lifecycle?.label ?? "untested").replaceAll("_", " ");
          return (
            <article key={card.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-950">{card.title || "Source card"}</h2>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">{originLabel(card.source_origin?.type)}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">{lifecycleLabel}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${card.is_current ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {card.is_current ? "Current" : `Version ${card.version_number ?? 1}`}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{card.source_text || "No source text recorded."}</p>
                </div>
                <button type="button" onClick={() => setExpandedId(expanded ? null : card.id)} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {expanded ? "Hide Details" : "View Details"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">24-hour samples</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{formatNumber(card.lifecycle?.sample_size)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">Unified index</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{formatNumber(card.lifecycle?.lifetime_index)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">Generation runs</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{formatNumber(card.generation_run_count)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">Updated</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-950">{formatDate(card.updated_at)}</p>
                </div>
              </div>

              {expanded ? (
                <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <h3 className="text-sm font-semibold text-slate-950">Why it works</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{card.source_mechanism || "Not recorded."}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <h3 className="text-sm font-semibold text-slate-950">Required output</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{card.required_product || "Not recorded."}</p>
                    </div>
                  </div>
                  {card.recommended_direction ? (
                    <div className="rounded-xl border border-slate-200 p-4">
                      <h3 className="text-sm font-semibold text-slate-950">Recommended direction</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{card.recommended_direction}</p>
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-950">Exact lineage</h3>
                    <dl className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                      <div><dt className="text-xs text-slate-500">Source card ID</dt><dd className="mt-1 break-all font-medium">{card.id}</dd></div>
                      <div><dt className="text-xs text-slate-500">Family ID</dt><dd className="mt-1 break-all font-medium">{card.family_id || "None"}</dd></div>
                      <div><dt className="text-xs text-slate-500">Source identity</dt><dd className="mt-1 break-all font-medium">{card.source_origin?.source_identity_key || "None"}</dd></div>
                      <div><dt className="text-xs text-slate-500">Created by</dt><dd className="mt-1 font-medium capitalize">{card.created_by || "Unknown"}</dd></div>
                    </dl>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <label htmlFor={`guidance-${card.id}`} className="text-sm font-semibold text-slate-950">Permanent owner guidance</label>
                    <p className="mt-1 text-xs text-slate-500">This remains attached to this exact source card and does not transfer to similar cards.</p>
                    <textarea id={`guidance-${card.id}`} rows={6} value={guidanceDrafts[card.id] ?? ""} onChange={(event) => setGuidanceDrafts((current) => ({ ...current, [card.id]: event.target.value }))} className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950" placeholder="Write permanent guidance for this exact source card." />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={savingGuidanceId === card.id || !(guidanceDrafts[card.id] ?? "").trim()} onClick={() => void saveGuidance(card.id, true)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                        {savingGuidanceId === card.id ? "Saving..." : "Save Guidance"}
                      </button>
                      {card.owner_guidance?.active ? (
                        <button type="button" disabled={savingGuidanceId === card.id} onClick={() => void saveGuidance(card.id, false)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">Disable Guidance</button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <nav className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm" aria-label="Source card pagination">
        <button type="button" disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
        <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
        <button type="button" disabled={loading || page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
      </nav>
    </div>
  );
}
