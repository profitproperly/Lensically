import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(scriptDirectory, "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function normalizedPath(root, path) {
  return relative(root, path).replaceAll("\\", "/");
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function collectMatches(source, pattern) {
  return Array.from(source.matchAll(pattern), (match) => match[1]);
}

function collectRuntimeDdl(root) {
  const sourceRoot = resolve(root, "src");
  const records = [];
  for (const absolutePath of walk(sourceRoot).filter((path) => path.endsWith(".ts"))) {
    const source = readFileSync(absolutePath, "utf8");
    const sourcePath = normalizedPath(root, absolutePath);
    const definitions = [
      ["table", /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+[\[\]`"']*([A-Za-z_][A-Za-z0-9_]*)/gi],
      ["alter_table", /ALTER\s+TABLE\s+[\[\]`"']*([A-Za-z_][A-Za-z0-9_]*)/gi],
      ["index", /CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+[\[\]`"']*[A-Za-z_][A-Za-z0-9_]*[\[\]`"']*\s+ON\s+[\[\]`"']*([A-Za-z_][A-Za-z0-9_]*)/gi],
      ["trigger", /CREATE\s+TRIGGER\s+IF\s+NOT\s+EXISTS\s+[\[\]`"']*[A-Za-z_][A-Za-z0-9_]*[\[\]`"']*[\s\S]{0,500}?\bON\s+[\[\]`"']*([A-Za-z_][A-Za-z0-9_]*)/gi],
      ["drop_table", /DROP\s+TABLE\s+IF\s+EXISTS\s+[\[\]`"']*([A-Za-z_][A-Za-z0-9_]*)/gi],
    ];
    for (const [kind, pattern] of definitions) {
      for (const table of collectMatches(source, pattern)) {
        records.push({ source: sourcePath, kind, table });
      }
    }
  }
  return records;
}

function tableOwnerMap(records, suffixes) {
  const temporary = new Set();
  const owners = new Map();
  for (const record of records.filter((item) => item.kind === "table")) {
    if (suffixes.some((suffix) => record.table.endsWith(suffix))) {
      temporary.add(record.table);
      continue;
    }
    if (!owners.has(record.table)) owners.set(record.table, new Set());
    owners.get(record.table).add(record.source);
  }
  return { owners, temporary: sortedUnique(temporary) };
}
export function validateDatabaseAuthority(root = defaultRoot) {
  const manifestPath = resolve(root, "database/schema-authority.json");
  if (!existsSync(manifestPath)) throw new Error("database_authority_manifest_missing");
  const manifest = readJson(manifestPath);
  const errors = [];
  if (manifest.version !== "lensically-database-authority-v1") errors.push("database_authority_version_invalid");
    if (manifest.canonical_migration_directory !== "database/migrations") errors.push("canonical_migration_directory_invalid");


  const records = collectRuntimeDdl(root);
  const runtimeSources = sortedUnique(records.map((record) => record.source));
  const declaredSources = sortedUnique(manifest.runtime_ddl_sources ?? []);
  const undeclaredSources = runtimeSources.filter((source) => !declaredSources.includes(source));
  const staleDeclaredSources = declaredSources.filter((source) => !runtimeSources.includes(source));
  for (const source of undeclaredSources) errors.push(`undeclared_runtime_ddl_source:${source}`);
  for (const source of staleDeclaredSources) errors.push(`stale_runtime_ddl_source:${source}`);

  const { owners, temporary } = tableOwnerMap(records, manifest.temporary_table_suffixes ?? []);
  const duplicateOwners = new Map(
    [...owners.entries()].filter(([, sources]) => sources.size > 1),
  );
  const declaredDuplicates = manifest.declared_duplicate_owners ?? {};
  for (const [table, sources] of duplicateOwners.entries()) {
    const declaration = declaredDuplicates[table];
    const actualSources = sortedUnique(sources);
    if (!declaration) {
      errors.push(`undeclared_duplicate_table_owner:${table}:${actualSources.join(",")}`);
      continue;
    }
    const expectedSources = sortedUnique(declaration.temporary_sources ?? []);
    if (JSON.stringify(actualSources) !== JSON.stringify(expectedSources)) {
      errors.push(`duplicate_table_owner_set_mismatch:${table}:${actualSources.join(",")}:${expectedSources.join(",")}`);
    }
    if (!actualSources.includes(declaration.canonical_source)) {
      errors.push(`duplicate_table_canonical_owner_missing:${table}:${declaration.canonical_source}`);
    }
  }
  for (const table of Object.keys(declaredDuplicates)) {
    if (!duplicateOwners.has(table)) errors.push(`stale_duplicate_table_declaration:${table}`);
  }

  const retiredTables = sortedUnique(manifest.retired_tables ?? []);
  const actualRetiredRecreations = sortedUnique(retiredTables.filter((table) => owners.has(table)));
  const expectedRetiredRecreations = sortedUnique(manifest.temporary_retired_table_recreations ?? []);
  if (JSON.stringify(actualRetiredRecreations) !== JSON.stringify(expectedRetiredRecreations)) {
    errors.push(`retired_table_recreation_set_mismatch:${actualRetiredRecreations.join(",")}:${expectedRetiredRecreations.join(",")}`);
  }

  const explicitDrops = sortedUnique(records.filter((record) => record.kind === "drop_table").map((record) => record.table));
  const unexpectedDrops = explicitDrops.filter((table) => !retiredTables.includes(table));
  for (const table of unexpectedDrops) errors.push(`undeclared_runtime_table_drop:${table}`);

    const wranglerConfig = readFileSync(resolve(root, "wrangler.jsonc"), "utf8");
  if (!wranglerConfig.includes('"migrations_dir": "database/migrations"')) errors.push("wrangler_migration_directory_missing");
  if (!wranglerConfig.includes('"migrations_table": "lensically_d1_migrations"')) errors.push("wrangler_migration_ledger_missing");
  const releaseWorkflow = readFileSync(resolve(root, "../.github/workflows/lensically-engineering.yml"), "utf8");
    if (!releaseWorkflow.includes("wrangler d1 migrations apply lensically-db --remote --config wrangler.jsonc")) {
    errors.push("release_migration_apply_missing");
  }
  if (!releaseWorkflow.includes("\n      - name: Apply exact-head database migrations\n        working-directory: lensically-worker")) {
    errors.push("release_migration_step_indentation_invalid");
  }


  const migrationDirectory = resolve(root, manifest.canonical_migration_directory);

  if (!existsSync(migrationDirectory)) errors.push("canonical_migration_directory_missing");
  const migrationFiles = existsSync(migrationDirectory)
    ? readdirSync(migrationDirectory).filter((name) => name.endsWith(".sql")).sort()
    : [];
    if (migrationFiles.length === 0) errors.push("versioned_migrations_missing");

  const migrationSource = migrationFiles
    .map((name) => readFileSync(resolve(migrationDirectory, name), "utf8"))
    .join("\n");
    const extractedTables = sortedUnique(manifest.extracted_tables ?? []);
  const migrationDependencyTables = sortedUnique(manifest.migration_dependency_tables ?? []);
  for (const table of extractedTables) {
    const runtimeOwnership = records.filter((record) =>
      record.table === table && ["table", "alter_table", "index", "trigger"].includes(record.kind));
    if (runtimeOwnership.length > 0) {
      errors.push(`extracted_table_runtime_ddl_present:${table}:${runtimeOwnership.map((record) => `${record.kind}@${record.source}`).join(",")}`);
    }
    const tablePattern = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`, "i");
        if (!tablePattern.test(migrationSource)) errors.push(`extracted_table_migration_owner_missing:${table}`);
  }
    for (const table of migrationDependencyTables) {
    const tablePattern = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`, "i");
    if (!tablePattern.test(migrationSource)) errors.push(`migration_dependency_owner_missing:${table}`);
  }
  if (manifest.index_runtime_ddl_complete === true) {
    const indexRuntimeDdl = records.filter((record) =>
      record.source === "src/index.ts" && ["table", "alter_table", "index", "trigger", "drop"].includes(record.kind));
    if (indexRuntimeDdl.length > 0) {
      errors.push(`index_runtime_ddl_present:${indexRuntimeDdl.map((record) => `${record.kind}:${record.table}`).join(",")}`);
    }
  }

  const vitestConfig = readFileSync(resolve(root, "vitest.config.mts"), "utf8");
  const migrationSetup = readFileSync(resolve(root, "test/apply-migrations.ts"), "utf8");
  const migrationTests = readFileSync(resolve(root, "test/databaseMigrations.spec.ts"), "utf8");
  if (!vitestConfig.includes("readD1Migrations") || !vitestConfig.includes("TEST_MIGRATIONS")) {
    errors.push("test_migration_binding_missing");
  }
  if (!migrationSetup.includes("applyD1Migrations") || !migrationSetup.includes("lensically_test_migrations")) {
    errors.push("test_migration_bootstrap_missing");
  }
    if (!migrationTests.includes("reapplies the canonical migration ledger without losing existing data")) {
    errors.push("migration_idempotency_regression_missing");
  }
    if (!migrationTests.includes("upgrades the legacy scheduled-deletion schema before backfilling new fields")) {
    errors.push("existing_database_upgrade_regression_missing");
  }
      if (!migrationTests.includes("upgrades legacy account keys while preserving tokens, profiles, and deletion receipts")) {
    errors.push("identity_migration_upgrade_regression_missing");
  }
    if (!migrationTests.includes("adopts the live measurement schema without losing caches, archive history, or learning metadata")) {
    errors.push("measurement_storage_upgrade_regression_missing");
  }
    if (!migrationTests.includes("adopts the live generation schema without losing adaptation, gate, or preflight lineage")) {
    errors.push("generation_lineage_upgrade_regression_missing");
  }
    if (!migrationTests.includes("adopts the live source lineage schema without losing draw, claim, exclusion, or version state")) {
    errors.push("source_lineage_upgrade_regression_missing");
  }
  if (!migrationTests.includes("preserves quality enforcement records across migration replay")) {
    errors.push("quality_enforcement_replay_regression_missing");
  }
    if (!migrationTests.includes("adopts the live quality enforcement schema without losing gate, evidence, inventory, or requirement state")) {
    errors.push("quality_enforcement_upgrade_regression_missing");
  }
  if (!migrationTests.includes("preserves operator continuity and autonomy records across migration replay")) {
    errors.push("operator_continuity_replay_regression_missing");
  }
    if (!migrationTests.includes("adopts the live operator continuity schema without losing session, receipt, mission, revision, or autonomy state")) {
    errors.push("operator_continuity_upgrade_regression_missing");
  }
  if (!migrationTests.includes("preserves autonomous cycle and protected decision records across migration replay")) {
    errors.push("autonomous_cycle_decision_replay_regression_missing");
  }
    if (!migrationTests.includes("adopts the live autonomous cycle and protected decision schema without losing lineage or budgets")) {
    errors.push("autonomous_cycle_decision_upgrade_regression_missing");
  }
  if (!migrationTests.includes("preserves operational assurance records across migration replay")) {
    errors.push("operational_assurance_replay_regression_missing");
  }
    if (!migrationTests.includes("adopts the live assurance schema without losing incidents, audit receipts, events, or observations")) {
    errors.push("operational_assurance_upgrade_regression_missing");
  }
  if (!migrationTests.includes("preserves durable work state, ledger, and repo-write sessions across migration replay")) {
    errors.push("durable_work_state_replay_regression_missing");
  }
    if (!migrationTests.includes("adopts the live durable work schema and completes legacy retirements without data loss")) {
    errors.push("durable_work_state_upgrade_regression_missing");
  }
  if (!migrationTests.includes("preserves execution checkpoints, persistent routes, and decision events across migration replay")) {
    errors.push("execution_control_replay_regression_missing");
  }
    if (!migrationTests.includes("adopts the live execution-control schema without losing checkpoints, routes, or events")) {
    errors.push("execution_control_upgrade_regression_missing");
  }
  if (!migrationTests.includes("preserves performance learning and content focus state across migration replay")) {
    errors.push("performance_focus_replay_regression_missing");
  }
  if (!migrationTests.includes("adopts the live performance learning and content focus schema without data loss")) {
    errors.push("performance_focus_upgrade_regression_missing");
  }
  if (!migrationTests.includes("enforces parent-user guards and cascades cleanup through scheduling tables")) {
    errors.push("scheduling_migration_behavior_regression_missing");
  }
  if (!releaseWorkflow.includes("test/databaseMigrations.spec.ts")) {
    errors.push("migration_regression_release_gate_missing");
  }

  const receipt = {
    ok: errors.length === 0,
    version: manifest.version,
    status: manifest.status,
    canonical_migration_directory: manifest.canonical_migration_directory,
    active_table_count: owners.size,
    runtime_ddl_source_count: runtimeSources.length,
    runtime_ddl_sources: runtimeSources,
    runtime_statement_counts: Object.fromEntries(
      ["table", "alter_table", "index", "trigger", "drop_table"].map((kind) => [kind, records.filter((record) => record.kind === kind).length]),
    ),
    duplicate_table_owners: Object.fromEntries(
      [...duplicateOwners.entries()].map(([table, sources]) => [table, sortedUnique(sources)]),
    ),
    temporary_tables: temporary,
    retired_table_recreations: actualRetiredRecreations,
        migration_file_count: migrationFiles.length,
        extracted_tables: extractedTables,
    migration_dependency_tables: migrationDependencyTables,
    errors,
  };
  if (errors.length > 0) {
    throw new Error(`database_authority_invalid:${JSON.stringify(receipt)}`);
  }
  return receipt;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const receipt = validateDatabaseAuthority();
  if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  else console.log(`[database-authority] ok tables=${receipt.active_table_count} sources=${receipt.runtime_ddl_source_count} migrations=${receipt.migration_file_count} duplicates=${Object.keys(receipt.duplicate_table_owners).length} retired_recreations=${receipt.retired_table_recreations.length}`);
}
