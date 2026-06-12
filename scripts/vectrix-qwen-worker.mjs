import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = path.join(ROOT, ".lensically-agent.env");
const STATE_DIR = path.join(ROOT, "agent-vaults", "vectrix", "State");
const MEMORY_DIR = path.join(ROOT, "agent-vaults", "vectrix", "Memory");
const LOG_DIR = path.join(ROOT, "logs");
const PERFORMANCE_MEMORY_PATH = path.join(MEMORY_DIR, "performance-memory.json");
const ACCOUNT_ID = "vectrix";
const TIMEZONE = "America/New_York";
const API_BASE_URL = process.env.LENSICALLY_API_BASE_URL || "https://api.lensically.com";
const LLAMA_BASE_URL = process.env.VECTRIX_LLAMA_BASE_URL || "http://127.0.0.1:8080/v1";
const MODEL = process.env.VECTRIX_QWEN_MODEL || "qwen3-4b-instruct";
const VECTRIX_POST_FORMATS = [
  "specific online income play with a concrete first step",
  "wealth building mistake most beginners make and the better move",
  "simple digital skill people can learn and sell",
  "cash flow system breakdown with clear inputs and outputs",
  "one person scenario that shows a money lesson",
  "contrarian financial freedom take with practical reasoning",
  "small operator checklist with three short items written as sentences",
  "business idea validation test someone can run today",
  "audience building lesson tied to monetization",
  "habit that compounds into income over months",
];
const VECTRIX_BANNED_WEAK_PHRASES = [
  "what's your strategy",
  "what is your strategy",
  "review your progress",
  "reflect on your progress",
  "build a habit of daily reflection",
  "focus on what you can control",
  "small changes compound",
  "financial goals",
  "stay motivated",
  "on track",
  "what worked today",
  "what can you improve",
];

