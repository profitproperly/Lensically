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
      "LENSICALLY OPERATOR MODE STARTUP AUTHORITY — READ FIRST.",
      "GOVERNING STANDARDS: AUTONOMY. EFFICIENCY. PREVENTION.",
    ]);
    expect(String(result.instructions)).toContain("Do not bypass fixes.");
    expect(String(result.instructions)).toContain("same failure twice is unacceptable");
    expect(OPERATOR_GOVERNING_STANDARDS.standards.map((standard) => standard.key)).toEqual(["autonomy", "efficiency", "prevention"]);
  });

  it("builds the exact four-line selected-key handshake", () => {
    expect(buildOperatorKeyHandshakeLines(75, "manifest_mental")).toEqual([
      "Lensically Operator Mode MCP is active.",
      "Selected key: manifest_mental",
      "Full tool surface loaded: 75 tools available and usable.",
      "Proceed to the next step?",
    ]);
  });
});
