import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";

type TestMigrationBinding = Parameters<typeof applyD1Migrations>[1];

beforeAll(async () => {
  const testEnv = env as typeof env & { TEST_MIGRATIONS: TestMigrationBinding };
  await applyD1Migrations(
    testEnv.DB,
    testEnv.TEST_MIGRATIONS,
    "lensically_test_migrations",
  );
});
