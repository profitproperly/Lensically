import type { OperatorManifestCycleServiceToolName } from "./operatorManifestCycleService";
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

export type OperatorRuntimeAdmission<TBrand> =
  | { kind: "response"; response: Response }
  | {
      kind: "context";
      toolName: string;
      payload: Record<string, unknown>;
      brand: TBrand;
    };

export async function admitOperatorRuntimeToolCall<TBrand>(
  input: {
    request: Request;
    toolName: string;
  },
  dependencies: {
    isAuthorized(request: Request): boolean;
    unauthorizedResponse(): Response;
    canonicalToolName(toolName: string): string;
    retiredToolNames: ReadonlySet<string>;
    retiredToolResponse(canonicalToolName: string): Response;
    prepare(): Promise<void>;
    readPayload(request: Request): Promise<Record<string, unknown>>;
    scopeCall(toolName: string, payload: Record<string, unknown>): ScopedOperatorMcpCall;
    accountDirectoryResponse(): Promise<Response>;
    resolveBrand(payload: Record<string, unknown>): Promise<TBrand | null>;
    missingBrandResponse(): Response;
  },
): Promise<OperatorRuntimeAdmission<TBrand>> {
  if (!dependencies.isAuthorized(input.request)) {
    return { kind: "response", response: dependencies.unauthorizedResponse() };
  }

  const canonicalToolName = dependencies.canonicalToolName(input.toolName);
  if (dependencies.retiredToolNames.has(canonicalToolName)) {
    return {
      kind: "response",
      response: dependencies.retiredToolResponse(canonicalToolName),
    };
  }

  await dependencies.prepare();
  const payload = await dependencies.readPayload(input.request);
  const scopedCall = dependencies.scopeCall(input.toolName, payload);
  Object.assign(payload, scopedCall.args);

  if (scopedCall.tool_name === "list_accounts") {
    return {
      kind: "response",
      response: await dependencies.accountDirectoryResponse(),
    };
  }

  const brand = await dependencies.resolveBrand(payload);
  if (!brand) {
    return { kind: "response", response: dependencies.missingBrandResponse() };
  }

    return {
    kind: "context",
    toolName: scopedCall.tool_name,
    payload,
    brand,
  };
}

export type OperatorRuntimeDispatch =
  | { handled: false }
  | {
      handled: true;
      body: Record<string, unknown>;
      status: number;
    };

export type OperatorRuntimeHandler = () => Promise<{
  body: Record<string, unknown>;
  status?: number;
}>;

export async function dispatchOperatorKeyedRuntimeTool(
  toolName: string,
  handlers: Readonly<Record<string, OperatorRuntimeHandler>>,
): Promise<OperatorRuntimeDispatch> {
  const handler = handlers[toolName];
  if (!handler) return { handled: false };
  const result = await handler();
  return {
    handled: true,
    body: result.body,
    status: result.status ?? 200,
  };
}

export type OperatorResponseRuntimeDispatch =
  | { handled: false }
  | { handled: true; response: Response };

export async function dispatchOperatorKeyedResponseTool(
  toolName: string,
  handlers: Readonly<Record<string, () => Promise<Response>>>,
): Promise<OperatorResponseRuntimeDispatch> {
  const handler = handlers[toolName];
  if (!handler) return { handled: false };
  return { handled: true, response: await handler() };
}

export type OperatorManifestRuntimeDispatch = OperatorRuntimeDispatch;


export async function dispatchOperatorManifestRuntimeTool(
  input: {
    toolName: string;
    payload: Record<string, unknown>;
  },
  dependencies: {
        isCycleServiceToolName(
      toolName: string,
    ): toolName is OperatorManifestCycleServiceToolName;
    handleCycleService(
      toolName: OperatorManifestCycleServiceToolName,
      payload: Record<string, unknown>,
    ): Promise<{ body: Record<string, unknown>; status: number }>;
    prepare(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    persist(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    review(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    observe(
      toolName: string,
      payload: Record<string, unknown>,
      result: Record<string, unknown>,
    ): Promise<Record<string, unknown>>;
  },
): Promise<OperatorManifestRuntimeDispatch> {
  const { toolName, payload } = input;

  if (dependencies.isCycleServiceToolName(toolName)) {
    const result = await dependencies.handleCycleService(toolName, payload);
    return { handled: true, body: result.body, status: result.status };
  }

  if (toolName === "prepare_manifest_autonomous_cycle") {
    try {
      const result = await dependencies.prepare(payload);
      return {
        handled: true,
        body: await dependencies.observe(toolName, payload, result),
        status: 200,
      };
    } catch (error) {
      const result = await dependencies.observe(toolName, payload, {
        success: false,
        cycle_id: payload.cycle_id ?? null,
        stage: "preparation_exception",
        error: error instanceof Error ? error.message : "manifest_autonomous_prepare_failed",
      });
      return { handled: true, body: result, status: 500 };
    }
  }

  if (toolName === "commit_manifest_autonomous_runway") {
    return {
      handled: true,
      status: 410,
      body: {
        success: false,
        error: "retired_monolithic_autonomous_commit",
        replacement_tool: "persist_manifest_autonomous_post",
        retryable: false,
      },
    };
  }

  if (toolName === "persist_manifest_autonomous_post") {
    try {
      const result = await dependencies.persist(payload);
      return {
        handled: true,
        body: await dependencies.observe(toolName, payload, result),
        status: 200,
      };
    } catch (error) {
      const result = await dependencies.observe(toolName, payload, {
        success: false,
        cycle_id: payload.cycle_id ?? null,
        error: error instanceof Error ? error.message : "manifest_autonomous_persist_failed",
        side_effect_state: "unknown",
        retryable: true,
      });
      return { handled: true, body: result, status: 500 };
    }
  }

  if (toolName === "review_manifest_scheduled_post") {
    return {
      handled: true,
      body: await dependencies.review(payload),
      status: 200,
    };
  }

  return { handled: false };
}





