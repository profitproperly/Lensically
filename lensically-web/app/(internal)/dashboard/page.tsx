"use client";

import { useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";

type RankedPost = {
  id: string;
  preview: string;
  timestamp: string | null;
  permalink: string | null;
  metric: number;
};

type DashboardResponse = {
  generated_at?: string;
  timezone?: string;
  profile?: {
    username?: string | null;
    name?: string | null;
    biography?: string | null;
    is_verified?: boolean;
    threads_profile_picture_url?: string | null;
    follower_count?: number | null;
  } | null;
  today?: {
    date?: string;
    followers_gained?: number;
    posts_published?: number;
    posts_scheduled?: number;
    remaining_posts?: number;
    next_scheduled_post_utc?: string | null;
    total_engagement?: number;
    total_views?: number;
    total_likes?: number;
    total_replies?: number;
    total_reposts?: number;
    total_follower_gain?: number;
  } | null;
  follower_growth?: {
    today_gain?: number;
    yesterday_gain?: number;
    seven_day_average_gain?: number;
    best_day?: {
      date?: string;
      gain?: number;
    } | null;
    trend?: Array<{
      date: string;
      followers_count: number;
      gain: number;
    }>;
  } | null;
  winners_24h?: {
    by_likes?: RankedPost[];
    by_views?: RankedPost[];
    by_replies?: RankedPost[];
    by_reposts?: RankedPost[];
  } | null;
  winners_7d?: {
    by_likes?: RankedPost[];
    by_views?: RankedPost[];
    by_replies?: RankedPost[];
    by_reposts?: RankedPost[];
  } | null;
  batch_health?: {
    hit_rate?: {
      threshold_likes?: number;
      hits?: number;
      total?: number;
    } | null;
    weak_posts?: Array<{
      id: string;
      preview: string;
      timestamp: string | null;
      permalink: string | null;
      views: number;
      likes: number;
      replies: number;
      reposts: number;
      reasons: string[];
    }>;
    winning_language?: {
      repeated_terms?: string[];
      repeated_phrases?: string[];
      repeated_openings?: string[];
    } | null;
    content_fatigue?: {
      duplicate_openings?: Array<{ phrase: string; count: number }>;
      repeated_sentence_shells?: Array<{ pattern: string; count: number }>;
      overused_words?: Array<{ word: string; count: number }>;
    } | null;
    batch_score?: {
      reach?: "weak" | "medium" | "strong";
      engagement?: "weak" | "medium" | "strong";
      follower_conversion?: "weak" | "medium" | "strong";
      overall?: number;
    } | null;
  } | null;
  error?: string;
};

const THREADS_DASHBOARD_URL = buildWorkerUrl("/api/threads/dashboard");

function formatMetric(value: number | null | undefined): string {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US").format(safeValue);
}

function formatSignedMetric(value: number | null | undefined): string {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (safeValue > 0) {
    return `+${formatMetric(safeValue)}`;
  }
  return formatMetric(safeValue);
}

function formatTimestamp(value: string | null | undefined, timeZone = "America/New_York"): string {
  if (!value) {
    return "Unknown time";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(parsed));
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) {
    return "Unknown date";
  }

  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(parsed));
}

function statusClasses(value: "weak" | "medium" | "strong" | null | undefined): string {
  if (value === "strong") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (value === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-rose-200 bg-rose-50 text-rose-800";
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-sm text-slate-500">
      {label}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate-600">{hint}</p> : null}
    </div>
  );
}

