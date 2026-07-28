import { describe, expect, it, vi } from "vitest";
import { planOperatorGenerationDraftPersistence } from "../src/operatorGenerationDraftPersistencePlanningService";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    toolName: "submit_candidate_draft",
    payload: {},
    draftId: "draft-1",
    runId: "run-1",
    accountId: "account-1",
    threadsUserId: "threads-1",
    sourceCardId: "card-1",
    text: "Draft text",
    ...overrides,
  };
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    normalizeText: vi.fn((value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null),
    normalizeMachineKey: vi.fn((value: unknown, fallback: string) => typeof value === "string" ? value.trim() : fallback),
    normalizeJson: vi.fn((value: unknown) => JSON.stringify(value)),
    runGates: vi.fn(async () => ({
      showable: false,
      gate_results: [],
      blocking_failures: [],
      warnings: [],
    })),
    ...overrides,
  };
}

describe("operator generation draft persistence planning", () => {
  it("runs candidate gates with exact context and builds insert values plus repair guidance", async () => {
    const deps = dependencies({
      runGates: vi.fn(async () => ({
        showable: false,
        gate_results: [{ gate: "brand", passed: true }],
        blocking_failures: [
          { gate: "duplicate", repair_guidance: "Change the opening." },
          { gate: "format", repair_guidance: null },
        ],
        warnings: ["review"],
      })),
    });
    const result = await planOperatorGenerationDraftPersistence(baseInput({
      payload: {
        draft_index: 3,
        strategy: { pillar: "money" },
        draft_analysis: { lane_key: "manifest_lane", novelty: "medium" },
        model_gate_results: [{ gate: "model" }],
        rejection_reason: " revise ",
        score: { total: 8 },
      },
    }), deps);

    expect(deps.runGates).toHaveBeenCalledWith({
      sourceCardId: "card-1",
      draftId: "draft-1",
      draftText: "Draft text",
      stageScope: "gate_evaluation",
      laneKey: "manifest_lane",
      draftAnalysis: { lane_key: "manifest_lane", novelty: "medium" },
      modelGateResults: [{ gate: "model" }],
    });
    expect(result.insertValues).toMatchObject({
      draftId: "draft-1",
      runId: "run-1",
      accountId: "account-1",
      threadsUserId: "threads-1",
      sourceCardId: "card-1",
      draftIndex: 3,
      text: "Draft text",
      status: "candidate",
      rejectionReason: "revise",
      showable: 0,
    });
    expect(JSON.parse(String(result.insertValues.strategyJson))).toEqual({
      pillar: "money",
      analysis: { lane_key: "manifest_lane", novelty: "medium" },
    });
    expect(result.body).toEqual({
      draft_id: "draft-1",
      status: "candidate",
      showable: false,
      gate_results: [{ gate: "brand", passed: true }],
      blocking_failures: [
        { gate: "duplicate", repair_guidance: "Change the opening." },
        { gate: "format", repair_guidance: null },
      ],
      repair_guidance: ["Change the opening."],
    });
  });

  it("skips gates and returns deterministic defaults for self-rejected drafts", async () => {
    const deps = dependencies();
    const result = await planOperatorGenerationDraftPersistence(baseInput({
      toolName: "save_self_rejected_draft",
      payload: { draft_index: "invalid" },
    }), deps);

    expect(deps.runGates).not.toHaveBeenCalled();
    expect(result.insertValues).toMatchObject({
      draftIndex: 1,
      status: "self_rejected",
      showable: 0,
    });
    expect(result.body).toEqual({
      draft_id: "draft-1",
      status: "self_rejected",
      showable: false,
      gate_results: [],
      blocking_failures: [],
      repair_guidance: [],
    });
  });

  it("normalizes malformed strategy and analysis with a zero floor for draft index", async () => {
    const deps = dependencies();
    const result = await planOperatorGenerationDraftPersistence(baseInput({
      payload: {
        draft_index: -4,
        strategy: [],
        draft_analysis: "invalid",
      },
    }), deps);

    expect(deps.runGates).toHaveBeenCalledWith(expect.objectContaining({
      laneKey: null,
      draftAnalysis: {},
      modelGateResults: null,
    }));
    expect(result.insertValues.draftIndex).toBe(0);
    expect(JSON.parse(String(result.insertValues.strategyJson))).toEqual({ analysis: {} });
  });

  it("uses scores fallback and stable operator metadata in the persistence plan", async () => {
    const deps = dependencies();
    const result = await planOperatorGenerationDraftPersistence(baseInput({
      payload: { scores: { quality: 7 } },
    }), deps);

    expect(JSON.parse(String(result.insertValues.scoreJson))).toEqual({ quality: 7 });
    expect(JSON.parse(String(result.insertValues.metadataJson))).toEqual({
      source: "operator_mode_mcp",
    });
    expect(JSON.parse(String(result.insertValues.gateSummaryJson))).toEqual({
      gate_results: [],
      blocking_failures: [],
    });
  });
});
