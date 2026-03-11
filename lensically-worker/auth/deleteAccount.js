import { requireAuth } from "./requireAuth.js";

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

  return new Response(JSON.stringify({
    success: true,
    message: "Account deleted successfully",
    user: {
      id: user.id,
      email: user.email,
      email_verified: user.email_verified,
    },
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
