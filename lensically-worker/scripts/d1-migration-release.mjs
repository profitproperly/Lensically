import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = resolve(fileURLToPath(new URL(".", import.meta.url)));
export const WORKER_ROOT = resolve(SCRIPT_DIRECTORY, "..");
export const MIGRATIONS_DIRECTORY = resolve(WORKER_ROOT, "database", "migrations");
export const WRANGLER_CONFIG = resolve(WORKER_ROOT, "wrangler.jsonc");
export const DATABASE_NAME = "lensically-db";
export const MIGRATIONS_TABLE = "lensically_d1_migrations";
const MIGRATION_PATH_PREFIX = "lensically-worker/database/migrations/";
const DIRECTIVE_PREFIX = "lensically-migration-";
const ALLOWED_CLASSES = new Set(["schema", "small-data", "backfill"]);
const ALLOWED_RISKS = new Set(["low", "medium", "high"]);
const MAX_NORMAL_MIGRATION_BYTES = 250_000;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fail(code, detail = "") {
  const suffix = detail ? `:${detail}` : "";
  throw new Error(`${code}${suffix}`);
}

function commandName(name) {
  return process.platform === "win32" && name === "npx" ? "npx.cmd" : name;
}

function run(command, args, options = {}) {
  try {
    return execFileSync(commandName(command), args, {
      cwd: WORKER_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
      ...options,
    }).trim();
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout).trim() : "";
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    fail("migration_command_failed", JSON.stringify({ command, args, stdout, stderr }));
  }
}

