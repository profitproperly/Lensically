import { enforceLimit, type EnforceLimitResult, type UsageFeature } from "./utils/enforceLimit";
import {
  enforceAuthRateLimit,
  getAuthRateLimitHeaders,
  type AuthRateLimitRoute,
} from "./utils/authRateLimit";
import { publishTextToThreads } from "./utils/threadsPublishService";
import {
  executeThreadsKeywordSearch,
  validateThreadsKeywordSearchParams,
} from "./utils/threadsKeywordSearchService";
import { register } from "../auth/register.js";
import { login } from "../auth/login.js";
import { verifyEmail } from "../auth/verifyEmail.js";
import { forgotPassword, resetPassword } from "../auth/passwordReset.js";
import { logout } from "../auth/logout.js";
import { currentUser } from "../auth/me.js";
import { deleteAccount } from "../auth/deleteAccount.js";
import { updatePreferences } from "../auth/preferences.js";
import { createSession, getSessionCookieValue } from "../auth/sessions.js";
import {
  clearOauthStateCookie,
  setOauthStateCookie,
  THREADS_OAUTH_STATE_COOKIE_NAME,
  setSessionCookie,
} from "../auth/cookies.js";
import { requireAuth } from "../auth/requireAuth.js";
import { sanitizeForLog, sanitizeLogMessage } from "../auth/logSanitizer.js";
import { evaluateIdentityAccess } from "../auth/identityControl.js";
import { logAuthEvent, logWorkerOperationalEvent } from "../auth/operationalLog.js";

const DEFAULT_APP_URL = "https://app.lensically.com";
const DEFAULT_ROOT_SITE_URL = "https://lensically.com";
const DEFAULT_WORKER_ORIGIN = "https://api.lensically.com";
const THREADS_OAUTH_SCOPES = [
  "threads_basic",
  "threads_manage_insights",
].join(",");
const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);
const DUPLICATE_EMAIL_OAUTH_ERROR = "duplicate_email";
const SCHEDULED_POST_STATUS_APPROVED = "approved";
const SCHEDULED_POST_STATUS_POSTING = "posting";
const SCHEDULED_POST_STATUS_POSTED = "posted";
const DEFAULT_SCHEDULED_POST_MAX_BATCH_SIZE = 25;
const MAX_SCHEDULED_POST_MAX_BATCH_SIZE = 100;
const SCHEDULED_POST_STALE_POSTING_WINDOW_MS = 15 * 60 * 1000;
const SCHEDULED_POST_PUBLISH_CRON = "* * * * *";
const THREADS_TOKEN_REFRESH_CRON = "0 */12 * * *";
const LEGACY_COMBINED_SCHEDULED_CRON = "0 3 * * *";
const IMMEDIATE_PUBLISH_IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;

interface Env {
  THREADS_CLIENT_ID: string;
  THREADS_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_PROD_CLIENT_ID: string;
  GITHUB_PROD_CLIENT_SECRET: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  INTERNAL_API_KEY: string;
  APP_URL?: string;
  ROOT_SITE_URL?: string;
  WORKER_ORIGIN?: string;
  WEB_APP_URL?: string;
  SCHEDULED_POST_BATCH_SIZE?: string;
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

function authRateLimitDeniedResponse(
  request: Request,
  env: Env,
  result: Exclude<Awaited<ReturnType<typeof enforceAuthRateLimit>>, { allowed: true }>,
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: result.error,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeadersForRequest(request, env),
        ...getAuthRateLimitHeaders(result),
      },
    },
  );
}

function resetPasswordTokenErrorResponse(request: Request, env: Env): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: "Invalid or expired reset token.",
    }),
    {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeadersForRequest(request, env),
      },
    },
  );
}

