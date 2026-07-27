import {
  mcpErrorResponse,
  mcpJsonResponse,
  type OperatorMcpJsonRpcId,
} from "./operatorMcpTransport";

export type OperatorMcpJsonRpcRequest = {
  jsonrpc?: string;
  id?: OperatorMcpJsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

export type OperatorMcpSessionValidation = {
  ok: boolean;
  provided: boolean;
  stale: boolean;
  reason?: string;
};

export type OperatorMcpToolCallContext = {
  request: Request;
  id: OperatorMcpJsonRpcId;
  params: Record<string, unknown>;
  requestId: string;
};

export type OperatorMcpDispatcherDependencies = {
  isAuthorized: (request: Request) => boolean;
  unauthorizedResponse: () => Response;
  createSessionId: () => Promise<string>;
  initializeResult: (requestedVersion: unknown) => Promise<Record<string, unknown>>;
  runtimeHeaders: (sessionId?: string) => Record<string, string>;
  validateSession: (request: Request) => Promise<OperatorMcpSessionValidation>;
  executionKernelMetadata: () => Record<string, unknown>;
  listTools: () => Promise<unknown[]>;
  handleToolCall: (context: OperatorMcpToolCallContext) => Promise<Response>;
  runtimeMetadata: () => Record<string, unknown>;
};

export async function dispatchOperatorMcpRequest(
  request: Request,
  dependencies: OperatorMcpDispatcherDependencies,
): Promise<Response> {
  const requestId = request.headers.get("cf-ray") || crypto.randomUUID();
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }

  if (!dependencies.isAuthorized(request)) {
    return dependencies.unauthorizedResponse();
  }

  const message = await request.json().catch(() => null) as OperatorMcpJsonRpcRequest | null;
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return mcpErrorResponse(null, -32700, "Parse error", 400);
  }

  const id = message.id;
  const method = typeof message.method === "string" ? message.method : "";
  if (!method) {
    return mcpErrorResponse(id, -32600, "Invalid Request");
  }

  try {
    if (method === "initialize") {
      const sessionId = await dependencies.createSessionId();
      return mcpJsonResponse({
        jsonrpc: "2.0",
        id: id ?? null,
        result: await dependencies.initializeResult(message.params?.protocolVersion),
      }, 200, {
        "MCP-Protocol-Version": String(message.params?.protocolVersion ?? "2025-06-18"),
        ...dependencies.runtimeHeaders(sessionId),
      });
    }

    const sessionValidation = await dependencies.validateSession(request);
    if (!sessionValidation.ok) {
      const replacementSessionId = await dependencies.createSessionId();
      return mcpJsonResponse({
        jsonrpc: "2.0",
        id: id ?? null,
        error: {
          code: -32001,
          message: "MCP deployment changed. Reinitialize before retrying the request.",
          data: {
            reason: sessionValidation.reason ?? "stale_mcp_deployment_session",
            execution_kernel: dependencies.executionKernelMetadata(),
          },
        },
      }, 404, dependencies.runtimeHeaders(replacementSessionId));
    }

    if (method === "notifications/initialized") {
      return new Response(null, { status: 202, headers: dependencies.runtimeHeaders() });
    }

    if (method === "ping") {
      return mcpJsonResponse({ jsonrpc: "2.0", id: id ?? null, result: {} });
    }

    if (method === "tools/list") {
      return mcpJsonResponse({
        jsonrpc: "2.0",
        id: id ?? null,
        result: { tools: await dependencies.listTools() },
      });
    }

    if (method === "tools/call") {
      return dependencies.handleToolCall({
        request,
        id,
        params: message.params ?? {},
        requestId,
      });
    }

    return mcpErrorResponse(id, -32601, "Method not found");
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    return mcpErrorResponse(
      id,
      -32603,
      `Internal MCP error: ${messageText || "unknown_error"}`,
      200,
      {
        ok: false,
        error_code: "operator_mcp_method_failed",
        phase: method === "tools/call"
          ? `tools_call:${String(message.params?.name ?? "unknown")}`
          : method.replace("/", "_"),
        request_id: requestId,
        ...dependencies.runtimeMetadata(),
        safe_message: (messageText || "unknown_error").slice(0, 500),
        retryable: true,
        surface_available: true,
      },
      requestId,
    );
  }
}
