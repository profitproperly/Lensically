import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";

type TestMigrationBinding = Parameters<typeof applyD1Migrations>[1];

type MigrationRow = { name: string };

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

beforeAll(async () => {
  const testEnv = env as typeof env & { TEST_MIGRATIONS: TestMigrationBinding };
  const migrationNames = expectedMigrationNames(testEnv.TEST_MIGRATIONS);
  if (migrationNames.length === 0) {
    throw new Error("test_migration_binding_empty");
  }
  if (await hasExactMigrationLedger(testEnv.DB, migrationNames)) return;
  await applyD1Migrations(
    testEnv.DB,
    testEnv.TEST_MIGRATIONS,
    "lensically_test_migrations",
  );
});
