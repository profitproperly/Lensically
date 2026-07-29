import { describe, expect, it, vi } from "vitest";
import { readOperatorStrategyMemoryList } from "../src/operatorStrategyMemoryListReadService";

describe("operator strategy memory list read", () => {
  it("uses unfiltered active memory with default pagination and exact counts", async () => {
    const listActiveMemory = vi.fn(async () => [
      { id: 1, kind: "approval_feedback" },
      { id: 2, kind: "rejection_feedback" },
    ]);
    const countActiveMemory = vi.fn(async () => 2);

    const result = await readOperatorStrategyMemoryList({ payload: {} }, {
      normalizeMachineKey: vi.fn((_value: unknown, fallback = "") => fallback),
      listActiveMemory,
      countActiveMemory,
    });

    expect(listActiveMemory).toHaveBeenCalledWith({
      kinds: [],
      limit: 50,
      offset: 0,
      status: "active",
    });
    expect(countActiveMemory).toHaveBeenCalledWith({
      kinds: [],
      status: "active",
    });
    expect(result).toEqual({
      items: [
        { id: 1, kind: "approval_feedback" },
        { id: 2, kind: "rejection_feedback" },
      ],
      returned_count: 2,
      total_count: 2,
      has_more: false,
    });
  });

  it("normalizes one kind and clamps limit and offset before active retrieval", async () => {
    const normalizeMachineKey = vi.fn(() => "approval_feedback");
    const listActiveMemory = vi.fn(async () => [
      { id: 7, kind: "approval_feedback" },
      { id: 8, kind: "approval_feedback" },
    ]);
    const countActiveMemory = vi.fn(async () => 5);

    const result = await readOperatorStrategyMemoryList({
      payload: {
        kind: " Approval Feedback ",
        limit: 500,
        offset: -9,
      },
    }, {
      normalizeMachineKey,
      listActiveMemory,
      countActiveMemory,
    });

    expect(normalizeMachineKey).toHaveBeenCalledWith(" Approval Feedback ", "");
    expect(listActiveMemory).toHaveBeenCalledWith({
      kinds: ["approval_feedback"],
      limit: 100,
      offset: 0,
      status: "active",
    });
    expect(countActiveMemory).toHaveBeenCalledWith({
      kinds: ["approval_feedback"],
      status: "active",
    });
    expect(result).toEqual({
      items: [
        { id: 7, kind: "approval_feedback" },
        { id: 8, kind: "approval_feedback" },
      ],
      returned_count: 2,
      total_count: 5,
      has_more: true,
    });
  });

  it("applies the lower limit bound and computes has_more from offset plus returned count", async () => {
    const listActiveMemory = vi.fn(async () => [{ id: 9 }]);
    const countActiveMemory = vi.fn(async () => 4);

    const result = await readOperatorStrategyMemoryList({
      payload: { limit: 0, offset: 3 },
    }, {
      normalizeMachineKey: vi.fn((_value: unknown, fallback = "") => fallback),
      listActiveMemory,
      countActiveMemory,
    });

    expect(listActiveMemory).toHaveBeenCalledWith({
      kinds: [],
      limit: 1,
      offset: 3,
      status: "active",
    });
    expect(result).toEqual({
      items: [{ id: 9 }],
      returned_count: 1,
      total_count: 4,
      has_more: false,
    });
  });
});
