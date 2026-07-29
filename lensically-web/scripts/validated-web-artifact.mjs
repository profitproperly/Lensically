import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

export const WEB_ARTIFACT_CONTRACT = "lensically-validated-web-artifact-v1";
export const WEB_ARTIFACT_ARCHIVE = "lensically-web-open-next.tar.gz";
export const WEB_ARTIFACT_MANIFEST = "lensically-web-artifact.json";
const REQUIRED_PATHS = [".open-next/worker.js", ".open-next/assets"];

function fail(code, details = "") {
  throw new Error(details ? `${code}:${details}` : code);
}

function assertSha(value) {
  if (!/^[a-f0-9]{40}$/i.test(String(value ?? ""))) fail("web_artifact_invalid_source_sha");
  return String(value).toLowerCase();
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function runTar(args, cwd) {
  const result = spawnSync("tar", args, { cwd, encoding: "utf8" });
  if (result.error) fail("web_artifact_tar_spawn_failed", result.error.message);
  if (result.status !== 0) {
    fail("web_artifact_tar_failed", String(result.stderr || result.stdout || result.status));
  }
  return result.stdout;
}

function ensureRequiredBuildPaths(appRoot) {
  for (const relativePath of REQUIRED_PATHS) {
    if (!existsSync(join(appRoot, relativePath))) fail("web_artifact_required_path_missing", relativePath);
  }
}

export function validateArchiveEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) fail("web_artifact_archive_empty");
  for (const rawEntry of entries) {
    const entry = String(rawEntry).replace(/\\/g, "/").replace(/\/$/, "");
    if (!entry) continue;
    if (isAbsolute(entry) || entry.startsWith("/")) fail("web_artifact_unsafe_entry", entry);
    const segments = entry.split("/");
    if (segments.includes("..") || segments.includes(".")) fail("web_artifact_unsafe_entry", entry);
    if (segments[0] !== ".open-next") fail("web_artifact_unexpected_root", entry);
  }
}

export function packageValidatedWebArtifact({ appRoot, outputDir, sourceSha }) {
  const root = resolve(appRoot);
  const destination = resolve(outputDir);
  const normalizedSha = assertSha(sourceSha);
  const packageLockPath = join(root, "package-lock.json");
  if (!existsSync(packageLockPath)) fail("web_artifact_package_lock_missing");
  ensureRequiredBuildPaths(root);

  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  const archivePath = join(destination, WEB_ARTIFACT_ARCHIVE);
  runTar(["-czf", archivePath, "--", ".open-next"], root);
  const archiveSize = statSync(archivePath).size;
  if (archiveSize <= 0) fail("web_artifact_archive_empty");

  const manifest = {
    contract: WEB_ARTIFACT_CONTRACT,
    source_sha: normalizedSha,
    artifact_file: WEB_ARTIFACT_ARCHIVE,
    sha256: hashFile(archivePath),
    size_bytes: archiveSize,
    package_lock_sha256: hashFile(packageLockPath),
    required_paths: REQUIRED_PATHS,
  };
  writeFileSync(join(destination, WEB_ARTIFACT_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export function restoreValidatedWebArtifact({ appRoot, inputDir, expectedSha }) {
  const root = resolve(appRoot);
  const source = resolve(inputDir);
  const normalizedSha = assertSha(expectedSha);
  const manifestPath = join(source, WEB_ARTIFACT_MANIFEST);
  if (!existsSync(manifestPath)) fail("web_artifact_manifest_missing");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.contract !== WEB_ARTIFACT_CONTRACT) fail("web_artifact_contract_mismatch");
  if (manifest.source_sha !== normalizedSha) fail("web_artifact_source_sha_mismatch");
  if (manifest.artifact_file !== WEB_ARTIFACT_ARCHIVE) fail("web_artifact_file_mismatch");
  if (!Array.isArray(manifest.required_paths)
      || JSON.stringify(manifest.required_paths) !== JSON.stringify(REQUIRED_PATHS)) {
    fail("web_artifact_required_paths_mismatch");
  }

  const packageLockPath = join(root, "package-lock.json");
  if (!existsSync(packageLockPath)) fail("web_artifact_package_lock_missing");
  if (manifest.package_lock_sha256 !== hashFile(packageLockPath)) fail("web_artifact_package_lock_mismatch");

  const archivePath = join(source, WEB_ARTIFACT_ARCHIVE);
  if (!existsSync(archivePath)) fail("web_artifact_archive_missing");
  if (Number(manifest.size_bytes) !== statSync(archivePath).size) fail("web_artifact_size_mismatch");
  if (manifest.sha256 !== hashFile(archivePath)) fail("web_artifact_digest_mismatch");

  const entries = runTar(["-tzf", archivePath], root).split(/\r?\n/).filter(Boolean);
  validateArchiveEntries(entries);
  rmSync(join(root, ".open-next"), { recursive: true, force: true });
  runTar(["-xzf", archivePath, "-C", root], root);
  ensureRequiredBuildPaths(root);
  return manifest;
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    values[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  return values;
}

async function main() {
  const scriptRoot = dirname(fileURLToPath(import.meta.url));
  const appRoot = resolve(scriptRoot, "..");
  const command = process.argv[2];
  const args = parseArgs(process.argv.slice(3));
  if (command === "package") {
    const manifest = packageValidatedWebArtifact({ appRoot, outputDir: args.directory, sourceSha: args.sha });
    console.log(JSON.stringify({ status: "packaged", ...manifest }));
    return;
  }
  if (command === "restore") {
    const manifest = restoreValidatedWebArtifact({ appRoot, inputDir: args.directory, expectedSha: args.sha });
    console.log(JSON.stringify({ status: "restored", ...manifest }));
    return;
  }
  fail("web_artifact_command_required");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
