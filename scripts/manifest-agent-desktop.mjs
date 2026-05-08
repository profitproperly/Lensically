import { createServer } from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VAULT = path.join(ROOT, "manifest-mental-vault");
const LOCAL_ENV_PATH = path.join(ROOT, ".lensically-agent.env");
const PORT = Number(process.env.MANIFEST_AGENT_DESKTOP_PORT || 4317);
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

function numberValue(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function average(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : 0;
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

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
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
  await writeJson(path.join(VAULT, "Lessons", "rejection-lessons.json"), {
    updated_at: new Date().toISOString(),
    lessons,
  });
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

function buildGeneratePrompt(context, lessons) {
  return [
    "You are the standalone Manifest Mental recursive learning agent.",
    "Output valid JSON only. No markdown.",
    "Generate exactly 17 post candidates from 07:00 through 23:00 ET.",
    "Never publish. Never call a publish endpoint. Only create candidates; scheduling is a later explicit user action.",
    "Goal: grow the account to 1,000,000 followers.",
    "Performance targets: over time, beat the top-liked post by 2x, create a rising floor for average likes and views, and protect audience fatigue.",
    "Audience fatigue rule: openers may repeat when useful. The latter half, payoff, promise, and sentence resolution must not be too close to recent/generated posts.",
    "Use the full archive, follower archive, metrics, goals, rejection lessons, and top posts. Do the math and strategy in the backend.",
    "Return JSON: {\"metrics\": object, \"strategy_summary\": string, \"fatigue_summary\": string, \"posts\": [{\"slot\":\"07:00\",\"text\":\"...\",\"objective\":\"...\",\"bet_type\":\"...\",\"fatigue_check\":\"...\",\"expected_win_condition\":\"...\"}], \"memory_notes\": [string]}",
    "Prior rejection lessons:",
    JSON.stringify(lessons.slice(-40)),
    "Context:",
    JSON.stringify(compactContext(context)),
  ].join("\n\n");
}

function buildRegenPrompt({ context, latestRun, slot, reason, previousPost, lessons }) {
  return [
    "You are the standalone Manifest Mental recursive learning agent regenerating one rejected post.",
    "Output valid JSON only. No markdown.",
    "Use cached context only. Do not fetch fresh insights, follower, or archive data.",
    "The user gave a rejection reason. Explain what you understood, write a memory note, and regenerate only that slot.",
    "Audience fatigue rule: openers may repeat when useful. The latter half, payoff, promise, and sentence resolution must not be too close.",
    "Return JSON: {\"slot\":\"09:00\",\"text\":\"...\",\"objective\":\"...\",\"bet_type\":\"...\",\"fatigue_check\":\"...\",\"expected_win_condition\":\"...\",\"learned_response\":\"...\", \"memory_note\":\"...\"}",
    "Rejection:",
    JSON.stringify({ slot, reason, previousPost }),
    "Prior rejection lessons:",
    JSON.stringify(lessons.slice(-40)),
    "Cached context:",
    JSON.stringify(compactContext(context)),
    "Current slate:",
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
    const child = spawn("wsl.exe", [
      "python3",
      wslRunnerPath,
      wslPromptPath,
    ], { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Hermes timed out after 10 minutes."));
    }, 10 * 60 * 1000);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) reject(new Error(`Hermes exited ${code}: ${stderr || stdout}`));
      else resolve(extractJson(stdout));
    });
  });
}

