import { describe, expect, it } from "vitest";
import {
  OPERATOR_MCP_ACCOUNT_FOUNDATION_TOOL_NAMES,
  OPERATOR_MCP_ACCOUNT_FOUNDATION_TOOLS,
} from "../src/operatorMcpAccountFoundationRegistry";
import { OPERATOR_WORKFLOW_TEMPLATE_KEY } from "../src/operatorMcpConstants";
import { SOURCE_TRANSFORMATION_CONTRACT_SCHEMA } from "../src/operatorMcpSchemas";

describe("Operator MCP account foundation registry", () => {
  it("preserves the exact ordered 21-tool foundation registry", () => {
    expect(OPERATOR_MCP_ACCOUNT_FOUNDATION_TOOL_NAMES).toHaveLength(21);
    expect(OPERATOR_MCP_ACCOUNT_FOUNDATION_TOOLS).toHaveLength(21);
    expect(new Set(OPERATOR_MCP_ACCOUNT_FOUNDATION_TOOL_NAMES).size).toBe(21);
    expect(OPERATOR_MCP_ACCOUNT_FOUNDATION_TOOLS.map((tool) => tool.name)).toEqual([
      ...OPERATOR_MCP_ACCOUNT_FOUNDATION_TOOL_NAMES,
    ]);
  });

  it("preserves account and UI pagination bounds", () => {
    const byName = new Map(OPERATOR_MCP_ACCOUNT_FOUNDATION_TOOLS.map((tool) => [tool.name, tool]));
    expect(byName.get("list_accounts")?.inputSchema).toMatchObject({
      properties: {},
      additionalProperties: false,
    });
    expect(byName.get("get_account_state")?.inputSchema).toMatchObject({
      required: ["brand_key"],
    });
    expect(byName.get("read_lensically_ui_surface")?.inputSchema).toMatchObject({
      required: ["brand_key", "surface"],
      properties: {
        surface: { enum: ["dashboard", "followers", "insights", "post_archive", "saved_patterns"] },
        order: { enum: ["recent", "top", "newest", "likes"] },
        limit: { minimum: 1, maximum: 200, default: 100 },
        cursor_depth: { minimum: 1, maximum: 250 },
      },
    });
  });

  it("preserves guided review limits and workflow defaults", () => {
    const byName = new Map(OPERATOR_MCP_ACCOUNT_FOUNDATION_TOOLS.map((tool) => [tool.name, tool]));
    expect(byName.get("claim_manifest_review_batch")?.inputSchema).toMatchObject({
      required: ["brand_key", "production_date"],
      properties: { batch_size: { minimum: 1, maximum: 4, default: 4 } },
    });
    expect(byName.get("attach_manifest_review_draft")?.inputSchema).toMatchObject({
      required: ["brand_key", "review_batch_id", "item_number", "draft_id"],
      properties: { item_number: { minimum: 1, maximum: 4 } },
    });
    expect(byName.get("skip_manifest_review_source")?.inputSchema).toMatchObject({
      properties: { scope: { enum: ["current_day", "delete_source"] } },
    });
    expect(byName.get("start_workflow_session")?.inputSchema).toMatchObject({
      properties: { workflow_template_key: { default: OPERATOR_WORKFLOW_TEMPLATE_KEY } },
    });
  });

  it("preserves source deletion, lineage recovery, and bounded backfill contracts", () => {
    const byName = new Map(OPERATOR_MCP_ACCOUNT_FOUNDATION_TOOLS.map((tool) => [tool.name, tool]));
    expect(byName.get("delete_saved_pattern_source")?.annotations).toMatchObject({ destructiveHint: true });
    expect(byName.get("recover_published_post_lineage")?.inputSchema).toMatchObject({
      required: ["brand_key", "workflow_session_id", "saved_pattern_id", "published_post_ids", "source_card"],
      properties: {
        published_post_ids: { minItems: 1, maxItems: 10 },
        source_card: {
          required: ["title", "source_mechanism", "required_product", "forbidden_surfaces", "pass_conditions", "fail_conditions"],
          properties: { transformation_contract: SOURCE_TRANSFORMATION_CONTRACT_SCHEMA },
        },
      },
    });
    expect(byName.get("create_all_missing_manifest_source_cards")?.inputSchema).toMatchObject({
      properties: { limit: { minimum: 1, maximum: 4, default: 4 } },
    });
    expect(byName.get("prepare_manifest_source_card_backfill")?.inputSchema).toMatchObject({
      properties: { limit: { minimum: 1, maximum: 25, default: 8 } },
    });
    expect(byName.get("get_source_candidate_batch")?.inputSchema).toMatchObject({
      required: ["brand_key", "source_batch_id"],
    });
  });
});
