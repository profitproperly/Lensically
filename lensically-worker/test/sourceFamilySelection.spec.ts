import { describe, expect, it } from "vitest";
import {
  SOURCE_SELECTION_ENGINE_VERSION,
  buildWinnerAllocationPlan,
  classifySourceFamilyLifetime,
    extractOwnerBannedSavedPatternIds,
  isSourceCardOriginEligibleForSelection,
  runSourceFamilySelectionEdgeCases,

  selectSourceFamilyLineup,
  type SourceFamilyLifetimeLabel,
  type SourceSelectionCandidate,
} from "../src/sourceFamilySelection";

function candidate(
  id: string,
  lifetimeLabel: SourceFamilyLifetimeLabel = "untested",
  rankingScore = 1,
  overrides: Partial<SourceSelectionCandidate> = {},
): SourceSelectionCandidate {
  return {
    source_identity_key: `source-${id}`,
    source_card_id: `card-${id}`,
    source_card_family_id: `family-${id}`,
    lifetime_label: lifetimeLabel,
    recent_label: "no_recent_data",
    lifetime_sample_size: lifetimeLabel === "untested" ? 0 : 6,
    unified_rating: rankingScore,
    ranking_score: rankingScore,
    lifetime_index: rankingScore,
    global_rank: null,
    uses_24h: 0,
    uses_7d: 0,
    uses_28d: 0,
    published_uses_72h: 0,
    future_scheduled_uses: 0,
    semantic_published_uses_24h: 0,
    semantic_future_scheduled_uses: 0,
    semantic_exposure_times: [],
    semantic_key: `semantic-${id}`,
    historical_opportunity_count: lifetimeLabel === "untested" ? 0 : 6,
    ...overrides,
  };
}

