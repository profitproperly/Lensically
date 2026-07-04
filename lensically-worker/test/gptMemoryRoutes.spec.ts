import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src";

const TEST_THREADS_USER_ID = "vectrix";
const TEST_BRAND_KEY = "vectrix";
const TEST_ACCOUNT_ID = "vectrix";

async function fetchFromWorker(path: string, init?: RequestInit): Promise<Response> {
  const request = new Request(`https://example.com${path}`, init);
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

async function resetTables(): Promise<void> {
  await env.DB.prepare("DROP TABLE IF EXISTS app_threads_accounts").run();
  await env.DB.prepare("DROP TABLE IF EXISTS gpt_post_strategy_tags").run();
  await env.DB.prepare("DROP TABLE IF EXISTS scheduled_posts").run();
  await env.DB.prepare("DROP TABLE IF EXISTS users").run();
  await env.DB.prepare("DROP TABLE IF EXISTS gpt_strategy_memory").run();
  await env.DB.prepare("DROP TABLE IF EXISTS gpt_generation_drafts").run();
  await env.DB.prepare("DROP TABLE IF EXISTS gpt_generation_runs").run();
  await env.DB.prepare("DROP TABLE IF EXISTS gpt_preflight_snapshots").run();
  await env.DB.prepare("DROP TABLE IF EXISTS threads_posts_archive").run();
  await env.DB.prepare("DROP TABLE IF EXISTS threads_follower_snapshots").run();
  await env.DB.prepare("DROP TABLE IF EXISTS threads_accounts").run();
  await env.DB.prepare("DROP TABLE IF EXISTS agent_account_controls").run();
  await env.DB.prepare("DROP TABLE IF EXISTS external_patterns").run();
  await env.DB.prepare(
    `CREATE TABLE users (
      id TEXT PRIMARY KEY,
      threads_user_id TEXT,
      threads_username TEXT,
      access_token TEXT,
      token_expires_at INTEGER,
      is_admin INTEGER NOT NULL DEFAULT 0,
      connection_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT 0
    )`,
  ).run();
  await env.DB.prepare(
    `INSERT INTO users (id, threads_user_id, threads_username, access_token, token_expires_at, is_admin, connection_active, created_at)
     VALUES ('workspace-owner', ?, 'vectrixvoltmore', 'test-token', 0, 1, 1, 0)`,
  ).bind(TEST_THREADS_USER_ID).run();
}

async function createCompactPaginationFixture(): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE gpt_strategy_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      threads_user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT,
      body TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE threads_posts_archive (
      threads_user_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      post_text TEXT,
      post_timestamp TEXT,
      post_permalink TEXT,
      post_username TEXT,
      profile_picture_url TEXT,
      views INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      replies INTEGER NOT NULL DEFAULT 0,
      reposts INTEGER NOT NULL DEFAULT 0,
      quotes INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      engagement_total INTEGER NOT NULL DEFAULT 0,
      source_rank INTEGER NOT NULL DEFAULT 0,
      first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (threads_user_id, post_id)
    )`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE external_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      source_url TEXT,
      post_id TEXT,
      author_handle TEXT,
      author_display_name TEXT,
      post_text TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      replies INTEGER NOT NULL DEFAULT 0,
      reposts INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      views INTEGER NOT NULL DEFAULT 0,
      posted_at TEXT,
      capture_confidence TEXT,
      raw_payload TEXT,
      saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run();

  for (let index = 1; index <= 5; index += 1) {
    await env.DB.prepare(
      `INSERT INTO gpt_strategy_memory (account_id, threads_user_id, kind, title, body, metadata_json)
       VALUES (?, ?, 'current_belief', ?, ?, ?)`,
    )
      .bind(
        TEST_ACCOUNT_ID,
        TEST_THREADS_USER_ID,
        `Rule ${index}`,
        `Compact memory body ${index}`,
        JSON.stringify({ heavy_debug: "x".repeat(1000), source: "test" }),
      )
      .run();
    await env.DB.prepare(
      `INSERT INTO threads_posts_archive (
        threads_user_id, post_id, post_text, post_timestamp, post_permalink, post_username,
        profile_picture_url, views, likes, replies, reposts, quotes, shares, engagement_total, source_rank
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        TEST_THREADS_USER_ID,
        `archive-${index}`,
        `Archive post ${index}`,
        `2026-07-0${index}T15:00:00.000Z`,
        `https://threads.net/@vectrix/post/archive-${index}`,
        "vectrixvoltmore",
        `https://cdn.example.com/avatar-${index}.jpg`,
        index * 100,
        index * 10,
        index,
        index + 1,
        0,
        0,
        index * 12,
        index,
      )
      .run();
    await env.DB.prepare(
      `INSERT INTO external_patterns (
        app_user_id, account_id, platform, source_url, post_id, author_handle, author_display_name,
        post_text, likes, replies, reposts, shares, views, posted_at, capture_confidence, raw_payload
      ) VALUES ('lensically', ?, 'threads', ?, ?, 'reference', 'Reference Account', ?, ?, ?, ?, ?, ?, ?, 'high', ?)`,
    )
      .bind(
        TEST_ACCOUNT_ID,
        `https://threads.net/@reference/post/pattern-${index}`,
        `pattern-${index}`,
        `Saved pattern ${index}`,
        index * 20,
        index,
        index + 2,
        index + 3,
        index * 200,
        `2026-07-0${index}T16:00:00.000Z`,
        JSON.stringify({ raw: "x".repeat(1000) }),
      )
      .run();
  }
}

