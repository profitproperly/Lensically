import { describe, expect, it, vi } from "vitest";
import {
  composeOperatorSourceCardPersistenceResponse,
  planOperatorSourceCardPersistence,
  type OperatorSourceCardPersistencePlanningDependencies,
  type OperatorSourceCardPersistencePlanningInput,
} from "../src/operatorSourceCardPersistencePlanningService";

function createInput(
  overrides: Partial<OperatorSourceCardPersistencePlanningInput> = {},
): OperatorSourceCardPersistencePlanningInput {
  return {
    brandKey: "manifest_mental",
    payload: {
      lane_key: "Money Lane",
      title: "A source card",
      secondary_sources: [{ id: "secondary-1" }],
      anti_sources: [{ id: "anti-1" }],
      forbidden_surfaces: ["forbidden"],
      danger_surfaces: ["danger"],
      current_inventory_constraints: ["inventory"],
      pass_conditions: ["pass"],
      fail_conditions: ["fail"],
      recommended_direction: "Keep the mechanism",
      context_admission_id: "context-1",
      created_by: "Model Agent",
    },
    sourceCardId: "card-new",
    workflowSessionId: "workflow-1",
    sequenceLabel: "daily_draw_batch-1_slot_7",
    primarySource: {
      threads_post_id: "post-1",
      canonical_source_url: "https://threads.net/t/post-1",
      text: "Source text",
    },
    metricsSnapshot: { likes: 1200 },
    sourceMechanism: "mechanism",
    requiredProduct: "product",
    familyId: "family-1",
    sourceSelectionId: "selection-1",
    versionNumber: 3,
    supersedesSourceCardId: "card-old",
    versionReason: "new evidence",
    transformationContract: { preserve_hook: true },
    savedPatternId: 91,
    ...overrides,
  };
}

function createDependencies(
  overrides: Partial<OperatorSourceCardPersistencePlanningDependencies> = {},
): OperatorSourceCardPersistencePlanningDependencies {
  return {
    normalizeMachineKey: (value, fallback) => {
      const text = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
      return text || fallback;
    },
    normalizeText: (value) => {
      const text = String(value ?? "").trim();
      return text || null;
    },
    normalizeJson: (value, fallback) => JSON.stringify(value ?? fallback),
    parseWorkflowSequence: vi.fn(() => 7),
    validateSourceCard: vi.fn(() => ({ can_lock: true, warnings: [] })),
    nowIso: vi.fn(() => "2026-07-28T20:30:00.000Z"),
    ...overrides,
  };
}

