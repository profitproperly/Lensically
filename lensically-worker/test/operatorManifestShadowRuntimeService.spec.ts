import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAutomaticShadowCandidate,
  handleOperatorManifestShadowTool,
  type ManifestShadowEvidence,
  type ManifestShadowRuntimeState,
} from "../src/operatorManifestShadowRuntimeService";
import { buildManifestShadowScenarioSlots } from "../src/operatorManifestShadowEvidenceService";
import { selectSourceFamilyLineup, type SourceSelectionCandidate } from "../src/sourceFamilySelection";

type JsonRecord = Record<string, unknown>;

const identity = {
  brandKey: "manifest_mental",
  accountId: "shadow-test-user",
  threadsUserId: "shadow-test-threads",
};

function candidates(count: number): SourceSelectionCandidate[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    source_candidate_id: `candidate-${index}`,
    source_identity_key: `identity-${index}`,
    source_card_family_id: `family-${index}`,
    source_card_id: `card-${index}`,
    source_type: "source_card",
    internal_source_id: `card-${index}`,
    source_mechanism: "direct_reader_wealth_utility",
    required_product: "concrete outcome",
    recommended_direction: "Preserve the source hook and payoff.",
    text: `The Universe is preparing a distinct financial breakthrough for the person reading this source ${index + 1}.`,
    metrics: { likes: 1000 + index },
    primary_source: { post_text: `Source ${index + 1}` },
    lifetime_label: index < 4 ? "proven" : "promising",
    recent_label: "stable",
    confidence_label: "high",
    lifetime_sample_size: 3 + index,
    recent_sample_size: 2,
    lifetime_index: 1.2 + index / 100,
    recent_index: 1.05,
    uses_24h: 0,
    uses_7d: 0,
    uses_28d: 0,
    hours_since_last_use: 100 + index,
    semantic_key: `mechanism-${index}`,
  }));
}

function evidence(): ManifestShadowEvidence {
  return {
    captured_at: "2026-07-30T18:30:00.000Z",
    strategy: { id: "strategy-live", directives: ["preserve winners"] },
    learning_brief: { brief_key: "brief-live", primary_metric: "24_hour_likes" },
    content_focus: { emphasize: ["concrete wealth utility"] },
    hard_bans: [{ rule_key: "ban-1", phrase: "I bet having" }],
    strongest_posts: [{ post_id: "winner-1", likes: 1993 }],
    weakest_posts: [{ post_id: "weak-1", likes: 0 }],
    recent_published: [],
    future_scheduled: [],
    evidence_gaps: [],
    production_fingerprint: { stable: { row_count: 1, latest_change: "2026-07-30T18:00:00Z" } },
    freshness: { stale: false, bounded_delta_refresh_required: false },
  };
}

function dependencies(now = new Date("2026-07-30T18:30:00.000Z")) {
  return {
    productionDb: env.DB,
    shadowDb: env.DB,
    codeSha: "a".repeat(40),
    now: () => new Date(now.getTime()),
    buildSlots: async (input: { timezone: string; horizonHours: number; scenario: string; requestedMissingCount: number }) =>
      buildManifestShadowScenarioSlots({ now, ...input }),
    loadSourceCandidates: async (_db: D1Database, _brandKey: string, _asOf: string) => candidates(72),
    selectSourceLineup: (input: { candidates: SourceSelectionCandidate[]; slot_keys: string[]; seed: string }) =>
      selectSourceFamilyLineup(input),
    readEvidence: async () => evidence(),
  };
}

