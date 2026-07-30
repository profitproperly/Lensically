type JsonRecord = Record<string, unknown>;

export type OperatorManifestPersistenceSlot = {
  key: string;
  date: string;
  time: string;
};

export type OperatorManifestPersistenceCoverage = {
  occupied: ReadonlyMap<string, JsonRecord>;
};

export type OperatorManifestPersistenceAdmissionContext = {
  cycle: JsonRecord;
  operationId: string;
  cycleId: string;
  requestedCycleStrategyId: string;
  requestedCyclePlanItemId: string;
  post: JsonRecord;
  postStrategy: JsonRecord;
  modelEvaluation: JsonRecord;
  hypothesis: JsonRecord;
  sourceContext: JsonRecord;
  candidateTrace: JsonRecord[];
  noveltyAssessment: string;
  winnerPreservationAssessment: string;
  slotPlacementAssessment: string;
  recentExposureAssessment: string;
  intelligenceApplicationAssessment: string | null;
  effectiveStrategicThesis: JsonRecord;
  cycleStrategicThesisReused: true;
  outputStrategyVersion: { id: string };
  date: string;
  time: string;
  text: string;
  generationMode: string;
  familyKey: string;
  sourceMechanism: string;
  audienceReward: string;
  strategicPurpose: string;
  slotKey: string;
  targetSlots: OperatorManifestPersistenceSlot[];
  cyclePlanItem: JsonRecord;
  postHypothesis: JsonRecord;
  timezone: string;
  reconciliationNowMs: number;
  existingLineup: JsonRecord | null;
  existingScheduledPostId: number | null;
  scheduledUtc: string;
  rejectPersist(error: string, details?: JsonRecord, slotKey?: string | null): Promise<JsonRecord>;
  reconcileNonfatalSlot(
    outcome: "slot_already_covered" | "slot_elapsed",
    evidence: JsonRecord | null,
  ): Promise<JsonRecord>;
};

export type OperatorManifestPersistenceAdmissionResult =
  | { handled: true; response: JsonRecord }
  | { handled: false; context: OperatorManifestPersistenceAdmissionContext };

