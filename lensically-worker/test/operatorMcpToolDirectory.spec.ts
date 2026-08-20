import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_RETIRED_TOOL_NAMES,
  OPERATOR_PUBLIC_DIRECT_TOOL_NAMES,
  RETIRED_HUMAN_GUIDANCE_TOOL_NAMES,
  countOperatorPublicMcpTools,
  filterOperatorPublicMcpTools,
  findOperatorMcpToolDefinition,
  isOperatorPublicDirectToolName,
} from "../src/operatorMcpToolDirectory";
import type { OperatorMcpToolDefinition } from "../src/operatorMcpToolDefinitions";

const tools: OperatorMcpToolDefinition[] = [
  {
    name: "getOperatorSessionMap",
    title: "Get Operator Session Map",
    description: "Load the lifecycle session map.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "engineeringPrecheck",
    title: "Engineering Precheck",
    description: "Read compact engineering state.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "getGrowthMission",
    title: "Get Growth Mission",
    description: "Read the current growth mission.",
    inputSchema: {
      type: "object",
      properties: { brand_key: { type: "string" } },
      required: ["brand_key"],
      additionalProperties: false,
    },
  },
  {
    name: "get_account_state",
    title: "Get Account State",
    description: "Read account state.",
    inputSchema: {
      type: "object",
      properties: { brand_key: { type: "string" } },
      required: ["brand_key"],
      additionalProperties: false,
    },
  },
  {
    name: "start_workflow_session",
    title: "Start Workflow Session",
    description: "Retired guided workflow tool.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "internal_only_tool",
    title: "Internal Only Tool",
    description: "Not public.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

describe("Operator MCP tool directory", () => {
                                                                it("preserves the eight-tool, five-stage public lifecycle surface while keeping capabilities internal", () => {
    expect(OPERATOR_PUBLIC_DIRECT_TOOL_NAMES.size).toBe(8);
    expect([...OPERATOR_PUBLIC_DIRECT_TOOL_NAMES]).toEqual([
      "getOperatorSessionMap",
      "getOperatorKnowledge",
      "getOperatorLiveState",
      "executeOperatorReadAction",
      "executeOperatorAction",
      "executeOperatorCaseAction",
      "executeOperatorHardeningAction",
      "closeOperatorAction",
    ]);
    expect(isOperatorPublicDirectToolName("getOperatorSessionMap")).toBe(true);
    expect(isOperatorPublicDirectToolName("executeOperatorReadAction")).toBe(true);
    expect(isOperatorPublicDirectToolName("executeOperatorAction")).toBe(true);
    expect(isOperatorPublicDirectToolName("executeOperatorCaseAction")).toBe(true);
    expect(isOperatorPublicDirectToolName("getRepoStatus")).toBe(false);
    expect(isOperatorPublicDirectToolName("searchRepoFiles")).toBe(false);
    expect(isOperatorPublicDirectToolName("operateStripe")).toBe(false);
    expect(isOperatorPublicDirectToolName("prepare_manifest_autonomous_cycle")).toBe(false);

    expect(isOperatorPublicDirectToolName("start_workflow_session")).toBe(false);
    expect(RETIRED_HUMAN_GUIDANCE_TOOL_NAMES.has("start_workflow_session")).toBe(true);
    expect(FORBIDDEN_RETIRED_TOOL_NAMES.has("routeAndExecuteLensicallyCall")).toBe(true);
    for (const retiredName of RETIRED_HUMAN_GUIDANCE_TOOL_NAMES) {
      expect(OPERATOR_PUBLIC_DIRECT_TOOL_NAMES.has(retiredName)).toBe(false);
    }
  });

  it("filters public tools without changing their source order", () => {
        expect(filterOperatorPublicMcpTools(tools).map((tool) => tool.name)).toEqual([
      "getOperatorSessionMap",
    ]);
    expect(countOperatorPublicMcpTools(tools)).toBe(1);
  });

  it("shapes engineering, admin, and backend definitions with required fields", () => {
    const classifications = {
      engineeringToolNames: new Set(["engineeringPrecheck"]),
      adminToolNames: new Set(["getGrowthMission"]),
    };
    expect(findOperatorMcpToolDefinition(tools, "engineeringPrecheck", classifications)).toMatchObject({
      handler: "operator_mcp_engineering_runtime",
      required_fields: [],
    });
    expect(findOperatorMcpToolDefinition(tools, "getGrowthMission", classifications)).toMatchObject({
      handler: "operator_mcp_admin_runtime",
      required_fields: ["brand_key"],
    });
    expect(findOperatorMcpToolDefinition(tools, "get_account_state", classifications)).toMatchObject({
      handler: "operator_tool_backend",
      required_fields: ["brand_key"],
    });
    expect(findOperatorMcpToolDefinition(tools, "missing", classifications)).toBeNull();
  });
});
