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
const PORT = Number(process.env.MANIFEST_AGENT_DESKTOP_PORT || 4317);
const API_BASE_URL = process.env.LENSICALLY_API_BASE_URL || "https://api.lensically.com";
const ACCOUNT_ID = "manifest-mental";
const TIMEZONE = "America/New_York";
const GOAL_FOLLOWERS = 1_000_000;
const HERMES_BIN = "/home/brian/.local/bin/hermes";
const HERMES_MODEL = "gpt-5.5";
const HERMES_PROVIDER = "openai-codex";
const MAX_SELECTED_REGEN = 3;
const DEFAULT_POST_COUNT = 17;
const RECENT_TASTE_WINDOW_SIZE = 100;
const RECENT_A_TIER_RATIO = 0.10;
const RECENT_B_TIER_RATIO = 0.15;
const ALL_TIME_CHAMPION_COUNT = 25;
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

async function fetchAllArchive(order) {
  const posts = [];
  for (let page = 1; page <= 20; page += 1) {
    const data = await fetchJson(`/api/threads/posts/archive?order=${encodeURIComponent(order)}&limit=100&page=${page}`);
    const pagePosts = Array.isArray(data.posts) ? data.posts : [];
    posts.push(...pagePosts);
    const total = Number(data.total ?? data.total_posts ?? data.totalCount ?? 0);
    if (!pagePosts.length || (total && posts.length >= total)) break;
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

function normalizeTastePost(post) {
  return {
    post_id: String(post?.id ?? post?.post_id ?? "").trim(),
    posted_at: String(post?.timestamp ?? post?.posted_at ?? "").trim(),
    text: String(post?.text ?? "").trim(),
    likes: numberValue(post?.likes),
  };
}

function tasteSignals(text) {
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

function winnerSynthesis(posts) {
  if (!posts.length) return "No eligible winners yet.";
  const tallies = posts.reduce((accumulator, post) => {
    const signals = tasteSignals(post.text);
    for (const [key, value] of Object.entries(signals)) {
      if (value) accumulator[key] += 1;
    }
    return accumulator;
  }, {
    direct_address: 0,
    imminent: 0,
    money: 0,
    status: 0,
    concrete_trigger: 0,
    short_line: 0,
  });

  const parts = [];
  if (tallies.direct_address >= posts.length * 0.6) parts.push("speak straight to the reader");
  if (tallies.imminent >= posts.length * 0.6) parts.push("make the payoff feel immediate");
  if (tallies.money >= posts.length * 0.45 && tallies.status >= posts.length * 0.35) {
    parts.push("blend money relief with status elevation");
  } else if (tallies.money >= posts.length * 0.45) {
    parts.push("center money relief");
  } else if (tallies.status >= posts.length * 0.35) {
    parts.push("center status elevation");
  }
  if (tallies.short_line >= posts.length * 0.5) parts.push("land the reward in very few words");
  if (!parts.length && tallies.concrete_trigger >= posts.length * 0.25) {
    parts.push("use concrete scenes instead of vague abstraction");
  }
  if (!parts.length) {
    parts.push("deliver a clean immediate emotional reward");
  }

  return `Winning posts here ${parts.slice(0, 4).join(", ")}; the constant is instant payoff, not repeating the same exact sentence resolution.`;
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
  const synthesisPosts = [...recentWinners, ...allTimeChampions].reduce((accumulator, post) => {
    if (!accumulator.some((item) => item.post_id === post.post_id)) accumulator.push(post);
    return accumulator;
  }, []);

  return {
    core_law: "Taste is learned from likes only.",
    recent_window_size: RECENT_TASTE_WINDOW_SIZE,
    recent_winners: recentWinners,
    all_time_champions: allTimeChampions,
    winner_synthesis: winnerSynthesis(synthesisPosts),
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

async function loadLatestRun() {
  try {
    const run = await readJson(path.join(VAULT, "Runs", "latest-run.json"));
    const { strategy_summary, fatigue_summary, ...cleanRun } = run ?? {};
    try {
      const context = await readJson(path.join(VAULT, "Context", "latest-generate-context.json"));
      return { ...cleanRun, metrics: normalizeMetrics(context.metrics, cleanRun.metrics) };
    } catch {
      return { ...cleanRun, metrics: normalizeMetrics({}, cleanRun.metrics) };
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
    return Array.isArray(data.lessons) ? data.lessons : [];
  } catch {
    return [];
  }
}

async function saveLessons(lessons) {
  await writeJson(path.join(VAULT, "Lessons", "rejection-lessons.json"), {
    updated_at: new Date().toISOString(),
    lessons,
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
    "The user is giving durable taste or strategy guidance that should shape future post generation and regeneration.",
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
      understanding: lesson.understanding,
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

const CONTROL_FILES = {
  "memory/guidance": { title: "Guidance Memory", file: path.join(VAULT, "Lessons", "agent-guidance.json"), editable: true, type: "json" },
  "memory/rejection-lessons": { title: "Rejection Lessons", file: path.join(VAULT, "Lessons", "rejection-lessons.json"), editable: true, type: "json" },
  "memory/taste-memory": { title: "Taste Memory", file: TASTE_MEMORY_PATH, editable: false, type: "json" },
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

async function buildFreshContext() {
  const internalKey = requireInternalKey();
  activeRun = { ...(activeRun ?? {}), phase: "pulling_lensically_context" };
  const automationContext = await fetchJson(`/api/automation/context?account_id=${ACCOUNT_ID}&timezone=${encodeURIComponent(TIMEZONE)}`, {
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
      regen_uses_cached_context: true,
      fatigue_rule: "Reusing openers is permitted. Reusing the latter half, payoff, or sentence resolution too closely is audience fatigue.",
    },
  };
  await writeJson(path.join(VAULT, "Context", "latest-generate-context.json"), context);
  await writeJson(path.join(VAULT, "Context", `generate-context-${nowStamp()}.json`), context);
  return context;
}

function compactContext(context) {
  return {
    target_date: context.target_date,
    desired_slots: context.desired_slots,
    missing_slots: context.missing_slots,
    metrics: context.metrics,
    follower_archive: { rows: Array.isArray(context.follower_archive?.rows) ? context.follower_archive.rows.slice(0, 120) : [] },
    archive_recent: context.archive_recent.slice(0, 180).map((post) => ({
      id: post.id,
      text: post.text,
      timestamp: post.timestamp,
      likes: post.likes,
      views: post.views,
      replies: post.replies,
      reposts: post.reposts,
    })),
    archive_top: context.archive_top.slice(0, 100).map((post) => ({
      id: post.id,
      text: post.text,
      timestamp: post.timestamp,
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
  const safeMax = Math.max(1, Number(maxCount ?? DEFAULT_POST_COUNT));
  if (!Number.isFinite(parsed)) return Math.min(DEFAULT_POST_COUNT, safeMax);
  return Math.max(1, Math.min(parsed, safeMax));
}

function pickGenerationSlots(context, requestedCount) {
  const desiredSlots = Array.isArray(context?.desired_slots) ? context.desired_slots : [];
  const count = clampPostCount(requestedCount, desiredSlots.length || DEFAULT_POST_COUNT);
  return desiredSlots.slice(0, count);
}

function compactRegenContext(context) {
  return {
    target_date: context.target_date,
    desired_slots: context.desired_slots,
    metrics: context.metrics,
    archive_recent: context.archive_recent.slice(0, 40).map((post) => ({
      text: post.text,
      likes: post.likes,
      views: post.views,
    })),
    archive_top: context.archive_top.slice(0, 40).map((post) => ({
      text: post.text,
      likes: post.likes,
      views: post.views,
    })),
    rules: context.agent_rules,
  };
}

function buildGeneratePrompt(context, lessons, guidance, tasteMemory, generationSlots) {
  return [
    "You are the standalone Manifest Mental recursive learning agent.",
    "Output valid JSON only. No markdown.",
    `Generate exactly ${generationSlots.length} post candidates for these ET slots: ${generationSlots.join(", ")}.`,
    "Never publish. Never call a publish endpoint. Only create candidates; scheduling is a later explicit user action.",
    "Goal: grow the account to 1,000,000 followers.",
    "Performance targets: over time, beat the top-liked post by 2x and create a rising floor for average likes and views.",
    "Do not allocate fixed post categories by time. Do not decide that mornings must be money, afternoons must be status, or nights must be spiritual.",
    "Do not optimize for variety theater. Generate the 17 strongest posts for this account, even if several winners share a broad lane.",
    "Do not label posts with genres, objectives, bet types, or win conditions. Those labels can bias the writing.",
    "Openers may repeat when useful. The latter half, payoff, promise, and sentence resolution must not be too close to recent/generated posts.",
    "Before generating posts, read the taste memory and generate from recent winners, all-time champions, and winner_synthesis.",
    "Preserve proven constants, but create fresh sentence resolutions that do not copy the winners' payoff logic.",
    "Use the full archive, follower archive, metrics, goals, rejection lessons, and top posts. Do the math and strategy in the backend.",
    "Return JSON: {\"metrics\": object, \"posts\": [{\"slot\":\"07:00\",\"text\":\"...\"}], \"memory_notes\": [string]}",
    "Taste memory:",
    JSON.stringify(tasteMemory ?? {}),
    "Prior rejection lessons:",
    JSON.stringify(lessons.slice(-40).map((lesson) => ({
      slot: lesson.slot,
      source_text: lesson.source_text,
      user_feedback: lesson.user_feedback,
      understanding: lesson.understanding,
      replacement_text: lesson.replacement_text,
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

function buildRegenPrompt({ context, latestRun, slot, reason, previousPost, lessons, guidance, tasteMemory }) {
  return [
    "You are the standalone Manifest Mental recursive learning agent regenerating one rejected post.",
    "Output valid JSON only. No markdown.",
    "Use cached context only. Do not fetch fresh insights, follower, or archive data.",
    "The user gave a rejection reason. Understand why they rejected it and regenerate only that slot.",
    "You are not allowed to lightly revise the rejected post. Create a whole brand new post with a different premise, image, payoff, sentence path, and emotional turn.",
    "Do not reuse the rejected post's main nouns, core metaphor, ending logic, or sentence resolution unless the user explicitly asked to keep them.",
    "Do not label the replacement with a genre, objective, bet type, or win condition. Just return the replacement post and understanding field.",
    "Openers may repeat when useful. The latter half, payoff, promise, and sentence resolution must not be too close.",
    "Use the taste memory as the winning baseline, but the replacement must still resolve differently from the stored winners.",
    "Return JSON: {\"slot\":\"09:00\",\"text\":\"...\",\"understanding\":\"one short plain-English explanation of why the user rejected the original post\"}",
    "Rejection:",
    JSON.stringify({ slot, reason, previousPost }),
    "Taste memory:",
    JSON.stringify(tasteMemory ?? {}),
    "Prior rejection lessons:",
    JSON.stringify(lessons.slice(-20).map((lesson) => ({
      slot: lesson.slot,
      source_text: lesson.source_text,
      user_feedback: lesson.user_feedback,
      understanding: lesson.understanding,
      replacement_text: lesson.replacement_text,
    }))),
    "Persistent user steering guidance:",
    JSON.stringify(guidance.slice(-40).map((entry) => ({
      user_input: entry.user_input,
      understanding: entry.understanding,
    }))),
    "Cached context:",
    JSON.stringify(compactRegenContext(context)),
    "Current slate:",
    JSON.stringify(latestRun?.posts ?? []),
  ].join("\n\n");
}

function words(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function sharedWordRatio(a, b) {
  const aWords = new Set(words(a).filter((word) => word.length > 3));
  const bWords = new Set(words(b).filter((word) => word.length > 3));
  if (!aWords.size || !bWords.size) return 0;
  let shared = 0;
  for (const word of aWords) if (bWords.has(word)) shared += 1;
  return shared / Math.min(aWords.size, bWords.size);
}

function phrase(value, start, count) {
  const allWords = words(value);
  return allWords.slice(start < 0 ? Math.max(0, allWords.length + start) : start, start < 0 ? allWords.length : start + count).join(" ");
}

function assertFreshReplacement(previousText, nextText) {
  const previous = String(previousText ?? "").trim();
  const next = String(nextText ?? "").trim();
  if (!next) throw new Error("Hermes returned an empty regenerated post.");
  if (previous.toLowerCase() === next.toLowerCase()) throw new Error("Hermes repeated the rejected post exactly.");
  const sameOpening = phrase(previous, 0, 6) && phrase(previous, 0, 6) === phrase(next, 0, 6);
  const sameEnding = phrase(previous, -7, 7) && phrase(previous, -7, 7) === phrase(next, -7, 7);
  const overlap = sharedWordRatio(previous, next);
  if (sameOpening || sameEnding || overlap > 0.55) {
    throw new Error(`Replacement is too close to rejected post. overlap=${overlap.toFixed(2)}`);
  }
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

async function generateRun(postCount = DEFAULT_POST_COUNT) {
  const runId = nowStamp();
  activeRun = { id: runId, phase: "starting", started_at: new Date().toISOString() };
  const context = await requireFreshPulledContext();
  const generationSlots = pickGenerationSlots(context, postCount);
  if (!generationSlots.length) throw new Error("No schedule slots are available for generation.");
  const tasteMemory = await writeTasteMemory(context);
  const lessons = await loadLessons();
  const guidance = await loadGuidance();
  activeRun = { ...activeRun, phase: `hermes_generating_${generationSlots.length}_posts` };
  const hermes = await runHermesJson(buildGeneratePrompt(context, lessons, guidance, tasteMemory, generationSlots));
  const posts = normalizePosts(hermes.posts, generationSlots);
  const run = {
    id: runId,
    status: "generated",
    generated_at: new Date().toISOString(),
    target_date: context.target_date,
    requested_post_count: generationSlots.length,
    metrics: normalizeMetrics(context.metrics, hermes.metrics),
    memory_notes: Array.isArray(hermes.memory_notes) ? hermes.memory_notes.map(String) : [],
    posts,
  };
  await writeJson(path.join(VAULT, "Runs", "latest-run.json"), run);
  await writeJson(path.join(VAULT, "Runs", `run-${runId}.json`), run);
  activeRun = null;
  return run;
}

async function regenSlot({ slot, reason }) {
  if (!slot || !reason?.trim()) throw new Error("slot and reason are required.");
  if (activeRun) throw new Error(`Agent is already running: ${activeRun.phase}`);
  const context = await readJson(path.join(VAULT, "Context", "latest-generate-context.json"));
  const tasteMemory = await writeTasteMemory(context);
  const latestRun = await loadLatestRun();
  if (!latestRun?.posts?.length) throw new Error("No generated run is available. Press Generate first.");
  const previousPost = latestRun.posts.find((post) => post.slot === slot);
  if (!previousPost) throw new Error(`Slot ${slot} was not found.`);
  const lessons = await loadLessons();
  const guidance = await loadGuidance();
  activeRun = { id: nowStamp(), phase: `regenerating_${slot}`, started_at: new Date().toISOString() };
  log("regen_slot_start", { slot });
  const hermes = await runHermesJson(buildRegenPrompt({ context, latestRun, slot, reason: reason.trim(), previousPost, lessons, guidance, tasteMemory }));
  const nextPost = {
    slot,
    text: String(hermes.text ?? "").trim(),
  };
  assertFreshReplacement(previousPost.text, nextPost.text);
  const savedAt = new Date().toISOString();
  const understanding = String(hermes.understanding ?? reason).trim();
  const rejectionLesson = {
    saved_at: savedAt,
    slot,
    source_text: String(previousPost.text ?? "").trim(),
    user_feedback: reason.trim(),
    understanding,
    replacement_text: nextPost.text,
  };
  const rejection = {
    ...rejectionLesson,
    previous_post: previousPost,
    replacement_post: nextPost,
  };
  latestRun.posts = latestRun.posts.map((post) => post.slot === slot ? nextPost : post);
  latestRun.last_regen = rejection;
  await writeJson(path.join(VAULT, "Runs", "latest-run.json"), latestRun);
  await writeJson(path.join(VAULT, "Rejections", `rejection-${nowStamp()}-${slot.replace(":", "-")}.json`), rejection);
  await saveLessons([...lessons, rejectionLesson].slice(-300));
  activeRun = null;
  log("regen_slot_complete", { slot });
  return { run: latestRun, post: nextPost, understanding };
}

async function regenSlots(rejections) {
  if (!Array.isArray(rejections) || !rejections.length) throw new Error("Select at least one post to regenerate.");
  if (rejections.length > MAX_SELECTED_REGEN) throw new Error(`Regenerate at most ${MAX_SELECTED_REGEN} selected posts at a time. This protects your model usage.`);
  const results = [];
  let run = null;
  for (const rejection of rejections) {
    const slot = String(rejection?.slot ?? "");
    const reason = String(rejection?.reason ?? "").trim();
    if (!slot || !reason) throw new Error("Every selected post needs a feedback reason.");
    const result = await regenSlot({ slot, reason });
    run = result.run;
    results.push({ slot, understanding: result.understanding });
  }
  return { run, results };
}

async function scheduleLatestRun() {
  const latestRun = await loadLatestRun();
  if (!latestRun?.posts?.length) throw new Error("No generated run is available.");
  const payloadPath = path.join(VAULT, "Runs", "latest-schedule-plan.json");
  await writeJson(payloadPath, {
    account_id: ACCOUNT_ID,
    date: latestRun.target_date,
    timezone: TIMEZONE,
    posts: latestRun.posts.map((post) => ({ slot: post.slot, text: post.text })),
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
  latestRun.schedule_result = output;
  latestRun.status = "scheduled";
  await writeJson(path.join(VAULT, "Runs", "latest-run.json"), latestRun);
  return latestRun;
}

async function pullFreshContext() {
  if (activeRun) throw new Error(`Agent is already running: ${activeRun.phase}`);
  activeRun = { id: nowStamp(), phase: "syncing_lensically_insights", started_at: new Date().toISOString() };
  const postSync = await syncLensicallyPostArchive();
  activeRun = { ...activeRun, phase: "syncing_lensically_followers" };
  const followerSync = await syncLensicallyFollowers();
  activeRun = { ...activeRun, phase: "building_hermes_context_from_lensically" };
  const context = await buildFreshContext();
  activeRun = { ...activeRun, phase: "updating_taste_memory" };
  await writeTasteMemory(context);
  activeRun = null;
  return {
    summary: summarizeContext(context),
    sync: {
      post_archive: postSync,
      followers: followerSync,
    },
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
  if (!context || typeof context !== "object") return true;
  return String(run.target_date ?? "") === String(context.target_date ?? "");
}

function html(initialState = {}) {
  const boot = JSON.stringify(initialState ?? {}).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Manifest Mental Agent</title>
<style>
:root{--ink:#08111f;--muted:#5d6f89;--line:#d9e1ec;--paper:#f6f3ea;--card:#fffdf8;--accent:#0b1220;--soft:#eef3ef;--good:#0f766e;--bad:#b42318;--gold:#b87503}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 12% 8%,#fff7df 0 18%,transparent 34%),linear-gradient(135deg,#f9f6ed,#edf5f1 52%,#f4eadc);color:var(--ink);font-family:Georgia,Cambria,serif}main{width:min(1480px,calc(100vw - 32px));margin:0 auto;padding:24px 0 42px}header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding:24px;border:1px solid var(--line);background:rgba(255,253,248,.92);border-radius:20px;box-shadow:0 22px 70px rgba(15,23,42,.1)}h1{margin:0;font-size:34px;letter-spacing:-.04em}.sub{margin:8px 0 0;color:var(--muted);line-height:1.45;max-width:860px;font-family:Segoe UI,ui-sans-serif,sans-serif}.actions,.review-actions,.guidance-actions,.control-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}button{border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:999px;padding:12px 17px;font-weight:800;font-size:14px;cursor:pointer;font-family:Segoe UI,ui-sans-serif,sans-serif}button.secondary{background:#fff;color:var(--ink);border-color:var(--line)}button.danger{background:#fff4f2;color:var(--bad);border-color:#f1b8b2}button.danger:not(:disabled){box-shadow:0 0 0 3px rgba(180,35,24,.08)}button:disabled{opacity:.48;cursor:not-allowed}.banner{margin-top:14px;border-radius:14px;padding:13px 16px;border:1px solid var(--line);background:rgba(255,253,248,.9);color:var(--muted);font-family:Segoe UI,ui-sans-serif,sans-serif}.banner.error{border-color:#f1b8b2;color:var(--bad);background:#fff4f2}.banner.ok{border-color:#9fd8cf;color:var(--good);background:#eefbf8}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px}.metric{border:1px solid var(--line);background:rgba(255,253,248,.9);border-radius:16px;padding:15px}.metric p{margin:0;color:#60718b;font-size:10px;text-transform:uppercase;letter-spacing:.16em;font-weight:900;font-family:Segoe UI,ui-sans-serif,sans-serif}.metric strong{display:block;margin-top:8px;font-size:27px;letter-spacing:-.04em}.metric span{display:block;margin-top:7px;color:var(--muted);font-size:13px;line-height:1.4;font-family:Segoe UI,ui-sans-serif,sans-serif}.guidance,.control{margin-top:16px;border:1px solid var(--line);background:rgba(255,253,248,.9);border-radius:16px;padding:18px}.guidance h2,.control h2,.posts h2{margin:0 0 10px;font-size:17px;letter-spacing:-.03em}.guidance-grid{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:14px}.guidance-list{max-height:155px;overflow:auto;border:1px solid var(--line);border-radius:14px;padding:10px;background:rgba(255,255,255,.55);font:13px/1.45 Segoe UI,ui-sans-serif,sans-serif;color:#334155}.guidance-item{padding:8px 0;border-bottom:1px solid #e8edf4}.guidance-item:last-child{border-bottom:0}.control-grid{display:grid;grid-template-columns:310px minmax(0,1fr);gap:14px;margin-top:12px}.control-list{max-height:420px;overflow:auto;border:1px solid var(--line);border-radius:14px;padding:10px;background:rgba(255,255,255,.55);font:13px/1.4 Segoe UI,ui-sans-serif,sans-serif}.control-group{margin:8px 0 10px;color:#526985;font-weight:900;text-transform:uppercase;letter-spacing:.12em}.control-item{display:block;width:100%;text-align:left;margin:5px 0;border-color:#dfe6ef;background:#fff;color:#0b2445;border-radius:12px;padding:9px 11px}.control-item.active{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,117,3,.12)}#control-editor{min-height:420px;font-family:Consolas,ui-monospace,monospace;font-size:12px;white-space:pre}.control-meta{font:13px/1.4 Segoe UI,ui-sans-serif,sans-serif;color:var(--muted);margin:0 0 8px}.posts{margin-top:16px;border:1px solid var(--line);background:rgba(255,253,248,.65);border-radius:20px;overflow:hidden}.posts-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:18px;align-items:center;padding:16px 18px;border-bottom:1px solid var(--line);background:rgba(255,253,248,.96);backdrop-filter:blur(8px)}.review-actions,.guidance-actions,.control-actions{align-items:center}.count{color:var(--muted);font-size:13px;font-family:Segoe UI,ui-sans-serif,sans-serif}.post{display:grid;grid-template-columns:42px 88px minmax(0,1fr) 380px;gap:18px;padding:20px 18px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.5)}.post:last-child{border-bottom:0}.post.selected{background:linear-gradient(90deg,rgba(184,117,3,.1),rgba(255,255,255,.72))}.pick{display:flex;align-items:flex-start;justify-content:center;padding-top:6px}.pick input{width:20px;height:20px;accent-color:var(--accent)}.slot{font-weight:900;font-size:22px;letter-spacing:-.04em}.text{font-size:23px;line-height:1.38;margin:0;letter-spacing:-.03em}textarea{width:100%;min-height:88px;resize:vertical;border:1px solid var(--line);border-radius:14px;padding:12px;font:14px/1.45 Segoe UI,ui-sans-serif,sans-serif;background:#fff}.feedback-label{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;color:#526985;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;font-family:Segoe UI,ui-sans-serif,sans-serif}.empty{padding:38px 18px;color:var(--muted);font-family:Segoe UI,ui-sans-serif,sans-serif}@media(max-width:1100px){header,.guidance-grid,.control-grid{display:block}.actions{justify-content:flex-start;margin-top:16px}.metrics{grid-template-columns:1fr 1fr}.post{grid-template-columns:38px 76px 1fr}.review{grid-column:1/-1}.posts-head{display:block}.review-actions{justify-content:flex-start;margin-top:10px}.guidance-list,.control-list{margin-top:12px}}@media(max-width:720px){main{width:min(100vw - 18px,720px)}.metrics{grid-template-columns:1fr}.post{grid-template-columns:34px 1fr}.slotbox{grid-column:2}.copy{grid-column:2}.review{grid-column:2}}
</style></head><body><main><header><div><h1>Manifest Mental Agent</h1><p class="sub">Pull Data manually syncs Lensically insights and followers, then Hermes generates from that fresh Lensically state for up to 24 hours.</p></div><div class="actions"><label style="display:flex;align-items:center;gap:8px;font:13px/1.2 Segoe UI,ui-sans-serif,sans-serif;color:var(--muted)">Posts <select id="post-count" style="border:1px solid var(--line);border-radius:999px;padding:9px 12px;background:#fff;color:var(--ink);font:14px/1 Segoe UI,ui-sans-serif,sans-serif"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option><option>13</option><option>14</option><option>15</option><option>16</option><option selected>17</option></select></label><button id="pull-data" class="secondary">Pull Data</button><button id="generate">Generate Posts</button><button id="stop" class="danger" disabled>Stop Agent</button><button id="schedule" class="secondary">Schedule Latest</button><button id="refresh" class="secondary">Refresh View</button></div></header><div id="message" class="banner">Starting local agent surface...</div><section id="metrics" class="metrics"></section><section class="guidance"><h2>Steer The Agent</h2><div class="guidance-grid"><div><textarea id="guidance-input" placeholder="Tell the agent what to learn. Example: stop using cleanly/clearly, avoid vague emotional abstractions, prefer concrete scenes with a sharper payoff."></textarea><div class="guidance-actions"><button id="save-guidance" class="secondary">Ask Agent + Save</button></div><p id="agent-reply" class="banner">Agent reply will appear here. This uses one Hermes model call when clicked.</p></div><div class="guidance-list" id="guidance-list">No steering guidance saved yet.</div></div></section><section class="control"><h2>Agent Control</h2><button id="toggle-control" class="secondary">Open Control Panel</button><div id="control-panel" style="display:none"><p class="control-meta">Inspect and edit memory, prompts, context, and runs. Latest prompts, context, and runs are read-only evidence.</p><div class="control-grid"><div id="control-list" class="control-list">Loading controls...</div><div><p id="control-meta" class="control-meta">Select an artifact.</p><textarea id="control-editor" spellcheck="false"></textarea><div class="control-actions"><button id="save-control" class="secondary" disabled>Save Artifact</button><button id="reload-control" class="secondary" disabled>Reload</button></div></div></div></div></section><section class="posts"><div class="posts-head"><h2>Generated Posts</h2><span id="slate-status">0</span></div><div id="posts"><div class="empty">Pull data, choose a post count, then generate.</div></div></section></main>
<script>
const initialData=${boot};const state={run:initialData.latest_run||null,active:initialData.active_run||null,reasons:{},selected:{},guidance:Array.isArray(initialData.guidance)?initialData.guidance:[],context:initialData.latest_context||null};const fmt=n=>new Intl.NumberFormat('en-US').format(Math.round(Number(n||0)));const pct=n=>(Number(n||0)).toFixed(4)+'%';
let controlState={registry:[],current:null};
function msg(t,type=''){const e=document.getElementById('message');e.textContent=t;e.className='banner '+type}
async function api(p,o={}){const r=await fetch(p,{...o,headers:{'content-type':'application/json',...(o.headers||{})}});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.error||'Request failed');return d}
function metric(l,v,h=''){return '<div class="metric"><p>'+l+'</p><strong>'+v+'</strong><span>'+h+'</span></div>'}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function isCurrentRunUsable(run, context){if(!run||typeof run!=='object')return false;if(!Array.isArray(run.posts)||!run.posts.length)return false;if(!context||typeof context!=='object')return true;return String(run.target_date||'')===String(context.target_date||'')}
function renderGuidance(){const list=document.getElementById('guidance-list');list.innerHTML=state.guidance.length?state.guidance.slice(-12).reverse().map(item=>'<div class="guidance-item"><b>'+esc(new Date(item.saved_at).toLocaleString())+'</b><br><b>You said:</b> '+esc(item.user_input||'')+(item.understanding?'<br><br><b>Understanding:</b> '+esc(item.understanding):'')+'</div>').join(''):'No steering guidance saved yet.'}
function selectedSlots(){return Object.keys(state.selected).filter(slot=>state.selected[slot])}
function render(){const rawRun=state.run||null,context=state.context||{},run=isCurrentRunUsable(rawRun,context)?rawRun:{},m=context.metrics||run.metrics||{},posts=run.posts||[],selected=selectedSlots(),requested=run.requested_post_count||posts.length||Number(document.getElementById('post-count')?.value||17),batchPreset=context.batch_preset||null,slotSource=context.slot_source||null,batchLabel=batchPreset?.name||'No Lensically batch',batchMeta=slotSource==='lensically_batch_preset'?'Using Lensically preset':'Using fallback slots';renderGuidance();document.getElementById('metrics').innerHTML=[metric('Current Followers',fmt(m.current_followers),fmt(m.followers_to_1m)+' away from 1M'),metric('Progress To 1M',pct(m.progress_to_1m_percent),'North-star target'),metric('2x Top Likes',fmt(m.goals?.top_post_likes_2x),'Top likes: '+fmt(m.top_post?.likes)),metric('2x Avg Views',fmt(m.goals?.average_views_2x),'Avg views: '+fmt(m.baselines?.average_views)),metric('2x Avg Likes',fmt(m.goals?.average_likes_2x),'Avg likes: '+fmt(m.baselines?.average_likes)),metric('Archive Seen',fmt(m.baselines?.archive_total_seen),fmt(m.baselines?.recent_sample_size)+' recent sample'),metric('Follower Snapshots',fmt(m.baselines?.follower_snapshots_seen),'Fresh on Pull Data'),metric('Batch Preset',batchPreset?.times?.length?fmt(batchPreset.times.length)+' slots':fmt((context.desired_slots||[]).length),batchLabel+' · '+batchMeta),metric('Slate',posts.length+'/'+requested,(run.target_date||context.target_date)?'Target '+(run.target_date||context.target_date):'No target')].join('');document.getElementById('pull-data').disabled=Boolean(state.active);document.getElementById('schedule').disabled=!posts.length||Boolean(state.active);document.getElementById('generate').disabled=Boolean(state.active);document.getElementById('post-count').disabled=Boolean(state.active);document.getElementById('stop').disabled=!Boolean(state.active);document.getElementById('slate-status').innerHTML=posts.length?'<span class="count">'+selected.length+' selected</span><div class="review-actions"><button id="select-all" class="secondary">Select All</button><button id="regen-selected" class="secondary" '+(!selected.length||state.active?'disabled':'')+'>Regenerate Selected</button><button id="clear-selected" class="secondary" '+(!selected.length?'disabled':'')+'>Clear</button><span class="count">'+posts.length+'/'+requested+'</span></div>':'0';document.getElementById('posts').innerHTML=posts.length?posts.map(post=>'<article class="post '+(state.selected[post.slot]?'selected':'')+'"><label class="pick"><input type="checkbox" data-select="'+post.slot+'" '+(state.selected[post.slot]?'checked':'')+'></label><div class="slotbox"><div class="slot">'+post.slot+'</div></div><div class="copy"><p class="text">'+esc(post.text)+'</p></div><div class="review"><div class="feedback-label"><span>Regen feedback</span><button class="secondary regen" data-slot="'+post.slot+'" '+(state.active?'disabled':'')+'>One Slot</button></div><textarea data-reason="'+post.slot+'" placeholder="What is wrong? The agent will avoid this exact premise, payoff, and sentence path.">'+esc(state.reasons[post.slot]||'')+'</textarea></div></article>').join(''):'<div class="empty">Pull data, choose a post count, then generate.</div>';document.querySelectorAll('input[data-select]').forEach(el=>el.addEventListener('change',e=>{state.selected[e.target.dataset.select]=e.target.checked;render()}));document.querySelectorAll('textarea[data-reason]').forEach(el=>el.addEventListener('input',e=>{state.reasons[e.target.dataset.reason]=e.target.value}));document.querySelectorAll('.regen').forEach(btn=>btn.addEventListener('click',()=>regen(btn.dataset.slot)));const regenSelected=document.getElementById('regen-selected');if(regenSelected)regenSelected.onclick=regenSelectedPosts;const selectAll=document.getElementById('select-all');if(selectAll)selectAll.onclick=()=>{posts.forEach(post=>{state.selected[post.slot]=true});render()};const clear=document.getElementById('clear-selected');if(clear)clear.onclick=()=>{state.selected={};render()}}
async function refresh(){const d=await api('/status');state.active=d.active_run;state.run=d.latest_run;state.guidance=d.guidance||[];state.context=d.latest_context||state.context;render();if(state.active)msg('Agent phase: '+state.active.phase);else msg(state.context?'View refreshed. Latest pulled data loaded.':state.run?'View refreshed. Latest run loaded.':'Agent ready. No run yet.','ok')}
async function pullData(){msg('Pulling fresh Lensically insights and followers without Hermes.');state.active={phase:'syncing_lensically_insights'};render();try{const d=await api('/pull-data',{method:'POST',body:'{}'});state.context=d.context?.summary||state.context;state.run=null;const sync=d.context?.sync||{};msg('Pulled fresh Lensically data. Synced '+(sync.post_archive?.synced_posts||0)+' posts across '+(sync.post_archive?.pages||0)+' pages and refreshed '+(sync.followers?.total_count||0)+' follower snapshots.','ok')}catch(e){msg(e.message,'error')}finally{state.active=null;render()}}
async function generate(){const postCount=Number(document.getElementById('post-count').value||17);msg('Generating '+postCount+' posts. Hermes is working locally; this can take several minutes.');state.active={phase:'starting'};render();try{const d=await api('/generate',{method:'POST',body:JSON.stringify({post_count:postCount})});state.run=d.run;state.context=d.context||state.context;msg('Generated '+(d.run?.posts?.length||postCount)+' posts.','ok')}catch(e){msg(e.message,'error')}finally{state.active=null;render()}}
async function regen(slot){const reason=(state.reasons[slot]||'').trim();if(!reason){msg('Give the agent a rejection reason first.','error');return}msg('Regenerating '+slot+' and writing rejection memory.');try{const d=await api('/regen',{method:'POST',body:JSON.stringify({slot,reason})});state.run=d.run;state.reasons[slot]='';msg(d.understanding||'Regenerated and saved the rejection understanding.','ok')}catch(e){msg(e.message,'error')}finally{render()}}
async function regenSelectedPosts(){const slots=selectedSlots();if(slots.length>${MAX_SELECTED_REGEN}){msg('Select at most ${MAX_SELECTED_REGEN} posts per regen. This protects your usage.','error');return}const rejections=slots.map(slot=>({slot,reason:(state.reasons[slot]||'').trim()}));const missing=rejections.filter(item=>!item.reason).map(item=>item.slot);if(missing.length){msg('Add feedback for selected slots: '+missing.join(', '),'error');return}state.active={phase:'regenerating_selected'};render();try{let done=0;for(const item of rejections){msg('Regenerating '+item.slot+' ('+(done+1)+'/'+rejections.length+').');const d=await api('/regen',{method:'POST',body:JSON.stringify(item)});state.run=d.run;state.reasons[item.slot]='';state.selected[item.slot]=false;done+=1;render()}msg('Regenerated '+done+' selected slot'+(done===1?'':'s')+' and wrote memory.','ok')}catch(e){msg(e.message+' Latest successful slots were saved; press Refresh to reload them.','error');await refresh()}finally{state.active=null;render()}}
async function schedule(){msg('Scheduling the latest generated posts through Lensically.');try{const d=await api('/schedule',{method:'POST',body:'{}'});state.run=d.run;msg('Scheduled the latest generated posts. It did not publish.','ok')}catch(e){msg(e.message,'error')}finally{render()}}
async function stopAgent(){msg('Stopping active Hermes run.');try{const d=await api('/kill',{method:'POST',body:'{}'});state.active=null;msg(d.killed?'Stopped active Hermes run.':'No active Hermes process found.','ok');await refresh()}catch(e){msg(e.message,'error')}finally{render()}}
async function loadControlRegistry(){const d=await api('/control');controlState.registry=d.groups||[];const list=document.getElementById('control-list');list.innerHTML=controlState.registry.map(group=>'<div class="control-group">'+esc(group.group)+'</div>'+group.items.map(item=>'<button class="control-item '+(controlState.current?.id===item.id?'active':'')+'" data-control="'+esc(item.id)+'">'+esc(item.title)+(item.editable?'':' · read-only')+'</button>').join('')).join('');document.querySelectorAll('[data-control]').forEach(btn=>btn.onclick=()=>loadControl(btn.dataset.control))}
async function loadControl(id){const d=await api('/control/file?id='+encodeURIComponent(id));controlState.current=d;document.getElementById('control-editor').value=d.content||'';document.getElementById('control-editor').readOnly=!d.editable;document.getElementById('save-control').disabled=!d.editable;document.getElementById('reload-control').disabled=false;document.getElementById('control-meta').textContent=d.title+' · '+d.type+(d.editable?' · editable':' · read-only');await loadControlRegistry()}
async function saveControl(){if(!controlState.current)return;try{const d=await api('/control/file',{method:'POST',body:JSON.stringify({id:controlState.current.id,content:document.getElementById('control-editor').value})});controlState.current=d;msg('Saved '+d.title+'.','ok');if(d.id==='memory/guidance'){const s=await api('/status');state.guidance=s.guidance||[];render()}}catch(e){msg(e.message,'error')}}
async function toggleControl(){const panel=document.getElementById('control-panel');const open=panel.style.display==='none';panel.style.display=open?'block':'none';document.getElementById('toggle-control').textContent=open?'Close Control Panel':'Open Control Panel';if(open)await loadControlRegistry()}
async function saveGuidance(){const input=document.getElementById('guidance-input');const text=input.value.trim();if(!text){msg('Write guidance before saving.','error');return}state.active={phase:'reasoning_about_guidance'};document.getElementById('agent-reply').textContent='Agent is reasoning about the guidance...';document.getElementById('agent-reply').className='banner';render();try{const d=await api('/guidance',{method:'POST',body:JSON.stringify({text})});state.guidance=d.guidance||[];input.value='';document.getElementById('agent-reply').textContent=d.reply;document.getElementById('agent-reply').className='banner ok';msg('Guidance saved to agent memory.','ok')}catch(e){document.getElementById('agent-reply').textContent=e.message;document.getElementById('agent-reply').className='banner error';msg(e.message,'error')}finally{state.active=null;render()}}
document.getElementById('pull-data').onclick=pullData;document.getElementById('generate').onclick=generate;document.getElementById('stop').onclick=stopAgent;document.getElementById('schedule').onclick=schedule;document.getElementById('refresh').onclick=refresh;document.getElementById('save-guidance').onclick=saveGuidance;document.getElementById('toggle-control').onclick=toggleControl;document.getElementById('save-control').onclick=saveControl;document.getElementById('reload-control').onclick=()=>controlState.current&&loadControl(controlState.current.id);render();if(state.active)msg('Agent phase: '+state.active.phase);else if(state.context)msg('Latest pulled data loaded.','ok');else if(state.run)msg('Latest run loaded.','ok');refresh();
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
      return send(response, 200, html({
        ok: true,
        active_run: activeRun,
        latest_run: await loadLatestRun(),
        latest_context: await loadLatestContextSummary(),
        guidance: await loadGuidance(),
      }), "text/html; charset=UTF-8");
    }
    if (url.pathname === "/status" && request.method === "GET") return send(response, 200, { ok: true, active_run: activeRun, latest_run: await loadLatestRun(), latest_context: await loadLatestContextSummary(), guidance: await loadGuidance() });
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
      return send(response, 200, { ok: true, run: await generateRun(body.post_count), context: await loadLatestContextSummary() });
    }
    if (url.pathname === "/pull-data" && request.method === "POST") return send(response, 200, { ok: true, context: await pullFreshContext() });
    if (url.pathname === "/regen" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, ...(await regenSlot({ slot: String(body.slot ?? ""), reason: String(body.reason ?? "") })) });
    }
    if (url.pathname === "/regen-selected" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, ...(await regenSlots(body.rejections)) });
    }
    if (url.pathname === "/guidance" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, ...(await saveGuidanceWithModel(body.text)) });
    }
    if (url.pathname === "/schedule" && request.method === "POST") return send(response, 200, { ok: true, run: await scheduleLatestRun() });
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
