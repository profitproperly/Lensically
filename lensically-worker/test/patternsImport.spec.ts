import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src";

async function fetchFromWorker(path: string, init?: RequestInit): Promise<Response> {
  const request = new Request(`https://example.com${path}`, init);
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

async function resetTables(): Promise<void> {
  await env.DB.prepare("DROP TABLE IF EXISTS external_patterns").run();
}

describe("patterns import routes", () => {
  beforeEach(async () => {
    await resetTables();
  });

  it("allows extension preflight and stores a saved pattern", async () => {
    const origin = "chrome-extension://exampleextensionid";

    const optionsResponse = await fetchFromWorker("/api/patterns/import", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
      },
    });

    expect(optionsResponse.status).toBe(200);
    expect(optionsResponse.headers.get("Access-Control-Allow-Origin")).toBe(origin);

    const importResponse = await fetchFromWorker("/api/patterns/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({
        app_user_id: "lensically_test",
        platform: "threads",
        source_url: "https://www.threads.com/@example/post/abc123",
        post_id: "abc123",
        author_handle: "example",
        author_display_name: "Example Account",
        post_text: "Test post text from the extension",
        likes: 42,
        replies: 5,
        reposts: 2,
        shares: 1,
        views: 999,
        posted_at: "2026-05-04T22:00:00.000Z",
        capture_confidence: "high",
        raw_payload: {
          extractor_version: "0.1.0",
          mode: "dom",
        },
      }),
    });

    expect(importResponse.status).toBe(200);
    expect(importResponse.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    await expect(importResponse.json()).resolves.toMatchObject({
      success: true,
      app_user_id: "lensically_test",
      pattern: expect.objectContaining({
        source_url: "https://www.threads.com/@example/post/abc123",
        post_text: "Test post text from the extension",
        likes: 42,
        replies: 5,
        reposts: 2,
        shares: 1,
        views: 999,
        capture_confidence: "high",
      }),
    });

    const listResponse = await fetchFromWorker("/api/patterns/list?app_user_id=lensically_test&limit=10", {
      headers: {
        Origin: origin,
      },
    });

    expect(listResponse.status).toBe(200);
    expect(listResponse.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    await expect(listResponse.json()).resolves.toMatchObject({
      success: true,
      app_user_id: "lensically_test",
      total: 1,
      patterns: [
        expect.objectContaining({
          source_url: "https://www.threads.com/@example/post/abc123",
          author_handle: "example",
          likes: 42,
        }),
      ],
    });
  });
});
