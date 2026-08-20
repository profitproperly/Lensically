import { describe, expect, it } from "vitest";
import {
  prepareSourceDefinedDirectEngineeringCall,
  resolveActionBoundWinningPaths,
  validateHardeningTerminalReconciliation,
  WINNING_PATH_PROMOTIONS,
} from "../src/mandatoryExecutionMap";

describe("mandatory execution map", () => {
  it("preserves lifecycle-bound control-step inputs through both public validation layers", () => {
    const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    const lifecycleGuard = source.indexOf('if (profileId === "control_step") {\n    if (typedLifecycleBound) {');
    const publicInputGuard = source.indexOf('const inputKeys = Object.keys(inputs);', lifecycleGuard);
    const preparedPassThrough = source.indexOf('inputs: { ...inputs },', lifecycleGuard);
    const routedPreparedMarker = source.indexOf('const preparedControlStep = directInputs?.prepared_tool_name === "runGitHubWorkflow";');
    const routedPublicGuard = source.indexOf('if (actionIntent === "advance control step" && directInputs && !preparedControlStep)', routedPreparedMarker);

    expect(lifecycleGuard).toBeGreaterThanOrEqual(0);
    expect(preparedPassThrough).toBeGreaterThan(lifecycleGuard);
    expect(publicInputGuard).toBeGreaterThan(preparedPassThrough);
    expect(routedPreparedMarker).toBeGreaterThan(publicInputGuard);
    expect(routedPublicGuard).toBeGreaterThan(routedPreparedMarker);
  });

  it("binds the neutral case-step prevention to opaque Step-4 identities", () => {
    const prevention = resolveActionBoundWinningPaths("advanceHardeningIncident")
      .find((candidate) => candidate.id === "neutral_case_step_contract");

    expect(prevention).toBeDefined();
    expect(prevention?.action_binding?.tool_names).toContain("advanceHardeningIncident");
        expect(prevention?.winning_path.procedure).toContain(
      "Mutating case Step 4 forwards only the opaque token through executeOperatorCaseAction.",
    );
    expect(prevention?.winning_path.procedure).toContain(
      "Derive the exact case descriptor server-side and reject non-case tokens.",
    );
    expect(prevention?.enforcement_point).toContain("executeOperatorCaseAction");
  });

  it("binds client block intake to the dedicated token-only hardening gateway", () => {
    const prevention = resolveActionBoundWinningPaths("recordHardeningIncident")
      .find((candidate) => candidate.id === "client_safe_hardening_intake_gateway");

    expect(prevention).toBeDefined();
    expect(prevention?.action_binding?.tool_names).toContain("recordHardeningIncident");
    expect(prevention?.winning_path.procedure).toContain(
      "Forward only the opaque live-state token through executeOperatorHardeningAction.",
    );
    expect(prevention?.winning_path.procedure).toContain(
      "Exclude client_block_intake from the generic executeOperatorAction descriptor union.",
    );
    expect(prevention?.enforcement_point).toContain("executeOperatorHardeningAction");
    expect(prevention?.regression_test_id).toBe(
      "routes client block intake only through dedicated token-only hardening gateway",
    );
  });

  it("binds current campaign topology revalidation before stale hardening closure", () => {
    const prevention = resolveActionBoundWinningPaths("runMcpTests")
      .find((candidate) => candidate.id === "current_capability_campaign_topology_revalidation");

    expect(prevention).toBeDefined();
    expect(prevention?.action_binding?.tool_names).toContain("runMcpTests");
    expect(prevention?.winning_path.procedure).toContain(
      "Re-run the exact bounded campaign on the current production SHA and callable topology before advancing a historical campaign incident.",
    );
    expect(prevention?.winning_path.procedure).toContain(
      "If the historically failing member left the callable surface and the exact current segment passes completely, classify the incident as stale validation debt rather than inventing a source defect.",
    );
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

    it("reconciles terminal hardening only from complete persisted closure evidence", () => {
    const completeEvidence = {
      root_cause: "root cause",
      generalized_cause: "generalized cause",
      prevention_rule_id: "server_owned_resumed_hardening_closure",
      regression_test_ids: ["terminal-reconciliation-regression"],
      tested_sha: "0123456789abcdef0123456789abcdef01234567",
      deployment_id: "deployment-id",
      live_verification: { verified: true },
      resume_result: { status: "resumed" },
      autonomy_dividend: { owner_action_required: false },
    };

    expect(validateHardeningTerminalReconciliation(completeEvidence)).toEqual({ allowed: true, errors: [] });

    const incomplete = validateHardeningTerminalReconciliation({
      ...completeEvidence,
      resume_result: null,
    });
    expect(incomplete.allowed).toBe(false);
    expect(incomplete.errors).toContain("resume_result_required");
    expect(incomplete.errors).not.toContain("invalid_transition:resumed:closed");
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
        name: "upsertGitHubRepositoryFile",
        title: "Upsert GitHub repository file",
        description: "Create or replace one bounded text file in an accessible GitHub repository.",
        inputSchema: {
          type: "object",
          properties: {
            repository: { type: "string" },
            path: { type: "string" },
            content: { type: "string" },
            message: { type: "string" },
            operation_id: { type: "string" },
          },
          required: ["repository", "path", "content", "message", "operation_id"],
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
      "apply repo patch set",
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

    const safePrepared = prepareSourceDefinedDirectEngineeringCall(
      "apply repo patch set",
      "Write one bounded file through the dedicated non-destructive GitHub upsert.",
      {
        repository: "opmgdeadman/signal-radar",
        path: "src/mcp.ts",
        content: "export const ok = true;",
        message: "Add MCP bootstrap",
        operation_id: "signal-radar-mcp-bootstrap-v0",
        prepared_tool_name: "upsertGitHubRepositoryFile",
      },
      tools,
    );

    expect(safePrepared?.ok).toBe(true);
    expect(safePrepared?.tool_name).toBe("upsertGitHubRepositoryFile");
    expect(safePrepared?.arguments?.repository).toBe("opmgdeadman/signal-radar");
    expect(safePrepared?.arguments?.operation_id).toBe("signal-radar-mcp-bootstrap-v0");
    expect(safePrepared?.arguments).not.toHaveProperty("prepared_tool_name");
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
