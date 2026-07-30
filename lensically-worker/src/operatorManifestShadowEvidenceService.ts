import type { ManifestShadowEvidence, ManifestShadowSlot } from "./operatorManifestShadowRuntimeService";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

async function firstOrNull(
  db: D1Database,
  sql: string,
  bindings: unknown[] = [],
): Promise<JsonRecord | null> {
  try {
    return await db.prepare(sql).bind(...bindings).first<JsonRecord>();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table|no such column/i.test(message)) return null;
    throw error;
  }
}

async function rowsOrEmpty(
  db: D1Database,
  sql: string,
  bindings: unknown[] = [],
): Promise<JsonRecord[]> {
  try {
    const result = await db.prepare(sql).bind(...bindings).all<JsonRecord>();
    return result.results ?? [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table|no such column/i.test(message)) return [];
    throw error;
  }
}

function parseJson(value: unknown): JsonRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonRecord : null;
  } catch {
    return null;
  }
}

function compactRow(row: JsonRecord | null, jsonFields: string[] = []): JsonRecord | null {
  if (!row) return null;
  const output: JsonRecord = { ...row };
  for (const field of jsonFields) {
    if (field in output) output[field.replace(/_json$/, "")] = parseJson(output[field]);
    delete output[field];
  }
  return output;
}

const FINGERPRINT_TABLES = [
  ["scheduled_posts", "updated_at"],
  ["gpt_generation_runs", "updated_at"],
  ["gpt_generation_drafts", "updated_at"],
  ["gpt_post_strategy_tags", "updated_at"],
  ["operator_autonomous_growth_cycles", "updated_at"],
  ["operator_manifest_cycle_strategies", "created_at"],
  ["operator_manifest_post_hypotheses", "updated_at"],
  ["operator_manifest_experiment_assignments", "created_at"],
  ["operator_manifest_decision_influences", "created_at"],
  ["operator_manifest_semantic_signatures", "updated_at"],
  ["operator_source_selections", "selected_at"],
  ["operator_source_selection_receipts", "created_at"],
] as const;

export async function readManifestShadowProductionFingerprint(
  db: D1Database,
): Promise<JsonRecord> {
  const fingerprint: JsonRecord = {};
  for (const [table, timeColumn] of FINGERPRINT_TABLES) {
    const row = await firstOrNull(
      db,
      `SELECT COUNT(*) AS row_count, MAX(${timeColumn}) AS latest_change FROM ${table}`,
    );
    fingerprint[table] = row ?? { row_count: 0, latest_change: null, unavailable: true };
  }
  return fingerprint;
}

