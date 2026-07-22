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
import {
  buildManifestComparableAnalysis,
  buildManifestMaturityEvaluation,
  buildManifestSemanticSignature,
  compareManifestSemanticSignatures,
  deriveManifestConfidenceTransition,
  deriveManifestPortfolioState,
  evaluateManifestExperiment,
} from "./src/manifestIntelligenceEngine";
import {
  buildManifestFollowerCheckpoint,
  buildManifestLearningBrief,
  buildManifestOperatorBenchmarks,
  buildManifestRunComparison,
  buildManifestSavedPatternIntelligence,
} from "./src/manifestMeasurementAudit";

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

        const finalPage = buildManifestCycleReceiptRead(receipt, "events", 3, 10);
    expect(finalPage.items).toEqual(events.slice(3));
    expect(finalPage.pagination).toMatchObject({ returned: 4, total: 7, has_more: false, next_offset: null });

    const startupChunks = buildManifestCycleReceiptRead(receipt, "startup_state", 0, 10);
    const reconstructedStartup = (startupChunks.items as Array<{ text: string }>).map((item) => item.text).join("");
    expect(JSON.parse(reconstructedStartup)).toEqual(receipt.startup_state);
    expect(startupChunks.section_data).toMatchObject({
      encoding: "stable-json-chunks",
      character_count: reconstructedStartup.length,
      chunk_count: 1,
    });

    const strategyChunks = buildManifestCycleReceiptRead(receipt, "output_strategy", 0, 10);
    const reconstructedStrategy = (strategyChunks.items as Array<{ text: string }>).map((item) => item.text).join("");
    expect(JSON.parse(reconstructedStrategy)).toEqual(receipt.output_strategy_version);
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

