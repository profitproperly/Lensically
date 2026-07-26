import { describe, expect, it } from "vitest";
import {
  OPERATOR_MCP_ENGINEERING_TOOL_NAMES,
  OPERATOR_MCP_ENGINEERING_TOOLS,
} from "../src/operatorMcpEngineeringRegistry";

describe("Operator MCP engineering registry", () => {
  it("preserves the exact 33-tool engineering registry without duplicates", () => {
    expect(OPERATOR_MCP_ENGINEERING_TOOL_NAMES).toHaveLength(33);
    expect(OPERATOR_MCP_ENGINEERING_TOOLS).toHaveLength(33);
    expect(new Set(OPERATOR_MCP_ENGINEERING_TOOL_NAMES).size).toBe(33);
    expect(new Set(OPERATOR_MCP_ENGINEERING_TOOLS.map((tool) => tool.name)).size).toBe(33);
    expect(new Set(OPERATOR_MCP_ENGINEERING_TOOLS.map((tool) => tool.name))).toEqual(
      new Set(OPERATOR_MCP_ENGINEERING_TOOL_NAMES),
    );
  });

  it("preserves source-defined engineering discovery and mutation schemas", () => {
    const byName = new Map(OPERATOR_MCP_ENGINEERING_TOOLS.map((tool) => [tool.name, tool]));
    expect(byName.get("getDatabaseSchemaState")?.inputSchema).toMatchObject({
      required: ["table_name"],
      properties: {
        table_name: { pattern: "^[A-Za-z_][A-Za-z0-9_]*$" },
        column_names: { maxItems: 50 },
      },
    });
    expect(byName.get("executeLensicallyIntent")?.inputSchema).toMatchObject({
      required: ["profile_id", "inputs"],
      additionalProperties: false,
    });
    expect(byName.get("applyRepoPatchSet")?.inputSchema).toMatchObject({
      required: ["patches", "message"],
      properties: { patches: { minItems: 1, maxItems: 20 } },
    });
    expect(byName.get("deleteRepoFile")?.annotations).toMatchObject({ destructiveHint: true });
  });

  it("preserves exact workflow and deployment controls", () => {
    const byName = new Map(OPERATOR_MCP_ENGINEERING_TOOLS.map((tool) => [tool.name, tool]));
    expect(byName.get("runGitHubWorkflow")?.inputSchema).toMatchObject({
      required: ["task"],
      properties: {
        task: {
          enum: [
            "typecheck",
            "operator-smoke",
            "operator-tests",
            "system-directory-tests",
            "threads-publish-tests",
            "human-free-tests",
            "worker-deploy",
          ],
        },
        release_sha: { pattern: "^[a-fA-F0-9]{40}$" },
      },
    });
    expect(byName.get("getGitHubWorkflowRun")?.inputSchema).toMatchObject({
      properties: { wait_seconds: { minimum: 0, maximum: 60 } },
    });
    expect(byName.get("verifyDeployedMcpVersion")?.annotations).toMatchObject({ readOnlyHint: true });
  });
});
