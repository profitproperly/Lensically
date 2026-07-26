import { applyD1Migrations, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

type TestMigrationBinding = Parameters<typeof applyD1Migrations>[1];
type SchemaObjectRow = { name: string; type: string };
type CountRow = { total: number | string };

const testEnv = env as typeof env & {
    TEST_MIGRATIONS: TestMigrationBinding;
  UPGRADE_DB: D1Database;
  IDENTITY_UPGRADE_DB: D1Database;
};

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
    users: [
    "id", "email", "password_hash", "email_verified", "threads_user_id",
    "threads_username", "access_token", "token_expires_at", "is_admin",
    "connection_active", "timezone", "clock_format", "created_at",
  ],
  app_threads_accounts: [
    "app_user_id", "threads_user_id", "connection_active", "is_active",
    "tombstone_expires_at", "created_at",
  ],
  threads_accounts: [
    "threads_user_id", "access_token", "expires_at", "created_at",
    "configured_account_id",
  ],
  threads_profile_cache: [
    "threads_user_id", "username", "name", "threads_biography", "is_verified",
    "threads_profile_picture_url", "last_refreshed_at", "created_at",
  ],
    meta_deletion_requests: [
    "confirmation_code", "platform_user_id", "status", "requested_at", "completed_at",
  ],
  threads_user_insights_cache: [
    "threads_user_id", "insights_json", "last_refreshed_at", "created_at",
  ],
  threads_post_insights_cache: [
    "threads_user_id", "post_id", "post_text", "post_timestamp", "post_permalink",
    "post_username", "profile_picture_url", "views", "likes", "replies", "reposts",
    "quotes", "shares", "sort_order", "last_refreshed_at", "created_at",
    "engagement_total",
  ],
  threads_posts_cache_state: [
    "threads_user_id", "next_cursor", "has_more", "last_refreshed_at", "created_at",
  ],
  threads_posts_archive: [
    "threads_user_id", "post_id", "post_text", "post_timestamp", "post_permalink",
    "post_username", "profile_picture_url", "views", "likes", "replies", "reposts",
    "quotes", "shares", "engagement_total", "source_rank", "first_seen_at",
    "last_seen_at", "last_synced_at",
  ],
  operator_post_metric_snapshots: [
    "id", "brand_key", "published_post_id", "scheduled_post_id", "draft_id",
    "generation_run_id", "source_card_id", "source_selection_id", "metrics_json",
    "captured_at", "valid_for_learning", "anomaly_reason", "collection_source",
    "created_at",
  ],
  scheduled_posts: [
    "id", "user_id", "threads_user_id", "post_text", "spoiler_all_text",
    "spoiler_phrases_json", "status", "scheduled_time", "publish_request_id",
    "published_post_id", "publish_error_message", "idempotency_key", "created_at",
    "updated_at", "processing_started_at", "published_at", "failed_at",
    "cancelled_at", "last_attempted_at",
  ],
  scheduled_post_deletions: [
    "id", "scheduled_post_id", "user_id", "threads_user_id", "post_text",
    "scheduled_time", "status_before", "reason_code", "reason",
    "learning_effect", "deleted_by", "deletion_source", "operation_id",
    "created_at",
  ],
  batch_schedule_presets: [
    "id", "user_id", "threads_user_id", "name", "times_json", "is_favorite",
    "created_at", "updated_at",
  ],
  threads_publish_idempotency: [
    "id", "scope", "app_user_id", "threads_user_id", "request_hash",
    "request_bucket", "response_status", "response_body", "created_at",
  ],
};