async function loadEnv() {
  try {
    const raw = await fs.readFile(ENV_PATH, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index <= 0) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function log(event, details = {}) {
  await fs.mkdir(LOG_DIR, { recursive: true });
  const entry = JSON.stringify({ ts: new Date().toISOString(), event, ...details });
  await fs.appendFile(path.join(LOG_DIR, "vectrix-qwen-worker.log"), `${entry}\n`, "utf8");
  console.log(entry);
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJsonFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function localTomorrowDate() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  const localNoon = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00-05:00`);
  localNoon.setUTCDate(localNoon.getUTCDate() + 1);
  return localNoon.toISOString().slice(0, 10);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${url.pathname} HTTP ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function getContext(targetDate) {
  const key = process.env.LENSICALLY_INTERNAL_API_KEY?.trim();
  if (!key) throw new Error("Missing LENSICALLY_INTERNAL_API_KEY in .lensically-agent.env");
  const url = new URL("/api/automation/context", API_BASE_URL);
  url.searchParams.set("account_id", ACCOUNT_ID);
  url.searchParams.set("timezone", TIMEZONE);
  url.searchParams.set("date", targetDate);
  return fetchJson(url, { headers: { "x-internal-key": key } });
}

async function schedulePlan(plan) {
  const key = process.env.LENSICALLY_INTERNAL_API_KEY?.trim();
  if (!key) throw new Error("Missing LENSICALLY_INTERNAL_API_KEY in .lensically-agent.env");
  const url = new URL("/api/automation/schedule-plan", API_BASE_URL);
  return fetchJson(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-key": key,
    },
    body: JSON.stringify(plan),
  });
}

function normalizePostText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 480);
}

function containsDash(text) {
  return /[-\u2010-\u2015]/.test(String(text ?? ""));
}

function containsWeakPhrase(text) {
  const normalized = normalizePostText(text).toLowerCase();
  return VECTRIX_BANNED_WEAK_PHRASES.some((phrase) => normalized.includes(phrase));
}

function postKey(text) {
  return normalizePostText(text)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function existingPostKeys(context) {
  const posts = [
    ...(Array.isArray(context.archive_recent) ? context.archive_recent : []),
    ...(Array.isArray(context.archive_top) ? context.archive_top : []),
    ...(Array.isArray(context.scheduled_posts) ? context.scheduled_posts : []),
  ];
  return new Set(posts.map((post) => postKey(post.post_text || post.text)).filter(Boolean));
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getPostMetric(post, names) {
  for (const name of names) {
    if (post?.[name] !== undefined && post?.[name] !== null) {
      const value = numberOrNull(post[name]);
      if (value !== null) return value;
    }
  }
  return null;
}

function extractPerformanceSnapshot(context) {
  const posts = [
    ...(Array.isArray(context.archive_top) ? context.archive_top : []),
    ...(Array.isArray(context.archive_recent) ? context.archive_recent : []),
  ];
  const byKey = new Map();

  for (const post of posts) {
    const text = normalizePostText(post.post_text || post.text);
    const key = postKey(text);
    if (!key || byKey.has(key)) continue;

    const likes = getPostMetric(post, ["like_count", "likes"]);
    const replies = getPostMetric(post, ["reply_count", "replies"]);
    const reposts = getPostMetric(post, ["repost_count", "reposts"]);
    const views = getPostMetric(post, ["view_count", "views"]);
    const score = (likes ?? 0) + ((replies ?? 0) * 2) + ((reposts ?? 0) * 3);

    byKey.set(key, {
      text,
      key,
      likes,
      replies,
      reposts,
      views,
      score,
      has_dash: containsDash(text),
      captured_from: post.id ?? post.post_id ?? null,
      posted_at: post.timestamp ?? post.posted_at ?? post.created_at ?? null,
    });
  }

  return Array.from(byKey.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, 120);
}

function defaultPerformanceMemory() {
  return {
    version: 1,
    updated_at: null,
    summary: "No performance data yet. Start broad, practical, and specific.",
    winning_patterns: [],
    weak_patterns: [],
    topics_to_repeat: [],
    topics_to_avoid: [],
    phrases_to_avoid: [],
    slot_notes: [],
    last_snapshot_count: 0,
  };
}

function normalizeStringArray(value, limit, maxLength = 160) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((entry) => !containsDash(entry))
    .filter((entry) => !containsWeakPhrase(entry))
    .slice(0, limit)
    .map((entry) => entry.slice(0, maxLength));
}

function normalizePerformanceMemory(value) {
  const fallback = defaultPerformanceMemory();
  if (!value || typeof value !== "object") return fallback;
  return {
    version: 1,
    updated_at: typeof value.updated_at === "string" ? value.updated_at : fallback.updated_at,
    summary: String(value.summary || fallback.summary).replace(/\s+/g, " ").trim().slice(0, 600),
    winning_patterns: normalizeStringArray(value.winning_patterns, 12),
    weak_patterns: normalizeStringArray(value.weak_patterns, 12),
    topics_to_repeat: normalizeStringArray(value.topics_to_repeat, 12, 80),
    topics_to_avoid: normalizeStringArray(value.topics_to_avoid, 12, 80),
    phrases_to_avoid: normalizeStringArray(value.phrases_to_avoid, 30, 80),
    slot_notes: normalizeStringArray(value.slot_notes, 24),
    last_snapshot_count: Number.isFinite(Number(value.last_snapshot_count)) ? Number(value.last_snapshot_count) : 0,
  };
}

function extractJson(text) {
  const raw = String(text ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Qwen returned no JSON: ${raw.slice(0, 400)}`);
  return JSON.parse(match[0]);
}

async function analyzePerformance(context, currentMemory) {
  const snapshot = extractPerformanceSnapshot(context);
  await writeJsonFile(path.join(MEMORY_DIR, "latest-performance-snapshot.json"), {
    captured_at: new Date().toISOString(),
    account_id: ACCOUNT_ID,
    post_count: snapshot.length,
    posts: snapshot,
  });

  if (snapshot.length < 5) {
    const memory = normalizePerformanceMemory({
      ...currentMemory,
      last_snapshot_count: snapshot.length,
      updated_at: new Date().toISOString(),
    });
    await writeJsonFile(PERFORMANCE_MEMORY_PATH, memory);
    return memory;
  }

  const winners = snapshot.slice(0, 20);
  const losers = snapshot.slice(-20).reverse();
  const prompt = [
    "You are improving the Vectrix Threads strategy from actual post performance.",
    "Analyze winners and weak posts. Update strategy memory for tomorrow's generator.",
    "Do not suggest dashes. Do not include hyphens, en dashes, em dashes, or minus signs in any memory field.",
    "Keep advice practical and specific to making money online, building wealth, and financial freedom.",
    "Return only JSON with this shape:",
    "{\"summary\":\"string\",\"winning_patterns\":[\"string\"],\"weak_patterns\":[\"string\"],\"topics_to_repeat\":[\"string\"],\"topics_to_avoid\":[\"string\"],\"phrases_to_avoid\":[\"string\"],\"slot_notes\":[\"string\"]}",
    `Current memory: ${JSON.stringify(currentMemory)}`,
    `Winning posts: ${JSON.stringify(winners)}`,
    `Weak posts: ${JSON.stringify(losers)}`,
  ].join("\n\n");

  try {
    const data = await fetchJson(new URL("/chat/completions", LLAMA_BASE_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.25,
        max_tokens: 2048,
        messages: [
          { role: "system", content: "You return clean JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });
    const content = data?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content);
    const memory = normalizePerformanceMemory({
      ...parsed,
      updated_at: new Date().toISOString(),
      last_snapshot_count: snapshot.length,
    });
    await writeJsonFile(path.join(MEMORY_DIR, `performance-memory-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), memory);
    await writeJsonFile(PERFORMANCE_MEMORY_PATH, memory);
    await log("memory_updated", { snapshot_count: snapshot.length });
    return memory;
  } catch (error) {
    await log("memory_update_failed", { error: error instanceof Error ? error.message : String(error), snapshot_count: snapshot.length });
    return currentMemory;
  }
}

async function generatePosts(context, memory) {
  const missingSlots = Array.isArray(context.missing_slots) ? context.missing_slots : [];
  const archiveSamples = [
    ...(Array.isArray(context.archive_top) ? context.archive_top.slice(0, 20) : []),
    ...(Array.isArray(context.archive_recent) ? context.archive_recent.slice(0, 30) : []),
  ].map((post) => ({
    text: normalizePostText(post.post_text || post.text),
    likes: post.like_count ?? post.likes ?? null,
    views: post.view_count ?? post.views ?? null,
  }));

  const prompt = [
    "You are the Vectrix Threads growth worker.",
    "Generate original Threads posts for the missing hourly slots that can attract followers, not generic motivation.",
    "Niche: making money online, building wealth, financial freedom, online business systems, monetizable skills, disciplined investing, cash-flow thinking.",
    "Rules: no scams, no guaranteed income claims, no fake results, no direct investment picks, no repeated wording, no hashtags, no emojis.",
    "Never use dashes of any kind in post text. Do not use hyphens, en dashes, em dashes, minus signs, or dash separators.",
    "Avoid vague coaching questions. Do not write generic lines like review your progress, reflect on your progress, stay motivated, or what is your strategy.",
    "Each post needs a concrete idea, a useful distinction, a specific action, or a memorable point of view.",
    "Use direct statements more than questions. If you use a question, make it sharp and specific.",
    "Write like an operator building online cash flow in public. Short, practical, specific, and follow worthy.",
    "Use archive samples to avoid repeating posts and to infer what should improve over time.",
    "Use strategy memory to repeat proven patterns and avoid weak patterns without copying old posts.",
    "Return only JSON in this exact shape: {\"posts\":[{\"slot\":\"HH:MM\",\"text\":\"post text\"}]}",
    `Date: ${context.date}`,
    `Missing slots: ${JSON.stringify(missingSlots)}`,
    `Content brief: ${context.agent?.content_brief || ""}`,
    `Strong post formats to rotate: ${JSON.stringify(VECTRIX_POST_FORMATS)}`,
    `Banned weak phrases: ${JSON.stringify(VECTRIX_BANNED_WEAK_PHRASES)}`,
    `Strategy memory: ${JSON.stringify(memory)}`,
    `Archive samples: ${JSON.stringify(archiveSamples)}`,
  ].join("\n\n");

  const data = await fetchJson(new URL("/chat/completions", LLAMA_BASE_URL), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.75,
      max_tokens: 4096,
      messages: [
        { role: "system", content: "You write concise, original JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const content = data?.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  const duplicateKeys = existingPostKeys(context);
  const seen = new Set();
  const requestedSlots = new Set(missingSlots);
  const posts = [];

  for (const entry of Array.isArray(parsed.posts) ? parsed.posts : []) {
    const slot = String(entry.slot ?? "").trim();
    const text = normalizePostText(entry.text);
    const key = postKey(text);
    if (!requestedSlots.has(slot) || !text || !key) continue;
    if (containsDash(text)) continue;
    if (containsWeakPhrase(text)) continue;
    if (duplicateKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    posts.push({ slot, text });
  }

  return posts;
}

async function runOnce() {
  await loadEnv();
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.mkdir(MEMORY_DIR, { recursive: true });
  const date = process.argv.find((arg) => arg.startsWith("--date="))?.split("=")[1] || localTomorrowDate();
  const context = await getContext(date);
  await writeJsonFile(path.join(STATE_DIR, "latest-context.json"), context);

  if (context?.agent?.enabled !== true) {
    await log("agent_disabled", { date });
    return;
  }

  const missingSlots = Array.isArray(context.missing_slots) ? context.missing_slots : [];
  const currentMemory = normalizePerformanceMemory(await readJsonFile(PERFORMANCE_MEMORY_PATH, defaultPerformanceMemory()));
  const memory = await analyzePerformance(context, currentMemory);

  if (!missingSlots.length) {
    await log("already_scheduled", { date, memory_snapshot_count: memory.last_snapshot_count });
    return;
  }

  const posts = await generatePosts(context, memory);
  if (!posts.length) {
    await log("no_posts_generated", { date, missing_slots: missingSlots.length });
    return;
  }

  const plan = { account_id: ACCOUNT_ID, date, timezone: TIMEZONE, posts };
  await writeJsonFile(path.join(STATE_DIR, `plan-${date}.json`), plan);
  const result = await schedulePlan(plan);
  await writeJsonFile(path.join(STATE_DIR, `schedule-result-${date}.json`), result);
  await log("scheduled", { date, requested: missingSlots.length, generated: posts.length, created: result.created?.length ?? 0, skipped: result.skipped?.length ?? 0 });
}

runOnce().catch(async (error) => {
  await log("failed", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
