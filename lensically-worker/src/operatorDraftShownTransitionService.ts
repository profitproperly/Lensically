type JsonRecord = Record<string, unknown>;

type OperatorDraftShownResult =
  | { kind: "response"; status?: number; body: JsonRecord }
  | {
      kind: "continue";
      plan: {
        draftId: string;
        updateStatus: "shown";
        inventory: JsonRecord;
        body: JsonRecord;
      };
    };

type OperatorDraftShownDependencies = {
  normalizeText: (value: unknown, maxLength: number) => string | null;
  loadDraft: (draftId: string) => Promise<JsonRecord | null>;
  isAllowedTransition: (currentStatus: unknown, targetStatus: "shown") => boolean;
};

const ALREADY_SHOWN_OR_ADVANCED = new Set([
  "shown",
  "approved",
  "scheduled",
  "published",
]);

export async function planOperatorDraftShownTransition(input: {
  brandKey: string;
  payload: JsonRecord;
}, dependencies: OperatorDraftShownDependencies): Promise<OperatorDraftShownResult> {
  const draftId = dependencies.normalizeText(input.payload.draft_id, 120);
  if (!draftId) {
    return {
      kind: "response",
      status: 400,
      body: { success: false, error: "draft_id is required" },
    };
  }

  const draft = await dependencies.loadDraft(draftId);
  if (!draft) {
    return {
      kind: "response",
      status: 404,
      body: { success: false, error: "draft_not_found" },
    };
  }

  const currentStatus = String(draft.status ?? "");
  if (ALREADY_SHOWN_OR_ADVANCED.has(currentStatus)) {
    return {
      kind: "response",
      body: {
        draft_id: draftId,
        status: draft.status,
        reused_existing: true,
        idempotency_reason: "draft_already_shown_or_advanced",
      },
    };
  }

  const showable = Boolean(draft.showable);
  if (!showable || !dependencies.isAllowedTransition(draft.status, "shown")) {
    return {
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "draft_not_showable",
        draft_id: draftId,
        status: draft.status,
        showable: draft.showable,
      },
    };
  }

  const strategy = draft.strategy
    && typeof draft.strategy === "object"
    && !Array.isArray(draft.strategy)
    ? draft.strategy as JsonRecord
    : null;
  const analysis = strategy?.analysis
    && typeof strategy.analysis === "object"
    && !Array.isArray(strategy.analysis)
    ? strategy.analysis as JsonRecord
    : null;

  return {
    kind: "continue",
    plan: {
      draftId,
      updateStatus: "shown",
      inventory: {
        brandKey: input.brandKey,
        sourceType: "draft",
        sourceId: draftId,
        text: draft.text,
        sourceCardId: draft.source_card_id,
        status: "shown",
        strategy,
        analysis,
      },
      body: { draft_id: draftId, status: "shown" },
    },
  };
}
