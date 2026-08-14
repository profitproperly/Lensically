import { describe, expect, it } from "vitest";
import {
                OPERATOR_GOVERNING_STANDARDS,
  OPERATOR_BLOCKER_HALT_RULE,
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

  it("preserves requested protocol negotiation and tool-count interpolation", () => {
    const result = buildOperatorMcpInitializeResult(" 2025-03-26 ", 112);
    expect(result.protocolVersion).toBe("2025-03-26");
        expect(String(result.instructions)).toContain("Full tool surface loaded: 112 tools available and usable.");
    expect(String(result.instructions)).toContain("Call the advertised direct typed tool");
        expect(String(result.instructions).split("\n").slice(0, 2)).toEqual([
      "# LENSICALLY OPERATOR MODE — STARTUP AUTHORITY",
      "",
    ]);
        expect(String(result.instructions)).toContain("A note in chat memory is not enforcement.");
    expect(String(result.instructions)).toContain("Resume the original objective only after prevention is locked in.");
    expect(String(result.instructions)).toContain("The requirement is the fastest complete, correct, verified, and durable route.");
                expect(OPERATOR_GOVERNING_STANDARDS.version).toBe("operator-governing-standards-v4");
    expect(String(result.instructions)).toContain("# MANDATORY BLOCKER HALT RULE");
    expect(String(result.instructions)).toContain("Do not switch target forms.");
    expect(OPERATOR_GOVERNING_STANDARDS.blocker_halt_rule).toBe(OPERATOR_BLOCKER_HALT_RULE);
    expect(OPERATOR_GOVERNING_STANDARDS.per_action_enforcement).toContain("rejects missing or altered acknowledgment");
    expect(OPERATOR_GOVERNING_STANDARDS.exact_spec_execution_rule).toContain("Do not reinterpret, condense, redesign, or restart discovery.");
                expect(OPERATOR_GOVERNING_STANDARDS.prevention_closure_rule).toContain("may not end with analysis");
    expect(OPERATOR_GOVERNING_STANDARDS.prevention_closure_rule).toContain("durable prevention evidence must exist");
    expect(OPERATOR_GOVERNING_STANDARDS.exact_owner_approved_text).toContain("A retry is not prevention.");
    expect(OPERATOR_GOVERNING_STANDARDS.exact_owner_approved_text).toContain("A note in chat memory is not enforcement.");
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
