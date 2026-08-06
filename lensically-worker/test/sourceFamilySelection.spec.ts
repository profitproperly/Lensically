import { describe, expect, it } from "vitest";
import {
  SOURCE_LABEL_ALLOCATION_POLICY_VERSION,
  SOURCE_SELECTION_ENGINE_VERSION,
  buildSourceLabelEffectiveShares,
  buildWinnerAllocationPlan,
  classifySourceFamilyLifetime,
  extractOwnerBannedSavedPatternIds,
  isSourceCardOriginEligibleForSelection,
    normalizeSourceLabelAllocationState,
  repairLockedSourceCardSelectionLineage,
  runSourceFamilySelectionEdgeCases,

  selectSourceFamilyLineup,
  type SourceFamilyLifetimeLabel,
  type SourceLabelAllocationState,
  type SourceSelectableLifetimeLabel,
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
    lifetime_sample_size: lifetimeLabel === "untested" ? 0 : 1,
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
    historical_opportunity_count: lifetimeLabel === "untested" ? 0 : 1,
    ...overrides,
  };
}

function candidatesForLabel(label: SourceSelectableLifetimeLabel, count: number): SourceSelectionCandidate[] {
  return Array.from({ length: count }, (_, index) => candidate(`${label}-${index}`, label, 2 - index / 10000));
}

function fullAllocationPool(perUniqueLabel = 60): SourceSelectionCandidate[] {
  return [
    ...candidatesForLabel("franchise", 2),
    ...candidatesForLabel("proven", 3),
    ...candidatesForLabel("prospect", perUniqueLabel),
    ...candidatesForLabel("emerging", perUniqueLabel),
    ...candidatesForLabel("untested", perUniqueLabel),
    ...candidatesForLabel("probation", perUniqueLabel),
    ...candidatesForLabel("tiebreaker", perUniqueLabel),
  ];
}

