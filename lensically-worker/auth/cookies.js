export function setSessionCookie(sessionToken) {
  return `session_token=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`;
}

export function clearSessionCookie() {
  return "session_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
}
