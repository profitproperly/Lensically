type JsonRecord = Record<string, unknown>;

export interface OperatorSourceCardLockDependencies {
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  loadSourceCard(sourceCardId: string): Promise<JsonRecord | null>;
  validateSourceCard(sourceCard: JsonRecord): unknown;
  nowIso(): string;
}

export type OperatorSourceCardLockResult =
  | { kind: "response"; status: number; body: JsonRecord }
  | {
      kind: "continue";
      plan: {
        sourceCardId: string;
        lockedAt: string;
        body: JsonRecord;
      };
    };

export async function planOperatorSourceCardLock(
  payload: JsonRecord,
  dependencies: OperatorSourceCardLockDependencies,
): Promise<OperatorSourceCardLockResult> {
  const sourceCardId = dependencies.normalizeText(payload.source_card_id, 120);
  const card = sourceCardId ? await dependencies.loadSourceCard(sourceCardId) : null;
  if (!card) {
    return {
      kind: "response",
      status: 404,
      body: { success: false, error: "source_card_not_found" },
    };
  }

  const validation = dependencies.validateSourceCard(card);
  const validationRecord = validation
    && typeof validation === "object"
    && !Array.isArray(validation)
    ? validation as JsonRecord
    : {};
  if (validationRecord.can_lock !== true) {
    return {
      kind: "response",
      status: 400,
      body: {
        success: false,
        source_card_id: sourceCardId,
        status: card.status,
        validation,
      },
    };
  }

  const lockedAt = dependencies.nowIso();
  return {
    kind: "continue",
    plan: {
      sourceCardId,
      lockedAt,
      body: {
        source_card_id: sourceCardId,
        status: "locked",
        locked_at: lockedAt,
        warnings: [],
      },
    },
  };
}
