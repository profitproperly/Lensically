import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";

type TestMigrationBinding = Parameters<typeof applyD1Migrations>[1];

type MigrationRow = { name: string };
type MigrationLockRow = { status: string; error_message: string | null };

const MIGRATION_LOCK_POLL_MS = 100;
const MIGRATION_LOCK_MAX_POLLS = 300;

function expectedMigrationNames(migrations: TestMigrationBinding): string[] {
  if (!Array.isArray(migrations)) return [];
  return migrations
    .map((migration) => {
      const name = (migration as { name?: unknown }).name;
      return typeof name === "string" ? name : "";
    })
    .filter(Boolean)
    .sort();
}

async function hasExactMigrationLedger(
  database: typeof env.DB,
  expectedNames: readonly string[],
): Promise<boolean> {
  try {
    const result = await database
      .prepare("SELECT name FROM lensically_test_migrations ORDER BY name ASC")
      .all<MigrationRow>();
    const actualNames = (result.results ?? []).map((row) => row.name).sort();
    if (actualNames.length === 0) return false;
    if (actualNames.length === expectedNames.length
        && actualNames.every((name, index) => name === expectedNames[index])) {
      return true;
    }
    throw new Error(`test_migration_ledger_mismatch:${JSON.stringify({ expectedNames, actualNames })}`);
  } catch (error) {
    if (String(error).includes("no such table: lensically_test_migrations")) return false;
    throw error;
  }
}

async function waitForMigrationOwner(
  database: typeof env.DB,
  expectedNames: readonly string[],
): Promise<void> {
  for (let poll = 0; poll < MIGRATION_LOCK_MAX_POLLS; poll += 1) {
    const lock = await database
      .prepare("SELECT status, error_message FROM lensically_test_migration_lock WHERE id = 1")
      .first<MigrationLockRow>();
    if (lock?.status === "completed") {
      if (await hasExactMigrationLedger(database, expectedNames)) return;
      throw new Error("test_migration_owner_completed_without_exact_ledger");
    }
    if (lock?.status === "failed") {
      throw new Error(`test_migration_owner_failed:${lock.error_message ?? "unknown"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, MIGRATION_LOCK_POLL_MS));
  }
  throw new Error("test_migration_owner_timeout");
}

beforeAll(async () => {
  const testEnv = env as typeof env & { TEST_MIGRATIONS: TestMigrationBinding };
  const migrationNames = expectedMigrationNames(testEnv.TEST_MIGRATIONS);
  if (migrationNames.length === 0) {
    throw new Error("test_migration_binding_empty");
  }

  await testEnv.DB.prepare(
    `CREATE TABLE IF NOT EXISTS lensically_test_migration_lock (
      id INTEGER PRIMARY KEY,
      status TEXT NOT NULL,
      error_message TEXT
    )`,
  ).run();
  const claim = await testEnv.DB.prepare(
    "INSERT OR IGNORE INTO lensically_test_migration_lock (id, status, error_message) VALUES (1, 'running', NULL)",
  ).run();
  const ownsMigration = Number(claim.meta.changes ?? 0) === 1;
  if (!ownsMigration) {
    await waitForMigrationOwner(testEnv.DB, migrationNames);
    return;
  }

  try {
    if (!(await hasExactMigrationLedger(testEnv.DB, migrationNames))) {
      await applyD1Migrations(
        testEnv.DB,
        testEnv.TEST_MIGRATIONS,
        "lensically_test_migrations",
      );
    }
    await testEnv.DB.prepare(
      "UPDATE lensically_test_migration_lock SET status = 'completed', error_message = NULL WHERE id = 1",
    ).run();
  } catch (error) {
    await testEnv.DB.prepare(
      "UPDATE lensically_test_migration_lock SET status = 'failed', error_message = ? WHERE id = 1",
    ).bind(error instanceof Error ? error.message : String(error)).run();
    throw error;
  }
});
