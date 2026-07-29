type ScheduledPostEditUpdateInput = {
  scheduledPostId: number;
  text?: string;
  date?: string;
  time?: string;
  timeZone: string;
  spoilerAllText?: boolean;
    spoilerPhrases?: string[];
};

type ScheduledPostEditUpdateResult<TScheduledPost> = {
  success: boolean;
  scheduledPost: TScheduledPost | null;
  linkedDraftsUpdated?: number;
  error?: string | null;
  statusCode: number;
};

type LinkedDraftRecord = {
  id: string;
  source_card_id: string | null;
  strategy_json: string | null;
};

export async function editOperatorScheduledPost<TBrand, TScheduledPost extends { text: string }>(
  input: {
    payload: Record<string, unknown>;
    scheduledPostId: number;
    brandKey: TBrand;
    defaultTimezone: string;
  },
  dependencies: {
    normalizeText: (value: unknown, maxLength: number, allowEmpty?: boolean) => string | null;
        normalizeSpoilerPhrases: (value: unknown) => string[];
    updateScheduledPost: (
      update: ScheduledPostEditUpdateInput,
    ) => Promise<ScheduledPostEditUpdateResult<TScheduledPost>>;
    loadLinkedDraft: (scheduledPostId: number) => Promise<LinkedDraftRecord | null>;
    parseStrategyJson: (value: string) => Record<string, unknown> | null;
    persistInventory: (inventory: {
      brandKey: TBrand;
      sourceType: "scheduled_post";
      sourceId: string;
      text: string;
      sourceCardId: string | null;
      status: "scheduled";
      strategy: Record<string, unknown> | null;
      analysis: {
        edit_source: "edit_scheduled_post";
        linked_draft_id: string | null;
      };
    }) => Promise<void>;
  },
): Promise<{
  statusCode: number;
  body: Record<string, unknown>;
}> {
  const { payload, scheduledPostId } = input;
  const hasText = Object.prototype.hasOwnProperty.call(payload, "text");
  const hasDate = Object.prototype.hasOwnProperty.call(payload, "date");
  const hasTime = Object.prototype.hasOwnProperty.call(payload, "time");
  const hasSpoilerAllText = Object.prototype.hasOwnProperty.call(payload, "spoiler_all_text");
  const hasSpoilerPhrases = Object.prototype.hasOwnProperty.call(payload, "spoiler_phrases");

  const updated = await dependencies.updateScheduledPost({
    scheduledPostId,
    text: hasText ? dependencies.normalizeText(payload.text, 20_000) ?? "" : undefined,
    date: hasDate ? dependencies.normalizeText(payload.date, 20) ?? "" : undefined,
    time: hasTime ? dependencies.normalizeText(payload.time, 20) ?? "" : undefined,
    timeZone: dependencies.normalizeText(payload.timezone, 100, true) ?? input.defaultTimezone,
    spoilerAllText: hasSpoilerAllText ? payload.spoiler_all_text === true : undefined,
    spoilerPhrases: hasSpoilerPhrases
      ? dependencies.normalizeSpoilerPhrases(payload.spoiler_phrases)
      : undefined,
  });

  if (!updated.success || !updated.scheduledPost) {
    return {
      statusCode: updated.statusCode,
      body: {
        success: false,
        error: updated.error ?? "scheduled_post_update_failed",
      },
    };
  }

  const linkedDraft = await dependencies.loadLinkedDraft(scheduledPostId);
  await dependencies.persistInventory({
    brandKey: input.brandKey,
    sourceType: "scheduled_post",
    sourceId: String(scheduledPostId),
    text: updated.scheduledPost.text,
    sourceCardId: linkedDraft?.source_card_id ?? null,
    status: "scheduled",
    strategy: linkedDraft?.strategy_json
      ? dependencies.parseStrategyJson(linkedDraft.strategy_json)
      : null,
    analysis: {
      edit_source: "edit_scheduled_post",
      linked_draft_id: linkedDraft?.id ?? null,
    },
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      scheduled_post: updated.scheduledPost,
      linked_drafts_updated: updated.linkedDraftsUpdated ?? 0,
      linked_draft_id: linkedDraft?.id ?? null,
    },
  };
}
