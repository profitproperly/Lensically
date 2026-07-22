import { describe, expect, it } from "vitest";
import {
  buildManifestRollingHourlySlots,
  resolveManifestAutonomousClock,
} from "./src/index";
import {
      MANIFEST_CYCLE_RECEIPT_READ_VERSION,
  MANIFEST_FOLLOWER_ATTRIBUTION_POLICY,
  MANIFEST_INTELLIGENCE_FOUNDATION_VERSION,
  MANIFEST_NONINTERFERENCE_POLICY,
  buildManifestCycleReceiptRead,
  buildManifestExposureDimensions,
  normalizeManifestSourceContext,
  validateManifestFollowerAttributionBoundary,
  validateManifestPostHypothesis,
} from "./src/manifestIntelligence";

describe("Manifest autonomous clock and horizon", () => {
    it("uses Threads server time when the runtime clock is behind", () => {
    const clock = resolveManifestAutonomousClock(
      "2026-07-21T15:16:39.000Z",
      "2026-07-21T17:16:39.000Z",
      "2026-07-21T17:16:38.000Z",
      "2026-07-21T17:05:00.000Z",
    );

    expect(clock.source).toBe("threads_server");
    expect(clock.effective_now_iso).toBe("2026-07-21T17:16:39.000Z");
    expect(clock.runtime_skew_seconds).toBe(-7200);
  });

  it("uses trusted UTC when runtime and database clocks expose New York wall time as UTC", () => {
    const clock = resolveManifestAutonomousClock(
      "2026-07-21T15:16:39.000Z",
      null,
      "2026-07-21T15:16:40.000Z",
      null,
      "2026-07-21T19:16:41.000Z",
    );
    const local = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(clock.effective_now_iso));
    const parts = new Map(local.map((part) => [part.type, part.value]));
    const slots = buildManifestRollingHourlySlots(
      `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`,
      Number(parts.get("hour")),
      4,
    );

    expect(clock.source).toBe("trusted_edge");
    expect(clock.effective_now_iso).toBe("2026-07-21T19:16:41.000Z");
    expect(slots[0]?.key).toBe("2026-07-21T16:00");
  });


    it("uses the newest verified publication as a hard lower bound", () => {
    const clock = resolveManifestAutonomousClock(
      "2026-07-21T15:16:39.000Z",
      null,
      "2026-07-21T15:16:40.000Z",
      "2026-07-21T17:05:00.000Z",
    );

    expect(clock.source).toBe("database");
    expect(clock.latest_publication_floor_applied).toBe(true);
    expect(clock.effective_now_iso).toBe("2026-07-21T17:05:00.000Z");
  });

  it("never lets stale Threads or database clocks move the runway behind runtime", () => {
    const clock = resolveManifestAutonomousClock(
      "2026-07-21T19:08:09.000Z",
      "2026-07-21T15:16:39.000Z",
      "2026-07-21T19:08:08.000Z",
      "2026-07-21T18:55:00.000Z",
    );

    expect(clock.source).toBe("runtime");
    expect(clock.effective_now_iso).toBe("2026-07-21T19:08:09.000Z");
    expect(clock.runtime_skew_seconds).toBe(0);
  });

  it("uses a newer database clock instead of a stale Threads response", () => {
    const clock = resolveManifestAutonomousClock(
      "2026-07-21T19:08:09.000Z",
      "2026-07-21T15:16:39.000Z",
      "2026-07-21T19:08:10.000Z",
      null,
    );

    expect(clock.source).toBe("database");
    expect(clock.effective_now_iso).toBe("2026-07-21T19:08:10.000Z");
  });

  it("starts the rolling horizon at the next future hour", () => {
    const slots = buildManifestRollingHourlySlots("2026-07-21", 13, 4);

    expect(slots.map((slot) => slot.key)).toEqual([
      "2026-07-21T14:00",
      "2026-07-21T15:00",
      "2026-07-21T16:00",
      "2026-07-21T17:00",
    ]);
    });
});

