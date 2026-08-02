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

    it("allows Manifest to decide from source evidence and owner notes without a forced adaptation goal", async () => {
    const card = {
      id: "card-1",
      status: "locked",
      primary_source: { text: "Original source" },
      owner_guidance: { id: "guidance-1", text: "Use my full note." },
      owner_edit_notes: [{ id: "revision-1", owner_note: "Previous correction." }],
      generation_direction: "Use the source card and the owner’s notes to understand the opportunity. Decide what the strongest post should be for Manifest Mental.",
    };
    const dependencies = createDependencies({
      loadSourceCard: vi.fn(async () => card),
      normalizeAdaptationPlan: vi.fn(() => ({ adaptation_goal: null })),
      loadCanonicalContext: vi.fn(async () => ({ family: null, versions: [], adaptation_history: [] })),
    });

    const result = await admitOperatorGenerationRun({
      brandKey: "manifest_mental",
      payload: { source_card_id: "card-1", adaptation_plan: {} },
    }, dependencies);

    expect(result.kind).toBe("continue");
    if (result.kind !== "continue") throw new Error("expected continuation");
    expect(result.context.adaptationPlan).toEqual({ adaptation_goal: null });
    expect(result.context.priorAdaptationContext).toMatchObject({
      source_evidence: { primary_source: { text: "Original source" } },
      owner_guidance: { id: "guidance-1", text: "Use my full note." },
      owner_edit_notes: [{ id: "revision-1", owner_note: "Previous correction." }],
      generation_direction: card.generation_direction,
      prior_runs: [],
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
        expect(result.kind).toBe("continue");
    if (result.kind !== "continue") throw new Error("expected continuation");
    expect(result.context).toMatchObject({
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
        source_evidence: {
          title: null,
          primary_source: null,
          metrics_snapshot: null,
        },
        owner_guidance: null,
        owner_edit_notes: [],
        generation_direction: null,
        account_rejection_context: rejectionContext,
        performance_learning: performanceLearning,
      },
    });
    expect(result.context.priorAdaptationContext.prior_runs).toEqual(
      adaptationHistory.slice(-24).map((run) => ({
        run_id: run.run_id,
        status: null,
        created_at: null,
        drafts: [],
      })),
    );
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