function keywordSearchValidationErrorResponse(
  requestCorsHeaders: Record<string, string>,
  errors: string[],
): Response {
  return new Response(
    JSON.stringify({
      error: "Invalid keyword search parameters.",
      details: errors,
    }),
    {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        ...requestCorsHeaders,
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

function getConfiguredWorkerOrigin(env: Env): string {
  return normalizeAppBaseUrl(env.WORKER_ORIGIN)
    ?? DEFAULT_WORKER_ORIGIN;
}

function getAllowedAppOrigins(env: Env): Set<string> {
  return new Set([
    getConfiguredAppBaseUrl(env),
    getConfiguredRootSiteUrl(env),
  ]);
}

function buildWorkerCallbackUrl(env: Env, path: string): string {
  const workerOrigin = getConfiguredWorkerOrigin(env).replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${workerOrigin}${normalizedPath}`;
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

function getRequestTransportScheme(request: Request): "http" | "https" | "unknown" {
  const requestUrl = parseUrl(request.url);
  if (requestUrl?.protocol === "https:") {
    return "https";
  }
  if (requestUrl?.protocol === "http:") {
    return "http";
  }

  const cfVisitor = request.headers.get("CF-Visitor");
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor) as { scheme?: string };
      const scheme = parsed?.scheme?.toLowerCase();
      if (scheme === "https") {
        return "https";
      }
      if (scheme === "http") {
        return "http";
      }
    } catch {
      // Ignore malformed header and fall through.
    }
  }

  const forwardedProto = request.headers.get("X-Forwarded-Proto")?.trim().toLowerCase();
  if (forwardedProto === "https") {
    return "https";
  }
  if (forwardedProto === "http") {
    return "http";
  }

  return "unknown";
}

function buildHttpsRedirectResponse(request: Request): Response {
  const url = new URL(request.url);
  url.protocol = "https:";

  return new Response(null, {
    status: 308,
    headers: {
      Location: url.toString(),
    },
  });
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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
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

function getOauthClientCredentials(
  provider: AuthProvider,
  env: Env,
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
    authURL.searchParams.set("scope", "openid email");
    authURL.searchParams.set("state", state);
    return authURL.toString();
  }
  if (provider === "github") {
    const authURL = new URL("https://github.com/login/oauth/authorize");
    authURL.searchParams.set("client_id", clientId);
    authURL.searchParams.set("redirect_uri", callbackUrl);
    authURL.searchParams.set("scope", "user:email");
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
): Promise<string | null> {
  const credentials = getOauthClientCredentials(provider, env);
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
    return String(sanitizeLogMessage(error.message));
  }
  if (typeof error === "string") {
    return String(sanitizeLogMessage(error));
  }
  try {
    return JSON.stringify(sanitizeForLog(error));
  } catch {
    return "unknown_error";
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("UNIQUE constraint failed");
}

function logWorkerEvent(
  event: string,
  details: Record<string, unknown> = {},
  level: "log" | "error" = "log",
): void {
  logWorkerOperationalEvent(event, details, level);
}

type ScheduledPostStatus =
  | typeof SCHEDULED_POST_STATUS_APPROVED
  | typeof SCHEDULED_POST_STATUS_POSTING
  | typeof SCHEDULED_POST_STATUS_POSTED;

type ScheduledPostTransitionContext = {
  publishRequestId?: string | null;
  publishedPostId?: string | null;
  publishErrorMessage?: string | null;
};

type DueScheduledPost = {
  id: number;
  user_id: string;
  threads_user_id: string;
  post_text: string;
};

type ImmediatePublishIdempotencyRecord = {
  response_status: number | null;
  response_body: string | null;
};

type ThreadsPublishResult = Awaited<ReturnType<typeof publishTextToThreads>>;
type ThreadsPublishSuccessResult = Extract<ThreadsPublishResult, { success: true }>;
type ThreadsPublishFailureCode = Extract<ThreadsPublishResult, { success: false }>["errorCode"];

type AppUserThreadsPublishResult =
  | {
    success: true;
    accountThreadsUserId: string;
    publishResult: ThreadsPublishSuccessResult;
  }
  | {
    success: false;
    accountThreadsUserId: string | null;
    errorCode: ThreadsPublishFailureCode | "threads_account_not_connected" | "threads_publish_exception";
    status?: number;
  };

const SCHEDULED_POST_ALLOWED_TRANSITIONS: Record<ScheduledPostStatus, ReadonlyArray<ScheduledPostStatus>> = {
  [SCHEDULED_POST_STATUS_APPROVED]: [SCHEDULED_POST_STATUS_POSTING],
  [SCHEDULED_POST_STATUS_POSTING]: [SCHEDULED_POST_STATUS_APPROVED, SCHEDULED_POST_STATUS_POSTED],
  [SCHEDULED_POST_STATUS_POSTED]: [],
};

function isScheduledPostTransitionAllowed(from: ScheduledPostStatus, to: ScheduledPostStatus): boolean {
  return SCHEDULED_POST_ALLOWED_TRANSITIONS[from].includes(to);
}

async function transitionScheduledPostStatus(
  env: Env,
  postId: number,
  fromStatus: ScheduledPostStatus,
  toStatus: ScheduledPostStatus,
  context: ScheduledPostTransitionContext = {},
): Promise<boolean> {
  if (!isScheduledPostTransitionAllowed(fromStatus, toStatus)) {
    logWorkerEvent("SCHEDULED_POST_TRANSITION_REJECTED", {
      postId,
      fromStatus,
      toStatus,
      reason: "invalid_transition",
    });
    return false;
  }

  let query = "";
  const bindings: Array<string | number | null> = [];

  if (toStatus === SCHEDULED_POST_STATUS_POSTING) {
    query = `
      UPDATE scheduled_posts
      SET
        status = ?,
        processing_started_at = CURRENT_TIMESTAMP,
        last_attempted_at = CURRENT_TIMESTAMP,
        publish_error_message = NULL
      WHERE id = ? AND status = ?
    `;
    bindings.push(toStatus, postId, fromStatus);
  } else if (toStatus === SCHEDULED_POST_STATUS_POSTED) {
    query = `
      UPDATE scheduled_posts
      SET
        status = ?,
        publish_request_id = ?,
        published_post_id = ?,
        publish_error_message = NULL,
        published_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = ?
    `;
    bindings.push(
      toStatus,
      context.publishRequestId ?? null,
      context.publishedPostId ?? null,
      postId,
      fromStatus,
    );
  } else {
    query = `
      UPDATE scheduled_posts
      SET
        status = ?,
        publish_error_message = ?,
        processing_started_at = NULL
      WHERE id = ? AND status = ?
    `;
    bindings.push(toStatus, context.publishErrorMessage ?? null, postId, fromStatus);
  }

  const result = await env.DB.prepare(query).bind(...bindings).run();
  return Number(result.meta?.changes ?? 0) > 0;
}

async function recoverStalePostingScheduledPosts(env: Env): Promise<void> {
  const staleCutoffIso = new Date(Date.now() - SCHEDULED_POST_STALE_POSTING_WINDOW_MS).toISOString();
  await env.DB.prepare(
    `UPDATE scheduled_posts
     SET
       status = ?,
       publish_error_message = 'publish_interrupted_retry',
       processing_started_at = NULL
     WHERE status = ?
       AND (processing_started_at IS NULL OR processing_started_at <= ?)`,
  )
    .bind(SCHEDULED_POST_STATUS_APPROVED, SCHEDULED_POST_STATUS_POSTING, staleCutoffIso)
    .run();
}

async function doesTableExist(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name = ?
     LIMIT 1`,
  )
    .bind(tableName)
    .first<{ name: string }>();

  return Boolean(row?.name);
}

async function doesColumnExist(env: Env, tableName: string, columnName: string): Promise<boolean> {
  const rows = await env.DB.prepare(`PRAGMA table_info(${tableName})`).all<{ name: string }>();
  for (const row of rows.results ?? []) {
    if (row.name === columnName) {
      return true;
    }
  }
  return false;
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function buildScheduledPostIdempotencyKey(
  appUserId: string,
  threadsUserId: string,
  scheduledUtc: string,
  text: string,
): Promise<string> {
  return sha256Hex(`schedule|${appUserId}|${threadsUserId}|${scheduledUtc}|${text}`);
}

async function buildImmediatePublishRequestHash(
  appUserId: string,
  threadsUserId: string,
  text: string,
): Promise<string> {
  return sha256Hex(`post-now|${appUserId}|${threadsUserId}|${text}`);
}

function getImmediatePublishRequestBucket(nowMs: number = Date.now()): string {
  const bucket = Math.floor(nowMs / IMMEDIATE_PUBLISH_IDEMPOTENCY_WINDOW_MS);
  return String(bucket);
}

function getScheduledPostBatchSize(env: Env): number {
  const parsed = Number(env.SCHEDULED_POST_BATCH_SIZE);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_SCHEDULED_POST_MAX_BATCH_SIZE;
  }
  return Math.min(parsed, MAX_SCHEDULED_POST_MAX_BATCH_SIZE);
}

async function getDueApprovedScheduledPosts(
  env: Env,
  nowIso: string,
  batchSize: number,
): Promise<DueScheduledPost[]> {
  const rows = await env.DB.prepare(
    `SELECT id, user_id, threads_user_id, post_text
     FROM scheduled_posts
     WHERE status = ?
       AND scheduled_time <= ?
       AND (published_post_id IS NULL OR length(trim(published_post_id)) = 0)
     ORDER BY scheduled_time ASC, id ASC
     LIMIT ?`,
  )
    .bind(SCHEDULED_POST_STATUS_APPROVED, nowIso, batchSize)
    .all<DueScheduledPost>();

  return rows.results ?? [];
}

async function publishThreadsTextForAppUser(
  env: Env,
  appUserId: string,
  threadsUserId: string,
  text: string,
): Promise<AppUserThreadsPublishResult> {
  const account = await getThreadsAccountForAppUser(env, appUserId);
  if (!account?.access_token || account.threads_user_id !== threadsUserId) {
    return {
      success: false,
      accountThreadsUserId: account?.threads_user_id ?? null,
      errorCode: "threads_account_not_connected",
    };
  }

  try {
    const publishResult = await publishTextToThreads({
      accessToken: account.access_token,
      threadsUserId: account.threads_user_id,
      text,
    });
    if (!publishResult.success) {
      return {
        success: false,
        accountThreadsUserId: account.threads_user_id,
        errorCode: publishResult.errorCode,
        status: publishResult.status,
      };
    }

    return {
      success: true,
      accountThreadsUserId: account.threads_user_id,
      publishResult,
    };
  } catch {
    return {
      success: false,
      accountThreadsUserId: account.threads_user_id,
      errorCode: "threads_publish_exception",
    };
  }
}

async function getUserTimezonePreference(env: Env, userId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT timezone
     FROM users
     WHERE id = ?
     LIMIT 1`,
  )
    .bind(userId)
    .first<{ timezone: string | null }>();

  if (typeof row?.timezone !== "string") {
    return null;
  }
  const timezone = row.timezone.trim();
  return timezone.length > 0 ? timezone : null;
}

async function getImmediatePublishIdempotentResponse(
  env: Env,
  scope: string,
  appUserId: string,
  threadsUserId: string,
  requestHash: string,
  requestBucket: string,
): Promise<ImmediatePublishIdempotencyRecord | null> {
  const row = await env.DB.prepare(
    `SELECT response_status, response_body
     FROM threads_publish_idempotency
     WHERE scope = ?
       AND app_user_id = ?
       AND threads_user_id = ?
       AND request_hash = ?
       AND request_bucket = ?
     LIMIT 1`,
  )
    .bind(scope, appUserId, threadsUserId, requestHash, requestBucket)
    .first<ImmediatePublishIdempotencyRecord>();

  if (!row?.response_body || !row.response_status) {
    return null;
  }
  return row;
}

async function storeImmediatePublishIdempotentResponse(
  env: Env,
  scope: string,
  appUserId: string,
  threadsUserId: string,
  requestHash: string,
  requestBucket: string,
  responseStatus: number,
  responseBody: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO threads_publish_idempotency (
      scope,
      app_user_id,
      threads_user_id,
      request_hash,
      request_bucket,
      response_status,
      response_body
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      scope,
      appUserId,
      threadsUserId,
      requestHash,
      requestBucket,
      responseStatus,
      responseBody,
    )
    .run();
}

async function processScheduledPost(
  env: Env,
  post: DueScheduledPost,
): Promise<void> {
  const claimed = await transitionScheduledPostStatus(
    env,
    post.id,
    SCHEDULED_POST_STATUS_APPROVED,
    SCHEDULED_POST_STATUS_POSTING,
  );
  if (!claimed) {
    logWorkerEvent("SCHEDULED_POST_PUBLISH_SKIPPED", {
      scheduled_post_id: post.id,
      user_id: post.user_id,
      threads_user_id: post.threads_user_id,
      reason: "claim_not_acquired",
    });
    return;
  }

  logWorkerEvent("SCHEDULED_POST_PUBLISH_ATTEMPT", {
    scheduled_post_id: post.id,
    user_id: post.user_id,
    threads_user_id: post.threads_user_id,
  });

  const publishOutcome = await publishThreadsTextForAppUser(
    env,
    post.user_id,
    post.threads_user_id,
    post.post_text,
  );
  if (!publishOutcome.success) {
    logWorkerEvent("SCHEDULED_POST_PUBLISH_FAILURE", {
      scheduled_post_id: post.id,
      user_id: post.user_id,
      threads_user_id: post.threads_user_id,
      error_code: publishOutcome.errorCode,
      status: publishOutcome.status ?? null,
      linked_threads_user_id: publishOutcome.accountThreadsUserId,
    });
    await transitionScheduledPostStatus(
      env,
      post.id,
      SCHEDULED_POST_STATUS_POSTING,
      SCHEDULED_POST_STATUS_APPROVED,
      {
        publishErrorMessage: publishOutcome.status
          ? `${publishOutcome.errorCode}:${publishOutcome.status}`
          : publishOutcome.errorCode,
      },
    );
    return;
  }

  const { publishResult } = publishOutcome;
  const posted = await transitionScheduledPostStatus(
    env,
    post.id,
    SCHEDULED_POST_STATUS_POSTING,
    SCHEDULED_POST_STATUS_POSTED,
    {
      publishRequestId: publishResult.publishRequestId,
      publishedPostId: publishResult.publishedPostId,
    },
  );
  if (posted) {
    logWorkerEvent("SCHEDULED_POST_PUBLISH_SUCCESS", {
      scheduled_post_id: post.id,
      user_id: post.user_id,
      threads_user_id: post.threads_user_id,
      publish_request_id: publishResult.publishRequestId,
      published_post_id: publishResult.publishedPostId,
    });
    return;
  }

  logWorkerEvent("SCHEDULED_POST_PUBLISH_FAILURE", {
    scheduled_post_id: post.id,
    user_id: post.user_id,
    threads_user_id: post.threads_user_id,
    error_code: "status_transition_failed",
    from_status: SCHEDULED_POST_STATUS_POSTING,
    to_status: SCHEDULED_POST_STATUS_POSTED,
  });
  await transitionScheduledPostStatus(
    env,
    post.id,
    SCHEDULED_POST_STATUS_POSTING,
    SCHEDULED_POST_STATUS_APPROVED,
    { publishErrorMessage: "status_transition_failed" },
  );
}

async function processDueScheduledPosts(env: Env): Promise<void> {
  const scheduledPostsTableExists = await doesTableExist(env, "scheduled_posts");
  if (!scheduledPostsTableExists) {
    return;
  }

  await ensureScheduledPostsTable(env);
  await recoverStalePostingScheduledPosts(env);
  const nowIso = new Date().toISOString();
  const posts = await getDueApprovedScheduledPosts(env, nowIso, getScheduledPostBatchSize(env));

  for (const post of posts) {
    await processScheduledPost(env, post);
  }
}

function withAuthCors(request: Request, env: Env, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", getAuthCorsOrigin(request, env));
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.append("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function withApiCors(request: Request, env: Env, path: string, response: Response): Response {
  const normalizedPath = path !== "/" ? path.replace(/\/+$/, "") : path;
  const isApiPath = normalizedPath.startsWith("/api/") || normalizedPath.startsWith("/auth/threads/");
  if (!isApiPath) {
    return response;
  }

  const headers = new Headers(response.headers);
  const corsHeaders = getCorsHeadersForRequest(request, env);
  headers.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
  headers.set("Access-Control-Allow-Methods", corsHeaders["Access-Control-Allow-Methods"]);
  headers.set("Access-Control-Allow-Headers", corsHeaders["Access-Control-Allow-Headers"]);
  headers.set("Access-Control-Allow-Credentials", corsHeaders["Access-Control-Allow-Credentials"]);
  headers.set("Vary", corsHeaders.Vary);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function forbiddenJsonResponse(
  requestCorsHeaders: Record<string, string>,
  error = "Forbidden",
): Response {
  return new Response(JSON.stringify({ error }), {
    status: 403,
    headers: {
      "Content-Type": "application/json",
      ...requestCorsHeaders,
    },
  });
}

function providerFailureResponse(
  error = "Could not complete the provider request.",
  status = 502,
): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}

function upstreamProviderErrorResponse(
  requestCorsHeaders: Record<string, string>,
  error = "Upstream provider request failed.",
): Response {
  return new Response(JSON.stringify({ error }), {
    status: 502,
    headers: {
      "Content-Type": "application/json",
      ...requestCorsHeaders,
    },
  });
}

function notFoundJsonResponse(requestCorsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: {
      "Content-Type": "application/json",
      ...requestCorsHeaders,
    },
  });
}

async function readJsonSafe(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidIsoTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.test(value);
}

function isValidIanaTimezone(value: string): boolean {
  try {
    // Constructing with an invalid zone throws RangeError.
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function splitLocalDateTime(date: string, time: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} | null {
  if (!isValidIsoDate(date) || !isValidIsoTime(time)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = date.split("-");
  const [hourRaw, minuteRaw, secondRaw = "00"] = time.split(":");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);

  if (
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || !Number.isInteger(day)
    || !Number.isInteger(hour)
    || !Number.isInteger(minute)
    || !Number.isInteger(second)
  ) {
    return null;
  }

  const dateUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    dateUtc.getUTCFullYear() !== year
    || dateUtc.getUTCMonth() !== month - 1
    || dateUtc.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, hour, minute, second };
}

function getPartsInTimeZone(
  timestampMs: number,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } | null {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(timestampMs));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(values.get("year"));
  const month = Number(values.get("month"));
  const day = Number(values.get("day"));
  const hour = Number(values.get("hour"));
  const minute = Number(values.get("minute"));
  const second = Number(values.get("second"));
  if (
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || !Number.isInteger(day)
    || !Number.isInteger(hour)
    || !Number.isInteger(minute)
    || !Number.isInteger(second)
  ) {
    return null;
  }
  return { year, month, day, hour, minute, second };
}

function getTimeZoneOffsetMs(timeZone: string, timestampMs: number): number | null {
  const parts = getPartsInTimeZone(timestampMs, timeZone);
  if (!parts) {
    return null;
  }
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - timestampMs;
}

function convertLocalDateTimeToUtcIso(
  date: string,
  time: string,
  timeZone: string,
): string | null {
  const local = splitLocalDateTime(date, time);
  if (!local || !isValidIanaTimezone(timeZone)) {
    return null;
  }

  const utcGuess = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  const offsetGuess = getTimeZoneOffsetMs(timeZone, utcGuess);
  if (offsetGuess === null) {
    return null;
  }

  let timestampMs = utcGuess - offsetGuess;
  const refinedOffset = getTimeZoneOffsetMs(timeZone, timestampMs);
  if (refinedOffset === null) {
    return null;
  }
  if (refinedOffset !== offsetGuess) {
    timestampMs = utcGuess - refinedOffset;
  }

  const resolved = getPartsInTimeZone(timestampMs, timeZone);
  if (!resolved) {
    return null;
  }
  if (
    resolved.year !== local.year
    || resolved.month !== local.month
    || resolved.day !== local.day
    || resolved.hour !== local.hour
    || resolved.minute !== local.minute
    || resolved.second !== local.second
  ) {
    // Invalid local time (e.g. DST spring-forward gap) or an unresolvable input.
    return null;
  }

  return new Date(timestampMs).toISOString();
}

function isPastUtcTimestamp(utcIso: string, nowMs = Date.now()): boolean {
  const scheduledMs = Date.parse(utcIso);
  if (!Number.isFinite(scheduledMs)) {
    return true;
  }
  return scheduledMs < nowMs;
}

function logUnhandledWorkerError(error: unknown, request: Request, path: string): void {
  logWorkerEvent("UNHANDLED_WORKER_ERROR", {
    path,
    method: request.method,
    error: getErrorMessage(error),
  }, "error");
}

function buildUnhandledErrorResponse(
  request: Request,
  env: Env,
  path: string,
): Response {
  const normalizedPath = path !== "/" ? path.replace(/\/+$/, "") : path;
  const isApiPath = normalizedPath.startsWith("/api/") || normalizedPath.startsWith("/auth/threads/");
  const isAuthPath = normalizedPath.startsWith("/api/auth/") || normalizedPath.startsWith("/auth/threads/");

  if (isApiPath) {
    const payload = isAuthPath
      ? { success: false, error: "An unexpected error occurred. Please try again." }
      : { error: "An unexpected error occurred. Please try again." };

    const response = new Response(JSON.stringify(payload), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeadersForRequest(request, env),
      },
    });

    return isAuthPath ? withAuthCors(request, env, response) : response;
  }

  return new Response("Internal Server Error", {
    status: 500,
    headers: { "content-type": "text/plain; charset=UTF-8" },
  });
}

function resolveAuthenticatedAppUserId(
  authUserId: string,
  requestedAppUserId: string | null,
) {
  if (requestedAppUserId && requestedAppUserId !== authUserId) {
    return null;
  }

  return authUserId;
}

async function readAuthRateLimitBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await request.clone().json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeEmailForRateLimit(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 254 || !normalized.includes("@")) {
    return null;
  }
  return normalized;
}

function normalizeResetTokenForRateLimit(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 120) {
    return null;
  }
  return normalized;
}

async function getAuthRateLimitIdentityKeys(
  request: Request,
  route: AuthRateLimitRoute,
): Promise<string[]> {
  if (route === "delete-account") {
    const sessionToken = getSessionCookieValue(request);
    return sessionToken ? [`session:${sessionToken}`] : [];
  }

  const body = await readAuthRateLimitBody(request);
  if (!body) {
    return [];
  }

  if (route === "login" || route === "register" || route === "forgot-password") {
    const email = normalizeEmailForRateLimit(body.email);
    return email ? [`email:${email}`] : [];
  }

  if (route === "reset-password") {
    const token = normalizeResetTokenForRateLimit(body.token);
    return token ? [`token:${token}`] : [];
  }

  return [];
}

function getIdentityKindFromKey(identityKey: string): string {
  const kind = identityKey.split(":")[0]?.trim().toLowerCase();
  if (!kind) {
    return "unknown";
  }
  return kind.slice(0, 32);
}

function logAuthAbuseEvent(
  request: Request,
  route: AuthRateLimitRoute,
  throttleScope: "ip" | "identity",
  reasonCode: string,
  details: Record<string, unknown> = {},
) {
  logAuthEvent("auth_abuse_detected", {
    event_type: "rate_limit_violation",
    route,
    throttle_scope: throttleScope,
    reason_code: reasonCode,
    request_method: request.method,
    request_path: new URL(request.url).pathname,
    ...details,
  });
}

async function enforceAuthRequestRateLimit(
  request: Request,
  env: Env,
  route: AuthRateLimitRoute,
  options: { includeIp?: boolean; includeIdentity?: boolean } = {},
): Promise<Response | null> {
  const includeIp = options.includeIp ?? true;
  const includeIdentity = options.includeIdentity ?? true;

  try {
    if (includeIp) {
      const result = await enforceAuthRateLimit(env, request, route);
      if (!result.allowed) {
        logAuthAbuseEvent(request, route, "ip", "ip_rate_limit_exceeded", {
          retry_after_seconds: result.retryAfterSeconds,
          limit: result.limit,
        });
        return authRateLimitDeniedResponse(request, env, result);
      }
    }

    if (!includeIdentity) {
      return null;
    }

    const identityKeys = await getAuthRateLimitIdentityKeys(request, route);
    for (const identityKey of identityKeys) {
      const identityResult = await enforceAuthRateLimit(env, request, route, {
        scope: "identity",
        identityKey,
      });
      if (!identityResult.allowed) {
        logAuthAbuseEvent(request, route, "identity", "identity_rate_limit_exceeded", {
          identity_kind: getIdentityKindFromKey(identityKey),
          retry_after_seconds: identityResult.retryAfterSeconds,
          limit: identityResult.limit,
        });
        return authRateLimitDeniedResponse(request, env, identityResult);
      }
    }

    return null;
  } catch (error) {
    logAuthEvent("auth_rate_limit_unavailable", {
      event_type: "failure",
      reason_code: "rate_limit_storage_unavailable",
      route,
      reason: sanitizeLogMessage(error instanceof Error ? error.message : String(error)),
      request: sanitizeForLog({
        method: request.method,
        url: request.url,
      }),
    });
    // Fail open so auth endpoints remain available if rate-limit storage is unavailable.
    return null;
  }
}

async function ensureAppThreadsTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS app_threads_accounts (
      app_user_id TEXT PRIMARY KEY,
      threads_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (app_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  ).run();

  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_app_threads_accounts_user_exists_insert
     BEFORE INSERT ON app_threads_accounts
     FOR EACH ROW
     WHEN NOT EXISTS (
       SELECT 1
       FROM users
       WHERE id = NEW.app_user_id
     )
     BEGIN
       SELECT RAISE(ABORT, 'foreign_key_violation:app_threads_accounts.app_user_id');
     END`,
  ).run();

  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_app_threads_accounts_user_exists_update
     BEFORE UPDATE OF app_user_id ON app_threads_accounts
     FOR EACH ROW
     WHEN NOT EXISTS (
       SELECT 1
       FROM users
       WHERE id = NEW.app_user_id
     )
     BEGIN
       SELECT RAISE(ABORT, 'foreign_key_violation:app_threads_accounts.app_user_id');
     END`,
  ).run();

  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_app_threads_accounts_user_cleanup
     AFTER DELETE ON users
     FOR EACH ROW
     BEGIN
       DELETE FROM app_threads_accounts
       WHERE app_user_id = OLD.id;
     END`,
  ).run();
}