export async function readManifestShadowEvidence(
  db: D1Database,
  input: {
    brandKey: string;
    threadsUserId: string;
    nowIso: string;
    evidenceMode: "snapshot" | "live_read";
  },
): Promise<ManifestShadowEvidence> {
  const [
    strategyRow,
    briefRow,
    contentFocusRow,
    hardBans,
    strongestPosts,
    weakestPosts,
    recentPublished,
    futureScheduled,
    fingerprint,
    latestMetric,
    latestLearning,
  ] = await Promise.all([
    firstOrNull(db, `SELECT * FROM operator_manifest_cycle_strategies WHERE brand_key = ? ORDER BY datetime(created_at) DESC LIMIT 1`, [input.brandKey]),
    firstOrNull(db, `SELECT * FROM operator_generation_learning_briefs WHERE brand_key = ? AND active = 1 ORDER BY datetime(generated_at) DESC LIMIT 1`, [input.brandKey]),
    firstOrNull(db, `SELECT * FROM operator_content_focus_reviews WHERE brand_key = ? ORDER BY datetime(created_at) DESC LIMIT 1`, [input.brandKey]),
    rowsOrEmpty(db, `SELECT id, rule_key, rule_type, phrase, pattern, rule_text, body, description, active, source_authority FROM operator_manifest_hard_bans WHERE brand_key = ? AND active = 1 ORDER BY rule_key`, [input.brandKey]),
    rowsOrEmpty(db, `SELECT post_id, post_text, post_timestamp, views, likes, replies, reposts, quotes, shares, engagement_total FROM threads_posts_archive WHERE threads_user_id = ? AND datetime(substr(post_timestamp, 1, 19)) >= datetime(?, '-28 days') ORDER BY likes DESC, views DESC, datetime(post_timestamp) DESC LIMIT 12`, [input.threadsUserId, input.nowIso]),
    rowsOrEmpty(db, `SELECT post_id, post_text, post_timestamp, views, likes, replies, reposts, quotes, shares, engagement_total FROM threads_posts_archive WHERE threads_user_id = ? AND datetime(substr(post_timestamp, 1, 19)) >= datetime(?, '-28 days') ORDER BY likes ASC, views ASC, datetime(post_timestamp) DESC LIMIT 12`, [input.threadsUserId, input.nowIso]),
    rowsOrEmpty(db, `SELECT post_id, post_text, post_timestamp, views, likes, replies, reposts, quotes, shares, engagement_total FROM threads_posts_archive WHERE threads_user_id = ? AND datetime(substr(post_timestamp, 1, 19)) >= datetime(?, '-72 hours') ORDER BY datetime(post_timestamp) DESC LIMIT 40`, [input.threadsUserId, input.nowIso]),
    rowsOrEmpty(db, `SELECT id, post_text, status, scheduled_time, published_post_id FROM scheduled_posts WHERE threads_user_id = ? AND datetime(scheduled_time) >= datetime(?) ORDER BY datetime(scheduled_time) ASC LIMIT 72`, [input.threadsUserId, input.nowIso]),
    readManifestShadowProductionFingerprint(db),
    firstOrNull(db, `SELECT MAX(observed_at) AS latest_metric_at, COUNT(*) AS metric_count FROM operator_post_metric_snapshots WHERE brand_key = ?`, [input.brandKey]),
    firstOrNull(db, `SELECT MAX(generated_at) AS latest_learning_at, COUNT(*) AS learning_count FROM operator_generation_learning_briefs WHERE brand_key = ?`, [input.brandKey]),
  ]);

  const strategy = compactRow(strategyRow, [
    "account_conclusion_json",
    "content_focus_json",
    "benchmarks_json",
    "strongest_json",
    "weakest_json",
    "directives_json",
    "experiments_json",
    "risks_json",
    "lineup_json",
  ]);
  const learningBrief = compactRow(briefRow, ["brief_json", "evidence_json"]);
  const contentFocus = compactRow(contentFocusRow, ["review_json", "evidence_json"]);
  const freshness = {
    evidence_mode: input.evidenceMode,
    captured_at: input.nowIso,
    latest_metric_at: latestMetric?.latest_metric_at ?? null,
    metric_count: Number(latestMetric?.metric_count ?? 0),
    latest_learning_at: latestLearning?.latest_learning_at ?? null,
    learning_count: Number(latestLearning?.learning_count ?? 0),
    stale: false,
    bounded_delta_refresh_required: false,
    full_rebuild_required: false,
  };
  const evidenceGaps: JsonRecord[] = [];
  if (!strategy) evidenceGaps.push({ gap_key: "strategy_unavailable", blocking: false });
  if (!learningBrief) evidenceGaps.push({ gap_key: "learning_brief_unavailable", blocking: false });
  if (!strongestPosts.length) evidenceGaps.push({ gap_key: "mature_post_evidence_unavailable", blocking: false });
  return {
    captured_at: input.nowIso,
    strategy,
    learning_brief: learningBrief,
    content_focus: contentFocus,
    hard_bans: hardBans,
    strongest_posts: strongestPosts,
    weakest_posts: weakestPosts,
    recent_published: recentPublished,
    future_scheduled: futureScheduled,
    evidence_gaps: evidenceGaps,
    production_fingerprint: fingerprint,
    freshness,
  };
}

function timeZoneParts(date: Date, timezone: string): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function localDateTimeToUtc(localDate: string, localTime: string, timezone: string): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  let candidate = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const observed = timeZoneParts(new Date(candidate), timezone);
    const observedUtc = Date.UTC(
      Number(observed.date.slice(0, 4)),
      Number(observed.date.slice(5, 7)) - 1,
      Number(observed.date.slice(8, 10)),
      observed.hour,
      observed.minute,
    );
    const desiredUtc = Date.UTC(year, month - 1, day, hour, minute);
    const delta = desiredUtc - observedUtc;
    candidate += delta;
    if (delta === 0) break;
  }
  return new Date(candidate).toISOString();
}

export function buildManifestShadowScenarioSlots(input: {
  now: Date;
  timezone: string;
  horizonHours: number;
  scenario: string;
  requestedMissingCount: number;
}): { targetSlots: ManifestShadowSlot[]; occupiedSlotKeys: string[] } {
  const base = new Date(input.now.getTime());
  base.setUTCMinutes(0, 0, 0);
  const targetSlots: ManifestShadowSlot[] = [];
  for (let offset = 1; offset <= input.horizonHours; offset += 1) {
    const instant = new Date(base.getTime() + offset * 3600000);
    const local = timeZoneParts(instant, input.timezone);
    const time = `${String(local.hour).padStart(2, "0")}:00`;
    targetSlots.push({
      key: `${local.date}T${time}`,
      date: local.date,
      time,
      scheduled_utc: localDateTimeToUtc(local.date, time, input.timezone),
    });
  }
  const missingCount = Math.max(0, Math.min(targetSlots.length, input.requestedMissingCount));
  const occupiedCount = Math.max(0, targetSlots.length - missingCount);
  return {
    targetSlots,
    occupiedSlotKeys: targetSlots.slice(0, occupiedCount).map((slot) => slot.key),
  };
}
