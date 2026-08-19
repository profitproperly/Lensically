import { describe, expect, it } from "vitest";
import { prepareSourceDefinedDirectEngineeringCall, resolveActionBoundWinningPaths, WINNING_PATH_PROMOTIONS } from "../src/mandatoryExecutionMap";

describe("mandatory execution map", () => {
  it("binds the neutral case-step prevention to opaque Step-4 identities", () => {
    const prevention = resolveActionBoundWinningPaths("advanceHardeningIncident")
      .find((candidate) => candidate.id === "neutral_case_step_contract");

    expect(prevention).toBeDefined();
    expect(prevention?.action_binding?.tool_names).toContain("advanceHardeningIncident");
        expect(prevention?.winning_path.procedure).toContain(
      "Derive stable opaque Step-4 action identities exec_02_00 through exec_02_10 from the immutable prepared stage so consecutive transitions remain client-distinguishable without exposing hardening semantics.",
    );
    expect(prevention?.winning_path.procedure).toContain(
      "Route mutating case_step descriptors only through the dedicated executeOperatorCaseAction public Step-4 gateway; keep case dry-runs on executeOperatorReadAction and reject case tokens on executeOperatorAction.",
    );
    expect(prevention?.enforcement_point).toContain("executeOperatorCaseAction");
  });

  it("closes stored-verified resumed hardening incidents without client finalization", () => {
    const prevention = WINNING_PATH_PROMOTIONS
      .find((candidate) => candidate.id === "server_owned_resumed_hardening_closure");

    expect(prevention).toBeDefined();
    expect(prevention?.status).toBe("active");
    expect(prevention?.binding_scope).toBe("runtime_guard");
    expect(prevention?.action_binding).toBeUndefined();
    expect(prevention?.winning_path.procedure).toContain(
      "Consider only incidents already in resumed state; never server-advance an incident that has not passed the explicit resume gate.",
    );
    expect(prevention?.winning_path.procedure).toContain(
      "Treat the incident's stored tested SHA and deployment ID as the exact verified release evidence even if a later Worker deployment is running when closure bookkeeping occurs.",
    );
  });

  it("binds declared first-party workflow inputs before GitHub dispatch", () => {
    const prevention = resolveActionBoundWinningPaths("operateGitHubRepositories")
      .find((candidate) => candidate.id === "workflow_dispatch_declared_input_contract");

    expect(prevention).toBeDefined();
    expect(prevention?.status).toBe("active");
    expect(prevention?.action_binding?.tool_names).toContain("operateGitHubRepositories");
    expect(prevention?.winning_path.procedure).toContain(
      "Reject unknown or missing known-workflow inputs locally before the GitHub workflow dispatch POST.",
    );
        expect(prevention?.regression_test_id).toBe(
      "enforces declared Lensically Engineering workflow dispatch inputs before GitHub transport",
    );
  });

    it("binds the Manifest shadow minimum-family single-source prevention to preparation", () => {
    const prevention = resolveActionBoundWinningPaths("prepareManifestShadowCycle")
      .find((candidate) => candidate.id === "manifest_shadow_minimum_family_single_source_contract");

    expect(prevention).toBeDefined();
    expect(prevention?.status).toBe("active");
    expect(prevention?.action_binding?.tool_names).toContain("prepareManifestShadowCycle");
    expect(prevention?.winning_path.procedure).toContain(
      "Define the minimum eligible-family threshold only in operatorManifestShadowRuntimeService; composition roots must not inject a second threshold.",
    );
  });

  it("routes cross-repository GitHub mutations through the generic GitHub operator without reinterpretation", () => {
    const tools = [
      {
        name: "operateGitHubRepositories",
        title: "Operate GitHub repositories",
        description: "Perform bounded operations against explicitly named accessible repositories.",
        inputSchema: {
          type: "object",
          properties: {
            operation: { type: "string" },
            repository: { type: "string" },
            path: { type: "string" },
            content: { type: "string" },
            message: { type: "string" },
          },
          required: ["operation"],
          additionalProperties: false,
        },
      },
      {
        name: "applyRepoPatchSet",
        title: "Apply atomic repo patch set",
        description: "Apply exact replacements in the configured Lensically repository.",
        inputSchema: {
          type: "object",
          properties: { patches: { type: "array" }, message: { type: "string" } },
          required: ["patches", "message"],
          additionalProperties: false,
        },
      },
    ];

    const prepared = prepareSourceDefinedDirectEngineeringCall(
      "operate git hub repositories",
      "Write one bounded file in an explicitly named accessible repository.",
      {
        operation: "upsert_file",
        repository: "opmgdeadman/signal-radar",
        path: "src/mcp.ts",
        content: "export const ok = true;",
        message: "Add MCP bootstrap",
      },
      tools,
    );

    expect(prepared?.ok).toBe(true);
    expect(prepared?.tool_name).toBe("operateGitHubRepositories");
    expect(prepared?.arguments?.operation).toBe("upsert_file");
    expect(prepared?.arguments?.repository).toBe("opmgdeadman/signal-radar");
  });

  it("omits absent optional non-null fields instead of serializing null", () => {
    const prevention = resolveActionBoundWinningPaths("closeOperatorAction")
      .find((candidate) => candidate.id === "optional_nonnull_field_omission_contract");

    expect(prevention).toBeDefined();
    expect(prevention?.status).toBe("active");
    expect(prevention?.action_binding?.tool_names).toContain("*");
    expect(prevention?.winning_path.procedure).toContain(
      "When an optional field has no value and its declared type is non-null, omit the key entirely.",
    );
    expect(prevention?.winning_path.procedure).toContain(
      "Send explicit null only when the schema explicitly permits null.",
    );
  });
});
