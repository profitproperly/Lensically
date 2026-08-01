import { describe, expect, it } from "vitest";
import {
  OPERATOR_MCP_AUTONOMOUS_EXECUTION_TOOL_NAMES,
  OPERATOR_MCP_AUTONOMOUS_EXECUTION_TOOLS,
} from "../src/operatorMcpAutonomousExecutionRegistry";

function tool(name: string) {
  const definition = OPERATOR_MCP_AUTONOMOUS_EXECUTION_TOOLS.find((candidate) => candidate.name === name);
  expect(definition).toBeDefined();
  return definition!;
}

describe("Operator MCP autonomous execution registry", () => {
    it("preserves the exact ordered four-tool autonomous execution registry", () => {
    expect(OPERATOR_MCP_AUTONOMOUS_EXECUTION_TOOL_NAMES).toEqual([
      "prepare_manifest_autonomous_cycle",
      "persist_manifest_autonomous_post",
      "persist_manifest_autonomous_batch",
      "review_manifest_scheduled_post",
    ]);
    expect(OPERATOR_MCP_AUTONOMOUS_EXECUTION_TOOLS.map((definition) => definition.name)).toEqual(OPERATOR_MCP_AUTONOMOUS_EXECUTION_TOOL_NAMES);
    expect(new Set(OPERATOR_MCP_AUTONOMOUS_EXECUTION_TOOL_NAMES).size).toBe(4);
  });

  it("preserves immediate prepare invocation and rolling runway bounds", () => {
    const prepare = tool("prepare_manifest_autonomous_cycle");
    expect(prepare.description).toContain("call this tool immediately after it is available");
    expect(prepare.description).toContain("Threads and database clock evidence");
        expect(prepare.description).toContain("eight source-backed candidates persisted through two persist_manifest_autonomous_batch calls");
    expect(prepare.description).toContain("each batch reconciles authoritative coverage once");
    expect(prepare.inputSchema.required).toEqual(["brand_key"]);
    expect((prepare.inputSchema.properties as Record<string, any>).horizon_hours).toMatchObject({
            minimum: 1,
      maximum: 48,
      default: 48,
    });
  });

  it("preserves one-post source lineage, hypothesis, and idempotency contracts", () => {
    const persist = tool("persist_manifest_autonomous_post");
    expect(persist.description).toContain("Persist exactly one source-card-backed Manifest post");
    expect(persist.description).toContain("Original model posts are forbidden");
    expect(persist.description).toContain("idempotency");
    expect(persist.inputSchema.required).toEqual([
      "brand_key",
      "cycle_id",
      "cycle_strategy_id",
      "cycle_plan_item_id",
      "post",
      "model_evaluation",
      "operation_id",
    ]);

    const post = (persist.inputSchema.properties as Record<string, any>).post;
    expect(post.required).toEqual([
      "date",
      "time",
      "text",
      "generation_mode",
      "family_key",
      "source_mechanism",
      "audience_reward",
      "strategic_purpose",
      "source_context",
      "hypothesis",
    ]);
        expect(post.properties.source_context.required).toEqual(["kind", "source_card_id"]);
    expect(post.properties.preserved_functions.description).toContain("exact must_preserve_function requirement statements");
    expect(post.properties.preserved_functions.description).toContain("Semantic paraphrases do not satisfy");
    expect(post.properties.hypothesis.description).toContain("Follower attribution is forbidden");
    expect(post.properties.hypothesis.properties.experiment.properties.maturity_windows.items.enum).toEqual([6, 12, 18, 24]);
  });

    it("preserves model judgment while deterministic gate evidence remains optional", () => {
    const persist = tool("persist_manifest_autonomous_post");
    const evaluation = (persist.inputSchema.properties as Record<string, any>).model_evaluation;
    expect(evaluation.required).toEqual([
      "generation_passed",
      "scheduling_passed",
      "novelty_assessment",
      "winner_preservation_assessment",
      "slot_placement_assessment",
            "recent_exposure_assessment",
    ]);
    expect(evaluation.properties.candidate_trace).toMatchObject({ type: "array", maxItems: 12 });
    expect(evaluation.properties.gate_summary.properties.results).toMatchObject({ type: "array", maxItems: 32 });
    expect(evaluation.properties.gate_summary.properties.results.items.required).toEqual(["executed", "status"]);
  });

        it("preserves a closed one-to-two Main batch schema by reusing the exact candidate contracts", () => {
    const single = tool("persist_manifest_autonomous_post");
    const batch = tool("persist_manifest_autonomous_batch");
    expect(batch.inputSchema.required).toEqual([
      "brand_key",
      "cycle_id",
      "cycle_strategy_id",
      "batch_operation_id",
      "candidates",
    ]);
    const batchProperties = batch.inputSchema.properties as Record<string, any>;
        expect(batchProperties.candidates).toMatchObject({ type: "array", minItems: 1, maxItems: 2 });
    const candidate = batchProperties.candidates.items;
    expect(candidate.required).toEqual([
      "operation_id",
      "cycle_plan_item_id",
      "post",
      "model_evaluation",
    ]);
    expect(candidate.additionalProperties).toBe(false);
    const singleProperties = single.inputSchema.properties as Record<string, any>;
    expect(candidate.properties.post).toBe(singleProperties.post);
    expect(candidate.properties.model_evaluation).toBe(singleProperties.model_evaluation);
    expect(batch.description).toContain("failed item does not roll back or hide successful siblings");
    expect(batch.description).toContain("exactly once after all accepted items");
  });

  it("preserves optional owner review and slot-preserving replacement", () => {
    const review = tool("review_manifest_scheduled_post");
    expect(review.description).toContain("optional owner criticism");
    expect(review.description).toContain("updates the same scheduled slot so runway coverage is preserved");
    expect(review.inputSchema.required).toEqual([
      "brand_key",
      "scheduled_post_id",
      "action",
      "feedback",
      "lesson_scope",
    ]);
    const properties = review.inputSchema.properties as Record<string, any>;
    expect(properties.action.enum).toEqual(["keep", "rewrite", "reject_replace"]);
    expect(properties.lesson_scope.enum).toEqual([
      "post_specific",
      "temporary_repetition",
      "family_strategy",
      "performance_hypothesis",
      "permanent_rule",
      "experiment",
    ]);
  });
});
