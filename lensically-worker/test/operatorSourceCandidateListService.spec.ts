import { describe, expect, it, vi } from "vitest";
import {
  listOperatorSourceCandidates,
  type OperatorSourceCandidateListDependencies,
} from "../src/operatorSourceCandidateListService";

function createHarness() {
  const mocks = {
    listCandidates: vi.fn(async () => ({ candidates: [] as unknown[], totalCount: 0 })),
  };
  const dependencies: OperatorSourceCandidateListDependencies = {
    manifestBrandKey: "manifest_mental",
    manifestSourceMinVerifiedLikes: 1000,
    listCandidates: mocks.listCandidates,
  };
  return { mocks, dependencies };
}

describe("operatorSourceCandidateListService", () => {
  it("uses empty source filters and canonical pagination defaults", async () => {
    const harness = createHarness();

    expect(await listOperatorSourceCandidates({
      brandKey: "vectrix",
      payload: {},
    }, harness.dependencies)).toEqual({
      candidates: [],
      returned_count: 0,
      total_count: 0,
      has_more: false,
      eligibility_min_likes: null,
    });
    expect(harness.mocks.listCandidates).toHaveBeenCalledWith({
      brandKey: "vectrix",
      sourceTypes: [],
      limit: 50,
      offset: 0,
    });
  });

  it("normalizes mixed source types and numeric pagination inputs", async () => {
    const harness = createHarness();

    await listOperatorSourceCandidates({
      brandKey: "opmg_deadman",
      payload: {
        source_types: ["saved_pattern", 42, true],
        limit: "12",
        offset: "8",
      },
    }, harness.dependencies);

    expect(harness.mocks.listCandidates).toHaveBeenCalledWith({
      brandKey: "opmg_deadman",
      sourceTypes: ["saved_pattern", "42", "true"],
      limit: 12,
      offset: 8,
    });
  });

  it("reports continuation when returned candidates do not exhaust the total", async () => {
    const harness = createHarness();
    harness.mocks.listCandidates.mockResolvedValue({
      candidates: [{ id: "one" }, { id: "two" }],
      totalCount: 10,
    });

    expect(await listOperatorSourceCandidates({
      brandKey: "vectrix",
      payload: { offset: 3, limit: 2 },
    }, harness.dependencies)).toEqual({
      candidates: [{ id: "one" }, { id: "two" }],
      returned_count: 2,
      total_count: 10,
      has_more: true,
      eligibility_min_likes: null,
    });
  });

  it("reports complete pagination when the returned window reaches the total", async () => {
    const harness = createHarness();
    harness.mocks.listCandidates.mockResolvedValue({
      candidates: [{ id: "last" }],
      totalCount: 6,
    });

    const result = await listOperatorSourceCandidates({
      brandKey: "vectrix",
      payload: { offset: 5, limit: 50 },
    }, harness.dependencies);

    expect(result.returned_count).toBe(1);
    expect(result.total_count).toBe(6);
    expect(result.has_more).toBe(false);
  });

  it("returns Manifest eligibility metadata and null for other brands", async () => {
    const harness = createHarness();

    const manifest = await listOperatorSourceCandidates({
      brandKey: "manifest_mental",
      payload: {},
    }, harness.dependencies);
    const other = await listOperatorSourceCandidates({
      brandKey: "vectrix",
      payload: {},
    }, harness.dependencies);

    expect(manifest.eligibility_min_likes).toBe(1000);
    expect(other.eligibility_min_likes).toBeNull();
  });
});
