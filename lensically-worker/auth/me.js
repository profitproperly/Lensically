import { requireAuth } from "./requireAuth.js";

function normalizeLoginProvider(value) {
  if (value === "google" || value === "discord" || value === "github") {
    return value;
  }
  return null;
}

function normalizeClockFormat(value) {
  if (value === "24h") {
    return "24h";
  }
  return "12h";
}

function normalizeTimezone(value) {
  if (typeof value !== "string") {
    return "UTC";
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "UTC";
}

export async function currentUser(request, env) {
  const user = await requireAuth(request, env);

  if (user instanceof Response) {
    return user;
  }

  const oauthProviderRow = await env.DB.prepare(
    `SELECT provider
     FROM oauth_accounts
     WHERE user_id = ?
     ORDER BY created_at ASC
     LIMIT 1`,
  )
    .bind(user.id)
    .first();

  const loginProvider = normalizeLoginProvider(oauthProviderRow?.provider);

  return new Response(
    JSON.stringify({
      id: user.id,
      email: user.email,
      timezone: normalizeTimezone(user.timezone),
      clock_format: normalizeClockFormat(user.clock_format),
      email_verified: user.email_verified,
      has_password: user.has_password,
      login_provider: loginProvider,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
