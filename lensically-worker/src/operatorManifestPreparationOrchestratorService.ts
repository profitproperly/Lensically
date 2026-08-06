import {
  handleOperatorManifestPrepareCheckpoint,
  type OperatorManifestPrepareCheckpointDependencies,
  type OperatorManifestPrepareCheckpointResult,
} from "./operatorManifestPrepareCheckpointService";

type JsonRecord = Record<string, unknown>;

export type OperatorManifestPreparationOrchestration = {
  version: "manifest-preparation-orchestrator-v2";
  advances: number;
  elapsed_ms: number;
  phase_path: string[];
  phase_durations_ms: number[];
  safety_stop: boolean;
  continuation_count: number;
  stop_reason: "completed" | "non_routine_response" | "transport_sensitive_boundary" | "elapsed_budget" | "advance_limit";
};

export type OperatorManifestPreparationOrchestratorResult =
  | {
      handled: true;
      response: JsonRecord & {
        server_orchestration: OperatorManifestPreparationOrchestration;
      };
    }
  | {
      handled: false;
      context: Extract<OperatorManifestPrepareCheckpointResult, { handled: false }>["context"] & {
        server_orchestration: OperatorManifestPreparationOrchestration;
      };
    };

export interface OperatorManifestPreparationOrchestratorOptions {
  maxAdvances?: number;
  maxElapsedMs?: number;
  nowMs?: () => number;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

const TRANSPORT_SENSITIVE_PREPARATION_PHASES = new Set([
  "live_collection",
  "live_evaluator",
  "delta_ready_snapshot_reused",
]);

function orchestrationReceipt(input: {
  advances: number;
  startedAtMs: number;
  nowMs: () => number;
  phasePath: string[];
  phaseDurationsMs: number[];
  safetyStop: boolean;
  continuationCount: number;
  stopReason: OperatorManifestPreparationOrchestration["stop_reason"];
}): OperatorManifestPreparationOrchestration {
  return {
    version: "manifest-preparation-orchestrator-v2",
    advances: input.advances,
    elapsed_ms: Math.max(0, input.nowMs() - input.startedAtMs),
    phase_path: input.phasePath,
    phase_durations_ms: input.phaseDurationsMs,
    safety_stop: input.safetyStop,
    continuation_count: input.continuationCount,
    stop_reason: input.stopReason,
  };
}

/**
 * Advances the existing durable checkpoint state machine inside one Worker call.
 * The checkpoint service remains the sole phase implementation and recovery authority.
 * This wrapper only removes routine client re-entry and stops at a bounded safety edge.
 */
export async function orchestrateOperatorManifestPrepareCheckpoint(
  input: {
    brandKey: string;
    accountId: string;
    threadsUserId: string;
    payload: JsonRecord;
  },
  dependencies: OperatorManifestPrepareCheckpointDependencies,
  options: OperatorManifestPreparationOrchestratorOptions = {},
): Promise<OperatorManifestPreparationOrchestratorResult> {
    const maxAdvances = Math.min(16, Math.max(1, Math.trunc(options.maxAdvances ?? 8)));
  const maxElapsedMs = Math.min(15_000, Math.max(1_000, Math.trunc(options.maxElapsedMs ?? 12_000)));
  const nowMs = options.nowMs ?? (() => Date.now());
  const startedAtMs = nowMs();
  const phasePath: string[] = [];
  const phaseDurationsMs: number[] = [];
  let advances = 0;
  let continuationCount = 0;

    while (advances < maxAdvances) {
    const phaseStartedAtMs = nowMs();
    const result = await handleOperatorManifestPrepareCheckpoint(input, dependencies);
    phaseDurationsMs.push(Math.max(0, nowMs() - phaseStartedAtMs));
    advances += 1;

    if (!result.handled) {
      return {
        handled: false,
        context: {
          ...result.context,
          server_orchestration: orchestrationReceipt({
            advances,
            startedAtMs,
            nowMs,
            phasePath,
            phaseDurationsMs,
            safetyStop: false,
            continuationCount,
            stopReason: "completed",
          }),
        },
      };
    }

    const response = record(result.response);
    const completed = String(response.stage_completed ?? response.stage ?? "unknown");
    const nextStage = String(response.next_stage ?? "");
    phasePath.push(nextStage ? `${completed}->${nextStage}` : completed);

    const routineContinuation = response.success === true
      && response.continuation_required === true
      && Boolean(response.operation_id)
      && Boolean(nextStage);

    if (!routineContinuation) {
      return {
        handled: true,
        response: {
          ...response,
          server_orchestration: orchestrationReceipt({
            advances,
            startedAtMs,
            nowMs,
            phasePath,
            phaseDurationsMs,
            safetyStop: false,
            continuationCount,
            stopReason: "non_routine_response",
          }),
        },
      };
    }

    continuationCount += 1;
    const elapsedMs = nowMs() - startedAtMs;
    const stopReason = TRANSPORT_SENSITIVE_PREPARATION_PHASES.has(completed)
      || TRANSPORT_SENSITIVE_PREPARATION_PHASES.has(nextStage)
      ? "transport_sensitive_boundary"
      : elapsedMs >= maxElapsedMs
        ? "elapsed_budget"
        : advances >= maxAdvances
          ? "advance_limit"
          : null;
    if (stopReason) {
      return {
        handled: true,
        response: {
          ...response,
          continuation_required: true,
          server_safety_continuation: true,
          next_action: "Call prepare_manifest_autonomous_cycle once more with the identical operation_id, timezone, and horizon_hours. The completed phase is durably checkpointed and the response returned before another transport-sensitive or over-budget phase could begin.",
          server_orchestration: orchestrationReceipt({
            advances,
            startedAtMs,
            nowMs,
            phasePath,
            phaseDurationsMs,
            safetyStop: true,
            continuationCount,
            stopReason,
          }),
        },
      };
    }
  }

  throw new Error("manifest_preparation_orchestrator_unreachable");
}
