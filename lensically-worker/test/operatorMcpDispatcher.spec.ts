import { describe, expect, it, vi } from "vitest";
import {
  dispatchOperatorMcpRequest,
  type OperatorMcpDispatcherDependencies,
} from "../src/operatorMcpDispatcher";

function postRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://operator.example/api/operator/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function dependencies(
  overrides: Partial<OperatorMcpDispatcherDependencies> = {},
): OperatorMcpDispatcherDependencies {
  return {
    isAuthorized: () => true,
    unauthorizedResponse: () => new Response("unauthorized", { status: 401 }),
    createSessionId: vi.fn(async () => "session-1"),
    initializeResult: vi.fn(async (requestedVersion) => ({
      protocolVersion: requestedVersion ?? "2025-06-18",
      capabilities: { tools: { listChanged: true } },
    })),
    runtimeHeaders: vi.fn((sessionId?: string) => ({
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
      "X-Lensically-Commit-Sha": "abc123",
    })),
    validateSession: vi.fn(async () => ({ ok: true, provided: false, stale: false })),
    executionKernelMetadata: vi.fn(() => ({ version: "kernel-v1" })),
    listTools: vi.fn(async () => [{ name: "readRepoFile" }]),
    handleToolCall: vi.fn(async ({ id, params }) => new Response(JSON.stringify({ id, params }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })),
    runtimeMetadata: vi.fn(() => ({ commit_sha: "abc123", mcp_version: "1.40.3" })),
    ...overrides,
  };
}

