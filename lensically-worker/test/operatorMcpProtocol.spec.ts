import { describe, expect, it } from "vitest";
import { sanitizeForLog } from "../auth/logSanitizer.js";
import {
                                                                OPERATOR_GOVERNING_STANDARDS,
    OPERATOR_GOVERNING_STANDARDS_VERSION,
    OPERATOR_ACTION_RULE_REGISTRY_VERSION,
        operatorActionRuleBindingForTool,
    validateOperatorActionRuleBindingContinuity,


        OPERATOR_DISCOVERY_EXECUTION_RULE,
    OPERATOR_FAILURE_REPAIR_RULE,
    OPERATOR_OPAQUE_LIFECYCLE_TOKEN_RULE,
    OPERATOR_CLIENT_PREDISPATCH_BLOCK_RULE,
    OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE,
    OPERATOR_CONVERSATIONAL_PROBLEM_INTAKE_RULE,
    OPERATOR_TURN_CLOSE_RULE,
  OPERATOR_MCP_DEFAULT_PROTOCOL_VERSION,
  OPERATOR_MCP_VERSION,
  buildOperatorKeyHandshakeLines,
  buildOperatorMcpInitializeResult,
  buildOperatorMcpInstructions,
  buildOperatorLifecycleReferenceId,
  normalizeOperatorLifecycleReference,
  buildOperatorOpaqueLifecycleTokenTelemetry,
  evaluateOperatorDeploymentCommitIdentity,
} from "../src/operatorMcpProtocol";

