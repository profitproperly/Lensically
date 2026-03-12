import { getSessionCookieValue } from "./sessions.js";
import { evaluateIdentityAccess } from "./identityControl.js";

function unauthorized(message = "Unauthorized", status = 401) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function requireAuth(request, env) {
  const sessionToken = getSessionCookieValue(request);

  if (!sessionToken) {
    return unauthorized("Unauthorized");
  }

  const row = await env.DB.prepare(
    `SELECT
      sessions.user_id,
      sessions.expires_at,
      users.email,
      users.timezone,
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
    email_verified: row.email_verified,
    is_admin: Boolean(row.is_admin),
    has_password: Boolean(row.password_hash),
  };
}
