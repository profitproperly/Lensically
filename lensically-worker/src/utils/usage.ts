export type UsageCounterColumn =
  | "me_calls"
  | "insights_calls"
  | "publish_calls";

export type UsageFeatureName =
  | "me"
  | "insights"
  | "publish";

export type UsageEnv = {
  DB: D1Database;
};

export type DailyFeatureUsageRow = {
  usage_key: string;
  user_id: string;
  feature: UsageFeatureName;
  date: string;
  usage_count: number;
};

export const DAILY_USAGE_LIMITS: Record<UsageCounterColumn, number> = {
  me_calls: 1,
  insights_calls: 11,
  publish_calls: 25,
};

const ALLOWED_USAGE_COLUMNS: ReadonlySet<UsageCounterColumn> = new Set([
  "me_calls",
  "insights_calls",
  "publish_calls",
]);

const USAGE_COLUMN_TO_FEATURE: Record<UsageCounterColumn, UsageFeatureName> = {
  me_calls: "me",
  insights_calls: "insights",
  publish_calls: "publish",
};

export function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function assertAllowedUsageColumn(column: UsageCounterColumn): void {
  if (!ALLOWED_USAGE_COLUMNS.has(column)) {
    throw new Error(`Invalid usage column: ${column}`);
  }
}

function usageFeatureFromColumn(column: UsageCounterColumn): UsageFeatureName {
  assertAllowedUsageColumn(column);
  return USAGE_COLUMN_TO_FEATURE[column];
}

export function buildDailyUsageKey(
  userId: string,
  feature: UsageFeatureName,
  date = getTodayDate(),
): string {
  return `${userId}:${feature}:${date}`;
}

export async function ensureFeatureDailyUsageRow(
  env: UsageEnv,
  userId: string,
  column: UsageCounterColumn,
  date = getTodayDate(),
): Promise<void> {
  const feature = usageFeatureFromColumn(column);
  const usageKey = buildDailyUsageKey(userId, feature, date);

  await env.DB.prepare(
    `INSERT INTO user_usage_feature_daily (usage_key, user_id, feature, date, usage_count)
     VALUES (?, ?, ?, ?, 0)
     ON CONFLICT(usage_key) DO NOTHING`,
  )
    .bind(usageKey, userId, feature, date)
    .run();
}

export async function getDailyUsage(
  env: UsageEnv,
  userId: string,
  column: UsageCounterColumn,
  date = getTodayDate(),
): Promise<DailyFeatureUsageRow> {
  const feature = usageFeatureFromColumn(column);
  const usageKey = buildDailyUsageKey(userId, feature, date);
  await ensureFeatureDailyUsageRow(env, userId, column, date);

  const row = await env.DB.prepare(
    `SELECT usage_key, user_id, feature, date, usage_count
     FROM user_usage_feature_daily
     WHERE usage_key = ?
     LIMIT 1`,
  )
    .bind(usageKey)
    .first<DailyFeatureUsageRow>();

  if (!row) {
    throw new Error("Failed to load daily usage row after ensure");
  }

  return row;
}

export async function incrementDailyUsage(
  env: UsageEnv,
  userId: string,
  column: UsageCounterColumn,
  date = getTodayDate(),
): Promise<DailyFeatureUsageRow> {
  assertAllowedUsageColumn(column);
  const feature = usageFeatureFromColumn(column);
  const usageKey = buildDailyUsageKey(userId, feature, date);
  await ensureFeatureDailyUsageRow(env, userId, column, date);

  const updatedRow = await env.DB.prepare(
    `UPDATE user_usage_feature_daily
     SET usage_count = usage_count + 1
     WHERE usage_key = ?
     RETURNING usage_key, user_id, feature, date, usage_count`,
  )
    .bind(usageKey)
    .first<DailyFeatureUsageRow>();

  if (!updatedRow) {
    throw new Error("Failed to update daily usage row");
  }

  return updatedRow;
}
