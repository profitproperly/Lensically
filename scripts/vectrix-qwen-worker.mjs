import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = path.join(ROOT, ".lensically-agent.env");
const STATE_DIR = path.join(ROOT, "agent-vaults", "vectrix", "State");
const LOG_DIR = path.join(ROOT, "logs");
const ACCOUNT_ID = "vectrix";
const TIMEZONE = "America/New_York";
const API_BASE_URL = process.env.LENSICALLY_API_BASE_URL || "https://api.lensically.com";
const LLAMA_BASE_URL = process.env.VECTRIX_LLAMA_BASE_URL || "http://127.0.0.1:8080/v1";
const MODEL = process.env.VECTRIX_QWEN_MODEL || "qwen3-4b-instruct";

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

function extractJson(text) {
  const raw = String(text ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Qwen returned no JSON: ${raw.slice(0, 400)}`);
  return JSON.parse(match[0]);
}

async function generatePosts(context) {
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
    "Generate original Threads posts for the missing hourly slots.",
    "Niche: making money online, building wealth, financial freedom, online business systems, monetizable skills, disciplined investing, cash-flow thinking.",
    "Rules: no scams, no guaranteed income claims, no fake results, no direct investment picks, no repeated wording, no hashtags, no emojis.",
    "Use archive samples to avoid repeating posts and to infer what should improve over time.",
    "Return only JSON in this exact shape: {\"posts\":[{\"slot\":\"HH:MM\",\"text\":\"post text\"}]}",
    `Date: ${context.date}`,
    `Missing slots: ${JSON.stringify(missingSlots)}`,
    `Content brief: ${context.agent?.content_brief || ""}`,
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
    if (duplicateKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    posts.push({ slot, text });
  }

  return posts;
}

async function runOnce() {
  await loadEnv();
  await fs.mkdir(STATE_DIR, { recursive: true });
  const date = process.argv.find((arg) => arg.startsWith("--date="))?.split("=")[1] || localTomorrowDate();
  const context = await getContext(date);
  await fs.writeFile(path.join(STATE_DIR, "latest-context.json"), `${JSON.stringify(context, null, 2)}\n`, "utf8");

  if (context?.agent?.enabled !== true) {
    await log("agent_disabled", { date });
    return;
  }

  const missingSlots = Array.isArray(context.missing_slots) ? context.missing_slots : [];
  if (!missingSlots.length) {
    await log("already_scheduled", { date });
    return;
  }

  const posts = await generatePosts(context);
  if (!posts.length) {
    await log("no_posts_generated", { date, missing_slots: missingSlots.length });
    return;
  }

  const plan = { account_id: ACCOUNT_ID, date, timezone: TIMEZONE, posts };
  await fs.writeFile(path.join(STATE_DIR, `plan-${date}.json`), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  const result = await schedulePlan(plan);
  await fs.writeFile(path.join(STATE_DIR, `schedule-result-${date}.json`), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await log("scheduled", { date, requested: missingSlots.length, generated: posts.length, created: result.created?.length ?? 0, skipped: result.skipped?.length ?? 0 });
}

runOnce().catch(async (error) => {
  await log("failed", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
