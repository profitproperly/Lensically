import { describe, expect, it, vi } from "vitest";
import {
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
