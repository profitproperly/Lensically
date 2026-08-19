"use client";

import { useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/api";

type Source = {
  source_id: string;
  vendor: string;
  product: string;
  source_type: string;
  canonical_url: string;
  enabled: number;
  priority: number;
  poll_interval_minutes: number;
  last_checked_at: string | null;
  last_changed_at: string | null;
  last_http_status: number | null;
  last_content_hash: string | null;
  last_error: string | null;
};

type Signal = {
  signal_id: string;
  source_id: string;
  vendor: string;
  product: string;
  category: string;
  title: string;
  summary: string;
  evidence_json: string;
  confidence: number;
  importance: number;
  status: string;
  published_at: string | null;
  detected_at: string;
};

type Run = {
  run_id: string;
  started_at: string;
  completed_at: string | null;
  source_count: number;
  checked_count: number;
  changed_count: number;
  signal_count: number;
  error_count: number;
  status: string;
};

type Overview = {
  success: boolean;
  generated_at: string;
  poll_cadence_minutes: number;
  sources: Source[];
  signals: Signal[];
  latest_run: Run | null;
};

function formatTime(value: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function evidenceLines(value: string) {
  try {
    const parsed = JSON.parse(value) as { added_lines?: string[]; removed_lines?: string[] };
    return [...(parsed.added_lines || []), ...(parsed.removed_lines || [])].slice(0, 6);
  } catch {
    return [];
  }
}

export default function SignalRadarPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vendor, setVendor] = useState("all");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    let cancelled = false;
    fetch(buildWorkerUrl("/api/signal-radar/overview?limit=80"), {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Signal Radar request failed (${response.status})`);
        return response.json() as Promise<Overview>;
      })
      .then((overview) => {
        if (!cancelled) setData(overview);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const vendors = useMemo(() => {
    return [...new Set((data?.sources || []).map((source) => source.vendor))].sort();
  }, [data]);

  const categories = useMemo(() => {
    return [...new Set((data?.signals || []).map((signal) => signal.category))].sort();
  }, [data]);

  const filteredSignals = useMemo(() => {
    return (data?.signals || []).filter((signal) => {
      return (vendor === "all" || signal.vendor === vendor) && (category === "all" || signal.category === category);
    });
  }, [data, vendor, category]);

  const enabledSources = (data?.sources || []).filter((source) => source.enabled === 1);
  const healthySources = enabledSources.filter((source) => source.last_checked_at && !source.last_error);
  const newSignals = (data?.signals || []).filter((signal) => signal.status === "new");

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Intelligence</p>
        <h1 className="text-3xl font-semibold tracking-tight">Signal Radar</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          First-party change detection across AI coding agents, models, and developer platforms. Sources are checked independently of this dashboard.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      ) : null}

      {!data && !error ? <div className="text-sm text-muted-foreground">Loading Signal Radar…</div> : null}

      {data ? (
        <div className="space-y-8">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Enabled sensors", String(enabledSources.length)],
              ["Healthy sensors", `${healthySources.length}/${enabledSources.length}`],
              ["New signals", String(newSignals.length)],
              ["Last run errors", String(data.latest_run?.error_count ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </section>

          <section className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Collection status</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Hourly cadence · Latest run {data.latest_run ? formatTime(data.latest_run.started_at) : "not yet recorded"}
                </p>
              </div>
              {data.latest_run ? (
                <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">{data.latest_run.status}</span>
              ) : null}
            </div>
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Latest signals</h2>
                <p className="text-sm text-muted-foreground">Qualified changes detected after each source baseline is established.</p>
              </div>
              <div className="flex gap-2">
                <select value={vendor} onChange={(event) => setVendor(event.target.value)} className="rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="all">All vendors</option>
                  {vendors.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="all">All categories</option>
                  {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>

            {filteredSignals.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
                No material changes have been detected yet. Initial fetches seed source baselines and do not manufacture alerts.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSignals.map((signal) => (
                  <article key={signal.signal_id} className="rounded-xl border bg-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{signal.vendor}</span><span>·</span><span>{signal.product}</span><span>·</span><span>{signal.category}</span>
                        </div>
                        <h3 className="mt-2 font-semibold">{signal.title}</h3>
                      </div>
                      <span className="rounded-full border px-2.5 py-1 text-xs">Importance {signal.importance}</span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{signal.summary}</p>
                    {evidenceLines(signal.evidence_json).length ? (
                      <ul className="mt-4 space-y-1 border-l pl-4 text-xs text-muted-foreground">
                        {evidenceLines(signal.evidence_json).map((line, index) => <li key={`${signal.signal_id}-${index}`}>{line}</li>)}
                      </ul>
                    ) : null}
                    <p className="mt-4 text-xs text-muted-foreground">Detected {formatTime(signal.detected_at)}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Source health</h2>
              <p className="text-sm text-muted-foreground">The registry is the current first-wave monitoring surface.</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {(data.sources || []).map((source) => (
                <a key={source.source_id} href={source.canonical_url} target="_blank" rel="noreferrer" className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{source.vendor} · {source.product}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{source.source_type} · every {source.poll_interval_minutes} min</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{source.enabled ? (source.last_error ? "Error" : source.last_checked_at ? "Healthy" : "Pending") : "Adapter pending"}</span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Last checked: {formatTime(source.last_checked_at)}</p>
                  {source.last_error ? <p className="mt-2 text-xs text-destructive">{source.last_error}</p> : null}
                </a>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
