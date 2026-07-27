import { describe, expect, it } from "vitest";
import {
  OPERATOR_MCP_ADMIN_TOOL_NAMES,
  OPERATOR_MCP_ADMIN_TOOLS,
} from "../src/operatorMcpAdminRegistry";
import { BRAND_KEY_SCHEMA, SOURCE_DRAFT_ANALYSIS_SCHEMA } from "../src/operatorMcpSchemas";

describe("Operator MCP admin registry", () => {
  it("preserves the intentional 25-name classification and 24 static definitions", () => {
    expect(OPERATOR_MCP_ADMIN_TOOL_NAMES).toHaveLength(25);
    expect(OPERATOR_MCP_ADMIN_TOOLS).toHaveLength(24);
    expect(new Set(OPERATOR_MCP_ADMIN_TOOL_NAMES).size).toBe(25);
    expect(new Set(OPERATOR_MCP_ADMIN_TOOLS.map((tool) => tool.name)).size).toBe(24);
    expect(OPERATOR_MCP_ADMIN_TOOL_NAMES).toContain("get_monthly_growth_review");
    expect(OPERATOR_MCP_ADMIN_TOOLS.map((tool) => tool.name)).not.toContain("get_monthly_growth_review");
    for (const tool of OPERATOR_MCP_ADMIN_TOOLS) {
      expect(OPERATOR_MCP_ADMIN_TOOL_NAMES).toContain(tool.name);
    }
  });

  it("preserves shared brand and draft-analysis schemas", () => {
    expect(BRAND_KEY_SCHEMA).toMatchObject({
      type: "string",
      enum: ["manifest_mental", "manifestmental", "opmg_deadman", "opmgdeadman", "vectrix"],
    });
    expect(SOURCE_DRAFT_ANALYSIS_SCHEMA).toMatchObject({
      type: "object",
      additionalProperties: true,
      properties: {
        opening_phrase: { type: "string" },
        preserved_functions: { type: "array" },
        audience_reward_delivered: { type: "boolean" },
      },
    });
  });

  it("preserves protected scheduler and decision schemas", () => {
    const byName = new Map(OPERATOR_MCP_ADMIN_TOOLS.map((tool) => [tool.name, tool]));
    expect(byName.get("setScheduledPostSchedulerMode")?.inputSchema).toMatchObject({
      required: ["mode", "reason"],
      properties: {
        mode: { enum: ["paused", "canary", "normal"] },
        scheduled_post_id: { minimum: 1 },
        owner_response: { type: "string" },
      },
    });
    expect(byName.get("recoverOverdueScheduledPosts")?.inputSchema).toMatchObject({
      required: ["actions", "reason_code"],
      properties: {
        actions: { minItems: 1, maxItems: 25 },
        reason_code: { type: "string" },
      },
    });
    expect(byName.get("proposeOperatorDecision")?.inputSchema).toMatchObject({
      required: ["brand_key", "category", "title", "decision", "authorized_tools"],
      properties: { authorized_tools: { minItems: 1 } },
    });
    expect(byName.get("resolveOperatorDecision")?.inputSchema).toMatchObject({
      required: ["brand_key", "decision_id", "resolution", "owner_response"],
    });
  });

  it("preserves workflow and gate compatibility schemas", () => {
    const byName = new Map(OPERATOR_MCP_ADMIN_TOOLS.map((tool) => [tool.name, tool]));
    expect(byName.get("runMcpTests")?.inputSchema).toMatchObject({
      properties: {
        segment: {
          enum: [
            "routes",
            "engineering_reads",
            "admin_reads",
            "account_reads_a",
            "account_reads_b",
            "engineering_mutations",
            "admin_mutations",
            "account_mutations_a",
            "account_mutations_b",
            "s0",
            "s1",
            "s2",
            "s3",
            "s4",
            "s5",
            "s6",
            "s7",
            "s8",
          ],
        },
      },
    });
    expect(byName.get("runGateSuite")?.inputSchema).toMatchObject({
      required: ["brand_key", "stage"],
      properties: { draft_analysis: SOURCE_DRAFT_ANALYSIS_SCHEMA },
    });
    expect(byName.get("submitAndGateDraft")?.inputSchema).toMatchObject({
      required: ["brand_key", "run_id", "source_card_id"],
      properties: { draft_analysis: SOURCE_DRAFT_ANALYSIS_SCHEMA },
    });
  });
});
