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
});
