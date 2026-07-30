import { BRAND_KEY_SCHEMA } from "./operatorMcpSchemas";
import type { OperatorMcpToolDefinition } from "./operatorMcpToolDefinitions";

const SHADOW_LINEUP_ITEM_SCHEMA = {
  type: "object",
  properties: {
    slot_key: { type: "string" },
    source_card_id: { type: "string" },
    family_key: { type: "string" },
    strategic_role: { type: "string" },
    generation_mode: { type: "string", enum: ["franchise_deployment", "controlled_variation", "mechanism_expansion", "adjacent_experiment"] },
    audience_reward: { type: "string" },
    hook_direction: { type: "string" },
    placement_reason: { type: "string" },
    exploration_mode: { type: "string", enum: ["exploit", "explore", "hybrid"] },
  },
  required: ["slot_key", "source_card_id", "family_key", "strategic_role", "generation_mode", "audience_reward", "hook_direction", "placement_reason", "exploration_mode"],
  additionalProperties: false,
} as const;

const MODEL_EVALUATION_SCHEMA = {
  type: "object",
  properties: {
    novelty_assessment: { type: "string" },
    winner_preservation_assessment: { type: "string" },
    slot_placement_assessment: { type: "string" },
    recent_exposure_assessment: { type: "string" },
    intelligence_application_assessment: { type: "string" },
  },
  required: ["novelty_assessment", "winner_preservation_assessment", "slot_placement_assessment", "recent_exposure_assessment", "intelligence_application_assessment"],
  additionalProperties: false,
} as const;

const SHADOW_CANDIDATE_SCHEMA = {
  type: "object",
  properties: {
    operation_id: { type: "string" },
    slot_key: { type: "string" },
    source_card_id: { type: "string" },
    family_key: { type: "string" },
    text: { type: "string", minLength: 1, maxLength: 3000 },
    hook_style: { type: "string" },
    format: { type: "string" },
    strategic_purpose: { type: "string" },
    experiment_key: { type: "string" },
    novelty_level: { type: "string" },
    adaptation_plan: { type: "object", additionalProperties: true },
    model_evaluation: MODEL_EVALUATION_SCHEMA,
  },
  required: ["operation_id", "slot_key", "source_card_id", "family_key", "text", "model_evaluation"],
  additionalProperties: false,
} as const;

export const OPERATOR_MCP_MANIFEST_SHADOW_TOOL_NAMES = [
  "prepare_manifest_shadow_cycle",
  "commit_manifest_shadow_cycle_strategy",
  "persist_manifest_shadow_batch",
  "get_manifest_shadow_cycle_receipt",
] as const;

export const OPERATOR_MCP_MANIFEST_SHADOW_TOOLS: OperatorMcpToolDefinition[] = [
  {
    name: "prepare_manifest_shadow_cycle",
    title: "Prepare isolated Manifest Shadow Cycle",
    description: "Reset and seed the physically isolated Manifest Shadow D1 workspace from one read-only production evidence snapshot, lock the canonical source plan, and return one complete compact decision bundle. No production operational table or Threads mutation is reachable.",
    inputSchema: {
      type: "object",
      properties: {
        brand_key: BRAND_KEY_SCHEMA,
        scenario: { type: "string", enum: ["noop", "normal_24", "recovery_48", "custom"], default: "normal_24" },
        evidence_mode: { type: "string", enum: ["snapshot", "live_read"], default: "snapshot" },
        variant_key: { type: "string", default: "control" },
        timezone: { type: "string", default: "America/New_York" },
        horizon_hours: { type: "integer", minimum: 1, maximum: 72, default: 48 },
        missing_count: { type: "integer", minimum: 0, maximum: 72 },
        retention_hours: { type: "integer", minimum: 1, maximum: 336, default: 72 },
        operation_id: { type: "string" },
      },
      required: ["brand_key", "scenario", "evidence_mode", "variant_key", "operation_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "commit_manifest_shadow_cycle_strategy",
    title: "Lock Manifest Shadow Cycle strategy",
    description: "Commit exactly one strategy against the frozen shadow decision bundle and exact locked source plan. Source substitution and conflicting second strategies are rejected.",
    inputSchema: {
      type: "object",
      properties: {
        brand_key: BRAND_KEY_SCHEMA,
        shadow_run_id: { type: "string" },
        decision_bundle_id: { type: "string" },
        account_conclusion: { type: "object", additionalProperties: true },
        content_focus: { type: "object", additionalProperties: true },
        benchmarks: { type: "object", additionalProperties: true },
        strongest_executions: { type: "array", items: { type: "object", additionalProperties: true } },
        weakest_executions: { type: "array", items: { type: "object", additionalProperties: true } },
        directives: { type: "object", additionalProperties: true },
        experiments: { type: "array", items: { type: "object", additionalProperties: true } },
        risks: { type: "array", items: {} },
        lineup: { type: "array", items: SHADOW_LINEUP_ITEM_SCHEMA },
      },
      required: ["brand_key", "shadow_run_id", "decision_bundle_id", "account_conclusion", "content_focus", "benchmarks", "strongest_executions", "weakest_executions", "directives", "experiments", "risks", "lineup"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "persist_manifest_shadow_batch",
    title: "Persist Manifest Shadow candidate batch",
    description: "Gate and persist one to four exact planned candidates into the isolated shadow schedule with item-level idempotency, production-shaped generation and draft lineage, selective rejection, and one post-batch coverage reconciliation.",
    inputSchema: {
      type: "object",
      properties: {
        brand_key: BRAND_KEY_SCHEMA,
        shadow_run_id: { type: "string" },
        operation_id: { type: "string" },
        candidates: { type: "array", minItems: 1, maxItems: 4, items: SHADOW_CANDIDATE_SCHEMA },
      },
      required: ["brand_key", "shadow_run_id", "operation_id", "candidates"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "get_manifest_shadow_cycle_receipt",
    title: "Get Manifest Shadow Cycle receipt",
    description: "Read one isolated shadow run, stage timings, compact benchmark, cleanup evidence, and state summary without returning generated post text by default.",
    inputSchema: {
      type: "object",
      properties: {
        brand_key: BRAND_KEY_SCHEMA,
        shadow_run_id: { type: "string" },
      },
      required: ["brand_key", "shadow_run_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];
