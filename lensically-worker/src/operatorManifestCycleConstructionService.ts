type JsonRecord = Record<string, unknown>;

export type OperatorManifestConstructionSlot = {
  key: string;
  date: string;
  time: string;
};

export type OperatorManifestConstructionCoverage = {
  occupied: ReadonlyMap<string, JsonRecord>;
  scheduled_records: JsonRecord[];
};

export type OperatorManifestDeliveryReconciliation = {
  unresolved_incidents: JsonRecord[];
  required_recovery_actions: JsonRecord[];
  [key: string]: unknown;
};

export interface OperatorManifestCycleConstructionDependencies {
  growthEngineVersion: string;
  sourceSelectionEngineVersion: string;
  savedPatternsAppUserId: string;
  sourceMinimumVerifiedLikes: number;
  humanFreeAutonomyContract: unknown;
  followerAttributionPolicy: unknown;
  noninterferencePolicy: unknown;
  analysisWindowDays: number;
  recentExposureHours: number;
      normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  refreshTrustedUtcClock(): Promise<string | null>;
  readDatabaseClock(): Promise<string | null>;
  resolveClock(
    runtimeNowIso: string,
    threadsServerTimeIso: unknown,
    databaseTimeIso: string | null,
    latestPublishedAt: unknown,
    trustedUtcTimeIso: string | null,
  ): JsonRecord;
  parseTimestampMs(value: unknown): number | null;
  nowMs(): number;
  localDateTimeParts(date: Date, timezone: string): { date: string; hour: number };
  hourlySlot(hour: number): string;
  buildTargetSlots(date: string, hour: number, horizonHours: number): OperatorManifestConstructionSlot[];
  buildCoverage(
    targetSlots: OperatorManifestConstructionSlot[],
    timezone: string,
    effectiveNowMs: number,
  ): Promise<OperatorManifestConstructionCoverage>;
    reconcileDelivery(
    timezone: string,
    effectiveNowMs: number,
  ): Promise<OperatorManifestDeliveryReconciliation>;
  ensureRequiredSchemas(): Promise<unknown>;
  readSavedPatternStates(accountId: string, brandKey: string): Promise<{
    qualified: JsonRecord | null;
    derived: JsonRecord | null;
  }>;
  refreshSavedPatternIntelligence(input: JsonRecord): Promise<unknown>;
    buildDecisionIntelligence(brandKey: string): Promise<JsonRecord>;
  compactPersistedValue(value: unknown, path: string): JsonRecord;
  buildAccountPosition(input: {
    targetSlots: OperatorManifestConstructionSlot[];
    coverage: OperatorManifestConstructionCoverage;
    clock: JsonRecord;
    threadsSnapshot: JsonRecord;
        deliveryReconciliation: OperatorManifestDeliveryReconciliation;
  }): Promise<JsonRecord>;
  readExistingCycle(operationId: string, brandKey: string): Promise<{ id: string } | null>;
  createId(): string;
  writeCycle(input: {
    existing: boolean;
    cycleId: string;
    brandKey: string;
    operationId: string;
    engineVersion: string;
    status: string;
    timezone: string;
    horizonHours: number;
    horizonStartLocal: string;
    horizonEndLocal: string;
    targetSlots: OperatorManifestConstructionSlot[];
    missingSlots: OperatorManifestConstructionSlot[];
    accountPosition: JsonRecord;
  }): Promise<unknown>;
  readLockedSourceSelectionPlan(brandKey: string, cycleId: string): Promise<JsonRecord[]>;
  loadLockedSourceCards(brandKey: string, asOf: string): Promise<JsonRecord[]>;
  loadSourceExclusions(brandKey: string): Promise<string[]>;
  selectSourceLineup(input: {
    candidates: JsonRecord[];
    slot_keys: string[];
    seed: string;
  }): { receipts: unknown[] };
  persistLockedSourceSelectionPlan(input: JsonRecord): Promise<JsonRecord[]>;
  buildRollingEvidence(input: JsonRecord): Promise<JsonRecord>;
  attachEvidenceSnapshot(cycleId: string, brandKey: string, evidenceSnapshotId: unknown): Promise<unknown>;
  ensureIntelligencePolicy(brandKey: string): Promise<unknown>;
  getLatestStrategyVersion(brandKey: string): Promise<JsonRecord | null>;
  createExposureSnapshot(input: JsonRecord): Promise<JsonRecord>;
  beginCycleReceipt(input: JsonRecord): Promise<JsonRecord>;
  appendCycleEvent(input: JsonRecord): Promise<unknown>;
  clearPrepareCheckpoint(brandKey: string, operationId: string): Promise<unknown>;
  readPreparedCycle(brandKey: string, cycleId: string): Promise<JsonRecord | null>;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function compactLockedSourceSelectionPlanForReceipt(plan: JsonRecord[]): JsonRecord[] {
  return plan.map((row) => {
    const receipt = record(row.receipt);
    return {
      slot_key: row.slot_key ?? receipt.slot_key ?? null,
      selection_order: Number(row.selection_order ?? 0),
      source_identity_key: row.source_identity_key ?? receipt.source_identity_key ?? null,
      source_card_family_id: row.source_card_family_id ?? receipt.source_card_family_id ?? null,
      source_card_id: row.source_card_id ?? receipt.source_card_id ?? null,
      engine_version: row.engine_version ?? null,
      status: row.status ?? null,
      selection_evidence: {
        policy_version: receipt.policy_version ?? null,
        lifetime_label: receipt.lifetime_label ?? null,
        recent_label: receipt.recent_label ?? null,
        lifetime_sample_size: Number(receipt.lifetime_sample_size ?? 0),
        lifetime_index: Number(receipt.lifetime_index ?? 0),
        shrunk_performance: Number(receipt.shrunk_performance ?? 0),
        exploration_bonus: Number(receipt.exploration_bonus ?? 0),
        uses_24h: Number(receipt.uses_24h ?? 0),
        uses_7d: Number(receipt.uses_7d ?? 0),
        uses_28d: Number(receipt.uses_28d ?? 0),
        planned_uses: Number(receipt.planned_uses ?? 0),
        exposure_burden: Number(receipt.exposure_burden ?? 0),
        cooldown_hours: Number(receipt.cooldown_hours ?? 0),
        score: Number(receipt.score ?? 0),
      },
    };
  });
}

function compactOperatorManifestThreadsSnapshot(snapshot: JsonRecord): JsonRecord {
  const evaluation = record(snapshot.performance_evaluation);
  const metricSnapshots = Array.isArray(snapshot.metric_snapshots)
    ? asRecords(snapshot.metric_snapshots).slice(0, 12)
    : record(snapshot.metric_snapshots);
  return {
    refreshed: snapshot.refreshed === true,
    complete: snapshot.complete === true,
    threads_server_time_iso: snapshot.threads_server_time_iso ?? null,
    latest_published_at: snapshot.latest_published_at ?? null,
    published_count: Number(snapshot.published_count ?? 0),
    list_metrics_available: snapshot.list_metrics_available === true,
    list_metrics_complete: snapshot.list_metrics_complete === true,
    due_checkpoint_post_count: Number(snapshot.due_checkpoint_post_count ?? 0),
    due_checkpoint_count: Number(snapshot.due_checkpoint_count ?? 0),
    processed_due_checkpoint_count: Number(snapshot.processed_due_checkpoint_count ?? 0),
    remaining_due_checkpoint_count: Number(snapshot.remaining_due_checkpoint_count ?? 0),
    continuation_required: snapshot.continuation_required === true,
    max_insight_calls_per_invocation: Number(snapshot.max_insight_calls_per_invocation ?? 0),
    metric_snapshots: metricSnapshots,
    performance_evaluation: {
      evaluator_version: evaluation.evaluator_version ?? null,
      maturity_scores_upserted: Number(evaluation.maturity_scores_upserted ?? 0),
      evidence_records: Number(evaluation.evidence_records ?? 0),
      manifest_layers_deferred: evaluation.manifest_layers_deferred === true,
    },
    error: snapshot.error ?? null,
  };
}

function databaseTimeIso(raw: string | null): string | null {
  return raw ? `${raw.replace(" ", "T").replace(/Z$/, "")}Z` : null;
}

export async function constructOperatorManifestAutonomousCycle(
  input: {
    brandKey: string;
    accountId: string;
    threadsUserId: string;
    timezone: string;
    horizonHours: number;
    explicitOperationId: string | null;
    phasedPreparation: boolean;
    runtimeNowIso: string;
    threadsSnapshot: JsonRecord;
  },
  dependencies: OperatorManifestCycleConstructionDependencies,
): Promise<JsonRecord> {
  const {
    brandKey,
    accountId,
    timezone,
    horizonHours,
    explicitOperationId,
    phasedPreparation,
    runtimeNowIso,
            threadsSnapshot,
  } = input;
  const boundedThreadsSnapshot = compactOperatorManifestThreadsSnapshot(threadsSnapshot);

  const [trustedUtcTimeIso, databaseClockRaw] = await Promise.all([
    dependencies.refreshTrustedUtcClock(),
    dependencies.readDatabaseClock(),
  ]);
    const clock = dependencies.resolveClock(
    runtimeNowIso,
    boundedThreadsSnapshot.threads_server_time_iso,
    databaseTimeIso(databaseClockRaw),
    boundedThreadsSnapshot.latest_published_at,
    trustedUtcTimeIso,
  );
  const effectiveNowMs = dependencies.parseTimestampMs(clock.effective_now_iso) ?? dependencies.nowMs();
  const local = dependencies.localDateTimeParts(new Date(effectiveNowMs), timezone);
  const operationId = explicitOperationId
    ?? `${brandKey}:autonomous-runway:${local.date}:${String(local.hour).padStart(2, "0")}`;
  const targetSlots = dependencies.buildTargetSlots(local.date, local.hour, horizonHours);
  const coverage = await dependencies.buildCoverage(targetSlots, timezone, effectiveNowMs);
  const missingSlots = targetSlots.filter((slot) => !coverage.occupied.has(slot.key));
  const deliveryReconciliation = await dependencies.reconcileDelivery(timezone, effectiveNowMs);
  await dependencies.ensureRequiredSchemas();

  const performanceEvaluation = record(boundedThreadsSnapshot.performance_evaluation);
  const intelligenceEngineRefresh = {
    mode: "autonomous_prepare_live_refresh",
    recomputed: true,
    refresh_owner: "autonomous_prepare",
    due_checkpoint_post_count: boundedThreadsSnapshot.due_checkpoint_post_count,
    due_checkpoint_count: boundedThreadsSnapshot.due_checkpoint_count,
    processed_due_checkpoint_count: boundedThreadsSnapshot.processed_due_checkpoint_count,
    remaining_due_checkpoint_count: boundedThreadsSnapshot.remaining_due_checkpoint_count,
    list_metrics_complete: boundedThreadsSnapshot.list_metrics_complete,
    max_insight_calls_per_invocation: boundedThreadsSnapshot.max_insight_calls_per_invocation,
    metric_snapshots: boundedThreadsSnapshot.metric_snapshots,
    evaluator_version: performanceEvaluation.evaluator_version ?? null,
    maturity_scores_upserted: Number(performanceEvaluation.maturity_scores_upserted ?? 0),
    evidence_records: Number(performanceEvaluation.evidence_records ?? 0),
    reason: "Autonomous preparation refreshed bounded live Threads evidence, persisted every currently due maturity checkpoint, and recomputed evaluator intelligence before strategy consumption.",
  };

  const patternStates = await dependencies.readSavedPatternStates(accountId, brandKey);
  const qualifiedPatternCount = Number(patternStates.qualified?.total ?? 0);
  const derivedPatternCount = Number(patternStates.derived?.total ?? 0);
  const qualifiedPatternUpdatedAt = dependencies.normalizeText(
    patternStates.qualified?.latest_updated_at,
    100,
    true,
  );
  const derivedPatternUpdatedAt = dependencies.normalizeText(
    patternStates.derived?.latest_source_updated_at,
    100,
    true,
  );
  const savedPatternRefreshRequired = qualifiedPatternCount > 0 && (
    derivedPatternCount !== qualifiedPatternCount
    || !derivedPatternUpdatedAt
    || Boolean(qualifiedPatternUpdatedAt && derivedPatternUpdatedAt < qualifiedPatternUpdatedAt)
  );
  const savedPatternIntelligenceRefresh = savedPatternRefreshRequired
    ? await dependencies.refreshSavedPatternIntelligence({
        brand_key: brandKey,
        account_id: accountId,
        app_user_id: dependencies.savedPatternsAppUserId,
      })
    : {
        qualified_pattern_count: qualifiedPatternCount,
        derived_pattern_count: derivedPatternCount,
        recomputed: false,
        current: true,
      };
  const measurementAuditRefresh = {
    mode: savedPatternRefreshRequired
      ? "saved_pattern_intelligence_refreshed"
      : "latest_persisted_measurement_state",
    recomputed: savedPatternRefreshRequired,
    refresh_owner: savedPatternRefreshRequired
      ? "autonomous_prepare_source_grounding"
      : "performance_evaluator_and_insights_cycle",
    saved_pattern_intelligence: savedPatternIntelligenceRefresh,
    reason: savedPatternRefreshRequired
      ? "Autonomous preparation repaired empty or stale Saved Pattern intelligence before generation so the source library cannot silently disappear."
      : "Autonomous preparation consumed current durable learning, benchmark, Saved Pattern, and follower records without recomputing the full measurement layer.",
  };

  const decisionIntelligence = await dependencies.buildDecisionIntelligence(brandKey);
  const latestStrategy = record(decisionIntelligence.latest_strategy);
  const learningBrief = record(decisionIntelligence.learning_brief);
  const benchmarkResponse = record(decisionIntelligence.benchmark_response);
  const benchmarkLatest = record(benchmarkResponse.latest);
  const decisionIntelligenceReceiptReference = {
    version: decisionIntelligence.version ?? null,
    source_fingerprint: decisionIntelligence.source_fingerprint ?? null,
    latest_strategy_version_id: latestStrategy.id ?? null,
    learning_brief_key: learningBrief.brief_key ?? null,
    benchmark_snapshot_key: benchmarkLatest.snapshot_key ?? null,
    required_directives: Array.isArray(decisionIntelligence.required_directives)
      ? decisionIntelligence.required_directives
      : [],
    strategy_change_warranted: decisionIntelligence.strategy_change_warranted === true,
    consumption_contract: decisionIntelligence.consumption_contract ?? {},
  };
        const accountPosition = await dependencies.buildAccountPosition({
    targetSlots,
    coverage,
    clock,
    threadsSnapshot: boundedThreadsSnapshot,
    deliveryReconciliation,
  });
  const persistedAccountPosition = dependencies.compactPersistedValue(
    accountPosition,
    "manifest_cycle.account_position",
  );

  const existing = await dependencies.readExistingCycle(operationId, brandKey);
  const cycleId = existing?.id ?? dependencies.createId();
  const cycleStatus = missingSlots.length > 0 ? "prepared" : "completed";
  const defaultHorizonKey = `${local.date}T${dependencies.hourlySlot(local.hour + 1)}`;
  await dependencies.writeCycle({
    existing: Boolean(existing?.id),
    cycleId,
    brandKey,
    operationId,
    engineVersion: dependencies.growthEngineVersion,
    status: cycleStatus,
    timezone,
    horizonHours,
    horizonStartLocal: targetSlots[0]?.key ?? defaultHorizonKey,
    horizonEndLocal: targetSlots[targetSlots.length - 1]?.key ?? defaultHorizonKey,
        targetSlots,
    missingSlots,
    accountPosition: persistedAccountPosition,
  });

  let lockedSourceSelectionPlan = await dependencies.readLockedSourceSelectionPlan(brandKey, cycleId);
  let sourceSelectionPlanStatus = missingSlots.length === 0
    ? "not_required"
    : lockedSourceSelectionPlan.length > 0
      ? "locked"
      : "pending";
  if (missingSlots.length > 0 && lockedSourceSelectionPlan.length === 0) {
    const [lockedSourceCards, sourceExclusions] = await Promise.all([
      dependencies.loadLockedSourceCards(brandKey, String(clock.effective_now_iso ?? "")),
      dependencies.loadSourceExclusions(brandKey),
    ]);
    const excludedIdentities = new Set(sourceExclusions.map(String));
    const selectionCandidates = lockedSourceCards
      .filter((candidate) => !excludedIdentities.has(String(candidate.source_identity_key ?? "")))
      .filter((candidate) => candidate.lifetime_label !== "disproven");
    if (selectionCandidates.length > 0) {
      const backendSelection = dependencies.selectSourceLineup({
        candidates: selectionCandidates,
        slot_keys: missingSlots.map((slot) => slot.key),
        seed: `${brandKey}:${cycleId}:${operationId}`,
      });
      lockedSourceSelectionPlan = await dependencies.persistLockedSourceSelectionPlan({
        brand_key: brandKey,
        cycle_id: cycleId,
        receipts: backendSelection.receipts,
      });
      sourceSelectionPlanStatus = "locked";
    } else {
      sourceSelectionPlanStatus = "pending_locked_source_card_inventory";
    }
  }

  const rollingEvidence = await dependencies.buildRollingEvidence({
    cycle_id: cycleId,
    as_of: clock.effective_now_iso,
    effective_now_ms: effectiveNowMs,
    timezone,
    future_schedule: coverage.scheduled_records.map((recordItem) => ({ ...recordItem })),
  });
  const evidenceSnapshot = record(rollingEvidence.snapshot);
  await dependencies.attachEvidenceSnapshot(cycleId, brandKey, evidenceSnapshot.id ?? null);

  const intelligencePolicy = await dependencies.ensureIntelligencePolicy(brandKey);
  const inputStrategyVersion = (await dependencies.getLatestStrategyVersion(brandKey)) ?? {
    id: null,
    strategy: null,
    status: "legacy_strategy_unavailable",
  };
  const recentEvidence = record(evidenceSnapshot.recent_exposure);
  const publishedExposure = asRecords(recentEvidence.posts);
  const scheduledExposure = coverage.scheduled_records.map((recordItem) => ({ ...recordItem }));
  const exposureSnapshot = await dependencies.createExposureSnapshot({
    cycleId,
    brandKey,
    asOf: clock.effective_now_iso,
    timezone,
    horizonStartLocal: targetSlots[0]?.key ?? null,
    horizonEndLocal: targetSlots[targetSlots.length - 1]?.key ?? null,
    published: publishedExposure,
    scheduled: scheduledExposure,
  });
    const rollingMaturityRefresh = record(rollingEvidence.maturity_refresh);
  const persistedHorizonPlan = dependencies.compactPersistedValue({
    target_slots: targetSlots,
    authoritative_missing_slots: missingSlots,
    occupied_slots: targetSlots
      .filter((slot) => coverage.occupied.has(slot.key))
      .map((slot) => ({ ...slot, evidence: coverage.occupied.get(slot.key) })),
    full_horizon_lineup_required_before_first_persist: true,
    backend_source_selection_locked: lockedSourceSelectionPlan.length > 0,
    source_selection_plan_status: sourceSelectionPlanStatus,
    source_selection_engine_version: dependencies.sourceSelectionEngineVersion,
    locked_source_selection_plan: compactLockedSourceSelectionPlanForReceipt(lockedSourceSelectionPlan),
  }, "manifest_cycle.horizon_plan");
  const cycleReceipt = await dependencies.beginCycleReceipt({
    cycleId,
    brandKey,
    operationId,
    trigger: {
      operation_id: operationId,
      requested_horizon_hours: horizonHours,
      timezone,
      clock,
      invocation_mode: "model_orchestrated_autonomous_cycle",
    },
    startupState: {
            account_position: persistedAccountPosition,
      occupancy_sources: [
        "live Threads posts",
        "threads_posts_archive",
        "scheduled_posts all statuses",
      ],
      data_consulted: [
        "complete rolling 28-day post evidence",
        "24-hour likes-first maturity records",
        "72-hour recent audience exposure",
        "future 48-hour scheduled exposure",
        "canonical hard bans",
        "active and newly mature experiments",
        "Saved Pattern and source-card lineage",
        "account-level follower checkpoint",
        "operational gates",
      ],
      maturity_refresh: {
        ...rollingMaturityRefresh,
        collection_source: "autonomous_prepare",
                due_checkpoint_post_count: boundedThreadsSnapshot.due_checkpoint_post_count,
        due_checkpoint_count: boundedThreadsSnapshot.due_checkpoint_count,
        metric_snapshots: boundedThreadsSnapshot.metric_snapshots,
        evaluator_version: performanceEvaluation.evaluator_version ?? null,
        maturity_scores_upserted: Number(performanceEvaluation.maturity_scores_upserted ?? 0),
      },
      intelligence_policy: intelligencePolicy,
      evidence_snapshot_id: evidenceSnapshot.id ?? null,
      evidence_page_count: evidenceSnapshot.page_count ?? 0,
      legacy_decision_intelligence_supporting_only: decisionIntelligenceReceiptReference,
    },
    inputStrategyVersionId: dependencies.normalizeText(inputStrategyVersion.id, 160, true),
    exposureSnapshotId: dependencies.normalizeText(exposureSnapshot.id, 160, true),
        horizonPlan: persistedHorizonPlan,
    startedAt: clock.effective_now_iso,
  });
  await dependencies.appendCycleEvent({
    cycleId,
    brandKey,
    eventKey: `cycle-prepared:${exposureSnapshot.revision ?? 1}:${runtimeNowIso}`,
    eventType: "cycle_prepared",
    payload: {
      operation_id: operationId,
      target_slot_count: targetSlots.length,
      missing_slot_count: missingSlots.length,
      input_strategy_version_id: inputStrategyVersion.id ?? null,
      exposure_snapshot_id: exposureSnapshot.id ?? null,
      exposure_revision: exposureSnapshot.revision ?? 1,
      exposure_refreshed: exposureSnapshot.refreshed === true,
      receipt_id: cycleReceipt.id ?? null,
      effective_now_iso: clock.effective_now_iso,
    },
  });
  if (phasedPreparation && explicitOperationId) {
    await dependencies.clearPrepareCheckpoint(brandKey, explicitOperationId);
  }
  const preparedCycle = await dependencies.readPreparedCycle(brandKey, cycleId);

  const strategyRequired = missingSlots.length > 0 && lockedSourceSelectionPlan.length > 0;
  const nextAction = strategyRequired
    ? `Read every remaining analysis page for cycle ${cycleId}, then call commit_manifest_cycle_strategy with the exact locked backend source plan covering all ${missingSlots.length} authoritative missing slots. The model may decide execution wording and placement rationale but may not substitute sources.`
    : missingSlots.length > 0
      ? "Create or repair the locked source-card inventory, then call prepare_manifest_autonomous_cycle again with the same operation_id so the backend can lock the source plan."
      : "The prepared horizon is covered. Verify the canonical completion receipt, complete lineage, scheduler health, and unresolved delivery incidents before ending.";

  if (existing?.id) {
    const compactCycle = preparedCycle
      ? {
          id: preparedCycle.id,
          brand_key: preparedCycle.brand_key,
          operation_id: preparedCycle.operation_id,
          engine_version: preparedCycle.engine_version,
          status: preparedCycle.status,
          timezone: preparedCycle.timezone,
          horizon_hours: preparedCycle.horizon_hours,
          horizon_start_local: preparedCycle.horizon_start_local,
          horizon_end_local: preparedCycle.horizon_end_local,
          target_slots: preparedCycle.target_slots,
          missing_slots: preparedCycle.missing_slots,
          scheduled_post_ids: preparedCycle.scheduled_post_ids,
          error: preparedCycle.error,
          updated_at: preparedCycle.updated_at,
        }
      : null;
    return {
      success: true,
      reused_existing: true,
      refreshed_live_state: true,
      cycle: compactCycle,
      intelligence_engine_refresh: intelligenceEngineRefresh,
      measurement_audit_refresh: measurementAuditRefresh,
      decision_intelligence: decisionIntelligenceReceiptReference,
      rolling_evidence: rollingEvidence,
      strategy_required: strategyRequired,
      source_backed_generation_only: true,
      source_selection_plan_status: sourceSelectionPlanStatus,
      locked_source_selection_plan: lockedSourceSelectionPlan,
      model_source_substitution_allowed: false,
      human_free_autonomy: dependencies.humanFreeAutonomyContract,
      remaining_missing_count: missingSlots.length,
      next_missing_slot: missingSlots[0] ?? null,
      next_action: nextAction,
      reconciliation_contract: {
        authoritative_clock_source: clock.source,
        effective_now_iso: clock.effective_now_iso,
        past_slots_ignored: true,
        occupancy_sources: [
          "live Threads posts",
          "threads_posts_archive",
          "scheduled_posts all statuses",
        ],
        stale_operation_refresh: true,
        coverage_reconciled: true,
      },
    };
  }

  return {
    success: true,
    reused_existing: false,
    refreshed_live_state: true,
    cycle: preparedCycle,
    intelligence_engine_refresh: intelligenceEngineRefresh,
    measurement_audit_refresh: measurementAuditRefresh,
    decision_intelligence: decisionIntelligence,
    rolling_evidence: rollingEvidence,
    strategy_required: strategyRequired,
    source_backed_generation_only: true,
    source_selection_plan_status: sourceSelectionPlanStatus,
    locked_source_selection_plan: lockedSourceSelectionPlan,
    model_source_substitution_allowed: false,
    human_free_autonomy: dependencies.humanFreeAutonomyContract,
    remaining_missing_count: missingSlots.length,
    next_missing_slot: missingSlots[0] ?? null,
    next_action: nextAction,
    intelligence_foundation: {
      policy: intelligencePolicy,
      legacy_input_strategy_reference: inputStrategyVersion,
      exposure_snapshot: {
        id: exposureSnapshot.id ?? null,
        ledger_version: exposureSnapshot.ledger_version ?? null,
        dimensions: exposureSnapshot.dimensions ?? {},
      },
      cycle_receipt: {
        id: cycleReceipt.id ?? null,
        receipt_version: cycleReceipt.receipt_version ?? null,
        status: cycleReceipt.status ?? null,
      },
      follower_attribution_policy: dependencies.followerAttributionPolicy,
      noninterference_policy: dependencies.noninterferencePolicy,
    },
    strategy_contract: {
      objective: "Inspect the complete rolling 28-day evidence, form one fresh account-wide conclusion, and lock one source-backed strategy and full authoritative missing-slot lineup before generating the first candidate.",
      analysis_window_days: dependencies.analysisWindowDays,
      primary_performance_metric: "24_hour_likes",
      recent_exposure_window_hours: dependencies.recentExposureHours,
      one_strategy_per_cycle: true,
      source_backed_generation_only: true,
      original_model_posts_forbidden: true,
      every_analysis_page_required: true,
      fixed_percentages: false,
      winner_preservation: "Continue using winners while comparable performance remains strong, while spacing them when recent published or scheduled exposure is dense.",
      repetition_distinction: "Mechanism repetition can be productive; clustered execution sameness must be rejected, rewritten, or moved to a later slot.",
      full_horizon_sequence_required: true,
      slot_placement_reasoning_required: true,
      recent_published_posts_required: true,
      future_schedule_required: true,
      delivery_incident_awareness_required: true,
      family_roles: ["franchise", "core", "emerging", "prospect", "cooling", "dormant"],
      generation_modes: [
        "franchise_deployment",
        "controlled_variation",
        "mechanism_expansion",
        "adjacent_experiment",
      ],
      source_kinds: ["saved_pattern", "source_card"],
      strategy_change_rule: "Change strategy when authoritative learning, benchmark movement, portfolio evidence, experiment results, audience response, account position, recent exposure, or opportunity changes—not merely because another day began.",
      sequencing_rule: "A franchise may stay in the portfolio and still move later in the day. The earliest slot is reserved for the strongest contextually appropriate move after exposure and novelty review.",
      scheduled_task_consumption_rule: "Before generating or placing any post, consume every field in decision_intelligence. Persist an intelligence_application_assessment explaining which learned directive changed the move or why evidence required preserving the current strategy.",
      decision_influence_receipt_required: true,
    },
    reconciliation_contract: {
      authoritative_clock_source: clock.source,
      effective_now_iso: clock.effective_now_iso,
      past_slots_ignored: true,
      occupancy_sources: [
        "live Threads posts",
        "threads_posts_archive",
        "scheduled_posts all statuses",
      ],
      delivery_states_included: [
        "scheduled",
        "publishing",
        "published",
        "failed",
        "retry_required",
        "not_attempted",
        "publishing_stalled",
      ],
      stale_operation_refresh: true,
      after_four_posts_tool: "get_hourly_coverage",
      collision_behavior: "Treat an occupied slot as nonfatal, preserve it, refresh coverage, move the candidate to the next authoritative missing slot with a new slot operation id, and continue.",
    },
    persistence_contract: {
      tool: "persist_manifest_autonomous_post",
      posts_per_call: 1,
      model_orchestrated: true,
      preserve_existing_schedule: true,
      exact_missing_slots_only: true,
      required_post_fields: [
        "date",
        "time",
        "text",
        "generation_mode",
        "family_key",
        "source_mechanism",
        "audience_reward",
        "strategic_purpose",
      ],
      required_model_evaluation_fields: [
        "generation_passed",
        "scheduling_passed",
        "novelty_assessment",
        "winner_preservation_assessment",
        "slot_placement_assessment",
        "recent_exposure_assessment",
        "intelligence_application_assessment",
      ],
      server_enforcement: [
        "slot_open",
        "exact_duplicate",
        "explicit_banned_phrase",
        "idempotency",
        "lineage_persistence",
      ],
      internal_gate_fanout: false,
      internal_runway_scan: false,
      threads_api_during_persistence: false,
      complete_lineage_required: true,
    },
  };
}
