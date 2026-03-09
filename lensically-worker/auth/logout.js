import { clearAuthCookies } from "./cookies.js";
import { destroySession } from "./sessions.js";

export async function logout(request, env) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  await destroySession(env, request);

  const headers = new Headers({
    "Content-Type": "application/json",
  });
  for (const cookie of clearAuthCookies()) {
    headers.append("Set-Cookie", cookie);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
}
