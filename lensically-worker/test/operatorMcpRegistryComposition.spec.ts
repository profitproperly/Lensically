import { describe, expect, it } from "vitest";
import {
  OPERATOR_MCP_ACCOUNT_TOOLS,
  OPERATOR_MCP_ADMIN_TOOL_NAME_SET,
  OPERATOR_MCP_ENGINEERING_TOOL_NAME_SET,
  buildComposedOperatorMcpTools,
  isOperatorMcpAdminToolName,
  isOperatorMcpEngineeringToolName,
  operatorMcpToolNameRequiresProceed,
} from "../src/operatorMcpRegistryComposition";

describe("Operator MCP registry composition", () => {
    it("preserves the exact 59-tool account aggregation order", () => {
    const names = OPERATOR_MCP_ACCOUNT_TOOLS.map((tool) => tool.name);
    expect(names).toHaveLength(59);
    expect(names.slice(0, 3)).toEqual([
      "list_accounts",
      "get_account_state",
      "read_lensically_ui_surface",
    ]);
        expect(names).toEqual(expect.arrayContaining([
      "prepare_manifest_shadow_cycle",
      "commit_manifest_shadow_cycle_strategy",
      "persist_manifest_shadow_batch",
      "get_manifest_shadow_cycle_receipt",
    ]));
    expect(names.indexOf("prepare_manifest_shadow_cycle")).toBeLessThan(names.indexOf("prepare_manifest_autonomous_cycle"));
    expect(names.slice(-5)).toEqual([
      "get_post_results",
      "get_monthly_growth_review",
      "get_performance_learning",
      "get_manifest_intelligence_audit",
      "get_content_focus",
    ]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("preserves engineering, admin, and intentional monthly-growth classifications", () => {
    expect(isOperatorMcpEngineeringToolName("readRepoFile")).toBe(true);
    expect(OPERATOR_MCP_ENGINEERING_TOOL_NAME_SET.has("readRepoFile")).toBe(true);
    expect(isOperatorMcpAdminToolName("getGrowthMission")).toBe(true);
    expect(isOperatorMcpAdminToolName("get_monthly_growth_review")).toBe(true);
    expect(OPERATOR_MCP_ADMIN_TOOL_NAME_SET.has("get_monthly_growth_review")).toBe(true);
    expect(isOperatorMcpEngineeringToolName("get_monthly_growth_review")).toBe(false);
  });

  it("preserves guided Proceed membership without blocking list_accounts", () => {
        expect(operatorMcpToolNameRequiresProceed("list_accounts")).toBe(false);
    expect(operatorMcpToolNameRequiresProceed("prepare_manifest_shadow_cycle")).toBe(false);
    expect(operatorMcpToolNameRequiresProceed("commit_manifest_shadow_cycle_strategy")).toBe(false);
    expect(operatorMcpToolNameRequiresProceed("persist_manifest_shadow_batch")).toBe(false);
    expect(operatorMcpToolNameRequiresProceed("get_manifest_shadow_cycle_receipt")).toBe(false);
    expect(operatorMcpToolNameRequiresProceed("get_account_state")).toBe(true);
    expect(operatorMcpToolNameRequiresProceed("getGrowthMission")).toBe(true);
    expect(operatorMcpToolNameRequiresProceed("mm_get_account_state")).toBe(true);
    expect(operatorMcpToolNameRequiresProceed("readRepoFile")).toBe(false);
  });

    it("builds the exact 116 direct tools with deterministic priority ordering", () => {
    const tools = buildComposedOperatorMcpTools(false);
    const names = tools.map((tool) => tool.name);
    expect(tools).toHaveLength(116);
    expect(names[0]).toBe("getOperatorStartupContext");
    expect(names.indexOf("getEngineeringContinuation")).toBeLessThan(names.indexOf("getDatabaseSchemaState"));
        expect(names.indexOf("get_performance_learning")).toBeLessThan(names.indexOf("prepare_manifest_shadow_cycle"));
    expect(names.indexOf("prepare_manifest_shadow_cycle")).toBeLessThan(names.indexOf("commit_manifest_shadow_cycle_strategy"));
    expect(names.indexOf("commit_manifest_shadow_cycle_strategy")).toBeLessThan(names.indexOf("persist_manifest_shadow_batch"));
    expect(names.indexOf("get_manifest_shadow_cycle_receipt")).toBeLessThan(names.indexOf("prepare_manifest_autonomous_cycle"));
    expect(names.indexOf("prepare_manifest_autonomous_cycle")).toBeLessThan(names.indexOf("persist_manifest_autonomous_post"));
  });

  it("builds all three scoped account wrapper surfaces without brand_key", () => {
    const directTools = buildComposedOperatorMcpTools(false);
    const scopedTools = buildComposedOperatorMcpTools(true);
        expect(scopedTools).toHaveLength(directTools.length + (58 * 3));

    for (const prefix of ["mm", "om", "vx"]) {
      const wrapper = scopedTools.find((tool) => tool.name === `${prefix}_get_post_results`);
      expect(wrapper).toBeDefined();
      expect(wrapper?.inputSchema.properties).not.toHaveProperty("brand_key");
      expect(wrapper?.inputSchema.properties).toHaveProperty("proceed_confirmed");
      expect(wrapper?.inputSchema.properties).toHaveProperty("operation_id");
      expect(wrapper?.annotations).toMatchObject({ readOnlyHint: true });
    }
  });
});
