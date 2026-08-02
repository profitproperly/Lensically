export type ScheduledPostRevisionEditor = "model" | "owner" | "system";
export type ScheduledPostRevisionSource = "ui" | "mcp" | "backfill" | "publish" | "system";
export type ScheduledPostRevisionMagnitude = "untouched" | "light" | "substantial";

type RevisionLineage = {
  brandKey: string | null;
  accountId: string | null;
  sourceCardId: string | null;
  draftId: string | null;
  cycleId: string | null;
  cyclePlanItemId: string | null;
  originalModelText: string | null;
  hasModelLineage: boolean;
};

export type ScheduledPostRevisionPlan = {
  statements: D1PreparedStatement[];
  currentRevisionId: string;
  createdRevision: {
    id: string;
    revisionNumber: number;
    editorType: ScheduledPostRevisionEditor;
    changeMagnitude: ScheduledPostRevisionMagnitude;
    ownerNote: string | null;
  } | null;
  lineage: RevisionLineage;
};

function normalizedText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function tokenCounts(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of normalizedText(value).toLowerCase().match(/[a-z0-9$%']+/g) ?? []) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

export function classifyScheduledPostRevisionMagnitude(
  previousText: string,
  revisedText: string,
): ScheduledPostRevisionMagnitude {
  const previous = normalizedText(previousText);
  const revised = normalizedText(revisedText);
  if (previous === revised) return "untouched";
  const previousTokens = tokenCounts(previous);
  const revisedTokens = tokenCounts(revised);
  const previousTotal = Array.from(previousTokens.values()).reduce((total, count) => total + count, 0);
  const revisedTotal = Array.from(revisedTokens.values()).reduce((total, count) => total + count, 0);
  let shared = 0;
  for (const [token, count] of previousTokens) {
    shared += Math.min(count, revisedTokens.get(token) ?? 0);
  }
  const tokenSimilarity = Math.max(previousTotal, revisedTotal) > 0
    ? shared / Math.max(previousTotal, revisedTotal)
    : 0;
  const lengthDelta = Math.abs(previous.length - revised.length) / Math.max(previous.length, revised.length, 1);
  return tokenSimilarity >= 0.72 && lengthDelta <= 0.28 ? "light" : "substantial";
}

export function normalizeOwnerNote(value: unknown, maxLength = 12000): string | null {
  if (typeof value !== "string") return null;
  const note = value.trim();
  return note ? note.slice(0, maxLength) : null;
}

async function loadRevisionLineage(
  db: D1Database,
  scheduledPostId: number,
  threadsUserId: string,
): Promise<RevisionLineage> {
  const row = await db.prepare(
    `SELECT
       (SELECT d.id FROM gpt_generation_drafts d
        WHERE d.scheduled_post_id = ? AND d.threads_user_id = ?
        ORDER BY datetime(d.updated_at) DESC, datetime(d.created_at) DESC LIMIT 1) AS draft_id,
       (SELECT d.account_id FROM gpt_generation_drafts d
        WHERE d.scheduled_post_id = ? AND d.threads_user_id = ?
        ORDER BY datetime(d.updated_at) DESC, datetime(d.created_at) DESC LIMIT 1) AS account_id,
       COALESCE(
         (SELECT li.source_card_id FROM operator_autonomous_lineup_items li
          WHERE li.scheduled_post_id = ? ORDER BY datetime(li.updated_at) DESC LIMIT 1),
         (SELECT d.source_card_id FROM gpt_generation_drafts d
          WHERE d.scheduled_post_id = ? AND d.threads_user_id = ?
          ORDER BY datetime(d.updated_at) DESC LIMIT 1)
       ) AS source_card_id,
       (SELECT li.brand_key FROM operator_autonomous_lineup_items li
        WHERE li.scheduled_post_id = ? ORDER BY datetime(li.updated_at) DESC LIMIT 1) AS lineup_brand_key,
       (SELECT li.cycle_id FROM operator_autonomous_lineup_items li
        WHERE li.scheduled_post_id = ? ORDER BY datetime(li.updated_at) DESC LIMIT 1) AS cycle_id,
       (SELECT li.cycle_plan_item_id FROM operator_autonomous_lineup_items li
        WHERE li.scheduled_post_id = ? ORDER BY datetime(li.updated_at) DESC LIMIT 1) AS cycle_plan_item_id,
       COALESCE(
         (SELECT li.text FROM operator_autonomous_lineup_items li
          WHERE li.scheduled_post_id = ? ORDER BY datetime(li.updated_at) DESC LIMIT 1),
         (SELECT d.text FROM gpt_generation_drafts d
          WHERE d.scheduled_post_id = ? AND d.threads_user_id = ?
          ORDER BY datetime(d.created_at) ASC LIMIT 1)
       ) AS original_model_text`,
  ).bind(
    scheduledPostId, threadsUserId,
    scheduledPostId, threadsUserId,
    scheduledPostId,
    scheduledPostId, threadsUserId,
    scheduledPostId,
    scheduledPostId,
    scheduledPostId,
    scheduledPostId,
    scheduledPostId, threadsUserId,
  ).first<Record<string, unknown>>();
  const sourceCardId = row?.source_card_id ? String(row.source_card_id) : null;
  const card = sourceCardId
    ? await db.prepare(`SELECT brand_key FROM operator_source_cards WHERE id = ? LIMIT 1`)
      .bind(sourceCardId).first<{ brand_key: string }>()
    : null;
  const originalModelText = typeof row?.original_model_text === "string"
    ? row.original_model_text
    : null;
  const draftId = row?.draft_id ? String(row.draft_id) : null;
  const cycleId = row?.cycle_id ? String(row.cycle_id) : null;
  return {
    brandKey: row?.lineup_brand_key ? String(row.lineup_brand_key) : card?.brand_key ?? null,
    accountId: row?.account_id ? String(row.account_id) : null,
    sourceCardId,
    draftId,
    cycleId,
    cyclePlanItemId: row?.cycle_plan_item_id ? String(row.cycle_plan_item_id) : null,
    originalModelText,
    hasModelLineage: Boolean(draftId || cycleId || sourceCardId || originalModelText),
  };
}

function revisionInsertStatement(
  db: D1Database,
  input: {
    id: string;
    scheduledPostId: number;
    revisionNumber: number;
    editorType: ScheduledPostRevisionEditor;
    editSource: ScheduledPostRevisionSource;
    previousText: string | null;
    revisedText: string;
    ownerNote: string | null;
    threadsUserId: string;
    lineage: RevisionLineage;
    magnitude: ScheduledPostRevisionMagnitude;
  },
): D1PreparedStatement {
  return db.prepare(
    `INSERT OR IGNORE INTO operator_scheduled_post_revisions (
       id, scheduled_post_id, revision_number, editor_type, edit_source,
       previous_text, revised_text, owner_note, brand_key, account_id,
       threads_user_id, source_card_id, draft_id, cycle_id, cycle_plan_item_id,
       change_magnitude
     )
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE EXISTS (
       SELECT 1 FROM scheduled_posts
       WHERE id = ? AND threads_user_id = ? AND status IN ('approved', 'posting')
     )`,
  ).bind(
    input.id,
    input.scheduledPostId,
    input.revisionNumber,
    input.editorType,
    input.editSource,
    input.previousText,
    input.revisedText,
    input.ownerNote,
    input.lineage.brandKey,
    input.lineage.accountId,
    input.threadsUserId,
    input.lineage.sourceCardId,
    input.lineage.draftId,
    input.lineage.cycleId,
    input.lineage.cyclePlanItemId,
    input.magnitude,
    input.scheduledPostId,
    input.threadsUserId,
  );
}

export async function prepareScheduledPostRevisionPlan(
  db: D1Database,
  input: {
    scheduledPostId: number;
    userId: string;
    threadsUserId: string;
    currentText: string;
    currentRevisionId: string | null;
    revisedText: string;
    editorType: ScheduledPostRevisionEditor;
    editSource: ScheduledPostRevisionSource;
    ownerNote?: unknown;
  },
): Promise<ScheduledPostRevisionPlan> {
  const lineage = await loadRevisionLineage(db, input.scheduledPostId, input.threadsUserId);
  const ownerNote = normalizeOwnerNote(input.ownerNote);
  const statements: D1PreparedStatement[] = [];
  const latest = await db.prepare(
    `SELECT id, revision_number
     FROM operator_scheduled_post_revisions
     WHERE scheduled_post_id = ?
     ORDER BY revision_number DESC LIMIT 1`,
  ).bind(input.scheduledPostId).first<{ id: string; revision_number: number | string }>();
  let revisionNumber = Number(latest?.revision_number ?? 0);
  let currentRevisionId = input.currentRevisionId ?? latest?.id ?? null;

  if (!currentRevisionId) {
    const baselineText = normalizedText(lineage.originalModelText ?? input.currentText);
    const baselineId = crypto.randomUUID();
    revisionNumber += 1;
    statements.push(revisionInsertStatement(db, {
      id: baselineId,
      scheduledPostId: input.scheduledPostId,
      revisionNumber,
      editorType: lineage.hasModelLineage ? "model" : "owner",
      editSource: "system",
      previousText: null,
      revisedText: baselineText,
      ownerNote: null,
      threadsUserId: input.threadsUserId,
      lineage,
      magnitude: "untouched",
    }));
    currentRevisionId = baselineId;

    if (baselineText !== normalizedText(input.currentText)) {
      const recoveredOwnerId = crypto.randomUUID();
      revisionNumber += 1;
      statements.push(revisionInsertStatement(db, {
        id: recoveredOwnerId,
        scheduledPostId: input.scheduledPostId,
        revisionNumber,
        editorType: "owner",
        editSource: "backfill",
        previousText: baselineText,
        revisedText: input.currentText,
        ownerNote: null,
        threadsUserId: input.threadsUserId,
        lineage,
        magnitude: classifyScheduledPostRevisionMagnitude(baselineText, input.currentText),
      }));
      currentRevisionId = recoveredOwnerId;
    }
  }

  const textChanged = normalizedText(input.currentText) !== normalizedText(input.revisedText);
  let createdRevision: ScheduledPostRevisionPlan["createdRevision"] = null;
  if (textChanged || ownerNote) {
    const revisionId = crypto.randomUUID();
    revisionNumber += 1;
    const magnitude = classifyScheduledPostRevisionMagnitude(input.currentText, input.revisedText);
    statements.push(revisionInsertStatement(db, {
      id: revisionId,
      scheduledPostId: input.scheduledPostId,
      revisionNumber,
      editorType: input.editorType,
      editSource: input.editSource,
      previousText: input.currentText,
      revisedText: input.revisedText,
      ownerNote,
      threadsUserId: input.threadsUserId,
      lineage,
      magnitude,
    }));
    currentRevisionId = revisionId;
    createdRevision = {
      id: revisionId,
      revisionNumber,
      editorType: input.editorType,
      changeMagnitude: magnitude,
      ownerNote,
    };
  }

  if (ownerNote) {
    statements.push(
      db.prepare(
        `UPDATE gpt_generation_drafts
         SET owner_feedback = ?, updated_at = CURRENT_TIMESTAMP
         WHERE scheduled_post_id = ? AND threads_user_id = ?`,
      ).bind(ownerNote, input.scheduledPostId, input.threadsUserId),
            db.prepare(
        `UPDATE operator_autonomous_lineup_items
         SET owner_feedback = ?, updated_at = CURRENT_TIMESTAMP
         WHERE scheduled_post_id = ?`,
      ).bind(ownerNote, input.scheduledPostId),
    );
  }

  return {
    statements,
    currentRevisionId,
    createdRevision,
    lineage,
  };
}

export async function ensureScheduledPostCurrentRevision(
  db: D1Database,
  input: {
    scheduledPostId: number;
    userId: string;
    threadsUserId: string;
    currentText: string;
    currentRevisionId: string | null;
  },
): Promise<string> {
  if (input.currentRevisionId) return input.currentRevisionId;
  const plan = await prepareScheduledPostRevisionPlan(db, {
    ...input,
    revisedText: input.currentText,
    editorType: "system",
    editSource: "publish",
  });
  if (plan.statements.length) {
    await db.batch([
      ...plan.statements,
      db.prepare(
        `UPDATE scheduled_posts
         SET current_revision_id = ?
         WHERE id = ? AND user_id = ? AND threads_user_id = ?`,
      ).bind(plan.currentRevisionId, input.scheduledPostId, input.userId, input.threadsUserId),
    ]);
  }
  return plan.currentRevisionId;
}

export async function readSourceCardOwnerLearning(
  db: D1Database,
  sourceCardId: string,
): Promise<Record<string, unknown>> {
  const guidanceRows = await db.prepare(
    `SELECT id, guidance_text, active, version_number, supersedes_guidance_id,
            created_at, updated_at
     FROM operator_source_card_owner_guidance
     WHERE source_card_id = ?
     ORDER BY version_number DESC, datetime(created_at) DESC
     LIMIT 25`,
  ).bind(sourceCardId).all<Record<string, unknown>>();
  const revisionRows = await db.prepare(
    `SELECT r.id, r.scheduled_post_id, r.revision_number, r.editor_type,
            r.previous_text, r.revised_text, r.owner_note, r.change_magnitude,
            r.became_published, r.published_post_id, r.created_at,
            s.scheduled_time, s.published_at,
            ps.checkpoint_hours, ps.scores_json, ps.metrics_json, ps.captured_at
     FROM operator_scheduled_post_revisions r
     LEFT JOIN scheduled_posts s ON s.id = r.scheduled_post_id
     LEFT JOIN operator_post_performance_scores ps
       ON ps.brand_key = r.brand_key
      AND ps.published_post_id = r.published_post_id
      AND ps.checkpoint_hours = 24
     WHERE r.source_card_id = ?
     ORDER BY datetime(r.created_at) DESC, r.revision_number DESC
     LIMIT 50`,
  ).bind(sourceCardId).all<Record<string, unknown>>();
  const guidance = guidanceRows.results ?? [];
  const revisions = (revisionRows.results ?? []).map((row) => ({
    id: row.id,
    scheduled_post_id: Number(row.scheduled_post_id),
    revision_number: Number(row.revision_number),
    editor_type: row.editor_type,
    previous_text: row.previous_text ?? null,
    revised_text: row.revised_text,
    owner_note: row.owner_note ?? null,
    change_magnitude: row.change_magnitude,
    became_published: Number(row.became_published ?? 0) === 1,
    published_post_id: row.published_post_id ?? null,
    scheduled_time: row.scheduled_time ?? null,
    published_at: row.published_at ?? null,
    performance_24h: row.checkpoint_hours ? {
      checkpoint_hours: Number(row.checkpoint_hours),
      scores: safeJson(row.scores_json),
      metrics: safeJson(row.metrics_json),
      captured_at: row.captured_at,
    } : null,
    created_at: row.created_at,
  }));
  return {
    active_guidance: guidance.find((row) => Number(row.active ?? 0) === 1) ?? null,
    guidance_history: guidance.map((row) => ({ ...row, active: Number(row.active ?? 0) === 1 })),
    owner_edit_notes: revisions.filter((row) => row.owner_note),
    revision_history: revisions,
  };
}

function safeJson(value: unknown): unknown {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function saveSourceCardOwnerGuidance(
  db: D1Database,
  input: {
    brandKey: string;
    accountId: string;
    threadsUserId: string;
    sourceCardId: string;
    guidanceText?: unknown;
    active: boolean;
  },
): Promise<Record<string, unknown>> {
  const current = await db.prepare(
    `SELECT id, guidance_text, version_number
     FROM operator_source_card_owner_guidance
     WHERE source_card_id = ? AND active = 1
     ORDER BY version_number DESC LIMIT 1`,
  ).bind(input.sourceCardId).first<Record<string, unknown>>();
  if (!input.active) {
    await db.prepare(
      `UPDATE operator_source_card_owner_guidance
       SET active = 0, updated_at = CURRENT_TIMESTAMP
       WHERE source_card_id = ? AND active = 1`,
    ).bind(input.sourceCardId).run();
    return { active: false, source_card_id: input.sourceCardId };
  }
  const guidanceText = normalizeOwnerNote(input.guidanceText, 20000);
  if (!guidanceText) throw new Error("guidance_text_required");
  if (current && String(current.guidance_text) === guidanceText) {
    return {
      id: current.id,
      source_card_id: input.sourceCardId,
      guidance_text: guidanceText,
      active: true,
      version_number: Number(current.version_number),
      reused: true,
    };
  }
  const latest = await db.prepare(
    `SELECT MAX(version_number) AS latest_version
     FROM operator_source_card_owner_guidance
     WHERE source_card_id = ?`,
  ).bind(input.sourceCardId).first<{ latest_version: number | string | null }>();
  const id = crypto.randomUUID();
  const versionNumber = Number(latest?.latest_version ?? 0) + 1;
  await db.batch([
    db.prepare(
      `UPDATE operator_source_card_owner_guidance
       SET active = 0, updated_at = CURRENT_TIMESTAMP
       WHERE source_card_id = ? AND active = 1`,
    ).bind(input.sourceCardId),
    db.prepare(
      `INSERT INTO operator_source_card_owner_guidance (
         id, brand_key, account_id, threads_user_id, source_card_id,
         guidance_text, active, version_number, supersedes_guidance_id
       ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).bind(
      id,
      input.brandKey,
      input.accountId,
      input.threadsUserId,
      input.sourceCardId,
      guidanceText,
      versionNumber,
      current?.id ?? null,
    ),
  ]);
  return {
    id,
    source_card_id: input.sourceCardId,
    guidance_text: guidanceText,
    active: true,
    version_number: versionNumber,
    reused: false,
  };
}

function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export async function readOwnerLearningSummary(
  db: D1Database,
  threadsUserId: string,
): Promise<Record<string, unknown>> {
  const rows = await db.prepare(
    `SELECT s.id AS scheduled_post_id, s.status, s.published_post_id,
            r.editor_type, r.change_magnitude, r.owner_note,
            ps.scores_json
     FROM scheduled_posts s
     LEFT JOIN operator_scheduled_post_revisions r ON r.id = s.current_revision_id
     LEFT JOIN operator_post_performance_scores ps
       ON ps.published_post_id = s.published_post_id
      AND ps.checkpoint_hours = 24
     WHERE s.threads_user_id = ?`,
  ).bind(threadsUserId).all<Record<string, unknown>>();
  const items = rows.results ?? [];
  const ownerEdited = items.filter((row) => row.editor_type === "owner");
  const substantial = ownerEdited.filter((row) => row.change_magnitude === "substantial");
  const untouchedModel = items.filter((row) => row.editor_type === "model" && row.change_magnitude === "untouched");
  const scoreOf = (row: Record<string, unknown>): number | null => {
    const parsed = safeJson(row.scores_json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const overall = Number((parsed as Record<string, unknown>).overall);
    return Number.isFinite(overall) ? overall : null;
  };
  const ownerScores = ownerEdited.map(scoreOf).filter((value): value is number => value !== null);
  const modelScores = untouchedModel.map(scoreOf).filter((value): value is number => value !== null);
  return {
    scheduled_post_count: items.length,
    untouched_model_count: untouchedModel.length,
    owner_edited_count: ownerEdited.length,
    substantial_owner_rewrite_count: substantial.length,
    owner_notes_count: ownerEdited.filter((row) => typeof row.owner_note === "string" && row.owner_note.trim()).length,
    owner_intervention_rate: items.length ? Number((ownerEdited.length / items.length).toFixed(4)) : 0,
    published_24h: {
      owner_edited_sample_size: ownerScores.length,
      owner_edited_median_overall: median(ownerScores),
      untouched_model_sample_size: modelScores.length,
      untouched_model_median_overall: median(modelScores),
      evidence_type: "observational_cohort_comparison",
    },
  };
}

export async function resolveSavedPatternSourceCard(
  db: D1Database,
  input: { accountId: string; patternId: number },
): Promise<Record<string, unknown> | null> {
  const row = await db.prepare(
        `SELECT c.id, c.brand_key, c.title, c.status, c.primary_source_json,
            c.version_number,
            c.updated_at, f.id AS family_id, f.source_identity_key,
            g.id AS guidance_id, g.guidance_text, g.version_number AS guidance_version,
            g.updated_at AS guidance_updated_at
     FROM operator_source_card_families f
     JOIN operator_source_cards c
       ON c.id = f.current_source_card_id
      AND c.family_id = f.id
      AND c.is_current = 1
     LEFT JOIN operator_source_card_owner_guidance g
       ON g.source_card_id = c.id AND g.active = 1
     WHERE f.source_type = 'saved_pattern'
       AND f.internal_source_id = ?
       AND EXISTS (
         SELECT 1 FROM external_patterns p
         WHERE p.id = ? AND p.account_id = ?
       )
     LIMIT 1`,
  ).bind(String(input.patternId), input.patternId, input.accountId).first<Record<string, unknown>>();
  if (!row) return null;
  const learning = await readSourceCardOwnerLearning(db, String(row.id));
  return {
    id: row.id,
    brand_key: row.brand_key,
    family_id: row.family_id,
    source_identity_key: row.source_identity_key,
        title: row.title,
    status: row.status,
    primary_source: safeJson(row.primary_source_json),
    version_number: Number(row.version_number ?? 1),
    updated_at: row.updated_at,
    owner_guidance: row.guidance_id ? {
      id: row.guidance_id,
      text: row.guidance_text,
      version_number: Number(row.guidance_version ?? 1),
      updated_at: row.guidance_updated_at,
      active: true,
    } : null,
    owner_learning: learning,
    generation_direction: "Use the source card and the owner’s notes to understand the opportunity. Decide what the strongest post should be for Manifest Mental.",
  };
}
