#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

export const SHADOW_DATABASE_NAME = "lensically-shadow-db";
export const SHADOW_DATABASE_BINDING = "SHADOW_DB";
export const SHADOW_MIGRATIONS_TABLE = "lensically_shadow_d1_migrations";

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) values.set(key, true);
    else {
      values.set(key, value);
      index += 1;
    }
  }
  return values;
}

function runWrangler(args, options = {}) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: options.cwd ?? process.cwd(),
    env: process.env,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    throw new Error(`shadow_d1_wrangler_failed:${args.join(" ")}:${detail}`);
  }
  return String(result.stdout ?? "").trim();
}

function parseJsonOutput(output, label) {
  const firstObject = output.indexOf("[");
  const firstSingle = output.indexOf("{");
  const start = firstObject === -1
    ? firstSingle
    : firstSingle === -1
      ? firstObject
      : Math.min(firstObject, firstSingle);
  if (start < 0) throw new Error(`shadow_d1_${label}_json_missing`);
  try {
    return JSON.parse(output.slice(start));
  } catch (error) {
    throw new Error(`shadow_d1_${label}_json_invalid:${error instanceof Error ? error.message : String(error)}`);
  }
}

export function selectShadowDatabaseId(listPayload, databaseName = SHADOW_DATABASE_NAME) {
  const rows = Array.isArray(listPayload)
    ? listPayload
    : Array.isArray(listPayload?.result)
      ? listPayload.result
      : [];
  const row = rows.find((candidate) => String(candidate?.name ?? candidate?.database_name ?? "") === databaseName);
  const id = String(row?.uuid ?? row?.id ?? row?.database_id ?? "").trim();
  return id || null;
}

export function injectShadowDatabaseBinding(config, databaseId) {
  if (!databaseId) throw new Error("shadow_d1_database_id_required");
  const databases = Array.isArray(config.d1_databases) ? [...config.d1_databases] : [];
  const production = databases.find((entry) => entry?.binding === "DB");
  const migrationsDir = production?.migrations_dir ?? "database/migrations";
  const filtered = databases.filter((entry) => entry?.binding !== SHADOW_DATABASE_BINDING);
  filtered.push({
    binding: SHADOW_DATABASE_BINDING,
    database_name: SHADOW_DATABASE_NAME,
    database_id: databaseId,
    migrations_dir: migrationsDir,
    migrations_table: SHADOW_MIGRATIONS_TABLE,
  });
  return { ...config, d1_databases: filtered };
}

export function verifyShadowBinding(config) {
  const rows = Array.isArray(config.d1_databases) ? config.d1_databases : [];
  const production = rows.find((entry) => entry?.binding === "DB");
  const shadow = rows.find((entry) => entry?.binding === SHADOW_DATABASE_BINDING);
  if (!production || !shadow) throw new Error("shadow_d1_dual_binding_required");
  if (production.database_id === shadow.database_id) throw new Error("shadow_d1_physical_isolation_failed");
  if (production.migrations_dir !== shadow.migrations_dir) throw new Error("shadow_d1_migration_directory_drift");
  if (shadow.migrations_table !== SHADOW_MIGRATIONS_TABLE) throw new Error("shadow_d1_migration_ledger_invalid");
  return true;
}

function ensureShadowDatabase() {
  const listed = parseJsonOutput(runWrangler(["d1", "list", "--json"]), "list");
  const existingId = selectShadowDatabaseId(listed);
  if (existingId) return existingId;
  const created = parseJsonOutput(
    runWrangler(["d1", "create", SHADOW_DATABASE_NAME, "--json"]),
    "create",
  );
  const createdId = String(
    created?.uuid
      ?? created?.id
      ?? created?.database_id
      ?? created?.result?.uuid
      ?? created?.result?.id
      ?? "",
  ).trim();
  if (!createdId) throw new Error("shadow_d1_create_id_missing");
  return createdId;
}

function migrateAndVerify(configPath) {
  runWrangler([
    "d1", "migrations", "apply", SHADOW_DATABASE_BINDING,
    "--remote", "--config", configPath,
  ]);
  const output = runWrangler([
    "d1", "execute", SHADOW_DATABASE_BINDING,
    "--remote", "--config", configPath,
    "--command",
    "SELECT COUNT(*) AS table_count FROM sqlite_schema WHERE type = 'table' AND name IN ('manifest_shadow_runs','manifest_shadow_snapshots','manifest_shadow_stage_events','manifest_shadow_diagnostic_archives','manifest_shadow_benchmark_receipts');",
    "--json",
  ]);
  const verification = parseJsonOutput(output, "verify");
  const resultRows = Array.isArray(verification)
    ? verification.flatMap((entry) => entry?.results ?? entry?.result?.results ?? [])
    : verification?.results ?? verification?.result?.results ?? [];
  const count = Number(resultRows[0]?.table_count ?? 0);
  if (count !== 5) throw new Error(`shadow_d1_schema_verification_failed:${count}`);
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const inputPath = String(args.get("--config") ?? "wrangler.release.generated.json");
  const outputPath = String(args.get("--output") ?? inputPath);
  const config = JSON.parse(readFileSync(inputPath, "utf8"));
  const databaseId = ensureShadowDatabase();
  const updated = injectShadowDatabaseBinding(config, databaseId);
  verifyShadowBinding(updated);
  writeFileSync(outputPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  migrateAndVerify(outputPath);
  process.stdout.write(JSON.stringify({
    ok: true,
    binding: SHADOW_DATABASE_BINDING,
    database_name: SHADOW_DATABASE_NAME,
    database_id_suffix: databaseId.slice(-8),
    config: outputPath,
    canonical_migrations: true,
    schema_verified: true,
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
