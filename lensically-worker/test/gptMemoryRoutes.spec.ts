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
  await env.DB.prepare("DROP TABLE IF EXISTS threads_posts_archive").run();
  await env.DB.prepare("DROP TABLE IF EXISTS threads_follower_snapshots").run();
  await env.DB.prepare("DROP TABLE IF EXISTS threads_accounts").run();
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
          }),
        ],
      }),
    });
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
