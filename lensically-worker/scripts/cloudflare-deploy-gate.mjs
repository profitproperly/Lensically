import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const run = (command, args, options = {}) => spawnSync(command, args, { encoding: "utf8", shell: process.platform === "win32", ...options });
const sha = process.env.WORKERS_CI_COMMIT_SHA || run("git", ["rev-parse", "HEAD"]).stdout.trim();
const message = run("git", ["log", "-1", "--pretty=%B"]).stdout;
const releaseRequested = message.includes("[verified-worker-release]");

if (!releaseRequested) {
  console.log(`[deploy-gate] ${sha} passed validation. No production release marker; deployment intentionally skipped.`);
  process.exit(0);
}

let receipt;
try {
  receipt = JSON.parse(readFileSync(".cloudflare-validation-receipt.json", "utf8"));
} catch {
  try {
    receipt = JSON.parse(readFileSync(".local-validation-receipt.json", "utf8"));
  } catch {
    console.error("[deploy-gate] validation receipt missing or unreadable");
    process.exit(2);
  }
}

const receiptSha = receipt?.commit_sha ?? receipt?.repository_sha;
const localReceiptShaMatches = receipt?.version === "local-validation-receipt-v1"
  && receipt?.repository_sha === sha
  && receipt?.checked_out_sha === sha
  && receipt?.validated_sha === sha
  && receipt?.release_candidate_sha === sha;
const cloudflareReceiptShaMatches = receipt?.ok === true && receiptSha === sha;

if (!cloudflareReceiptShaMatches && !localReceiptShaMatches) {
  console.error(`[deploy-gate] receipt SHA mismatch: expected ${sha}, received ${receiptSha ?? "none"}`);
  process.exit(3);
}

console.log(`[deploy-gate] deploying exact validated head ${sha}`);
const deployment = spawnSync(
  "npx",
  ["wrangler", "deploy", "--config", "wrangler.jsonc", "--var", `LENSICALLY_COMMIT_SHA:${sha}`],
  { stdio: "inherit", shell: process.platform === "win32" },
);
process.exit(deployment.status ?? 1);
