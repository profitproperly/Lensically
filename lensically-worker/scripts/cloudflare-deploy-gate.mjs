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
  console.error("[deploy-gate] Cloudflare exact-head validation receipt missing or unreadable; local receipt files never authorize production deployment");
  process.exit(2);
}

const receiptSha = receipt?.commit_sha ?? receipt?.repository_sha;
const cloudflareReceiptShaMatches = receipt?.ok === true && receiptSha === sha;

if (!cloudflareReceiptShaMatches) {
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