function parseArgs(argv) {
  const parsed = { positional: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      parsed.positional.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDirectives(sql) {
  const directives = {};
  for (const line of sql.split(/\r?\n/).slice(0, 30)) {
    const match = line.match(/^\s*--\s*lensically-migration-(class|owner|risk):\s*(.+?)\s*$/i);
    if (!match) continue;
    directives[match[1].toLowerCase()] = match[2].trim().toLowerCase();
  }
  return directives;
}

function inspectSql(sql) {
  const normalized = stripSqlComments(sql);
  const hasDataMutation = [
    /\bINSERT\s+(?:OR\s+[A-Z]+\s+)?INTO\b/i,
    /\bREPLACE\s+INTO\b/i,
    /\bUPDATE\s+(?:OR\s+[A-Z]+\s+)?["`\[]?[A-Z_][A-Z0-9_]*["`\]]?\s+SET\b/i,
    /\bDELETE\s+FROM\b/i,
  ].some((pattern) => pattern.test(normalized));
  const unsafePatterns = [
    ["attach_database", /\bATTACH\s+(?:DATABASE\s+)?/i],
    ["detach_database", /\bDETACH\s+(?:DATABASE\s+)?/i],
    ["writable_schema", /\bPRAGMA\s+writable_schema\b/i],
    ["vacuum", /\bVACUUM\b/i],
    ["drop_table", /\bDROP\s+TABLE\b/i],
    ["drop_column", /\bALTER\s+TABLE\b[\s\S]*?\bDROP\s+COLUMN\b/i],
    ["rename_table_or_column", /\bALTER\s+TABLE\b[\s\S]*?\bRENAME\s+(?:TO|COLUMN)\b/i],
  ];
  return {
    hasDataMutation,
    unsafeReasons: unsafePatterns.filter(([, pattern]) => pattern.test(normalized)).map(([reason]) => reason),
  };
}

function verifyWranglerContract() {
  const source = readFileSync(WRANGLER_CONFIG, "utf8");
  if (!source.includes(`"database_name": "${DATABASE_NAME}"`)) fail("wrangler_database_name_mismatch");
  if (!source.includes('"migrations_dir": "database/migrations"')) fail("wrangler_migrations_directory_mismatch");
  if (!source.includes(`"migrations_table": "${MIGRATIONS_TABLE}"`)) fail("wrangler_migrations_table_mismatch");
}

export function auditRepositoryMigrations(directory = MIGRATIONS_DIRECTORY) {
  verifyWranglerContract();
  const names = readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));
  if (names.length === 0) fail("migration_repository_empty");

  const entries = names.map((name, position) => {
    const match = name.match(/^(\d{4})_([a-z0-9_]+)\.sql$/);
    if (!match) fail("migration_filename_invalid", name);
    const numericOrder = Number(match[1]);
    if (numericOrder !== position) {
      fail("migration_order_not_contiguous", JSON.stringify({ name, expected: position, actual: numericOrder }));
    }
    const source = readFileSync(resolve(directory, name), "utf8");
    const directives = parseDirectives(source);
    const inspection = inspectSql(source);
    return {
      name,
      order: numericOrder,
      bytes: Buffer.byteLength(source),
      sha256: sha256(source),
      migrationClass: directives.class ?? "legacy-unclassified",
      owner: directives.owner ?? null,
      risk: directives.risk ?? null,
      hasDataMutation: inspection.hasDataMutation,
      unsafeReasons: inspection.unsafeReasons,
    };
  });

  const duplicateOrders = entries.filter((entry, index) => entries.findIndex((candidate) => candidate.order === entry.order) !== index);
  if (duplicateOrders.length > 0) fail("migration_order_duplicate", duplicateOrders.map((entry) => entry.name).join(","));
  return entries;
}

export function validateClassificationBoundary(entries) {
  const firstClassifiedIndex = entries.findIndex((entry) => entry.migrationClass !== "legacy-unclassified");
  if (firstClassifiedIndex < 0) return;
  const laterLegacy = entries.slice(firstClassifiedIndex).find((entry) => entry.migrationClass === "legacy-unclassified");
  if (laterLegacy) fail("migration_classification_boundary_regressed", laterLegacy.name);
}

export function validateUnappliedMigration(entry) {
  if (!ALLOWED_CLASSES.has(entry.migrationClass)) fail("migration_class_missing_or_invalid", entry.name);
  if (!entry.owner || !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(entry.owner)) fail("migration_owner_missing_or_invalid", entry.name);
  if (!ALLOWED_RISKS.has(entry.risk)) fail("migration_risk_missing_or_invalid", entry.name);
  if (entry.bytes > MAX_NORMAL_MIGRATION_BYTES) fail("migration_too_large_for_normal_lane", entry.name);
  if (entry.unsafeReasons.length > 0) fail("migration_unsafe_statement", `${entry.name}:${entry.unsafeReasons.join(",")}`);
  if (entry.migrationClass === "backfill") fail("migration_backfill_forbidden_in_normal_directory", entry.name);
  if (entry.risk === "high") fail("migration_high_risk_requires_explicit_lane", entry.name);
  if (entry.migrationClass === "schema" && entry.hasDataMutation) fail("schema_migration_contains_data_mutation", entry.name);
  if (entry.migrationClass === "small-data" && !entry.hasDataMutation) fail("small_data_migration_has_no_data_mutation", entry.name);
}

function extractResultRows(value) {
  const candidates = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (Array.isArray(node.results)) candidates.push(node.results);
    for (const nested of Object.values(node)) visit(nested);
  };
  visit(value);
  return candidates.find((rows) => rows.every((row) => row && typeof row === "object" && "name" in row)) ?? [];
}

export function parseWranglerLedgerJson(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    const firstArray = stdout.indexOf("[");
    const lastArray = stdout.lastIndexOf("]");
    if (firstArray < 0 || lastArray <= firstArray) fail("migration_ledger_json_invalid");
    parsed = JSON.parse(stdout.slice(firstArray, lastArray + 1));
  }
  const rows = extractResultRows(parsed);
  if (!Array.isArray(rows)) fail("migration_ledger_rows_missing");
  return rows.map((row) => {
    if (typeof row.name !== "string" || row.name.length === 0) fail("migration_ledger_name_invalid");
    return { id: Number(row.id), name: row.name, applied_at: row.applied_at ?? null };
  });
}

function requireRemoteAccess() {
  const missing = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"].filter((name) => !process.env[name]);
  if (missing.length > 0) fail("migration_remote_access_missing", missing.join(","));
}

export function queryProductionLedger() {
  requireRemoteAccess();
  const stdout = run("npx", [
    "wrangler", "d1", "execute", DATABASE_NAME,
    "--remote", "--config", "wrangler.jsonc", "--json",
    "--command", `SELECT id, name, applied_at FROM ${MIGRATIONS_TABLE} ORDER BY id ASC`,
  ]);
  return parseWranglerLedgerJson(stdout);
}

export function reconcileProductionPrefix(repositoryEntries, productionRows) {
  const productionNames = productionRows.map((row) => row.name);
  if (new Set(productionNames).size !== productionNames.length) fail("migration_production_ledger_duplicate");
  if (productionNames.length > repositoryEntries.length) fail("migration_production_ledger_ahead_of_repository");
  for (let index = 0; index < productionNames.length; index += 1) {
    const expected = repositoryEntries[index]?.name;
    const actual = productionNames[index];
    if (expected !== actual) {
      fail("migration_production_ledger_not_exact_prefix", JSON.stringify({ index, expected, actual }));
    }
  }
  return repositoryEntries.slice(productionNames.length);
}

export function parseMigrationTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  const text = String(value ?? "").trim();
  if (!text) return Number.NaN;
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  const normalized = text.includes("T") || text.endsWith("Z")
    ? text
    : `${text.replace(" ", "T")}Z`;
  return Date.parse(normalized);
}

export function appliedMigrationChangeIsSafe(change) {
  const latestCommitMs = parseMigrationTimestamp(change.latestCommitAt);
  const appliedMs = parseMigrationTimestamp(change.appliedAt);
  return change.status === "A"
    && Number.isFinite(latestCommitMs)
    && Number.isFinite(appliedMs)
    && latestCommitMs <= appliedMs;
}

function assertAppliedMigrationsUnedited(productionSha, productionRows) {
  if (!/^[a-f0-9]{40}$/i.test(productionSha ?? "")) fail("migration_production_sha_invalid");
  run("git", ["cat-file", "-e", `${productionSha}^{commit}`]);
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", productionSha, "HEAD"], {
      cwd: WORKER_ROOT,
      stdio: "ignore",
    });
  } catch {
    fail("migration_production_sha_not_ancestor", productionSha);
  }
    const changed = run("git", ["diff", "--name-status", productionSha, "HEAD", "--", "database/migrations"])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, ...pathParts] = line.split(/\s+/);
      return { status, path: pathParts[pathParts.length - 1] ?? "" };
    });
    const appliedByName = new Map(productionRows.map((row) => [row.name, row]));
    const unsafeApplied = [];
  for (const change of changed.filter((entry) => appliedByName.has(basename(entry.path)))) {
    const latestCommitAt = run("git", ["log", "-1", "--format=%cI", "HEAD", "--", change.path]).trim();
    const appliedAt = appliedByName.get(basename(change.path))?.applied_at ?? null;
    if (!appliedMigrationChangeIsSafe({ status: change.status, latestCommitAt, appliedAt })) {
      unsafeApplied.push({
        path: change.path,
        status: change.status,
        latestCommitAt,
        appliedAt,
        latestCommitMs: parseMigrationTimestamp(latestCommitAt),
        appliedMs: parseMigrationTimestamp(appliedAt),
      });
    }
  }
  if (unsafeApplied.length > 0) fail("migration_applied_file_edited", JSON.stringify(unsafeApplied));
  return changed.map((entry) => entry.path);
}

export function buildMigrationPlan({ productionSha, productionRows, repositoryEntries, sourceSha }) {
  const unapplied = reconcileProductionPrefix(repositoryEntries, productionRows);
    const appliedNames = productionRows.map((row) => row.name);
  assertAppliedMigrationsUnedited(productionSha, productionRows);
  for (const entry of unapplied) validateUnappliedMigration(entry);
  const planCore = {
    planVersion: "lensically-d1-release-plan-v1",
    database: DATABASE_NAME,
    migrationsTable: MIGRATIONS_TABLE,
    sourceSha,
    productionSha,
    repository: repositoryEntries.map(({ name, order, bytes, sha256: digest, migrationClass, owner, risk, hasDataMutation }) => ({
      name, order, bytes, sha256: digest, migrationClass, owner, risk, hasDataMutation,
    })),
    applied: appliedNames,
    unapplied: unapplied.map(({ name, order, bytes, sha256: digest, migrationClass, owner, risk, hasDataMutation }) => ({
      name, order, bytes, sha256: digest, migrationClass, owner, risk, hasDataMutation,
    })),
  };
  return {
    ...planCore,
    fingerprint: sha256(stableJson(planCore)),
    generatedAt: new Date().toISOString(),
  };
}

export function planRemote(productionSha) {
  const repositoryEntries = auditRepositoryMigrations();
  const productionRows = queryProductionLedger();
  const sourceSha = run("git", ["rev-parse", "HEAD"]);
  return buildMigrationPlan({ productionSha, productionRows, repositoryEntries, sourceSha });
}

function assertPlanIdentity(expected, actual) {
  for (const key of ["planVersion", "database", "migrationsTable", "sourceSha", "productionSha", "fingerprint"]) {
    if (expected[key] !== actual[key]) fail("migration_plan_identity_changed", key);
  }
  if (stableJson(expected.unapplied) !== stableJson(actual.unapplied)) fail("migration_unapplied_plan_changed");
}

export function applyRemote({ productionSha, planPath }) {
  if (!planPath || !existsSync(planPath)) fail("migration_plan_file_missing");
  const expectedPlan = JSON.parse(readFileSync(planPath, "utf8"));
  const actualPlan = planRemote(productionSha);
  assertPlanIdentity(expectedPlan, actualPlan);
  if (actualPlan.unapplied.length === 0) {
    return { applied: [], verified: true, fingerprint: actualPlan.fingerprint };
  }
  run("npx", ["wrangler", "d1", "migrations", "apply", DATABASE_NAME, "--remote", "--config", "wrangler.jsonc"]);
  const repositoryEntries = auditRepositoryMigrations();
  const productionRows = queryProductionLedger();
  const remaining = reconcileProductionPrefix(repositoryEntries, productionRows);
  if (remaining.length > 0) fail("migration_apply_incomplete", remaining.map((entry) => entry.name).join(","));
  return { applied: actualPlan.unapplied.map((entry) => entry.name), verified: true, fingerprint: actualPlan.fingerprint };
}

export function verifyRemote() {
  const repositoryEntries = auditRepositoryMigrations();
  const productionRows = queryProductionLedger();
  const remaining = reconcileProductionPrefix(repositoryEntries, productionRows);
  if (remaining.length > 0) fail("migration_production_ledger_incomplete", remaining.map((entry) => entry.name).join(","));
  return { verified: true, migrationCount: repositoryEntries.length };
}

function localCheck() {
  const entries = auditRepositoryMigrations();
  validateClassificationBoundary(entries);
  const classified = entries.filter((entry) => entry.migrationClass !== "legacy-unclassified");
  for (const entry of classified) validateUnappliedMigration(entry);
  return {
    checked: true,
    migrationCount: entries.length,
    legacyCount: entries.length - classified.length,
    classifiedCount: classified.length,
    dataBearingCount: entries.filter((entry) => entry.hasDataMutation).length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let result;
  if (args.check) {
    result = localCheck();
  } else if (args["plan-remote"]) {
    const productionSha = String(args["production-sha"] ?? process.env.LENSICALLY_PRODUCTION_SHA ?? "");
    result = planRemote(productionSha);
    const output = String(args.output ?? "");
    if (!output) fail("migration_plan_output_missing");
    writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  } else if (args["apply-remote"]) {
    const productionSha = String(args["production-sha"] ?? process.env.LENSICALLY_PRODUCTION_SHA ?? "");
    result = applyRemote({ productionSha, planPath: String(args.plan ?? "") });
  } else if (args["verify-remote"]) {
    result = verifyRemote();
  } else {
    fail("migration_release_mode_required");
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export { DIRECTIVE_PREFIX, MIGRATION_PATH_PREFIX, inspectSql, parseDirectives, stableJson };
