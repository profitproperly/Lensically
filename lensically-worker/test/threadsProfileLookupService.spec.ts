import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createThreadsProfileLookupRequestConfig,
  executeThreadsProfileLookup,
  normalizeThreadsProfileLookupResponse,
} from "../src/utils/threadsProfileLookupService";

describe("threadsProfileLookupService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds profile_lookup request URL and bearer auth header", () => {
    const config = createThreadsProfileLookupRequestConfig({
      accessToken: "threads-access-token",
      username: "user.name",
    });

    expect(config.url).toBe("https://graph.threads.net/v1.0/profile_lookup?username=user.name");
    expect(config.requestInit).toMatchObject({
      method: "GET",
      headers: {
        Authorization: "Bearer threads-access-token",
      },
    });
  });

  it("normalizes profile lookup payload to the internal profile shape", () => {
    const normalized = normalizeThreadsProfileLookupResponse({
      data: [{
        id: "123",
        username: "target-user",
        name: "Target User",
        biography: "Bio from Threads API",
        profile_picture_url: "https://example.com/avatar.jpg",
        is_verified: true,
        follower_count: 1001,
        likes_count: "2500",
        quotes_count: 44,
        replies_count: "61",
        reposts_count: 18,
        views_count: "9000",
        ignored_field: "ignored",
      }],
    });

    expect(normalized).toEqual({
      id: "123",
      username: "target-user",
      name: "Target User",
      biography: "Bio from Threads API",
      profile_picture_url: "https://example.com/avatar.jpg",
      is_verified: true,
      follower_count: 1001,
      likes_count: 2500,
      quotes_count: 44,
      replies_count: 61,
      reposts_count: 18,
      views_count: 9000,
    });
  });

  it("requests and returns normalized Threads profile data for the provided username", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        data: [{
          id: "123",
          username: "target-user",
          name: "Target User",
          biography: "Bio from Threads API",
          profile_picture_url: "https://example.com/avatar.jpg",
          is_verified: true,
          follower_count: 1001,
          likes_count: 2500,
          quotes_count: 44,
          replies_count: 61,
          reposts_count: 18,
          views_count: 9000,
        }],
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const result = await executeThreadsProfileLookup({
      accessToken: "token-abc",
      username: "target-user",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://graph.threads.net/v1.0/profile_lookup?username=target-user",
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
        id: "123",
        username: "target-user",
        name: "Target User",
        biography: "Bio from Threads API",
        profile_picture_url: "https://example.com/avatar.jpg",
        is_verified: true,
        follower_count: 1001,
        likes_count: 2500,
        quotes_count: 44,
        replies_count: 61,
        reposts_count: 18,
        views_count: 9000,
      },
    });
  });
});
