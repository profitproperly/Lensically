import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VAULT = path.join(ROOT, "manifest-mental-vault");
const LOCAL_ENV_PATH = path.join(ROOT, ".lensically-agent.env");
const TASTE_MEMORY_PATH = path.join(VAULT, "Lessons", "manifest_mental_taste_memory.json");
const SAVED_PATTERN_MEMORY_PATH = path.join(VAULT, "Lessons", "manifest_mental_saved_pattern_memory.json");
const BATCH_PRESET_SELECTION_PATH = path.join(VAULT, "Context", "selected-batch-preset.json");
const PORT = Number(process.env.MANIFEST_AGENT_DESKTOP_PORT || 4317);
const API_BASE_URL = process.env.LENSICALLY_API_BASE_URL || "https://api.lensically.com";
const ACCOUNT_ID = "manifest-mental";
const SAVED_PATTERNS_APP_USER_ID = "lensically";
const TIMEZONE = "America/New_York";
const GOAL_FOLLOWERS = 1_000_000;
const HERMES_BIN = "/home/brian/.local/bin/hermes";
const HERMES_MODEL = "gpt-5.5";
const HERMES_PROVIDER = "openai-codex";
const DEFAULT_POST_COUNT = 17;
const MAX_POST_COUNT = 200;
const RECENT_TASTE_WINDOW_SIZE = 100;
const RECENT_FATIGUE_WINDOW_SIZE = 40;
const RECENT_A_TIER_RATIO = 0.10;
const RECENT_B_TIER_RATIO = 0.15;
const ALL_TIME_CHAMPION_COUNT = 25;
const SAVED_PATTERN_TOP_COUNT = 25;
const HERMES_CONTEXT_MAX_AGE_HOURS = 24;

let activeRun = null;
let activeHermesChild = null;
let activeHermesKilled = false;

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function log(message, data = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), message, ...data }));
}

async function ensureDirs() {
  for (const name of ["Context", "Runs", "Rejections", "Lessons"]) {
    await fs.mkdir(path.join(VAULT, name), { recursive: true });
  }
}

