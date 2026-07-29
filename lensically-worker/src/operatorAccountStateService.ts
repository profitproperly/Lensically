type JsonRecord = Record<string, unknown>;

export interface OperatorAccountStateDependencies {
  getActiveSession(brandKey: string): Promise<JsonRecord | null>;
  getSourceCard(brandKey: string, sourceCardId: string): Promise<JsonRecord | null>;
  listDraftsByStatus(accountId: string, statuses: string[], limit: number): Promise<JsonRecord[]>;
  countScheduledPosts(threadsUserId: string): Promise<number>;
  listActiveGates(brandKey: string): Promise<JsonRecord[]>;
}

export async function readOperatorAccountState(
  input: {
    brandKey: string;
    accountId: string;
    threadsUserId: string;
  },
  dependencies: OperatorAccountStateDependencies,
): Promise<JsonRecord> {
  const activeSession = await dependencies.getActiveSession(input.brandKey);
  const activeSourceCard = activeSession?.active_source_card_id
    ? await dependencies.getSourceCard(input.brandKey, String(activeSession.active_source_card_id))
    : null;
  const approved = await dependencies.listDraftsByStatus(input.accountId, ["approved"], 5);
  const rejected = await dependencies.listDraftsByStatus(input.accountId, ["rejected"], 5);
  const scheduledCount = await dependencies.countScheduledPosts(input.threadsUserId);
  const gates = await dependencies.listActiveGates(input.brandKey);
    return {
    brand_key: input.brandKey,
    active_workflow_session: activeSession,
    active_source_card: activeSourceCard,
    latest_approved_drafts: approved,
    latest_rejected_drafts: rejected,
    scheduled_posts_count: Number(scheduledCount ?? 0),
    active_gates_count: gates.length,
    warnings: [],
  };
}

type OperatorPostMetricEvaluation = {
  metrics: JsonRecord;
  validForLearning: boolean;
  anomalyReason: string | null;
};

export interface OperatorPostResultsDependencies {
  ensureArchiveTable(): Promise<void>;
  ensureMetricSnapshotsTable(): Promise<void>;
  normalizeText(value: unknown, maxLength: number): string | null;
  loadScheduledLineage(publishedPostId: string): Promise<JsonRecord | null>;
  loadDraftFallback(publishedPostId: string): Promise<JsonRecord | null>;
  loadArchivePost(publishedPostId: string): Promise<JsonRecord | null>;
  loadSourceCard(sourceCardId: string): Promise<JsonRecord | null>;
  loadSourceSelection(sourceCardId: string): Promise<JsonRecord | null>;
  evaluateMetrics(publishedPostId: string, metricValues: JsonRecord): OperatorPostMetricEvaluation;
  loadGenerationRun(runId: string): Promise<JsonRecord | null>;
  loadDraftDetail(draftId: string): Promise<JsonRecord | null>;
  parseJson(value: string): unknown;
  serializeJson(value: unknown): string;
  loadLatestMetricSnapshot(publishedPostId: string): Promise<{ metrics_json: string } | null>;
  insertMetricSnapshot(input: {
    id: string;
    publishedPostId: string;
    scheduledPostId: number | null;
    draftId: string | null;
    generationRunId: string | null;
    sourceCardId: string | null;
    sourceSelectionId: string | null;
    metricsJson: string;
    capturedAt: string;
    validForLearning: boolean;
    anomalyReason: string | null;
  }): Promise<void>;
  ensurePerformanceTables(): Promise<void>;
  loadFingerprint(publishedPostId: string): Promise<JsonRecord | null>;
  listPerformanceScores(publishedPostId: string): Promise<JsonRecord[]>;
  listMetricHistory(publishedPostId: string): Promise<JsonRecord[]>;
  randomUuid(): string;
  now(): string;
}

function asJsonRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

