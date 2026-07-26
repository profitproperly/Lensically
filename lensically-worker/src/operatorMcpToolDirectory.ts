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
  "getOperatorStartupContext",
  "getEngineeringContinuation",
  "getDatabaseSchemaState",
  "engineeringPrecheck",
  "getEngineeringAccessState",
  "listRepoFiles",
  "selectOperatorKey",
  "confirmOperatorProceed",
  "getGrowthMission",
  "updateGrowthMission",
  "getOperatorDecisionState",
  "proposeOperatorDecision",
  "resolveOperatorDecision",
  "markOperatorDecisionExecuted",
  "list_accounts",
  "get_account_state",
  "start_workflow_session",
  "admit_context",
  "read_lensically_ui_surface",
  "get_hourly_coverage",
  "get_production_board",
  "audit_published_post_lineage",
  "recover_published_post_lineage",
  "delete_saved_pattern_source",
  "getWorkflowStatus",
  "updateWorkflowRequirement",
  "advanceWorkflowStage",
  "prepareFullPreflight",
  "updateGate",
  "runGateSuite",
  "submitAndGateDraft",
  "get_monthly_growth_review",
  "get_performance_learning",
  "get_manifest_intelligence_audit",
  "get_content_focus",
  "get_manifest_intelligence_foundation",
  "get_manifest_cycle_receipt",
  "record_manifest_cycle_defect",
  "resolve_manifest_cycle_defect",
  "get_manifest_cycle_analysis_page",
  "commit_manifest_cycle_strategy",
  "prepare_manifest_autonomous_cycle",
  "persist_manifest_autonomous_post",
  "review_manifest_scheduled_post",
  "claim_manifest_review_batch",
  "get_manifest_review_batch",
  "attach_manifest_review_draft",
  "skip_manifest_review_source",
  "discard_manifest_review_batch",
  "schedule_manifest_review_batch",
  "list_source_candidates",
  "draw_source_candidate_batch",
  "get_source_candidate_batch",
  "create_all_missing_manifest_source_cards",
  "create_source_card",
  "lock_source_card",
  "get_source_card",
  "create_generation_run",
  "run_gates",
  "submit_candidate_draft",
  "mark_draft_shown",
  "save_self_rejected_draft",
  "approve_draft",
  "reject_draft",
  "list_active_gates",
  "create_or_update_gate",
  "promote_memory_to_gate",
  "list_strategy_memory",
  "save_strategy_memory",
  "list_scheduled_posts",
  "delete_scheduled_post",
  "edit_scheduled_post",
  "schedule_owner_approved_batch",
  "schedule_approved_draft",
  "get_post_results",
  "getScheduledPostSchedulerState",
  "auditScheduledPost",
  "setScheduledPostSchedulerMode",
  "recoverOverdueScheduledPosts",
  "runApprovedPostCanary",
  "getRepoStatus",
  "readRepoFile",
  "searchRepoFiles",
  "applyRepoTextPatch",
  "applyRepoPatchSet",
  "startRepoFileWrite",
  "appendRepoFileChunk",
  "commitRepoFileWrite",
  "createRepoFile",
  "createGitHubRepository",
  "upsertGitHubRepositoryFile",
  "createCloudflarePagesProject",
  "deployCloudflarePagesProject",
  "deleteRepoFile",
  "listGitHubWorkflowRuns",
  "getGitHubWorkflowRun",
  "runGitHubWorkflow",
  "verifyDeployedMcpVersion",
  "listMcpTools",
  "readMcpToolDefinition",
  "runMcpTests",
  "listEngineeringAudit",
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
