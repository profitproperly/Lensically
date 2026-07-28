import { describe, expect, it, vi } from "vitest";
import {
  admitOperatorContext,
  type OperatorContextAdmissionDependencies,
} from "../src/operatorContextAdmissionService";

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function normalizeMachineKey(value: unknown, fallback = "unknown"): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function createHarness() {
  const mocks = {
    insertAdmission: vi.fn(async () => undefined),
  };
  const dependencies: OperatorContextAdmissionDependencies = {
    normalizeText,
    normalizeMachineKey,
    createId: () => "admission-new",
    insertAdmission: mocks.insertAdmission,
  };
  return { mocks, dependencies };
}

describe("operatorContextAdmissionService", () => {
  it("persists an empty complete admission with canonical defaults", async () => {
    const harness = createHarness();

    expect(await admitOperatorContext({
      brandKey: "manifest_mental",
      payload: {},
    }, harness.dependencies)).toEqual({
      context_admission_id: "admission-new",
      coverage: [],
      is_partial: false,
      warnings: [],
    });
    expect(harness.mocks.insertAdmission).toHaveBeenCalledWith({
      admissionId: "admission-new",
      brandKey: "manifest_mental",
      workflowSessionId: null,
      snapshotId: null,
      admissionScope: "source_card_selection",
      sections: [],
      freshnessStartedAt: null,
      freshnessCompletedAt: null,
      isPartial: false,
      notes: null,
    });
  });

  it("normalizes pagination coverage and uses the admission snapshot fallback", async () => {
    const harness = createHarness();

    const result = await admitOperatorContext({
      brandKey: "vectrix",
      payload: {
        snapshot_id: " snapshot-main ",
        sections: [{
          section: "Saved Patterns",
          limit: 20,
          total_count: 20,
          offset: 40,
        }],
      },
    }, harness.dependencies);

    expect(result.coverage).toEqual([{
      section: "saved_patterns",
      returned_count: 20,
      total_count: 20,
      limit: 20,
      offset: 40,
      offsets_read: [40],
      has_more: false,
      coverage_status: "complete",
      source: "existing_db",
      snapshot_id: " snapshot-main ",
    }]);
    expect(harness.mocks.insertAdmission).toHaveBeenCalledWith(expect.objectContaining({
      snapshotId: "snapshot-main",
      sections: result.coverage,
      isPartial: false,
    }));
  });

  it("preserves explicit pagination overrides and section snapshot precedence", async () => {
    const harness = createHarness();

    const result = await admitOperatorContext({
      brandKey: "manifest_mental",
      payload: {
        snapshot_id: "snapshot-parent",
        sections: [{
          section: "archive",
          returned_count: 5,
          total_count: 100,
          limit: 10,
          offset: 30,
          offsets_read: [0, 10, 20, 30],
          has_more: false,
          coverage_status: "complete",
          source: "fresh_api",
          snapshot_id: "snapshot-section",
        }],
      },
    }, harness.dependencies);

    expect(result).toEqual({
      context_admission_id: "admission-new",
      coverage: [{
        section: "archive",
        returned_count: 5,
        total_count: 100,
        limit: 10,
        offset: 30,
        offsets_read: [0, 10, 20, 30],
        has_more: false,
        coverage_status: "complete",
        source: "fresh_api",
        snapshot_id: "snapshot-section",
      }],
      is_partial: false,
      warnings: [],
    });
  });

  it("infers partial coverage from remaining pagination and emits the exact warning", async () => {
    const harness = createHarness();

    const result = await admitOperatorContext({
      brandKey: "manifest_mental",
      payload: {
        sections: [{ section: "metrics", returned_count: 10, total_count: 25 }],
      },
    }, harness.dependencies);

    expect(result.coverage).toEqual([expect.objectContaining({
      has_more: true,
      coverage_status: "partial",
    })]);
    expect(result.is_partial).toBe(true);
    expect(result.warnings).toEqual(["Context admission is partial."]);
    expect(harness.mocks.insertAdmission).toHaveBeenCalledWith(expect.objectContaining({ isPartial: true }));
  });

  it("normalizes admission metadata and honors explicit partial status", async () => {
    const harness = createHarness();

    await admitOperatorContext({
      brandKey: "opmg_deadman",
      payload: {
        workflow_session_id: " session-1 ",
        snapshot_id: " snapshot-1 ",
        admission_scope: "Production Planning",
        freshness_started_at: " 2026-07-27T20:00:00-04:00 ",
        freshness_completed_at: " 2026-07-27T20:05:00-04:00 ",
        notes: " coverage notes ",
        sections: [{
          section: "strategy",
          returned_count: 1,
          total_count: 1,
          has_more: false,
          coverage_status: "partial",
        }],
      },
    }, harness.dependencies);

    expect(harness.mocks.insertAdmission).toHaveBeenCalledWith({
      admissionId: "admission-new",
      brandKey: "opmg_deadman",
      workflowSessionId: "session-1",
      snapshotId: "snapshot-1",
      admissionScope: "production_planning",
      sections: [expect.objectContaining({ coverage_status: "partial", has_more: false })],
      freshnessStartedAt: "2026-07-27T20:00:00-04:00",
      freshnessCompletedAt: "2026-07-27T20:05:00-04:00",
      isPartial: true,
      notes: "coverage notes",
    });
  });
});