async function ensureScheduledPostsTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS scheduled_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      threads_user_id TEXT NOT NULL CHECK (length(trim(threads_user_id)) > 0),
      post_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'posting', 'posted')),
      scheduled_time TEXT NOT NULL,
      publish_request_id TEXT,
      published_post_id TEXT,
      publish_error_message TEXT,
      idempotency_key TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processing_started_at TEXT,
      published_at TEXT,
      failed_at TEXT,
      cancelled_at TEXT,
      last_attempted_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due
     ON scheduled_posts (status, scheduled_time)`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_id
     ON scheduled_posts (user_id)`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_scheduled_posts_threads_user_id
     ON scheduled_posts (threads_user_id)`,
  ).run();

  const schemaAlignmentColumns: Array<{ name: string; definition: string }> = [
    { name: "publish_request_id", definition: "TEXT" },
    { name: "idempotency_key", definition: "TEXT" },
    { name: "published_at", definition: "TEXT" },
    { name: "failed_at", definition: "TEXT" },
    { name: "cancelled_at", definition: "TEXT" },
    { name: "last_attempted_at", definition: "TEXT" },
  ];
  for (const column of schemaAlignmentColumns) {
    const columnExists = await doesColumnExist(env, "scheduled_posts", column.name);
    if (columnExists) {
      continue;
    }
    await env.DB.prepare(
      `ALTER TABLE scheduled_posts ADD COLUMN ${column.name} ${column.definition}`,
    ).run();
  }

  await env.DB.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_posts_idempotency_key
     ON scheduled_posts (idempotency_key)
     WHERE idempotency_key IS NOT NULL`,
  ).run();

  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_user_exists_insert
     BEFORE INSERT ON scheduled_posts
     FOR EACH ROW
     WHEN NOT EXISTS (
       SELECT 1
       FROM users
       WHERE id = NEW.user_id
     )
     BEGIN
       SELECT RAISE(ABORT, 'foreign_key_violation:scheduled_posts.user_id');
     END`,
  ).run();

  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_user_exists_update
     BEFORE UPDATE OF user_id ON scheduled_posts
     FOR EACH ROW
     WHEN NOT EXISTS (
       SELECT 1
       FROM users
       WHERE id = NEW.user_id
     )
     BEGIN
       SELECT RAISE(ABORT, 'foreign_key_violation:scheduled_posts.user_id');
     END`,
  ).run();

  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_user_cleanup
     AFTER DELETE ON users
     FOR EACH ROW
     BEGIN
       DELETE FROM scheduled_posts
       WHERE user_id = OLD.id;
     END`,
  ).run();

  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_touch_updated_at
     AFTER UPDATE ON scheduled_posts
     FOR EACH ROW
     WHEN NEW.updated_at = OLD.updated_at
     BEGIN
       UPDATE scheduled_posts
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = NEW.id;
     END`,
  ).run();
}

async function ensureImmediatePublishIdempotencyTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS threads_publish_idempotency (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL,
      app_user_id TEXT NOT NULL,
      threads_user_id TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      request_bucket TEXT NOT NULL,
      response_status INTEGER,
      response_body TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(scope, app_user_id, threads_user_id, request_hash, request_bucket),
      FOREIGN KEY (app_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_threads_publish_idempotency_created_at
     ON threads_publish_idempotency (created_at)`,
  ).run();

  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_threads_publish_idempotency_user_exists_insert
     BEFORE INSERT ON threads_publish_idempotency
     FOR EACH ROW
     WHEN NOT EXISTS (
       SELECT 1
       FROM users
       WHERE id = NEW.app_user_id
     )
     BEGIN
       SELECT RAISE(ABORT, 'foreign_key_violation:threads_publish_idempotency.app_user_id');
     END`,
  ).run();

  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_threads_publish_idempotency_user_cleanup
     AFTER DELETE ON users
     FOR EACH ROW
     BEGIN
       DELETE FROM threads_publish_idempotency
       WHERE app_user_id = OLD.id;
     END`,
  ).run();
}

type ThreadsAccount = {
  threads_user_id: string;
  access_token: string;
};

type MetaDeletionRequestRecord = {
  confirmation_code: string;
  platform_user_id: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
};

async function getThreadsAccountForAppUser(env: Env, appUserId: string): Promise<ThreadsAccount | null> {
  logWorkerEvent("THREADS_ACCOUNT_LOOKUP", {
    appUserId,
  });
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

async function ensureMetaDeletionRequestsTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS meta_deletion_requests (
      confirmation_code TEXT PRIMARY KEY,
      platform_user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )`,
  ).run();
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding === 0 ? normalized : normalized.padEnd(normalized.length + (4 - padding), "=");
  return atob(padded);
}

function decodeBase64UrlBytes(value: string): Uint8Array {
  const decoded = decodeBase64Url(value);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

async function parseMetaSignedRequest(
  signedRequest: string,
  appSecret: string,
): Promise<{ user_id?: string | null } | null> {
  const [encodedSignature, encodedPayload] = signedRequest.split(".", 2);
  if (!encodedSignature || !encodedPayload) {
    return null;
  }

  const payloadJson = JSON.parse(decodeBase64Url(encodedPayload)) as {
    algorithm?: string;
    user_id?: string | null;
  };

  if (payloadJson.algorithm?.toUpperCase() !== "HMAC-SHA256") {
    return null;
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signatureVerified = await crypto.subtle.verify(
    "HMAC",
    cryptoKey,
    decodeBase64UrlBytes(encodedSignature),
    new TextEncoder().encode(encodedPayload),
  );

  if (!signatureVerified) {
    return null;
  }

  return payloadJson;
}

async function resolveMetaDeletionUserId(request: Request, env: Env): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";
  const rawBody = await request.text();

  if (!rawBody) {
    return null;
  }

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(rawBody) as {
        signed_request?: string;
        user_id?: string;
      };
      if (typeof parsed.user_id === "string" && parsed.user_id.trim()) {
        return parsed.user_id.trim();
      }
      if (typeof parsed.signed_request !== "string" || !parsed.signed_request.trim()) {
        return null;
      }
      const payload = await parseMetaSignedRequest(parsed.signed_request.trim(), env.THREADS_CLIENT_SECRET);
      return typeof payload?.user_id === "string" && payload.user_id.trim()
        ? payload.user_id.trim()
        : null;
    } catch {
      return null;
    }
  }

  const params = new URLSearchParams(rawBody);
  const directUserId = params.get("user_id")?.trim();
  if (directUserId) {
    return directUserId;
  }

  const signedRequest = params.get("signed_request")?.trim();
  if (!signedRequest) {
    return null;
  }

  const payload = await parseMetaSignedRequest(signedRequest, env.THREADS_CLIENT_SECRET);
  return typeof payload?.user_id === "string" && payload.user_id.trim()
    ? payload.user_id.trim()
    : null;
}

async function processMetaDeletionRequest(
  env: Env,
  platformUserId: string,
): Promise<{ confirmationCode: string; statusUrl: string }> {
  await ensureAppThreadsTable(env);
  await ensureMetaDeletionRequestsTable(env);

  const confirmationCode = crypto.randomUUID();
  const completedAt = new Date().toISOString();

  const dbSession = env.DB.withSession("first-primary");
  let transactionStarted = false;

  try {
    await dbSession.prepare("BEGIN TRANSACTION").run();
    transactionStarted = true;

    await removeThreadsLinkageForPlatformUser(dbSession, platformUserId);

    await dbSession.prepare(
      `INSERT INTO meta_deletion_requests (
        confirmation_code,
        platform_user_id,
        status,
        requested_at,
        completed_at
      ) VALUES (?, ?, 'processed', CURRENT_TIMESTAMP, ?)` ,
    )
      .bind(confirmationCode, platformUserId, completedAt)
      .run();

    await dbSession.prepare("COMMIT").run();
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      await dbSession.prepare("ROLLBACK").run();
    }
    logWorkerEvent("META_DELETION_REQUEST_FAILED", {
      platform_user_id: platformUserId,
      error: getErrorMessage(error),
    }, "error");
    throw error;
  }

  logWorkerEvent("META_DELETION_REQUEST_PROCESSED", {
    platform_user_id: platformUserId,
    confirmation_code: confirmationCode,
  });

  const statusUrl =
    `${getConfiguredWorkerOrigin(env)}/auth/threads/delete-status?confirmation_code=${encodeURIComponent(confirmationCode)}`;

  return { confirmationCode, statusUrl };
}

