import { describe, expect, it } from "vitest";
import {
                                OPERATOR_GOVERNING_STANDARDS,
        OPERATOR_DISCOVERY_EXECUTION_RULE,
    OPERATOR_FAILURE_REPAIR_RULE,
    OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE,
  OPERATOR_MCP_DEFAULT_PROTOCOL_VERSION,
  OPERATOR_MCP_VERSION,
  buildOperatorKeyHandshakeLines,
  buildOperatorMcpInitializeResult,
  buildOperatorMcpInstructions,
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
    expect(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE).toContain("CONTEXT PORT — PASTE INTO NEW CHAT");
    expect(OPERATOR_GOVERNING_STANDARDS.public_schema_refresh_rule).toBe(OPERATOR_PUBLIC_SCHEMA_REFRESH_RULE);
    expect(OPERATOR_FAILURE_REPAIR_RULE).toContain("Alternate tools are required when they are part of root-cause repair");
    expect(OPERATOR_GOVERNING_STANDARDS.failure_repair_rule).toBe(OPERATOR_FAILURE_REPAIR_RULE);
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