export interface OperatorManifestPersistenceAdmissionDependencies {
  autonomyMode: string;
  workspaceDefaultTimezone: string;
  allowedGenerationModes: readonly string[];
  getAutonomyProfile(brandKey: string): Promise<JsonRecord | null>;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  normalizeMachineKey(value: unknown, fallback: string): string;
  readCycle(brandKey: string, cycleId: string): Promise<JsonRecord | null>;
  appendCycleEvent(input: JsonRecord): Promise<unknown>;
    getCycleStrategy(cycleId: string, brandKey: string): Promise<JsonRecord | null>;
  validateHypothesis(value: unknown): { ok: boolean; value?: JsonRecord; errors?: unknown };
  normalizeSourceContext(value: unknown): { ok: boolean; value?: JsonRecord; errors?: unknown };
  validateFollowerBoundary(value: JsonRecord): { ok: boolean; errors?: unknown };
  getCyclePlanItem(cycleId: string, brandKey: string, slotKey: string): Promise<JsonRecord | null>;
  recordHypothesis(input: JsonRecord): Promise<JsonRecord>;
  parseTimestampMs(value: unknown): number | null;
  nowMs(): number;
  buildCoverage(
    targetSlots: OperatorManifestPersistenceSlot[],
    timezone: string,
    effectiveNowMs: number,
  ): Promise<OperatorManifestPersistenceCoverage>;
  convertLocalDateTimeToUtcIso(date: string, time: string, timezone: string): string | null;
  updateCycleCoverage(input: {
    cycleId: string;
    brandKey: string;
    status: string;
    missingSlots: OperatorManifestPersistenceSlot[];
  }): Promise<unknown>;
  readExistingLineup(cycleId: string, brandKey: string, slotKey: string): Promise<JsonRecord | null>;
  readScheduledPost(scheduledPostId: number, threadsUserId: string): Promise<JsonRecord | null>;
  markLineupStale(input: {
    cycleId: string;
    brandKey: string;
    slotKey: string;
    scheduledPostId: number;
  }): Promise<unknown>;
  getPublishLineage(scheduledPostId: number, threadsUserId: string): Promise<JsonRecord>;
  readPersistEvent(cycleId: string, operationId: string): Promise<JsonRecord | null>;
  parseJson(value: string): unknown;
  linkHypothesisResult(input: JsonRecord): Promise<unknown>;
  upsertSemanticSignature(input: JsonRecord): Promise<unknown>;
  registerExperimentAssignment(input: JsonRecord): Promise<unknown>;
  recordDecisionInfluence(input: JsonRecord): Promise<unknown>;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function records(value: unknown, limit?: number): JsonRecord[] {
  const result = Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
  return typeof limit === "number" ? result.slice(0, limit) : result;
}

function numericId(value: unknown): number | null {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function admitOperatorManifestPersistence(
  input: {
    brandKey: string;
    accountId: string;
    threadsUserId: string;
    payload: JsonRecord;
  },
  dependencies: OperatorManifestPersistenceAdmissionDependencies,
): Promise<OperatorManifestPersistenceAdmissionResult> {
  const { brandKey, threadsUserId, payload } = input;
  if (brandKey !== "manifest_mental") {
    return { handled: true, response: { success: false, error: "manifest_only" } };
  }
  const profile = await dependencies.getAutonomyProfile(brandKey);
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
  const operationId = dependencies.normalizeText(payload.operation_id, 240, true);
  if (!operationId) {
    return { handled: true, response: { success: false, error: "stable_operation_id_required" } };
  }
  const cycleId = dependencies.normalizeText(payload.cycle_id, 120);
  if (!cycleId) {
    return { handled: true, response: { success: false, error: "autonomous_cycle_id_required" } };
  }
  const cycle = await dependencies.readCycle(brandKey, cycleId);
  if (!cycle) {
    return { handled: true, response: { success: false, error: "autonomous_cycle_not_found" } };
  }
  const rejectPersist = async (
    error: string,
    details: JsonRecord = {},
    slotKey: string | null = null,
  ): Promise<JsonRecord> => {
    await dependencies.appendCycleEvent({
      cycleId,
      brandKey,
      eventKey: `rejected:${operationId}`,
      eventType: "candidate_rejected",
      slotKey,
      payload: { operation_id: operationId, error, ...details },
    });
    return { success: false, error, ...details };
  };

  const requestedCycleStrategyId = dependencies.normalizeText(payload.cycle_strategy_id, 160);
  const requestedCyclePlanItemId = dependencies.normalizeText(payload.cycle_plan_item_id, 160);
  const cycleStrategy = await dependencies.getCycleStrategy(cycleId, brandKey);
  if (!cycleStrategy) {
    return { handled: true, response: await rejectPersist("manifest_cycle_strategy_required_before_persist") };
  }
  if (!requestedCycleStrategyId || String(cycleStrategy.id ?? "") !== requestedCycleStrategyId) {
    return {
      handled: true,
      response: await rejectPersist("manifest_cycle_strategy_mismatch", {
        expected_cycle_strategy_id: cycleStrategy.id ?? null,
        received_cycle_strategy_id: requestedCycleStrategyId ?? null,
      }),
    };
  }
    if (!cycleStrategy.decision_bundle_id || !cycleStrategy.decision_bundle_hash) {
    return {
      handled: true,
      response: await rejectPersist("manifest_consumed_decision_bundle_required"),
    };
  }
  if (!requestedCyclePlanItemId) {
    return { handled: true, response: await rejectPersist("manifest_cycle_plan_item_required") };
  }

  const post = record(payload.post);
  const rawPostStrategy = record(post.strategy);
  const {
    hypothesis: embeddedHypothesis,
    source_context: embeddedSourceContext,
    ...postStrategy
  } = rawPostStrategy;
  const modelEvaluation = record(payload.model_evaluation);
  const hypothesisValidation = dependencies.validateHypothesis(post.hypothesis ?? embeddedHypothesis);
  if (!hypothesisValidation.ok || !hypothesisValidation.value) {
    return {
      handled: true,
      response: await rejectPersist("post_hypothesis_invalid", { details: hypothesisValidation.errors }),
    };
  }
  const sourceContextValidation = dependencies.normalizeSourceContext(post.source_context ?? embeddedSourceContext);
  if (!sourceContextValidation.ok || !sourceContextValidation.value) {
    return {
      handled: true,
      response: await rejectPersist("source_context_invalid", { details: sourceContextValidation.errors }),
    };
  }
  const sourceContext = sourceContextValidation.value;
  if (["saved_pattern", "source_card"].includes(String(sourceContext.kind ?? ""))
    && !sourceContext.source_card_id
    && !sourceContext.source_selection_id) {
    return { handled: true, response: await rejectPersist("existing_source_card_lineage_required") };
  }
  const candidateTrace = records(modelEvaluation.candidate_trace, 12);
  if (modelEvaluation.generation_passed !== true || modelEvaluation.scheduling_passed !== true) {
    return { handled: true, response: await rejectPersist("model_evaluation_not_passed") };
  }

  const noveltyAssessment = dependencies.normalizeText(modelEvaluation.novelty_assessment, 4000);
  const winnerPreservationAssessment = dependencies.normalizeText(modelEvaluation.winner_preservation_assessment, 4000);
  const slotPlacementAssessment = dependencies.normalizeText(modelEvaluation.slot_placement_assessment, 4000);
  const recentExposureAssessment = dependencies.normalizeText(modelEvaluation.recent_exposure_assessment, 4000);
  const intelligenceApplicationAssessment = dependencies.normalizeText(
    modelEvaluation.intelligence_application_assessment,
    4000,
    true,
  );
  if (!noveltyAssessment || !winnerPreservationAssessment || !slotPlacementAssessment || !recentExposureAssessment) {
    return {
      handled: true,
      response: await rejectPersist("model_evaluation_incomplete", {
        required_fields: [
          "novelty_assessment",
          "winner_preservation_assessment",
          "slot_placement_assessment",
          "recent_exposure_assessment",
        ],
      }),
    };
  }

  const effectiveStrategicThesis = cycleStrategy;
  const outputStrategyVersion = { id: String(cycleStrategy.id ?? requestedCycleStrategyId) };
  const followerBoundary = dependencies.validateFollowerBoundary({
    cycle_strategy: cycleStrategy,
    post_strategy: postStrategy,
    model_evaluation: modelEvaluation,
  });
  if (!followerBoundary.ok) {
    return {
      handled: true,
      response: await rejectPersist("follower_attribution_forbidden", { details: followerBoundary.errors }),
    };
  }

  const date = dependencies.normalizeText(post.date, 20);
  const time = dependencies.normalizeText(post.time, 20);
  const text = dependencies.normalizeText(post.text, 20000);
  const generationMode = dependencies.normalizeMachineKey(post.generation_mode, "");
  const familyKey = dependencies.normalizeMachineKey(post.family_key, "");
  const sourceMechanism = dependencies.normalizeText(post.source_mechanism, 4000);
  const audienceReward = dependencies.normalizeText(post.audience_reward, 4000);
  const strategicPurpose = dependencies.normalizeText(post.strategic_purpose, 4000);
  const slotKey = date && time ? `${date}T${time}` : "";
  const allowedGenerationModes = new Set(dependencies.allowedGenerationModes);
  if (!date || !time || !text || !familyKey || !sourceMechanism || !audienceReward || !strategicPurpose
    || !allowedGenerationModes.has(generationMode)) {
    return {
      handled: true,
      response: await rejectPersist("invalid_source_backed_autonomous_post", {
        allowed_generation_modes: Array.from(allowedGenerationModes),
      }, slotKey || null),
    };
  }
  if (!["saved_pattern", "source_card"].includes(String(sourceContext.kind ?? ""))
    || !sourceContext.source_card_id) {
    return {
      handled: true,
      response: await rejectPersist("canonical_source_card_required", {
        received_source_kind: sourceContext.kind ?? null,
        corrective_action: "Create or recover a locked canonical source card from a qualified Saved Pattern or proven prior winner before generation.",
      }, slotKey || null),
    };
  }

  const targetSlots = records(cycle.target_slots) as OperatorManifestPersistenceSlot[];
  const targetSlot = targetSlots.find((slot) => slot.key === slotKey);
  if (!targetSlot) {
    return {
      handled: true,
      response: await rejectPersist("slot_outside_prepared_cycle", { slot_key: slotKey }, slotKey),
    };
  }
  const cyclePlanItem = await dependencies.getCyclePlanItem(cycleId, brandKey, slotKey);
  if (!cyclePlanItem || String(cyclePlanItem.id ?? "") !== requestedCyclePlanItemId) {
    return {
      handled: true,
      response: await rejectPersist("manifest_cycle_plan_item_mismatch", {
        slot_key: slotKey,
        expected_cycle_plan_item_id: cyclePlanItem?.id ?? null,
        received_cycle_plan_item_id: requestedCyclePlanItemId,
      }, slotKey),
    };
  }
  if (String(cyclePlanItem.strategy_id ?? "") !== requestedCycleStrategyId
    || String(cyclePlanItem.source_card_id ?? "") !== String(sourceContext.source_card_id ?? "")
    || dependencies.normalizeMachineKey(cyclePlanItem.family_key, "") !== familyKey
    || dependencies.normalizeMachineKey(cyclePlanItem.generation_mode, "") !== generationMode) {
    return {
      handled: true,
      response: await rejectPersist("candidate_does_not_match_locked_cycle_plan", {
        slot_key: slotKey,
        planned_family_key: cyclePlanItem.family_key ?? null,
        planned_generation_mode: cyclePlanItem.generation_mode ?? null,
        planned_source_card_id: cyclePlanItem.source_card_id ?? null,
      }, slotKey),
    };
  }

  let postHypothesis = await dependencies.recordHypothesis({
    cycleId,
    brandKey,
    slotKey,
    strategyVersionId: outputStrategyVersion.id,
    source: sourceContext,
    hypothesis: hypothesisValidation.value,
    candidateTrace,
    modelEvaluation,
  });
  await dependencies.appendCycleEvent({
    cycleId,
    brandKey,
    eventKey: `candidate:${operationId}`,
    eventType: "candidate_evaluated",
    slotKey,
    payload: {
      operation_id: operationId,
      text,
      generation_mode: generationMode,
      family_key: familyKey,
      source_context: sourceContext,
      hypothesis_id: postHypothesis.id ?? null,
      candidate_trace: candidateTrace,
      model_evaluation: modelEvaluation,
    },
  });

  const timezone = String(cycle.timezone ?? dependencies.workspaceDefaultTimezone);
  const accountPosition = record(cycle.account_position);
  const cycleClock = record(accountPosition.clock);
  const preparedClockMs = dependencies.parseTimestampMs(cycleClock.effective_now_iso);
  const reconciliationNowMs = Math.max(dependencies.nowMs(), preparedClockMs ?? 0);
  const reconcileNonfatalSlot = async (
    outcome: "slot_already_covered" | "slot_elapsed",
    evidence: JsonRecord | null,
  ): Promise<JsonRecord> => {
    const liveCoverage = await dependencies.buildCoverage(targetSlots, timezone, reconciliationNowMs);
    const liveMissing = targetSlots.filter((slot) => {
      const slotUtc = dependencies.convertLocalDateTimeToUtcIso(slot.date, slot.time, timezone);
      const slotMs = dependencies.parseTimestampMs(slotUtc);
      return slotMs !== null && slotMs > reconciliationNowMs && !liveCoverage.occupied.has(slot.key);
    });
    await dependencies.updateCycleCoverage({
      cycleId,
      brandKey,
      status: liveMissing.length > 0 ? "partially_committed" : "completed",
      missingSlots: liveMissing,
    });
    return {
      success: true,
      persisted: false,
      outcome,
      slot_key: slotKey,
      preserved_existing: outcome === "slot_already_covered",
      occupied_evidence: evidence,
      collision_reconciled: true,
      candidate_requires_reslot: liveMissing.length > 0,
      next_missing_slot: liveMissing[0] ?? null,
      authoritative_missing_slots: liveMissing.slice(0, 12),
      remaining_missing_count: liveMissing.length,
      next_action: liveMissing.length > 0
        ? "Re-evaluate the candidate for the returned next_missing_slot, use that slot's deterministic operation id, and continue without stopping."
        : "The prepared horizon is covered; verify lineage, scheduler health, and delivery incidents.",
    };
  };

  const existingLineup = await dependencies.readExistingLineup(cycleId, brandKey, slotKey);
  const existingLineupScheduledPostId = numericId(existingLineup?.scheduled_post_id);
  const existingScheduledPost = existingLineupScheduledPostId
    ? await dependencies.readScheduledPost(existingLineupScheduledPostId, threadsUserId)
    : null;
  const existingScheduledPostId = numericId(existingScheduledPost?.id);
  if (existingLineupScheduledPostId && !existingScheduledPost) {
    await dependencies.markLineupStale({
      cycleId,
      brandKey,
      slotKey,
      scheduledPostId: existingLineupScheduledPostId,
    });
  }

  if (existingScheduledPostId && String(existingLineup?.status ?? "") === "scheduled") {
    const existingLineage = await dependencies.getPublishLineage(existingScheduledPostId, threadsUserId);
    if (existingLineage.complete === true) {
      const priorPersistEvent = await dependencies.readPersistEvent(cycleId, operationId);
      const priorPersistPayload = priorPersistEvent?.payload_json
        ? dependencies.parseJson(String(priorPersistEvent.payload_json))
        : null;
      const priorPersistPayloadRecord = record(priorPersistPayload);
      const priorScheduledPostId = numericId(priorPersistPayloadRecord.scheduled_post_id);
      if (["post_persisted", "post_reused"].includes(String(priorPersistEvent?.event_type ?? ""))
        && priorScheduledPostId === existingScheduledPostId) {
        return {
          handled: true,
          response: {
            success: true,
            reused: true,
            replayed_persist_event: true,
            slot_key: slotKey,
            scheduled_post_id: existingScheduledPostId,
            lineage: existingLineage.lineage ?? {
              source_card_id: existingLineup?.source_card_id ?? null,
              source_selection_id: existingLineup?.source_selection_id ?? null,
              generation_run_id: existingLineup?.generation_run_id ?? null,
              draft_id: existingLineup?.draft_id ?? null,
            },
            publish_lineage_complete: true,
            hypothesis_id: priorPersistPayloadRecord.hypothesis_id ?? postHypothesis.id ?? null,
            strategy_version_id: priorPersistPayloadRecord.strategy_version_id ?? outputStrategyVersion.id,
            experiment_assignment: priorPersistPayloadRecord.experiment_assignment ?? null,
            decision_influence: priorPersistPayloadRecord.decision_influence ?? null,
            coverage_reconciliation_required: true,
          },
        };
      }

      await dependencies.linkHypothesisResult({
        cycleId,
        slotKey,
        scheduledPostId: existingScheduledPostId,
        status: "reused",
        hypothesisId: dependencies.normalizeText(postHypothesis.id, 160, true),
        sourceSelectionId: dependencies.normalizeText(existingLineup?.source_selection_id, 160, true)
          ?? dependencies.normalizeText(sourceContext.source_selection_id, 160, true),
      });
      await dependencies.upsertSemanticSignature({
        brand_key: brandKey,
        content_type: "scheduled",
        content_id: String(existingScheduledPostId),
        text,
        metadata: {
          ...postStrategy,
          family_key: familyKey,
          source_mechanism: sourceMechanism,
          audience_reward: audienceReward,
          strategic_purpose: strategicPurpose,
        },
        scheduled_post_id: existingScheduledPostId,
        observed_at: existingScheduledPost?.scheduled_time ?? null,
      });
      const experimentAssignment = await dependencies.registerExperimentAssignment({
        brand_key: brandKey,
        cycle_id: cycleId,
        slot_key: slotKey,
        family_key: familyKey,
        hypothesis_id: String(postHypothesis.id ?? ""),
        scheduled_post_id: existingScheduledPostId,
        experiment: hypothesisValidation.value.experiment,
      });
      const decisionInfluence = await dependencies.recordDecisionInfluence({
        brand_key: brandKey,
        cycle_id: cycleId,
        slot_key: slotKey,
        scheduled_post_id: existingScheduledPostId,
        hypothesis_id: String(postHypothesis.id ?? ""),
        input_strategy_version_id: dependencies.normalizeText(cycle.strategy_version_id, 160, true),
        output_strategy_version_id: dependencies.normalizeText(outputStrategyVersion.id, 160, true),
        family_key: familyKey,
        generation_mode: generationMode,
        source_context: sourceContext,
        strategic_thesis: effectiveStrategicThesis,
        model_evaluation: {
          ...modelEvaluation,
          intelligence_application_assessment: intelligenceApplicationAssessment,
        },
        semantic_repetition: {},
        experiment_assignment: experimentAssignment,
      });
      await dependencies.appendCycleEvent({
        cycleId,
        brandKey,
        eventKey: `persist:${operationId}`,
        eventType: "post_reused",
        slotKey,
        payload: {
          scheduled_post_id: existingScheduledPostId,
          publish_lineage_complete: true,
          experiment_assignment: experimentAssignment,
          decision_influence: decisionInfluence,
        },
      });
      return {
        handled: true,
        response: {
          success: true,
          reused: true,
          slot_key: slotKey,
          scheduled_post_id: existingScheduledPostId,
          lineage: existingLineage.lineage ?? {
            source_card_id: existingLineup?.source_card_id ?? null,
            generation_run_id: existingLineup?.generation_run_id ?? null,
            draft_id: existingLineup?.draft_id ?? null,
          },
          publish_lineage_complete: true,
          hypothesis_id: postHypothesis.id ?? null,
          strategy_version_id: outputStrategyVersion.id,
          experiment_assignment: experimentAssignment,
          decision_influence: decisionInfluence,
          coverage_reconciliation_required: true,
        },
      };
    }
  }

  const scheduledUtc = dependencies.convertLocalDateTimeToUtcIso(date, time, timezone);
  if (!scheduledUtc) {
    return {
      handled: true,
      response: await rejectPersist("invalid_date_time", { slot_key: slotKey }, slotKey),
    };
  }
  if ((dependencies.parseTimestampMs(scheduledUtc) ?? 0) <= reconciliationNowMs && !existingScheduledPostId) {
    return {
      handled: true,
      response: await reconcileNonfatalSlot("slot_elapsed", null),
    };
  }

  return {
    handled: false,
    context: {
      cycle,
      operationId,
      cycleId,
      requestedCycleStrategyId,
      requestedCyclePlanItemId,
      post,
      postStrategy,
      modelEvaluation,
      hypothesis: hypothesisValidation.value,
      sourceContext,
      candidateTrace,
      noveltyAssessment,
      winnerPreservationAssessment,
      slotPlacementAssessment,
      recentExposureAssessment,
      intelligenceApplicationAssessment,
      effectiveStrategicThesis,
      cycleStrategicThesisReused: true,
      outputStrategyVersion,
      date,
      time,
      text,
      generationMode,
      familyKey,
      sourceMechanism,
      audienceReward,
      strategicPurpose,
      slotKey,
      targetSlots,
      cyclePlanItem,
      postHypothesis,
      timezone,
      reconciliationNowMs,
      existingLineup,
      existingScheduledPostId,
      scheduledUtc,
      rejectPersist,
      reconcileNonfatalSlot,
    },
  };
}