describe("Operator MCP dispatcher", () => {
  it("preserves POST-only admission and authorization", async () => {
    const deps = dependencies();
    const methodResponse = await dispatchOperatorMcpRequest(
      new Request("https://operator.example/api/operator/mcp", { method: "GET" }),
      deps,
    );
    expect(methodResponse.status).toBe(405);
    expect(methodResponse.headers.get("allow")).toBe("POST");

    const unauthorized = await dispatchOperatorMcpRequest(
      postRequest({ jsonrpc: "2.0", id: 1, method: "ping" }),
      dependencies({ isAuthorized: () => false }),
    );
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.text()).toBe("unauthorized");
  });

  it("preserves parse and invalid-request JSON-RPC errors", async () => {
    const parseResponse = await dispatchOperatorMcpRequest(
      postRequest("{"),
      dependencies(),
    );
    expect(parseResponse.status).toBe(400);
    expect(await parseResponse.json()).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });

    const invalidResponse = await dispatchOperatorMcpRequest(
      postRequest({ jsonrpc: "2.0", id: 3 }),
      dependencies(),
    );
    expect(invalidResponse.status).toBe(200);
    expect(await invalidResponse.json()).toEqual({
      jsonrpc: "2.0",
      id: 3,
      error: { code: -32600, message: "Invalid Request" },
    });
  });

  it("preserves initialize and deployment-scoped session headers", async () => {
    const deps = dependencies();
    const response = await dispatchOperatorMcpRequest(
      postRequest({
        jsonrpc: "2.0",
        id: "init-1",
        method: "initialize",
        params: { protocolVersion: "2025-03-26" },
      }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("mcp-protocol-version")).toBe("2025-03-26");
    expect(response.headers.get("mcp-session-id")).toBe("session-1");
    expect(response.headers.get("x-lensically-commit-sha")).toBe("abc123");
    expect(await response.json()).toEqual({
      jsonrpc: "2.0",
      id: "init-1",
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: true } },
      },
    });
    expect(deps.createSessionId).toHaveBeenCalledTimes(1);
    expect(deps.validateSession).not.toHaveBeenCalled();
  });

  it("preserves stale-session replacement and initialized notification", async () => {
    const staleDeps = dependencies({
      createSessionId: vi.fn(async () => "replacement-session"),
      validateSession: vi.fn(async () => ({
        ok: false,
        provided: true,
        stale: true,
        reason: "stale_mcp_deployment_session",
      })),
    });
    const staleResponse = await dispatchOperatorMcpRequest(
      postRequest({ jsonrpc: "2.0", id: 4, method: "ping" }),
      staleDeps,
    );
    expect(staleResponse.status).toBe(404);
    expect(staleResponse.headers.get("mcp-session-id")).toBe("replacement-session");
    expect(await staleResponse.json()).toEqual({
      jsonrpc: "2.0",
      id: 4,
      error: {
        code: -32001,
        message: "MCP deployment changed. Reinitialize before retrying the request.",
        data: {
          reason: "stale_mcp_deployment_session",
          execution_kernel: { version: "kernel-v1" },
        },
      },
    });

    const initializedResponse = await dispatchOperatorMcpRequest(
      postRequest({ jsonrpc: "2.0", method: "notifications/initialized" }),
      dependencies(),
    );
    expect(initializedResponse.status).toBe(202);
    expect(initializedResponse.headers.get("x-lensically-commit-sha")).toBe("abc123");
    expect(await initializedResponse.text()).toBe("");
  });

  it("preserves ping, tools/list, and tools/call delegation", async () => {
    const deps = dependencies();
    const ping = await dispatchOperatorMcpRequest(
      postRequest({ jsonrpc: "2.0", id: 5, method: "ping" }),
      deps,
    );
    expect(await ping.json()).toEqual({ jsonrpc: "2.0", id: 5, result: {} });

    const list = await dispatchOperatorMcpRequest(
      postRequest({ jsonrpc: "2.0", id: 6, method: "tools/list" }),
      deps,
    );
    expect(await list.json()).toEqual({
      jsonrpc: "2.0",
      id: 6,
      result: { tools: [{ name: "readRepoFile" }] },
    });

    const call = await dispatchOperatorMcpRequest(
      postRequest({
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: { name: "readRepoFile", arguments: { path: "README.md" } },
      }, { "cf-ray": "ray-7" }),
      deps,
    );
    expect(await call.json()).toEqual({
      id: 7,
      params: { name: "readRepoFile", arguments: { path: "README.md" } },
    });
    expect(deps.handleToolCall).toHaveBeenCalledWith(expect.objectContaining({
      id: 7,
      params: { name: "readRepoFile", arguments: { path: "README.md" } },
      requestId: "ray-7",
    }));
  });

  it("preserves unsupported-method and bounded internal-error shaping", async () => {
    const unsupported = await dispatchOperatorMcpRequest(
      postRequest({ jsonrpc: "2.0", id: 8, method: "resources/list" }),
      dependencies(),
    );
    expect(await unsupported.json()).toEqual({
      jsonrpc: "2.0",
      id: 8,
      error: { code: -32601, message: "Method not found" },
    });

    const failed = await dispatchOperatorMcpRequest(
      postRequest({
        jsonrpc: "2.0",
        id: 9,
        method: "tools/call",
        params: { name: "readRepoFile" },
      }, { "cf-ray": "ray-9" }),
      dependencies({
        handleToolCall: vi.fn(async () => {
          throw new Error("x".repeat(700));
        }),
      }),
    );
    expect(failed.status).toBe(200);
    expect(failed.headers.get("x-request-id")).toBe("ray-9");
    const body = await failed.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      jsonrpc: "2.0",
      id: 9,
      error: {
        code: -32603,
        data: {
          ok: false,
          error_code: "operator_mcp_method_failed",
          phase: "tools_call:readRepoFile",
          request_id: "ray-9",
          commit_sha: "abc123",
          mcp_version: "1.40.3",
          retryable: true,
          surface_available: true,
        },
      },
    });
    const error = (body.error as Record<string, unknown>);
    expect(String(error.message).startsWith("Internal MCP error: ")).toBe(true);
    const data = error.data as Record<string, unknown>;
    expect(String(data.safe_message)).toHaveLength(500);
  });
});
