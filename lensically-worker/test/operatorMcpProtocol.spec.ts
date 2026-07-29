import { describe, expect, it } from "vitest";
import {
    OPERATOR_GOVERNING_STANDARDS,
  OPERATOR_MCP_DEFAULT_PROTOCOL_VERSION,
  OPERATOR_MCP_VERSION,
  buildOperatorKeyHandshakeLines,
  buildOperatorMcpInitializeResult,
  buildOperatorMcpInstructions,
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
        expect(OPERATOR_GOVERNING_STANDARDS.version).toBe("operator-governing-standards-v3");
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
