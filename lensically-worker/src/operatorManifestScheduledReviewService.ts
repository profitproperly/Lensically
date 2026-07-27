type JsonRecord = Record<string, unknown>;

export interface OperatorManifestScheduledReviewDependencies {
  approvedStatus: string;
  workspaceDefaultTimezone: string;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  normalizeMachineKey(value: unknown, fallback: string): string;
  readScheduledPost(scheduledPostId: number, threadsUserId: string): Promise<JsonRecord | null>;
  readLinkedDraft(scheduledPostId: number, accountId: string): Promise<JsonRecord | null>;
  runGenerationGates(input: {
    draftId: string | null;
    sourceCardId: string | null;
    replacementText: string;
  }): Promise<{ showable: boolean; blocking_failures: unknown[] }>;
  getPartsInTimeZone(timestampMs: number, timezone: string): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  } | null;
  formatIsoDateParts(year: number, month: number, day: number): string;
  runSchedulingGates(input: {
    draftId: string | null;
    sourceCardId: string | null;
    replacementText: string;
    date: string;
    time: string;
    timezone: string;
  }): Promise<{ showable: boolean; blocking_failures: unknown[] }>;
  updateScheduledPost(input: {
    scheduledPostId: number;
    threadsUserId: string;
    replacementText: string;
    timezone: string;
  }): Promise<{ success: boolean; scheduledPost?: JsonRecord | null; error?: unknown }>;
  updateLineup(input: {
    scheduledPostId: number;
    brandKey: string;
    replacementText: string | null;
    status: "owner_kept" | "owner_revised";
    feedback: string;
  }): Promise<unknown>;
  saveStrategyMemory(input: {
    accountId: string;
    threadsUserId: string;
    kind: string;
    title: string;
    body: string;
    metadata: JsonRecord;
  }): Promise<unknown>;
}

function reviewMemoryKind(lessonScope: string): string {
  if (lessonScope === "permanent_rule") return "approved_rule";
  if (lessonScope === "temporary_repetition") return "cooldown";
  if (lessonScope === "performance_hypothesis" || lessonScope === "experiment") return "experiment";
  if (lessonScope === "family_strategy") return "current_belief";
  return "approval_feedback";
}

export async function reviewOperatorManifestScheduledPost(
  input: {
    brandKey: string;
    accountId: string;
    threadsUserId: string;
    payload: JsonRecord;
  },
  dependencies: OperatorManifestScheduledReviewDependencies,
): Promise<JsonRecord> {
  const { brandKey, accountId, threadsUserId, payload } = input;
  if (brandKey !== "manifest_mental") return { success: false, error: "manifest_only" };

  const scheduledPostId = Math.trunc(Number(payload.scheduled_post_id));
  const action = dependencies.normalizeMachineKey(payload.action, "");
  const feedback = dependencies.normalizeText(payload.feedback, 8000);
  const lessonScope = dependencies.normalizeMachineKey(payload.lesson_scope, "post_specific");
  if (!Number.isInteger(scheduledPostId)
    || scheduledPostId <= 0
    || !["keep", "rewrite", "reject_replace"].includes(action)) {
    return { success: false, error: "scheduled_post_action_required" };
  }
  if (!feedback) return { success: false, error: "scheduled_post_feedback_required" };

  const scheduled = await dependencies.readScheduledPost(scheduledPostId, threadsUserId);
  if (!scheduled) return { success: false, error: "scheduled_post_not_found" };
  if (String(scheduled.status ?? "") !== dependencies.approvedStatus) {
    return {
      success: false,
      error: "only_unpublished_approved_post_reviewable",
      status: scheduled.status ?? null,
    };
  }

  const linkedDraft = await dependencies.readLinkedDraft(scheduledPostId, accountId);
  const replacementText = dependencies.normalizeText(payload.replacement_text, 20000, true);
  if (["rewrite", "reject_replace"].includes(action) && !replacementText) {
    return { success: false, error: "replacement_text_required" };
  }

  let updatedPost: JsonRecord | null = null;
  if (replacementText) {
    const sourceCardId = dependencies.normalizeText(linkedDraft?.source_card_id, 120, true);
    const draftId = dependencies.normalizeText(linkedDraft?.id, 120, true);
    const generationGates = await dependencies.runGenerationGates({
      draftId,
      sourceCardId,
      replacementText,
    });
    if (!generationGates.showable) {
      return {
        success: false,
        error: "replacement_generation_gates_failed",
        blocking_failures: generationGates.blocking_failures,
      };
    }

    const scheduledTimeMs = Date.parse(String(scheduled.scheduled_time ?? ""));
    const timezone = dependencies.normalizeText(payload.timezone, 100, true)
      ?? dependencies.workspaceDefaultTimezone;
    const parts = Number.isFinite(scheduledTimeMs)
      ? dependencies.getPartsInTimeZone(scheduledTimeMs, timezone)
      : null;
    if (!parts) return { success: false, error: "scheduled_time_unreadable" };
    const date = dependencies.formatIsoDateParts(parts.year, parts.month, parts.day);
    const time = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
    const schedulingGates = await dependencies.runSchedulingGates({
      draftId,
      sourceCardId,
      replacementText,
      date,
      time,
      timezone,
    });
    if (!schedulingGates.showable) {
      return {
        success: false,
        error: "replacement_scheduling_gates_failed",
        blocking_failures: schedulingGates.blocking_failures,
      };
    }

    const updated = await dependencies.updateScheduledPost({
      scheduledPostId,
      threadsUserId,
      replacementText,
      timezone,
    });
    if (!updated.success || !updated.scheduledPost) {
      return {
        success: false,
        error: updated.error ?? "scheduled_post_update_failed",
      };
    }
    updatedPost = updated.scheduledPost;
  }

  await dependencies.updateLineup({
    scheduledPostId,
    brandKey,
    replacementText,
    status: action === "keep" ? "owner_kept" : "owner_revised",
    feedback,
  });
  const memoryKind = reviewMemoryKind(lessonScope);
  await dependencies.saveStrategyMemory({
    accountId,
    threadsUserId,
    kind: memoryKind,
    title: `Scheduled post ${scheduledPostId} owner review`,
    body: feedback,
    metadata: {
      source: "review_manifest_scheduled_post",
      scheduled_post_id: scheduledPostId,
      action,
      lesson_scope: lessonScope,
      permanent: lessonScope === "permanent_rule",
      replacement_text: replacementText ?? null,
    },
  });

  return {
    success: true,
    scheduled_post_id: scheduledPostId,
    action,
    lesson_scope: lessonScope,
    updated_post: updatedPost,
    operational_effect: action === "keep"
      ? "No production change; feedback recorded."
      : "The same scheduled slot was updated and remains covered.",
  };
}
