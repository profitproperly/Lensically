import { describe, expect, it, vi } from "vitest";
import {
  admitOperatorGenerationRun,
  type OperatorGenerationRunAdmissionDependencies,
} from "../src/operatorGenerationRunAdmissionService";

type JsonRecord = Record<string, unknown>;

function createDependencies(
  overrides: Partial<OperatorGenerationRunAdmissionDependencies> = {},
): OperatorGenerationRunAdmissionDependencies {
  return {
    getWorkflowConflict: vi.fn(() => null),
    normalizeText: (value) => {
      const text = String(value ?? "").trim();
      return text || null;
    },
    normalizeAdaptationPlan: vi.fn(() => ({ adaptation_goal: "Transform the payoff" })),
    loadSourceCard: vi.fn(async () => null),
    loadCanonicalContext: vi.fn(async () => ({})),
    loadAccountRejectionContext: vi.fn(async () => null),
    loadPerformanceLearning: vi.fn(async () => null),
    ...overrides,
  };
}

describe("admitOperatorGenerationRun", () => {
  it("returns the exact saved-workflow conflict before any source-card lookup", async () => {
    const dependencies = createDependencies({
      getWorkflowConflict: vi.fn(() => "single_source_card_loop_required"),
    });

    const result = await admitOperatorGenerationRun({
      brandKey: "manifest_mental",
      payload: { source_card_id: "card-1" },
    }, dependencies);

    expect(dependencies.loadSourceCard).not.toHaveBeenCalled();
    expect(dependencies.normalizeAdaptationPlan).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "lensically_saved_workflow_required",
        reason: "single_source_card_loop_required",
        required_workflow: "Create generation runs according to the selected account's saved workflow. Do not create batch or multi-post generation runs unless a backend-supported override exists for that account.",
      },
    });
  });

  it("requires a normalized locked source card before adaptation work", async () => {
    const dependencies = createDependencies({
      loadSourceCard: vi.fn(async () => ({ id: "card-1", status: "draft" })),
    });

    const result = await admitOperatorGenerationRun({
      brandKey: "manifest_mental",
      payload: { source_card_id: " card-1 " },
    }, dependencies);

    expect(dependencies.loadSourceCard).toHaveBeenCalledWith("card-1");
    expect(dependencies.normalizeAdaptationPlan).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: { success: false, error: "locked_source_card_required" },
    });
  });

  it("requires a Manifest adaptation goal before context retrieval", async () => {
    const dependencies = createDependencies({
      loadSourceCard: vi.fn(async () => ({ id: "card-1", status: "locked" })),
      normalizeAdaptationPlan: vi.fn(() => ({ adaptation_goal: null })),
    });

    const result = await admitOperatorGenerationRun({
      brandKey: "manifest_mental",
      payload: { source_card_id: "card-1", adaptation_plan: {} },
    }, dependencies);

    expect(dependencies.loadCanonicalContext).not.toHaveBeenCalled();
    expect(dependencies.loadAccountRejectionContext).not.toHaveBeenCalled();
    expect(dependencies.loadPerformanceLearning).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: { success: false, error: "manifest_adaptation_goal_required" },
    });
  });

  it("allows a non-Manifest run without an adaptation goal", async () => {
    const card = { id: "card-1", status: "locked", family_id: "family-1" };
    const dependencies = createDependencies({
      loadSourceCard: vi.fn(async () => card),
      normalizeAdaptationPlan: vi.fn(() => ({ adaptation_goal: null })),
      loadCanonicalContext: vi.fn(async () => ({ family: null, versions: [] })),
    });

    const result = await admitOperatorGenerationRun({
      brandKey: "opmg_deadman",
      payload: { source_card_id: "card-1", adaptation_plan: {} },
    }, dependencies);

    expect(result.kind).toBe("continue");
    if (result.kind !== "continue") throw new Error("expected continuation");
    expect(result.context.sourceCard).toEqual(card);
    expect(result.context.adaptationPlan).toEqual({ adaptation_goal: null });
  });

  it("assembles canonical context with only the latest 24 historical runs", async () => {
    const card = {
      id: "card-1",
      status: "locked",
      family_id: "family-1",
      version_number: 4,
    };
    const adaptationHistory = Array.from({ length: 30 }, (_, index) => ({ run_id: `run-${index + 1}` }));
    const canonicalContext: JsonRecord = {
      family: { id: "family-1" },
      versions: [{ id: "card-0" }, card],
      adaptation_history: adaptationHistory,
    };
    const rejectionContext = { blocked_families: ["family-0"] };
    const performanceLearning = { winning_lanes: ["money"] };
    const dependencies = createDependencies({
      loadSourceCard: vi.fn(async () => card),
      normalizeAdaptationPlan: vi.fn(() => ({
        adaptation_goal: "Transform the payoff",
        retained_exact_surfaces: ["hook"],
      })),
      loadCanonicalContext: vi.fn(async () => canonicalContext),
      loadAccountRejectionContext: vi.fn(async () => rejectionContext),
      loadPerformanceLearning: vi.fn(async () => performanceLearning),
    });

    const result = await admitOperatorGenerationRun({
      brandKey: "manifest_mental",
      payload: {
        source_card_id: "card-1",
        adaptation_plan: { adaptation_goal: "Transform the payoff" },
      },
    }, dependencies);

    expect(dependencies.loadCanonicalContext).toHaveBeenCalledWith(card);
    expect(dependencies.loadAccountRejectionContext).toHaveBeenCalledOnce();
    expect(dependencies.loadPerformanceLearning).toHaveBeenCalledOnce();
    expect(result).toEqual({
      kind: "continue",
      context: {
        sourceCardId: "card-1",
        sourceCard: card,
        adaptationPlan: {
          adaptation_goal: "Transform the payoff",
          retained_exact_surfaces: ["hook"],
        },
        canonicalContext,
        accountRejectionContext: rejectionContext,
        performanceLearning,
        priorAdaptationContext: {
          family: { id: "family-1" },
          versions: [{ id: "card-0" }, card],
          prior_runs: adaptationHistory.slice(-24),
          account_rejection_context: rejectionContext,
          performance_learning: performanceLearning,
        },
      },
    });
  });

  it("uses empty canonical defaults when optional history fields are malformed", async () => {
    const dependencies = createDependencies({
      loadSourceCard: vi.fn(async () => ({ id: "card-1", status: "locked" })),
      loadCanonicalContext: vi.fn(async () => ({
        family: undefined,
        versions: undefined,
        adaptation_history: "bad-history",
      })),
    });

    const result = await admitOperatorGenerationRun({
      brandKey: "manifest_mental",
      payload: { source_card_id: "card-1" },
    }, dependencies);

    expect(result.kind).toBe("continue");
    if (result.kind !== "continue") throw new Error("expected continuation");
    expect(result.context.priorAdaptationContext).toMatchObject({
      family: null,
      versions: [],
      prior_runs: [],
    });
  });
});
