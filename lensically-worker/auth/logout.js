import { clearAuthCookies } from "./cookies.js";
import { destroySession } from "./sessions.js";
import { getSessionCookieValue } from "./sessions.js";
import { logAuthEvent } from "./operationalLog.js";

export async function logout(request, env) {
  if (request.method !== "POST") {
    logAuthEvent("logout_rejected", { reason: "method_not_allowed" });
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const hadSessionCookie = Boolean(getSessionCookieValue(request));
  await destroySession(env, request);
  logAuthEvent("logout_succeeded", { had_session_cookie: hadSessionCookie });

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
