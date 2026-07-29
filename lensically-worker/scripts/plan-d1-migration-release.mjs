import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

export const MIGRATION_RELEASE_CONTRACT = "lensically-d1-migration-release-v1";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(scriptDirectory, "..");
const migrationDirectoryRelative = "database/migrations";
const policyPathRelative = "database/migration-release-policy.json";
const releaseClassPattern = /^\s*--\s*lensically-release-class:\s*(schema|backfill)\s*$/im;

function fail(code, details = undefined) {
  const suffix = details === undefined ? "" : `:${JSON.stringify(details)}`;
  throw new Error(`${code}${suffix}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

function normalizeMigrationName(value) {
  const normalized = String(value ?? "").replaceAll("\\", "/").trim();
  if (!normalized.toLowerCase().endsWith(".sql")) return null;
  return basename(normalized);
}

function collectMigrationNames(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectMigrationNames(item, output);
    return output;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (["name", "migration", "migration_name", "file", "filename"].includes(key)) {
        const name = normalizeMigrationName(item);
        if (name) output.push(name);
      }
      collectMigrationNames(item, output);
    }
    return output;
  }
  const name = normalizeMigrationName(value);
  if (name) output.push(name);
  return output;
}

export function extractMigrationNames(value) {
  const names = collectMigrationNames(value);
  return [...new Set(names)];
}

function readPolicy(root) {
  const path = resolve(root, policyPathRelative);
  if (!existsSync(path)) fail("migration_release_policy_missing");
  const policy = readJson(path);
  if (policy.version !== "lensically-migration-release-policy-v1") {
    fail("migration_release_policy_version_invalid", policy.version);
  }
  return policy;
}

function stripSqlComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*--.*$/gm, " ");
}

function classifySchemaSafety(source, migrationName) {
  const sql = stripSqlComments(source);
  const prohibited = [
    ["destructive_drop", /\bDROP\s+(?:TABLE|INDEX|TRIGGER|VIEW)\b/i],
    ["destructive_rename", /\bALTER\s+TABLE\b[\s\S]*?\bRENAME\b/i],
    ["destructive_column_drop", /\bALTER\s+TABLE\b[\s\S]*?\bDROP\s+COLUMN\b/i],
    ["unbounded_insert", /\bINSERT\s+(?:OR\s+\w+\s+)?INTO\b/i],
    ["unbounded_update", /\bUPDATE\s+[A-Za-z_][A-Za-z0-9_]*\s+SET\b/i],
    ["unbounded_delete", /\bDELETE\s+FROM\b/i],
    ["replace_data", /\bREPLACE\s+INTO\b/i],
    ["unsafe_foreign_keys", /\bPRAGMA\s+foreign_keys\s*=\s*(?:0|OFF)\b/i],
    ["database_attach", /\b(?:ATTACH|DETACH)\s+DATABASE\b/i],
    ["vacuum", /\bVACUUM\b/i],
  ];
  const violations = prohibited
    .filter(([, pattern]) => pattern.test(sql))
    .map(([code]) => code);
  if (violations.length > 0) fail("unsafe_schema_migration", { migrationName, violations });
}

export function readRepositoryMigrations(root = defaultRoot) {
  const policy = readPolicy(root);
  const migrationDirectory = resolve(root, migrationDirectoryRelative);
  if (!existsSync(migrationDirectory)) fail("migration_directory_missing");
  const filenamePattern = new RegExp(policy.filename_pattern);
  const names = readdirSync(migrationDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));
  if (names.length === 0) fail("migration_inventory_empty");
  const expectedStart = Number(policy.sequence_starts_at ?? 1);
  return names.map((name, index) => {
    if (!filenamePattern.test(name)) fail("migration_filename_invalid", name);
    const sequence = Number(name.slice(0, 4));
    const expectedSequence = expectedStart + index;
    if (sequence !== expectedSequence) {
      fail("migration_sequence_invalid", { name, sequence, expectedSequence });
    }
    const source = readFileSync(join(migrationDirectory, name), "utf8");
    return {
      name,
      sequence,
      sha256: sha256(source),
      source,
    };
  });
}

function assertExactPrefix(repositoryNames, appliedNames) {
  if (appliedNames.length > repositoryNames.length) {
    fail("production_migration_ledger_longer_than_repository", {
      repositoryCount: repositoryNames.length,
      appliedCount: appliedNames.length,
    });
  }
  for (let index = 0; index < appliedNames.length; index += 1) {
    if (appliedNames[index] !== repositoryNames[index]) {
      fail("production_migration_ledger_not_repository_prefix", {
        index,
        expected: repositoryNames[index],
        actual: appliedNames[index],
      });
    }
  }
}

function assertExactList(expected, actual, code) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    fail(code, { expected, actual });
  }
}

function parseGitMigrationDiff(output) {
  const entries = [];
  for (const rawLine of String(output ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const columns = line.split("\t");
    const status = columns[0];
    const paths = columns.slice(1).map((path) => path.replaceAll("\\", "/"));
    if (!paths.some((path) => path.startsWith(`${migrationDirectoryRelative}/`))) continue;
    entries.push({ status, paths });
  }
  return entries;
}

export function validateMigrationHistory(entries) {
  const mutated = entries.filter((entry) => !entry.status.startsWith("A"));
  if (mutated.length > 0) fail("applied_migration_history_mutated", mutated);
  return entries
    .filter((entry) => entry.status.startsWith("A"))
    .flatMap((entry) => entry.paths)
    .filter((path) => path.startsWith(`${migrationDirectoryRelative}/`))
    .map((path) => basename(path));
}

function gitMigrationDiff(root, productionSha, releaseSha) {
  if (!/^[a-f0-9]{40}$/i.test(String(productionSha ?? ""))) {
    fail("migration_production_sha_invalid");
  }
  if (!/^[a-f0-9]{40}$/i.test(String(releaseSha ?? ""))) {
    fail("migration_release_sha_invalid");
  }
  const result = spawnSync(
    "git",
    ["diff", "--name-status", productionSha, releaseSha, "--", migrationDirectoryRelative],
    { cwd: root, encoding: "utf8" },
  );
  if (result.error) fail("migration_git_diff_spawn_failed", result.error.message);
  if (result.status !== 0) {
    fail("migration_git_diff_failed", String(result.stderr || result.stdout || result.status));
  }
  return parseGitMigrationDiff(result.stdout);
}

function releaseClassForMigration(migration) {
  const match = migration.source.match(releaseClassPattern);
  if (!match) fail("migration_release_class_header_missing", migration.name);
  return match[1];
}

export function planMigrationRelease({
  repositoryMigrations,
  appliedNames,
  unappliedNames,
  changedMigrationEntries = [],
}) {
  const repositoryNames = repositoryMigrations.map((migration) => migration.name);
  assertExactPrefix(repositoryNames, appliedNames);
  const pendingMigrations = repositoryMigrations.slice(appliedNames.length);
  const pendingNames = pendingMigrations.map((migration) => migration.name);
  assertExactList(pendingNames, unappliedNames, "wrangler_unapplied_list_mismatch");
  const addedNames = validateMigrationHistory(changedMigrationEntries);
  const unknownAdded = addedNames.filter((name) => !pendingNames.includes(name));
  if (unknownAdded.length > 0) fail("added_migration_not_pending", unknownAdded);

  const schemaPending = [];
  const backfillPending = [];
  for (const migration of pendingMigrations) {
    const releaseClass = releaseClassForMigration(migration);
    if (releaseClass === "schema") {
      classifySchemaSafety(migration.source, migration.name);
      schemaPending.push(migration.name);
    } else {
      backfillPending.push(migration.name);
    }
  }
  if (backfillPending.length > 0 && schemaPending.length > 0) {
    fail("mixed_schema_and_backfill_migrations_pending", { schemaPending, backfillPending });
  }

  const action = backfillPending.length > 0
    ? "backfill_required"
    : schemaPending.length > 0
      ? "apply_schema"
      : "noop";
  return {
    contract: MIGRATION_RELEASE_CONTRACT,
    action,
    repository_migration_count: repositoryMigrations.length,
    applied_migration_count: appliedNames.length,
    pending_migration_count: pendingMigrations.length,
    repository_migrations: repositoryMigrations.map(({ name, sequence, sha256: digest }) => ({
      name,
      sequence,
      sha256: digest,
    })),
    applied_migrations: appliedNames,
    pending_migrations: pendingNames,
    schema_pending_migrations: schemaPending,
    backfill_pending_migrations: backfillPending,
    production_relative_added_migrations: addedNames,
    normal_apply_allowed: action === "apply_schema",
    long_running_backfill_required: action === "backfill_required",
  };
}

export function verifyMigrationRelease({ repositoryMigrations, appliedNames, unappliedNames, plan }) {
  if (plan?.contract !== MIGRATION_RELEASE_CONTRACT) fail("migration_release_plan_contract_invalid");
  const repositoryIdentity = repositoryMigrations.map(({ name, sequence, sha256: digest }) => ({
    name,
    sequence,
    sha256: digest,
  }));
  assertExactList(plan.repository_migrations, repositoryIdentity, "migration_repository_identity_changed_after_plan");
  const repositoryNames = repositoryMigrations.map((migration) => migration.name);
  assertExactList(repositoryNames, appliedNames, "migration_post_apply_ledger_incomplete");
  assertExactList([], unappliedNames, "migration_post_apply_unapplied_remaining");
  return {
    contract: MIGRATION_RELEASE_CONTRACT,
    status: "verified",
    applied_migration_count: appliedNames.length,
    verified_repository_migrations: repositoryIdentity,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    args[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  return args;
}

function requiredArg(args, name) {
  const value = args[name];
  if (!value) fail("migration_planner_argument_required", name);
  return value;
}

function readMigrationEvidence(path) {
  if (!existsSync(path)) fail("migration_evidence_file_missing", path);
  return extractMigrationNames(readJson(path));
}

function writeReceipt(path, receipt) {
  const serialized = `${JSON.stringify(receipt, null, 2)}\n`;
  if (path) writeFileSync(path, serialized, "utf8");
  process.stdout.write(serialized);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.mode ?? "plan";
  const root = resolve(args.root ?? defaultRoot);
  const repositoryMigrations = readRepositoryMigrations(root);
  const appliedNames = readMigrationEvidence(resolve(requiredArg(args, "applied")));
  const unappliedNames = readMigrationEvidence(resolve(requiredArg(args, "unapplied")));

  if (mode === "plan") {
    const productionSha = requiredArg(args, "production-sha");
    const releaseSha = requiredArg(args, "release-sha");
    const changedMigrationEntries = gitMigrationDiff(root, productionSha, releaseSha);
    const receipt = planMigrationRelease({
      repositoryMigrations,
      appliedNames,
      unappliedNames,
      changedMigrationEntries,
    });
    writeReceipt(args.output ? resolve(args.output) : null, {
      ...receipt,
      production_sha: productionSha,
      release_sha: releaseSha,
    });
    return;
  }

  if (mode === "verify") {
    const planPath = resolve(requiredArg(args, "plan"));
    if (!existsSync(planPath)) fail("migration_release_plan_missing", planPath);
    const receipt = verifyMigrationRelease({
      repositoryMigrations,
      appliedNames,
      unappliedNames,
      plan: readJson(planPath),
    });
    writeReceipt(args.output ? resolve(args.output) : null, receipt);
    return;
  }

  fail("migration_planner_mode_invalid", mode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
