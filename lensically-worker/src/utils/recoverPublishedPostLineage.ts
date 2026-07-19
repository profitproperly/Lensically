type RecoveryEnv = { DB: D1Database };

type RecoveryBrand = {
  brand_key: string;
  account_id: string;
  profile: { threads_user_id: string };
};

type RecoveryResponse = {
  status: number;
  payload: Record<string, unknown>;
};

type RecoveredPost = {
  published_post_id: string;
  scheduled_post_id: number | null;
  text: string;
  posted_at: string | null;
  archive: Record<string, unknown> | null;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, max = 20000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringList(value: unknown, maxItems = 100): string[] {
  return Array.isArray(value)
    ? value.map((item) => text(item, 2000)).filter(Boolean).slice(0, maxItems)
    : [];
}

function json(value: unknown, fallback: unknown = null): string {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function parseJson(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return record(parsed);
  } catch {
    return {};
  }
}

function canonicalThreadsUrl(value: unknown): string | null {
  const raw = text(value, 2000);
  if (!raw) return null;
  try {
    const url = new URL(raw.replace(/^https:\/\/threads\.net/i, "https://www.threads.com"));
    url.protocol = "https:";
    url.hostname = "www.threads.com";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

function threadsPostId(value: unknown): string | null {
  const url = canonicalThreadsUrl(value);
  return url?.match(/\/post\/([^/?#]+)/i)?.[1] ?? null;
}

async function tableExists(env: RecoveryEnv, name: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
  ).bind(name).first<{ name: string }>();
  return Boolean(row?.name);
}

function failure(error: string, status = 400, extra: Record<string, unknown> = {}): RecoveryResponse {
  return { status, payload: { success: false, error, ...extra } };
}

export async function recoverPublishedPostLineage(
  env: RecoveryEnv,
  brand: RecoveryBrand,
  payload: Record<string, unknown>,
  minimumVerifiedLikes = 1000,
): Promise<RecoveryResponse> {
  if (brand.brand_key !== "manifest_mental") {
    return failure("lineage_recovery_not_configured_for_brand");
  }

  const workflowSessionId = text(payload.workflow_session_id, 120);
  const savedPatternId = Math.trunc(Number(payload.saved_pattern_id));
  const publishedPostIds = Array.from(new Set(
    (Array.isArray(payload.published_post_ids) ? payload.published_post_ids : [])
      .map((item) => text(item, 255))
      .filter(Boolean),
  )).slice(0, 10);
  const cardInput = record(payload.source_card);
  const title = text(cardInput.title, 300);
  const laneKey = text(cardInput.lane_key, 120) || null;
  const sourceMechanism = text(cardInput.source_mechanism, 4000);
  const requiredProduct = text(cardInput.required_product, 4000);
  const transformationContract = record(cardInput.transformation_contract);
  const forbiddenSurfaces = Array.isArray(cardInput.forbidden_surfaces) ? cardInput.forbidden_surfaces.slice(0, 100) : [];
  const dangerSurfaces = Array.isArray(cardInput.danger_surfaces) ? cardInput.danger_surfaces.slice(0, 100) : [];
  const passConditions = Array.isArray(cardInput.pass_conditions) ? cardInput.pass_conditions.slice(0, 100) : [];
  const failConditions = Array.isArray(cardInput.fail_conditions) ? cardInput.fail_conditions.slice(0, 100) : [];
  const recommendedDirection = text(cardInput.recommended_direction, 4000) || null;

  if (!workflowSessionId || !Number.isInteger(savedPatternId) || savedPatternId < 1 || !publishedPostIds.length) {
    return failure("workflow_session_pattern_and_published_posts_required");
  }
  if (!title || !sourceMechanism || !requiredProduct || !passConditions.length || !failConditions.length) {
    return failure("complete_source_card_lesson_required");
  }

  const session = await env.DB.prepare(
    `SELECT id FROM operator_workflow_sessions
     WHERE id = ? AND brand_key = ? AND status = 'active' LIMIT 1`,
  ).bind(workflowSessionId, brand.brand_key).first<{ id: string }>();
  if (!session?.id) return failure("active_workflow_session_required");

  const pattern = await env.DB.prepare(
    `SELECT id, post_id, post_text, source_url, views, likes, replies, reposts, shares,
            posted_at, capture_confidence, updated_at
     FROM external_patterns
     WHERE app_user_id = 'lensically' AND account_id = ? AND id = ? LIMIT 1`,
  ).bind(brand.account_id, savedPatternId).first<Record<string, unknown>>();
  if (!pattern) return failure("saved_pattern_not_found", 404, { saved_pattern_id: savedPatternId });
  if (Number(pattern.likes ?? 0) < minimumVerifiedLikes) {
    return failure("saved_pattern_below_verified_like_floor", 409, {
      saved_pattern_id: savedPatternId,
      verified_likes: Number(pattern.likes ?? 0),
      required_likes: minimumVerifiedLikes,
    });
  }

  const canonicalSourceUrl = canonicalThreadsUrl(pattern.source_url);
  const sourceThreadsPostId = text(pattern.post_id, 255) || threadsPostId(canonicalSourceUrl);
  const sourceIdentityKey = sourceThreadsPostId
    ? `threads:${sourceThreadsPostId}`
    : canonicalSourceUrl
      ? `url:${canonicalSourceUrl}`
      : "";
  if (!sourceIdentityKey) return failure("saved_pattern_stable_identity_required", 409);

  const archiveAvailable = await tableExists(env, "threads_posts_archive");
  const recoveredPosts: RecoveredPost[] = [];
  for (const publishedPostId of publishedPostIds) {
    const scheduled = await env.DB.prepare(
      `SELECT id, post_text, status, scheduled_time, published_at, published_post_id
       FROM scheduled_posts
       WHERE threads_user_id = ? AND published_post_id = ?
       ORDER BY id DESC LIMIT 1`,
    ).bind(brand.profile.threads_user_id, publishedPostId).first<Record<string, unknown>>();
    const archive = archiveAvailable
      ? await env.DB.prepare(
          `SELECT post_id, post_text, post_timestamp, post_permalink, views, likes, replies,
                  reposts, quotes, shares, engagement_total, last_synced_at
           FROM threads_posts_archive
           WHERE threads_user_id = ? AND post_id = ? LIMIT 1`,
        ).bind(brand.profile.threads_user_id, publishedPostId).first<Record<string, unknown>>()
      : null;
    if (!scheduled && !archive) {
      return failure("published_post_not_found", 404, { published_post_id: publishedPostId });
    }
    const postText = text(archive?.post_text ?? scheduled?.post_text, 10000);
    if (!postText) return failure("published_post_text_required", 409, { published_post_id: publishedPostId });
    recoveredPosts.push({
      published_post_id: publishedPostId,
      scheduled_post_id: scheduled?.id === null || scheduled?.id === undefined ? null : Number(scheduled.id),
      text: postText,
      posted_at: text(archive?.post_timestamp ?? scheduled?.published_at, 100) || null,
      archive: archive ?? null,
    });
  }

  const selectedAt = new Date().toISOString();
  let selection = await env.DB.prepare(
    `SELECT * FROM operator_source_selections
     WHERE brand_key = ? AND source_identity_key = ?
       AND source_type = 'saved_pattern' AND internal_source_id = ?
     ORDER BY datetime(selected_at) DESC, datetime(created_at) DESC LIMIT 1`,
  ).bind(brand.brand_key, sourceIdentityKey, String(savedPatternId)).first<Record<string, unknown>>();

  if (!selection) {
    const sourceBatchId = crypto.randomUUID();
    const sourceSelectionId = crypto.randomUUID();
    const metricsSnapshot = {
      views: Number(pattern.views ?? 0),
      likes: Number(pattern.likes ?? 0),
      replies: Number(pattern.replies ?? 0),
      reposts: Number(pattern.reposts ?? 0),
      quotes: 0,
      shares: Number(pattern.shares ?? 0),
      engagement_total: Number(pattern.likes ?? 0) + Number(pattern.replies ?? 0)
        + Number(pattern.reposts ?? 0) + Number(pattern.shares ?? 0),
      captured_at: pattern.updated_at ?? selectedAt,
      eligibility_min_likes: minimumVerifiedLikes,
    };
    const sourceSnapshot = {
      source_candidate_id: `saved_pattern:${savedPatternId}`,
      source_identity_key: sourceIdentityKey,
      brand_key: brand.brand_key,
      source_type: "saved_pattern",
      source_id: savedPatternId,
      internal_source_id: String(savedPatternId),
      threads_post_id: sourceThreadsPostId,
      canonical_source_url: canonicalSourceUrl,
      text: pattern.post_text,
      metrics: metricsSnapshot,
      eligibility: {
        name: "verified_like_floor",
        threshold: minimumVerifiedLikes,
        verified_likes: Number(pattern.likes ?? 0),
        qualified: true,
      },
      posted_at: pattern.posted_at ?? null,
      source_url: canonicalSourceUrl,
      capture_confidence: pattern.capture_confidence ?? null,
      source_updated_at: pattern.updated_at ?? null,
      evidence_role: "market_signal",
    };
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO operator_source_selection_batches (
          id, brand_key, workflow_session_id, selection_method, eligibility_min_likes,
          qualified_pool_count, requested_count, selected_count, selected_at, metadata_json,
          production_date, status, retired_at, retirement_reason
        ) VALUES (?, ?, ?, 'historical_lineage_recovery', ?, 1, 1, 1, ?, ?, NULL,
                  'retired', ?, 'historical_lineage_recovery')`,
      ).bind(
        sourceBatchId,
        brand.brand_key,
        workflowSessionId,
        minimumVerifiedLikes,
        selectedAt,
        json({ saved_pattern_id: savedPatternId, published_post_ids: publishedPostIds }),
        selectedAt,
      ),
      env.DB.prepare(
        `INSERT INTO operator_source_selections (
          id, batch_id, brand_key, workflow_session_id, draw_order, source_identity_key,
          source_type, internal_source_id, threads_post_id, canonical_source_url,
          post_text, original_posted_at, metrics_snapshot_json, source_snapshot_json,
          disposition, disposition_reason, disposition_at, selected_at
        ) VALUES (?, ?, ?, ?, 1, ?, 'saved_pattern', ?, ?, ?, ?, ?, ?, ?,
                  'claimed', 'historical_lineage_recovery', ?, ?)`,
      ).bind(
        sourceSelectionId,
        sourceBatchId,
        brand.brand_key,
        workflowSessionId,
        sourceIdentityKey,
        String(savedPatternId),
        sourceThreadsPostId,
        canonicalSourceUrl,
        text(pattern.post_text, 10000),
        pattern.posted_at ?? null,
        json(metricsSnapshot, {}),
        json(sourceSnapshot, {}),
        selectedAt,
        selectedAt,
      ),
    ]);
    selection = await env.DB.prepare(
      `SELECT * FROM operator_source_selections WHERE id = ? LIMIT 1`,
    ).bind(sourceSelectionId).first<Record<string, unknown>>();
  }
  if (!selection?.id) return failure("source_selection_recovery_failed", 500);

  let family = await env.DB.prepare(
    `SELECT * FROM operator_source_card_families
     WHERE brand_key = ? AND source_identity_key = ? AND status = 'active' LIMIT 1`,
  ).bind(brand.brand_key, sourceIdentityKey).first<Record<string, unknown>>();
  if (!family) {
    const familyId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO operator_source_card_families (
        id, brand_key, source_identity_key, source_type, internal_source_id,
        threads_post_id, canonical_source_url, current_source_card_id, status
      ) VALUES (?, ?, ?, 'saved_pattern', ?, ?, ?, NULL, 'active')`,
    ).bind(
      familyId,
      brand.brand_key,
      sourceIdentityKey,
      String(savedPatternId),
      sourceThreadsPostId,
      canonicalSourceUrl,
    ).run();
    family = await env.DB.prepare(
      `SELECT * FROM operator_source_card_families WHERE id = ? LIMIT 1`,
    ).bind(familyId).first<Record<string, unknown>>();
  }
  if (!family?.id) return failure("source_card_family_recovery_failed", 500);

  const currentCard = family.current_source_card_id
    ? await env.DB.prepare(
        `SELECT * FROM operator_source_cards
         WHERE id = ? AND brand_key = ? LIMIT 1`,
      ).bind(String(family.current_source_card_id), brand.brand_key).first<Record<string, unknown>>()
    : null;
  const desiredCard = {
    title,
    lane_key: laneKey,
    source_mechanism: sourceMechanism,
    required_product: requiredProduct,
    transformation_contract_json: json(transformationContract, {}),
    forbidden_surfaces_json: json(forbiddenSurfaces, []),
    danger_surfaces_json: json(dangerSurfaces, []),
    pass_conditions_json: json(passConditions, []),
    fail_conditions_json: json(failConditions, []),
    recommended_direction: recommendedDirection,
  };
  const currentMatches = Boolean(currentCard)
    && String(currentCard?.title ?? "") === desiredCard.title
    && String(currentCard?.lane_key ?? "") === String(desiredCard.lane_key ?? "")
    && String(currentCard?.source_mechanism ?? "") === desiredCard.source_mechanism
    && String(currentCard?.required_product ?? "") === desiredCard.required_product
    && json(parseJson(currentCard?.transformation_contract_json), {}) === desiredCard.transformation_contract_json
    && json(JSON.parse(String(currentCard?.forbidden_surfaces_json ?? "[]")), []) === desiredCard.forbidden_surfaces_json
    && json(JSON.parse(String(currentCard?.pass_conditions_json ?? "[]")), []) === desiredCard.pass_conditions_json
    && json(JSON.parse(String(currentCard?.fail_conditions_json ?? "[]")), []) === desiredCard.fail_conditions_json;

  let sourceCardId = currentMatches ? String(currentCard?.id) : crypto.randomUUID();
  let sourceCardVersion = currentMatches ? Number(currentCard?.version_number ?? 1) : Number(currentCard?.version_number ?? 0) + 1;
  const sourceMetrics = parseJson(selection.metrics_snapshot_json);
  const primarySource = {
    source_candidate_id: `saved_pattern:${savedPatternId}`,
    source_identity_key: sourceIdentityKey,
    brand_key: brand.brand_key,
    source_type: "saved_pattern",
    source_id: savedPatternId,
    internal_source_id: String(savedPatternId),
    threads_post_id: sourceThreadsPostId,
    canonical_source_url: canonicalSourceUrl,
    text: pattern.post_text,
    metrics: sourceMetrics,
    source_selection_id: selection.id,
    source_batch_id: selection.batch_id,
    evidence_role: "market_signal",
  };

  if (!currentMatches) {
    const statements = [];
    if (currentCard?.id) {
      statements.push(
        env.DB.prepare(
          `UPDATE operator_source_cards SET is_current = 0 WHERE id = ? AND brand_key = ?`,
        ).bind(String(currentCard.id), brand.brand_key),
      );
    }
    statements.push(
      env.DB.prepare(
        `INSERT INTO operator_source_cards (
          id, brand_key, workflow_session_id, sequence_label, lane_key, title, status,
          primary_source_json, secondary_sources_json, anti_sources_json, metrics_snapshot_json,
          source_mechanism, required_product, forbidden_surfaces_json, danger_surfaces_json,
          current_inventory_constraints_json, pass_conditions_json, fail_conditions_json,
          recommended_direction, created_by, family_id, source_selection_id, version_number,
          is_current, supersedes_source_card_id, version_reason, transformation_contract_json,
          locked_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'locked', ?, '[]', '[]', ?, ?, ?, ?, ?, '[]', ?, ?, ?,
                  'gpt', ?, ?, ?, 1, ?, ?, ?, ?)`,
      ).bind(
        sourceCardId,
        brand.brand_key,
        workflowSessionId,
        `historical_recovery_${savedPatternId}`,
        laneKey,
        title,
        json(primarySource, {}),
        json(sourceMetrics, {}),
        sourceMechanism,
        requiredProduct,
        json(forbiddenSurfaces, []),
        json(dangerSurfaces, []),
        json(passConditions, []),
        json(failConditions, []),
        recommendedDirection,
        String(family.id),
        String(selection.id),
        sourceCardVersion,
        currentCard?.id ? String(currentCard.id) : null,
        `historical_lineage_recovery_saved_pattern_${savedPatternId}`,
        json(transformationContract, {}),
        selectedAt,
      ),
    );
    statements.push(
      env.DB.prepare(
        `UPDATE operator_source_card_families
         SET current_source_card_id = ?, source_type = 'saved_pattern', internal_source_id = ?,
             threads_post_id = ?, canonical_source_url = ?
         WHERE id = ? AND brand_key = ?`,
      ).bind(
        sourceCardId,
        String(savedPatternId),
        sourceThreadsPostId,
        canonicalSourceUrl,
        String(family.id),
        brand.brand_key,
      ),
    );
    await env.DB.batch(statements);
  }

  await env.DB.prepare(
    `UPDATE operator_source_selections
     SET source_card_id = ?
     WHERE brand_key = ? AND source_identity_key = ?`,
  ).bind(sourceCardId, brand.brand_key, sourceIdentityKey).run();

  const postResults: Array<Record<string, unknown>> = [];
  for (const post of recoveredPosts) {
    const recoveryKey = `${brand.brand_key}:${savedPatternId}:${post.published_post_id}`;
    let run = await env.DB.prepare(
      `SELECT * FROM gpt_generation_runs
       WHERE account_id = ?
         AND json_extract(metadata_json, '$.historical_lineage_recovery_key') = ?
       ORDER BY datetime(created_at) DESC LIMIT 1`,
    ).bind(brand.account_id, recoveryKey).first<Record<string, unknown>>();
    if (!run) {
      const runId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO gpt_generation_runs (
          id, account_id, threads_user_id, source_card_id, source_card_family_id,
          source_card_version_number, objective, prompt_summary, status, metadata_json,
          adaptation_plan_json, prior_adaptation_context_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, '{}')`,
      ).bind(
        runId,
        brand.account_id,
        brand.profile.threads_user_id,
        sourceCardId,
        String(family.id),
        sourceCardVersion,
        `Historical lineage recovery for published post ${post.published_post_id}.`,
        `Recovered from Saved Pattern ${savedPatternId}.`,
        json({
          historical_lineage_recovery_key: recoveryKey,
          saved_pattern_id: savedPatternId,
          published_post_id: post.published_post_id,
          recovered_at: selectedAt,
        }),
        json({
          adaptation_goal: "Preserve the proven source mechanism and attach the historical published result.",
          adaptation_style: "historical_lineage_recovery",
          source_identity_key: sourceIdentityKey,
        }),
      ).run();
      run = await env.DB.prepare(
        `SELECT * FROM gpt_generation_runs WHERE id = ? LIMIT 1`,
      ).bind(runId).first<Record<string, unknown>>();
    } else {
      await env.DB.prepare(
        `UPDATE gpt_generation_runs
         SET source_card_id = ?, source_card_family_id = ?, source_card_version_number = ?,
             status = 'completed', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND account_id = ?`,
      ).bind(
        sourceCardId,
        String(family.id),
        sourceCardVersion,
        String(run.id),
        brand.account_id,
      ).run();
    }
    if (!run?.id) return failure("generation_run_recovery_failed", 500, { published_post_id: post.published_post_id });

    let draft = await env.DB.prepare(
      `SELECT * FROM gpt_generation_drafts
       WHERE account_id = ? AND threads_user_id = ?
         AND (published_post_id = ? OR (? IS NOT NULL AND scheduled_post_id = ?))
       ORDER BY CASE WHEN published_post_id = ? THEN 0 ELSE 1 END, datetime(updated_at) DESC
       LIMIT 1`,
    ).bind(
      brand.account_id,
      brand.profile.threads_user_id,
      post.published_post_id,
      post.scheduled_post_id,
      post.scheduled_post_id,
      post.published_post_id,
    ).first<Record<string, unknown>>();
    if (!draft) {
      const draftId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO gpt_generation_drafts (
          id, run_id, account_id, threads_user_id, draft_index, text, status,
          source_card_id, owner_feedback, showable, scheduled_post_id, published_post_id,
          metadata_json
        ) VALUES (?, ?, ?, ?, 1, ?, 'published', ?, ?, 1, ?, ?, ?)`,
      ).bind(
        draftId,
        String(run.id),
        brand.account_id,
        brand.profile.threads_user_id,
        post.text,
        sourceCardId,
        "Historical lineage recovered from a verified Saved Pattern and published result.",
        post.scheduled_post_id,
        post.published_post_id,
        json({
          historical_lineage_recovery_key: recoveryKey,
          recovered_at: selectedAt,
        }),
      ).run();
      draft = await env.DB.prepare(
        `SELECT * FROM gpt_generation_drafts WHERE id = ? LIMIT 1`,
      ).bind(draftId).first<Record<string, unknown>>();
    } else {
      await env.DB.prepare(
        `UPDATE gpt_generation_drafts
         SET run_id = ?, source_card_id = ?, status = 'published', showable = 1,
             scheduled_post_id = ?, published_post_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND account_id = ?`,
      ).bind(
        String(run.id),
        sourceCardId,
        post.scheduled_post_id,
        post.published_post_id,
        String(draft.id),
        brand.account_id,
      ).run();
    }
    if (!draft?.id) return failure("draft_lineage_recovery_failed", 500, { published_post_id: post.published_post_id });

    await env.DB.prepare(
      `UPDATE operator_post_metric_snapshots
       SET scheduled_post_id = ?, draft_id = ?, source_card_id = ?, source_selection_id = ?
       WHERE brand_key = ? AND published_post_id = ?`,
    ).bind(
      post.scheduled_post_id,
      String(draft.id),
      sourceCardId,
      String(selection.id),
      brand.brand_key,
      post.published_post_id,
    ).run();

    const snapshotCount = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM operator_post_metric_snapshots
       WHERE brand_key = ? AND published_post_id = ?`,
    ).bind(brand.brand_key, post.published_post_id).first<{ total: number | string }>();
    if (Number(snapshotCount?.total ?? 0) === 0 && post.archive) {
      const metrics = {
        views: Number(post.archive.views ?? 0),
        likes: Number(post.archive.likes ?? 0),
        replies: Number(post.archive.replies ?? 0),
        reposts: Number(post.archive.reposts ?? 0),
        quotes: Number(post.archive.quotes ?? 0),
        shares: Number(post.archive.shares ?? 0),
        engagement_total: Number(post.archive.engagement_total ?? 0),
      };
      await env.DB.prepare(
        `INSERT INTO operator_post_metric_snapshots (
          id, brand_key, published_post_id, scheduled_post_id, draft_id,
          source_card_id, source_selection_id, metrics_json, captured_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        brand.brand_key,
        post.published_post_id,
        post.scheduled_post_id,
        String(draft.id),
        sourceCardId,
        String(selection.id),
        json(metrics, {}),
        post.archive.last_synced_at ?? selectedAt,
      ).run();
    }

    await env.DB.prepare(
      `UPDATE operator_content_inventory
       SET source_card_id = ?
       WHERE brand_key = ?
         AND ((source_type = 'scheduled_post' AND source_id = ?) OR text = ?)`,
    ).bind(
      sourceCardId,
      brand.brand_key,
      post.scheduled_post_id === null ? "" : String(post.scheduled_post_id),
      post.text,
    ).run();

    await env.DB.prepare(
      `UPDATE operator_daily_source_claims
       SET source_identity_key = ?, source_type = 'saved_pattern', internal_source_id = ?,
           source_batch_id = ?, source_selection_id = ?, source_card_id = ?,
           generation_run_id = ?, draft_id = ?, status = 'published'
       WHERE brand_key = ?
         AND ((? IS NOT NULL AND scheduled_post_id = ?) OR draft_id = ?)`,
    ).bind(
      sourceIdentityKey,
      String(savedPatternId),
      String(selection.batch_id),
      String(selection.id),
      sourceCardId,
      String(run.id),
      String(draft.id),
      brand.brand_key,
      post.scheduled_post_id,
      post.scheduled_post_id,
      String(draft.id),
    ).run();

    postResults.push({
      published_post_id: post.published_post_id,
      scheduled_post_id: post.scheduled_post_id,
      generation_run_id: run.id,
      draft_id: draft.id,
      source_card_id: sourceCardId,
      source_selection_id: selection.id,
      metrics_snapshot_count: Number(snapshotCount?.total ?? 0) || (post.archive ? 1 : 0),
    });
  }

  return {
    status: 200,
    payload: {
      success: true,
      brand_key: brand.brand_key,
      saved_pattern_id: savedPatternId,
      source_identity_key: sourceIdentityKey,
      source_batch_id: selection.batch_id,
      source_selection_id: selection.id,
      source_card_family_id: family.id,
      source_card_id: sourceCardId,
      source_card_version: sourceCardVersion,
      source_card_reused: currentMatches,
      recovered_posts: postResults,
      recovered_count: postResults.length,
      verification_intent: "get post results",
    },
  };
}
