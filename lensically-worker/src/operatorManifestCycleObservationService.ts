type JsonRecord = Record<string, unknown>;

export interface OperatorManifestCycleObservationDependencies {
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  normalizeMachineKey(value: unknown, fallback: string): string;
  resolveDefectsByScope(input: {
    cycleId: string;
    brandKey: string;
    stageKey: string;
    phase: string;
    slotKey: string | null;
    verification: JsonRecord;
  }): Promise<JsonRecord[]>;
  recordDefect(input: {
    cycleId: string;
    brandKey: string;
    defectKey: string;
    stageNumber: number;
    stageKey: string;
    phase: string;
    slotKey: string | null;
    operationId: string | null;
    errorCode: string;
    errorMessage: string;
    impactState: string;
    retryable: boolean;
    blocking: boolean;
    reconciliation: JsonRecord;
    metadata: JsonRecord;
  }): Promise<JsonRecord>;
}

export interface OperatorManifestCycleToolScope {
  stageNumber: number;
  stageKey: string;
  phase: string;
  slotKey: string | null;
}

function normalizeMachineKey(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

export function manifestCycleFailureIsDefect(errorCode: unknown): boolean {
  const code = normalizeMachineKey(errorCode, "");
  if (!code) return false;
  const expected = [
    "candidate_gate_suite_failed", "complete_cycle_strategy_required", "cycle_id_and_snapshot_id_required",
    "autonomous_cycle_id_required", "autonomous_cycle_not_found", "autonomous_cycle_strategy_required",
    "autonomous_cycle_plan_item_required", "cycle_strategy_identity_mismatch", "cycle_plan_item_identity_mismatch",
    "slot_already_occupied", "exact_duplicate", "duplicate", "hard_ban", "source_fidelity",
    "operation_already_in_progress", "prior_operation_in_progress", "continuation_required",
    "retired_monolithic_autonomous_commit", "manifest_only", "brand_key_required",
  ];
  return !expected.some((surface) => code.includes(surface));
}

export function manifestCycleToolScope(
  toolName: string,
  payload: JsonRecord,
  result: JsonRecord,
  dependencies: Pick<OperatorManifestCycleObservationDependencies, "normalizeText" | "normalizeMachineKey">,
): OperatorManifestCycleToolScope | null {
  const post = payload.post && typeof payload.post === "object" && !Array.isArray(payload.post)
    ? payload.post as JsonRecord
    : {};
  const postDate = dependencies.normalizeText(post.date, 20, true);
  const postTime = dependencies.normalizeText(post.time, 20, true);
  const slotKey = dependencies.normalizeText(result.slot_key, 40, true)
    ?? dependencies.normalizeText(payload.slot_key, 40, true)
    ?? (postDate && postTime ? `${postDate}T${postTime}` : null);
  if (toolName === "get_manifest_cycle_analysis_page") {
    return { stageNumber: 2, stageKey: "evidence_consumption", phase: "analysis_page", slotKey: null };
  }
  if (toolName === "commit_manifest_cycle_strategy") {
    return { stageNumber: 3, stageKey: "strategy_and_lineup", phase: "strategy_commit", slotKey: null };
  }
  if (toolName === "persist_manifest_autonomous_post") {
    return { stageNumber: 5, stageKey: "persistence_and_scheduling", phase: "single_slot_persist", slotKey };
  }
  if (toolName === "get_hourly_coverage") {
    return { stageNumber: 6, stageKey: "coverage_and_completion", phase: "coverage_reconciliation", slotKey };
  }
  if (toolName === "prepare_manifest_autonomous_cycle") {
    const phase = dependencies.normalizeMachineKey(
      result.stage ?? result.phase ?? result.checkpoint_phase,
      "preparation",
    );
    const evaluatorPhase = ["evaluator", "intelligence", "measurement", "content_focus", "learning"]
      .some((surface) => phase.includes(surface));
    return {
      stageNumber: evaluatorPhase ? 7 : 1,
      stageKey: evaluatorPhase ? "post_publication_evaluator" : "preparation_and_reconciliation",
      phase,
      slotKey: null,
    };
  }
  return null;
}

export async function observeOperatorManifestCycleToolResult(
  input: {
    brandKey: string;
    toolName: string;
    payload: JsonRecord;
    result: JsonRecord;
  },
  dependencies: OperatorManifestCycleObservationDependencies,
): Promise<JsonRecord> {
  const { brandKey, toolName, payload, result } = input;
  if (brandKey !== "manifest_mental") return result;
  const cycleId = dependencies.normalizeText(payload.cycle_id ?? result.cycle_id, 160, true);
  const scope = manifestCycleToolScope(toolName, payload, result, dependencies);
  if (!cycleId || !scope) return result;

  const succeeded = result.success !== false && result.ok !== false;
  if (succeeded) {
    const resolved = await dependencies.resolveDefectsByScope({
      cycleId,
      brandKey,
      stageKey: scope.stageKey,
      phase: scope.phase,
      slotKey: scope.slotKey,
      verification: {
        resolution_mode: "successful_scoped_retry_or_reconciliation",
        tool_name: toolName,
        operation_id: dependencies.normalizeText(payload.operation_id, 240, true),
        observed_result: {
          success: result.success ?? result.ok ?? true,
          scheduled_post_id: result.scheduled_post_id ?? null,
          remaining_missing_count: result.remaining_missing_count ?? null,
        },
      },
    });
    return resolved.length ? { ...result, auto_resolved_defect_count: resolved.length } : result;
  }

  const errorCode = dependencies.normalizeText(result.error ?? result.code, 300, true)
    ?? "manifest_cycle_tool_failed";
  if (!manifestCycleFailureIsDefect(errorCode)) return result;
  const operationId = dependencies.normalizeText(payload.operation_id, 240, true);
  const impactState = result.scheduled_post_id
    ? "partially_succeeded"
    : result.side_effect_state === "unknown"
      ? "possibly_succeeded"
      : "definitely_failed";
  const reconciliation = result.reconciliation
    && typeof result.reconciliation === "object"
    && !Array.isArray(result.reconciliation)
    ? result.reconciliation as JsonRecord
    : {};
  const defect = await dependencies.recordDefect({
    cycleId,
    brandKey,
    defectKey: `${toolName}:${scope.phase}:${scope.slotKey ?? "cycle"}:${dependencies.normalizeMachineKey(errorCode, "failure")}`,
    stageNumber: scope.stageNumber,
    stageKey: scope.stageKey,
    phase: scope.phase,
    slotKey: scope.slotKey,
    operationId,
    errorCode,
    errorMessage: dependencies.normalizeText(result.message ?? result.error ?? result.code, 4000, true) ?? errorCode,
    impactState,
    retryable: result.retryable === true,
    blocking: true,
    reconciliation,
    metadata: {
      tool_name: toolName,
      result_keys: Object.keys(result).sort(),
      side_effect_state: result.side_effect_state ?? null,
      next_action: result.next_action ?? result.required_next_action ?? null,
    },
  });
  return {
    ...result,
    defect_receipt_id: defect.id ?? null,
    defect_key: defect.defect_key ?? null,
  };
}
