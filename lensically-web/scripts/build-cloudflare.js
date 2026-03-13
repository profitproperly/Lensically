"use strict";

async function main() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { spawnSync } = await import("node:child_process");

  function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  }

  function ensureFileExists(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required build artifact missing: ${filePath}`);
    }
  }
  const appRoot = process.cwd();
  const nextDir = path.join(appRoot, ".next");
  const pagesManifestPath = path.join(nextDir, "server", "pages-manifest.json");

  fs.rmSync(nextDir, { recursive: true, force: true });

  // Always run the Next.js build directly before OpenNext packaging.
  run("next", ["build", "--webpack"]);
  ensureFileExists(pagesManifestPath);

  // Package with OpenNext without letting it decide whether to run Next.js.
  run("opennextjs-cloudflare", ["build", "--skipNextBuild"], {
    ...process.env,
    NEXT_DISABLE_TURBOPACK: "1",
  });
}

void main();