async function removeThreadsLinkageForPlatformUser(
  db: D1DatabaseSession | D1Database,
  platformUserId: string,
): Promise<void> {
  await db.prepare(
    `DELETE FROM app_threads_accounts
     WHERE threads_user_id = ?`,
  )
    .bind(platformUserId)
    .run();

  await db.prepare(
    `DELETE FROM threads_accounts
     WHERE threads_user_id = ?`,
  )
    .bind(platformUserId)
    .run();
}

async function processThreadsUninstallRequest(env: Env, platformUserId: string): Promise<void> {
  await ensureAppThreadsTable(env);

  const dbSession = env.DB.withSession("first-primary");
  let transactionStarted = false;

  try {
    await dbSession.prepare("BEGIN TRANSACTION").run();
    transactionStarted = true;

    await removeThreadsLinkageForPlatformUser(dbSession, platformUserId);

    await dbSession.prepare("COMMIT").run();
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      await dbSession.prepare("ROLLBACK").run();
    }
    logWorkerEvent("THREADS_UNINSTALL_CALLBACK_FAILED", {
      platform_user_id: platformUserId,
      error: getErrorMessage(error),
    }, "error");
    throw error;
  }

  logWorkerEvent("THREADS_UNINSTALL_CALLBACK_PROCESSED", {
    platform_user_id: platformUserId,
  });
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

