type JsonRecord = Record<string, unknown>;

export const MANIFEST_READY_SNAPSHOT_VERSION = "manifest-ready-snapshot-v1";
export const MANIFEST_READY_SNAPSHOT_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export type ManifestReadySnapshotWatermarks = {
  learning_brief_id: string | null;
  learning_generated_at: string | null;
  qualified_pattern_count: number;
  qualified_pattern_updated_at: string | null;
  derived_pattern_count: number;
  derived_pattern_updated_at: string | null;
  owner_revision_updated_at: string | null;
};

export type ManifestReadySnapshotAssessment = {
  reusable: boolean;
  reason: string;
  snapshot_id: string | null;
  snapshot_version: string | null;
  learning_brief_id: string | null;
  generated_at: string | null;
  age_ms: number | null;
  stored_watermarks: ManifestReadySnapshotWatermarks | null;
  current_watermarks: ManifestReadySnapshotWatermarks;
  payload: JsonRecord;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function integer(value: unknown): number {
  const parsed = Math.trunc(Number(value ?? 0));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function normalizeWatermarks(value: unknown): ManifestReadySnapshotWatermarks {
  const input = record(value);
  return {
    learning_brief_id: text(input.learning_brief_id),
    learning_generated_at: text(input.learning_generated_at),
    qualified_pattern_count: integer(input.qualified_pattern_count),
    qualified_pattern_updated_at: text(input.qualified_pattern_updated_at),
    derived_pattern_count: integer(input.derived_pattern_count),
    derived_pattern_updated_at: text(input.derived_pattern_updated_at),
    owner_revision_updated_at: text(input.owner_revision_updated_at),
  };
}

function sameWatermarks(
  left: ManifestReadySnapshotWatermarks,
  right: ManifestReadySnapshotWatermarks,
): boolean {
  return left.learning_brief_id === right.learning_brief_id
    && left.learning_generated_at === right.learning_generated_at
    && left.qualified_pattern_count === right.qualified_pattern_count
    && left.qualified_pattern_updated_at === right.qualified_pattern_updated_at
    && left.derived_pattern_count === right.derived_pattern_count
    && left.derived_pattern_updated_at === right.derived_pattern_updated_at
    && left.owner_revision_updated_at === right.owner_revision_updated_at;
}

export function assessManifestReadySnapshot(input: {
  stored: JsonRecord | null;
  currentWatermarks: ManifestReadySnapshotWatermarks;
  nowMs: number;
  maxAgeMs?: number;
}): ManifestReadySnapshotAssessment {
  const stored = input.stored;
  const payload = record(parseJson(stored?.payload_json));
  const storedWatermarks = stored
    ? normalizeWatermarks(parseJson(stored.watermark_json))
    : null;
  const generatedAt = text(stored?.generated_at);
  const generatedAtMs = generatedAt ? Date.parse(generatedAt) : Number.NaN;
  const ageMs = Number.isFinite(generatedAtMs)
    ? Math.max(0, input.nowMs - generatedAtMs)
    : null;
  const maxAgeMs = Math.max(60_000, Math.trunc(input.maxAgeMs ?? MANIFEST_READY_SNAPSHOT_MAX_AGE_MS));

  let reason = "ready";
  if (!stored) reason = "snapshot_missing";
  else if (String(stored.snapshot_version ?? "") !== MANIFEST_READY_SNAPSHOT_VERSION) reason = "snapshot_version_mismatch";
  else if (!storedWatermarks || !sameWatermarks(storedWatermarks, input.currentWatermarks)) reason = "watermark_changed";
  else if (ageMs === null || ageMs > maxAgeMs) reason = "snapshot_expired";
  else if (payload.manifest_layers_finalized !== true) reason = "snapshot_not_finalized";

  return {
    reusable: reason === "ready",
    reason,
    snapshot_id: text(stored?.id),
    snapshot_version: text(stored?.snapshot_version),
    learning_brief_id: text(stored?.learning_brief_id),
    generated_at: generatedAt,
    age_ms: ageMs,
    stored_watermarks: storedWatermarks,
    current_watermarks: input.currentWatermarks,
    payload,
  };
}

async function safeFirst(
  db: D1Database,
  sql: string,
  binds: unknown[],
): Promise<JsonRecord> {
  try {
    return await db.prepare(sql).bind(...binds).first<JsonRecord>() ?? {};
  } catch {
    return {};
  }
}

export async function ensureManifestReadySnapshotTable(_db: D1Database): Promise<void> {
  // Schema ownership is exclusively lensically-worker/database/migrations/0027_manifest_ready_snapshot.sql.
}


export async function readManifestReadyWatermarks(
  db: D1Database,
  input: {
    brandKey: string;
    accountId: string;
    savedPatternsAppUserId: string;
    sourceMinimumVerifiedLikes: number;
  },
): Promise<ManifestReadySnapshotWatermarks> {
  const [brief, qualified, derived, ownerRevision] = await Promise.all([
    safeFirst(
      db,
      `SELECT id, generated_at FROM operator_generation_learning_briefs
       WHERE brand_key = ? AND active = 1
       ORDER BY datetime(generated_at) DESC LIMIT 1`,
      [input.brandKey],
    ),
    safeFirst(
      db,
      `SELECT COUNT(*) AS total, MAX(updated_at) AS latest_updated_at
       FROM external_patterns
       WHERE app_user_id = ? AND account_id = ? AND likes >= ?`,
      [input.savedPatternsAppUserId, input.accountId, input.sourceMinimumVerifiedLikes],
    ),
    safeFirst(
      db,
      `SELECT COUNT(*) AS total, MAX(source_updated_at) AS latest_source_updated_at
       FROM operator_manifest_saved_pattern_intelligence
       WHERE brand_key = ?`,
      [input.brandKey],
    ),
    safeFirst(
      db,
      `SELECT MAX(COALESCE(updated_at, created_at)) AS latest_owner_revision_at
       FROM operator_scheduled_post_revisions
       WHERE brand_key = ? AND editor_type = 'owner'`,
      [input.brandKey],
    ),
  ]);

  return {
    learning_brief_id: text(brief.id),
    learning_generated_at: text(brief.generated_at),
    qualified_pattern_count: integer(qualified.total),
    qualified_pattern_updated_at: text(qualified.latest_updated_at),
    derived_pattern_count: integer(derived.total),
    derived_pattern_updated_at: text(derived.latest_source_updated_at),
    owner_revision_updated_at: text(ownerRevision.latest_owner_revision_at),
  };
}

export async function readManifestReadySnapshot(
  db: D1Database,
  input: {
    brandKey: string;
    accountId: string;
    savedPatternsAppUserId: string;
    sourceMinimumVerifiedLikes: number;
    nowMs: number;
    maxAgeMs?: number;
  },
): Promise<ManifestReadySnapshotAssessment> {
  await ensureManifestReadySnapshotTable(db);
  const [stored, currentWatermarks] = await Promise.all([
    db.prepare(
      `SELECT * FROM operator_manifest_ready_snapshots
       WHERE brand_key = ? LIMIT 1`,
    ).bind(input.brandKey).first<JsonRecord>(),
    readManifestReadyWatermarks(db, input),
  ]);
  return assessManifestReadySnapshot({
    stored: stored ?? null,
    currentWatermarks,
    nowMs: input.nowMs,
    maxAgeMs: input.maxAgeMs,
  });
}

export async function writeManifestReadySnapshot(
  db: D1Database,
  input: {
    brandKey: string;
    accountId: string;
    savedPatternsAppUserId: string;
    sourceMinimumVerifiedLikes: number;
    learningBriefId: string;
    generatedAt: string;
    payload: JsonRecord;
  },
): Promise<JsonRecord> {
  await ensureManifestReadySnapshotTable(db);
  const watermarks = await readManifestReadyWatermarks(db, input);
  const id = `manifest-ready:${input.brandKey}`;
  const payload = {
    ...input.payload,
    manifest_layers_finalized: true,
    snapshot_version: MANIFEST_READY_SNAPSHOT_VERSION,
  };
  await db.prepare(
    `INSERT INTO operator_manifest_ready_snapshots (
      id, brand_key, snapshot_version, learning_brief_id, generated_at,
      watermark_json, payload_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(brand_key) DO UPDATE SET
      id = excluded.id,
      snapshot_version = excluded.snapshot_version,
      learning_brief_id = excluded.learning_brief_id,
      generated_at = excluded.generated_at,
      watermark_json = excluded.watermark_json,
      payload_json = excluded.payload_json,
      updated_at = CURRENT_TIMESTAMP`,
  ).bind(
    id,
    input.brandKey,
    MANIFEST_READY_SNAPSHOT_VERSION,
    input.learningBriefId,
    input.generatedAt,
    stableJson(watermarks),
    stableJson(payload),
  ).run();
  return {
    id,
    brand_key: input.brandKey,
    snapshot_version: MANIFEST_READY_SNAPSHOT_VERSION,
    learning_brief_id: input.learningBriefId,
    generated_at: input.generatedAt,
    watermarks,
    payload,
  };
}
