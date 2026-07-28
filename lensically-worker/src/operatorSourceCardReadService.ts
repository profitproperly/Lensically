type JsonRecord = Record<string, unknown>;

export interface OperatorSourceCardReadDependencies {
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  loadSourceCard(sourceCardId: string): Promise<JsonRecord | null>;
  loadHistory(sourceCard: JsonRecord): Promise<unknown>;
}

export async function readOperatorSourceCard(
  input: {
    brandKey: string;
    payload: JsonRecord;
    ownerPresentation: JsonRecord;
  },
  dependencies: OperatorSourceCardReadDependencies,
): Promise<{ status: number; body: JsonRecord }> {
  const sourceCardId = dependencies.normalizeText(input.payload.source_card_id, 120);
  const sourceCard = sourceCardId
    ? await dependencies.loadSourceCard(sourceCardId)
    : null;
  if (!sourceCard) {
    return {
      status: 404,
      body: { success: false, error: "source_card_not_found" },
    };
  }

  const canonicalContext = input.payload.include_history === false
    ? null
    : await dependencies.loadHistory(sourceCard);
  return {
    status: 200,
    body: {
      source_card: sourceCard,
      canonical_context: canonicalContext,
      owner_presentation: {
        ...input.ownerPresentation,
        account_scope: input.brandKey,
      },
    },
  };
}
