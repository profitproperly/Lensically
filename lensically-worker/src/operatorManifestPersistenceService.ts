import type { OperatorManifestPersistenceAdmissionContext } from "./operatorManifestPersistenceAdmissionService";

type JsonRecord = Record<string, unknown>;

type ExactScheduled = {
  id: number | string;
  scheduled_time: string;
};

type ScheduledResult = {
  success: boolean;
  scheduledPostId?: number;
  scheduledTimeUtc?: string;
  reused?: boolean;
  error?: unknown;
};

export interface OperatorManifestPersistenceDependencies {
  growthEngineVersion: string;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  normalizeMachineKey(value: unknown, fallback: string): string;
  normalizeJson(value: unknown, fallback: unknown): string;
  ensureScheduledPosts(): Promise<unknown>;
  buildScheduleIdempotencyKey(input: {
    threadsUserId: string;
    scheduledUtc: string;
    text: string;
  }): Promise<string>;
  readExactScheduledByKey(idempotencyKey: string): Promise<ExactScheduled | null>;
  readScheduledById(scheduledPostId: number, threadsUserId: string): Promise<ExactScheduled | null>;
  buildCoverage(
    targetSlots: Array<{ key: string; date: string; time: string }>,
    timezone: string,
    effectiveNowMs: number,
  ): Promise<{ occupied: ReadonlyMap<string, JsonRecord> }>;
  findExactDuplicate(input: {
    threadsUserId: string;
    text: string;
    idempotencyKey: string;
    excludedScheduledPostId: number;
  }): Promise<JsonRecord | null>;
  analyzeRepetition(input: JsonRecord): Promise<JsonRecord>;
  ensureSourceCard(cycleId: string, post: JsonRecord): Promise<JsonRecord>;
  linkHypothesisResult(input: JsonRecord): Promise<unknown>;
  extractOpeningPhrase(text: string): string;
  listHardBans(brandKey: string): Promise<JsonRecord[]>;
  runGateSuite(input: JsonRecord): Promise<{
    showable: boolean;
    gate_results: JsonRecord[];
    blocking_failures: unknown[];
    warnings: unknown[];
  }>;
  recordGateReceipt(input: JsonRecord): Promise<JsonRecord>;
  recordHypothesis(input: JsonRecord): Promise<JsonRecord>;
  sha256(value: string): Promise<string>;
  createScheduledPost(input: {
    text: string;
    date: string;
    time: string;
    timezone: string;
  }): Promise<ScheduledResult>;
  ensurePersistenceSchemas(): Promise<unknown>;
  normalizeStrategy(value: JsonRecord): JsonRecord | null;
  inferRealmEntranceKey(openingPhrase: string): string | null;
  persistLineageRecords(input: JsonRecord): Promise<unknown>;
  upsertSemanticSignature(input: JsonRecord): Promise<unknown>;
  readLineageStatus(input: {
    cycleId: string;
    brandKey: string;
    slotKey: string;
    scheduledPostId: number;
    accountId: string;
    threadsUserId: string;
  }): Promise<JsonRecord | null>;
  markLineageFailure(input: {
    scheduledPostId: number;
    threadsUserId: string;
    errorMessage: string;
  }): Promise<unknown>;
  registerExperimentAssignment(input: JsonRecord): Promise<unknown>;
  recordDecisionInfluence(input: JsonRecord): Promise<unknown>;
  appendCycleEvent(input: JsonRecord): Promise<unknown>;
  readCurrentCycle(brandKey: string, cycleId: string): Promise<JsonRecord | null>;
  occupiedSlots(
    targetSlots: Array<{ key: string; date: string; time: string }>,
    timezone: string,
  ): Promise<ReadonlyMap<string, JsonRecord>>;
  localDateTimeParts(date: Date, timezone: string): { date: string; hour: number };
  hourlySlot(hour: number): string;
  reconcileCoverageState(
    targetSlots: Array<{ key: string; date: string; time: string }>,
    occupied: ReadonlyMap<string, JsonRecord>,
    currentLocalHourKey: string,
    scheduledPostIds: unknown[],
  ): {
    remaining_missing_slots: Array<{ key: string; date: string; time: string }>;
    elapsed_unfilled_slots: Array<{ key: string; date: string; time: string }>;
    scheduled_post_ids: number[];
  };
  updateCycleAfterPersist(input: {
    cycleId: string;
    brandKey: string;
    status: string;
    strategicThesis: JsonRecord;
    remainingMissing: Array<{ key: string; date: string; time: string }>;
    scheduledPostIds: number[];
  }): Promise<unknown>;
  finalizeCycleReceipt(input: JsonRecord): Promise<JsonRecord>;
  setCycleStatus(cycleId: string, brandKey: string, status: string): Promise<unknown>;
  now(): Date;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function numericId(value: unknown): number | null {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function persistOperatorManifestCandidate(
  input: {
    brandKey: string;
    accountId: string;
    threadsUserId: string;
    context: OperatorManifestPersistenceAdmissionContext;
  },
  dependencies: OperatorManifestPersistenceDependencies,
): Promise<JsonRecord> {
  const { brandKey, accountId, threadsUserId, context } = input;
  const {
    cycle,
    operationId,
    cycleId,
    requestedCycleStrategyId,
    requestedCyclePlanItemId,
    post,
    postStrategy,
    modelEvaluation,
    hypothesis,
    sourceContext,
    candidateTrace,
    noveltyAssessment,
    winnerPreservationAssessment,
    slotPlacementAssessment,
    recentExposureAssessment,
    intelligenceApplicationAssessment,
    effectiveStrategicThesis,
    cycleStrategicThesisReused,
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
    timezone,
    reconciliationNowMs,
    existingScheduledPostId,
    scheduledUtc,
    rejectPersist,
    reconcileNonfatalSlot,
  } = context;
  let postHypothesis = context.postHypothesis;

  await dependencies.ensureScheduledPosts();
  const scheduleIdempotencyKey = await dependencies.buildScheduleIdempotencyKey({
    threadsUserId,
    scheduledUtc,
    text,
  });
  const exactScheduledByKey = await dependencies.readExactScheduledByKey(scheduleIdempotencyKey);
  const exactScheduledByLineup = !exactScheduledByKey && existingScheduledPostId
    ? await dependencies.readScheduledById(existingScheduledPostId, threadsUserId)
    : null;
  const exactScheduled = exactScheduledByKey ?? exactScheduledByLineup;
  if (!exactScheduled) {
    const liveCoverage = await dependencies.buildCoverage(targetSlots, timezone, reconciliationNowMs);
    if (liveCoverage.occupied.has(slotKey)) {
      return reconcileNonfatalSlot(
        "slot_already_covered",
        liveCoverage.occupied.get(slotKey) ?? null,
      );
    }
  }
  const duplicate = await dependencies.findExactDuplicate({
    threadsUserId,
    text,
    idempotencyKey: scheduleIdempotencyKey,
    excludedScheduledPostId: Number(exactScheduled?.id ?? 0),
  });
  if (duplicate) {
    return rejectPersist("exact_duplicate_post", {
      slot_key: slotKey,
      duplicate_scheduled_post_id: Number(duplicate.id),
      duplicate_status: duplicate.status ?? null,
    }, slotKey);
  }

  const semanticRepetition = await dependencies.analyzeRepetition({
    brand_key: brandKey,
    text,
    metadata: {
      ...postStrategy,
      family_key: familyKey,
      source_mechanism: sourceMechanism,
      audience_reward: audienceReward,
      strategic_purpose: strategicPurpose,
      expected_audience_reward: hypothesis.expected_audience_reward,
    },
    candidate_slot_utc: scheduledUtc,
    exclude_scheduled_post_id: exactScheduled ? Number(exactScheduled.id) : null,
    recent_hours: 72,
    future_hours: 48,
  });
  if (semanticRepetition.semantic_repetition_blocked === true) {
    return rejectPersist("semantic_repetition_collision", {
      slot_key: slotKey,
      semantic_repetition: semanticRepetition,
      required_action: "Preserve the proven source mechanism while rewriting or respacing the repeated premise, reward, opening, closing, scenario, or sentence architecture.",
    }, slotKey);
  }

  let sourceCard: JsonRecord;
  try {
    sourceCard = await dependencies.ensureSourceCard(cycleId, post);
  } catch (error) {
    return rejectPersist(
      error instanceof Error ? error.message : "canonical_source_card_required",
      { slot_key: slotKey },
      slotKey,
    );
  }
  const sourceCardId = String(sourceCard.id ?? "");
  const familyId = dependencies.normalizeText(sourceCard.family_id, 120, true);
  const sourceSelectionId = dependencies.normalizeText(sourceCard.source_selection_id, 120, true);
  if (!sourceSelectionId || sourceCard.status !== "locked") {
    await dependencies.linkHypothesisResult({
      cycleId,
      slotKey,
      status: "source_lineage_failed",
      hypothesisId: dependencies.normalizeText(postHypothesis.id, 160, true),
    });
    return rejectPersist("autonomous_source_lineage_missing", {
      source_card_id: sourceCardId || null,
      source_selection_id: sourceSelectionId,
      source_card_status: sourceCard.status ?? null,
    }, slotKey);
  }

  const draftAnalysis = {
    opening_phrase: dependencies.extractOpeningPhrase(text),
    hook_style: dependencies.normalizeText(postStrategy.hook_style, 120, true),
    lane_key: dependencies.normalizeMachineKey(postStrategy.pillar, ""),
    preserved_functions: Array.isArray(post.preserved_functions) ? post.preserved_functions.map(String) : [],
    transformed_elements: Array.isArray(post.transformed_elements) ? post.transformed_elements.map(String) : [],
    satisfied_time_or_context_requirements: Array.isArray(post.satisfied_time_or_context_requirements)
      ? post.satisfied_time_or_context_requirements.map(String)
      : Array.isArray(modelEvaluation.satisfied_time_or_context_requirements)
        ? modelEvaluation.satisfied_time_or_context_requirements.map(String)
        : [],
    audience_reward_delivered: true,
  };
  const suppliedGateSummary = record(modelEvaluation.gate_summary);
  const suppliedGateResults = records(suppliedGateSummary.results);
  const canonicalHardBans = await dependencies.listHardBans(brandKey);
  const ownerHardBans = canonicalHardBans.filter(
    (rule) => !String(rule.source_authority ?? "").startsWith("operator_gate:"),
  );
  const missingHardBanResults = ownerHardBans.filter((rule) => {
    const ruleKey = String(rule.rule_key ?? "");
    const result = suppliedGateResults.find(
      (item) => String(item.rule_key ?? item.gate_key ?? "") === ruleKey,
    );
    const status = String(result?.status ?? "").toLowerCase();
    return !result
      || result.executed !== true
      || status !== "pass"
      || !dependencies.normalizeText(result.evidence ?? result.reason, 4000, true);
  });
  if (missingHardBanResults.length) {
    return rejectPersist("canonical_hard_ban_evaluation_incomplete", {
      slot_key: slotKey,
      missing_rule_keys: missingHardBanResults.map((rule) => rule.rule_key),
      required_action: "Evaluate every canonical owner hard-ban rule against the exact candidate and provide explicit pass evidence. A summary statement is insufficient.",
    }, slotKey);
  }

  const serverGateSuite = await dependencies.runGateSuite({
    sourceCardId,
    draftText: text,
    stageScope: "gate_evaluation",
    laneKey: dependencies.normalizeMachineKey(postStrategy.pillar, "") || null,
    contentType: dependencies.normalizeText(postStrategy.format, 120, true),
    draftAnalysis,
    modelGateResults: suppliedGateResults,
  });
  if (!serverGateSuite.gate_results.length) {
    return rejectPersist("required_candidate_gate_execution_empty", { slot_key: slotKey }, slotKey);
  }
  if (!serverGateSuite.showable) {
    return rejectPersist("candidate_gate_suite_failed", {
      slot_key: slotKey,
      blocking_failures: serverGateSuite.blocking_failures,
      warnings: serverGateSuite.warnings,
    }, slotKey);
  }

  const gateResults: JsonRecord[] = [
    {
      gate_key: "locked_cycle_strategy",
      executed: true,
      status: "pass",
      evidence: requestedCycleStrategyId,
    },
    {
      gate_key: "exact_cycle_plan_item",
      executed: true,
      status: "pass",
      evidence: requestedCyclePlanItemId,
    },
    {
      gate_key: "canonical_source_lineage",
      executed: true,
      status: "pass",
      evidence: { source_card_id: sourceCardId, source_selection_id: sourceSelectionId },
    },
    {
      gate_key: "exact_duplicate",
      executed: true,
      status: "pass",
      evidence: "No other scheduled post has identical normalized text.",
    },
    {
      gate_key: "slot_collision",
      executed: true,
      status: "pass",
      evidence: { slot_key: slotKey, open: true },
    },
    {
      gate_key: "semantic_repetition",
      executed: true,
      status: "pass",
      evidence: semanticRepetition,
    },
    ...suppliedGateResults.map((result) => ({ ...result, executed: true })),
    ...serverGateSuite.gate_results.map((result) => ({ ...result, executed: true })),
  ];
  const gateReceipt = await dependencies.recordGateReceipt({
    cycleId,
    strategyId: requestedCycleStrategyId,
    planItemId: requestedCyclePlanItemId,
    brandKey,
    slotKey,
    candidateText: text,
    results: gateResults,
  });
  if (gateReceipt.passed !== true) {
    return rejectPersist("candidate_gate_receipt_failed", {
      slot_key: slotKey,
      gate_receipt_id: gateReceipt.id ?? null,
      results: gateReceipt.results ?? [],
    }, slotKey);
  }

  postHypothesis = await dependencies.recordHypothesis({
    cycleId,
    brandKey,
    slotKey,
    strategyVersionId: requestedCycleStrategyId,
    source: {
      ...sourceContext,
      source_card_id: sourceCardId,
      source_selection_id: sourceSelectionId,
    },
    hypothesis,
    candidateTrace,
    modelEvaluation,
  });

  const identityHash = await dependencies.sha256(`${brandKey}|${cycleId}|${slotKey}|${operationId}`);
  const runId = `autonomous-run-${identityHash.slice(0, 32)}`;
  const draftId = `autonomous-draft-${identityHash.slice(0, 32)}`;
  const lineupId = `autonomous-lineup-${identityHash.slice(0, 32)}`;
  const inventoryId = `autonomous-inventory-${identityHash.slice(0, 32)}`;
  const strategy: JsonRecord = {
    ...postStrategy,
    autonomous_engine_version: dependencies.growthEngineVersion,
    autonomous_cycle_id: cycleId,
    cycle_strategy_id: requestedCycleStrategyId,
    cycle_plan_item_id: requestedCyclePlanItemId,
    generation_mode: generationMode,
    family_key: familyKey,
    source_mechanism: sourceMechanism,
    audience_reward: audienceReward,
    strategic_purpose: strategicPurpose,
    cycle_strategy: effectiveStrategicThesis,
    post_hypothesis: hypothesis,
    source_context: {
      ...sourceContext,
      source_card_id: sourceCardId,
      source_selection_id: sourceSelectionId,
    },
    model_evaluation: modelEvaluation,
    gate_receipt_id: gateReceipt.id ?? null,
  };

  const scheduled = exactScheduled
    ? {
        success: true,
        scheduledPostId: Number(exactScheduled.id),
        scheduledTimeUtc: exactScheduled.scheduled_time,
        reused: true,
      }
    : await dependencies.createScheduledPost({ text, date, time, timezone });
  if (!scheduled.success || !scheduled.scheduledPostId) {
    return rejectPersist("autonomous_schedule_failed_after_gate_pass", {
      slot_key: slotKey,
      detail: scheduled.error ?? null,
      gate_receipt_id: gateReceipt.id ?? null,
    }, slotKey);
  }
  const scheduledPostId = scheduled.scheduledPostId;

  await dependencies.ensurePersistenceSchemas();
  const gateSummary = {
    model_orchestrated: true,
    model_evaluation: modelEvaluation,
    gate_receipt_id: gateReceipt.id ?? null,
    gate_receipt_version: gateReceipt.receipt_version ?? null,
    gate_results: gateResults,
    server_checks: {
      slot_open: true,
      exact_duplicate: false,
      canonical_hard_bans_complete: true,
      source_fidelity_passed: true,
      semantic_repetition_collision: false,
      semantic_repetition_summary: {
        highest_score: semanticRepetition.highest_score ?? 0,
        high_similarity: semanticRepetition.high_similarity ?? null,
        candidate_signature: semanticRepetition.signature ?? null,
      },
      threads_api_call: false,
    },
  };
  const normalizedStrategy = dependencies.normalizeStrategy(strategy);
  const firstLine = text.split(/\n/)[0]?.trim().slice(0, 500) ?? "";
  const openingPhrase = dependencies.extractOpeningPhrase(text);
  const realmEntranceKey = dependencies.inferRealmEntranceKey(openingPhrase);
    await dependencies.persistLineageRecords({
    brandKey,
    accountId,
    threadsUserId,
    operationId,
    cycleId,
    slotKey,
    requestedCycleStrategyId,
    requestedCyclePlanItemId,
    post,
    postHypothesis,
    sourceCard,
    sourceCardId,
    sourceSelectionId,
    familyId,
    date,
    time,
    text,
    generationMode,
    familyKey,
    strategicPurpose,
    sourceMechanism,
    audienceReward,
    effectiveStrategicThesis,
    cycleStrategicThesisReused,
    modelEvaluation,
    strategy,
    normalizedStrategy,
    gateSummary,
    gateReceipt,
    draftAnalysis,
    runId,
    draftId,
    lineupId,
    inventoryId,
    scheduledPostId,
    scheduledTimeUtc: scheduled.scheduledTimeUtc ?? scheduledUtc,
    firstLine,
    openingPhrase,
    realmEntranceKey,
    usedAt: dependencies.now().toISOString(),
  });
  await dependencies.upsertSemanticSignature({
    brand_key: brandKey,
    content_type: "scheduled",
    content_id: String(scheduledPostId),
    text,
    metadata: strategy,
    scheduled_post_id: scheduledPostId,
    observed_at: scheduled.scheduledTimeUtc ?? scheduledUtc,
  });

  const lineageStatus = await dependencies.readLineageStatus({
    cycleId,
    brandKey,
    slotKey,
    scheduledPostId,
    accountId,
    threadsUserId,
  });
  const publishMissingStages: string[] = [];
  if (!lineageStatus?.source_selection_id || !lineageStatus?.source_batch_id) publishMissingStages.push("source");
  if (!lineageStatus?.source_card_id) publishMissingStages.push("source_card");
  if (!lineageStatus?.generation_run_id) publishMissingStages.push("generation_run");
  if (!lineageStatus?.draft_id) publishMissingStages.push("draft");
  const intelligenceMissingStages: string[] = [];
  if (!lineageStatus?.cycle_strategy_id
    || !lineageStatus?.stored_cycle_strategy_id
    || String(lineageStatus.cycle_strategy_id) !== requestedCycleStrategyId) {
    intelligenceMissingStages.push("cycle_strategy");
  }
  if (!lineageStatus?.lineup_source_selection_id) intelligenceMissingStages.push("source_selection");
  if (!lineageStatus?.cycle_plan_item_id
    || !lineageStatus?.stored_plan_item_id
    || String(lineageStatus.plan_status) !== "scheduled") {
    intelligenceMissingStages.push("cycle_plan_item");
  }
  if (!lineageStatus?.gate_receipt_id
    || !lineageStatus?.stored_gate_receipt_id
    || Number(lineageStatus.gate_passed ?? 0) !== 1) {
    intelligenceMissingStages.push("candidate_gate_receipt");
  }
  if (!lineageStatus?.hypothesis_id || !lineageStatus?.stored_hypothesis_id) {
    intelligenceMissingStages.push("hypothesis");
  }
  if (Number(lineageStatus?.hypothesis_scheduled_post_id ?? 0) !== scheduledPostId) {
    intelligenceMissingStages.push("hypothesis_schedule_link");
  }
  if (!lineageStatus?.hypothesis_locked_at || String(lineageStatus?.hypothesis_status) !== "scheduled") {
    intelligenceMissingStages.push("hypothesis_lock");
  }
  if (publishMissingStages.length > 0 || intelligenceMissingStages.length > 0) {
    const missingStages = [...publishMissingStages, ...intelligenceMissingStages];
    await dependencies.linkHypothesisResult({
      cycleId,
      slotKey,
      scheduledPostId,
      status: "lineage_failed",
      hypothesisId: dependencies.normalizeText(postHypothesis.id, 160, true),
      sourceSelectionId,
    });
    await dependencies.appendCycleEvent({
      cycleId,
      brandKey,
      eventKey: `persist:${operationId}`,
      eventType: "lineage_failed",
      slotKey,
      payload: { scheduled_post_id: scheduledPostId, missing_stages: missingStages },
    });
    await dependencies.markLineageFailure({
      scheduledPostId,
      threadsUserId,
      errorMessage: `manifest_lineage_incomplete:${missingStages.join(",")}`,
    });
    return {
      success: false,
      error: "autonomous_lineage_incomplete_after_persist",
      slot_key: slotKey,
      scheduled_post_id: scheduledPostId,
      missing_stages: missingStages,
    };
  }

  const publishLineageRow = lineageStatus ?? {};
  await dependencies.linkHypothesisResult({
    cycleId,
    slotKey,
    scheduledPostId,
    status: "scheduled",
    hypothesisId: dependencies.normalizeText(postHypothesis.id, 160, true),
    sourceSelectionId,
  });
  const experimentAssignment = await dependencies.registerExperimentAssignment({
    brand_key: brandKey,
    cycle_id: cycleId,
    slot_key: slotKey,
    family_key: familyKey,
    hypothesis_id: String(postHypothesis.id ?? ""),
    scheduled_post_id: scheduledPostId,
    experiment: hypothesis.experiment,
  });
  const decisionInfluence = await dependencies.recordDecisionInfluence({
    brand_key: brandKey,
    cycle_id: cycleId,
    slot_key: slotKey,
    scheduled_post_id: scheduledPostId,
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
    semantic_repetition: semanticRepetition,
    experiment_assignment: experimentAssignment,
  });
  await dependencies.appendCycleEvent({
    cycleId,
    brandKey,
    eventKey: `persist:${operationId}`,
    eventType: "post_persisted",
    slotKey,
    payload: {
      scheduled_post_id: scheduledPostId,
      source_card_id: sourceCardId,
      source_selection_id: sourceSelectionId,
      generation_run_id: runId,
      draft_id: draftId,
      hypothesis_id: postHypothesis.id ?? null,
      strategy_version_id: outputStrategyVersion.id ?? null,
      gate_summary: gateSummary,
      semantic_repetition: semanticRepetition,
      experiment_assignment: experimentAssignment,
      decision_influence: decisionInfluence,
      publish_lineage_complete: true,
      intelligence_lineage_complete: true,
    },
  });

  const currentCycle = (await dependencies.readCurrentCycle(brandKey, cycleId)) ?? cycle;
  const authoritativeTargetSlots = Array.isArray(currentCycle.target_slots)
    ? currentCycle.target_slots as Array<{ key: string; date: string; time: string }>
    : [];
  const cycleTimezone = dependencies.normalizeText(currentCycle.timezone, 100, true) ?? timezone;
  const occupiedAfter = await dependencies.occupiedSlots(authoritativeTargetSlots, cycleTimezone);
  const localNow = dependencies.localDateTimeParts(dependencies.now(), cycleTimezone);
  const currentLocalHourKey = `${localNow.date}T${dependencies.hourlySlot(localNow.hour)}`;
  const coverageState = dependencies.reconcileCoverageState(
    authoritativeTargetSlots,
    occupiedAfter,
    currentLocalHourKey,
    Array.isArray(currentCycle.scheduled_post_ids) ? currentCycle.scheduled_post_ids : [],
  );
  const remainingMissing = coverageState.remaining_missing_slots;
  const elapsedUnfilledSlots = coverageState.elapsed_unfilled_slots;
  const scheduledIds = new Set<number>(coverageState.scheduled_post_ids);
  scheduledIds.add(scheduledPostId);
  await dependencies.updateCycleAfterPersist({
    cycleId,
    brandKey,
    status: remainingMissing.length ? "partially_committed" : "coverage_complete",
    strategicThesis: effectiveStrategicThesis,
    remainingMissing,
    scheduledPostIds: Array.from(scheduledIds),
  });
  await dependencies.appendCycleEvent({
    cycleId,
    brandKey,
    eventKey: `coverage:${operationId}`,
    eventType: "coverage_reconciled",
    slotKey,
    payload: {
      persisted_scheduled_post_id: scheduledPostId,
      scheduled_post_ids: Array.from(scheduledIds),
      remaining_missing_slots: remainingMissing,
      remaining_missing_count: remainingMissing.length,
      elapsed_unfilled_slots: elapsedUnfilledSlots,
      elapsed_unfilled_count: elapsedUnfilledSlots.length,
      authoritative_occupied_count: occupiedAfter.size,
    },
  });

  let cycleCompletion: JsonRecord | null = null;
  if (!remainingMissing.length) {
    const completedAt = dependencies.now().toISOString();
    const completion = {
      completed_slot_key: slotKey,
      completion_trigger: "final_post_persisted",
      scheduled_post_ids: Array.from(scheduledIds),
      scheduled_count: scheduledIds.size,
      remaining_missing_count: 0,
      final_post_lineage_complete: true,
      output_strategy_version_id: outputStrategyVersion.id ?? null,
      elapsed_unfilled_slots_ignored: elapsedUnfilledSlots,
      past_slots_backfilled: false,
      authoritative_target_slot_count: authoritativeTargetSlots.length,
      authoritative_occupied_slot_count: occupiedAfter.size,
      completed_at: completedAt,
    };
    cycleCompletion = await dependencies.finalizeCycleReceipt({
      cycleId,
      status: "completed",
      completion,
      unresolvedIssues: [],
      completedAt,
    });
    if (cycleCompletion.completed === true) {
      await dependencies.appendCycleEvent({
        cycleId,
        brandKey,
        eventKey: "cycle-completed",
        eventType: "cycle_completed",
        payload: cycleCompletion,
      });
      await dependencies.setCycleStatus(cycleId, brandKey, "completed");
    } else {
      await dependencies.appendCycleEvent({
        cycleId,
        brandKey,
        eventKey: "cycle-completion-blocked",
        eventType: "cycle_completion_blocked",
        payload: cycleCompletion,
      });
      await dependencies.setCycleStatus(cycleId, brandKey, "completion_blocked");
    }
  }

  return {
    success: true,
    reused: scheduled.reused === true,
    slot_key: slotKey,
    scheduled_post_id: scheduledPostId,
    scheduled_time_utc: scheduled.scheduledTimeUtc ?? scheduledUtc,
    lineage: {
      source_batch_id: publishLineageRow.source_batch_id ?? null,
      source_selection_id: publishLineageRow.source_selection_id ?? sourceSelectionId,
      source_card_id: sourceCardId,
      source_card_family_id: familyId,
      generation_run_id: runId,
      draft_id: draftId,
      inventory_id: inventoryId,
      hypothesis_id: postHypothesis.id ?? null,
      strategy_version_id: outputStrategyVersion.id ?? null,
    },
    publish_lineage_complete: true,
    intelligence_lineage_complete: true,
    hypothesis_id: postHypothesis.id ?? null,
    strategy_version_id: outputStrategyVersion.id ?? null,
    experiment_assignment: experimentAssignment,
    semantic_repetition: semanticRepetition,
    decision_influence: decisionInfluence,
    model_evaluation: {
      novelty_assessment: noveltyAssessment,
      winner_preservation_assessment: winnerPreservationAssessment,
      slot_placement_assessment: slotPlacementAssessment,
      recent_exposure_assessment: recentExposureAssessment,
      intelligence_application_assessment: intelligenceApplicationAssessment,
    },
    server_checks: record(gateSummary.server_checks),
    remaining_missing_count: remainingMissing.length,
    cycle_completion: cycleCompletion,
    coverage_reconciliation_required: true,
    reconciliation_tool: "get_hourly_coverage",
    next_action: "After four successfully persisted posts, call get_hourly_coverage once. Do not call prepare_manifest_autonomous_cycle again inside the same run.",
  };
}
