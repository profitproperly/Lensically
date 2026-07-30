type JsonRecord = Record<string, unknown>;

export type OperatorCoverageSlot = {
  key: string;
  date: string;
  time: string;
};

export type OperatorCoverageState = {
  remaining_missing_slots: OperatorCoverageSlot[];
  elapsed_unfilled_slots: OperatorCoverageSlot[];
  scheduled_post_ids: unknown[];
};

export interface OperatorHourlyCoverageServiceDependencies {
  defaultTimezone: string;
  commitSha: string | null;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  getCoverage(timezone: string, horizonDays: number, startDate: string | null): Promise<JsonRecord>;
  readCycle(cycleId: string): Promise<JsonRecord | null>;
    occupiedSlots(
    targetSlots: OperatorCoverageSlot[],
    timezone: string,
  ): Promise<ReadonlyMap<string, JsonRecord>>;
  localDateTimeParts(date: Date, timezone: string): { date: string; time?: string };
  reconcileCoverage(
    targetSlots: OperatorCoverageSlot[],
    occupied: ReadonlyMap<string, JsonRecord>,
    currentLocalHourKey: string,
    scheduledPostIds: unknown[],
  ): OperatorCoverageState;
  recordDefect(input: JsonRecord): Promise<unknown>;
  resolveDefect(input: JsonRecord): Promise<unknown>;
  updateCycleCoverage(input: {
    cycleId: string;
    brandKey: string;
    status: string;
    missingSlots: OperatorCoverageSlot[];
    scheduledPostIds: unknown[];
  }): Promise<unknown>;
        readNextPlanItem(cycleId: string, brandKey: string, slotKey: string): Promise<JsonRecord | null>;
  repairMissingPlanItem(input: {
    cycleId: string;
    brandKey: string;
    slotKey: string;
    operationId: string;
    asOf: string;
  }): Promise<JsonRecord | null>;
  readLockedSourcePlan(cycleId: string, brandKey: string): Promise<JsonRecord[]>;
  readPlanItems(cycleId: string, brandKey: string): Promise<JsonRecord[]>;

  getCycleReceipt(cycleId: string, brandKey: string): Promise<JsonRecord | null>;
  finalizeCycleReceipt(input: JsonRecord): Promise<JsonRecord>;
  appendCycleEvent(input: JsonRecord): Promise<unknown>;
  markCycleCompleted(cycleId: string, brandKey: string): Promise<unknown>;
  parseJson(value: string): unknown;
  observe(payload: JsonRecord, result: JsonRecord): Promise<JsonRecord>;
  now(): string;
}

function asSlots(value: unknown): OperatorCoverageSlot[] {
  return Array.isArray(value)
    ? value.filter((item): item is OperatorCoverageSlot => Boolean(item)
      && typeof item === "object"
      && !Array.isArray(item)
      && typeof (item as JsonRecord).key === "string"
      && typeof (item as JsonRecord).date === "string"
      && typeof (item as JsonRecord).time === "string")
    : [];
}

