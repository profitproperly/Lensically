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

  return new Response(JSON.stringify({
    success: true,
    message: "Authenticated account deletion request received",
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
