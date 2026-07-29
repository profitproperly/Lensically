import { describe, expect, it, vi } from "vitest";
import {
    MANIFEST_AUTONOMOUS_PROCEED_EXEMPT_TOOLS,
  admitOperatorRuntimeToolCall,
  canonicalAutonomyToolName,
  canonicalOperatorExecutionArgs,
  canonicalScopedOperatorMcpToolName,
  classifyOperatorMcpHandler,
    createOperatorMcpRoutingPolicy,
  dispatchOperatorManifestRuntimeTool,
  operatorMcpCallRequiresProceed,
  operatorMcpProceedConfirmed,
  requestedMcpBrandKey,
  scopeOperatorMcpToolCall,
} from "../src/operatorMcpRoutingPolicy";
import type { OperatorMcpBrandKey } from "../src/operatorMcpProtocol";

const normalizeBrandKey = (value: unknown): OperatorMcpBrandKey | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/-/g, "_");
  if (["manifest_mental", "manifestmental", "manifest"].includes(normalized)) return "manifest_mental";
  if (["opmg_deadman", "opmgdeadman", "deadman", "opmg"].includes(normalized)) return "opmg_deadman";
  if (["vectrix", "vectrixvoltmore"].includes(normalized)) return "vectrix";
  return null;
};

const normalizeText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
};

const policy = createOperatorMcpRoutingPolicy({ normalizeBrandKey, normalizeText });

describe("Operator MCP routing policy", () => {
  it("preserves scoped wrapper canonicalization and account injection", () => {
    const sourceArgs = { published_post_id: "post-1" };
    expect(canonicalScopedOperatorMcpToolName("mm_get_post_results")).toBe("get_post_results");
    expect(scopeOperatorMcpToolCall("mm_get_post_results", sourceArgs)).toEqual({
      tool_name: "get_post_results",
      args: { published_post_id: "post-1", brand_key: "manifestmental" },
      scoped_brand_key: "manifest_mental",
    });
    expect(scopeOperatorMcpToolCall("om_get_post_results", {})).toMatchObject({
      tool_name: "get_post_results",
      args: { brand_key: "opmgdeadman" },
      scoped_brand_key: "opmg_deadman",
    });
    expect(scopeOperatorMcpToolCall("vx_get_post_results", {})).toMatchObject({
      tool_name: "get_post_results",
      args: { brand_key: "vectrix" },
      scoped_brand_key: "vectrix",
    });
    expect(sourceArgs).toEqual({ published_post_id: "post-1" });
  });

  it("preserves scoped precedence and direct brand alias normalization", () => {
    expect(requestedMcpBrandKey("mm_get_account_state", { brand_key: "vectrix" }, normalizeBrandKey)).toBe("manifest_mental");
    expect(requestedMcpBrandKey("get_account_state", { brand_key: "Manifest-Mental" }, normalizeBrandKey)).toBe("manifest_mental");
    expect(requestedMcpBrandKey("get_account_state", { brand_key: "deadman" }, normalizeBrandKey)).toBe("opmg_deadman");
    expect(requestedMcpBrandKey("get_account_state", { brand_key: "vectrixvoltmore" }, normalizeBrandKey)).toBe("vectrix");
    expect(requestedMcpBrandKey("get_account_state", {}, normalizeBrandKey)).toBeNull();
  });

  it("preserves guided Proceed requirements and autonomous exemptions", () => {
    expect(MANIFEST_AUTONOMOUS_PROCEED_EXEMPT_TOOLS.has("prepare_manifest_autonomous_cycle")).toBe(true);
    expect(operatorMcpCallRequiresProceed("prepare_manifest_autonomous_cycle", { brand_key: "manifest_mental" }, normalizeBrandKey)).toBe(false);
    expect(operatorMcpCallRequiresProceed("get_account_state", { brand_key: "manifest_mental" }, normalizeBrandKey)).toBe(true);
    expect(operatorMcpCallRequiresProceed("mm_get_account_state", {}, normalizeBrandKey)).toBe(true);
    expect(operatorMcpCallRequiresProceed("list_accounts", {}, normalizeBrandKey)).toBe(false);
    expect(operatorMcpCallRequiresProceed("updateWorkflowRequirement", { brand_key: "manifest" }, normalizeBrandKey)).toBe(true);
    expect(operatorMcpCallRequiresProceed("updateWorkflowRequirement", {}, normalizeBrandKey)).toBe(false);
    expect(operatorMcpProceedConfirmed("get_account_state", { proceed_confirmed: true })).toBe(true);
    expect(operatorMcpProceedConfirmed("get_account_state", { proceed_confirmed: false })).toBe(false);
  });

  it("preserves nested alias canonicalization and strips execution metadata", () => {
    expect(canonicalOperatorExecutionArgs("listMcpTools", {
      execute_tool: " runEngineeringTool ",
      arguments: {
        tool_name: " readRepoFile ",
        arguments: {
          path: "README.md",
          execution_guard: "signed",
          proceed_confirmed: true,
          continuity_loaded: true,
          continuity_ref: "ref",
          continuity_token: "token",
        },
      },
    }, normalizeText)).toEqual({
      tool_name: "readRepoFile",
      args: { path: "README.md" },
    });
  });

  it("preserves autonomy canonical names and handler classification", () => {
    expect(canonicalAutonomyToolName("mm_delete_scheduled_post")).toBe("delete_scheduled_post");
    expect(canonicalAutonomyToolName("runApprovedPostCanary")).toBe("setScheduledPostSchedulerMode");
    expect(classifyOperatorMcpHandler("readRepoFile")).toBe("engineering");
    expect(classifyOperatorMcpHandler("getGrowthMission")).toBe("admin");
    expect(classifyOperatorMcpHandler("get_account_state")).toBe("account");
  });

    it("binds injected normalizers into one deterministic routing policy", () => {
    expect(policy.requestedBrandKey("get_account_state", { brand_key: "opmg" })).toBe("opmg_deadman");
    expect(policy.callRequiresProceed("get_manifest_cycle_receipt", { brand_key: "manifest" })).toBe(false);
    expect(policy.canonicalExecutionArgs("runEngineeringTool", {
      tool_name: " searchRepoFiles ",
      arguments: { query: "needle", prefix: "src/index.ts", execution_guard: "signed" },
    })).toEqual({
      tool_name: "searchRepoFiles",
      args: { query: "needle", prefix: "src/index.ts" },
    });
    expect(policy.classifyHandler("get_monthly_growth_review")).toBe("admin");
  });
});

