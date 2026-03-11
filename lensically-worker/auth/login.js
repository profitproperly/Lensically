import bcrypt from "bcryptjs";
import { createSession } from "./sessions.js";
import { setSessionCookie } from "./cookies.js";
import {
  json,
  normalizeEmail,
  readJsonObject,
  rejectUnexpectedFields,
  validateEmail,
  validatePassword,
} from "./validation.js";
import { logAuthEvent } from "./operationalLog.js";

export async function login(request, env) {
  if (request.method !== "POST") {
    logAuthEvent("login_rejected", { reason: "method_not_allowed" });
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    logAuthEvent("login_rejected", { reason: "invalid_json" });
    return parsed.response ?? json({ success: false, error: "Invalid JSON body" }, 400);
  }
  const { body } = parsed;

  const unexpectedFieldResponse = rejectUnexpectedFields(body, ["email", "password"]);
  if (unexpectedFieldResponse) {
    logAuthEvent("login_rejected", { reason: "unexpected_field" });
    return unexpectedFieldResponse;
  }

  const email = normalizeEmail(body.email);
  const password = typeof body?.password === "string" ? body.password : "";

  const emailError = validateEmail(email, "Email and password are required");
  if (emailError) {
    logAuthEvent("login_rejected", { reason: "invalid_email" });
    return json({ success: false, error: emailError }, 400);
  }

  const passwordError = validatePassword(password, "Email and password are required");
  if (passwordError) {
    logAuthEvent("login_rejected", { reason: "invalid_password" });
    return json({ success: false, error: passwordError }, 400);
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
    logAuthEvent("login_failed", { reason: "credentials_invalid" });
    return json({ success: false, error: "Invalid email or password." }, 401);
  }

  if (!user.password_hash) {
    logAuthEvent("login_failed", { reason: "credentials_invalid" });
    return json({ success: false, error: "Invalid email or password." }, 401);
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    logAuthEvent("login_failed", { reason: "credentials_invalid" });
    return json({ success: false, error: "Invalid email or password." }, 401);
  }

  if (!user.email_verified) {
    logAuthEvent("login_failed", { reason: "email_unverified" });
    return json({ success: false, error: "Please verify your email before logging in" }, 403);
  }

  const sessionToken = await createSession(env, user.id, request);
  logAuthEvent("login_succeeded", { session_created: Boolean(sessionToken) });

  return json(
    {
      success: true,
      message: "Logged in successfully",
    },
    200,
    { "Set-Cookie": setSessionCookie(sessionToken) },
  );
}
