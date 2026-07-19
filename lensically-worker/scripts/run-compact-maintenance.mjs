import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const wrapperPath = fileURLToPath(import.meta.url);
const workerRoot = path.resolve(path.dirname(wrapperPath), "..");
const repoRoot = path.resolve(workerRoot, "..");
const patchPath = path.resolve(workerRoot, "scripts/apply-compact-post-results-patch.mjs");
const diagnosticPath = path.resolve(workerRoot, "compact-maintenance-error.json");

const result = spawnSync(process.execPath, [patchPath], {
  cwd: repoRoot,
  encoding: "utf8",
  env: process.env,
});

if (result.status !== 0) {
  const diagnostic = {
    status: result.status,
    signal: result.signal,
    error: result.error ? String(result.error.stack ?? result.error.message ?? result.error) : null,
    stdout: String(result.stdout ?? "").slice(-20000),
    stderr: String(result.stderr ?? "").slice(-20000),
    captured_at: new Date().toISOString(),
  };
  execFileSync("git", ["reset", "--hard", "HEAD"], { cwd: repoRoot, stdio: "inherit" });
  execFileSync("git", ["clean", "-fd"], { cwd: repoRoot, stdio: "inherit" });
  fs.writeFileSync(diagnosticPath, `${JSON.stringify(diagnostic, null, 2)}\n`);
  process.exit(result.status ?? 1);
}

if (fs.existsSync(wrapperPath)) fs.unlinkSync(wrapperPath);
