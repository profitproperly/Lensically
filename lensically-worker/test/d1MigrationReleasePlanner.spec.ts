import { describe, expect, it } from "vitest";
import {
  CANONICAL_MIGRATION_PLANNER,
  LEGACY_MIGRATION_PLANNER_STATUS,
  legacyMigrationPlannerRetired,
} from "../scripts/plan-d1-migration-release.mjs";

describe("retired D1 migration planner compatibility tombstone", () => {
  it("fails stale callers toward the sole canonical planner", () => {
    expect(LEGACY_MIGRATION_PLANNER_STATUS).toBe("retired");
    expect(CANONICAL_MIGRATION_PLANNER).toBe("scripts/d1-migration-release.mjs");
    expect(legacyMigrationPlannerRetired()).toMatchObject({
      status: "retired",
      canonical_planner: "scripts/d1-migration-release.mjs",
      error_code: "legacy_migration_planner_retired",
    });
  });
});
