type JsonRecord = Record<string, unknown>;

type OperatorGateRun = {
  showable: boolean;
  gate_results: JsonRecord[];
  blocking_failures: JsonRecord[];
  warnings: string[];
};

type OperatorGenerationDraftPersistenceDependencies = {
  normalizeText: (value: unknown, maxLength: number, allowEmpty?: boolean) => string | null;
  normalizeMachineKey: (value: unknown, fallback: string) => string;
  normalizeJson: (value: unknown, fallback: unknown) => string | null;
  runGates: (input: JsonRecord) => Promise<OperatorGateRun>;
};

export async function planOperatorGenerationDraftPersistence(input: {
  toolName: string;
  payload: JsonRecord;
  draftId: string;
  runId: string;
  accountId: string;
  threadsUserId: string;
  sourceCardId: string;
  text: string;
}, dependencies: OperatorGenerationDraftPersistenceDependencies) {
  const status = input.toolName === "save_self_rejected_draft"
    ? "self_rejected"
    : "candidate";
  const requestedDraftIndex = Number(input.payload.draft_index);
  const draftIndex = Number.isFinite(requestedDraftIndex)
    ? Math.max(0, Math.trunc(requestedDraftIndex))
    : 1;
  const strategy = input.payload.strategy
    && typeof input.payload.strategy === "object"
    && !Array.isArray(input.payload.strategy)
    ? input.payload.strategy as JsonRecord
    : {};
  const analysis = input.payload.draft_analysis
    && typeof input.payload.draft_analysis === "object"
    && !Array.isArray(input.payload.draft_analysis)
    ? input.payload.draft_analysis as JsonRecord
    : {};

  let gateRun: OperatorGateRun = {
    showable: false,
    gate_results: [],
    blocking_failures: [],
    warnings: [],
  };
  if (status === "candidate") {
    gateRun = await dependencies.runGates({
      sourceCardId: input.sourceCardId,
      draftId: input.draftId,
      draftText: input.text,
      stageScope: "gate_evaluation",
      laneKey: dependencies.normalizeMachineKey(
        analysis.lane_key ?? strategy.pillar,
        "",
      ) || null,
      draftAnalysis: analysis,
      modelGateResults: Array.isArray(input.payload.model_gate_results)
        ? input.payload.model_gate_results
        : null,
    });
  }

  const insertValues = {
    draftId: input.draftId,
    runId: input.runId,
    accountId: input.accountId,
    threadsUserId: input.threadsUserId,
    sourceCardId: input.sourceCardId,
    draftIndex,
    text: input.text,
    status,
    rejectionReason: dependencies.normalizeText(
      input.payload.rejection_reason,
      2_000,
      true,
    ),
    scoreJson: dependencies.normalizeJson(
      input.payload.score ?? input.payload.scores,
      null,
    ),
    strategyJson: dependencies.normalizeJson({ ...strategy, analysis }, {}),
    gateSummaryJson: dependencies.normalizeJson({
      gate_results: gateRun.gate_results,
      blocking_failures: gateRun.blocking_failures,
    }, {}),
    showable: gateRun.showable ? 1 : 0,
    metadataJson: dependencies.normalizeJson({ source: "operator_mode_mcp" }, {}),
  };

  return {
    insertValues,
    body: {
      draft_id: input.draftId,
      status,
      showable: gateRun.showable,
      gate_results: gateRun.gate_results,
      blocking_failures: gateRun.blocking_failures,
      repair_guidance: gateRun.blocking_failures
        .map((failure) => failure.repair_guidance)
        .filter(Boolean),
    },
  };
}
