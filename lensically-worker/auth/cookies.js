function clearCookie(name, sameSite = "Lax") {
  return `${name}=; HttpOnly; Secure; SameSite=${sameSite}; Path=/; Max-Age=0`;
}

export function setSessionCookie(sessionToken) {
  return `session_token=${sessionToken}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=2592000`;
}

export function clearSessionCookie() {
  return clearCookie("session_token", "None");
}

export function clearAuthCookies() {
  return [
    clearSessionCookie(),
    clearCookie("lensically_oauth_state"),
    clearCookie("lensically_oauth_state_google"),
    clearCookie("lensically_oauth_state_github"),
    clearCookie("lensically_oauth_state_discord"),
  ];
}