export async function readOperatorPostResults(
  input: {
    brandKey: string;
    accountId: string;
    threadsUserId: string;
    payload: JsonRecord;
  },
  dependencies: OperatorPostResultsDependencies,
): Promise<{ status: number; body: JsonRecord }> {
  await dependencies.ensureArchiveTable();
  await dependencies.ensureMetricSnapshotsTable();
  const publishedPostId = dependencies.normalizeText(input.payload.published_post_id, 255);
  if (!publishedPostId) {
    return {
      status: 400,
      body: { success: false, error: "published_post_id is required" },
    };
  }

  const scheduled = await dependencies.loadScheduledLineage(publishedPostId);
  const draftFallback = scheduled ? null : await dependencies.loadDraftFallback(publishedPostId);
  const lineageRow = scheduled ?? draftFallback;
  const archivePost = await dependencies.loadArchivePost(publishedPostId);
  const sourceCardId = lineageRow?.source_card_id ? String(lineageRow.source_card_id) : null;
  const sourceCard = sourceCardId ? await dependencies.loadSourceCard(sourceCardId) : null;
  const sourceSelection = sourceCardId ? await dependencies.loadSourceSelection(sourceCardId) : null;

  const metricValues = archivePost ? {
    views: Number(archivePost.views ?? 0),
    likes: Number(archivePost.likes ?? 0),
    replies: Number(archivePost.replies ?? 0),
    reposts: Number(archivePost.reposts ?? 0),
    quotes: Number(archivePost.quotes ?? 0),
    shares: Number(archivePost.shares ?? 0),
    engagement_total: Number(archivePost.engagement_total ?? 0),
  } : null;
  const evaluatedMetrics = metricValues
    ? dependencies.evaluateMetrics(publishedPostId, metricValues)
    : null;
  const metrics = metricValues ? {
    ...metricValues,
    captured_at: archivePost?.last_synced_at ?? dependencies.now(),
    valid_for_learning: evaluatedMetrics?.validForLearning ?? false,
    anomaly_reason: evaluatedMetrics?.anomalyReason ?? null,
  } : null;

  if (input.payload.compact === true) {
    const generationRun = lineageRow?.run_id
      ? await dependencies.loadGenerationRun(String(lineageRow.run_id))
      : null;
    const draftDetail = lineageRow?.draft_id
      ? await dependencies.loadDraftDetail(String(lineageRow.draft_id))
      : null;
    const primarySource = sourceCard?.primary_source && typeof sourceCard.primary_source === "object"
      ? sourceCard.primary_source as JsonRecord
      : null;
    const sourceMetrics = sourceSelection
      ? asJsonRecord(dependencies.parseJson(String(sourceSelection.metrics_snapshot_json ?? "{}")))
      : {};
    return {
      status: 200,
      body: {
        post: {
          published_post_id: publishedPostId,
          text: archivePost?.post_text ?? lineageRow?.post_text ?? null,
          posted_at: archivePost?.post_timestamp ?? lineageRow?.published_at ?? null,
        },
        metrics,
        lineage: {
          source_selection_id: sourceSelection?.id ?? null,
          source_batch_id: sourceSelection?.batch_id ?? null,
          source_identity_key: sourceSelection?.source_identity_key ?? null,
          source_card_id: sourceCardId,
          generation_run_id: lineageRow?.run_id ?? null,
          draft_id: lineageRow?.draft_id ?? null,
          scheduled_post_id: lineageRow?.scheduled_post_id ?? null,
          published_post_id: publishedPostId,
        },
        source: sourceSelection ? {
          saved_pattern_id: sourceSelection.source_type === "saved_pattern"
            ? Number(sourceSelection.internal_source_id)
            : null,
          source_type: sourceSelection.source_type ?? null,
          source_identity_key: sourceSelection.source_identity_key ?? null,
          source_text: sourceSelection.post_text ?? primarySource?.text ?? null,
          source_likes: Number(sourceMetrics.likes ?? 0),
        } : null,
        source_card: sourceCard ? {
          id: sourceCard.id,
          family_id: sourceCard.family_id ?? null,
          version_number: sourceCard.version_number ?? null,
          is_current: sourceCard.is_current ?? null,
          title: sourceCard.title ?? null,
          transformation_contract: sourceCard.transformation_contract ?? null,
        } : null,
        generation_run: generationRun ? {
          id: generationRun.id,
          source_card_id: generationRun.source_card_id ?? null,
          source_card_family_id: generationRun.source_card_family_id ?? null,
          source_card_version_number: generationRun.source_card_version_number ?? null,
          objective: generationRun.objective ?? null,
          prompt_summary: generationRun.prompt_summary ?? null,
          status: generationRun.status ?? null,
          metadata: dependencies.parseJson(String(generationRun.metadata_json ?? "{}")) ?? {},
          adaptation_plan: dependencies.parseJson(String(generationRun.adaptation_plan_json ?? "{}")) ?? {},
        } : null,
        draft: draftDetail ? {
          id: draftDetail.id,
          run_id: draftDetail.run_id ?? null,
          source_card_id: draftDetail.source_card_id ?? null,
          status: draftDetail.status ?? null,
          scheduled_post_id: draftDetail.scheduled_post_id ?? null,
          published_post_id: draftDetail.published_post_id ?? null,
          strategy: dependencies.parseJson(String(draftDetail.strategy_json ?? "{}")) ?? {},
          metadata: dependencies.parseJson(String(draftDetail.metadata_json ?? "{}")) ?? {},
        } : null,
        warning: archivePost ? null : "Published post lineage was found, but synced Threads metrics are not available yet.",
        response_mode: "compact",
      },
    };
  }

  if (metrics && evaluatedMetrics) {
    const serializedMetrics = dependencies.serializeJson(evaluatedMetrics.metrics);
    const latestSnapshot = await dependencies.loadLatestMetricSnapshot(publishedPostId);
    if (latestSnapshot?.metrics_json !== serializedMetrics) {
      await dependencies.insertMetricSnapshot({
        id: dependencies.randomUuid(),
        publishedPostId,
        scheduledPostId: lineageRow?.scheduled_post_id === null || lineageRow?.scheduled_post_id === undefined
          ? null
          : Number(lineageRow.scheduled_post_id),
        draftId: lineageRow?.draft_id ? String(lineageRow.draft_id) : null,
        generationRunId: lineageRow?.run_id ? String(lineageRow.run_id) : null,
        sourceCardId,
        sourceSelectionId: sourceSelection?.id ? String(sourceSelection.id) : null,
        metricsJson: serializedMetrics,
        capturedAt: String(metrics.captured_at),
        validForLearning: evaluatedMetrics.validForLearning,
        anomalyReason: evaluatedMetrics.anomalyReason,
      });
    }
  }

  await dependencies.ensurePerformanceTables();
  const fingerprintRow = await dependencies.loadFingerprint(publishedPostId);
  const performanceRows = await dependencies.listPerformanceScores(publishedPostId);
  const history = input.payload.include_history === true
    ? await dependencies.listMetricHistory(publishedPostId)
    : [];

  return {
    status: 200,
    body: {
      post: archivePost ? {
        published_post_id: publishedPostId,
        text: archivePost.post_text ?? lineageRow?.post_text ?? null,
        posted_at: archivePost.post_timestamp ?? lineageRow?.published_at ?? null,
        permalink: archivePost.post_permalink ?? null,
        username: archivePost.post_username ?? null,
      } : scheduled ? {
        published_post_id: publishedPostId,
        text: scheduled.post_text ?? null,
        posted_at: scheduled.published_at ?? null,
        permalink: null,
        username: null,
      } : null,
      metrics,
      lineage: {
        source_selection_id: sourceSelection?.id ?? null,
        source_batch_id: sourceSelection?.batch_id ?? null,
        source_identity_key: sourceSelection?.source_identity_key ?? null,
        source_card_id: sourceCardId,
        generation_run_id: lineageRow?.run_id ?? null,
        draft_id: lineageRow?.draft_id ?? null,
        scheduled_post_id: lineageRow?.scheduled_post_id ?? null,
        published_post_id: publishedPostId,
      },
      source_selection: sourceSelection ? {
        id: sourceSelection.id,
        batch_id: sourceSelection.batch_id,
        draw_order: Number(sourceSelection.draw_order ?? 0),
        source_identity_key: sourceSelection.source_identity_key,
        threads_post_id: sourceSelection.threads_post_id ?? null,
        canonical_source_url: sourceSelection.canonical_source_url ?? null,
        metrics_snapshot: dependencies.parseJson(String(sourceSelection.metrics_snapshot_json ?? "{}")) ?? {},
        selected_at: sourceSelection.selected_at,
      } : null,
      source_card: sourceCard,
      performance_evaluation: {
        follower_attribution_policy: {
          post_level_attribution: "forbidden",
          day_or_period_post_attribution: "forbidden",
          account_level_tracking_only: true,
        },
        fingerprint: fingerprintRow
          ? dependencies.parseJson(String(fingerprintRow.fingerprint_json ?? "{}")) ?? {}
          : null,
        fingerprint_version: fingerprintRow?.fingerprint_version ?? null,
        maturity_scores: performanceRows.map((row) => ({
          checkpoint_hours: Number(row.checkpoint_hours),
          post_age_hours: Number(row.post_age_hours),
          metrics: dependencies.parseJson(String(row.metrics_json ?? "{}")) ?? {},
          rates: dependencies.parseJson(String(row.rates_json ?? "{}")) ?? {},
          velocity: dependencies.parseJson(String(row.velocity_json ?? "{}")) ?? {},
          scores: dependencies.parseJson(String(row.scores_json ?? "{}")) ?? {},
          distribution_state: row.distribution_state,
          captured_at: row.captured_at,
        })),
      },
      metric_history: history.map((row) => ({
        metrics: dependencies.parseJson(String(row.metrics_json ?? "{}")) ?? {},
        captured_at: row.captured_at,
        valid_for_learning: Number(row.valid_for_learning ?? 1) === 1,
        anomaly_reason: row.anomaly_reason ?? null,
        collection_source: row.collection_source ?? null,
      })),
      warning: archivePost ? null : "Published post lineage was found, but synced Threads metrics are not available yet.",
    },
  };
}

