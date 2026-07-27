type JsonRecord = Record<string, unknown>;

export interface OperatorManifestReviewBatchSchedulingDependencies {
  defaultTimezone: string;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  now(): Date;
  localDateTimeParts(date: Date, timezone: string): { date: string; hour: number };
  hourlySlot(hour: number): string;
  getReviewBatch(reviewBatchId: string, brandKey: string): Promise<JsonRecord | null>;
  listScheduledPosts(threadsUserId: string, productionDate: string, timezone: string): Promise<JsonRecord[]>;
  listApprovedClaims(accountId: string, reviewBatchId: string, brandKey: string): Promise<JsonRecord[]>;
  getDraft(draftId: string): Promise<JsonRecord | null>;
  runSchedulingGates(input: {
    draft: JsonRecord;
    productionDate: string;
    time: string;
    timezone: string;
  }): Promise<{ showable: boolean; gate_results?: unknown }>;
  createScheduledPost(input: {
    threadsUserId: string;
    text: string;
    productionDate: string;
    time: string;
    timezone: string;
  }): Promise<{ success: boolean; scheduledPostId?: unknown; error?: unknown }>;
  persistScheduledState(input: {
    accountId: string;
    draftId: string;
    claimId: string;
    scheduledPostId: unknown;
  }): Promise<unknown>;
  saveStrategyTag(input: {
    accountId: string;
    threadsUserId: string;
    scheduledPostId: unknown;
    strategy: unknown;
  }): Promise<unknown>;
  insertInventory(input: {
    brandKey: string;
    scheduledPostId: unknown;
    text: string;
    sourceCardId: unknown;
    strategy: unknown;
  }): Promise<unknown>;
  countUnresolved(reviewBatchId: string): Promise<number>;
  updateReviewBatchStatus(reviewBatchId: string, status: "completed" | "partially_resolved"): Promise<unknown>;
  serializeReviewBatch(reviewBatchId: string): Promise<JsonRecord | null>;
}

export interface OperatorManifestReviewBatchSchedulingResult {
  status: number;
  body: JsonRecord;
}

function scheduledHour(item: JsonRecord): number | null {
  const localTime = String(item.local_time ?? item.scheduled_time_local ?? "");
  const matched = localTime.match(/(?:\s|^)(\d{1,2}):\d{2}/)?.[1];
  const hour = Number(matched ?? localTime.split(":")[0]);
  return Number.isInteger(hour) ? hour : null;
}

export async function scheduleOperatorManifestReviewBatch(
  input: {
    brandKey: string;
    accountId: string;
    threadsUserId: string;
    payload: JsonRecord;
  },
  dependencies: OperatorManifestReviewBatchSchedulingDependencies,
): Promise<OperatorManifestReviewBatchSchedulingResult> {
  const reviewBatchId = dependencies.normalizeText(input.payload.review_batch_id, 120);
  const batch = reviewBatchId
    ? await dependencies.getReviewBatch(reviewBatchId, input.brandKey)
    : null;
  if (!batch) {
    return { status: 404, body: { success: false, error: "review_batch_not_found" } };
  }

  const resolvedReviewBatchId = String(batch.id);
  const productionDate = String(batch.production_date);
  const timezone = String(batch.timezone ?? dependencies.defaultTimezone);
  const requestedNumbers = Array.isArray(input.payload.item_numbers)
    ? new Set(
        input.payload.item_numbers
          .map((value) => Math.trunc(Number(value)))
          .filter((value) => Number.isInteger(value)),
      )
    : null;
  const local = dependencies.localDateTimeParts(dependencies.now(), timezone);
  const firstEligibleHour = productionDate === local.date ? Math.min(local.hour + 1, 24) : 0;
  const scheduledToday = await dependencies.listScheduledPosts(
    input.threadsUserId,
    productionDate,
    timezone,
  );
  const occupied = new Set<number>();
  for (const item of scheduledToday) {
    const hour = scheduledHour(item);
    if (hour !== null) occupied.add(hour);
  }
  const openSlots = Array.from(
    { length: Math.max(24 - firstEligibleHour, 0) },
    (_, index) => firstEligibleHour + index,
  )
    .filter((hour) => !occupied.has(hour))
    .map((hour) => dependencies.hourlySlot(hour));

  const approvedClaims = await dependencies.listApprovedClaims(
    input.accountId,
    resolvedReviewBatchId,
    input.brandKey,
  );
  const eligibleClaimsAll = approvedClaims.filter((claim) =>
    !requestedNumbers || requestedNumbers.has(Number(claim.review_item_number))
  );
  const eligibleClaims = eligibleClaimsAll.slice(0, 1);
  if (openSlots.length < eligibleClaims.length) {
    return {
      status: 409,
      body: {
        success: false,
        error: "insufficient_open_hourly_slots",
        open_slots: openSlots,
        approved_items: eligibleClaims.length,
      },
    };
  }

  const results: JsonRecord[] = [];
  for (let index = 0; index < eligibleClaims.length; index += 1) {
    const claim = eligibleClaims[index];
    const time = openSlots[index];
    const draft = await dependencies.getDraft(String(claim.draft_id));
    if (!draft) continue;
    const gateRun = await dependencies.runSchedulingGates({
      draft,
      productionDate,
      time,
      timezone,
    });
    if (!gateRun.showable) {
      results.push({
        item_number: claim.review_item_number,
        success: false,
        error: "scheduling_gates_failed",
        gate_results: gateRun.gate_results,
      });
      continue;
    }
    const text = String(draft.text ?? "");
    const scheduled = await dependencies.createScheduledPost({
      threadsUserId: input.threadsUserId,
      text,
      productionDate,
      time,
      timezone,
    });
    if (!scheduled.success || !scheduled.scheduledPostId) {
      results.push({
        item_number: claim.review_item_number,
        success: false,
        error: scheduled.error ?? "schedule_failed",
      });
      continue;
    }
    await dependencies.persistScheduledState({
      accountId: input.accountId,
      draftId: String(draft.id),
      claimId: String(claim.id),
      scheduledPostId: scheduled.scheduledPostId,
    });
    await dependencies.saveStrategyTag({
      accountId: input.accountId,
      threadsUserId: input.threadsUserId,
      scheduledPostId: scheduled.scheduledPostId,
      strategy: draft.strategy,
    });
    await dependencies.insertInventory({
      brandKey: input.brandKey,
      scheduledPostId: scheduled.scheduledPostId,
      text,
      sourceCardId: draft.source_card_id,
      strategy: draft.strategy,
    });
    results.push({
      item_number: Number(claim.review_item_number),
      success: true,
      scheduled_post_id: scheduled.scheduledPostId,
      date: productionDate,
      time,
      timezone,
    });
  }

  const unresolved = await dependencies.countUnresolved(resolvedReviewBatchId);
  await dependencies.updateReviewBatchStatus(
    resolvedReviewBatchId,
    unresolved === 0 ? "completed" : "partially_resolved",
  );
  return {
    status: 200,
    body: {
      review_batch_id: resolvedReviewBatchId,
      production_date: productionDate,
      results,
      invocation_item_limit: 1,
      remaining_approved_item_numbers: eligibleClaimsAll
        .slice(1)
        .map((claim) => Number(claim.review_item_number)),
      continuation_required: eligibleClaimsAll.length > 1,
      review_batch: await dependencies.serializeReviewBatch(resolvedReviewBatchId),
    },
  };
}
