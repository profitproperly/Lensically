import { describe, expect, it } from "vitest";
import {
  addOperatorExecutionMetadataSchema,
  buildOperatorMcpToolDefinitions,
  cloneOperatorMcpTool,
  createScopedOperatorWrapperTool,
  type OperatorMcpToolDefinition,
} from "../src/operatorMcpToolDefinitions";

const accountTool: OperatorMcpToolDefinition = {
  name: "get_account_state",
  title: "Get Account State",
  description: "Read account state.",
  inputSchema: {
    type: "object",
    properties: {
      brand_key: { type: "string" },
      detail: { type: "string" },
    },
    required: ["brand_key", "detail"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true },
};

describe("Operator MCP tool-definition construction", () => {
  it("deep-clones definitions without mutating the source", () => {
    const cloned = cloneOperatorMcpTool(accountTool);
    const clonedProperties = cloned.inputSchema.properties as Record<string, unknown>;
    delete clonedProperties.brand_key;
    expect((accountTool.inputSchema.properties as Record<string, unknown>).brand_key).toEqual({ type: "string" });
  });

  it("builds account-scoped wrappers without brand_key", () => {
    const wrapper = createScopedOperatorWrapperTool(accountTool, "mm", "Manifest", "Manifest Mental");
    expect(wrapper).toMatchObject({
      name: "mm_get_account_state",
      title: "Manifest Get Account State",
    });
    expect(wrapper.description).toContain("automatically scopes the call to Manifest Mental");
    expect(wrapper.inputSchema.properties).toEqual({ detail: { type: "string" } });
    expect(wrapper.inputSchema.required).toEqual(["detail"]);
    expect(wrapper.inputSchema.additionalProperties).toBe(false);
  });

  it("adds execution metadata only to the returned clone", () => {
    const enriched = addOperatorExecutionMetadataSchema(accountTool, true);
    expect(enriched.inputSchema.properties).toMatchObject({
      brand_key: { type: "string" },
      proceed_confirmed: { type: "boolean" },
      operation_id: { type: "string" },
    });
    expect(accountTool.inputSchema.properties).not.toHaveProperty("proceed_confirmed");
  });

  it("builds three scoped account wrappers and preserves priority order", () => {
    const engineeringTool: OperatorMcpToolDefinition = {
      name: "engineeringPrecheck",
      title: "Engineering Precheck",
      description: "Check engineering readiness.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    };
    const tools = buildOperatorMcpToolDefinitions({
      engineeringTools: [engineeringTool],
      adminTools: [],
      accountTools: [accountTool],
      includeScopedWrappers: true,
      directPriorities: new Map([["engineeringPrecheck", 0], ["get_account_state", 10]]),
      requiresProceed: (toolName) => toolName !== "engineeringPrecheck",
    });

    expect(tools.map((tool) => tool.name)).toEqual([
      "engineeringPrecheck",
      "get_account_state",
      "mm_get_account_state",
      "om_get_account_state",
      "vx_get_account_state",
    ]);
    expect(tools.find((tool) => tool.name === "get_account_state")?.inputSchema.properties).toHaveProperty("proceed_confirmed");
    expect(tools.find((tool) => tool.name === "engineeringPrecheck")?.inputSchema.properties).not.toHaveProperty("proceed_confirmed");
  });
});
