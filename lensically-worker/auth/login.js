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
import { evaluateIdentityAccess } from "./identityControl.js";

const GENERIC_LOGIN_ERROR = "Invalid email or password.";
const FAILED_LOGIN_ROUTE = "login-failed";
const FAILED_LOGIN_LIMIT = 10;
const FAILED_LOGIN_WINDOW_MS = 10 * 60 * 1000;
const FAILED_LOGIN_RETENTION_MS = 24 * 60 * 60 * 1000;
const FAILED_LOGIN_BLOCK_ERROR = "Too many failed login attempts. Please wait before trying again.";

function getClientIp(request) {
  const cfConnectingIp = request.headers.get("CF-Connecting-IP")?.trim();
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const forwardedFor = request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim();
  if (forwardedFor) {
    return forwardedFor;
  }

  return "unknown";
}

function getFailedLoginBucketKey(request) {
  return `${FAILED_LOGIN_ROUTE}:${getClientIp(request)}`;
}

function buildFailedLoginBlockedResponse(retryAfterSeconds, resetAt) {
  return json(
    {
      success: false,
      error: FAILED_LOGIN_BLOCK_ERROR,
    },
    429,
    {
      "Retry-After": String(retryAfterSeconds),
      "X-RateLimit-Limit": String(FAILED_LOGIN_LIMIT),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
    },
  );
}

async function enforceFailedLoginThrottle(env, request) {
  const now = Date.now();
  const bucketKey = getFailedLoginBucketKey(request);

  await env.DB.prepare(
    `DELETE FROM auth_rate_limits
     WHERE route = ?
       AND updated_at < ?`,
  )
    .bind(FAILED_LOGIN_ROUTE, now - FAILED_LOGIN_RETENTION_MS)
    .run();

  const row = await env.DB.prepare(
    `SELECT request_count, window_started_at
     FROM auth_rate_limits
     WHERE bucket_key = ?
     LIMIT 1`,
  )
    .bind(bucketKey)
    .first();

  if (!row) {
    return null;
  }

  const requestCount = Number(row.request_count ?? 0);
  const windowStartedAt = Number(row.window_started_at ?? now);
  const resetAt = windowStartedAt + FAILED_LOGIN_WINDOW_MS;

  if (windowStartedAt <= now - FAILED_LOGIN_WINDOW_MS) {
    await env.DB.prepare("DELETE FROM auth_rate_limits WHERE bucket_key = ?")
      .bind(bucketKey)
      .run();
    return null;
  }

  if (requestCount <= FAILED_LOGIN_LIMIT) {
    return null;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
  return buildFailedLoginBlockedResponse(retryAfterSeconds, resetAt);
}

async function recordFailedLoginAttempt(env, request) {
  const now = Date.now();
  const resetWindowBefore = now - FAILED_LOGIN_WINDOW_MS;
  const bucketKey = getFailedLoginBucketKey(request);

  const row = await env.DB.prepare(
    `INSERT INTO auth_rate_limits (bucket_key, route, request_count, window_started_at, updated_at)
     VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(bucket_key) DO UPDATE SET
       request_count = CASE
         WHEN auth_rate_limits.window_started_at <= ? THEN 1
         ELSE auth_rate_limits.request_count + 1
       END,
       window_started_at = CASE
         WHEN auth_rate_limits.window_started_at <= ? THEN excluded.window_started_at
         ELSE auth_rate_limits.window_started_at
       END,
       updated_at = excluded.updated_at
     RETURNING request_count, window_started_at`,
  )
    .bind(bucketKey, FAILED_LOGIN_ROUTE, now, now, resetWindowBefore, resetWindowBefore)
    .first();

  const requestCount = Number(row?.request_count ?? 1);
  const windowStartedAt = Number(row?.window_started_at ?? now);
  const resetAt = windowStartedAt + FAILED_LOGIN_WINDOW_MS;

  if (requestCount <= FAILED_LOGIN_LIMIT) {
    return null;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
  return buildFailedLoginBlockedResponse(retryAfterSeconds, resetAt);
}

async function clearFailedLoginAttempts(env, request) {
  await env.DB.prepare("DELETE FROM auth_rate_limits WHERE bucket_key = ?")
    .bind(getFailedLoginBucketKey(request))
    .run();
}

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

  const identityAccess = await evaluateIdentityAccess(env.DB, [
    { type: "email", value: email },
  ]);
  if (!identityAccess.allowed && identityAccess.reason === "banned") {
    logAuthEvent("login_rejected", {
      reason: "identity_banned",
      identity_type: identityAccess.identity?.type ?? "email",
    });
    return json({
      success: false,
      error: "This identity is not allowed to authenticate.",
    }, 403);
  }

  const passwordError = validatePassword(password, "Email and password are required");
  if (passwordError) {
    logAuthEvent("login_rejected", { reason: "invalid_password" });
    return json({ success: false, error: passwordError }, 400);
  }

  const failedThrottleResponse = await enforceFailedLoginThrottle(env, request);
  if (failedThrottleResponse) {
    logAuthEvent("login_failed_throttled", {
      event_type: "abuse_detection",
      throttle_scope: "ip",
      reason_code: "failed_login_limit_exceeded",
    });
    return failedThrottleResponse;
  }

  async function handleCredentialsFailure(reason) {
    logAuthEvent("login_failed", {
      reason,
      event_type: "abuse_signal",
      signal: "credential_failure",
    });
    const throttledResponse = await recordFailedLoginAttempt(env, request);
    if (throttledResponse) {
      logAuthEvent("login_failed_throttled", {
        event_type: "abuse_detection",
        throttle_scope: "ip",
        reason_code: "failed_login_limit_exceeded",
      });
      return throttledResponse;
    }
    return json({ success: false, error: GENERIC_LOGIN_ERROR }, 401);
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
    return handleCredentialsFailure("credentials_invalid");
  }

  if (!user.password_hash) {
    return handleCredentialsFailure("credentials_invalid");
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    return handleCredentialsFailure("credentials_invalid");
  }

  if (!user.email_verified) {
    return handleCredentialsFailure("email_unverified");
  }

  await clearFailedLoginAttempts(env, request);
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
