import { describe, expect, it } from "vitest";
import { SCHEDULED_POST_DELETION_REASON_CODES } from "../src/humanFreeAutonomy";
import { GPT_STRATEGY_MEMORY_KINDS } from "../src/operatorMcpConstants";
import {
  OPERATOR_MCP_STRATEGY_SCHEDULE_TOOL_NAMES,
  OPERATOR_MCP_STRATEGY_SCHEDULE_TOOLS,
} from "../src/operatorMcpStrategyScheduleRegistry";

function tool(name: string) {
  const definition = OPERATOR_MCP_STRATEGY_SCHEDULE_TOOLS.find((candidate) => candidate.name === name);
  expect(definition).toBeDefined();
  return definition!;
}

describe("Operator MCP strategy-scheduling registry", () => {
  it("preserves the exact ordered seven-tool strategy-scheduling registry", () => {
    expect(OPERATOR_MCP_STRATEGY_SCHEDULE_TOOL_NAMES).toEqual([
      "list_strategy_memory",
      "save_strategy_memory",
      "list_scheduled_posts",
      "delete_scheduled_post",
      "edit_scheduled_post",
      "schedule_owner_approved_batch",
      "schedule_approved_draft",
    ]);
    expect(OPERATOR_MCP_STRATEGY_SCHEDULE_TOOLS.map((definition) => definition.name)).toEqual(OPERATOR_MCP_STRATEGY_SCHEDULE_TOOL_NAMES);
    expect(new Set(OPERATOR_MCP_STRATEGY_SCHEDULE_TOOL_NAMES).size).toBe(7);
  });

  it("preserves shared strategy-memory kind authority", () => {
    const save = tool("save_strategy_memory");
    const kind = (save.inputSchema.properties as Record<string, any>).kind;
    expect(kind.enum).toEqual(Array.from(GPT_STRATEGY_MEMORY_KINDS));
    expect(kind.enum).toContain("approved_rule");
    expect(kind.enum).toContain("rejection_feedback");
    expect(save.inputSchema.required).toEqual(["brand_key", "kind", "body"]);
  });

  it("preserves protected scheduled-post deletion and retry restrictions", () => {
    const deletion = tool("delete_scheduled_post");
    expect(deletion.annotations).toMatchObject({ destructiveHint: true });
    expect((deletion.inputSchema.properties as Record<string, any>).reason_code.enum).toEqual(SCHEDULED_POST_DELETION_REASON_CODES);
    expect(deletion.inputSchema.required).toEqual(["brand_key", "scheduled_post_id", "reason_code"]);
    expect(deletion.description).toContain("never affects selection, family labels, strategy, or model learning");

    const edit = tool("edit_scheduled_post");
    expect((edit.inputSchema.properties as Record<string, any>).retry_now.description).toContain("only after its scheduled time has passed");
    expect(edit.description).toContain("Posting and posted records cannot be edited or retried");
  });

  it("preserves owner batch limits and Manifest lineage protections", () => {
    const batch = tool("schedule_owner_approved_batch");
    const posts = (batch.inputSchema.properties as Record<string, any>).posts;
    expect(posts).toMatchObject({ minItems: 1, maxItems: 12 });
    expect(batch.inputSchema.required).toEqual(["brand_key", "owner_approval", "posts"]);
    expect(batch.description).toContain("Manifest Mental rejects this path");
    expect(batch.description).toContain("source-card, generation-run, draft, and metric lineage");

    const approved = tool("schedule_approved_draft");
    expect(approved.inputSchema.required).toEqual(["brand_key", "draft_id", "date", "time"]);
    expect(approved.description).toContain("only after it has been approved");
  });
});