function RankedPostsColumn({
  title,
  posts,
  timeZone,
}: {
  title: string;
  posts: RankedPost[] | undefined;
  timeZone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="text-xs uppercase tracking-wide text-slate-400">Top 5</span>
      </div>
      <div className="mt-4 space-y-3">
        {!posts?.length ? (
          <p className="text-sm text-slate-500">No posts in this window.</p>
        ) : (
          posts.map((post, index) => (
            <article key={`${title}-${post.id}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white">
                  #{index + 1}
                </span>
                <span className="text-sm font-semibold text-slate-900">{formatMetric(post.metric)}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-800">{post.preview}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>{formatTimestamp(post.timestamp, timeZone)}</span>
                {post.permalink ? (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
                  >
                    Open
                  </a>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(THREADS_DASHBOARD_URL, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });

        const data = (await response.json().catch(() => null)) as DashboardResponse | null;
        if (!response.ok) {
          throw new Error(data?.error || "Could not load dashboard.");
        }

        setDashboard(data);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }
        setDashboard(null);
        setError(loadError instanceof Error ? loadError.message : "Could not load dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      controller.abort();
    };
  }, []);

  const timeZone = dashboard?.timezone || "America/New_York";
  const profile = dashboard?.profile;
  const today = dashboard?.today;
  const followerGrowth = dashboard?.follower_growth;
  const batchHealth = dashboard?.batch_health;

  const trend = useMemo(() => dashboard?.follower_growth?.trend ?? [], [dashboard]);
  const maxGain = useMemo(
    () => Math.max(1, ...trend.map((entry) => Math.max(0, entry.gain))),
    [trend],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-slate-950">Operator Dashboard</h1>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">Loading operator dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-slate-950">Operator Dashboard</h1>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <p className="text-sm text-rose-700">{error || "Could not load dashboard."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.16),_transparent_28%),linear-gradient(135deg,_#0f172a_0%,_#111827_38%,_#f8fafc_38%,_#f8fafc_100%)] p-6 shadow-sm sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200">Growth Control Room</p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {profile?.threads_profile_picture_url ? (
                <img
                  src={profile.threads_profile_picture_url}
                  alt={`${profile.username || "Threads"} avatar`}
                  className="h-16 w-16 rounded-full border border-white/20 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-semibold">
                  {(profile?.name || profile?.username || "MM").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {profile?.name || profile?.username || "Operator Dashboard"}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                  {profile?.username ? <span>@{profile.username}</span> : null}
                  {profile?.is_verified ? (
                    <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-2 py-0.5 text-sky-200">Verified</span>
                  ) : null}
                  <span>Followers {formatMetric(profile?.follower_count)}</span>
                </div>
              </div>
            </div>
            {profile?.biography ? (
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">{profile.biography}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-3xl border border-slate-200/80 bg-white/96 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Batch Score</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-4xl font-semibold text-slate-950">{batchHealth?.batch_score?.overall?.toFixed(1) ?? "0.0"}</p>
                  <p className="mt-2 text-sm text-slate-600">Overall batch grade</p>
                </div>
                <div className="space-y-2 text-right text-xs text-slate-600">
                  <p>Reach: <span className="font-semibold text-slate-900">{batchHealth?.batch_score?.reach ?? "weak"}</span></p>
                  <p>Engagement: <span className="font-semibold text-slate-900">{batchHealth?.batch_score?.engagement ?? "weak"}</span></p>
                  <p>Conversion: <span className="font-semibold text-slate-900">{batchHealth?.batch_score?.follower_conversion ?? "weak"}</span></p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white/96 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Hit Rate</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">
                {formatMetric(batchHealth?.hit_rate?.hits)} / {formatMetric(batchHealth?.hit_rate?.total)}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Posts crossed {formatMetric(batchHealth?.hit_rate?.threshold_likes)} likes in the last 24h batch.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Today</h2>
            <p className="mt-1 text-sm text-slate-600">
              {today?.date ? `Operating day ${today.date}` : "Live operational summary"}
            </p>
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Refreshed {formatTimestamp(dashboard.generated_at, timeZone)}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Followers Gained" value={formatSignedMetric(today?.followers_gained)} />
          <MetricCard label="Posts Published" value={formatMetric(today?.posts_published)} />
          <MetricCard label="Posts Scheduled" value={formatMetric(today?.posts_scheduled)} hint={`${formatMetric(today?.remaining_posts)} remaining`} />
          <MetricCard
            label="Next Scheduled"
            value={today?.next_scheduled_post_utc ? formatTimestamp(today.next_scheduled_post_utc, timeZone) : "None"}
          />
          <MetricCard label="Total Engagement" value={formatMetric(today?.total_engagement)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <MetricCard label="Views Today" value={formatMetric(today?.total_views)} />
          <MetricCard label="Likes Today" value={formatMetric(today?.total_likes)} />
          <MetricCard label="Replies Today" value={formatMetric(today?.total_replies)} />
          <MetricCard label="Reposts Today" value={formatMetric(today?.total_reposts)} />
          <MetricCard label="Follower Gain Today" value={formatSignedMetric(today?.total_follower_gain)} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Growth Trend</h2>
              <p className="mt-1 text-sm text-slate-600">Follower gains by day.</p>
            </div>
            {followerGrowth?.best_day ? (
              <div className="text-right text-xs text-slate-500">
                <p className="font-medium text-slate-900">Best day</p>
                <p>{formatShortDate(followerGrowth.best_day.date)} • {formatSignedMetric(followerGrowth.best_day.gain)}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Today</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{formatSignedMetric(followerGrowth?.today_gain)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Yesterday</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{formatSignedMetric(followerGrowth?.yesterday_gain)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">7 Day Avg</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{formatSignedMetric(followerGrowth?.seven_day_average_gain)}</p>
            </div>
          </div>

          <div className="mt-6">
            {!trend.length ? (
              <EmptyState label="Follower history will appear after daily snapshots accumulate." />
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {trend.slice(-7).map((entry) => (
                  <div key={entry.date} className="flex flex-col items-center gap-2">
                    <div className="flex h-36 w-full items-end rounded-2xl border border-slate-200 bg-slate-50 p-2">
                      <div
                        className="w-full rounded-xl bg-[linear-gradient(180deg,_#1d4ed8_0%,_#22c55e_100%)]"
                        style={{ height: `${Math.max(10, (Math.max(0, entry.gain) / maxGain) * 100)}%` }}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-900">{formatSignedMetric(entry.gain)}</p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">{formatShortDate(entry.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Winning Language</h2>
          <p className="mt-1 text-sm text-slate-600">Repeated patterns from strong posts in the last 7 days.</p>

          <div className="mt-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Terms</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {batchHealth?.winning_language?.repeated_terms?.length ? batchHealth.winning_language.repeated_terms.map((term) => (
                  <span key={term} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-800">
                    {term}
                  </span>
                )) : <p className="text-sm text-slate-500">No repeated winning terms yet.</p>}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phrases</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {batchHealth?.winning_language?.repeated_phrases?.length ? batchHealth.winning_language.repeated_phrases.map((phrase) => (
                  <span key={phrase} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm text-sky-800">
                    {phrase}
                  </span>
                )) : <p className="text-sm text-slate-500">No repeated phrases yet.</p>}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Openings</p>
              <div className="mt-2 space-y-2">
                {batchHealth?.winning_language?.repeated_openings?.length ? batchHealth.winning_language.repeated_openings.map((opening) => (
                  <div key={opening} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {opening}
                  </div>
                )) : <p className="text-sm text-slate-500">No repeated openings yet.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Last 24h Winners</h2>
          <p className="mt-1 text-sm text-slate-600">Best posts ranked by metric with preview and post time.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-4">
          <RankedPostsColumn title="By Likes" posts={dashboard.winners_24h?.by_likes} timeZone={timeZone} />
          <RankedPostsColumn title="By Views" posts={dashboard.winners_24h?.by_views} timeZone={timeZone} />
          <RankedPostsColumn title="By Replies" posts={dashboard.winners_24h?.by_replies} timeZone={timeZone} />
          <RankedPostsColumn title="By Reposts" posts={dashboard.winners_24h?.by_reposts} timeZone={timeZone} />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Last 7 Days Winners</h2>
          <p className="mt-1 text-sm text-slate-600">Posts that kept moving after the day ended.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-4">
          <RankedPostsColumn title="By Likes" posts={dashboard.winners_7d?.by_likes} timeZone={timeZone} />
          <RankedPostsColumn title="By Views" posts={dashboard.winners_7d?.by_views} timeZone={timeZone} />
          <RankedPostsColumn title="By Replies" posts={dashboard.winners_7d?.by_replies} timeZone={timeZone} />
          <RankedPostsColumn title="By Reposts" posts={dashboard.winners_7d?.by_reposts} timeZone={timeZone} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Weak Post Detector</h2>
              <p className="mt-1 text-sm text-slate-600">Posts below baseline after a time threshold.</p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              {formatMetric(batchHealth?.weak_posts?.length)} flagged
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {!batchHealth?.weak_posts?.length ? (
              <EmptyState label="No weak posts flagged in the last 24 hours." />
            ) : (
              batchHealth.weak_posts.map((post) => (
                <article key={post.id} className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-800">{formatTimestamp(post.timestamp, timeZone)}</p>
                    {post.permalink ? (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-amber-900 underline decoration-amber-300 underline-offset-2"
                      >
                        Open
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-800">{post.preview}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span>Views {formatMetric(post.views)}</span>
                    <span>Likes {formatMetric(post.likes)}</span>
                    <span>Replies {formatMetric(post.replies)}</span>
                    <span>Reposts {formatMetric(post.reposts)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {post.reasons.map((reason) => (
                      <span key={reason} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs text-amber-900">
                        {reason}
                      </span>
                    ))}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Content Fatigue Warning</h2>
          <p className="mt-1 text-sm text-slate-600">Detect repeated openings, sentence shells, and overused words.</p>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Duplicate Openings</p>
              <div className="mt-3 space-y-2">
                {batchHealth?.content_fatigue?.duplicate_openings?.length ? batchHealth.content_fatigue.duplicate_openings.map((entry) => (
                  <div key={entry.phrase} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-sm text-slate-800">{entry.phrase}</p>
                    <p className="mt-1 text-xs text-slate-500">{entry.count} uses</p>
                  </div>
                )) : <p className="text-sm text-slate-500">No duplicate openings flagged.</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sentence Shells</p>
              <div className="mt-3 space-y-2">
                {batchHealth?.content_fatigue?.repeated_sentence_shells?.length ? batchHealth.content_fatigue.repeated_sentence_shells.map((entry) => (
                  <div key={entry.pattern} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-sm text-slate-800">{entry.pattern}</p>
                    <p className="mt-1 text-xs text-slate-500">{entry.count} repeats</p>
                  </div>
                )) : <p className="text-sm text-slate-500">No repeated sentence shells flagged.</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Overused Words</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {batchHealth?.content_fatigue?.overused_words?.length ? batchHealth.content_fatigue.overused_words.map((entry) => (
                  <span key={entry.word} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm text-rose-800">
                    {entry.word} ×{entry.count}
                  </span>
                )) : <p className="text-sm text-slate-500">No overused words flagged.</p>}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1 text-sm font-medium ${statusClasses(batchHealth?.batch_score?.reach ?? "weak")}`}>
              Reach: {batchHealth?.batch_score?.reach ?? "weak"}
            </span>
            <span className={`rounded-full border px-3 py-1 text-sm font-medium ${statusClasses(batchHealth?.batch_score?.engagement ?? "weak")}`}>
              Engagement: {batchHealth?.batch_score?.engagement ?? "weak"}
            </span>
            <span className={`rounded-full border px-3 py-1 text-sm font-medium ${statusClasses(batchHealth?.batch_score?.follower_conversion ?? "weak")}`}>
              Follower conversion: {batchHealth?.batch_score?.follower_conversion ?? "weak"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
