import { requireAuth } from "./requireAuth.js";
import { clearAuthCookies } from "./cookies.js";

export async function deleteAccount(request, env) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const user = await requireAuth(request, env);
  if (user instanceof Response) {
    return user;
  }

  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?")
    .bind(user.id)
    .run();

  await env.DB.prepare("DELETE FROM oauth_accounts WHERE user_id = ?")
    .bind(user.id)
    .run();

  await env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id = ?")
    .bind(user.id)
    .run();

  await env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?")
    .bind(user.id)
    .run();

  await env.DB.prepare("DELETE FROM user_daily_usage WHERE user_id = ?")
    .bind(user.id)
    .run();

  await env.DB.prepare("DELETE FROM user_usage_daily WHERE user_id = ?")
    .bind(user.id)
    .run();

  await env.DB.prepare("DELETE FROM scheduled_posts WHERE user_id = ?")
    .bind(user.id)
    .run();

  const result = await env.DB.prepare("DELETE FROM users WHERE id = ?")
    .bind(user.id)
    .run();

  if (Number(result.meta?.changes ?? 0) === 0) {
    return new Response(JSON.stringify({
      success: false,
      error: "Account not found",
    }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const headers = new Headers({
    "Content-Type": "application/json",
  });
  for (const cookie of clearAuthCookies()) {
    headers.append("Set-Cookie", cookie);
  }

  return new Response(JSON.stringify({
    success: true,
    message: "Account has been permanently deleted",
    user: {
      id: user.id,
      email: user.email,
      email_verified: user.email_verified,
    },
  }), {
    status: 200,
    headers,
  });
}
