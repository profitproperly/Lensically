import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  extractMigrationNames,
  planMigrationRelease,
  readRepositoryMigrations,
  validateMigrationHistory,
  verifyMigrationRelease,
} from "../scripts/plan-d1-migration-release.mjs";

const migration = (name: string, source: string) => ({
  name,
  sequence: Number(name.slice(0, 4)),
  sha256: `hash-${name}`,
  source,
});

const schemaSource = "-- lensically-release-class: schema\nCREATE TABLE IF NOT EXISTS example (id INTEGER PRIMARY KEY);\n";

describe("D1 migration release planner", () => {
  it("extracts ordered migration names from Wrangler execute and list payloads", () => {
    const names = extractMigrationNames([
      { results: [{ name: "0001_initial.sql" }, { name: "0002_next.sql" }] },
      { migrations: [{ migration_name: "0002_next.sql" }] },
    ]);
    expect(names).toEqual(["0001_initial.sql", "0002_next.sql"]);
  });

  it("returns noop when the production ledger exactly covers the repository", () => {
    const repositoryMigrations = [
      migration("0001_initial.sql", schemaSource),
      migration("0002_next.sql", schemaSource),
    ];
    const plan = planMigrationRelease({
      repositoryMigrations,
      appliedNames: ["0001_initial.sql", "0002_next.sql"],
      unappliedNames: [],
      changedMigrationEntries: [],
    });
    expect(plan).toMatchObject({ action: "noop", pending_migration_count: 0, normal_apply_allowed: false });
  });

  it("plans only the exact safe schema suffix reported by Wrangler", () => {
    const repositoryMigrations = [
      migration("0001_initial.sql", schemaSource),
      migration("0002_next.sql", schemaSource),
    ];
    const plan = planMigrationRelease({
      repositoryMigrations,
      appliedNames: ["0001_initial.sql"],
      unappliedNames: ["0002_next.sql"],
      changedMigrationEntries: [{ status: "A", paths: ["database/migrations/0002_next.sql"] }],
    });
    expect(plan).toMatchObject({
      action: "apply_schema",
      pending_migrations: ["0002_next.sql"],
      schema_pending_migrations: ["0002_next.sql"],
      normal_apply_allowed: true,
    });
  });

  it("fails closed when the production ledger is not an exact repository prefix", () => {
    expect(() => planMigrationRelease({
      repositoryMigrations: [migration("0001_initial.sql", schemaSource)],
      appliedNames: ["9999_unknown.sql"],
      unappliedNames: [],
      changedMigrationEntries: [],
    })).toThrow(/production_migration_ledger_not_repository_prefix/);
  });

  it("fails closed when Wrangler pending evidence differs from the repository suffix", () => {
    expect(() => planMigrationRelease({
      repositoryMigrations: [
        migration("0001_initial.sql", schemaSource),
        migration("0002_next.sql", schemaSource),
      ],
      appliedNames: ["0001_initial.sql"],
      unappliedNames: [],
      changedMigrationEntries: [],
    })).toThrow(/wrangler_unapplied_list_mismatch/);
  });

  it("rejects modified, deleted, or renamed migration history", () => {
    expect(() => validateMigrationHistory([
      { status: "M", paths: ["database/migrations/0001_initial.sql"] },
    ])).toThrow(/applied_migration_history_mutated/);
  });

  it("rejects destructive or data-bearing statements from the normal schema lane", () => {
    expect(() => planMigrationRelease({
      repositoryMigrations: [migration(
        "0001_initial.sql",
        "-- lensically-release-class: schema\nUPDATE users SET active = 1;\n",
      )],
      appliedNames: [],
      unappliedNames: ["0001_initial.sql"],
      changedMigrationEntries: [{ status: "A", paths: ["database/migrations/0001_initial.sql"] }],
    })).toThrow(/unsafe_schema_migration/);
  });

  it("blocks backfill-class migrations from the standard release lane", () => {
    const plan = planMigrationRelease({
      repositoryMigrations: [migration(
        "0001_backfill.sql",
        "-- lensically-release-class: backfill\nUPDATE users SET active = 1 WHERE active IS NULL;\n",
      )],
      appliedNames: [],
      unappliedNames: ["0001_backfill.sql"],
      changedMigrationEntries: [{ status: "A", paths: ["database/migrations/0001_backfill.sql"] }],
    });
    expect(plan).toMatchObject({
      action: "backfill_required",
      normal_apply_allowed: false,
      long_running_backfill_required: true,
    });
  });

  it("verifies the exact complete post-apply ledger and unchanged repository identity", () => {
    const repositoryMigrations = [migration("0001_initial.sql", schemaSource)];
    const plan = planMigrationRelease({
      repositoryMigrations,
      appliedNames: [],
      unappliedNames: ["0001_initial.sql"],
      changedMigrationEntries: [{ status: "A", paths: ["database/migrations/0001_initial.sql"] }],
    });
    expect(verifyMigrationRelease({
      repositoryMigrations,
      appliedNames: ["0001_initial.sql"],
      unappliedNames: [],
      plan,
    })).toMatchObject({ status: "verified", applied_migration_count: 1 });
  });

  it("enforces contiguous four-digit migration ordering from the policy", () => {
    const root = mkdtempSync(join(tmpdir(), "lensically-migration-plan-"));
    try {
      mkdirSync(join(root, "database", "migrations"), { recursive: true });
      writeFileSync(join(root, "database", "migration-release-policy.json"), JSON.stringify({
        version: "lensically-migration-release-policy-v1",
        filename_pattern: "^\\d{4}_[a-z0-9][a-z0-9_]*\\.sql$",
        sequence_starts_at: 1,
      }));
      writeFileSync(join(root, "database", "migrations", "0001_initial.sql"), schemaSource);
      writeFileSync(join(root, "database", "migrations", "0003_gap.sql"), schemaSource);
      expect(() => readRepositoryMigrations(root)).toThrow(/migration_sequence_invalid/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
