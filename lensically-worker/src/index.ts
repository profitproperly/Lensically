import { enforceLimit, type EnforceLimitResult, type UsageFeature } from "./utils/enforceLimit";
import { register } from "../auth/register.js";
import { login } from "../auth/login.js";
import { verifyEmail } from "../auth/verifyEmail.js";
import { forgotPassword, resetPassword } from "../auth/passwordReset.js";
import { logout } from "../auth/logout.js";
import { currentUser } from "../auth/me.js";
import { createSession } from "../auth/sessions.js";
import { setSessionCookie } from "../auth/cookies.js";
import { requireAuth } from "../auth/requireAuth.js";

const DEFAULT_APP_URL = "https://app.lensically.com";
const DEFAULT_ROOT_SITE_URL = "https://lensically.com";
const REDIRECT_URI =
  "https://lensically-worker.lensically.workers.dev/auth/threads/callback";
const SCOPES = [
  "threads_basic",
  "threads_manage_insights",
  "threads_keyword_search",
  "threads_profile_discovery",
  "threads_content_publish",
].join(",");
const API_OAUTH_REDIRECT_URI =
  "https://lensically-worker.lensically.workers.dev/api/auth/threads/callback";
const API_OAUTH_SCOPES = [
  "threads_basic",
  "threads_manage_insights",
].join(",");
const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);
const DUPLICATE_EMAIL_OAUTH_ERROR = "duplicate_email";

interface Env {
  THREADS_CLIENT_ID: string;
  THREADS_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_DEV_CLIENT_ID: string;
  GITHUB_DEV_CLIENT_SECRET: string;
  GITHUB_PROD_CLIENT_ID: string;
  GITHUB_PROD_CLIENT_SECRET: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  INTERNAL_API_KEY: string;
  APP_URL?: string;
  ROOT_SITE_URL?: string;
  WEB_APP_URL?: string;
  DB: D1Database;
}

function limitDeniedResponse(
  result: Exclude<EnforceLimitResult, { allowed: true }>,
  feature: UsageFeature,
  request: Request,
  env: Env,
): Response {
  return new Response(
    JSON.stringify({
      error: result.error,
      feature,
      limit: result.limit ?? null,
      used: result.used ?? null,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeadersForRequest(request, env),
      },
    },
  );
}

function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = cookie.trim().split("=");
    if (rawKey === name) {
      return rawValue.join("=");
    }
  }
  return null;
}

function normalizeAppBaseUrl(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function normalizeAppUserId(raw: string | null | undefined): string | null {
  const value = raw?.trim().toLowerCase();
  if (!value) {
    return null;
  }
  return value;
}

type OauthStateContext = {
  appBaseUrl: string;
  appUserId: string | null;
};

type AuthProvider = "google" | "github" | "discord";

type OAuthIdentity = {
  providerUserId: string;
  email: string | null;
};

function buildOauthState(appBaseUrl: string, appUserId: string): string {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const encodedContext = btoa(JSON.stringify({ appBaseUrl, appUserId }));
  return `${nonce}.${encodedContext}`;
}

function parseUrl(raw: string | null | undefined): URL | null {
  if (!raw) {
    return null;
  }
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function getConfiguredAppBaseUrl(env: Env): string {
  return normalizeAppBaseUrl(env.APP_URL)
    ?? DEFAULT_APP_URL;
}

function getConfiguredRootSiteUrl(env: Env): string {
  return normalizeAppBaseUrl(env.ROOT_SITE_URL)
    ?? DEFAULT_ROOT_SITE_URL;
}

function getAllowedAppOrigins(env: Env): Set<string> {
  return new Set([
    getConfiguredAppBaseUrl(env),
    getConfiguredRootSiteUrl(env),
  ]);
}

function isLocalDevHostname(hostname: string | null | undefined): boolean {
  return Boolean(hostname && LOCAL_DEV_HOSTS.has(hostname.trim().toLowerCase()));
}

function isLocalDevelopmentRequest(request: Request): boolean {
  const requestUrl = parseUrl(request.url);
  if (isLocalDevHostname(requestUrl?.hostname)) {
    return true;
  }

  const originUrl = parseUrl(request.headers.get("origin"));
  if (isLocalDevHostname(originUrl?.hostname)) {
    return true;
  }

  const refererUrl = parseUrl(request.headers.get("referer"));
  return isLocalDevHostname(refererUrl?.hostname);
}

function getAuthCorsOrigin(request: Request, env: Env): string {
  const allowedOrigins = getAllowedAppOrigins(env);
  const requestOrigin = normalizeAppBaseUrl(request.headers.get("origin"));
  if (requestOrigin) {
    const requestOriginUrl = parseUrl(requestOrigin);
    if (isLocalDevHostname(requestOriginUrl?.hostname) || allowedOrigins.has(requestOrigin)) {
      return requestOrigin;
    }
  }

  if (isLocalDevelopmentRequest(request)) {
    const refererOrigin = normalizeAppBaseUrl(request.headers.get("referer"));
    if (refererOrigin) {
      return refererOrigin;
    }
  }

  return getConfiguredAppBaseUrl(env);
}

function getCorsHeadersForRequest(request: Request, env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getAuthCorsOrigin(request, env),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };
}

function contextFromState(state: string | null): OauthStateContext | null {
  if (!state) {
    return null;
  }
  const dotIndex = state.indexOf(".");
  if (dotIndex === -1 || dotIndex === state.length - 1) {
    return null;
  }
  const encodedState = state.slice(dotIndex + 1);
  try {
    const decoded = atob(encodedState);
    if (decoded.startsWith("{")) {
      const parsed = JSON.parse(decoded) as { appBaseUrl?: string; appUserId?: string };
      const appBaseUrl = normalizeAppBaseUrl(parsed.appBaseUrl ?? null);
      if (!appBaseUrl) {
        return null;
      }
      return {
        appBaseUrl,
        appUserId: normalizeAppUserId(parsed.appUserId ?? null),
      };
    }
    const appBaseUrl = normalizeAppBaseUrl(decoded);
    if (!appBaseUrl) {
      return null;
    }
    return { appBaseUrl, appUserId: null };
  } catch {
    return null;
  }
}

function oauthStateCookieName(provider: AuthProvider): string {
  return `lensically_oauth_state_${provider}`;
}

function setOauthStateCookie(name: string, state: string): string {
  return `${name}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;
}

function clearOauthStateCookie(name: string): string {
  return `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function getOauthClientCredentials(
  provider: AuthProvider,
  env: Env,
  request: Request,
): { clientId: string; clientSecret: string } | null {
  if (provider === "google") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return null;
    }
    return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  }
  if (provider === "github") {
    if (!env.GITHUB_PROD_CLIENT_ID || !env.GITHUB_PROD_CLIENT_SECRET) {
      return null;
    }
    return {
      clientId: env.GITHUB_PROD_CLIENT_ID,
      clientSecret: env.GITHUB_PROD_CLIENT_SECRET,
    };
  }
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return null;
  }
  return { clientId: env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET };
}

