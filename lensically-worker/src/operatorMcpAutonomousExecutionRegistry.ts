import { BRAND_KEY_SCHEMA } from "./operatorMcpSchemas";
import type { OperatorMcpToolDefinition } from "./operatorMcpToolDefinitions";

export const OPERATOR_MCP_AUTONOMOUS_EXECUTION_TOOL_NAMES = [
    "prepare_manifest_autonomous_cycle",
  "persist_manifest_autonomous_post",
  "persist_manifest_autonomous_batch",
  "review_manifest_scheduled_post",
] as const;

export type OperatorMcpAutonomousExecutionToolName = typeof OPERATOR_MCP_AUTONOMOUS_EXECUTION_TOOL_NAMES[number];

const OPERATOR_MCP_AUTONOMOUS_EXECUTION_BASE_TOOLS: OperatorMcpToolDefinition[] = [
  {
    name: "prepare_manifest_autonomous_cycle",
            title: "Prepare Manifest autonomous cycle",
        description: "Run or resume the live Manifest Main Cycle only when the owner explicitly requests the Main Cycle or canonical cycle continuation requires it. This tool changes live cycle state and never invokes or connects the isolated Innovation Cycle. Synchronize live Threads publications, use Threads and database clock evidence, reconcile every schedule state, ignore elapsed hours, preserve valid posts, and compute exactly the missing 0-through-48 slots inside the fixed 48-hour runway. Reuse fresh finalized intelligence when no maturity checkpoint changed, return one compact decision bundle, and read the exact locked lineup through get_manifest_locked_lineup_page. Sequence the complete actual deficit before persistence, preserve winners, and space repetition. Reusing the same operation ID resumes durable Main Cycle work. Default generation is eight source-backed candidates persisted through two persist_manifest_autonomous_batch calls; each batch reconciles authoritative coverage once, so do not call get_hourly_coverage or prepare a second cycle between accepted batches.",
    inputSchema: {
      type: "object",
      properties: {
        brand_key: BRAND_KEY_SCHEMA,
        timezone: { type: "string", default: "America/New_York" },
                horizon_hours: { type: "integer", minimum: 1, maximum: 48, default: 48 },
        operation_id: { type: "string", minLength: 1, maxLength: 240, description: "Stable durable preparation identity. Reuse the same value to resume the same checkpointed Main Cycle preparation." },
      },
      required: ["brand_key"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "persist_manifest_autonomous_post",
    title: "Persist Manifest autonomous post",
        description: "Persist exactly one source-card-backed Manifest post into the exact slot defined by the locked cycle strategy and plan item. The strategy must carry the consumed decision-bundle identity. Original model posts are forbidden. The server owns deterministic hard bans, strategy and plan identity, canonical source lineage, source fidelity, exact duplicates, semantic repetition, slot availability, backend gates, idempotency, complete lineage, and the size-one coverage reconciliation. The model remains responsible for wording, adaptation fidelity, novelty judgment, audience reward, placement, and response to genuine candidate failures.",
    inputSchema: {
      type: "object",
      properties: {
        brand_key: BRAND_KEY_SCHEMA,
        cycle_id: { type: "string" },
        cycle_strategy_id: { type: "string" },
        cycle_plan_item_id: { type: "string" },
        post: {
          type: "object",
          properties: {
            date: { type: "string" },
            time: { type: "string" },
            text: { type: "string" },
            generation_mode: {
              type: "string",
              enum: ["franchise_deployment", "controlled_variation", "mechanism_expansion", "adjacent_experiment"],
            },
            family_key: { type: "string" },
            family_title: { type: "string" },
            source_mechanism: { type: "string" },
            audience_reward: { type: "string" },
            strategic_purpose: { type: "string" },
            recommended_direction: { type: "string" },
            intentionally_different_from_prior: { type: "string" },
                        preserved_functions: {
              type: "array",
              items: { type: "string" },
              description: "Copy the exact must_preserve_function requirement statements returned by the locked lineup or canonical source card. Semantic paraphrases do not satisfy the deterministic source-fidelity gate.",
            },
            transformed_elements: { type: "array", items: { type: "string" } },
            satisfied_time_or_context_requirements: {
              type: "array",
              items: { type: "string" },
              description: "Exact source-card time or context requirement statements satisfied by this candidate. Persistence replays these into the internal source-fidelity gate.",
            },
            source_context: {
              type: "object",
              description: "Identify the real Saved Pattern or canonical source card used for this adaptation. source_card_id is mandatory; autonomous generation may not invent a source or premise.",
              properties: {
                kind: { type: "string", enum: ["saved_pattern", "source_card"] },
                source_type: { type: "string" },
                source_identity_key: { type: "string" },
                source_card_id: { type: "string" },
                source_selection_id: { type: "string" },
                internal_source_id: { type: "string" },
                source_url: { type: "string" },
              },
              required: ["kind", "source_card_id"],
              additionalProperties: false,
            },
            hypothesis: {
              type: "object",
              description: "Pre-publication engagement hypothesis. Follower attribution is forbidden.",
              properties: {
                expected_response_type: { type: "string", enum: ["reach", "likes", "replies", "reposts", "shares", "engagement_rate", "balanced_engagement"] },
                expected_audience_reward: { type: "string" },
                hook_rationale: { type: "string" },
                premise_rationale: { type: "string" },
                exploration_mode: { type: "string", enum: ["exploit", "explore", "hybrid"] },
                comparable_post_ids: { type: "array", items: { type: "string" } },
                expected_performance_range: { type: "object", additionalProperties: true },
                uncertainty: { type: "string" },
                falsification_conditions: { type: "array", items: { type: "string" } },
                experiment: {
                  type: "object",
                  description: "Optional controlled experiment with a stable identity, explicit comparison group, 6/12/18/24-hour maturity windows, result criteria, and variant assignment.",
                  properties: {
                    experiment_key: { type: "string" },
                    hypothesis: { type: "object", additionalProperties: true },
                    comparison_group: { type: "object", additionalProperties: true },
                    maturity_windows: { type: "array", items: { type: "integer", enum: [6, 12, 18, 24] } },
                    result_criteria: { type: "object", additionalProperties: true },
                    variant_key: { type: "string" },
                  },
                  required: ["experiment_key", "hypothesis", "comparison_group", "maturity_windows", "result_criteria"],
                  additionalProperties: false,
                },
              },
              required: ["expected_response_type", "expected_audience_reward", "hook_rationale", "premise_rationale", "exploration_mode", "expected_performance_range", "uncertainty"],
              additionalProperties: false,
            },
            strategy: { type: "object", additionalProperties: true },
            score: { type: "object", additionalProperties: true },
          },
          required: ["date", "time", "text", "generation_mode", "family_key", "source_mechanism", "audience_reward", "strategic_purpose", "source_context", "hypothesis"],
          additionalProperties: false,
        },
        model_evaluation: {
          type: "object",
          properties: {
            generation_passed: { type: "boolean" },
            scheduling_passed: { type: "boolean" },
            novelty_assessment: { type: "string" },
            winner_preservation_assessment: { type: "string" },
            slot_placement_assessment: { type: "string", description: "Explain why this exact family and execution belong in this exact hourly slot after sequencing the full horizon." },
            recent_exposure_assessment: { type: "string", description: "Explain which recent published and future scheduled posts were considered and how clustering was avoided or justified." },
            intelligence_application_assessment: { type: "string", description: "Explain which learning brief directive, benchmark movement, portfolio state, experiment, Saved Pattern intelligence, repetition evidence, or account-level checkpoint changed the move, or why mature evidence required preserving the current strategy." },
            candidate_trace: {
              type: "array",
              maxItems: 12,
              description: "Record source-backed candidate variations considered for this exact locked plan item, including rejected variations and their source-card-grounded reasons. Do not include original premises or source-independent candidates.",
              items: { type: "object", additionalProperties: true },
            },
            gate_summary: {
              type: "object",
              properties: {
                results: {
                                    type: "array",
                  maxItems: 32,
                  items: {
                    type: "object",
                    properties: {
                      rule_key: { type: "string" },
                      gate_key: { type: "string" },
                      executed: { type: "boolean" },
                      status: { type: "string", enum: ["pass", "fail", "block", "blocked"] },
                      evidence: {},
                      reason: { type: "string" },
                    },
                    required: ["executed", "status"],
                    additionalProperties: true,
                  },
                },
              },
              required: ["results"],
              additionalProperties: true,
            },
          },
                    required: ["generation_passed", "scheduling_passed", "novelty_assessment", "winner_preservation_assessment", "slot_placement_assessment", "recent_exposure_assessment"],
          additionalProperties: true,
        },
        operation_id: { type: "string" },
      },
      required: ["brand_key", "cycle_id", "cycle_strategy_id", "cycle_plan_item_id", "post", "model_evaluation", "operation_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "review_manifest_scheduled_post",
    title: "Review Manifest scheduled post",
    description: "Apply optional owner criticism to one unpublished scheduled Manifest post. Keep records feedback only; rewrite or reject_replace validates and updates the same scheduled slot so runway coverage is preserved. Feedback scope controls whether the lesson is post-specific, temporary, strategic, experimental, or an explicit permanent rule.",
    inputSchema: {
      type: "object",
      properties: {
        brand_key: BRAND_KEY_SCHEMA,
        scheduled_post_id: { type: "integer", minimum: 1 },
        action: { type: "string", enum: ["keep", "rewrite", "reject_replace"] },
        feedback: { type: "string" },
        replacement_text: { type: "string" },
        lesson_scope: { type: "string", enum: ["post_specific", "temporary_repetition", "family_strategy", "performance_hypothesis", "permanent_rule", "experiment"] },
        timezone: { type: "string", default: "America/New_York" },
      },
      required: ["brand_key", "scheduled_post_id", "action", "feedback", "lesson_scope"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
];

const [prepareManifestCycleTool, persistManifestPostTool, reviewManifestPostTool] = OPERATOR_MCP_AUTONOMOUS_EXECUTION_BASE_TOOLS;
const singlePersistProperties = persistManifestPostTool.inputSchema.properties as Record<string, unknown>;
const manifestBatchCandidateSchema = {
  type: "object",
  properties: {
    operation_id: { type: "string" },
    cycle_plan_item_id: { type: "string" },
    post: singlePersistProperties.post,
    model_evaluation: singlePersistProperties.model_evaluation,
  },
  required: ["operation_id", "cycle_plan_item_id", "post", "model_evaluation"],
  additionalProperties: false,
};

export const OPERATOR_MCP_AUTONOMOUS_EXECUTION_TOOLS: OperatorMcpToolDefinition[] = [
  prepareManifestCycleTool,
  persistManifestPostTool,
  {
    name: "persist_manifest_autonomous_batch",
            title: "Persist Manifest autonomous batch",
        description: "Persist one or two exact locked-plan Main Cycle candidates in one server-bounded call. The production limit of two protects Cloudflare Worker subrequest capacity while every item retains its own operation ID, plan item, source lineage, deterministic backend gates, hypothesis, experiment assignment, decision influence, schedule row, and complete durable lineage. A failed item does not roll back or hide successful siblings. Successful items return compact identity and lineage proof instead of echoing already persisted evidence; rejected items retain exact slots, reasons, and retryability for selective regeneration. The server reconciles authoritative cycle coverage exactly once after all accepted items and returns candidate-persistence, reconciliation, and total elapsed timing as telemetry only, never as a correctness gate. Default generation is eight candidates persisted through four two-item calls. This Main Cycle limit does not change the isolated Innovation Cycle batch contract.",
    inputSchema: {
      type: "object",
      properties: {
        brand_key: BRAND_KEY_SCHEMA,
        cycle_id: { type: "string" },
        cycle_strategy_id: { type: "string" },
        batch_operation_id: { type: "string" },
        candidates: {
          type: "array",
          minItems: 1,
                    maxItems: 2,
          items: manifestBatchCandidateSchema,
        },
      },
      required: ["brand_key", "cycle_id", "cycle_strategy_id", "batch_operation_id", "candidates"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  reviewManifestPostTool,
];

