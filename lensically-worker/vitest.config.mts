import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  defineWorkersConfig,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

const root = dirname(fileURLToPath(import.meta.url));
const migrations = await readD1Migrations(join(root, "database/migrations"));

export default defineWorkersConfig({
  test: {
    setupFiles: ["./test/apply-migrations.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
                miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
                                        d1Databases: {
            UPGRADE_DB: { id: "lensically-upgrade-test" },
                        IDENTITY_UPGRADE_DB: { id: "lensically-identity-upgrade-test" },
                        MEASUREMENT_UPGRADE_DB: { id: "lensically-measurement-upgrade-test" },
            GENERATION_UPGRADE_DB: { id: "lensically-generation-upgrade-test" },
          },
        },
        isolatedStorage: false,
      },
    },
  },
});

