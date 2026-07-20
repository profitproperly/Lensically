#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(process.cwd(), "..");
const sourcePath = join(repoRoot, "lensically-local-node", "worker", "src", "worker.mjs");
const testRootBase = "C:\\LensicallyLocalNodeTest";
mkdirSync(testRootBase, { recursive: true });
const root = mkdtempSync(join(testRootBase, "update-"));
mkdirSync(join(root, "workers", "active"), { recursive: true });
mkdirSync(join(root, "workers", "previous"), { recursive: true });
writeFileSync(join(root, "workers", "active", "worker.mjs"), readFileSync(sourcePath));
writeFileSync(join(root, "state.json"), JSON.stringify({
  active_slot: "active",
  previous_slot: "previous",
  worker_version: "local-worker-v1",
}, null, 2));

const sha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).stdout.trim();
const committedWorker = spawnSync("git", ["show", `${sha}:lensically-local-node/worker/src/worker.mjs`], { cwd: repoRoot, encoding: "buffer" });
if (committedWorker.status !== 0) throw new Error("committed_worker_missing");
const committedPackageHash = createHash("sha256").update(committedWorker.stdout).digest("hex");

function runUpdate(package_hash) {
  const job = {
    job_id: randomUUID(),
    job_type: "update_worker",
    node_id: "test-node",
    commit_sha: sha,
    inputs: {
      repository_path: repoRoot,
      package_hash,
      package_sha: sha,
      worker_version: "local-worker-v1-test",
    },
  };
  return spawnSync(process.execPath, [sourcePath, JSON.stringify(job)], {
    cwd: repoRoot,
    env: { ...process.env, LENSICALLY_LOCAL_NODE_ROOT: root },
    encoding: "utf8",
    timeout: 60000,
  });
}

const success = runUpdate(committedPackageHash);
if (success.status !== 0) throw new Error(`update_success_failed:${success.stderr || success.stdout}`);
const stateAfterSuccess = JSON.parse(readFileSync(join(root, "state.json"), "utf8"));
if (stateAfterSuccess.active_slot !== "previous" || stateAfterSuccess.previous_slot !== "active") {
  throw new Error(`update_did_not_flip_slots:${JSON.stringify(stateAfterSuccess)}`);
}
if (!existsSync(join(root, "workers", "previous", "worker.mjs"))) throw new Error("candidate_worker_missing");

const failed = runUpdate("0".repeat(64));
if (failed.status === 0) throw new Error("hash_mismatch_update_unexpectedly_passed");
const stateAfterFailure = JSON.parse(readFileSync(join(root, "state.json"), "utf8"));
if (JSON.stringify(stateAfterFailure) !== JSON.stringify(stateAfterSuccess)) {
  throw new Error("rollback_state_changed_after_failed_update");
}

console.log(`[local-worker-update-rollback] ok root=${root} active=${stateAfterFailure.active_slot}`);
