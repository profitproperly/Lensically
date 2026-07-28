import { describe, expect, it, vi } from "vitest";
import {
  excludeOperatorSavedPatternSource,
  type OperatorSavedPatternSourceExclusionDependencies,
} from "../src/operatorSavedPatternSourceExclusionService";

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function createHarness() {
  const calls: string[] = [];
  const mocks = {
    getPattern: vi.fn(async () => ({ id: 7, post_id: "post-7", source_url: "https://threads.net/@x/post/post-7" })),
    canonicalizeSourceUrl: vi.fn((value: string | null) => value),
    extractThreadsPostId: vi.fn(() => "url-post"),
    upsertExclusion: vi.fn(async () => { calls.push("exclude"); }),
    skipActiveSelections: vi.fn(async () => { calls.push("selections"); return 3; }),
    markActiveClaimsDeleted: vi.fn(async () => { calls.push("claims"); }),
  };
  const dependencies: OperatorSavedPatternSourceExclusionDependencies = {
    normalizeText,
    createId: () => "exclusion-new",
    getPattern: mocks.getPattern,
    canonicalizeSourceUrl: mocks.canonicalizeSourceUrl,
    extractThreadsPostId: mocks.extractThreadsPostId,
    upsertExclusion: mocks.upsertExclusion,
    skipActiveSelections: mocks.skipActiveSelections,
    markActiveClaimsDeleted: mocks.markActiveClaimsDeleted,
  };
  return { calls, mocks, dependencies };
}

describe("operatorSavedPatternSourceExclusionService", () => {
  it("rejects missing explicit delete approval before reads or mutation", async () => {
    const harness = createHarness();

    expect(await excludeOperatorSavedPatternSource({
      brandKey: "manifest_mental",
      payload: { pattern_id: 7, owner_approval: "remove this" },
    }, harness.dependencies)).toEqual({
      status: 400,
      body: {
        success: false,
        error: "pattern_id and explicit owner_approval containing delete are required",
      },
    });
    expect(harness.mocks.getPattern).not.toHaveBeenCalled();
    expect(harness.mocks.upsertExclusion).not.toHaveBeenCalled();
  });

  it("returns the exact not-found preservation response without mutation", async () => {
    const harness = createHarness();
    harness.mocks.getPattern.mockResolvedValue(null);

    expect(await excludeOperatorSavedPatternSource({
      brandKey: "manifest_mental",
      payload: { pattern_id: 7, owner_approval: "Delete this source" },
    }, harness.dependencies)).toEqual({
      status: 200,
      body: {
        excluded_source_count: 0,
        preserved_pattern_count: 0,
        status: "not_found",
      },
    });
    expect(harness.mocks.upsertExclusion).not.toHaveBeenCalled();
    expect(harness.mocks.skipActiveSelections).not.toHaveBeenCalled();
    expect(harness.mocks.markActiveClaimsDeleted).not.toHaveBeenCalled();
  });

  it("prefers the stored Threads post ID for durable source identity", async () => {
    const harness = createHarness();

    const result = await excludeOperatorSavedPatternSource({
      brandKey: "manifest_mental",
      payload: { pattern_id: "7.9", owner_approval: "  DELETE future use  " },
    }, harness.dependencies);

    expect(result.body.source_identity_key).toBe("threads:post-7");
    expect(harness.mocks.upsertExclusion).toHaveBeenCalledWith({
      id: "exclusion-new",
      brandKey: "manifest_mental",
      sourceIdentityKey: "threads:post-7",
      patternId: 7,
      reason: "DELETE future use",
    });
  });

  it("falls back from canonical URL identity to saved-pattern identity", async () => {
    const canonicalHarness = createHarness();
    canonicalHarness.mocks.getPattern.mockResolvedValue({ id: 8, post_id: null, source_url: "raw" });
    canonicalHarness.mocks.canonicalizeSourceUrl.mockReturnValue("https://threads.net/@x/post/from-url");
    canonicalHarness.mocks.extractThreadsPostId.mockReturnValue(null);

    const canonical = await excludeOperatorSavedPatternSource({
      brandKey: "vectrix",
      payload: { pattern_id: 8, owner_approval: "delete" },
    }, canonicalHarness.dependencies);
    expect(canonical.body.source_identity_key).toBe("url:https://threads.net/@x/post/from-url");

    const fallbackHarness = createHarness();
    fallbackHarness.mocks.getPattern.mockResolvedValue({ id: 9, post_id: null, source_url: null });
    fallbackHarness.mocks.canonicalizeSourceUrl.mockReturnValue(null);
    fallbackHarness.mocks.extractThreadsPostId.mockReturnValue(null);
    const fallback = await excludeOperatorSavedPatternSource({
      brandKey: "vectrix",
      payload: { pattern_id: 9, owner_approval: "delete" },
    }, fallbackHarness.dependencies);
    expect(fallback.body.source_identity_key).toBe("saved_pattern:9");
  });

  it("retires active work in order while preserving all historical data", async () => {
    const harness = createHarness();

    expect(await excludeOperatorSavedPatternSource({
      brandKey: "manifest_mental",
      payload: { pattern_id: 7, owner_approval: "delete from future sources" },
    }, harness.dependencies)).toEqual({
      status: 200,
      body: {
        status: "excluded_from_future_sources",
        pattern_id: 7,
        source_identity_key: "threads:post-7",
        excluded_source_count: 1,
        preserved_pattern_count: 1,
        preserved_historical_data: true,
        skipped_active_selection_count: 3,
      },
    });
    expect(harness.calls).toEqual(["exclude", "selections", "claims"]);
    expect(harness.mocks.skipActiveSelections).toHaveBeenCalledWith({
      brandKey: "manifest_mental",
      patternId: 7,
    });
    expect(harness.mocks.markActiveClaimsDeleted).toHaveBeenCalledWith({
      brandKey: "manifest_mental",
      patternId: 7,
    });
  });
});
