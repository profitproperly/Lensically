import { describe, expect, it, vi } from "vitest";
import {
  readOperatorLensicallyUiSurface,
  type OperatorLensicallyUiSurfaceDependencies,
} from "../src/operatorLensicallyUiSurfaceService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function createHarness() {
  const mocks = {
    getThreadsAccount: vi.fn(async () => ({ threads_user_id: "threads-1", access_token: "token-1" } as JsonRecord)),
    buildDashboard: vi.fn(async () => ({ followers_count: 700 } as JsonRecord)),
    refreshFollowerSnapshot: vi.fn(async () => undefined),
    countFollowerSnapshots: vi.fn(async () => 3),
    listFollowerSnapshots: vi.fn(async () => [
      { snapshot_date: "2026-07-27", baseline_followers_count: 690, followers_count: 700, captured_at: "now" },
      { snapshot_date: "2026-07-26", baseline_followers_count: 680, followers_count: 685, captured_at: "older" },
    ]),
    fetchPostsPage: vi.fn(async () => ({
      posts: [{ id: "post-1" }],
      hasMore: true,
      nextCursor: "cursor-2",
    })),
    upsertPostsArchive: vi.fn(async () => undefined),
    replacePostsCache: vi.fn(async () => undefined),
    listPostArchive: vi.fn(async () => ({ posts: [{ id: "archive-1" }], totalCount: 8 })),
    listSavedPatterns: vi.fn(async () => ({ available: true, patterns: [{ id: 9 }], totalCount: 11 })),
  };
  const dependencies: OperatorLensicallyUiSurfaceDependencies = {
    insightsTimezone: "America/New_York",
    maxPostsCursorDepth: 3,
    normalizeText,
    getThreadsAccount: mocks.getThreadsAccount,
    buildDashboard: mocks.buildDashboard,
    refreshFollowerSnapshot: mocks.refreshFollowerSnapshot,
    countFollowerSnapshots: mocks.countFollowerSnapshots,
    listFollowerSnapshots: mocks.listFollowerSnapshots,
    fetchPostsPage: mocks.fetchPostsPage,
    upsertPostsArchive: mocks.upsertPostsArchive,
    replacePostsCache: mocks.replacePostsCache,
    listPostArchive: mocks.listPostArchive,
    listSavedPatterns: mocks.listSavedPatterns,
  };
  const input = {
    brandKey: "manifest_mental",
    accountId: "account-1",
    threadsUserId: "threads-1",
    payload: {} as JsonRecord,
  };
  return { mocks, dependencies, input };
}

describe("operatorLensicallyUiSurfaceService", () => {
  it("enforces selected Threads account and dashboard token admission", async () => {
    const harness = createHarness();
    harness.mocks.getThreadsAccount.mockResolvedValueOnce(null);
    expect(await readOperatorLensicallyUiSurface({
      ...harness.input,
      payload: { surface: "dashboard" },
    }, harness.dependencies)).toEqual({
      status: 404,
      body: { success: false, error: "threads_account_not_connected" },
    });

    harness.mocks.getThreadsAccount.mockResolvedValueOnce({ threads_user_id: "threads-1" });
    expect(await readOperatorLensicallyUiSurface({
      ...harness.input,
      payload: { surface: "dashboard" },
    }, harness.dependencies)).toEqual({
      status: 400,
      body: { success: false, error: "threads_access_token_missing" },
    });
  });

  it("maps follower snapshots into exact deltas and pagination", async () => {
    const harness = createHarness();
    const result = await readOperatorLensicallyUiSurface({
      ...harness.input,
      payload: { surface: "followers", page: 1, limit: 1 },
    }, harness.dependencies);

    expect(harness.mocks.refreshFollowerSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ threads_user_id: "threads-1" }),
      "America/New_York",
    );
    expect(harness.mocks.listFollowerSnapshots).toHaveBeenCalledWith("threads-1", 2, 0);
    expect(result).toEqual({
      status: 200,
      body: {
        success: true,
        surface: "followers",
        brand_key: "manifest_mental",
        rows: [{
          date: "2026-07-27",
          start_of_day_followers: 690,
          gap_carry: 5,
          latest_followers: 700,
          net_change: 15,
          updated_at: "now",
        }],
        total_count: 3,
        page: 1,
        page_size: 1,
        total_pages: 3,
        timezone: "America/New_York",
      },
    });
  });

  it("bounds insights cursor depth and writes first-page archive and cache state", async () => {
    const harness = createHarness();
    const result = await readOperatorLensicallyUiSurface({
      ...harness.input,
      payload: { surface: "insights", cursor_depth: 99 },
    }, harness.dependencies);

    expect(harness.mocks.fetchPostsPage).toHaveBeenCalledWith("token-1", "threads-1", null);
    expect(harness.mocks.upsertPostsArchive).toHaveBeenCalledWith("threads-1", [{ id: "post-1" }]);
    expect(harness.mocks.replacePostsCache).toHaveBeenCalledWith("threads-1", [{ id: "post-1" }], {
      threads_user_id: "threads-1",
      next_cursor: null,
      has_more: false,
    });
    expect(result).toEqual({
      status: 200,
      body: {
        success: true,
        surface: "insights",
        brand_key: "manifest_mental",
        posts: [{ id: "post-1" }],
        next_cursor: null,
        has_more: false,
        cursor_depth: 3,
      },
    });
  });

  it("preserves archive and missing saved-pattern pagination contracts", async () => {
    const harness = createHarness();
    const archive = await readOperatorLensicallyUiSurface({
      ...harness.input,
      payload: { surface: "post_archive", order: "top", page: 2, limit: 3 },
    }, harness.dependencies);
    expect(harness.mocks.listPostArchive).toHaveBeenCalledWith("threads-1", "top", 3, 3);
    expect(archive).toMatchObject({
      status: 200,
      body: { order: "top", page: 2, page_size: 3, total_pages: 3 },
    });

    harness.mocks.listSavedPatterns.mockResolvedValue({ available: false, patterns: [], totalCount: 0 });
    const patterns = await readOperatorLensicallyUiSurface({
      ...harness.input,
      payload: { surface: "saved_patterns", order: "likes", page: 2, limit: 20 },
    }, harness.dependencies);
    expect(patterns).toEqual({
      status: 200,
      body: {
        success: true,
        surface: "saved_patterns",
        brand_key: "manifest_mental",
        patterns: [],
        total_count: 0,
        order: "likes",
        page: 2,
        page_size: 20,
        total_pages: 1,
      },
    });
  });

  it("returns the exact unsupported-surface status and body", async () => {
    const harness = createHarness();
    expect(await readOperatorLensicallyUiSurface({
      ...harness.input,
      payload: { surface: "unknown" },
    }, harness.dependencies)).toEqual({
      status: 400,
      body: { success: false, error: "unsupported_lensically_ui_surface", surface: "unknown" },
    });
  });
});