function normalizePosts(posts, desiredSlots) {
  if (!Array.isArray(posts)) throw new Error("Hermes response did not include posts array.");
  return desiredSlots.map((slot) => {
    const post = posts.find((item) => item?.slot === slot);
    if (!post?.text || typeof post.text !== "string") throw new Error(`Missing generated post for ${slot}.`);
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

async function generateRun() {
  const runId = nowStamp();
  activeRun = { id: runId, phase: "starting", started_at: new Date().toISOString() };
  const context = await buildFreshContext();
  const lessons = await loadLessons();
  activeRun = { ...activeRun, phase: "hermes_generating_17_posts" };
  const hermes = await runHermesJson(buildGeneratePrompt(context, lessons));
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
  if (!slot || !reason?.trim()) throw new Error("slot and reason are required.");
  const context = await readJson(path.join(VAULT, "Context", "latest-generate-context.json"));
  const latestRun = await loadLatestRun();
  if (!latestRun?.posts?.length) throw new Error("No generated run is available. Press Generate first.");
  const previousPost = latestRun.posts.find((post) => post.slot === slot);
  if (!previousPost) throw new Error(`Slot ${slot} was not found.`);
  const lessons = await loadLessons();
  activeRun = { id: nowStamp(), phase: `regenerating_${slot}`, started_at: new Date().toISOString() };
  const hermes = await runHermesJson(buildRegenPrompt({ context, latestRun, slot, reason, previousPost, lessons }));
  const nextPost = {
    slot,
    text: String(hermes.text ?? "").trim(),
    objective: String(hermes.objective ?? "").trim(),
    bet_type: String(hermes.bet_type ?? "").trim(),
    fatigue_check: String(hermes.fatigue_check ?? "").trim(),
    expected_win_condition: String(hermes.expected_win_condition ?? "").trim(),
  };
  if (!nextPost.text) throw new Error("Hermes returned an empty regenerated post.");
  const rejection = {
    rejected_at: new Date().toISOString(),
    slot,
    reason: reason.trim(),
    previous_post: previousPost,
    replacement_post: nextPost,
    learned_response: String(hermes.learned_response ?? "").trim(),
    memory_note: String(hermes.memory_note ?? reason).trim(),
  };
  latestRun.posts = latestRun.posts.map((post) => post.slot === slot ? nextPost : post);
  latestRun.last_regen = rejection;
  await writeJson(path.join(VAULT, "Runs", "latest-run.json"), latestRun);
  await writeJson(path.join(VAULT, "Rejections", `rejection-${nowStamp()}-${slot.replace(":", "-")}.json`), rejection);
  await saveLessons([...lessons, rejection].slice(-300));
  activeRun = null;
  return { run: latestRun, post: nextPost, learned_response: rejection.learned_response };
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char]);
}

function html() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Manifest Mental Agent</title>
<style>
:root{--ink:#111827;--muted:#64748b;--line:#d7dde8;--paper:#fbfaf7;--card:#fff;--accent:#111827;--good:#0f766e;--bad:#b42318}*{box-sizing:border-box}body{margin:0;background:linear-gradient(135deg,#fbfaf7,#eef4f1 46%,#f8efe6);color:var(--ink);font-family:Segoe UI,ui-sans-serif,sans-serif}main{width:min(1440px,calc(100vw - 32px));margin:0 auto;padding:28px 0 48px}header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding:22px;border:1px solid var(--line);background:rgba(255,255,255,.86);border-radius:14px;box-shadow:0 18px 60px rgba(31,41,55,.08)}h1{margin:0;font-size:30px}.sub{margin:8px 0 0;color:var(--muted);line-height:1.5;max-width:820px}.actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}button{border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:9px;padding:12px 16px;font-weight:750;font-size:14px;cursor:pointer}button.secondary{background:#fff;color:var(--ink);border-color:var(--line)}button:disabled{opacity:.55;cursor:not-allowed}.banner{margin-top:16px;border-radius:10px;padding:12px 14px;border:1px solid var(--line);background:#fff;color:var(--muted)}.banner.error{border-color:#f1b8b2;color:var(--bad);background:#fff4f2}.banner.ok{border-color:#9fd8cf;color:var(--good);background:#eefbf8}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:18px}.metric{border:1px solid var(--line);background:rgba(255,255,255,.88);border-radius:12px;padding:16px}.metric p{margin:0;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.14em;font-weight:800}.metric strong{display:block;margin-top:10px;font-size:26px}.metric span{display:block;margin-top:8px;color:var(--muted);font-size:13px;line-height:1.45}.summary{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.panel,.post{border:1px solid var(--line);background:rgba(255,255,255,.9);border-radius:12px;padding:18px}.panel h2,.posts h2{margin:0 0 10px;font-size:16px}.panel p{margin:0;color:#334155;line-height:1.6}.posts{margin-top:18px;border:1px solid var(--line);background:rgba(255,255,255,.7);border-radius:14px;overflow:hidden}.posts-head{display:flex;justify-content:space-between;align-items:center;padding:18px;border-bottom:1px solid var(--line)}.post{border:0;border-bottom:1px solid var(--line);border-radius:0;display:grid;grid-template-columns:92px 1fr 320px;gap:18px}.post:last-child{border-bottom:0}.slot{font-weight:900}.bet{color:var(--muted);font-size:12px;margin-top:6px}.text{font-size:17px;line-height:1.65;margin:0}.details{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px;color:#475569;font-size:12px;line-height:1.45}textarea{width:100%;min-height:94px;resize:vertical;border:1px solid var(--line);border-radius:9px;padding:10px;font:inherit;font-size:14px}.empty{padding:36px 18px;color:var(--muted)}@media(max-width:980px){header,.summary{display:block}.actions{justify-content:flex-start;margin-top:16px}.metrics{grid-template-columns:1fr 1fr}.post{grid-template-columns:1fr}}
</style></head><body><main><header><div><h1>Manifest Mental Agent</h1><p class="sub">Standalone local Hermes growth agent. Generate pulls fresh Lensically data once. Regenerate uses cached context and writes rejection memory. Schedule only schedules; it never publishes.</p></div><div class="actions"><button id="generate">Generate 17 Posts</button><button id="schedule" class="secondary">Schedule 17</button><button id="refresh" class="secondary">Refresh</button></div></header><div id="message" class="banner">Starting local agent surface...</div><section id="metrics" class="metrics"></section><section class="summary"><div class="panel"><h2>Strategy</h2><p id="strategy">No run yet.</p></div><div class="panel"><h2>Audience Fatigue</h2><p id="fatigue">No run yet.</p></div></section><section class="posts"><div class="posts-head"><h2>Generated Posts</h2><span id="slate-status">0/17</span></div><div id="posts"><div class="empty">Press Generate to run the agent.</div></div></section></main>
<script>
const state={run:null,active:null,reasons:{}};const fmt=n=>new Intl.NumberFormat('en-US').format(Math.round(Number(n||0)));const pct=n=>(Number(n||0)).toFixed(4)+'%';
function msg(t,type=''){const e=document.getElementById('message');e.textContent=t;e.className='banner '+type}
async function api(p,o={}){const r=await fetch(p,{...o,headers:{'content-type':'application/json',...(o.headers||{})}});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.error||'Request failed');return d}
function metric(l,v,h=''){return '<div class="metric"><p>'+l+'</p><strong>'+v+'</strong><span>'+h+'</span></div>'}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function render(){const run=state.run||{},m=run.metrics||{};document.getElementById('metrics').innerHTML=[metric('Current Followers',fmt(m.current_followers),fmt(m.followers_to_1m)+' away from 1M'),metric('Progress To 1M',pct(m.progress_to_1m_percent),'North-star target'),metric('2x Top Likes',fmt(m.goals?.top_post_likes_2x),'Top likes: '+fmt(m.top_post?.likes)),metric('2x Avg Views',fmt(m.goals?.average_views_2x),'Avg views: '+fmt(m.baselines?.average_views)),metric('2x Avg Likes',fmt(m.goals?.average_likes_2x),'Avg likes: '+fmt(m.baselines?.average_likes)),metric('Archive Seen',fmt(m.baselines?.archive_total_seen),fmt(m.baselines?.recent_sample_size)+' recent sample'),metric('Follower Snapshots',fmt(m.baselines?.follower_snapshots_seen),'Fresh on Generate'),metric('Slate',(run.posts||[]).length+'/17',run.target_date?'Target '+run.target_date:'No target')].join('');document.getElementById('strategy').textContent=run.strategy_summary||'No run yet.';document.getElementById('fatigue').textContent=run.fatigue_summary||'No run yet.';document.getElementById('slate-status').textContent=(run.posts||[]).length+'/17';document.getElementById('schedule').disabled=(run.posts||[]).length!==17||Boolean(state.active);document.getElementById('generate').disabled=Boolean(state.active);const posts=run.posts||[];document.getElementById('posts').innerHTML=posts.length?posts.map(post=>'<article class="post"><div><div class="slot">'+post.slot+'</div><div class="bet">'+esc(post.bet_type||'')+'</div></div><div><p class="text">'+esc(post.text)+'</p><div class="details"><div><b>Objective</b><br>'+esc(post.objective||'')+'</div><div><b>Fatigue</b><br>'+esc(post.fatigue_check||'')+'</div><div><b>Win</b><br>'+esc(post.expected_win_condition||'')+'</div></div></div><div><textarea data-reason="'+post.slot+'" placeholder="Why regenerate this post?">'+esc(state.reasons[post.slot]||'')+'</textarea><button class="secondary regen" data-slot="'+post.slot+'">Regenerate</button></div></article>').join(''):'<div class="empty">Press Generate to run the agent.</div>';document.querySelectorAll('textarea[data-reason]').forEach(el=>el.addEventListener('input',e=>{state.reasons[e.target.dataset.reason]=e.target.value}));document.querySelectorAll('.regen').forEach(btn=>btn.addEventListener('click',()=>regen(btn.dataset.slot)))}
async function refresh(){const d=await api('/status');state.active=d.active_run;state.run=d.latest_run;render();if(state.active)msg('Agent phase: '+state.active.phase);else msg(state.run?'Agent ready. Latest run loaded.':'Agent ready. No run yet.','ok')}
async function generate(){msg('Generating. Hermes is working locally; this can take several minutes.');state.active={phase:'starting'};render();try{const d=await api('/generate',{method:'POST',body:'{}'});state.run=d.run;msg('Generated 17 posts.','ok')}catch(e){msg(e.message,'error')}finally{state.active=null;render()}}
async function regen(slot){const reason=(state.reasons[slot]||'').trim();if(!reason){msg('Give the agent a rejection reason first.','error');return}msg('Regenerating '+slot+' and writing rejection memory.');try{const d=await api('/regen',{method:'POST',body:JSON.stringify({slot,reason})});state.run=d.run;state.reasons[slot]='';msg(d.learned_response||'Regenerated and learned from rejection.','ok')}catch(e){msg(e.message,'error')}finally{render()}}
async function schedule(){msg('Scheduling latest 17-post slate through Lensically.');try{const d=await api('/schedule',{method:'POST',body:'{}'});state.run=d.run;msg('Scheduled latest slate. It did not publish.','ok')}catch(e){msg(e.message,'error')}finally{render()}}
document.getElementById('generate').onclick=generate;document.getElementById('schedule').onclick=schedule;document.getElementById('refresh').onclick=refresh;refresh();
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
    if (url.pathname === "/" && request.method === "GET") return send(response, 200, html(), "text/html; charset=UTF-8");
    if (url.pathname === "/status" && request.method === "GET") return send(response, 200, { ok: true, active_run: activeRun, latest_run: await loadLatestRun() });
    if (url.pathname === "/generate" && request.method === "POST") {
      if (activeRun) return send(response, 409, { error: "Agent is already running.", active_run: activeRun });
      return send(response, 200, { ok: true, run: await generateRun() });
    }
    if (url.pathname === "/regen" && request.method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { ok: true, ...(await regenSlot({ slot: String(body.slot ?? ""), reason: String(body.reason ?? "") })) });
    }
    if (url.pathname === "/schedule" && request.method === "POST") return send(response, 200, { ok: true, run: await scheduleLatestRun() });
    return send(response, 404, { error: "Not found" });
  } catch (error) {
    activeRun = null;
    return send(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

await loadLocalEnv();
await ensureDirs();
createServer((request, response) => void handle(request, response)).listen(PORT, "127.0.0.1", () => {
  console.log(`Manifest Mental Agent desktop app running at http://127.0.0.1:${PORT}`);
});
