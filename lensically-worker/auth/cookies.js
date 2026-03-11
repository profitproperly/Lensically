export const SESSION_COOKIE_NAME = "__Host-session_token";
export const LEGACY_SESSION_COOKIE_NAME = "session_token";
export const THREADS_OAUTH_STATE_COOKIE_NAME = "lensically_oauth_state";

const COOKIE_PATH = "/";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

function buildCookie(name, value, { maxAge, sameSite = "Lax" }) {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=${sameSite}; Path=${COOKIE_PATH}; Max-Age=${maxAge}`;
}

export function clearCookie(name, sameSite = "Lax") {
  return buildCookie(name, "", { maxAge: 0, sameSite });
}

export function setSessionCookie(sessionToken) {
  return buildCookie(SESSION_COOKIE_NAME, sessionToken, {
    maxAge: SESSION_MAX_AGE_SECONDS,
    sameSite: "Lax",
  });
}

export function clearSessionCookie() {
  return clearCookie(SESSION_COOKIE_NAME, "Lax");
}

export function clearLegacySessionCookie() {
  return clearCookie(LEGACY_SESSION_COOKIE_NAME, "Lax");
}

export function setOauthStateCookie(name, state) {
  return buildCookie(name, state, {
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    sameSite: "Lax",
  });
}

export function clearOauthStateCookie(name) {
  return clearCookie(name, "Lax");
}

export function clearAuthCookies() {
  return [
    clearSessionCookie(),
    clearLegacySessionCookie(),
    clearOauthStateCookie(THREADS_OAUTH_STATE_COOKIE_NAME),
    clearOauthStateCookie("lensically_oauth_state_google"),
    clearOauthStateCookie("lensically_oauth_state_github"),
    clearOauthStateCookie("lensically_oauth_state_discord"),
  ];
}
