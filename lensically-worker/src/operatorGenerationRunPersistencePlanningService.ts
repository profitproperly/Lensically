type JsonRecord = Record<string, unknown>;

export interface OperatorGenerationRunPersistencePlanningDependencies {
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  normalizeJson(value: unknown, fallback: unknown): string;
  parseJson(value: string): unknown;
  loadExistingRun(input: {
    sourceCardId: string;
    operationId: string;
  }): Promise<JsonRecord | null>;
}

export interface OperatorGenerationRunInsertValues {
  runId: string;
    accountId: unknown;
  threadsUserId: unknown;

  sourceCardId: string;
  sourceCardFamilyId: unknown;
  sourceCardVersionNumber: number;
  adaptationPlanJson: string;
  priorAdaptationContextJson: string;
  objective: string | null;
  promptSummary: string | null;
  metadataJson: string;
}

export type OperatorGenerationRunPersistencePlanningResult =
  | { kind: "response"; status: number; body: JsonRecord }
  | {
      kind: "continue";
      plan: {
        operationId: string | null;
        insertValues: OperatorGenerationRunInsertValues;
        body: JsonRecord;
      };
    };

export async function planOperatorGenerationRunPersistence(
  input: {
    payload: JsonRecord;
    sourceCardId: string;
    sourceCard: JsonRecord;
    adaptationPlan: JsonRecord;
    priorAdaptationContext: JsonRecord;
    performanceLearning: unknown;
    runId: string;
        accountId: unknown;
    threadsUserId: unknown;

    transformationContractVersion: string;
  },
  dependencies: OperatorGenerationRunPersistencePlanningDependencies,
): Promise<OperatorGenerationRunPersistencePlanningResult> {
  const operationId = dependencies.normalizeText(input.payload.operation_id, 240, true);
  if (operationId) {
    const existingRun = await dependencies.loadExistingRun({
      sourceCardId: input.sourceCardId,
      operationId,
    });
    if (existingRun?.id) {
      return {
        kind: "response",
        status: 200,
        body: {
          run_id: existingRun.id,
          source_card_id: input.sourceCardId,
          source_card_family_id: existingRun.source_card_family_id
            ?? input.sourceCard.family_id
            ?? null,
          source_card_version_number: Number(
            existingRun.source_card_version_number
              ?? input.sourceCard.version_number
              ?? 1,
          ),
          adaptation_plan: dependencies.parseJson(
            String(existingRun.adaptation_plan_json ?? "{}"),
          ) ?? input.adaptationPlan,
          prior_adaptation_context: dependencies.parseJson(
            String(existingRun.prior_adaptation_context_json ?? "{}"),
          ) ?? input.priorAdaptationContext,
          status: existingRun.status ?? "drafted",
          reused_existing: true,
          idempotency_reason: "generation_operation_already_completed",
        },
      };
    }
  }

  const sourceCardFamilyId = input.sourceCard.family_id ?? null;
  const sourceCardVersionNumber = Number(input.sourceCard.version_number ?? 1);
  return {
    kind: "continue",
    plan: {
      operationId,
      insertValues: {
        runId: input.runId,
        accountId: input.accountId,
        threadsUserId: input.threadsUserId,
        sourceCardId: input.sourceCardId,
        sourceCardFamilyId,
        sourceCardVersionNumber,
        adaptationPlanJson: dependencies.normalizeJson(input.adaptationPlan, {}),
        priorAdaptationContextJson: dependencies.normalizeJson(
          input.priorAdaptationContext,
          {},
        ),
        objective: dependencies.normalizeText(input.payload.objective, 1000, true),
        promptSummary: dependencies.normalizeText(
          input.payload.prompt_summary,
          4000,
          true,
        ),
        metadataJson: dependencies.normalizeJson({
          source: "operator_mode_mcp",
          operation_id: operationId,
          canonical_source_card_reuse: Boolean(input.sourceCard.family_id),
          transformation_contract_version: input.transformationContractVersion,
        }, {}),
      },
      body: {
        run_id: input.runId,
        source_card_id: input.sourceCardId,
        source_card_family_id: sourceCardFamilyId,
        source_card_version_number: sourceCardVersionNumber,
        adaptation_plan: input.adaptationPlan,
        prior_adaptation_context: input.priorAdaptationContext,
        performance_learning: input.performanceLearning,
        status: "drafted",
      },
    },
  };
}
