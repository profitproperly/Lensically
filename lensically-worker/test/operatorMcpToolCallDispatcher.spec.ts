import { describe, expect, it, vi } from "vitest";
import {
  dispatchOperatorMcpToolCall as rawDispatchOperatorMcpToolCall,
  type OperatorMcpToolCallDependencies,
} from "../src/operatorMcpToolCallDispatcher";
import { OPERATOR_GOVERNING_STANDARDS_ACK } from "../src/operatorMcpProtocol";

type JsonRecord = Record<string, unknown>;

function baseDependencies(
  overrides: Partial<OperatorMcpToolCallDependencies> = {},
): OperatorMcpToolCallDependencies {
  const dependencies: OperatorMcpToolCallDependencies = {
    routedExecutionGateway: "executeLensicallyIntent",
    mandatoryExecutionMapVersion: "map-v1",
    preCallRoutingVersion: "pre-call-v1",
    executionPolicyVersion: "execution-v1",
    idempotencyVersion: "idempotency-v1",
    engineeringAuthorityVersion: "engineering-v1",
    executionGuardVersion: "guard-v1",
    guidedExecutionMode: "guided",
    autonomyMode: "autonomous",
    autonomyObjective: "grow",
    protectedTools: new Set<string>(),
    hardeningControllerTools: new Set<string>(),
    isPublicDirectToolName: vi.fn(() => true),
    gatewayAccountDataLoaded: vi.fn(async () => false),
    createExecutionGuard: vi.fn(async () => "guard"),
    compilePublicProfileRequest: vi.fn(() => ({
      ok: true,
      profile_id: "profile",
      request: { intent: "test" },
    })),
    prepareRoutedGatewayCall: vi.fn(async () => ({
      ok: true,
      tool_name: "getRepoStatus",
      arguments: {},
      map_execution: {},
      route_trail: [],
    })),
    toolExists: vi.fn(async () => true),
    verifyExecutionGuard: vi.fn(async () => ({ ok: true })),
    isEngineeringToolName: vi.fn(() => false),
    canonicalAutonomyToolName: vi.fn((toolName) => toolName),
    resolvePreCallRouting: vi.fn(async (_toolName, args) => ({
      arguments: args,
      corrections: [],
      route: null,
      redirect: false,
    })),
    normalizeText: vi.fn((value) => typeof value === "string" && value.trim() ? value.trim() : null),
    getBoundaryBlock: vi.fn(async () => null),
    buildExecutionPolicy: vi.fn((toolName) => ({
      canonical_tool: toolName,
      execution_plane: "operator_account",
      operation_class: "account_workflow",
    })),
    getKnownAliasRetryBlock: vi.fn(async () => null),
    recordExecutionDecision: vi.fn(async () => undefined),
    executionKernelMetadata: vi.fn(() => ({ name: "Execution Kernel" })),
    operatorIdempotencyKey: vi.fn(async () => null),
    beginOperationReceipt: vi.fn(async () => ({ existing: null, fingerprint: "fp", created: true })),
    parseJson: vi.fn((value) => JSON.parse(value) as unknown),
    operationLeaseMs: vi.fn(() => 120000),
    failOperationReceipt: vi.fn(async () => undefined),
    beginAutonomyAuthorization: vi.fn(async () => ({ allowed: true, governed: false })),
    completeAutonomyAuthorization: vi.fn(async () => undefined),
    classifyHandler: vi.fn(() => "account"),
    executeEngineeringTool: vi.fn(async () => ({ ok: true })),
    executeAdminTool: vi.fn(async () => ({ ok: true })),
    executeAccountTool: vi.fn(async () => ({ ok: true, status: "done" })),
    finalizeMandatoryExecutionMapCall: vi.fn(async () => ({ status: "completed" })),
    enforcePayloadBudget: vi.fn((payload) => payload),
    completeOperationReceipt: vi.fn(async () => undefined),
    normalizeMachineKey: vi.fn((value, fallback) => typeof value === "string" ? value : fallback),
    isExpectedHardeningControlResult: vi.fn(() => false),
    closeResolvedHardeningIncidentsForRequest: vi.fn(async () => 0),
    recordHardeningIncident: vi.fn(async () => ({
      incident: { id: "incident-1" },
      normal_work_blocked: true,
    })),
    publicProfileIdForToolName: vi.fn((toolName) => toolName),
    executionFingerprint: vi.fn(async () => "request-fingerprint"),
    toolMutatesState: vi.fn(() => false),
    buildActionClosure: vi.fn(async () => ({
      next_action: "continue",
      checkpoint: "resume",
    })),
    ...overrides,
  };
  return dependencies;
}

