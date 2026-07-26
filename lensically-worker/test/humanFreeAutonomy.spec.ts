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

  it("prepares active operator state without recreating guided workflow tables", async () => {
    (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT, email_verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, timezone TEXT, clock_format TEXT)").run();
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS operator_system_retirements (retirement_key TEXT PRIMARY KEY, completed_at TEXT)").run();
    await env.DB.prepare("DELETE FROM operator_system_retirements WHERE retirement_key = 'human-free-retirement-v2'").run();
    for (const table of [
      "operator_workflow_sessions",
      "operator_context_admissions",
      "operator_production_board_items",
      "operator_review_batches",
      "gpt_strategy_memory",
    ]) {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT)`).run();
    }
    const response = await fetchFromWorker("/api/operator/tools/list_accounts", {
      headers: { authorization: "Bearer test-gpt-key" },
    });
    expect(response.status).toBe(200);
    for (const table of [
      "operator_workflow_sessions",
      "operator_context_admissions",
      "operator_production_board_items",
      "operator_review_batches",
      "gpt_strategy_memory",
    ]) {
      const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
        .bind(table)
        .first<{ name?: string }>();
      expect(row).toBeNull();
    }
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
