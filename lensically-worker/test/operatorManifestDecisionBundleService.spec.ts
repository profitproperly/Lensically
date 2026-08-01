import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildManifestDecisionBundle,
  consumeManifestDecisionBundle,
  getManifestDecisionBundleConsumptionState,
    MANIFEST_DECISION_BUNDLE_CONTRACT_VERSION,
  MANIFEST_DECISION_BUNDLE_MAX_BYTES,
} from "../src/operatorManifestDecisionBundleService";
import { validateManifestFollowerAttributionBoundary } from "../src/manifestIntelligence";

const brandKey = "manifest_decision_bundle_test";

beforeEach(async () => {
  await env.DB.batch([
        env.DB.prepare("DELETE FROM operator_manifest_decision_bundles WHERE brand_key = ?").bind(brandKey),
    env.DB.prepare("DELETE FROM operator_source_selection_plans WHERE brand_key = ?").bind(brandKey),
    env.DB.prepare("DELETE FROM operator_manifest_evidence_pages WHERE brand_key = ?").bind(brandKey),
    env.DB.prepare("DELETE FROM operator_manifest_evidence_posts WHERE brand_key = ?").bind(brandKey),
    env.DB.prepare("DELETE FROM operator_manifest_evidence_snapshots WHERE brand_key = ?").bind(brandKey),
    env.DB.prepare("DELETE FROM operator_autonomous_growth_cycles WHERE brand_key = ?").bind(brandKey),
  ]);
});

