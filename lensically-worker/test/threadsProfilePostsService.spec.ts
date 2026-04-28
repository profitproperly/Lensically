import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createThreadsProfilePostsRequestConfig,
  executeThreadsProfilePosts,
  normalizeThreadsProfilePostsResponse,
} from "../src/utils/threadsProfilePostsService";

describe("threadsProfilePostsService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds profile_posts request URL and bearer auth header", () => {
    const config = createThreadsProfilePostsRequestConfig({
      accessToken: "threads-access-token",
      username: "user.name",
    });

    expect(config.url).toBe(
      "https://graph.threads.net/v1.0/profile_posts?username=user.name&fields=id%2Cusername%2Ctext%2Ctimestamp%2Cpermalink%2Cmedia_type%2Cmedia_url%2Chas_replies",
    );
    expect(config.requestInit).toMatchObject({
      method: "GET",
      headers: {
        Authorization: "Bearer threads-access-token",
      },
    });
  });

  it("includes the after query parameter when cursor is provided", () => {
    const config = createThreadsProfilePostsRequestConfig({
      accessToken: "threads-access-token",
      username: "user.name",
      cursor: "cursor-123",
    });

    expect(config.url).toBe(
      "https://graph.threads.net/v1.0/profile_posts?username=user.name&fields=id%2Cusername%2Ctext%2Ctimestamp%2Cpermalink%2Cmedia_type%2Cmedia_url%2Chas_replies&after=cursor-123",
    );
  });

  it("normalizes profile posts payload to the internal posts shape", () => {
    const normalized = normalizeThreadsProfilePostsResponse({
      data: [
        {
          id: "post-1",
          username: "target-user",
          text: "Hello from Threads",
          timestamp: "2026-03-14T13:00:00Z",
          permalink: "https://threads.net/@target-user/post/post-1",
          media_type: "IMAGE",
          media_url: "https://example.com/image.jpg",
          has_replies: 1,
          ignored_field: "ignored",
        },
      ],
      paging: {
        cursors: {
          after: "cursor-next-1",
        },
      },
    });

    expect(normalized).toEqual({
      posts: [
        {
          id: "post-1",
          username: "target-user",
          text: "Hello from Threads",
          timestamp: "2026-03-14T13:00:00Z",
          permalink: "https://threads.net/@target-user/post/post-1",
          media_type: "IMAGE",
          media_url: "https://example.com/image.jpg",
          has_replies: true,
        },
      ],
      next_cursor: "cursor-next-1",
    });
  });

  it("maps Threads fields from wrapped post entries", () => {
    const normalized = normalizeThreadsProfilePostsResponse({
      data: [
        {
          post: {
            id: "post-2",
            username: "wrapped-user",
            text: "Wrapped post content",
            timestamp: "2026-03-14T13:30:00Z",
            permalink: "https://threads.net/@wrapped-user/post/post-2",
            media_type: "VIDEO",
            media_url: "https://example.com/video.mp4",
            has_replies: true,
          },
        },
      ],
    });

    expect(normalized).toEqual({
      posts: [
        {
          id: "post-2",
          username: "wrapped-user",
          text: "Wrapped post content",
          timestamp: "2026-03-14T13:30:00Z",
          permalink: "https://threads.net/@wrapped-user/post/post-2",
          media_type: "VIDEO",
          media_url: "https://example.com/video.mp4",
          has_replies: true,
        },
      ],
      next_cursor: null,
    });
  });

  it("prefers top-level Threads fields when nested post object is also present", () => {
    const normalized = normalizeThreadsProfilePostsResponse({
      data: [
        {
          id: "post-top-level",
          username: "top-level-user",
          text: "Top level content",
          timestamp: "2026-03-14T14:00:00Z",
          permalink: "https://threads.net/@top-level-user/post/post-top-level",
          media_type: "CAROUSEL_ALBUM",
          media_url: "https://example.com/top-level.jpg",
          has_replies: true,
          post: {
            id: "post-nested",
            username: "nested-user",
            text: "Nested content",
            timestamp: "2026-03-14T15:00:00Z",
            permalink: "https://threads.net/@nested-user/post/post-nested",
            media_type: "TEXT",
            media_url: "https://example.com/nested.jpg",
            has_replies: false,
          },
        },
      ],
    });

    expect(normalized).toEqual({
      posts: [
        {
          id: "post-top-level",
          username: "top-level-user",
          text: "Top level content",
          timestamp: "2026-03-14T14:00:00Z",
          permalink: "https://threads.net/@top-level-user/post/post-top-level",
          media_type: "CAROUSEL_ALBUM",
          media_url: "https://example.com/top-level.jpg",
          has_replies: true,
        },
      ],
      next_cursor: null,
    });
  });

  it("requests and returns normalized Threads profile posts for the provided username", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        data: [
          {
            id: "post-1",
            text: "Hello from Threads",
            username: "target-user",
            timestamp: "2026-03-14T13:00:00Z",
            permalink: "https://threads.net/@target-user/post/post-1",
            media_type: "TEXT",
            media_url: null,
            has_replies: false,
          },
        ],
        paging: {
          cursors: {
            after: "cursor-next-2",
          },
        },
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const result = await executeThreadsProfilePosts({
      accessToken: "token-abc",
      username: "target-user",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://graph.threads.net/v1.0/profile_posts?username=target-user&fields=id%2Cusername%2Ctext%2Ctimestamp%2Cpermalink%2Cmedia_type%2Cmedia_url%2Chas_replies",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer token-abc",
        },
      },
    );

    expect(result).toEqual({
      success: true,
      data: {
        posts: [
          {
            id: "post-1",
            text: "Hello from Threads",
            username: "target-user",
            timestamp: "2026-03-14T13:00:00Z",
            permalink: "https://threads.net/@target-user/post/post-1",
            media_type: "TEXT",
            media_url: null,
            has_replies: false,
          },
        ],
        next_cursor: "cursor-next-2",
      },
    });
  });

  it("returns null cursor when no paging cursor is present", () => {
    const normalized = normalizeThreadsProfilePostsResponse({
      data: [],
    });

    expect(normalized).toEqual({
      posts: [],
      next_cursor: null,
    });
  });

  it("extracts cursor from paging.next URL when cursors.after is missing", () => {
    const normalized = normalizeThreadsProfilePostsResponse({
      data: [],
      paging: {
        next: "https://graph.threads.net/v1.0/profile_posts?username=user.name&after=cursor-from-next",
      },
    });

    expect(normalized).toEqual({
      posts: [],
      next_cursor: "cursor-from-next",
    });
  });
});
