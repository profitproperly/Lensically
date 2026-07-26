import { applyD1Migrations, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

type TestMigrationBinding = Parameters<typeof applyD1Migrations>[1];

type SchemaObjectRow = {
  name: string;
  type: string;
};

const testEnv = env as typeof env & { TEST_MIGRATIONS: TestMigrationBinding };

describe("canonical database migrations", () => {
  it("creates the first extracted schema owners with their indexes and trigger", async () => {
    const requiredColumns: Record<string, string[]> = {
      external_patterns: [
        "id", "app_user_id", "account_id", "platform", "source_url", "post_id",
        "author_handle", "author_display_name", "post_text", "likes", "replies",
        "reposts", "shares", "views", "posted_at", "capture_confidence",
        "raw_payload", "saved_at", "updated_at",
      ],
      threads_follower_snapshots: [
        "threads_user_id", "snapshot_date", "followers_count",
        "baseline_followers_count", "captured_at", "created_at",
      ],
      gpt_strategy_memory: [
        "id", "account_id", "threads_user_id", "kind", "title", "body",
        "metadata_json", "created_at", "updated_at",
      ],
    };

    for (const [table, expectedColumns] of Object.entries(requiredColumns)) {
      const columns = await testEnv.DB.prepare(`PRAGMA table_info(${table})`)
        .all<{ name: string }>();
      expect((columns.results ?? []).map((column) => column.name)).toEqual(
        expect.arrayContaining(expectedColumns),
      );
    }

    const expectedObjects = [
      "idx_external_patterns_user_updated",
      "idx_external_patterns_user_likes",
      "idx_external_patterns_user_account_source",
      "idx_external_patterns_user_account_post",
      "idx_threads_follower_snapshots_captured_at",
      "idx_gpt_strategy_memory_account_kind_updated",
      "idx_gpt_strategy_memory_threads_updated",
      "trg_gpt_strategy_memory_touch_updated_at",
    ];
    const objects = await testEnv.DB.prepare(
      `SELECT name, type FROM sqlite_master
       WHERE name IN (${expectedObjects.map(() => "?").join(", ")})`,
    ).bind(...expectedObjects).all<SchemaObjectRow>();
    expect((objects.results ?? []).map((row) => row.name).sort()).toEqual(
      [...expectedObjects].sort(),
    );
  });

  it("reapplies the canonical migration ledger without losing existing data", async () => {
    const suffix = crypto.randomUUID();
    await testEnv.DB.prepare(
      `INSERT INTO external_patterns (
        app_user_id, account_id, source_url, post_text, likes
      ) VALUES (?, ?, ?, ?, ?)`,
    ).bind("migration-test", "manifest-mental", `https://threads.net/t/${suffix}`, "Migration fixture", 1000).run();
    await testEnv.DB.prepare(
      `INSERT INTO threads_follower_snapshots (
        threads_user_id, snapshot_date, followers_count
      ) VALUES (?, '2099-01-01', 42)`,
    ).bind(`migration-${suffix}`).run();
    await testEnv.DB.prepare(
      `INSERT INTO gpt_strategy_memory (
        account_id, threads_user_id, kind, body
      ) VALUES (?, ?, 'approved_rule', 'Migration fixture')`,
    ).bind(`account-${suffix}`, `threads-${suffix}`).run();

    await applyD1Migrations(
      testEnv.DB,
      testEnv.TEST_MIGRATIONS,
      "lensically_test_migrations",
    );

    const counts = await Promise.all([
      testEnv.DB.prepare("SELECT COUNT(*) AS total FROM external_patterns WHERE source_url = ?")
        .bind(`https://threads.net/t/${suffix}`).first<{ total: number }>(),
      testEnv.DB.prepare("SELECT COUNT(*) AS total FROM threads_follower_snapshots WHERE threads_user_id = ?")
        .bind(`migration-${suffix}`).first<{ total: number }>(),
      testEnv.DB.prepare("SELECT COUNT(*) AS total FROM gpt_strategy_memory WHERE account_id = ?")
        .bind(`account-${suffix}`).first<{ total: number }>(),
    ]);
    expect(counts.map((row) => Number(row?.total ?? 0))).toEqual([1, 1, 1]);
  });
});
