import { describe, expect, it } from "vitest";
import {
  SOURCE_PRESELECTION_POLICY_VERSION,
  compileSourcePreselectionPolicy,
  sourcePreselectionAdjustmentForCandidate,
  sourcePreselectionExclusionForCandidate,
} from "../src/sourcePreselectionPolicy";

type Candidate = Record<string, unknown>;

function candidate(id: string, text = `Source ${id}`): Candidate {
  return {
    source_identity_key: `source-${id}`,
    source_card_id: `card-${id}`,
    source_card_family_id: `family-${id}`,
    saved_pattern_id: id,
    text,
  };
}

function compile(overrides: Record<string, unknown> = {}) {
  const candidates = [candidate("1", "Never repeat this phrase"), candidate("2"), candidate("3")];
  return {
    candidates,
    policy: compileSourcePreselectionPolicy({
      candidates,
      slot_keys: ["2026-08-10T00:00", "2026-08-10T01:00", "2026-08-10T02:00"],
      ...overrides,
    }),
  };
}

describe("Stage 4 source preselection policy", () => {
  it("is deterministic, versioned, and hashable", () => {
    const first = compile({ strategy_directives: { source_weights: { "source-2": 1.4 } } }).policy;
    const second = compile({ strategy_directives: { source_weights: { "source-2": 1.4 } } }).policy;

    expect(first.contract_version).toBe(SOURCE_PRESELECTION_POLICY_VERSION);
    expect(first.policy_hash).toBe(second.policy_hash);
    expect(first).toEqual(second);
  });

  it("turns an active hard ban into a fail-closed candidate exclusion", () => {
    const { candidates, policy } = compile({
      hard_bans: [{ rule_key: "ban-phrase", phrase: "Never repeat this phrase", active: 1 }],
    });

    expect(sourcePreselectionExclusionForCandidate(policy, candidates[0])).toEqual(expect.objectContaining({
      reason: "preselection_hard_ban",
      signal: expect.objectContaining({ signal_type: "hard_ban", effect: "exclude" }),
    }));
    expect(sourcePreselectionExclusionForCandidate(policy, candidates[1])).toBeNull();
  });

  it("reserves one eligible source for an active experiment", () => {
    const { policy } = compile({
      active_experiments: [{
        experiment_key: "hook-test",
        status: "active",
        source_identity_key: "source-2",
        required_slots: 1,
        reserved_slot_keys: ["2026-08-10T01:00"],
        variant_key: "challenger",
      }],
    });

    expect(policy.experiment_reservations).toEqual([
      expect.objectContaining({
        reservation_key: "hook-test",
        source_identity_key: "source-2",
        required_slots: 1,
        slot_keys: ["2026-08-10T01:00"],
        variant_key: "challenger",
      }),
    ]);
  });

  it("materially changes score and tier through strategy directives", () => {
    const { candidates, policy } = compile({
      strategy_directives: {
        source_weights: { "source-2": 1.6 },
        exploration_family_ids: ["family-3"],
      },
    });

    expect(sourcePreselectionAdjustmentForCandidate(policy, candidates[1])).toEqual(expect.objectContaining({
      score_multiplier: 1.6,
      signals: expect.arrayContaining([expect.objectContaining({ signal_type: "strategy_directive", effect: "weight" })]),
    }));
    expect(sourcePreselectionAdjustmentForCandidate(policy, candidates[2])).toEqual(expect.objectContaining({
      allocation_tier_override: "exploration",
      signals: expect.arrayContaining([expect.objectContaining({ signal_type: "strategy_directive", effect: "tier" })]),
    }));
  });

  it("materially promotes strongest mature evidence before selection", () => {
    const { candidates, policy } = compile({
      strongest_mature_evidence: [{ published_post_id: "winner-post", source_card_family_id: "family-2" }],
    });
    const adjustment = sourcePreselectionAdjustmentForCandidate(policy, candidates[1]);

    expect(adjustment?.score_multiplier).toBeGreaterThan(1);
    expect(adjustment?.score_addend).toBeGreaterThan(0);
    expect(adjustment?.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ signal_type: "strongest_evidence", effect: "weight" }),
    ]));
  });

  it("materially reduces weakest mature evidence before selection", () => {
    const { candidates, policy } = compile({
      weakest_mature_evidence: [{ published_post_id: "weak-post", source_identity_key: "source-2" }],
    });
    const adjustment = sourcePreselectionAdjustmentForCandidate(policy, candidates[1]);

    expect(adjustment?.score_multiplier).toBeLessThan(1);
    expect(adjustment?.score_addend).toBeLessThan(0);
    expect(adjustment?.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ signal_type: "weakest_evidence", effect: "weight" }),
    ]));
  });

  it("changes only the signal-governed policy surface in counterfactual comparisons", () => {
    const baseline = compile().policy;
    const hardBan = compile({ hard_bans: [{ rule_key: "ban-source", source_identity_key: "source-1", active: 1 }] }).policy;
    const experiment = compile({ active_experiments: [{ experiment_key: "exp", status: "active", source_identity_key: "source-2", required_slots: 1 }] }).policy;
    const strategy = compile({ strategy_directives: { source_weights: { "source-2": 1.5 } } }).policy;
    const strongest = compile({ strongest_mature_evidence: [{ source_identity_key: "source-2" }] }).policy;
    const weakest = compile({ weakest_mature_evidence: [{ source_identity_key: "source-2" }] }).policy;

    expect(hardBan.hard_exclusions).not.toEqual(baseline.hard_exclusions);
    expect(experiment.experiment_reservations).not.toEqual(baseline.experiment_reservations);
    expect(strategy.candidate_adjustments).not.toEqual(baseline.candidate_adjustments);
    expect(strongest.candidate_adjustments).not.toEqual(baseline.candidate_adjustments);
    expect(weakest.candidate_adjustments).not.toEqual(baseline.candidate_adjustments);
    expect(new Set([baseline.policy_hash, hardBan.policy_hash, experiment.policy_hash, strategy.policy_hash, strongest.policy_hash, weakest.policy_hash]).size).toBe(6);
  });
});
