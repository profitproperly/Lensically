import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATABASE_NAME = "lensically-db";
const CONFIG_PATH = "wrangler.jsonc";
const ACTIVE_STATUSES = new Set(["prepared", "partially_committed"]);

function fail(code, detail = "") {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function commandName(name) {
  return process.platform === "win32" && name === "npx" ? "npx.cmd" : name;
}

function run(command, args) {
  try {
    return execFileSync(commandName(command), args, {
      cwd: WORKER_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    }).trim();
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout).trim() : "";
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    fail("active_cycle_guard_command_failed", JSON.stringify({ command, args, stdout, stderr }));
  }
}

function extractResultObjects(value) {
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (Array.isArray(node.results)) found.push(...node.results);
    for (const child of Object.values(node)) visit(child);
  };
  visit(value);
  return found.filter((row) => row && typeof row === "object" && !Array.isArray(row));
}

function parseWranglerJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    const first = stdout.indexOf("[");
    const last = stdout.lastIndexOf("]");
    if (first < 0 || last <= first) fail("active_cycle_guard_wrangler_json_invalid");
    return JSON.parse(stdout.slice(first, last + 1));
  }
}

function d1Rows(sql) {
  const stdout = run("npx", [
    "wrangler", "d1", "execute", DATABASE_NAME,
    "--remote", "--config", CONFIG_PATH, "--json", "--command", sql,
  ]);
  return extractResultObjects(parseWranglerJson(stdout));
}

function requireRemoteAccess() {
  const missing = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"].filter((name) => !process.env[name]);
  if (missing.length) fail("active_cycle_guard_remote_access_missing", missing.join(","));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

export function localHourKey(date, timezone) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) fail("active_cycle_guard_now_invalid");
  if (typeof timezone !== "string" || !timezone.trim()) fail("active_cycle_guard_timezone_missing");
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
  } catch {
    fail("active_cycle_guard_timezone_invalid", timezone);
  }
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!value.year || !value.month || !value.day || value.hour === undefined) {
    fail("active_cycle_guard_local_time_unavailable", timezone);
  }
  return `${value.year}-${pad(value.month)}-${pad(value.day)}T${pad(value.hour)}:00`;
}

export function classifyActiveContentCycles(rows, now = new Date()) {
  if (!Array.isArray(rows)) fail("active_cycle_guard_rows_invalid");
  const active = [];
  const historical = [];
  for (const row of rows) {
    const cycleId = String(row?.cycle_id ?? "").trim();
    const status = String(row?.status ?? "").trim();
    const timezone = String(row?.timezone ?? "").trim();
    const horizonEnd = String(row?.horizon_end_local ?? "").trim();
    if (!cycleId || !ACTIVE_STATUSES.has(status) || !timezone || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(horizonEnd)) {
      fail("active_cycle_guard_candidate_invalid", JSON.stringify({ cycle_id: cycleId, status, timezone, horizon_end_local: horizonEnd }));
    }
    const nowLocal = localHourKey(now, timezone);
    const normalizedHorizonEnd = `${horizonEnd.slice(0, 13)}:00`;
    const classified = { ...row, now_local_hour: nowLocal };
    if (normalizedHorizonEnd >= nowLocal) active.push(classified);
    else historical.push(classified);
  }
  return { active, historical };
}

export function assertNoActiveContentCycles(rows, now = new Date()) {
  const { active, historical } = classifyActiveContentCycles(rows, now);
  if (active.length) {
    const latest = [...active].sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))[0] ?? null;
    fail("active_main_content_cycle_deploy_forbidden", JSON.stringify({
      active_cycle_count: active.length,
      latest_active_cycle_id: latest?.cycle_id ?? null,
      latest_active_cycle_status: latest?.status ?? null,
      latest_active_cycle_horizon_end_local: latest?.horizon_end_local ?? null,
      latest_active_cycle_timezone: latest?.timezone ?? null,
      latest_active_cycle_updated_at: latest?.updated_at ?? null,
      historical_active_status_rows_ignored: historical.length,
    }));
  }
  return {
    active_cycle_count: 0,
    historical_active_status_rows_ignored: historical.length,
  };
}

export function readManifestCycleCandidates() {
  requireRemoteAccess();
  return d1Rows(`SELECT id AS cycle_id, status, timezone, horizon_end_local, updated_at FROM operator_autonomous_growth_cycles WHERE brand_key = 'manifest_mental' AND status IN ('prepared','partially_committed') ORDER BY datetime(updated_at) DESC, id DESC`);
}

async function main() {
  const rows = readManifestCycleCandidates();
  const result = assertNoActiveContentCycles(rows, new Date());
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
