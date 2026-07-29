import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const LEGACY_MIGRATION_PLANNER_STATUS = "retired";
export const CANONICAL_MIGRATION_PLANNER = "scripts/d1-migration-release.mjs";
export const RETIREMENT_REASON = "Stage 8E removed the competing migration policy and planner. All migration release planning, application, and verification is owned exclusively by scripts/d1-migration-release.mjs.";

export function legacyMigrationPlannerRetired() {
  return {
    status: LEGACY_MIGRATION_PLANNER_STATUS,
    canonical_planner: CANONICAL_MIGRATION_PLANNER,
    error_code: "legacy_migration_planner_retired",
    reason: RETIREMENT_REASON,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stderr.write(`${JSON.stringify(legacyMigrationPlannerRetired())}\n`);
  process.exitCode = 1;
}