async function createGenerationDraftFixture(): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE gpt_generation_runs (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      threads_user_id TEXT NOT NULL,
      objective TEXT,
      prompt_summary TEXT,
      status TEXT NOT NULL DEFAULT 'drafted',
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE gpt_generation_drafts (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      threads_user_id TEXT NOT NULL,
      draft_index INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'drafted',
      rejection_reason TEXT,
      score_json TEXT,
      strategy_json TEXT,
      replacement_for_draft_id TEXT,
      scheduled_post_id INTEGER,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES gpt_generation_runs(id) ON DELETE CASCADE
    )`,
  ).run();
  await env.DB.prepare(
    `INSERT INTO gpt_generation_runs (id, account_id, threads_user_id, objective, status)
     VALUES ('run-test', ?, ?, 'Test run', 'drafted')`,
  ).bind(TEST_ACCOUNT_ID, TEST_THREADS_USER_ID).run();
  await env.DB.prepare(
    `INSERT INTO gpt_generation_drafts (id, run_id, account_id, threads_user_id, draft_index, text, status)
     VALUES ('draft-test', 'run-test', ?, ?, 0, 'A grounded test draft.', 'shown')`,
  ).bind(TEST_ACCOUNT_ID, TEST_THREADS_USER_ID).run();
}

async function createScheduledPostFixture(): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE scheduled_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      threads_user_id TEXT NOT NULL,
      post_text TEXT NOT NULL,
      spoiler_all_text INTEGER NOT NULL DEFAULT 0,
      spoiler_phrases_json TEXT,
      status TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      idempotency_key TEXT,
      publish_error_message TEXT,
      last_attempted_at TEXT,
      processing_started_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run();
  await env.DB.prepare(
    `INSERT INTO scheduled_posts (id, user_id, threads_user_id, post_text, status, scheduled_time)
     VALUES (777, 'workspace-owner', ?, 'Scheduled strategy fixture', 'approved', '2099-01-01T15:00:00.000Z')`,
  ).bind(TEST_THREADS_USER_ID).run();
}

async function createPostedTaggedPostFixture(): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE scheduled_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      threads_user_id TEXT NOT NULL,
      post_text TEXT NOT NULL,
      spoiler_all_text INTEGER NOT NULL DEFAULT 0,
      spoiler_phrases_json TEXT,
      status TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      publish_request_id TEXT,
      published_post_id TEXT,
      publish_error_message TEXT,
      idempotency_key TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processing_started_at TEXT,
      published_at TEXT,
      failed_at TEXT,
      cancelled_at TEXT,
      last_attempted_at TEXT
    )`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE threads_posts_archive (
      threads_user_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      post_text TEXT,
      post_timestamp TEXT,
      post_permalink TEXT,
      post_username TEXT,
      profile_picture_url TEXT,
      views INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      replies INTEGER NOT NULL DEFAULT 0,
      reposts INTEGER NOT NULL DEFAULT 0,
      quotes INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      engagement_total INTEGER NOT NULL DEFAULT 0,
      source_rank INTEGER NOT NULL DEFAULT 0,
      first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (threads_user_id, post_id)
    )`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE threads_follower_snapshots (
      threads_user_id TEXT NOT NULL,
      snapshot_date TEXT NOT NULL,
      followers_count INTEGER NOT NULL DEFAULT 0,
      baseline_followers_count INTEGER,
      captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (threads_user_id, snapshot_date)
    )`,
  ).run();
  await env.DB.prepare(
    `INSERT INTO scheduled_posts (id, user_id, threads_user_id, post_text, status, scheduled_time, published_post_id, published_at)
     VALUES (888, 'workspace-owner', ?, 'Posted strategy fixture', 'posted', '2026-07-01T15:00:00.000Z', 'post-888', '2026-07-01T15:01:00.000Z')`,
  ).bind(TEST_THREADS_USER_ID).run();
  await env.DB.prepare(
    `INSERT INTO threads_posts_archive (
      threads_user_id, post_id, post_text, post_timestamp, post_permalink, post_username,
      views, likes, replies, reposts, quotes, shares, engagement_total, source_rank
    ) VALUES (?, 'post-888', 'Posted strategy fixture', '2026-07-01T15:01:00.000Z', 'https://threads.net/post-888', 'vectrixvoltmore',
      1200, 90, 12, 8, 2, 1, 113, 0)`,
  ).bind(TEST_THREADS_USER_ID).run();
  await env.DB.prepare(
    `INSERT INTO threads_follower_snapshots (threads_user_id, snapshot_date, followers_count, baseline_followers_count, captured_at)
     VALUES (?, '2026-07-01', 1050, 1042, '2026-07-01T23:00:00.000Z')`,
  ).bind(TEST_THREADS_USER_ID).run();
  await fetchFromWorker("/api/threads/schedule/strategy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scheduled_post_id: 888,
      pillar: "offer",
      hook_style: "direct",
      format: "short",
      intent: "follower_growth",
      experiment: "posted tag learning",
      novelty_level: "medium",
    }),
  });
}

