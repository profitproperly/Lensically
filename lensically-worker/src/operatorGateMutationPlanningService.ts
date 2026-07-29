type GateMutationToolName = "create_or_update_gate" | "promote_memory_to_gate";

type StrategyMemoryRecord = {
  id: number;
  title: string | null;
  body: string;
};

type ExistingGateRecord = {
  id: string;
};

type GateMutationResponse = {
  kind: "response";
  status: number;
  body: Record<string, unknown>;
};

export type OperatorGateMutationPlan<TBrand, TStage> = {
  kind: "plan";
  mode: "insert" | "update";
  gateId: string;
  identity: {
    brandScope: TBrand | null;
    gateKey: string;
    laneScope: string | null;
    contentTypeScope: string | null;
  };
  values: {
    displayName: string;
    description: string;
    stageScope: TStage;
    gateType: string;
    severity: string;
    evaluator: string;
    activeFlag: number;
    orderIndex: number;
    passExamplesJson: string;
    failExamplesJson: string;
    sourceMemoryIdsJson: string;
    createdFrom: string;
  };
  body: Record<string, unknown>;
};

export async function planOperatorGateMutation<TBrand, TStage>(
  input: {
    toolName: GateMutationToolName;
    payload: Record<string, unknown>;
    accountBrandKey: TBrand;
  },
  dependencies: {
    normalizeText: (value: unknown, maxLength: number, allowEmpty?: boolean) => string | null;
    normalizeMachineKey: (value: unknown, fallback?: string) => string;
        normalizeStage: (value: unknown, fallback: "gate_evaluation") => TStage;
    normalizeJson: (value: unknown, fallback: unknown) => string;
    loadMemory: (memoryId: number) => Promise<StrategyMemoryRecord | null>;
    loadExistingGate: (identity: {
      brandScope: TBrand | null;
      gateKey: string;
      laneScope: string | null;
      contentTypeScope: string | null;
    }) => Promise<ExistingGateRecord | null>;
    createGateId: () => string;
  },
): Promise<GateMutationResponse | OperatorGateMutationPlan<TBrand, TStage>> {
  const { payload, toolName, accountBrandKey } = input;
  let description = dependencies.normalizeText(payload.description, 4_000, true);
  let displayName = dependencies.normalizeText(payload.display_name, 240, true);
  let sourceMemoryIds: unknown = payload.source_memory_ids ?? [];
  let createdFrom = dependencies.normalizeMachineKey(payload.created_from, "owner_feedback");

  if (toolName === "promote_memory_to_gate") {
    const memoryId = Number(payload.memory_id);
    const memory = Number.isFinite(memoryId)
      ? await dependencies.loadMemory(memoryId)
      : null;
    if (!memory) {
      return {
        kind: "response",
        status: 404,
        body: { success: false, error: "memory_not_found" },
      };
    }
    displayName = displayName
      ?? memory.title
      ?? dependencies.normalizeText(payload.gate_key, 120)
      ?? "Promoted memory gate";
    description = description ?? memory.body;
    sourceMemoryIds = [memory.id];
    createdFrom = "strategy_memory";
  }

  const gateKey = dependencies.normalizeMachineKey(payload.gate_key);
  if (!gateKey || !description) {
    return {
      kind: "response",
      status: 400,
      body: { success: false, error: "gate_key and description are required" },
    };
  }

  const brandScope = payload.brand_key === null || payload.brand_key === "global"
    ? null
    : accountBrandKey;
  const laneScope = dependencies.normalizeMachineKey(payload.lane_scope, "") || null;
  const contentTypeScope = dependencies.normalizeMachineKey(
    payload.content_type_scope ?? payload.content_type,
    "",
  ) || null;
  const identity = {
    brandScope,
    gateKey,
    laneScope,
    contentTypeScope,
  };
  const existing = await dependencies.loadExistingGate(identity);
  const gateId = existing?.id ?? dependencies.createGateId();
  const values = {
    displayName: displayName ?? gateKey,
    description,
    stageScope: dependencies.normalizeStage(payload.stage_scope, "gate_evaluation"),
    gateType: dependencies.normalizeMachineKey(payload.gate_type, "hard"),
    severity: dependencies.normalizeMachineKey(payload.severity, "block"),
    evaluator: dependencies.normalizeMachineKey(payload.evaluator, "hybrid"),
    activeFlag: payload.active === false ? 0 : 1,
    orderIndex: Number(payload.order_index ?? 100),
    passExamplesJson: dependencies.normalizeJson(payload.pass_examples, []),
    failExamplesJson: dependencies.normalizeJson(payload.fail_examples, []),
    sourceMemoryIdsJson: dependencies.normalizeJson(sourceMemoryIds, []),
    createdFrom,
  };

  return {
    kind: "plan",
    mode: existing?.id ? "update" : "insert",
    gateId,
    identity,
    values,
    body: {
      gate_id: gateId,
      gate_key: gateKey,
      active: payload.active !== false,
            created_from_memory_id: toolName === "promote_memory_to_gate"
        ? payload.memory_id ?? null
        : null,
    },
  };
}

export type OperatorGateEvaluationResult = {
  showable: boolean;
  gate_results: Record<string, unknown>[];
  blocking_failures: Record<string, unknown>[];
  warnings: string[];
};

export async function evaluateOperatorGates<TStage extends string>(
  input: { payload: Record<string, unknown> },
  dependencies: {
    normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
    normalizeStage(value: unknown, fallback: "gate_evaluation"): TStage;
    normalizeMachineKey(value: unknown, fallback?: string): string;
    runGates(gateInput: {
      sourceCardId: string | null;
      draftText: string | null;
      stageScope: TStage;
      laneKey: string | null;
      contentType: string | null;
      draftAnalysis: Record<string, unknown> | null;
      modelGateResults: Array<Record<string, unknown>> | null;
    }): Promise<OperatorGateEvaluationResult>;
  },
): Promise<OperatorGateEvaluationResult> {
  const payload = input.payload;
  const draftAnalysis = payload.draft_analysis
    && typeof payload.draft_analysis === "object"
    && !Array.isArray(payload.draft_analysis)
    ? payload.draft_analysis as Record<string, unknown>
    : null;

  return dependencies.runGates({
    sourceCardId: dependencies.normalizeText(payload.source_card_id, 120, true),
    draftText: dependencies.normalizeText(payload.draft_text, 20000, true),
    stageScope: dependencies.normalizeStage(payload.stage, "gate_evaluation"),
    laneKey: dependencies.normalizeMachineKey(
      payload.lane_key ?? draftAnalysis?.lane_key,
      "",
    ) || null,
    contentType: dependencies.normalizeMachineKey(payload.content_type, "") || null,
    draftAnalysis,
    modelGateResults: Array.isArray(payload.model_gate_results)
      ? payload.model_gate_results as Array<Record<string, unknown>>
      : null,
  });
}

