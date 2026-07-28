import { describe, expect, it, vi } from "vitest";
import {
  admitOperatorSourceCardCreation,
  type OperatorSourceCardAdmissionDependencies,
  type OperatorSourceCardAdmissionInput,
} from "../src/operatorSourceCardAdmissionService";

type JsonRecord = Record<string, unknown>;

function createInput(overrides: Partial<OperatorSourceCardAdmissionInput> = {}): OperatorSourceCardAdmissionInput {
  return {
    brandKey: "manifest_mental",
    payload: {},
    sourceCardId: "new-card-id",
    defaultSequenceTimestamp: 123456,
    selectedAt: "2026-07-29T09:00:00.000Z",
    ...overrides,
  };
}

function createDependencies(
  overrides: Partial<OperatorSourceCardAdmissionDependencies> = {},
): OperatorSourceCardAdmissionDependencies {
  return {
    manifestBrandKey: "manifest_mental",
    normalizeText: (value) => {
      const text = String(value ?? "").trim();
      return text || null;
    },
    getWorkflowConflict: vi.fn(() => null),
    normalizeTransformationContract: vi.fn(() => ({ normalized: true })),
    canonicalizeSourceUrl: vi.fn((value) => value),
    extractPostIdFromUrl: vi.fn(() => null),
    parseJson: vi.fn((value) => JSON.parse(value)),
    runBackfillBridge: vi.fn(async () => ({})),
    loadSavedPattern: vi.fn(async () => null),
    persistSavedPatternSelection: vi.fn(async () => undefined),
    loadSelection: vi.fn(async () => null),
    loadSourceCard: vi.fn(async () => null),
    validateSourceCard: vi.fn(() => ({ can_lock: true })),
    ...overrides,
  };
}

