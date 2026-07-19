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
  fs.writeFileSync(diagnosticPath, `${JSON.stringify(diagnostic, null, 2)}\n`);
  execFileSync("git", ["config", "user.name", "lensically-engineering"], { cwd: repoRoot, stdio: "inherit" });
  execFileSync("git", ["config", "user.email", "lensically-engineering@users.noreply.github.com"], { cwd: repoRoot, stdio: "inherit" });
  execFileSync("git", ["add", "lensically-worker/compact-maintenance-error.json"], { cwd: repoRoot, stdio: "inherit" });
  execFileSync("git", ["commit", "-m", "Record compact maintenance diagnostic"], { cwd: repoRoot, stdio: "inherit" });
  execFileSync("git", ["push", "origin", "HEAD:main"], { cwd: repoRoot, stdio: "inherit" });
  process.exit(result.status ?? 1);
}

if (fs.existsSync(wrapperPath)) fs.unlinkSync(wrapperPath);
