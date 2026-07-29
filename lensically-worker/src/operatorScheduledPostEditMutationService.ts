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

type OwnerApprovedBatchScheduledItem = {
  index: number;
  scheduled_post_id: number;
  date: string;
  time: string;
};

export async function scheduleOperatorOwnerApprovedBatch<TBrand>(
  input: {
    payload: Record<string, unknown>;
    brandKey: TBrand;
    defaultTimezone: string;
  },
  dependencies: {
    normalizeText: (value: unknown, maxLength: number, allowEmpty?: boolean) => string | null;
    isValidIsoDate: (value: string) => boolean;
    isValidTime: (value: string) => boolean;
    createScheduledPost: (post: {
      text: string;
      date: string;
      time: string;
      timezone: string;
    }) => Promise<{
      success: boolean;
      scheduledPostId: number | null;
      error?: string | null;
    }>;
    saveStrategyMemory: (memory: {
      kind: "scheduled_batch";
      title: "Owner-approved direct scheduling batch";
      body: string;
      metadata: {
        source: "schedule_owner_approved_batch";
        scheduled_post_ids: number[];
        timezone: string;
      };
    }) => Promise<void>;
  },
): Promise<{
  statusCode: number;
  body: Record<string, unknown>;
}> {
  const ownerApproval = dependencies.normalizeText(input.payload.owner_approval, 4_000);
  const timezone = dependencies.normalizeText(input.payload.timezone, 100, true) ?? input.defaultTimezone;
  const rawPosts = Array.isArray(input.payload.posts) ? input.payload.posts.slice(0, 12) : [];

  if (!ownerApproval || !rawPosts.length) {
    return {
      statusCode: 400,
      body: { success: false, error: "owner_approval_and_posts_required" },
    };
  }

  if (String(input.brandKey) === "manifest_mental") {
    return {
      statusCode: 409,
      body: {
        success: false,
        error: "manifest_lineage_preserving_schedule_required",
        reason: "Direct text-only batch scheduling bypasses source cards, generation runs, drafts, and future metric lineage.",
        required_tools: ["schedule_manifest_review_batch", "schedule_approved_draft"],
        account_mutated: false,
      },
    };
  }

  const scheduledItems: OwnerApprovedBatchScheduledItem[] = [];
  for (let index = 0; index < rawPosts.length; index += 1) {
    const rawPost = rawPosts[index];
    const post = rawPost && typeof rawPost === "object" && !Array.isArray(rawPost)
      ? rawPost as Record<string, unknown>
      : {};
    const text = dependencies.normalizeText(post.text, 20_000);
    const date = dependencies.normalizeText(post.date, 20);
    const time = dependencies.normalizeText(post.time, 20);

    if (!text || !date || !time || !dependencies.isValidIsoDate(date) || !dependencies.isValidTime(time)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: "valid_text_date_and_time_required",
          failed_index: index,
          scheduled_count: scheduledItems.length,
          scheduled_items: scheduledItems,
        },
      };
    }

    const scheduled = await dependencies.createScheduledPost({ text, date, time, timezone });
    if (!scheduled.success || !scheduled.scheduledPostId) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: scheduled.error ?? "schedule_failed",
          failed_index: index,
          scheduled_count: scheduledItems.length,
          scheduled_items: scheduledItems,
        },
      };
    }

    scheduledItems.push({
      index,
      scheduled_post_id: scheduled.scheduledPostId,
      date,
      time,
    });
  }

  await dependencies.saveStrategyMemory({
    kind: "scheduled_batch",
    title: "Owner-approved direct scheduling batch",
    body: `Scheduled ${scheduledItems.length} owner-approved posts. Approval: ${ownerApproval}`,
    metadata: {
      source: "schedule_owner_approved_batch",
      scheduled_post_ids: scheduledItems.map((item) => item.scheduled_post_id),
      timezone,
    },
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      scheduled_count: scheduledItems.length,
      scheduled_items: scheduledItems,
      timezone,
    },
  };
}

