import { describe, expect, it } from "vitest";
import {
  OPERATOR_MCP_ACCOUNT_ANALYTICS_TOOL_NAMES,
  OPERATOR_MCP_ACCOUNT_ANALYTICS_TOOLS,
} from "../src/operatorMcpAccountAnalyticsRegistry";

function tool(name: string) {
  const definition = OPERATOR_MCP_ACCOUNT_ANALYTICS_TOOLS.find((candidate) => candidate.name === name);
  expect(definition).toBeDefined();
  return definition!;
}

describe("Operator MCP account analytics registry", () => {
  it("preserves the exact ordered five-tool account analytics registry", () => {
    expect(OPERATOR_MCP_ACCOUNT_ANALYTICS_TOOL_NAMES).toEqual([
      "get_post_results",
      "get_monthly_growth_review",
      "get_performance_learning",
      "get_manifest_intelligence_audit",
      "get_content_focus",
    ]);
    expect(OPERATOR_MCP_ACCOUNT_ANALYTICS_TOOLS.map((definition) => definition.name)).toEqual(OPERATOR_MCP_ACCOUNT_ANALYTICS_TOOL_NAMES);
    expect(new Set(OPERATOR_MCP_ACCOUNT_ANALYTICS_TOOL_NAMES).size).toBe(5);
  });

  it("preserves compact post-result verification and date-bounded growth review", () => {
    const results = tool("get_post_results");
    expect(results.inputSchema.required).toEqual(["brand_key", "published_post_id"]);
    expect((results.inputSchema.properties as Record<string, any>).compact.description).toContain("bounded verification fields");

    const growth = tool("get_monthly_growth_review");
    expect(growth.inputSchema.required).toEqual(["brand_key", "date_from", "date_to"]);
    expect((growth.inputSchema.properties as Record<string, any>).top_limit).toMatchObject({ minimum: 1, maximum: 10, default: 5 });
    expect(growth.description).toContain("post-level follower attribution is forbidden");
  });

  it("preserves maturity-normalized learning without follower attribution", () => {
    const learning = tool("get_performance_learning");
    expect(learning.description).toContain("maturity-normalized post evidence");
    expect(learning.description).toContain("Follower totals remain account-level only");
    expect(learning.inputSchema.required).toEqual(["brand_key"]);
    expect(learning.annotations).toMatchObject({ readOnlyHint: true });
  });

  it("preserves bounded intelligence-audit pagination", () => {
    const audit = tool("get_manifest_intelligence_audit");
    const properties = audit.inputSchema.properties as Record<string, any>;
    expect(properties.audit_section.enum).toEqual([
      "summary",
      "learning_brief",
      "benchmarks",
      "run_comparisons",
      "saved_patterns",
      "follower_checkpoint",
      "strategy_transitions",
      "portfolio",
      "experiments",
      "capability_gaps",
    ]);
    expect(properties.limit).toMatchObject({ minimum: 1, maximum: 50, default: 20 });
    expect(audit.description).toContain("never changes content or schedule state");
  });

  it("preserves persisted Content Focus reads", () => {
    const focus = tool("get_content_focus");
    expect(focus.inputSchema.required).toEqual(["brand_key"]);
    expect(focus.description).toContain("daily, weekly, monthly, and quarterly Content Focus decisions");
    expect(focus.description).toContain("source-card family states");
    expect(focus.annotations).toMatchObject({ readOnlyHint: true });
  });
});
