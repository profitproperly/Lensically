import { describe, expect, it } from "vitest";
import {
  buildManifestEvidencePages,
  MANIFEST_EVIDENCE_FRAGMENT_CONTRACT_VERSION,
  validateManifestFollowerAttributionBoundary,
} from "../src/manifestIntelligence";

import { executeManifestD1WriteBatches } from "../src/manifestIntelligenceEngine";

describe("Manifest follower attribution boundary", () => {
  it("allows explicit no-attribution policy statements that use a no-follower noun phrase", () => {
    expect(validateManifestFollowerAttributionBoundary({
      uncertainty: "Evidence is incomplete, and no follower movement is attributed to individual posts or families.",
    })).toEqual({ ok: true });
  });

    it("allows explicit uncertainty and prohibition statements about attribution", () => {
    expect(validateManifestFollowerAttributionBoundary({
      account_conclusion: {
        uncertainty: "The evidence does not justify post-level follower attribution.",
      },
      directives: {
        prohibit: ["Post-level follower attribution"],
      },
    })).toEqual({ ok: true });
  });

  it("continues to reject positive scoped follower attribution claims", () => {
    const directResult = validateManifestFollowerAttributionBoundary({
      conclusion: "This post generated 25 followers.",
    });
    expect(directResult.ok).toBe(false);
    if (!directResult.ok) expect(directResult.errors.join(" ")).toContain("follower_attribution_forbidden");

    const policyPathResult = validateManifestFollowerAttributionBoundary({
      directives: {
        prohibit: ["This post generated 25 followers."],
      },
    });
    expect(policyPathResult.ok).toBe(false);
    if (!policyPathResult.ok) expect(policyPathResult.errors.join(" ")).toContain("follower_attribution_forbidden");
  });
});

describe("Manifest evidence paging", () => {
  it("losslessly fragments one oversized evidence item within the byte ceiling", () => {
    const oversizedOwnerNote = "🧠".repeat(7000);
    const pages = buildManifestEvidencePages({
      summary: {},
      posts: [{
        published_post_id: "post-1",
        lineage: { owner_note: oversizedOwnerNote },
      }],
      benchmarks: {},
      recentExposure: {},
      futureSchedule: [],
      hardBans: [],
      experiments: [],
      maxItems: 12,
      maxBytes: 4000,
    });
    expect(pages.every((page) => Number(page.byte_count) <= 4000)).toBe(true);
    const items = pages.flatMap((page) => Array.isArray(page.items)
      ? page.items as Record<string, unknown>[]
      : []);
    const fragments = items
      .filter((item) => item.evidence_type === "published_post"
        && item.fragment_contract_version === MANIFEST_EVIDENCE_FRAGMENT_CONTRACT_VERSION
        && JSON.stringify(item.fragment_path) === JSON.stringify(["lineage", "owner_note"]))
      .sort((left, right) => Number(left.fragment_index) - Number(right.fragment_index));
    expect(fragments.length).toBeGreaterThan(1);
    expect(fragments.every((item) => Number(item.fragment_count) === fragments.length)).toBe(true);
    expect(fragments.map((item) => String(item.data ?? "")).join("")).toBe(oversizedOwnerNote);
  });
});

describe("Manifest D1 write batching", () => {
  it("keeps large intelligence persistence within bounded D1 batch calls", async () => {
    const observedBatchSizes: number[] = [];
    const db = {
      batch: async (statements: D1PreparedStatement[]) => {
        observedBatchSizes.push(statements.length);
        return [];
      },
    } as unknown as Pick<D1Database, "batch">;
    const statements = Array.from({ length: 95 }, (_, index) => ({ index } as unknown as D1PreparedStatement));

    const receipt = await executeManifestD1WriteBatches(db, statements, 40);

    expect(receipt).toEqual({ statement_count: 95, batch_count: 3 });
    expect(observedBatchSizes).toEqual([40, 40, 15]);
  });

  it("does not call D1 for an empty write set", async () => {
    let calls = 0;
    const db = {
      batch: async () => {
        calls += 1;
        return [];
      },
    } as unknown as Pick<D1Database, "batch">;

    await expect(executeManifestD1WriteBatches(db, [])).resolves.toEqual({
      statement_count: 0,
      batch_count: 0,
    });
    expect(calls).toBe(0);
  });
});





