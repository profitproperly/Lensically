import { describe, expect, it, vi } from "vitest";
import {
  startOperatorWorkflowSession,
  type OperatorWorkflowSessionStartDependencies,
} from "../src/operatorWorkflowSessionStartService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function createHarness() {
  const mocks = {
    getActiveSession: vi.fn(async () => null as JsonRecord | null),
    insertSession: vi.fn(async () => undefined),
    workflowTemplatePayload: vi.fn(() => ({ key: "template-v1" })),
  };
  const dependencies: OperatorWorkflowSessionStartDependencies = {
    defaultWorkflowTemplateKey: "operator-default-v1",
    normalizeText,
    createId: () => "session-new",
    getActiveSession: mocks.getActiveSession,
    insertSession: mocks.insertSession,
    workflowTemplatePayload: mocks.workflowTemplatePayload,
  };
  return { mocks, dependencies };
}

describe("operatorWorkflowSessionStartService", () => {
  it("reuses an account-selection session with exact idempotency guidance", async () => {
    const harness = createHarness();
    harness.mocks.getActiveSession.mockResolvedValue({
      id: "session-existing",
      current_stage: "account_selection",
    });

    expect(await startOperatorWorkflowSession({
      brandKey: "manifest_mental",
      payload: {},
    }, harness.dependencies)).toEqual({
      workflow_session_id: "session-existing",
      current_stage: "account_selection",
      next_required_stage: "context_admission",
      workflow_template: { key: "template-v1" },
      reused_existing: true,
      idempotency_reason: "active_workflow_session_already_exists",
    });
    expect(harness.mocks.insertSession).not.toHaveBeenCalled();
  });

  it("reuses later-stage sessions without forcing context admission", async () => {
    const harness = createHarness();
    harness.mocks.getActiveSession.mockResolvedValue({
      id: "session-existing",
      current_stage: "source_card_selection",
    });

    const result = await startOperatorWorkflowSession({ brandKey: "manifest_mental", payload: {} }, harness.dependencies);

    expect(result.current_stage).toBe("source_card_selection");
    expect(result.next_required_stage).toBeNull();
    expect(harness.mocks.insertSession).not.toHaveBeenCalled();
  });

  it("preserves the missing existing-stage display and next-stage edge contract", async () => {
    const harness = createHarness();
    harness.mocks.getActiveSession.mockResolvedValue({ id: "session-existing", current_stage: null });

    const result = await startOperatorWorkflowSession({ brandKey: "manifest_mental", payload: {} }, harness.dependencies);

    expect(result.current_stage).toBe("account_selection");
    expect(result.next_required_stage).toBeNull();
  });

  it("creates a new session with the canonical template fallback and null notes", async () => {
    const harness = createHarness();

    expect(await startOperatorWorkflowSession({
      brandKey: "manifest_mental",
      payload: {},
    }, harness.dependencies)).toEqual({
      workflow_session_id: "session-new",
      current_stage: "account_selection",
      next_required_stage: "context_admission",
      workflow_template: { key: "template-v1" },
    });
    expect(harness.mocks.insertSession).toHaveBeenCalledWith({
      sessionId: "session-new",
      brandKey: "manifest_mental",
      workflowTemplateKey: "operator-default-v1",
      notes: null,
    });
  });

  it("normalizes a requested template and notes for new-session persistence", async () => {
    const harness = createHarness();

    await startOperatorWorkflowSession({
      brandKey: "vectrix",
      payload: { workflow_template_key: " custom-template ", notes: " launch notes " },
    }, harness.dependencies);

    expect(harness.mocks.insertSession).toHaveBeenCalledWith({
      sessionId: "session-new",
      brandKey: "vectrix",
      workflowTemplateKey: "custom-template",
      notes: "launch notes",
    });
  });
});
