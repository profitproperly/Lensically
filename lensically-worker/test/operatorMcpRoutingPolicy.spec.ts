import { describe, expect, it } from "vitest";
import {
  MANIFEST_AUTONOMOUS_PROCEED_EXEMPT_TOOLS,
  canonicalAutonomyToolName,
  canonicalOperatorExecutionArgs,
  canonicalScopedOperatorMcpToolName,
  classifyOperatorMcpHandler,
  createOperatorMcpRoutingPolicy,
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
