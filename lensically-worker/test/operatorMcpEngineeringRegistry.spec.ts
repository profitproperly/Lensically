import { describe, expect, it } from "vitest";
import {
  OPERATOR_MCP_ENGINEERING_TOOL_NAMES,
  OPERATOR_MCP_ENGINEERING_TOOLS,
} from "../src/operatorMcpEngineeringRegistry";

describe("Operator MCP engineering registry", () => {
        it("preserves the exact 37-tool engineering registry without duplicates", () => {
    expect(OPERATOR_MCP_ENGINEERING_TOOL_NAMES).toHaveLength(37);
    expect(OPERATOR_MCP_ENGINEERING_TOOLS).toHaveLength(37);
    expect(new Set(OPERATOR_MCP_ENGINEERING_TOOL_NAMES).size).toBe(37);
    expect(new Set(OPERATOR_MCP_ENGINEERING_TOOLS.map((tool) => tool.name)).size).toBe(37);
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
        expect(byName.get("getOperatorSessionMap")?.annotations).toMatchObject({ readOnlyHint: true });
                expect(byName.get("getOperatorKnowledge")?.inputSchema).toMatchObject({ required: ["session_map_token", "planned_action"], additionalProperties: false });
    expect(byName.get("getOperatorKnowledge")?.inputSchema?.properties).not.toHaveProperty("node_ids");
    expect(byName.get("getOperatorLiveState")?.inputSchema).toMatchObject({ required: ["knowledge_token"], additionalProperties: false });
    expect(byName.get("getOperatorLiveState")?.inputSchema?.properties).not.toHaveProperty("scopes");
    expect(byName.get("getOperatorLiveState")?.inputSchema?.properties).not.toHaveProperty("brand_key");
        expect(byName.get("executeOperatorAction")?.inputSchema).toMatchObject({ required: ["live_state_token"], additionalProperties: false });
    expect(byName.get("executeOperatorAction")?.inputSchema?.properties).not.toHaveProperty("action");
    expect(byName.get("executeOperatorAction")?.description).toContain("server-bound action");
    expect(byName.get("closeOperatorAction")?.inputSchema).toMatchObject({ required: ["action_execution_token", "verification"], additionalProperties: false });
    expect(byName.get("closeOperatorAction")?.inputSchema?.properties).not.toHaveProperty("action");
    expect(byName.get("applyRepoPatchSet")?.inputSchema).toMatchObject({
      required: ["patches", "message"],
      properties: { patches: { minItems: 1, maxItems: 20 } },
    });
        expect(byName.get("deleteRepoFile")?.annotations).toMatchObject({ destructiveHint: true });
    expect(byName.get("operateGitHubRepositories")?.inputSchema).toMatchObject({
      required: ["operation"],
      properties: {
        operation: {
          enum: [
            "list_repositories",
            "get_repository",
            "list_files",
            "read_file",
            "search_file",
            "upsert_file",
            "patch_file",
            "delete_file",
            "list_workflow_runs",
            "dispatch_workflow",
            "get_workflow_run",
          ],
        },
                repository: { pattern: "^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)?$" },
        path: { description: expect.stringContaining("Exact repository-relative file path") },
        prefix: { description: expect.stringContaining("search_file") },
        limit: { maximum: 500 },
      },
    });
    expect(byName.get("operateGitHubRepositories")?.annotations).toMatchObject({ destructiveHint: true, openWorldHint: true });

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
