import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");

const workerPath = resolve(repoRoot, "lensically-local-node/worker/src/worker.mjs");
if (!existsSync(workerPath)) throw new Error("local_worker_missing");

const gitCommand = process.platform === "win32" ? "git.exe" : "git";
const shaResult = spawnSync(gitCommand, ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
const sha = shaResult.stdout.trim();
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error(`invalid_sha:${shaResult.error?.message ?? sha}`);

const job = {
  job_id: "receipt-test",
  repo: "profitproperly/Lensically",
  commit_sha: sha,
  job_type: "validate_sha",
  inputs: { test_path: "test/localExecution.spec.ts" },
  node_id: "receipt-test-node",
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 600000).toISOString(),
  nonce: "receipt-test-nonce",
  max_runtime_ms: 120000,
  expected_stages: ["typecheck", "focused_tests"],
  authorization_level: "validate",
  signature: "server-signature",
  attempt_count: 1,
  result_status: "claimed",
};

const result = spawnSync(process.execPath, [workerPath, JSON.stringify(job)], {
  cwd: repoRoot,
  encoding: "utf8",
  timeout: 120000,
});

if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  process.exit(result.status ?? 1);
}

const parsed = JSON.parse(result.stdout);
const receipt = parsed.receipt;
if (receipt?.version !== "local-validation-receipt-v1") throw new Error("receipt_version_missing");
for (const field of ["repository_sha", "checked_out_sha", "validated_sha", "release_candidate_sha"]) {
  if (receipt[field] !== sha) throw new Error(`receipt_sha_mismatch:${field}`);
}
if (!Array.isArray(receipt.stages) || receipt.stages.some((stage) => stage.status !== "passed")) {
  throw new Error("receipt_stage_failed");
}
if (!receipt.integrity?.signature) throw new Error("receipt_integrity_missing");
console.log(`[local-worker-receipt] ok sha=${sha} stages=${receipt.stages.length}`);