describe("admitOperatorSourceCardCreation", () => {
  it("routes the Manifest backfill compatibility bridge with exact status and identity", async () => {
    const dependencies = createDependencies({
      runBackfillBridge: vi.fn(async () => ({
        http_status: 207,
        created_count: 4,
      })),
    });

    const result = await admitOperatorSourceCardCreation(createInput({
      payload: {
        sequence_label: "all_missing_manifest_source_cards",
        operation_id: " bridge-op ",
      },
    }), dependencies);

    expect(dependencies.runBackfillBridge).toHaveBeenCalledWith("bridge-op-batch");
    expect(result).toEqual({
      kind: "response",
      status: 207,
      body: {
        http_status: 207,
        created_count: 4,
        compatibility_bridge: "create_source_card.sequence_label",
      },
    });
  });

  it("returns the exact saved-workflow conflict before any source read", async () => {
    const dependencies = createDependencies({
      getWorkflowConflict: vi.fn(() => "guided_batch_not_supported"),
    });

    const result = await admitOperatorSourceCardCreation(createInput(), dependencies);

    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "lensically_saved_workflow_required",
        reason: "guided_batch_not_supported",
        required_workflow: "Use the selected account's saved workflow before creating source cards. Do not create batch or multi-post source cards unless a backend-supported override exists for that account.",
      },
    });
    expect(dependencies.loadSavedPattern).not.toHaveBeenCalled();
    expect(dependencies.loadSelection).not.toHaveBeenCalled();
  });

  it("requires a primary source for non-Manifest accounts", async () => {
    const dependencies = createDependencies();

    const result = await admitOperatorSourceCardCreation(createInput({
      brandKey: "vectrix",
      payload: { primary_source: [] },
    }), dependencies);

    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: { success: false, error: "primary_source is required" },
    });
  });

  it("requires a Manifest selection or positive Saved Pattern ID", async () => {
    const dependencies = createDependencies();

    const result = await admitOperatorSourceCardCreation(createInput(), dependencies);

    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: { success: false, error: "manifest_source_selection_id_or_saved_pattern_id_required" },
    });
    expect(dependencies.loadSelection).not.toHaveBeenCalled();
  });

  it("returns exact Saved Pattern not-found behavior before persistence", async () => {
    const dependencies = createDependencies();

    const result = await admitOperatorSourceCardCreation(createInput({
      payload: { saved_pattern_id: 91 },
    }), dependencies);

    expect(dependencies.loadSavedPattern).toHaveBeenCalledWith(91);
    expect(dependencies.persistSavedPatternSelection).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "response",
      status: 404,
      body: { success: false, error: "saved_pattern_not_found", saved_pattern_id: 91 },
    });
  });

  it("builds deterministic Saved Pattern selection evidence and hydrates continuation state", async () => {
    const selection: JsonRecord = {
      id: "manifest-source-card-selection-91",
      batch_id: "manifest-source-card-backfill-91",
      workflow_session_id: "manifest_mental-source-card-backfill-session",
      draw_order: "1",
      source_identity_key: "threads:post-91",
      threads_post_id: "post-91",
      canonical_source_url: "https://www.threads.net/@author/post/post-91",
      source_snapshot_json: '{"capture_confidence":"verified"}',
      metrics_snapshot_json: '{"likes":1500}',
    };
    const dependencies = createDependencies({
      canonicalizeSourceUrl: vi.fn(() => "https://www.threads.net/@author/post/post-91"),
      extractPostIdFromUrl: vi.fn(() => "post-91"),
      loadSavedPattern: vi.fn(async () => ({
        id: 91,
        post_id: null,
        post_text: "Source text",
        views: "9000",
        likes: "1500",
        replies: "20",
        reposts: "30",
        shares: "10",
        source_url: "https://threads.net/t/post-91",
        posted_at: "2026-07-01T10:00:00.000Z",
        capture_confidence: "verified",
        updated_at: "2026-07-28T10:00:00.000Z",
      })),
      loadSelection: vi.fn(async () => selection),
    });

    const result = await admitOperatorSourceCardCreation(createInput({
      payload: {
        saved_pattern_id: 91,
        source_mechanism: "mechanism",
        required_product: "product",
        transformation_contract: { raw: true },
      },
    }), dependencies);

    expect(dependencies.persistSavedPatternSelection).toHaveBeenCalledWith(expect.objectContaining({
      brandKey: "manifest_mental",
      savedPatternId: 91,
      backfillSessionId: "manifest_mental-source-card-backfill-session",
      batchId: "manifest-source-card-backfill-91",
      selectionId: "manifest-source-card-selection-91",
      selectedAt: "2026-07-29T09:00:00.000Z",
      sourceIdentityKey: "threads:post-91",
      threadsPostId: "post-91",
      canonicalSourceUrl: "https://www.threads.net/@author/post/post-91",
      metrics: {
        views: 9000,
        likes: 1500,
        replies: 20,
        reposts: 30,
        quotes: 0,
        shares: 10,
        engagement_total: 1560,
        captured_at: "2026-07-29T09:00:00.000Z",
      },
      sourceSnapshot: expect.objectContaining({
        source_candidate_id: "saved_pattern:91",
        source_identity_key: "threads:post-91",
        source_type: "saved_pattern",
        source_id: 91,
        internal_source_id: "91",
        threads_post_id: "post-91",
        canonical_source_url: "https://www.threads.net/@author/post/post-91",
        text: "Source text",
        evidence_role: "market_evidence",
      }),
    }));
    expect(result.kind).toBe("continue");
    if (result.kind !== "continue") throw new Error("expected continuation");
    expect(result.context).toMatchObject({
      sourceCardId: "new-card-id",
      sourceMechanism: "mechanism",
      requiredProduct: "product",
      workflowSessionId: "manifest_mental-source-card-backfill-session",
      sequenceLabel: "daily_draw_manifest-source-card-backfill-91_slot_1",
      sourceSelectionId: "manifest-source-card-selection-91",
      savedPatternId: 91,
      versionReason: null,
      createNewVersion: false,
      transformationContract: { normalized: true },
      selection,
      metricsSnapshot: { likes: 1500 },
    });
    expect(result.context.primarySource).toMatchObject({
      capture_confidence: "verified",
      source_selection_id: "manifest-source-card-selection-91",
      source_batch_id: "manifest-source-card-backfill-91",
      draw_order: 1,
      source_identity_key: "threads:post-91",
      threads_post_id: "post-91",
      canonical_source_url: "https://www.threads.net/@author/post/post-91",
    });
  });

  it("reuses an already resolved selection with exact linked-card response", async () => {
    const validation = { can_lock: true, warnings: [] };
    const dependencies = createDependencies({
      loadSelection: vi.fn(async () => ({
        id: "selection-1",
        source_card_id: "card-1",
      })),
      loadSourceCard: vi.fn(async () => ({
        id: "card-1",
        family_id: "family-1",
        version_number: 4,
        status: "locked",
      })),
      validateSourceCard: vi.fn(() => validation),
    });

    const result = await admitOperatorSourceCardCreation(createInput({
      payload: { source_selection_id: "selection-1" },
    }), dependencies);

    expect(result).toEqual({
      kind: "response",
      status: 200,
      body: {
        source_card_id: "card-1",
        source_selection_id: "selection-1",
        family_id: "family-1",
        version_number: 4,
        status: "locked",
        reused_existing: true,
        reason: "selection_already_resolved",
        validation,
      },
    });
  });

  it("rejects a source-selection workflow mismatch before hydration", async () => {
    const dependencies = createDependencies({
      loadSelection: vi.fn(async () => ({
        id: "selection-1",
        workflow_session_id: "session-b",
      })),
    });

    const result = await admitOperatorSourceCardCreation(createInput({
      payload: {
        source_selection_id: "selection-1",
        workflow_session_id: "session-a",
      },
    }), dependencies);

    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: { success: false, error: "source_selection_workflow_mismatch" },
    });
    expect(dependencies.parseJson).not.toHaveBeenCalled();
  });

  it("hydrates an explicit selection and preserves versioning inputs deterministically", async () => {
    const dependencies = createDependencies({
      loadSelection: vi.fn(async () => ({
        id: "selection-2",
        batch_id: "batch-2",
        workflow_session_id: "session-2",
        draw_order: 7,
        source_identity_key: "url:https://example.com/post",
        threads_post_id: null,
        canonical_source_url: "https://example.com/post",
        source_snapshot_json: '{"text":"Snapshot text"}',
        metrics_snapshot_json: '{"likes":1200}',
      })),
    });

    const result = await admitOperatorSourceCardCreation(createInput({
      payload: {
        source_selection_id: " selection-2 ",
        sequence_label: " explicit-sequence ",
        version_reason: " corrected interpretation ",
        create_new_version: true,
        primary_source: { ignored: true },
      },
    }), dependencies);

    expect(result.kind).toBe("continue");
    if (result.kind !== "continue") throw new Error("expected continuation");
    expect(result.context).toMatchObject({
      workflowSessionId: "session-2",
      sequenceLabel: "explicit-sequence",
      sourceSelectionId: "selection-2",
      savedPatternId: null,
      versionReason: "corrected interpretation",
      createNewVersion: true,
      metricsSnapshot: { likes: 1200 },
    });
    expect(result.context.primarySource).toEqual({
      text: "Snapshot text",
      source_selection_id: "selection-2",
      source_batch_id: "batch-2",
      draw_order: 7,
      source_identity_key: "url:https://example.com/post",
      threads_post_id: null,
      canonical_source_url: "https://example.com/post",
    });
  });
});
