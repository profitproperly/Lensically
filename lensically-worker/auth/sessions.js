import { LEGACY_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "./cookies.js";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function generateSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getCookie(request, name) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = cookie.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

export function getSessionCookieValue(request) {
  return getCookie(request, SESSION_COOKIE_NAME) ?? getCookie(request, LEGACY_SESSION_COOKIE_NAME);
}

export async function createSession(env, userId, request) {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const ipAddress =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const userAgent = request.headers.get("user-agent");

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, session_token, expires_at, created_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
  )
    .bind(crypto.randomUUID(), userId, sessionToken, expiresAt, ipAddress, userAgent)
    .run();

  return sessionToken;
}

export async function getSession(env, request) {
  const sessionToken = getSessionCookieValue(request);
  if (!sessionToken) {
    return null;
  }

  const session = await env.DB.prepare(
    `SELECT id, user_id, session_token, expires_at, created_at, ip_address, user_agent
     FROM sessions
     WHERE session_token = ?
     LIMIT 1`,
  )
    .bind(sessionToken)
    .first();

  if (!session) {
    return null;
  }

  const expiresAt = new Date(session.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE session_token = ?").bind(sessionToken).run();
    return null;
  }

  return session;
}

export async function destroySession(env, request) {
  const sessionToken = getSessionCookieValue(request);
  if (!sessionToken) {
    return;
  }

  await env.DB.prepare("DELETE FROM sessions WHERE session_token = ?").bind(sessionToken).run();
}
