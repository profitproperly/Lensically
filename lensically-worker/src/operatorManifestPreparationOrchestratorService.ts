import {
  handleOperatorManifestPrepareCheckpoint,
  type OperatorManifestPrepareCheckpointDependencies,
  type OperatorManifestPrepareCheckpointResult,
} from "./operatorManifestPrepareCheckpointService";

type JsonRecord = Record<string, unknown>;

export type OperatorManifestPreparationOrchestration = {
  version: "manifest-preparation-orchestrator-v1";
  advances: number;
  elapsed_ms: number;
  phase_path: string[];
  safety_stop: boolean;
  continuation_count: number;
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

function orchestrationReceipt(input: {
  advances: number;
  startedAtMs: number;
  nowMs: () => number;
  phasePath: string[];
  safetyStop: boolean;
  continuationCount: number;
}): OperatorManifestPreparationOrchestration {
  return {
    version: "manifest-preparation-orchestrator-v1",
    advances: input.advances,
    elapsed_ms: Math.max(0, input.nowMs() - input.startedAtMs),
    phase_path: input.phasePath,
    safety_stop: input.safetyStop,
    continuation_count: input.continuationCount,
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
  const maxAdvances = Math.min(32, Math.max(1, Math.trunc(options.maxAdvances ?? 24)));
  const maxElapsedMs = Math.min(25_000, Math.max(1_000, Math.trunc(options.maxElapsedMs ?? 21_000)));
  const nowMs = options.nowMs ?? (() => Date.now());
  const startedAtMs = nowMs();
  const phasePath: string[] = [];
  let advances = 0;
  let continuationCount = 0;

  while (advances < maxAdvances) {
    const result = await handleOperatorManifestPrepareCheckpoint(input, dependencies);
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
            safetyStop: false,
            continuationCount,
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
            safetyStop: false,
            continuationCount,
          }),
        },
      };
    }

    continuationCount += 1;
    const elapsedMs = nowMs() - startedAtMs;
    if (elapsedMs >= maxElapsedMs || advances >= maxAdvances) {
      return {
        handled: true,
        response: {
          ...response,
          continuation_required: true,
          server_safety_continuation: true,
          next_action: "Call prepare_manifest_autonomous_cycle once more with the identical operation_id, timezone, and horizon_hours. Server orchestration reached its bounded Worker safety edge; every completed phase is durably checkpointed.",
          server_orchestration: orchestrationReceipt({
            advances,
            startedAtMs,
            nowMs,
            phasePath,
            safetyStop: true,
            continuationCount,
          }),
        },
      };
    }
  }

  throw new Error("manifest_preparation_orchestrator_unreachable");
}
