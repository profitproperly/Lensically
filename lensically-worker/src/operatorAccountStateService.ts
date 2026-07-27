type JsonRecord = Record<string, unknown>;

export interface OperatorAccountStateDependencies {
  getActiveSession(brandKey: string): Promise<JsonRecord | null>;
  getSourceCard(brandKey: string, sourceCardId: string): Promise<JsonRecord | null>;
  listDraftsByStatus(accountId: string, statuses: string[], limit: number): Promise<JsonRecord[]>;
  countScheduledPosts(threadsUserId: string): Promise<number>;
  listActiveGates(brandKey: string): Promise<JsonRecord[]>;
}

export async function readOperatorAccountState(
  input: {
    brandKey: string;
    accountId: string;
    threadsUserId: string;
  },
  dependencies: OperatorAccountStateDependencies,
): Promise<JsonRecord> {
  const activeSession = await dependencies.getActiveSession(input.brandKey);
  const activeSourceCard = activeSession?.active_source_card_id
    ? await dependencies.getSourceCard(input.brandKey, String(activeSession.active_source_card_id))
    : null;
  const approved = await dependencies.listDraftsByStatus(input.accountId, ["approved"], 5);
  const rejected = await dependencies.listDraftsByStatus(input.accountId, ["rejected"], 5);
  const scheduledCount = await dependencies.countScheduledPosts(input.threadsUserId);
  const gates = await dependencies.listActiveGates(input.brandKey);
  return {
    brand_key: input.brandKey,
    active_workflow_session: activeSession,
    active_source_card: activeSourceCard,
    latest_approved_drafts: approved,
    latest_rejected_drafts: rejected,
    scheduled_posts_count: Number(scheduledCount ?? 0),
    active_gates_count: gates.length,
    warnings: [],
  };
}