type RuntimeBrand = { brand_key: string };

function createRuntimeAdmissionDependencies() {
  const events: string[] = [];
  const dependencies = {
    isAuthorized: vi.fn((_request: Request) => true),
    unauthorizedResponse: vi.fn(() => new Response("unauthorized", { status: 401 })),
    canonicalToolName: vi.fn((toolName: string) => toolName.replace(/^(?:mm_|om_|vx_)/, "")),
    retiredToolNames: new Set<string>(["retired_guidance"]),
    retiredToolResponse: vi.fn((canonicalToolName: string) => new Response(
      JSON.stringify({ error: "human_guidance_tool_retired", tool_name: canonicalToolName }),
      { status: 410 },
    )),
    prepare: vi.fn(async () => { events.push("prepare"); }),
    readPayload: vi.fn(async (_request: Request) => {
      events.push("read_payload");
      return { draft_id: "draft-1" } as Record<string, unknown>;
    }),
    scopeCall: vi.fn((toolName: string, payload: Record<string, unknown>) => {
      events.push("scope_call");
      return {
        tool_name: toolName,
        args: { ...payload },
        scoped_brand_key: null as OperatorMcpBrandKey | null,
      };
    }),
    accountDirectoryResponse: vi.fn(async () => new Response(
      JSON.stringify({ accounts: [] }),
      { status: 200 },
    )),
    resolveBrand: vi.fn(async (_payload: Record<string, unknown>): Promise<RuntimeBrand | null> => {
      events.push("resolve_brand");
      return { brand_key: "manifest_mental" };
    }),
    missingBrandResponse: vi.fn(() => new Response(
      JSON.stringify({ success: false, error: "brand_key is required or unavailable" }),
      { status: 400 },
    )),
  };
  return { events, dependencies };
}

