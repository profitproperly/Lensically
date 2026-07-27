import { SCHEDULED_POST_DELETION_REASON_CODES } from "./humanFreeAutonomy";
import { GPT_STRATEGY_MEMORY_KINDS } from "./operatorMcpConstants";
import { BRAND_KEY_SCHEMA } from "./operatorMcpSchemas";
import type { OperatorMcpToolDefinition } from "./operatorMcpToolDefinitions";

export const OPERATOR_MCP_STRATEGY_SCHEDULE_TOOL_NAMES = [
  "list_strategy_memory",
  "save_strategy_memory",
  "list_scheduled_posts",
  "delete_scheduled_post",
  "edit_scheduled_post",
  "schedule_owner_approved_batch",
  "schedule_approved_draft",
] as const;

export type OperatorMcpStrategyScheduleToolName = typeof OPERATOR_MCP_STRATEGY_SCHEDULE_TOOL_NAMES[number];

export const OPERATOR_MCP_STRATEGY_SCHEDULE_TOOLS: OperatorMcpToolDefinition[] = [
  {
    name: "list_strategy_memory",
    title: "List strategy memory",
    description: "Use this to read active strategy memory for one Lensically account, optionally filtered by kind.",
    inputSchema: { type: "object", properties: { brand_key: BRAND_KEY_SCHEMA, kind: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 100 }, offset: { type: "integer", minimum: 0 } }, required: ["brand_key"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "save_strategy_memory",
    title: "Save strategy memory",
    description: "Use this to save account-scoped approval, rejection, voice, rule, cooldown, or experiment memory in Lensically.",
    inputSchema: { type: "object", properties: { brand_key: BRAND_KEY_SCHEMA, kind: { type: "string", enum: Array.from(GPT_STRATEGY_MEMORY_KINDS) }, title: { type: "string" }, body: { type: "string" }, source: { type: "string" }, metadata: { type: "object", additionalProperties: true } }, required: ["brand_key", "kind", "body"], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "list_scheduled_posts",
    title: "List scheduled posts",
    description: "Use this to inspect scheduled posts for a selected Lensically account and date.",
    inputSchema: { type: "object", properties: { brand_key: BRAND_KEY_SCHEMA, date: { type: "string" }, timezone: { type: "string" }, limit: { type: "integer" }, offset: { type: "integer" } }, required: ["brand_key"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "delete_scheduled_post",
    title: "Delete scheduled post",
    description: "Delete one approved unpublished scheduled post only for an objective constitutional, safety, duplicate, corruption, account-or-slot, or emergency-withdrawal reason. The receipt is operational and unobserved: it never affects selection, family labels, strategy, or model learning.",
    inputSchema: {
      type: "object",
      properties: {
        brand_key: BRAND_KEY_SCHEMA,
        scheduled_post_id: { type: "integer", minimum: 1 },
        reason_code: { type: "string", enum: SCHEDULED_POST_DELETION_REASON_CODES },
        reason_detail: { type: "string", description: "Optional factual operational detail. Do not include taste feedback or performance predictions." },
        owner_response: { type: "string", description: "Exact owner authorization for this protected deletion when required by the Execution Kernel." },
      },
      required: ["brand_key", "scheduled_post_id", "reason_code"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
  {
    name: "edit_scheduled_post",
    title: "Edit scheduled post",
    description: "Edit the text, schedule, or spoiler settings of an existing approved unpublished scheduled post for the selected account, or safely retry one approved unpublished post that is already due. Omitted fields are preserved. Date and time must be provided together when rescheduling. Posting and posted records cannot be edited or retried.",
    inputSchema: {
      type: "object",
      properties: {
        brand_key: BRAND_KEY_SCHEMA,
        scheduled_post_id: { type: "integer", minimum: 1 },
        text: { type: "string" },
        date: { type: "string" },
        time: { type: "string" },
        timezone: { type: "string" },
        spoiler_all_text: { type: "boolean" },
        spoiler_phrases: { type: "array", items: { type: "string" } },
        retry_now: { type: "boolean", description: "Immediately retry one approved, unpublished post only after its scheduled time has passed. Future, posting, and published records are rejected." },
      },
      required: ["brand_key", "scheduled_post_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "schedule_owner_approved_batch",
    title: "Schedule owner-approved post batch",
    description: "Schedule up to 12 posts exactly as explicitly approved by the owner for accounts that permit direct text scheduling. Manifest Mental rejects this path because it bypasses source-card, generation-run, draft, and metric lineage; use schedule_manifest_review_batch or schedule_approved_draft instead.",
    inputSchema: {
      type: "object",
      properties: {
        brand_key: BRAND_KEY_SCHEMA,
        owner_approval: { type: "string" },
        timezone: { type: "string" },
        posts: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              date: { type: "string" },
              time: { type: "string" },
            },
            required: ["text", "date", "time"],
            additionalProperties: false,
          },
        },
      },
      required: ["brand_key", "owner_approval", "posts"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "schedule_approved_draft",
    title: "Schedule approved draft",
    description: "Use this to schedule a draft only after it has been approved. This fails for candidate, shown, rejected, or self-rejected drafts.",
    inputSchema: { type: "object", properties: { brand_key: BRAND_KEY_SCHEMA, draft_id: { type: "string" }, date: { type: "string" }, time: { type: "string" }, timezone: { type: "string" }, strategy: { type: "object", additionalProperties: true } }, required: ["brand_key", "draft_id", "date", "time"], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
];