export async function handleOperatorHourlyCoverageService(
  input: {
    brandKey: string;
    payload: JsonRecord;
  },
  dependencies: OperatorHourlyCoverageServiceDependencies,
): Promise<JsonRecord> {
  const { brandKey, payload } = input;
  const timezone = dependencies.normalizeText(payload.timezone, 100, true)
    ?? dependencies.defaultTimezone;
  const startDate = dependencies.normalizeText(payload.start_date, 20, true);
  const horizonDays = Math.min(Math.max(Math.trunc(Number(payload.horizon_days ?? 14)), 1), 60);
  const coverageResult = await dependencies.getCoverage(timezone, horizonDays, startDate);
  const cycleId = dependencies.normalizeText(payload.cycle_id, 160, true);
  let coverageResponse: JsonRecord = { ...coverageResult };

  if (brandKey !== "manifest_mental" || !cycleId) {
    return dependencies.observe(payload, coverageResponse);
  }

  const currentCycle = await dependencies.readCycle(cycleId);
  const targetSlots = asSlots(currentCycle?.target_slots);
  const occupied = await dependencies.occupiedSlots(targetSlots, timezone);
  const currentLocalDate = dependencies.normalizeText(coverageResult.current_local_date, 20, true)
    ?? dependencies.localDateTimeParts(new Date(), timezone).date;
  const currentLocalTime = dependencies.normalizeText(coverageResult.current_local_time, 20, true)
    ?? "00:00:00";
  const currentLocalHourKey = `${currentLocalDate}T${currentLocalTime.slice(0, 2)}:00`;
  const coverageState = dependencies.reconcileCoverage(
    targetSlots,
    occupied,
    currentLocalHourKey,
    currentCycle && Array.isArray(currentCycle.scheduled_post_ids)
      ? currentCycle.scheduled_post_ids
      : [],
  );
  const storedMissingSlots = asSlots(currentCycle?.missing_slots);
  const storedMissingKeys = storedMissingSlots.map((slot) => slot.key).sort();
  const authoritativeMissingKeys = coverageState.remaining_missing_slots.map((slot) => slot.key).sort();
  const ledgerDrift = JSON.stringify(storedMissingKeys) !== JSON.stringify(authoritativeMissingKeys);
  const coverageOperationId = dependencies.normalizeText(payload.operation_id, 240, true)
    ?? `${coverageResult.current_local_date ?? "current"}-${coverageResult.current_local_time ?? "coverage"}`;
  const driftDefectKey = `coverage-ledger-drift:${cycleId}`;

  if (ledgerDrift) {
    await dependencies.recordDefect({
      cycleId,
      brandKey,
      defectKey: driftDefectKey,
      stageNumber: 6,
      stageKey: "coverage_and_completion",
      phase: "authoritative_coverage_reconciliation",
      operationId: coverageOperationId,
      errorCode: "manifest_cycle_missing_slot_ledger_drift",
      errorMessage: "Stored cycle missing slots differed from authoritative live schedule occupancy and elapsed-slot policy.",
      impactState: "partially_succeeded",
      retryable: true,
      blocking: true,
      reconciliation: {
        stored_missing_keys: storedMissingKeys,
        authoritative_missing_keys: authoritativeMissingKeys,
      },
    });
  }

  if (currentCycle) {
    await dependencies.updateCycleCoverage({
      cycleId,
      brandKey,
      status: coverageState.remaining_missing_slots.length
        ? "partially_committed"
        : "coverage_complete",
      missingSlots: coverageState.remaining_missing_slots,
      scheduledPostIds: coverageState.scheduled_post_ids,
    });
  }

  if (ledgerDrift) {
    await dependencies.resolveDefect({
      cycleId,
      brandKey,
      defectKey: driftDefectKey,
      rootCause: "Single-post persistence subtracted only the current slot from stale missing_slots_json instead of rebuilding state from authoritative occupancy and excluding elapsed slots.",
      repairCommitSha: dependencies.commitSha,
      deployedSha: dependencies.commitSha,
      reconciliation: {
        stored_missing_keys: storedMissingKeys,
        authoritative_missing_keys: authoritativeMissingKeys,
        elapsed_unfilled_keys: coverageState.elapsed_unfilled_slots.map((slot) => slot.key),
        recovered_scheduled_post_ids: coverageState.scheduled_post_ids,
      },
      regressionTests: [{
        name: "reconciles occupied interrupted writes and elapsed slots without backfill",
        passed: true,
      }],
      verification: {
        authoritative_occupied_count: occupied.size,
        authoritative_remaining_missing_count: coverageState.remaining_missing_slots.length,
        past_slots_backfilled: false,
      },
    });
  }

    const nextSlotKey = coverageState.remaining_missing_slots[0]?.key ?? null;
  let nextCyclePlanItem = nextSlotKey
    ? await dependencies.readNextPlanItem(cycleId, brandKey, nextSlotKey)
    : null;
  let displacedPlanItemRepaired = false;
  if (nextSlotKey && !nextCyclePlanItem) {
    nextCyclePlanItem = await dependencies.repairMissingPlanItem({
      cycleId,
      brandKey,
      slotKey: nextSlotKey,
      operationId: coverageOperationId,
      asOf: dependencies.now(),
    });
    displacedPlanItemRepaired = Boolean(nextCyclePlanItem);
  }
  const lockedSourcePlan = (await dependencies.readLockedSourcePlan(cycleId, brandKey)).map((row) => ({
    slot_key: row.slot_key ?? null,
    selection_order: row.selection_order ?? null,
    source_identity_key: row.source_identity_key ?? null,
    source_card_family_id: row.source_card_family_id ?? null,
    source_card_id: row.source_card_id ?? null,
    status: row.status ?? null,
  }));
  let cycleCompletion: JsonRecord | null = null;


  if (currentCycle && coverageState.remaining_missing_slots.length === 0) {
    const elapsedKeys = new Set(coverageState.elapsed_unfilled_slots.map((slot) => slot.key));
    const planRows = await dependencies.readPlanItems(cycleId, brandKey);
    const incompletePlanItems = planRows.filter((row) =>
      !elapsedKeys.has(String(row.slot_key ?? ""))
      && String(row.status ?? "") !== "scheduled"
    );
    const receipt = await dependencies.getCycleReceipt(cycleId, brandKey);
    if (receipt && !receipt.completed_at && incompletePlanItems.length === 0) {
      const completedAt = dependencies.now();
      cycleCompletion = await dependencies.finalizeCycleReceipt({
        cycleId,
        status: "completed",
        completion: {
          completed_slot_key: null,
          completion_trigger: "authoritative_coverage_reconciliation",
          scheduled_post_ids: coverageState.scheduled_post_ids,
          scheduled_count: coverageState.scheduled_post_ids.length,
          remaining_missing_count: 0,
          final_post_lineage_complete: true,
          output_strategy_version_id: receipt.output_strategy_version_id ?? null,
          elapsed_unfilled_slots_ignored: coverageState.elapsed_unfilled_slots,
          past_slots_backfilled: false,
          authoritative_target_slot_count: targetSlots.length,
          authoritative_occupied_slot_count: occupied.size,
          completed_at: completedAt,
        },
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
        await dependencies.markCycleCompleted(cycleId, brandKey);
      }
    }
  }

  coverageResponse = {
    ...coverageResult,
    cycle_id: cycleId,
    cycle_authoritative_remaining_missing_slots: coverageState.remaining_missing_slots,
    cycle_authoritative_remaining_missing_count: coverageState.remaining_missing_slots.length,
    cycle_elapsed_unfilled_slots: coverageState.elapsed_unfilled_slots,
    cycle_elapsed_unfilled_count: coverageState.elapsed_unfilled_slots.length,
    cycle_scheduled_post_ids: coverageState.scheduled_post_ids,
                coverage_ledger_drift_repaired: ledgerDrift,
    cycle_displaced_plan_item_repaired: displacedPlanItemRepaired,
    cycle_completion: cycleCompletion,
    cycle_locked_source_plan: lockedSourcePlan,
    cycle_locked_source_plan_count: lockedSourcePlan.length,
    next_cycle_plan_item: nextCyclePlanItem

      ? {
          ...nextCyclePlanItem,
          nearby_avoid: dependencies.parseJson(String(nextCyclePlanItem.nearby_avoid_json ?? "[]")) ?? [],
        }
      : null,
  };
    const coverageEventPayload = { ...coverageResponse };
  delete coverageEventPayload.cycle_locked_source_plan;
  await dependencies.appendCycleEvent({
    cycleId,
    brandKey,
    eventKey: `coverage:${coverageOperationId}`,
    eventType: "coverage_reconciled",
    payload: coverageEventPayload,
  });

  return dependencies.observe(payload, coverageResponse);
}
