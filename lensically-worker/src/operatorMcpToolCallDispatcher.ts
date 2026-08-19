import {
  mcpErrorResponse,
  mcpToolCompletionResponse,
  mcpToolResultResponse,
  type OperatorMcpJsonRpcId,
} from "./operatorMcpTransport";
import {
  OPERATOR_GOVERNING_STANDARDS_ACK,
  OPERATOR_GOVERNING_STANDARDS_TEXT,
  OPERATOR_GOVERNING_STANDARDS_VERSION,
} from "./operatorMcpProtocol";
import { evaluateOperatorTurnCloseGate } from "./operatorTurnCloseGate";

type JsonRecord = Record<string, unknown>;

type CompiledProfileResult =
  | (JsonRecord & { ok: true; profile_id: string; request: JsonRecord })
    | (JsonRecord & { ok: false; error?: unknown; profile_id?: string | null });

type PreparedGatewayResult = JsonRecord & {
  ok: boolean;
  tool_name?: string;
  arguments?: JsonRecord;
  error?: unknown;
  map_execution?: JsonRecord | null;
  map_state?: unknown;
  map_entry?: unknown;
  incident?: unknown;
  execution_library?: unknown;
  corrections?: unknown[];
  route_trail?: JsonRecord[];
};

type PreCallRoutingResult = {
  arguments: JsonRecord;
  corrections: unknown[];
  route: JsonRecord | null;
  redirect: boolean;
};

export type OperatorMcpAutonomyAuthorization = JsonRecord & {
  allowed: boolean;
  governed: boolean;
  engineering_autonomous?: boolean;
  account_autonomous?: boolean;
  guided_plan_approved?: boolean;
  authority_version?: string;
  growth_mission?: JsonRecord | null;
  decision_id?: string;
  decision_title?: string;
  event_id?: string;
  error?: unknown;
};

