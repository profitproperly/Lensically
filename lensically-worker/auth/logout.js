import { clearSessionCookie } from "./cookies.js";

export async function logout(request, env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionMatch = cookieHeader.match(/session_token=([^;]+)/);
  const sessionToken = sessionMatch ? sessionMatch[1] : null;

  if (sessionToken) {
    await env.DB.prepare("DELETE FROM sessions WHERE session_token = ?").bind(sessionToken).run();
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearSessionCookie(),
    },
  });
}