describe("planOperatorSourceCardPersistence", () => {
  it("returns exact Saved Pattern lockability rejection before persistence planning", () => {
    const validation = { can_lock: false, missing: ["source_mechanism"] };
    const dependencies = createDependencies({
      validateSourceCard: vi.fn(() => validation),
    });

    const result = planOperatorSourceCardPersistence(createInput(), dependencies);

    expect(dependencies.validateSourceCard).toHaveBeenCalledWith({
      brand_key: "manifest_mental",
      primary_source: expect.objectContaining({ threads_post_id: "post-1" }),
      source_mechanism: "mechanism",
      required_product: "product",
      forbidden_surfaces: ["forbidden"],
      pass_conditions: ["pass"],
      fail_conditions: ["fail"],
      transformation_contract: { preserve_hook: true },
    });
    expect(dependencies.nowIso).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "saved_pattern_source_card_not_lockable",
        saved_pattern_id: 91,
        validation,
      },
    });
  });

  it("builds a normalized locked plan with every mutation intent", () => {
    const dependencies = createDependencies();

    const result = planOperatorSourceCardPersistence(createInput(), dependencies);

    expect(result.kind).toBe("continue");
    if (result.kind !== "continue") throw new Error("expected continuation plan");
    expect(result.plan).toEqual({
      insertValues: {
        sourceCardId: "card-new",
        brandKey: "manifest_mental",
        workflowSessionId: "workflow-1",
        sequenceLabel: "daily_draw_batch-1_slot_7",
        laneKey: "money_lane",
        title: "A source card",
        primarySourceJson: JSON.stringify({
          threads_post_id: "post-1",
          canonical_source_url: "https://threads.net/t/post-1",
          text: "Source text",
        }),
        secondarySourcesJson: JSON.stringify([{ id: "secondary-1" }]),
        antiSourcesJson: JSON.stringify([{ id: "anti-1" }]),
        metricsSnapshotJson: JSON.stringify({ likes: 1200 }),
        sourceMechanism: "mechanism",
        requiredProduct: "product",
        forbiddenSurfacesJson: JSON.stringify(["forbidden"]),
        dangerSurfacesJson: JSON.stringify(["danger"]),
        currentInventoryConstraintsJson: JSON.stringify(["inventory"]),
        passConditionsJson: JSON.stringify(["pass"]),
        failConditionsJson: JSON.stringify(["fail"]),
        recommendedDirection: "Keep the mechanism",
        contextAdmissionId: "context-1",
        createdBy: "model_agent",
        familyId: "family-1",
        sourceSelectionId: "selection-1",
        versionNumber: 3,
        supersedesSourceCardId: "card-old",
        versionReason: "new evidence",
        transformationContractJson: JSON.stringify({ preserve_hook: true }),
      },
      status: "locked",
      lockedAt: "2026-07-28T20:30:00.000Z",
      retireSupersededCardId: "card-old",
      familyUpdate: {
        familyId: "family-1",
        threadsPostId: "post-1",
        canonicalSourceUrl: "https://threads.net/t/post-1",
      },
      selectionLink: {
        sourceSelectionId: "selection-1",
        workflowSequence: 7,
      },
    });
  });

  it("builds a draft plan without lock validation or optional linkage intents", () => {
    const dependencies = createDependencies();
    const result = planOperatorSourceCardPersistence(createInput({
      payload: {},
      primarySource: "not-an-object",
      metricsSnapshot: null,
      familyId: null,
      sourceSelectionId: null,
      supersedesSourceCardId: null,
      versionReason: null,
      savedPatternId: null,
    }), dependencies);

    expect(dependencies.validateSourceCard).not.toHaveBeenCalled();
    expect(dependencies.nowIso).not.toHaveBeenCalled();
    expect(dependencies.parseWorkflowSequence).not.toHaveBeenCalled();
    expect(result.kind).toBe("continue");
    if (result.kind !== "continue") throw new Error("expected continuation plan");
    expect(result.plan.status).toBe("draft");
    expect(result.plan.lockedAt).toBeNull();
    expect(result.plan.retireSupersededCardId).toBeNull();
    expect(result.plan.familyUpdate).toBeNull();
    expect(result.plan.selectionLink).toBeNull();
    expect(result.plan.insertValues).toMatchObject({
      laneKey: null,
      title: "Source card",
      familyId: null,
      sourceSelectionId: null,
      supersedesSourceCardId: null,
      versionReason: null,
      createdBy: "gpt",
    });
  });
});

describe("composeOperatorSourceCardPersistenceResponse", () => {
  it("composes the exact persisted-card response from the completed plan", () => {
    const dependencies = createDependencies({
      validateSourceCard: vi.fn(() => ({ can_lock: true, warnings: [] })),
    });
    const planning = planOperatorSourceCardPersistence(createInput(), dependencies);
    if (planning.kind !== "continue") throw new Error("expected continuation plan");

    const result = composeOperatorSourceCardPersistenceResponse({
      plan: planning.plan,
      persistedCard: { id: "card-new", status: "locked" },
      ownerPresentation: { mode: "owner_readable" },
    }, dependencies);

    expect(dependencies.validateSourceCard).toHaveBeenLastCalledWith({
      id: "card-new",
      status: "locked",
    });
    expect(result).toEqual({
      status: 200,
      body: {
        source_card_id: "card-new",
        source_selection_id: "selection-1",
        family_id: "family-1",
        version_number: 3,
        supersedes_source_card_id: "card-old",
        status: "locked",
        locked_at: "2026-07-28T20:30:00.000Z",
        reused_existing: false,
        validation: { can_lock: true, warnings: [] },
        owner_presentation: {
          mode: "owner_readable",
          account_scope: "manifest_mental",
        },
      },
    });
  });

  it("validates an empty object when the persisted card read is missing", () => {
    const validateSourceCard = vi.fn(() => ({ can_lock: false }));
    const dependencies = createDependencies({ validateSourceCard });
    const planning = planOperatorSourceCardPersistence(createInput({
      savedPatternId: null,
    }), dependencies);
    if (planning.kind !== "continue") throw new Error("expected continuation plan");

    const result = composeOperatorSourceCardPersistenceResponse({
      plan: planning.plan,
      persistedCard: null,
      ownerPresentation: {},
    }, dependencies);

    expect(validateSourceCard).toHaveBeenCalledWith({});
    expect(result.body.validation).toEqual({ can_lock: false });
    expect(result.body.status).toBe("draft");
    expect(result.body.locked_at).toBeNull();
  });
});
