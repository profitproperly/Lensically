type JsonRecord = Record<string, unknown>;

export type OperatorManifestPrepareCheckpointResult =
  | { handled: true; response: JsonRecord }
  | {
      handled: false;
      context: {
        timezone: string;
        horizonHours: number;
        explicitOperationId: string | null;
        phasedPreparation: boolean;
        runtimeNowIso: string;
        threadsSnapshot: JsonRecord;
      };
    };

export interface OperatorManifestPrepareCheckpointDependencies {
  autonomyMode: string;
  defaultTimezone: string;
  defaultRunwayHours: number;
  checkpointVersion: string;
  savedPatternsAppUserId: string;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  hasTestRuntimeTokens(): boolean;
  getAutonomyProfile(brandKey: string): Promise<JsonRecord | null>;
  ensureCheckpointTable(): Promise<unknown>;
  readCheckpoint(brandKey: string, operationId: string): Promise<JsonRecord | null>;
  writeCheckpoint(input: JsonRecord): Promise<unknown>;
  clearCheckpoint(brandKey: string, operationId: string): Promise<unknown>;
  refreshThreadsSnapshot(options?: JsonRecord): Promise<JsonRecord>;
  compactThreadsSnapshot(snapshot: JsonRecord): JsonRecord;
  refreshIntelligenceEngine(options: JsonRecord): Promise<JsonRecord>;
  compactPayloadValue(value: unknown, path: string): unknown;
  operatorRecord(value: unknown): JsonRecord;
  refreshMeasurementAudit(input: JsonRecord): Promise<JsonRecord>;
  refreshContentFocus(brandKey: string): Promise<unknown>;
  readActiveLearningBrief(brandKey: string): Promise<JsonRecord | null>;
  parseJson(value: string): unknown;
  updateActiveLearningBrief(input: { id: string; brandKey: string; brief: JsonRecord }): Promise<unknown>;
  now(): string;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function continuation(
  operationId: string,
  checkpointVersion: string,
  stageCompleted: string,
  nextStage: string,
  nextAction: string,
  evidence: JsonRecord = {},
): OperatorManifestPrepareCheckpointResult {
  return {
    handled: true,
    response: {
      success: true,
      preparation_complete: false,
      continuation_required: true,
      operation_id: operationId,
      checkpoint_version: checkpointVersion,
      stage_completed: stageCompleted,
      next_stage: nextStage,
      ...evidence,
      next_action: nextAction,
    },
  };
}

export async function handleOperatorManifestPrepareCheckpoint(
  input: {
    brandKey: string;
    accountId: string;
    threadsUserId: string;
    payload: JsonRecord;
  },
  dependencies: OperatorManifestPrepareCheckpointDependencies,
): Promise<OperatorManifestPrepareCheckpointResult> {
  const { brandKey, accountId, threadsUserId, payload } = input;
  const profile = await dependencies.getAutonomyProfile(brandKey);
  if (brandKey !== "manifest_mental") {
    return { handled: true, response: { success: false, error: "manifest_only" } };
  }
  if (String(profile?.mode ?? "") !== dependencies.autonomyMode) {
    return {
      handled: true,
      response: {
        success: false,
        error: "autonomous_operator_mode_required",
        current_mode: profile?.mode ?? null,
      },
    };
  }

  const timezone = dependencies.normalizeText(payload.timezone, 100, true)
    ?? dependencies.defaultTimezone;
  const horizonHours = Math.min(
    Math.max(Math.trunc(Number(payload.horizon_hours ?? dependencies.defaultRunwayHours)), 1),
    72,
  );
  const explicitOperationId = dependencies.normalizeText(payload.operation_id, 240, true);
  const phasedPreparation = Boolean(explicitOperationId) && !dependencies.hasTestRuntimeTokens();
  let runtimeNowIso = dependencies.now();
  let threadsSnapshot: JsonRecord;

  if (phasedPreparation && explicitOperationId) {
    await dependencies.ensureCheckpointTable();
    const checkpoint = await dependencies.readCheckpoint(brandKey, explicitOperationId);
    if (checkpoint
      && (String(checkpoint.timezone ?? "") !== timezone
        || Number(checkpoint.horizon_hours ?? 0) !== horizonHours)) {
      return {
        handled: true,
        response: {
          success: false,
          error: "idempotency_key_payload_mismatch",
          operation_id: explicitOperationId,
          stored_timezone: checkpoint.timezone ?? null,
          requested_timezone: timezone,
          stored_horizon_hours: Number(checkpoint.horizon_hours ?? 0),
          requested_horizon_hours: horizonHours,
        },
      };
    }

    if (!checkpoint || String(checkpoint.phase ?? "") === "live_collection") {
      const collectedSnapshot = await dependencies.refreshThreadsSnapshot({ defer_evaluator: true });
      if (!collectedSnapshot.refreshed
        || !collectedSnapshot.evaluator_deferred
        || !collectedSnapshot.collection_state) {
        return {
          handled: true,
          response: {
            success: false,
            error: collectedSnapshot.error ?? "manifest_live_collection_incomplete",
            stage: "live_collection",
            retryable: collectedSnapshot.continuation_required === true,
            continuation_required: collectedSnapshot.continuation_required === true,
            remaining_due_checkpoint_count: collectedSnapshot.remaining_due_checkpoint_count,
            next_action: "Repair or retry the bounded live Threads collection before evaluator recomputation.",
            threads_snapshot: dependencies.compactThreadsSnapshot(collectedSnapshot),
          },
        };
      }
      await dependencies.writeCheckpoint({
        brand_key: brandKey,
        operation_id: explicitOperationId,
        phase: "live_evaluator",
        timezone,
        horizon_hours: horizonHours,
        state: {
          runtime_now_iso: runtimeNowIso,
          collection_state: collectedSnapshot.collection_state,
        },
      });
      return continuation(
        explicitOperationId,
        dependencies.checkpointVersion,
        "live_collection",
        "live_evaluator",
        "Call prepare_manifest_autonomous_cycle again with the identical operation_id, timezone, and horizon_hours. The Threads collection and due metric snapshots are durably checkpointed; the next invocation runs evaluator recomputation only.",
        { threads_snapshot: dependencies.compactThreadsSnapshot(collectedSnapshot) },
      );
    }

    const state = record(checkpoint.state);
    runtimeNowIso = dependencies.normalizeText(state.runtime_now_iso, 100, true) ?? runtimeNowIso;
    if (String(checkpoint.phase ?? "") === "live_evaluator") {
      const collectionState = record(state.collection_state);
      if (!Object.keys(collectionState).length) {
        await dependencies.clearCheckpoint(brandKey, explicitOperationId);
        return {
          handled: true,
          response: {
            success: false,
            error: "manifest_live_collection_checkpoint_missing",
            stage: "live_evaluator",
            retryable: true,
            next_action: "Call prepare_manifest_autonomous_cycle again with the identical inputs to rebuild the missing live collection checkpoint.",
          },
        };
      }
      const evaluatedSnapshot = await dependencies.refreshThreadsSnapshot({
        collection_state: collectionState,
        defer_manifest_layers: true,
      });
      if (!evaluatedSnapshot.complete) {
        await dependencies.writeCheckpoint({
          brand_key: brandKey,
          operation_id: explicitOperationId,
          phase: "live_collection",
          timezone,
          horizon_hours: horizonHours,
          state: { runtime_now_iso: runtimeNowIso },
        });
        return continuation(
          explicitOperationId,
          dependencies.checkpointVersion,
          "live_evaluator",
          "live_collection",
          "Call prepare_manifest_autonomous_cycle again with the identical inputs. The evaluator pass is persisted; another bounded Threads collection will advance the remaining due checkpoints.",
          {
            remaining_due_checkpoint_count: evaluatedSnapshot.remaining_due_checkpoint_count,
            threads_snapshot: dependencies.compactThreadsSnapshot(evaluatedSnapshot),
          },
        );
      }
      threadsSnapshot = evaluatedSnapshot;
      await dependencies.writeCheckpoint({
        brand_key: brandKey,
        operation_id: explicitOperationId,
        phase: "manifest_intelligence",
        timezone,
        horizon_hours: horizonHours,
        state: {
          runtime_now_iso: runtimeNowIso,
          threads_snapshot: dependencies.compactThreadsSnapshot(evaluatedSnapshot),
        },
      });
      return continuation(
        explicitOperationId,
        dependencies.checkpointVersion,
        "live_evaluator",
        "manifest_intelligence",
        "Call prepare_manifest_autonomous_cycle again with the identical inputs. Core maturity scoring and evidence are complete; the next invocation refreshes Manifest intelligence only.",
        { threads_snapshot: dependencies.compactThreadsSnapshot(evaluatedSnapshot) },
      );
    }

    if (String(checkpoint.phase ?? "") === "manifest_intelligence") {
      const intelligenceEngine = await dependencies.refreshIntelligenceEngine({ phase: "semantic_signatures" });
      const intelligenceSummary = dependencies.compactPayloadValue(
        intelligenceEngine,
        "manifest_intelligence.semantic",
      );
      await dependencies.writeCheckpoint({
        brand_key: brandKey,
        operation_id: explicitOperationId,
        phase: "manifest_intelligence_maturity",
        timezone,
        horizon_hours: horizonHours,
        state: {
          runtime_now_iso: runtimeNowIso,
          threads_snapshot: state.threads_snapshot ?? {},
          intelligence_engine: { semantic_signatures: intelligenceSummary },
        },
      });
      return continuation(
        explicitOperationId,
        dependencies.checkpointVersion,
        "manifest_intelligence_semantic",
        "manifest_intelligence_maturity",
        "Call prepare_manifest_autonomous_cycle again with the identical inputs. Semantic exposure signatures are refreshed; the next invocation refreshes maturity and comparable analyses only.",
        { intelligence_engine: intelligenceSummary },
      );
    }

    if (String(checkpoint.phase ?? "") === "manifest_intelligence_maturity") {
      const maturity = await dependencies.refreshIntelligenceEngine({ phase: "maturity_evaluations" });
      const maturitySummary = dependencies.compactPayloadValue(
        maturity,
        "manifest_intelligence.maturity",
      );
      await dependencies.writeCheckpoint({
        brand_key: brandKey,
        operation_id: explicitOperationId,
        phase: "manifest_intelligence_comparables",
        timezone,
        horizon_hours: horizonHours,
        state: {
          runtime_now_iso: runtimeNowIso,
          threads_snapshot: state.threads_snapshot ?? {},
          intelligence_engine: {
            ...dependencies.operatorRecord(state.intelligence_engine),
            maturity_evaluations: maturitySummary,
          },
        },
      });
      return continuation(
        explicitOperationId,
        dependencies.checkpointVersion,
        "manifest_intelligence_maturity",
        "manifest_intelligence_comparables",
        "Call prepare_manifest_autonomous_cycle again with the identical inputs. Maturity evaluations are refreshed; the next invocation computes comparable analyses only.",
        { intelligence_engine: maturitySummary },
      );
    }

    if (String(checkpoint.phase ?? "") === "manifest_intelligence_comparables") {
      const comparables = await dependencies.refreshIntelligenceEngine({ phase: "comparable_analyses" });
      const comparableSummary = dependencies.compactPayloadValue(
        comparables,
        "manifest_intelligence.comparables",
      );
      await dependencies.writeCheckpoint({
        brand_key: brandKey,
        operation_id: explicitOperationId,
        phase: "manifest_intelligence_learning",
        timezone,
        horizon_hours: horizonHours,
        state: {
          runtime_now_iso: runtimeNowIso,
          threads_snapshot: state.threads_snapshot ?? {},
          intelligence_engine: {
            ...dependencies.operatorRecord(state.intelligence_engine),
            comparable_analyses: comparableSummary,
          },
          learning_offset: 0,
        },
      });
      return continuation(
        explicitOperationId,
        dependencies.checkpointVersion,
        "manifest_intelligence_comparables",
        "manifest_intelligence_learning",
        "Call prepare_manifest_autonomous_cycle again with the identical inputs. Comparable analyses are refreshed; the next invocation begins bounded multi-level learning observations.",
        { intelligence_engine: comparableSummary },
      );
    }

    if (String(checkpoint.phase ?? "") === "manifest_intelligence_learning") {
      const learningOffset = Math.max(0, Math.trunc(Number(state.learning_offset ?? 0)));
      const learning = await dependencies.refreshIntelligenceEngine({
        phase: "learning_observations",
        learning_offset: learningOffset,
        learning_limit: 180,
      });
      const learningSummary = dependencies.compactPayloadValue(
        learning,
        "manifest_intelligence.learning",
      );
      const learningContinuation = learning.continuation_required === true;
      await dependencies.writeCheckpoint({
        brand_key: brandKey,
        operation_id: explicitOperationId,
        phase: learningContinuation
          ? "manifest_intelligence_learning"
          : "manifest_intelligence_portfolio",
        timezone,
        horizon_hours: horizonHours,
        state: {
          runtime_now_iso: runtimeNowIso,
          threads_snapshot: state.threads_snapshot ?? {},
          intelligence_engine: {
            ...dependencies.operatorRecord(state.intelligence_engine),
            learning_observations: learningSummary,
          },
          learning_offset: learningContinuation
            ? Number(learning.next_offset ?? learningOffset + 180)
            : null,
        },
      });
      return continuation(
        explicitOperationId,
        dependencies.checkpointVersion,
        "manifest_intelligence_learning_batch",
        learningContinuation
          ? "manifest_intelligence_learning"
          : "manifest_intelligence_portfolio",
        learningContinuation
          ? "Call prepare_manifest_autonomous_cycle again with the identical inputs. The next bounded learning-observation batch will resume from the persisted offset."
          : "Call prepare_manifest_autonomous_cycle again with the identical inputs. Multi-level learning is complete; the next invocation refreshes portfolio states and experiments.",
        { intelligence_engine: learningSummary },
      );
    }

    if (String(checkpoint.phase ?? "") === "manifest_intelligence_portfolio") {
      const portfolio = await dependencies.refreshIntelligenceEngine({ phase: "portfolio_experiments" });
      const portfolioSummary = dependencies.compactPayloadValue(
        portfolio,
        "manifest_intelligence.portfolio",
      );
      const completeIntelligence = {
        ...dependencies.operatorRecord(state.intelligence_engine),
        portfolio_experiments: portfolioSummary,
      };
      await dependencies.writeCheckpoint({
        brand_key: brandKey,
        operation_id: explicitOperationId,
        phase: "manifest_measurement_audit",
        timezone,
        horizon_hours: horizonHours,
        state: {
          runtime_now_iso: runtimeNowIso,
          threads_snapshot: state.threads_snapshot ?? {},
          intelligence_engine: completeIntelligence,
        },
      });
      return continuation(
        explicitOperationId,
        dependencies.checkpointVersion,
        "manifest_intelligence_portfolio",
        "manifest_measurement_audit",
        "Call prepare_manifest_autonomous_cycle again with the identical inputs. All intelligence-engine phases are complete; the next invocation refreshes the measurement audit only.",
        { intelligence_engine: portfolioSummary },
      );
    }

    if (String(checkpoint.phase ?? "") === "manifest_measurement_audit") {
      const measurementAudit = await dependencies.refreshMeasurementAudit({
        brand_key: brandKey,
        threads_user_id: threadsUserId,
        account_id: accountId,
        saved_patterns_app_user_id: dependencies.savedPatternsAppUserId,
      });
      const measurementSummary = dependencies.compactPayloadValue(
        measurementAudit,
        "manifest_measurement_audit",
      );
      await dependencies.writeCheckpoint({
        brand_key: brandKey,
        operation_id: explicitOperationId,
        phase: "manifest_content_focus",
        timezone,
        horizon_hours: horizonHours,
        state: {
          runtime_now_iso: runtimeNowIso,
          threads_snapshot: state.threads_snapshot ?? {},
          intelligence_engine: state.intelligence_engine ?? {},
          measurement_audit: measurementSummary,
        },
      });
      return continuation(
        explicitOperationId,
        dependencies.checkpointVersion,
        "manifest_measurement_audit",
        "manifest_content_focus",
        "Call prepare_manifest_autonomous_cycle again with the identical inputs. Measurement audit state is durably refreshed; the next invocation refreshes Content Focus and finalizes the learning brief.",
        { measurement_audit: measurementSummary },
      );
    }

    if (String(checkpoint.phase ?? "") === "manifest_content_focus") {
      const contentFocus = await dependencies.refreshContentFocus(brandKey);
      const contentFocusSummary = dependencies.compactPayloadValue(
        contentFocus,
        "manifest_content_focus",
      );
      const activeBrief = await dependencies.readActiveLearningBrief(brandKey);
      if (activeBrief?.id) {
        const brief = dependencies.operatorRecord(
          dependencies.parseJson(String(activeBrief.brief_json ?? "{}")),
        );
        await dependencies.updateActiveLearningBrief({
          id: String(activeBrief.id),
          brandKey,
          brief: {
            ...brief,
            intelligence_engine: state.intelligence_engine ?? {},
            measurement_audit: state.measurement_audit ?? {},
            content_focus: contentFocusSummary,
            manifest_layers_finalized: true,
          },
        });
      }
      const storedThreadsSnapshot = record(state.threads_snapshot);
      const storedEvaluation = record(storedThreadsSnapshot.performance_evaluation);
      threadsSnapshot = {
        ...storedThreadsSnapshot,
        performance_evaluation: {
          ...storedEvaluation,
          manifest_layers_deferred: false,
          manifest_layers_finalized: true,
        },
      };
      await dependencies.writeCheckpoint({
        brand_key: brandKey,
        operation_id: explicitOperationId,
        phase: "cycle_construction",
        timezone,
        horizon_hours: horizonHours,
        state: {
          runtime_now_iso: runtimeNowIso,
          threads_snapshot: threadsSnapshot,
        },
      });
      return continuation(
        explicitOperationId,
        dependencies.checkpointVersion,
        "manifest_content_focus",
        "cycle_construction",
        "Call prepare_manifest_autonomous_cycle again with the identical inputs. All evaluator layers and the active learning brief are finalized; the next invocation constructs the cycle.",
        { content_focus: contentFocusSummary },
      );
    }

    threadsSnapshot = record(state.threads_snapshot);
  } else {
    threadsSnapshot = await dependencies.refreshThreadsSnapshot();
  }

  if (!threadsSnapshot.refreshed || !threadsSnapshot.complete) {
    return {
      handled: true,
      response: {
        success: false,
        error: threadsSnapshot.error ?? "manifest_live_evidence_refresh_incomplete",
        stage: "live_evidence_refresh",
        retryable: threadsSnapshot.continuation_required === true,
        continuation_required: threadsSnapshot.continuation_required === true,
        remaining_due_checkpoint_count: threadsSnapshot.remaining_due_checkpoint_count,
        next_action: threadsSnapshot.continuation_required === true
          ? "Call prepare_manifest_autonomous_cycle again with the identical operation_id. The prior bounded refresh was persisted; the next invocation advances the remaining due checkpoint batch without replaying completed work."
          : "Repair the live evidence refresh failure before strategy work.",
        threads_snapshot: threadsSnapshot,
      },
    };
  }

  return {
    handled: false,
    context: {
      timezone,
      horizonHours,
      explicitOperationId,
      phasedPreparation,
      runtimeNowIso,
      threadsSnapshot,
    },
  };
}