function buildProviderAuthorizationUrl(
  provider: AuthProvider,
  clientId: string,
  callbackUrl: string,
  state: string,
): string {
  if (provider === "google") {
    const authURL = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authURL.searchParams.set("client_id", clientId);
    authURL.searchParams.set("redirect_uri", callbackUrl);
    authURL.searchParams.set("response_type", "code");
    authURL.searchParams.set("scope", "openid email profile");
    authURL.searchParams.set("state", state);
    return authURL.toString();
  }
  if (provider === "github") {
    const authURL = new URL("https://github.com/login/oauth/authorize");
    authURL.searchParams.set("client_id", clientId);
    authURL.searchParams.set("redirect_uri", callbackUrl);
    authURL.searchParams.set("scope", "read:user user:email");
    authURL.searchParams.set("state", state);
    return authURL.toString();
  }
  const authURL = new URL("https://discord.com/oauth2/authorize");
  authURL.searchParams.set("client_id", clientId);
  authURL.searchParams.set("redirect_uri", callbackUrl);
  authURL.searchParams.set("response_type", "code");
  authURL.searchParams.set("scope", "identify email");
  authURL.searchParams.set("state", state);
  return authURL.toString();
}

async function exchangeCodeForAccessToken(
  provider: AuthProvider,
  code: string,
  callbackUrl: string,
  env: Env,
  request: Request,
): Promise<string | null> {
  const credentials = getOauthClientCredentials(provider, env, request);
  if (!credentials) {
    return null;
  }

  const tokenBody = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    code,
    redirect_uri: callbackUrl,
  });

  if (provider === "google") {
    tokenBody.set("grant_type", "authorization_code");
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });
    if (!tokenResp.ok) {
      return null;
    }
    const tokenData = await tokenResp.json() as { access_token?: string };
    return tokenData.access_token ?? null;
  }

  if (provider === "github") {
    const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: tokenBody,
    });
    if (!tokenResp.ok) {
      return null;
    }
    const tokenData = await tokenResp.json() as { access_token?: string };
    return tokenData.access_token ?? null;
  }

  tokenBody.set("grant_type", "authorization_code");
  const tokenResp = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  if (!tokenResp.ok) {
    return null;
  }
  const tokenData = await tokenResp.json() as { access_token?: string };
  return tokenData.access_token ?? null;
}

async function fetchProviderIdentity(
  provider: AuthProvider,
  accessToken: string,
): Promise<OAuthIdentity | null> {
  if (provider === "google") {
    const profileResp = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileResp.ok) {
      return null;
    }
    const profile = await profileResp.json() as { sub?: string; email?: string };
    if (!profile.sub) {
      return null;
    }
    return {
      providerUserId: profile.sub,
      email: typeof profile.email === "string" ? profile.email.trim().toLowerCase() : null,
    };
  }

  if (provider === "github") {
    const profileResp = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Lensically",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!profileResp.ok) {
      return null;
    }
    const profile = await profileResp.json() as { id?: number | string; email?: string | null };
    if (profile.id === undefined || profile.id === null) {
      return null;
    }

    let email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : null;

    if (!email) {
      const emailResp = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "Lensically",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (emailResp.ok) {
        const emailData = await emailResp.json() as Array<{
          email?: string;
          verified?: boolean;
          primary?: boolean;
        }>;
        const selectedEmail =
          emailData.find((entry) => entry.primary && entry.verified && entry.email)?.email
          ?? emailData.find((entry) => entry.verified && entry.email)?.email
          ?? emailData.find((entry) => entry.email)?.email
          ?? null;
        email = selectedEmail ? selectedEmail.trim().toLowerCase() : null;
      }
    }

    return {
      providerUserId: String(profile.id),
      email,
    };
  }

  const profileResp = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileResp.ok) {
    return null;
  }
  const profile = await profileResp.json() as { id?: string; email?: string | null };
  if (!profile.id) {
    return null;
  }
  return {
    providerUserId: profile.id,
    email: typeof profile.email === "string" ? profile.email.trim().toLowerCase() : null,
  };
}

async function getOrCreateOauthUser(
  env: Env,
  provider: AuthProvider,
  providerUserId: string,
  email: string | null,
): Promise<{ id: string; email: string }> {
  const existingOauthUser = await env.DB.prepare(
    `SELECT users.id, users.email
     FROM oauth_accounts
     JOIN users ON users.id = oauth_accounts.user_id
     WHERE oauth_accounts.provider = ?
       AND oauth_accounts.provider_user_id = ?
     LIMIT 1`,
  )
    .bind(provider, providerUserId)
    .first<{ id: string; email: string }>();
  if (existingOauthUser) {
    return existingOauthUser;
  }

  let user = null as { id: string; email: string } | null;
  if (email) {
    user = await env.DB.prepare("SELECT id, email FROM users WHERE email = ? LIMIT 1")
      .bind(email)
      .first<{ id: string; email: string }>();
    if (user) {
      throw new Error(DUPLICATE_EMAIL_OAUTH_ERROR);
    }
  }

  if (!user) {
    const userId = crypto.randomUUID();
    const resolvedEmail = email ?? `${provider}_${providerUserId}@oauth.lensically.local`;
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, email_verified, created_at)
       VALUES (?, ?, NULL, 1, CURRENT_TIMESTAMP)`,
    )
      .bind(userId, resolvedEmail)
      .run();
    user = { id: userId, email: resolvedEmail };
  }

  try {
    await env.DB.prepare(
      `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
      .bind(crypto.randomUUID(), user.id, provider, providerUserId)
      .run();
  } catch {
    const linkedOauthUser = await env.DB.prepare(
      `SELECT users.id, users.email
       FROM oauth_accounts
       JOIN users ON users.id = oauth_accounts.user_id
       WHERE oauth_accounts.provider = ?
         AND oauth_accounts.provider_user_id = ?
       LIMIT 1`,
    )
      .bind(provider, providerUserId)
      .first<{ id: string; email: string }>();
    if (linkedOauthUser) {
      return linkedOauthUser;
    }
    throw new Error("Failed to persist oauth account");
  }

  return user;
}

function buildOauthAppBaseUrl(url: URL, request: Request, env: Env): string {
  const allowedOrigins = getAllowedAppOrigins(env);
  const candidates = [
    normalizeAppBaseUrl(url.searchParams.get("return_to")),
    normalizeAppBaseUrl(request.headers.get("origin")),
    normalizeAppBaseUrl(request.headers.get("referer")),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const candidateUrl = parseUrl(candidate);
    if (isLocalDevHostname(candidateUrl?.hostname) || allowedOrigins.has(candidate)) {
      return candidate;
    }
  }

  return getConfiguredAppBaseUrl(env);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "unknown_error";
  }
}

function withAuthCors(request: Request, env: Env, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", getAuthCorsOrigin(request, env));
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.append("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function ensureAppThreadsTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS app_threads_accounts (
      app_user_id TEXT PRIMARY KEY,
      threads_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
  ).run();
}

type ThreadsAccount = {
  threads_user_id: string;
  access_token: string;
};

async function getThreadsAccountForAppUser(env: Env, appUserId: string): Promise<ThreadsAccount | null> {
  console.log(JSON.stringify({
    event: "THREADS_ACCOUNT_LOOKUP",
    appUserId,
  }));
  await ensureAppThreadsTable(env);
  return env.DB.prepare(
    `SELECT t.threads_user_id, t.access_token
     FROM app_threads_accounts a
     JOIN threads_accounts t ON t.threads_user_id = a.threads_user_id
     WHERE a.app_user_id = ?
     LIMIT 1`,
  )
    .bind(appUserId)
    .first<ThreadsAccount>();
}