function strategyPayload(prepared: JsonRecord): JsonRecord {
  const bundle = prepared.decision_bundle as JsonRecord;
  const locked = bundle.locked_source_lineup as JsonRecord[];
  return {
    brand_key: "manifest_mental",
    shadow_run_id: prepared.shadow_run_id,
    decision_bundle_id: prepared.decision_bundle_id,
    account_conclusion: { conclusion: "Preserve proven wealth utility while testing the locked broader portfolio." },
    content_focus: { emphasize: ["concrete outcomes"], reduce: ["generic filler"] },
    benchmarks: { primary_metric: "24_hour_likes", winner_post_id: "winner-1" },
    strongest_executions: [{ published_post_id: "winner-1", reason: "highest mature likes" }],
    weakest_executions: [{ published_post_id: "weak-1", reason: "zero mature likes" }],
    directives: { generation: ["preserve source hook and payoff"], source_authority: "locked" },
    experiments: [{ experiment_key: "shadow-portfolio" }],
    risks: ["execution sameness"],
    lineup: locked.map((item) => ({
      slot_key: item.assigned_slot_key,
      source_card_id: item.source_card_id,
      family_key: item.source_card_family_id,
      strategic_role: item.lifetime_label === "proven" ? "franchise" : "prospect",
      generation_mode: item.lifetime_label === "proven" ? "franchise_deployment" : "adjacent_experiment",
      audience_reward: "Concrete reader-directed outcome.",
      hook_direction: "Preserve the source hook function.",
      placement_reason: "Exact locked source-selection order.",
      exploration_mode: item.lifetime_label === "proven" ? "exploit" : "explore",
    })),
  };
}

async function runScenario(scenario: "noop" | "normal_24" | "recovery_48", suffix: string): Promise<{ duration: number; prepared: JsonRecord; receipt: JsonRecord }> {
  const started = Date.now();
  const deps = dependencies();
  const preparedResult = await handleOperatorManifestShadowTool({
    toolName: "prepare_manifest_shadow_cycle",
    payload: {
      scenario,
      evidence_mode: "snapshot",
      variant_key: `control-${suffix}`,
      operation_id: `shadow-test:${scenario}:${suffix}`,
      horizon_hours: 48,
    },
    identity,
  }, deps);
  expect(preparedResult.status).toBe(200);
  expect(preparedResult.body.success).toBe(true);
  const prepared = preparedResult.body;

  if (scenario !== "noop") {
    const committed = await handleOperatorManifestShadowTool({
      toolName: "commit_manifest_shadow_cycle_strategy",
      payload: strategyPayload(prepared),
      identity,
    }, deps);
    expect(committed.body.success).toBe(true);
    const bundle = prepared.decision_bundle as JsonRecord;
    const locked = bundle.locked_source_lineup as JsonRecord[];
    for (let offset = 0; offset < locked.length; offset += 4) {
      const batch = locked.slice(offset, offset + 4).map((item, index) => {
        const slot = String(item.assigned_slot_key);
        return {
          operation_id: `${prepared.shadow_run_id}:${slot}:candidate`,
          slot_key: slot,
          source_card_id: item.source_card_id,
          family_key: item.source_card_family_id,
          text: `The Universe is aligning a distinct breakthrough for the person reading this batch ${offset + index + 1}.`,
          model_evaluation: {
            novelty_assessment: "Distinct opening and bounded wording.",
            winner_preservation_assessment: "Preserves the selected source mechanism.",
            slot_placement_assessment: `Exact locked slot ${slot}.`,
            recent_exposure_assessment: "Compared with the frozen exposure bundle.",
            intelligence_application_assessment: "Applies the strategy and locked source directive.",
          },
        };
      });
      const persisted = await handleOperatorManifestShadowTool({
        toolName: "persist_manifest_shadow_batch",
        payload: {
          shadow_run_id: prepared.shadow_run_id,
          operation_id: `batch-${suffix}-${offset / 4}`,
          candidates: batch,
        },
        identity,
      }, deps);
      expect(persisted.body.success).toBe(true);
      expect(persisted.body.rejected_count).toBe(0);
    }
  }

  const receipt = await handleOperatorManifestShadowTool({
    toolName: "get_manifest_shadow_cycle_receipt",
    payload: { shadow_run_id: prepared.shadow_run_id },
    identity,
  }, deps);
  expect(receipt.body.success).toBe(true);
  return { duration: Date.now() - started, prepared, receipt: receipt.body };
}

beforeEach(async () => {
  await env.DB.prepare(`DELETE FROM manifest_shadow_benchmark_receipts`).run();
  await env.DB.prepare(`DELETE FROM manifest_shadow_diagnostic_archives`).run();
  await env.DB.prepare(`DELETE FROM manifest_shadow_stage_events`).run();
  await env.DB.prepare(`DELETE FROM manifest_shadow_snapshots`).run();
  await env.DB.prepare(`DELETE FROM manifest_shadow_runs`).run();
});

