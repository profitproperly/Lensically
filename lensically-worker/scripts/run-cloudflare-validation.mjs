import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const steps = [
  ["npx", ["tsc", "--noEmit"], "TypeScript"],
  ["node", ["scripts/release-preflight.mjs"], "Release preflight"],
  ["node", ["scripts/run-operator-validation.mjs", "acceptance"], "Operator acceptance"],
  ["npm", ["run", "test", "--", "--run", "test/systemDirectory.spec.ts", "--reporter=dot", "--bail=1"], "System directory"],
  ["npm", ["run", "test", "--", "--run", "test/threadsPublishService.spec.ts", "--reporter=dot", "--bail=1"], "Threads publishing"],
  ["npm", ["run", "test", "--", "--run", "test/gptMemoryRoutes.spec.ts", "--reporter=dot", "--bail=1"], "GPT memory"],
];

const sha = process.env.WORKERS_CI_COMMIT_SHA || spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
const startedAt = new Date().toISOString();
const completed = [];

for (const [command, args, name] of steps) {
  const started = Date.now();
  console.log(`\n[validation] ${name}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  completed.push({ name, duration_ms: Date.now() - started, status: result.status ?? 1 });
  if (result.status !== 0) {
    console.error(`[validation] ${name} failed with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

const receipt = {
  version: "cloudflare-validation-receipt-v1",
  commit_sha: sha,
  started_at: startedAt,
  completed_at: new Date().toISOString(),
  steps: completed,
  ok: true,
};
writeFileSync(".cloudflare-validation-receipt.json", JSON.stringify(receipt, null, 2));
console.log(`\n[validation] exact head ${sha} passed every required gate.`);
