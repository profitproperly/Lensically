type JsonRecord = Record<string, unknown>;

export interface OperatorWorkflowSessionStartDependencies {
  defaultWorkflowTemplateKey: string;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  createId(): string;
  getActiveSession(brandKey: string): Promise<JsonRecord | null>;
  insertSession(input: {
    sessionId: string;
    brandKey: string;
    workflowTemplateKey: string;
    notes: string | null;
  }): Promise<unknown>;
  workflowTemplatePayload(): unknown;
}

export async function startOperatorWorkflowSession(
  input: { brandKey: string; payload: JsonRecord },
  dependencies: OperatorWorkflowSessionStartDependencies,
): Promise<JsonRecord> {
  const existingSession = await dependencies.getActiveSession(input.brandKey);
  if (existingSession?.id) {
    return {
      workflow_session_id: existingSession.id,
      current_stage: existingSession.current_stage ?? "account_selection",
      next_required_stage: existingSession.current_stage === "account_selection"
        ? "context_admission"
        : null,
      workflow_template: dependencies.workflowTemplatePayload(),
      reused_existing: true,
      idempotency_reason: "active_workflow_session_already_exists",
    };
  }

  const sessionId = dependencies.createId();
  const workflowTemplateKey = dependencies.normalizeText(
    input.payload.workflow_template_key,
    120,
    true,
  ) ?? dependencies.defaultWorkflowTemplateKey;
  const notes = dependencies.normalizeText(input.payload.notes, 2000, true);
  await dependencies.insertSession({
    sessionId,
    brandKey: input.brandKey,
    workflowTemplateKey,
    notes,
  });
  return {
    workflow_session_id: sessionId,
    current_stage: "account_selection",
    next_required_stage: "context_admission",
    workflow_template: dependencies.workflowTemplatePayload(),
  };
}