async function structuredContent(response: Response): Promise<JsonRecord> {
  const payload = await response.json() as JsonRecord;
  const result = payload.result as JsonRecord;
  return result.structuredContent as JsonRecord;
}

async function dispatchOperatorMcpToolCall(
  input: Parameters<typeof rawDispatchOperatorMcpToolCall>[0],
  dependencies: OperatorMcpToolCallDependencies,
): Promise<Response> {
  const argumentsRecord = input.params.arguments && typeof input.params.arguments === "object" && !Array.isArray(input.params.arguments)
    ? input.params.arguments as JsonRecord
    : {};
  return rawDispatchOperatorMcpToolCall({
    ...input,
    params: {
      ...input.params,
      arguments: {
        governing_standards_ack: OPERATOR_GOVERNING_STANDARDS_ACK,
        ...argumentsRecord,
      },
    },
  }, dependencies);
}

describe("Operator MCP tool-call dispatcher", () => {
  it("fails closed before routing or account loading when governing standards are not acknowledged", async () => {
    const dependencies = baseDependencies();
    const response = await rawDispatchOperatorMcpToolCall({
      request: new Request("https://lensically.test/mcp", { method: "POST" }),
      id: 0,
      params: { name: "getRepoStatus", arguments: {} },
    }, dependencies);
    expect(await structuredContent(response)).toMatchObject({
      ok: false,
      error: "governing_standards_ack_required",
      account_data_loaded: false,
      execution_started: false,
      governing_standards: {
        required_acknowledgment: OPERATOR_GOVERNING_STANDARDS_ACK,
      },
    });
    expect(dependencies.gatewayAccountDataLoaded).not.toHaveBeenCalled();
    expect(dependencies.createExecutionGuard).not.toHaveBeenCalled();
    expect(dependencies.executeAccountTool).not.toHaveBeenCalled();
  });
  it("preserves direct-public admission and rejects hidden routes", async () => {
    const dependencies = baseDependencies({
      isPublicDirectToolName: vi.fn(() => false),
    });
    const response = await dispatchOperatorMcpToolCall({
      request: new Request("https://lensically.test/mcp", { method: "POST" }),
      id: 1,
      params: { name: "hiddenTool", arguments: {} },
    }, dependencies);
    expect(await structuredContent(response)).toMatchObject({
      ok: false,
      error: "public_direct_tool_required",
      requested_tool: "hiddenTool",
      account_data_loaded: false,
    });
    expect(dependencies.gatewayAccountDataLoaded).not.toHaveBeenCalled();
  });

  it("preserves registered gateway compilation failures", async () => {
    const dependencies = baseDependencies({
      isPublicDirectToolName: vi.fn(() => false),
      compilePublicProfileRequest: vi.fn(() => ({
        ok: false,
        error: "unknown_profile",
        profile_id: null,
      })),
    });
    const response = await dispatchOperatorMcpToolCall({
      request: new Request("https://lensically.test/mcp", { method: "POST" }),
      id: 2,
      params: { name: "executeLensicallyIntent", arguments: {} },
    }, dependencies);
    expect(await structuredContent(response)).toMatchObject({
      ok: false,
      error: "unknown_profile",
      required_tool: "executeLensicallyIntent",
      freehand_gateway_payload_allowed: false,
    });
  });

  it("preserves proven pre-call redirects before execution", async () => {
    const executeAccountTool = vi.fn(async () => ({ ok: true }));
    const dependencies = baseDependencies({
      isPublicDirectToolName: vi.fn(() => false),
      executeAccountTool,
      resolvePreCallRouting: vi.fn(async (_toolName, args) => ({
        arguments: args,
        corrections: [{ field: "path" }],
        route: {
          required_tool: "readRepoFile",
          error: "pre_call_route_required",
          mandatory_route: "read the known file first",
        },
        redirect: true,
      })),
    });
    const response = await dispatchOperatorMcpToolCall({
      request: new Request("https://lensically.test/mcp", { method: "POST" }),
      id: 3,
      params: { name: "executeLensicallyIntent", arguments: {} },
    }, dependencies);
    expect(await structuredContent(response)).toMatchObject({
      ok: false,
      error: "pre_call_route_required",
      required_tool: "readRepoFile",
      required_route: "read the known file first",
    });
    expect(executeAccountTool).not.toHaveBeenCalled();
  });

  it("preserves completed idempotency replay without re-execution", async () => {
    const executeAccountTool = vi.fn(async () => ({ ok: true }));
    const dependencies = baseDependencies({
      executeAccountTool,
      operatorIdempotencyKey: vi.fn(async () => "idem-1"),
      beginOperationReceipt: vi.fn(async () => ({
        existing: {
          status: "completed",
          result_json: JSON.stringify({ ok: true, durable: true }),
        },
        fingerprint: "fp-1",
        created: false,
      })),
    });
    const response = await dispatchOperatorMcpToolCall({
      request: new Request("https://lensically.test/mcp", { method: "POST" }),
      id: 4,
      params: { name: "getRepoStatus", arguments: {} },
    }, dependencies);
    expect(await structuredContent(response)).toMatchObject({
      ok: true,
      durable: true,
      idempotency: {
        version: "idempotency-v1",
        key: "idem-1",
        replayed: true,
        request_fingerprint: "fp-1",
      },
    });
    expect(executeAccountTool).not.toHaveBeenCalled();
  });

    it("expires a stale started receipt from immutable creation time even when updated_at is fresh", async () => {
    const executeAccountTool = vi.fn(async () => ({ ok: true, durable: true }));
    const dependencies = baseDependencies({
      executeAccountTool,
      operatorIdempotencyKey: vi.fn(async () => "idem-stale-started"),
      operationLeaseMs: vi.fn(() => 120000),
      beginOperationReceipt: vi.fn(async () => ({
        existing: {
          status: "started",
          request_fingerprint: "fp-stale-started",
          created_at: "2000-01-01T00:00:00.000Z",
          updated_at: new Date().toISOString(),
        },
        fingerprint: "fp-stale-started",
        created: false,
      })),
    });
    const response = await dispatchOperatorMcpToolCall({
      request: new Request("https://lensically.test/mcp", { method: "POST" }),
      id: 5,
      params: { name: "mutatingTool", arguments: {} },
    }, dependencies);
    expect(await structuredContent(response)).toMatchObject({
      ok: true,
      durable: true,
    });
    expect(executeAccountTool).toHaveBeenCalledTimes(1);
  });

  it("preserves autonomy blocking before handler execution", async () => {
    const executeAccountTool = vi.fn(async () => ({ ok: true }));
    const failOperationReceipt = vi.fn(async () => undefined);
    const dependencies = baseDependencies({
      executeAccountTool,
      operatorIdempotencyKey: vi.fn(async () => "idem-2"),
      failOperationReceipt,
      beginAutonomyAuthorization: vi.fn(async () => ({
        allowed: false,
        governed: true,
        error: "approved_operator_decision_required",
      })),
    });
    const response = await dispatchOperatorMcpToolCall({
      request: new Request("https://lensically.test/mcp", { method: "POST" }),
      id: 5,
      params: { name: "mutatingTool", arguments: {} },
    }, dependencies);
    expect(await structuredContent(response)).toMatchObject({
      ok: false,
      governed: true,
      error: "approved_operator_decision_required",
    });
    expect(failOperationReceipt).toHaveBeenCalledWith("idem-2", expect.any(Error));
    expect(executeAccountTool).not.toHaveBeenCalled();
  });

  it("preserves handler completion, hardening intake, and action closure", async () => {
    const recordHardeningIncident = vi.fn(async () => ({
      incident: { id: "incident-9" },
      normal_work_blocked: true,
    }));
    const dependencies = baseDependencies({
      executeAccountTool: vi.fn(async () => ({ ok: false, error: "unexpected_failure" })),
      recordHardeningIncident,
      toolMutatesState: vi.fn(() => true),
    });
    const response = await dispatchOperatorMcpToolCall({
      request: new Request("https://lensically.test/mcp", { method: "POST" }),
      id: 6,
      params: { name: "mutatingTool", arguments: { workflow_session_id: "session-1" } },
    }, dependencies);
    const structured = await structuredContent(response);
    expect(structured).toMatchObject({
      ok: false,
      error: "unexpected_failure",
      hardening_incident: { id: "incident-9" },
      normal_work_blocked: true,
      operator_action_closure: {
        next_action: "continue",
        checkpoint: "resume",
      },
    });
    expect(recordHardeningIncident).toHaveBeenCalledWith(expect.objectContaining({
      boundary: "quality",
      operation_class: "mutation",
      request_fingerprint: "request-fingerprint",
    }));
  });
});