describe("Operator MCP protocol contract", () => {
  it("builds the exact default initialize payload", () => {
    expect(buildOperatorMcpInitializeResult(undefined, 75)).toEqual({
      protocolVersion: OPERATOR_MCP_DEFAULT_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: true } },
      serverInfo: {
        name: "lensically-operator-mode",
        title: "Lensically Operator Mode",
        version: OPERATOR_MCP_VERSION,
      },
      instructions: buildOperatorMcpInstructions(75),
    });
  });

  it("fingerprints opaque lifecycle values without exposing them and survives log sanitization", async () => {
    const original = "opaque.payload.signature";
    const mutated = "opaque.payloae.signature";
    const originalTelemetry = await buildOperatorOpaqueLifecycleTokenTelemetry(original);
    const repeatedTelemetry = await buildOperatorOpaqueLifecycleTokenTelemetry(original);
    const mutatedTelemetry = await buildOperatorOpaqueLifecycleTokenTelemetry(mutated);

    expect(originalTelemetry).toEqual(repeatedTelemetry);
    expect(originalTelemetry.opaque_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(originalTelemetry.opaque_length).toBe(original.length);
    expect(originalTelemetry.opaque_segment_count).toBe(3);
    expect(mutatedTelemetry.opaque_sha256).not.toBe(originalTelemetry.opaque_sha256);
    expect(originalTelemetry).not.toHaveProperty("token");
    expect(originalTelemetry).not.toHaveProperty("raw_token");
    expect(sanitizeForLog(originalTelemetry)).toEqual(originalTelemetry);
    expect(await buildOperatorOpaqueLifecycleTokenTelemetry(null)).toEqual({
      opaque_sha256: null,
      opaque_length: 0,
      opaque_segment_count: 0,
    });
  });

  it("keeps lifecycle continuation references short, opaque, and copy-stable", () => {
    const reference = buildOperatorLifecycleReferenceId("123e4567-e89b-12d3-a456-426614174000");
    expect(reference).toBe("olr_123e4567e89b12d3a456426614174000");
    expect(reference.length).toBe(36);
    expect(normalizeOperatorLifecycleReference(reference)).toBe(reference);
    expect(normalizeOperatorLifecycleReference(reference.toUpperCase())).toBeNull();
    expect(normalizeOperatorLifecycleReference(` ${reference}`)).toBeNull();
    expect(normalizeOperatorLifecycleReference(`${reference}x`)).toBeNull();
    expect(() => buildOperatorLifecycleReferenceId("not-a-uuid")).toThrow("operator_lifecycle_reference_uuid_invalid");
  });

    it("fails closed when the executing handler and fresh endpoint commits differ", () => {
    const same = evaluateOperatorDeploymentCommitIdentity(
      "9dfff53b851f0b81358f70ad4a497e651098373c",
      "9DFFF53B851F0B81358F70AD4A497E651098373C",
    );
    expect(same).toMatchObject({
      commit_match: true,
      verification_ready: true,
      session_refresh_required: false,
      error: null,
    });

    const mismatch = evaluateOperatorDeploymentCommitIdentity(
      "df38ef3772dbfa15be89df4b949a4c880ae9d707",
      "9dfff53b851f0b81358f70ad4a497e651098373c",
    );
    expect(mismatch).toMatchObject({
      commit_match: false,
      verification_ready: false,
      session_refresh_required: true,
      error: "mcp_session_commit_mismatch",
    });

    const unavailable = evaluateOperatorDeploymentCommitIdentity(null, "9dfff53b851f0b81358f70ad4a497e651098373c");
    expect(unavailable).toMatchObject({
      commits_comparable: false,
      verification_ready: false,
      session_refresh_required: false,
      error: "deployment_commit_identity_unavailable",
    });
  });

    it("keeps MCP initialize as a tiny Step-0 bootloader while preserving full governance downstream", () => {
    const result = buildOperatorMcpInitializeResult(" 2025-03-26 ", 112);
    expect(result.protocolVersion).toBe("2025-03-26");
    const instructions = String(result.instructions);
    expect(instructions.split("\n")).toEqual([
      "Governing standards: Autonomy. Efficiency. Prevention.",
      "Do not rush. Do not skip. Do not bypass. Do not work around unresolved problems. Use the fastest complete route, fix the actual problem, prevent recurrence, and then continue.",
      "Call getOperatorSessionMap before any other Lensically Operator Mode tool.",
    ]);
    expect(instructions.length).toBeLessThan(1000);
    expect(instructions).not.toContain("# 1. AUTONOMY");
    expect(instructions).not.toContain("Full tool surface loaded");
    expect(instructions).not.toContain("A retry is not prevention.");
            expect(OPERATOR_GOVERNING_STANDARDS.version).toBe(OPERATOR_GOVERNING_STANDARDS_VERSION);
    expect(OPERATOR_GOVERNING_STANDARDS.exact_owner_approved_text).toContain("A retry is not prevention.");
    expect(OPERATOR_GOVERNING_STANDARDS.exact_owner_approved_text).toContain("A note in chat memory is not enforcement.");
    expect(OPERATOR_DISCOVERY_EXECUTION_RULE).toContain("never authorize execution");
    expect(OPERATOR_GOVERNING_STANDARDS.discovery_execution_rule).toBe(OPERATOR_DISCOVERY_EXECUTION_RULE);
        expect(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE).toContain("exactly one operational trigger");
    expect(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE).toContain("still advertises the pre-change public schema");
    expect(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE).toContain("cannot correctly use the newly deployed invocation contract");
    expect(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE).toContain("If the changed tools or actions are already surfaced and usable, do not request an MCP refresh and do not instruct the owner to start a new chat");
    expect(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE).toContain("client-side block");
    expect(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE).toContain("No other rule may independently request an MCP refresh or a new chat");
    expect(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE).toContain("mandatory client-refresh boundary");
    expect(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE).not.toContain("Operator MCP runtime-behavior change");
    expect(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE).toContain("CONTEXT PORT — PASTE INTO NEW CHAT");
    expect(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE).toContain("ENGINEERING_CONTINUATION.md is the canonical continuation authority");
    expect(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE).toContain("bootstrap-only");
    expect(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE).toContain("must not duplicate ECL history, evidence, constraints, deployment state, or next-step detail");
    expect(OPERATOR_GOVERNING_STANDARDS.public_schema_refresh_rule).toBe(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE);
    expect(OPERATOR_CONVERSATIONAL_PROBLEM_INTAKE_RULE).toContain("activates immediately at problem intake");
    expect(OPERATOR_CONVERSATIONAL_PROBLEM_INTAKE_RULE).toContain("an explicit statement of what will be implemented next");
    expect(OPERATOR_CONVERSATIONAL_PROBLEM_INTAKE_RULE).toContain("Do not stop at explanation-only");
    expect(OPERATOR_CONVERSATIONAL_PROBLEM_INTAKE_RULE).toContain("Do not invent work after closure");
    expect(OPERATOR_GOVERNING_STANDARDS.conversational_problem_intake_rule).toBe(OPERATOR_CONVERSATIONAL_PROBLEM_INTAKE_RULE);
    expect(OPERATOR_TURN_CLOSE_RULE).toContain("blocked work enters repair mode and never terminal mode");
    expect(OPERATOR_TURN_CLOSE_RULE).toContain("Lifecycle action closure closes one action only");
    expect(OPERATOR_TURN_CLOSE_RULE).toContain("Status reporting may describe progress but may not substitute for execution");
    expect(OPERATOR_GOVERNING_STANDARDS.turn_close_rule).toBe(OPERATOR_TURN_CLOSE_RULE);
    expect(OPERATOR_FAILURE_REPAIR_RULE).toContain("Alternate tools are required when they are part of root-cause repair");
    expect(OPERATOR_GOVERNING_STANDARDS.failure_repair_rule).toBe(OPERATOR_FAILURE_REPAIR_RULE);
    expect(OPERATOR_OPAQUE_LIFECYCLE_TOKEN_RULE).toContain("short opaque continuation references");
    expect(OPERATOR_OPAQUE_LIFECYCLE_TOKEN_RULE).toContain("remain server-side");
    expect(OPERATOR_OPAQUE_LIFECYCLE_TOKEN_RULE).toContain("byte-for-byte");
    expect(OPERATOR_OPAQUE_LIFECYCLE_TOKEN_RULE).toContain("Never decode, reconstruct, transcribe, normalize, trim, edit");
    expect(OPERATOR_OPAQUE_LIFECYCLE_TOKEN_RULE).toContain("copy-only atomic value");
    expect(OPERATOR_OPAQUE_LIFECYCLE_TOKEN_RULE).toContain("never retry the corrupted reference");
    expect(OPERATOR_GOVERNING_STANDARDS.opaque_lifecycle_token_rule).toBe(OPERATOR_OPAQUE_LIFECYCLE_TOKEN_RULE);
        expect(OPERATOR_CLIENT_PREDISPATCH_BLOCK_RULE).toContain("before it reaches Lensically");
    expect(OPERATOR_CLIENT_PREDISPATCH_BLOCK_RULE).not.toContain("fresh MCP/client transport");
    expect(OPERATOR_CLIENT_PREDISPATCH_BLOCK_RULE).toContain("never authorizes an MCP refresh or a new-chat instruction");
    expect(OPERATOR_CLIENT_PREDISPATCH_BLOCK_RULE).toContain("current chat is surfacing a stale public schema and cannot use the newly deployed contract");
    expect(OPERATOR_CLIENT_PREDISPATCH_BLOCK_RULE).toContain("server-side evidence");
    expect(OPERATOR_GOVERNING_STANDARDS.client_predispatch_block_rule).toBe(OPERATOR_CLIENT_PREDISPATCH_BLOCK_RULE);
    expect(OPERATOR_GOVERNING_STANDARDS.standards.map((standard) => standard.key)).toEqual(["autonomy", "efficiency", "prevention"]);
    const readCompetencies = ["governance", "repository_engineering"];
    const readRules = operatorActionRuleBindingForTool("readRepoFile", { path: "lensically-worker/src/index.ts", max_lines: 400 }, readCompetencies);
    expect(readRules.registry_version).toBe(OPERATOR_ACTION_RULE_REGISTRY_VERSION);
    expect(readRules.rule_ids).toContain("schema.declared_bounds_hard");
    expect(readRules.rule_ids).toContain("repository.known_file_read");
    expect(readRules.competency_ids).toEqual(readCompetencies);
    expect(readRules.rule_ids).toContain("competency.governance");
    expect(readRules.rule_ids).toContain("competency.repository_engineering");
    expect(readRules.rule_ids).toContain("prevention.typed_profile_exact_contract");
    expect(readRules.prevention_rule_ids).toContain("typed_profile_exact_contract");
    const caseStepRules = operatorActionRuleBindingForTool("advanceHardeningIncident", {});
    expect(caseStepRules.rule_ids).toEqual(expect.arrayContaining([
      "prevention.typed_profile_exact_contract",
      "prevention.neutral_case_step_contract",
    ]));
    expect(caseStepRules.prevention_rule_ids).toEqual(expect.arrayContaining([
      "typed_profile_exact_contract",
      "neutral_case_step_contract",
    ]));
    const patchRules = operatorActionRuleBindingForTool("applyRepoPatchSet", {});
    expect(patchRules.rule_ids).toContain("repository.contiguous_source_anchor");
    expect(patchRules.rule_ids).toContain("repository.non_whitespace_semantic_anchor");
        const releaseRules = operatorActionRuleBindingForTool("runGitHubWorkflow", { task: "worker-deploy" });
    expect(releaseRules.rule_ids).toContain("release.exact_validated_head");
    expect(releaseRules.rule_ids).toContain("release.no_active_content_cycle");
    const continuityPayload = {
      action_rule_registry_version: readRules.registry_version,
      winning_path_registry_version: readRules.winning_path_registry_version,
      action_intelligence_version: readRules.action_intelligence_version,
      competency_ids: readRules.competency_ids,
      action_rule_ids: readRules.rule_ids,
      prevention_rule_ids: readRules.prevention_rule_ids,
      action_intelligence_ids: readRules.action_intelligence_ids,
    };
    expect(validateOperatorActionRuleBindingContinuity("readRepoFile", { path: "lensically-worker/src/index.ts" }, continuityPayload, readCompetencies).ok).toBe(true);
    expect(validateOperatorActionRuleBindingContinuity("readRepoFile", { path: "lensically-worker/src/index.ts" }, { ...continuityPayload, action_rule_ids: [...readRules.rule_ids].reverse() }, readCompetencies).ok).toBe(false);
    expect(validateOperatorActionRuleBindingContinuity("readRepoFile", { path: "lensically-worker/src/index.ts" }, { ...continuityPayload, prevention_rule_ids: undefined }, readCompetencies).ok).toBe(false);
    expect(validateOperatorActionRuleBindingContinuity("readRepoFile", { path: "lensically-worker/src/index.ts" }, { ...continuityPayload, action_intelligence_ids: undefined }, readCompetencies).ok).toBe(false);
    expect(validateOperatorActionRuleBindingContinuity("readRepoFile", { path: "lensically-worker/src/index.ts" }, { ...continuityPayload, competency_ids: undefined }, readCompetencies).ok).toBe(false);
    expect(readRules.action_intelligence_ids).toEqual(expect.arrayContaining(["typed_profile_exact_contract", "client_safe_step4_execution_descriptor"]));
    expect(readRules.action_intelligence.find((entry) => entry.intelligence_id === "client_safe_step4_execution_descriptor")).toMatchObject({
      prevention_rule_id: "client_safe_step4_execution_descriptor",
    });
    const futureRules = operatorActionRuleBindingForTool("futureRegisteredTool", {}, ["governance", "account_runtime"]);
    expect(futureRules.competency_ids).toEqual(["governance", "account_runtime"]);
    expect(futureRules.rule_ids).toContain("competency.account_runtime");
    expect(futureRules.prevention_rule_ids).toContain("typed_profile_exact_contract");
    expect(futureRules.rule_ids).toContain("prevention.typed_profile_exact_contract");


  });

    it("builds the visible standards-first selected-key handshake", () => {
    expect(buildOperatorKeyHandshakeLines(75, "manifest_mental")).toEqual([
      "Governing standards: Autonomy. Efficiency. Prevention.",
      "Do not rush. Do not skip. Do not bypass. Do not work around unresolved problems. Use the fastest complete route, fix the actual problem, prevent recurrence, and then continue.",
      "Lensically Operator Mode MCP is active.",
      "Selected key: manifest_mental",
      "Full tool surface loaded: 75 tools available and usable.",
      "Proceed to the next step?",
    ]);
  });
});