describe("Manifest intelligence engine", () => {
  it("detects the same spending-priority premise when only the dollar amount and wording change", () => {
    const first = buildManifestSemanticSignature({
      text: "If $25,000 reached you today, what expense disappears first?",
    });
    const second = buildManifestSemanticSignature({
      text: "$50,000 arrives today. What gets handled first?",
    });
    const comparison = compareManifestSemanticSignatures(first, second);

    expect(first.premise_key).toBe(second.premise_key);
    expect(first.dollar_amounts).not.toEqual(second.dollar_amounts);
    expect(comparison).toMatchObject({
      semantic_repetition: true,
      severity: "collision",
      premise_similarity: 1,
    });
    expect(comparison.repeated_dimensions).toEqual(expect.arrayContaining([
      "question_type", "financial_scenario_key", "tension_key", "audience_reward_key", "sentence_architecture",
    ]));
  });

  it("keeps materially different premises outside the semantic collision class", () => {
    const money = buildManifestSemanticSignature({
      text: "If $25,000 reached you today, what expense disappears first?",
    });
    const intuition = buildManifestSemanticSignature({
      text: "Trust what your intuition keeps telling you. BELIEVE IT.",
    });
    const comparison = compareManifestSemanticSignatures(money, intuition);

    expect(comparison.semantic_repetition).toBe(false);
    expect(comparison.severity).toBe("none");
  });

  it("uses 6, 12, and 18 hours directionally while reserving structural changes for 24 hours", () => {
    const evaluations = [6, 12, 18, 24].map((checkpoint_hours) => buildManifestMaturityEvaluation({
      checkpoint_hours,
      metrics: { views: 1000, likes: 100 },
      rates: { like_rate: 0.1 },
      velocity: { cumulative_views_per_hour: 50 },
      scores: { overall: 75 },
      distribution_state: "accelerating",
    }));

    expect(evaluations.map((item) => item.maturity_state)).toEqual([
      "initial_signal", "directional", "strong_directional", "authoritative",
    ]);
    expect(evaluations.map((item) => item.structural_change_allowed)).toEqual([false, false, false, true]);
    expect(evaluations.map((item) => item.learning_weight)).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it("selects age-matched comparable posts across family, hook, structure, reward, format, topic, and time", () => {
    const targetSignature = buildManifestSemanticSignature({
      text: "If $25,000 reached you today, what expense disappears first?",
    });
    const closeSignature = buildManifestSemanticSignature({
      text: "$50,000 arrives today. What gets handled first?",
    });
    const analysis = buildManifestComparableAnalysis({
      published_post_id: "target",
      checkpoint_hours: 24,
      overall_score: 70,
      family_key: "specific_money_question",
      hook_style: "money_question",
      structure: "specific_amount_question",
      audience_reward: "financial_choice",
      format: "short_text",
      topic: "money",
      time_bucket: "morning",
      semantic_signature: targetSignature,
    }, [
      {
        published_post_id: "close",
        checkpoint_hours: 24,
        overall_score: 60,
        family_key: "specific_money_question",
        hook_style: "money_question",
        structure: "specific_amount_question",
        audience_reward: "financial_choice",
        format: "short_text",
        topic: "money",
        time_bucket: "morning",
        semantic_signature: closeSignature,
      },
      {
        published_post_id: "unrelated",
        checkpoint_hours: 24,
        overall_score: 80,
        family_key: "intuition",
        hook_style: "direct_validation",
        structure: "two_step_claim",
        audience_reward: "self_trust",
        format: "short_text",
        topic: "intuition",
        time_bucket: "evening",
        semantic_signature: buildManifestSemanticSignature({ text: "Trust what your intuition keeps telling you. BELIEVE IT." }),
      },
    ]);

    expect(analysis.comparable_post_ids).toEqual(["close"]);
    expect(analysis.comparable_count).toBe(1);
    expect(analysis.delta_from_comparable_median).toBe(10);
  });

  it("permits strategy transitions only when mature evidence reaches a supported confidence state", () => {
    const reliable = deriveManifestConfidenceTransition({
      sample_size: 8,
      authoritative_sample_size: 8,
      supporting_count: 7,
      contradicting_count: 1,
      effect_size: 14,
    });
    const insufficient = deriveManifestConfidenceTransition({
      sample_size: 2,
      authoritative_sample_size: 1,
      supporting_count: 1,
      contradicting_count: 0,
      effect_size: 18,
    });

    expect(reliable).toMatchObject({ label: "reliable", transition_allowed: true });
    expect(insufficient).toMatchObject({ label: "insufficient", transition_allowed: false });
  });

  it("classifies adaptive portfolio roles without fixed quotas and evaluates controlled experiments", () => {
    const portfolio = deriveManifestPortfolioState({
      current_role: "prospect",
      mature_count: 8,
      median_overall: 70,
      recent_median_overall: 72,
      baseline_median_overall: 68,
      strong_count: 5,
      weak_count: 0,
      confidence_label: "reliable",
    });
    const experiment = evaluateManifestExperiment({
      variant_scores: [70, 72, 74],
      control_scores: [55, 58, 60],
    });

    expect(portfolio).toMatchObject({
      role: "franchise",
      recommended_role: "franchise",
      allocation_weight: 1.6,
      transition_allowed: true,
      actual_decay: false,
    });
    expect(experiment).toMatchObject({ decision: "expand", variant_median: 72, control_median: 58, delta: 14 });
  });

  it("validates a controlled experiment inside the immutable pre-publication hypothesis", () => {
    const result = validateManifestPostHypothesis({
      expected_response_type: "replies",
      expected_audience_reward: "A specific financial choice worth discussing.",
      hook_rationale: "The concrete amount creates immediate imagination.",
      premise_rationale: "The question exposes a real priority tradeoff.",
      exploration_mode: "explore",
      expected_performance_range: { replies: { min: 10, max: 100 } },
      uncertainty: "The premise may be overexposed.",
      experiment: {
        experiment_key: "money-question-payoff-v1",
        hypothesis: { variable: "payoff", expected_effect: "higher conversation rate" },
        comparison_group: { family_key: "specific_money_question", variant_excluded: true },
        maturity_windows: [6, 12, 18, 24],
        result_criteria: { minimum_variant: 3, minimum_control: 3, win_delta: 8, loss_delta: -8 },
        variant_key: "direct-relief-payoff",
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.experiment).toMatchObject({
        experiment_key: "money-question-payoff-v1",
        maturity_windows: [6, 12, 18, 24],
        variant_key: "direct-relief-payoff",
      });
    }
  });
});