const expectedObjects = [
  "idx_external_patterns_user_updated",
  "idx_external_patterns_user_likes",
  "idx_external_patterns_user_account_source",
  "idx_external_patterns_user_account_post",
  "idx_threads_follower_snapshots_captured_at",
  "idx_gpt_strategy_memory_account_kind_updated",
  "idx_gpt_strategy_memory_threads_updated",
  "trg_gpt_strategy_memory_touch_updated_at",
  "idx_scheduled_posts_due",
  "idx_scheduled_posts_user_id",
  "idx_scheduled_posts_threads_user_id",
  "idx_scheduled_posts_idempotency_key",
  "trg_scheduled_posts_user_exists_insert",
  "trg_scheduled_posts_user_exists_update",
  "trg_scheduled_posts_user_cleanup",
  "trg_scheduled_posts_touch_updated_at",
  "idx_scheduled_post_deletions_account_time",
  "idx_scheduled_post_deletions_scheduled_post",
  "idx_scheduled_post_deletions_operation",
  "idx_batch_schedule_presets_user_id",
  "idx_batch_schedule_presets_user_threads",
  "idx_batch_schedule_presets_favorite_per_user_threads",
  "trg_batch_schedule_presets_touch_updated_at",
  "trg_batch_schedule_presets_user_cleanup",
  "idx_threads_publish_idempotency_created_at",
  "trg_threads_publish_idempotency_user_exists_insert",
    "trg_threads_publish_idempotency_user_cleanup",
  "idx_app_threads_accounts_app_user_active",
  "idx_app_threads_accounts_threads_user_id",
  "idx_app_threads_accounts_one_active_per_user",
  "trg_app_threads_accounts_user_exists_insert",
  "trg_app_threads_accounts_user_exists_update",
  "trg_app_threads_accounts_user_cleanup",
  "idx_threads_accounts_configured_account_id",
    "idx_threads_profile_cache_last_refreshed_at",
  "idx_threads_user_insights_cache_last_refreshed_at",
  "idx_threads_post_insights_cache_user_refresh",
  "idx_threads_post_insights_cache_user_sort_order",
  "idx_threads_posts_cache_state_last_refreshed_at",
  "idx_threads_posts_archive_user_timestamp",
  "idx_threads_posts_archive_user_engagement",
  "idx_threads_posts_archive_user_synced",
  "idx_operator_post_metric_snapshots_post_captured",
  "idx_operator_post_metric_snapshots_learning",
];

async function countWhere(sql: string, ...bindings: unknown[]): Promise<number> {
  const row = await testEnv.DB.prepare(sql).bind(...bindings).first<CountRow>();
  return Number(row?.total ?? 0);
}

