import { requireAuth } from "./requireAuth.js";

function normalizeLoginProvider(value) {
  if (value === "google" || value === "discord" || value === "github") {
    return value;
  }
  return null;
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
