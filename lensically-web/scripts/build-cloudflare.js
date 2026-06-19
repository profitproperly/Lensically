"use strict";

async function main() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const appRoot = process.cwd();
  const isWindows = process.platform === "win32";

  function resolveBin(command) {
    return path.join(
      appRoot,
      "node_modules",
      ".bin",
      isWindows ? `${command}.cmd` : command,
    );
  }

  function run(command, args, env = process.env) {
    const result = spawnSync(command, args, {
      stdio: "inherit",
      env,
      shell: isWindows,
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
  const nextDir = path.join(appRoot, ".next");
  const openNextDir = path.join(appRoot, ".open-next");
  const pagesManifestPath = path.join(nextDir, "server", "pages-manifest.json");
  const standalonePagesManifestPath = path.join(
    nextDir,
    "standalone",
    ".next",
    "server",
    "pages-manifest.json",
  );

  fs.rmSync(nextDir, { recursive: true, force: true });
  fs.rmSync(openNextDir, { recursive: true, force: true });

  // Always run the Next.js build directly before OpenNext packaging.
  run(resolveBin("next"), ["build", "--webpack"]);
  const defaultManifest = "{}\n";
  if (!fs.existsSync(pagesManifestPath)) {
    fs.mkdirSync(path.dirname(pagesManifestPath), { recursive: true });
    fs.writeFileSync(pagesManifestPath, defaultManifest, "utf8");
  }
  if (!fs.existsSync(standalonePagesManifestPath)) {
    fs.mkdirSync(path.dirname(standalonePagesManifestPath), { recursive: true });
    const sourceManifest = fs.existsSync(pagesManifestPath)
      ? fs.readFileSync(pagesManifestPath, "utf8")
      : defaultManifest;
    fs.writeFileSync(standalonePagesManifestPath, sourceManifest || defaultManifest, "utf8");
  }
  ensureFileExists(pagesManifestPath);
  ensureFileExists(standalonePagesManifestPath);

  // Package with OpenNext without letting it decide whether to run Next.js.
  run(resolveBin("opennextjs-cloudflare"), ["build", "--skipNextBuild"], {
    ...process.env,
    NEXT_DISABLE_TURBOPACK: "1",
  });
}

void main();
