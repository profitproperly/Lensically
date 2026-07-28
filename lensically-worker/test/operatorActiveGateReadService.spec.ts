import { describe, expect, it, vi } from "vitest";
import { readOperatorActiveGates } from "../src/operatorActiveGateReadService";

describe("operator active gate read", () => {
  it("passes null scopes when optional filters are absent", async () => {
    const listGates = vi.fn(async () => [{ id: "gate-1" }]);
    const result = await readOperatorActiveGates({
      brandKey: "manifest_mental",
      payload: {},
    }, {
      normalizeStage: vi.fn((value: unknown) => String(value)),
      normalizeMachineKey: vi.fn((_value: unknown, fallback: string) => fallback),
      listGates,
    });

    expect(listGates).toHaveBeenCalledWith({
      brandKey: "manifest_mental",
      stageScope: null,
      laneKey: null,
      contentType: null,
    });
    expect(result).toEqual({ gates: [{ id: "gate-1" }] });
  });

  it("normalizes every supplied scope and returns the exact gates response", async () => {
    const normalizeStage = vi.fn(() => "gate_evaluation");
    const normalizeMachineKey = vi.fn((value: unknown) => String(value).trim().toLowerCase());
    const listGates = vi.fn(async () => [
      { id: "gate-1", gate_key: "brand" },
      { id: "gate-2", gate_key: "duplicate" },
    ]);
    const result = await readOperatorActiveGates({
      brandKey: "manifest_mental",
      payload: {
        stage_scope: " Gate Evaluation ",
        lane_key: " Manifest Lane ",
        content_type: " Text Post ",
      },
    }, {
      normalizeStage,
      normalizeMachineKey,
      listGates,
    });

    expect(normalizeStage).toHaveBeenCalledWith(" Gate Evaluation ");
    expect(normalizeMachineKey).toHaveBeenNthCalledWith(1, " Manifest Lane ", "");
    expect(normalizeMachineKey).toHaveBeenNthCalledWith(2, " Text Post ", "");
    expect(listGates).toHaveBeenCalledWith({
      brandKey: "manifest_mental",
      stageScope: "gate_evaluation",
      laneKey: "manifest lane",
      contentType: "text post",
    });
    expect(result).toEqual({
      gates: [
        { id: "gate-1", gate_key: "brand" },
        { id: "gate-2", gate_key: "duplicate" },
      ],
    });
  });
});
