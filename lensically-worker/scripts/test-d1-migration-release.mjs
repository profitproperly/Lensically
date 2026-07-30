import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  auditRepositoryMigrations,
  parseWranglerLedgerJson,
    reconcileProductionPrefix,
  validateClassificationBoundary,
  validateUnappliedMigration,
} from "./d1-migration-release.mjs";

function withMigrations(files, callback) {
  const directory = mkdtempSync(resolve(tmpdir(), "lensically-d1-migrations-"));
  try {
    for (const [name, source] of Object.entries(files)) {
      writeFileSync(resolve(directory, name), source);
    }
    return callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function expectFailure(callback, code) {
  assert.throws(callback, (error) => {
    assert.match(String(error?.message ?? error), new RegExp(`^${code}`));
    return true;
  });
}

withMigrations({
  "0000_legacy.sql": "CREATE TABLE legacy_table (id INTEGER PRIMARY KEY);\n",
  "0001_receipts.sql": [
    "-- lensically-migration-class: schema",
    "-- lensically-migration-owner: release-engineering",
    "-- lensically-migration-risk: low",
    "CREATE TABLE migration_receipts (id INTEGER PRIMARY KEY);",
    "",
  ].join("\n"),
}, (directory) => {
  const entries = auditRepositoryMigrations(directory);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].migrationClass, "legacy-unclassified");
  assert.equal(entries[1].migrationClass, "schema");
    validateClassificationBoundary(entries);
  validateUnappliedMigration(entries[1]);
});

withMigrations({
  "0000_legacy.sql": "CREATE TABLE legacy_table (id INTEGER PRIMARY KEY);\n",
  "0001_classified.sql": [
    "-- lensically-migration-class: schema",
    "-- lensically-migration-owner: release-engineering",
    "-- lensically-migration-risk: low",
    "CREATE TABLE classified_table (id INTEGER PRIMARY KEY);",
  ].join("\n"),
  "0002_missing_metadata.sql": "CREATE TABLE missing_metadata (id INTEGER PRIMARY KEY);\n",
}, (directory) => {
  const entries = auditRepositoryMigrations(directory);
  expectFailure(() => validateClassificationBoundary(entries), "migration_classification_boundary_regressed");
});

withMigrations({
  "0000_first.sql": "CREATE TABLE first_table (id INTEGER);\n",
  "0002_gap.sql": "CREATE TABLE gap_table (id INTEGER);\n",
}, (directory) => {
  expectFailure(() => auditRepositoryMigrations(directory), "migration_order_not_contiguous");
});

withMigrations({
  "0000_seed.sql": [
    "-- lensically-migration-class: schema",
    "-- lensically-migration-owner: release-engineering",
    "-- lensically-migration-risk: low",
    "CREATE TABLE seeded_table (id INTEGER);",
    "INSERT INTO seeded_table (id) VALUES (1);",
  ].join("\n"),
}, (directory) => {
  const [entry] = auditRepositoryMigrations(directory);
  expectFailure(() => validateUnappliedMigration(entry), "schema_migration_contains_data_mutation");
});

withMigrations({
  "0000_backfill.sql": [
    "-- lensically-migration-class: backfill",
    "-- lensically-migration-owner: release-engineering",
    "-- lensically-migration-risk: medium",
    "UPDATE records SET normalized = 1 WHERE normalized = 0;",
  ].join("\n"),
}, (directory) => {
  const [entry] = auditRepositoryMigrations(directory);
  expectFailure(() => validateUnappliedMigration(entry), "migration_backfill_forbidden_in_normal_directory");
});

withMigrations({
  "0000_drop.sql": [
    "-- lensically-migration-class: schema",
    "-- lensically-migration-owner: release-engineering",
    "-- lensically-migration-risk: low",
    "DROP TABLE old_records;",
  ].join("\n"),
}, (directory) => {
  const [entry] = auditRepositoryMigrations(directory);
  expectFailure(() => validateUnappliedMigration(entry), "migration_unsafe_statement");
});

const parsedRows = parseWranglerLedgerJson(JSON.stringify([
  {
    results: [
      { id: 1, name: "0000_first.sql", applied_at: "2026-07-29T00:00:00Z" },
      { id: 2, name: "0001_second.sql", applied_at: "2026-07-29T00:01:00Z" },
    ],
    success: true,
  },
]));
assert.deepEqual(parsedRows.map((row) => row.name), ["0000_first.sql", "0001_second.sql"]);

const repositoryEntries = [
  { name: "0000_first.sql" },
  { name: "0001_second.sql" },
  { name: "0002_third.sql" },
];
assert.deepEqual(
  reconcileProductionPrefix(repositoryEntries, parsedRows).map((entry) => entry.name),
  ["0002_third.sql"],
);
expectFailure(
  () => reconcileProductionPrefix(repositoryEntries, [{ id: 1, name: "9999_unknown.sql" }]),
  "migration_production_ledger_not_exact_prefix",
);
expectFailure(
  () => reconcileProductionPrefix(repositoryEntries, [
    { id: 1, name: "0000_first.sql" },
    { id: 2, name: "0000_first.sql" },
  ]),
  "migration_production_ledger_duplicate",
);

process.stdout.write("d1_migration_release_contract_valid\n");