describe("canonical database migrations", () => {
  it("creates every extracted table with the required columns, indexes, and triggers", async () => {
    for (const [table, expectedColumns] of Object.entries(requiredColumns)) {
      const columns = await testEnv.DB.prepare(`PRAGMA table_info(${table})`)
        .all<{ name: string }>();
      expect((columns.results ?? []).map((column) => column.name)).toEqual(
        expect.arrayContaining(expectedColumns),
      );
    }

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
    const userId = `migration-user-${suffix}`;
    const sourceUrl = `https://threads.net/t/${suffix}`;
    const followerId = `migration-follower-${suffix}`;
    const accountId = `migration-account-${suffix}`;
    const scheduledKey = `migration-scheduled-${suffix}`;
    const operationId = `migration-delete-${suffix}`;
        const presetId = `migration-preset-${suffix}`;
    const requestHash = `migration-hash-${suffix}`;
    const configuredAccountId = `configured-${suffix}`;
    const confirmationCode = `confirmation-${suffix}`;


    await testEnv.DB.prepare(
      `INSERT INTO users (id, email, email_verified, timezone, clock_format)
       VALUES (?, ?, 1, 'America/New_York', '12h')`,
    ).bind(userId, `${suffix}@example.com`).run();
    await testEnv.DB.prepare(
      `INSERT INTO external_patterns (
        app_user_id, account_id, source_url, post_text, likes
      ) VALUES (?, ?, ?, 'Migration fixture', 1000)`,
    ).bind(userId, "manifest-mental", sourceUrl).run();
    await testEnv.DB.prepare(
      `INSERT INTO threads_follower_snapshots (
        threads_user_id, snapshot_date, followers_count
      ) VALUES (?, '2099-01-01', 42)`,
    ).bind(followerId).run();
    await testEnv.DB.prepare(
      `INSERT INTO gpt_strategy_memory (
        account_id, threads_user_id, kind, body
      ) VALUES (?, ?, 'approved_rule', 'Migration fixture')`,
    ).bind(accountId, followerId).run();
    const scheduled = await testEnv.DB.prepare(
      `INSERT INTO scheduled_posts (
        user_id, threads_user_id, post_text, status, scheduled_time, idempotency_key
      ) VALUES (?, ?, 'Migration scheduled fixture', 'approved', '2099-01-02T12:00:00.000Z', ?)`,
    ).bind(userId, followerId, scheduledKey).run();
    const scheduledPostId = Number(scheduled.meta?.last_row_id ?? 0);
    expect(scheduledPostId).toBeGreaterThan(0);
    await testEnv.DB.prepare(
      `INSERT INTO scheduled_post_deletions (
        id, scheduled_post_id, user_id, threads_user_id, post_text, scheduled_time,
        status_before, reason_code, reason, learning_effect, deleted_by,
        deletion_source, operation_id
      ) VALUES (?, ?, ?, ?, 'Migration deleted fixture', '2099-01-02T12:00:00.000Z',
        'approved', 'technical_corruption', 'Migration fixture', 'unobserved',
        'model', 'mcp', ?)`,
    ).bind(`deletion-${suffix}`, scheduledPostId, userId, followerId, operationId).run();
    await testEnv.DB.prepare(
      `INSERT INTO batch_schedule_presets (
        id, user_id, threads_user_id, name, times_json, is_favorite
      ) VALUES (?, ?, ?, 'Migration preset', '["09:00"]', 1)`,
    ).bind(presetId, userId, followerId).run();
        await testEnv.DB.prepare(
      `INSERT INTO threads_publish_idempotency (
        scope, app_user_id, threads_user_id, request_hash, request_bucket,
        response_status, response_body
      ) VALUES ('immediate', ?, ?, ?, '2099-01-02T12', 200, '{"ok":true}')`,
    ).bind(userId, followerId, requestHash).run();
    await testEnv.DB.prepare(
      `INSERT INTO threads_accounts (
        threads_user_id, access_token, expires_at, created_at, configured_account_id
      ) VALUES (?, 'migration-token', 4102444800, 1, ?)`,
    ).bind(followerId, configuredAccountId).run();
    await testEnv.DB.prepare(
      `INSERT INTO threads_profile_cache (
        threads_user_id, username, name, threads_biography, is_verified,
        threads_profile_picture_url
      ) VALUES (?, 'migration-user', 'Migration User', 'Migration profile', 1,
        'https://example.com/profile.png')`,
    ).bind(followerId).run();
    await testEnv.DB.prepare(
      `INSERT INTO app_threads_accounts (
        app_user_id, threads_user_id, connection_active, is_active,
        tombstone_expires_at, created_at
      ) VALUES (?, ?, 1, 1, NULL, 1)`,
    ).bind(userId, followerId).run();
    await testEnv.DB.prepare(
      `INSERT INTO meta_deletion_requests (
        confirmation_code, platform_user_id, status
      ) VALUES (?, ?, 'pending')`,
    ).bind(confirmationCode, followerId).run();

    await applyD1Migrations(
      testEnv.DB,
      testEnv.TEST_MIGRATIONS,
      "lensically_test_migrations",
    );

    const counts = await Promise.all([
      countWhere("SELECT COUNT(*) AS total FROM users WHERE id = ?", userId),
      countWhere("SELECT COUNT(*) AS total FROM external_patterns WHERE source_url = ?", sourceUrl),
      countWhere("SELECT COUNT(*) AS total FROM threads_follower_snapshots WHERE threads_user_id = ?", followerId),
      countWhere("SELECT COUNT(*) AS total FROM gpt_strategy_memory WHERE account_id = ?", accountId),
      countWhere("SELECT COUNT(*) AS total FROM scheduled_posts WHERE idempotency_key = ?", scheduledKey),
      countWhere("SELECT COUNT(*) AS total FROM scheduled_post_deletions WHERE operation_id = ?", operationId),
      countWhere("SELECT COUNT(*) AS total FROM batch_schedule_presets WHERE id = ?", presetId),
            countWhere("SELECT COUNT(*) AS total FROM threads_publish_idempotency WHERE request_hash = ?", requestHash),
      countWhere("SELECT COUNT(*) AS total FROM threads_accounts WHERE configured_account_id = ?", configuredAccountId),
      countWhere("SELECT COUNT(*) AS total FROM threads_profile_cache WHERE threads_user_id = ?", followerId),
      countWhere("SELECT COUNT(*) AS total FROM app_threads_accounts WHERE app_user_id = ? AND threads_user_id = ?", userId, followerId),
      countWhere("SELECT COUNT(*) AS total FROM meta_deletion_requests WHERE confirmation_code = ?", confirmationCode),
    ]);
    expect(counts).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });

    it("upgrades the legacy scheduled-deletion schema before backfilling new fields", async () => {
    await testEnv.UPGRADE_DB.prepare(
      `CREATE TABLE scheduled_post_deletions (
        id TEXT PRIMARY KEY,
        scheduled_post_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        threads_user_id TEXT NOT NULL,
        post_text TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        status_before TEXT NOT NULL,
        reason TEXT NOT NULL,
        deleted_by TEXT NOT NULL,
        deletion_source TEXT NOT NULL,
        operation_id TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await testEnv.UPGRADE_DB.prepare(
      `INSERT INTO scheduled_post_deletions (
        id, scheduled_post_id, user_id, threads_user_id, post_text, scheduled_time,
        status_before, reason, deleted_by, deletion_source
      ) VALUES (
        'legacy-deletion', 1, 'legacy-user', 'legacy-threads', 'Legacy fixture',
        '2099-01-01T12:00:00.000Z', 'approved', 'Legacy reason', 'model', 'mcp'
      )`,
    ).run();

    await applyD1Migrations(
      testEnv.UPGRADE_DB,
      testEnv.TEST_MIGRATIONS,
      "lensically_upgrade_migrations",
    );

    const columns = await testEnv.UPGRADE_DB.prepare(
      "PRAGMA table_info(scheduled_post_deletions)",
    ).all<{ name: string }>();
    expect((columns.results ?? []).map((column) => column.name)).toEqual(
      expect.arrayContaining(["reason_code", "learning_effect"]),
    );
    const upgraded = await testEnv.UPGRADE_DB.prepare(
      `SELECT reason_code, learning_effect
       FROM scheduled_post_deletions
       WHERE id = 'legacy-deletion'`,
    ).first<{ reason_code: string; learning_effect: string }>();
    expect(upgraded).toEqual({
      reason_code: "legacy_unclassified",
      learning_effect: "unobserved",
    });
  });

    it("upgrades legacy account keys while preserving tokens, profiles, and deletion receipts", async () => {
    const db = testEnv.IDENTITY_UPGRADE_DB;
    await db.prepare(
      `CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0,
        threads_user_id TEXT,
        threads_username TEXT,
        access_token TEXT,
        token_expires_at INTEGER,
        is_admin INTEGER NOT NULL DEFAULT 0,
        connection_active INTEGER NOT NULL DEFAULT 1,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        clock_format TEXT NOT NULL DEFAULT '12h',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO users (id, email, email_verified, is_admin)
       VALUES ('legacy-owner', 'legacy-owner@example.com', 1, 1)`,
    ).run();
    await db.prepare(
      `CREATE TABLE app_threads_accounts (
        app_user_id TEXT PRIMARY KEY,
        threads_user_id TEXT NOT NULL,
        connection_active INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        tombstone_expires_at TEXT,
        created_at INTEGER NOT NULL
      )`,
    ).run();
        await db.prepare(
      `INSERT INTO app_threads_accounts (
        app_user_id, threads_user_id, connection_active, is_active,
        tombstone_expires_at, created_at
      ) VALUES (
        'legacy-owner', 'legacy-threads', 1, 1, '2099-01-01T00:00:00.000Z', 1
      )`,
    ).run();
    await db.prepare(
      `CREATE TRIGGER trg_app_threads_accounts_user_cleanup
       AFTER DELETE ON users
       FOR EACH ROW
       BEGIN
         DELETE FROM app_threads_accounts WHERE app_user_id = OLD.id;
       END`,
    ).run();
    await db.prepare(
      `CREATE TABLE threads_accounts (
        threads_user_id TEXT NOT NULL,
        access_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        configured_account_id TEXT
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO threads_accounts (
        threads_user_id, access_token, expires_at, created_at, configured_account_id
      ) VALUES ('legacy-threads', 'legacy-token', 4102444800, 1, 'manifest-mental')`,
    ).run();
    await db.prepare(
      `CREATE TABLE threads_profile_cache (
        threads_user_id TEXT PRIMARY KEY,
        username TEXT,
        name TEXT,
        threads_biography TEXT,
        is_verified INTEGER NOT NULL DEFAULT 0,
        threads_profile_picture_url TEXT,
        last_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO threads_profile_cache (
        threads_user_id, username, name, threads_biography, is_verified,
        threads_profile_picture_url
      ) VALUES (
        'legacy-threads', 'legacyuser', 'Legacy User', 'Legacy profile', 1,
        'https://example.com/legacy.png'
      )`,
    ).run();
    await db.prepare(
      `CREATE TABLE meta_deletion_requests (
        confirmation_code TEXT PRIMARY KEY,
        platform_user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      )`,
    ).run();
    await db.prepare(
      `INSERT INTO meta_deletion_requests (
        confirmation_code, platform_user_id, status
      ) VALUES ('legacy-confirmation', 'legacy-threads', 'pending')`,
    ).run();

    await applyD1Migrations(
      db,
      testEnv.TEST_MIGRATIONS,
      "lensically_identity_upgrade_migrations",
    );

    const appColumns = await db.prepare("PRAGMA table_info(app_threads_accounts)")
      .all<{ name: string; pk: number }>();
    const appPrimaryKey = new Map((appColumns.results ?? []).map((column) => [column.name, Number(column.pk)]));
    expect(appPrimaryKey.get("app_user_id")).toBe(1);
    expect(appPrimaryKey.get("threads_user_id")).toBe(2);

    const tokenColumns = await db.prepare("PRAGMA table_info(threads_accounts)")
      .all<{ name: string; pk: number }>();
    expect((tokenColumns.results ?? []).find((column) => column.name === "threads_user_id")?.pk).toBe(1);

    const identity = await db.prepare(
      `SELECT a.tombstone_expires_at, t.access_token, t.configured_account_id,
              p.username, p.threads_profile_picture_url, d.status
       FROM app_threads_accounts a
       JOIN threads_accounts t ON t.threads_user_id = a.threads_user_id
       JOIN threads_profile_cache p ON p.threads_user_id = t.threads_user_id
       JOIN meta_deletion_requests d ON d.platform_user_id = t.threads_user_id
       WHERE a.app_user_id = 'legacy-owner'`,
    ).first<Record<string, unknown>>();
    expect(identity).toMatchObject({
      tombstone_expires_at: null,
      access_token: "legacy-token",
      configured_account_id: "manifest-mental",
      username: "legacyuser",
      threads_profile_picture_url: "https://example.com/legacy.png",
      status: "pending",
    });

    await db.prepare(
      `INSERT INTO app_threads_accounts (
        app_user_id, threads_user_id, connection_active, is_active, created_at
      ) VALUES ('legacy-owner', 'second-threads', 1, 0, 2)`,
    ).run();
        const linkedAccountCount = await db.prepare(
      "SELECT COUNT(*) AS total FROM app_threads_accounts WHERE app_user_id = 'legacy-owner'",
    ).first<CountRow>();
    expect(Number(linkedAccountCount?.total ?? 0)).toBe(2);

    await expect(
      db.prepare(
        `INSERT INTO app_threads_accounts (
          app_user_id, threads_user_id, connection_active, is_active, created_at
        ) VALUES ('missing-owner', 'missing-threads', 1, 1, 1)`,
      ).run(),
    ).rejects.toThrow(/foreign_key_violation:app_threads_accounts\.app_user_id/);

    await db.prepare("DELETE FROM users WHERE id = 'legacy-owner'").run();
    const remainingLinks = await db.prepare(
      "SELECT COUNT(*) AS total FROM app_threads_accounts WHERE app_user_id = 'legacy-owner'",
    ).first<CountRow>();
    expect(Number(remainingLinks?.total ?? 0)).toBe(0);
  });

  it("enforces parent-user guards and cascades cleanup through scheduling tables", async () => {
    const suffix = crypto.randomUUID();
    const missingUserId = `missing-${suffix}`;

    await expect(
      testEnv.DB.prepare(
        `INSERT INTO scheduled_posts (
          user_id, threads_user_id, post_text, status, scheduled_time
        ) VALUES (?, ?, 'Missing user fixture', 'approved', '2099-02-01T12:00:00.000Z')`,
      ).bind(missingUserId, `threads-${suffix}`).run(),
    ).rejects.toThrow(/foreign_key_violation:scheduled_posts\.user_id/);

    await expect(
      testEnv.DB.prepare(
        `INSERT INTO threads_publish_idempotency (
          scope, app_user_id, threads_user_id, request_hash, request_bucket
        ) VALUES ('immediate', ?, ?, ?, '2099-02-01T12')`,
      ).bind(missingUserId, `threads-${suffix}`, `missing-hash-${suffix}`).run(),
    ).rejects.toThrow(/foreign_key_violation:threads_publish_idempotency\.app_user_id/);

    const userId = `cleanup-user-${suffix}`;
    const threadsUserId = `cleanup-threads-${suffix}`;
    await testEnv.DB.prepare(
      `INSERT INTO users (id, email, email_verified)
       VALUES (?, ?, 1)`,
    ).bind(userId, `cleanup-${suffix}@example.com`).run();
    await testEnv.DB.prepare(
      `INSERT INTO scheduled_posts (
        user_id, threads_user_id, post_text, status, scheduled_time, idempotency_key
      ) VALUES (?, ?, 'Cleanup fixture', 'approved', '2099-02-02T12:00:00.000Z', ?)`,
    ).bind(userId, threadsUserId, `cleanup-scheduled-${suffix}`).run();
    await testEnv.DB.prepare(
      `INSERT INTO batch_schedule_presets (
        id, user_id, threads_user_id, name, times_json, is_favorite
      ) VALUES (?, ?, ?, 'Cleanup preset', '["10:00"]', 1)`,
    ).bind(`cleanup-preset-${suffix}`, userId, threadsUserId).run();
    await testEnv.DB.prepare(
      `INSERT INTO threads_publish_idempotency (
        scope, app_user_id, threads_user_id, request_hash, request_bucket
      ) VALUES ('immediate', ?, ?, ?, '2099-02-02T12')`,
    ).bind(userId, threadsUserId, `cleanup-hash-${suffix}`).run();

    await testEnv.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();

    const childCounts = await Promise.all([
      countWhere("SELECT COUNT(*) AS total FROM scheduled_posts WHERE user_id = ?", userId),
      countWhere("SELECT COUNT(*) AS total FROM batch_schedule_presets WHERE user_id = ?", userId),
      countWhere("SELECT COUNT(*) AS total FROM threads_publish_idempotency WHERE app_user_id = ?", userId),
    ]);
    expect(childCounts).toEqual([0, 0, 0]);
  });
});
