type JsonRecord = Record<string, unknown>;

type OperatorGenerationDraftAdmissionResult =
  | { kind: "response"; status?: number; body: JsonRecord }
  | {
      kind: "continue";
      context: {
        runId: string;
        sourceCardId: string;
        text: string;
        existingDraftCount: number;
      };
    };

type OperatorGenerationDraftAdmissionDependencies = {
  normalizeText: (value: unknown, maxLength: number) => string | null;
  parseJson: (value: string) => unknown;
  loadExistingDraft: (input: {
    runId: string;
    sourceCardId: string;
    text: string;
  }) => Promise<JsonRecord | null>;
  countExistingDrafts: (input: {
    runId: string;
    sourceCardId: string;
  }) => Promise<number>;
};

export async function admitOperatorGenerationDraft(
  payload: JsonRecord,
  dependencies: OperatorGenerationDraftAdmissionDependencies,
): Promise<OperatorGenerationDraftAdmissionResult> {
  const runId = dependencies.normalizeText(payload.run_id, 120);
  const sourceCardId = dependencies.normalizeText(payload.source_card_id, 120);
  const text = dependencies.normalizeText(payload.text, 20_000);
  if (!runId || !sourceCardId || !text) {
    return {
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "run_id, source_card_id, and text are required",
      },
    };
  }

  const existingDraft = await dependencies.loadExistingDraft({
    runId,
    sourceCardId,
    text,
  });
  if (existingDraft?.id) {
    const parsedGateSummary = dependencies.parseJson(
      String(existingDraft.gate_summary_json ?? "{}"),
    );
    const gateSummary = parsedGateSummary
      && typeof parsedGateSummary === "object"
      && !Array.isArray(parsedGateSummary)
      ? parsedGateSummary as JsonRecord
      : {};
    return {
      kind: "response",
      body: {
        draft_id: existingDraft.id,
        status: existingDraft.status,
        showable: Number(existingDraft.showable ?? 0) === 1,
        gate_results: Array.isArray(gateSummary.gate_results)
          ? gateSummary.gate_results
          : [],
        blocking_failures: Array.isArray(gateSummary.blocking_failures)
          ? gateSummary.blocking_failures
          : [],
        reused_existing: true,
        idempotency_reason: "identical_run_draft_already_exists",
      },
    };
  }

  const existingDraftCount = await dependencies.countExistingDrafts({
    runId,
    sourceCardId,
  });
  if (existingDraftCount >= 2) {
    return {
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "lensically_saved_workflow_required",
        existing_draft_count: existingDraftCount,
        required_workflow: "Lensically account workflows are source-card controlled. A single source-card run may create one candidate plus one repair candidate unless an account has a backend-supported override. Start the next source-card loop instead of adding more drafts to the same run.",
      },
    };
  }

  return {
    kind: "continue",
    context: {
      runId,
      sourceCardId,
      text,
      existingDraftCount,
    },
  };
}
