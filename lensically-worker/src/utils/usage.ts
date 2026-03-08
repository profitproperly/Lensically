export type UsageCounterColumn =
  | "me_calls"
  | "insights_calls"
  | "publish_calls"
  | "keyword_calls"
  | "profile_calls";

export type UsageEnv = {
  DB: D1Database;
};

export type DailyUsageRow = {
  user_id: string;
  date: string;
  me_calls: number;
  insights_calls: number;
  publish_calls: number;
  keyword_calls: number;
  profile_calls: number;
};

export const DAILY_USAGE_LIMITS: Record<UsageCounterColumn, number> = {
  me_calls: 2,
  insights_calls: 11,
  publish_calls: 25,
  keyword_calls: 72,
  profile_calls: 50,
};

const ALLOWED_USAGE_COLUMNS: ReadonlySet<UsageCounterColumn> = new Set([
  "me_calls",
  "insights_calls",
  "publish_calls",
  "keyword_calls",
  "profile_calls",
]);

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function assertAllowedUsageColumn(column: UsageCounterColumn): void {
  if (!ALLOWED_USAGE_COLUMNS.has(column)) {
    throw new Error(`Invalid usage column: ${column}`);
  }
}

export async function ensureDailyUsageRow(
  env: UsageEnv,
  userId: string,
  date = getTodayDate(),
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO user_usage_daily (user_id, date)
     VALUES (?, ?)
     ON CONFLICT(user_id, date) DO NOTHING`,
  )
    .bind(userId, date)
    .run();
}

export async function getDailyUsage(
  env: UsageEnv,
  userId: string,
  date = getTodayDate(),
): Promise<DailyUsageRow> {
  await ensureDailyUsageRow(env, userId, date);

  const row = await env.DB.prepare(
    `SELECT user_id, date, me_calls, insights_calls, publish_calls, keyword_calls, profile_calls
     FROM user_usage_daily
     WHERE user_id = ? AND date = ?
     LIMIT 1`,
  )
    .bind(userId, date)
    .first<DailyUsageRow>();

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
): Promise<DailyUsageRow> {
  assertAllowedUsageColumn(column);
  await ensureDailyUsageRow(env, userId, date);

  const updatedRow = await env.DB.prepare(
    `UPDATE user_usage_daily
     SET ${column} = ${column} + 1
     WHERE user_id = ? AND date = ?
     RETURNING user_id, date, me_calls, insights_calls, publish_calls, keyword_calls, profile_calls`,
  )
    .bind(userId, date)
    .first<DailyUsageRow>();

  if (!updatedRow) {
    throw new Error("Failed to update daily usage row");
  }

  return updatedRow;
}
