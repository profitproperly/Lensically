import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src";
import {
  HUMAN_FREE_AUTONOMY_CONTRACT,
  HUMAN_FREE_AUTONOMY_POLICY_VERSION,
  SCHEDULED_POST_DELETION_REASON_CODES,
  buildScheduledPostDeletionReason,
  isHumanLearningApiRetired,
  normalizeScheduledPostDeletionReasonCode,
} from "../src/humanFreeAutonomy";

async function fetchFromWorker(path: string, init?: RequestInit): Promise<Response> {
  const request = new Request(`https://example.com${path}`, init);
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

describe("human-free autonomy contract", () => {
  it("keeps human guidance outside the learning plane", () => {
    expect(HUMAN_FREE_AUTONOMY_POLICY_VERSION).toBe("human-free-autonomy-v1");
    expect(isHumanLearningApiRetired()).toBe(true);
    expect(HUMAN_FREE_AUTONOMY_CONTRACT.prohibited_learning_inputs).toEqual(expect.arrayContaining([
      "owner approvals",
      "owner rejections",
      "owner edits",
      "owner taste feedback",
      "guided-review history",
      "scheduled-post deletion history",
    ]));
    expect(HUMAN_FREE_AUTONOMY_CONTRACT.learning_inputs).toEqual(expect.arrayContaining([
      "published market performance",
      "mature metric snapshots",
      "source-family evidence",
      "experiment outcomes",
    ]));
  });

  it("treats every scheduled deletion as unobserved operational state", () => {
    expect(SCHEDULED_POST_DELETION_REASON_CODES).toEqual([
      "constitution_violation",
      "platform_safety",
      "exact_duplicate",
      "technical_corruption",
      "wrong_account_or_slot",
      "owner_emergency_withdrawal",
    ]);
    expect(HUMAN_FREE_AUTONOMY_CONTRACT.deletion_policy).toMatchObject({
      learning_effect: "unobserved",
      selection_effect: "none",
      family_label_effect: "none",
      strategy_effect: "none",
    });
    expect(normalizeScheduledPostDeletionReasonCode(" exact_duplicate ")).toBe("exact_duplicate");
    expect(normalizeScheduledPostDeletionReasonCode("unsupported_reason")).toBeNull();
    expect(buildScheduledPostDeletionReason("technical_corruption", "Malformed payload")).toBe("Malformed payload");
  });

  it.each([
    ["/api/gpt-memory/dashboard", "gpt_memory_retired"],
    ["/api/agent/accounts", "legacy_agent_mode_retired"],
    ["/api/threads/intelligence-dashboard", "intelligence_dashboard_retired"],
    ["/api/automation/context", "legacy_automation_api_retired"],
  ])("retires %s", async (path, expectedError) => {
    const response = await fetchFromWorker(path);
    expect(response.status).toBe(410);
    const body = await response.json() as Record<string, unknown>;
    expect(body.error).toBe(expectedError);
  });

    it("retires guided workflow tables while preserving active backend strategy memory", async () => {
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";
        const retirement = await env.DB.prepare(
      "SELECT retirement_key FROM operator_system_retirements WHERE retirement_key = 'human-free-retirement-v2'",
    ).first<{ retirement_key?: string }>();
    expect(retirement).toEqual({ retirement_key: "human-free-retirement-v2" });
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS gpt_strategy_memory (id TEXT)").run();
    const response = await fetchFromWorker("/api/operator/tools/list_accounts", {
      headers: { authorization: "Bearer test-gpt-key" },
    });
    expect(response.status).toBe(200);
        for (const table of [
      "operator_workflow_sessions",
      "operator_context_admissions",
      "operator_production_board_items",
      "operator_review_batches",
    ]) {
      const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
        .bind(table)
        .first<{ name?: string }>();
      expect(row).toBeNull();
    }
    const strategyMemoryTable = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'gpt_strategy_memory' LIMIT 1")
      .first<{ name?: string }>();
    expect(strategyMemoryTable).toEqual({ name: "gpt_strategy_memory" });
    const retiredTool = await fetchFromWorker("/api/operator/tools/approve_draft", {
      method: "POST",
      headers: {
        authorization: "Bearer test-gpt-key",
        "content-type": "application/json",
      },
      body: JSON.stringify({ brand_key: "manifest_mental", draft_id: "retired" }),
    });
    expect(retiredTool.status).toBe(410);
    expect((await retiredTool.json() as Record<string, unknown>).error).toBe("human_guidance_tool_retired");
  });
});