describe("Manifest intelligence foundation", () => {
  it("rejects any post hypothesis that attempts follower attribution", () => {
    const result = validateManifestPostHypothesis({
      expected_response_type: "replies",
      expected_audience_reward: "A specific financial choice worth discussing.",
      hook_rationale: "The concrete amount creates immediate imagination.",
      premise_rationale: "The question exposes a real priority tradeoff.",
      exploration_mode: "explore",
      expected_performance_range: { replies: { min: 10, max: 100 } },
      uncertainty: "The premise may be overexposed.",
      expected_followers: 25,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("|")).toContain("follower_attribution_forbidden");
  });

  it("normalizes a complete engagement-only post hypothesis", () => {
    const result = validateManifestPostHypothesis({
      expected_response_type: "balanced_engagement",
      expected_audience_reward: "A vivid financial-freedom scenario.",
      hook_rationale: "The opener directly selects the reader.",
      premise_rationale: "The payoff is concrete without repeating a spending-priority question.",
      exploration_mode: "hybrid",
      comparable_post_ids: ["post-1", "post-2"],
      expected_performance_range: { views: { min: 500, max: 5000 }, likes: { min: 25, max: 500 } },
      uncertainty: "Distribution can vary even when engagement quality is strong.",
      falsification_conditions: ["Comparable mature posts consistently outperform this premise."],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.expected_response_type).toBe("balanced_engagement");
      expect(result.value.comparable_post_ids).toEqual(["post-1", "post-2"]);
    }
  });

  it("builds structured exposure counts across semantic dimensions", () => {
    const dimensions = buildManifestExposureDimensions([
      {
        text: "If $25,000 reached you today, what expense disappears first?",
        strategy: { family_key: "specific_money_question", hook_style: "money_question", premise_key: "spending_priority", audience_reward: "financial_choice", generation_mode: "controlled_variation" },
      },
      {
        text: "$50,000 arrives today. What gets handled first?",
        strategy: { family_key: "specific_money_question", hook_style: "money_question", premise_key: "spending_priority", audience_reward: "financial_choice", generation_mode: "controlled_variation" },
      },
    ]);

    expect(dimensions.record_count).toBe(2);
    expect((dimensions.premise_counts as Record<string, number>).spending_priority).toBe(2);
    expect(dimensions.question_count).toBe(2);
    expect(Object.keys(dimensions.dollar_amount_counts as Record<string, number>)).toEqual(["25,000", "50,000"]);
  });

    it("allows only account-level follower checkpoints", () => {
    const result = validateManifestFollowerAttributionBoundary({
      follower_checkpoint: {
        current_followers: 505,
        target_followers: 1_000_000,
        followers_remaining: 999_495,
        long_horizon_follower_trajectory: "Account-level checkpoint only.",
      },
    });

    expect(result).toEqual({ ok: true });
  });

  it("rejects scoped follower attribution in fields and narrative claims", () => {
    const result = validateManifestFollowerAttributionBoundary({
      post_strategy: { expected_followers_from_post: 25 },
      rationale: "This post generated followers from the morning schedule.",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("|")).toContain("follower_attribution_forbidden");
  });

    it("returns complete pageable receipt evidence without payload truncation", () => {
    const events = Array.from({ length: 7 }, (_, index) => ({
      event_key: `event-${index + 1}`,
      event_type: index === 0 ? "cycle_prepared" : `event_type_${index + 1}`,
      payload: { index: index + 1 },
    }));
    const receipt = {
      id: "receipt-1",
      cycle_id: "cycle-1",
      brand_key: "manifest_mental",
      receipt_version: "manifest-cycle-receipt-v2",
      foundation_version: "manifest-intelligence-foundation-v2",
      status: "running",
      input_strategy_version: { id: "strategy-in", version: 1, strategy: { thesis: "input" } },
      output_strategy_version: { id: "strategy-out", version: 2, strategy: { thesis: "output" } },
      exposure_snapshot: {
        id: "exposure-1",
        revision: 2,
        published: [{ id: "published-1" }, { id: "published-2" }],
        scheduled: [{ id: "scheduled-1" }],
        dimensions: { record_count: 3 },
      },
      startup_state: { captured_at: "2026-07-21T00:00:00.000Z", consulted: ["performance", "schedule"] },
      events,
      hypotheses: [
        { id: "hypothesis-1", slot_key: "2026-07-21T12:00", status: "scheduled" },
        { id: "hypothesis-2", slot_key: "2026-07-21T13:00", status: "scheduled" },
      ],
    };

    const summary = buildManifestCycleReceiptRead(receipt, "summary");
    expect(summary.receipt_read_version).toBe(MANIFEST_CYCLE_RECEIPT_READ_VERSION);
    expect((summary.summary as Record<string, unknown>).event_count).toBe(7);
    expect((summary.summary as Record<string, unknown>).hypothesis_count).toBe(2);
    expect(summary.items).toEqual([]);

    const firstPage = buildManifestCycleReceiptRead(receipt, "events", 0, 3);
    expect(firstPage.items).toEqual(events.slice(0, 3));
    expect(firstPage.pagination).toMatchObject({
      offset: 0,
      limit: 3,
      returned: 3,
      total: 7,
      has_more: true,
      next_offset: 3,
    });

    const finalPage = buildManifestCycleReceiptRead(receipt, "events", 3, 20);
    expect(finalPage.items).toEqual(events.slice(3));
    expect(finalPage.pagination).toMatchObject({ returned: 4, total: 7, has_more: false, next_offset: null });
  });

  it("accepts operator hypotheses and preserves permanent policy boundaries", () => {
    const source = normalizeManifestSourceContext({ kind: "operator_hypothesis", source_type: "operator_hypothesis" });
    expect(source.ok).toBe(true);
    expect(MANIFEST_INTELLIGENCE_FOUNDATION_VERSION).toBe("manifest-intelligence-foundation-v2");
    expect(MANIFEST_NONINTERFERENCE_POLICY.learning_source).toBe("observable_post_engagement");
    expect(MANIFEST_FOLLOWER_ATTRIBUTION_POLICY.post_level_attribution).toBe("forbidden");
    expect(MANIFEST_FOLLOWER_ATTRIBUTION_POLICY.account_level_only).toBe(true);
  });
});