function slots(count: number, start = "2026-08-10T00:00"): string[] {
  const startMs = Date.parse(`${start}:00Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(startMs + index * 3600000).toISOString().slice(0, 16)
  );
}

function countsByIdentity(result: ReturnType<typeof selectSourceFamilyLineup>): Record<string, number> {
  return result.selected.reduce<Record<string, number>>((accumulator, item) => {
    const identity = String(item.source_identity_key);
    accumulator[identity] = Number(accumulator[identity] ?? 0) + 1;
    return accumulator;
  }, {});
}

function countsByLabel(result: ReturnType<typeof selectSourceFamilyLineup>): Record<string, number> {
  return result.selected.reduce<Record<string, number>>((accumulator, item) => {
    const label = String(item.lifetime_label);
    accumulator[label] = Number(accumulator[label] ?? 0) + 1;
    return accumulator;
  }, {});
}

function nextState(result: ReturnType<typeof selectSourceFamilyLineup>): SourceLabelAllocationState {
  return normalizeSourceLabelAllocationState(result.summary.allocation_state_after);
}

function removeSelectedUniqueCandidates(
  pool: SourceSelectionCandidate[],
  result: ReturnType<typeof selectSourceFamilyLineup>,
): SourceSelectionCandidate[] {
  const consumed = new Set(result.selected
    .filter((item) => item.lifetime_label !== "franchise" && item.lifetime_label !== "proven")
    .map((item) => String(item.source_identity_key)));
  return pool.filter((item) => !consumed.has(String(item.source_identity_key)));
}

describe("source-selection engine v9", () => {
  it("uses the v9 production and 40/60 allocation contracts", () => {
    expect(SOURCE_SELECTION_ENGINE_VERSION).toBe("source-selection-engine-v9");
    expect(SOURCE_LABEL_ALLOCATION_POLICY_VERSION).toBe("source-label-allocation-40-60-v1");
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

  it("backfills durable selection lineage for a legacy locked source card", async () => {
    const batched: Array<{ sql: string; bindings: unknown[] }> = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...bindings: unknown[]) => ({
          sql,
          bindings,
          all: async () => sql.includes("SELECT\n       card.id AS source_card_id")
            ? {
                results: [{
                  source_card_id: "card-legacy",
                  source_card_created_at: "2026-07-01T00:00:00.000Z",
                  primary_source_json: JSON.stringify({
                    source_type: "operator_hypothesis",
                    strategic_purpose: "A direct-reader blessing.",
                  }),
                  metrics_snapshot_json: "{}",
                  source_mechanism: "Direct-reader blessing",
                  required_product: "A source-backed blessing",
                  source_identity_key: "operator_hypothesis:legacy",
                  source_type: "operator_hypothesis",
                  internal_source_id: "legacy",
                  threads_post_id: null,
                  canonical_source_url: null,
                }],
              }
            : { results: [] },
          first: async () => ({ total: 0 }),
          run: async () => ({}),
        }),
      }),
      batch: async (statements: Array<{ sql: string; bindings: unknown[] }>) => {
        batched.push(...statements);
        return [];
      },
    } as unknown as D1Database;

    const receipt = await repairLockedSourceCardSelectionLineage(db, "manifest_mental");

    expect(receipt).toEqual({
      version: "source-card-lineage-backfill-v1",
      repaired_count: 1,
      repaired_source_card_ids: ["card-legacy"],
    });
    expect(batched.some((statement) =>
      statement.sql.includes("INSERT OR IGNORE INTO operator_source_selections")
      && statement.bindings[0] === "source-card-lineage-selection:card-legacy"
    )).toBe(true);
    expect(batched.some((statement) =>
      statement.sql.includes("UPDATE operator_source_cards")
      && statement.bindings[0] === "source-card-lineage-selection:card-legacy"
    )).toBe(true);
  });
});


describe("40/60 lifecycle-label allocation", () => {
  it("allocates 40% equally to established labels and 60% equally to unresolved labels", () => {
    const result = selectSourceFamilyLineup({
      candidates: fullAllocationPool(),
      slot_keys: slots(10),
      seed: "40-60-baseline",
    });
    expect(countsByLabel(result)).toEqual({
      probation: 2,
      tiebreaker: 2,
      untested: 2,
      franchise: 1,
      proven: 1,
      prospect: 1,
      emerging: 1,
    });
  });

  it("redistributes a missing unresolved label inside the unresolved pool", () => {
    const result = selectSourceFamilyLineup({
      candidates: fullAllocationPool().filter((item) => item.lifetime_label !== "tiebreaker"),
      slot_keys: slots(20),
      seed: "missing-tiebreaker",
    });
    expect(countsByLabel(result)).toEqual({
      probation: 6,
      untested: 6,
      franchise: 2,
      proven: 2,
      prospect: 2,
      emerging: 2,
    });
  });

  it("redistributes the full unresolved pool when no unresolved inventory exists", () => {
    const stablePool = fullAllocationPool().filter((item) =>
      ["franchise", "proven", "prospect", "emerging"].includes(String(item.lifetime_label))
    );
    const result = selectSourceFamilyLineup({
      candidates: stablePool,
      slot_keys: slots(12),
      seed: "no-unresolved",
    });
    expect(countsByLabel(result)).toEqual({
      franchise: 3,
      proven: 3,
      prospect: 3,
      emerging: 3,
    });
  });

  it("gives every slot to the only available label", () => {
    const result = selectSourceFamilyLineup({
      candidates: candidatesForLabel("probation", 48),
      slot_keys: slots(48),
      seed: "probation-only",
    });
    expect(countsByLabel(result)).toEqual({ probation: 48 });
  });

  it("handles every requested slot count from one through 48 without losing a slot", () => {
    for (let slotCount = 1; slotCount <= 48; slotCount += 1) {
      const result = selectSourceFamilyLineup({
        candidates: fullAllocationPool(),
        slot_keys: slots(slotCount),
        seed: `slot-count-${slotCount}`,
      });
      expect(result.selected).toHaveLength(slotCount);
      expect(result.receipts).toHaveLength(slotCount);
      expect(Object.values(countsByLabel(result)).reduce((sum, count) => sum + count, 0)).toBe(slotCount);
    }
  });

  it("produces the same allocation across one 48-slot cycle and forty-eight one-slot cycles", () => {
    const oneShot = selectSourceFamilyLineup({
      candidates: fullAllocationPool(),
      slot_keys: slots(48),
      seed: "one-shot-48",
    });

    let fragmentedPool = fullAllocationPool();
    let fragmentedState = normalizeSourceLabelAllocationState();
    const fragmentedCounts: Record<string, number> = {};
    for (let index = 0; index < 48; index += 1) {
      const result = selectSourceFamilyLineup({
        candidates: fragmentedPool,
        slot_keys: slots(1, new Date(Date.parse("2026-09-01T00:00:00Z") + index * 3600000).toISOString().slice(0, 16)),
        seed: `fragment-${index}`,
        allocation_state: fragmentedState,
      });
      for (const [label, count] of Object.entries(countsByLabel(result))) {
        fragmentedCounts[label] = Number(fragmentedCounts[label] ?? 0) + count;
      }
      fragmentedState = nextState(result);
      fragmentedPool = removeSelectedUniqueCandidates(fragmentedPool, result);
    }

    expect(fragmentedCounts).toEqual(countsByLabel(oneShot));
    expect(fragmentedState).toEqual(nextState(oneShot));
  });

  it("does not create historical debt while a label is unavailable", () => {
    const stableOnly = selectSourceFamilyLineup({
      candidates: fullAllocationPool().filter((item) =>
        ["franchise", "proven", "prospect", "emerging"].includes(String(item.lifetime_label))
      ),
      slot_keys: slots(20),
      seed: "unresolved-absent",
    });
    const restored = selectSourceFamilyLineup({
      candidates: fullAllocationPool(),
      slot_keys: slots(10, "2026-08-11T00:00"),
      seed: "unresolved-restored",
      allocation_state: nextState(stableOnly),
    });
    expect(countsByLabel(restored)).toEqual({
      probation: 2,
      tiebreaker: 2,
      untested: 2,
      franchise: 1,
      proven: 1,
      prospect: 1,
      emerging: 1,
    });
  });

  it("exhausts finite tiebreaker inventory and redistributes its remaining share", () => {
    const currentInventoryFixture = [
      ...candidatesForLabel("franchise", 1),
      ...candidatesForLabel("proven", 1),
      ...candidatesForLabel("prospect", 53),
      ...candidatesForLabel("emerging", 10),
      ...candidatesForLabel("untested", 82),
      ...candidatesForLabel("probation", 62),
      ...candidatesForLabel("tiebreaker", 7),
    ];
    const result = selectSourceFamilyLineup({
      candidates: currentInventoryFixture,
      slot_keys: slots(48),
      seed: "current-live-inventory-capacity",
    });
    expect(countsByLabel(result)).toEqual({
      probation: 11,
      tiebreaker: 7,
      untested: 11,
      franchise: 5,
      proven: 5,
      prospect: 5,
      emerging: 4,
    });
  });

  it("returns valid shares for every nonempty label combination", () => {
    const labels: SourceSelectableLifetimeLabel[] = [
      "franchise", "proven", "prospect", "emerging", "untested", "probation", "tiebreaker",
    ];
    for (let mask = 1; mask < 2 ** labels.length; mask += 1) {
      const active = labels.filter((_, index) => Boolean(mask & (1 << index)));
      const shares = buildSourceLabelEffectiveShares(active);
      expect(Object.keys(shares).sort()).toEqual([...active].sort());
      expect(Object.values(shares).reduce((sum, value) => sum + Number(value), 0)).toBeCloseTo(1, 12);
    }
  });
});

describe("winner distribution inside lifecycle labels", () => {
  const auditedWinners = [
    candidate("universe", "franchise", 5.88661973, { global_rank: 1 }),
    candidate("income", "proven", 2.43192433, { global_rank: 2 }),
    candidate("relational", "proven", 1.25568152, { global_rank: 3 }),
    candidate("finger", "proven", 1.01270251, { global_rank: 4 }),
  ];

  it("preserves the audited 16-slot 8-4-2-2 winner distribution", () => {
    const result = selectSourceFamilyLineup({
      candidates: auditedWinners,
      slot_keys: slots(16),
      seed: "audited-winner-regression",
      include_parity_trace: true,
    });
    expect(countsByIdentity(result)).toEqual({
      "source-universe": 8,
      "source-income": 4,
      "source-relational": 2,
      "source-finger": 2,
    });
    expect(result.summary).toEqual(expect.objectContaining({
      winner_allocation_contract: "label_scoped_first_coverage_then_score_weighted_deficit_v2",
      winner_target_mismatch_count: 0,
      maximum_exact_family_concentration: 0.5,
    }));
  });

  it("keeps the legacy allocation helper deterministic for audit compatibility", () => {
    const first = buildWinnerAllocationPlan(auditedWinners, 16);
    const second = buildWinnerAllocationPlan(auditedWinners, 16);
    expect(first).toEqual(second);
  });

  it("allows the sole qualified winner to receive every available placement", () => {
    const result = selectSourceFamilyLineup({
      candidates: [candidate("sole", "franchise", 2.5)],
      slot_keys: slots(9),
      seed: "sole-winner",
    });
    expect(countsByIdentity(result)).toEqual({ "source-sole": 9 });
  });
});

describe("selection protection", () => {
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
