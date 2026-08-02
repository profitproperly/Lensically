type JsonRecord = Record<string, unknown>;

export interface OperatorGenerationRunAdmissionDependencies {
  getWorkflowConflict(payload: JsonRecord): string | null;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  normalizeAdaptationPlan(value: unknown): JsonRecord;
  loadSourceCard(sourceCardId: string): Promise<JsonRecord | null>;
  loadCanonicalContext(sourceCard: JsonRecord): Promise<JsonRecord>;
  loadAccountRejectionContext(): Promise<unknown>;
  loadPerformanceLearning(): Promise<unknown>;
}

export type OperatorGenerationRunAdmissionResult =
  | { kind: "response"; status: number; body: JsonRecord }
  | {
      kind: "continue";
      context: {
        sourceCardId: string;
        sourceCard: JsonRecord;
        adaptationPlan: JsonRecord;
        canonicalContext: JsonRecord;
        accountRejectionContext: unknown;
        performanceLearning: unknown;
        priorAdaptationContext: JsonRecord;
      };
    };

export async function admitOperatorGenerationRun(
  input: {
    brandKey: string;
    payload: JsonRecord;
  },
  dependencies: OperatorGenerationRunAdmissionDependencies,
): Promise<OperatorGenerationRunAdmissionResult> {
  const workflowConflict = dependencies.getWorkflowConflict(input.payload);
  if (workflowConflict) {
    return {
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "lensically_saved_workflow_required",
        reason: workflowConflict,
        required_workflow: "Create generation runs according to the selected account's saved workflow. Do not create batch or multi-post generation runs unless a backend-supported override exists for that account.",
      },
    };
  }

  const sourceCardId = dependencies.normalizeText(input.payload.source_card_id, 120);
  const sourceCard = sourceCardId
    ? await dependencies.loadSourceCard(sourceCardId)
    : null;
  if (!sourceCardId || !sourceCard || sourceCard.status !== "locked") {
    return {
      kind: "response",
      status: 400,
      body: { success: false, error: "locked_source_card_required" },
    };
  }

  const adaptationPlan = dependencies.normalizeAdaptationPlan(input.payload.adaptation_plan);
  if (
    input.brandKey === "manifest_mental"
    && !dependencies.normalizeText(adaptationPlan.adaptation_goal, 1500, true)
  ) {
    return {
      kind: "response",
      status: 400,
      body: { success: false, error: "manifest_adaptation_goal_required" },
    };
  }

  const [canonicalContext, accountRejectionContext, performanceLearning] = await Promise.all([
    dependencies.loadCanonicalContext(sourceCard),
    dependencies.loadAccountRejectionContext(),
    dependencies.loadPerformanceLearning(),
  ]);
    const adaptationHistory = Array.isArray(canonicalContext.adaptation_history)
    ? canonicalContext.adaptation_history.slice(-24) as JsonRecord[]
    : [];
  const priorRuns = input.brandKey === "manifest_mental"
    ? adaptationHistory.map((run) => ({
      run_id: run.run_id ?? null,
      status: run.status ?? null,
      created_at: run.created_at ?? null,
      drafts: Array.isArray(run.drafts)
        ? (run.drafts as JsonRecord[]).map((draft) => ({
          draft_id: draft.draft_id ?? null,
          status: draft.status ?? null,
          scheduled_post_id: draft.scheduled_post_id ?? null,
          published_post_id: draft.published_post_id ?? null,
          published_execution: draft.published_execution ?? null,
          metric_history: draft.metric_history ?? [],
        }))
        : [],
    }))
    : adaptationHistory;
  const priorAdaptationContext: JsonRecord = {
    family: canonicalContext.family ?? null,
    versions: canonicalContext.versions ?? [],
    source_evidence: input.brandKey === "manifest_mental" ? {
      title: sourceCard.title ?? null,
      primary_source: sourceCard.primary_source ?? null,
      metrics_snapshot: sourceCard.metrics_snapshot ?? null,
    } : null,
    owner_guidance: sourceCard.owner_guidance ?? null,
    owner_edit_notes: sourceCard.owner_edit_notes ?? [],
    generation_direction: sourceCard.generation_direction ?? null,
    prior_runs: priorRuns,
    account_rejection_context: accountRejectionContext,
    performance_learning: performanceLearning,
  };

  return {
    kind: "continue",
    context: {
      sourceCardId,
      sourceCard,
      adaptationPlan,
      canonicalContext,
      accountRejectionContext,
      performanceLearning,
      priorAdaptationContext,
    },
  };
}
