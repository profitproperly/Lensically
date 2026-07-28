import { describe, expect, it, vi } from "vitest";
import {
  planOperatorGenerationRunPersistence,
  type OperatorGenerationRunPersistencePlanningDependencies,
} from "../src/operatorGenerationRunPersistencePlanningService";

function createDependencies(
  overrides: Partial<OperatorGenerationRunPersistencePlanningDependencies> = {},
): OperatorGenerationRunPersistencePlanningDependencies {
  return {
    normalizeText: (value) => {
      const text = String(value ?? "").trim();
      return text || null;
    },
    normalizeJson: (value, fallback) => JSON.stringify(value ?? fallback),
    parseJson: (value) => JSON.parse(value),
    loadExistingRun: vi.fn(async () => null),
    ...overrides,
  };
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    payload: {
      operation_id: " operation-1 ",
      objective: " Improve the payoff ",
      prompt_summary: " Keep the mechanism, change the expression ",
    },
    sourceCardId: "card-1",
    sourceCard: {
      id: "card-1",
      family_id: "family-1",
      version_number: 4,
    },
    adaptationPlan: { adaptation_goal: "Transform the payoff" },
    priorAdaptationContext: { prior_runs: [{ run_id: "run-old" }] },
    performanceLearning: { winning_lanes: ["money"] },
    runId: "run-new",
    accountId: "account-1",
    threadsUserId: "threads-1",
    transformationContractVersion: "source-transformation-contract-v1",
    ...overrides,
  };
}

describe("planOperatorGenerationRunPersistence", () => {
  it("skips the existing-run lookup when operation ID is absent", async () => {
    const dependencies = createDependencies();

    const result = await planOperatorGenerationRunPersistence(createInput({
      payload: {},
    }), dependencies);

    expect(dependencies.loadExistingRun).not.toHaveBeenCalled();
    expect(result.kind).toBe("continue");
    if (result.kind !== "continue") throw new Error("expected continuation");
    expect(result.plan.operationId).toBeNull();
    expect(result.plan.insertValues.metadataJson).toBe(JSON.stringify({
      source: "operator_mode_mcp",
      operation_id: null,
      canonical_source_card_reuse: true,
      transformation_contract_version: "source-transformation-contract-v1",
    }));
  });

  it("returns the exact existing-run reuse response with parsed persisted context", async () => {
    const existingRun = {
      id: "run-existing",
      source_card_family_id: "family-existing",
      source_card_version_number: "7",
      adaptation_plan_json: '{"adaptation_goal":"Persisted goal"}',
      prior_adaptation_context_json: '{"prior_runs":[{"run_id":"run-persisted"}]}',
      status: "reviewed",
    };
    const dependencies = createDependencies({
      loadExistingRun: vi.fn(async () => existingRun),
    });

    const result = await planOperatorGenerationRunPersistence(createInput(), dependencies);

    expect(dependencies.loadExistingRun).toHaveBeenCalledWith({
      sourceCardId: "card-1",
      operationId: "operation-1",
    });
    expect(result).toEqual({
      kind: "response",
      status: 200,
      body: {
        run_id: "run-existing",
        source_card_id: "card-1",
        source_card_family_id: "family-existing",
        source_card_version_number: 7,
        adaptation_plan: { adaptation_goal: "Persisted goal" },
        prior_adaptation_context: { prior_runs: [{ run_id: "run-persisted" }] },
        status: "reviewed",
        reused_existing: true,
        idempotency_reason: "generation_operation_already_completed",
      },
    });
  });

  it("falls back to current context and defaults when persisted JSON is unavailable", async () => {
    const parseJson = vi.fn(() => null);
    const dependencies = createDependencies({
      parseJson,
      loadExistingRun: vi.fn(async () => ({
        id: "run-existing",
        source_card_family_id: null,
        source_card_version_number: null,
        adaptation_plan_json: "bad-json",
        prior_adaptation_context_json: "bad-json",
        status: null,
      })),
    });

    const result = await planOperatorGenerationRunPersistence(createInput(), dependencies);

    expect(parseJson).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      kind: "response",
      status: 200,
      body: {
        run_id: "run-existing",
        source_card_id: "card-1",
        source_card_family_id: "family-1",
        source_card_version_number: 4,
        adaptation_plan: { adaptation_goal: "Transform the payoff" },
        prior_adaptation_context: { prior_runs: [{ run_id: "run-old" }] },
        status: "drafted",
        reused_existing: true,
        idempotency_reason: "generation_operation_already_completed",
      },
    });
  });

  it("builds normalized insert values and exact new-run response", async () => {
    const dependencies = createDependencies();

    const result = await planOperatorGenerationRunPersistence(createInput(), dependencies);

    expect(result).toEqual({
      kind: "continue",
      plan: {
        operationId: "operation-1",
        insertValues: {
          runId: "run-new",
          accountId: "account-1",
          threadsUserId: "threads-1",
          sourceCardId: "card-1",
          sourceCardFamilyId: "family-1",
          sourceCardVersionNumber: 4,
          adaptationPlanJson: JSON.stringify({ adaptation_goal: "Transform the payoff" }),
          priorAdaptationContextJson: JSON.stringify({ prior_runs: [{ run_id: "run-old" }] }),
          objective: "Improve the payoff",
          promptSummary: "Keep the mechanism, change the expression",
          metadataJson: JSON.stringify({
            source: "operator_mode_mcp",
            operation_id: "operation-1",
            canonical_source_card_reuse: true,
            transformation_contract_version: "source-transformation-contract-v1",
          }),
        },
        body: {
          run_id: "run-new",
          source_card_id: "card-1",
          source_card_family_id: "family-1",
          source_card_version_number: 4,
          adaptation_plan: { adaptation_goal: "Transform the payoff" },
          prior_adaptation_context: { prior_runs: [{ run_id: "run-old" }] },
          performance_learning: { winning_lanes: ["money"] },
          status: "drafted",
        },
      },
    });
  });

  it("uses canonical family and version defaults for a root source card", async () => {
    const dependencies = createDependencies();
    const result = await planOperatorGenerationRunPersistence(createInput({
      sourceCard: { id: "card-1" },
    }), dependencies);

    expect(result.kind).toBe("continue");
    if (result.kind !== "continue") throw new Error("expected continuation");
    expect(result.plan.insertValues.sourceCardFamilyId).toBeNull();
    expect(result.plan.insertValues.sourceCardVersionNumber).toBe(1);
    expect(JSON.parse(result.plan.insertValues.metadataJson)).toMatchObject({
      canonical_source_card_reuse: false,
    });
    expect(result.plan.body).toMatchObject({
      source_card_family_id: null,
      source_card_version_number: 1,
    });
  });
});