async function loadLocalEnv() {
  try {
    const raw = await fs.readFile(LOCAL_ENV_PATH, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const splitAt = trimmed.indexOf("=");
      if (splitAt <= 0) continue;
      const key = trimmed.slice(0, splitAt).trim();
      const value = trimmed.slice(splitAt + 1).trim();
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function requireInternalKey() {
  const key = process.env.LENSICALLY_INTERNAL_API_KEY?.trim();
  if (!key) throw new Error("Missing LENSICALLY_INTERNAL_API_KEY in .lensically-agent.env.");
  return key;
}

async function fetchJson(route, options = {}) {
  const response = await fetch(new URL(route, API_BASE_URL), options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) throw new Error(`${route} HTTP ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

async function fetchInternalJson(route) {
  const key = requireInternalKey();
  return fetchJson(route, {
    headers: { "x-internal-key": key },
  });
}

async function fetchLensicallyBatchPresets() {
  const data = await fetchInternalJson("/api/internal/batch-schedule/presets");
  return Array.isArray(data?.presets) ? data.presets : [];
}

async function fetchSavedPatternsPage(order = "newest", limit = 200, page = 1) {
  const safeOrder = String(order ?? "").trim().toLowerCase() === "likes" ? "likes" : "newest";
  const safeLimit = Math.max(1, Math.min(Math.floor(Number(limit ?? 200)) || 200, 200));
  const safePage = Math.max(1, Math.floor(Number(page ?? 1)) || 1);
  return fetchJson(`/api/patterns/list?app_user_id=${encodeURIComponent(SAVED_PATTERNS_APP_USER_ID)}&limit=${safeLimit}&page=${safePage}&order=${encodeURIComponent(safeOrder)}`);
}

async function fetchAllSavedPatterns(order = "newest") {
  const limit = 200;
  const patterns = [];
  let page = 1;
  let totalPages = 1;

  do {
    const data = await fetchSavedPatternsPage(order, limit, page);
    const pagePatterns = Array.isArray(data?.patterns) ? data.patterns : [];
    patterns.push(...pagePatterns);
    totalPages = Math.max(1, numberValue(data?.total_pages) || Math.ceil(numberValue(data?.total) / limit) || 1);
    page += 1;
    if (!pagePatterns.length) break;
  } while (page <= totalPages);

  return patterns;
}

function mergeSavedPatterns(...patternSets) {
  const merged = [];
  const seen = new Set();
  for (const set of patternSets) {
    for (const pattern of Array.isArray(set) ? set : []) {
      const id = String(pattern?.id ?? "").trim();
      const sourceUrl = String(pattern?.source_url ?? "").trim();
      const text = String(pattern?.post_text ?? "").trim();
      const key = id || sourceUrl || text;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(pattern);
    }
  }
  return merged;
}

function dedupeArchivePosts(posts) {
  const deduped = [];
  const seen = new Set();
  for (const post of Array.isArray(posts) ? posts : []) {
    const id = String(post?.id ?? post?.post_id ?? "").trim();
    const permalink = String(post?.permalink ?? "").trim();
    const text = String(post?.text ?? "").trim();
    const timestamp = String(post?.timestamp ?? post?.posted_at ?? "").trim();
    const key = id || permalink || `${timestamp}::${text}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(post);
  }
  return deduped;
}

async function fetchAllArchive(order) {
  const posts = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page += 1) {
    const data = await fetchJson(`/api/threads/posts/archive?order=${encodeURIComponent(order)}&limit=100&page=${page}`);
    const pagePosts = Array.isArray(data.posts) ? data.posts : [];
    posts.push(...pagePosts);
    totalPages = Math.max(1, Number(data.total_pages ?? 0) || Math.ceil(Number(data.total_count ?? data.total ?? data.total_posts ?? data.totalCount ?? 0) / 100) || 1);
    if (!pagePosts.length) break;
  }
  return posts;
}

async function syncLensicallyPostArchive() {
  let cursor = null;
  let hasMore = true;
  let pages = 0;
  let syncedPosts = 0;

  while (hasMore && pages < 250) {
    const route = cursor
      ? `/api/threads/posts?cursor=${encodeURIComponent(cursor)}&cursor_depth=${pages + 1}`
      : "/api/threads/posts";
    const data = await fetchJson(route);
    const posts = Array.isArray(data.posts) ? data.posts : [];
    syncedPosts += posts.length;
    cursor = typeof data.next_cursor === "string" && data.next_cursor.trim() ? data.next_cursor.trim() : null;
    hasMore = Boolean(data.has_more && cursor);
    pages += 1;
  }

  return { pages, synced_posts: syncedPosts };
}

async function syncLensicallyFollowers() {
  const data = await fetchJson("/api/threads/followers?limit=100&page=1");
  return {
    rows: Array.isArray(data.rows) ? data.rows.length : 0,
    total_count: numberValue(data.total_count),
    page_size: numberValue(data.page_size),
  };
}

function numberValue(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function average(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : 0;
}

function parseTimestamp(value) {
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function isoDatePartsInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

function isoDateInTimeZone(date, timeZone) {
  const parts = isoDatePartsInTimeZone(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDaysToIsoDate(isoDate, days) {
  const match = String(isoDate ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const next = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Number(days || 0)));
  return next.toISOString().slice(0, 10);
}

function defaultBatchTargetDate() {
  const today = isoDateInTimeZone(new Date(), TIMEZONE);
  return addDaysToIsoDate(today, 1) ?? today;
}

function normalizeTastePost(post) {
  return {
    post_id: String(post?.id ?? post?.post_id ?? "").trim(),
    posted_at: String(post?.timestamp ?? post?.posted_at ?? "").trim(),
    text: String(post?.text ?? "").trim(),
    likes: numberValue(post?.likes),
  };
}

function normalizeAnalysisText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[â€™’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function legacyTasteSignals(text) {
  const normalized = String(text ?? "").toLowerCase().replace(/[’]/g, "'");
  const words = normalized.split(/\s+/).filter(Boolean);
  return {
    direct_address: /\byou\b|\byour\b|you're|the person reading this/.test(normalized),
    imminent: /about to|going to|soon|this year/.test(normalized),
    money: /money|cash|income|paid|pay|deposit|bank|bill|debt|interest|salary|wealth|rich|overpay/.test(normalized),
    status: /chosen|optional|privilege|appointment|main event|standard|match|access|name|brought up|treated better|treated like|noticed|claim you|priority/.test(normalized),
    concrete_trigger: /message|text|call|email|application|account|bill|charge|deposit|bank|name|room|door|location|phone/.test(normalized),
    short_line: words.length > 0 && words.length <= 12,
  };
}

function tasteSignals(text) {
  const normalized = normalizeAnalysisText(text);
  const words = normalized.split(/\s+/).filter(Boolean);
  return {
    direct_address: /\byou\b|\byour\b|you're|the person reading this/.test(normalized),
    imminent: /about to|going to|soon|this year/.test(normalized),
    money: /money|cash|income|paid|pay|deposit|bank|bill|debt|interest|salary|wealth|rich|overpay/.test(normalized),
    status: /chosen|optional|privilege|appointment|main event|standard|match|access|name|brought up|treated better|treated like|noticed|claim you|priority/.test(normalized),
    concrete_trigger: /message|text|call|email|application|account|bill|charge|deposit|bank|name|room|door|location|phone/.test(normalized),
    short_line: words.length > 0 && words.length <= 12,
  };
}

function analyzePostText(text) {
  const raw = String(text ?? "").trim();
  const normalized = normalizeAnalysisText(raw);
  const words = normalized.split(/\s+/).filter(Boolean);
  const signals = tasteSignals(raw);
  return {
    text: raw,
    opener: words.slice(0, 4).join(" "),
    word_count: words.length,
    line_count: raw ? raw.split(/\n+/).filter((line) => line.trim()).length || 1 : 0,
    direct_address: signals.direct_address,
    imminent: signals.imminent,
    money: signals.money,
    status: signals.status,
    concrete_trigger: signals.concrete_trigger,
    short_line: signals.short_line,
    social_reversal: /ignored|underestimating|underestimated|dismissing|dismissed|regret|expensive mistake|saw it coming|can't undo|cannot undo/.test(normalized),
    authority: /standards|value|respect|chosen|priority|worth protecting|worth waiting|risk losing|optional|privilege/.test(normalized),
    certainty: /about to|will|already|always|never|impossible|refuse|not suggestions|can't undo|cannot undo/.test(normalized),
    contrast: /\bbut\b|\binstead\b|\brather than\b|\bnot\b/.test(normalized),
    caps_emphasis: /\b[A-Z]{3,}\b/.test(raw),
  };
}

function summarizePostAnalyses(analyses) {
  const rows = Array.isArray(analyses) ? analyses.filter((entry) => entry && entry.text) : [];
  const total = rows.length;
  const rate = (predicate) => total ? Number((rows.filter(predicate).length / total).toFixed(3)) : 0;
  const openerCounts = new Map();

  for (const entry of rows) {
    if (!entry.opener) continue;
    openerCounts.set(entry.opener, (openerCounts.get(entry.opener) ?? 0) + 1);
  }

  return {
    total_posts: total,
    average_words: Number(average(rows.map((entry) => entry.word_count)).toFixed(1)),
    average_lines: Number(average(rows.map((entry) => entry.line_count)).toFixed(1)),
    length_buckets: {
      short: rows.filter((entry) => entry.word_count > 0 && entry.word_count <= 12).length,
      medium: rows.filter((entry) => entry.word_count >= 13 && entry.word_count <= 20).length,
      long: rows.filter((entry) => entry.word_count >= 21).length,
    },
    signal_rates: {
      direct_address: rate((entry) => entry.direct_address),
      imminent: rate((entry) => entry.imminent),
      money: rate((entry) => entry.money),
      status: rate((entry) => entry.status),
      concrete_trigger: rate((entry) => entry.concrete_trigger),
      short_line: rate((entry) => entry.short_line),
      social_reversal: rate((entry) => entry.social_reversal),
      authority: rate((entry) => entry.authority),
      certainty: rate((entry) => entry.certainty),
      contrast: rate((entry) => entry.contrast),
      caps_emphasis: rate((entry) => entry.caps_emphasis),
    },
    top_openers: [...openerCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 12)
      .map(([opener, count]) => ({ opener, count })),
  };
}

function summarizeSavedPatternPerformance(patterns, context) {
  const likes = patterns.map((pattern) => numberValue(pattern.likes));
  const views = patterns.map((pattern) => numberValue(pattern.views));
  const replies = patterns.map((pattern) => numberValue(pattern.replies));
  const reposts = patterns.map((pattern) => numberValue(pattern.reposts));
  const archiveAverageLikes = numberValue(context?.metrics?.baselines?.average_likes);
  const archiveAverageViews = numberValue(context?.metrics?.baselines?.average_views);
  const archiveTopLikes = numberValue(context?.metrics?.top_post?.likes);
  const archiveTopViews = numberValue(context?.metrics?.top_post?.views);
  const avgLikes = Math.round(average(likes));
  const avgViews = Math.round(average(views));
  const topLikes = likes.length ? Math.max(...likes) : 0;
  const topViews = views.length ? Math.max(...views) : 0;

  return {
    average_likes: avgLikes,
    average_views: avgViews,
    average_replies: Math.round(average(replies)),
    average_reposts: Math.round(average(reposts)),
    top_likes: topLikes,
    top_views: topViews,
    archive_average_likes: archiveAverageLikes,
    archive_average_views: archiveAverageViews,
    archive_top_likes: archiveTopLikes,
    archive_top_views: archiveTopViews,
    average_likes_ratio_vs_archive: archiveAverageLikes ? Number((avgLikes / archiveAverageLikes).toFixed(2)) : null,
    average_views_ratio_vs_archive: archiveAverageViews ? Number((avgViews / archiveAverageViews).toFixed(2)) : null,
    top_likes_ratio_vs_archive_top: archiveTopLikes ? Number((topLikes / archiveTopLikes).toFixed(2)) : null,
    top_views_ratio_vs_archive_top: archiveTopViews ? Number((topViews / archiveTopViews).toFixed(2)) : null,
  };
}

function summarizeSignalGaps(sourceSummary, targetSummary) {
  const sourceRates = sourceSummary?.signal_rates ?? {};
  const targetRates = targetSummary?.signal_rates ?? {};
  const keys = [...new Set([...Object.keys(sourceRates), ...Object.keys(targetRates)])];
  return keys.map((key) => {
    const source = numberValue(sourceRates[key]);
    const target = numberValue(targetRates[key]);
    return {
      signal: key,
      source_rate: source,
      target_rate: target,
      gap: Number((source - target).toFixed(3)),
    };
  }).sort((left, right) => Math.abs(right.gap) - Math.abs(left.gap));
}

function buildPatternStrategyNotes(patternSummary, archiveSummary, ratioSummary) {
  const notes = [];
  const averageLikesRatio = numberValue(ratioSummary?.average_likes_ratio_vs_archive);
  const averageViewsRatio = numberValue(ratioSummary?.average_views_ratio_vs_archive);

  if (averageLikesRatio > 1.2) notes.push(`Saved patterns are outperforming the archive on likes by ${averageLikesRatio}x on average.`);
  if (averageViewsRatio > 1.2) notes.push(`Saved patterns are outperforming the archive on views by ${averageViewsRatio}x on average.`);

  for (const gap of summarizeSignalGaps(patternSummary, archiveSummary).slice(0, 6)) {
    if (gap.gap >= 0.18) notes.push(`Saved patterns lean harder into ${gap.signal.replace(/_/g, " ")} than the current archive.`);
    else if (gap.gap <= -0.18) notes.push(`The current archive leans harder into ${gap.signal.replace(/_/g, " ")} than the saved-pattern winners.`);
  }

  return notes.slice(0, 8);
}

function summarizeSavedPatternBand(patterns) {
  const sample = patterns.slice(0, 8).map((pattern, index) => ({
    rank: index + 1,
    text: pattern.post_text,
    likes: pattern.likes,
    views: pattern.views,
  }));
  return {
    count: patterns.length,
    performance: summarizeSavedPatternPerformance(patterns, null),
    shape: summarizePostAnalyses(patterns.map((pattern) => analyzePostText(pattern.post_text))),
    sample,
  };
}

function uniqueEligibleTastePosts(context) {
  const sources = [
    ...(Array.isArray(context?.archive_recent) ? context.archive_recent : []),
    ...(Array.isArray(context?.archive_top) ? context.archive_top : []),
  ];
  const seen = new Set();
  const eligible = [];

  for (const sourcePost of sources) {
    const post = normalizeTastePost(sourcePost);
    if (!post.posted_at || !post.text) continue;
    const stamp = parseTimestamp(post.posted_at);
    if (!stamp) continue;
    const dedupeKey = post.post_id || `${post.posted_at}::${post.text}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    eligible.push(post);
  }

  return eligible;
}

function recentWinnerCounts(size) {
  if (!size) return { aCount: 0, bCount: 0 };
  const aCount = Math.max(1, Math.ceil(size * RECENT_A_TIER_RATIO));
  const bCount = Math.max(1, Math.ceil(size * RECENT_B_TIER_RATIO));
  return {
    aCount,
    bCount: Math.min(size - aCount, bCount),
  };
}

function buildTasteMemory(context) {
  const eligible = uniqueEligibleTastePosts(context);
  const recentWindow = [...eligible]
    .sort((left, right) => parseTimestamp(right.posted_at).valueOf() - parseTimestamp(left.posted_at).valueOf())
    .slice(0, RECENT_TASTE_WINDOW_SIZE);
  const recentRanked = [...recentWindow]
    .sort((left, right) => right.likes - left.likes || parseTimestamp(right.posted_at).valueOf() - parseTimestamp(left.posted_at).valueOf());
  const { aCount, bCount } = recentWinnerCounts(recentRanked.length);
  const recentWinners = recentRanked.slice(0, aCount + bCount).map((post, index) => ({
    ...post,
    rank: index + 1,
    tier: index < aCount ? "A" : "B",
  }));
  const allTimeChampions = [...eligible]
    .sort((left, right) => right.likes - left.likes || parseTimestamp(right.posted_at).valueOf() - parseTimestamp(left.posted_at).valueOf())
    .slice(0, ALL_TIME_CHAMPION_COUNT)
    .map((post, index) => ({
      ...post,
      rank: index + 1,
    }));
  const recentArchive = [...eligible]
    .sort((left, right) => parseTimestamp(right.posted_at).valueOf() - parseTimestamp(left.posted_at).valueOf())
    .slice(0, RECENT_FATIGUE_WINDOW_SIZE);
  const winnerAnalysis = summarizePostAnalyses(recentWinners.map((post) => analyzePostText(post.text)));
  const recentArchiveAnalysis = summarizePostAnalyses(recentArchive.map((post) => analyzePostText(post.text)));
  const repeatedOpeners = recentArchiveAnalysis.top_openers.filter((entry) => entry.count >= 2).slice(0, 8);
  const overusedSignals = Object.entries(recentArchiveAnalysis.signal_rates)
    .map(([signal, rate]) => ({ signal, rate, winner_rate: numberValue(winnerAnalysis.signal_rates?.[signal]) }))
    .filter((entry) => entry.rate >= 0.6)
    .sort((left, right) => right.rate - left.rate)
    .slice(0, 8);
  const freshnessNotes = summarizeSignalGaps(recentArchiveAnalysis, winnerAnalysis)
    .filter((entry) => Math.abs(entry.gap) >= 0.2)
    .slice(0, 6)
    .map((entry) => entry.gap > 0
      ? `Recent archive is over-leaning on ${entry.signal.replace(/_/g, " ")} relative to internal winners.`
      : `Recent archive is under-leaning on ${entry.signal.replace(/_/g, " ")} relative to internal winners.`);

  return {
    core_law: "Taste is learned from likes only.",
    recent_window_size: RECENT_TASTE_WINDOW_SIZE,
    archive_total_seen: eligible.length,
    recent_winners: recentWinners,
    all_time_champions: allTimeChampions,
    fatigue_summary: {
      recent_archive_window_size: RECENT_FATIGUE_WINDOW_SIZE,
      recent_archive_analysis: recentArchiveAnalysis,
      winner_analysis: winnerAnalysis,
      repeated_openers: repeatedOpeners,
      overused_signals: overusedSignals,
      freshness_notes: freshnessNotes,
    },
  };
}

function normalizeSavedPattern(pattern) {
  return {
    id: numberValue(pattern?.id),
    source_url: String(pattern?.source_url ?? "").trim(),
    author_handle: String(pattern?.author_handle ?? "").trim(),
    author_display_name: String(pattern?.author_display_name ?? "").trim(),
    post_text: String(pattern?.post_text ?? "").trim(),
    likes: numberValue(pattern?.likes),
    replies: numberValue(pattern?.replies),
    reposts: numberValue(pattern?.reposts),
    shares: numberValue(pattern?.shares),
    views: numberValue(pattern?.views),
    posted_at: String(pattern?.posted_at ?? "").trim(),
    updated_at: String(pattern?.updated_at ?? "").trim(),
  };
}

function buildSavedPatternMemory(patterns, context = null) {
  const normalized = (Array.isArray(patterns) ? patterns : [])
    .map(normalizeSavedPattern)
    .filter((pattern) => pattern.source_url && pattern.post_text);
  const rankedPatterns = [...normalized]
    .sort((left, right) => (
      right.likes - left.likes
      || right.views - left.views
      || (parseTimestamp(right.posted_at)?.valueOf() ?? 0) - (parseTimestamp(left.posted_at)?.valueOf() ?? 0)
    ));
  const top_patterns = rankedPatterns
    .slice(0, SAVED_PATTERN_TOP_COUNT)
    .map((pattern, index) => ({
      ...pattern,
      rank: index + 1,
    }));
  const all_patterns = rankedPatterns.map((pattern, index) => ({
    rank: index + 1,
    id: pattern.id,
    source_url: pattern.source_url,
    author_handle: pattern.author_handle,
    post_text: pattern.post_text,
    likes: pattern.likes,
    views: pattern.views,
    replies: pattern.replies,
    reposts: pattern.reposts,
    shares: pattern.shares,
    posted_at: pattern.posted_at,
    updated_at: pattern.updated_at,
  }));
  const recent_patterns = [...normalized]
    .sort((left, right) => (
      (parseTimestamp(right.posted_at)?.valueOf() ?? 0) - (parseTimestamp(left.posted_at)?.valueOf() ?? 0)
      || right.likes - left.likes
      || right.views - left.views
    ))
    .slice(0, 15)
    .map((pattern, index) => ({
      ...pattern,
      recent_rank: index + 1,
    }));
  const upperBound = Math.max(SAVED_PATTERN_TOP_COUNT, Math.floor(rankedPatterns.length * 0.33));
  const lowerStart = Math.max(upperBound, Math.floor(rankedPatterns.length * 0.66));
  const midBand = rankedPatterns.slice(upperBound, lowerStart);
  const lowerBand = rankedPatterns.slice(lowerStart);
  const patternSummary = summarizePostAnalyses(top_patterns.map((pattern) => analyzePostText(pattern.post_text)));
  const allPatternSummary = summarizePostAnalyses(rankedPatterns.map((pattern) => analyzePostText(pattern.post_text)));
  const archiveSummary = summarizePostAnalyses(uniqueEligibleTastePosts(context).map((post) => analyzePostText(post.text)));
  const performanceSummary = summarizeSavedPatternPerformance(rankedPatterns, context);
  const topPerformanceSummary = summarizeSavedPatternPerformance(top_patterns, context);
  const strategyNotes = buildPatternStrategyNotes(allPatternSummary, archiveSummary, performanceSummary);

  return {
    core_law: "Saved patterns are curated market research and the primary external growth signal. Use them to evolve the account without copying.",
    ranked_by: "likes",
    total_count: normalized.length,
    top_count: SAVED_PATTERN_TOP_COUNT,
    market_position: {
      saved_patterns_lead: true,
      archive_role: "Use archive context mainly for anti-fatigue, anti-duplication, and identity guardrails.",
      lesson_role: "Use rejection lessons as hard constraints and approval lessons as strong positive steering.",
    },
    performance_summary: performanceSummary,
    top_performance_summary: topPerformanceSummary,
    all_pattern_shape: allPatternSummary,
    top_pattern_shape: patternSummary,
    archive_shape_comparison: {
      archive_shape: archiveSummary,
      signal_gaps_vs_archive: summarizeSignalGaps(allPatternSummary, archiveSummary).slice(0, 12),
    },
    coverage_bands: {
      top_band: summarizeSavedPatternBand(rankedPatterns.slice(0, upperBound)),
      mid_band: summarizeSavedPatternBand(midBand),
      lower_band: summarizeSavedPatternBand(lowerBand),
      recent_band: summarizeSavedPatternBand(recent_patterns),
    },
    strategy_notes: strategyNotes,
    all_patterns,
    top_patterns,
    recent_patterns,
  };
}

function computeMetrics({ dashboard, followers, archiveRecent, archiveTop }) {
  const followerCount = numberValue(dashboard?.profile?.follower_count);
  const topPost = dashboard?.top_post ?? archiveTop[0] ?? null;
  const topLikes = numberValue(topPost?.likes);
  const topViews = numberValue(topPost?.views);
  const averageLikes = Math.round(average(archiveRecent.map((post) => numberValue(post.likes))));
  const averageViews = Math.round(average(archiveRecent.map((post) => numberValue(post.views))));
  return {
    current_followers: followerCount,
    followers_to_1m: Math.max(0, GOAL_FOLLOWERS - followerCount),
    progress_to_1m_percent: Number(((followerCount / GOAL_FOLLOWERS) * 100).toFixed(4)),
    top_post: topPost ? {
      id: String(topPost.id ?? ""),
      text: String(topPost.preview ?? topPost.text ?? ""),
      likes: topLikes,
      views: topViews,
      replies: numberValue(topPost.replies),
      reposts: numberValue(topPost.reposts),
      permalink: topPost.permalink ?? null,
    } : null,
    goals: {
      top_post_likes_2x: topLikes * 2,
      top_post_views_2x: topViews * 2,
      average_likes_2x: averageLikes * 2,
      average_views_2x: averageViews * 2,
    },
    baselines: {
      average_likes: averageLikes,
      average_views: averageViews,
      archive_total_seen: Math.max(archiveRecent.length, archiveTop.length),
      recent_sample_size: archiveRecent.length,
      follower_snapshots_seen: Array.isArray(followers?.rows) ? followers.rows.length : 0,
    },
  };
}

function normalizeMetrics(baseMetrics = {}, incomingMetrics = {}) {
  const base = baseMetrics && typeof baseMetrics === "object" ? baseMetrics : {};
  const incoming = incomingMetrics && typeof incomingMetrics === "object" ? incomingMetrics : {};
  const baseTopPost = base.top_post && typeof base.top_post === "object" ? base.top_post : {};
  const incomingTopPost = incoming.top_post && typeof incoming.top_post === "object" ? incoming.top_post : {};
  const baselines = {
    ...(base.baselines ?? {}),
    ...(incoming.baselines ?? {}),
  };
  const goals = {
    ...(base.goals ?? {}),
    ...(incoming.goals ?? {}),
  };

  if (incoming.archive_average_likes !== undefined) baselines.average_likes = numberValue(incoming.archive_average_likes);
  if (incoming.archive_average_views !== undefined) baselines.average_views = numberValue(incoming.archive_average_views);
  if (incoming.recent_sample_size !== undefined) baselines.recent_sample_size = numberValue(incoming.recent_sample_size);
  if (incoming.archive_total_seen !== undefined) baselines.archive_total_seen = numberValue(incoming.archive_total_seen);
  if (incoming.follower_snapshots_seen !== undefined) baselines.follower_snapshots_seen = numberValue(incoming.follower_snapshots_seen);

  if (incoming.top_post_likes_2x_target !== undefined) goals.top_post_likes_2x = numberValue(incoming.top_post_likes_2x_target);
  if (incoming.top_post_views_2x_target !== undefined) goals.top_post_views_2x = numberValue(incoming.top_post_views_2x_target);
  if (incoming.average_likes_2x_target !== undefined) goals.average_likes_2x = numberValue(incoming.average_likes_2x_target);
  if (incoming.average_views_2x_target !== undefined) goals.average_views_2x = numberValue(incoming.average_views_2x_target);

  const topPost = {
    ...baseTopPost,
    ...incomingTopPost,
  };
  if (incoming.top_post_likes !== undefined) topPost.likes = numberValue(incoming.top_post_likes);
  if (incoming.top_post_views !== undefined) topPost.views = numberValue(incoming.top_post_views);

  return {
    ...base,
    ...incoming,
    top_post: Object.keys(topPost).length ? topPost : null,
    goals,
    baselines,
  };
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeTasteMemory(context) {
  const memory = buildTasteMemory(context);
  await writeJson(TASTE_MEMORY_PATH, memory);
  return memory;
}

async function writeSavedPatternMemory(patterns) {
  let context = null;
  try {
    context = await readLatestPulledContext();
  } catch {}
  const memory = buildSavedPatternMemory(patterns, context);
  await writeJson(SAVED_PATTERN_MEMORY_PATH, memory);
  return memory;
}

async function loadSavedPatternMemory() {
  try {
    return await readJson(SAVED_PATTERN_MEMORY_PATH);
  } catch {
    return buildSavedPatternMemory([]);
  }
}

async function loadLatestRun() {
  try {
    const run = await readJson(path.join(VAULT, "Runs", "latest-run.json"));
    const { strategy_summary, fatigue_summary, ...cleanRun } = run ?? {};
    const normalizedRun = {
      ...cleanRun,
      posts: relabelPosts(cleanRun.posts),
    };
    try {
      const context = await readJson(path.join(VAULT, "Context", "latest-generate-context.json"));
      return { ...normalizedRun, metrics: normalizeMetrics(context.metrics, cleanRun.metrics) };
    } catch {
      return { ...normalizedRun, metrics: normalizeMetrics({}, cleanRun.metrics) };
    }
  } catch {
    return null;
  }
}

function summarizeContext(context) {
  if (!context || typeof context !== "object") return null;
  return {
    generated_at: context.generated_at ?? null,
    target_date: context.target_date ?? null,
    desired_slots: Array.isArray(context.desired_slots) ? context.desired_slots : [],
    missing_slots: Array.isArray(context.missing_slots) ? context.missing_slots : [],
    batch_preset: context.batch_preset ?? null,
    slot_source: context.slot_source ?? null,
    metrics: normalizeMetrics({}, context.metrics),
  };
}

async function loadLatestContextSummary() {
  try {
    const context = await readJson(path.join(VAULT, "Context", "latest-generate-context.json"));
    return summarizeContext(context);
  } catch {
    return null;
  }
}

function hoursSince(isoTimestamp) {
  const parsed = parseTimestamp(isoTimestamp);
  if (!parsed) return Number.POSITIVE_INFINITY;
  return (Date.now() - parsed.valueOf()) / (60 * 60 * 1000);
}

async function loadSelectedBatchPresetId() {
  try {
    const data = await readJson(BATCH_PRESET_SELECTION_PATH);
    if (data?.explicit_selection !== true) {
      return null;
    }
    const presetId = String(data?.preset_id ?? "").trim();
    return presetId || null;
  } catch {
    return null;
  }
}

async function saveSelectedBatchPresetId(presetId) {
  const trimmed = String(presetId ?? "").trim();
  if (!trimmed) throw new Error("preset_id is required.");
  await writeJson(BATCH_PRESET_SELECTION_PATH, {
    preset_id: trimmed,
    explicit_selection: true,
    updated_at: new Date().toISOString(),
  });
  return trimmed;
}

async function clearSelectedBatchPresetId() {
  try {
    await fs.unlink(BATCH_PRESET_SELECTION_PATH);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function resolveSelectedBatchPreset(presets, selectedPresetId) {
  if (!Array.isArray(presets) || !presets.length) return null;
  if (!selectedPresetId) return null;
  return presets.find((preset) => String(preset?.id ?? "") === String(selectedPresetId)) ?? null;
}

async function loadBatchPresetState(context = null) {
  const presets = await fetchLensicallyBatchPresets();
  const selectedPresetId = await loadSelectedBatchPresetId();
  const activePreset = resolveSelectedBatchPreset(presets, selectedPresetId);
  return {
    presets,
    selected_preset_id: activePreset?.id ?? null,
    active_preset: activePreset ?? null,
  };
}

function isContextFresh(context) {
  return hoursSince(context?.generated_at) <= HERMES_CONTEXT_MAX_AGE_HOURS;
}

async function readLatestPulledContext() {
  return readJson(path.join(VAULT, "Context", "latest-generate-context.json"));
}

async function requireFreshPulledContext() {
  let context;
  try {
    context = await readLatestPulledContext();
  } catch {
    throw new Error("No pulled Lensically data is available. Press Pull Data first.");
  }
  if (!isContextFresh(context)) {
    throw new Error("Pulled Lensically data is older than 24 hours. Press Pull Data before generating.");
  }
  return context;
}

async function loadLessons() {
  try {
    const data = await readJson(path.join(VAULT, "Lessons", "rejection-lessons.json"));
    return (Array.isArray(data.lessons) ? data.lessons : []).map((lesson) => ({
      saved_at: String(lesson?.saved_at ?? "").trim(),
      slot: String(lesson?.slot ?? "").trim(),
      source_text: String(lesson?.source_text ?? "").trim(),
      user_feedback: String(lesson?.user_feedback ?? "").trim(),
    })).filter((lesson) => lesson.slot && lesson.source_text && lesson.user_feedback);
  } catch {
    return [];
  }
}

async function saveLessons(lessons) {
  await writeJson(path.join(VAULT, "Lessons", "rejection-lessons.json"), {
    updated_at: new Date().toISOString(),
    lessons: (Array.isArray(lessons) ? lessons : []).map((lesson) => ({
      saved_at: String(lesson?.saved_at ?? "").trim(),
      slot: String(lesson?.slot ?? "").trim(),
      source_text: String(lesson?.source_text ?? "").trim(),
      user_feedback: String(lesson?.user_feedback ?? "").trim(),
    })).filter((lesson) => lesson.slot && lesson.source_text && lesson.user_feedback),
  });
}

async function loadApprovalLessons() {
  try {
    const data = await readJson(path.join(VAULT, "Lessons", "approval-lessons.json"));
    return (Array.isArray(data.lessons) ? data.lessons : []).map((lesson) => ({
      saved_at: String(lesson?.saved_at ?? "").trim(),
      scheduled_at: String(lesson?.scheduled_at ?? "").trim(),
      target_date: String(lesson?.target_date ?? "").trim(),
      slot: String(lesson?.slot ?? "").trim(),
      source_text: String(lesson?.source_text ?? "").trim(),
      user_feedback: String(lesson?.user_feedback ?? "").trim(),
    })).filter((lesson) => lesson.slot && lesson.source_text && lesson.user_feedback);
  } catch {
    return [];
  }
}

async function saveApprovalLessons(lessons) {
  await writeJson(path.join(VAULT, "Lessons", "approval-lessons.json"), {
    updated_at: new Date().toISOString(),
    lessons: (Array.isArray(lessons) ? lessons : []).map((lesson) => ({
      saved_at: String(lesson?.saved_at ?? "").trim(),
      scheduled_at: String(lesson?.scheduled_at ?? "").trim(),
      target_date: String(lesson?.target_date ?? "").trim(),
      slot: String(lesson?.slot ?? "").trim(),
      source_text: String(lesson?.source_text ?? "").trim(),
      user_feedback: String(lesson?.user_feedback ?? "").trim(),
    })).filter((lesson) => lesson.slot && lesson.source_text && lesson.user_feedback),
  });
}

async function loadGuidance() {
  try {
    const data = await readJson(path.join(VAULT, "Lessons", "agent-guidance.json"));
    return Array.isArray(data.guidance) ? data.guidance : [];
  } catch {
    return [];
  }
}

async function saveGuidanceEntry(userInput, understanding) {
  const trimmedInput = String(userInput ?? "").trim();
  const trimmedUnderstanding = String(understanding ?? "").trim();
  if (!trimmedInput) throw new Error("Guidance text is required.");
  const guidance = await loadGuidance();
  const entry = {
    saved_at: new Date().toISOString(),
    user_input: trimmedInput,
    understanding: trimmedUnderstanding || trimmedInput,
    mode: trimmedUnderstanding && trimmedUnderstanding !== trimmedInput ? "agent_reply" : "store_only",
  };
  await writeJson(path.join(VAULT, "Lessons", "agent-guidance.json"), {
    updated_at: new Date().toISOString(),
    guidance: [...guidance, entry].slice(-100),
  });
  return entry;
}

function buildGuidancePrompt(text, guidance, lessons) {
  return [
    "You are the local Manifest Mental growth agent.",
    "Output valid JSON only. No markdown.",
    "The user is giving durable taste or strategy guidance that should shape future post generation and deletion decisions.",
    "Understand why the user is telling you this. Be direct. Do not generate posts.",
    "Return JSON: {\"reply\":\"short direct response to the user explaining what you understood\", \"understanding\":\"one short plain-English explanation of why the user is giving this guidance and what signal it contains\"}",
    "New user guidance:",
    String(text ?? "").trim(),
    "Existing steering guidance:",
    JSON.stringify(guidance.slice(-40).map((entry) => ({
      user_input: entry.user_input,
      understanding: entry.understanding,
    }))),
    "Recent rejection lessons:",
    JSON.stringify(lessons.slice(-20).map((lesson) => ({
      slot: lesson.slot,
      user_feedback: lesson.user_feedback,
    }))),
  ].join("\n\n");
}

async function saveGuidanceWithModel(text) {
  if (activeRun) throw new Error(`Agent is already running: ${activeRun.phase}`);
  const trimmed = String(text ?? "").trim();
  if (!trimmed) throw new Error("Guidance text is required.");
  const guidance = await loadGuidance();
  const lessons = await loadLessons();
  activeRun = { id: nowStamp(), phase: "reasoning_about_guidance", started_at: new Date().toISOString() };
  const hermes = await runHermesJson(buildGuidancePrompt(trimmed, guidance, lessons));
  const reply = String(hermes.reply ?? "").trim();
  const understanding = String(hermes.understanding ?? trimmed).trim();
  const entry = await saveGuidanceEntry(trimmed, understanding);
  activeRun = null;
  return { entry, reply: reply || "I saved this as steering memory and will apply it to future Generate and Regen prompts.", guidance: await loadGuidance() };
}

async function saveGuidanceDirect(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) throw new Error("Guidance text is required.");
  const entry = await saveGuidanceEntry(trimmed, trimmed);
  return {
    entry,
    reply: "Saved directly to steering memory without asking Hermes.",
    guidance: await loadGuidance(),
  };
}

const CONTROL_FILES = {
  "memory/guidance": { title: "Guidance Memory", file: path.join(VAULT, "Lessons", "agent-guidance.json"), editable: true, type: "json" },
  "memory/rejection-lessons": { title: "Rejection Lessons", file: path.join(VAULT, "Lessons", "rejection-lessons.json"), editable: true, type: "json" },
  "memory/approval-lessons": { title: "Approval Lessons", file: path.join(VAULT, "Lessons", "approval-lessons.json"), editable: true, type: "json" },
  "memory/taste-memory": { title: "Taste Memory", file: TASTE_MEMORY_PATH, editable: false, type: "json" },
  "memory/saved-pattern-memory": { title: "Saved Pattern Memory", file: SAVED_PATTERN_MEMORY_PATH, editable: false, type: "json" },
  "runs/latest-run": { title: "Latest Run", file: path.join(VAULT, "Runs", "latest-run.json"), editable: false, type: "json" },
  "context/latest-generate-context": { title: "Latest Generate Context", file: path.join(VAULT, "Context", "latest-generate-context.json"), editable: false, type: "json" },
  "context/latest-hermes-prompt": { title: "Latest Hermes Prompt", file: path.join(VAULT, "Context", "latest-hermes-prompt.txt"), editable: false, type: "text" },
};

async function controlRegistry() {
  return [
    { group: "Memory", items: Object.entries(CONTROL_FILES).filter(([id]) => id.startsWith("memory/")).map(([id, item]) => ({ id, title: item.title, editable: item.editable, type: item.type })) },
    { group: "Run Evidence", items: Object.entries(CONTROL_FILES).filter(([id]) => !id.startsWith("memory/")).map(([id, item]) => ({ id, title: item.title, editable: item.editable, type: item.type })) },
  ];
}

async function resolveControlFile(id) {
  if (CONTROL_FILES[id]) return CONTROL_FILES[id];
  throw new Error("Unknown control file.");
}

async function readControlFile(id) {
  const item = await resolveControlFile(id);
  let content = "";
  try {
    content = await fs.readFile(item.file, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return { id, title: item.title, editable: item.editable, type: item.type, content };
}

async function writeControlFile(id, content) {
  const item = await resolveControlFile(id);
  if (!item.editable) throw new Error("This file is read-only from the dashboard.");
  if (item.type === "json") JSON.parse(String(content || "{}"));
  if (item.type === "markdown" && !String(content).startsWith("---\n")) throw new Error("Skill files must start with YAML frontmatter.");
  await fs.mkdir(path.dirname(item.file), { recursive: true });
  await fs.writeFile(item.file, String(content ?? ""), "utf8");
  return readControlFile(id);
}

async function buildFreshContext(targetDate = null) {
  const internalKey = requireInternalKey();
  activeRun = { ...(activeRun ?? {}), phase: "pulling_lensically_context" };
  const dateQuery = String(targetDate ?? "").trim();
  const automationContext = await fetchJson(`/api/automation/context?account_id=${ACCOUNT_ID}&timezone=${encodeURIComponent(TIMEZONE)}${dateQuery ? `&date=${encodeURIComponent(dateQuery)}` : ""}`, {
    headers: { "x-internal-key": internalKey },
  });
  const [dashboard, followers, archiveRecent, archiveTop] = await Promise.all([
    fetchJson("/api/threads/dashboard"),
    fetchJson("/api/threads/followers"),
    fetchAllArchive("recent"),
    fetchAllArchive("top"),
  ]);
  const context = {
    generated_at: new Date().toISOString(),
    account_id: ACCOUNT_ID,
    account: automationContext.account ?? null,
    timezone: TIMEZONE,
    target_date: automationContext.date,
    desired_slots: automationContext.desired_slots,
    missing_slots: automationContext.missing_slots,
    batch_preset: automationContext.batch_preset ?? null,
    slot_source: automationContext.slot_source ?? null,
    scheduled_posts: automationContext.scheduled_posts,
    metrics: computeMetrics({ dashboard, followers, archiveRecent, archiveTop }),
    follower_archive: followers,
    archive_recent: archiveRecent,
    archive_top: archiveTop,
    agent_rules: {
      never_publish: true,
      only_schedule_after_user_clicks_schedule: true,
      full_context_pull_only_on_generate: true,
      delete_feedback_writes_rejection_memory: true,
      fatigue_rule: "Reusing openers is permitted. Reusing the latter half, payoff, or sentence resolution too closely is audience fatigue.",
    },
  };
  await writeJson(path.join(VAULT, "Context", "latest-generate-context.json"), context);
  await writeJson(path.join(VAULT, "Context", `generate-context-${nowStamp()}.json`), context);
  return context;
}

function compactContext(context) {
  const archiveAll = dedupeArchivePosts([
    ...(Array.isArray(context.archive_recent) ? context.archive_recent : []),
    ...(Array.isArray(context.archive_top) ? context.archive_top : []),
  ]);
  return {
    target_date: context.target_date,
    desired_slots: context.desired_slots,
    missing_slots: context.missing_slots,
    metrics: context.metrics,
    follower_archive: { rows: Array.isArray(context.follower_archive?.rows) ? context.follower_archive.rows.slice(0, 120) : [] },
    archive_recent: (Array.isArray(context.archive_recent) ? context.archive_recent : []).map((post) => ({
      id: post.id,
      text: post.text,
      timestamp: post.timestamp,
      likes: post.likes,
      views: post.views,
      replies: post.replies,
      reposts: post.reposts,
    })),
    archive_top: (Array.isArray(context.archive_top) ? context.archive_top : []).map((post) => ({
      id: post.id,
      text: post.text,
      timestamp: post.timestamp,
      likes: post.likes,
      views: post.views,
      replies: post.replies,
      reposts: post.reposts,
    })),
    archive_all: archiveAll.map((post) => ({
      id: post.id,
      text: post.text,
      timestamp: post.timestamp ?? post.posted_at,
      likes: post.likes,
      views: post.views,
      replies: post.replies,
      reposts: post.reposts,
    })),
    rules: context.agent_rules,
  };
}

function clampPostCount(value, maxCount) {
  const parsed = Math.floor(Number(value ?? DEFAULT_POST_COUNT));
  const safeMax = Math.max(1, Number(maxCount ?? MAX_POST_COUNT));
  if (!Number.isFinite(parsed)) return Math.min(DEFAULT_POST_COUNT, safeMax);
  return Math.max(1, Math.min(parsed, safeMax));
}

function buildGenerationSlots(requestedCount, startIndex = 0) {
  const count = clampPostCount(requestedCount, MAX_POST_COUNT);
  const safeStart = Math.max(0, Math.floor(Number(startIndex ?? 0)) || 0);
  return Array.from({ length: count }, (_, index) => `Post ${safeStart + index + 1}`);
}

function relabelPosts(posts) {
  return (Array.isArray(posts) ? posts : []).map((post, index) => ({
    ...post,
    slot: `Post ${index + 1}`,
    text: String(post?.text ?? "").trim(),
    approved: Boolean(post?.approved),
    approval_lesson: String(post?.approval_lesson ?? "").trim(),
  }));
}

function buildGeneratePrompt(context, rejectionLessons, approvalLessons, guidance, tasteMemory, savedPatternMemory, generationSlots, existingPosts = []) {
  return [
    "You are the standalone Manifest Mental recursive learning agent.",
    "Output valid JSON only. No markdown.",
    `Generate exactly ${generationSlots.length} post candidates in this order: ${generationSlots.join(", ")}.`,
    "Never publish. Never call a publish endpoint. Only create candidates; scheduling is a later explicit user action.",
    "Goal: grow the account to 1,000,000 followers.",
    "Performance targets: over time, beat the top-liked post by 2x and create a rising floor for average likes and views.",
    "Do not allocate fixed post categories by time. Do not decide that mornings must be money, afternoons must be status, or nights must be spiritual.",
    `Do not optimize for variety theater. Generate the ${generationSlots.length} strongest posts for this account, even if several winners share a broad lane.`,
    "Do not label posts with genres, objectives, bet types, or win conditions. Those labels can bias the writing.",
    "Openers may repeat when useful. The latter half, payoff, promise, and sentence resolution must not be too close to recent/generated posts.",
    "Before generating posts, read the taste memory and the saved pattern memory.",
    "Saved patterns are curated market research and should usually lead strategy when they materially outperform the account archive.",
    "Use the full saved-pattern memory: the complete ranked catalog, top winners for breakthrough mechanics, mid/lower bands for anti-staleness and range awareness, and recent saved patterns for what the market is rewarding now.",
    "Use the full account archive, especially the deduped archive_all view, mainly for anti-fatigue, anti-duplication, and identity guardrails. Do not let the archive trap you inside stale account habits if stronger saved-pattern evidence points elsewhere.",
    "Read the saved-pattern performance summary, coverage bands, and shape summaries. Borrow mechanics, pacing, and post shape from the market without copying wording, exact opener plus resolution combinations, or exact payoff logic.",
    "Read the taste-memory fatigue summary. Avoid repeated opener families, overused mechanics, and stale sentence resolutions that the recent archive is already leaning on too hard.",
    "If a saved pattern uses gendered audience language, treat that as source-specific wrapping rather than wording to copy.",
    "Keep the growth strategy, emotional mechanic, pacing, and post style from strong saved patterns, but rewrite them into gender-neutral language for this account.",
    "Prefer direct second-person language or neutral terms such as person, people, or the person reading this. Do not use girl, guy, man, woman, boyfriend, girlfriend, wife, husband, or other gendered audience labels unless the user explicitly asks for that.",
    "Rejection lessons are the hardest constraints. Approval lessons are strong positive steering. Saved patterns are the main growth engine. The archive is context, not the ceiling.",
    "Preserve proven constants, but create fresh sentence resolutions that do not copy the winners' payoff logic.",
    "Some posts may already exist in the current slate. Do not rewrite them. Generate only the new slots and avoid duplicating or lightly paraphrasing the existing posts.",
    "Use the full archive, follower archive, metrics, goals, rejection lessons, approval lessons, and top posts. Do the math and strategy in the backend.",
    "Return JSON: {\"metrics\": object, \"posts\": [{\"slot\":\"Post 1\",\"text\":\"...\"}], \"memory_notes\": [string]}",
    "Existing posts already kept in the slate:",
    JSON.stringify((existingPosts ?? []).map((post) => ({ slot: post.slot, text: post.text, approved: Boolean(post.approved) }))),
    "Taste memory:",
    JSON.stringify(tasteMemory ?? {}),
    "Saved pattern memory:",
    JSON.stringify(savedPatternMemory ?? {}),
    "Prior rejection lessons:",
    JSON.stringify(rejectionLessons.slice(-40).map((lesson) => ({
      slot: lesson.slot,
      source_text: lesson.source_text,
      user_feedback: lesson.user_feedback,
    }))),
    "Prior approval lessons:",
    JSON.stringify(approvalLessons.slice(-40).map((lesson) => ({
      slot: lesson.slot,
      source_text: lesson.source_text,
      user_feedback: lesson.user_feedback,
      target_date: lesson.target_date,
    }))),
    "Persistent user steering guidance:",
    JSON.stringify(guidance.slice(-40).map((entry) => ({
      user_input: entry.user_input,
      understanding: entry.understanding,
    }))),
    "Context:",
    JSON.stringify(compactContext(context)),
  ].join("\n\n");
}

function extractJson(text) {
  const trimmed = String(text ?? "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) return JSON.parse(trimmed.slice(first, last + 1));
    throw new Error(`Hermes did not return parseable JSON: ${trimmed.slice(0, 500)}`);
  }
}

function toWslPath(windowsPath) {
  const normalized = path.resolve(windowsPath).replace(/\\/g, "/");
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
  return match ? `/mnt/${match[1].toLowerCase()}/${match[2]}` : normalized;
}

async function runHermesJson(prompt) {
  const promptPath = path.join(VAULT, "Context", "latest-hermes-prompt.txt");
  const runnerPath = path.join(VAULT, "Context", "hermes-runner.py");
  await fs.writeFile(promptPath, prompt, "utf8");
  await fs.writeFile(runnerPath, [
    "import subprocess",
    "import sys",
    "",
    "prompt_path = sys.argv[1]",
    "with open(prompt_path, 'r', encoding='utf-8') as prompt_file:",
    "    prompt = prompt_file.read()",
    "",
    "cmd = [",
    `    ${JSON.stringify(HERMES_BIN)},`,
    "    '-z',",
    "    prompt,",
    "    '--provider',",
    `    ${JSON.stringify(HERMES_PROVIDER)},`,
    "    '--model',",
    `    ${JSON.stringify(HERMES_MODEL)},`,
    "]",
    "result = subprocess.run(",
    "    cmd,",
    "    cwd='/mnt/c/Auto-Threads/lensically',",
    "    text=True,",
    "    stdout=subprocess.PIPE,",
    "    stderr=subprocess.PIPE,",
    ")",
    "sys.stdout.write(result.stdout)",
    "sys.stderr.write(result.stderr)",
    "sys.exit(result.returncode)",
    "",
  ].join("\n"), "utf8");
  const wslPromptPath = toWslPath(promptPath);
  const wslRunnerPath = toWslPath(runnerPath);
  return new Promise((resolve, reject) => {
    activeHermesKilled = false;
    log("hermes_start", { prompt_bytes: Buffer.byteLength(prompt, "utf8") });
    const child = spawn("wsl.exe", [
      "python3",
      wslRunnerPath,
      wslPromptPath,
    ], { windowsHide: true });
    activeHermesChild = child;
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      activeHermesKilled = true;
      child.kill();
      reject(new Error("Hermes timed out after 10 minutes."));
    }, 10 * 60 * 1000);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timeout);
      if (activeHermesChild === child) activeHermesChild = null;
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (activeHermesChild === child) activeHermesChild = null;
      if (activeHermesKilled) {
        log("hermes_stopped", { code });
        reject(new Error("Hermes was stopped by kill switch."));
      } else if (code !== 0) {
        log("hermes_failed", { code, stderr: stderr.slice(0, 500) });
        reject(new Error(`Hermes exited ${code}: ${stderr || stdout}`));
      } else {
        log("hermes_complete", { stdout_bytes: Buffer.byteLength(stdout, "utf8") });
        resolve(extractJson(stdout));
      }
    });
  });
}

function killActiveAgent() {
  const killedTrackedChild = Boolean(activeHermesChild);
  activeHermesKilled = true;
  if (activeHermesChild) {
    activeHermesChild.kill();
    activeHermesChild = null;
  }
  spawnSync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "$targets = Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^wsl(\\.exe)?$' -and ($_.CommandLine -match 'hermes|hermes-runner|openai-codex') }; foreach ($proc in $targets) { Stop-Process -Id $proc.ProcessId -Force }",
  ], { windowsHide: true });
  activeRun = null;
  return { killed: killedTrackedChild };
}

function normalizePosts(posts, desiredSlots) {
  if (!Array.isArray(posts)) throw new Error("Hermes response did not include posts array.");
  return desiredSlots.map((slot) => {
    const post = posts.find((item) => item?.slot === slot);
    if (!post?.text || typeof post.text !== "string") throw new Error(`Missing generated post for ${slot}.`);
    return {
      slot,
      text: post.text.trim(),
    };
  });
}

async function loadExistingSlateForTarget(targetDate) {
  const latestRun = await loadLatestRun();
  if (!latestRun?.posts?.length) return [];
  if (String(latestRun.target_date ?? "") !== String(targetDate ?? "")) return [];
  return relabelPosts(latestRun.posts);
}

async function generateRun(postCount = DEFAULT_POST_COUNT, requestedTargetDate = null) {
  const runId = nowStamp();
  activeRun = { id: runId, phase: "starting", started_at: new Date().toISOString() };
  const context = await requireFreshPulledContext();
  const expectedTargetDate = String(requestedTargetDate ?? "").trim();
  if (expectedTargetDate && String(context.target_date ?? "") !== expectedTargetDate) {
    activeRun = null;
    throw new Error(`Pulled data is for ${context.target_date || "a different date"}. Press Pull Data for ${expectedTargetDate} before generating.`);
  }
  const existingPosts = await loadExistingSlateForTarget(context.target_date);
  const generationSlots = buildGenerationSlots(postCount, existingPosts.length);
  const tasteMemory = await writeTasteMemory(context);
  const savedPatternMemory = await loadSavedPatternMemory();
  const rejectionLessons = await loadLessons();
  const approvalLessons = await loadApprovalLessons();
  const guidance = await loadGuidance();
  let hermes = { posts: [], metrics: {}, memory_notes: [] };
  if (generationSlots.length) {
    activeRun = { ...activeRun, phase: `hermes_generating_${generationSlots.length}_posts` };
    hermes = await runHermesJson(buildGeneratePrompt(context, rejectionLessons, approvalLessons, guidance, tasteMemory, savedPatternMemory, generationSlots, existingPosts));
  } else {
    activeRun = { ...activeRun, phase: "no_new_posts_requested" };
  }
  const generatedPosts = normalizePosts(hermes.posts ?? [], generationSlots).map((post) => ({ ...post, approved: false }));
  const posts = relabelPosts([...existingPosts, ...generatedPosts]);
  const run = {
    id: runId,
    status: "generated",
    generated_at: new Date().toISOString(),
    target_date: context.target_date,
    requested_post_count: posts.length,
    metrics: normalizeMetrics(context.metrics, hermes.metrics),
    memory_notes: [
      ...(existingPosts.length ? [`Appended ${generatedPosts.length} new post${generatedPosts.length === 1 ? "" : "s"} after keeping ${existingPosts.length} existing slate post${existingPosts.length === 1 ? "" : "s"} in place.`] : []),
      ...(Array.isArray(hermes.memory_notes) ? hermes.memory_notes.map(String) : []),
    ],
    posts,
  };
  await writeJson(path.join(VAULT, "Runs", "latest-run.json"), run);
  await writeJson(path.join(VAULT, "Runs", `run-${runId}.json`), run);
  activeRun = null;
  return run;
}

async function saveRejectedPosts(entries) {
  const normalizedEntries = (Array.isArray(entries) ? entries : []).map((entry) => ({
    slot: String(entry?.slot ?? "").trim(),
    source_text: String(entry?.source_text ?? "").trim(),
    user_feedback: String(entry?.user_feedback ?? "").trim(),
  })).filter((entry) => entry.slot && entry.source_text && entry.user_feedback);
  if (!normalizedEntries.length) return [];
  const lessons = await loadLessons();
  const savedAt = new Date().toISOString();
  const lessonEntries = normalizedEntries.map((entry) => ({
    saved_at: savedAt,
    slot: entry.slot,
    source_text: entry.source_text,
    user_feedback: entry.user_feedback,
  }));
  const existing = Array.isArray(lessons) ? lessons : [];
  await saveLessons([...existing, ...lessonEntries].slice(-300));
  for (const lesson of lessonEntries) {
    await writeJson(path.join(VAULT, "Rejections", `rejection-${nowStamp()}-${lesson.slot.replace(/[^a-z0-9]+/gi, "-")}.json`), {
      ...lesson,
      deleted: true,
    });
  }
  return lessonEntries;
}

async function saveScheduledApprovalLessons(entries, metadata = {}) {
  const normalizedEntries = (Array.isArray(entries) ? entries : []).map((entry) => ({
    slot: String(entry?.slot ?? "").trim(),
    source_text: String(entry?.source_text ?? "").trim(),
    user_feedback: String(entry?.user_feedback ?? "").trim(),
  })).filter((entry) => entry.slot && entry.source_text && entry.user_feedback);
  if (!normalizedEntries.length) return [];
  const lessons = await loadApprovalLessons();
  const savedAt = new Date().toISOString();
  const scheduledAt = String(metadata?.scheduled_at ?? savedAt).trim();
  const targetDate = String(metadata?.target_date ?? "").trim();
  const lessonEntries = normalizedEntries.map((entry) => ({
    saved_at: savedAt,
    scheduled_at: scheduledAt,
    target_date: targetDate,
    slot: entry.slot,
    source_text: entry.source_text,
    user_feedback: entry.user_feedback,
  }));
  const existing = Array.isArray(lessons) ? lessons : [];
  await saveApprovalLessons([...existing, ...lessonEntries].slice(-300));
  for (const lesson of lessonEntries) {
    await writeJson(path.join(VAULT, "Approvals", `approval-${nowStamp()}-${lesson.slot.replace(/[^a-z0-9]+/gi, "-")}.json`), {
      ...lesson,
      scheduled: true,
    });
  }
  return lessonEntries;
}

async function deleteRunPost(index, reason = "") {
  const latestRun = await loadLatestRun();
  if (!latestRun?.posts?.length) throw new Error("No generated run is available.");
  latestRun.posts = relabelPosts(latestRun.posts);
  const numericIndex = Math.trunc(Number(index));
  if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= latestRun.posts.length) {
    throw new Error("Post index is out of range.");
  }
  const deletedPost = latestRun.posts[numericIndex];
  await saveRejectedPosts([{
    slot: deletedPost.slot,
    source_text: deletedPost.text,
    user_feedback: reason,
  }]);
  latestRun.posts.splice(numericIndex, 1);
  latestRun.posts = relabelPosts(latestRun.posts);
  await writeJson(path.join(VAULT, "Runs", "latest-run.json"), latestRun);
  return latestRun;
}

async function reorderRunPosts(fromIndex, toIndex) {
  const latestRun = await loadLatestRun();
  if (!latestRun?.posts?.length) throw new Error("No generated run is available.");
  latestRun.posts = relabelPosts(latestRun.posts);
  const sourceIndex = Math.trunc(Number(fromIndex));
  const targetIndex = Math.trunc(Number(toIndex));
  if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= latestRun.posts.length) {
    throw new Error("Source post index is out of range.");
  }
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= latestRun.posts.length) {
    throw new Error("Target post index is out of range.");
  }
  if (sourceIndex === targetIndex) return latestRun;
  const [moved] = latestRun.posts.splice(sourceIndex, 1);
  latestRun.posts.splice(targetIndex, 0, moved);
  latestRun.posts = relabelPosts(latestRun.posts);
  await writeJson(path.join(VAULT, "Runs", "latest-run.json"), latestRun);
  return latestRun;
}

async function updateRunPostText(index, text) {
  const latestRun = await loadLatestRun();
  if (!latestRun?.posts?.length) throw new Error("No generated run is available.");
  latestRun.posts = relabelPosts(latestRun.posts);
  const numericIndex = Math.trunc(Number(index));
  if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= latestRun.posts.length) {
    throw new Error("Post index is out of range.");
  }
  const nextText = String(text ?? "").trim();
  if (!nextText) throw new Error("Post text cannot be empty.");
  latestRun.posts[numericIndex] = {
    ...latestRun.posts[numericIndex],
    text: nextText,
  };
  await writeJson(path.join(VAULT, "Runs", "latest-run.json"), latestRun);
  return latestRun;
}

async function updateRunPostApprovalLesson(index, approvalLesson) {
  const latestRun = await loadLatestRun();
  if (!latestRun?.posts?.length) throw new Error("No generated run is available.");
  latestRun.posts = relabelPosts(latestRun.posts);
  const numericIndex = Math.trunc(Number(index));
  if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= latestRun.posts.length) {
    throw new Error("Post index is out of range.");
  }
  latestRun.posts[numericIndex] = {
    ...latestRun.posts[numericIndex],
    approval_lesson: String(approvalLesson ?? "").trim(),
  };
  await writeJson(path.join(VAULT, "Runs", "latest-run.json"), latestRun);
  return latestRun;
}

async function setApprovedRunPosts(slots, approved = true) {
  const latestRun = await loadLatestRun();
  if (!latestRun?.posts?.length) throw new Error("No generated run is available.");
  const slotSet = new Set((Array.isArray(slots) ? slots : []).map((slot) => String(slot ?? "")).filter(Boolean));
  if (!slotSet.size) throw new Error("Select at least one post first.");
  latestRun.posts = relabelPosts(latestRun.posts).map((post) => slotSet.has(post.slot) ? { ...post, approved: Boolean(approved) } : post);
  await writeJson(path.join(VAULT, "Runs", "latest-run.json"), latestRun);
  return latestRun;
}

async function deleteRunPostsBySlots(entries) {
  const latestRun = await loadLatestRun();
  if (!latestRun?.posts?.length) throw new Error("No generated run is available.");
  const normalizedEntries = (Array.isArray(entries) ? entries : []).map((entry) => ({
    slot: typeof entry === "string" ? entry : String(entry?.slot ?? ""),
    user_feedback: typeof entry === "string" ? "" : String(entry?.reason ?? ""),
  })).filter((entry) => entry.slot);
  const slotSet = new Set(normalizedEntries.map((entry) => entry.slot));
  if (!slotSet.size) throw new Error("Select at least one post first.");
  latestRun.posts = relabelPosts(latestRun.posts);
  const deletedPosts = latestRun.posts.filter((post) => slotSet.has(post.slot));
  await saveRejectedPosts(deletedPosts.map((post) => ({
    slot: post.slot,
    source_text: post.text,
    user_feedback: normalizedEntries.find((entry) => entry.slot === post.slot)?.user_feedback ?? "",
  })));
  latestRun.posts = latestRun.posts.filter((post) => !slotSet.has(post.slot));
  latestRun.posts = relabelPosts(latestRun.posts);
  await writeJson(path.join(VAULT, "Runs", "latest-run.json"), latestRun);
  return latestRun;
}

async function resolveThreadsUserId(targetDate = null) {
  try {
    const context = await readLatestPulledContext();
    const existing = String(context?.account?.threads_user_id ?? "").trim();
    if (existing) return existing;
  } catch {
    // fall through to fresh account lookup
  }
  const internalKey = requireInternalKey();
  const dateQuery = String(targetDate ?? "").trim();
  const automationContext = await fetchJson(`/api/automation/context?account_id=${ACCOUNT_ID}&timezone=${encodeURIComponent(TIMEZONE)}${dateQuery ? `&date=${encodeURIComponent(dateQuery)}` : ""}`, {
    headers: { "x-internal-key": internalKey },
  });
  const threadsUserId = String(automationContext?.account?.threads_user_id ?? "").trim();
  if (!threadsUserId) throw new Error("Threads account is not connected.");
  return threadsUserId;
}

async function scheduleLatestRun(targetDate = null) {
  const latestRun = await loadLatestRun();
  if (!latestRun?.posts?.length) throw new Error("No generated run is available.");
  const batchPresetState = await loadBatchPresetState();
  const batchTimes = Array.isArray(batchPresetState.active_preset?.times) ? batchPresetState.active_preset.times : [];
  if (!batchTimes.length) throw new Error("Choose a Lensically batch before scheduling.");
  if (latestRun.posts.length > batchTimes.length) {
    throw new Error(`Selected batch has ${batchTimes.length} slots but the current slate has ${latestRun.posts.length} posts.`);
  }
  const scheduleDate = String(targetDate ?? latestRun.target_date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate)) throw new Error("Choose a valid target date before scheduling.");
  const payloadPath = path.join(VAULT, "Runs", "latest-schedule-plan.json");
  const scheduledAt = new Date().toISOString();
  await writeJson(payloadPath, {
    account_id: ACCOUNT_ID,
    date: scheduleDate,
    timezone: TIMEZONE,
    posts: latestRun.posts.map((post, index) => ({ slot: batchTimes[index], text: post.text })),
  });
  const output = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, "scripts", "lensically-agent-api.mjs"), "schedule-plan", "--file", payloadPath], { cwd: ROOT, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr || stdout));
      else resolve(extractJson(stdout));
    });
  });
  const response = output?.response ?? {};
  const createdSlots = new Set((Array.isArray(response.created) ? response.created : []).map((entry) => String(entry?.slot ?? "").trim()).filter(Boolean));
  const plannedPosts = latestRun.posts.map((post, index) => ({
    slot_time: String(batchTimes[index] ?? "").trim(),
    ...post,
  }));
  const scheduledPosts = plannedPosts.filter((post) => createdSlots.has(post.slot_time));
  const remainingPosts = relabelPosts(plannedPosts.filter((post) => !createdSlots.has(post.slot_time)).map(({ slot_time, ...post }) => post));
  if (scheduledPosts.length) {
    await saveScheduledApprovalLessons(
      scheduledPosts.map((post) => ({
        slot: post.slot,
        source_text: post.text,
        user_feedback: post.approval_lesson,
      })),
      { scheduled_at: scheduledAt, target_date: scheduleDate },
    );
  }
  const scheduledSnapshot = {
    ...latestRun,
    schedule_result: output,
    scheduled_batch_preset: batchPresetState.active_preset ?? null,
    scheduled_target_date: scheduleDate,
    scheduled_at: scheduledAt,
    status: scheduledPosts.length ? "scheduled" : latestRun.status,
  };
  await writeJson(path.join(VAULT, "Runs", `scheduled-${nowStamp()}.json`), scheduledSnapshot);
  const nextRun = {
    ...latestRun,
    schedule_result: output,
    scheduled_batch_preset: batchPresetState.active_preset ?? null,
    scheduled_target_date: scheduleDate,
    scheduled_at: scheduledAt,
    status: remainingPosts.length ? "generated" : "scheduled",
    posts: remainingPosts,
    requested_post_count: remainingPosts.length,
  };
  await writeJson(path.join(VAULT, "Runs", "latest-run.json"), nextRun);
  return nextRun;
}

async function scheduleSingleRunPost(slot, date, time) {
  const latestRun = await loadLatestRun();
  if (!latestRun?.posts?.length) throw new Error("No generated run is available.");
  const normalizedSlot = String(slot ?? "").trim();
  const scheduleDate = String(date ?? "").trim();
  const scheduleTime = String(time ?? "").trim();
  if (!normalizedSlot) throw new Error("Select exactly one post to custom schedule.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate)) throw new Error("Choose a valid schedule date.");
  if (!/^\d{2}:\d{2}$/.test(scheduleTime)) throw new Error("Choose a valid schedule time.");
  const post = latestRun.posts.find((entry) => String(entry?.slot ?? "") === normalizedSlot);
  if (!post) throw new Error("Selected post is no longer in the slate.");
  const threadsUserId = await resolveThreadsUserId(scheduleDate);
  const result = await fetchJson("/api/threads/schedule", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      threads_user_id: threadsUserId,
      text: post.text,
      date: scheduleDate,
      time: scheduleTime,
      timezone: TIMEZONE,
    }),
  });
  const scheduledAt = new Date().toISOString();
  await saveScheduledApprovalLessons([{
    slot: post.slot,
    source_text: post.text,
    user_feedback: post.approval_lesson,
  }], {
    scheduled_at: scheduledAt,
    target_date: scheduleDate,
  });
  latestRun.posts = relabelPosts(latestRun.posts.filter((entry) => String(entry?.slot ?? "") !== normalizedSlot));
  latestRun.requested_post_count = latestRun.posts.length;
  latestRun.last_custom_schedule = {
    slot: normalizedSlot,
    date: scheduleDate,
    time: scheduleTime,
    scheduled_post: result?.scheduled_post ?? null,
    scheduled_at: scheduledAt,
  };
  await writeJson(path.join(VAULT, "Runs", "latest-run.json"), latestRun);
  return { run: latestRun, scheduled_post: result?.scheduled_post ?? null };
}

async function pullFreshContext(targetDate = null) {
  if (activeRun) throw new Error(`Agent is already running: ${activeRun.phase}`);
  activeRun = { id: nowStamp(), phase: "syncing_lensically_insights", started_at: new Date().toISOString() };
  const postSync = await syncLensicallyPostArchive();
  activeRun = { ...activeRun, phase: "syncing_lensically_followers" };
  const followerSync = await syncLensicallyFollowers();
  activeRun = { ...activeRun, phase: "syncing_saved_patterns" };
  const [savedPatternsByLikes, savedPatternsByNewest] = await Promise.all([
    fetchAllSavedPatterns("likes"),
    fetchAllSavedPatterns("newest"),
  ]);
  const savedPatterns = mergeSavedPatterns(savedPatternsByLikes, savedPatternsByNewest);
  activeRun = { ...activeRun, phase: "building_hermes_context_from_lensically" };
  const context = await buildFreshContext(targetDate);
  activeRun = { ...activeRun, phase: "updating_taste_memory" };
  await writeTasteMemory(context);
  activeRun = { ...activeRun, phase: "updating_saved_pattern_memory" };
  const savedPatternMemory = await writeSavedPatternMemory(savedPatterns);
  const guidance = await loadGuidance();
  const lessons = await loadLessons();
  const batchPresetState = await loadBatchPresetState(context);
  activeRun = null;
  return {
    summary: summarizeContext(context),
    sync: {
      post_archive: postSync,
      followers: followerSync,
      saved_patterns: {
        total_count: savedPatterns.length,
        likes_feed_count: savedPatternsByLikes.length,
        newest_feed_count: savedPatternsByNewest.length,
        top_count: Array.isArray(savedPatternMemory?.top_patterns) ? savedPatternMemory.top_patterns.length : 0,
      },
    },
    guidance,
    lessons,
    saved_pattern_memory: savedPatternMemory,
    batch_presets: batchPresetState.presets,
    selected_batch_preset_id: batchPresetState.selected_preset_id,
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char]);
}

function isCurrentRunUsable(run, context) {
  if (!run || typeof run !== "object") return false;
  if (!Array.isArray(run.posts) || !run.posts.length) return false;
  return true;
}

function html(initialState = {}) {
  const boot = JSON.stringify(initialState ?? {}).replace(/</g, "\\u003c");
  const initialContextDate = String(initialState?.latest_context?.target_date ?? defaultBatchTargetDate());
  const initialScheduleDate = String(initialState?.latest_run?.target_date ?? initialState?.latest_context?.target_date ?? defaultBatchTargetDate());
  const minCustomDate = isoDateInTimeZone(new Date(), TIMEZONE);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Manifest Mental Agent</title>
<style>
:root{--ink:#08111f;--muted:#5d6f89;--line:#d9e1ec;--paper:#f6f3ea;--card:#fffdf8;--accent:#0b1220;--soft:#eef3ef;--good:#0f766e;--bad:#b42318;--gold:#b87503}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 12% 8%,#fff7df 0 18%,transparent 34%),linear-gradient(135deg,#f9f6ed,#edf5f1 52%,#f4eadc);color:var(--ink);font-family:Georgia,Cambria,serif}main{width:min(1480px,calc(100vw - 32px));margin:0 auto;padding:24px 0 42px}header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding:24px;border:1px solid var(--line);background:rgba(255,253,248,.92);border-radius:20px;box-shadow:0 22px 70px rgba(15,23,42,.1)}h1{margin:0;font-size:34px;letter-spacing:-.04em}.sub{margin:8px 0 0;color:var(--muted);line-height:1.45;max-width:860px;font-family:Segoe UI,ui-sans-serif,sans-serif}.actions,.review-actions,.guidance-actions,.control-actions,.feedback-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}button{border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:999px;padding:12px 17px;font-weight:800;font-size:14px;cursor:pointer;font-family:Segoe UI,ui-sans-serif,sans-serif}button.secondary{background:#fff;color:var(--ink);border-color:var(--line)}button.danger{background:#fff4f2;color:var(--bad);border-color:#f1b8b2}button.danger:not(:disabled){box-shadow:0 0 0 3px rgba(180,35,24,.08)}button:disabled{opacity:.48;cursor:not-allowed}.banner{margin-top:14px;border-radius:14px;padding:13px 16px;border:1px solid var(--line);background:rgba(255,253,248,.9);color:var(--muted);font-family:Segoe UI,ui-sans-serif,sans-serif}.banner.error{border-color:#f1b8b2;color:var(--bad);background:#fff4f2}.banner.ok{border-color:#9fd8cf;color:var(--good);background:#eefbf8}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px}.metric{border:1px solid var(--line);background:rgba(255,253,248,.9);border-radius:16px;padding:15px}.metric p{margin:0;color:#60718b;font-size:10px;text-transform:uppercase;letter-spacing:.16em;font-weight:900;font-family:Segoe UI,ui-sans-serif,sans-serif}.metric strong{display:block;margin-top:8px;font-size:27px;letter-spacing:-.04em}.metric span{display:block;margin-top:7px;color:var(--muted);font-size:13px;line-height:1.4;font-family:Segoe UI,ui-sans-serif,sans-serif}.guidance,.control{margin-top:16px;border:1px solid var(--line);background:rgba(255,253,248,.9);border-radius:16px;padding:18px}.guidance h2,.control h2,.posts h2{margin:0 0 10px;font-size:17px;letter-spacing:-.03em}.guidance-grid{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:14px}.guidance-list{max-height:155px;overflow:auto;border:1px solid var(--line);border-radius:14px;padding:10px;background:rgba(255,255,255,.55);font:13px/1.45 Segoe UI,ui-sans-serif,sans-serif;color:#334155}.guidance-item{padding:8px 0;border-bottom:1px solid #e8edf4}.guidance-item:last-child{border-bottom:0}.control-grid{display:grid;grid-template-columns:310px minmax(0,1fr);gap:14px;margin-top:12px}.control-list{max-height:420px;overflow:auto;border:1px solid var(--line);border-radius:14px;padding:10px;background:rgba(255,255,255,.55);font:13px/1.4 Segoe UI,ui-sans-serif,sans-serif}.control-group{margin:8px 0 10px;color:#526985;font-weight:900;text-transform:uppercase;letter-spacing:.12em}.control-item{display:block;width:100%;text-align:left;margin:5px 0;border-color:#dfe6ef;background:#fff;color:#0b2445;border-radius:12px;padding:9px 11px}.control-item.active{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,117,3,.12)}#control-editor{min-height:420px;font-family:Consolas,ui-monospace,monospace;font-size:12px;white-space:pre}.control-meta{font:13px/1.4 Segoe UI,ui-sans-serif,sans-serif;color:var(--muted);margin:0 0 8px}.posts{margin-top:16px;border:1px solid var(--line);background:rgba(255,253,248,.65);border-radius:20px;overflow:hidden}.posts-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:18px;align-items:center;padding:16px 18px;border-bottom:1px solid var(--line);background:rgba(255,253,248,.96);backdrop-filter:blur(8px)}.review-actions,.guidance-actions,.control-actions,.feedback-actions{align-items:center}.count{color:var(--muted);font-size:13px;font-family:Segoe UI,ui-sans-serif,sans-serif}.post{display:grid;grid-template-columns:42px 120px minmax(0,1.2fr) minmax(340px,.9fr);gap:22px;padding:24px 18px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.5)}.post:last-child{border-bottom:0}.post.selected{background:linear-gradient(90deg,rgba(184,117,3,.1),rgba(255,255,255,.72))}.post.approved{box-shadow:inset 4px 0 0 var(--gold)}.post.drop-target{box-shadow:inset 0 0 0 2px rgba(184,117,3,.55);background:linear-gradient(90deg,rgba(184,117,3,.08),rgba(255,255,255,.8))}.post.dragging{opacity:.55}.pick{display:flex;align-items:flex-start;justify-content:center;padding-top:10px}.pick input{width:20px;height:20px;accent-color:var(--accent)}.slotbox{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding-top:4px}.slot{font-weight:900;font-size:22px;letter-spacing:-.04em}.slot-meta{display:flex;flex-direction:column;gap:6px}.drag-handle{display:inline-flex;align-items:center;gap:8px;border:1px dashed #cbd5e1;border-radius:999px;padding:8px 12px;background:rgba(255,255,255,.7);color:#40556f;font:12px/1 Segoe UI,ui-sans-serif,sans-serif;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:grab;user-select:none}.drag-handle:active{cursor:grabbing}.drag-handle::before{content:'⋮⋮';font-size:14px;letter-spacing:-1px}.text{font-size:23px;line-height:1.38;margin:0;letter-spacing:-.03em}.copy{padding-top:4px;display:flex;flex-direction:column;gap:14px}.copy-actions{display:flex;justify-content:flex-start}.copy textarea{min-height:120px;padding:15px 16px;font-size:15px;line-height:1.55}.review{display:flex;flex-direction:column;gap:16px;padding:16px 18px;border:1px solid #dde6f0;border-radius:18px;background:rgba(255,255,255,.72)}textarea{width:100%;min-height:96px;resize:vertical;border:1px solid var(--line);border-radius:14px;padding:12px;font:14px/1.45 Segoe UI,ui-sans-serif,sans-serif;background:#fff}.note-block{display:flex;flex-direction:column;gap:8px}.note-block + .note-block{padding-top:16px;border-top:1px solid #e6edf5}.note-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.note-title{margin:0;font:800 13px/1.2 Segoe UI,ui-sans-serif,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#36506f}.note-help{margin:4px 0 0;color:var(--muted);font:13px/1.45 Segoe UI,ui-sans-serif,sans-serif;max-width:28ch}.note-head .feedback-actions{align-self:center}.feedback-label{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;color:#526985;font-size:12px;font-weight:800;letter-spacing:.08em;font-family:Segoe UI,ui-sans-serif,sans-serif}.feedback-actions{justify-content:flex-start}.empty{padding:38px 18px;color:var(--muted);font-family:Segoe UI,ui-sans-serif,sans-serif}@media(max-width:1100px){header,.guidance-grid,.control-grid{display:block}.actions{justify-content:flex-start;margin-top:16px}.metrics{grid-template-columns:1fr 1fr}.post{grid-template-columns:38px 110px 1fr}.review{grid-column:1/-1}.posts-head{display:block}.review-actions{justify-content:flex-start;margin-top:10px}.guidance-list,.control-list{margin-top:12px}}@media(max-width:720px){main{width:min(100vw - 18px,720px)}.metrics{grid-template-columns:1fr}.post{grid-template-columns:34px 1fr}.slotbox{grid-column:2}.copy{grid-column:2}.review{grid-column:2;padding:14px}.note-head,.feedback-label{align-items:flex-start;flex-direction:column}.feedback-actions{width:100%}}
</style></head><body><main><header><div><h1>Manifest Mental Agent</h1><p class="sub">Pull Data manually syncs Lensically insights and followers, then Hermes generates from that fresh Lensically state for up to 24 hours.</p></div><div class="actions"><label style="display:flex;align-items:center;gap:8px;font:13px/1.2 Segoe UI,ui-sans-serif,sans-serif;color:var(--muted)">Posts <input id="post-count" type="number" min="1" max="${MAX_POST_COUNT}" value="${DEFAULT_POST_COUNT}" style="width:96px;border:1px solid var(--line);border-radius:999px;padding:9px 12px;background:#fff;color:var(--ink);font:14px/1 Segoe UI,ui-sans-serif,sans-serif"></label><button id="pull-data" class="secondary">Pull Data</button><button id="generate">Generate Posts</button><button id="stop" class="danger" disabled>Stop Agent</button><button id="schedule" class="secondary">Schedule Latest</button></div></header><div id="message" class="banner">Starting local agent surface...</div><section id="metrics" class="metrics"></section><section class="control"><h2>Context Date</h2><p class="control-meta">Pull Data and Generate use this date. Change it without affecting batch scheduling.</p><div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin-bottom:4px"><label style="display:flex;flex-direction:column;gap:6px;font:13px/1.2 Segoe UI,ui-sans-serif,sans-serif;color:var(--muted)"><span>Context Date</span><input id="context-target-date" type="date" value="${initialContextDate}" min="${minCustomDate}" style="border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:#fff;color:var(--ink);font:14px/1 Segoe UI,ui-sans-serif,sans-serif"></label><span class="count">Use this when refreshing Lensically data or generating a slate.</span></div></section><section class="control"><h2>Batch Schedule</h2><p class="control-meta">Pick the saved Lensically batch Hermes should use only when you schedule the current slate.</p><div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin-bottom:12px"><label style="display:flex;flex-direction:column;gap:6px;font:13px/1.2 Segoe UI,ui-sans-serif,sans-serif;color:var(--muted)"><span>Schedule Date</span><input id="batch-target-date" type="date" value="${initialScheduleDate}" min="${minCustomDate}" style="border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:#fff;color:var(--ink);font:14px/1 Segoe UI,ui-sans-serif,sans-serif"></label><span class="count">Used only when scheduling the current slate.</span></div><div id="batch-presets" class="control-list">Loading saved batches...</div></section><section class="control"><h2>Custom Schedule</h2><p class="control-meta">Select exactly one generated post, then schedule it directly with a custom date and time.</p><div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap"><label style="display:flex;flex-direction:column;gap:6px;font:13px/1.2 Segoe UI,ui-sans-serif,sans-serif;color:var(--muted)"><span>Date</span><input id="custom-schedule-date" type="date" min="${minCustomDate}" style="border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:#fff;color:var(--ink);font:14px/1 Segoe UI,ui-sans-serif,sans-serif"></label><label style="display:flex;flex-direction:column;gap:6px;font:13px/1.2 Segoe UI,ui-sans-serif,sans-serif;color:var(--muted)"><span>Time</span><input id="custom-schedule-time" type="time" style="border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:#fff;color:var(--ink);font:14px/1 Segoe UI,ui-sans-serif,sans-serif"></label><button id="schedule-custom" class="secondary">Schedule Selected</button></div></section><section class="guidance"><h2>Steer The Agent</h2><div class="guidance-grid"><div><textarea id="guidance-input" placeholder="Tell the agent what to learn. Example: stop using cleanly/clearly, avoid vague emotional abstractions, prefer concrete scenes with a sharper payoff."></textarea><div class="guidance-actions"><button id="save-guidance" class="secondary">Talk To Agent + Save</button><button id="store-guidance" class="secondary">Store Only</button></div><p id="agent-reply" class="banner">Use Talk To Agent when you want Hermes to interpret the steering. Use Store Only when you just want the note saved as memory.</p></div><div class="guidance-list" id="guidance-list">No steering guidance saved yet.</div></div></section><section class="control"><h2>Agent Control</h2><button id="toggle-control" class="secondary">Open Control Panel</button><div id="control-panel" style="display:none"><p class="control-meta">Inspect and edit memory, prompts, context, and runs. Latest prompts, context, and runs are read-only evidence.</p><div class="control-grid"><div id="control-list" class="control-list">Loading controls...</div><div><p id="control-meta" class="control-meta">Select an artifact.</p><textarea id="control-editor" spellcheck="false"></textarea><div class="control-actions"><button id="save-control" class="secondary" disabled>Save Artifact</button><button id="reload-control" class="secondary" disabled>Reload</button></div></div></div></div></section><section class="posts"><div class="posts-head"><h2>Generated Posts</h2><span id="slate-status">0</span></div><div id="posts"><div class="empty">Pull data, enter a post count, then generate.</div></div></section></main>
<script>
const initialData=${boot};const state={run:initialData.latest_run||null,active:initialData.active_run||null,reasons:{},approvalLessons:{},selected:{},edits:{},guidance:Array.isArray(initialData.guidance)?initialData.guidance:[],context:initialData.latest_context||null,batchPresets:Array.isArray(initialData.batch_presets)?initialData.batch_presets:[],selectedBatchPresetId:initialData.selected_batch_preset_id||null,guidanceBusy:false,loading:true};const fmt=n=>new Intl.NumberFormat('en-US').format(Math.round(Number(n||0)));const pct=n=>(Number(n||0)).toFixed(4)+'%';
let controlState={registry:[],current:null};
let guidanceVersion=0;
function msg(t,type=''){const e=document.getElementById('message');e.textContent=t;e.className='banner '+type}
function setGuidanceReply(t,type=''){const e=document.getElementById('agent-reply');e.textContent=t;e.className='banner'+(type?' '+type:'')}
async function api(p,o={}){const r=await fetch(p,{...o,headers:{'content-type':'application/json',...(o.headers||{})}});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.error||'Request failed');return d}
function metric(l,v,h=''){return '<div class="metric"><p>'+l+'</p><strong>'+v+'</strong><span>'+h+'</span></div>'}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function isCurrentRunUsable(run, context){if(!run||typeof run!=='object')return false;if(!Array.isArray(run.posts)||!run.posts.length)return false;if(!context||typeof context!=='object')return true;return String(run.target_date||'')===String(context.target_date||'')}
function renderGuidance(){const list=document.getElementById('guidance-list');list.innerHTML=state.guidance.length?state.guidance.slice(-12).reverse().map(item=>{const mode=item.mode==='agent_reply'?'Talked to agent':'Stored directly';return '<div class="guidance-item"><b>'+esc(new Date(item.saved_at).toLocaleString())+'</b><br><b>Mode:</b> '+esc(mode)+'<br><b>You said:</b> '+esc(item.user_input||'')+(item.understanding&&item.understanding!==item.user_input?'<br><br><b>Understanding:</b> '+esc(item.understanding):'')+'</div>'}).join(''):'No steering guidance saved yet.'}
function renderBatchPresets(){const activeId=state.selectedBatchPresetId||null;const target=document.getElementById('batch-presets');const header=activeId?'<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button id="clear-batch-selection" class="secondary">Clear Selection</button></div>':'<div style="margin-bottom:10px;color:var(--muted)">No batch selected.</div>';target.innerHTML=state.batchPresets.length?header+state.batchPresets.map(preset=>{const active=activeId===preset.id;return '<button class="control-item use-batch'+(active?' active':'')+'" data-preset="'+esc(preset.id)+'" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div style="text-align:left"><div style="font-weight:800">'+esc(preset.name)+(preset.is_favorite?' <span style=\"color:var(--gold)\">Favorite</span>':'')+'</div><div style="margin-top:6px;color:var(--muted);font-size:12px;line-height:1.45">'+esc((preset.times||[]).join(', '))+'</div></div><div style="white-space:nowrap;font-weight:800;color:'+(active?'var(--gold)':'#0b2445')+'">'+(active?'Selected':'Use This Batch')+'</div></div></button>'}).join(''):'No saved Lensically batches yet.';document.querySelectorAll('.use-batch').forEach(btn=>btn.onclick=()=>useBatchPreset(btn.dataset.preset));const clear=document.getElementById('clear-batch-selection');if(clear)clear.onclick=clearBatchPreset}
function selectedSlots(){return Object.keys(state.selected).filter(slot=>state.selected[slot])}
function getContextTargetDate(){return String(document.getElementById('context-target-date')?.value||'').trim()}
function getBatchTargetDate(){return String(document.getElementById('batch-target-date')?.value||'').trim()}
function getCustomScheduleDate(){return String(document.getElementById('custom-schedule-date')?.value||'').trim()}
function getCustomScheduleTime(){return String(document.getElementById('custom-schedule-time')?.value||'').trim()}
function render(){const rawRun=state.run||null,context=state.context||{},run=isCurrentRunUsable(rawRun,context)?rawRun:{},m=context.metrics||run.metrics||{},posts=run.posts||[],selected=selectedSlots(),requested=run.requested_post_count||posts.length||Number(document.getElementById('post-count')?.value||${DEFAULT_POST_COUNT}),approvedCount=posts.filter(post=>post.approved).length,batchPreset=(state.batchPresets.find(preset=>preset.id===state.selectedBatchPresetId)||null),batchLabel=batchPreset?.name||'No batch selected',batchMeta=batchPreset?'Used only when scheduling the current slate':'Choose a saved Lensically batch before scheduling';renderGuidance();renderBatchPresets();document.getElementById('metrics').innerHTML=[metric('Current Followers',fmt(m.current_followers),fmt(m.followers_to_1m)+' away from 1M'),metric('Progress To 1M',pct(m.progress_to_1m_percent),'North-star target'),metric('2x Top Likes',fmt(m.goals?.top_post_likes_2x),'Top likes: '+fmt(m.top_post?.likes)),metric('2x Avg Views',fmt(m.goals?.average_views_2x),'Avg views: '+fmt(m.baselines?.average_views)),metric('2x Avg Likes',fmt(m.goals?.average_likes_2x),'Avg likes: '+fmt(m.baselines?.average_likes)),metric('Archive Seen',fmt(m.baselines?.archive_total_seen),fmt(m.baselines?.recent_sample_size)+' recent sample'),metric('Follower Snapshots',fmt(m.baselines?.follower_snapshots_seen),'Fresh on Pull Data'),metric('Batch Preset',batchPreset?.times?.length?fmt(batchPreset.times.length)+' slots':'0 slots',batchLabel+' · '+batchMeta),metric('Slate',posts.length+'/'+requested,(run.target_date||context.target_date)?'Target '+(run.target_date||context.target_date)+' · '+approvedCount+' approved':'No target')].join('');document.getElementById('pull-data').disabled=Boolean(state.active);document.getElementById('schedule').disabled=!posts.length||Boolean(state.active);document.getElementById('generate').disabled=Boolean(state.active);document.getElementById('post-count').disabled=Boolean(state.active);document.getElementById('stop').disabled=!Boolean(state.active);document.getElementById('slate-status').innerHTML=posts.length?'<span class="count">'+selected.length+' selected · '+approvedCount+' approved</span><div class="review-actions"><button id="select-all" class="secondary">Select All</button><button id="approve-selected" class="secondary" '+(!selected.length||state.active?'disabled':'')+'>Approve Selected</button><button id="unapprove-selected" class="secondary" '+(!selected.length||state.active?'disabled':'')+'>Unapprove Selected</button><button id="delete-selected" class="secondary" '+(!selected.length||state.active?'disabled':'')+'>Delete Selected</button><button id="clear-selected" class="secondary" '+(!selected.length?'disabled':'')+'>Clear</button><span class="count">'+posts.length+'/'+requested+'</span></div>':'0';document.getElementById('posts').innerHTML=posts.length?posts.map((post,index)=>{const draft=Object.prototype.hasOwnProperty.call(state.edits,post.slot)?state.edits[post.slot]:post.text;const approvalLesson=Object.prototype.hasOwnProperty.call(state.approvalLessons,post.slot)?state.approvalLessons[post.slot]:String(post.approval_lesson||'');const noteBlock=post.approved?'<div class="note-block"><div class="note-head"><div><p class="note-title">Approval lesson</p><p class="note-help">Saved only if this post is actually scheduled.</p></div></div><textarea data-approval-lesson="'+post.slot+'" data-index="'+index+'" placeholder="Why is this post good? This will be saved into approval lessons only if this post gets scheduled.">'+esc(approvalLesson)+'</textarea></div>':'<div class="note-block"><div class="note-head"><div><p class="note-title">Delete feedback</p><p class="note-help">Use this only when you cut the post and want rejection memory updated.</p></div><div class="feedback-actions"><button class="secondary delete-post" data-index="'+index+'" '+(state.active?'disabled':'')+'>Delete</button></div></div><textarea data-reason="'+post.slot+'" placeholder="Why is this post bad? This will be saved into rejection memory when you delete it.">'+esc(state.reasons[post.slot]||'')+'</textarea></div>';return '<article class="post '+(state.selected[post.slot]?'selected ':'')+(post.approved?'approved':'')+'" data-index="'+index+'"><label class="pick"><input type="checkbox" data-select="'+post.slot+'" '+(state.selected[post.slot]?'checked':'')+'></label><div class="slotbox"><div class="drag-handle" draggable="'+(!state.active)+'" data-drag-index="'+index+'" title="Drag to reorder">Drag</div><div class="slot-meta"><div class="slot">#'+(index+1)+'</div><div class="count">'+esc(post.slot)+'</div>'+(post.approved?'<div class="count" style="color:var(--gold);font-weight:800">Approved</div>':'<div class="count">Not approved</div>')+'</div></div><div class="copy"><textarea data-edit="'+post.slot+'" data-index="'+index+'" placeholder="Edit post text here.">'+esc(draft)+'</textarea><div class="copy-actions"><button class="secondary toggle-approval" data-slot="'+esc(post.slot)+'" data-approved="'+(post.approved?'1':'0')+'" '+(state.active?'disabled':'')+'>'+(post.approved?'Unapprove':'Approve')+'</button></div></div><div class="review">'+noteBlock+'</div></article>'}).join(''):'<div class="empty">Pull data, enter a post count, then generate.</div>';document.querySelectorAll('input[data-select]').forEach(el=>el.addEventListener('change',e=>{state.selected[e.target.dataset.select]=e.target.checked;render()}));document.querySelectorAll('textarea[data-reason]').forEach(el=>el.addEventListener('input',e=>{state.reasons[e.target.dataset.reason]=e.target.value}));document.querySelectorAll('textarea[data-edit]').forEach(el=>{el.addEventListener('input',e=>{state.edits[e.target.dataset.edit]=e.target.value});el.addEventListener('blur',e=>savePostEdit(Number(e.target.dataset.index),true))});document.querySelectorAll('textarea[data-approval-lesson]').forEach(el=>{el.addEventListener('input',e=>{state.approvalLessons[e.target.dataset.approvalLesson]=e.target.value});el.addEventListener('blur',e=>saveApprovalLesson(Number(e.target.dataset.index),true))});document.querySelectorAll('.toggle-approval').forEach(btn=>btn.addEventListener('click',()=>toggleApproval(btn.dataset.slot,btn.dataset.approved==='1')));document.querySelectorAll('.delete-post').forEach(btn=>btn.addEventListener('click',()=>deletePost(Number(btn.dataset.index))));document.querySelectorAll('.drag-handle').forEach(handle=>{handle.addEventListener('dragstart',event=>{const index=handle.dataset.dragIndex;if(!index)return;event.dataTransfer?.setData('text/plain',index);event.dataTransfer&&(event.dataTransfer.effectAllowed='move');handle.closest('.post')?.classList.add('dragging')});handle.addEventListener('dragend',()=>{document.querySelectorAll('.post').forEach(card=>card.classList.remove('dragging','drop-target'))})});document.querySelectorAll('.post').forEach(card=>{card.addEventListener('dragover',event=>{event.preventDefault();if(state.active)return;event.dataTransfer&&(event.dataTransfer.dropEffect='move');document.querySelectorAll('.post.drop-target').forEach(node=>node.classList.remove('drop-target'));card.classList.add('drop-target')});card.addEventListener('dragleave',event=>{if(!card.contains(event.relatedTarget))card.classList.remove('drop-target')});card.addEventListener('drop',event=>{event.preventDefault();card.classList.remove('drop-target');const fromIndex=Number(event.dataTransfer?.getData('text/plain'));const toIndex=Number(card.dataset.index);if(Number.isInteger(fromIndex)&&Number.isInteger(toIndex)&&fromIndex!==toIndex)reorderPosts(fromIndex,toIndex)})});const approveSelected=document.getElementById('approve-selected');if(approveSelected)approveSelected.onclick=approveSelectedPosts;const unapproveSelected=document.getElementById('unapprove-selected');if(unapproveSelected)unapproveSelected.onclick=unapproveSelectedPosts;const deleteSelected=document.getElementById('delete-selected');if(deleteSelected)deleteSelected.onclick=deleteSelectedPosts;const selectAll=document.getElementById('select-all');if(selectAll)selectAll.onclick=()=>{posts.forEach(post=>{state.selected[post.slot]=true});render()};const clear=document.getElementById('clear-selected');if(clear)clear.onclick=()=>{state.selected={};render()}}
async function savePostEdit(index,silent=false){const posts=state.run?.posts||[];const post=posts[index]||null;if(!post)return;const text=String(Object.prototype.hasOwnProperty.call(state.edits,post.slot)?state.edits[post.slot]:post.text).trim();if(!text||text===post.text)return;if(!silent)msg('Saving post text.');try{const d=await api('/run/posts/edit',{method:'POST',body:JSON.stringify({index,text})});delete state.edits[post.slot];state.run=d.run;if(!silent)msg('Post text updated.','ok')}catch(e){msg(e.message,'error')}finally{if(!silent)render()}}
async function saveApprovalLesson(index,silent=false){const posts=state.run?.posts||[];const post=posts[index]||null;if(!post)return;const approvalLesson=String(Object.prototype.hasOwnProperty.call(state.approvalLessons,post.slot)?state.approvalLessons[post.slot]:post.approval_lesson||'').trim();if(approvalLesson===String(post.approval_lesson||'').trim())return;if(!silent)msg('Saving approval lesson.');try{const d=await api('/run/posts/approval-lesson',{method:'POST',body:JSON.stringify({index,approval_lesson:approvalLesson})});delete state.approvalLessons[post.slot];state.run=d.run;if(!silent)msg('Approval lesson updated.','ok')}catch(e){msg(e.message,'error')}finally{if(!silent)render()}}
async function unapproveSelectedPosts(){const slots=selectedSlots();if(!slots.length){msg('Select at least one post to unapprove.','error');return}msg('Removing approval from selected posts.');try{const d=await api('/run/posts/unapprove',{method:'POST',body:JSON.stringify({slots})});state.run=d.run;state.selected={};msg('Selected posts unapproved.','ok')}catch(e){msg(e.message,'error')}finally{render()}}
async function toggleApproval(slot,isApproved){msg((isApproved?'Removing approval from ':'Approving ')+slot+'.');try{const d=await api(isApproved?'/run/posts/unapprove':'/run/posts/approve',{method:'POST',body:JSON.stringify({slots:[slot]})});state.run=d.run;delete state.selected[slot];msg('Post approval updated.','ok')}catch(e){msg(e.message,'error')}finally{render()}}
async function refresh(){const currentGuidanceVersion=guidanceVersion;try{const d=await api('/status');state.active=d.active_run;state.run=d.latest_run;if(currentGuidanceVersion===guidanceVersion)state.guidance=d.guidance||[];state.context=d.latest_context||state.context;state.batchPresets=Array.isArray(d.batch_presets)?d.batch_presets:state.batchPresets;state.selectedBatchPresetId=d.selected_batch_preset_id||state.selectedBatchPresetId;if(state.active)msg('Agent phase: '+state.active.phase);else msg(state.context?'View refreshed. Latest pulled data loaded.':state.run?'View refreshed. Latest run loaded.':'Agent ready. No run yet.','ok')}finally{state.loading=false;render()}}
async function useBatchPreset(presetId){msg('Using selected Lensically batch in Hermes.');try{const d=await api('/batch-presets/use',{method:'POST',body:JSON.stringify({preset_id:presetId})});state.batchPresets=Array.isArray(d.presets)?d.presets:state.batchPresets;state.selectedBatchPresetId=d.selected_preset_id||presetId;msg('Using '+(d.active_preset?.name||'selected batch')+' for Hermes generation and scheduling.','ok')}catch(e){msg(e.message,'error')}finally{render()}}
async function clearBatchPreset(){msg('Clearing Hermes batch selection.');try{const d=await api('/batch-presets/clear',{method:'POST',body:'{}'});state.batchPresets=Array.isArray(d.presets)?d.presets:state.batchPresets;state.selectedBatchPresetId=null;msg('Batch selection cleared. Choose a batch before generating.','ok')}catch(e){msg(e.message,'error')}finally{render()}}
async function pullData(){const targetDate=getContextTargetDate();if(!targetDate){msg('Choose a context date before pulling data.','error');return}msg('Pulling fresh Lensically insights and followers without Hermes.');state.active={phase:'syncing_lensically_insights'};render();try{const d=await api('/pull-data',{method:'POST',body:JSON.stringify({target_date:targetDate})});state.context=d.context?.summary||state.context;state.guidance=Array.isArray(d.context?.guidance)?d.context.guidance:state.guidance;state.batchPresets=Array.isArray(d.context?.batch_presets)?d.context.batch_presets:state.batchPresets;state.selectedBatchPresetId=d.context?.selected_batch_preset_id??state.selectedBatchPresetId;const sync=d.context?.sync||{};msg('Pulled fresh Lensically data for '+targetDate+'. Synced '+(sync.post_archive?.synced_posts||0)+' posts across '+(sync.post_archive?.pages||0)+' pages and refreshed '+(sync.followers?.total_count||0)+' follower snapshots.','ok')}catch(e){msg(e.message,'error')}finally{state.active=null;render()}}
async function generate(){const postCount=Number(document.getElementById('post-count').value||17);const targetDate=getContextTargetDate();if(!targetDate){msg('Choose a context date before generating.','error');return}msg('Generating '+postCount+' more posts for '+targetDate+'. Hermes is appending to the current slate; this can take several minutes.');state.active={phase:'starting'};render();try{const d=await api('/generate',{method:'POST',body:JSON.stringify({post_count:postCount,target_date:targetDate})});state.run=d.run;state.context=d.context||state.context;state.selected={};msg('Slate now has '+(d.run?.posts?.length||postCount)+' total posts for '+targetDate+'.','ok')}catch(e){msg(e.message,'error')}finally{state.active=null;render()}}
async function reorderPosts(fromIndex,toIndex){msg('Reordering generated posts.');try{const d=await api('/run/posts/reorder',{method:'POST',body:JSON.stringify({from_index:fromIndex,to_index:toIndex})});state.run=d.run;msg('Post order updated.','ok')}catch(e){msg(e.message,'error')}finally{render()}}
async function deletePost(index){const posts=state.run?.posts||[];const post=posts[index]||null;if(!post){msg('Post not found.','error');return}if(!window.confirm('Delete generated post #'+(index+1)+'?'))return;msg('Deleting generated post #'+(index+1)+'.');try{const d=await api('/run/posts/delete',{method:'POST',body:JSON.stringify({index,reason:(state.reasons[post.slot]||'').trim()})});delete state.reasons[post.slot];delete state.approvalLessons[post.slot];delete state.selected[post.slot];state.run=d.run;msg('Post deleted.','ok')}catch(e){msg(e.message,'error')}finally{render()}}
async function approveSelectedPosts(){const slots=selectedSlots();if(!slots.length){msg('Select at least one post to approve.','error');return}msg('Approving selected posts.');try{const d=await api('/run/posts/approve',{method:'POST',body:JSON.stringify({slots})});state.run=d.run;state.selected={};msg('Selected posts approved. Future generate runs will keep them and append new posts after the current slate.','ok')}catch(e){msg(e.message,'error')}finally{render()}}
async function deleteSelectedPosts(){const slots=selectedSlots();if(!slots.length){msg('Select at least one post to delete.','error');return}if(!window.confirm('Delete '+slots.length+' selected post'+(slots.length===1?'':'s')+'?'))return;msg('Deleting selected posts.');try{const entries=slots.map(slot=>({slot,reason:(state.reasons[slot]||'').trim()}));const d=await api('/run/posts/delete-selected',{method:'POST',body:JSON.stringify({entries})});slots.forEach(slot=>{delete state.reasons[slot];delete state.approvalLessons[slot];delete state.selected[slot]});state.selected={};state.run=d.run;msg('Selected posts deleted.','ok')}catch(e){msg(e.message,'error')}finally{render()}}
async function schedule(){const targetDate=getBatchTargetDate();if(!targetDate){msg('Choose a target date before scheduling.','error');return}const posts=state.run?.posts||[];if(!posts.length){msg('No generated run is available.','error');return}if(!window.confirm('Schedule '+posts.length+' post'+(posts.length===1?'':'s')+' for '+targetDate+'? Double-check the date before continuing.'))return;msg('Scheduling the latest generated posts through Lensically for '+targetDate+'.');try{const d=await api('/schedule',{method:'POST',body:JSON.stringify({target_date:targetDate})});state.run=d.run;const created=(d.run?.schedule_result?.response?.created||[]).length;const skipped=(d.run?.schedule_result?.response?.skipped||[]).length;if(created&&skipped)msg('Scheduled '+created+' post'+(created===1?'':'s')+' for '+targetDate+' and kept '+(d.run?.posts?.length||0)+' unscheduled post'+((d.run?.posts?.length||0)===1?'':'s')+' in the slate.','ok');else if(created)msg('Scheduled '+created+' post'+(created===1?'':'s')+' for '+targetDate+'. It did not publish.','ok');else msg('Nothing was scheduled for '+targetDate+'. The slate was kept intact.','ok')}catch(e){msg(e.message,'error')}finally{render()}}
async function scheduleCustom(){const slots=selectedSlots();if(slots.length!==1){msg('Select exactly one post for custom scheduling.','error');return}const date=getCustomScheduleDate();const time=getCustomScheduleTime();if(!date||!time){msg('Choose both a custom date and time first.','error');return}if(!window.confirm('Schedule '+slots[0]+' for '+date+' at '+time+'? Double-check the date and time before continuing.'))return;msg('Scheduling '+slots[0]+' for '+date+' at '+time+'.');try{const d=await api('/schedule/custom',{method:'POST',body:JSON.stringify({slot:slots[0],date,time})});state.run=d.run;delete state.selected[slots[0]];msg('Scheduled '+slots[0]+' for '+date+' at '+time+'.','ok')}catch(e){msg(e.message,'error')}finally{render()}}
async function stopAgent(){msg('Stopping active Hermes run.');try{const d=await api('/kill',{method:'POST',body:'{}'});state.active=null;msg(d.killed?'Stopped active Hermes run.':'No active Hermes process found.','ok');await refresh()}catch(e){msg(e.message,'error')}finally{render()}}
async function loadControlRegistry(){const d=await api('/control');controlState.registry=d.groups||[];const list=document.getElementById('control-list');list.innerHTML=controlState.registry.map(group=>'<div class="control-group">'+esc(group.group)+'</div>'+group.items.map(item=>'<button class="control-item '+(controlState.current?.id===item.id?'active':'')+'" data-control="'+esc(item.id)+'">'+esc(item.title)+(item.editable?'':' · read-only')+'</button>').join('')).join('');document.querySelectorAll('[data-control]').forEach(btn=>btn.onclick=()=>loadControl(btn.dataset.control))}
async function loadControl(id){const d=await api('/control/file?id='+encodeURIComponent(id));controlState.current=d;document.getElementById('control-editor').value=d.content||'';document.getElementById('control-editor').readOnly=!d.editable;document.getElementById('save-control').disabled=!d.editable;document.getElementById('reload-control').disabled=false;document.getElementById('control-meta').textContent=d.title+' · '+d.type+(d.editable?' · editable':' · read-only');await loadControlRegistry()}
async function saveControl(){if(!controlState.current)return;try{const d=await api('/control/file',{method:'POST',body:JSON.stringify({id:controlState.current.id,content:document.getElementById('control-editor').value})});controlState.current=d;msg('Saved '+d.title+'.','ok');if(d.id==='memory/guidance'){const s=await api('/status');state.guidance=s.guidance||[];render()}}catch(e){msg(e.message,'error')}}
async function toggleControl(){const panel=document.getElementById('control-panel');const open=panel.style.display==='none';panel.style.display=open?'block':'none';document.getElementById('toggle-control').textContent=open?'Close Control Panel':'Open Control Panel';if(open)await loadControlRegistry()}
async function saveGuidance(){const input=document.getElementById('guidance-input');const text=input.value.trim();if(!text){msg('Write guidance before saving.','error');setGuidanceReply('Write guidance before saving.','error');return}guidanceVersion+=1;state.guidanceBusy=true;state.active={phase:'reasoning_about_guidance'};setGuidanceReply('Agent is reasoning about the guidance...');msg('Sending steering to Hermes.');render();try{const d=await api('/guidance',{method:'POST',body:JSON.stringify({text})});state.guidance=d.guidance||[];input.value='';setGuidanceReply(d.reply,'ok');msg('Guidance saved to agent memory.','ok')}catch(e){setGuidanceReply(e.message,'error');msg(e.message,'error')}finally{state.guidanceBusy=false;state.active=null;render()}}
async function storeGuidanceOnly(){const input=document.getElementById('guidance-input');const text=input.value.trim();if(!text){msg('Write guidance before saving.','error');setGuidanceReply('Write guidance before saving.','error');return}guidanceVersion+=1;state.guidanceBusy=true;setGuidanceReply('Saving steering note directly without Hermes...');msg('Storing steering directly.');render();try{const d=await api('/guidance/store',{method:'POST',body:JSON.stringify({text})});state.guidance=d.guidance||[];input.value='';setGuidanceReply(d.reply,'ok');msg('Guidance stored directly.','ok')}catch(e){setGuidanceReply(e.message,'error');msg(e.message,'error')}finally{state.guidanceBusy=false;render()}}
document.getElementById('pull-data').onclick=pullData;document.getElementById('generate').onclick=generate;document.getElementById('stop').onclick=stopAgent;document.getElementById('schedule').onclick=schedule;document.getElementById('schedule-custom').onclick=scheduleCustom;document.getElementById('save-guidance').onclick=saveGuidance;document.getElementById('store-guidance').onclick=storeGuidanceOnly;document.getElementById('toggle-control').onclick=toggleControl;document.getElementById('save-control').onclick=saveControl;document.getElementById('reload-control').onclick=()=>controlState.current&&loadControl(controlState.current.id);render();if(state.active)msg('Agent phase: '+state.active.phase);else if(state.context)msg('Latest pulled data loaded.','ok');else if(state.run)msg('Latest run loaded.','ok');refresh();
</script></body></html>`;
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function send(response, status, body, type = "application/json; charset=UTF-8") {
  response.writeHead(status, { "content-type": type });
  response.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}

async function handle(request, response) {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname === "/" && request.method === "GET") {
      const latestContext = await loadLatestContextSummary();
      const batchPresetState = await loadBatchPresetState(latestContext);
      return send(response, 200, html({
        ok: true,
        active_run: activeRun,
        latest_run: await loadLatestRun(),
        latest_context: latestContext,
        batch_presets: batchPresetState.presets,
        selected_batch_preset_id: batchPresetState.selected_preset_id,
        guidance: await loadGuidance(),
      }), "text/html; charset=UTF-8");
    }
    if (url.pathname === "/status" && request.method === "GET") {
      const latestContext = await loadLatestContextSummary();
      const batchPresetState = await loadBatchPresetState(latestContext);
      return send(response, 200, {
        ok: true,
        active_run: activeRun,
        latest_run: await loadLatestRun(),
        latest_context: latestContext,
        batch_presets: batchPresetState.presets,
        selected_batch_preset_id: batchPresetState.selected_preset_id,
        guidance: await loadGuidance(),
      });
    }
    if (url.pathname === "/batch-presets" && request.method === "GET") {
      const latestContext = await loadLatestContextSummary();
      const batchPresetState = await loadBatchPresetState(latestContext);
      return send(response, 200, { ok: true, ...batchPresetState });
    }
    if (url.pathname === "/batch-presets/use" && request.method === "POST") {
      const body = await readBody(request);
      const presetId = await saveSelectedBatchPresetId(String(body.preset_id ?? ""));
      const latestContext = await loadLatestContextSummary();
      const batchPresetState = await loadBatchPresetState(latestContext);
      const activePreset = resolveSelectedBatchPreset(batchPresetState.presets, presetId);
      return send(response, 200, {
        ok: true,
        selected_preset_id: activePreset?.id ?? presetId,
        active_preset: activePreset ?? null,
        presets: batchPresetState.presets,
      });
    }
    if (url.pathname === "/batch-presets/clear" && request.method === "POST") {
      await clearSelectedBatchPresetId();
      const latestContext = await loadLatestContextSummary();
      const batchPresetState = await loadBatchPresetState(latestContext);
      return send(response, 200, {
        ok: true,
        selected_preset_id: null,
        active_preset: null,
        presets: batchPresetState.presets,
      });
    }
    if (url.pathname === "/control" && request.method === "GET") return send(response, 200, { ok: true, groups: await controlRegistry() });
    if (url.pathname === "/control/file" && request.method === "GET") return send(response, 200, { ok: true, ...(await readControlFile(url.searchParams.get("id"))) });
    if (url.pathname === "/control/file" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, ...(await writeControlFile(String(body.id ?? ""), String(body.content ?? ""))) });
    }
    if (url.pathname === "/kill" && request.method === "POST") return send(response, 200, { ok: true, ...killActiveAgent() });
    if (url.pathname === "/generate" && request.method === "POST") {
      if (activeRun) return send(response, 409, { error: "Agent is already running.", active_run: activeRun });
      const body = await readBody(request);
      return send(response, 200, { ok: true, run: await generateRun(body.post_count, body.target_date), context: await loadLatestContextSummary() });
    }
    if (url.pathname === "/pull-data" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, context: await pullFreshContext(body.target_date) });
    }
    if (url.pathname === "/run/posts/delete" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, run: await deleteRunPost(body.index, String(body.reason ?? "")) });
    }
    if (url.pathname === "/run/posts/delete-selected" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, run: await deleteRunPostsBySlots(body.entries) });
    }
    if (url.pathname === "/run/posts/edit" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, run: await updateRunPostText(body.index, body.text) });
    }
    if (url.pathname === "/run/posts/approval-lesson" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, run: await updateRunPostApprovalLesson(body.index, body.approval_lesson) });
    }
    if (url.pathname === "/run/posts/approve" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, run: await setApprovedRunPosts(body.slots, true) });
    }
    if (url.pathname === "/run/posts/unapprove" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, run: await setApprovedRunPosts(body.slots, false) });
    }
    if (url.pathname === "/run/posts/reorder" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, run: await reorderRunPosts(body.from_index, body.to_index) });
    }
    if (url.pathname === "/guidance" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, ...(await saveGuidanceWithModel(body.text)) });
    }
    if (url.pathname === "/guidance/store" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, ...(await saveGuidanceDirect(body.text)) });
    }
    if (url.pathname === "/schedule/custom" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, ...(await scheduleSingleRunPost(body.slot, body.date, body.time)) });
    }
    if (url.pathname === "/schedule" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, run: await scheduleLatestRun(body.target_date) });
    }
    return send(response, 404, { error: "Not found" });
  } catch (error) {
    activeRun = null;
    return send(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function rebuildTasteMemoryFromLatestContext() {
  const contextPath = path.join(VAULT, "Context", "latest-generate-context.json");
  const context = await readJson(contextPath);
  return writeTasteMemory(context);
}

await loadLocalEnv();
await ensureDirs();
if (process.argv.includes("--rebuild-taste-memory")) {
  const memory = await rebuildTasteMemoryFromLatestContext();
  console.log(`Taste memory rebuilt with ${memory.recent_winners.length} recent winners and ${memory.all_time_champions.length} all-time champions.`);
  process.exit(0);
}
createServer((request, response) => void handle(request, response)).listen(PORT, "127.0.0.1", () => {
  console.log(`Manifest Mental Agent desktop app running at http://127.0.0.1:${PORT}`);
});