async function handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const normalizedPath = path !== "/" ? path.replace(/\/+$/, "") : path;
    const isApiPath = normalizedPath.startsWith("/api/") || normalizedPath.startsWith("/auth/threads/");
    const isAuthPath = normalizedPath.startsWith("/api/auth/") || normalizedPath.startsWith("/auth/threads/");
    const requestCorsHeaders = getCorsHeadersForRequest(request, env);
    const applyAuthCors = (response: Response): Response =>
      isAuthPath ? withAuthCors(request, env, response) : response;

    if (request.method === "OPTIONS") {
      const corsHeaders = isApiPath
        ? getCorsHeadersForRequest(request, env)
        : {
          "Access-Control-Allow-Origin": getConfiguredAppBaseUrl(env),
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
          Vary: "Origin",
        };
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Operational/internal routes must not be externally reachable in production.
    if (!isLocalDevelopmentRequest(request)) {
      if (normalizedPath.startsWith("/internal/")) {
        logWorkerEvent("INTERNAL_ROUTE_BLOCKED", {
          path: normalizedPath,
          method: request.method,
          reason_code: "internal_route_not_public",
        }, "error");
        return notFoundJsonResponse(requestCorsHeaders);
      }

      if (normalizedPath === "/api/accounts") {
        logWorkerEvent("INTERNAL_ROUTE_BLOCKED", {
          path: normalizedPath,
          method: request.method,
          reason_code: "admin_route_not_public",
        }, "error");
        return notFoundJsonResponse(requestCorsHeaders);
      }
    }

    if (path === "/api/auth/register" && request.method === "POST") {
      const rateLimitResponse = await enforceAuthRequestRateLimit(request, env, "register");
      if (rateLimitResponse) {
        return applyAuthCors(rateLimitResponse);
      }
      return applyAuthCors(await register(request, env));
    }

    if (path === "/api/auth/login" && request.method === "POST") {
      const loginRateLimitRequest = request.clone();
      const rateLimitResponse = await enforceAuthRequestRateLimit(request, env, "login", {
        includeIp: true,
        includeIdentity: false,
      });
      if (rateLimitResponse) {
        return applyAuthCors(rateLimitResponse);
      }
      const loginResponse = await login(request, env);
      if (loginResponse.status === 401) {
        const identityRateLimitResponse = await enforceAuthRequestRateLimit(
          loginRateLimitRequest,
          env,
          "login",
          {
            includeIp: false,
            includeIdentity: true,
          },
        );
        if (identityRateLimitResponse) {
          return applyAuthCors(identityRateLimitResponse);
        }
      }
      return applyAuthCors(loginResponse);
    }

    if (path === "/api/auth/verify-email" && request.method === "GET") {
      return applyAuthCors(await verifyEmail(request, env));
    }

    if (path === "/api/auth/forgot-password" && request.method === "POST") {
      const rateLimitResponse = await enforceAuthRequestRateLimit(request, env, "forgot-password");
      if (rateLimitResponse) {
        return applyAuthCors(rateLimitResponse);
      }
      return applyAuthCors(await forgotPassword(request, env));
    }

    if (path === "/api/auth/reset-password" && request.method === "GET") {
      try {
        return applyAuthCors(await resetPassword(request, env));
      } catch (error) {
        logWorkerEvent("RESET_PASSWORD_ROUTE_ERROR", {
          method: request.method,
          path,
          error: getErrorMessage(error),
        }, "error");
        return applyAuthCors(resetPasswordTokenErrorResponse(request, env));
      }
    }

    if (path === "/api/auth/reset-password" && request.method === "POST") {
      try {
        const rateLimitResponse = await enforceAuthRequestRateLimit(request, env, "reset-password");
        if (rateLimitResponse) {
          return applyAuthCors(rateLimitResponse);
        }
        return applyAuthCors(await resetPassword(request, env));
      } catch (error) {
        logWorkerEvent("RESET_PASSWORD_ROUTE_ERROR", {
          method: request.method,
          path,
          error: getErrorMessage(error),
        }, "error");
        return applyAuthCors(resetPasswordTokenErrorResponse(request, env));
      }
    }

    if (path === "/api/auth/logout" && request.method === "POST") {
      return applyAuthCors(await logout(request, env));
    }

    if (path === "/api/auth/me" && request.method === "GET") {
      return applyAuthCors(await currentUser(request, env));
    }

    if (path === "/api/auth/preferences" && request.method === "POST") {
      return applyAuthCors(await updatePreferences(request, env));
    }

    if (path === "/api/auth/delete-account" && request.method === "POST") {
      const rateLimitResponse = await enforceAuthRequestRateLimit(request, env, "delete-account");
      if (rateLimitResponse) {
        return applyAuthCors(rateLimitResponse);
      }
      return applyAuthCors(await deleteAccount(request, env));
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
      const credentials = getOauthClientCredentials(provider, env);

      if (!credentials) {
        return applyAuthCors(Response.redirect(`${appBaseUrl}/login?error=server_config`, 302));
      }

      const state = buildOauthState(appBaseUrl, "");
      const callbackUrl = buildWorkerCallbackUrl(env, `/api/auth/${provider}/callback`);
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
      const callbackUrl = buildWorkerCallbackUrl(env, `/api/auth/${provider}/callback`);
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
          logWorkerEvent(event, {
            provider: "google",
            ...extra,
          });
        };
        const logError = (
          event: string,
          error: unknown,
          extra: Record<string, string | number | boolean | null> = {},
        ): void => {
          logWorkerEvent(event, {
            provider: "google",
            error: getErrorMessage(error),
            ...extra,
          }, "error");
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
        logWorkerEvent("OAUTH_CALLBACK_RECEIVED", {
          provider,
          hasCode: Boolean(code),
          hasState: Boolean(state),
          hasStateCookie: Boolean(cookieState),
        });

        if (!code) {
          logWorkerEvent("OAUTH_CALLBACK_REJECTED", {
            provider,
            reason_code: "access_denied",
          });
          return redirectToAuthError("access_denied");
        }
        if (!state || !cookieState) {
          logWorkerEvent("OAUTH_CALLBACK_REJECTED", {
            provider,
            reason_code: "state_missing",
          });
          return redirectToAuthError("state_missing");
        }
        if (state !== cookieState) {
          logWorkerEvent("OAUTH_CALLBACK_REJECTED", {
            provider,
            reason_code: "state_mismatch",
          });
          return redirectToAuthError("state_mismatch");
        }

        const accessToken = await exchangeCodeForAccessToken(
          provider,
          code,
          callbackUrl,
          env,
        );
        if (!accessToken) {
          logWorkerEvent("OAUTH_CALLBACK_FAILED", {
            provider,
            reason_code: "token_exchange_failed",
          }, "error");
          return redirectToAuthError("token_exchange_failed");
        }

        const identity = await fetchProviderIdentity(provider, accessToken);
        if (!identity?.providerUserId) {
          logWorkerEvent("OAUTH_CALLBACK_FAILED", {
            provider,
            reason_code: "account_lookup_failed",
          }, "error");
          return redirectToAuthError("account_lookup_failed");
        }

        const identityAccess = await evaluateIdentityAccess(env.DB, [
          { type: provider, value: identity.providerUserId },
          { type: "email", value: identity.email ?? "" },
        ]);
        if (!identityAccess.allowed) {
          logWorkerEvent("OAUTH_CALLBACK_REJECTED", {
            provider,
            reason_code: identityAccess.reason === "banned"
              ? "identity_banned"
              : "identity_recently_deleted",
          });
          return redirectToAuthError(
            identityAccess.reason === "banned" ? "identity_banned" : "identity_recently_deleted",
          );
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
        logWorkerEvent("OAUTH_CALLBACK_COMPLETED", {
          provider,
        });
        return applyAuthCors(new Response(null, { status: 302, headers }));
      } catch (error) {
        logWorkerEvent("OAUTH_CALLBACK_FAILED", {
          provider,
          reason: getErrorMessage(error),
        }, "error");
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

      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        return applyAuthCors(Response.redirect(`${requestAppBase}/login`, 302));
      }

      const effectiveAppUserId = resolveAuthenticatedAppUserId(
        authUser.id,
        normalizeAppUserId(url.searchParams.get("app_user_id")),
      );
      if (!effectiveAppUserId) {
        return applyAuthCors(forbiddenJsonResponse(requestCorsHeaders));
      }

      const state = buildOauthState(requestAppBase, effectiveAppUserId);
      const authURL = new URL("https://www.threads.net/oauth/authorize");
      authURL.searchParams.set("client_id", env.THREADS_CLIENT_ID);
      authURL.searchParams.set("redirect_uri", buildWorkerCallbackUrl(env, "/api/auth/threads/callback"));
      authURL.searchParams.set("scope", THREADS_OAUTH_SCOPES);
      authURL.searchParams.set("response_type", "code");
      authURL.searchParams.set("state", state);

      return applyAuthCors(new Response(null, {
        status: 302,
        headers: {
          Location: authURL.toString(),
          "Set-Cookie": setOauthStateCookie(THREADS_OAUTH_STATE_COOKIE_NAME, state),
        },
      }));
    }

    if (url.pathname === "/api/auth/threads/callback" && request.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const cookieState = getCookieValue(request, THREADS_OAUTH_STATE_COOKIE_NAME);
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
            "Set-Cookie": clearOauthStateCookie(THREADS_OAUTH_STATE_COOKIE_NAME),
          },
        }));
      logWorkerEvent("THREADS_SESSION_RESOLUTION_STARTED", {
        provider: "threads",
        has_session_cookie: Boolean(getSessionCookieValue(request)),
      });
      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        logWorkerEvent("THREADS_SESSION_RESOLUTION_FAILED", {
          provider: "threads",
          has_session_cookie: Boolean(getSessionCookieValue(request)),
          session_resolved: false,
          error: authUser.status === 401 ? "session_not_found" : "unauthorized",
        }, "error");
        return redirectToConnectError("session_not_found");
      }
      logWorkerEvent("THREADS_SESSION_RESOLUTION_SUCCEEDED", {
        provider: "threads",
        has_session_cookie: true,
        session_resolved: true,
        user_id: authUser.id,
      });

      const logEvent = (
        event: string,
        extra: Record<string, string | number | boolean | null> = {},
      ): void => {
        logWorkerEvent(event, {
          provider: "threads",
          ...extra,
        });
      };
      const logError = (
        event: string,
        error: unknown,
        extra: Record<string, string | number | boolean | null> = {},
      ): void => {
        logWorkerEvent(event, {
          provider: "threads",
          error: getErrorMessage(error),
          ...extra,
        }, "error");
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
        if (authUser.id !== appUserId) {
          throw new Error("state_user_mismatch");
        }
        if (!env.THREADS_CLIENT_ID || !env.THREADS_CLIENT_SECRET) {
          throw new Error("server_config");
        }
        resolvedAppUserId = authUser.id;
        logEvent("THREADS_OAUTH_STATE_VALIDATION_SUCCEEDED");
      } catch (error) {
        logError("THREADS_OAUTH_STATE_VALIDATION_FAILED", error);
        const errorCode = getErrorMessage(error);
        if (
          errorCode === "access_denied"
          || errorCode === "state_missing"
          || errorCode === "state_mismatch"
          || errorCode === "state_user_mismatch"
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
          redirect_uri: buildWorkerCallbackUrl(env, "/api/auth/threads/callback"),
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
          "Set-Cookie": clearOauthStateCookie(THREADS_OAUTH_STATE_COOKIE_NAME),
        },
      }));
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "ok",
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
      authURL.searchParams.set("redirect_uri", buildWorkerCallbackUrl(env, "/auth/threads/callback"));
      authURL.searchParams.set("scope", THREADS_OAUTH_SCOPES);
      authURL.searchParams.set("response_type", "code");
      return Response.redirect(authURL.toString(), 302);
    }

    if (url.pathname === "/auth/threads/callback") {
      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 401,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const code = url.searchParams.get("code");
      if (!code) {
        return new Response(
          JSON.stringify({ error: "Could not complete Threads authorization." }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const body = new URLSearchParams({
        client_id: env.THREADS_CLIENT_ID,
        client_secret: env.THREADS_CLIENT_SECRET,
        redirect_uri: buildWorkerCallbackUrl(env, "/auth/threads/callback"),
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
        return providerFailureResponse("Could not complete Threads authorization.");
      }

      const shortTokenData = await tokenResp.json() as {
        access_token?: string;
      };
      const shortToken = shortTokenData.access_token;
      if (!shortToken) {
        return new Response(
          JSON.stringify({ error: "Could not complete Threads authorization." }),
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
        return providerFailureResponse("Could not complete Threads authorization.");
      }

      const longTokenData = await longResp.json() as {
        access_token?: string;
        expires_in?: number;
      };
      const accessToken = longTokenData.access_token;
      const expiresIn = Number(longTokenData.expires_in ?? 0);

      if (!accessToken || !expiresIn) {
        return new Response(
          JSON.stringify({ error: "Could not complete Threads authorization." }),
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
        return providerFailureResponse("Could not complete Threads authorization.");
      }

      const meData = await meResp.json() as { id?: string };
      if (!meData.id) {
        return new Response(
          JSON.stringify({ error: "Could not complete Threads authorization." }),
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
      const platformUserId = await resolveMetaDeletionUserId(request, env);
      if (!platformUserId) {
        return new Response(
          JSON.stringify({ error: "Invalid Threads uninstall request" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      try {
        await processThreadsUninstallRequest(env, platformUserId);
        return new Response(
          JSON.stringify({ success: true }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      } catch {
        return new Response(
          JSON.stringify({ error: "Could not process Threads uninstall callback" }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
    }

    if (url.pathname === "/auth/threads/delete" && request.method === "POST") {
      const platformUserId = await resolveMetaDeletionUserId(request, env);
      if (!platformUserId) {
        return new Response(
          JSON.stringify({ error: "Invalid Meta deletion request" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      try {
        const { confirmationCode, statusUrl } = await processMetaDeletionRequest(env, platformUserId);
        return new Response(
          JSON.stringify({
            url: statusUrl,
            confirmation_code: confirmationCode,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      } catch {
        return new Response(
          JSON.stringify({ error: "Could not process Meta deletion request" }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
    }

    if (url.pathname === "/auth/threads/delete-status" && request.method === "GET") {
      await ensureMetaDeletionRequestsTable(env);
      const confirmationCode = url.searchParams.get("confirmation_code")?.trim();
      if (!confirmationCode) {
        return new Response(
          JSON.stringify({ error: "Missing confirmation_code" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const requestRecord = await env.DB.prepare(
        `SELECT confirmation_code, platform_user_id, status, requested_at, completed_at
         FROM meta_deletion_requests
         WHERE confirmation_code = ?
         LIMIT 1`,
      )
        .bind(confirmationCode)
        .first<MetaDeletionRequestRecord>();

      if (!requestRecord) {
        return new Response(
          JSON.stringify({ error: "Deletion request not found" }),
          {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          confirmation_code: requestRecord.confirmation_code,
          status: requestRecord.status,
          requested_at: requestRecord.requested_at,
          completed_at: requestRecord.completed_at,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }

    if (url.pathname === "/api/threads/me" && request.method === "GET") {
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
      logWorkerEvent("THREADS_ME_REQUEST_RECEIVED", {
        appUserId,
      });
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
      const account = await getThreadsAccountForAppUserWithRetry(env, appUserId);
      logWorkerEvent("THREADS_ME_LOOKUP_RESULT", {
        appUserId,
        found: Boolean(account),
        threadsUserId: account?.threads_user_id ?? null,
      });

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
      if (!meResp.ok) {
        logWorkerEvent("THREADS_ME_UPSTREAM_FAILED", {
          status: meResp.status,
          app_user_id: appUserId,
        }, "error");
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }

      const mePayload = await readJsonSafe(meResp);
      if (!mePayload || typeof mePayload !== "object") {
        logWorkerEvent("THREADS_ME_UPSTREAM_INVALID_JSON", {
          app_user_id: appUserId,
        }, "error");
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }

      const meJson = mePayload as {
        name?: string;
        username?: string;
        threads_biography?: string;
        is_verified?: boolean;
        threads_profile_picture_url?: string;
      };

      const accountPayload = {
        threads_user_id: account.threads_user_id,
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

      const appUserId = resolveAuthenticatedAppUserId(
        authUser.id,
        normalizeAppUserId(payload.app_user_id ?? null),
      );
      if (!appUserId) {
        return forbiddenJsonResponse(requestCorsHeaders);
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
      if (!res.ok) {
        logWorkerEvent("THREADS_PROFILE_LOOKUP_FAILED", {
          status: res.status,
          app_user_id: appUserId,
        }, "error");
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }

      const data = await readJsonSafe(res);
      if (data === null) {
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }

      return new Response(JSON.stringify(data), {
        status: 200,
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
      logWorkerEvent("THREADS_POSTS_REQUEST", {
        app_user_id: appUserId,
      });

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
      logWorkerEvent("THREADS_ACCOUNT_LOOKUP_RESULT", {
        found: Boolean(account),
        threads_user_id: account?.threads_user_id ?? null,
      });

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
          logWorkerEvent("USAGE_LIMIT_EXCEEDED", {
            feature: "insights",
            app_user_id: appUserId,
            limit: "limit" in limitCheck ? (limitCheck.limit ?? null) : null,
            used: "used" in limitCheck ? (limitCheck.used ?? null) : null,
          });
        }
      } catch (error) {
        logWorkerEvent("USAGE_LIMIT_CHECK_FAILED", {
          feature: "insights",
          app_user_id: appUserId,
          error: getErrorMessage(error),
        });
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
      if (!postsResp.ok) {
        logWorkerEvent("THREADS_POSTS_UPSTREAM_FAILED", {
          status: postsResp.status,
          app_user_id: appUserId,
        }, "error");
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }
      logWorkerEvent("THREADS_API_REQUEST", {
        endpoint: "/v1.0/:threads_user_id/threads",
        has_cursor: Boolean(cursor),
      });
      const postsResponseText = await postsResp.text();
      logWorkerEvent("THREADS_API_RESPONSE", {
        status: postsResp.status,
        hasBody: Boolean(postsResponseText),
      });

      let data = null as {
        data?: unknown[];
        paging?: {
          next?: string;
          cursors?: {
            after?: string;
          };
        };
      } | null;
      try {
        data = JSON.parse(postsResponseText) as {
          data?: unknown[];
          paging?: {
            next?: string;
            cursors?: {
              after?: string;
            };
          };
        };
      } catch {
        logWorkerEvent("THREADS_POSTS_UPSTREAM_INVALID_JSON", {
          app_user_id: appUserId,
        }, "error");
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }
      if (!data || typeof data !== "object") {
        logWorkerEvent("THREADS_POSTS_UPSTREAM_INVALID_SHAPE", {
          app_user_id: appUserId,
        }, "error");
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }
      const postsArray = Array.isArray(data.data) ? data.data : [];
      const profileResp = await fetch(
        "https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url",
        {
          headers: { Authorization: `Bearer ${account.access_token}` },
        },
      );
      const profileJson = await profileResp.json() as { threads_profile_picture_url?: string };
      const profilePicture = profileJson?.threads_profile_picture_url ?? null;
      logWorkerEvent("THREADS_POSTS_COUNT", { count: postsArray.length });
      const enrichedPosts = [];
      const batchSize = 10;
      for (let i = 0; i < postsArray.length; i += batchSize) {
        const batch = postsArray.slice(i, i + batchSize);

        const results = await Promise.all(
          batch.map(async (post) => {
            const postId = String((post as { id?: string })?.id ?? "");
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
                logWorkerEvent("INSIGHTS_REQUEST_FAILED", {
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
              logWorkerEvent("THREADS_INSIGHTS_DEBUG", {
                status: metricsResp.status,
                metricCount: Array.isArray(metricsJson.data) ? metricsJson.data.length : 0,
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
      if (!insightsResp.ok) {
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }
      const insightsData = await readJsonSafe(insightsResp);
      if (insightsData === null) {
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }

      return new Response(JSON.stringify(insightsData), {
        status: 200,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

    if (url.pathname === "/api/threads/post-insights" && request.method === "GET") {
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
      if (!insightsRes.ok) {
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }

      const data = await readJsonSafe(insightsRes);
      if (data === null) {
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

    if (url.pathname === "/api/threads/user-insights" && request.method === "GET") {
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
      if (!insightsRes.ok) {
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }

      const data = await readJsonSafe(insightsRes);
      if (data === null) {
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }
      return new Response(JSON.stringify(data), {
        status: 200,
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
      const searchType = url.searchParams.get("search_type");
      const searchMode = url.searchParams.get("search_mode");
      const limit = url.searchParams.get("limit");

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

      const validationResult = validateThreadsKeywordSearchParams({
        query: q,
        searchMode,
        searchType,
        limit,
      });
      if (!validationResult.valid) {
        return keywordSearchValidationErrorResponse(requestCorsHeaders, validationResult.errors);
      }

      const account = await getThreadsAccountForAppUser(env, appUserId);
      const threadsUserId = account?.threads_user_id?.trim();
      const accessToken = account?.access_token?.trim();

      if (!threadsUserId || !accessToken) {
        return new Response(
          JSON.stringify({ error: "Threads authorization required" }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }
      const usageLimit = await enforceLimit(
        env,
        { id: appUserId, is_admin: authUser.is_admin },
        "keyword_search",
      );
      if (!usageLimit.allowed) {
        return limitDeniedResponse(usageLimit, "keyword_search", request, env);
      }

      const searchResult = await executeThreadsKeywordSearch({
        accessToken,
        query: validationResult.value.query,
        searchType: validationResult.value.searchType,
        searchMode: validationResult.value.searchMode,
        limit: validationResult.value.limit,
      });

      if (!searchResult.success) {
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }

      return new Response(JSON.stringify(searchResult.data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (
      (url.pathname === "/api/threads/publish" || url.pathname === "/api/threads/post-now")
      && request.method === "POST"
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

      if (!threadsUserId || !text) {
        return new Response(
          JSON.stringify({ error: "threads_user_id and text are required" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const ownedAppUserId = resolveAuthenticatedAppUserId(authUser.id, appUserId);
      if (!ownedAppUserId) {
        return forbiddenJsonResponse({ "content-type": "application/json; charset=UTF-8" });
      }

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId);

      if (!account?.access_token || account.threads_user_id !== threadsUserId) {
        return new Response(
          JSON.stringify({ error: "Threads account not connected" }),
          {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
      if (url.pathname === "/api/threads/publish") {
        const limit = await enforceLimit(
          env,
          { id: account.threads_user_id, is_admin: authUser.is_admin },
          "publish",
        );
        if (!limit.allowed) {
          return limitDeniedResponse(limit, "publish", request, env);
        }
      }

      await ensureImmediatePublishIdempotencyTable(env);
      const publishScope = url.pathname === "/api/threads/publish" ? "publish" : "post-now";
      const requestHash = await buildImmediatePublishRequestHash(
        ownedAppUserId,
        account.threads_user_id,
        text,
      );
      const requestBucket = getImmediatePublishRequestBucket();
      const existingResponse = await getImmediatePublishIdempotentResponse(
        env,
        publishScope,
        ownedAppUserId,
        account.threads_user_id,
        requestHash,
        requestBucket,
      );
      if (existingResponse) {
        return new Response(existingResponse.response_body, {
          status: existingResponse.response_status,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      const publishOutcome = await publishThreadsTextForAppUser(
        env,
        ownedAppUserId,
        account.threads_user_id,
        text,
      );
      if (!publishOutcome.success) {
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }
      const { publishResult } = publishOutcome;

      const responsePayload = url.pathname === "/api/threads/publish"
        ? publishResult.publishResponse
        : {
          success: true,
          publish_request_id: publishResult.publishRequestId,
          published_post_id: publishResult.publishedPostId,
          provider_response: publishResult.publishResponse,
        };
      const responseBody = JSON.stringify(responsePayload);

      try {
        await storeImmediatePublishIdempotentResponse(
          env,
          publishScope,
          ownedAppUserId,
          account.threads_user_id,
          requestHash,
          requestBucket,
          200,
          responseBody,
        );
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }

        const racedResponse = await getImmediatePublishIdempotentResponse(
          env,
          publishScope,
          ownedAppUserId,
          account.threads_user_id,
          requestHash,
          requestBucket,
        );
        if (racedResponse) {
          return new Response(racedResponse.response_body, {
            status: racedResponse.response_status,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
      }

      if (url.pathname === "/api/threads/publish") {
        return new Response(responseBody, {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      return new Response(responseBody, {
        status: 200,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

    if (url.pathname === "/api/threads/schedule" && request.method === "POST") {
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

      let payload: {
        app_user_id?: string;
        threads_user_id?: string;
        text?: string;
        date?: string;
        time?: string;
        timezone?: string;
      };
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
      const date = payload.date?.trim();
      const time = payload.time?.trim();
      const timezone = payload.timezone?.trim() || null;

      if (!threadsUserId || !text || !date || !time) {
        return new Response(
          JSON.stringify({
            error: "threads_user_id, text, date, and time are required",
          }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const ownedAppUserId = resolveAuthenticatedAppUserId(authUser.id, appUserId);
      if (!ownedAppUserId) {
        return forbiddenJsonResponse(requestCorsHeaders);
      }

      const preferredTimezone = await getUserTimezonePreference(env, ownedAppUserId);
      const resolvedTimezone = timezone ?? preferredTimezone ?? "UTC";

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId);
      if (!account?.threads_user_id || account.threads_user_id !== threadsUserId) {
        return new Response(
          JSON.stringify({ error: "Threads account not connected" }),
          {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const scheduledUtc = convertLocalDateTimeToUtcIso(date, time, resolvedTimezone);
      if (!scheduledUtc) {
        return new Response(
          JSON.stringify({ error: "Invalid date, time, or timezone" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
      if (isPastUtcTimestamp(scheduledUtc)) {
        return new Response(
          JSON.stringify({ error: "Scheduled time must be in the future (UTC)." }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      if (timezone && timezone !== preferredTimezone) {
        await env.DB.prepare(
          `UPDATE users
           SET timezone = ?
           WHERE id = ?`,
        )
          .bind(resolvedTimezone, ownedAppUserId)
          .run();
      }

      await ensureScheduledPostsTable(env);
      const scheduleIdempotencyKey = await buildScheduledPostIdempotencyKey(
        ownedAppUserId,
        threadsUserId,
        scheduledUtc,
        text,
      );

      const existingScheduledPost = await env.DB.prepare(
        `SELECT id, status, scheduled_time
         FROM scheduled_posts
         WHERE idempotency_key = ?
         LIMIT 1`,
      )
        .bind(scheduleIdempotencyKey)
        .first<{ id: number | string; status: string; scheduled_time: string }>();

      if (existingScheduledPost) {
        logWorkerEvent("SCHEDULED_POST_CREATED", {
          scheduled_post_id: Number(existingScheduledPost.id),
          user_id: ownedAppUserId,
          threads_user_id: threadsUserId,
          idempotent_reuse: true,
          status: existingScheduledPost.status,
        });
        return new Response(
          JSON.stringify({
            success: true,
            scheduled_post: {
              id: Number(existingScheduledPost.id),
              status: existingScheduledPost.status,
              scheduled_time_utc: existingScheduledPost.scheduled_time,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      let insertedScheduledPostId = 0;
      try {
        const insert = await env.DB.prepare(
          `INSERT INTO scheduled_posts (
            user_id,
            threads_user_id,
            post_text,
            status,
            scheduled_time,
            idempotency_key
          )
          VALUES (?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            ownedAppUserId,
            threadsUserId,
            text,
            SCHEDULED_POST_STATUS_APPROVED,
            scheduledUtc,
            scheduleIdempotencyKey,
          )
          .run();
        insertedScheduledPostId = Number(insert.meta?.last_row_id ?? 0);
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }

        const racedScheduledPost = await env.DB.prepare(
          `SELECT id, status, scheduled_time
           FROM scheduled_posts
           WHERE idempotency_key = ?
           LIMIT 1`,
        )
          .bind(scheduleIdempotencyKey)
          .first<{ id: number | string; status: string; scheduled_time: string }>();

        if (!racedScheduledPost) {
          throw error;
        }

        logWorkerEvent("SCHEDULED_POST_CREATED", {
          scheduled_post_id: Number(racedScheduledPost.id),
          user_id: ownedAppUserId,
          threads_user_id: threadsUserId,
          idempotent_reuse: true,
          status: racedScheduledPost.status,
          source: "unique_race_recovered",
        });
        return new Response(
          JSON.stringify({
            success: true,
            scheduled_post: {
              id: Number(racedScheduledPost.id),
              status: racedScheduledPost.status,
              scheduled_time_utc: racedScheduledPost.scheduled_time,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      logWorkerEvent("SCHEDULED_POST_CREATED", {
        scheduled_post_id: insertedScheduledPostId,
        user_id: ownedAppUserId,
        threads_user_id: threadsUserId,
        idempotent_reuse: false,
        status: SCHEDULED_POST_STATUS_APPROVED,
      });

      return new Response(
        JSON.stringify({
          success: true,
          scheduled_post: {
            id: insertedScheduledPostId,
            status: SCHEDULED_POST_STATUS_APPROVED,
            scheduled_time_utc: scheduledUtc,
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }

    if (url.pathname === "/api/threads/schedule/update" && request.method === "POST") {
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

      let payload: {
        app_user_id?: string;
        scheduled_post_id?: number | string;
        text?: string;
        date?: string;
        time?: string;
        timezone?: string;
      };
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
      const scheduledPostId = Number(payload.scheduled_post_id);
      const text = payload.text?.trim();
      const date = payload.date?.trim();
      const time = payload.time?.trim();
      const timezone = payload.timezone?.trim() || null;

      if (!Number.isInteger(scheduledPostId) || scheduledPostId <= 0 || !text || !date || !time) {
        return new Response(
          JSON.stringify({
            error: "scheduled_post_id, text, date, and time are required",
          }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const ownedAppUserId = resolveAuthenticatedAppUserId(authUser.id, appUserId);
      if (!ownedAppUserId) {
        return forbiddenJsonResponse(requestCorsHeaders);
      }

      const preferredTimezone = await getUserTimezonePreference(env, ownedAppUserId);
      const resolvedTimezone = timezone ?? preferredTimezone ?? "UTC";
      const scheduledUtc = convertLocalDateTimeToUtcIso(date, time, resolvedTimezone);
      if (!scheduledUtc) {
        return new Response(
          JSON.stringify({ error: "Invalid date, time, or timezone" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
      if (isPastUtcTimestamp(scheduledUtc)) {
        return new Response(
          JSON.stringify({ error: "Scheduled time must be in the future (UTC)." }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      if (timezone && timezone !== preferredTimezone) {
        await env.DB.prepare(
          `UPDATE users
           SET timezone = ?
           WHERE id = ?`,
        )
          .bind(resolvedTimezone, ownedAppUserId)
          .run();
      }

      await ensureScheduledPostsTable(env);

      const existingScheduledPost = await env.DB.prepare(
        `SELECT id, status, threads_user_id
         FROM scheduled_posts
         WHERE id = ?
           AND user_id = ?
         LIMIT 1`,
      )
        .bind(scheduledPostId, ownedAppUserId)
        .first<{ id: number | string; status: string; threads_user_id: string }>();
      if (!existingScheduledPost) {
        return new Response(
          JSON.stringify({ error: "Scheduled post not found" }),
          {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
      if (existingScheduledPost.status !== SCHEDULED_POST_STATUS_APPROVED) {
        return new Response(
          JSON.stringify({ error: "Only approved scheduled posts can be edited." }),
          {
            status: 409,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const scheduleIdempotencyKey = await buildScheduledPostIdempotencyKey(
        ownedAppUserId,
        existingScheduledPost.threads_user_id,
        scheduledUtc,
        text,
      );

      try {
        const result = await env.DB.prepare(
          `UPDATE scheduled_posts
           SET post_text = ?,
               scheduled_time = ?,
               idempotency_key = ?
           WHERE id = ?
             AND user_id = ?
             AND status = ?`,
        )
          .bind(
            text,
            scheduledUtc,
            scheduleIdempotencyKey,
            scheduledPostId,
            ownedAppUserId,
            SCHEDULED_POST_STATUS_APPROVED,
          )
          .run();

        if (Number(result.meta?.changes ?? 0) <= 0) {
          return new Response(
            JSON.stringify({ error: "Scheduled post could not be updated." }),
            {
              status: 409,
              headers: { "content-type": "application/json; charset=UTF-8" },
            },
          );
        }
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
        return new Response(
          JSON.stringify({ error: "An identical scheduled post already exists." }),
          {
            status: 409,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          scheduled_post: {
            id: scheduledPostId,
            text,
            status: SCHEDULED_POST_STATUS_APPROVED,
            scheduled_time_utc: scheduledUtc,
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }

    if (url.pathname === "/api/threads/schedule" && request.method === "GET") {
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
      const ownedAppUserId = resolveAuthenticatedAppUserId(authUser.id, appUserId);
      if (!ownedAppUserId) {
        return forbiddenJsonResponse(requestCorsHeaders);
      }

      const scheduledPostsTableExists = await doesTableExist(env, "scheduled_posts");
      if (!scheduledPostsTableExists) {
        return new Response(
          JSON.stringify({
            success: true,
            scheduled_posts: [],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const nowIso = new Date().toISOString();
      const rows = await env.DB.prepare(
        `SELECT id, post_text, status, scheduled_time
         FROM scheduled_posts
         WHERE user_id = ?
           AND status IN (?, ?)
           AND scheduled_time >= ?
         ORDER BY scheduled_time ASC, id ASC
         LIMIT 100`,
      )
        .bind(
          ownedAppUserId,
          SCHEDULED_POST_STATUS_APPROVED,
          SCHEDULED_POST_STATUS_POSTING,
          nowIso,
        )
        .all<{
          id: number | string;
          post_text: string;
          status: string;
          scheduled_time: string;
        }>();

      return new Response(
        JSON.stringify({
          success: true,
          scheduled_posts: (rows.results ?? []).map((row) => ({
            id: Number(row.id),
            text: row.post_text,
            status: row.status,
            scheduled_time_utc: row.scheduled_time,
          })),
        }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
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

      await ensureAppThreadsTable(env);

      const rows = await env.DB.prepare(
        `SELECT DISTINCT t.threads_user_id, t.access_token, t.expires_at
         FROM threads_accounts t
         JOIN app_threads_accounts a
           ON a.threads_user_id = t.threads_user_id
         JOIN users u
           ON u.id = a.app_user_id`,
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
}

async function refreshExpiringThreadsTokens(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const threshold = now + (7 * 24 * 60 * 60);

  await ensureAppThreadsTable(env);

  const rows = await env.DB
    .prepare(
      `SELECT DISTINCT t.threads_user_id, t.access_token
       FROM threads_accounts t
       JOIN app_threads_accounts a
         ON a.threads_user_id = t.threads_user_id
       JOIN users u
         ON u.id = a.app_user_id
       WHERE t.expires_at <= ?`,
    )
    .bind(threshold)
    .all<{ threads_user_id: string; access_token: string }>();

  for (const row of rows.results) {
    try {
      const refresh = await fetch(
        `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(row.access_token)}`,
      );

      if (!refresh.ok) {
        logWorkerEvent("THREADS_TOKEN_REFRESH_FAILED", {
          source: "scheduled",
          status: refresh.status,
        });
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

      logWorkerEvent("THREADS_TOKEN_REFRESH_SUCCEEDED", {
        source: "scheduled",
      });
    } catch {
      logWorkerEvent("THREADS_TOKEN_REFRESH_ERROR", {
        source: "scheduled",
      });
    }
  }
}

async function handleScheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  const cron = event.cron?.trim() ?? "";
  logWorkerEvent("SCHEDULED_CRON_TRIGGERED", {
    cron,
  });

  if (cron === SCHEDULED_POST_PUBLISH_CRON) {
    await processDueScheduledPosts(env);
    return;
  }

  if (cron === THREADS_TOKEN_REFRESH_CRON) {
    await refreshExpiringThreadsTokens(env);
    return;
  }

  if (cron === LEGACY_COMBINED_SCHEDULED_CRON) {
    await refreshExpiringThreadsTokens(env);
    await processDueScheduledPosts(env);
    return;
  }

  logWorkerEvent("SCHEDULED_CRON_UNRECOGNIZED", {
    cron,
  }, "error");
}

export default {
  async fetch(request, env): Promise<Response> {
    const path = new URL(request.url).pathname;
    const scheme = getRequestTransportScheme(request);
    if (!isLocalDevelopmentRequest(request) && scheme === "http") {
      logWorkerEvent("INSECURE_TRANSPORT_REDIRECTED", {
        path,
        method: request.method,
        reason_code: "http_not_allowed",
      });
      return buildHttpsRedirectResponse(request);
    }

    try {
      const response = await handleRequest(request, env);
      return withApiCors(request, env, path, response);
    } catch (error) {
      logUnhandledWorkerError(error, request, path);
      const errorResponse = buildUnhandledErrorResponse(request, env, path);
      return withApiCors(request, env, path, errorResponse);
    }
  },
  async scheduled(event, env, ctx) {
    try {
      await handleScheduled(event, env, ctx);
    } catch (error) {
      logWorkerEvent("UNHANDLED_SCHEDULED_ERROR", {
        cron: event.cron,
        error: getErrorMessage(error),
      }, "error");
    }
  },
} satisfies ExportedHandler<Env>;
