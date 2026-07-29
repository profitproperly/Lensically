type ScheduledPostDeletionOutcome<TRecord> = {
  outcome: "deleted" | "not_found" | "not_deletable" | "reason_required";
  record?: TRecord | null;
  replayed?: boolean;
};

export type OperatorScheduledPostDeletionResult<TRecord> = {
  statusCode: number;
  body: Record<string, unknown> & {
    deletion?: TRecord | null;
  };
};

export async function deleteOperatorScheduledPost<
  TReason extends string,
  TRecord,
>(
  input: {
    payload: Record<string, unknown>;
  },
  dependencies: {
    normalizeReasonCode: (value: unknown) => TReason | null;
    allowedReasonCodes: readonly unknown[];
    normalizeText: (
      value: unknown,
      maxLength: number,
      allowEmpty?: boolean,
    ) => string | null;
    deleteScheduledPost: (request: {
      scheduledPostId: number;
      reasonCode: TReason;
      reasonDetail: string | null;
      operationId: string | null;
    }) => Promise<ScheduledPostDeletionOutcome<TRecord>>;
  },
): Promise<OperatorScheduledPostDeletionResult<TRecord>> {
  const scheduledPostId = Math.trunc(Number(input.payload.scheduled_post_id ?? 0));
  const reasonCode = dependencies.normalizeReasonCode(input.payload.reason_code);
  const reasonDetail = dependencies.normalizeText(input.payload.reason_detail, 8000, true);

  if (!Number.isInteger(scheduledPostId) || scheduledPostId <= 0) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: "scheduled_post_id is required",
      },
    };
  }
  if (!reasonCode) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: "scheduled_post_deletion_reason_code_required",
        allowed_reason_codes: Array.from(dependencies.allowedReasonCodes),
      },
    };
  }

  const deletion = await dependencies.deleteScheduledPost({
    scheduledPostId,
    reasonCode,
    reasonDetail,
    operationId: dependencies.normalizeText(input.payload.operation_id, 240, true),
  });

  if (deletion.outcome === "not_found") {
    return {
      statusCode: 404,
      body: { success: false, error: "scheduled_post_not_found" },
    };
  }
  if (deletion.outcome === "not_deletable") {
    return {
      statusCode: 409,
      body: {
        success: false,
        error: "only_approved_scheduled_posts_can_be_deleted",
      },
    };
  }
  if (deletion.outcome === "reason_required") {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: "scheduled_post_deletion_reason_required",
      },
    };
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      deleted: true,
      deletion: deletion.record ?? null,
      replayed: deletion.replayed === true,
      strategy_memory_written: false,
    },
  };
}
