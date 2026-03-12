import { getSessionCookieValue } from "./sessions.js";
import { evaluateIdentityAccess } from "./identityControl.js";

function unauthorized(message = "Unauthorized", status = 401) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeClockFormat(value) {
  if (value === "24h") {
    return "24h";
  }
  return "12h";
}

function isMissingPreferenceColumnError(error) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("no such column: users.timezone")
    || message.includes("no such column: users.clock_format")
    || message.includes("no such column: timezone")
    || message.includes("no such column: clock_format");
}

async function fetchAuthRow(env, sessionToken) {
  try {
    return await env.DB.prepare(
      `SELECT
        sessions.user_id,
        sessions.expires_at,
        users.email,
        users.timezone,
        users.clock_format,
        users.email_verified,
        users.is_admin,
        users.password_hash
      FROM sessions
      JOIN users
        ON sessions.user_id = users.id
      WHERE sessions.session_token = ?`,
    )
      .bind(sessionToken)
      .first();
  } catch (error) {
    if (!isMissingPreferenceColumnError(error)) {
      throw error;
    }

    const legacyRow = await env.DB.prepare(
      `SELECT
        sessions.user_id,
        sessions.expires_at,
        users.email,
        users.email_verified,
        users.is_admin,
        users.password_hash
      FROM sessions
      JOIN users
        ON sessions.user_id = users.id
      WHERE sessions.session_token = ?`,
    )
      .bind(sessionToken)
      .first();

    if (!legacyRow) {
      return null;
    }

    return {
      ...legacyRow,
      timezone: "UTC",
      clock_format: "12h",
    };
  }
}

export async function requireAuth(request, env) {
  const sessionToken = getSessionCookieValue(request);

  if (!sessionToken) {
    return unauthorized("Unauthorized");
  }

  const row = await fetchAuthRow(env, sessionToken);

  if (!row) {
    return unauthorized("Unauthorized");
  }

  if (new Date(row.expires_at) < new Date()) {
    return unauthorized("Session expired");
  }

  const identityAccess = await evaluateIdentityAccess(env.DB, [
    { type: "email", value: row.email },
  ]);
  if (!identityAccess.allowed && identityAccess.reason === "banned") {
    return unauthorized("Account access is restricted.", 403);
  }

  return {
    id: row.user_id,
    email: row.email,
    timezone: typeof row.timezone === "string" && row.timezone.trim().length > 0 ? row.timezone.trim() : "UTC",
    clock_format: normalizeClockFormat(row.clock_format),
    email_verified: row.email_verified,
    is_admin: Boolean(row.is_admin),
    has_password: Boolean(row.password_hash),
  };
}
