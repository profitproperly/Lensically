import { createServer } from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VAULT = path.join(ROOT, "manifest-mental-vault");
const LOCAL_ENV_PATH = path.join(ROOT, ".lensically-agent.env");
const PORT = Number(process.env.MANIFEST_AGENT_PORT || 4127);
const API_BASE_URL = process.env.LENSICALLY_API_BASE_URL || "https://api.lensically.com";
const ACCOUNT_ID = "manifest-mental";
const TIMEZONE = "America/New_York";
const GOAL_FOLLOWERS = 1_000_000;
const HERMES_BIN = "/home/brian/.local/bin/hermes";
const HERMES_MODEL = "gpt-5.5";
const HERMES_PROVIDER = "openai-codex";

let activeRun = null;

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function ensureDirs() {
  await Promise.all([
    fs.mkdir(path.join(VAULT, "Context"), { recursive: true }),
    fs.mkdir(path.join(VAULT, "Runs"), { recursive: true }),
    fs.mkdir(path.join(VAULT, "Rejections"), { recursive: true }),
    fs.mkdir(path.join(VAULT, "Lessons"), { recursive: true }),
  ]);
}

async function loadLocalEnv() {
  try {
    const raw = await fs.readFile(LOCAL_ENV_PATH, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex <= 0) continue;
      const key = trimmed.slice(0, equalsIndex).trim();
      const value = trimmed.slice(equalsIndex + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function requireInternalKey() {
  const key = process.env.LENSICALLY_INTERNAL_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing LENSICALLY_INTERNAL_API_KEY in .lensically-agent.env.");
  }
  return key;
}

async function fetchJson(route, options = {}) {
  const url = new URL(route, API_BASE_URL);
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${route} HTTP ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function fetchAllArchive(order) {
  const posts = [];
  let page = 1;
  const limit = 100;
  for (;;) {
    const data = await fetchJson(`/api/threads/posts/archive?order=${encodeURIComponent(order)}&limit=${limit}&page=${page}`);
    const pagePosts = Array.isArray(data.posts) ? data.posts : [];
    posts.push(...pagePosts);
    const total = Number(data.total ?? data.total_posts ?? data.totalCount ?? 0);
    if (!pagePosts.length || (total && posts.length >= total) || page >= 20) {
      return posts;
    }
    page += 1;
  }
}

function average(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return 0;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function numberValue(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeMetrics({ dashboard, followers, archiveRecent, archiveTop }) {
  const profile = dashboard?.profile ?? {};
  const followerCount = numberValue(profile.follower_count);
  const topPost = dashboard?.top_post ?? archiveTop[0] ?? null;
  const topLikes = numberValue(topPost?.likes);
  const topViews = numberValue(topPost?.views);
  const recentLikes = archiveRecent.map((post) => numberValue(post.likes));
  const recentViews = archiveRecent.map((post) => numberValue(post.views));
  const averageLikes = Math.round(average(recentLikes));
  const averageViews = Math.round(average(recentViews));

  return {
    current_followers: followerCount,
    followers_to_1m: Math.max(0, GOAL_FOLLOWERS - followerCount),
    progress_to_1m_percent: GOAL_FOLLOWERS ? Number(((followerCount / GOAL_FOLLOWERS) * 100).toFixed(4)) : 0,
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
      average_likes_2x: averageLikes * 2,
      average_views_2x: averageViews * 2,
    },
    baselines: {
      average_likes: averageLikes,
      average_views: averageViews,
      recent_sample_size: archiveRecent.length,
      archive_total_seen: Math.max(archiveRecent.length, archiveTop.length),
      follower_snapshots_seen: Array.isArray(followers?.rows) ? followers.rows.length : 0,
    },
  };
}

async function buildFreshContext() {
  const internalKey = requireInternalKey();
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
    scheduled_posts: automationContext.scheduled_posts,
    metrics: computeMetrics({ dashboard, followers, archiveRecent, archiveTop }),
    dashboard,
    follower_archive: followers,
    archive_recent: archiveRecent,
    archive_top: archiveTop,
    agent_rules: {
      never_publish: true,
      only_schedule_after_user_clicks_schedule: true,
      generate_17_posts_for_7am_to_11pm: true,
      regen_uses_cached_context: true,
      full_context_pull_only_on_generate: true,
      fatigue_rule: "Reusing openers is allowed. Reusing the latter half, payoff, or full sentence shape too closely is audience fatigue.",
    },
  };

  await writeJson(path.join(VAULT, "Context", "latest-generate-context.json"), context);
  await writeJson(path.join(VAULT, "Context", `generate-context-${nowStamp()}.json`), context);
  return context;
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function compactContextForPrompt(context) {
  return {
    generated_at: context.generated_at,
    target_date: context.target_date,
    desired_slots: context.desired_slots,
    missing_slots: context.missing_slots,
    metrics: context.metrics,
    follower_archive: {
      rows: Array.isArray(context.follower_archive?.rows) ? context.follower_archive.rows.slice(0, 90) : [],
    },
    archive_recent: context.archive_recent.slice(0, 140).map((post) => ({
      id: post.id,
      text: post.text,
      timestamp: post.timestamp,
      likes: post.likes,
      views: post.views,
      replies: post.replies,
      reposts: post.reposts,
    })),
    archive_top: context.archive_top.slice(0, 80).map((post) => ({
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

function buildGeneratePrompt(context) {
  return [
    "You are the Manifest Mental recursive growth agent.",
    "Your output must be valid JSON only. No markdown.",
    "Mission: create a 17-post slate that can schedule from 07:00 through 23:00 ET, move the account toward 1,000,000 followers, outperform the current top-liked post by 2x over time, raise the average likes and views floor, and protect against audience fatigue.",
    "Never publish. Only create candidate text. Scheduling happens only after a separate user command.",
    "Audience fatigue rule: reusing openers is permitted when useful, but reusing the latter half, payoff, or sentence resolution too closely is fatigue.",
    "Use the archive, follower history, metrics, top posts, baselines, and goals. Do the math yourself.",
    "Return JSON shape: {\"metrics\": object, \"strategy_summary\": string, \"fatigue_summary\": string, \"posts\": [{\"slot\":\"07:00\",\"text\":\"...\",\"objective\":\"...\",\"bet_type\":\"...\",\"fatigue_check\":\"...\",\"expected_win_condition\":\"...\"}], \"memory_notes\": [string] }",
    "Context JSON:",
    JSON.stringify(compactContextForPrompt(context)),
  ].join("\n\n");
}

function buildRegenPrompt({ context, latestRun, slot, reason, previousPost, lessons }) {
  return [
    "You are the Manifest Mental recursive growth agent regenerating one rejected slot.",
    "Your output must be valid JSON only. No markdown.",
    "The user rejected the slot. Learn from the rejection and regenerate only that slot using cached context. Do not call fresh insights or follower data.",
    "Never publish. Only create candidate text.",
    "Audience fatigue rule: reusing openers is permitted when useful, but reusing the latter half, payoff, or sentence resolution too closely is fatigue.",
    "Return JSON shape: {\"slot\":\"09:00\",\"text\":\"...\",\"objective\":\"...\",\"bet_type\":\"...\",\"fatigue_check\":\"...\",\"expected_win_condition\":\"...\",\"learned_response\":\"I understand you rejected this because ...\", \"memory_note\":\"...\"}",
    "Rejection:",
    JSON.stringify({ slot, reason, previousPost, prior_lessons: lessons.slice(-20) }),
    "Cached context JSON:",
    JSON.stringify(compactContextForPrompt(context)),
    "Current slate JSON:",
    JSON.stringify(latestRun?.posts ?? []),
  ].join("\n\n");
}

function extractJson(text) {
  const trimmed = String(text ?? "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error(`Hermes did not return parseable JSON: ${trimmed.slice(0, 500)}`);
  }
}

function toWslPath(windowsPath) {
  const normalized = path.resolve(windowsPath).replace(/\\/g, "/");
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!match) {
    return normalized;
  }
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
}

async function runHermesJson(prompt) {
  const promptPath = path.join(VAULT, "Context", "latest-hermes-prompt.txt");
  await fs.writeFile(promptPath, prompt, "utf8");
  const wslPromptPath = toWslPath(promptPath);
  return new Promise((resolve, reject) => {
    const child = spawn("wsl.exe", [
      "bash",
      "-lc",
      `cd /mnt/c/Auto-Threads/lensically && PROMPT="$(cat '${wslPromptPath}')" && ${HERMES_BIN} -z "$PROMPT" --provider ${HERMES_PROVIDER} --model ${HERMES_MODEL}`,
    ], {
      env: { ...process.env },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Hermes timed out after 10 minutes."));
    }, 10 * 60 * 1000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`Hermes exited ${code}: ${stderr || stdout}`));
        return;
      }
      try {
        resolve(extractJson(stdout));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function normalizePosts(posts, desiredSlots) {
  if (!Array.isArray(posts)) {
    throw new Error("Hermes response did not include posts array.");
  }
  return desiredSlots.map((slot) => {
    const post = posts.find((item) => item?.slot === slot);
    if (!post?.text || typeof post.text !== "string") {
      throw new Error(`Missing generated post for ${slot}.`);
    }
    return {
      slot,
      text: post.text.trim(),
      objective: String(post.objective ?? "").trim(),
      bet_type: String(post.bet_type ?? "").trim(),
      fatigue_check: String(post.fatigue_check ?? "").trim(),
      expected_win_condition: String(post.expected_win_condition ?? "").trim(),
    };
  });
}

async function loadLatestRun() {
  try {
    return await readJson(path.join(VAULT, "Runs", "latest-run.json"));
  } catch {
    return null;
  }
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
  await writeJson(path.join(VAULT, "Lessons", "rejection-lessons.json"), { updated_at: new Date().toISOString(), lessons });
}

async function generateRun() {
  const runId = nowStamp();
  activeRun = { id: runId, phase: "pulling_context", started_at: new Date().toISOString() };
  const context = await buildFreshContext();
  activeRun = { ...activeRun, phase: "generating_posts" };
  const hermes = await runHermesJson(buildGeneratePrompt(context));
  const posts = normalizePosts(hermes.posts, context.desired_slots);
  const run = {
    id: runId,
    status: "generated",
    generated_at: new Date().toISOString(),
    target_date: context.target_date,
    metrics: hermes.metrics ?? context.metrics,
    strategy_summary: String(hermes.strategy_summary ?? ""),
    fatigue_summary: String(hermes.fatigue_summary ?? ""),
    memory_notes: Array.isArray(hermes.memory_notes) ? hermes.memory_notes.map(String) : [],
    posts,
  };
  await writeJson(path.join(VAULT, "Runs", "latest-run.json"), run);
  await writeJson(path.join(VAULT, "Runs", `run-${runId}.json`), run);
  activeRun = null;
  return run;
}

async function regenSlot({ slot, reason }) {
  if (!slot || !reason?.trim()) {
    throw new Error("slot and reason are required.");
  }
  const context = await readJson(path.join(VAULT, "Context", "latest-generate-context.json"));
  const latestRun = await loadLatestRun();
  if (!latestRun?.posts?.length) {
    throw new Error("No latest generated run is available. Press Generate first.");
  }
  const previousPost = latestRun.posts.find((post) => post.slot === slot);
  if (!previousPost) {
    throw new Error(`Slot ${slot} was not found in latest run.`);
  }
  const lessons = await loadLessons();
  const hermes = await runHermesJson(buildRegenPrompt({ context, latestRun, slot, reason, previousPost, lessons }));
  const nextPost = {
    slot,
    text: String(hermes.text ?? "").trim(),
    objective: String(hermes.objective ?? "").trim(),
    bet_type: String(hermes.bet_type ?? "").trim(),
    fatigue_check: String(hermes.fatigue_check ?? "").trim(),
    expected_win_condition: String(hermes.expected_win_condition ?? "").trim(),
  };
  if (!nextPost.text) {
    throw new Error("Hermes returned an empty regenerated post.");
  }
  const learnedResponse = String(hermes.learned_response ?? "I understand the rejection and adjusted this slot.").trim();
  const memoryNote = String(hermes.memory_note ?? reason).trim();
  const rejection = {
    rejected_at: new Date().toISOString(),
    slot,
    reason: reason.trim(),
    previous_post: previousPost,
    replacement_post: nextPost,
    learned_response: learnedResponse,
    memory_note: memoryNote,
  };
  latestRun.posts = latestRun.posts.map((post) => post.slot === slot ? nextPost : post);
  latestRun.last_regen = rejection;
  await writeJson(path.join(VAULT, "Runs", "latest-run.json"), latestRun);
  await writeJson(path.join(VAULT, "Rejections", `rejection-${nowStamp()}-${slot.replace(":", "-")}.json`), rejection);
  await saveLessons([...lessons, rejection].slice(-200));
  return { post: nextPost, learned_response: learnedResponse, run: latestRun };
}

async function scheduleLatestRun() {
  const latestRun = await loadLatestRun();
  if (!latestRun?.posts?.length) {
    throw new Error("No latest generated run is available.");
  }
  const payloadPath = path.join(VAULT, "Runs", "latest-schedule-plan.json");
  const payload = {
    account_id: ACCOUNT_ID,
    date: latestRun.target_date,
    timezone: TIMEZONE,
    posts: latestRun.posts.map((post) => ({ slot: post.slot, text: post.text })),
  };
  await writeJson(payloadPath, payload);
  const output = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, "scripts", "lensically-agent-api.mjs"), "schedule-plan", "--file", payloadPath], {
      cwd: ROOT,
      windowsHide: true,
    });
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

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "content-type": "application/json; charset=UTF-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end(JSON.stringify(data));
}

async function handleRequest(request, response) {
  if (request.method === "OPTIONS") {
    sendJson(response, 200, { ok: true });
    return;
  }
  try {
    const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname === "/status" && request.method === "GET") {
      sendJson(response, 200, { ok: true, active_run: activeRun, latest_run: await loadLatestRun() });
      return;
    }
    if (url.pathname === "/latest" && request.method === "GET") {
      sendJson(response, 200, { ok: true, latest_run: await loadLatestRun() });
      return;
    }
    if (url.pathname === "/generate" && request.method === "POST") {
      if (activeRun) {
        sendJson(response, 409, { error: "Agent is already running.", active_run: activeRun });
        return;
      }
      const run = await generateRun();
      sendJson(response, 200, { ok: true, run });
      return;
    }
    if (url.pathname === "/regen" && request.method === "POST") {
      const body = await readBody(request);
      const result = await regenSlot({ slot: String(body.slot ?? ""), reason: String(body.reason ?? "") });
      sendJson(response, 200, { ok: true, ...result });
      return;
    }
    if (url.pathname === "/schedule" && request.method === "POST") {
      const run = await scheduleLatestRun();
      sendJson(response, 200, { ok: true, run });
      return;
    }
    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    activeRun = null;
    sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

await loadLocalEnv();
await ensureDirs();

createServer((request, response) => {
  void handleRequest(request, response);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Manifest agent bridge listening on http://127.0.0.1:${PORT}`);
});
