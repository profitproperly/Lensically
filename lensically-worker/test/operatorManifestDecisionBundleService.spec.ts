import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildManifestDecisionBundle,
  consumeManifestDecisionBundle,
  getManifestDecisionBundleConsumptionState,
  MANIFEST_DECISION_BUNDLE_CONTRACT_VERSION,
} from "../src/operatorManifestDecisionBundleService";

const brandKey = "manifest_decision_bundle_test";

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM operator_manifest_decision_bundles WHERE brand_key = ?").bind(brandKey),
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
});
