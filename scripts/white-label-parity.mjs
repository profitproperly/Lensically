#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const configPath = resolve(root, "config/white-label-parity.config.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function run(command, args, options = {}) {
  const useWindowsNpm = process.platform === "win32" && command === "npm";
  const executable = useWindowsNpm ? "cmd.exe" : command;
  const finalArgs = useWindowsNpm ? ["/d", "/s", "/c", ["npm", ...args].join(" ")] : args;
  const result = spawnSync(executable, finalArgs, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    const error = new Error(`${command} ${args.join(" ")} failed`);
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    error.status = result.status;
    error.cause = result.error;
    console.error(result.stdout ?? "");
    console.error(result.stderr ?? "");
    throw error;
  }
  return result.stdout.trim();
}

function git(args, cwd = root, env = process.env) {
  const gitEnv = {
    ...env,
    GIT_TERMINAL_PROMPT: "0",
  };
  return run("git", args, { cwd, env: gitEnv });
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function normalizePath(value) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesAny(path, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(path));
}

function readState(targetRoot, config) {
  const path = resolve(targetRoot, config.state_path);
  if (!existsSync(path)) return null;
  return readJson(path);
}

function listTrackedFiles(cwd) {
  return git(["ls-files"], cwd).split(/\r?\n/).filter(Boolean).map(normalizePath);
}

function listChangedSince(baseSha) {
  if (!baseSha) return [];
  try {
    return git(["diff", "--name-only", `${baseSha}..HEAD`])
      .split(/\r?\n/)
      .filter(Boolean)
      .map(normalizePath);
  } catch {
    return [];
  }
}

function classifyPath(path, config) {
  if (matchesAny(path, config.exclude)) return "EXCLUDED";
  if (matchesAny(path, config.sync_allow)) return "SYNC_CANDIDATE";
  if (matchesAny(path, config.product_relevant)) return "PENDING";
  return "EXCLUDED";
}

function contentIsProductSafe(text, config) {
  return !config.forbidden_content_patterns.some((pattern) => text.includes(pattern));
}

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function copyCandidate(path, targetRoot) {
  const sourcePath = resolve(root, path);
  const targetPath = resolve(targetRoot, path);
  ensureParent(targetPath);
  copyFileSync(sourcePath, targetPath);
}

function validateTarget(targetRoot, commands) {
  for (const command of commands) {
    const [name, ...args] = command.split(/\s+/).filter(Boolean);
    run(name, args, { cwd: targetRoot });
  }
}

function writeReportAndState(targetRoot, config, report, state) {
  const reportPath = resolve(targetRoot, config.report_path);
  const statePath = resolve(targetRoot, config.state_path);
  ensureParent(reportPath);
  ensureParent(statePath);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function configureAutomationAuthor(targetRoot) {
  git(["config", "user.name", process.env.WHITE_LABEL_PARITY_GIT_AUTHOR_NAME || "Lensically Parity Bot"], targetRoot);
  git(["config", "user.email", process.env.WHITE_LABEL_PARITY_GIT_AUTHOR_EMAIL || "lensically-parity-bot@users.noreply.github.com"], targetRoot);
}

function targetRemote(config, token) {
  if (!token) return `https://github.com/${config.target_repository}.git`;
  return `https://x-access-token:${token}@github.com/${config.target_repository}.git`;
}

function usage() {
  console.log("Usage: node scripts/white-label-parity.mjs [--apply] [--target <path>] [--push]");
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    usage();
    return;
  }
  const apply = args.includes("--apply");
  const push = args.includes("--push");
  const targetIndex = args.indexOf("--target");
  const suppliedTarget = targetIndex >= 0 ? args[targetIndex + 1] : null;
  const config = readJson(configPath);
  const sourceSha = git(["rev-parse", "HEAD"]);
  const sourceFiles = listTrackedFiles(root);
  const tempRoot = suppliedTarget ? null : mkdtempSync(resolve(tmpdir(), "lensically-white-label-parity-"));
  const token = process.env.WHITE_LABEL_PARITY_TOKEN || process.env.PARITY_GITHUB_TOKEN || "";
  let targetRoot = suppliedTarget ? resolve(suppliedTarget) : resolve(tempRoot, "target");

  if (!suppliedTarget) {
    git(["clone", "--branch", config.target_branch, targetRemote(config, token), targetRoot]);
  }

  const targetFiles = new Set(listTrackedFiles(targetRoot));
  const state = readState(targetRoot, config);
  const changedSinceWatermark = new Set(listChangedSince(state?.source_sha).filter(Boolean));
  const candidatePaths = sourceFiles
    .filter((path) => targetFiles.has(path) || matchesAny(path, config.sync_allow) || changedSinceWatermark.has(path))
    .sort();

  const synced = [];
  const excluded = [];
  const pending = [];
  const copied = [];

  for (const path of candidatePaths) {
    const classification = classifyPath(path, config);
    if (classification === "EXCLUDED") {
      if (changedSinceWatermark.has(path)) excluded.push({ path, reason: "excluded_by_policy" });
      continue;
    }
    const sourceText = readFileSync(resolve(root, path), "utf8");
    if (!contentIsProductSafe(sourceText, config)) {
      pending.push({ path, reason: "forbidden_product_content" });
      continue;
    }
    if (classification === "PENDING") {
      pending.push({ path, reason: "product_relevant_not_allowlisted" });
      continue;
    }
    const targetPath = resolve(targetRoot, path);
    const targetText = existsSync(targetPath) ? readFileSync(targetPath, "utf8") : "";
    if (sha256(sourceText) === sha256(targetText)) {
      synced.push({ path, status: "unchanged" });
      continue;
    }
    if (apply) {
      copyCandidate(path, targetRoot);
      copied.push(path);
    }
    synced.push({ path, status: apply ? "copied" : "would_copy" });
  }

  const report = {
    version: config.version,
    generated_at: new Date().toISOString(),
    mode: apply ? "apply" : "dry_run",
    source_repository: config.source_repository,
    source_sha: sourceSha,
    target_repository: config.target_repository,
    target_branch: config.target_branch,
    counts: {
      synced: synced.length,
      copied: copied.length,
      excluded: excluded.length,
      pending: pending.length,
    },
    synced,
    excluded,
    pending,
  };

  if (apply) {
    validateTarget(targetRoot, config.validation_commands);
    configureAutomationAuthor(targetRoot);
    const newState = {
      version: config.version,
      source_repository: config.source_repository,
      source_sha: sourceSha,
      target_repository: config.target_repository,
      target_branch: config.target_branch,
      updated_at: report.generated_at,
      synced_count: synced.length,
      copied_count: copied.length,
      excluded_count: excluded.length,
      pending_count: pending.length,
      report_sha256: sha256(JSON.stringify(report)),
    };
    writeReportAndState(targetRoot, config, report, newState);
    git(["add", ...copied, config.report_path, config.state_path], targetRoot);
    const diffStatus = git(["status", "--short"], targetRoot);
    if (diffStatus) {
      git(["commit", "-m", `Maintain Lensically parity through ${sourceSha.slice(0, 12)}`], targetRoot);
      if (push) git(["push", "origin", config.target_branch], targetRoot);
    }
  }

  console.log(JSON.stringify(report, null, 2));
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
}

main();
