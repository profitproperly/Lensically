type LimitColumn =
  | "me_calls"
  | "insights_calls"
  | "publish_calls"
  | "keyword_calls"
  | "discovery_calls";

type LimitEnv = {
  DB: D1Database;
};

type UsageRow = {
  me_calls: number;
  insights_calls: number;
  publish_calls: number;
  keyword_calls: number;
  discovery_calls: number;
};

const ALLOWED_COLUMNS: ReadonlySet<LimitColumn> = new Set([
  "me_calls",
  "insights_calls",
  "publish_calls",
  "keyword_calls",
  "discovery_calls",
]);

function dailyLimitResponse(): Response {
  return new Response(JSON.stringify({ error: "daily limit reached" }), {
    status: 429,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}

export async function enforceLimit(
  env: LimitEnv,
  userId: string,
  column: LimitColumn,
  limit: number,
): Promise<void> {
  if (!ALLOWED_COLUMNS.has(column)) {
    throw new Error(`Invalid usage column: ${column}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  let row = await env.DB.prepare(
    `SELECT me_calls, insights_calls, publish_calls, keyword_calls, discovery_calls
     FROM user_daily_usage
     WHERE user_id = ? AND date = ?`,
  )
    .bind(userId, today)
    .first<UsageRow>();

  if (!row) {
    await env.DB.prepare(
      "INSERT INTO user_daily_usage (user_id, date) VALUES (?, ?)",
    )
      .bind(userId, today)
      .run();

    row = {
      me_calls: 0,
      insights_calls: 0,
      publish_calls: 0,
      keyword_calls: 0,
      discovery_calls: 0,
    };
  }

  const current = Number(row[column] ?? 0);
  if (current >= limit) {
    throw dailyLimitResponse();
  }

  await env.DB.prepare(
    `UPDATE user_daily_usage
     SET ${column} = ${column} + 1
     WHERE user_id = ? AND date = ?`,
  )
    .bind(userId, today)
    .run();
}
