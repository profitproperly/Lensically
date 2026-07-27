type JsonRecord = Record<string, unknown>;

interface ThreadsPostsPage {
  posts: JsonRecord[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface FollowerSnapshotRow extends JsonRecord {
  snapshot_date?: string;
  baseline_followers_count?: number | null;
  followers_count?: number;
  captured_at?: string;
}

export interface OperatorLensicallyUiSurfaceDependencies {
  insightsTimezone: string;
  maxPostsCursorDepth: number;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  getThreadsAccount(threadsUserId: string): Promise<JsonRecord | null>;
  buildDashboard(account: JsonRecord): Promise<JsonRecord>;
  refreshFollowerSnapshot(account: JsonRecord, timezone: string): Promise<unknown>;
  countFollowerSnapshots(threadsUserId: string): Promise<number>;
  listFollowerSnapshots(threadsUserId: string, limit: number, offset: number): Promise<FollowerSnapshotRow[]>;
  fetchPostsPage(accessToken: string, threadsUserId: string, cursor: string | null): Promise<ThreadsPostsPage | null>;
  upsertPostsArchive(threadsUserId: string, posts: JsonRecord[]): Promise<unknown>;
  replacePostsCache(threadsUserId: string, posts: JsonRecord[], metadata: JsonRecord): Promise<unknown>;
  listPostArchive(threadsUserId: string, order: "top" | "recent", limit: number, offset: number): Promise<{
    posts: JsonRecord[];
    totalCount: number;
  }>;
  listSavedPatterns(accountId: string, order: "likes" | "newest", limit: number, offset: number): Promise<{
    available: boolean;
    patterns: JsonRecord[];
    totalCount: number;
  }>;
}

export interface OperatorLensicallyUiSurfaceResult {
  status: number;
  body: JsonRecord;
}

export async function readOperatorLensicallyUiSurface(
  input: {
    brandKey: string;
    accountId: string;
    threadsUserId: string;
    payload: JsonRecord;
  },
  dependencies: OperatorLensicallyUiSurfaceDependencies,
): Promise<OperatorLensicallyUiSurfaceResult> {
  const surface = dependencies.normalizeText(input.payload.surface, 40, true);
  const page = Math.max(Math.trunc(Number(input.payload.page ?? 1)), 1);
  const limit = Math.min(Math.max(Math.trunc(Number(input.payload.limit ?? 100)), 1), 200);
  const account = await dependencies.getThreadsAccount(input.threadsUserId);
  if (!account?.threads_user_id) {
    return { status: 404, body: { success: false, error: "threads_account_not_connected" } };
  }
  const resolvedThreadsUserId = String(account.threads_user_id);

  if (surface === "dashboard") {
    if (!account.access_token) {
      return { status: 400, body: { success: false, error: "threads_access_token_missing" } };
    }
    return {
      status: 200,
      body: {
        success: true,
        surface,
        brand_key: input.brandKey,
        data: await dependencies.buildDashboard(account),
      },
    };
  }

  if (surface === "followers") {
    await dependencies.refreshFollowerSnapshot(account, dependencies.insightsTimezone);
    const offset = (page - 1) * limit;
    const totalCount = await dependencies.countFollowerSnapshots(resolvedThreadsUserId);
    const snapshotRows = await dependencies.listFollowerSnapshots(resolvedThreadsUserId, limit + 1, offset);
    const rows = snapshotRows.slice(0, limit).map((row, index) => {
      const olderSnapshot = snapshotRows[index + 1] ?? null;
      const latestFollowers = Number(row.followers_count ?? 0);
      const startOfDayFollowers = Number(row.baseline_followers_count ?? latestFollowers);
      const olderFollowers = olderSnapshot ? Number(olderSnapshot.followers_count ?? 0) : null;
      return {
        date: row.snapshot_date,
        start_of_day_followers: startOfDayFollowers,
        gap_carry: olderFollowers === null ? 0 : startOfDayFollowers - olderFollowers,
        latest_followers: latestFollowers,
        net_change: olderFollowers === null
          ? latestFollowers - startOfDayFollowers
          : latestFollowers - olderFollowers,
        updated_at: row.captured_at,
      };
    });
    return {
      status: 200,
      body: {
        success: true,
        surface,
        brand_key: input.brandKey,
        rows,
        total_count: totalCount,
        page,
        page_size: limit,
        total_pages: Math.max(1, Math.ceil(totalCount / limit)),
        timezone: dependencies.insightsTimezone,
      },
    };
  }

  if (surface === "insights") {
    if (!account.access_token) {
      return { status: 400, body: { success: false, error: "threads_access_token_missing" } };
    }
    const accessToken = String(account.access_token);
    const cursor = dependencies.normalizeText(input.payload.cursor, 2000, true);
    const requestedDepth = Math.trunc(Number(input.payload.cursor_depth ?? (cursor ? 2 : 1)));
    const cursorDepth = Math.min(Math.max(requestedDepth, 1), dependencies.maxPostsCursorDepth);
    const postsPage = await dependencies.fetchPostsPage(accessToken, resolvedThreadsUserId, cursor);
    if (!postsPage) {
      return { status: 502, body: { success: false, error: "threads_insights_upstream_failed" } };
    }
    const hasMore = postsPage.hasMore && cursorDepth < dependencies.maxPostsCursorDepth;
    const nextCursor = cursorDepth < dependencies.maxPostsCursorDepth ? postsPage.nextCursor : null;
    await dependencies.upsertPostsArchive(resolvedThreadsUserId, postsPage.posts);
    if (!cursor) {
      await dependencies.replacePostsCache(resolvedThreadsUserId, postsPage.posts, {
        threads_user_id: resolvedThreadsUserId,
        next_cursor: nextCursor,
        has_more: hasMore,
      });
    }
    return {
      status: 200,
      body: {
        success: true,
        surface,
        brand_key: input.brandKey,
        posts: postsPage.posts,
        next_cursor: nextCursor,
        has_more: hasMore,
        cursor_depth: cursorDepth,
      },
    };
  }

  if (surface === "post_archive") {
    const order = input.payload.order === "top" ? "top" : "recent";
    const offset = (page - 1) * limit;
    const archive = await dependencies.listPostArchive(resolvedThreadsUserId, order, limit, offset);
    return {
      status: 200,
      body: {
        success: true,
        surface,
        brand_key: input.brandKey,
        posts: archive.posts,
        total_count: archive.totalCount,
        order,
        page,
        page_size: limit,
        total_pages: Math.max(1, Math.ceil(archive.totalCount / limit)),
      },
    };
  }

  if (surface === "saved_patterns") {
    const order = input.payload.order === "likes" ? "likes" : "newest";
    const offset = (page - 1) * limit;
    const savedPatterns = await dependencies.listSavedPatterns(input.accountId, order, limit, offset);
    if (!savedPatterns.available) {
      return {
        status: 200,
        body: {
          success: true,
          surface,
          brand_key: input.brandKey,
          patterns: [],
          total_count: 0,
          order,
          page,
          page_size: limit,
          total_pages: 1,
        },
      };
    }
    return {
      status: 200,
      body: {
        success: true,
        surface,
        brand_key: input.brandKey,
        patterns: savedPatterns.patterns,
        total_count: savedPatterns.totalCount,
        order,
        page,
        page_size: limit,
        total_pages: Math.max(1, Math.ceil(savedPatterns.totalCount / limit)),
      },
    };
  }

  return {
    status: 400,
    body: { success: false, error: "unsupported_lensically_ui_surface", surface },
  };
}
