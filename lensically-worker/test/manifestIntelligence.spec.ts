import { describe, expect, it } from "vitest";
import { validateManifestFollowerAttributionBoundary } from "../src/manifestIntelligence";

describe("Manifest follower attribution boundary", () => {
  it("allows explicit no-attribution policy statements that use a no-follower noun phrase", () => {
    expect(validateManifestFollowerAttributionBoundary({
      uncertainty: "Evidence is incomplete, and no follower movement is attributed to individual posts or families.",
    })).toEqual({ ok: true });
  });

  it("continues to reject positive scoped follower attribution claims", () => {
    const result = validateManifestFollowerAttributionBoundary({
      conclusion: "This post generated 25 followers.",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("follower_attribution_forbidden");
  });
});


