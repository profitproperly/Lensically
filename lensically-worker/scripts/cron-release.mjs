import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = resolve(fileURLToPath(new URL(".", import.meta.url)));
export const WORKER_ROOT = resolve(SCRIPT_DIRECTORY, "..");
export const DEFAULT_CONFIG_PATH = resolve(WORKER_ROOT, "wrangler.jsonc");
const CONTRACT_VERSION = "lensically-cron-release-v1";

function fail(code, detail = "") {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function stripJsonComments(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
        output += character;
      } else {
        output += " ";
      }
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        output += "  ";
        blockComment = false;
        index += 1;
      } else {
        output += character === "\n" ? "\n" : " ";
      }
      continue;
    }
    if (inString) {
      output += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      output += character;
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      output += "  ";
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      output += "  ";
      index += 1;
      continue;
    }
    output += character;
  }
  if (inString || blockComment) fail("cron_config_unterminated_jsonc");
  return output;
}

export function parseJsonc(source) {
  const withoutComments = stripJsonComments(source);
  const withoutTrailingCommas = withoutComments.replace(/,\s*([}\]])/g, "$1");
  try {
    return JSON.parse(withoutTrailingCommas);
  } catch (error) {
    fail("cron_config_json_invalid", error instanceof Error ? error.message : String(error));
  }
}

function normalizeCrons(values, source) {
  if (!Array.isArray(values)) fail("cron_schedule_list_missing", source);
  const normalized = values.map((value) => {
    if (typeof value !== "string" || value.trim().length === 0) fail("cron_schedule_invalid", source);
    const cron = value.trim();
    if (cron.length > 120 || /[\r\n]/.test(cron)) fail("cron_schedule_invalid", cron);
    return cron;
  });
  if (new Set(normalized).size !== normalized.length) fail("cron_schedule_duplicate", source);
  return [...normalized].sort();
}

export function extractCronContract(config, source = "wrangler.jsonc") {
  if (!config || typeof config !== "object" || Array.isArray(config)) fail("cron_config_not_object", source);
  if (typeof config.name !== "string" || config.name.trim().length === 0) fail("cron_worker_name_missing", source);
  const crons = normalizeCrons(config.triggers?.crons, source);
  return {
    version: CONTRACT_VERSION,
    workerName: config.name.trim(),
    crons,
  };
}

export function loadCronContract(configPath = DEFAULT_CONFIG_PATH) {
  const absolute = resolve(configPath);
  return extractCronContract(parseJsonc(readFileSync(absolute, "utf8")), absolute);
}

export function buildTriggerNeutralConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) fail("cron_config_not_object");
  const clone = structuredClone(config);
  delete clone.triggers;
  return clone;
}

export function writeTriggerNeutralConfig(inputPath, outputPath) {
  const input = resolve(inputPath);
  const output = resolve(outputPath);
  if (dirname(input) !== dirname(output)) fail("cron_deploy_config_directory_mismatch");
  const parsed = parseJsonc(readFileSync(input, "utf8"));
  extractCronContract(parsed, input);
  const neutral = buildTriggerNeutralConfig(parsed);
  if (Object.prototype.hasOwnProperty.call(neutral, "triggers")) fail("cron_deploy_config_still_has_triggers");
  writeFileSync(output, `${JSON.stringify(neutral, null, 2)}\n`);
  return { output, workerName: neutral.name, triggerNeutral: true };
}

export function schedulesEqual(left, right) {
  return JSON.stringify(normalizeCrons(left, "left")) === JSON.stringify(normalizeCrons(right, "right"));
}

function extractRemoteCrons(payload) {
  if (!payload || payload.success !== true || !Array.isArray(payload.result?.schedules)) {
    fail("cron_remote_response_invalid");
  }
  return normalizeCrons(payload.result.schedules.map((schedule) => schedule?.cron), "remote");
}

async function cloudflareRequest({ fetchImpl, url, token, method = "GET", body }) {
  const response = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    fail("cron_remote_json_invalid", `${response.status}:${text.slice(0, 500)}`);
  }
  if (!response.ok || payload.success !== true) {
    fail("cron_remote_request_failed", JSON.stringify({ status: response.status, errors: payload.errors ?? [] }));
  }
  return payload;
}

export async function reconcileCronSchedules({ contract, accountId, token, fetchImpl = fetch }) {
  if (!accountId || !token) fail("cron_remote_access_missing");
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(contract.workerName)}/schedules`;
  const beforePayload = await cloudflareRequest({ fetchImpl, url, token });
  const before = extractRemoteCrons(beforePayload);
  if (schedulesEqual(before, contract.crons)) {
    return { version: CONTRACT_VERSION, action: "unchanged", workerName: contract.workerName, crons: contract.crons };
  }
  await cloudflareRequest({
    fetchImpl,
    url,
    token,
    method: "PUT",
    body: contract.crons.map((cron) => ({ cron })),
  });
  const afterPayload = await cloudflareRequest({ fetchImpl, url, token });
  const after = extractRemoteCrons(afterPayload);
  if (!schedulesEqual(after, contract.crons)) {
    fail("cron_remote_verification_mismatch", JSON.stringify({ expected: contract.crons, actual: after }));
  }
  return { version: CONTRACT_VERSION, action: "updated", workerName: contract.workerName, before, crons: after };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) fail("cron_argument_invalid", token);
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configPath = resolve(String(args.config ?? DEFAULT_CONFIG_PATH));
  const contract = loadCronContract(configPath);
  if (args.check) {
    const neutral = buildTriggerNeutralConfig(parseJsonc(readFileSync(configPath, "utf8")));
    if (Object.prototype.hasOwnProperty.call(neutral, "triggers")) fail("cron_deploy_config_still_has_triggers");
    process.stdout.write(`${JSON.stringify({ checked: true, contract, triggerNeutralDeploy: true })}\n`);
    return;
  }
  if (args["write-deploy-config"]) {
    if (!args.output) fail("cron_deploy_config_output_missing");
    const receipt = writeTriggerNeutralConfig(configPath, String(args.output));
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
    return;
  }
  if (args["reconcile-remote"]) {
    const receipt = await reconcileCronSchedules({
      contract,
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
    });
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
    return;
  }
  fail("cron_release_mode_required");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
