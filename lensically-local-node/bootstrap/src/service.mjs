#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const BOOTSTRAP_VERSION = "lensically-local-bootstrap-v1";
const root = process.env.LENSICALLY_LOCAL_NODE_ROOT || "C:\\ProgramData\\Lensically\\LocalExecutionNode";
const configPath = join(root, "config.json");
const statePath = join(root, "state.json");

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

async function postJson(url, body, config) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-lensically-node-id": config.node_id,
      "x-lensically-node-secret": config.device_secret,
    },
    body: JSON.stringify(body),
  });
  return response.json().catch(() => ({ ok: false, error: "invalid_json_response", status: response.status }));
}

function runWorker(job, config, state) {
  const activeSlot = state.active_slot || "active";
  const workerPath = join(root, "workers", activeSlot, "worker.mjs");
  const result = spawnSync(process.execPath, [workerPath, JSON.stringify(job)], {
    cwd: config.repository_path || process.cwd(),
    encoding: "utf8",
    timeout: Math.max(1, Number(job.max_runtime_ms || 600000)),
  });
  return {
    status: result.status === 0 ? "completed" : "failed",
    exit_code: result.status,
    stdout: String(result.stdout || "").slice(-20000),
    stderr: String(result.stderr || "").replace(/[A-Za-z0-9_=-]{32,}/g, "[redacted]").slice(-20000),
  };
}

async function tick() {
  const config = loadJson(configPath, null);
  if (!config?.lensically_origin || !config?.node_id || !config?.device_secret) throw new Error("node_not_paired");
  const state = loadJson(statePath, { active_slot: "active", previous_slot: "previous" });
  await postJson(`${config.lensically_origin}/api/operator/local-node/heartbeat`, {
    bootstrap_version: BOOTSTRAP_VERSION,
    worker_version: state.worker_version || null,
    active_slot: state.active_slot || "active",
    healthy: true,
  }, config);
  const poll = await postJson(`${config.lensically_origin}/api/operator/local-node/poll`, {
    bootstrap_version: BOOTSTRAP_VERSION,
    worker_version: state.worker_version || null,
  }, config);
  if (!poll?.job) return;
  const verified = await verifyJob(poll.job, config);
  if (!verified.ok) {
    await postJson(`${config.lensically_origin}/api/operator/local-node/result`, { job_id: poll.job.job_id, status: "failed", error: verified.error }, config);
    return;
  }
  const result = runWorker(poll.job, config, state);
  await postJson(`${config.lensically_origin}/api/operator/local-node/result`, { job_id: poll.job.job_id, ...result }, config);
}

if (process.argv.includes("--once")) {
  tick().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
} else {
  setInterval(() => tick().catch((error) => console.error(`[bootstrap] ${error.message}`)), Number(process.env.LENSICALLY_POLL_INTERVAL_MS || 15000));
}
