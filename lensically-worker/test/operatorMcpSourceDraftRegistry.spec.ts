import { describe, expect, it } from "vitest";
import {
  OPERATOR_MCP_SOURCE_DRAFT_TOOL_NAMES,
  OPERATOR_MCP_SOURCE_DRAFT_TOOLS,
} from "../src/operatorMcpSourceDraftRegistry";

function tool(name: string) {
  const definition = OPERATOR_MCP_SOURCE_DRAFT_TOOLS.find((candidate) => candidate.name === name);
  expect(definition).toBeDefined();
  return definition!;
}

describe("Operator MCP source-draft registry", () => {
  it("preserves the exact ordered 13-tool source-draft registry", () => {
    expect(OPERATOR_MCP_SOURCE_DRAFT_TOOL_NAMES).toEqual([
      "create_source_card",
      "lock_source_card",
      "get_source_card",
      "create_generation_run",
      "run_gates",
      "submit_candidate_draft",
      "mark_draft_shown",
      "save_self_rejected_draft",
      "approve_draft",
      "reject_draft",
      "list_active_gates",
      "create_or_update_gate",
      "promote_memory_to_gate",
    ]);
    expect(OPERATOR_MCP_SOURCE_DRAFT_TOOLS.map((definition) => definition.name)).toEqual(OPERATOR_MCP_SOURCE_DRAFT_TOOL_NAMES);
    expect(new Set(OPERATOR_MCP_SOURCE_DRAFT_TOOL_NAMES).size).toBe(13);
  });

  it("preserves source-card versioning and generation adaptation contracts", () => {
    const createSource = tool("create_source_card");
    expect(createSource.inputSchema.required).toEqual([
      "brand_key",
      "title",
      "source_mechanism",
      "required_product",
      "forbidden_surfaces",
      "pass_conditions",
      "fail_conditions",
    ]);
    expect(createSource.inputSchema.properties).toMatchObject({
      create_new_version: { type: "boolean" },
      version_reason: { type: "string" },
      transformation_contract: { type: "object" },
    });

    const generation = tool("create_generation_run");
    expect(generation.inputSchema.required).toEqual(["brand_key", "source_card_id"]);
    expect(generation.inputSchema.properties).toMatchObject({
      adaptation_plan: {
        type: "object",
        properties: {
          adaptation_goal: { type: "string" },
          retained_exact_surfaces: { type: "array" },
          intentionally_different_from_prior: { type: "string" },
        },
      },
    });
  });

  it("preserves showable draft lifecycle and rejection evidence requirements", () => {
    const submit = tool("submit_candidate_draft");
    expect(submit.inputSchema.required).toEqual([
      "brand_key",
      "run_id",
      "source_card_id",
      "text",
      "draft_analysis",
    ]);
    expect(submit.description).toContain("Only present the draft when showable=true");

    expect(tool("mark_draft_shown").description).toContain("showable=true");
    expect(tool("save_self_rejected_draft").inputSchema.required).toContain("rejection_reason");
    expect(tool("reject_draft").inputSchema.properties).toHaveProperty("rejection_reason");
    expect(tool("approve_draft").annotations).toMatchObject({ destructiveHint: false });
  });

  it("preserves gate discovery, mutation, and memory-promotion schemas", () => {
    expect(tool("list_active_gates").annotations).toMatchObject({ readOnlyHint: true });
    expect(tool("create_or_update_gate").inputSchema.required).toEqual([
      "brand_key",
      "gate_key",
      "description",
      "stage_scope",
    ]);
    expect(tool("create_or_update_gate").inputSchema.properties).toMatchObject({
      pass_examples: { type: "array" },
      fail_examples: { type: "array" },
      source_memory_ids: { type: "array" },
    });
    expect(tool("promote_memory_to_gate").inputSchema.required).toEqual([
      "brand_key",
      "memory_id",
      "gate_key",
      "stage_scope",
    ]);
  });
});
