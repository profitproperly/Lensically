import { describe, expect, it, vi } from "vitest";
import { planOperatorDraftShownTransition } from "../src/operatorDraftShownTransitionService";

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    normalizeText: vi.fn((value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null),
    loadDraft: vi.fn(async () => null),
    isAllowedTransition: vi.fn(() => true),
    ...overrides,
  };
}

describe("operator draft shown transition", () => {
  it("returns the exact required-ID rejection without loading a draft", async () => {
    const deps = dependencies();
    const result = await planOperatorDraftShownTransition({
      brandKey: "manifest_mental",
      payload: {},
    }, deps);

    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: { success: false, error: "draft_id is required" },
    });
    expect(deps.loadDraft).not.toHaveBeenCalled();
  });

  it("returns the exact not-found response after account-scoped retrieval", async () => {
    const deps = dependencies();
    const result = await planOperatorDraftShownTransition({
      brandKey: "manifest_mental",
      payload: { draft_id: "draft-1" },
    }, deps);

    expect(result).toEqual({
      kind: "response",
      status: 404,
      body: { success: false, error: "draft_not_found" },
    });
    expect(deps.loadDraft).toHaveBeenCalledWith("draft-1");
  });

  it.each(["shown", "approved", "scheduled", "published"])(
    "returns exact idempotent reuse for %s drafts",
    async (status) => {
      const deps = dependencies({
        loadDraft: vi.fn(async () => ({ id: "draft-1", status })),
      });
      const result = await planOperatorDraftShownTransition({
        brandKey: "manifest_mental",
        payload: { draft_id: "draft-1" },
      }, deps);

      expect(result).toEqual({
        kind: "response",
        body: {
          draft_id: "draft-1",
          status,
          reused_existing: true,
          idempotency_reason: "draft_already_shown_or_advanced",
        },
      });
      expect(deps.isAllowedTransition).not.toHaveBeenCalled();
    },
  );

  it("returns the exact not-showable rejection before transition validation", async () => {
    const deps = dependencies({
      loadDraft: vi.fn(async () => ({
        id: "draft-1",
        status: "candidate",
        showable: false,
      })),
    });
    const result = await planOperatorDraftShownTransition({
      brandKey: "manifest_mental",
      payload: { draft_id: "draft-1" },
    }, deps);

    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "draft_not_showable",
        draft_id: "draft-1",
        status: "candidate",
        showable: false,
      },
    });
    expect(deps.isAllowedTransition).not.toHaveBeenCalled();
  });

  it("returns the exact rejection when the shown transition is not allowed", async () => {
    const deps = dependencies({
      loadDraft: vi.fn(async () => ({
        id: "draft-1",
        status: "candidate",
        showable: true,
      })),
      isAllowedTransition: vi.fn(() => false),
    });
    const result = await planOperatorDraftShownTransition({
      brandKey: "manifest_mental",
      payload: { draft_id: "draft-1" },
    }, deps);

    expect(result).toMatchObject({
      kind: "response",
      status: 400,
      body: { error: "draft_not_showable", showable: true },
    });
    expect(deps.isAllowedTransition).toHaveBeenCalledWith("candidate", "shown");
  });

  it("builds exact update, inventory, and success intents for an eligible draft", async () => {
    const deps = dependencies({
      loadDraft: vi.fn(async () => ({
        id: "draft-1",
        status: "candidate",
        showable: true,
        text: "Draft text",
        source_card_id: "card-1",
        strategy: {
          pillar: "money",
          analysis: { lane_key: "manifest_lane" },
        },
      })),
    });
    const result = await planOperatorDraftShownTransition({
      brandKey: "manifest_mental",
      payload: { draft_id: " draft-1 " },
    }, deps);

    expect(result).toEqual({
      kind: "continue",
      plan: {
        draftId: "draft-1",
        updateStatus: "shown",
        inventory: {
          brandKey: "manifest_mental",
          sourceType: "draft",
          sourceId: "draft-1",
          text: "Draft text",
          sourceCardId: "card-1",
          status: "shown",
          strategy: {
            pillar: "money",
            analysis: { lane_key: "manifest_lane" },
          },
          analysis: { lane_key: "manifest_lane" },
        },
        body: { draft_id: "draft-1", status: "shown" },
      },
    });
  });
});
