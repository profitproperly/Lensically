import { describe, expect, it } from "vitest";
import {
  MANIFEST_SHADOW_OPERATIONAL_TABLES,
  MANIFEST_SHADOW_SNAPSHOT_VERSION,
  assertManifestShadowReadOnlySql,
  createManifestShadowNoThreadsMutationAdapter,
  createManifestShadowReadOnlyDatabase,
  resetManifestShadowWorkspace,
  seedManifestShadowSnapshot,
} from "../src/operatorManifestShadowService";

type Row = Record<string, unknown>;

class FakeStatement {
  constructor(
    private readonly db: FakeDatabase,
    private readonly sql: string,
    private readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]): FakeStatement {
    return new FakeStatement(this.db, this.sql, values);
  }

  async run(): Promise<{ success: true; meta: { changes: number } }> {
    this.db.runs.push({ sql: this.sql, values: this.values });
    return { success: true, meta: { changes: 1 } };
  }

  async first<T>(): Promise<T | null> {
    this.db.reads.push({ sql: this.sql, values: this.values });
    return ({ count: 0 } as unknown) as T;
  }

  async all<T>(): Promise<{ success: true; results: T[] }> {
    this.db.reads.push({ sql: this.sql, values: this.values });
    return { success: true, results: [] };
  }

  async raw<T>(): Promise<T[]> {
    this.db.reads.push({ sql: this.sql, values: this.values });
    return [];
  }
}

class FakeDatabase {
  readonly runs: Array<{ sql: string; values: unknown[] }> = [];
  readonly reads: Array<{ sql: string; values: unknown[] }> = [];

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this, sql);
  }

  async batch(): Promise<never> {
    throw new Error("batch should not be called");
  }

  async exec(): Promise<never> {
    throw new Error("exec should not be called");
  }
}

function fakeDb(): D1Database {
  return new FakeDatabase() as unknown as D1Database;
}

describe("operatorManifestShadowService", () => {
  it("allows one SELECT or read CTE and rejects production mutation SQL", () => {
    expect(() => assertManifestShadowReadOnlySql("SELECT * FROM scheduled_posts")).not.toThrow();
    expect(() => assertManifestShadowReadOnlySql("WITH x AS (SELECT 1) SELECT * FROM x")).not.toThrow();
    expect(() => assertManifestShadowReadOnlySql("UPDATE scheduled_posts SET status='posted'")).toThrow(
      "manifest_shadow_production_query_must_be_read_only",
    );
    expect(() => assertManifestShadowReadOnlySql("SELECT 1; DELETE FROM scheduled_posts")).toThrow(
      "manifest_shadow_multiple_sql_statements_forbidden",
    );
    expect(() => assertManifestShadowReadOnlySql("PRAGMA table_info(scheduled_posts)")).toThrow(
      "manifest_shadow_production_query_must_be_read_only",
    );
  });

  it("wraps production D1 so prepared run, batch, and exec fail closed", async () => {
    const database = new FakeDatabase();
    const readOnly = createManifestShadowReadOnlyDatabase(database as unknown as D1Database);

    await expect(readOnly.prepare("SELECT 1").first()).resolves.toEqual({ count: 0 });
    await expect(readOnly.prepare("SELECT 1").run()).rejects.toThrow(
      "manifest_shadow_production_mutation_forbidden",
    );
    await expect(readOnly.batch([])).rejects.toThrow("manifest_shadow_production_mutation_forbidden");
    await expect(readOnly.exec("SELECT 1")).rejects.toThrow("manifest_shadow_production_mutation_forbidden");
    expect(() => readOnly.prepare("DELETE FROM users")).toThrow(
      "manifest_shadow_production_query_must_be_read_only",
    );
    expect(database.runs).toHaveLength(0);
  });

  it("blocks every Threads mutation boundary and counts attempts", async () => {
    const adapter = createManifestShadowNoThreadsMutationAdapter();
    await expect(adapter.schedule()).rejects.toThrow("manifest_shadow_threads_mutation_forbidden");
    await expect(adapter.publish()).rejects.toThrow("manifest_shadow_threads_mutation_forbidden");
    await expect(adapter.edit()).rejects.toThrow("manifest_shadow_threads_mutation_forbidden");
    await expect(adapter.delete()).rejects.toThrow("manifest_shadow_threads_mutation_forbidden");
    expect(adapter.mutationCount()).toBe(4);
  });

  it("resets the complete declared production-shaped workspace and verifies orphans", async () => {
    const database = new FakeDatabase();
    const result = await resetManifestShadowWorkspace(database as unknown as D1Database);
    expect(result.orphan_count).toBe(0);
    expect(result.deleted_tables).toEqual([...MANIFEST_SHADOW_OPERATIONAL_TABLES]);
    expect(database.runs).toHaveLength(MANIFEST_SHADOW_OPERATIONAL_TABLES.length);
    expect(database.runs.every((entry) => /^DELETE FROM "[A-Za-z_][A-Za-z0-9_]*"$/.test(entry.sql))).toBe(true);
  });

  it("seeds only approved snapshot tables", async () => {
    await expect(seedManifestShadowSnapshot(
      fakeDb(),
      "run-1",
      {
        contract_version: MANIFEST_SHADOW_SNAPSHOT_VERSION,
        brand_key: "manifest_mental",
        source_as_of: "2026-07-30T17:00:00.000Z",
        snapshot_hash: "abc",
        tables: [{ table: "operator_engineering_audit", columns: ["id"], rows: [{ id: "no" }] }],
      },
      "2026-08-02T17:00:00.000Z",
    )).rejects.toThrow("manifest_shadow_snapshot_table_forbidden:operator_engineering_audit");
  });

  it("seeds approved rows and records a compact snapshot without production access", async () => {
    const database = new FakeDatabase();
    const result = await seedManifestShadowSnapshot(
      database as unknown as D1Database,
      "run-1",
      {
        contract_version: MANIFEST_SHADOW_SNAPSHOT_VERSION,
        brand_key: "manifest_mental",
        source_as_of: "2026-07-30T17:00:00.000Z",
        snapshot_hash: "abc",
        tables: [{
          table: "users",
          columns: ["id", "email"],
          rows: [{ id: "user-1", email: "shadow@example.invalid" }],
        }],
      },
      "2026-08-02T17:00:00.000Z",
    );
    expect(result.table_count).toBe(1);
    expect(result.row_count).toBe(1);
    expect(result.payload_bytes).toBeGreaterThan(0);
    expect(database.runs.some((entry) => entry.sql.includes("INSERT INTO \"users\""))).toBe(true);
    expect(database.runs.some((entry) => entry.sql.includes("manifest_shadow_snapshots"))).toBe(true);
  });
});
