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
                        SOURCE_UPGRADE_DB: { id: "lensically-source-upgrade-test" },
                        QUALITY_UPGRADE_DB: { id: "lensically-quality-upgrade-test" },
                        CONTINUITY_UPGRADE_DB: { id: "lensically-continuity-upgrade-test" },
                        CYCLE_DECISION_UPGRADE_DB: { id: "lensically-cycle-decision-upgrade-test" },
                        ASSURANCE_UPGRADE_DB: { id: "lensically-assurance-upgrade-test" },
                        WORK_STATE_UPGRADE_DB: { id: "lensically-work-state-upgrade-test" },
            EXECUTION_CONTROL_UPGRADE_DB: { id: "lensically-execution-control-upgrade-test" },
          },
        },
        isolatedStorage: false,
      },
    },
  },
});

