import { describe, expect, it } from "vitest";
import {
  OPERATOR_MCP_ACCOUNT_TOOLS,
  OPERATOR_MCP_ADMIN_TOOL_NAME_SET,
  OPERATOR_MCP_ENGINEERING_TOOL_NAME_SET,
  buildComposedOperatorMcpTools,
  isOperatorMcpAdminToolName,
  isOperatorMcpEngineeringToolName,
} from "../src/operatorMcpRegistryComposition";

describe("Operator MCP registry composition", () => {
        it("preserves the exact 64-tool account aggregation order", () => {
    const names = OPERATOR_MCP_ACCOUNT_TOOLS.map((tool) => tool.name);
    expect(names).toHaveLength(64);
    expect(names.slice(0, 3)).toEqual([
      "list_accounts",
      "get_account_state",
      "read_lensically_ui_surface",
    ]);
        expect(names).toEqual(expect.arrayContaining([
      "seed_manifest_shadow_snapshot",
      "prepare_manifest_shadow_cycle",
      "commit_manifest_shadow_cycle_strategy",
      "persist_manifest_shadow_batch",
                        "get_manifest_shadow_cycle_receipt",
            "get_manifest_shadow_posts",
      "get_manifest_locked_lineup_page",
      "persist_manifest_autonomous_batch",
    ]));
        expect(names.indexOf("prepare_manifest_shadow_cycle")).toBeLessThan(names.indexOf("prepare_manifest_autonomous_cycle"));
    expect(names.indexOf("get_manifest_cycle_analysis_page")).toBeLessThan(names.indexOf("get_manifest_locked_lineup_page"));
    expect(names.indexOf("get_manifest_locked_lineup_page")).toBeLessThan(names.indexOf("commit_manifest_cycle_strategy"));
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

  it("removes generic Proceed metadata from the callable surface", () => {
    const tools = buildComposedOperatorMcpTools(true);
    for (const tool of tools) {
      const properties = tool.inputSchema.properties as Record<string, unknown> | undefined;
      expect(properties ?? {}).not.toHaveProperty("proceed_confirmed");
    }
  });

                  it("builds the exact 129 internal typed tools with deterministic priority ordering", () => {
    const tools = buildComposedOperatorMcpTools(false);
    const names = tools.map((tool) => tool.name);
    expect(tools).toHaveLength(129);
        expect(names).toContain("operateGitHubRepositories");
    expect(names).toEqual(expect.arrayContaining([
      "getStripeAccountState",
      "readStripeObjects",
      "operateStripe",
    ]));

            const lifecycleOrder = ["getOperatorSessionMap", "getOperatorKnowledge", "getOperatorLiveState", "executeOperatorReadAction", "executeOperatorAction", "closeOperatorAction"];
    for (let index = 1; index < lifecycleOrder.length; index += 1) {
      expect(names.indexOf(lifecycleOrder[index - 1])).toBeLessThan(names.indexOf(lifecycleOrder[index]));
    }
    expect(names.indexOf("getEngineeringContinuation")).toBeLessThan(names.indexOf("getDatabaseSchemaState"));
        expect(names.indexOf("get_performance_learning")).toBeLessThan(names.indexOf("prepare_manifest_shadow_cycle"));
    expect(names.indexOf("prepare_manifest_shadow_cycle")).toBeLessThan(names.indexOf("commit_manifest_shadow_cycle_strategy"));
    expect(names.indexOf("commit_manifest_shadow_cycle_strategy")).toBeLessThan(names.indexOf("persist_manifest_shadow_batch"));
        expect(names.indexOf("get_manifest_shadow_cycle_receipt")).toBeLessThan(names.indexOf("prepare_manifest_autonomous_cycle"));
    expect(names.indexOf("get_manifest_cycle_analysis_page")).toBeLessThan(names.indexOf("get_manifest_locked_lineup_page"));
    expect(names.indexOf("get_manifest_locked_lineup_page")).toBeLessThan(names.indexOf("commit_manifest_cycle_strategy"));
        expect(names.indexOf("prepare_manifest_autonomous_cycle")).toBeLessThan(names.indexOf("persist_manifest_autonomous_batch"));
    expect(names.indexOf("persist_manifest_autonomous_batch")).toBeLessThan(names.indexOf("persist_manifest_autonomous_post"));
  });

  it("builds all three scoped account wrapper surfaces without brand_key", () => {
    const directTools = buildComposedOperatorMcpTools(false);
    const scopedTools = buildComposedOperatorMcpTools(true);
                    expect(scopedTools).toHaveLength(directTools.length + (63 * 3));

    for (const prefix of ["mm", "om", "vx"]) {
      const wrapper = scopedTools.find((tool) => tool.name === `${prefix}_get_post_results`);
      expect(wrapper).toBeDefined();
      expect(wrapper?.inputSchema.properties).not.toHaveProperty("brand_key");
      expect(wrapper?.inputSchema.properties).not.toHaveProperty("proceed_confirmed");
            expect(wrapper?.annotations).toMatchObject({ readOnlyHint: true });

      const lineupWrapper = scopedTools.find((tool) => tool.name === `${prefix}_get_manifest_locked_lineup_page`);
      expect(lineupWrapper).toBeDefined();
      expect(lineupWrapper?.inputSchema.properties).not.toHaveProperty("brand_key");
      expect(lineupWrapper?.inputSchema.properties).toHaveProperty("cycle_id");
      expect(lineupWrapper?.inputSchema.properties).toHaveProperty("offset");
      expect(lineupWrapper?.inputSchema.properties).toHaveProperty("limit");
      expect(lineupWrapper?.annotations).toMatchObject({ readOnlyHint: true });
    }
  });
});