export interface OperatorMcpToolCallDependencies {
  readOnlyRoutedExecutionGateway: string;
  routedExecutionGateway: string;
  caseRoutedExecutionGateway: string;
  mandatoryExecutionMapVersion: string;
  preCallRoutingVersion: string;
  executionPolicyVersion: string;
  idempotencyVersion: string;
  engineeringAuthorityVersion: string;
  executionGuardVersion: string;
  guidedExecutionMode: string;
  autonomyMode: string;
  autonomyObjective: string;
  protectedTools: ReadonlySet<string>;
  hardeningControllerTools: ReadonlySet<string>;
  isPublicDirectToolName(toolName: string): boolean;
  gatewayAccountDataLoaded(args: JsonRecord): Promise<boolean>;
  createExecutionGuard(toolName: string, args: JsonRecord): Promise<unknown>;
  compilePublicProfileRequest(args: JsonRecord): CompiledProfileResult;
  prepareRoutedGatewayCall(request: JsonRecord): Promise<PreparedGatewayResult>;
  toolExists(toolName: string): Promise<boolean>;
  verifyExecutionGuard(toolName: string, args: JsonRecord): Promise<{ ok: boolean; error?: string }>;
  isEngineeringToolName(toolName: string): boolean;
  canonicalAutonomyToolName(toolName: string): string;
  resolvePreCallRouting(toolName: string, args: JsonRecord): Promise<PreCallRoutingResult>;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  getBoundaryBlock(request: Request, toolName: string, args: JsonRecord): Promise<JsonRecord | null>;
  buildExecutionPolicy(toolName: string, args: JsonRecord): JsonRecord;
  getKnownAliasRetryBlock(toolName: string, args: JsonRecord, policy: JsonRecord): Promise<JsonRecord | null>;
  recordExecutionDecision(toolName: string, args: JsonRecord, policy: JsonRecord, decision?: string): Promise<void>;
  executionKernelMetadata(): JsonRecord;
  operatorIdempotencyKey(toolName: string, args: JsonRecord): Promise<string | null>;
  beginOperationReceipt(key: string, toolName: string, args: JsonRecord): Promise<{
    existing: JsonRecord | null;
    fingerprint: string;
    created: boolean;
  }>;
  parseJson(value: string): unknown;
  operationLeaseMs(toolName: string): number;
  failOperationReceipt(key: string, error: unknown): Promise<void>;
  beginAutonomyAuthorization(toolName: string, args: JsonRecord): Promise<OperatorMcpAutonomyAuthorization>;
  completeAutonomyAuthorization(authorization: OperatorMcpAutonomyAuthorization, result: JsonRecord): Promise<void>;
  classifyHandler(toolName: string): "engineering" | "admin" | "account";
  executeEngineeringTool(request: Request, toolName: string, args: JsonRecord, routed: boolean): Promise<JsonRecord>;
  executeAdminTool(request: Request, toolName: string, args: JsonRecord, routed: boolean): Promise<JsonRecord>;
  executeAccountTool(request: Request, toolName: string, args: JsonRecord): Promise<JsonRecord>;
  finalizeMandatoryExecutionMapCall(input: {
    mapExecution: JsonRecord | null;
    toolName: string;
    args: JsonRecord;
    result: JsonRecord;
    sourceDefinedDirectEngineering: boolean;
  }): Promise<unknown>;
  enforcePayloadBudget(payload: JsonRecord): JsonRecord;
  completeOperationReceipt(key: string, result: JsonRecord): Promise<void>;
  normalizeMachineKey(value: unknown, fallback: string): string;
  isExpectedHardeningControlResult(toolName: string, error: string, result: JsonRecord): boolean;
  closeResolvedHardeningIncidentsForRequest(toolName: string, args: JsonRecord, result: JsonRecord): Promise<number>;
  recordHardeningIncident(input: JsonRecord): Promise<JsonRecord>;
  publicProfileIdForToolName(toolName: string): unknown;
  executionFingerprint(toolName: string, args: JsonRecord): Promise<string>;
  toolMutatesState(toolName: string): boolean;
    buildActionClosure(toolName: string, result: JsonRecord): Promise<unknown>;
    verifyLifecycleExecutionToken(token: unknown): Promise<{ ok: boolean; error?: string; payload?: JsonRecord }>;
  requiredKnowledgeNodes(toolName: string): string[];
  requiredLiveStateScopes(toolName: string): string[];
  issueActionExecutionToken(input: { profileId: string | null; toolName: string; result: JsonRecord; liveStatePayload: JsonRecord }): Promise<string>;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

export async function dispatchOperatorMcpToolCall(
  input: {
    request: Request;
    id: OperatorMcpJsonRpcId;
    params: JsonRecord;
  },
  dependencies: OperatorMcpToolCallDependencies,
): Promise<Response> {
  const { request, id, params } = input;
    const requestedToolName = typeof params.name === "string" ? params.name : "";
  const requestedArgs = asRecord(params.arguments) ?? {};
  if (requestedArgs.governing_standards_ack !== OPERATOR_GOVERNING_STANDARDS_ACK) {
    return mcpToolResultResponse(id, {
      ok: false,
      error: "governing_standards_ack_required",
      requested_tool: requestedToolName,
      governing_standards: {
        version: OPERATOR_GOVERNING_STANDARDS_VERSION,
        required_acknowledgment: OPERATOR_GOVERNING_STANDARDS_ACK,
        exact_text: OPERATOR_GOVERNING_STANDARDS_TEXT,
      },
      account_data_loaded: false,
      execution_started: false,
    }, "Lensically blocked the action before execution because the mandatory governing-standards acknowledgment was absent or altered.", true);
  }
  const governedRequestedArgs = { ...requestedArgs };
  delete governedRequestedArgs.governing_standards_ack;
    const directPublicEntry = dependencies.isPublicDirectToolName(requestedToolName);
  const gatewayAccountDataLoaded = directPublicEntry
    ? await dependencies.gatewayAccountDataLoaded(governedRequestedArgs)
    : false;

  if (!directPublicEntry) {
    return mcpToolResultResponse(id, {
      ok: false,
      error: "public_direct_tool_required",
      requested_tool: requestedToolName,
      account_data_loaded: false,
    }, "Lensically accepts only advertised direct typed Main tools.", true);
  }

      let toolName = requestedToolName;
  let rawArgs: JsonRecord = directPublicEntry
    ? {
        ...governedRequestedArgs,
        execution_guard: await dependencies.createExecutionGuard(requestedToolName, governedRequestedArgs),
      }
    : governedRequestedArgs;
  let routedGatewayMetadata: JsonRecord | null = null;
  let lifecycleLiveStatePayload: JsonRecord | null = null;

  if (
    requestedToolName === dependencies.readOnlyRoutedExecutionGateway
    || requestedToolName === dependencies.routedExecutionGateway
    || requestedToolName === dependencies.caseRoutedExecutionGateway
  ) {
    const lifecycleCheck = await dependencies.verifyLifecycleExecutionToken(
      governedRequestedArgs.live_state_token,
    );
    if (!lifecycleCheck.ok || !lifecycleCheck.payload) {
      return mcpToolResultResponse(id, {
        ok: false,
        error: lifecycleCheck.error ?? "operator_live_state_token_required",
        required_stage: "getOperatorLiveState",
        required_tool: "getOperatorLiveState",
        execution_started: false,
        account_data_loaded: gatewayAccountDataLoaded,
      }, "Lensically blocked Step 4 because current Step-3 live-state proof was missing, invalid, expired, or deployment-stale.", true);
    }
    lifecycleLiveStatePayload = lifecycleCheck.payload;
    const requestedExecutionDescriptor = asRecord(governedRequestedArgs.execution_descriptor);
    const expectedClientActionId = typeof lifecycleCheck.payload.client_action_id === "string" ? lifecycleCheck.payload.client_action_id.trim() : "";
    const expectedEffectClass = lifecycleCheck.payload.effect_class === "read_only" || lifecycleCheck.payload.effect_class === "mutation"
      ? lifecycleCheck.payload.effect_class
      : "";
    const expectedGateway = expectedEffectClass === "read_only"
      ? dependencies.readOnlyRoutedExecutionGateway
      : dependencies.routedExecutionGateway;
    if (expectedEffectClass && requestedToolName !== expectedGateway) {
      return mcpToolResultResponse(id, {
        ok: false,
        error: "operator_execution_gateway_effect_mismatch",
        expected_effect_class: expectedEffectClass,
        required_tool: expectedGateway,
        execution_started: false,
        account_data_loaded: gatewayAccountDataLoaded,
      }, "Lensically blocked Step 4 because the selected public gateway does not match the server-bound action effect.", true);
    }
    const requestedClientActionId = typeof requestedExecutionDescriptor?.action_id === "string" ? requestedExecutionDescriptor.action_id.trim() : "";
    const requestedEffectClass = requestedExecutionDescriptor?.effect_class === "read_only" || requestedExecutionDescriptor?.effect_class === "mutation"
      ? requestedExecutionDescriptor.effect_class
      : "";
    if (!expectedClientActionId || !expectedEffectClass || requestedClientActionId !== expectedClientActionId || requestedEffectClass !== expectedEffectClass) {
      return mcpToolResultResponse(id, {
        ok: false,
        error: "operator_execution_descriptor_mismatch",
        expected_execution_descriptor: expectedClientActionId && expectedEffectClass
          ? { action_id: expectedClientActionId, effect_class: expectedEffectClass }
          : null,
        received_execution_descriptor: requestedExecutionDescriptor,
        required_stage: "getOperatorLiveState",
        required_tool: "getOperatorLiveState",
        execution_started: false,
        account_data_loaded: gatewayAccountDataLoaded,
      }, "Lensically blocked Step 4 because the client-safe execution descriptor did not exactly match the action prepared by Step 3.", true);
    }
    const capability = typeof lifecycleCheck.payload.planned_capability === "string" ? lifecycleCheck.payload.planned_capability.trim() : "";
    const actionArguments = asRecord(lifecycleCheck.payload.planned_arguments);
    if (!capability || !actionArguments) {
      return mcpToolResultResponse(id, {
        ok: false,
        error: "operator_prepared_action_binding_invalid",
        required_stage: "getOperatorKnowledge",
        required_tool: "getOperatorKnowledge",
        execution_started: false,
        account_data_loaded: gatewayAccountDataLoaded,
      }, "Lensically blocked Step 4 because the server-bound prepared action was missing or invalid.", true);
    }
    const preparedBrandKey = typeof lifecycleCheck.payload.brand_key === "string" ? lifecycleCheck.payload.brand_key : "";
    const boundBrandKey = typeof actionArguments.brand_key === "string" ? actionArguments.brand_key.trim().toLowerCase().replace(/-/g, "_") : "";
    if (preparedBrandKey && boundBrandKey && preparedBrandKey !== boundBrandKey) {
      return mcpToolResultResponse(id, {
        ok: false,
        error: "operator_action_brand_changed_after_live_state",
        prepared_brand_key: preparedBrandKey,
        bound_brand_key: boundBrandKey,
        required_stage: "getOperatorKnowledge",
        execution_started: false,
        account_data_loaded: gatewayAccountDataLoaded,
      }, "Lensically blocked Step 4 because the server-bound account target no longer matches the prepared lifecycle state.", true);
    }
        const compiledProfile = dependencies.compilePublicProfileRequest({
      profile_id: capability,
      inputs: actionArguments,
      typed_lifecycle_bound: true,
    });
    if (!compiledProfile.ok) {
      return mcpToolResultResponse(id, {
        ...compiledProfile,
        required_tool: expectedGateway,
        account_data_loaded: gatewayAccountDataLoaded,
        freehand_gateway_payload_allowed: false,
      }, `Lensically rejected an unregistered public request profile: ${compiledProfile.error}.`, true);
    }
        const governedCompiledRequest: JsonRecord = {
      ...compiledProfile.request,
      inputs: {
        governing_standards_ack: OPERATOR_GOVERNING_STANDARDS_ACK,
        ...(asRecord(compiledProfile.request.inputs) ?? {}),
      },
    };
    const prepared = await dependencies.prepareRoutedGatewayCall(governedCompiledRequest);
    if (!prepared.ok || !prepared.tool_name || !prepared.arguments) {
      return mcpToolResultResponse(id, {
        ...prepared,
        profile_id: compiledProfile.profile_id,
        required_tool: expectedGateway,
        account_data_loaded: gatewayAccountDataLoaded,
      }, `Lensically could not resolve registered profile ${compiledProfile.profile_id}: ${String(prepared.error ?? "unknown_error")}.`, true);
    }
                    toolName = prepared.tool_name;
    const preparedCapability = typeof lifecycleCheck.payload.planned_capability === "string" ? lifecycleCheck.payload.planned_capability : "";
    const preparedToolName = typeof lifecycleCheck.payload.planned_tool === "string" ? lifecycleCheck.payload.planned_tool : "";
    const preparedFingerprint = typeof lifecycleCheck.payload.planned_action_fingerprint === "string" ? lifecycleCheck.payload.planned_action_fingerprint : "";
    const submittedFingerprint = await dependencies.executionFingerprint(toolName, actionArguments);
    if (!preparedCapability || preparedCapability !== capability || !preparedToolName || preparedToolName !== toolName || !preparedFingerprint || preparedFingerprint !== submittedFingerprint) {
      return mcpToolResultResponse(id, {
        ok: false,
        error: "operator_action_changed_after_preparation",
        prepared_capability: preparedCapability || null,
        requested_capability: capability,
        prepared_tool: preparedToolName || null,
        resolved_tool: toolName,
        required_stage: "getOperatorKnowledge",
        execution_started: false,
        account_data_loaded: gatewayAccountDataLoaded,
      }, "Lensically blocked Step 4 because the typed action changed after Steps 2 and 3 prepared its knowledge and live state.", true);
    }

    const loadedKnowledge = Array.isArray(lifecycleCheck.payload.knowledge_node_ids)
      ? lifecycleCheck.payload.knowledge_node_ids.map(String)
      : [];
    const loadedScopes = Array.isArray(lifecycleCheck.payload.scopes)
      ? lifecycleCheck.payload.scopes.map(String)
      : [];
    const requiredKnowledge = dependencies.requiredKnowledgeNodes(toolName);
    const requiredScopes = dependencies.requiredLiveStateScopes(toolName);
    const missingKnowledge = requiredKnowledge.filter((nodeId) => !loadedKnowledge.includes(nodeId));
    if (missingKnowledge.length) {
      return mcpToolResultResponse(id, {
        ok: false,
        error: "operator_action_knowledge_prerequisites_missing",
        requested_action: capability,
        resolved_tool: toolName,
        required_knowledge_nodes: requiredKnowledge,
        loaded_knowledge_nodes: loadedKnowledge,
        missing_knowledge_nodes: missingKnowledge,
        required_stage: "getOperatorKnowledge",
        execution_started: false,
        account_data_loaded: gatewayAccountDataLoaded,
      }, "Lensically blocked Step 4 because the selected action requires durable knowledge that Step 2 did not load.", true);
    }
    const missingScopes = requiredScopes.filter((scope) => !loadedScopes.includes(scope));
    if (missingScopes.length) {
      return mcpToolResultResponse(id, {
        ok: false,
        error: "operator_action_live_state_prerequisites_missing",
        requested_action: capability,
        resolved_tool: toolName,
        required_live_state_scopes: requiredScopes,
        loaded_live_state_scopes: loadedScopes,
        missing_live_state_scopes: missingScopes,
        required_stage: "getOperatorLiveState",
        execution_started: false,
        account_data_loaded: gatewayAccountDataLoaded,
      }, "Lensically blocked Step 4 because the selected action requires current live state that Step 3 did not load.", true);
    }
    const governedPreparedArguments = { ...prepared.arguments };
    delete governedPreparedArguments.governing_standards_ack;
    rawArgs = {
      ...governedPreparedArguments,
      execution_guard: await dependencies.createExecutionGuard(toolName, governedPreparedArguments),
    };
    routedGatewayMetadata = {
      version: dependencies.mandatoryExecutionMapVersion,
      profile_id: compiledProfile.profile_id,
      action_intent: governedCompiledRequest.intent ?? null,
      action_key: prepared.map_execution?.action_key ?? null,
      map_state: prepared.map_state ?? null,
      map_entry: prepared.map_entry ?? null,
      incident: prepared.incident ?? null,
      map_execution: prepared.map_execution ?? null,
      execution_library: prepared.execution_library ?? null,
      executed_tool: toolName,
      corrections: prepared.corrections ?? [],
      route_trail: prepared.route_trail ?? [],
      model_tool_choice_allowed: false,
    };
  }

  if (!await dependencies.toolExists(toolName)) {
    return mcpErrorResponse(id, -32602, "Unknown tool");
  }

  const guardCheck = await dependencies.verifyExecutionGuard(toolName, rawArgs);
  if (!guardCheck.ok) {
    return mcpToolResultResponse(id, {
      ok: false,
      error: guardCheck.error ?? "execution_guard_required",
      intended_tool: toolName,
      required_tool: dependencies.routedExecutionGateway,
      account_data_loaded: gatewayAccountDataLoaded,
    }, "Lensically rejected an operation that was not prepared by the routed execution gateway.", true);
  }

  let args: JsonRecord = { ...rawArgs };
  delete args.execution_guard;
    const routedMapExecution = asRecord(routedGatewayMetadata?.map_execution);
  const lifecycleGatewayExecution = routedGatewayMetadata !== null;
  const sourceDefinedStaticRoute = lifecycleGatewayExecution
    ? routedMapExecution?.d1_execution_library_bypassed === true
    : directPublicEntry;
  const sourceDefinedDirectEngineering = lifecycleGatewayExecution
    ? routedMapExecution?.mode === "source_defined_direct_engineering"
    : directPublicEntry && dependencies.isEngineeringToolName(toolName);
  const sourceDefinedProtectedOperation = sourceDefinedDirectEngineering
    && dependencies.protectedTools.has(dependencies.canonicalAutonomyToolName(toolName));
  const preCallRouting: PreCallRoutingResult = sourceDefinedStaticRoute
    ? { arguments: args, corrections: [], route: null, redirect: false }
    : await dependencies.resolvePreCallRouting(toolName, args);

  if (preCallRouting.redirect) {
    const requiredTool = dependencies.normalizeText(preCallRouting.route?.required_tool, 160, true) ?? toolName;
    const resultPayload: JsonRecord = {
      ok: false,
      error: dependencies.normalizeText(preCallRouting.route?.error, 160, true) ?? "pre_call_route_required",
      intended_tool: toolName,
      normalized_arguments: preCallRouting.arguments,
      corrections: preCallRouting.corrections,
      pre_call_route: preCallRouting.route,
      pre_call_routing_version: dependencies.preCallRoutingVersion,
      required_tool: requiredTool,
      required_route: preCallRouting.route?.mandatory_route ?? null,
      suggested_tools: [requiredTool],
      account_data_loaded: gatewayAccountDataLoaded,
    };
    return mcpToolResultResponse(
      id,
      resultPayload,
      `Lensically requires the proven pre-call route for ${toolName} before execution.`,
      true,
    );
  }

  args = preCallRouting.arguments;
  if (sourceDefinedProtectedOperation && !dependencies.normalizeText(args.owner_response, 8000, true)) {
    const route = {
      route_key: "explicit_owner_ratification_handoff",
      source: "source_defined_static_guard",
      required_tool: toolName,
      mandatory_route: "Include brand_key and the owner's exact approval in owner_response before the protected operation executes.",
    };
    return mcpToolResultResponse(id, {
      ok: false,
      error: "known_blocker_prevented",
      intended_tool: toolName,
      required_tool: toolName,
      required_route: route.mandatory_route,
      route_trail: [route],
      account_data_loaded: gatewayAccountDataLoaded,
    }, `Lensically blocked protected operation ${toolName} until explicit owner ratification is supplied.`, true);
  }

  const boundaryBlock = await dependencies.getBoundaryBlock(request, toolName, args);
  if (boundaryBlock) {
    return mcpToolResultResponse(
      id,
      boundaryBlock,
      `Lensically Operator Mode blocked ${toolName}: ${String(boundaryBlock.error ?? "account_boundary_block")}`,
      true,
    );
  }

  const routedRouteTrail = Array.isArray(routedGatewayMetadata?.route_trail)
    ? routedGatewayMetadata.route_trail as JsonRecord[]
    : [];
  const effectivePreCallRoute = preCallRouting.route ?? routedRouteTrail[routedRouteTrail.length - 1] ?? null;
  const executionPolicy: JsonRecord = sourceDefinedDirectEngineering
    ? {
        version: dependencies.executionPolicyVersion,
        canonical_tool: toolName,
        execution_plane: "engineering_control",
        operation_class: "engineering",
        mandatory_path_applied: true,
        source_defined_direct: true,
        compact_receipt_only: true,
        model_tool_choice_allowed: false,
        protected_operation: sourceDefinedProtectedOperation,
        authorization_mode: sourceDefinedProtectedOperation ? "owner_ratified" : "autonomous_engineering",
      }
    : {
        ...dependencies.buildExecutionPolicy(toolName, args),
        pre_call_route: effectivePreCallRoute,
        pre_call_routing_version: dependencies.preCallRoutingVersion,
      };

  const aliasRetryBlock = sourceDefinedStaticRoute
    ? null
    : await dependencies.getKnownAliasRetryBlock(toolName, args, executionPolicy);
  if (aliasRetryBlock) {
    await dependencies.recordExecutionDecision(toolName, args, executionPolicy, "blocked_known_regression");
    return mcpToolResultResponse(
      id,
      { ...aliasRetryBlock, execution_kernel: { ...dependencies.executionKernelMetadata(), policy: executionPolicy } },
      `Lensically Operator Mode blocked same-backend wrapper retry for ${String(executionPolicy.canonical_tool ?? toolName)}.`,
      true,
    );
  }
  if (!sourceDefinedStaticRoute) {
    await dependencies.recordExecutionDecision(toolName, args, executionPolicy);
  }

  const idempotencyKey = sourceDefinedDirectEngineering
    ? null
    : await dependencies.operatorIdempotencyKey(toolName, args);
  let receiptFingerprint: string | null = null;
  if (idempotencyKey) {
    const receipt = await dependencies.beginOperationReceipt(idempotencyKey, toolName, args);
    receiptFingerprint = receipt.fingerprint;
    if (receipt.existing?.status === "completed" && receipt.existing.result_json) {
      const replayed = dependencies.parseJson(String(receipt.existing.result_json));
      const resultPayload = asRecord(replayed) ?? { ok: false, error: "idempotency_receipt_parse_failed" };
      resultPayload.execution_kernel = { ...dependencies.executionKernelMetadata(), policy: executionPolicy };
      resultPayload.idempotency = {
        version: dependencies.idempotencyVersion,
        key: idempotencyKey,
        replayed: true,
        request_fingerprint: receiptFingerprint,
      };
      const isError = resultPayload.ok === false;
      return mcpToolResultResponse(
        id,
        resultPayload,
        isError
          ? `Lensically Operator Mode replayed failed operation ${toolName}.`
          : `Lensically Operator Mode replayed completed operation ${toolName}.`,
        isError,
      );
    }
    if (!receipt.created && receipt.existing?.request_fingerprint && receipt.existing.request_fingerprint !== receiptFingerprint) {
      const resultPayload: JsonRecord = {
        ok: false,
        error: "idempotency_key_payload_mismatch",
        idempotency: { version: dependencies.idempotencyVersion, key: idempotencyKey, request_fingerprint: receiptFingerprint },
        execution_kernel: { ...dependencies.executionKernelMetadata(), policy: executionPolicy },
      };
      return mcpToolResultResponse(
        id,
        resultPayload,
        `Lensically Operator Mode rejected reused operation identity with different inputs for ${toolName}.`,
        true,
      );
    }
        if (!receipt.created && receipt.existing?.status === "started") {
      const startedAt = Date.parse(String(receipt.existing.created_at ?? receipt.existing.updated_at ?? ""));
      const ageMs = Number.isFinite(startedAt) ? Date.now() - startedAt : 0;
      const leaseMs = dependencies.operationLeaseMs(toolName);
            if (ageMs < leaseMs) {
        const reconciliationWaitMs = Math.min(8_000, Math.max(0, leaseMs - ageMs));
        if (reconciliationWaitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, reconciliationWaitMs));
        }
        const activeReceipt = await dependencies.beginOperationReceipt(idempotencyKey, toolName, args);
        if (activeReceipt.existing?.status === "completed" && activeReceipt.existing.result_json) {
          const replayed = dependencies.parseJson(String(activeReceipt.existing.result_json));
          const resultPayload = asRecord(replayed) ?? { ok: false, error: "idempotency_receipt_parse_failed" };
          resultPayload.execution_kernel = { ...dependencies.executionKernelMetadata(), policy: executionPolicy };
          resultPayload.idempotency = {
            version: dependencies.idempotencyVersion,
            key: idempotencyKey,
            replayed: true,
            request_fingerprint: receiptFingerprint,
            reconciled_in_progress: true,
          };
          const isError = resultPayload.ok === false;
          return mcpToolResultResponse(
            id,
            resultPayload,
            isError
              ? `Lensically Operator Mode replayed failed operation ${toolName} after in-progress reconciliation.`
              : `Lensically Operator Mode replayed completed operation ${toolName} after in-progress reconciliation.`,
            isError,
          );
        }
        const refreshedStartedAt = Date.parse(String(activeReceipt.existing?.created_at ?? activeReceipt.existing?.updated_at ?? ""));
        const refreshedAgeMs = Number.isFinite(refreshedStartedAt) ? Date.now() - refreshedStartedAt : ageMs;
        if (activeReceipt.existing?.status === "started" && refreshedAgeMs < leaseMs) {
          const resultPayload: JsonRecord = {
            ok: false,
            error: "operation_already_in_progress",
            retryable_after_seconds: Math.max(1, Math.ceil((leaseMs - refreshedAgeMs) / 1000)),
            reconciliation_wait_ms: 15_000,
            idempotency: {
              version: dependencies.idempotencyVersion,
              key: idempotencyKey,
              replayed: false,
              request_fingerprint: receiptFingerprint,
            },
            execution_kernel: { ...dependencies.executionKernelMetadata(), policy: executionPolicy },
          };
          return mcpToolResultResponse(
            id,
            resultPayload,
            `Lensically Operator Mode operation ${toolName} is still in progress after receipt reconciliation.`,
            true,
          );
        }
      }
    }

  }

  const autonomyAuthorization: OperatorMcpAutonomyAuthorization = sourceDefinedDirectEngineering && !sourceDefinedProtectedOperation
    ? {
        allowed: true,
        governed: false,
        engineering_autonomous: true,
        authority_version: dependencies.engineeringAuthorityVersion,
      }
    : await dependencies.beginAutonomyAuthorization(toolName, args);

  if (!autonomyAuthorization.allowed) {
    await dependencies.recordExecutionDecision(toolName, args, executionPolicy, "blocked_autonomy_decision_required");
    if (idempotencyKey) {
      await dependencies.failOperationReceipt(
        idempotencyKey,
        new Error(String(autonomyAuthorization.error ?? "autonomy_authorization_blocked")),
      );
    }
    const resultPayload: JsonRecord = {
      ok: false,
      ...autonomyAuthorization,
      execution_kernel: { ...dependencies.executionKernelMetadata(), policy: executionPolicy },
    };
    return mcpToolResultResponse(
      id,
      resultPayload,
      `Lensically Operator Mode blocked ${toolName}: an approved model-originated decision is required.`,
      true,
    );
  }

  let resultPayload: JsonRecord;
  try {
    const handlerClass = dependencies.classifyHandler(toolName);
    resultPayload = handlerClass === "engineering"
      ? await dependencies.executeEngineeringTool(request, toolName, args, routedGatewayMetadata !== null)
      : handlerClass === "admin"
        ? await dependencies.executeAdminTool(request, toolName, args, routedGatewayMetadata !== null)
        : await dependencies.executeAccountTool(request, toolName, args);
  } catch (error) {
    await dependencies.completeAutonomyAuthorization(autonomyAuthorization, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    if (idempotencyKey) {
      await dependencies.failOperationReceipt(idempotencyKey, error);
    }
    throw error;
  }

  await dependencies.completeAutonomyAuthorization(autonomyAuthorization, resultPayload);
  if (autonomyAuthorization.governed) {
    resultPayload.autonomy_decision = {
      governed: true,
      decision_id: autonomyAuthorization.decision_id,
      decision_title: autonomyAuthorization.decision_title,
      execution_event_id: autonomyAuthorization.event_id,
    };
  } else if (autonomyAuthorization.engineering_autonomous) {
    resultPayload.engineering_authority = {
      mode: "full_discretion_recursive",
      version: autonomyAuthorization.authority_version,
      outcome_bound: true,
      owner_ratification_required: false,
      numerical_tool_budget_applies: false,
    };
  } else if (autonomyAuthorization.guided_plan_approved) {
    resultPayload.account_authority = {
      mode: dependencies.guidedExecutionMode,
      version: autonomyAuthorization.authority_version,
      objective: dependencies.autonomyObjective,
      growth_plan_status: autonomyAuthorization.growth_mission?.status ?? null,
      owner_ratification_required: true,
      routine_account_operations_autonomous: false,
      execution_within_approved_plan: true,
      protected_operations_owner_ratified: true,
    };
  } else if (autonomyAuthorization.account_autonomous) {
    resultPayload.account_authority = {
      mode: dependencies.autonomyMode,
      version: autonomyAuthorization.authority_version,
      objective: dependencies.autonomyObjective,
      owner_ratification_required: false,
      protected_operations_owner_ratified: true,
    };
  }

  if (routedGatewayMetadata) {
    const mapLifecycle = await dependencies.finalizeMandatoryExecutionMapCall({
      mapExecution: asRecord(routedGatewayMetadata.map_execution),
      toolName,
      args,
      result: resultPayload,
      sourceDefinedDirectEngineering,
    });
    resultPayload.execution_kernel = {
      ...dependencies.executionKernelMetadata(),
      route: {
        intent: routedGatewayMetadata.action_intent ?? null,
        action_key: routedGatewayMetadata.action_key ?? null,
        tool_name: toolName,
        source_defined: true,
        model_tool_choice_allowed: false,
      },
      lifecycle: mapLifecycle,
      policy: executionPolicy,
    };
    
    resultPayload.routed_execution = routedGatewayMetadata;
    resultPayload.execution_guard_enforcement = {
      version: dependencies.executionGuardVersion,
      mode: sourceDefinedDirectEngineering ? "source_defined_direct_engineering" : "source_defined_static_route",
      normalized_before_execution: true,
      known_path_checked: true,
      direct_operational_calls_allowed: false,
      model_tool_choice_allowed: false,
      ...(sourceDefinedDirectEngineering ? {
        d1_bootstrap_bypassed: true,
        d1_pre_call_routing_bypassed: true,
        d1_execution_events_bypassed: true,
        d1_autonomy_bypassed: !sourceDefinedProtectedOperation,
      } : {}),
    };
  }

  resultPayload = dependencies.enforcePayloadBudget(resultPayload);
  if (idempotencyKey) {
    resultPayload.idempotency = {
      version: dependencies.idempotencyVersion,
      key: idempotencyKey,
      replayed: false,
      request_fingerprint: receiptFingerprint,
    };
      }

  const isError = resultPayload.ok === false;
  const resultError = dependencies.normalizeMachineKey(
    resultPayload.error ?? resultPayload.error_code,
    "unexpected_result",
  );
  const expectedControl = isError
    && dependencies.isExpectedHardeningControlResult(toolName, resultError, resultPayload);
  const unexplainedZero = !isError
    && toolName === "searchRepoFiles"
    && Number(resultPayload.returned_count ?? 0) === 0
    && resultPayload.verified_complete_for_known_file !== true;

  if ((!isError || expectedControl) && !unexplainedZero) {
    const resolvedIncidentCount = await dependencies.closeResolvedHardeningIncidentsForRequest(
      toolName,
      args,
      resultPayload,
    );
    if (resolvedIncidentCount > 0) {
      resultPayload.resolved_hardening_incidents = resolvedIncidentCount;
    }
  }

  if (!dependencies.hardeningControllerTools.has(toolName)
      && ((isError && !expectedControl) || unexplainedZero)) {
    const automaticIncident = await dependencies.recordHardeningIncident({
      boundary: dependencies.isEngineeringToolName(toolName) ? "server" : "quality",
      blocked_profile_id: routedGatewayMetadata?.profile_id
        ?? dependencies.publicProfileIdForToolName(toolName),
      error_category: unexplainedZero ? "unexplained_zero_result" : resultError,
      request_fingerprint: await dependencies.executionFingerprint(toolName, args),
      operation_class: dependencies.toolMutatesState(toolName) ? "mutation" : "read",
      expected_outcome: unexplainedZero
        ? "complete and non-ambiguous search evidence"
        : "successful typed handler result",
      observed_outcome: resultPayload,
      resume_capsule: {
        profile_id: routedGatewayMetadata?.profile_id
          ?? dependencies.publicProfileIdForToolName(toolName),
        tool_name: toolName,
        argument_keys: Object.keys(args).sort(),
        workflow_session_id: dependencies.normalizeText(args.workflow_session_id, 120, true),
      },
    });
        resultPayload.hardening_incident = automaticIncident.incident;
    if (automaticIncident.recurrence) resultPayload.hardening_recurrence = automaticIncident.recurrence;
    resultPayload.normal_work_blocked = automaticIncident.normal_work_blocked;
  }

    if (routedGatewayMetadata && lifecycleLiveStatePayload) {
    resultPayload.action_execution_token = await dependencies.issueActionExecutionToken({
      profileId: typeof routedGatewayMetadata.profile_id === "string" ? routedGatewayMetadata.profile_id : null,
      toolName,
      result: resultPayload,
      liveStatePayload: lifecycleLiveStatePayload,
    });
    resultPayload.operator_action_closure = {
      version: "operator-action-closure-v1",
      status: "pending_explicit_close",
      lifecycle_stage: 4,
      required_tool: "closeOperatorAction",
      rule: "Execution is not lifecycle-closed until closeOperatorAction verifies evidence and records the next checkpoint.",
      turn_close_gate: evaluateOperatorTurnCloseGate({
        unresolved_failure: resultPayload.ok === false || resultPayload.normal_work_blocked === true || Boolean(resultPayload.hardening_incident),
        active_interrupt: Boolean(resultPayload.hardening_incident),
        reachable_next_action: true,
      }),
    };
  } else {
    resultPayload.operator_action_closure = await dependencies.buildActionClosure(toolName, resultPayload);
  }
  resultPayload = dependencies.enforcePayloadBudget(resultPayload);
    if (!sourceDefinedStaticRoute) {
    await dependencies.recordExecutionDecision(
      toolName,
      args,
      executionPolicy,
      isError ? "failed" : "completed",
    );
  }
  if (idempotencyKey) {
    await dependencies.completeOperationReceipt(idempotencyKey, resultPayload);
  }
  return mcpToolCompletionResponse(id, toolName, resultPayload, isError);
}
