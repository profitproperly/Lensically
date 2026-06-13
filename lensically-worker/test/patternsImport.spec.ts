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

  it("deletes selected saved patterns", async () => {
    const importResponse = await fetchFromWorker("/api/patterns/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "chrome-extension://exampleextensionid",
      },
      body: JSON.stringify({
        app_user_id: "lensically_test",
        platform: "threads",
        source_url: "https://www.threads.com/@example/post/delete-me",
        post_text: "Delete me",
      }),
    });

    const imported = (await importResponse.json()) as {
      pattern?: { id?: number };
    };
    const patternId = Number(imported.pattern?.id ?? 0);
    expect(patternId).toBeGreaterThan(0);

    const deleteResponse = await fetchFromWorker("/api/patterns/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "chrome-extension://exampleextensionid",
      },
      body: JSON.stringify({
        app_user_id: "lensically_test",
        ids: [patternId],
      }),
    });

    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toMatchObject({
      success: true,
      app_user_id: "lensically_test",
      deleted: 1,
    });

    const listResponse = await fetchFromWorker("/api/patterns/list?app_user_id=lensically_test&limit=10");
    await expect(listResponse.json()).resolves.toMatchObject({
      success: true,
      total: 0,
      patterns: [],
    });
  });

  it("lists saved patterns ranked by likes when requested", async () => {
    const origin = "chrome-extension://exampleextensionid";

    await fetchFromWorker("/api/patterns/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({
        app_user_id: "lensically_test",
        platform: "threads",
        source_url: "https://www.threads.com/@example/post/low",
        post_text: "Lower like post",
        likes: 12,
        views: 900,
      }),
    });

    await fetchFromWorker("/api/patterns/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({
        app_user_id: "lensically_test",
        platform: "threads",
        source_url: "https://www.threads.com/@example/post/high",
        post_text: "Higher like post",
        likes: 400,
        views: 100,
      }),
    });

    const listResponse = await fetchFromWorker("/api/patterns/list?app_user_id=lensically_test&limit=10&order=likes");
    expect(listResponse.status).toBe(200);
    const payload = (await listResponse.json()) as {
      order?: string;
      patterns?: Array<{ source_url?: string; likes?: number }>;
    };

    expect(payload.order).toBe("likes");
    expect(payload.patterns?.[0]).toMatchObject({
      source_url: "https://www.threads.com/@example/post/high",
      likes: 400,
    });
    expect(payload.patterns?.[1]).toMatchObject({
      source_url: "https://www.threads.com/@example/post/low",
      likes: 12,
    });
  });

  it("scopes saved patterns to Manifest Mental by default", async () => {
    const origin = "chrome-extension://exampleextensionid";

    await fetchFromWorker("/api/patterns/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({
        app_user_id: "lensically_test",
        source_url: "https://www.threads.com/@example/post/manifest-only",
        post_text: "Manifest pattern",
      }),
    });

    const manifestResponse = await fetchFromWorker("/api/patterns/list?app_user_id=lensically_test&limit=10");
    await expect(manifestResponse.json()).resolves.toMatchObject({
      success: true,
      account_id: "manifest-mental",
      total: 1,
    });

    const vectrixResponse = await fetchFromWorker("/api/patterns/list?app_user_id=lensically_test&account_id=vectrix&limit=10");
    await expect(vectrixResponse.json()).resolves.toMatchObject({
      success: true,
      account_id: "vectrix",
      total: 0,
      patterns: [],
    });
  });

  it("paginates saved patterns", async () => {
    const origin = "chrome-extension://exampleextensionid";

    for (let index = 1; index <= 3; index += 1) {
      await fetchFromWorker("/api/patterns/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
        },
        body: JSON.stringify({
          app_user_id: "lensically_test",
          platform: "threads",
          source_url: `https://www.threads.com/@example/post/page-${index}`,
          post_text: `Paged post ${index}`,
          likes: index,
          posted_at: `2026-05-0${index}T00:00:00.000Z`,
        }),
      });
    }

    const listResponse = await fetchFromWorker("/api/patterns/list?app_user_id=lensically_test&limit=2&page=2&order=newest");
    expect(listResponse.status).toBe(200);
    const payload = (await listResponse.json()) as {
      total?: number;
      page?: number;
      page_size?: number;
      total_pages?: number;
      patterns?: Array<{ source_url?: string }>;
    };

    expect(payload.total).toBe(3);
    expect(payload.page).toBe(2);
    expect(payload.page_size).toBe(2);
    expect(payload.total_pages).toBe(2);
    expect(payload.patterns).toHaveLength(1);
    expect(payload.patterns?.[0]?.source_url).toBe("https://www.threads.com/@example/post/page-1");
  });
});
