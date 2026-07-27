import { describe, expect, it, vi } from "vitest";
import {
  readOperatorAccountState,
  type OperatorAccountStateDependencies,
} from "../src/operatorAccountStateService";

type JsonRecord = Record<string, unknown>;

function createHarness() {
  const mocks = {
    getActiveSession: vi.fn(async () => ({ id: "session-1", active_source_card_id: "card-1" } as JsonRecord)),
    getSourceCard: vi.fn(async () => ({ id: "card-1", title: "Source" } as JsonRecord)),
    listDraftsByStatus: vi.fn(async (_accountId: string, statuses: string[]) => statuses[0] === "approved"
      ? [{ id: "draft-approved" }]
      : [{ id: "draft-rejected" }]),
    countScheduledPosts: vi.fn(async () => 7),
    listActiveGates: vi.fn(async () => [{ id: "gate-1" }, { id: "gate-2" }]),
  };
  const dependencies: OperatorAccountStateDependencies = {
    getActiveSession: mocks.getActiveSession,
    getSourceCard: mocks.getSourceCard,
    listDraftsByStatus: mocks.listDraftsByStatus,
    countScheduledPosts: mocks.countScheduledPosts,
    listActiveGates: mocks.listActiveGates,
  };
  return { mocks, dependencies };
}

describe("operatorAccountStateService", () => {
  it("reads the selected account state and resolves its active source card", async () => {
    const harness = createHarness();
    const result = await readOperatorAccountState({
      brandKey: "manifest_mental",
      accountId: "account-1",
      threadsUserId: "threads-1",
    }, harness.dependencies);

    expect(harness.mocks.getSourceCard).toHaveBeenCalledWith("manifest_mental", "card-1");
    expect(harness.mocks.listDraftsByStatus).toHaveBeenNthCalledWith(1, "account-1", ["approved"], 5);
    expect(harness.mocks.listDraftsByStatus).toHaveBeenNthCalledWith(2, "account-1", ["rejected"], 5);
    expect(harness.mocks.countScheduledPosts).toHaveBeenCalledWith("threads-1");
    expect(result).toEqual({
      brand_key: "manifest_mental",
      active_workflow_session: { id: "session-1", active_source_card_id: "card-1" },
      active_source_card: { id: "card-1", title: "Source" },
      latest_approved_drafts: [{ id: "draft-approved" }],
      latest_rejected_drafts: [{ id: "draft-rejected" }],
      scheduled_posts_count: 7,
      active_gates_count: 2,
      warnings: [],
    });
  });

  it("does not read a source card when the active session has no source identity", async () => {
    const harness = createHarness();
    harness.mocks.getActiveSession.mockResolvedValue({ id: "session-1", active_source_card_id: null });

    const result = await readOperatorAccountState({
      brandKey: "vectrix",
      accountId: "account-2",
      threadsUserId: "threads-2",
    }, harness.dependencies);

    expect(harness.mocks.getSourceCard).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      brand_key: "vectrix",
      active_source_card: null,
    });
  });

  it("normalizes an unavailable scheduled count without changing the response contract", async () => {
    const harness = createHarness();
    harness.mocks.countScheduledPosts.mockResolvedValue(Number.NaN);
    const result = await readOperatorAccountState({
      brandKey: "opmg_deadman",
      accountId: "account-3",
      threadsUserId: "threads-3",
    }, harness.dependencies);

    expect(result).toMatchObject({
      brand_key: "opmg_deadman",
      scheduled_posts_count: Number.NaN,
      warnings: [],
    });
  });
});
