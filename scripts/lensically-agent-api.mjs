import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_ENV_PATH = path.join(ROOT, ".lensically-agent.env");
const VAULT_CONTEXT_DIR = path.join(ROOT, "manifest-mental-vault", "Context");
const DEFAULT_BASE_URL = "https://api.lensically.com";
const DEFAULT_ACCOUNT_ID = "manifest-mental";
const DEFAULT_TIMEZONE = "America/New_York";

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      args._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
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
    throw new Error("Missing LENSICALLY_INTERNAL_API_KEY. Run npm run agent:configure-lensically-api first.");
  }
  return key;
}

function buildUrl(route, params = {}) {
  const baseUrl = process.env.LENSICALLY_API_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const url = new URL(route, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim()) {
      url.searchParams.set(key, String(value).trim());
    }
  }
  return url;
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

function todayStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function commandContext(args) {
  const internalKey = requireInternalKey();
  const accountId = args.account || DEFAULT_ACCOUNT_ID;
  const timezone = args.timezone || DEFAULT_TIMEZONE;
  const url = buildUrl("/internal/automation/context", {
    account_id: accountId,
    timezone,
    date: args.date,
  });

  const data = await fetchJson(url, {
    headers: { "x-internal-key": internalKey },
  });

  const latestPath = path.join(VAULT_CONTEXT_DIR, "latest-context.json");
  const snapshotPath = path.join(VAULT_CONTEXT_DIR, `context-${todayStamp()}.json`);
  await writeJson(latestPath, data);
  await writeJson(snapshotPath, data);

  console.log(JSON.stringify({
    success: true,
    command: "context",
    account: data.account,
    date: data.date,
    timezone: data.timezone,
    missing_slots: data.missing_slots,
    archive_summary: data.archive_summary,
    latest_context_path: latestPath,
    snapshot_context_path: snapshotPath,
  }, null, 2));
}

async function commandSchedulePlan(args) {
  const internalKey = requireInternalKey();
  const planFile = args.file;
  if (!planFile) {
    throw new Error("schedule-plan requires --file <path-to-plan-json>.");
  }

  const raw = await fs.readFile(path.resolve(planFile), "utf8");
  const payload = JSON.parse(raw);
  const url = buildUrl("/internal/automation/schedule-plan");
  const data = await fetchJson(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-key": internalKey,
    },
    body: JSON.stringify(payload),
  });

  console.log(JSON.stringify({
    success: true,
    command: "schedule-plan",
    response: data,
  }, null, 2));
}

async function main() {
  await loadLocalEnv();
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (command === "context") {
    await commandContext(args);
    return;
  }
  if (command === "schedule-plan") {
    await commandSchedulePlan(args);
    return;
  }

  throw new Error("Usage: node scripts/lensically-agent-api.mjs <context|schedule-plan> [--file plan.json]");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