describe("Operator runtime admission", () => {
  const request = new Request("https://api.lensically.com/operator", { method: "POST" });

  it("stops unauthorized requests before routing work", async () => {
    const { events, dependencies } = createRuntimeAdmissionDependencies();
    dependencies.isAuthorized.mockReturnValue(false);

    const result = await admitOperatorRuntimeToolCall({ request, toolName: "get_account_state" }, dependencies);

    expect(result.kind).toBe("response");
    if (result.kind === "response") expect(result.response.status).toBe(401);
    expect(events).toEqual([]);
    expect(dependencies.canonicalToolName).not.toHaveBeenCalled();
  });

  it("retires canonical tools before preparation or payload reads", async () => {
    const { events, dependencies } = createRuntimeAdmissionDependencies();

    const result = await admitOperatorRuntimeToolCall({ request, toolName: "mm_retired_guidance" }, dependencies);

    expect(result.kind).toBe("response");
    if (result.kind === "response") {
      expect(result.response.status).toBe(410);
      expect(await result.response.json()).toMatchObject({
        error: "human_guidance_tool_retired",
        tool_name: "retired_guidance",
      });
    }
    expect(events).toEqual([]);
    expect(dependencies.readPayload).not.toHaveBeenCalled();
  });

  it("preserves scoped payload admission and brand resolution order", async () => {
    const { events, dependencies } = createRuntimeAdmissionDependencies();
    dependencies.scopeCall.mockImplementation((toolName, payload) => {
      events.push("scope_call");
      return {
        tool_name: toolName.slice(3),
        args: { ...payload, brand_key: "manifestmental" },
        scoped_brand_key: "manifest_mental",
      };
    });

    const result = await admitOperatorRuntimeToolCall({ request, toolName: "mm_get_account_state" }, dependencies);

    expect(result).toEqual({
      kind: "context",
      toolName: "get_account_state",
      payload: { draft_id: "draft-1", brand_key: "manifestmental" },
      brand: { brand_key: "manifest_mental" },
    });
    expect(events).toEqual(["prepare", "read_payload", "scope_call", "resolve_brand"]);
    expect(dependencies.resolveBrand).toHaveBeenCalledWith({
      draft_id: "draft-1",
      brand_key: "manifestmental",
    });
  });

  it("serves the account directory without brand resolution", async () => {
    const { dependencies } = createRuntimeAdmissionDependencies();
    dependencies.scopeCall.mockReturnValue({
      tool_name: "list_accounts",
      args: {},
      scoped_brand_key: null,
    });

    const result = await admitOperatorRuntimeToolCall({ request, toolName: "list_accounts" }, dependencies);

    expect(result.kind).toBe("response");
    if (result.kind === "response") expect(result.response.status).toBe(200);
    expect(dependencies.accountDirectoryResponse).toHaveBeenCalledTimes(1);
    expect(dependencies.resolveBrand).not.toHaveBeenCalled();
  });

    it("returns the exact missing-brand response after scoped admission", async () => {
    const { events, dependencies } = createRuntimeAdmissionDependencies();
    dependencies.resolveBrand.mockImplementationOnce(async () => {
      events.push("resolve_brand");
      return null;
    });

    const result = await admitOperatorRuntimeToolCall({ request, toolName: "get_account_state" }, dependencies);

    expect(result.kind).toBe("response");
    if (result.kind === "response") expect(result.response.status).toBe(400);
    expect(events).toEqual(["prepare", "read_payload", "scope_call", "resolve_brand"]);
    expect(dependencies.missingBrandResponse).toHaveBeenCalledTimes(1);
  });
});

