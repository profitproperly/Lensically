import { requireAuth } from "./requireAuth.js";

function normalizeTimezone(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    return trimmed;
  } catch {
    return null;
  }
}

function normalizeClockFormat(value) {
  if (value === "24h") {
    return "24h";
  }
  if (value === "12h") {
    return "12h";
  }
  return null;
}

async function listUserColumns(env) {
  const result = await env.DB.prepare("PRAGMA table_info(users)").all();
  const rows = Array.isArray(result?.results) ? result.results : [];
  return rows
    .map((row) => (typeof row?.name === "string" ? row.name : ""))
    .filter((name) => name.length > 0);
}

async function ensurePreferenceColumns(env) {
  const columns = await listUserColumns(env);

  if (!columns.includes("timezone")) {
    await env.DB.prepare("ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC'").run();
  }

  if (!columns.includes("clock_format")) {
    await env.DB.prepare(
      "ALTER TABLE users ADD COLUMN clock_format TEXT NOT NULL DEFAULT '12h' CHECK (clock_format IN ('12h', '24h'))",
    ).run();
  }
}

export async function updatePreferences(request, env) {
  const authUser = await requireAuth(request, env);
  if (authUser instanceof Response) {
    return authUser;
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const timezone = normalizeTimezone(payload?.timezone);
  const clockFormat = normalizeClockFormat(payload?.clock_format);

  if (!timezone) {
    return new Response(JSON.stringify({ error: "timezone must be a valid IANA timezone" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!clockFormat) {
    return new Response(JSON.stringify({ error: "clock_format must be either 12h or 24h" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await ensurePreferenceColumns(env);

  await env.DB.prepare(
    `UPDATE users
     SET timezone = ?, clock_format = ?
     WHERE id = ?`,
  )
    .bind(timezone, clockFormat, authUser.id)
    .run();

  return new Response(JSON.stringify({
    success: true,
    user: {
      id: authUser.id,
      timezone,
      clock_format: clockFormat,
    },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
