#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";

const WORKER_VERSION = "local-worker-v1";
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
  const executable = process.platform === "win32" && (command === "npm" || command === "npx") ? process.execPath : command;
  const commandArgs = process.platform === "win32" && (command === "npm" || command === "npx")
    ? [join(nodeRoot, "node_modules", "npm", "bin", command === "npm" ? "npm-cli.js" : "npx-cli.js"), ...args]
    : args;
  const result = spawnSync(executable, commandArgs, { cwd, encoding: "utf8" });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  return {
    name: [command, ...args].join(" "),
    status: result.status === 0 ? "passed" : "failed",
    exit_code: result.status,
    duration_ms: Date.now() - started,
    output_hash: createHash("sha256").update(output).digest("hex"),
    output_tail: output.replace(/[A-Za-z0-9_=-]{32,}/g, "[redacted]").slice(-12000),
  };
}

function assertSha(job) {
  if (!/^[a-f0-9]{40}$/i.test(job.commit_sha || "")) throw new Error("exact_sha_required");
  const current = run("git", ["rev-parse", "HEAD"], process.cwd());
  if (current.status !== "passed" || !current.output_tail.includes(job.commit_sha)) throw new Error("checked_out_sha_mismatch");
}

function main() {
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
  if (job.job_type === "deploy_validated_sha") {
    if (!existsSync("lensically-worker/.local-validation-receipt.json")) throw new Error("local_receipt_required");
    stages.push(run("npm", ["run", "deploy:cloudflare-gated"], "lensically-worker"));
  }
  const failed = stages.find((stage) => stage.status !== "passed");
  console.log(JSON.stringify({ ok: !failed, worker_version: WORKER_VERSION, stages }, null, 2));
  if (failed) process.exit(1);
}

main();
