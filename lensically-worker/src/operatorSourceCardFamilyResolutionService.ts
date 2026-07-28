type JsonRecord = Record<string, unknown>;

export interface OperatorSourceCardFamilyResolutionInput {
  brandKey: string;
  selection: JsonRecord;
  sourceSelectionId: string;
  sequenceLabel: string;
  createNewVersion: boolean;
  versionReason: string | null;
  newFamilyId: string;
  ownerPresentation: JsonRecord;
}

export interface OperatorSourceCardFamilyCreationInput {
  familyId: string;
  sourceIdentityKey: string;
  sourceType: string;
  internalSourceId: string;
  threadsPostId: unknown;
  canonicalSourceUrl: unknown;
}

export interface OperatorSourceCardFamilyResolutionDependencies {
  loadFamily(sourceIdentityKey: string): Promise<JsonRecord | null>;
  createFamily(input: OperatorSourceCardFamilyCreationInput): Promise<void>;
  loadSourceCard(sourceCardId: string): Promise<JsonRecord | null>;
  linkSelectionToCurrentCard(input: {
    sourceCardId: string;
    sourceSelectionId: string;
    workflowSequence: number | null;
  }): Promise<void>;
  parseWorkflowSequence(sequenceLabel: string): number | null;
  validateSourceCard(sourceCard: JsonRecord): unknown;
}

export type OperatorSourceCardFamilyResolutionResult =
  | { kind: "response"; status: number; body: JsonRecord }
  | {
    kind: "continue";
    context: {
      familyId: string;
      versionNumber: number;
      supersedesSourceCardId: string | null;
    };
  };

export async function resolveOperatorSourceCardFamily(
  input: OperatorSourceCardFamilyResolutionInput,
  dependencies: OperatorSourceCardFamilyResolutionDependencies,
): Promise<OperatorSourceCardFamilyResolutionResult> {
  const sourceIdentityKey = String(input.selection.source_identity_key ?? "");
  let family = await dependencies.loadFamily(sourceIdentityKey);
  let familyId: string;

  if (!family) {
    familyId = input.newFamilyId;
    await dependencies.createFamily({
      familyId,
      sourceIdentityKey,
      sourceType: String(input.selection.source_type ?? ""),
      internalSourceId: String(input.selection.internal_source_id ?? ""),
      threadsPostId: input.selection.threads_post_id ?? null,
      canonicalSourceUrl: input.selection.canonical_source_url ?? null,
    });
    family = { id: familyId, current_source_card_id: null };
  } else {
    familyId = String(family.id);
  }

  const currentCardId = family.current_source_card_id
    ? String(family.current_source_card_id)
    : null;
  const currentCard = currentCardId
    ? await dependencies.loadSourceCard(currentCardId)
    : null;

  if (currentCard && !input.createNewVersion) {
    await dependencies.linkSelectionToCurrentCard({
      sourceCardId: String(currentCard.id),
      sourceSelectionId: input.sourceSelectionId,
      workflowSequence: dependencies.parseWorkflowSequence(input.sequenceLabel),
    });
    return {
      kind: "response",
      status: 200,
      body: {
        source_card_id: currentCard.id,
        source_selection_id: input.sourceSelectionId,
        family_id: familyId,
        version_number: currentCard.version_number ?? 1,
        status: currentCard.status,
        reused_existing: true,
        reason: "canonical_source_card_reused",
        validation: dependencies.validateSourceCard(currentCard),
        owner_presentation: {
          ...input.ownerPresentation,
          account_scope: input.brandKey,
        },
      },
    };
  }

  if (currentCard && input.createNewVersion) {
    if (!input.versionReason) {
      return {
        kind: "response",
        status: 400,
        body: { success: false, error: "version_reason_required" },
      };
    }
    return {
      kind: "continue",
      context: {
        familyId,
        versionNumber: Number(currentCard.version_number ?? 1) + 1,
        supersedesSourceCardId: String(currentCard.id),
      },
    };
  }

  return {
    kind: "continue",
    context: {
      familyId,
      versionNumber: 1,
      supersedesSourceCardId: null,
    },
  };
}