function createManifestRuntimeDependencies() {
  const events: string[] = [];
  const dependencies = {
    isCycleServiceToolName: vi.fn((toolName: string) => toolName === "get_manifest_cycle_receipt"),
    handleCycleService: vi.fn(async () => ({ body: { source: "cycle_service" }, status: 207 })),
    prepare: vi.fn(async () => ({ success: true, source: "prepare" } as Record<string, unknown>)),
    persist: vi.fn(async () => ({ success: true, source: "persist" } as Record<string, unknown>)),
    review: vi.fn(async () => ({ success: true, source: "review" } as Record<string, unknown>)),
    observe: vi.fn(async (toolName: string, _payload: Record<string, unknown>, result: Record<string, unknown>) => {
      events.push(`observe:${toolName}`);
      return { ...result, observed: true };
    }),
  };
  return { events, dependencies };
}

describe("Operator Manifest runtime dispatch", () => {
  it("routes cycle-service tools before autonomous branches", async () => {
    const { dependencies } = createManifestRuntimeDependencies();
    const result = await dispatchOperatorManifestRuntimeTool({
      toolName: "get_manifest_cycle_receipt",
      payload: { cycle_id: "cycle-1" },
    }, dependencies);

    expect(result).toEqual({ handled: true, body: { source: "cycle_service" }, status: 207 });
    expect(dependencies.handleCycleService).toHaveBeenCalledTimes(1);
    expect(dependencies.prepare).not.toHaveBeenCalled();
  });

  it("observes successful autonomous preparation", async () => {
    const { events, dependencies } = createManifestRuntimeDependencies();
    const result = await dispatchOperatorManifestRuntimeTool({
      toolName: "prepare_manifest_autonomous_cycle",
      payload: { cycle_id: "cycle-1" },
    }, dependencies);

    expect(result).toEqual({
      handled: true,
      body: { success: true, source: "prepare", observed: true },
      status: 200,
    });
    expect(events).toEqual(["observe:prepare_manifest_autonomous_cycle"]);
  });

  it("normalizes preparation exceptions through cycle observation", async () => {
    const { dependencies } = createManifestRuntimeDependencies();
    dependencies.prepare.mockRejectedValueOnce(new Error("prepare exploded"));
    const result = await dispatchOperatorManifestRuntimeTool({
      toolName: "prepare_manifest_autonomous_cycle",
      payload: { cycle_id: "cycle-2" },
    }, dependencies);

    expect(result).toMatchObject({
      handled: true,
      status: 500,
      body: {
        success: false,
        cycle_id: "cycle-2",
        stage: "preparation_exception",
        error: "prepare exploded",
        observed: true,
      },
    });
  });

  it("preserves the retired monolithic commit response", async () => {
    const { dependencies } = createManifestRuntimeDependencies();
    const result = await dispatchOperatorManifestRuntimeTool({
      toolName: "commit_manifest_autonomous_runway",
      payload: {},
    }, dependencies);

    expect(result).toEqual({
      handled: true,
      status: 410,
      body: {
        success: false,
        error: "retired_monolithic_autonomous_commit",
        replacement_tool: "persist_manifest_autonomous_post",
        retryable: false,
      },
    });
  });

  it("normalizes ambiguous persistence exceptions without retrying", async () => {
    const { dependencies } = createManifestRuntimeDependencies();
    dependencies.persist.mockRejectedValueOnce(new Error("persist interrupted"));
    const result = await dispatchOperatorManifestRuntimeTool({
      toolName: "persist_manifest_autonomous_post",
      payload: { cycle_id: "cycle-3" },
    }, dependencies);

    expect(result).toMatchObject({
      handled: true,
      status: 500,
      body: {
        success: false,
        cycle_id: "cycle-3",
        error: "persist interrupted",
        side_effect_state: "unknown",
        retryable: true,
        observed: true,
      },
    });
  });

  it("routes scheduled review and leaves unrelated tools unhandled", async () => {
    const { dependencies } = createManifestRuntimeDependencies();
    const review = await dispatchOperatorManifestRuntimeTool({
      toolName: "review_manifest_scheduled_post",
      payload: { scheduled_post_id: 7 },
    }, dependencies);
    const unrelated = await dispatchOperatorManifestRuntimeTool({
      toolName: "get_account_state",
      payload: {},
    }, dependencies);

    expect(review).toEqual({
      handled: true,
      body: { success: true, source: "review" },
      status: 200,
    });
    expect(unrelated).toEqual({ handled: false });
  });
});



