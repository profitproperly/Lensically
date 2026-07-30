import {
  buildOperatorMcpToolDefinitions,
  type OperatorMcpToolDefinition,
} from "./operatorMcpToolDefinitions";
import {
  OPERATOR_MCP_ENGINEERING_TOOL_NAMES,
  OPERATOR_MCP_ENGINEERING_TOOLS,
  type OperatorMcpEngineeringToolName,
} from "./operatorMcpEngineeringRegistry";
import {
  OPERATOR_MCP_ADMIN_TOOL_NAMES,
  OPERATOR_MCP_ADMIN_TOOLS,
  type OperatorMcpAdminToolName,
} from "./operatorMcpAdminRegistry";
import { OPERATOR_MCP_ACCOUNT_FOUNDATION_TOOLS } from "./operatorMcpAccountFoundationRegistry";
import { OPERATOR_MCP_SOURCE_DRAFT_TOOLS } from "./operatorMcpSourceDraftRegistry";
import { OPERATOR_MCP_STRATEGY_SCHEDULE_TOOLS } from "./operatorMcpStrategyScheduleRegistry";
import { OPERATOR_MCP_MANIFEST_CYCLE_TOOLS } from "./operatorMcpManifestCycleRegistry";
import { OPERATOR_MCP_MANIFEST_SHADOW_TOOLS } from "./operatorMcpManifestShadowRegistry";
import { OPERATOR_MCP_AUTONOMOUS_EXECUTION_TOOLS } from "./operatorMcpAutonomousExecutionRegistry";
import { OPERATOR_MCP_ACCOUNT_ANALYTICS_TOOLS } from "./operatorMcpAccountAnalyticsRegistry";

export {
  OPERATOR_MCP_ADMIN_TOOL_NAMES,
  OPERATOR_MCP_ENGINEERING_TOOL_NAMES,
};

export const OPERATOR_MCP_ACCOUNT_TOOLS: readonly OperatorMcpToolDefinition[] = [
  ...OPERATOR_MCP_ACCOUNT_FOUNDATION_TOOLS,
  ...OPERATOR_MCP_SOURCE_DRAFT_TOOLS,
  ...OPERATOR_MCP_STRATEGY_SCHEDULE_TOOLS,
    ...OPERATOR_MCP_MANIFEST_CYCLE_TOOLS,
  ...OPERATOR_MCP_MANIFEST_SHADOW_TOOLS,
  ...OPERATOR_MCP_AUTONOMOUS_EXECUTION_TOOLS,
  ...OPERATOR_MCP_ACCOUNT_ANALYTICS_TOOLS,
];

export const OPERATOR_MCP_ADMIN_TOOL_NAME_SET = new Set<string>(
  OPERATOR_MCP_ADMIN_TOOL_NAMES as readonly string[],
);
export const OPERATOR_MCP_ENGINEERING_TOOL_NAME_SET = new Set<string>(
  OPERATOR_MCP_ENGINEERING_TOOL_NAMES as readonly string[],
);
export const ACCOUNT_SCOPED_MCP_ADMIN_TOOLS = new Set<string>([
  "getGrowthMission",
  "updateGrowthMission",
  "getWorkflowStatus",
  "auditScheduledPost",
  "advanceWorkflowStage",
  "prepareFullPreflight",
  "updateGate",
  "runGateSuite",
  "submitAndGateDraft",
]);

export const OPERATOR_MCP_DIRECT_PRIORITIES = new Map<string, number>([
  ["getOperatorStartupContext", 0],
  ["getEngineeringContinuation", 1],
  ["getDatabaseSchemaState", 2],
  ["selectOperatorKey", 1],
  ["confirmOperatorProceed", 2],
  ["getScheduledPostSchedulerState", 6],
  ["auditScheduledPost", 7],
  ["setScheduledPostSchedulerMode", 8],
  ["recoverOverdueScheduledPosts", 9],
  ["runApprovedPostCanary", 10],
  ["get_hourly_coverage", 11],
  ["claim_manifest_review_batch", 9],
  ["get_manifest_review_batch", 10],
  ["attach_manifest_review_draft", 11],
  ["schedule_manifest_review_batch", 12],
  ["get_performance_learning", 13],
  ["get_manifest_intelligence_audit", 13],
  ["get_manifest_intelligence_foundation", 13],
  ["get_manifest_cycle_receipt", 13],
  ["record_manifest_cycle_defect", 13],
  ["resolve_manifest_cycle_defect", 13],
  ["get_manifest_cycle_analysis_page", 14],
    ["commit_manifest_cycle_strategy", 15],
  ["prepare_manifest_shadow_cycle", 15],
  ["commit_manifest_shadow_cycle_strategy", 16],
  ["persist_manifest_shadow_batch", 17],
  ["get_manifest_shadow_cycle_receipt", 15],
  ["prepare_manifest_autonomous_cycle", 16],
  ["persist_manifest_autonomous_post", 17],
  ["review_manifest_scheduled_post", 16],
  ["markOperatorDecisionExecuted", 17],
  ["delete_scheduled_post", 15],
  ["edit_scheduled_post", 15],
  ["skip_manifest_review_source", 16],
]);

export function isOperatorMcpAdminToolName(
  value: string,
): value is OperatorMcpAdminToolName {
  return OPERATOR_MCP_ADMIN_TOOL_NAME_SET.has(value);
}

export function isOperatorMcpEngineeringToolName(
  value: string,
): value is OperatorMcpEngineeringToolName {
  return OPERATOR_MCP_ENGINEERING_TOOL_NAME_SET.has(value);
}

export function operatorMcpToolNameRequiresProceed(toolName: string): boolean {
  if (toolName.startsWith("mm_") || toolName.startsWith("om_") || toolName.startsWith("vx_")) {
    return true;
  }
  if (OPERATOR_MCP_ACCOUNT_TOOLS.some((tool) => tool.name === toolName && toolName !== "list_accounts")) {
    return true;
  }
  return ACCOUNT_SCOPED_MCP_ADMIN_TOOLS.has(toolName);
}

export function buildComposedOperatorMcpTools(
  includeScopedWrappers: boolean,
): OperatorMcpToolDefinition[] {
  return buildOperatorMcpToolDefinitions({
    engineeringTools: OPERATOR_MCP_ENGINEERING_TOOLS,
    adminTools: OPERATOR_MCP_ADMIN_TOOLS,
    accountTools: OPERATOR_MCP_ACCOUNT_TOOLS,
    includeScopedWrappers,
    directPriorities: OPERATOR_MCP_DIRECT_PRIORITIES,
    requiresProceed: operatorMcpToolNameRequiresProceed,
  });
}