describe("GPT memory browser routes", () => {
  beforeEach(async () => {
    await resetTables();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 500 })));
  });

  it("advertises and returns the GPT operator playbook", async () => {
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";

    const schemaResponse = await fetchFromWorker("/api/gpt/openapi.json");
    expect(schemaResponse.status).toBe(200);
    const schema = await schemaResponse.json() as { paths?: Record<string, unknown> };
    expect(schema.paths?.["/api/gpt/operator-playbook"]).toBeTruthy();

    const response = await fetchFromWorker(`/api/gpt/operator-playbook?brand_key=${TEST_BRAND_KEY}&objective=generate%20posts`, {
      headers: { Authorization: "Bearer test-gpt-key" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      playbook_version: "operator_playbook_v1",
      brand_key: TEST_BRAND_KEY,
      objective: "generate posts",
      useful_actions_by_job: expect.objectContaining({
        generate_posts: expect.arrayContaining(["prepareGenerationBrief", "checkDraftSimilarity"]),
        learn_from_results: expect.arrayContaining(["prepareGrowthReview", "saveExperiment"]),
      }),
    });
  });

  it("supports full compact paginated GPT context pulls without heavy fields", async () => {
    await createCompactPaginationFixture();
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";
    const authHeaders = { Authorization: "Bearer test-gpt-key" };

    const memoryItems: Array<Record<string, unknown>> = [];
    for (let offset = 0; ; offset += 2) {
      const response = await fetchFromWorker(`/api/gpt/strategy-memory?brand_key=${TEST_BRAND_KEY}&limit=2&offset=${offset}`, {
        headers: authHeaders,
      });
      expect(response.status).toBe(200);
      const page = await response.json() as { memory: Array<Record<string, unknown>>; has_more: boolean; total_count: number };
      memoryItems.push(...page.memory);
      if (!page.has_more) {
        expect(memoryItems).toHaveLength(page.total_count);
        break;
      }
    }

    const savedPatterns: Array<Record<string, unknown>> = [];
    for (let offset = 0; ; offset += 2) {
      const response = await fetchFromWorker(`/api/gpt/saved-patterns?brand_key=${TEST_BRAND_KEY}&limit=2&offset=${offset}`, {
        headers: authHeaders,
      });
      expect(response.status).toBe(200);
      const page = await response.json() as { patterns: Array<Record<string, unknown>>; has_more: boolean; total_count: number };
      savedPatterns.push(...page.patterns);
      if (!page.has_more) {
        expect(savedPatterns).toHaveLength(page.total_count);
        break;
      }
    }

    const archivePosts: Array<Record<string, unknown>> = [];
    for (let offset = 0; ; offset += 2) {
      const response = await fetchFromWorker(`/api/gpt/posts/recent?brand_key=${TEST_BRAND_KEY}&limit=2&offset=${offset}`, {
        headers: authHeaders,
      });
      expect(response.status).toBe(200);
      const page = await response.json() as { posts: Array<Record<string, unknown>>; has_more: boolean; total_count: number };
      archivePosts.push(...page.posts);
      if (!page.has_more) {
        expect(archivePosts).toHaveLength(page.total_count);
        break;
      }
    }

    expect(memoryItems).toHaveLength(5);
    expect(savedPatterns).toHaveLength(5);
    expect(archivePosts).toHaveLength(5);
    expect(memoryItems[0]).not.toHaveProperty("metadata");
    expect(savedPatterns[0]).not.toHaveProperty("source_url");
    expect(savedPatterns[0]).not.toHaveProperty("raw_payload");
    expect(savedPatterns[0]).not.toHaveProperty("author_display_name");
    expect(archivePosts[0]).not.toHaveProperty("permalink");
    expect(archivePosts[0]).not.toHaveProperty("profile_picture_url");
    expect(archivePosts[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      text: expect.any(String),
      views: expect.any(Number),
      likes: expect.any(Number),
      engagement_total: expect.any(Number),
    }));
  });

  it("creates, pages, and replaces compact GPT preflight snapshots", async () => {
    await createCompactPaginationFixture();
    await createGenerationDraftFixture();
    await createScheduledPostFixture();
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";
    const authHeaders = { Authorization: "Bearer test-gpt-key", "Content-Type": "application/json" };

    const createResponse = await fetchFromWorker("/api/gpt/preflight-snapshot", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ brand_key: TEST_BRAND_KEY, objective: "generate a test batch" }),
    });
    expect(createResponse.status).toBe(200);
    const created = await createResponse.json() as {
      snapshot_id: string;
      sections: Array<{ section: string; total_count: number; returned_count: number; truncated: boolean }>;
    };
    expect(created.snapshot_id).toEqual(expect.any(String));
    expect(created.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: "strategy_memory", total_count: 5, returned_count: 5, truncated: false }),
      expect.objectContaining({ section: "saved_patterns", total_count: 5, returned_count: 5, truncated: false }),
      expect.objectContaining({ section: "archive_recent", total_count: 5, returned_count: 5, truncated: false }),
      expect.objectContaining({ section: "recent_insights", total_count: expect.any(Number), returned_count: expect.any(Number), truncated: false }),
      expect.objectContaining({ section: "scheduled_posts", total_count: 1, returned_count: 1, truncated: false }),
      expect.objectContaining({ section: "generation_runs", total_count: 1, returned_count: 1, truncated: false }),
    ]));
    const recentInsightsSection = created.sections.find((section) => section.section === "recent_insights");
    expect(recentInsightsSection?.total_count).toBeGreaterThan(0);
    expect(created).toEqual(expect.objectContaining({
      recent_insights_count: recentInsightsSection?.total_count,
      recent_insights_hours: 72,
    }));

    const pageResponse = await fetchFromWorker(
      `/api/gpt/preflight-snapshot/page?brand_key=${TEST_BRAND_KEY}&snapshot_id=${created.snapshot_id}&section=saved_patterns&limit=2&offset=0`,
      { headers: { Authorization: "Bearer test-gpt-key" } },
    );
    expect(pageResponse.status).toBe(200);
    const page = await pageResponse.json() as {
      snapshot_id: string;
      section: string;
      items: Array<Record<string, unknown>>;
      total_count: number;
      returned_count: number;
      has_more: boolean;
    };
    expect(page.snapshot_id).toBe(created.snapshot_id);
    expect(page.section).toBe("saved_patterns");
    expect(page.total_count).toBe(5);
    expect(page.returned_count).toBe(2);
    expect(page.has_more).toBe(true);
    expect(page.items[0]).not.toHaveProperty("source_url");
    expect(page.items[0]).not.toHaveProperty("raw_payload");
    expect(page.items[0]).not.toHaveProperty("author_display_name");

    const archivePageResponse = await fetchFromWorker(
      `/api/gpt/preflight-snapshot/page?brand_key=${TEST_BRAND_KEY}&snapshot_id=${created.snapshot_id}&section=archive_recent&limit=1`,
      { headers: { Authorization: "Bearer test-gpt-key" } },
    );
    expect(archivePageResponse.status).toBe(200);
    const archivePage = await archivePageResponse.json() as { items: Array<Record<string, unknown>> };
    expect(archivePage.items[0]).not.toHaveProperty("permalink");
    expect(archivePage.items[0]).not.toHaveProperty("profile_picture_url");

    const insightsPageResponse = await fetchFromWorker(
      `/api/gpt/preflight-snapshot/page?brand_key=${TEST_BRAND_KEY}&snapshot_id=${created.snapshot_id}&section=recent_insights&limit=2`,
      { headers: { Authorization: "Bearer test-gpt-key" } },
    );
    expect(insightsPageResponse.status).toBe(200);
    const insightsPage = await insightsPageResponse.json() as { total_count: number; items: Array<Record<string, unknown>> };
    expect(insightsPage.total_count).toBeGreaterThan(0);
    expect(insightsPage.items[0]).toEqual(expect.objectContaining({
      post_id: expect.any(String),
      text: expect.any(String),
      active_window_status: expect.any(String),
      views: expect.any(Number),
      likes: expect.any(Number),
      engagement_total: expect.any(Number),
    }));

    const replaceResponse = await fetchFromWorker("/api/gpt/preflight-snapshot", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ brand_key: TEST_BRAND_KEY, objective: "second snapshot" }),
    });
    expect(replaceResponse.status).toBe(200);
    const replacement = await replaceResponse.json() as { snapshot_id: string };
    expect(replacement.snapshot_id).not.toBe(created.snapshot_id);

    const oldSnapshotResponse = await fetchFromWorker(
      `/api/gpt/preflight-snapshot?brand_key=${TEST_BRAND_KEY}&snapshot_id=${created.snapshot_id}`,
      { headers: { Authorization: "Bearer test-gpt-key" } },
    );
    expect(oldSnapshotResponse.status).toBe(404);

    const activeManifestResponse = await fetchFromWorker(
      `/api/gpt/preflight-snapshot?brand_key=${TEST_BRAND_KEY}`,
      { headers: { Authorization: "Bearer test-gpt-key" } },
    );
    expect(activeManifestResponse.status).toBe(200);
    await expect(activeManifestResponse.json()).resolves.toMatchObject({
      success: true,
      active_snapshot_id: replacement.snapshot_id,
      manifest: expect.objectContaining({ snapshot_id: replacement.snapshot_id }),
    });
  });

  it("stores owner taste feedback for the selected configured account", async () => {
    const response = await fetchFromWorker("/api/gpt-memory/taste-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threads_user_id: TEST_THREADS_USER_ID,
        feedback_type: "rejection_feedback",
        lesson: "Avoid generic motivational phrasing.",
        metadata: { test_case: "taste" },
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      memory: expect.objectContaining({
        account_id: TEST_ACCOUNT_ID,
        threads_user_id: TEST_THREADS_USER_ID,
        kind: "rejection_feedback",
        body: "Lesson: Avoid generic motivational phrasing.",
      }),
    });
  });

  it("stores browser-safe strategy memory for rule proposals", async () => {
    const response = await fetchFromWorker("/api/gpt-memory/strategy-memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threads_user_id: TEST_THREADS_USER_ID,
        kind: "rule_proposal",
        title: "Test direct hooks",
        body: "Try sharper direct hooks with sample-size caution.",
        metadata: { test_case: "rule_proposal" },
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      memory: expect.objectContaining({
        account_id: TEST_ACCOUNT_ID,
        threads_user_id: TEST_THREADS_USER_ID,
        kind: "rule_proposal",
        title: "Test direct hooks",
        body: "Try sharper direct hooks with sample-size caution.",
      }),
    });
  });

  it("updates and archives browser-safe strategy memory", async () => {
    const createResponse = await fetchFromWorker("/api/gpt-memory/strategy-memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threads_user_id: TEST_THREADS_USER_ID,
        kind: "rule_proposal",
        title: "Edit me",
        body: "Original rule proposal.",
      }),
    });
    const created = await createResponse.json() as { memory: { id: number } };

    const updateResponse = await fetchFromWorker("/api/gpt-memory/strategy-memory/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threads_user_id: TEST_THREADS_USER_ID,
        memory_id: created.memory.id,
        kind: "current_belief",
        title: "Edited belief",
        body: "Edited memory body.",
        archived: true,
        archive_reason: "No longer useful.",
      }),
    });

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      memory: expect.objectContaining({
        id: created.memory.id,
        kind: "current_belief",
        title: "Edited belief",
        body: "Edited memory body.",
        metadata: expect.objectContaining({
          archived: true,
          archive_reason: "No longer useful.",
          last_memory_update_source: "lensically_memory_dashboard_update",
        }),
      }),
    });

    const editResponse = await fetchFromWorker("/api/gpt-memory/strategy-memory/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threads_user_id: TEST_THREADS_USER_ID,
        memory_id: created.memory.id,
        title: "Edited archived belief",
      }),
    });

    expect(editResponse.status).toBe(200);
    await expect(editResponse.json()).resolves.toMatchObject({
      success: true,
      memory: expect.objectContaining({
        title: "Edited archived belief",
        metadata: expect.objectContaining({
          archived: true,
          archive_reason: "No longer useful.",
        }),
      }),
    });
  });

  it("advertises and updates GPT strategy memory action", async () => {
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";
    const createResponse = await fetchFromWorker("/api/gpt/strategy-memory", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-gpt-key",
      },
      body: JSON.stringify({
        brand_key: TEST_BRAND_KEY,
        kind: "rule_proposal",
        title: "GPT edit me",
        body: "Original GPT memory.",
      }),
    });
    const created = await createResponse.json() as { memory: { id: number } };

    const schemaResponse = await fetchFromWorker("/api/gpt/openapi.json");
    const schema = await schemaResponse.json() as { paths?: Record<string, unknown> };
    expect(schema.paths?.["/api/gpt/strategy-memory/update"]).toBeTruthy();

    const updateResponse = await fetchFromWorker("/api/gpt/strategy-memory/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-gpt-key",
      },
      body: JSON.stringify({
        brand_key: TEST_BRAND_KEY,
        memory_id: created.memory.id,
        title: "GPT edited",
        body: "Updated GPT memory.",
        archived: true,
        archive_reason: "Stale after review.",
      }),
    });

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      memory: expect.objectContaining({
        id: created.memory.id,
        title: "GPT edited",
        body: "Updated GPT memory.",
        metadata: expect.objectContaining({
          archived: true,
          archive_reason: "Stale after review.",
          last_memory_update_source: "gpt_strategy_memory_update",
        }),
      }),
    });

    const editResponse = await fetchFromWorker("/api/gpt/strategy-memory/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-gpt-key",
      },
      body: JSON.stringify({
        brand_key: TEST_BRAND_KEY,
        memory_id: created.memory.id,
        body: "Edited without changing archive state.",
      }),
    });

    expect(editResponse.status).toBe(200);
    await expect(editResponse.json()).resolves.toMatchObject({
      success: true,
      memory: expect.objectContaining({
        body: "Edited without changing archive state.",
        metadata: expect.objectContaining({
          archived: true,
          archive_reason: "Stale after review.",
        }),
      }),
    });

    const defaultListResponse = await fetchFromWorker(`/api/gpt/strategy-memory?brand_key=${TEST_BRAND_KEY}`, {
      headers: { Authorization: "Bearer test-gpt-key" },
    });
    expect(defaultListResponse.status).toBe(200);
    const defaultList = await defaultListResponse.json() as { memory: Array<{ id: number }>; total_count: number; archive_filter: string };
    expect(defaultList.archive_filter).toBe("active");
    expect(defaultList.memory.find((item) => item.id === created.memory.id)).toBeUndefined();
    expect(defaultList.total_count).toBe(0);

    const archivedListResponse = await fetchFromWorker(`/api/gpt/strategy-memory?brand_key=${TEST_BRAND_KEY}&archive_filter=archived`, {
      headers: { Authorization: "Bearer test-gpt-key" },
    });
    expect(archivedListResponse.status).toBe(200);
    await expect(archivedListResponse.json()).resolves.toMatchObject({
      archive_filter: "archived",
      total_count: 1,
      memory: [
        expect.objectContaining({ id: created.memory.id }),
      ],
    });
  });

  it("reviews and applies GPT memory hygiene for duplicate operating rules", async () => {
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: "Bearer test-gpt-key",
    };

    for (const [title, body] of [
      ["Full context via pagination", "Before generation, use paginated full context pulls and avoid heavy aggregate helpers."],
      ["Use paginated preflight", "Use compact paginated preflight context because heavy aggregate helpers can cause ResponseTooLarge."],
      ["No heavy aggregate helpers", "Full context should come through compact pagination, not one giant aggregate helper."],
    ]) {
      await fetchFromWorker("/api/gpt/strategy-memory", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          brand_key: TEST_BRAND_KEY,
          kind: "approved_rule",
          title,
          body,
        }),
      });
    }

    const reviewResponse = await fetchFromWorker(`/api/gpt/memory-hygiene-review?brand_key=${TEST_BRAND_KEY}`, {
      headers: { Authorization: "Bearer test-gpt-key" },
    });
    expect(reviewResponse.status).toBe(200);
    const review = await reviewResponse.json() as {
      duplicate_groups: Array<{ archive_memory_ids: number[]; keep_memory_id: number }>;
    };
    expect(review.duplicate_groups.length).toBeGreaterThan(0);
    const archiveIds = review.duplicate_groups[0].archive_memory_ids;
    expect(archiveIds.length).toBeGreaterThan(0);

    const applyResponse = await fetchFromWorker("/api/gpt/memory-hygiene/apply", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        brand_key: TEST_BRAND_KEY,
        archive_memory_ids: archiveIds,
        archive_reason: "Duplicate full-context operating rule.",
        replacement_rule: {
          kind: "approved_rule",
          title: "Full context via compact paginated pulls; no heavy aggregate helpers.",
          body: "Full context should be collected through compact paginated pulls. Do not rely on heavy aggregate helpers for generation.",
        },
      }),
    });
    expect(applyResponse.status).toBe(200);
    await expect(applyResponse.json()).resolves.toMatchObject({
      success: true,
      archived_count: archiveIds.length,
      replacement_memory: expect.objectContaining({
        title: "Full context via compact paginated pulls; no heavy aggregate helpers.",
      }),
    });
  });

  it("stores saved pattern reviews as pattern memory", async () => {
    const response = await fetchFromWorker("/api/gpt-memory/saved-patterns/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threads_user_id: TEST_THREADS_USER_ID,
        saved_pattern_ids: [101, 102],
        verdict: "approved",
        note: "Use the mechanism, not the wording.",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      memory: expect.objectContaining({
        kind: "approved_pattern",
        body: expect.stringContaining("Saved pattern ids: 101, 102"),
      }),
    });
  });

  it("stores growth experiments without GPT bearer auth", async () => {
    const response = await fetchFromWorker("/api/gpt-memory/experiment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threads_user_id: TEST_THREADS_USER_ID,
        title: "Test sharper hooks",
        hypothesis: "Sharper first lines should lift the engagement floor.",
        status: "running",
        success_criteria: ["Compare weak-post rate against baseline"],
        sample_size_target: 5,
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      memory: expect.objectContaining({
        kind: "experiment",
        title: "Test sharper hooks",
        body: expect.stringContaining("Hypothesis: Sharper first lines"),
      }),
    });
  });

  it("stores draft review feedback as strategy memory", async () => {
    await createGenerationDraftFixture();

    const response = await fetchFromWorker("/api/gpt-memory/generation-drafts/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threads_user_id: TEST_THREADS_USER_ID,
        draft_id: "draft-test",
        status: "approved",
        feedback_note: "This feels direct and worth using.",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      draft: expect.objectContaining({
        id: "draft-test",
        status: "approved",
      }),
      feedback_memory: expect.objectContaining({
        kind: "approval_feedback",
        body: expect.stringContaining("Lesson: This feels direct and worth using."),
      }),
    });
  });

  it("stores GPT action draft feedback as strategy memory", async () => {
    await createGenerationDraftFixture();
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";

    const response = await fetchFromWorker("/api/gpt/generation-drafts/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-gpt-key",
      },
      body: JSON.stringify({
        brand_key: TEST_BRAND_KEY,
        draft_id: "draft-test",
        status: "rejected",
        rejection_reason: "Too generic.",
        feedback_note: "Reject wording that sounds like generic internet advice.",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      draft: expect.objectContaining({
        id: "draft-test",
        status: "rejected",
      }),
      feedback_memory: expect.objectContaining({
        kind: "rejection_feedback",
        body: expect.stringContaining("Reject wording that sounds like generic internet advice."),
      }),
    });
  });

  it("saves GPT generation draft scores and strategy tags", async () => {
    await createGenerationDraftFixture();
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";

    const response = await fetchFromWorker("/api/gpt/generation-drafts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-gpt-key",
      },
      body: JSON.stringify({
        brand_key: TEST_BRAND_KEY,
        run_id: "run-test",
        drafts: [
          {
            draft_index: 1,
            text: "Money is about to start acting like it knows where you live.",
            status: "shown",
            scores: {
              hook_strength: 8,
              specificity: 7,
              repeat_risk: 2,
              brand_fit: 9,
              follower_growth_intent: 8,
              shareability: 7,
              engagement_floor_likelihood: 8,
              overall: 8,
            },
            strategy: {
              pillar: "money_relief",
              hook_style: "definite_prophecy",
              format: "one_line_prophecy",
              intent: "follower_growth",
              experiment: "survival_career_money_relief",
              novelty_level: "proven_variant",
            },
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      drafts: [
        expect.objectContaining({
          text: "Money is about to start acting like it knows where you live.",
          score: expect.objectContaining({
            hook_strength: 8,
            repeat_risk: 2,
            overall: 8,
          }),
          strategy: expect.objectContaining({
            pillar: "money_relief",
            hook_style: "definite_prophecy",
            intent: "follower_growth",
            novelty_level: "proven_variant",
          }),
        }),
      ],
    });
  });

  it("updates GPT generation draft scores and strategy tags", async () => {
    await createGenerationDraftFixture();
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";

    const response = await fetchFromWorker("/api/gpt/generation-drafts/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-gpt-key",
      },
      body: JSON.stringify({
        brand_key: TEST_BRAND_KEY,
        draft_id: "draft-test",
        status: "approved",
        score: {
          hook_strength: 9,
          specificity: 8,
          repeat_risk: 1,
          brand_fit: 10,
          follower_growth_intent: 9,
          shareability: 8,
          engagement_floor_likelihood: 9,
          overall: 9,
        },
        strategy: {
          pillar: "identity_shift",
          hook_style: "quiet_command",
          format: "one_line_identity",
          intent: "engagement_floor",
          experiment: "approved_rewrite_tagging",
          novelty_level: "fresh_variant",
        },
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      draft: expect.objectContaining({
        id: "draft-test",
        status: "approved",
        score: expect.objectContaining({
          hook_strength: 9,
          brand_fit: 10,
          overall: 9,
        }),
        strategy: expect.objectContaining({
          pillar: "identity_shift",
          hook_style: "quiet_command",
          intent: "engagement_floor",
        }),
      }),
    });
  });

  it("returns a browser-safe generation brief without creating a run by default", async () => {
    const response = await fetchFromWorker("/api/gpt-memory/generation-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threads_user_id: TEST_THREADS_USER_ID,
        objective: "Generate a tighter batch",
        batch_size: 4,
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      objective: "Generate a tighter batch",
      run: null,
      context_readiness: expect.objectContaining({
        should_ask_taste_question: expect.any(Boolean),
      }),
      candidate_pool: expect.objectContaining({
        requested_batch_size: 4,
        minimum_internal_candidates: 12,
        show_after_self_rejection: 4,
      }),
    });
  });

  it("returns browser-safe taste interview prompts", async () => {
    const response = await fetchFromWorker(`/api/gpt-memory/taste-interview?threads_user_id=${TEST_THREADS_USER_ID}&objective=Generate%20a%20calibrated%20batch`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      objective: "Generate a calibrated batch",
      should_ask_before_generating: true,
      prioritized_questions: expect.arrayContaining([
        expect.any(String),
      ]),
      save_answers_with: expect.objectContaining({
        action: "saveTasteFeedback",
      }),
    });
  });

  it("saves strategy tags for scheduled posts and returns them from the schedule list", async () => {
    await createScheduledPostFixture();

    const updateResponse = await fetchFromWorker("/api/threads/schedule/strategy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduled_post_id: 777,
        pillar: "offer",
        hook_style: "direct",
        format: "short",
        intent: "follower_growth",
        experiment: "test direct hooks",
        novelty_level: "medium",
      }),
    });

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      success: true,
      scheduled_post_id: 777,
      strategy: expect.objectContaining({
        pillar: "offer",
        hook_style: "direct",
        format: "short",
        intent: "follower_growth",
        experiment: "test direct hooks",
        novelty_level: "medium",
      }),
    });

    const listResponse = await fetchFromWorker(`/api/threads/schedule?threads_user_id=${TEST_THREADS_USER_ID}`);

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      success: true,
      scheduled_posts: [
        expect.objectContaining({
          id: 777,
          strategy: expect.objectContaining({
            pillar: "offer",
            hook_style: "direct",
          }),
        }),
      ],
    });
  });

  it("returns timezone-explicit GPT brand context dates", async () => {
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";

    const response = await fetchFromWorker(`/api/gpt/context?brand_key=${TEST_BRAND_KEY}&timezone=America/New_York`, {
      headers: { Authorization: "Bearer test-gpt-key" },
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      date?: string;
      local_date?: string;
      local_time?: string;
      timezone?: string;
      server_date_utc?: string;
      server_time_utc?: string;
      target_date?: string;
    };
    expect(payload.timezone).toBe("America/New_York");
    expect(payload.local_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.local_time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(payload.server_date_utc).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.server_time_utc).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(payload.date).toBe(payload.local_date);
    expect(payload.target_date).toBe(payload.local_date);
  });

  it("lists scheduled posts by local date and timezone", async () => {
    await createScheduledPostFixture();
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";

    const response = await fetchFromWorker(`/api/gpt/scheduled?brand_key=${TEST_BRAND_KEY}&date=2099-01-01&timezone=America/New_York`, {
      headers: { Authorization: "Bearer test-gpt-key" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      date: "2099-01-01",
      timezone: "America/New_York",
      scheduled_posts: [
        expect.objectContaining({
          id: 777,
          scheduled_time_utc: "2099-01-01T15:00:00.000Z",
          scheduled_time_local: "2099-01-01 10:00",
          local_time: "10:00",
        }),
      ],
    });
  });

  it("updates desired posting slots for GPT context", async () => {
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";
    const slots = Array.from({ length: 24 }, (_, hour) => `${hour.toString().padStart(2, "0")}:00`);

    const updateResponse = await fetchFromWorker("/api/gpt/desired-slots", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-gpt-key",
      },
      body: JSON.stringify({
        brand_key: TEST_BRAND_KEY,
        slots,
        timezone: "America/New_York",
      }),
    });

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      timezone: "America/New_York",
      desired_slots: slots,
    });

    const contextResponse = await fetchFromWorker(`/api/gpt/context?brand_key=${TEST_BRAND_KEY}&fields=desired_slots&timezone=America/New_York`, {
      headers: { Authorization: "Bearer test-gpt-key" },
    });

    expect(contextResponse.status).toBe(200);
    await expect(contextResponse.json()).resolves.toMatchObject({
      success: true,
      desired_slots: slots,
    });
  });

  it("includes posted strategy-tag performance in GPT growth context", async () => {
    await createPostedTaggedPostFixture();
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";

    const response = await fetchFromWorker(`/api/gpt/growth-context?brand_key=${TEST_BRAND_KEY}`, {
      headers: { Authorization: "Bearer test-gpt-key" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      tagged_post_results: [
        expect.objectContaining({
          scheduled_post_id: 888,
          published_post_id: "post-888",
          local_date: "2026-07-01",
          follower_day_net_change: 8,
          strategy: expect.objectContaining({
            pillar: "offer",
            hook_style: "direct",
          }),
          post: expect.objectContaining({
            id: "post-888",
            likes: 90,
            engagement_total: 113,
          }),
        }),
      ],
      tag_performance: expect.objectContaining({
        pillars: [
          expect.objectContaining({
            key: "offer",
            posts: 1,
            posts_with_metrics: 1,
            median_engagement_total: 113,
            median_follower_day_net_change: 8,
          }),
        ],
      }),
    });

    const generationResponse = await fetchFromWorker(`/api/gpt/generation-context?brand_key=${TEST_BRAND_KEY}&compact=true`, {
      headers: { Authorization: "Bearer test-gpt-key" },
    });

    expect(generationResponse.status).toBe(200);
    const generationPayload = await generationResponse.json() as {
      archive?: { recent?: Array<Record<string, unknown>> };
      posted_tagged_results?: unknown[];
      tag_performance?: Record<string, Array<Record<string, unknown>>>;
    };
    expect(generationPayload).toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      posted_tagged_results: [
        expect.objectContaining({
          scheduled_post_id: 888,
          follower_day_net_change: 8,
        }),
      ],
      tag_performance: expect.objectContaining({
        pillars: [
          expect.objectContaining({
            key: "offer",
            median_follower_day_net_change: 8,
          }),
        ],
      }),
    });
    expect(generationPayload.archive?.recent?.[0]).not.toHaveProperty("profile_picture_url");
    expect(generationPayload.archive?.recent?.[0]).not.toHaveProperty("permalink");
  });

  it("returns recent GPT post performance windows for learning before generation", async () => {
    await createPostedTaggedPostFixture();
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";

    const response = await fetchFromWorker(`/api/gpt/recent-performance?brand_key=${TEST_BRAND_KEY}&hours=24&days=7`, {
      headers: { Authorization: "Bearer test-gpt-key" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      windows: expect.objectContaining({
        last_days: expect.objectContaining({
          label: "last_7_days",
          posts_count: 1,
          posts_with_metrics: 1,
          winners: [
            expect.objectContaining({
              scheduled_post_id: 888,
              published_post_id: "post-888",
              strategy: expect.objectContaining({
                pillar: "offer",
                hook_style: "direct",
              }),
              post: expect.objectContaining({
                likes: 90,
                engagement_total: 113,
              }),
            }),
          ],
          tag_performance: expect.objectContaining({
            pillars: [
              expect.objectContaining({
                key: "offer",
                median_engagement_total: 113,
              }),
            ],
          }),
        }),
      }),
    });
  });

  it("refreshes Threads insights before returning the standalone recent insights pull", async () => {
    await createPostedTaggedPostFixture();
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";
    const nowIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const requestUrl = typeof input === "string" ? input : input.toString();
      if (requestUrl.includes("/me?fields=")) {
        return new Response(JSON.stringify({
          id: TEST_THREADS_USER_ID,
          username: "vectrixvoltmore",
          name: "Vectrix",
          threads_profile_picture_url: "https://cdn.example.com/profile.jpg",
        }), { status: 200 });
      }
      if (requestUrl.includes(`/${TEST_THREADS_USER_ID}/threads?`)) {
        return new Response(JSON.stringify({
          data: [
            {
              id: "post-888",
              text: "Freshly pulled post text",
              timestamp: nowIso,
              permalink: "https://threads.net/post-888",
              username: "vectrixvoltmore",
              view_count: 10,
              like_count: 1,
              reply_count: 0,
              repost_count: 0,
              quote_count: 0,
            },
          ],
          paging: { cursors: {} },
        }), { status: 200 });
      }
      if (requestUrl.includes("/post-888/insights?")) {
        return new Response(JSON.stringify({
          data: [
            { name: "views", total_value: { value: 3210 } },
            { name: "likes", total_value: { value: 210 } },
            { name: "replies", total_value: { value: 31 } },
            { name: "reposts", total_value: { value: 22 } },
            { name: "quotes", total_value: { value: 7 } },
            { name: "shares", total_value: { value: 5 } },
          ],
        }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 500 });
    }));

    const response = await fetchFromWorker(`/api/gpt/insights/recent?brand_key=${TEST_BRAND_KEY}&hours=72&limit=1`, {
      headers: { Authorization: "Bearer test-gpt-key" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      purpose: "fresh_recent_insights_pull",
      hours: 72,
      returned_count: 1,
      refresh: expect.objectContaining({
        attempted: true,
        refreshed: true,
        pages_fetched: 1,
        posts_upserted: 1,
      }),
      insights: [
        expect.objectContaining({
          post_id: "post-888",
          scheduled_post_id: 888,
          text: "Freshly pulled post text",
          active_window_status: "active_0_24h",
          views: 3210,
          likes: 210,
          replies: 31,
          comments: 31,
          reposts: 22,
          quote_posts: 7,
          shares: 5,
          engagement_total: 275,
          strategy: expect.objectContaining({
            pillar: "offer",
            hook_style: "direct",
          }),
          permalink: "https://threads.net/post-888",
        }),
      ],
    });
  });

  it("hides rule proposals that have duplicate approved rules", async () => {
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";
    const title = "Archive-aware candidate pool before showing drafts";
    const body = "Create more internal candidates than shown and self-reject weak archive-overfit drafts.";

    const proposalResponse = await fetchFromWorker("/api/gpt/strategy-memory", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-gpt-key",
      },
      body: JSON.stringify({
        brand_key: TEST_BRAND_KEY,
        kind: "rule_proposal",
        title,
        body,
      }),
    });
    const proposal = await proposalResponse.json() as { memory?: { id?: number } };

    await fetchFromWorker("/api/gpt/strategy-memory", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-gpt-key",
      },
      body: JSON.stringify({
        brand_key: TEST_BRAND_KEY,
        kind: "approved_rule",
        title,
        body,
        metadata: {
          promoted_from_memory_id: proposal.memory?.id,
        },
      }),
    });

    const contextResponse = await fetchFromWorker(`/api/gpt/generation-context?brand_key=${TEST_BRAND_KEY}&compact=true`, {
      headers: { Authorization: "Bearer test-gpt-key" },
    });

    expect(contextResponse.status).toBe(200);
    const context = await contextResponse.json() as {
      taste_and_beliefs?: {
        rule_review_summary?: {
          open_rule_proposals?: Array<{ title?: string }>;
        };
      };
    };
    expect(context.taste_and_beliefs?.rule_review_summary?.open_rule_proposals ?? []).toEqual([]);
  });

  it("returns a dashboard scoped to the selected account", async () => {
    await fetchFromWorker("/api/gpt-memory/taste-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threads_user_id: TEST_THREADS_USER_ID,
        feedback_type: "taste_profile",
        lesson: "Prefer grounded, direct language.",
      }),
    });

    const response = await fetchFromWorker(`/api/gpt-memory/dashboard?threads_user_id=${TEST_THREADS_USER_ID}`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      brand_key: TEST_BRAND_KEY,
      account: expect.objectContaining({
        account_id: TEST_ACCOUNT_ID,
        threads_user_id: TEST_THREADS_USER_ID,
      }),
      memory_summary: expect.objectContaining({
        total_count: 1,
      }),
      memory_by_kind: expect.objectContaining({
        taste_profile: [
          expect.objectContaining({
            body: "Lesson: Prefer grounded, direct language.",
          }),
        ],
      }),
    });
  });
});