function slots(count: number, start = "2026-08-10T00:00"): string[] {
  const startMs = Date.parse(`${start}:00Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(startMs + index * 3600000).toISOString().slice(0, 16)
  );
}

function counts(result: ReturnType<typeof selectSourceFamilyLineup>): Record<string, number> {
  return result.selected.reduce<Record<string, number>>((accumulator, item) => {
    const identity = String(item.source_identity_key);
    accumulator[identity] = Number(accumulator[identity] ?? 0) + 1;
    return accumulator;
  }, {});
}

describe("source-selection engine v8", () => {
  it("uses the v8 production contract", () => {
    expect(SOURCE_SELECTION_ENGINE_VERSION).toBe("source-selection-engine-v8");
  });

  it("preserves exact Saved Pattern owner exclusions", () => {
    const ids = extractOwnerBannedSavedPatternIds({
      owner_hard_bans: ["Never select Saved Patterns 6, 7, 118, or 214."],
      banned_saved_pattern_ids: [25],
    });
    expect([...ids].sort((left, right) => Number(left) - Number(right))).toEqual([
      "6", "7", "25", "118", "214",
    ]);
  });

    it("keeps two below-median matured results underperforming", () => {
    expect(classifySourceFamilyLifetime({ indexes: [0.8, 0.7] })).toEqual(expect.objectContaining({
      label: "underperforming",
      audition_failures: 2,
    }));
  });

  it("treats source-card validity as independent from origin", () => {
    const liveSavedPatterns = new Set(["128"]);
    expect(isSourceCardOriginEligibleForSelection("saved_pattern", "128", liveSavedPatterns)).toBe(true);
    expect(isSourceCardOriginEligibleForSelection("saved_pattern", "999", liveSavedPatterns)).toBe(false);
    expect(isSourceCardOriginEligibleForSelection("operator_hypothesis", null, liveSavedPatterns)).toBe(true);
    expect(isSourceCardOriginEligibleForSelection("owner_source_card", null, liveSavedPatterns)).toBe(true);
  });

});

describe("deterministic proportional Exploit allocation", () => {
  const auditedWinners = [
    candidate("universe", "franchise", 5.88661973, { global_rank: 1 }),
    candidate("income", "proven", 2.43192433, { global_rank: 2 }),
    candidate("relational", "proven", 1.25568152, { global_rank: 3 }),
    candidate("finger", "proven", 1.01270251, { global_rank: 4 }),
  ];

  it("turns the audited 16-slot fixture into 8-4-2-2 instead of 13-1-1-1", () => {
    const plan = buildWinnerAllocationPlan(auditedWinners, 16);
    expect(Object.fromEntries(plan.map((target) => [target.source_identity_key, target.final_target_count]))).toEqual({
      "source-universe": 8,
      "source-income": 4,
      "source-relational": 2,
      "source-finger": 2,
    });

    const result = selectSourceFamilyLineup({
      candidates: auditedWinners,
      slot_keys: slots(16),
      seed: "audited-13-1-1-1-regression",
      include_parity_trace: true,
    });

    expect(counts(result)).toEqual({
      "source-universe": 8,
      "source-income": 4,
      "source-relational": 2,
      "source-finger": 2,
    });
    expect(result.summary).toEqual(expect.objectContaining({
      winner_allocation_contract: "first_coverage_then_score_weighted_largest_remainder_v1",
      winner_target_mismatch_count: 0,
      maximum_exact_family_concentration: 0.5,
    }));
    expect(result.receipts.every((receipt) =>
      receipt.winner_target_satisfied
      && receipt.winner_actual_selected_count === receipt.winner_final_target_count
    )).toBe(true);
  });

  it("covers highest-ranked winners once when capacity is smaller than the winner pool", () => {
    const result = selectSourceFamilyLineup({
      candidates: auditedWinners,
      slot_keys: slots(2),
      seed: "winner-pool-larger-than-capacity",
    });
    expect(counts(result)).toEqual({
      "source-universe": 1,
      "source-income": 1,
    });
  });

  it("allows the sole qualified winner to receive every Exploit placement", () => {
    const result = selectSourceFamilyLineup({
      candidates: [candidate("sole", "franchise", 2.5)],
      slot_keys: slots(9),
      seed: "sole-winner",
    });
    expect(counts(result)).toEqual({ "source-sole": 9 });
    expect(result.summary).toEqual(expect.objectContaining({
      maximum_exact_family_concentration: 1,
      winner_target_mismatch_count: 0,
    }));
  });

  it("matches deterministic largest-remainder targets for arbitrary slot counts", () => {
    for (const slotCount of [16, 33, 47]) {
      const expected = Object.fromEntries(
        buildWinnerAllocationPlan(auditedWinners, slotCount)
          .filter((target) => target.final_target_count > 0)
          .map((target) => [target.source_identity_key, target.final_target_count]),
      );
      const input = {
        candidates: auditedWinners,
        slot_keys: slots(slotCount),
        seed: `arbitrary-${slotCount}`,
      };
      const first = selectSourceFamilyLineup(input);
      const second = selectSourceFamilyLineup(input);
      expect(counts(first)).toEqual(expected);
      expect(first.receipts).toEqual(second.receipts);
    }
  });

  it("does not add wording, opener, Universe, Finger Touch, or mechanism concentration limits", () => {
    const sameOpening = auditedWinners.map((item, index) => ({
      ...item,
      text: "Universe, make the person reading this wealthy.",
      semantic_key: index % 2 === 0 ? "universe" : "finger_touch",
    }));
    const result = selectSourceFamilyLineup({
      candidates: sameOpening,
      slot_keys: slots(16),
      seed: "wording-is-not-allocation-authority",
    });
    expect(counts(result)).toEqual({
      "source-universe": 8,
      "source-income": 4,
      "source-relational": 2,
      "source-finger": 2,
    });
  });
});

describe("Develop and Explore protection", () => {
  it("keeps independently saved similar sources independent", () => {
    const result = selectSourceFamilyLineup({
      candidates: [
        candidate("finger-a", "untested", 1, { semantic_key: "finger_touch" }),
        candidate("finger-b", "untested", 1, { semantic_key: "finger_touch" }),
      ],
      slot_keys: slots(2),
      seed: "independent-saved-patterns",
    });
    expect(new Set(result.selected.map((item) => item.source_identity_key)).size).toBe(2);
  });

  it("blocks an unresolved source until its prior 24-hour evidence matures", () => {
    const result = selectSourceFamilyLineup({
      candidates: [
        candidate("pending", "untested", 1, { uses_24h: 1 }),
        candidate("fresh", "untested", 1),
      ],
      slot_keys: slots(1),
      seed: "pending-evidence",
    });
    expect(result.selected[0]?.source_identity_key).toBe("source-fresh");
  });

  it("keeps Underperforming families out of normal distribution", () => {
    const result = selectSourceFamilyLineup({
      candidates: [
        candidate("bench", "underperforming", 4),
        candidate("fresh", "untested", 1),
      ],
      slot_keys: slots(1),
      seed: "bench-exclusion",
      include_parity_trace: true,
    });
    expect(result.selected[0]?.source_identity_key).toBe("source-fresh");
    expect(result.parity_trace?.exclusions).toEqual(expect.arrayContaining([
      expect.objectContaining({ source_identity_key: "source-bench", reason: "lifetime_underperforming" }),
    ]));
  });

  it("passes the built-in production edge-case contract", () => {
    expect(runSourceFamilySelectionEdgeCases()).toEqual(expect.objectContaining({ passed: true }));
  });
});
