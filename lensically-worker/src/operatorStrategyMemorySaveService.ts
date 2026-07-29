type StrategyMemorySaveResponse = {
  kind: "response";
  status: number;
  body: Record<string, unknown>;
};

export type OperatorStrategyMemorySavePlan<TKind> = {
  kind: "plan";
  values: {
    memoryKind: TKind;
    title: string | null;
    body: string;
    metadataJson: string;
  };
};

export function planOperatorStrategyMemorySave<TKind>(
  payload: Record<string, unknown>,
  dependencies: {
    normalizeKind: (value: unknown) => TKind | null;
    allowedKinds: readonly TKind[];
    normalizeText: (value: unknown, maxLength: number, allowEmpty?: boolean) => string | null;
    normalizeJson: (value: unknown, fallback: unknown) => string;
  },
): StrategyMemorySaveResponse | OperatorStrategyMemorySavePlan<TKind> {
  const memoryKind = dependencies.normalizeKind(payload.kind);
  if (!memoryKind) {
    return {
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "invalid_strategy_memory_kind",
        allowed_kinds: Array.from(dependencies.allowedKinds),
      },
    };
  }

  const body = dependencies.normalizeText(payload.body, 20_000);
  if (!body) {
    return {
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "strategy_memory_body_required",
      },
    };
  }

  const metadata = payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
    ? payload.metadata as Record<string, unknown>
    : {};

  return {
    kind: "plan",
    values: {
      memoryKind,
      title: dependencies.normalizeText(payload.title, 500, true),
      body,
      metadataJson: dependencies.normalizeJson({
        ...metadata,
        source: payload.source ?? "mcp_operator",
      }, {}),
    },
  };
}

export function composeOperatorStrategyMemorySaveResponse(
  memory: { id?: unknown } | null | undefined,
): { memory_id: unknown | null } {
  return {
    memory_id: memory?.id ?? null,
  };
}
