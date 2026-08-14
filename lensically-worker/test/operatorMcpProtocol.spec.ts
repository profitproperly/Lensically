import { describe, expect, it } from "vitest";
import {
                                OPERATOR_GOVERNING_STANDARDS,
        OPERATOR_DISCOVERY_EXECUTION_RULE,
    OPERATOR_FAILURE_REPAIR_RULE,
    OPERATOR_OPAQUE_LIFECYCLE_TOKEN_RULE,
    OPERATOR_CLIENT_PREDISPATCH_BLOCK_RULE,
    OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE,
    OPERATOR_CONVERSATIONAL_PROBLEM_INTAKE_RULE,
  OPERATOR_MCP_DEFAULT_PROTOCOL_VERSION,
  OPERATOR_MCP_VERSION,
  buildOperatorKeyHandshakeLines,
  buildOperatorMcpInitializeResult,
  buildOperatorMcpInstructions,
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

  it("fingerprints opaque lifecycle tokens without exposing or normalizing them", async () => {
    const original = "opaque.payload.signature";
    const mutated = "opaque.payloae.signature";
    const originalTelemetry = await buildOperatorOpaqueLifecycleTokenTelemetry(original);
    const repeatedTelemetry = await buildOperatorOpaqueLifecycleTokenTelemetry(original);
    const mutatedTelemetry = await buildOperatorOpaqueLifecycleTokenTelemetry(mutated);

    expect(originalTelemetry).toEqual(repeatedTelemetry);
    expect(originalTelemetry.token_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(originalTelemetry.token_length).toBe(original.length);
    expect(originalTelemetry.token_segment_count).toBe(3);
    expect(mutatedTelemetry.token_sha256).not.toBe(originalTelemetry.token_sha256);
    expect(originalTelemetry).not.toHaveProperty("token");
    expect(originalTelemetry).not.toHaveProperty("raw_token");
    expect(await buildOperatorOpaqueLifecycleTokenTelemetry(null)).toEqual({
      token_sha256: null,
      token_length: 0,
      token_segment_count: 0,
    });
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
    expect(OPERATOR_GOVERNING_STANDARDS.version).toBe("operator-governing-standards-v7");
    expect(OPERATOR_GOVERNING_STANDARDS.exact_owner_approved_text).toContain("A retry is not prevention.");
    expect(OPERATOR_GOVERNING_STANDARDS.exact_owner_approved_text).toContain("A note in chat memory is not enforcement.");
    expect(OPERATOR_DISCOVERY_EXECUTION_RULE).toContain("never authorize execution");
    expect(OPERATOR_GOVERNING_STANDARDS.discovery_execution_rule).toBe(OPERATOR_DISCOVERY_EXECUTION_RULE);
    expect(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE).toContain("Operator MCP runtime-behavior change");
    expect(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE).toContain("mandatory client-refresh boundary");
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
    expect(OPERATOR_FAILURE_REPAIR_RULE).toContain("Alternate tools are required when they are part of root-cause repair");
    expect(OPERATOR_GOVERNING_STANDARDS.failure_repair_rule).toBe(OPERATOR_FAILURE_REPAIR_RULE);
    expect(OPERATOR_OPAQUE_LIFECYCLE_TOKEN_RULE).toContain("byte-for-byte");
    expect(OPERATOR_OPAQUE_LIFECYCLE_TOKEN_RULE).toContain("Never decode, reconstruct, transcribe, normalize, trim, edit");
    expect(OPERATOR_OPAQUE_LIFECYCLE_TOKEN_RULE).toContain("copy-only atomic value");
    expect(OPERATOR_OPAQUE_LIFECYCLE_TOKEN_RULE).toContain("stop before making the next lifecycle call");
    expect(OPERATOR_OPAQUE_LIFECYCLE_TOKEN_RULE).toContain("never retry the corrupted token");
    expect(OPERATOR_GOVERNING_STANDARDS.opaque_lifecycle_token_rule).toBe(OPERATOR_OPAQUE_LIFECYCLE_TOKEN_RULE);
    expect(OPERATOR_CLIENT_PREDISPATCH_BLOCK_RULE).toContain("before it reaches Lensically");
    expect(OPERATOR_CLIENT_PREDISPATCH_BLOCK_RULE).toContain("fresh MCP/client transport");
    expect(OPERATOR_CLIENT_PREDISPATCH_BLOCK_RULE).toContain("Do not retry or reshape the blocked request in the same connection");
    expect(OPERATOR_CLIENT_PREDISPATCH_BLOCK_RULE).toContain("server-side evidence");
    expect(OPERATOR_GOVERNING_STANDARDS.client_predispatch_block_rule).toBe(OPERATOR_CLIENT_PREDISPATCH_BLOCK_RULE);
    expect(OPERATOR_GOVERNING_STANDARDS.standards.map((standard) => standard.key)).toEqual(["autonomy", "efficiency", "prevention"]);
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
