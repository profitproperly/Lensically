import { describe, expect, it, vi } from "vitest";
import {
  prepareOperatorManifestSourceCardBackfill,
  type OperatorManifestSourceCardBackfillPreparationDependencies,
} from "../src/operatorManifestSourceCardBackfillPreparationService";

type JsonRecord = Record<string, unknown>;

function createDependencies(
  overrides: Partial<OperatorManifestSourceCardBackfillPreparationDependencies> = {},
): OperatorManifestSourceCardBackfillPreparationDependencies {
  return {
    manifestBrandKey: "manifest_mental",
    loadState: vi.fn(async () => ({
      savedPatternTotal: 0,
      alreadyCardedCount: 0,
      rows: [],
    })),
    canonicalizeThreadsSourceUrl: (value) => value ? value.trim() : null,
    extractThreadsPostIdFromUrl: (value) => value?.split("/").pop() ?? null,
    ...overrides,
  };
}

describe("prepareOperatorManifestSourceCardBackfill", () => {
  it("rejects non-Manifest brands before reading state", async () => {
    const dependencies = createDependencies();

    const result = await prepareOperatorManifestSourceCardBackfill({
      brandKey: "vectrix",
      payload: {},
    }, dependencies);

    expect(result).toEqual({
      status: 400,
      body: { success: false, error: "manifest_mental_required" },
    });
    expect(dependencies.loadState).not.toHaveBeenCalled();
  });

  it("applies the exact default and bounded limits before state retrieval", async () => {
    const defaultDependencies = createDependencies();
    const defaultResult = await prepareOperatorManifestSourceCardBackfill({
      brandKey: "manifest_mental",
      payload: {},
    }, defaultDependencies);

    expect(defaultDependencies.loadState).toHaveBeenCalledWith({ limit: 8 });
    expect(defaultResult.body.batch_limit).toBe(8);

    const maximumDependencies = createDependencies();
    const maximumResult = await prepareOperatorManifestSourceCardBackfill({
      brandKey: "manifest_mental",
      payload: { limit: 900 },
    }, maximumDependencies);

    expect(maximumDependencies.loadState).toHaveBeenCalledWith({ limit: 25 });
    expect(maximumResult.body.batch_limit).toBe(25);

    const minimumDependencies = createDependencies();
    const minimumResult = await prepareOperatorManifestSourceCardBackfill({
      brandKey: "manifest_mental",
      payload: { limit: 0 },
    }, minimumDependencies);

    expect(minimumDependencies.loadState).toHaveBeenCalledWith({ limit: 1 });
    expect(minimumResult.body.batch_limit).toBe(1);
  });

  it("uses deterministic source identity precedence across post ID, URL, and Saved Pattern ID", async () => {
    const dependencies = createDependencies({
      loadState: vi.fn(async () => ({
        savedPatternTotal: 7,
        alreadyCardedCount: 3,
        rows: [
          { id: 11, post_id: "direct-post", source_url: " https://threads.net/t/url-post " },
          { id: 12, post_id: null, source_url: " https://threads.net/t/extracted-post " },
          { id: 13, post_id: null, source_url: " https://example.com/source " },
          { id: 14, post_id: null, source_url: null },
        ],
      })),
      canonicalizeThreadsSourceUrl: (value) => value ? value.trim() : null,
      extractThreadsPostIdFromUrl: (value) => value?.startsWith("https://threads.net/")
        ? value.split("/").pop() ?? null
        : null,
    });

    const result = await prepareOperatorManifestSourceCardBackfill({
      brandKey: "manifest_mental",
      payload: {},
    }, dependencies);
    const patterns = result.body.patterns as JsonRecord[];

    expect(patterns.map((pattern) => ({
      id: pattern.saved_pattern_id,
      identity: pattern.source_identity_key,
      postId: pattern.threads_post_id,
      url: pattern.canonical_source_url,
    }))).toEqual([
      {
        id: 11,
        identity: "threads:direct-post",
        postId: "direct-post",
        url: "https://threads.net/t/url-post",
      },
      {
        id: 12,
        identity: "threads:extracted-post",
        postId: "extracted-post",
        url: "https://threads.net/t/extracted-post",
      },
      {
        id: 13,
        identity: "url:https://example.com/source",
        postId: null,
        url: "https://example.com/source",
      },
      {
        id: 14,
        identity: "saved_pattern:14",
        postId: null,
        url: null,
      },
    ]);
    expect(result.body).toMatchObject({
      status: "ready",
      saved_pattern_total: 7,
      already_carded_count: 3,
      uncarded_count: 4,
      returned_count: 4,
    });
  });

  it("serializes metrics, nullable metadata, and exact rules without mutation", async () => {
    const dependencies = createDependencies({
      loadState: vi.fn(async () => ({
        savedPatternTotal: "2",
        alreadyCardedCount: "1",
        rows: [{
          id: "21",
          post_id: "post-21",
          source_url: "https://threads.net/t/post-21",
          post_text: "Pattern text",
          posted_at: undefined,
          capture_confidence: null,
          updated_at: "2026-07-01T00:00:00.000Z",
          views: "900",
          likes: "100",
          replies: "7",
          reposts: "3",
          shares: "5",
        }],
      })),
    });

    const result = await prepareOperatorManifestSourceCardBackfill({
      brandKey: "manifest_mental",
      payload: { limit: 2 },
    }, dependencies);

    expect(result).toEqual({
      status: 200,
      body: {
        success: true,
        brand_key: "manifest_mental",
        status: "ready",
        saved_pattern_total: 2,
        already_carded_count: 1,
        uncarded_count: 1,
        batch_limit: 2,
        returned_count: 1,
        patterns: [{
          saved_pattern_id: 21,
          source_identity_key: "threads:post-21",
          threads_post_id: "post-21",
          canonical_source_url: "https://threads.net/t/post-21",
          post_text: "Pattern text",
          posted_at: null,
          capture_confidence: null,
          source_updated_at: "2026-07-01T00:00:00.000Z",
          metrics: {
            views: 900,
            likes: 100,
            replies: 7,
            reposts: 3,
            shares: 5,
            engagement_total: 115,
          },
        }],
        completion_rule: "Complete only when every Saved Pattern has a linked source card.",
        interruption_rule: "Report an uncarded count only when execution is forced to stop before completion.",
      },
    });
  });

  it("returns complete state and clamps negative uncarded totals to zero", async () => {
    const dependencies = createDependencies({
      loadState: vi.fn(async () => ({
        savedPatternTotal: 4,
        alreadyCardedCount: 6,
        rows: [],
      })),
    });

    const result = await prepareOperatorManifestSourceCardBackfill({
      brandKey: "manifest_mental",
      payload: {},
    }, dependencies);

    expect(result.body).toMatchObject({
      status: "complete",
      saved_pattern_total: 4,
      already_carded_count: 6,
      uncarded_count: 0,
      returned_count: 0,
      patterns: [],
    });
  });
});
