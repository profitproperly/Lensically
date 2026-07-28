type JsonRecord = Record<string, unknown>;
type DraftDecisionStatus = "approved" | "rejected";

type OperatorDraftDecisionResult =
  | { kind: "response"; status?: number; body: JsonRecord }
  | {
      kind: "continue";
      plan: {
        draftId: string;
        nextStatus: DraftDecisionStatus;
        draftUpdate: {
          feedback: string | null;
          rejectionReason: string | null;
          scoreJson: string | null;
          strategyJson: string | null;
        };
        claimUpdate: {
          status: "approved" | "revision_required";
          dispositionReason: string | null;
        };
        memory: {
          accountId: string;
          threadsUserId: string;
          kind: "approval_feedback" | "rejection_feedback";
          title: string;
          body: string;
          metadataJson: string | null;
        };
        inventory: JsonRecord;
      };
    };

type OperatorDraftDecisionDependencies = {
  normalizeText: (value: unknown, maxLength: number, allowEmpty?: boolean) => string | null;
  normalizeJson: (value: unknown, fallback: unknown) => string | null;
  loadDraft: (draftId: string) => Promise<JsonRecord | null>;
  isAllowedTransition: (currentStatus: string, targetStatus: DraftDecisionStatus) => boolean;
};

export async function planOperatorDraftDecision(input: {
  toolName: "approve_draft" | "reject_draft";
  accountId: string;
  threadsUserId: string;
  brandKey: string;
  payload: JsonRecord;
}, dependencies: OperatorDraftDecisionDependencies): Promise<OperatorDraftDecisionResult> {
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

  const nextStatus: DraftDecisionStatus = input.toolName === "approve_draft"
    ? "approved"
    : "rejected";
  const currentStatus = String(draft.status ?? "");
  if (
    currentStatus === nextStatus
    || (input.toolName === "approve_draft" && ["scheduled", "published"].includes(currentStatus))
  ) {
    return {
      kind: "response",
      body: {
        draft_id: draftId,
        status: draft.status,
        reused_existing: true,
        idempotency_reason: "draft_decision_already_applied",
      },
    };
  }

  if (!dependencies.isAllowedTransition(currentStatus, nextStatus)) {
    return {
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "invalid_status_transition",
        from: draft.status,
        to: nextStatus,
      },
    };
  }

  const feedback = dependencies.normalizeText(
    input.payload.feedback_note,
    4_000,
    true,
  );
  const rejectionReason = input.toolName === "reject_draft"
    ? dependencies.normalizeText(input.payload.rejection_reason, 4_000, true)
      ?? feedback
      ?? "Rejected from operator mode."
    : null;
  const payloadStrategy = input.payload.strategy
    && typeof input.payload.strategy === "object"
    && !Array.isArray(input.payload.strategy)
    ? input.payload.strategy as JsonRecord
    : null;
  const draftStrategy = draft.strategy
    && typeof draft.strategy === "object"
    && !Array.isArray(draft.strategy)
    ? draft.strategy as JsonRecord
    : null;
  const memoryKind = input.toolName === "approve_draft"
    ? "approval_feedback"
    : "rejection_feedback";
  const memoryTitle = input.toolName === "approve_draft"
    ? "Draft approved from operator mode"
    : "Draft rejected from operator mode";

  return {
    kind: "continue",
    plan: {
      draftId,
      nextStatus,
      draftUpdate: {
        feedback,
        rejectionReason,
        scoreJson: dependencies.normalizeJson(
          input.payload.score ?? input.payload.scores,
          null,
        ),
        strategyJson: input.payload.strategy
          ? dependencies.normalizeJson(input.payload.strategy, {})
          : null,
      },
      claimUpdate: {
        status: input.toolName === "approve_draft" ? "approved" : "revision_required",
        dispositionReason: input.toolName === "reject_draft"
          ? rejectionReason
          : feedback,
      },
      memory: {
        accountId: input.accountId,
        threadsUserId: input.threadsUserId,
        kind: memoryKind,
        title: memoryTitle,
        body: `Draft id: ${draftId}\nStatus: ${nextStatus}\n${feedback || rejectionReason || "No feedback note provided."}`,
        metadataJson: dependencies.normalizeJson({
          source: "operator_mode_mcp",
          draft_id: draftId,
          source_card_id: draft.source_card_id,
        }, {}),
      },
      inventory: {
        brandKey: input.brandKey,
        sourceType: "draft",
        sourceId: draftId,
        text: draft.text,
        sourceCardId: draft.source_card_id,
        status: nextStatus,
        strategy: payloadStrategy ?? draftStrategy,
      },
    },
  };
}

export function composeOperatorDraftDecisionResponse(
  plan: { draftId: string; nextStatus: DraftDecisionStatus },
  memory: JsonRecord | null,
): JsonRecord {
  return {
    draft_id: plan.draftId,
    status: plan.nextStatus,
    memory_id: memory?.id ?? null,
  };
}
