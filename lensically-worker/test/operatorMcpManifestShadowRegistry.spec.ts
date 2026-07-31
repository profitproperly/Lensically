import { describe, expect, it } from "vitest";
import {
  OPERATOR_MCP_MANIFEST_SHADOW_TOOL_NAMES,
  OPERATOR_MCP_MANIFEST_SHADOW_TOOLS,
} from "../src/operatorMcpManifestShadowRegistry";

function tool(name: string) {
  const definition = OPERATOR_MCP_MANIFEST_SHADOW_TOOLS.find((candidate) => candidate.name === name);
  expect(definition).toBeDefined();
  return definition!;
}

describe("Operator MCP Manifest Shadow registry", () => {
  it("preserves the exact ordered Shadow tool registry", () => {
    expect(OPERATOR_MCP_MANIFEST_SHADOW_TOOL_NAMES).toEqual([
      "seed_manifest_shadow_snapshot",
      "prepare_manifest_shadow_cycle",
      "commit_manifest_shadow_cycle_strategy",
      "persist_manifest_shadow_batch",
      "get_manifest_shadow_cycle_receipt",
      "get_manifest_shadow_posts",
    ]);
    expect(OPERATOR_MCP_MANIFEST_SHADOW_TOOLS.map((definition) => definition.name)).toEqual(
      OPERATOR_MCP_MANIFEST_SHADOW_TOOL_NAMES,
    );
  });

  it("exposes bounded pagination for pending 48-slot strategy lineups", () => {
    const receipt = tool("get_manifest_shadow_cycle_receipt");
    const properties = receipt.inputSchema.properties as Record<string, any>;

    expect(properties.lineup_offset).toMatchObject({
      type: "integer",
      minimum: 0,
      maximum: 72,
      default: 0,
    });
    expect(properties.lineup_limit).toMatchObject({
      type: "integer",
      minimum: 1,
      maximum: 24,
      default: 24,
    });
    expect(receipt.inputSchema.required).toEqual(["brand_key", "shadow_run_id"]);
    expect(receipt.inputSchema.additionalProperties).toBe(false);
    expect(receipt.description).toContain("lineup_offset");
    expect(receipt.description).toContain("lineup_limit");
  });
});
