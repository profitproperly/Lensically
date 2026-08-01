import { describe, expect, it } from "vitest";
import {
  classifySourceFamilyLifetime,
  extractOwnerBannedSavedPatternIds,
  normalizeSourceFamilyLifetimeLabel,
  selectSourceFamilyLineup,

  type SourceFamilyLifetimeLabel,
  type SourceSelectionCandidate,
} from "../src/sourceFamilySelection";
import { compileSourcePreselectionPolicy } from "../src/sourcePreselectionPolicy";


function candidate(
  id: string,
  lifetimeLabel: SourceFamilyLifetimeLabel = "untested",
  overrides: Partial<SourceSelectionCandidate> = {},
): SourceSelectionCandidate {
  return {
    source_identity_key: `source-${id}`,
    source_card_id: `card-${id}`,
    source_card_family_id: `family-${id}`,
    lifetime_label: lifetimeLabel,
    recent_label: "no_recent_data",
    lifetime_sample_size: lifetimeLabel === "untested" ? 0 : 4,
    recent_sample_size: lifetimeLabel === "untested" ? 0 : 2,
    lifetime_index: lifetimeLabel === "franchise" ? 1.8 : lifetimeLabel === "proven" ? 1.4 : 1,
    recent_index: lifetimeLabel === "untested" ? null : 1,
    uses_24h: 0,
    uses_7d: 0,
    uses_28d: 0,
    published_uses_72h: 0,
    future_scheduled_uses: 0,
    semantic_published_uses_24h: 0,
    semantic_future_scheduled_uses: 0,
    semantic_exposure_times: [],
    semantic_key: `semantic-${id}`,
    ...overrides,
  };
}

