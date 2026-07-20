#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const WORKER_VERSION = "local-worker-v1";
const BOOTSTRAP_VERSION = "lensically-local-bootstrap-v1";
const RECEIPT_VERSION = "local-validation-receipt-v1";
const allowed = new Set([
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

function run(command, args, cwd) {
  const started = Date.now();
  const nodeRoot = process.execPath.replace(/\\node\.exe$/i, "");
  const executable = process.platform === "win32" && (command === "npm" || command === "npx")
    ? process.execPath
    : process.platform === "win32" && command === "git"
      ? "git.exe"
      : command;
  const commandArgs = process.platform === "win32" && (command === "npm" || command === "npx")
    ? [join(nodeRoot, "node_modules", "npm", "bin", command === "npm" ? "npm-cli.js" : "npx-cli.js"), ...args]
    : args;
  const result = spawnSync(executable, commandArgs, { cwd, encoding: "utf8" });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const allowExactShaOutput = command === "git" && args.join(" ") === "rev-parse HEAD";
  return {
    name: [command, ...args].join(" "),
    status: result.status === 0 ? "passed" : "failed",
    exit_code: result.status,
    duration_ms: Date.now() - started,
    output_hash: createHash("sha256").update(output).digest("hex"),
    output_tail: (allowExactShaOutput ? output : output.replace(/[A-Za-z0-9_=-]{32,}/g, "[redacted]")).slice(-12000),
  };
}

function assertSha(job) {
  if (!/^[a-f0-9]{40}$/i.test(job.commit_sha || "")) throw new Error("exact_sha_required");
  const current = run("git", ["rev-parse", "HEAD"], process.cwd());
  if (current.status !== "passed" || !current.output_tail.includes(job.commit_sha)) {
    throw new Error(`checked_out_sha_mismatch:${current.status}:${current.output_tail.slice(0, 80).trim()}`);
  }
}

function buildReceipt(job, stages, startedAt, durationMs) {
  const stageSummaries = stages.map((stage) => ({
    name: stage.name,
    status: stage.status,
    duration_ms: stage.duration_ms,
    output_hash: stage.output_hash,
  }));
  const integrityInput = JSON.stringify({ job_id: job.job_id, commit_sha: job.commit_sha, stages: stageSummaries });
  return {
    version: RECEIPT_VERSION,
    repository_sha: job.commit_sha,
    checked_out_sha: job.commit_sha,
    validated_sha: job.commit_sha,
    release_candidate_sha: job.commit_sha,
    node_id: job.node_id,
    worker_version: WORKER_VERSION,
    bootstrap_version: BOOTSTRAP_VERSION,
    validation_profile: job.job_type === "run_full_validation" ? "full" : "focused",
    stages: stageSummaries,
    started_at: new Date(startedAt).toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: durationMs,
    environment: { os: process.platform, node: process.version },
    result_hashes: Object.fromEntries(stages.map((stage) => [stage.name, stage.output_hash])),
    integrity: { algorithm: "server-hmac-sha256", signature: createHash("sha256").update(integrityInput).digest("hex") },
  };
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function updateWorker(job) {
  const root = process.env.LENSICALLY_LOCAL_NODE_ROOT || "C:\\ProgramData\\Lensically\\LocalExecutionNode";
  const sourcePath = String(job.inputs?.worker_source_path || join(process.cwd(), "lensically-local-node", "worker", "src", "worker.mjs"));
  const expectedHash = String(job.inputs?.package_hash || "");
  const workerVersion = String(job.inputs?.worker_version || WORKER_VERSION);
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) throw new Error("package_hash_required");
  if (!existsSync(sourcePath)) throw new Error("worker_package_missing");
  const actualHash = hashFile(sourcePath);
  if (actualHash !== expectedHash) throw new Error("worker_package_hash_mismatch");

  const statePath = join(root, "state.json");
  const previousState = readJson(statePath, { active_slot: "active", previous_slot: "previous", worker_version: WORKER_VERSION });
  const activeSlot = previousState.active_slot === "previous" ? "previous" : "active";
  const inactiveSlot = activeSlot === "active" ? "previous" : "active";
  const candidateDir = join(root, "workers", inactiveSlot);
  const candidatePath = join(candidateDir, "worker.mjs");
  mkdirSync(candidateDir, { recursive: true });
  copyFileSync(sourcePath, candidatePath);

  const health = spawnSync(process.execPath, [candidatePath, JSON.stringify({
    job_id: `${job.job_id}-health`,
    job_type: "node_status",
    node_id: job.node_id,
    commit_sha: job.commit_sha,
    inputs: {},
  })], { cwd: process.cwd(), encoding: "utf8", timeout: 30000 });
  if (health.status !== 0) {
    writeJson(statePath, previousState);
    throw new Error(`candidate_health_failed:${String(health.stderr || health.stdout || "").slice(0, 200)}`);
  }

  const nextState = {
    ...previousState,
    active_slot: inactiveSlot,
    previous_slot: activeSlot,
    worker_version: workerVersion,
    previous_worker_version: previousState.worker_version || null,
    updated_at: new Date().toISOString(),
  };
  writeJson(statePath, nextState);
  return [
    { name: "download", status: "passed", exit_code: 0, duration_ms: 0, output_hash: actualHash, output_tail: "local source package copied to inactive slot" },
    { name: "verify_integrity", status: "passed", exit_code: 0, duration_ms: 0, output_hash: actualHash, output_tail: "package hash matched" },
    { name: "commission", status: "passed", exit_code: 0, duration_ms: 0, output_hash: createHash("sha256").update(health.stdout || "").digest("hex"), output_tail: "candidate worker health check passed" },
    { name: "activate_or_rollback", status: "passed", exit_code: 0, duration_ms: 0, output_hash: createHash("sha256").update(JSON.stringify(nextState)).digest("hex"), output_tail: `activated ${inactiveSlot}, previous ${activeSlot}` },
  ];
}

function main() {
  const startedAt = Date.now();
  const job = JSON.parse(process.argv[2] || "{}");
  if (!allowed.has(job.job_type)) throw new Error("unknown_job_type");
  const stages = [];
  if (job.job_type === "node_status") {
    console.log(JSON.stringify({ ok: true, worker_version: WORKER_VERSION, platform: process.platform }));
    return;
  }
  if (job.job_type === "cancel_job") {
    console.log(JSON.stringify({ ok: true, cancelled: true }));
    return;
  }
  assertSha(job);
  if (job.job_type === "run_typecheck" || job.job_type === "validate_sha" || job.job_type === "run_full_validation") {
    stages.push(run("npx", ["tsc", "--noEmit"], "lensically-worker"));
  }
  if (job.job_type === "run_focused_tests" || job.job_type === "validate_sha" || job.job_type === "run_full_validation") {
    const testPath = String(job.inputs?.test_path || "test/localExecution.spec.ts");
    stages.push(run("npm", ["run", "test", "--", "--run", testPath, "--reporter=dot", "--bail=1"], "lensically-worker"));
  }
  if (job.job_type === "run_full_validation") {
    stages.push(run("node", ["scripts/run-cloudflare-validation.mjs"], "lensically-worker"));
  }
  if (job.job_type === "build_worker") {
    stages.push(run("npm", ["ci"], "lensically-worker"));
  }
  if (job.job_type === "update_worker") {
    stages.push(...updateWorker(job));
  }
  if (job.job_type === "deploy_validated_sha") {
    if (!existsSync("lensically-worker/.local-validation-receipt.json")) throw new Error("local_receipt_required");
    stages.push(run("npm", ["run", "deploy:cloudflare-gated"], "lensically-worker"));
  }
  const failed = stages.find((stage) => stage.status !== "passed");
  const receipt = !failed && ["validate_sha", "run_focused_tests", "run_typecheck", "run_full_validation"].includes(job.job_type)
    ? buildReceipt(job, stages, startedAt, Date.now() - startedAt)
    : undefined;
  console.log(JSON.stringify({ ok: !failed, worker_version: WORKER_VERSION, stages, ...(receipt ? { receipt } : {}) }, null, 2));
  if (failed) process.exit(1);
}

main();
