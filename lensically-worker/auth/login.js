import bcrypt from "bcryptjs";
import { createSession } from "./sessions.js";
import { setSessionCookie } from "./cookies.js";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

export async function login(request, env) {
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return json({ success: false, error: "Email and password are required" }, 400);
  }

  const user = await env.DB.prepare(
    `SELECT id, email, password_hash, email_verified
     FROM users
     WHERE email = ?
     LIMIT 1`,
  )
    .bind(email)
    .first();

  if (!user) {
    return json({ success: false, error: "Invalid email or password." }, 401);
  }

  if (!user.password_hash) {
    return json({ success: false, error: "Invalid email or password." }, 401);
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    return json({ success: false, error: "Invalid email or password." }, 401);
  }

  if (!user.email_verified) {
    return json({ success: false, error: "Please verify your email before logging in" }, 403);
  }

  const sessionToken = await createSession(env, user.id, request);

  return json(
    {
      success: true,
      message: "Logged in successfully",
    },
    200,
    { "Set-Cookie": setSessionCookie(sessionToken) },
  );
}
