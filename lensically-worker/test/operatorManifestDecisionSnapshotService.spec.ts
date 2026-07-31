import { describe, expect, it } from "vitest";
import {
  buildManifestDecisionScenarioOverlay,
  compareManifestDecisionSelectorParity,
  hashManifestDecisionValue,
  type ManifestDecisionSnapshot,
} from "../src/operatorManifestDecisionSnapshotService";
import {
  selectSourceFamilyLineup,
  type SourceSelectionCandidate,
} from "../src/sourceFamilySelection";

function candidates(count = 120): SourceSelectionCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    source_candidate_id: `candidate-${index}`,
    source_identity_key: `saved-pattern:${index}`,
    source_card_family_id: `family-${index}`,
    source_card_id: `card-${index}`,
    source_type: "source_card",
    internal_source_id: String(index),
    source_mechanism: `mechanism-${index}`,
    required_product: `reader reward ${index}`,
    lifetime_label: index < 20 ? "franchise" : index < 80 ? "proven" : "prospect",
    recent_label: index % 3 === 0 ? "hot" : "healthy",
    confidence_label: "reliable",
    lifetime_sample_size: 1 + (index % 9),
    recent_sample_size: 2,
    lifetime_index: 1 + index / 100,
    recent_index: 1 + (index % 5) / 100,
    uses_24h: 0,
    uses_7d: index % 2,
    uses_28d: index % 4,
    hours_since_last_use: 100 + index,
    semantic_key: `semantic-${index}`,
  }));
}

async function snapshot(sourceCandidates = candidates()): Promise<ManifestDecisionSnapshot> {
  const withoutHash = {
    contract_version: "manifest-decision-snapshot-v1",
    provider_version: "manifest-decision-provider-v1",
    brand_key: "manifest_mental",
    account_id: "account-1",
    threads_user_id: "threads-1",
    captured_at: "2026-07-31T13:00:00.000Z",
    timezone: "America/New_York",
    coverage_rules: { exact_hourly_slots: true },
    source_candidates: sourceCandidates,
    saved_patterns: [],
    source_cards: [],
    source_families: [],
    source_selections: [],
    source_exclusions: [],
    mature_metric_windows: [],
    source_exposure_history: [],
    strategy: null,
    learning_brief: null,
    content_focus: null,
    portfolio_state: null,
    experiments: [],
    hypotheses: [],
    repetition_evidence: [],
    follower_checkpoint: null,
    hard_bans: [],
    recent_performance: {},
    strongest_posts: [],
    weakest_posts: [],
    recent_published: [],
    future_scheduled: [],
    eligibility_state: {
      candidate_count: sourceCandidates.length,
      eligible_candidate_count: sourceCandidates.length,
      eligible_family_count: sourceCandidates.length,
      excluded_candidate_count: 0,
      excluded_candidates: [],
    },
    evidence_gaps: [],
    freshness: { evidence_mode: "snapshot", stale: false },
    query_receipts: [],
    production_fingerprint_before: {},
    production_fingerprint_after: {},
    zero_write_proof: { passed: true, main_write_count: 0, select_only_enforced: true },
  };
  return {
    ...withoutHash,
    snapshot_hash: await hashManifestDecisionValue(withoutHash),
  };
}

function hourlySlots(count: number): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, index) => ({
    key: `2026-08-01T${String(index).padStart(2, "0")}:00`,
    date: "2026-08-01",
    time: `${String(index).padStart(2, "0")}:00`,
  }));
}

describe("operatorManifestDecisionSnapshotService", () => {
  it("builds a 24-slot schedule-only overlay without changing evidence", async () => {
    const frozen = await snapshot();
    const targetSlots = hourlySlots(24);
    const overlay = await buildManifestDecisionScenarioOverlay({
      snapshotHash: frozen.snapshot_hash,
      targetSlots,
      occupiedSlotKeys: [],
    });

    expect(overlay.snapshot_hash).toBe(frozen.snapshot_hash);
    expect(overlay.missing_slot_keys).toHaveLength(24);
    expect(overlay.diff_manifest).toEqual({
      changed_paths: ["coverage.target_slots", "coverage.occupied_slot_keys", "coverage.missing_slot_keys"],
      forbidden_changed_paths: [],
      evidence_unchanged: true,
    });
  });

  it("proves exact Main-equivalent selector parity across 120 real families", async () => {
    const frozen = await snapshot();
    const receipt = await compareManifestDecisionSelectorParity({
      snapshot: frozen,
      slotKeys: hourlySlots(24).map((slot) => String(slot.key)),
      seed: "manifest-main-mimic-parity",
      minimumEligibleFamilies: 100,
      selectSourceLineup: selectSourceFamilyLineup,
    });

    expect(receipt.candidate_pool_requirement_passed).toBe(true);
    expect(receipt.eligible_family_count).toBe(120);
    expect(receipt.selected_source_to_slot).toHaveLength(24);
    expect(receipt.eligible_pool_match).toBe(true);
    expect(receipt.exclusions_match).toBe(true);
    expect(receipt.ranked_order_match).toBe(true);
    expect(receipt.selected_lineup_match).toBe(true);
    expect(receipt.parity_passed).toBe(true);
  });

  it("detects selector divergence before generation", async () => {
    const frozen = await snapshot();
    let calls = 0;
    const receipt = await compareManifestDecisionSelectorParity({
      snapshot: frozen,
      slotKeys: hourlySlots(24).map((slot) => String(slot.key)),
      seed: "manifest-main-mimic-divergence",
      minimumEligibleFamilies: 100,
      selectSourceLineup: (input) => {
        calls += 1;
        const result = selectSourceFamilyLineup(input);
        if (calls === 2 && result.receipts[0]) {
          result.receipts[0] = { ...result.receipts[0], source_card_id: "tampered-card" };
        }
        return result;
      },
    });

    expect(receipt.selected_lineup_match).toBe(false);
    expect(receipt.parity_passed).toBe(false);
  });
});
