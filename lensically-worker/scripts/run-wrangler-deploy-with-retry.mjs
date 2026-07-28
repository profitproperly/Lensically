import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runWranglerDeployWithRetry } from "./wrangler-deploy-retry-core.mjs";

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const exitCode = await runWranglerDeployWithRetry({
    args: process.argv.slice(2),
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    cwd: process.cwd(),
    env: process.env,
    spawn: spawnSync,
    stdout: process.stdout,
    stderr: process.stderr,
  });
  process.exitCode = exitCode;
}

