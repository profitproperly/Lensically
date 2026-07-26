export const OPERATOR_MCP_VERSION = "1.40.3";
export const OPERATOR_MCP_DEFAULT_PROTOCOL_VERSION = "2025-06-18";

export type OperatorMcpBrandKey = "manifest_mental" | "opmg_deadman" | "vectrix";

export function buildOperatorMcpInstructions(toolCount: number): string {
  return [
    "Use Lensically Operator Mode as the source of truth.",
    "Call the advertised direct typed tool that matches the requested operation. Do not send profile IDs, generic inputs envelopes, freehand routing text, wrappers, or internal handler names.",
    "Tool discovery, schema loading, and tools/list are preparation only and never count as execution.",
    "When an owner or scheduled task explicitly names a direct typed tool, invoke that exact tool immediately once it is available; do not answer in prose between discovery and invocation.",
    "Never report a safety block, timeout, connector error, backend failure, attempted execution, or completed execution unless the exact tool invocation returned evidence for that status. Without a tool result, the only valid status is not invoked, and the next action is to invoke it.",
    "Autonomous Manifest cycle tools execute directly without an interactive Proceed handshake. Guided account workflows may still require explicit Proceed before account data loads.",
    "After Proceed, reconcile live schedule, delivery, metrics, strategy, incidents, and durable cycle state, then resume the active autonomous outcome. Stale continuity summaries never override live state.",
    "Routine engineering uses bounded known-file inspection, one coherent change set, focused validation, one exact-head release, and compact receipts.",
    "Use Recovery only when the main Worker or deployment plane cannot receive or complete the repair.",
    "Canonical brand keys are manifest_mental, opmg_deadman, and vectrix.",
    "For guided account workflows only, use the exact four-line selected-key handshake returned by the server:",
    "Lensically Operator Mode MCP is active.",
    "Selected key: <selected_key>",
    `Full tool surface loaded: ${toolCount} tools available and usable.`,
    "Proceed to the next step?",
    "Autonomous Manifest strategy, generation, scheduling, evaluation, receipts, and coverage execute directly under the active autonomous profile. After explicit Proceed for guided workflows, account calls include only their advertised typed fields.",
    "Content generation preserves source lineage, passes every mandatory backend gate, and schedules only internally approved autonomous drafts into exact missing runway slots.",
    "Owner review is optional and non-blocking. Spending, credential or ownership changes, irreversible deletion, fundamental mission changes, disabling critical infrastructure, and material account or project danger remain owner-ratified.",
    "Scheduler safety and overdue recovery remain backend-enforced.",
    "Follower totals are account-level trajectory data and are never attributed to a post or posting period.",
  ].join("\n");
}

export function buildOperatorMcpInitializeResult(
  requestedVersion: unknown,
  toolCount: number,
): Record<string, unknown> {
  const protocolVersion = typeof requestedVersion === "string" && requestedVersion.trim()
    ? requestedVersion.trim()
    : OPERATOR_MCP_DEFAULT_PROTOCOL_VERSION;

  return {
    protocolVersion,
    capabilities: {
      tools: { listChanged: true },
    },
    serverInfo: {
      name: "lensically-operator-mode",
      title: "Lensically Operator Mode",
      version: OPERATOR_MCP_VERSION,
    },
    instructions: buildOperatorMcpInstructions(toolCount),
  };
}

export function buildOperatorKeyHandshakeLines(
  toolCount: number,
  brandKey: OperatorMcpBrandKey,
): string[] {
  return [
    "Lensically Operator Mode MCP is active.",
    `Selected key: ${brandKey}`,
    `Full tool surface loaded: ${toolCount} tools available and usable.`,
    "Proceed to the next step?",
  ];
}
