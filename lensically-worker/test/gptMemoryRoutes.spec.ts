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
  await env.DB.prepare("DROP TABLE IF EXISTS users").run();
  await env.DB.prepare("DROP TABLE IF EXISTS gpt_strategy_memory").run();
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
}

describe("GPT memory browser routes", () => {
  beforeEach(async () => {
    await resetTables();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 500 })));
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
