import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  afterEach(() => {
    vi.unstubAllGlobals();
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
      account_id: "manifest-mental",
      pattern: expect.objectContaining({
        account_id: "manifest-mental",
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

  it("cleans author and relative time prefixes from imported mobile post text", async () => {
    const importResponse = await fetchFromWorker("/api/patterns/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://www.threads.com",
      },
      body: JSON.stringify({
        app_user_id: "lensically_test",
        platform: "threads",
        source_url: "https://www.threads.com/@julietemirella/post/DZpKBkd-Fd2",
        post_text: "julietemirella 2d A lot of anxiety disappears when your finances are in order.",
      }),
    });

    expect(importResponse.status).toBe(200);
    await expect(importResponse.json()).resolves.toMatchObject({
      success: true,
      pattern: expect.objectContaining({
        author_handle: "julietemirella",
        post_text: "A lot of anxiety disappears when your finances are in order.",
      }),
    });
  });

  it("cleans standalone relative time prefixes from listed saved patterns", async () => {
    await fetchFromWorker("/api/patterns/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://www.threads.com",
      },
      body: JSON.stringify({
        app_user_id: "lensically_test",
        platform: "threads",
        source_url: "https://www.threads.com/@jenny_nuel1/post/DZuaqSFIwUC",
        post_text: "13h Does anybody actually go to the dentist every six months??",
      }),
    });

    const listResponse = await fetchFromWorker("/api/patterns/list?app_user_id=lensically_test&limit=10");
    await expect(listResponse.json()).resolves.toMatchObject({
      success: true,
      patterns: [
        expect.objectContaining({
          author_handle: "jenny_nuel1",
          post_text: "Does anybody actually go to the dentist every six months??",
        }),
      ],
    });
  });

  it("prefers the Threads source URL author over the logged-in importer handle", async () => {
    const importResponse = await fetchFromWorker("/api/patterns/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://www.threads.com",
      },
      body: JSON.stringify({
        app_user_id: "lensically_test",
        platform: "threads",
        source_url: "https://www.threads.com/@luvandrea.c/post/DZuZ7TWoP77",
        author_handle: "profitproperly",
        post_text: "hitting the gym because I can't hit someone",
      }),
    });

    expect(importResponse.status).toBe(200);
    await expect(importResponse.json()).resolves.toMatchObject({
      success: true,
      pattern: expect.objectContaining({
        author_handle: "luvandrea.c",
      }),
    });

    const listResponse = await fetchFromWorker("/api/patterns/list?app_user_id=lensically_test&limit=10");
    await expect(listResponse.json()).resolves.toMatchObject({
      success: true,
      patterns: [
        expect.objectContaining({
          author_handle: "luvandrea.c",
        }),
      ],
    });
  });

  it("fills the posted date from public Threads metadata when the mobile payload omits it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      '<html><head><meta property="article:published_time" content="2026-06-18T21:07:00.000Z" /></head><body></body></html>',
      { status: 200, headers: { "Content-Type": "text/html" } },
    )));

    const importResponse = await fetchFromWorker("/api/patterns/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://www.threads.com",
      },
      body: JSON.stringify({
        app_user_id: "lensically_test",
        platform: "threads",
        source_url: "https://www.threads.com/@example/post/posted-date",
        post_text: "Post with a public timestamp",
        views: 0,
      }),
    });

    expect(importResponse.status).toBe(200);
    await expect(importResponse.json()).resolves.toMatchObject({
      success: true,
      pattern: expect.objectContaining({
        posted_at: "2026-06-18T21:07:00.000Z",
      }),
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
