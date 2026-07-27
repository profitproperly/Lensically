import type { OperatorMcpBrandKey } from "./operatorMcpProtocol";
import {
  isOperatorMcpAdminToolName,
  isOperatorMcpEngineeringToolName,
  operatorMcpToolNameRequiresProceed,
} from "./operatorMcpRegistryComposition";

export type OperatorMcpBrandNormalizer = (
  value: unknown,
) => OperatorMcpBrandKey | null;

export type OperatorMcpTextNormalizer = (
  value: unknown,
  maxLength: number,
) => string | null;

export type OperatorMcpHandlerClass = "engineering" | "admin" | "account";

export type ScopedOperatorMcpCall = {
  tool_name: string;
  args: Record<string, unknown>;
  scoped_brand_key: OperatorMcpBrandKey | null;
};

export const MANIFEST_AUTONOMOUS_PROCEED_EXEMPT_TOOLS = new Set<string>([
  "prepare_manifest_autonomous_cycle",
  "persist_manifest_autonomous_post",
  "get_hourly_coverage",
  "get_manifest_cycle_receipt",
  "get_manifest_intelligence_audit",
  "get_manifest_intelligence_foundation",
]);

export function canonicalScopedOperatorMcpToolName(toolName: string): string {
  return toolName.replace(/^(?:mm_|om_|vx_)/, "");
}

export function scopeOperatorMcpToolCall(
  toolName: string,
  args: Record<string, unknown>,
): ScopedOperatorMcpCall {
  const scopedArgs = { ...args };
  if (toolName.startsWith("mm_")) {
    scopedArgs.brand_key = "manifestmental";
    return {
      tool_name: toolName.slice(3),
      args: scopedArgs,
      scoped_brand_key: "manifest_mental",
    };
  }
  if (toolName.startsWith("om_")) {
    scopedArgs.brand_key = "opmgdeadman";
    return {
      tool_name: toolName.slice(3),
      args: scopedArgs,
      scoped_brand_key: "opmg_deadman",
    };
  }
  if (toolName.startsWith("vx_")) {
    scopedArgs.brand_key = "vectrix";
    return {
      tool_name: toolName.slice(3),
      args: scopedArgs,
      scoped_brand_key: "vectrix",
    };
  }
  return {
    tool_name: toolName,
    args: scopedArgs,
    scoped_brand_key: null,
  };
}

export function requestedMcpBrandKey(
  toolName: string,
  args: Record<string, unknown>,
  normalizeBrandKey: OperatorMcpBrandNormalizer,
): OperatorMcpBrandKey | null {
  if (toolName.startsWith("mm_")) return "manifest_mental";
  if (toolName.startsWith("om_")) return "opmg_deadman";
  if (toolName.startsWith("vx_")) return "vectrix";
  return normalizeBrandKey(args.brand_key);
}

export function operatorMcpCallRequiresProceed(
  toolName: string,
  args: Record<string, unknown>,
  normalizeBrandKey: OperatorMcpBrandNormalizer,
): boolean {
  if (MANIFEST_AUTONOMOUS_PROCEED_EXEMPT_TOOLS.has(toolName)) {
    return false;
  }
  if (operatorMcpToolNameRequiresProceed(toolName)) {
    return true;
  }
  return toolName === "updateWorkflowRequirement"
    && requestedMcpBrandKey(toolName, args, normalizeBrandKey) !== null;
}

export function operatorMcpProceedConfirmed(
  _toolName: string,
  args: Record<string, unknown>,
): boolean {
  return args.proceed_confirmed === true;
}

export function canonicalAutonomyToolName(toolName: string): string {
  const scoped = toolName.match(/^(?:mm|om|vx)_(.+)$/);
  const canonical = scoped?.[1] ?? toolName;
  return canonical === "runApprovedPostCanary"
    ? "setScheduledPostSchedulerMode"
    : canonical;
}

export function canonicalOperatorExecutionArgs(
  toolName: string,
  args: Record<string, unknown>,
  normalizeText: OperatorMcpTextNormalizer,
): { tool_name: string; args: Record<string, unknown> } {
  if (toolName === "listMcpTools") {
    const nestedTool = normalizeText(args.execute_tool, 160);
    if (nestedTool && nestedTool !== toolName) {
      const nestedArgs = args.arguments
        && typeof args.arguments === "object"
        && !Array.isArray(args.arguments)
        ? args.arguments as Record<string, unknown>
        : {};
      return canonicalOperatorExecutionArgs(nestedTool, nestedArgs, normalizeText);
    }
  }
  if (toolName === "runEngineeringTool") {
    const nestedTool = normalizeText(args.tool_name, 160);
    if (nestedTool && nestedTool !== toolName) {
      const nestedArgs = args.arguments
        && typeof args.arguments === "object"
        && !Array.isArray(args.arguments)
        ? args.arguments as Record<string, unknown>
        : {};
      return canonicalOperatorExecutionArgs(nestedTool, nestedArgs, normalizeText);
    }
  }

  const canonicalArgs = { ...args };
  delete canonicalArgs.execution_guard;
  delete canonicalArgs.proceed_confirmed;
  delete canonicalArgs.continuity_loaded;
  delete canonicalArgs.continuity_ref;
  delete canonicalArgs.continuity_token;
  return { tool_name: toolName, args: canonicalArgs };
}

export function classifyOperatorMcpHandler(
  toolName: string,
): OperatorMcpHandlerClass {
  if (isOperatorMcpEngineeringToolName(toolName)) return "engineering";
  if (isOperatorMcpAdminToolName(toolName)) return "admin";
  return "account";
}

export function createOperatorMcpRoutingPolicy(dependencies: {
  normalizeBrandKey: OperatorMcpBrandNormalizer;
  normalizeText: OperatorMcpTextNormalizer;
}) {
  return {
    canonicalScopedToolName: canonicalScopedOperatorMcpToolName,
    scopeCall: scopeOperatorMcpToolCall,
    requestedBrandKey: (toolName: string, args: Record<string, unknown>) => requestedMcpBrandKey(
      toolName,
      args,
      dependencies.normalizeBrandKey,
    ),
    callRequiresProceed: (toolName: string, args: Record<string, unknown>) => operatorMcpCallRequiresProceed(
      toolName,
      args,
      dependencies.normalizeBrandKey,
    ),
    proceedConfirmed: operatorMcpProceedConfirmed,
    canonicalAutonomyToolName,
    canonicalExecutionArgs: (toolName: string, args: Record<string, unknown>) => canonicalOperatorExecutionArgs(
      toolName,
      args,
      dependencies.normalizeText,
    ),
    classifyHandler: classifyOperatorMcpHandler,
  } as const;
}

