import { describe, expect, it } from "vitest";
import {
  extractOwnerBannedSavedPatternIds,
  selectSourceFamilyLineup,
  type SourceFamilyLifetimeLabel,
  type SourceSelectionCandidate,
} from "../src/sourceFamilySelection";

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

describe("hardened source family selection", () => {
  it("hard-excludes recent published, future scheduled, underperforming, and disproven families", () => {
    const blocked = [
      candidate("recent", "proven", { published_uses_72h: 1 }),
      candidate("scheduled", "franchise", { future_scheduled_uses: 1 }),
      candidate("weak", "underperforming"),
      candidate("dead", "disproven"),
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
      expect.objectContaining({ reason: "lifetime_disproven" }),
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

