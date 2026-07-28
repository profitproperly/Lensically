import { describe, expect, it, vi } from "vitest";
import {
  composeOperatorDraftDecisionResponse,
  planOperatorDraftDecision,
} from "../src/operatorDraftDecisionService";

function input(overrides: Record<string, unknown> = {}) {
  return {
    toolName: "approve_draft" as const,
    accountId: "account-1",
    threadsUserId: "threads-1",
    brandKey: "manifest_mental",
    payload: { draft_id: "draft-1" },
    ...overrides,
  };
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    normalizeText: vi.fn((value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null),
    normalizeJson: vi.fn((value: unknown) => JSON.stringify(value)),
    loadDraft: vi.fn(async () => null),
    isAllowedTransition: vi.fn(() => true),
    ...overrides,
  };
}

describe("operator draft decision planning", () => {
  it("returns the exact required-ID rejection before loading a draft", async () => {
    const deps = dependencies();
    const result = await planOperatorDraftDecision(input({ payload: {} }), deps);

    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: { success: false, error: "draft_id is required" },
    });
    expect(deps.loadDraft).not.toHaveBeenCalled();
  });

  it("returns the exact not-found response after account-scoped retrieval", async () => {
    const deps = dependencies();
    const result = await planOperatorDraftDecision(input(), deps);

    expect(result).toEqual({
      kind: "response",
      status: 404,
      body: { success: false, error: "draft_not_found" },
    });
    expect(deps.loadDraft).toHaveBeenCalledWith("draft-1");
  });

  it.each([
    ["approve_draft", "approved"],
    ["approve_draft", "scheduled"],
    ["approve_draft", "published"],
    ["reject_draft", "rejected"],
  ] as const)("returns exact idempotent reuse for %s from %s", async (toolName, status) => {
    const deps = dependencies({
      loadDraft: vi.fn(async () => ({ id: "draft-1", status })),
    });
    const result = await planOperatorDraftDecision(input({ toolName }), deps);

    expect(result).toEqual({
      kind: "response",
      body: {
        draft_id: "draft-1",
        status,
        reused_existing: true,
        idempotency_reason: "draft_decision_already_applied",
      },
    });
    expect(deps.isAllowedTransition).not.toHaveBeenCalled();
  });

  it("returns the exact invalid-transition response with canonical statuses", async () => {
    const deps = dependencies({
      loadDraft: vi.fn(async () => ({ id: "draft-1", status: "candidate" })),
      isAllowedTransition: vi.fn(() => false),
    });
    const result = await planOperatorDraftDecision(input({ toolName: "reject_draft" }), deps);

    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "invalid_status_transition",
        from: "candidate",
        to: "rejected",
      },
    });
    expect(deps.isAllowedTransition).toHaveBeenCalledWith("candidate", "rejected");
  });

  it("builds complete approval update, claim, memory, inventory, and response intents", async () => {
    const deps = dependencies({
      loadDraft: vi.fn(async () => ({
        id: "draft-1",
        status: "shown",
        text: "Draft text",
        source_card_id: "card-1",
        strategy: { pillar: "old" },
      })),
    });
    const result = await planOperatorDraftDecision(input({
      payload: {
        draft_id: " draft-1 ",
        feedback_note: " Strong work ",
        score: { total: 9 },
        strategy: { pillar: "money" },
      },
    }), deps);

    expect(result).toMatchObject({
      kind: "continue",
      plan: {
        draftId: "draft-1",
        nextStatus: "approved",
        draftUpdate: {
          feedback: "Strong work",
          rejectionReason: null,
        },
        claimUpdate: {
          status: "approved",
          dispositionReason: "Strong work",
        },
        memory: {
          accountId: "account-1",
          threadsUserId: "threads-1",
          kind: "approval_feedback",
          title: "Draft approved from operator mode",
          body: "Draft id: draft-1\nStatus: approved\nStrong work",
        },
        inventory: {
          brandKey: "manifest_mental",
          sourceType: "draft",
          sourceId: "draft-1",
          text: "Draft text",
          sourceCardId: "card-1",
          status: "approved",
          strategy: { pillar: "money" },
        },
      },
    });
    if (result.kind !== "continue") throw new Error("expected continuation");
    expect(JSON.parse(String(result.plan.draftUpdate.scoreJson))).toEqual({ total: 9 });
    expect(JSON.parse(String(result.plan.draftUpdate.strategyJson))).toEqual({ pillar: "money" });
    expect(JSON.parse(String(result.plan.memory.metadataJson))).toEqual({
      source: "operator_mode_mcp",
      draft_id: "draft-1",
      source_card_id: "card-1",
    });
  });

  it("uses feedback then the stable default for rejection reasons and draft strategy fallback", async () => {
    const draft = {
      id: "draft-1",
      status: "shown",
      text: "Draft text",
      source_card_id: "card-1",
      strategy: { pillar: "existing" },
    };
    const feedbackDeps = dependencies({ loadDraft: vi.fn(async () => draft) });
    const feedbackResult = await planOperatorDraftDecision(input({
      toolName: "reject_draft",
      payload: { draft_id: "draft-1", feedback_note: "Needs a new ending" },
    }), feedbackDeps);
    expect(feedbackResult).toMatchObject({
      kind: "continue",
      plan: {
        nextStatus: "rejected",
        draftUpdate: { rejectionReason: "Needs a new ending" },
        claimUpdate: {
          status: "revision_required",
          dispositionReason: "Needs a new ending",
        },
        inventory: { strategy: { pillar: "existing" } },
      },
    });

    const defaultDeps = dependencies({ loadDraft: vi.fn(async () => draft) });
    const defaultResult = await planOperatorDraftDecision(input({
      toolName: "reject_draft",
      payload: { draft_id: "draft-1" },
    }), defaultDeps);
    expect(defaultResult).toMatchObject({
      kind: "continue",
      plan: {
        draftUpdate: { rejectionReason: "Rejected from operator mode." },
        memory: {
          kind: "rejection_feedback",
          title: "Draft rejected from operator mode",
          body: "Draft id: draft-1\nStatus: rejected\nRejected from operator mode.",
        },
      },
    });
  });

  it("composes the exact persisted decision response with nullable memory identity", () => {
    expect(composeOperatorDraftDecisionResponse({
      draftId: "draft-1",
      nextStatus: "approved",
    }, { id: 42 })).toEqual({
      draft_id: "draft-1",
      status: "approved",
      memory_id: 42,
    });
    expect(composeOperatorDraftDecisionResponse({
      draftId: "draft-2",
      nextStatus: "rejected",
    }, null)).toEqual({
      draft_id: "draft-2",
      status: "rejected",
      memory_id: null,
    });
  });
});