describe("operatorManifestDecisionBundleService", () => {
  it("builds, replays, and consumes a bundle from the canonical snapshot_version column", async () => {
    const cycleId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO operator_autonomous_growth_cycles (
           id, brand_key, operation_id, engine_version, status, timezone, horizon_hours,
           horizon_start_local, horizon_end_local, target_slots_json, missing_slots_json,
           account_position_json, scheduled_post_ids_json
         ) VALUES (?, ?, ?, 'test-engine-v1', 'prepared', 'America/New_York', 48,
           '2026-07-30T16:00', '2026-08-01T15:00', '[]', '[]', '{}', '[]')`,
      ).bind(cycleId, brandKey, `decision-bundle-${cycleId}`),
      env.DB.prepare(
        `INSERT INTO operator_manifest_evidence_snapshots (
           id, cycle_id, brand_key, snapshot_version, as_of, timezone,
           window_start, window_end, post_count, mature_count, immature_count,
           incomplete_count, page_size, page_count, page_byte_budget,
           benchmarks_json, source_hash
         ) VALUES (?, ?, ?, 'manifest-evidence-snapshot-test-v1',
           '2026-07-30T19:00:00.000Z', 'America/New_York',
           '2026-07-02T19:00:00.000Z', '2026-07-30T19:00:00.000Z',
           0, 0, 0, 0, 12, 1, 12000, '{"median_likes":0}', 'snapshot-source-hash')`,
      ).bind(snapshotId, cycleId, brandKey),
      env.DB.prepare(
        `INSERT INTO operator_manifest_evidence_pages (
           id, snapshot_id, cycle_id, brand_key, page_index, page_contract_version,
           item_count, byte_count, evidence_types_json, items_json
         ) VALUES (?, ?, ?, ?, 0, 'manifest-evidence-page-test-v1', 0, 2, '[]', '[]')`,
      ).bind(crypto.randomUUID(), snapshotId, cycleId, brandKey),
    ]);

    const built = await buildManifestDecisionBundle(env.DB, {
      brandKey,
      cycleId,
      snapshotId,
    });
    expect(built).toMatchObject({
      cycle_id: cycleId,
      snapshot_id: snapshotId,
      contract_version: MANIFEST_DECISION_BUNDLE_CONTRACT_VERSION,
      replayed: false,
      requires_detail_read: true,
    });
    expect((built.bundle as Record<string, any>).snapshot.evidence_contract_version)
      .toBe("manifest-evidence-snapshot-test-v1");
    expect(String(built.bundle_hash)).toHaveLength(64);

    const replay = await buildManifestDecisionBundle(env.DB, {
      brandKey,
      cycleId,
      snapshotId,
    });
    expect(replay).toMatchObject({ id: built.id, bundle_hash: built.bundle_hash, replayed: true });

    const consumed = await consumeManifestDecisionBundle(env.DB, {
      brandKey,
      cycleId,
      snapshotId,
      bundleId: String(built.id),
      bundleHash: String(built.bundle_hash),
    });
    expect(consumed.consumed_at).toBeTruthy();
    await expect(getManifestDecisionBundleConsumptionState(env.DB, {
      brandKey,
      cycleId,
      snapshotId,
      bundleId: String(built.id),
    })).resolves.toMatchObject({
      complete: true,
      bundle_id: built.id,
      bundle_hash: built.bundle_hash,
    });
    });

  it("keeps a complete 48-slot locked source plan inside the 24KB bundle contract", async () => {
    const cycleId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    const missingSlots = Array.from({ length: 48 }, (_, index) => ({
      key: `2026-08-${String(1 + Math.floor(index / 24)).padStart(2, "0")}T${String(index % 24).padStart(2, "0")}:00`,
      date: `2026-08-${String(1 + Math.floor(index / 24)).padStart(2, "0")}`,
      time: `${String(index % 24).padStart(2, "0")}:00`,
    }));
    const oversizedAccountPosition = {
      follower_count: 715,
      recent_posts: Array.from({ length: 40 }, (_, index) => ({
        id: `recent-${index}`,
        text: "x".repeat(500),
        metrics: { likes: index, views: index * 10 },
      })),
      future_schedule: missingSlots.map((slot) => ({ ...slot, text: "y".repeat(300) })),
      decision_intelligence: { narrative: "z".repeat(8000) },
    };
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO operator_autonomous_growth_cycles (
           id, brand_key, operation_id, engine_version, status, timezone, horizon_hours,
           horizon_start_local, horizon_end_local, target_slots_json, missing_slots_json,
           account_position_json, scheduled_post_ids_json
         ) VALUES (?, ?, ?, 'test-engine-v1', 'prepared', 'America/New_York', 48,
           ?, ?, ?, ?, ?, '[]')`,
      ).bind(
        cycleId,
        brandKey,
        `decision-bundle-48-${cycleId}`,
        missingSlots[0].key,
        missingSlots[47].key,
        JSON.stringify(missingSlots),
        JSON.stringify(missingSlots),
        JSON.stringify(oversizedAccountPosition),
      ),
      env.DB.prepare(
        `INSERT INTO operator_manifest_evidence_snapshots (
           id, cycle_id, brand_key, snapshot_version, as_of, timezone,
           window_start, window_end, post_count, mature_count, immature_count,
           incomplete_count, page_size, page_count, page_byte_budget,
           benchmarks_json, source_hash
         ) VALUES (?, ?, ?, 'manifest-evidence-snapshot-test-v1',
           '2026-07-30T19:00:00.000Z', 'America/New_York',
           '2026-07-02T19:00:00.000Z', '2026-07-30T19:00:00.000Z',
                      0, 0, 0, 0, 12, 64, 12000, ?, 'snapshot-source-hash-48')`,
      ).bind(
        snapshotId,
        cycleId,
        brandKey,
        JSON.stringify({ median_likes: 0, production_sized_benchmark_narrative: "b".repeat(30000) }),
      ),
      ...Array.from({ length: 64 }, (_, pageIndex) => env.DB.prepare(
        `INSERT INTO operator_manifest_evidence_pages (
           id, snapshot_id, cycle_id, brand_key, page_index, page_contract_version,
           item_count, byte_count, evidence_types_json, items_json
         ) VALUES (?, ?, ?, ?, ?, 'manifest-evidence-page-test-v1', 0, 2, '[]', '[]')`,
      ).bind(crypto.randomUUID(), snapshotId, cycleId, brandKey, pageIndex)),
      ...missingSlots.map((slot, index) => env.DB.prepare(

        `INSERT INTO operator_source_selection_plans (
           id, brand_key, cycle_id, slot_key, selection_order, source_identity_key,
           source_card_family_id, source_card_id, engine_version, receipt_json, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'selection-test-v1', ?, 'locked')`,
      ).bind(
        crypto.randomUUID(),
        brandKey,
        cycleId,
        slot.key,
        index + 1,
        `identity-${index}`,
        `family-${index}`,
        `card-${index}`,
                JSON.stringify({
          lifetime_label: "proven",
          audition_state: "graduated",
          recent_label: "stable",
          score: 1.5,
          preselection_policy_version: "source-preselection-policy-v1",
          preselection_policy_hash: "policy-hash-1",
          preselection_signals: [{ signal_type: "strongest_evidence", signal_key: "post-1", effect: "weight" }],
        }),

      )),
    ]);

    const built = await buildManifestDecisionBundle(env.DB, { brandKey, cycleId, snapshotId });
    const bundle = built.bundle as Record<string, any>;
    expect(Number(built.payload_bytes)).toBeLessThanOrEqual(MANIFEST_DECISION_BUNDLE_MAX_BYTES);
    expect(bundle.locked_source_plan).toHaveLength(48);
    expect(bundle.locked_source_plan.map((item: Record<string, unknown>) => item.slot_key))
      .toEqual(missingSlots.map((slot) => slot.key));
        expect(bundle.locked_source_plan.map((item: Record<string, unknown>) => item.source_card_id))
      .toEqual(Array.from({ length: 48 }, (_, index) => `card-${index}`));
        expect(bundle.selection_causal_authority).toEqual(expect.objectContaining({
      preselection_policy_versions: ["source-preselection-policy-v1"],
      preselection_policy_hashes: ["policy-hash-1"],
      per_selection_trace_persisted: true,
      durable_receipt_authority: "operator_source_selection_plans.receipt_json",
      locked_source_plan_hash: bundle.locked_source_plan_hash,
      stage_5_generation_and_audit_only: true,
    }));
    expect(bundle.stage_authority).toEqual(expect.objectContaining({

      stage_5: "generation_and_audit_context_only",
      stage_5_may_rerank: false,
      stage_5_may_substitute_sources: false,
      stage_5_may_change_slots: false,
    }));
    const replayed = await buildManifestDecisionBundle(env.DB, { brandKey, cycleId, snapshotId });
    expect((replayed.bundle as Record<string, any>).locked_source_plan_hash).toBe(bundle.locked_source_plan_hash);
    expect((replayed.bundle as Record<string, any>).locked_source_plan).toEqual(bundle.locked_source_plan);
    expect(built.requires_detail_read).toBe(true);

        expect(String(built.detail_reason)).toContain("bundle_size_compaction_level_");
  });
});

describe("Manifest follower attribution boundary", () => {
  it("allows explicit no-attribution policy statements that use a no-follower noun phrase", () => {
    expect(validateManifestFollowerAttributionBoundary({
      uncertainty: "Evidence is incomplete, and no follower movement is attributed to individual posts or families.",
    })).toEqual({ ok: true });
  });

  it("continues to reject positive scoped follower attribution claims", () => {
    const result = validateManifestFollowerAttributionBoundary({
      conclusion: "This post generated 25 followers.",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("follower_attribution_forbidden");
  });
});


