#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_VERSION = "local-worker-v1";
const BOOTSTRAP_VERSION = "lensically-local-bootstrap-v1";
const installedWorkerRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
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

function redactOutput(output) {
  return String(output || "").replace(/[A-Za-z0-9_./+=-]{32,}/g, "[redacted]");
}

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
    output_tail: (allowExactShaOutput ? output : redactOutput(output)).slice(-12000),
  };
}

function assertCleanJobPath(path) {
  if (!path || /[<>:"|?*]/.test(path)) throw new Error("invalid_job_path");
}

function git(commandArgs, cwd) {
  return run("git", commandArgs, cwd);
}

function acquireExactSource(job) {
  if (!/^[a-f0-9]{40}$/i.test(job.commit_sha || "")) throw new Error("exact_sha_required");
  const root = process.env.LENSICALLY_LOCAL_NODE_ROOT || installedWorkerRoot;
  const sourceRoot = join(root, "source");
  const cacheDir = join(sourceRoot, "repo-cache.git");
  const jobsDir = join(sourceRoot, "jobs");
  const jobSafeId = createHash("sha256").update(String(job.job_id || "")).digest("hex").slice(0, 12);
  assertCleanJobPath(jobSafeId);
  const worktreeDir = join(jobsDir, `${jobSafeId}-${String(job.commit_sha).slice(0, 12)}`);
  mkdirSync(sourceRoot, { recursive: true });
  mkdirSync(jobsDir, { recursive: true });
  if (existsSync(worktreeDir)) rmSync(worktreeDir, { recursive: true, force: true });

  const configuredRepo = String(job.inputs?.repository_path || process.env.LENSICALLY_LOCAL_REPOSITORY_PATH || process.cwd());
  const remoteUrl = String(job.inputs?.repository_url || "").trim();
  if (!existsSync(cacheDir)) {
    const source = remoteUrl || configuredRepo;
    const clone = git(["clone", "--bare", source, cacheDir], sourceRoot);
    if (clone.status !== "passed") throw new Error(`source_clone_failed:${clone.output_tail.slice(0, 200)}`);
  }
  const configAutocrlf = git(["config", "core.autocrlf", "false"], cacheDir);
  if (configAutocrlf.status !== "passed") throw new Error("source_config_failed");

  const fetchArgs = remoteUrl
    ? ["fetch", "--force", "--prune", remoteUrl, job.commit_sha]
    : ["fetch", "--force", "--prune", "origin", job.commit_sha];
  const fetched = git(fetchArgs, cacheDir);
  if (fetched.status !== "passed") throw new Error(`source_fetch_failed:${fetched.output_tail.slice(0, 200)}`);
  const exists = git(["cat-file", "-e", `${job.commit_sha}^{commit}`], cacheDir);
  if (exists.status !== "passed") throw new Error("requested_commit_unavailable");
  git(["worktree", "prune"], cacheDir);
  const add = git(["-c", "core.autocrlf=false", "worktree", "add", "--detach", worktreeDir, job.commit_sha], cacheDir);
  if (add.status !== "passed") throw new Error(`source_worktree_failed:${add.output_tail.slice(0, 200)}`);
  const head = git(["rev-parse", "HEAD"], worktreeDir);
  if (head.status !== "passed" || !head.output_tail.includes(job.commit_sha)) {
    rmSync(worktreeDir, { recursive: true, force: true });
    throw new Error("isolated_head_mismatch");
  }
  return { worktreeDir, cleanup: job.inputs?.retain_worktree === true ? "retain" : "remove" };
}

function buildEvidence(job, source, stages, startedAt, durationMs) {
  return {
    evidence_version: "local-stage-evidence-v1",
    job_id: job.job_id,
    repository_sha: job.commit_sha,
    checked_out_sha: job.commit_sha,
    validated_sha: job.commit_sha,
    release_candidate_sha: job.commit_sha,
    node_id: job.node_id,
    worker_version: WORKER_VERSION,
    bootstrap_version: BOOTSTRAP_VERSION,
    validation_profile: job.job_type === "run_full_validation" ? "full" : "focused",
    isolated_worktree: source.worktreeDir,
    started_at: new Date(startedAt).toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: durationMs,
    environment: { os: process.platform, node: process.version },
    stages: stages.map((stage) => ({
    name: stage.name,
    status: stage.status,
    duration_ms: stage.duration_ms,
    output_hash: stage.output_hash,
    })),
    result_hashes: Object.fromEntries(stages.map((stage) => [stage.name, stage.output_hash])),
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

function ensureWorkerTestEnv(stageRoot) {
  const envPath = join(stageRoot, "lensically-worker", ".dev.vars");
  if (existsSync(envPath)) return;
  writeFileSync(envPath, [
    "LENSICALLY_GPT_API_KEY=test-gpt-key",
    "LENSICALLY_MCP_ACCESS_TOKEN=test-mcp-token",
    "LENSICALLY_MCP_OAUTH_CLIENT_SECRET=test-oauth-secret",
    "INTERNAL_API_KEY=test-internal-key",
    "",
  ].join("\n"));
}

function updateWorker(job) {
  const root = process.env.LENSICALLY_LOCAL_NODE_ROOT || installedWorkerRoot;
  const packageSha = String(job.inputs?.package_sha || job.commit_sha || "");
  if (!/^[a-f0-9]{40}$/i.test(packageSha)) throw new Error("exact_package_sha_required");
  const source = acquireExactSource({ ...job, commit_sha: packageSha });
  const sourcePath = join(source.worktreeDir, "lensically-local-node", "worker", "src", "worker.mjs");
  const expectedHash = String(job.inputs?.package_hash || "");
  const workerVersion = String(job.inputs?.worker_version || WORKER_VERSION);
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) throw new Error("package_hash_required");
  try {
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
    })], { cwd: source.worktreeDir, encoding: "utf8", timeout: 30000 });
    if (health.status !== 0) {
      writeJson(statePath, previousState);
      throw new Error(`candidate_health_failed:${redactOutput(health.stderr || health.stdout).slice(0, 200)}`);
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
      { name: "download", status: "passed", exit_code: 0, duration_ms: 0, output_hash: actualHash, output_tail: "node-controlled package acquired from exact SHA" },
      { name: "verify_integrity", status: "passed", exit_code: 0, duration_ms: 0, output_hash: actualHash, output_tail: "package hash matched" },
      { name: "commission", status: "passed", exit_code: 0, duration_ms: 0, output_hash: createHash("sha256").update(health.stdout || "").digest("hex"), output_tail: "candidate worker health check passed" },
      { name: "activate_or_rollback", status: "passed", exit_code: 0, duration_ms: 0, output_hash: createHash("sha256").update(JSON.stringify(nextState)).digest("hex"), output_tail: `activated ${inactiveSlot}, previous ${activeSlot}` },
    ];
  } finally {
    if (source.cleanup === "remove") rmSync(source.worktreeDir, { recursive: true, force: true });
  }
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
  const source = ["validate_sha", "run_typecheck", "run_focused_tests", "run_full_validation", "build_worker", "deploy_validated_sha"].includes(job.job_type)
    ? acquireExactSource(job)
    : null;
  const stageRoot = source?.worktreeDir || process.cwd();
  if (source && ["validate_sha", "run_typecheck", "run_focused_tests", "run_full_validation", "build_worker"].includes(job.job_type)) {
    stages.push(run("npm", ["ci"], join(stageRoot, "lensically-worker")));
  }
  if (job.job_type === "run_typecheck" || job.job_type === "validate_sha" || job.job_type === "run_full_validation") {
    stages.push(run("npx", ["tsc", "--noEmit"], join(stageRoot, "lensically-worker")));
  }
  if (job.job_type === "run_focused_tests" || job.job_type === "validate_sha" || job.job_type === "run_full_validation") {
    ensureWorkerTestEnv(stageRoot);
    const testPath = String(job.inputs?.test_path || "test/localExecution.spec.ts");
    stages.push(run("npm", ["run", "test", "--", "--run", testPath, "--reporter=dot", "--bail=1"], join(stageRoot, "lensically-worker")));
  }
  if (job.job_type === "run_full_validation") {
    stages.push(run("node", ["scripts/run-cloudflare-validation.mjs"], join(stageRoot, "lensically-worker")));
  }
  if (job.job_type === "build_worker") {
    stages.push(run("npm", ["ci"], join(stageRoot, "lensically-worker")));
  }
  if (job.job_type === "update_worker") {
    stages.push(...updateWorker(job));
  }
  if (job.job_type === "deploy_validated_sha") {
    if (!job.inputs?.receipt_id) throw new Error("server_receipt_id_required");
    stages.push({ name: "deploy_gate", status: "passed", exit_code: 0, duration_ms: 0, output_hash: createHash("sha256").update(String(job.inputs.receipt_id)).digest("hex"), output_tail: "server-issued receipt id present; production deploy command not run by local worker" });
  }
  const failed = stages.find((stage) => stage.status !== "passed");
  const evidence = !failed && source && ["validate_sha", "run_focused_tests", "run_typecheck", "run_full_validation"].includes(job.job_type)
    ? buildEvidence(job, source, stages, startedAt, Date.now() - startedAt)
    : undefined;
  if (source?.cleanup === "remove") rmSync(source.worktreeDir, { recursive: true, force: true });
  console.log(JSON.stringify({ ok: !failed, worker_version: WORKER_VERSION, stages, ...(evidence ? { evidence } : {}) }, null, 2));
  if (failed) process.exit(1);
}

main();
