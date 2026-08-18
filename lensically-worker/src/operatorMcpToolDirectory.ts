import type { OperatorMcpToolDefinition } from "./operatorMcpToolDefinitions";

export const FORBIDDEN_RETIRED_TOOL_NAMES = new Set<string>([
  "guardLensicallyCall",
  "routeAndExecuteLensicallyCall",
  "executeMappedIntent",
  "runEngineeringTool",
  "listPreCallRoutes",
  "recordPreCallRoute",
  "recordOpsMemory",
  "listOpsMemory",
  "searchOpsMemory",
  "readOpsMemory",
  "updateOpsMemory",
  "createMcpTool",
  "updateMcpToolSchema",
  "updateMcpToolBehavior",
  "disableMcpTool",
  "deployMcpChanges",
  "rollbackMcpChanges",
  "createImplementationBacklogItem",
  "listImplementationBacklogItems",
  "markImplementationBacklogItemResolved",
  "planOperatorExecution",
  "getMcpAdminState",
  "resolveContinuationContext",
]);

export const RETIRED_HUMAN_GUIDANCE_TOOL_NAMES = new Set<string>([
  "start_workflow_session",
  "admit_context",
  "getWorkflowStatus",
  "updateWorkflowRequirement",
  "advanceWorkflowStage",
  "prepareFullPreflight",
  "updateGate",
  "runGateSuite",
  "submitAndGateDraft",
  "review_manifest_scheduled_post",
  "claim_manifest_review_batch",
  "get_manifest_review_batch",
  "attach_manifest_review_draft",
  "skip_manifest_review_source",
  "discard_manifest_review_batch",
  "schedule_manifest_review_batch",
  "draw_source_candidate_batch",
  "get_source_candidate_batch",
  "mark_draft_shown",
  "approve_draft",
  "reject_draft",
  "create_or_update_gate",
  "promote_memory_to_gate",
  "list_strategy_memory",
  "save_strategy_memory",
  "schedule_owner_approved_batch",
  "schedule_approved_draft",
]);

const PUBLIC_DIRECT_TOOL_NAMES = [
  "getOperatorSessionMap",
  "getOperatorKnowledge",
  "getOperatorLiveState",
  "executeOperatorReadAction",
  "executeOperatorAction",
  "closeOperatorAction",
] as const;


export const OPERATOR_PUBLIC_DIRECT_TOOL_NAMES = new Set<string>(
  PUBLIC_DIRECT_TOOL_NAMES.filter((name) => !RETIRED_HUMAN_GUIDANCE_TOOL_NAMES.has(name)),
);

export type OperatorMcpToolHandler =
  | "operator_mcp_engineering_runtime"
  | "operator_mcp_admin_runtime"
  | "operator_tool_backend";

export type OperatorMcpToolClassifications = {
  engineeringToolNames: ReadonlySet<string>;
  adminToolNames: ReadonlySet<string>;
};

export function isOperatorPublicDirectToolName(value: string): boolean {
  return OPERATOR_PUBLIC_DIRECT_TOOL_NAMES.has(value);
}

export function filterOperatorPublicMcpTools(
  tools: readonly OperatorMcpToolDefinition[],
): OperatorMcpToolDefinition[] {
  return tools.filter((tool) => isOperatorPublicDirectToolName(tool.name));
}

export function countOperatorPublicMcpTools(
  tools: readonly OperatorMcpToolDefinition[],
): number {
  return filterOperatorPublicMcpTools(tools).length;
}

export function classifyOperatorMcpToolHandler(
  toolName: string,
  classifications: OperatorMcpToolClassifications,
): OperatorMcpToolHandler {
  if (classifications.engineeringToolNames.has(toolName)) {
    return "operator_mcp_engineering_runtime";
  }
  if (classifications.adminToolNames.has(toolName)) {
    return "operator_mcp_admin_runtime";
  }
  return "operator_tool_backend";
}

export function shapeOperatorMcpToolDefinition(
  tool: OperatorMcpToolDefinition,
  classifications: OperatorMcpToolClassifications,
): Record<string, unknown> {
  const required = Array.isArray(tool.inputSchema.required)
    ? tool.inputSchema.required
    : [];
  return {
    ...tool,
    handler: classifyOperatorMcpToolHandler(tool.name, classifications),
    required_fields: required,
  };
}

export function findOperatorMcpToolDefinition(
  tools: readonly OperatorMcpToolDefinition[],
  toolName: string,
  classifications: OperatorMcpToolClassifications,
): Record<string, unknown> | null {
  const tool = tools.find((item) => item.name === toolName);
  return tool ? shapeOperatorMcpToolDefinition(tool, classifications) : null;
}
