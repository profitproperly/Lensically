import {
  mcpErrorResponse,
  mcpToolCompletionResponse,
  mcpToolResultResponse,
  type OperatorMcpJsonRpcId,
} from "./operatorMcpTransport";

type JsonRecord = Record<string, unknown>;

type CompiledProfileResult =
  | (JsonRecord & { ok: true; profile_id: string; request: JsonRecord })
  | (JsonRecord & { ok: false; error?: unknown; profile_id?: string });

type PreparedGatewayResult =
  | (JsonRecord & {
      ok: true;
      tool_name: string;
      arguments: JsonRecord;
      map_execution?: JsonRecord | null;
      map_state?: unknown;
      map_entry?: unknown;
      incident?: unknown;
      execution_library?: unknown;
      corrections?: unknown[];
      route_trail?: JsonRecord[];
    })
  | (JsonRecord & { ok: false; error?: unknown });

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
  routedExecutionGateway: string;
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
  const directPublicEntry = dependencies.isPublicDirectToolName(requestedToolName);
  const legacyGatewayEntry = requestedToolName === dependencies.routedExecutionGateway;
  const gatewayAccountDataLoaded = directPublicEntry || legacyGatewayEntry
    ? await dependencies.gatewayAccountDataLoaded(requestedArgs)
    : false;

  if (!directPublicEntry && !legacyGatewayEntry) {
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
        ...requestedArgs,
        execution_guard: await dependencies.createExecutionGuard(requestedToolName, requestedArgs),
      }
    : requestedArgs;
  let routedGatewayMetadata: JsonRecord | null = null;

  if (requestedToolName === dependencies.routedExecutionGateway) {
    const compiledProfile = dependencies.compilePublicProfileRequest(requestedArgs);
    if (!compiledProfile.ok) {
      return mcpToolResultResponse(id, {
        ...compiledProfile,
        required_tool: dependencies.routedExecutionGateway,
        account_data_loaded: gatewayAccountDataLoaded,
        freehand_gateway_payload_allowed: false,
      }, `Lensically rejected an unregistered public request profile: ${compiledProfile.error}.`, true);
    }
    const prepared = await dependencies.prepareRoutedGatewayCall(compiledProfile.request);
    if (!prepared.ok || !prepared.tool_name || !prepared.arguments) {
      return mcpToolResultResponse(id, {
        ...prepared,
        profile_id: compiledProfile.profile_id,
        required_tool: dependencies.routedExecutionGateway,
        account_data_loaded: gatewayAccountDataLoaded,
      }, `Lensically could not resolve registered profile ${compiledProfile.profile_id}: ${String(prepared.error ?? "unknown_error")}.`, true);
    }
    toolName = prepared.tool_name;
    rawArgs = {
      ...prepared.arguments,
      execution_guard: await dependencies.createExecutionGuard(toolName, prepared.arguments),
    };
    routedGatewayMetadata = {
      version: dependencies.mandatoryExecutionMapVersion,
      profile_id: compiledProfile.profile_id,
      action_intent: compiledProfile.request.intent ?? null,
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
  const sourceDefinedStaticRoute = directPublicEntry || routedMapExecution?.d1_execution_library_bypassed === true;
  const sourceDefinedDirectEngineering = (directPublicEntry && dependencies.isEngineeringToolName(toolName))
    || routedMapExecution?.mode === "source_defined_direct_engineering";
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

  const boundaryBlock = sourceDefinedDirectEngineering
    ? null
    : await dependencies.getBoundaryBlock(request, toolName, args);
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
      const startedAt = Date.parse(String(receipt.existing.updated_at ?? receipt.existing.created_at ?? ""));
      const ageMs = Number.isFinite(startedAt) ? Date.now() - startedAt : 0;
      const leaseMs = dependencies.operationLeaseMs(toolName);
      if (ageMs < leaseMs) {
        const resultPayload: JsonRecord = {
          ok: false,
          error: "operation_already_in_progress",
          retryable_after_seconds: Math.max(1, Math.ceil((leaseMs - ageMs) / 1000)),
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
          `Lensically Operator Mode operation ${toolName} is already in progress.`,
          true,
        );
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
    if (sourceDefinedDirectEngineering && routedGatewayMetadata.profile_id === "engineering_precheck") {
      resultPayload.mandatory_execution_map = mapLifecycle;
    }
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
    await dependencies.completeOperationReceipt(idempotencyKey, resultPayload);
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
    resultPayload.normal_work_blocked = automaticIncident.normal_work_blocked;
  }

  resultPayload.operator_action_closure = await dependencies.buildActionClosure(toolName, resultPayload);
  resultPayload = dependencies.enforcePayloadBudget(resultPayload);
  if (!sourceDefinedStaticRoute) {
    await dependencies.recordExecutionDecision(
      toolName,
      args,
      executionPolicy,
      isError ? "failed" : "completed",
    );
  }
  return mcpToolCompletionResponse(id, toolName, resultPayload, isError);
}
