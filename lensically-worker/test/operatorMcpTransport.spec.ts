import { describe, expect, it } from "vitest";
import {
  buildMcpToolResultEnvelope,
  buildOperatorMcpRuntimeHeaders,
  buildOperatorMcpToolCompletionText,
  mcpErrorResponse,
  mcpJsonResponse,
  mcpToolCompletionResponse,
  mcpToolResultResponse,
  operatorTransportFailureResponse,
} from "../src/operatorMcpTransport";

describe("Operator MCP transport", () => {
  it("preserves JSON status, cache, content type, and extra headers", async () => {
    const response = mcpJsonResponse({ ok: true }, 201, { "x-request-id": "req-1" });
    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toBe("application/json; charset=UTF-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe("req-1");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("preserves JSON-RPC errors, null IDs, optional data, and request IDs", async () => {
    const response = mcpErrorResponse(undefined, -32602, "Unknown tool", 404, {
      requested_tool: "missing",
    }, "req-2");
    expect(response.status).toBe(404);
    expect(response.headers.get("x-request-id")).toBe("req-2");
    expect(await response.json()).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32602,
        message: "Unknown tool",
        data: { requested_tool: "missing" },
      },
    });
  });

  it("preserves exact MCP tool-result envelopes and response shaping", async () => {
    const envelope = buildMcpToolResultEnvelope(7, { ok: false, error: "blocked" }, "Blocked.", true);
    expect(envelope).toEqual({
      jsonrpc: "2.0",
      id: 7,
      result: {
        structuredContent: { ok: false, error: "blocked" },
        content: [{ type: "text", text: "Blocked." }],
        isError: true,
      },
    });
    const response = mcpToolResultResponse(7, { ok: false, error: "blocked" }, "Blocked.", true);
    expect(await response.json()).toEqual(envelope);
  });

  it("preserves canonical completion and failure language", async () => {
    const completedPayload = {
      ok: true,
      operator_action_closure: {
        next_action: "Continue validation.",
        checkpoint: "Resume from durable validation state.",
      },
    };
    expect(buildOperatorMcpToolCompletionText("readRepoFile", completedPayload, false)).toBe(
      "Lensically Operator Mode tool readRepoFile completed. Required turn closure: record progress; preserve deferred work; declare next action: Continue validation.; emit checkpoint: Resume from durable validation state.",
    );
    const failedPayload = {
      ok: false,
      error: "file_not_found",
      operator_action_closure: { next_action: "Use a known file path." },
    };
    expect(buildOperatorMcpToolCompletionText("readRepoFile", failedPayload, true)).toBe(
      "Lensically Operator Mode tool readRepoFile failed: file_not_found. Required next action: Use a known file path.",
    );
    const response = mcpToolCompletionResponse(11, "readRepoFile", failedPayload, true);
    const body = await response.json() as Record<string, unknown>;
    expect(body).toMatchObject({ jsonrpc: "2.0", id: 11 });
    expect((body.result as Record<string, unknown>).isError).toBe(true);
  });

  it("preserves deployment, commit, kernel, and optional session headers", () => {
    expect(buildOperatorMcpRuntimeHeaders({
      sessionId: "session-1",
      deploymentId: "deployment-1",
      commitSha: "abc123",
      executionKernelVersion: "kernel-v1",
    })).toEqual({
      "Mcp-Session-Id": "session-1",
      "X-Lensically-Deployment-Id": "deployment-1",
      "X-Lensically-Commit-Sha": "abc123",
      "X-Lensically-Execution-Kernel": "kernel-v1",
    });
    expect(buildOperatorMcpRuntimeHeaders({
      deploymentId: "deployment-1",
      commitSha: "unknown",
      executionKernelVersion: "kernel-v1",
    })).not.toHaveProperty("Mcp-Session-Id");
  });

  it("preserves bounded transport failures and runtime evidence", async () => {
    const response = operatorTransportFailureResponse({
      requestId: "req-3",
      phase: "mcp_transport",
      error: new Error("x".repeat(700)),
      status: 503,
      runtimeMetadata: {
        commit_sha: "abc123",
        mcp_version: "1.40.3",
      },
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("x-request-id")).toBe("req-3");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      ok: false,
      error_code: "operator_transport_failure",
      phase: "mcp_transport",
      request_id: "req-3",
      commit_sha: "abc123",
      mcp_version: "1.40.3",
    });
    expect(String(body.message)).toHaveLength(500);
  });
});
