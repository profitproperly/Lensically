import { describe, expect, it, vi } from "vitest";
import {
  auditOperatorPublishedPostLineage,
  type OperatorPublishedPostLineageAuditDependencies,
} from "../src/operatorPublishedPostLineageAuditService";

type JsonRecord = Record<string, unknown>;

function createDependencies(
  rows: JsonRecord[] = [],
): OperatorPublishedPostLineageAuditDependencies {
  return {
    listRows: vi.fn(async () => rows),
  };
}

function completeRow(overrides: JsonRecord = {}): JsonRecord {
  return {
    post_id: "post-1",
    post_text: "A proven post",
    post_timestamp: "2026-07-20T12:00:00.000Z",
    post_permalink: "https://www.threads.net/@manifest/post/post-1",
    views: "5000",
    likes: "1500",
    replies: "30",
    reposts: "20",
    quotes: "10",
    shares: "40",
    engagement_total: "1600",
    last_synced_at: "2026-07-21T12:00:00.000Z",
    scheduled_post_id: "91",
    draft_id: "draft-1",
    generation_run_id: "run-1",
    source_card_id: "card-1",
    source_selection_id: "selection-1",
    source_batch_id: "batch-1",
    source_identity_key: "saved-pattern:42",
    source_type: "saved_pattern",
    internal_source_id: "42",
    metric_snapshot_count: "4",
    linked_metric_snapshot_count: "4",
    ...overrides,
  };
}

describe("auditOperatorPublishedPostLineage", () => {
  it("applies exact defaults and bounded criteria before row retrieval", async () => {
    const defaults = createDependencies();
    const defaultResult = await auditOperatorPublishedPostLineage({
      brandKey: "manifest_mental",
      payload: {},
    }, defaults);

    expect(defaults.listRows).toHaveBeenCalledWith({
      minimumLikes: 1000,
      days: 30,
      limit: 25,
    });
    expect(defaultResult.criteria).toEqual({
      minimum_likes: 1000,
      days: 30,
      limit: 25,
    });

    const bounded = createDependencies();
    const boundedResult = await auditOperatorPublishedPostLineage({
      brandKey: "manifest_mental",
      payload: { minimum_likes: -8, days: 900, limit: 0 },
    }, bounded);

    expect(bounded.listRows).toHaveBeenCalledWith({
      minimumLikes: 1,
      days: 90,
      limit: 1,
    });
    expect(boundedResult.criteria).toEqual({
      minimum_likes: 1,
      days: 90,
      limit: 1,
    });
  });

  it("serializes complete lineage with stable metrics and numeric identifiers", async () => {
    const dependencies = createDependencies([completeRow()]);

    const result = await auditOperatorPublishedPostLineage({
      brandKey: "manifest_mental",
      payload: { minimum_likes: 1200, days: 14, limit: 7 },
    }, dependencies);

    expect(result).toEqual({
      success: true,
      brand_key: "manifest_mental",
      criteria: { minimum_likes: 1200, days: 14, limit: 7 },
      audited_count: 1,
      complete_count: 1,
      incomplete_count: 0,
      posts: [{
        published_post_id: "post-1",
        post_text: "A proven post",
        posted_at: "2026-07-20T12:00:00.000Z",
        post_permalink: "https://www.threads.net/@manifest/post/post-1",
        metrics: {
          views: 5000,
          likes: 1500,
          replies: 30,
          reposts: 20,
          quotes: 10,
          shares: 40,
          engagement_total: 1600,
          last_synced_at: "2026-07-21T12:00:00.000Z",
        },
        lineage: {
          source_batch_id: "batch-1",
          source_selection_id: "selection-1",
          source_identity_key: "saved-pattern:42",
          source_type: "saved_pattern",
          saved_pattern_id: 42,
          source_card_id: "card-1",
          generation_run_id: "run-1",
          draft_id: "draft-1",
          scheduled_post_id: 91,
          published_post_id: "post-1",
          metric_snapshot_count: 4,
          linked_metric_snapshot_count: 4,
        },
        complete: true,
        missing_stages: [],
      }],
    });
  });

  it("classifies every missing lineage stage in deterministic order", async () => {
    const dependencies = createDependencies([completeRow({
      source_selection_id: null,
      source_batch_id: null,
      source_card_id: null,
      generation_run_id: null,
      draft_id: null,
      scheduled_post_id: null,
      linked_metric_snapshot_count: 0,
    })]);

    const result = await auditOperatorPublishedPostLineage({
      brandKey: "manifest_mental",
      payload: {},
    }, dependencies);
    const posts = result.posts as JsonRecord[];

    expect(posts[0]).toMatchObject({
      complete: false,
      missing_stages: [
        "source",
        "source_card",
        "generation_run",
        "draft",
        "scheduled_post",
        "metrics",
      ],
      lineage: {
        source_batch_id: null,
        source_selection_id: null,
        source_card_id: null,
        generation_run_id: null,
        draft_id: null,
        scheduled_post_id: null,
        linked_metric_snapshot_count: 0,
      },
    });
    expect(result.complete_count).toBe(0);
    expect(result.incomplete_count).toBe(1);
  });

  it("counts mixed results and omits saved-pattern identity for other source types", async () => {
    const dependencies = createDependencies([
      completeRow(),
      completeRow({
        post_id: "post-2",
        source_type: "archive_winner",
        internal_source_id: "99",
        linked_metric_snapshot_count: 0,
      }),
    ]);

    const result = await auditOperatorPublishedPostLineage({
      brandKey: "opmg_deadman",
      payload: {},
    }, dependencies);
    const posts = result.posts as Array<JsonRecord & { lineage: JsonRecord }>;

    expect(result).toMatchObject({
      brand_key: "opmg_deadman",
      audited_count: 2,
      complete_count: 1,
      incomplete_count: 1,
    });
    expect(posts[1].lineage.saved_pattern_id).toBeNull();
    expect(posts[1].missing_stages).toEqual(["metrics"]);
  });
});
