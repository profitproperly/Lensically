import { describe, expect, it, vi } from "vitest";
import {
  applyManifestWinnerPreservation,
  readOperatorSourceCard,
  type OperatorSourceCardReadDependencies,
} from "../src/operatorSourceCardReadService";

function createDependencies(
  overrides: Partial<OperatorSourceCardReadDependencies> = {},
): OperatorSourceCardReadDependencies {
  return {
    normalizeText: (value) => {
      const text = String(value ?? "").trim();
      return text || null;
    },
    loadSourceCard: vi.fn(async () => null),
    loadHistory: vi.fn(async () => null),
    ...overrides,
  };
}

describe("readOperatorSourceCard", () => {
  it("returns exact not-found behavior without loading history", async () => {
    const dependencies = createDependencies();

    const result = await readOperatorSourceCard({
      brandKey: "manifest_mental",
      payload: { source_card_id: " card-404 " },
      ownerPresentation: {},
    }, dependencies);

    expect(dependencies.loadSourceCard).toHaveBeenCalledWith("card-404");
    expect(dependencies.loadHistory).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 404,
      body: { success: false, error: "source_card_not_found" },
    });
  });

  it("suppresses history retrieval only when include_history is exactly false", async () => {
    const card = { id: "card-1", status: "locked" };
    const dependencies = createDependencies({
      loadSourceCard: vi.fn(async () => card),
    });

    const result = await readOperatorSourceCard({
      brandKey: "manifest_mental",
      payload: { source_card_id: "card-1", include_history: false },
      ownerPresentation: { mode: "owner_readable" },
    }, dependencies);

    expect(dependencies.loadHistory).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 200,
      body: {
        source_card: card,
        canonical_context: null,
        owner_presentation: {
          mode: "owner_readable",
          account_scope: "manifest_mental",
        },
      },
    });
  });

  it("loads canonical history by default and composes the exact response", async () => {
    const card = { id: "card-1", status: "locked" };
    const history = { family: { id: "family-1" }, versions: [card] };
    const dependencies = createDependencies({
      loadSourceCard: vi.fn(async () => card),
      loadHistory: vi.fn(async () => history),
    });

    const result = await readOperatorSourceCard({
      brandKey: "manifest_mental",
      payload: { source_card_id: "card-1" },
      ownerPresentation: { mode: "owner_readable" },
    }, dependencies);

    expect(dependencies.loadHistory).toHaveBeenCalledWith(card);
    expect(result).toEqual({
      status: 200,
      body: {
        source_card: card,
        canonical_context: history,
        owner_presentation: {
          mode: "owner_readable",
          account_scope: "manifest_mental",
        },
      },
    });
    });
});

describe("Manifest winner preservation", () => {
  it("repairs a legacy winning finger-touch source card with enforceable exact anchors", () => {
    const result = applyManifestWinnerPreservation({
      id: "card-touch",
      primary_source: {},
      metrics_snapshot: null,
      forbidden_surfaces: [],
      danger_surfaces: [],
      owner_revision_history: [{
        revised_text: "IF YOUR FINGER TOUCHED THIS TODAY, EXPECT GOOD MONEY NEWS WITHIN 7 DAYS.",
        published_post_id: "post-winner",
        performance_24h: { metrics: { likes: 6604 } },
      }],
    }, {
      must_preserve_exact: [],
      must_preserve_function: [],
      may_reuse: [],
      must_transform: [],
      audience_reward: "Immediate anticipation of positive money news.",
    });

    expect(result.winner_preservation).toMatchObject({
      required: true,
      observed_likes: 6604,
      winner_post_id: "post-winner",
      exact_surfaces: [
        "IF YOUR FINGER TOUCHED THIS TODAY",
        "EXPECT GOOD MONEY NEWS",
      ],
    });
    expect(result.transformation_contract).toMatchObject({
      must_preserve_exact: [
        "IF YOUR FINGER TOUCHED THIS TODAY",
        "EXPECT GOOD MONEY NEWS",
      ],
      winner_preservation: expect.objectContaining({ required: true }),
    });
  });

  it("does not activate winner enforcement below the evidence threshold", () => {
    const result = applyManifestWinnerPreservation({
      id: "card-prospect",
      primary_source: { text: "A useful but unproven idea.", metrics: { likes: 300 } },
      owner_revision_history: [],
    }, {
      must_preserve_exact: [],
      must_preserve_function: ["Preserve the premise."],
    });

    expect(result.winner_preservation).toBeNull();
    expect(result.transformation_contract).toMatchObject({
      must_preserve_exact: [],
      must_preserve_function: ["Preserve the premise."],
    });
  });

    it("keeps explicit safe winner anchors instead of deriving gendered source language", () => {
    const result = applyManifestWinnerPreservation({
      id: "card-universe",
      primary_source: {
        text: "Universe! Make the woman reading this a multimillionaire!",
        metrics: { likes: 23100 },
      },
      owner_revision_history: [],
      forbidden_surfaces: ["Gendered audience language"],
    }, {
      must_preserve_exact: ["Universe", "the person reading this"],
      must_preserve_function: ["Deliver a decisive blessing of substantial wealth."],
    });

    expect((result.transformation_contract as Record<string, unknown>).must_preserve_exact).toEqual([
      "Universe",
      "the person reading this",
    ]);
  });

  it("does not auto-protect deity-specific wording for religion-neutral Manifest winners", () => {
    const result = applyManifestWinnerPreservation({
      id: "card-gratitude",
      primary_source: {
        text: "Normalize thanking God before asking Him for more. Gratitude changes everything.",
        metrics: { likes: 5700 },
      },
      owner_revision_history: [],
      forbidden_surfaces: [],
      danger_surfaces: [],
    }, {
      must_preserve_exact: [],
      must_preserve_function: [
        "Open with a normalization statement about expressing gratitude before making another request.",
        "Keep gratitude as the central spiritual practice.",
      ],
      may_reuse: ["Normalize thanking the universe", "Gratitude changes everything"],
      must_transform: [],
      audience_reward: "A religion-neutral gratitude-first spiritual reminder.",
      notes: "Use universe as the religion-neutral alternative.",
    });

    expect((result.transformation_contract as Record<string, unknown>).must_preserve_exact).toEqual([]);
    expect(result.winner_preservation).toMatchObject({
      required: true,
      observed_likes: 5700,
      exact_surfaces: [],
    });
    expect((result.transformation_contract as Record<string, unknown>).must_preserve_function).toEqual(
      expect.arrayContaining([
        "Open with a normalization statement about expressing gratitude before making another request.",
        "Keep gratitude as the central spiritual practice.",
        "Preserve the winning post's recognizable opening hook and directness.",
      ]),
    );
  });
});

