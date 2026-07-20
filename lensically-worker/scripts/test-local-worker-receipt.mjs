import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");

const workerPath = resolve(repoRoot, "lensically-local-node/worker/src/worker.mjs");
if (!existsSync(workerPath)) throw new Error("local_worker_missing");
const testRootBase = "C:\\LensicallyLocalNodeTest";
mkdirSync(testRootBase, { recursive: true });

const gitCommand = process.platform === "win32" ? "git.exe" : "git";
const shaResult = spawnSync(gitCommand, ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
const sha = shaResult.stdout.trim();
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error(`invalid_sha:${shaResult.error?.message ?? sha}`);

const job = {
  job_id: "receipt-test",
  repo: "profitproperly/Lensically",
  commit_sha: sha,
  job_type: "validate_sha",
  inputs: { test_path: "test/localExecution.spec.ts", repository_path: repoRoot },
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
  env: { ...process.env, LENSICALLY_LOCAL_NODE_ROOT: mkdtempSync(join(testRootBase, "receipt-")) },
  encoding: "utf8",
  timeout: 120000,
});

if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  process.exit(result.status ?? 1);
}

const parsed = JSON.parse(result.stdout);
const evidence = parsed.evidence;
if (evidence?.evidence_version !== "local-stage-evidence-v1") throw new Error("evidence_version_missing");
for (const field of ["repository_sha", "checked_out_sha", "validated_sha", "release_candidate_sha"]) {
  if (evidence[field] !== sha) throw new Error(`evidence_sha_mismatch:${field}`);
}
if (!String(evidence.isolated_worktree || "").includes(sha.slice(0, 12))) throw new Error("isolated_worktree_missing");
if (!Array.isArray(evidence.stages) || evidence.stages.some((stage) => stage.status !== "passed")) {
  throw new Error("evidence_stage_failed");
}
console.log(`[local-worker-evidence] ok sha=${sha} stages=${evidence.stages.length} worktree=${evidence.isolated_worktree}`);
