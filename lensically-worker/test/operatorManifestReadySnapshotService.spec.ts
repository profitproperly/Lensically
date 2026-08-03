import { describe, expect, it } from "vitest";
import {
  MANIFEST_READY_SNAPSHOT_VERSION,
  assessManifestReadySnapshot,
  type ManifestReadySnapshotWatermarks,
} from "../src/operatorManifestReadySnapshotService";

const watermarks: ManifestReadySnapshotWatermarks = {
  learning_brief_id: "brief-1",
  learning_generated_at: "2026-08-03T12:00:00.000Z",
  qualified_pattern_count: 240,
  qualified_pattern_updated_at: "2026-08-03T11:30:00.000Z",
  derived_pattern_count: 240,
  derived_pattern_updated_at: "2026-08-03T11:31:00.000Z",
  owner_revision_updated_at: "2026-08-03T10:00:00.000Z",
};

function stored(overrides: Record<string, unknown> = {}) {
  return {
    id: "manifest-ready:manifest_mental",
    snapshot_version: MANIFEST_READY_SNAPSHOT_VERSION,
    learning_brief_id: "brief-1",
    generated_at: "2026-08-03T12:00:00.000Z",
    watermark_json: JSON.stringify(watermarks),
    payload_json: JSON.stringify({ manifest_layers_finalized: true }),
    ...overrides,
  };
}

describe("Manifest ready snapshot assessment", () => {
  it("reuses only a finalized snapshot with identical watermarks", () => {
    const result = assessManifestReadySnapshot({
      stored: stored(),
      currentWatermarks: watermarks,
      nowMs: Date.parse("2026-08-03T13:00:00.000Z"),
    });
    expect(result).toMatchObject({
      reusable: true,
      reason: "ready",
      snapshot_id: "manifest-ready:manifest_mental",
      learning_brief_id: "brief-1",
    });
  });

  it("invalidates when Saved Pattern or owner-edit evidence changes", () => {
    const result = assessManifestReadySnapshot({
      stored: stored(),
      currentWatermarks: {
        ...watermarks,
        qualified_pattern_count: 241,
        owner_revision_updated_at: "2026-08-03T12:30:00.000Z",
      },
      nowMs: Date.parse("2026-08-03T13:00:00.000Z"),
    });
    expect(result).toMatchObject({ reusable: false, reason: "watermark_changed" });
  });

  it("invalidates an expired snapshot even when evidence is unchanged", () => {
    const result = assessManifestReadySnapshot({
      stored: stored({ generated_at: "2026-08-03T01:00:00.000Z" }),
      currentWatermarks: watermarks,
      nowMs: Date.parse("2026-08-03T13:00:00.000Z"),
    });
    expect(result).toMatchObject({ reusable: false, reason: "snapshot_expired" });
  });
});
