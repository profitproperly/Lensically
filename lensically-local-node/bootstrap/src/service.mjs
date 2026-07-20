#!/usr/bin/env node
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const BOOTSTRAP_VERSION = "lensically-local-bootstrap-v1";
const root = process.env.LENSICALLY_LOCAL_NODE_ROOT || "C:\\ProgramData\\Lensically\\LocalExecutionNode";
const configPath = join(root, "config.json");
const statePath = join(root, "state.json");
const logPath = join(root, "logs", "bootstrap.log");

const allowedJobTypes = new Set([
  "node_status",
  "validate_sha",
  "run_typecheck",
  "run_focused_tests",
  "run_full_validation",
  "build_worker",
  "deploy_validated_sha",
  "collect_diagnostics",
  "update_worker",
  "cancel_job",
]);

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function saveJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function redact(value) {
  return String(value || "").replace(/[A-Za-z0-9_./+=-]{32,}/g, "[redacted]");
}

function log(event, details = {}) {
  mkdirSync(join(root, "logs"), { recursive: true });
  appendFileSync(logPath, `${JSON.stringify({ ts: new Date().toISOString(), event, ...JSON.parse(redact(JSON.stringify(details))) })}\n`);
}

async function ensureEnrolled(config) {
  if (config.enrolled_at) return config;
  if (!config.enrollment_token || !config.device_credential) throw new Error("node_not_enrolled");
  const enrollment = await postJson(`${config.lensically_origin}/api/operator/local-node/enroll`, {
    node_id: config.node_id,
    enrollment_token: config.enrollment_token,
    device_credential: config.device_credential,
    bootstrap_version: BOOTSTRAP_VERSION,
  }, config, { enrollment: true });
  if (!enrollment?.ok) throw new Error(enrollment?.error || "enrollment_failed");
  const updated = { ...config, enrolled_at: enrollment.enrolled_at, enrollment_token: undefined };
  saveJson(configPath, updated);
  log("enrolled", { node_id: config.node_id });
  return updated;
}

async function verifyJob(job, config) {
  if (!job || typeof job !== "object") return { ok: false, error: "job_required" };
  if (!allowedJobTypes.has(job.job_type)) return { ok: false, error: "unknown_job_type" };
  if (job.node_id !== config.node_id) return { ok: false, error: "wrong_node" };
  if (!/^[a-f0-9]{40}$/i.test(job.commit_sha || "")) return { ok: false, error: "exact_sha_required" };
  if (Date.parse(job.expires_at || "") <= Date.now()) return { ok: false, error: "expired_job" };
  const seen = new Set(loadJson(join(root, "nonces.json"), []));
  if (seen.has(job.nonce)) return { ok: false, error: "reused_nonce" };
  const serverVerification = await postJson(`${config.lensically_origin}/api/operator/local-node/verify-job`, { job }, config);
  if (!serverVerification?.ok) return { ok: false, error: serverVerification?.error || "invalid_signature" };
  seen.add(job.nonce);
  saveJson(join(root, "nonces.json"), Array.from(seen).slice(-1000));
  return { ok: true };
}

async function postJson(url, body, config, options = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-lensically-node-id": config.node_id,
      ...(options.enrollment ? {} : { "x-lensically-node-credential": config.device_credential }),
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({ ok: false, error: "invalid_json_response", status: response.status }));
  if (!response.ok) log("request_failed", { url, status: response.status, error: json?.error });
  return json;
}

function runWorker(job, config, state) {
  const activeSlot = state.active_slot || "active";
  const workerPath = join(root, "workers", activeSlot, "worker.mjs");
  const result = spawnSync(process.execPath, [workerPath, JSON.stringify(job)], {
    cwd: config.repository_path || process.cwd(),
    encoding: "utf8",
    timeout: Math.max(1, Number(job.max_runtime_ms || 600000)),
  });
  const stdout = String(result.stdout || "");
  const parsed = (() => {
    try { return JSON.parse(stdout); } catch { return null; }
  })();
  return {
    status: result.status === 0 ? "completed" : "failed",
    exit_code: result.status,
    stdout: stdout.slice(-20000),
    stderr: String(result.stderr || "").replace(/[A-Za-z0-9_=-]{32,}/g, "[redacted]").slice(-20000),
    ...(parsed?.evidence ? { evidence: parsed.evidence } : {}),
  };
}

async function tick() {
  let config = loadJson(configPath, null);
  if (!config?.lensically_origin || !config?.node_id || !config?.device_credential) throw new Error("node_not_configured");
  config = await ensureEnrolled(config);
  const state = loadJson(statePath, { active_slot: "active", previous_slot: "previous" });
  const heartbeat = await postJson(`${config.lensically_origin}/api/operator/local-node/heartbeat`, {
    bootstrap_version: BOOTSTRAP_VERSION,
    worker_version: state.worker_version || null,
    active_slot: state.active_slot || "active",
    healthy: true,
  }, config);
  if (heartbeat?.ok) log("heartbeat", { node_id: config.node_id, heartbeat_at: heartbeat.heartbeat_at });
  const poll = await postJson(`${config.lensically_origin}/api/operator/local-node/poll`, {
    bootstrap_version: BOOTSTRAP_VERSION,
    worker_version: state.worker_version || null,
  }, config);
  if (!poll?.job) return;
  log("job_claimed", { job_id: poll.job.job_id, job_type: poll.job.job_type, commit_sha: poll.job.commit_sha });
  const verified = await verifyJob(poll.job, config);
  if (!verified.ok) {
    await postJson(`${config.lensically_origin}/api/operator/local-node/result`, { job_id: poll.job.job_id, status: "failed", error: verified.error }, config);
    return;
  }
  const result = runWorker(poll.job, config, state);
  await postJson(`${config.lensically_origin}/api/operator/local-node/result`, { job_id: poll.job.job_id, ...result }, config);
  log("job_result", { job_id: poll.job.job_id, status: result.status, exit_code: result.exit_code });
}

if (process.argv.includes("--once")) {
  tick().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
} else {
  tick().catch((error) => log("tick_failed", { error: error.message }));
  setInterval(() => tick().catch((error) => log("tick_failed", { error: error.message })), Number(process.env.LENSICALLY_POLL_INTERVAL_MS || 15000));
}
