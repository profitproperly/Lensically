import { describe, expect, it } from "vitest";
import { assertDatabaseIntegrity } from "../src/databaseIntegrity";

function databaseWith(result: (sql: string, call: number) => Promise<unknown>): D1Database {
  let calls = 0;
  return {
    prepare(sql: string) {
      return {
        async all() {
          calls += 1;
          return result(sql, calls);
        },
      } as unknown as D1PreparedStatement;
    },
  } as unknown as D1Database;
}

describe("database integrity runtime cache", () => {
  it("executes one D1 probe for repeated equivalent checks", async () => {
    let calls = 0;
    const db = databaseWith(async () => {
      calls += 1;
      return { results: [] };
    });

    await assertDatabaseIntegrity(db, { table: "operator_workflow_requirements", columns: ["id", "stage"] });
    await assertDatabaseIntegrity(db, { table: "operator_workflow_requirements", columns: ["stage", "id", "id"] });

    expect(calls).toBe(1);
  });

  it("does not cache a failed probe", async () => {
    let calls = 0;
    const db = databaseWith(async () => {
      calls += 1;
      if (calls === 1) throw new Error("temporary_d1_failure");
      return { results: [] };
    });

    await expect(assertDatabaseIntegrity(db, { table: "operator_workflow_requirements", columns: ["id"] }))
      .rejects.toThrow("database_integrity_failed:operator_workflow_requirements:temporary_d1_failure");
    await expect(assertDatabaseIntegrity(db, { table: "operator_workflow_requirements", columns: ["id"] }))
      .resolves.toBeUndefined();

    expect(calls).toBe(2);
  });
});