function slots(count: number, start = "2026-08-10T00:00"): string[] {
  const startMs = Date.parse(`${start}:00Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(startMs + index * 3600000).toISOString().slice(0, 16)
  );
}

describe("source family owner exclusions", () => {
  it("extracts only Saved Pattern IDs from durable owner directives", () => {
    const ids = extractOwnerBannedSavedPatternIds({
      owner_hard_bans: [
        "Never generate or schedule I bet having $250,000 removes anxiety wording.",
        "Never select Saved Patterns 6, 7, 218, 189, 25, 27, 214, 118, 205, or 190.",
      ],
    });

    expect([...ids].sort((left, right) => Number(left) - Number(right))).toEqual([
      "6", "7", "25", "27", "118", "189", "190", "205", "214", "218",
    ]);
    expect(ids.has("250000")).toBe(false);
  });

  it("supports structured Saved Pattern exclusion fields", () => {
    const ids = extractOwnerBannedSavedPatternIds({
      banned_saved_pattern_ids: [6, "214"],
      nested: { saved_pattern_id: 118 },
    });

    expect([...ids].sort((left, right) => Number(left) - Number(right))).toEqual(["6", "118", "214"]);
  });
});

describe("bounded source family audition", () => {
  it("keeps a one-flop family on probation for exactly one second audition", () => {
    expect(classifySourceFamilyLifetime({ indexes: [0.84] })).toEqual(expect.objectContaining({
      label: "untested",
      audition_state: "probation",
      audition_failures: 1,
      audition_opportunities_remaining: 1,
      graduated: false,
    }));
  });

  it("excludes two flops and graduates two passes", () => {
    expect(classifySourceFamilyLifetime({ indexes: [0.84, 0.6] })).toEqual(expect.objectContaining({
      label: "underperforming",
      audition_state: "underperforming",
      audition_failures: 2,
    }));
    expect(classifySourceFamilyLifetime({ indexes: [0.85, 0.9] })).toEqual(expect.objectContaining({
      audition_state: "graduated",
      audition_passes: 2,
      graduated: true,
    }));
  });

  it("uses one tiebreaker only when the first two results split", () => {
        expect(classifySourceFamilyLifetime({ indexes: [0.84, 0.85] })).toEqual(expect.objectContaining({
      label: "prospect",
      audition_state: "tiebreaker",

      audition_opportunities_remaining: 1,
    }));
    expect(classifySourceFamilyLifetime({ indexes: [0.84, 0.85, 0.85] })).toEqual(expect.objectContaining({
      audition_state: "graduated",
      audition_passes: 2,
      graduated: true,
    }));
    expect(classifySourceFamilyLifetime({ indexes: [0.85, 0.84, 0.2] })).toEqual(expect.objectContaining({
      label: "underperforming",
      audition_state: "underperforming",
      audition_failures: 2,
    }));
  });

  it("cuts a graduated family when its later lifetime median falls below 0.85", () => {
    expect(classifySourceFamilyLifetime({ indexes: [1, 1, 0.2, 0.2, 0.2] })).toEqual(expect.objectContaining({
      label: "underperforming",
      audition_state: "underperforming",
    }));
  });

    it("recognizes one passing result immediately, treats 0.85 as a pass, and normalizes legacy history", () => {
    expect(classifySourceFamilyLifetime({ indexes: [0.85] })).toEqual(expect.objectContaining({
      label: "prospect",
      audition_state: "provisional_pass",
      audition_passes: 1,
    }));
    expect(classifySourceFamilyLifetime({ indexes: [4] })).toEqual(expect.objectContaining({
      label: "emerging",
      audition_state: "provisional_pass",
      audition_passes: 1,
    }));

    expect(normalizeSourceFamilyLifetimeLabel("disproven")).toBe("underperforming");
  });
});

describe("hardened source family selection", () => {
  it("hard-excludes recent published, future scheduled, and underperforming families", () => {

    const blocked = [
      candidate("recent", "proven", { published_uses_72h: 1 }),
      candidate("scheduled", "franchise", { future_scheduled_uses: 1 }),
            candidate("weak", "underperforming"),

    ];
    const safe = Array.from({ length: 6 }, (_, index) => candidate(`safe-${index}`));
    const result = selectSourceFamilyLineup({
      candidates: [...blocked, ...safe],
      slot_keys: slots(4),
      seed: "hard-exclusions",
      include_parity_trace: true,
    });

    expect(result.selected).toHaveLength(4);
    expect(result.selected.every((item) => String(item.source_identity_key).startsWith("source-safe-"))).toBe(true);
    expect(result.receipts.every((receipt) => receipt.cooldown_hours === 72 && receipt.cooldown_relaxation === 1)).toBe(true);
    expect(result.parity_trace?.exclusions).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "source_published_within_72h" }),
      expect.objectContaining({ reason: "source_already_future_scheduled" }),
            expect.objectContaining({ reason: "lifetime_underperforming" }),

    ]));
  });

    it("keeps probation and tiebreaker families exploration-only", () => {
    const audition = [
      candidate("probation", "untested", { audition_state: "probation", audition_failures: 1 }),
      candidate("tiebreaker", "untested", { audition_state: "tiebreaker", audition_passes: 1, audition_failures: 1 }),
    ];
    const result = selectSourceFamilyLineup({
      candidates: [...audition, candidate("winner", "franchise"), candidate("dev", "emerging")],
      slot_keys: slots(4),
      seed: "audition-exploration",
    });
    const auditionReceipts = result.receipts.filter((receipt) => ["probation", "tiebreaker"].includes(receipt.audition_state));
    expect(auditionReceipts).toHaveLength(2);
    expect(auditionReceipts.every((receipt) => receipt.allocation_tier === "exploration")).toBe(true);
  });

  it("enforces compiled hard bans, experiment reservations, and strategy/evidence weights before lock", () => {
    const candidates = [
      candidate("banned", "franchise", { text: "Forbidden premise" }),
      candidate("reserved", "emerging"),
      candidate("weighted", "emerging"),
      candidate("safe-a", "franchise"),
      candidate("safe-b", "prospect"),
      candidate("safe-c"),
    ];
    const slotKeys = slots(4);
    const policy = compileSourcePreselectionPolicy({
      candidates,
      slot_keys: slotKeys,
      hard_bans: [{ rule_key: "ban-premise", phrase: "Forbidden premise", active: 1 }],
      active_experiments: [{
        experiment_key: "reserved-test",
        status: "active",
        source_identity_key: "source-reserved",
        required_slots: 1,
        reserved_slot_keys: [slotKeys[0]],
      }],
      strategy_directives: { source_weights: { "source-weighted": 2 } },
      strongest_mature_evidence: [{ source_identity_key: "source-weighted" }],
    });
    const result = selectSourceFamilyLineup({ candidates, slot_keys: slotKeys, seed: "policy-authority", preselection_policy: policy, include_parity_trace: true });

    expect(result.selected.some((item) => item.source_identity_key === "source-banned")).toBe(false);
    expect(result.receipts[0]).toEqual(expect.objectContaining({
      source_identity_key: "source-reserved",
      experiment_reservation_key: "reserved-test",
      preselection_policy_hash: policy.policy_hash,
    }));
    expect(result.summary).toEqual(expect.objectContaining({
      experiment_reservations_required: 1,
      experiment_reservations_fulfilled: 1,
      preselection_policy_hash: policy.policy_hash,
    }));
    expect(result.parity_trace?.exclusions).toEqual(expect.arrayContaining([
      expect.objectContaining({ source_identity_key: "source-banned", reason: "preselection_hard_ban" }),
    ]));
  });

  it("enforces protected exploration and controlled winner allocation", () => {

    const winners = Array.from({ length: 3 }, (_, index) => candidate(`winner-${index}`, "franchise"));
    const development = Array.from({ length: 8 }, (_, index) => candidate(`development-${index}`, "emerging"));
    const exploration = Array.from({ length: 20 }, (_, index) => candidate(`exploration-${index}`));
    const result = selectSourceFamilyLineup({
      candidates: [...winners, ...development, ...exploration],
      slot_keys: slots(20),
      seed: "allocation",
    });
    const tiers = result.summary.selected_allocation_tiers as Record<string, number>;

    expect(tiers).toEqual({ winner: 3, development: 8, exploration: 9 });
    expect(new Set(result.selected.map((item) => item.source_identity_key)).size).toBe(20);
  });

  it("blocks a semantic premise inside the 24-hour audience window", () => {
    const crowded = candidate("crowded", "franchise", {
      semantic_key: "future-spouse-coming",
      semantic_exposure_times: ["2026-08-10T01:00:00.000Z"],
    });
    const candidates = [
      crowded,
      candidate("winner-safe", "franchise"),
      candidate("dev-1", "emerging"),
      candidate("dev-2", "prospect"),
      candidate("explore-1"),
      candidate("explore-2"),
      candidate("explore-3"),
    ];
    const result = selectSourceFamilyLineup({
      candidates,
      slot_keys: slots(5),
      seed: "semantic-spacing",
    });

    expect(result.selected.some((item) => item.source_identity_key === crowded.source_identity_key)).toBe(false);
  });

  it("permanently blocks the July 30-31 parrot-repeat fixtures", () => {
    const julyRepeatFixtures = [
      "life-about-to-get-good",
      "hands-channel-abundance",
      "inner-child-higher-self",
      "intuition-believe-it",
      "kind-person-opportunity",
      "celebrate-others-beautiful",
      "twenty-k-month-day",
      "one-hundred-k-stay-focused",
      "future-spouse-coming",
      "flat-stomach-bank-account",
    ].map((id) => candidate(`july-repeat-${id}`, "proven", { published_uses_72h: 1 }));
    const fresh = Array.from({ length: 24 }, (_, index) => candidate(`fresh-${index}`));
    const result = selectSourceFamilyLineup({
      candidates: [...julyRepeatFixtures, ...fresh],
      slot_keys: slots(24),
      seed: "july-repeat-regression",
    });

    expect(result.selected).toHaveLength(24);
    expect(result.selected.some((item) => String(item.source_identity_key).includes("july-repeat"))).toBe(false);
  });

  it("fails closed instead of relaxing when hardened inventory is insufficient", () => {
    expect(() => selectSourceFamilyLineup({
      candidates: [
        candidate("recent-a", "proven", { published_uses_72h: 1 }),
        candidate("recent-b", "proven", { published_uses_72h: 1 }),
        candidate("only-safe"),
      ],
      slot_keys: slots(2),
      seed: "fail-closed",
    })).toThrow("insufficient_hardened_source_families:1:2");
  });

  it("replays deterministically under the hardened policy", () => {
    const candidates = Array.from({ length: 24 }, (_, index) => candidate(`deterministic-${index}`));
    const input = { candidates, slot_keys: slots(24), seed: "deterministic-v5" };
    expect(selectSourceFamilyLineup(input).receipts).toEqual(selectSourceFamilyLineup(input).receipts);
  });
});

