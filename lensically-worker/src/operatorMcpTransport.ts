export type OperatorMcpJsonRpcId = string | number | null | undefined;

export function mcpJsonResponse(
  payload: Record<string, unknown>,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export function mcpErrorResponse(
  id: OperatorMcpJsonRpcId,
  code: number,
  message: string,
  status = 200,
  data?: Record<string, unknown>,
  requestId?: string,
): Response {
  return mcpJsonResponse({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(data ? { data } : {}) },
  }, status, requestId ? { "x-request-id": requestId } : {});
}

export function buildMcpToolResultEnvelope(
  id: OperatorMcpJsonRpcId,
  structuredContent: Record<string, unknown>,
  text: string,
  isError: boolean,
): Record<string, unknown> {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result: {
      structuredContent,
      content: [{ type: "text", text }],
      isError,
    },
  };
}

export function mcpToolResultResponse(
  id: OperatorMcpJsonRpcId,
  structuredContent: Record<string, unknown>,
  text: string,
  isError: boolean,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return mcpJsonResponse(
    buildMcpToolResultEnvelope(id, structuredContent, text, isError),
    status,
    extraHeaders,
  );
}

export function buildOperatorMcpToolCompletionText(
  toolName: string,
  resultPayload: Record<string, unknown>,
  isError: boolean,
): string {
  const closure = resultPayload.operator_action_closure
    && typeof resultPayload.operator_action_closure === "object"
    && !Array.isArray(resultPayload.operator_action_closure)
    ? resultPayload.operator_action_closure as Record<string, unknown>
    : {};
  if (isError) {
    return `Lensically Operator Mode tool ${toolName} failed: ${String(resultPayload.error ?? resultPayload.status ?? "unknown_error")}. Required next action: ${String(closure.next_action ?? "Contain, repair, verify, record, and checkpoint before ending the turn.")}`;
  }
  return `Lensically Operator Mode tool ${toolName} completed. Required turn closure: record progress; preserve deferred work; declare next action: ${String(closure.next_action ?? "Continue the active durable outcome.")}; emit checkpoint: ${String(closure.checkpoint ?? "Resume from durable state, not chat memory.")}`;
}

export function mcpToolCompletionResponse(
  id: OperatorMcpJsonRpcId,
  toolName: string,
  resultPayload: Record<string, unknown>,
  isError: boolean,
): Response {
  return mcpToolResultResponse(
    id,
    resultPayload,
    buildOperatorMcpToolCompletionText(toolName, resultPayload, isError),
    isError,
  );
}

export function buildOperatorMcpRuntimeHeaders(options: {
  sessionId?: string;
  deploymentId: string;
  commitSha: string;
  executionKernelVersion: string;
}): Record<string, string> {
  return {
    ...(options.sessionId ? { "Mcp-Session-Id": options.sessionId } : {}),
    "X-Lensically-Deployment-Id": options.deploymentId,
    "X-Lensically-Commit-Sha": options.commitSha,
    "X-Lensically-Execution-Kernel": options.executionKernelVersion,
  };
}

export function operatorTransportFailureResponse(options: {
  requestId: string;
  phase: string;
  error: unknown;
  status?: number;
  runtimeMetadata: Record<string, unknown>;
}): Response {
  const safeMessage = options.error instanceof Error
    ? options.error.message
    : String(options.error || "unknown_error");
  return mcpJsonResponse({
    ok: false,
    error_code: "operator_transport_failure",
    phase: options.phase,
    request_id: options.requestId,
    ...options.runtimeMetadata,
    message: safeMessage.slice(0, 500),
  }, options.status ?? 500, { "x-request-id": options.requestId });
}
