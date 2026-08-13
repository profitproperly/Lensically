import { describe, expect, it } from "vitest";
import {
    executeManifestD1WriteBatches,
  resolveManifestMaturityEvaluation,
      persistManifestLearningObservationBatch,
  persistManifestPortfolioStateBatch,
  persistManifestSemanticSignatureBatch,
} from "../src/manifestIntelligenceEngine";

describe("Manifest D1 write batching", () => {
  it("reuses persisted maturity evaluations instead of rebuilding them on later intelligence phases", () => {
    const persisted = {
      version: "manifest-maturity-evaluation-v1",
      checkpoint_hours: 24,
      maturity_state: "authoritative",
      learning_weight: 1,
      structural_change_allowed: true,
      performance_band: "breakout",
      overall_score: 91,
      distribution_state: "healthy",
      metrics: { likes: 100 },
      rates: {},
      velocity: {},
    };

    const resolved = resolveManifestMaturityEvaluation({
      prefer_persisted: true,
      persisted_maturity_json: JSON.stringify(persisted),
      checkpoint_hours: 24,
      scores_json: JSON.stringify({ overall: 1 }),
      distribution_state: "weak",
    });

    expect(resolved).toEqual(persisted);
  });

  it("keeps large intelligence persistence within bounded D1 batch calls", async () => {
    const observedBatchSizes: number[] = [];
    const db = {
      batch: async (statements: D1PreparedStatement[]) => {
        observedBatchSizes.push(statements.length);
        return [];
      },
    } as unknown as Pick<D1Database, "batch">;
    const statements = Array.from({ length: 95 }, (_, index) => ({ index } as unknown as D1PreparedStatement));

    const receipt = await executeManifestD1WriteBatches(db, statements, 40);

    expect(receipt).toEqual({ statement_count: 95, batch_count: 3 });
    expect(observedBatchSizes).toEqual([40, 40, 15]);
  });

    it("does not call D1 for an empty write set", async () => {
    let calls = 0;
    const db = {
      batch: async () => {
        calls += 1;
        return [];
      },
    } as unknown as Pick<D1Database, "batch">;

    await expect(executeManifestD1WriteBatches(db, [])).resolves.toEqual({
      statement_count: 0,
      batch_count: 0,
    });
    expect(calls).toBe(0);
  });

    it("persists semantic signatures through bounded D1 batches instead of sequential runs", async () => {
    const observedBatchSizes: number[] = [];
    const db = {
      prepare: () => ({
        bind: (...values: unknown[]) => ({ values } as unknown as D1PreparedStatement),
      }),
      batch: async (statements: D1PreparedStatement[]) => {
        observedBatchSizes.push(statements.length);
        return [];
      },
    } as unknown as Pick<D1Database, "prepare" | "batch">;
    const inputs = Array.from({ length: 95 }, (_, index) => ({
      brand_key: "manifest_mental",
      content_type: "published" as const,
      content_id: `post-${index}`,
      text: `Post ${index} with a distinct semantic payload`,
      published_post_id: `post-${index}`,
      observed_at: "2026-08-06T20:00:00.000Z",
    }));

    const receipt = await persistManifestSemanticSignatureBatch(db, inputs, 40);

    expect(receipt.statement_count).toBe(95);
    expect(receipt.batch_count).toBe(3);
    expect(receipt.signatures).toHaveLength(95);
    expect(observedBatchSizes).toEqual([40, 40, 15]);
  });

    it("persists portfolio states and transitions through bounded D1 batches", async () => {
    const observedBatchSizes: number[] = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...values: unknown[]) => ({ sql, values } as unknown as D1PreparedStatement),
      }),
      batch: async (statements: D1PreparedStatement[]) => {
        observedBatchSizes.push(statements.length);
        return [];
      },
    } as unknown as Pick<D1Database, "prepare" | "batch">;
    const inputs = [
      { family_key: "unchanged", current_role: "core" as const, role: "core" as const },
      { family_key: "promoted", current_role: "prospect" as const, role: "emerging" as const },
      { family_key: "cooled", current_role: "core" as const, role: "cooling" as const },
    ].map((item) => ({
      brand_key: "manifest_mental",
      recommended_role: item.role,
      confidence_score: 0.8,
      confidence_label: "directional" as const,
      allocation_weight: 1,
      actual_decay: false,
      reason: "test",
      evidence: { sample_size: 5 },
      ...item,
    }));

    const receipt = await persistManifestPortfolioStateBatch(db, inputs, 40);

    expect(receipt.portfolio_count).toBe(3);
    expect(receipt.transition_count).toBe(2);
    expect(receipt.statement_count).toBe(5);
    expect(receipt.batch_count).toBe(1);
    expect(observedBatchSizes).toEqual([5]);
  });

  it("persists learning observations and transitions through bounded D1 batches", async () => {
    const observedBatchSizes: number[] = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...values: unknown[]) => sql.includes("SELECT level, feature_key, confidence_label")
          ? { all: async () => ({ results: [
              { level: "family", feature_key: "existing", confidence_label: "directional" },
            ] }) }
          : ({ sql, values } as unknown as D1PreparedStatement),
      }),
      batch: async (statements: D1PreparedStatement[]) => {
        observedBatchSizes.push(statements.length);
        return [];
      },
    } as unknown as Pick<D1Database, "prepare" | "batch">;
    const inputs = [
      { level: "family", feature_key: "existing", confidence_label: "directional" as const },
      { level: "family", feature_key: "changed", confidence_label: "reliable" as const },
      { level: "hook", feature_key: "new", confidence_label: "emerging" as const },
    ].map((item) => ({
      brand_key: "manifest_mental",
      sample_size: 5,
      supporting_count: 3,
      contradicting_count: 1,
      median_overall: 62,
      effect_size: 8,
      confidence_score: 0.8,
      state: "supporting",
      evidence: { published_post_ids: ["1"] },
      reason: "test",
      ...item,
    }));

    const receipt = await persistManifestLearningObservationBatch(db, inputs, 40);

    expect(receipt.observation_count).toBe(3);
    expect(receipt.transition_count).toBe(2);
    expect(receipt.statement_count).toBe(5);
    expect(receipt.batch_count).toBe(1);
    expect(receipt.results).toEqual([
      { transitioned: false, from_state: "directional", to_state: "directional" },
      { transitioned: true, from_state: null, to_state: "reliable" },
      { transitioned: true, from_state: null, to_state: "emerging" },
    ]);
    expect(observedBatchSizes).toEqual([5]);
  });
});