describe("operatorManifestShadowRuntimeService", () => {
  it("completes three no-op cycles below thirty seconds with zero operational mutation", async () => {
    for (let index = 0; index < 3; index += 1) {
      const result = await runScenario("noop", `noop-${index}`);
      expect(result.duration).toBeLessThanOrEqual(30_000);
      const summary = result.receipt.state_summary as JsonRecord;
      expect(summary.completed).toBe(true);
      const benchmark = (result.receipt.receipt as JsonRecord).benchmark as JsonRecord;
      expect(Number(benchmark.passed)).toBe(1);
      expect(Number(benchmark.threads_mutation_count)).toBe(0);
    }
  });

  it("completes three 24-slot cycles below six minutes with complete lineage", async () => {
    for (let index = 0; index < 3; index += 1) {
      const result = await runScenario("normal_24", `normal-${index}`);
      expect(result.duration).toBeLessThanOrEqual(360_000);
      const summary = result.receipt.state_summary as JsonRecord;
      expect(summary.accepted_count).toBe(24);
      expect(summary.remaining_missing_count).toBe(0);
      expect(summary.completed).toBe(true);
    }
  });

  it("completes three 48-slot recovery cycles below ten minutes", async () => {
    for (let index = 0; index < 3; index += 1) {
      const result = await runScenario("recovery_48", `recovery-${index}`);
      expect(result.duration).toBeLessThan(600_000);
      const summary = result.receipt.state_summary as JsonRecord;
      expect(summary.accepted_count).toBe(48);
      expect(summary.remaining_missing_count).toBe(0);
      expect(summary.completed).toBe(true);
    }
  });

  it("rejects one banned candidate without rolling back successful siblings and replays the batch", async () => {
    const deps = dependencies();
    const prepared = await handleOperatorManifestShadowTool({
      toolName: "prepare_manifest_shadow_cycle",
      payload: { scenario: "custom", missing_count: 2, horizon_hours: 2, evidence_mode: "snapshot", variant_key: "rejection", operation_id: "shadow-test:rejection" },
      identity,
    }, deps);
    await handleOperatorManifestShadowTool({ toolName: "commit_manifest_shadow_cycle_strategy", payload: strategyPayload(prepared.body), identity }, deps);
    const locked = ((prepared.body.decision_bundle as JsonRecord).locked_source_lineup as JsonRecord[]);
    const base = (item: JsonRecord, index: number) => ({
      operation_id: `rejection-${index}`,
      slot_key: item.assigned_slot_key,
      source_card_id: item.source_card_id,
      family_key: item.source_card_family_id,
      text: index === 1 ? "I bet having money would remove every problem." : "The Universe is bringing the reader a distinct practical breakthrough.",
      model_evaluation: {
        novelty_assessment: "Distinct.", winner_preservation_assessment: "Preserved.", slot_placement_assessment: "Exact.", recent_exposure_assessment: "Checked.", intelligence_application_assessment: "Applied.",
      },
    });
    const payload = { shadow_run_id: prepared.body.shadow_run_id, operation_id: "mixed-batch", candidates: locked.map(base) };
    const first = await handleOperatorManifestShadowTool({ toolName: "persist_manifest_shadow_batch", payload, identity }, deps);
    expect(first.body.accepted_count).toBe(1);
    expect(first.body.rejected_count).toBe(1);
    expect(first.body.remaining_missing_count).toBe(1);
    const replay = await handleOperatorManifestShadowTool({ toolName: "persist_manifest_shadow_batch", payload, identity }, deps);
    expect(replay.body.reused).toBe(true);
    expect(replay.body.accepted_count).toBe(1);
  });

  it("builds source-faithful automatic benchmark candidates", () => {
    const state = {
      run_id: "run",
      locked_source_lineup: [{ assigned_slot_key: "2026-07-31T10:00", source_card_id: "card", source_card_family_id: "family", text: "Universe, make the person reading this financially free." }],
    } as unknown as ManifestShadowRuntimeState;
    expect(buildAutomaticShadowCandidate(state, "2026-07-31T10:00", 0)).toMatchObject({
      slot_key: "2026-07-31T10:00",
      source_card_id: "card",
      family_key: "family",
    });
  });
});
