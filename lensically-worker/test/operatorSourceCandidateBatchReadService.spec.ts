import { describe, expect, it, vi } from "vitest";
import {
  readOperatorSourceCandidateBatch,
  type OperatorSourceCandidateBatchReadDependencies,
} from "../src/operatorSourceCandidateBatchReadService";

type JsonRecord = Record<string, unknown>;

function createDependencies(
  overrides: Partial<OperatorSourceCandidateBatchReadDependencies> = {},
): OperatorSourceCandidateBatchReadDependencies {
  return {
    normalizeText: (value) => {
      const text = String(value ?? "").trim();
      return text || null;
    },
    loadBatch: vi.fn(async () => null),
    listSelections: vi.fn(async () => []),
    parseJson: (value) => JSON.parse(value),
    ...overrides,
  };
}

describe("readOperatorSourceCandidateBatch", () => {
  it("rejects a missing batch ID before any repository read", async () => {
    const dependencies = createDependencies();

    const result = await readOperatorSourceCandidateBatch({}, dependencies);

    expect(result).toEqual({
      status: 400,
      body: { success: false, error: "source_batch_id is required" },
    });
    expect(dependencies.loadBatch).not.toHaveBeenCalled();
    expect(dependencies.listSelections).not.toHaveBeenCalled();
  });

  it("returns exact not-found behavior without reading selections", async () => {
    const dependencies = createDependencies();

    const result = await readOperatorSourceCandidateBatch({
      source_batch_id: " batch-404 ",
    }, dependencies);

    expect(dependencies.loadBatch).toHaveBeenCalledWith("batch-404");
    expect(dependencies.listSelections).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 404,
      body: { success: false, error: "source_batch_not_found" },
    });
  });

  it("parses batch and selection snapshots and serializes complete canonical state", async () => {
    const dependencies = createDependencies({
      loadBatch: vi.fn(async () => ({
        id: "batch-1",
        brand_key: "manifest_mental",
        production_date: "2026-07-29",
        metadata_json: '{"timezone":"America/New_York","batch_size":24}',
      })),
      listSelections: vi.fn(async () => [{
        id: "selection-1",
        batch_id: "batch-1",
        draw_order: "3",
        source_identity_key: "threads:post-1",
        source_type: "saved_pattern",
        internal_source_id: "91",
        threads_post_id: "post-1",
        canonical_source_url: "https://threads.net/t/post-1",
        post_text: "Source text",
        original_posted_at: "2026-07-01T10:00:00.000Z",
        metrics_snapshot_json: '{"likes":1500,"views":9000}',
        source_snapshot_json: '{"capture_confidence":"verified"}',
        source_card_id: "card-1",
        canonical_family_id: "family-1",
        canonical_source_card_id: "card-current",
        canonical_source_card_version: "4",
        canonical_source_card_status: "locked",
        disposition: "claimed",
        disposition_reason: "daily_batch",
        disposition_at: "2026-07-29T08:00:00.000Z",
        workflow_sequence: "12",
                selected_at: "2026-07-29T07:59:00.000Z",
      }]),
    });

    const result = await readOperatorSourceCandidateBatch({
      source_batch_id: "batch-1",
    }, dependencies);

    expect(dependencies.listSelections).toHaveBeenCalledWith("batch-1");
    expect(result).toEqual({
      status: 200,
      body: {
        source_batch: {
          id: "batch-1",
          brand_key: "manifest_mental",
          production_date: "2026-07-29",
          metadata_json: '{"timezone":"America/New_York","batch_size":24}',
          metadata: { timezone: "America/New_York", batch_size: 24 },
        },
        selections: [{
          source_selection_id: "selection-1",
          source_batch_id: "batch-1",
          draw_order: 3,
          source_identity_key: "threads:post-1",
          source_type: "saved_pattern",
          internal_source_id: "91",
          threads_post_id: "post-1",
          canonical_source_url: "https://threads.net/t/post-1",
          post_text: "Source text",
          original_posted_at: "2026-07-01T10:00:00.000Z",
          metrics_snapshot: { likes: 1500, views: 9000 },
          source_snapshot: { capture_confidence: "verified" },
          source_card_id: "card-1",
          canonical_family_id: "family-1",
          canonical_source_card_id: "card-current",
          canonical_source_card_version: 4,
          canonical_source_card_status: "locked",
          disposition: "claimed",
          disposition_reason: "daily_batch",
          disposition_at: "2026-07-29T08:00:00.000Z",
          workflow_sequence: 12,
          selected_at: "2026-07-29T07:59:00.000Z",
        }],
      },
    });
  });

  it("applies empty-object, pending, and null defaults deterministically", async () => {
    const parseJson = vi.fn((value: string) => value === "bad-json" ? null : JSON.parse(value));
    const dependencies = createDependencies({
      loadBatch: vi.fn(async () => ({
        id: "batch-2",
        metadata_json: "bad-json",
      })),
      listSelections: vi.fn(async () => [{
        id: "selection-2",
        batch_id: "batch-2",
        draw_order: null,
        metrics_snapshot_json: "bad-json",
        source_snapshot_json: undefined,
        threads_post_id: undefined,
        canonical_source_url: undefined,
        original_posted_at: undefined,
        source_card_id: undefined,
        canonical_family_id: undefined,
        canonical_source_card_id: undefined,
        canonical_source_card_version: null,
        canonical_source_card_status: undefined,
        disposition: undefined,
        disposition_reason: undefined,
        disposition_at: undefined,
        workflow_sequence: undefined,
        selected_at: "2026-07-29T09:00:00.000Z",
      }])),
      parseJson,
    });

    const result = await readOperatorSourceCandidateBatch({
      source_batch_id: "batch-2",
    }, dependencies);
    const selections = result.body.selections as JsonRecord[];

    expect((result.body.source_batch as JsonRecord).metadata).toEqual({});
    expect(selections[0]).toMatchObject({
      draw_order: 0,
      threads_post_id: null,
      canonical_source_url: null,
      original_posted_at: null,
      metrics_snapshot: {},
      source_snapshot: {},
      source_card_id: null,
      canonical_family_id: null,
      canonical_source_card_id: null,
      canonical_source_card_version: null,
      canonical_source_card_status: null,
      disposition: "pending",
      disposition_reason: null,
      disposition_at: null,
      workflow_sequence: null,
    });
  });
});
