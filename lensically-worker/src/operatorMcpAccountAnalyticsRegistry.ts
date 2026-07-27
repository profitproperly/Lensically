import { BRAND_KEY_SCHEMA } from "./operatorMcpSchemas";
import type { OperatorMcpToolDefinition } from "./operatorMcpToolDefinitions";

export const OPERATOR_MCP_ACCOUNT_ANALYTICS_TOOL_NAMES = [
  "get_post_results",
  "get_monthly_growth_review",
  "get_performance_learning",
  "get_manifest_intelligence_audit",
  "get_content_focus",
] as const;

export type OperatorMcpAccountAnalyticsToolName = typeof OPERATOR_MCP_ACCOUNT_ANALYTICS_TOOL_NAMES[number];

export const OPERATOR_MCP_ACCOUNT_ANALYTICS_TOOLS: OperatorMcpToolDefinition[] = [
  {
    name: "get_post_results",
    title: "Get post results",
    description: "Use this to retrieve published post results linked to a Lensically draft and source card when available.",
    inputSchema: { type: "object", properties: { brand_key: BRAND_KEY_SCHEMA, published_post_id: { type: "string" }, include_history: { type: "boolean" }, compact: { type: "boolean", description: "Return only bounded verification fields and compact generation evidence." } }, required: ["brand_key", "published_post_id"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_monthly_growth_review",
    title: "Get monthly growth review",
    description: "Return one compact, date-bounded account follower trajectory and the strongest posts published in the same period. The server fixes the response size; post-level follower attribution is forbidden.",
    inputSchema: {
      type: "object",
      properties: {
        brand_key: BRAND_KEY_SCHEMA,
        date_from: { type: "string", description: "Inclusive YYYY-MM-DD date." },
        date_to: { type: "string", description: "Inclusive YYYY-MM-DD date." },
        timezone: { type: "string", default: "America/New_York" },
        top_limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
      },
      required: ["brand_key", "date_from", "date_to"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_performance_learning",
    title: "Get performance learning",
    description: "Read the latest maturity-normalized post evidence, hypotheses, fatigue signals, generation learning brief, and current Content Focus state. Follower totals remain account-level only and are never attributed to posts or posting periods.",
    inputSchema: { type: "object", properties: { brand_key: BRAND_KEY_SCHEMA, include_posts: { type: "boolean" } }, required: ["brand_key"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_manifest_intelligence_audit",
    title: "Get Manifest intelligence audit",
    description: "Read the bounded Manifest learning brief, benchmark history, run comparisons, Saved Pattern intelligence, account-level follower checkpoint, strategy transitions, portfolio state, experiments, or remaining evidence gaps. This tool never changes content or schedule state.",
    inputSchema: {
      type: "object",
      properties: {
        brand_key: BRAND_KEY_SCHEMA,
        audit_section: {
          type: "string",
          enum: ["summary", "learning_brief", "benchmarks", "run_comparisons", "saved_patterns", "follower_checkpoint", "strategy_transitions", "portfolio", "experiments", "capability_gaps"],
          default: "summary",
        },
        offset: { type: "integer", minimum: 0, default: 0 },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      },
      required: ["brand_key"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_content_focus",
    title: "Get Content Focus",
    description: "Read the latest persisted daily, weekly, monthly, and quarterly Content Focus decisions and source-card family states for the selected account.",
    inputSchema: { type: "object", properties: { brand_key: BRAND_KEY_SCHEMA }, required: ["brand_key"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];