async function getThreadsAccountForAppUserWithRetry(
  env: Env,
  appUserId: string,
  attempts = 6,
  delayMs = 500,
): Promise<ThreadsAccount | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const account = await getThreadsAccountForAppUser(env, appUserId);
    if (account) {
      return account;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return null;
}

async function disconnectThreadsAccountForAppUser(
  env: Env,
  appUserId: string,
): Promise<{ disconnected: boolean; threadsUserId: string | null }> {
  await ensureAppThreadsTable(env);

  const existingLink = await env.DB.prepare(
    `SELECT threads_user_id
     FROM app_threads_accounts
     WHERE app_user_id = ?
     LIMIT 1`,
  )
    .bind(appUserId)
    .first<{ threads_user_id: string }>();

  if (!existingLink?.threads_user_id) {
    return { disconnected: false, threadsUserId: null };
  }

  const threadsUserId = existingLink.threads_user_id;

  await env.DB.prepare(
    `DELETE FROM app_threads_accounts
     WHERE app_user_id = ?`,
  )
    .bind(appUserId)
    .run();

  const remainingLinks = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM app_threads_accounts
     WHERE threads_user_id = ?`,
  )
    .bind(threadsUserId)
    .first<{ total: number | string }>();

  if (Number(remainingLinks?.total ?? 0) === 0) {
    await env.DB.prepare(
      `DELETE FROM threads_accounts
       WHERE threads_user_id = ?`,
    )
      .bind(threadsUserId)
      .run();
  }

  return { disconnected: true, threadsUserId };
}

async function checkUserCapacity(
  env: Env,
  threadsUserId: string,
): Promise<Response | null> {
  const existing = await env.DB.prepare(
    "SELECT threads_user_id FROM threads_accounts WHERE threads_user_id = ? LIMIT 1",
  )
    .bind(threadsUserId)
    .first<{ threads_user_id: string }>();

  if (existing) {
    return null;
  }

  const users = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM threads_accounts",
  ).first<{ total: number | string }>();

  if (Number(users?.total ?? 0) >= 500) {
    return new Response(
      JSON.stringify({ error: "user capacity reached" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return null;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const normalizedPath = path !== "/" ? path.replace(/\/+$/, "") : path;
    const isApiPath = normalizedPath.startsWith("/api/") || normalizedPath.startsWith("/auth/threads/");
    const isAuthPath = normalizedPath.startsWith("/api/auth/") || normalizedPath.startsWith("/auth/threads/");
    const requestCorsHeaders = getCorsHeadersForRequest(request, env);
    const applyAuthCors = (response: Response): Response =>
      isAuthPath ? withAuthCors(request, env, response) : response;

    if (request.method === "OPTIONS") {
      const accessControlOrigin = isApiPath
        ? getAuthCorsOrigin(request, env)
        : getConfiguredAppBaseUrl(env);
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": accessControlOrigin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Credentials": "true",
          Vary: "Origin",
        },
      });
    }

    if (path === "/api/auth/register" && request.method === "POST") {
      return applyAuthCors(await register(request, env));
    }

    if (path === "/api/auth/login" && request.method === "POST") {
      return applyAuthCors(await login(request, env));
    }

    if (path === "/api/auth/verify-email" && request.method === "GET") {
      return applyAuthCors(await verifyEmail(request, env));
    }

    if (path === "/api/auth/forgot-password" && request.method === "POST") {
      return applyAuthCors(await forgotPassword(request, env));
    }

    if (path === "/api/auth/reset-password" && request.method === "POST") {
      return applyAuthCors(await resetPassword(request, env));
    }

    if (path === "/api/auth/logout" && request.method === "POST") {
      return applyAuthCors(await logout(request, env));
    }

    if (path === "/api/auth/me" && request.method === "GET") {
      return applyAuthCors(await currentUser(request, env));
    }

    if (
      (normalizedPath === "/api/auth/google/start"
        || normalizedPath === "/api/auth/github/start"
        || normalizedPath === "/api/auth/discord/start")
      && request.method === "GET"
    ) {
      const provider = normalizedPath.includes("/google/")
        ? "google"
        : normalizedPath.includes("/github/")
          ? "github"
          : "discord";
      const appBaseUrl = buildOauthAppBaseUrl(url, request, env);
      const credentials = getOauthClientCredentials(provider, env, request);

      if (!credentials) {
        return applyAuthCors(Response.redirect(`${appBaseUrl}/login?error=server_config`, 302));
      }

      const state = buildOauthState(appBaseUrl, "");
      const callbackUrl = `${url.origin}/api/auth/${provider}/callback`;
      const authURL = buildProviderAuthorizationUrl(
        provider,
        credentials.clientId,
        callbackUrl,
        state,
      );
      const stateCookieName = oauthStateCookieName(provider);

      return applyAuthCors(new Response(null, {
        status: 302,
        headers: {
          Location: authURL,
          "Set-Cookie": setOauthStateCookie(stateCookieName, state),
        },
      }));
    }

    if (
      (normalizedPath === "/api/auth/google/callback"
        || normalizedPath === "/api/auth/github/callback"
        || normalizedPath === "/api/auth/discord/callback")
      && request.method === "GET"
    ) {
      const provider = normalizedPath.includes("/google/")
        ? "google"
        : normalizedPath.includes("/github/")
          ? "github"
          : "discord";
      const stateCookieName = oauthStateCookieName(provider);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const cookieState = getCookieValue(request, stateCookieName);
      const stateContext = contextFromState(state);
      const appBaseUrl =
        stateContext?.appBaseUrl
        ?? getConfiguredAppBaseUrl(env);
      const callbackUrl = `${url.origin}/api/auth/${provider}/callback`;
      const redirectToAuthError = (error: string): Response =>
        applyAuthCors(new Response(null, {
          status: 302,
          headers: {
            Location: `${appBaseUrl}/login?error=${error}`,
            "Set-Cookie": clearOauthStateCookie(stateCookieName),
          },
        }));

      if (provider === "google") {
        const logEvent = (
          event: string,
          extra: Record<string, string | number | boolean | null> = {},
        ): void => {
          console.log(JSON.stringify({
            event,
            provider: "google",
            ...extra,
          }));
        };
        const logError = (
          event: string,
          error: unknown,
          extra: Record<string, string | number | boolean | null> = {},
        ): void => {
          console.error(JSON.stringify({
            event,
            provider: "google",
            error: getErrorMessage(error),
            ...extra,
          }));
        };

        logEvent("GOOGLE_OAUTH_CALLBACK_RECEIVED", {
          hasCode: Boolean(code),
          hasState: Boolean(state),
          hasStateCookie: Boolean(cookieState),
        });

        try {
          logEvent("GOOGLE_OAUTH_STATE_VALIDATION_STARTED");
          if (!code) {
            throw new Error("missing_code");
          }
          if (!state || !cookieState) {
            throw new Error("missing_state_or_cookie_state");
          }
          if (state !== cookieState) {
            throw new Error("state_mismatch");
          }
          logEvent("GOOGLE_OAUTH_STATE_VALIDATION_SUCCEEDED");
        } catch (error) {
          logError("GOOGLE_OAUTH_STATE_VALIDATION_FAILED", error);
          return redirectToAuthError("unexpected");
        }

        let accessToken = "";
        try {
          logEvent("GOOGLE_OAUTH_TOKEN_EXCHANGE_STARTED");
          const maybeToken = await exchangeCodeForAccessToken(
            provider,
            code,
            callbackUrl,
            env,
            request,
          );
          if (!maybeToken) {
            throw new Error("token_exchange_returned_null");
          }
          accessToken = maybeToken;
          logEvent("GOOGLE_OAUTH_TOKEN_EXCHANGE_SUCCEEDED");
        } catch (error) {
          logError("GOOGLE_OAUTH_TOKEN_EXCHANGE_FAILED", error);
          return redirectToAuthError("unexpected");
        }

        let identity = null as OAuthIdentity | null;
        try {
          logEvent("GOOGLE_OAUTH_PROFILE_FETCH_STARTED");
          identity = await fetchProviderIdentity(provider, accessToken);
          if (!identity?.providerUserId) {
            throw new Error("profile_missing_provider_user_id");
          }
          logEvent("GOOGLE_OAUTH_PROFILE_FETCH_SUCCEEDED", {
            hasEmail: Boolean(identity.email),
          });
        } catch (error) {
          logError("GOOGLE_OAUTH_PROFILE_FETCH_FAILED", error);
          return redirectToAuthError("unexpected");
        }

        let user = null as { id: string; email: string } | null;
        try {
          logEvent("GOOGLE_OAUTH_DB_USER_UPSERT_STARTED");
          user = await getOrCreateOauthUser(
            env,
            provider,
            identity.providerUserId,
            identity.email,
          );
          logEvent("GOOGLE_OAUTH_DB_USER_UPSERT_SUCCEEDED", {
            hasUserId: Boolean(user.id),
          });
        } catch (error) {
          logError("GOOGLE_OAUTH_DB_USER_UPSERT_FAILED", error);
          if (getErrorMessage(error) === DUPLICATE_EMAIL_OAUTH_ERROR) {
            return redirectToAuthError(DUPLICATE_EMAIL_OAUTH_ERROR);
          }
          return redirectToAuthError("unexpected");
        }

        let sessionToken = "";
        try {
          logEvent("GOOGLE_OAUTH_SESSION_CREATION_STARTED");
          sessionToken = await createSession(env, user.id, request);
          if (!sessionToken) {
            throw new Error("session_token_empty");
          }
          logEvent("GOOGLE_OAUTH_SESSION_CREATION_SUCCEEDED");
        } catch (error) {
          logError("GOOGLE_OAUTH_SESSION_CREATION_FAILED", error);
          return redirectToAuthError("unexpected");
        }

        const headers = new Headers({
          Location: `${appBaseUrl}/connect`,
        });
        headers.append("Set-Cookie", clearOauthStateCookie(stateCookieName));
        headers.append("Set-Cookie", setSessionCookie(sessionToken));
        logEvent("GOOGLE_OAUTH_CALLBACK_COMPLETED");
        return applyAuthCors(new Response(null, { status: 302, headers }));
      }

      try {
        if (!code) {
          return redirectToAuthError("access_denied");
        }
        if (!state || !cookieState) {
          return redirectToAuthError("state_missing");
        }
        if (state !== cookieState) {
          return redirectToAuthError("state_mismatch");
        }

        const accessToken = await exchangeCodeForAccessToken(
          provider,
          code,
          callbackUrl,
          env,
          request,
        );
        if (!accessToken) {
          return redirectToAuthError("token_exchange_failed");
        }

        const identity = await fetchProviderIdentity(provider, accessToken);
        if (!identity?.providerUserId) {
          return redirectToAuthError("account_lookup_failed");
        }

        const user = await getOrCreateOauthUser(
          env,
          provider,
          identity.providerUserId,
          identity.email,
        );
        const sessionToken = await createSession(env, user.id, request);

        const headers = new Headers({
          Location: `${appBaseUrl}/connect`,
        });
        headers.append("Set-Cookie", clearOauthStateCookie(stateCookieName));
        headers.append("Set-Cookie", setSessionCookie(sessionToken));
        return applyAuthCors(new Response(null, { status: 302, headers }));
      } catch (error) {
        if (getErrorMessage(error) === DUPLICATE_EMAIL_OAUTH_ERROR) {
          return redirectToAuthError(DUPLICATE_EMAIL_OAUTH_ERROR);
        }
        return redirectToAuthError("unexpected");
      }
    }

    if (url.pathname === "/connect/threads") {
      return Response.redirect(
        `${url.origin}/auth/threads/login`,
        302
      );
    }

    if (url.pathname === "/api/auth/threads/start" && request.method === "GET") {
      const requestAppBase =
        buildOauthAppBaseUrl(url, request, env);

      const effectiveAppUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));

      if (!effectiveAppUserId) {
        return applyAuthCors(Response.redirect(`${requestAppBase}/login`, 302));
      }

      const state = buildOauthState(requestAppBase, effectiveAppUserId);
      const authURL = new URL("https://www.threads.net/oauth/authorize");
      authURL.searchParams.set("client_id", env.THREADS_CLIENT_ID);
      authURL.searchParams.set("redirect_uri", API_OAUTH_REDIRECT_URI);
      authURL.searchParams.set("scope", API_OAUTH_SCOPES);
      authURL.searchParams.set("response_type", "code");
      authURL.searchParams.set("state", state);

      return applyAuthCors(new Response(null, {
        status: 302,
        headers: {
          Location: authURL.toString(),
          "Set-Cookie": `lensically_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
        },
      }));
    }

    if (url.pathname === "/api/auth/threads/callback" && request.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const cookieState = getCookieValue(request, "lensically_oauth_state");
      const sessionToken = getCookieValue(request, "session_token");
      const stateContext = contextFromState(state);
      const appBaseUrl =
        stateContext?.appBaseUrl
        ?? getConfiguredAppBaseUrl(env);
      const appUserId = stateContext?.appUserId;
      const redirectToConnectError = (error: string): Response =>
        applyAuthCors(new Response(null, {
          status: 302,
          headers: {
            Location: `${appBaseUrl}/connect?error=${error}`,
            "Set-Cookie": "lensically_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
          },
        }));
      console.log(JSON.stringify({
        event: "THREADS_SESSION_RESOLUTION_STARTED",
        provider: "threads",
        has_session_cookie: Boolean(sessionToken),
      }));
      try {
        if (!sessionToken) {
          throw new Error("session_cookie_missing");
        }
        const resolvedSession = await env.DB.prepare(
          `SELECT user_id
           FROM sessions
           WHERE session_token = ?
           LIMIT 1`,
        )
          .bind(sessionToken)
          .first<{ user_id: string }>();
        if (!resolvedSession?.user_id) {
          throw new Error("session_not_found");
        }
        console.log(JSON.stringify({
          event: "THREADS_SESSION_RESOLUTION_SUCCEEDED",
          provider: "threads",
          has_session_cookie: true,
          session_resolved: true,
          user_id: resolvedSession.user_id,
        }));
      } catch (error) {
        console.error(JSON.stringify({
          event: "THREADS_SESSION_RESOLUTION_FAILED",
          provider: "threads",
          has_session_cookie: Boolean(sessionToken),
          session_resolved: false,
          error: getErrorMessage(error),
        }));
      }

      const logEvent = (
        event: string,
        extra: Record<string, string | number | boolean | null> = {},
      ): void => {
        console.log(JSON.stringify({
          event,
          provider: "threads",
          ...extra,
        }));
      };
      const logError = (
        event: string,
        error: unknown,
        extra: Record<string, string | number | boolean | null> = {},
      ): void => {
        console.error(JSON.stringify({
          event,
          provider: "threads",
          error: getErrorMessage(error),
          ...extra,
        }));
      };

      logEvent("THREADS_OAUTH_CALLBACK_RECEIVED", {
        hasCode: Boolean(code),
        hasState: Boolean(state),
        hasStateCookie: Boolean(cookieState),
        hasAppUserId: Boolean(appUserId),
      });

      let resolvedAppUserId = "";
      try {
        logEvent("THREADS_OAUTH_STATE_VALIDATION_STARTED");
        if (!code) {
          throw new Error("access_denied");
        }
        if (!state || !cookieState) {
          throw new Error("state_missing");
        }
        if (state !== cookieState) {
          throw new Error("state_mismatch");
        }
        if (!appUserId) {
          throw new Error("state_missing");
        }
        if (!env.THREADS_CLIENT_ID || !env.THREADS_CLIENT_SECRET) {
          throw new Error("server_config");
        }
        resolvedAppUserId = appUserId;
        logEvent("THREADS_OAUTH_STATE_VALIDATION_SUCCEEDED");
      } catch (error) {
        logError("THREADS_OAUTH_STATE_VALIDATION_FAILED", error);
        const errorCode = getErrorMessage(error);
        if (
          errorCode === "access_denied"
          || errorCode === "state_missing"
          || errorCode === "state_mismatch"
          || errorCode === "server_config"
        ) {
          return redirectToConnectError(errorCode);
        }
        return redirectToConnectError("unexpected");
      }

      let accessToken = "";
      let expiresIn = 0;
      try {
        logEvent("THREADS_OAUTH_TOKEN_EXCHANGE_STARTED");
        const tokenBody = new URLSearchParams({
          client_id: env.THREADS_CLIENT_ID,
          client_secret: env.THREADS_CLIENT_SECRET,
          redirect_uri: API_OAUTH_REDIRECT_URI,
          grant_type: "authorization_code",
          code,
        });

        const tokenResp = await fetch("https://graph.threads.net/oauth/access_token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: tokenBody,
        });

        if (!tokenResp.ok) {
          throw new Error("token_exchange_failed");
        }

        const shortTokenData = await tokenResp.json() as { access_token?: string };
        const shortToken = shortTokenData.access_token;
        if (!shortToken) {
          throw new Error("token_exchange_failed");
        }

        const longResp = await fetch(
          `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${env.THREADS_CLIENT_SECRET}&access_token=${shortToken}`,
        );

        if (!longResp.ok) {
          throw new Error("token_upgrade_failed");
        }

        const longTokenData = await longResp.json() as {
          access_token?: string;
          expires_in?: number;
        };
        accessToken = longTokenData.access_token ?? "";
        expiresIn = Number(longTokenData.expires_in ?? 0);

        if (!accessToken || !expiresIn) {
          throw new Error("token_upgrade_failed");
        }
        logEvent("THREADS_OAUTH_TOKEN_EXCHANGE_SUCCEEDED");
      } catch (error) {
        logError("THREADS_OAUTH_TOKEN_EXCHANGE_FAILED", error);
        const errorCode = getErrorMessage(error);
        if (errorCode === "token_exchange_failed" || errorCode === "token_upgrade_failed") {
          return redirectToConnectError(errorCode);
        }
        return redirectToConnectError("unexpected");
      }

      let threadsUserId = "";
      try {
        logEvent("THREADS_OAUTH_PROFILE_FETCH_STARTED");
        const meResp = await fetch(
          `https://graph.threads.net/me?fields=id&access_token=${accessToken}`,
        );
        if (!meResp.ok) {
          throw new Error("account_lookup_failed");
        }

        const meData = await meResp.json() as { id?: string };
        if (!meData.id) {
          throw new Error("account_lookup_failed");
        }

        const userCapacityResponse = await checkUserCapacity(env, meData.id);
        if (userCapacityResponse) {
          throw new Error("account_lookup_failed");
        }

        threadsUserId = meData.id;
        logEvent("THREADS_OAUTH_PROFILE_FETCH_SUCCEEDED", {
          hasThreadsUserId: Boolean(threadsUserId),
        });
      } catch (error) {
        logError("THREADS_OAUTH_PROFILE_FETCH_FAILED", error);
        const errorCode = getErrorMessage(error);
        if (errorCode === "account_lookup_failed") {
          return redirectToConnectError(errorCode);
        }
        return redirectToConnectError("unexpected");
      }

      try {
        logEvent("THREADS_OAUTH_ACCOUNT_SAVE_STARTED");
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + expiresIn;

        await env.DB.prepare(
          `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(threads_user_id) DO UPDATE SET
             access_token = excluded.access_token,
             expires_at = excluded.expires_at`,
        )
          .bind(threadsUserId, accessToken, expiresAt, now)
          .run();

        await ensureAppThreadsTable(env);
        await env.DB.prepare(
          `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
           VALUES (?, ?, ?)
           ON CONFLICT(app_user_id) DO UPDATE SET
             threads_user_id = excluded.threads_user_id`,
        )
          .bind(resolvedAppUserId, threadsUserId, now)
          .run();
        logEvent("THREADS_OAUTH_ACCOUNT_LINK_SAVED", {
          resolvedAppUserId,
          threadsUserId,
        });
        logEvent("THREADS_OAUTH_ACCOUNT_SAVE_SUCCEEDED");
      } catch (error) {
        logError("THREADS_OAUTH_ACCOUNT_SAVE_FAILED", error);
        return redirectToConnectError("save_failed");
      }

      logEvent("THREADS_OAUTH_CALLBACK_COMPLETED");
      return applyAuthCors(new Response(null, {
        status: 302,
        headers: {
          Location: `${appBaseUrl}/dashboard`,
          "Set-Cookie": "lensically_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
        },
      }));
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "lensically-worker",
          time: Math.floor(Date.now() / 1000),
        }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }

    if (url.pathname === "/connect/success" && request.method === "GET") {
      const rootSiteUrl = getConfiguredRootSiteUrl(env);
      return new Response(
        `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lensically</title>
  </head>
  <body>
    <p>Threads account connected successfully.</p>
    <a href="${rootSiteUrl}">Return to Lensically</a>
  </body>
</html>`,
        {
          status: 200,
          headers: { "content-type": "text/html; charset=UTF-8" },
        },
      );
    }

    if (url.pathname === "/auth/threads/login") {
      const authURL = new URL("https://graph.threads.net/oauth/authorize");
      authURL.searchParams.set("client_id", env.THREADS_CLIENT_ID);
      authURL.searchParams.set("redirect_uri", REDIRECT_URI);
      authURL.searchParams.set("scope", SCOPES);
      authURL.searchParams.set("response_type", "code");
      return Response.redirect(authURL.toString(), 302);
    }

    if (url.pathname === "/auth/threads/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return new Response(
          JSON.stringify({ error: "Missing OAuth code" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const body = new URLSearchParams({
        client_id: env.THREADS_CLIENT_ID,
        client_secret: env.THREADS_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
        code,
      });

      const tokenResp = await fetch(
        "https://graph.threads.net/oauth/access_token",
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body,
        },
      );

      if (!tokenResp.ok) {
        return new Response(await tokenResp.text(), {
          status: tokenResp.status,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      const shortTokenData = await tokenResp.json() as {
        access_token?: string;
      };
      const shortToken = shortTokenData.access_token;
      if (!shortToken) {
        return new Response(
          JSON.stringify({ error: "Missing short-lived access token" }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const longResp = await fetch(
        `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${env.THREADS_CLIENT_SECRET}&access_token=${shortToken}`,
      );

      if (!longResp.ok) {
        return new Response(await longResp.text(), {
          status: longResp.status,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      const longTokenData = await longResp.json() as {
        access_token?: string;
        expires_in?: number;
      };
      const accessToken = longTokenData.access_token;
      const expiresIn = Number(longTokenData.expires_in ?? 0);

      if (!accessToken || !expiresIn) {
        return new Response(
          JSON.stringify({ error: "Invalid long-lived token response" }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const meResp = await fetch("https://graph.threads.net/v1.0/me?fields=id", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meResp.ok) {
        return new Response(await meResp.text(), {
          status: meResp.status,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      const meData = await meResp.json() as { id?: string };
      if (!meData.id) {
        return new Response(
          JSON.stringify({ error: "Missing Threads user id" }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
      const userCapacityResponse = await checkUserCapacity(env, meData.id);
      if (userCapacityResponse) {
        return userCapacityResponse;
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + expiresIn;

      await env.DB.prepare(
        `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(threads_user_id) DO UPDATE SET
           access_token = excluded.access_token,
           expires_at = excluded.expires_at`,
      )
        .bind(meData.id, accessToken, expiresAt, now)
        .run();

      return Response.redirect(
        `${getConfiguredAppBaseUrl(env)}/connect`,
        302
      );
    }

    if (url.pathname === "/auth/threads/uninstall" && request.method === "POST") {
      return new Response("ok", { status: 200 });
    }

    if (url.pathname === "/auth/threads/delete" && request.method === "POST") {
      return new Response("ok", { status: 200 });
    }

    if (url.pathname === "/api/threads/me" && request.method === "GET") {
      const appUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));
      console.log(JSON.stringify({
        event: "THREADS_ME_REQUEST_RECEIVED",
        appUserId,
      }));
      if (!appUserId) {
        return new Response(
          JSON.stringify({ error: "Missing app_user_id" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }
      const account = await getThreadsAccountForAppUserWithRetry(env, appUserId);
      console.log(JSON.stringify({
        event: "THREADS_ME_LOOKUP_RESULT",
        appUserId,
        found: Boolean(account),
        threadsUserId: account?.threads_user_id ?? null,
      }));

      if (!account) {
        return new Response(
          JSON.stringify({ connected: false }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }

      const meResp = await fetch(
        "https://graph.threads.net/v1.0/me?fields=id,username,name,threads_biography,is_verified,threads_profile_picture_url",
        {
          headers: { Authorization: `Bearer ${account.access_token}` },
        },
      );

      const meJson = await meResp.json() as {
        name?: string;
        username?: string;
        threads_biography?: string;
        is_verified?: boolean;
        threads_profile_picture_url?: string;
      };

      const accountPayload = {
        name: meJson.name ?? null,
        username: meJson.username ?? null,
        threads_biography: meJson.threads_biography ?? null,
        is_verified: meJson.is_verified ?? false,
        threads_profile_picture_url: meJson.threads_profile_picture_url ?? null,
      };

      return new Response(
        JSON.stringify({
          connected: true,
          account: accountPayload,
          ...accountPayload,
        }),
        {
          status: meResp.status,
          headers: {
            "Content-Type": "application/json",
            ...requestCorsHeaders,
          },
        },
      );
    }

    if (url.pathname === "/api/threads/disconnect" && request.method === "POST") {
      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        return new Response(authUser.body, {
          status: authUser.status,
          statusText: authUser.statusText,
          headers: {
            "Content-Type": "application/json",
            ...requestCorsHeaders,
          },
        });
      }

      let payload: { app_user_id?: string } = {};
      try {
        payload = await request.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }

      const appUserId = normalizeAppUserId(payload.app_user_id ?? null);
      if (!appUserId) {
        return new Response(
          JSON.stringify({ error: "Missing app_user_id" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }

      if (authUser.id !== appUserId) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }

      const result = await disconnectThreadsAccountForAppUser(env, appUserId);
      if (!result.disconnected) {
        return new Response(
          JSON.stringify({ error: "Threads account not connected" }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          disconnected: true,
          threads_user_id: result.threadsUserId,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...requestCorsHeaders,
          },
        },
      );
    }

    if (
      (url.pathname === "/api/threads/profile" || url.pathname === "/api/threads/profile_lookup")
      && request.method === "GET"
    ) {
      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        return new Response(authUser.body, {
          status: authUser.status,
          statusText: authUser.statusText,
          headers: {
            "Content-Type": "application/json",
            ...requestCorsHeaders,
          },
        });
      }

      const username = url.searchParams.get("username");
      const appUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));

      if (!username || !appUserId) {
        return new Response(
          JSON.stringify({ error: "missing username or app_user_id" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }

      if (authUser.id !== appUserId) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }

      const account = await getThreadsAccountForAppUser(env, appUserId);

      if (!account) {
        return new Response(
          JSON.stringify({ error: "no connected account" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }
      const limit = await enforceLimit(
        env,
        { id: account.threads_user_id, is_admin: authUser.is_admin },
        "profile_discovery",
      );
      if (!limit.allowed) {
        return limitDeniedResponse(limit, "profile_discovery", request, env);
      }

      const res = await fetch(
        `https://graph.threads.net/v1.0/profile_lookup?username=${username}`,
        {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
          },
        },
      );

      const data = await res.json();

      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/api/threads/posts" && request.method === "GET") {
      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        return new Response(authUser.body, {
          status: authUser.status,
          statusText: authUser.statusText,
          headers: {
            "Content-Type": "application/json",
            ...requestCorsHeaders,
          },
        });
      }

      const appUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));
      const cursor = url.searchParams.get("cursor");
      const cursorDepthParam = Number(url.searchParams.get("cursor_depth") || 0);
      const cursorDepth = Number.isFinite(cursorDepthParam) && cursorDepthParam > 0
        ? cursorDepthParam
        : (cursor ? 2 : 1);
      console.log(JSON.stringify({
        event: "THREADS_POSTS_REQUEST",
        app_user_id: appUserId,
      }));

      if (cursorDepth > 3) {
        return new Response(
          JSON.stringify({
            posts: [],
            has_more: false,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }

      if (!appUserId) {
        return new Response(
          JSON.stringify({ error: "Missing app_user_id" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }

      if (authUser.id !== appUserId) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }

      const account = await getThreadsAccountForAppUser(env, appUserId);
      console.log(JSON.stringify({
        event: "THREADS_ACCOUNT_VALUES",
        threads_user_id: account?.threads_user_id ?? null,
        access_token_present: Boolean(account?.access_token),
        access_token_length: account?.access_token?.length ?? 0,
      }));
      console.log(JSON.stringify({
        event: "THREADS_ACCOUNT_DATA",
        hasAccount: Boolean(account),
        keys: account ? Object.keys(account) : null,
      }));
      console.log(JSON.stringify({
        event: "THREADS_ACCOUNT_LOOKUP_RESULT",
        found: Boolean(account),
      }));

      if (!account || !account.access_token) {
        return new Response(
          JSON.stringify({ error: "Threads access token missing" }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }
      let limitCheck = null as EnforceLimitResult | null;
      try {
        limitCheck = await enforceLimit(
          env,
          { id: account.threads_user_id, is_admin: authUser.is_admin },
          "insights",
        );
        if (limitCheck && limitCheck.allowed === false) {
          console.log(JSON.stringify({
            event: "USAGE_LIMIT_EXCEEDED",
            feature: "insights",
            app_user_id: appUserId,
            limit: "limit" in limitCheck ? (limitCheck.limit ?? null) : null,
            used: "used" in limitCheck ? (limitCheck.used ?? null) : null,
          }));
        }
      } catch (error) {
        console.log(JSON.stringify({
          event: "USAGE_LIMIT_CHECK_FAILED",
          feature: "insights",
          app_user_id: appUserId,
          error: String(error),
        }));
      }

      const params = new URLSearchParams({
        fields:
          "id,text,media_type,permalink,timestamp,username,has_replies,is_quote_post,is_reply",
        limit: "40",
      });
      if (cursor) {
        params.set("after", cursor);
      }

      const requestUrl = `https://graph.threads.net/v1.0/${account.threads_user_id}/threads?${params.toString()}`;
      const postsResp = await fetch(
        requestUrl,
        {
          headers: { Authorization: `Bearer ${account.access_token}` },
        },
      );
      console.log(JSON.stringify({
        event: "THREADS_API_REQUEST",
        url: requestUrl,
      }));
      const postsResponseText = await postsResp.text();
      console.log(JSON.stringify({
        event: "THREADS_API_RESPONSE",
        status: postsResp.status,
        body: postsResponseText,
      }));

      const data = JSON.parse(postsResponseText) as {
        data?: unknown[];
        paging?: {
          next?: string;
          cursors?: {
            after?: string;
          };
        };
      };
      const postsArray = Array.isArray(data.data) ? data.data : [];
      const profileResp = await fetch(
        "https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url",
        {
          headers: { Authorization: `Bearer ${account.access_token}` },
        },
      );
      const profileJson = await profileResp.json() as { threads_profile_picture_url?: string };
      const profilePicture = profileJson?.threads_profile_picture_url ?? null;
      console.log("POST_COUNT", postsArray.length);
      const enrichedPosts = [];
      const batchSize = 10;
      for (let i = 0; i < postsArray.length; i += batchSize) {
        const batch = postsArray.slice(i, i + batchSize);

        const results = await Promise.all(
          batch.map(async (post) => {
            const postId = String((post as { id?: string })?.id ?? "");
            console.log("PROCESSING_POST", postId);
            const basePost = {
              id: (post as { id?: string })?.id,
              text: (post as { text?: string })?.text,
              timestamp: (post as { timestamp?: string })?.timestamp,
              permalink: (post as { permalink?: string })?.permalink,
              username: (post as { username?: string })?.username,
            };

            if (!postId) {
              return {
                ...basePost,
                profile_picture_url: profilePicture,
                views: 0,
                likes: 0,
                replies: 0,
                reposts: 0,
                quotes: 0,
                shares: 0,
              };
            }

            try {
              const metricsResp = await fetch(
                `https://graph.threads.net/v1.0/${postId}/insights?metric=views,likes,replies,reposts,quotes,shares&access_token=${encodeURIComponent(account.access_token)}`,
              );
              if (!metricsResp.ok) {
                console.log("INSIGHTS_REQUEST_FAILED", {
                  postId,
                  text: basePost.text,
                  status: metricsResp.status,
                });
              }

              const metricsJson = await metricsResp.json() as {
                data?: Array<{
                  name?: string;
                  values?: Array<{ value?: number }>;
                  total_value?: { value?: number };
                  link_total_values?: Array<{ value?: number }>;
                }>;
              };
              console.log("THREADS_INSIGHTS_DEBUG", {
                postId: postId,
                status: metricsResp.status,
                response: metricsJson,
              });

              const metricMap: Record<string, number> = {};

              for (const m of metricsJson.data ?? []) {
                const value =
                  m?.values?.[0]?.value ??
                  m?.total_value?.value ??
                  m?.link_total_values?.[0]?.value ??
                  0;

                if (m?.name) {
                  metricMap[m.name] = Number(value ?? 0);
                }
              }

              return {
                ...basePost,
                profile_picture_url: profilePicture,
                views: metricMap.views ?? 0,
                likes: metricMap.likes ?? 0,
                replies: metricMap.replies ?? 0,
                reposts: metricMap.reposts ?? 0,
                quotes: metricMap.quotes ?? 0,
                shares: metricMap.shares ?? 0,
              };
            } catch {
              return {
                ...basePost,
                profile_picture_url: profilePicture,
                views: 0,
                likes: 0,
                replies: 0,
                reposts: 0,
                quotes: 0,
                shares: 0,
              };
            }
          }),
        );

        enrichedPosts.push(...results);
      }
      const hasMore = Boolean(data.paging?.next) && cursorDepth < 3;
      const nextCursor = cursorDepth < 3 ? (data.paging?.cursors?.after || null) : null;

      return new Response(JSON.stringify({
        posts: enrichedPosts,
        next_cursor: nextCursor,
        has_more: hasMore,
      }), {
        status: postsResp.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          ...requestCorsHeaders,
        },
      });
    }

    if (url.pathname === "/api/threads/insights" && request.method === "GET") {
      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        return new Response(authUser.body, {
          status: authUser.status,
          statusText: authUser.statusText,
          headers: {
            "Content-Type": "application/json",
            ...requestCorsHeaders,
          },
        });
      }

      const appUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));
      const threadsUserId = url.searchParams.get("threads_user_id");
      if (!appUserId) {
        return new Response(
          JSON.stringify({ error: "missing app_user_id" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      if (authUser.id !== appUserId) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          {
            status: 403,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const account = await getThreadsAccountForAppUser(env, appUserId);

      if (!account?.access_token || (threadsUserId && threadsUserId !== account.threads_user_id)) {
        return new Response(
          JSON.stringify({ error: "Threads account not connected" }),
          {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
      const limit = await enforceLimit(
        env,
        { id: account.threads_user_id, is_admin: authUser.is_admin },
        "insights",
      );
      if (!limit.allowed) {
        return limitDeniedResponse(limit, "insights", request, env);
      }

      const insightsResp = await fetch(
        "https://graph.threads.net/v1.0/me/threads_insights?metric=views,likes,replies,reposts",
        {
          headers: { Authorization: `Bearer ${account.access_token}` },
        },
      );

      return new Response(await insightsResp.text(), {
        status: insightsResp.status,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

    if (url.pathname === "/api/threads/post-insights" && request.method === "GET") {
      const mediaId = url.searchParams.get("id");
      const appUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));
      if (!mediaId) {
        return new Response(
          JSON.stringify({ error: "missing media id" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      if (!appUserId) {
        return new Response(
          JSON.stringify({ error: "missing app_user_id" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const account = await getThreadsAccountForAppUser(env, appUserId);

      if (!account?.access_token) {
        return new Response(
          JSON.stringify({ error: "no connected account" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const params = new URLSearchParams({
        metric: "views,likes,replies,reposts,quotes,shares",
      });

      const insightsRes = await fetch(
        `https://graph.threads.net/v1.0/${mediaId}/insights?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${account.access_token}` },
        },
      );

      const data = await insightsRes.json();
      return new Response(JSON.stringify(data), {
        status: insightsRes.status,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

    if (url.pathname === "/api/threads/user-insights" && request.method === "GET") {
      const appUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));
      if (!appUserId) {
        return new Response(
          JSON.stringify({ error: "missing app_user_id" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const account = await getThreadsAccountForAppUser(env, appUserId);

      if (!account) {
        return new Response(
          JSON.stringify({ error: "no connected account" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const params = new URLSearchParams({
        metric: "views,likes,replies,reposts,quotes,clicks,followers_count",
      });

      const insightsRes = await fetch(
        `https://graph.threads.net/v1.0/${account.threads_user_id}/threads_insights?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${account.access_token}` },
        },
      );

      const data = await insightsRes.json();
      return new Response(JSON.stringify(data), {
        status: insightsRes.status,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

    if (url.pathname === "/api/threads/search" && request.method === "GET") {
      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        return new Response(authUser.body, {
          status: authUser.status,
          statusText: authUser.statusText,
          headers: {
            "Content-Type": "application/json",
            ...requestCorsHeaders,
          },
        });
      }

      const q = url.searchParams.get("q");
      const appUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));
      if (!q) {
        return new Response(
          JSON.stringify({ error: "missing query parameter q" }),
          { status: 400 },
        );
      }

      const searchType = url.searchParams.get("search_type") || "TOP";
      const searchMode = url.searchParams.get("search_mode") || "KEYWORD";
      const mediaType = url.searchParams.get("media_type");
      const limit = url.searchParams.get("limit") || "25";

      if (!appUserId) {
        return new Response(
          JSON.stringify({ error: "missing app_user_id" }),
          { status: 400 },
        );
      }

      if (authUser.id !== appUserId) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }

      const account = await getThreadsAccountForAppUser(env, appUserId);

      if (!account) {
        return new Response(
          JSON.stringify({ error: "no connected account" }),
          { status: 400 },
        );
      }
      const usageLimit = await enforceLimit(
        env,
        { id: account.threads_user_id, is_admin: authUser.is_admin },
        "keyword_search",
      );
      if (!usageLimit.allowed) {
        return limitDeniedResponse(usageLimit, "keyword_search", request, env);
      }

      const params = new URLSearchParams({
        q,
        search_type: searchType,
        search_mode: searchMode,
        limit,
      });

      if (mediaType) {
        params.append("media_type", mediaType);
      }

      params.append(
        "fields",
        "id,text,media_type,permalink,timestamp,username,has_replies,is_quote_post,is_reply",
      );

      const threadsRes = await fetch(
        `https://graph.threads.net/v1.0/keyword_search?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
          },
        },
      );

      const data = await threadsRes.json();

      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/api/threads/publish" && request.method === "POST") {
      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        return new Response(authUser.body, {
          status: authUser.status,
          statusText: authUser.statusText,
          headers: {
            "Content-Type": "application/json",
            ...requestCorsHeaders,
          },
        });
      }

      let payload: { app_user_id?: string; threads_user_id?: string; text?: string };
      try {
        payload = await request.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const appUserId = normalizeAppUserId(payload.app_user_id ?? null);
      const threadsUserId = payload.threads_user_id?.trim();
      const text = payload.text?.trim();

      if (!appUserId || !threadsUserId || !text) {
        return new Response(
          JSON.stringify({ error: "app_user_id, threads_user_id and text are required" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      if (authUser.id !== appUserId) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          {
            status: 403,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const account = await getThreadsAccountForAppUser(env, appUserId);

      if (!account?.access_token || account.threads_user_id !== threadsUserId) {
        return new Response(
          JSON.stringify({ error: "Threads account not connected" }),
          {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
      const limit = await enforceLimit(
        env,
        { id: account.threads_user_id, is_admin: authUser.is_admin },
        "publish",
      );
      if (!limit.allowed) {
        return limitDeniedResponse(limit, "publish", request, env);
      }

      const publishBody = new URLSearchParams({
        text,
        media_type: "TEXT"
      });
      const publishResp = await fetch("https://graph.threads.net/v1.0/me/threads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: publishBody,
      });

      return new Response(await publishResp.text(), {
        status: publishResp.status,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

    if (url.pathname === "/api/accounts" && request.method === "GET") {
      const result = await env.DB.prepare(
        `SELECT threads_user_id, created_at
         FROM threads_accounts
         ORDER BY created_at DESC`,
      ).all<{ threads_user_id: string; created_at: number }>();

      return new Response(
        JSON.stringify({ accounts: result.results ?? [] }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }

    if (url.pathname === "/internal/refresh-tokens" && request.method === "POST") {
      const key = request.headers.get("x-internal-key");
      if (key !== env.INTERNAL_API_KEY) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      const rows = await env.DB.prepare(
        `SELECT threads_user_id, access_token, expires_at
         FROM threads_accounts`,
      ).all<{ threads_user_id: string; access_token: string; expires_at: number }>();

      const now = Math.floor(Date.now() / 1000);
      const refreshThreshold = now + (7 * 24 * 60 * 60);
      let refreshed = 0;

      for (const row of rows.results ?? []) {
        if (!row.access_token || !row.threads_user_id || !row.expires_at) {
          continue;
        }
        if (row.expires_at >= refreshThreshold) {
          continue;
        }

        const refreshResp = await fetch(
          `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(row.access_token)}`,
        );
        if (!refreshResp.ok) {
          continue;
        }

        const refreshData = await refreshResp.json() as {
          access_token?: string;
          expires_in?: number;
        };
        const newAccessToken = refreshData.access_token;
        const expiresIn = Number(refreshData.expires_in ?? 0);
        if (!newAccessToken || !expiresIn) {
          continue;
        }

        const newExpiresAt = now + expiresIn;
        await env.DB.prepare(
          `UPDATE threads_accounts
           SET access_token = ?, expires_at = ?
           WHERE threads_user_id = ?`,
        )
          .bind(newAccessToken, newExpiresAt, row.threads_user_id)
          .run();
        refreshed += 1;
      }

      return new Response(
        JSON.stringify({ refreshed }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }

    return new Response("Lensically Worker Running", {
      status: 200,
      headers: { "content-type": "text/plain; charset=UTF-8" },
    });
  },
  async scheduled(event, env, ctx) {
    const now = Math.floor(Date.now() / 1000);
    const threshold = now + (7 * 24 * 60 * 60);

    const rows = await env.DB
      .prepare(
        "SELECT threads_user_id, access_token FROM threads_accounts WHERE expires_at <= ?",
      )
      .bind(threshold)
      .all();

    for (const row of rows.results) {
      try {
        const refresh = await fetch(
          `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${row.access_token}`,
        );

        if (!refresh.ok) {
          console.log("refresh failed", row.threads_user_id);
          continue;
        }

        const data: any = await refresh.json();
        const newToken = data.access_token;
        const expiresAt = now + data.expires_in;

        await env.DB.prepare(
          "UPDATE threads_accounts SET access_token = ?, expires_at = ? WHERE threads_user_id = ?",
        )
          .bind(newToken, expiresAt, row.threads_user_id)
          .run();

        console.log("token refreshed", row.threads_user_id);
      } catch (err) {
        console.log("refresh error", err);
      }
    }
  },
} satisfies ExportedHandler<Env>;
