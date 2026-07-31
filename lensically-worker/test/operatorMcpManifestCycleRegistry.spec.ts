import { describe, expect, it } from "vitest";
import {
  OPERATOR_MCP_MANIFEST_CYCLE_TOOL_NAMES,
  OPERATOR_MCP_MANIFEST_CYCLE_TOOLS,
} from "../src/operatorMcpManifestCycleRegistry";

function tool(name: string) {
  const definition = OPERATOR_MCP_MANIFEST_CYCLE_TOOLS.find((candidate) => candidate.name === name);
  expect(definition).toBeDefined();
  return definition!;
}

describe("Operator MCP Manifest cycle-strategy registry", () => {
    it("preserves the exact ordered seven-tool Main Cycle registry", () => {
    expect(OPERATOR_MCP_MANIFEST_CYCLE_TOOL_NAMES).toEqual([
      "get_manifest_intelligence_foundation",
      "get_manifest_cycle_receipt",
      "record_manifest_cycle_defect",
      "resolve_manifest_cycle_defect",
      "get_manifest_cycle_analysis_page",
      "get_manifest_locked_lineup_page",
      "commit_manifest_cycle_strategy",
    ]);
    expect(OPERATOR_MCP_MANIFEST_CYCLE_TOOLS.map((definition) => definition.name)).toEqual(OPERATOR_MCP_MANIFEST_CYCLE_TOOL_NAMES);
    expect(new Set(OPERATOR_MCP_MANIFEST_CYCLE_TOOL_NAMES).size).toBe(7);
  });

  it("preserves pageable canonical cycle receipt reconstruction", () => {
    const receipt = tool("get_manifest_cycle_receipt");
    const properties = receipt.inputSchema.properties as Record<string, any>;
    expect(properties.receipt_section.enum).toEqual([
      "summary",
      "events",
      "hypotheses",
      "defects",
      "exposure_published",
      "exposure_scheduled",
      "exposure_dimensions",
      "startup_state",
      "input_strategy",
      "output_strategy",
      "completion",
      "unresolved_issues",
    ]);
    expect(properties.limit).toMatchObject({ minimum: 1, maximum: 10, default: 10 });
    expect(receipt.description).toContain("without payload-budget truncation");
  });

  it("preserves seven-stage defect evidence and durable repair verification", () => {
    const record = tool("record_manifest_cycle_defect");
    const recordProperties = record.inputSchema.properties as Record<string, any>;
    expect(recordProperties.stage_number).toMatchObject({ minimum: 1, maximum: 7 });
    expect(recordProperties.impact_state.enum).toEqual([
      "definitely_failed",
      "possibly_succeeded",
      "partially_succeeded",
      "succeeded_before_response_failed",
    ]);
    expect(record.inputSchema.required).toEqual([
      "brand_key",
      "cycle_id",
      "defect_key",
      "stage_number",
      "stage_key",
      "phase",
      "error_code",
      "error_message",
      "impact_state",
    ]);

    const resolve = tool("resolve_manifest_cycle_defect");
    expect(resolve.inputSchema.required).toEqual(["brand_key", "cycle_id", "defect_key", "root_cause", "verification"]);
    expect(resolve.inputSchema.properties).toMatchObject({
      repair_commit_sha: { type: "string" },
      deployed_sha: { type: "string" },
      regression_tests: { type: "array" },
      verification: { type: "object" },
    });
  });

        it("preserves compact decision-bundle consumption, ambiguity-only detail, and locked-lineup paging", () => {
    const page = tool("get_manifest_cycle_analysis_page");
    expect(page.inputSchema.required).toEqual(["brand_key", "cycle_id", "snapshot_id", "page_index"]);
    expect(page.description).toContain("only when decision_bundle.requires_detail_read is true");
    expect(page.description).not.toContain("page 0 through the final page");

    const lineupPage = tool("get_manifest_locked_lineup_page");
    expect(lineupPage.inputSchema.required).toEqual(["brand_key", "cycle_id"]);
    expect(lineupPage.inputSchema.properties).toMatchObject({
      offset: { type: "integer", minimum: 0, default: 0 },
      limit: { type: "integer", minimum: 1, maximum: 12, default: 12 },
    });
    expect(lineupPage.description).toContain("Main Cycle");
    expect(lineupPage.description).toContain("Do not replace locked sources");

    const strategy = tool("commit_manifest_cycle_strategy");
    expect(strategy.description).toContain("complete versioned decision bundle");
    expect(strategy.description).toContain("bounded evidence-page detail read");
    expect(strategy.description).toContain("Replaying an identical strategy is safe");
    expect(strategy.inputSchema.required).toContain("decision_bundle_id");
    expect(strategy.inputSchema.required).toContain("decision_bundle_hash");
    expect(strategy.inputSchema.properties).toMatchObject({
      decision_bundle_id: { type: "string" },
      decision_bundle_hash: { type: "string" },
    });
    const lineup = (strategy.inputSchema.properties as Record<string, any>).lineup;
    expect(lineup.minItems).toBe(1);
    expect(lineup.items.required).toContain("source_card_id");
    expect(lineup.items.properties.generation_mode.enum).toEqual([
      "franchise_deployment",
      "controlled_variation",
      "mechanism_expansion",
      "adjacent_experiment",
    ]);
    expect(lineup.items.properties.exploration_mode.enum).toEqual(["exploit", "explore", "hybrid"]);
  });
});
