import { describe, expect, it, vi } from "vitest";
import {
  composeOperatorStrategyMemorySaveResponse,
  planOperatorStrategyMemorySave,
} from "../src/operatorStrategyMemorySaveService";

const allowedKinds = ["approval_feedback", "rejection_feedback"] as const;

function createDependencies() {
  return {
    normalizeKind: vi.fn((value: unknown) => allowedKinds.includes(value as typeof allowedKinds[number])
      ? value as typeof allowedKinds[number]
      : null),
    allowedKinds,
    normalizeText: vi.fn((value: unknown, _maxLength: number) => {
      if (typeof value !== "string") return null;
      const normalized = value.trim();
      return normalized || null;
    }),
    normalizeJson: vi.fn((value: unknown) => JSON.stringify(value)),
  };
}

describe("operator strategy memory save", () => {
  it("returns the exact invalid-kind rejection with all allowed kinds", () => {
    const dependencies = createDependencies();
    const result = planOperatorStrategyMemorySave({
      kind: "unknown",
      body: "Memory body",
    }, dependencies);

    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "invalid_strategy_memory_kind",
        allowed_kinds: ["approval_feedback", "rejection_feedback"],
      },
    });
    expect(dependencies.normalizeText).not.toHaveBeenCalled();
    expect(dependencies.normalizeJson).not.toHaveBeenCalled();
  });

  it("returns the exact required-body rejection after valid kind admission", () => {
    const dependencies = createDependencies();
    const result = planOperatorStrategyMemorySave({
      kind: "approval_feedback",
      body: "   ",
    }, dependencies);

    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "strategy_memory_body_required",
      },
    });
    expect(dependencies.normalizeText).toHaveBeenCalledWith("   ", 20_000);
    expect(dependencies.normalizeJson).not.toHaveBeenCalled();
  });

  it("builds normalized persistence values with default source metadata", () => {
    const dependencies = createDependencies();
    const result = planOperatorStrategyMemorySave({
      kind: "approval_feedback",
      title: "  Strong approval  ",
      body: "  Keep this pattern.  ",
      metadata: { draft_id: "draft-1", score: 9 },
    }, dependencies);

    expect(dependencies.normalizeText).toHaveBeenNthCalledWith(1, "  Keep this pattern.  ", 20_000);
    expect(dependencies.normalizeText).toHaveBeenNthCalledWith(2, "  Strong approval  ", 500, true);
    expect(dependencies.normalizeJson).toHaveBeenCalledWith({
      draft_id: "draft-1",
      score: 9,
      source: "mcp_operator",
    }, {});
    expect(result).toEqual({
      kind: "plan",
      values: {
        memoryKind: "approval_feedback",
        title: "Strong approval",
        body: "Keep this pattern.",
        metadataJson: "{\"draft_id\":\"draft-1\",\"score\":9,\"source\":\"mcp_operator\"}",
      },
    });
  });

  it("uses an explicit source and ignores malformed metadata containers", () => {
    const dependencies = createDependencies();
    const result = planOperatorStrategyMemorySave({
      kind: "rejection_feedback",
      body: "Do not repeat this.",
      metadata: ["not", "an", "object"],
      source: "autonomous_gate",
    }, dependencies);

    expect(dependencies.normalizeJson).toHaveBeenCalledWith({
      source: "autonomous_gate",
    }, {});
    expect(result).toEqual({
      kind: "plan",
      values: {
        memoryKind: "rejection_feedback",
        title: null,
        body: "Do not repeat this.",
        metadataJson: "{\"source\":\"autonomous_gate\"}",
      },
    });
  });

  it("composes exact persisted and null memory responses", () => {
    expect(composeOperatorStrategyMemorySaveResponse({ id: 42 })).toEqual({ memory_id: 42 });
    expect(composeOperatorStrategyMemorySaveResponse(null)).toEqual({ memory_id: null });
    expect(composeOperatorStrategyMemorySaveResponse({})).toEqual({ memory_id: null });
  });
});
