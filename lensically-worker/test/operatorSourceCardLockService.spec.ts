import { describe, expect, it, vi } from "vitest";
import {
  planOperatorSourceCardLock,
  type OperatorSourceCardLockDependencies,
} from "../src/operatorSourceCardLockService";

function createDependencies(
  overrides: Partial<OperatorSourceCardLockDependencies> = {},
): OperatorSourceCardLockDependencies {
  return {
    normalizeText: (value) => {
      const text = String(value ?? "").trim();
      return text || null;
    },
    loadSourceCard: vi.fn(async () => null),
    validateSourceCard: vi.fn(() => ({ can_lock: true })),
    nowIso: vi.fn(() => "2026-07-28T20:45:00.000Z"),
    ...overrides,
  };
}

describe("planOperatorSourceCardLock", () => {
  it("returns exact not-found behavior for a missing source-card ID without a lookup", async () => {
    const dependencies = createDependencies();

    const result = await planOperatorSourceCardLock({}, dependencies);

    expect(dependencies.loadSourceCard).not.toHaveBeenCalled();
    expect(dependencies.validateSourceCard).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "response",
      status: 404,
      body: { success: false, error: "source_card_not_found" },
    });
  });

  it("returns exact not-found behavior after an account-scoped lookup", async () => {
    const dependencies = createDependencies();

    const result = await planOperatorSourceCardLock({
      source_card_id: " card-404 ",
    }, dependencies);

    expect(dependencies.loadSourceCard).toHaveBeenCalledWith("card-404");
    expect(dependencies.validateSourceCard).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "response",
      status: 404,
      body: { success: false, error: "source_card_not_found" },
    });
  });

  it("returns the exact lockability rejection with current status", async () => {
    const card = { id: "card-1", status: "draft" };
    const validation = { can_lock: false, missing: ["required_product"] };
    const dependencies = createDependencies({
      loadSourceCard: vi.fn(async () => card),
      validateSourceCard: vi.fn(() => validation),
    });

    const result = await planOperatorSourceCardLock({
      source_card_id: "card-1",
    }, dependencies);

    expect(dependencies.validateSourceCard).toHaveBeenCalledWith(card);
    expect(dependencies.nowIso).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: {
        success: false,
        source_card_id: "card-1",
        status: "draft",
        validation,
      },
    });
  });

  it("returns deterministic lock persistence intent and success response", async () => {
    const card = { id: "card-1", status: "draft" };
    const dependencies = createDependencies({
      loadSourceCard: vi.fn(async () => card),
    });

    const result = await planOperatorSourceCardLock({
      source_card_id: "card-1",
    }, dependencies);

    expect(result).toEqual({
      kind: "continue",
      plan: {
        sourceCardId: "card-1",
        lockedAt: "2026-07-28T20:45:00.000Z",
        body: {
          source_card_id: "card-1",
          status: "locked",
          locked_at: "2026-07-28T20:45:00.000Z",
          warnings: [],
        },
      },
    });
  });
});
