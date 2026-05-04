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
import { executeThreadsProfileLookup } from "./utils/threadsProfileLookupService";
import { executeThreadsProfilePosts } from "./utils/threadsProfilePostsService";
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
  "threads_content_publish",
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
const THREADS_FOLLOWER_START_OF_DAY_CRON = "1 4,5 * * *";
const THREADS_INSIGHTS_DAILY_WINDOW_CRON = "59 3,4 * * *";
const THREADS_INSIGHTS_TIME_ZONE = "America/New_York";
const THREADS_FOLLOWER_START_OF_DAY_HOUR = 0;
const THREADS_FOLLOWER_START_OF_DAY_MINUTE = 1;
const THREADS_INSIGHTS_TARGET_HOUR = 23;
const THREADS_INSIGHTS_TARGET_MINUTE = 59;
const THREADS_INSIGHTS_CACHE_MAX_AGE_HOURS = 30;
const MAX_THREADS_POST_CURSOR_DEPTH = 250;
const IMMEDIATE_PUBLISH_IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;
const THREADS_CONNECTION_TOMBSTONE_WINDOW_MS = 24 * 60 * 60 * 1000;
const WORKSPACE_APP_USER_ID = "workspace-owner";
const WORKSPACE_IS_ADMIN = true;
const WORKSPACE_DEFAULT_TIMEZONE = "America/New_York";
const MAX_BATCH_SCHEDULE_PRESET_NAME_LENGTH = 80;
const MAX_BATCH_SCHEDULE_PRESET_COUNT = 50;
const MAX_BATCH_SCHEDULE_PRESET_SLOTS = 50;
const DASHBOARD_TIME_ZONE = "America/New_York";
const DASHBOARD_FOLLOWER_SNAPSHOT_RETENTION_DAYS = 45;
const DASHBOARD_HIT_RATE_LIKES_THRESHOLD = 30;
const DASHBOARD_WEAK_POST_VIEWS_THRESHOLD = 100;
const DASHBOARD_WEAK_POST_VIEWS_HOURS = 6;
const DASHBOARD_WEAK_POST_ZERO_LIKES_HOURS = 3;
const DASHBOARD_POST_PREVIEW_LENGTH = 140;
const DASHBOARD_RECENT_POST_LIMIT = 250;
const DASHBOARD_WINNING_TERM_LIMIT = 8;
const DASHBOARD_WINNING_PHRASE_LIMIT = 5;
const DASHBOARD_FATIGUE_WORD_LIMIT = 6;
const DASHBOARD_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for", "from", "had", "has", "have",
  "he", "her", "his", "i", "if", "in", "into", "is", "it", "its", "me", "my", "of", "on", "or", "our",
  "so", "that", "the", "their", "them", "there", "they", "this", "to", "was", "we", "were", "will",
  "with", "you", "your",
]);

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
  THREADS_TOKEN_MANIFEST_MENTAL?: string;
  DB: D1Database;
}

type ConfiguredThreadsAccount = {
  id: string;
  label: string;
  username: string;
  tokenEnv: keyof Env;
};

type ResolvedConfiguredThreadsAccount = ConfiguredThreadsAccount & {
  accessToken: string;
  expiresAt: number | null;
  createdAt: number | null;
};

type ConfiguredThreadsAccountProfile = {
  threads_user_id: string;
  is_active: boolean;
  created_at: number;
  username: string | null;
  name: string | null;
  label: string;
  account_id: string;
  threads_biography: string | null;
  is_verified: boolean;
  threads_profile_picture_url: string | null;
};

const CONFIGURED_THREADS_ACCOUNTS: ConfiguredThreadsAccount[] = [
  {
    id: "manifest-mental",
    label: "Manifest Mental",
    username: "manifestmental",
    tokenEnv: "THREADS_TOKEN_MANIFEST_MENTAL",
  },
];

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

function keywordSearchServiceErrorResponse(
  requestCorsHeaders: Record<string, string>,
  errorCode:
    | "threads_keyword_search_invalid_token"
    | "threads_keyword_search_provider_failed"
    | "threads_keyword_search_invalid_response"
    | "threads_keyword_search_exception",
): Response {
  if (errorCode === "threads_keyword_search_invalid_token") {
    return new Response(
      JSON.stringify({
        error: "Keyword search authorization failed.",
        code: "keyword_search_invalid_token",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...requestCorsHeaders,
        },
      },
    );
  }

  return new Response(
    JSON.stringify({
      error: "Keyword search provider request failed.",
      code: "keyword_search_provider_error",
    }),
    {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        ...requestCorsHeaders,
      },
    },
  );
}

function keywordSearchUnexpectedErrorResponse(
  requestCorsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: "Keyword search failed.",
      code: "keyword_search_unexpected_error",
    }),
    {
      status: 500,
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

function getConfiguredThreadsAccountDefinitions(env: Env): ConfiguredThreadsAccount[] {
  return CONFIGURED_THREADS_ACCOUNTS.filter((account) => {
    const accessToken = env[account.tokenEnv];
    return typeof accessToken === "string" && accessToken.trim().length > 0;
  });
}

async function resolveConfiguredThreadsAccount(
  env: Env,
  account: ConfiguredThreadsAccount,
): Promise<ResolvedConfiguredThreadsAccount | null> {
  await ensureThreadsAccountsTable(env);

  const storedAccount = await env.DB.prepare(
    `SELECT access_token, expires_at, created_at
     FROM threads_accounts
     WHERE configured_account_id = ?
     LIMIT 1`,
  ).bind(account.id).first<{
    access_token: string | null;
    expires_at: number | string | null;
    created_at: number | string | null;
  }>();

  const storedAccessToken = storedAccount?.access_token?.trim() ?? "";
  if (storedAccessToken) {
    return {
      ...account,
      accessToken: storedAccessToken,
      expiresAt: Number(storedAccount?.expires_at ?? 0) || 0,
      createdAt: Number(storedAccount?.created_at ?? 0) || 0,
    };
  }

  const bootstrapAccessToken = env[account.tokenEnv];
  if (typeof bootstrapAccessToken !== "string" || !bootstrapAccessToken.trim()) {
    return null;
  }

  return {
    ...account,
    accessToken: bootstrapAccessToken.trim(),
    expiresAt: null,
    createdAt: null,
  };
}

async function getConfiguredThreadsAccountById(
  env: Env,
  accountId: string | null | undefined,
): Promise<ResolvedConfiguredThreadsAccount | null> {
  const normalizedId = accountId?.trim().toLowerCase();
  const accounts = getConfiguredThreadsAccountDefinitions(env);

  if (!normalizedId) {
    return accounts.length > 0 ? resolveConfiguredThreadsAccount(env, accounts[0]) : null;
  }

  const matchedAccount = accounts.find((account) => account.id === normalizedId) ?? null;
  return matchedAccount ? resolveConfiguredThreadsAccount(env, matchedAccount) : null;
}

function configuredThreadsAccountFallbackPayload(
  account: ConfiguredThreadsAccount,
  index: number,
): ConfiguredThreadsAccountProfile {
  return {
    threads_user_id: account.id,
    is_active: index === 0,
    created_at: 0,
    username: account.username,
    name: account.label,
    label: account.label,
    account_id: account.id,
    threads_biography: null,
    is_verified: false,
    threads_profile_picture_url: null,
  };
}

async function upsertConfiguredThreadsAccountToken(
  env: Env,
  account: ResolvedConfiguredThreadsAccount,
  threadsUserId: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const createdAt = account.createdAt && account.createdAt > 0 ? account.createdAt : now;
  const expiresAt = account.expiresAt && account.expiresAt > 0 ? account.expiresAt : 0;

  await ensureThreadsAccountsTable(env);
  await env.DB.prepare(
    `DELETE FROM threads_accounts
     WHERE configured_account_id = ?
       AND threads_user_id <> ?`,
  )
    .bind(account.id, threadsUserId)
    .run();

  await env.DB.prepare(
    `INSERT INTO threads_accounts (
      threads_user_id,
      access_token,
      expires_at,
      created_at,
      configured_account_id
    )
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(threads_user_id) DO UPDATE SET
       access_token = excluded.access_token,
       expires_at = excluded.expires_at,
       configured_account_id = excluded.configured_account_id`,
  )
    .bind(threadsUserId, account.accessToken, expiresAt, createdAt, account.id)
    .run();
}

async function fetchConfiguredThreadsProfile(
  env: Env,
  account: ResolvedConfiguredThreadsAccount,
  index: number,
): Promise<ConfiguredThreadsAccountProfile> {
  const fallback = configuredThreadsAccountFallbackPayload(account, index);
  const data = await fetchThreadsProfileByAccessToken(account.accessToken);
  if (!data) {
    return fallback;
  }

  try {
    if (data.threads_user_id) {
      await upsertConfiguredThreadsAccountToken(env, account, data.threads_user_id);
    }
  } catch {
    // Refresh bootstrap should not break configured account reads.
  }

  return {
    threads_user_id: data.threads_user_id ?? fallback.threads_user_id,
    is_active: index === 0,
    created_at: 0,
    username: data.username ?? fallback.username,
    name: data.name ?? fallback.name,
    label: account.label,
    account_id: account.id,
    threads_biography: data.threads_biography,
    is_verified: data.is_verified,
    threads_profile_picture_url: data.threads_profile_picture_url,
  };
}

async function getConfiguredThreadsProfiles(env: Env): Promise<ConfiguredThreadsAccountProfile[]> {
  const configuredAccounts = await Promise.all(
    getConfiguredThreadsAccountDefinitions(env).map((account) => resolveConfiguredThreadsAccount(env, account)),
  );
  const accounts = configuredAccounts.filter((account): account is ResolvedConfiguredThreadsAccount => account !== null);
  return Promise.all(accounts.map((account, index) => fetchConfiguredThreadsProfile(env, account, index)));
}

async function bootstrapConfiguredThreadsAccounts(env: Env): Promise<void> {
  const accounts = await Promise.all(
    getConfiguredThreadsAccountDefinitions(env).map((account) => resolveConfiguredThreadsAccount(env, account)),
  );

  for (const account of accounts) {
    if (!account) {
      continue;
    }
    try {
      const profile = await fetchThreadsProfileByAccessToken(account.accessToken);
      if (!profile?.threads_user_id) {
        continue;
      }
      await upsertConfiguredThreadsAccountToken(env, account, profile.threads_user_id);
    } catch {
      // Best-effort bootstrap only.
    }
  }
}

type OauthStateContext = {
  appBaseUrl: string;
  appUserId: string | null;
  connectionMode?: "add" | null;
  expectedThreadsUsername?: string | null;
};

type AuthProvider = "google" | "github" | "discord";

type OAuthIdentity = {
  providerUserId: string;
  email: string | null;
};

function encodeBase64Url(raw: string): string {
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeOauthStateBase64Url(raw: string): string {
  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;
  const padded = remainder === 0 ? normalized : `${normalized}${"=".repeat(4 - remainder)}`;
  return atob(padded);
}

function buildOauthState(
  appBaseUrl: string,
  appUserId: string,
  connectionMode: "add" | null = null,
  expectedThreadsUsername: string | null = null,
): string {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const encodedContext = encodeBase64Url(JSON.stringify({
    appBaseUrl,
    appUserId,
    connectionMode,
    expectedThreadsUsername,
  }));
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
    const decoded = decodeOauthStateBase64Url(encodedState);
    if (decoded.startsWith("{")) {
      const parsed = JSON.parse(decoded) as {
        appBaseUrl?: string;
        appUserId?: string;
        connectionMode?: string | null;
        expectedThreadsUsername?: string | null;
      };
      const appBaseUrl = normalizeAppBaseUrl(parsed.appBaseUrl ?? null);
      if (!appBaseUrl) {
        return null;
      }
      const normalizedConnectionMode = parsed.connectionMode?.trim().toLowerCase() === "add" ? "add" : null;
      const normalizedExpectedUsername = parsed.expectedThreadsUsername?.trim().toLowerCase() ?? null;
      return {
        appBaseUrl,
        appUserId: normalizeAppUserId(parsed.appUserId ?? null),
        connectionMode: normalizedConnectionMode,
        expectedThreadsUsername: normalizedExpectedUsername,
      };
    }
    const appBaseUrl = normalizeAppBaseUrl(decoded);
    if (!appBaseUrl) {
      return null;
    }
    return { appBaseUrl, appUserId: null, connectionMode: null, expectedThreadsUsername: null };
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
    providerErrorMessage?: string;
    providerResponseBody?: string;
  };

function sanitizePublishErrorDetail(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 180);
}

function buildPublishErrorStorageValue(
  errorCode: string,
  status?: number,
  providerErrorMessage?: string,
): string {
  const statusPart = typeof status === "number" ? `:${status}` : "";
  const providerDetail = typeof providerErrorMessage === "string"
    ? sanitizePublishErrorDetail(providerErrorMessage)
    : "";
  return providerDetail
    ? `${errorCode}${statusPart}:${providerDetail}`
    : `${errorCode}${statusPart}`;
}

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
        providerErrorMessage: publishResult.errorMessage,
        providerResponseBody: publishResult.responseBody,
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
      provider_error_message: publishOutcome.providerErrorMessage ?? null,
      provider_response_body: publishOutcome.providerResponseBody ?? null,
      linked_threads_user_id: publishOutcome.accountThreadsUserId,
    });
    await transitionScheduledPostStatus(
      env,
      post.id,
      SCHEDULED_POST_STATUS_POSTING,
      SCHEDULED_POST_STATUS_APPROVED,
      {
        publishErrorMessage: buildPublishErrorStorageValue(
          publishOutcome.errorCode,
          publishOutcome.status,
          publishOutcome.providerErrorMessage,
        ),
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

function safeParseJsonString(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isInternalRequestAuthorized(request: Request, env: Env): boolean {
  const internalKey = request.headers.get("x-internal-key")?.trim();
  return Boolean(internalKey && env.INTERNAL_API_KEY && internalKey === env.INTERNAL_API_KEY);
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidIsoTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.test(value);
}

function parseHourMinute(value: string): { hour: number; minute: number } | null {
  const match = value.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
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
  const normalizedAuthUserId = normalizeAppUserId(authUserId);
  if (!normalizedAuthUserId) {
    return null;
  }

  if (requestedAppUserId && requestedAppUserId !== normalizedAuthUserId) {
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
  const appThreadsTableExists = await doesTableExist(env, "app_threads_accounts");
  if (!appThreadsTableExists) {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS app_threads_accounts (
        app_user_id TEXT NOT NULL,
        threads_user_id TEXT NOT NULL,
        connection_active INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        tombstone_expires_at TEXT,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (app_user_id, threads_user_id),
        FOREIGN KEY (app_user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
    ).run();
  }

  const appThreadsTableInfo = await env.DB.prepare("PRAGMA table_info(app_threads_accounts)").all<{
    name: string;
    pk: number;
  }>();
  const appThreadsColumnNames = new Set((appThreadsTableInfo.results ?? []).map((column) => column.name));
  const hasLegacyConnectionActive = appThreadsColumnNames.has("connection_active");
  const hasLegacyIsActive = appThreadsColumnNames.has("is_active");
  const hasLegacyTombstoneExpiresAt = appThreadsColumnNames.has("tombstone_expires_at");
  const hasLegacyCreatedAt = appThreadsColumnNames.has("created_at");
  const legacyConnectionActiveExpr = hasLegacyConnectionActive && hasLegacyIsActive
    ? "COALESCE(connection_active, is_active, 1)"
    : hasLegacyConnectionActive
      ? "COALESCE(connection_active, 1)"
      : hasLegacyIsActive
        ? "COALESCE(is_active, 1)"
        : "1";
  const legacyIsActiveExpr = hasLegacyIsActive && hasLegacyConnectionActive
    ? "COALESCE(is_active, connection_active, 1)"
    : hasLegacyIsActive
      ? "COALESCE(is_active, 1)"
      : hasLegacyConnectionActive
        ? "COALESCE(connection_active, 1)"
        : "1";
  const legacyTombstoneExpr = hasLegacyTombstoneExpiresAt ? "tombstone_expires_at" : "NULL";
  const legacyCreatedAtExpr = hasLegacyCreatedAt
    ? "created_at"
    : "CAST(strftime('%s','now') AS INTEGER)";
  const appUserIdPkOrdinal = (appThreadsTableInfo.results ?? []).find((column) => column.name === "app_user_id")?.pk ?? 0;
  const threadsUserIdPkOrdinal = (appThreadsTableInfo.results ?? []).find((column) => column.name === "threads_user_id")?.pk ?? 0;
  const legacyPrimaryKeyOnAppUserId = Number(appUserIdPkOrdinal) > 0 && Number(threadsUserIdPkOrdinal) === 0;

  if (legacyPrimaryKeyOnAppUserId) {
    const dbSession = env.DB.withSession("first-primary");
    let transactionStarted = false;
    try {
      await dbSession.prepare("BEGIN TRANSACTION").run();
      transactionStarted = true;

      await dbSession.prepare(
        `CREATE TABLE IF NOT EXISTS app_threads_accounts_multi (
          app_user_id TEXT NOT NULL,
          threads_user_id TEXT NOT NULL,
          connection_active INTEGER NOT NULL DEFAULT 1,
          is_active INTEGER NOT NULL DEFAULT 1,
          tombstone_expires_at TEXT,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (app_user_id, threads_user_id),
          FOREIGN KEY (app_user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
      ).run();

      await dbSession.prepare(
        `INSERT OR REPLACE INTO app_threads_accounts_multi (
          app_user_id,
          threads_user_id,
          connection_active,
          is_active,
          tombstone_expires_at,
          created_at
        )
        SELECT
          app_user_id,
          threads_user_id,
          ${legacyConnectionActiveExpr},
          ${legacyIsActiveExpr},
          ${legacyTombstoneExpr},
          ${legacyCreatedAtExpr}
        FROM app_threads_accounts`,
      ).run();

      await dbSession.prepare("DROP TABLE app_threads_accounts").run();
      await dbSession.prepare("ALTER TABLE app_threads_accounts_multi RENAME TO app_threads_accounts").run();

      await dbSession.prepare("COMMIT").run();
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) {
        await dbSession.prepare("ROLLBACK").run();
      }
      throw error;
    }
  }

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS app_threads_accounts (
      app_user_id TEXT NOT NULL,
      threads_user_id TEXT NOT NULL,
      connection_active INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      tombstone_expires_at TEXT,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (app_user_id, threads_user_id),
      FOREIGN KEY (app_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  ).run();

  const appThreadsColumns: Array<{ name: string; definition: string }> = [
    { name: "connection_active", definition: "INTEGER NOT NULL DEFAULT 1" },
    { name: "is_active", definition: "INTEGER NOT NULL DEFAULT 1" },
    { name: "tombstone_expires_at", definition: "TEXT" },
    { name: "created_at", definition: "INTEGER NOT NULL DEFAULT 0" },
  ];
  for (const column of appThreadsColumns) {
    const columnExists = await doesColumnExist(env, "app_threads_accounts", column.name);
    if (columnExists) {
      continue;
    }
    await env.DB.prepare(
      `ALTER TABLE app_threads_accounts ADD COLUMN ${column.name} ${column.definition}`,
    ).run();
  }

  await env.DB.prepare(
    `UPDATE app_threads_accounts
     SET connection_active = COALESCE(connection_active, is_active, 1),
         is_active = COALESCE(is_active, connection_active, 1)
     WHERE connection_active IS NULL
        OR is_active IS NULL`,
  ).run();

  // Admin accounts should never retain reconnect tombstones.
  // Guard this for older DBs where users.is_admin may not exist yet.
  const usersHasIsAdminColumn = await doesColumnExist(env, "users", "is_admin");
  if (usersHasIsAdminColumn) {
    await env.DB.prepare(
      `UPDATE app_threads_accounts
       SET tombstone_expires_at = NULL
       WHERE app_user_id IN (
         SELECT id
         FROM users
         WHERE is_admin = 1
       )
         AND tombstone_expires_at IS NOT NULL`,
    ).run();
  }

  await env.DB.prepare(
    `UPDATE app_threads_accounts
     SET is_active = 0
     WHERE COALESCE(connection_active, is_active, 1) = 0
       AND COALESCE(is_active, 1) != 0`,
  ).run();

  const usersNeedingSingleActiveNormalization = await env.DB.prepare(
    `SELECT app_user_id
     FROM app_threads_accounts
     WHERE COALESCE(connection_active, is_active, 1) = 1
     GROUP BY app_user_id
     HAVING SUM(CASE WHEN COALESCE(is_active, 1) = 1 THEN 1 ELSE 0 END) != 1`,
  ).all<{ app_user_id: string }>();

  for (const row of usersNeedingSingleActiveNormalization.results ?? []) {
    const appUserId = row.app_user_id?.trim();
    if (!appUserId) {
      continue;
    }

    const preferredRow = await env.DB.prepare(
      `SELECT threads_user_id
       FROM app_threads_accounts
       WHERE app_user_id = ?
         AND COALESCE(connection_active, is_active, 1) = 1
       ORDER BY created_at DESC, threads_user_id ASC
       LIMIT 1`,
    )
      .bind(appUserId)
      .first<{ threads_user_id: string }>();

    if (!preferredRow?.threads_user_id) {
      continue;
    }

    await env.DB.prepare(
      `UPDATE app_threads_accounts
       SET is_active = CASE
         WHEN threads_user_id = ? AND COALESCE(connection_active, is_active, 1) = 1 THEN 1
         ELSE 0
       END
       WHERE app_user_id = ?`,
    )
      .bind(preferredRow.threads_user_id, appUserId)
      .run();
  }

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_app_threads_accounts_app_user_active
     ON app_threads_accounts (app_user_id, connection_active, is_active, created_at DESC)`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_app_threads_accounts_threads_user_id
     ON app_threads_accounts (threads_user_id)`,
  ).run();

  await env.DB.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_app_threads_accounts_one_active_per_user
     ON app_threads_accounts (app_user_id)
     WHERE COALESCE(connection_active, is_active, 1) = 1
       AND COALESCE(is_active, 1) = 1`,
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

async function rebuildAppThreadsTableForMultiAccount(env: Env): Promise<void> {
  const legacyTableInfo = await env.DB.prepare("PRAGMA table_info(app_threads_accounts)").all<{ name: string }>();
  const legacyColumnNames = new Set((legacyTableInfo.results ?? []).map((column) => column.name));
  const hasLegacyConnectionActive = legacyColumnNames.has("connection_active");
  const hasLegacyIsActive = legacyColumnNames.has("is_active");
  const hasLegacyTombstoneExpiresAt = legacyColumnNames.has("tombstone_expires_at");
  const hasLegacyCreatedAt = legacyColumnNames.has("created_at");
  const legacyConnectionActiveExpr = hasLegacyConnectionActive && hasLegacyIsActive
    ? "COALESCE(connection_active, is_active, 1)"
    : hasLegacyConnectionActive
      ? "COALESCE(connection_active, 1)"
      : hasLegacyIsActive
        ? "COALESCE(is_active, 1)"
        : "1";
  const legacyIsActiveExpr = hasLegacyIsActive && hasLegacyConnectionActive
    ? "COALESCE(is_active, connection_active, 1)"
    : hasLegacyIsActive
      ? "COALESCE(is_active, 1)"
      : hasLegacyConnectionActive
        ? "COALESCE(connection_active, 1)"
        : "1";
  const legacyTombstoneExpr = hasLegacyTombstoneExpiresAt ? "tombstone_expires_at" : "NULL";
  const legacyCreatedAtExpr = hasLegacyCreatedAt
    ? "created_at"
    : "CAST(strftime('%s','now') AS INTEGER)";

  const dbSession = env.DB.withSession("first-primary");
  let transactionStarted = false;
  try {
    await dbSession.prepare("BEGIN TRANSACTION").run();
    transactionStarted = true;

    await dbSession.prepare(
      `CREATE TABLE IF NOT EXISTS app_threads_accounts_multi_rebuild (
        app_user_id TEXT NOT NULL,
        threads_user_id TEXT NOT NULL,
        connection_active INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        tombstone_expires_at TEXT,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (app_user_id, threads_user_id),
        FOREIGN KEY (app_user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
    ).run();

    await dbSession.prepare(
      `INSERT OR REPLACE INTO app_threads_accounts_multi_rebuild (
        app_user_id,
        threads_user_id,
        connection_active,
        is_active,
        tombstone_expires_at,
        created_at
      )
      SELECT
        app_user_id,
        threads_user_id,
        ${legacyConnectionActiveExpr},
        ${legacyIsActiveExpr},
        ${legacyTombstoneExpr},
        ${legacyCreatedAtExpr}
      FROM app_threads_accounts`,
    ).run();

    await dbSession.prepare("DROP TABLE app_threads_accounts").run();
    await dbSession.prepare("ALTER TABLE app_threads_accounts_multi_rebuild RENAME TO app_threads_accounts").run();
    await dbSession.prepare("COMMIT").run();
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      await dbSession.prepare("ROLLBACK").run();
    }
    throw error;
  }

  await ensureAppThreadsTable(env);
}

async function upsertAppThreadsAccountLink(
  env: Env,
  appUserId: string,
  threadsUserId: string,
  createdAt: number,
): Promise<void> {
  const upsertSql = `INSERT INTO app_threads_accounts (
      app_user_id,
      threads_user_id,
      connection_active,
      is_active,
      tombstone_expires_at,
      created_at
    )
    VALUES (?, ?, 1, 0, NULL, ?)
    ON CONFLICT(app_user_id, threads_user_id) DO UPDATE SET
      connection_active = 1,
      is_active = 0,
      tombstone_expires_at = NULL`;

  try {
    await ensureAppThreadsTable(env);
    await env.DB.prepare(upsertSql)
      .bind(appUserId, threadsUserId, createdAt)
      .run();
  } catch (error) {
    const message = getErrorMessage(error);
    const shouldForceRebuild = message.includes("ON CONFLICT clause does not match")
      || message.includes("no such column")
      || message.includes("UNIQUE constraint failed: app_threads_accounts.app_user_id");
    if (!shouldForceRebuild) {
      throw error;
    }

    await rebuildAppThreadsTableForMultiAccount(env);
    await env.DB.prepare(upsertSql)
      .bind(appUserId, threadsUserId, createdAt)
      .run();
  }
}

async function linkThreadsAccountWithSchemaFallback(
  env: Env,
  appUserId: string,
  threadsUserId: string,
  createdAt: number,
): Promise<boolean> {
  const writeAttempts: Array<{ sql: string; bindings: Array<string | number> }> = [
    {
      sql: `INSERT INTO app_threads_accounts (
              app_user_id,
              threads_user_id,
              connection_active,
              is_active,
              tombstone_expires_at,
              created_at
            )
            VALUES (?, ?, 1, 0, NULL, ?)
            ON CONFLICT(app_user_id, threads_user_id) DO UPDATE SET
              connection_active = 1,
              is_active = 0,
              tombstone_expires_at = NULL`,
      bindings: [appUserId, threadsUserId, createdAt],
    },
    {
      sql: `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
            VALUES (?, ?, ?)
            ON CONFLICT(app_user_id, threads_user_id) DO UPDATE SET
              threads_user_id = excluded.threads_user_id`,
      bindings: [appUserId, threadsUserId, createdAt],
    },
    {
      sql: `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
            VALUES (?, ?, ?)
            ON CONFLICT(app_user_id) DO UPDATE SET
              threads_user_id = excluded.threads_user_id`,
      bindings: [appUserId, threadsUserId, createdAt],
    },
    {
      sql: `INSERT INTO app_threads_accounts (app_user_id, threads_user_id)
            VALUES (?, ?)
            ON CONFLICT(app_user_id) DO UPDATE SET
              threads_user_id = excluded.threads_user_id`,
      bindings: [appUserId, threadsUserId],
    },
    {
      sql: `INSERT INTO app_threads_accounts (app_user_id, threads_user_id)
            VALUES (?, ?)
            ON CONFLICT(app_user_id, threads_user_id) DO NOTHING`,
      bindings: [appUserId, threadsUserId],
    },
  ];

  for (const attempt of writeAttempts) {
    try {
      await env.DB.prepare(attempt.sql).bind(...attempt.bindings).run();
      return true;
    } catch {
      // Try the next legacy-compatible write shape.
    }
  }

  try {
    const updateResult = await env.DB.prepare(
      `UPDATE app_threads_accounts
       SET threads_user_id = ?
       WHERE app_user_id = ?`,
    )
      .bind(threadsUserId, appUserId)
      .run();
    if (Number(updateResult.meta?.changes ?? 0) > 0) {
      return true;
    }
  } catch {
    // Fall through to insert-only attempt.
  }

  try {
    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id)
       VALUES (?, ?)`,
    )
      .bind(appUserId, threadsUserId)
      .run();
    return true;
  } catch {
    // Try created_at variant as final fallback.
  }

  try {
    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind(appUserId, threadsUserId, createdAt)
      .run();
    return true;
  } catch {
    return false;
  }
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

function normalizeBatchSchedulePresetName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_BATCH_SCHEDULE_PRESET_NAME_LENGTH) {
    return null;
  }
  return trimmed;
}

function normalizeBatchSchedulePresetTimes(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BATCH_SCHEDULE_PRESET_SLOTS) {
    return null;
  }

  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .map((entry) => {
      const parsed = parseHourMinute(entry);
      if (!parsed) {
        return "";
      }
      return `${parsed.hour.toString().padStart(2, "0")}:${parsed.minute.toString().padStart(2, "0")}`;
    });

  if (normalized.some((entry) => !entry)) {
    return null;
  }

  return normalized;
}

async function ensureBatchSchedulePresetsTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS batch_schedule_presets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      times_json TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_batch_schedule_presets_user_id
     ON batch_schedule_presets (user_id, is_favorite DESC, updated_at DESC)`,
  ).run();

  await env.DB.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_schedule_presets_favorite_per_user
     ON batch_schedule_presets (user_id)
     WHERE is_favorite = 1`,
  ).run();

  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_batch_schedule_presets_touch_updated_at
     AFTER UPDATE ON batch_schedule_presets
     FOR EACH ROW
     WHEN NEW.updated_at = OLD.updated_at
     BEGIN
       UPDATE batch_schedule_presets
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = NEW.id;
     END`,
  ).run();

  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_batch_schedule_presets_user_cleanup
     AFTER DELETE ON users
     FOR EACH ROW
     BEGIN
       DELETE FROM batch_schedule_presets
       WHERE user_id = OLD.id;
     END`,
  ).run();
}

async function listBatchSchedulePresetsForUser(
  env: Env,
  userId: string,
): Promise<Array<{ id: string; name: string; times: string[]; is_favorite: boolean; created_at: string; updated_at: string }>> {
  await ensureBatchSchedulePresetsTable(env);
  const rows = await env.DB.prepare(
    `SELECT id, name, times_json, is_favorite, created_at, updated_at
     FROM batch_schedule_presets
     WHERE user_id = ?
     ORDER BY is_favorite DESC, updated_at DESC, created_at DESC, id DESC`,
  )
    .bind(userId)
    .all<{
      id: string;
      name: string;
      times_json: string;
      is_favorite: number;
      created_at: string;
      updated_at: string;
    }>();

  return (rows.results ?? []).map((row) => {
    let parsedTimes: unknown = [];
    try {
      parsedTimes = JSON.parse(row.times_json);
    } catch {
      parsedTimes = [];
    }
    const normalizedTimes = normalizeBatchSchedulePresetTimes(parsedTimes) ?? [];
    return {
      id: row.id,
      name: row.name,
      times: normalizedTimes,
      is_favorite: Number(row.is_favorite) === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
}

async function listUserTableColumns(env: Env): Promise<string[]> {
  const result = await env.DB.prepare("PRAGMA table_info(users)").all<{ name?: string }>();
  return (result.results ?? [])
    .map((row) => (typeof row?.name === "string" ? row.name : ""))
    .filter((name) => name.length > 0);
}

async function ensureWorkspaceUserRecord(
  env: Env,
  user: {
    id: string;
    email: string;
    timezone?: string | null;
    clock_format?: string | null;
  },
): Promise<void> {
  const usersTableExists = await doesTableExist(env, "users");
  if (!usersTableExists) {
    throw new Error("users_table_missing");
  }

  const columns = await listUserTableColumns(env);
  const insertColumns = ["id", "email", "password_hash", "email_verified", "created_at"];
  const insertValues = ["?", "?", "NULL", "1", "CURRENT_TIMESTAMP"];
  const bindings: Array<string> = [user.id, user.email];
  const updateAssignments = ["email = excluded.email"];

  if (columns.includes("timezone")) {
    insertColumns.push("timezone");
    insertValues.push("?");
    bindings.push(user.timezone?.trim() || "America/New_York");
    updateAssignments.push("timezone = excluded.timezone");
  }

  if (columns.includes("clock_format")) {
    insertColumns.push("clock_format");
    insertValues.push("?");
    bindings.push(user.clock_format?.trim() || "12h");
    updateAssignments.push("clock_format = excluded.clock_format");
  }

  await env.DB.prepare(
    `INSERT INTO users (${insertColumns.join(", ")})
     VALUES (${insertValues.join(", ")})
     ON CONFLICT(id) DO UPDATE SET ${updateAssignments.join(", ")}`,
  )
    .bind(...bindings)
    .run();
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

async function ensureThreadsAccountsTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS threads_accounts (
      threads_user_id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      configured_account_id TEXT
    )`,
  ).run();

  const tableInfo = await env.DB.prepare("PRAGMA table_info(threads_accounts)").all<{
    name: string;
    pk: number;
  }>();
  const tableColumns = tableInfo.results ?? [];
  const columnNames = new Set(tableColumns.map((column) => column.name));
  const hasThreadsUserId = columnNames.has("threads_user_id");
  const threadsUserIdPkOrdinal = tableColumns.find((column) => column.name === "threads_user_id")?.pk ?? 0;
  const needsPrimaryKeyRebuild = !hasThreadsUserId || Number(threadsUserIdPkOrdinal) === 0;

  if (needsPrimaryKeyRebuild) {
    const hasUserId = columnNames.has("user_id");
    const hasAppUserId = columnNames.has("app_user_id");
    const hasAccessToken = columnNames.has("access_token");
    const hasExpiresAt = columnNames.has("expires_at");
    const hasCreatedAt = columnNames.has("created_at");
    const hasConfiguredAccountId = columnNames.has("configured_account_id");

    const threadsUserIdExpr = hasThreadsUserId
      ? "threads_user_id"
      : hasUserId
        ? "user_id"
        : hasAppUserId
          ? "app_user_id"
          : "NULL";
    const accessTokenExpr = hasAccessToken ? "access_token" : "''";
    const expiresAtExpr = hasExpiresAt ? "expires_at" : "0";
    const createdAtExpr = hasCreatedAt ? "created_at" : "CAST(strftime('%s','now') AS INTEGER)";
    const configuredAccountIdExpr = hasConfiguredAccountId ? "configured_account_id" : "NULL";

    const dbSession = env.DB.withSession("first-primary");
    let transactionStarted = false;
    try {
      await dbSession.prepare("BEGIN TRANSACTION").run();
      transactionStarted = true;

      await dbSession.prepare(
        `CREATE TABLE IF NOT EXISTS threads_accounts_rebuild (
          threads_user_id TEXT PRIMARY KEY,
          access_token TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          configured_account_id TEXT
        )`,
      ).run();

      await dbSession.prepare(
        `INSERT OR REPLACE INTO threads_accounts_rebuild (
          threads_user_id,
          access_token,
          expires_at,
          created_at,
          configured_account_id
        )
        SELECT
          ${threadsUserIdExpr},
          ${accessTokenExpr},
          ${expiresAtExpr},
          ${createdAtExpr},
          ${configuredAccountIdExpr}
        FROM threads_accounts
        WHERE ${threadsUserIdExpr} IS NOT NULL
          AND length(trim(${threadsUserIdExpr})) > 0`,
      ).run();

      await dbSession.prepare("DROP TABLE threads_accounts").run();
      await dbSession.prepare("ALTER TABLE threads_accounts_rebuild RENAME TO threads_accounts").run();

      await dbSession.prepare("COMMIT").run();
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) {
        await dbSession.prepare("ROLLBACK").run();
      }
      throw error;
    }
  }

  const requiredColumns: Array<{ name: string; definition: string }> = [
    { name: "access_token", definition: "TEXT NOT NULL DEFAULT ''" },
    { name: "expires_at", definition: "INTEGER NOT NULL DEFAULT 0" },
    { name: "created_at", definition: "INTEGER NOT NULL DEFAULT 0" },
    { name: "configured_account_id", definition: "TEXT" },
  ];

  for (const column of requiredColumns) {
    const exists = await doesColumnExist(env, "threads_accounts", column.name);
    if (exists) {
      continue;
    }
    await env.DB.prepare(`ALTER TABLE threads_accounts ADD COLUMN ${column.name} ${column.definition}`).run();
  }

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_threads_accounts_configured_account_id
     ON threads_accounts (configured_account_id)`,
  ).run();
}

type ThreadsAccount = {
  threads_user_id: string;
  access_token: string;
};

type LinkedThreadsAccount = {
  threads_user_id: string;
  is_active: number;
  created_at: number;
  username: string | null;
  name: string | null;
  threads_profile_picture_url: string | null;
  threads_biography: string | null;
  is_verified: number | null;
};

type ThreadsProfileCachePayload = {
  threads_user_id: string;
  username: string | null;
  name: string | null;
  threads_biography: string | null;
  is_verified: boolean;
  threads_profile_picture_url: string | null;
};

type ThreadsProfileCacheRow = {
  threads_user_id: string;
  username: string | null;
  name: string | null;
  threads_biography: string | null;
  is_verified: number;
  threads_profile_picture_url: string | null;
  last_refreshed_at: string;
};

type ThreadsInsightsMetricName =
  | "views"
  | "likes"
  | "replies"
  | "reposts"
  | "quotes"
  | "shares"
  | "clicks"
  | "followers_count";

type ThreadsMetricMap = Record<ThreadsInsightsMetricName, number>;

type ThreadsUserInsightsCachePayload = {
  threads_user_id: string;
  insights_json: string;
};

type ThreadsUserInsightsCacheRow = {
  threads_user_id: string;
  insights_json: string;
  last_refreshed_at: string;
};

type ThreadsFollowerSnapshotRow = {
  threads_user_id: string;
  snapshot_date: string;
  followers_count: number | string;
  baseline_followers_count?: number | string | null;
  captured_at: string;
};

type CachedThreadsPost = {
  id: string;
  text: string | null;
  timestamp: string | null;
  permalink: string | null;
  username: string | null;
  profile_picture_url: string | null;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
  engagement_total: number;
};

type ThreadsPostsCacheStatePayload = {
  threads_user_id: string;
  next_cursor: string | null;
  has_more: boolean;
};

type ThreadsPostsArchiveRow = {
  threads_user_id: string;
  post_id: string;
  post_text: string | null;
  post_timestamp: string | null;
  post_permalink: string | null;
  post_username: string | null;
  profile_picture_url: string | null;
  views: number | string | null;
  likes: number | string | null;
  replies: number | string | null;
  reposts: number | string | null;
  quotes: number | string | null;
  shares: number | string | null;
  engagement_total: number | string | null;
  source_rank: number | string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_synced_at: string;
};

type AutomationDailyRunLockRow = {
  automation_id: string;
  account_id: string;
  run_date: string;
  first_source: string;
  first_claimed_at: string;
  last_claimed_at: string;
  manual_claim_count: number | string | null;
  scheduled_claim_count: number | string | null;
  last_result: string | null;
  successful_completed_at: string | null;
  last_finished_at: string | null;
};

type ThreadsPostsCacheStateRow = {
  threads_user_id: string;
  next_cursor: string | null;
  has_more: number;
  last_refreshed_at: string;
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
  const configuredAccount = await getConfiguredThreadsAccountById(env, null);
  if (configuredAccount) {
    const profile = await fetchConfiguredThreadsProfile(env, configuredAccount, 0);
    return {
      threads_user_id: profile.threads_user_id,
      access_token: configuredAccount.accessToken,
    };
  }

  return null;
}

async function listConnectedThreadsAccountsForAppUser(
  env: Env,
  appUserId: string,
): Promise<LinkedThreadsAccount[]> {
  const configuredProfiles = await getConfiguredThreadsProfiles(env);
  if (configuredProfiles.length > 0) {
    return configuredProfiles.map((profile, index) => ({
      threads_user_id: profile.threads_user_id,
      is_active: index === 0 ? 1 : 0,
      created_at: 0,
      username: profile.username ?? null,
      name: profile.name ?? profile.label ?? null,
      threads_profile_picture_url: profile.threads_profile_picture_url ?? null,
      threads_biography: profile.threads_biography ?? null,
      is_verified: profile.is_verified ? 1 : 0,
    }));
  }

  return [];
}

function getThreadsConnectionTombstoneExpiresAt(nowMs = Date.now()): string {
  return new Date(nowMs + THREADS_CONNECTION_TOMBSTONE_WINDOW_MS).toISOString();
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

async function ensureThreadsProfileCacheTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS threads_profile_cache (
      threads_user_id TEXT PRIMARY KEY CHECK (length(trim(threads_user_id)) > 0),
      username TEXT,
      name TEXT,
      threads_biography TEXT,
      is_verified INTEGER NOT NULL DEFAULT 0,
      threads_profile_picture_url TEXT,
      last_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (threads_user_id) REFERENCES threads_accounts(threads_user_id) ON DELETE CASCADE
    )`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_threads_profile_cache_last_refreshed_at
     ON threads_profile_cache (last_refreshed_at)`,
  ).run();
}

async function upsertThreadsProfileCache(env: Env, payload: ThreadsProfileCachePayload): Promise<void> {
  await ensureThreadsProfileCacheTable(env);

  await env.DB.prepare(
    `INSERT INTO threads_profile_cache (
      threads_user_id,
      username,
      name,
      threads_biography,
      is_verified,
      threads_profile_picture_url,
      last_refreshed_at
    )
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(threads_user_id) DO UPDATE SET
      username = excluded.username,
      name = excluded.name,
      threads_biography = excluded.threads_biography,
      is_verified = excluded.is_verified,
      threads_profile_picture_url = excluded.threads_profile_picture_url,
      last_refreshed_at = CURRENT_TIMESTAMP`,
  )
    .bind(
      payload.threads_user_id,
      payload.username,
      payload.name,
      payload.threads_biography,
      payload.is_verified ? 1 : 0,
      payload.threads_profile_picture_url,
    )
    .run();
}

async function getFreshThreadsProfileCache(
  env: Env,
  threadsUserId: string,
): Promise<ThreadsProfileCacheRow | null> {
  await ensureThreadsProfileCacheTable(env);

  return env.DB.prepare(
    `SELECT threads_user_id, username, name, threads_biography, is_verified, threads_profile_picture_url, last_refreshed_at
     FROM threads_profile_cache
     WHERE threads_user_id = ?
       AND datetime(last_refreshed_at) >= datetime('now', '-24 hours')
     LIMIT 1`,
  )
    .bind(threadsUserId)
    .first<ThreadsProfileCacheRow>();
}

async function ensureThreadsUserInsightsCacheTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS threads_user_insights_cache (
      threads_user_id TEXT PRIMARY KEY CHECK (length(trim(threads_user_id)) > 0),
      insights_json TEXT NOT NULL,
      last_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_threads_user_insights_cache_last_refreshed_at
     ON threads_user_insights_cache (last_refreshed_at)`,
  ).run();
}

async function upsertThreadsUserInsightsCache(
  env: Env,
  payload: ThreadsUserInsightsCachePayload,
): Promise<void> {
  await ensureThreadsUserInsightsCacheTable(env);

  await env.DB.prepare(
    `INSERT INTO threads_user_insights_cache (
      threads_user_id,
      insights_json,
      last_refreshed_at
    )
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(threads_user_id) DO UPDATE SET
      insights_json = excluded.insights_json,
      last_refreshed_at = CURRENT_TIMESTAMP`,
  )
    .bind(payload.threads_user_id, payload.insights_json)
    .run();
}

async function getFreshThreadsUserInsightsCache(
  env: Env,
  threadsUserId: string,
): Promise<ThreadsUserInsightsCacheRow | null> {
  await ensureThreadsUserInsightsCacheTable(env);

  return env.DB.prepare(
    `SELECT threads_user_id, insights_json, last_refreshed_at
     FROM threads_user_insights_cache
     WHERE threads_user_id = ?
       AND datetime(last_refreshed_at) >= datetime('now', '-${THREADS_INSIGHTS_CACHE_MAX_AGE_HOURS} hours')
     LIMIT 1`,
  )
    .bind(threadsUserId)
    .first<ThreadsUserInsightsCacheRow>();
}

async function ensureThreadsFollowerSnapshotsTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS threads_follower_snapshots (
      threads_user_id TEXT NOT NULL CHECK (length(trim(threads_user_id)) > 0),
      snapshot_date TEXT NOT NULL CHECK (length(trim(snapshot_date)) = 10),
      followers_count INTEGER NOT NULL DEFAULT 0,
      baseline_followers_count INTEGER,
      captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (threads_user_id, snapshot_date)
    )`,
  ).run();

  const tableInfo = await env.DB.prepare(
    `PRAGMA table_info(threads_follower_snapshots)`,
  ).all<{ name: string }>();

  const columnNames = new Set((tableInfo.results ?? []).map((column) => column.name));
  if (!columnNames.has("baseline_followers_count")) {
    await env.DB.prepare(
      `ALTER TABLE threads_follower_snapshots
       ADD COLUMN baseline_followers_count INTEGER`,
    ).run();
  }

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_threads_follower_snapshots_captured_at
     ON threads_follower_snapshots (captured_at)`,
  ).run();
}

async function upsertThreadsFollowerSnapshot(
  env: Env,
  threadsUserId: string,
  snapshotDate: string,
  followersCount: number,
): Promise<void> {
  await ensureThreadsFollowerSnapshotsTable(env);

  const normalizedFollowersCount = Math.max(0, Math.trunc(followersCount));
  const existingSnapshot = await env.DB.prepare(
    `SELECT threads_user_id, snapshot_date, followers_count, baseline_followers_count, captured_at
     FROM threads_follower_snapshots
     WHERE threads_user_id = ?
       AND snapshot_date = ?
     LIMIT 1`,
  )
    .bind(threadsUserId, snapshotDate)
    .first<ThreadsFollowerSnapshotRow>();

  const baselineFollowersCount = existingSnapshot
    ? Number(existingSnapshot.baseline_followers_count ?? existingSnapshot.followers_count ?? normalizedFollowersCount)
    : await env.DB.prepare(
      `SELECT followers_count
       FROM threads_follower_snapshots
       WHERE threads_user_id = ?
         AND snapshot_date < ?
       ORDER BY snapshot_date DESC
       LIMIT 1`,
    )
      .bind(threadsUserId, snapshotDate)
      .first<{ followers_count?: number | string }>()
      .then((row) => Number(row?.followers_count ?? normalizedFollowersCount));

  if (existingSnapshot) {
    await env.DB.prepare(
      `UPDATE threads_follower_snapshots
       SET followers_count = ?,
           baseline_followers_count = ?,
           captured_at = CURRENT_TIMESTAMP
       WHERE threads_user_id = ?
         AND snapshot_date = ?`,
    )
      .bind(normalizedFollowersCount, baselineFollowersCount, threadsUserId, snapshotDate)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO threads_follower_snapshots (
        threads_user_id,
        snapshot_date,
        followers_count,
        baseline_followers_count,
        captured_at
      )
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
      .bind(threadsUserId, snapshotDate, normalizedFollowersCount, baselineFollowersCount)
      .run();
  }

  await env.DB.prepare(
    `DELETE FROM threads_follower_snapshots
     WHERE threads_user_id = ?
       AND datetime(captured_at) < datetime('now', '-${DASHBOARD_FOLLOWER_SNAPSHOT_RETENTION_DAYS} days')`,
  )
    .bind(threadsUserId)
    .run();
}

async function listThreadsFollowerSnapshots(
  env: Env,
  threadsUserId: string,
  limit = 30,
): Promise<Array<{ snapshot_date: string; followers_count: number; baseline_followers_count: number | null; captured_at: string }>> {
  await ensureThreadsFollowerSnapshotsTable(env);

  const rows = await env.DB.prepare(
    `SELECT threads_user_id, snapshot_date, followers_count, baseline_followers_count, captured_at
     FROM threads_follower_snapshots
     WHERE threads_user_id = ?
     ORDER BY snapshot_date DESC
     LIMIT ?`,
  )
    .bind(threadsUserId, limit)
    .all<ThreadsFollowerSnapshotRow>();

  return (rows.results ?? [])
    .map((row) => ({
      snapshot_date: row.snapshot_date,
      followers_count: Number(row.followers_count ?? 0),
      baseline_followers_count: row.baseline_followers_count === null || row.baseline_followers_count === undefined
        ? null
        : Number(row.baseline_followers_count),
      captured_at: row.captured_at,
    }))
    .reverse();
}

async function countThreadsFollowerSnapshots(
  env: Env,
  threadsUserId: string,
): Promise<number> {
  await ensureThreadsFollowerSnapshotsTable(env);

  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS total_count
     FROM threads_follower_snapshots
     WHERE threads_user_id = ?`,
  )
    .bind(threadsUserId)
    .first<{ total_count?: number | string }>();

  return Number(row?.total_count ?? 0);
}

async function listThreadsFollowerSnapshotsPage(
  env: Env,
  threadsUserId: string,
  limit: number,
  offset: number,
): Promise<Array<{ snapshot_date: string; followers_count: number; baseline_followers_count: number | null; captured_at: string }>> {
  await ensureThreadsFollowerSnapshotsTable(env);

  const rows = await env.DB.prepare(
    `SELECT threads_user_id, snapshot_date, followers_count, baseline_followers_count, captured_at
     FROM threads_follower_snapshots
     WHERE threads_user_id = ?
     ORDER BY snapshot_date DESC
     LIMIT ?
     OFFSET ?`,
  )
    .bind(threadsUserId, limit, offset)
    .all<ThreadsFollowerSnapshotRow>();

  return (rows.results ?? []).map((row) => ({
    snapshot_date: row.snapshot_date,
    followers_count: Number(row.followers_count ?? 0),
    baseline_followers_count: row.baseline_followers_count === null || row.baseline_followers_count === undefined
      ? null
      : Number(row.baseline_followers_count),
    captured_at: row.captured_at,
  }));
}

function extractFollowersCountFromInsightsPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const data = (payload as {
    data?: Array<{
      name?: string;
      values?: Array<{ value?: number }>;
      total_value?: { value?: number };
      link_total_values?: Array<{ value?: number }>;
    }>;
  }).data;

  const metricMap = buildThreadsMetricMap(data);
  return Number.isFinite(metricMap.followers_count) ? metricMap.followers_count : null;
}

async function resolveCurrentThreadsFollowerCount(
  accessToken: string,
  profileUsername: string | null | undefined,
  userInsightsPayload: unknown,
): Promise<number | null> {
  let currentFollowersCount = extractFollowersCountFromInsightsPayload(userInsightsPayload);

  if (profileUsername) {
    const discovery = await executeThreadsProfileLookup({
      accessToken,
      username: profileUsername,
    });
    if (discovery.success && typeof discovery.data.follower_count === "number") {
      currentFollowersCount = discovery.data.follower_count;
    }
  }

  return currentFollowersCount;
}

async function refreshCurrentThreadsFollowerSnapshot(
  env: Env,
  account: ThreadsAccount,
  snapshotTimeZone: string,
): Promise<number | null> {
  const snapshotDate = getLocalDateInTimeZone(snapshotTimeZone, Date.now());
  if (!snapshotDate) {
    return null;
  }

  const profile = await fetchThreadsProfileByAccessToken(account.access_token);
  let userInsightsPayload = await fetchThreadsUserInsightsByAccount(account.access_token, account.threads_user_id);

  if (userInsightsPayload !== null) {
    await upsertThreadsUserInsightsCache(env, {
      threads_user_id: account.threads_user_id,
      insights_json: JSON.stringify(userInsightsPayload),
    });
  } else {
    const cachedInsights = await getFreshThreadsUserInsightsCache(env, account.threads_user_id);
    userInsightsPayload = cachedInsights ? safeParseJsonString(cachedInsights.insights_json) : null;
  }

  const currentFollowersCount = await resolveCurrentThreadsFollowerCount(
    account.access_token,
    profile?.username,
    userInsightsPayload,
  );

  if (currentFollowersCount !== null) {
    await upsertThreadsFollowerSnapshot(env, account.threads_user_id, snapshotDate, currentFollowersCount);
  }

  return currentFollowersCount;
}

function getPostTimestampMs(post: Pick<CachedThreadsPost, "timestamp">): number | null {
  if (!post.timestamp) {
    return null;
  }

  const parsed = Date.parse(post.timestamp);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPostWithinWindow(post: Pick<CachedThreadsPost, "timestamp">, startMs: number, endMs: number): boolean {
  const timestampMs = getPostTimestampMs(post);
  return timestampMs !== null && timestampMs >= startMs && timestampMs < endMs;
}

function getPostLocalDate(post: Pick<CachedThreadsPost, "timestamp">, timeZone: string): string | null {
  const timestampMs = getPostTimestampMs(post);
  if (timestampMs === null) {
    return null;
  }
  return getLocalDateInTimeZone(timeZone, timestampMs);
}

function createPostPreview(text: string | null, maxLength = DASHBOARD_POST_PREVIEW_LENGTH): string {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "(No post text)";
  }
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeDashboardText(text: string | null): string {
  return (text ?? "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, "\"")
    .replace(/[–—]/g, " ")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[@#][\p{L}\p{N}_]+/gu, " ")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDashboardDisplayText(text: string | null): string {
  return (text ?? "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, "\"")
    .replace(/[–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDashboardWords(text: string | null): string[] {
  return normalizeDashboardText(text)
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !DASHBOARD_STOP_WORDS.has(word));
}

function getOpeningKey(text: string | null, wordCount = 5): string | null {
  const words = normalizeDashboardText(text)
    .split(" ")
    .filter(Boolean)
    .slice(0, wordCount);

  return words.length >= Math.min(3, wordCount) ? words.join(" ") : null;
}

function getOpeningDisplay(text: string | null, wordCount = 5): string | null {
  const words = normalizeDashboardDisplayText(text)
    .split(" ")
    .filter(Boolean)
    .slice(0, wordCount);

  return words.length >= Math.min(3, wordCount) ? words.join(" ") : null;
}

function getSentenceShell(text: string | null): string | null {
  const firstSentence = (text ?? "")
    .split(/[.!?]/, 1)[0]
    ?.toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\d+/g, "#")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!firstSentence) {
    return null;
  }

  const words = firstSentence.split(" ");
  return words.length >= 4 ? words.slice(0, 7).join(" ") : null;
}

function getSentenceShellDisplay(text: string | null): string | null {
  const displayText = normalizeDashboardDisplayText(text);
  if (!displayText) {
    return null;
  }

  const firstSentenceMatch = displayText.match(/^[^.!?]+[.!?]?/);
  const firstSentence = firstSentenceMatch?.[0]?.trim() ?? "";
  if (!firstSentence) {
    return null;
  }

  const words = firstSentence.split(" ").filter(Boolean);
  return words.length >= 4 ? words.slice(0, 7).join(" ") : null;
}

function pickTopCounts(
  counts: Map<string, number>,
  limit: number,
  minimumCount = 2,
): Array<{ value: string; count: number }> {
  return Array.from(counts.entries())
    .filter(([, count]) => count >= minimumCount)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function pickTopCountsWithDisplay(
  counts: Map<string, number>,
  displays: Map<string, string>,
  limit: number,
  minimumCount = 2,
): Array<{ value: string; display: string; count: number }> {
  return Array.from(counts.entries())
    .filter(([, count]) => count >= minimumCount)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([value, count]) => ({
      value,
      display: displays.get(value) ?? value,
      count,
    }));
}

function summarizeWinningLanguage(posts: CachedThreadsPost[]): {
  repeated_terms: string[];
  repeated_phrases: string[];
  repeated_openings: string[];
} {
  const wordCounts = new Map<string, number>();
  const phraseCounts = new Map<string, number>();
  const openingCounts = new Map<string, number>();
  const phraseDisplays = new Map<string, string>();
  const openingDisplays = new Map<string, string>();

  for (const post of posts) {
    const words = getDashboardWords(post.text);
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
    }

    for (let index = 0; index < words.length - 1; index += 1) {
      const phrase = `${words[index]} ${words[index + 1]}`;
      phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
      if (!phraseDisplays.has(phrase)) {
        phraseDisplays.set(phrase, phrase);
      }
    }

    const openingKey = getOpeningKey(post.text, 5);
    const openingDisplay = getOpeningDisplay(post.text, 5);
    if (openingKey) {
      openingCounts.set(openingKey, (openingCounts.get(openingKey) ?? 0) + 1);
      if (openingDisplay && !openingDisplays.has(openingKey)) {
        openingDisplays.set(openingKey, openingDisplay);
      }
    }
  }

  return {
    repeated_terms: pickTopCounts(wordCounts, DASHBOARD_WINNING_TERM_LIMIT).map((entry) => entry.value),
    repeated_phrases: pickTopCountsWithDisplay(
      phraseCounts,
      phraseDisplays,
      DASHBOARD_WINNING_PHRASE_LIMIT,
    ).map((entry) => entry.display),
    repeated_openings: pickTopCountsWithDisplay(openingCounts, openingDisplays, 4).map((entry) => entry.display),
  };
}

function buildMetricRanking(
  posts: CachedThreadsPost[],
  metric: "views" | "likes" | "replies" | "reposts",
  limit = 5,
): Array<{
  id: string;
  preview: string;
  timestamp: string | null;
  permalink: string | null;
  metric: number;
}> {
  return [...posts]
    .sort((left, right) => right[metric] - left[metric] || right.engagement_total - left.engagement_total)
    .slice(0, limit)
    .map((post) => ({
      id: post.id,
      preview: createPostPreview(post.text),
      timestamp: post.timestamp,
      permalink: post.permalink,
      metric: post[metric] ?? 0,
    }));
}

async function buildThreadsDashboardPayload(
  env: Env,
  account: ThreadsAccount,
): Promise<Record<string, unknown>> {
  const nowMs = Date.now();
  const todayDate = getLocalDateInTimeZone(DASHBOARD_TIME_ZONE, nowMs) ?? getLocalDateInTimeZone(WORKSPACE_DEFAULT_TIMEZONE, nowMs);
  if (!todayDate) {
    throw new Error("Could not resolve dashboard local date.");
  }

  let profile = await fetchThreadsProfileByAccessToken(account.access_token);
  let userInsightsPayload = await fetchThreadsUserInsightsByAccount(account.access_token, account.threads_user_id);
  let currentFollowersCount = extractFollowersCountFromInsightsPayload(userInsightsPayload);

  if (currentFollowersCount === null) {
    const cachedInsights = await getFreshThreadsUserInsightsCache(env, account.threads_user_id);
    const cachedPayload = cachedInsights ? safeParseJsonString(cachedInsights.insights_json) : null;
    currentFollowersCount = extractFollowersCountFromInsightsPayload(cachedPayload);
    if (userInsightsPayload === null && cachedPayload !== null) {
      userInsightsPayload = cachedPayload;
    }
  }

  currentFollowersCount = await resolveCurrentThreadsFollowerCount(
    account.access_token,
    profile?.username,
    userInsightsPayload,
  );

  if (currentFollowersCount !== null) {
    await upsertThreadsFollowerSnapshot(env, account.threads_user_id, todayDate, currentFollowersCount);
  }

  if (userInsightsPayload !== null) {
    await upsertThreadsUserInsightsCache(env, {
      threads_user_id: account.threads_user_id,
      insights_json: JSON.stringify(userInsightsPayload),
    });
  }

  let latestPosts = await fetchThreadsPostsPageWithInsights(account.access_token, account.threads_user_id, null);
  if (latestPosts) {
    await upsertThreadsPostsArchive(env, account.threads_user_id, latestPosts.posts);
    await replaceThreadsPostsCache(env, account.threads_user_id, latestPosts.posts, {
      threads_user_id: account.threads_user_id,
      next_cursor: latestPosts.nextCursor,
      has_more: latestPosts.hasMore,
    });
  }

  const archive = await listArchivedThreadsPosts(
    env,
    account.threads_user_id,
    "recent",
    DASHBOARD_RECENT_POST_LIMIT,
    0,
  );

  const posts = archive.posts.filter((post) => getPostTimestampMs(post) !== null);
  const last7dStartMs = nowMs - (7 * 24 * 60 * 60 * 1000);
  const postsLast7d = posts.filter((post) => isPostWithinWindow(post, last7dStartMs, nowMs));
  const postsToday = posts.filter((post) => getPostLocalDate(post, DASHBOARD_TIME_ZONE) === todayDate);
  const yesterdayDate = addDaysToIsoDate(todayDate, -1);
  const postsYesterday = yesterdayDate
    ? posts.filter((post) => getPostLocalDate(post, DASHBOARD_TIME_ZONE) === yesterdayDate)
    : [];
  const topPost = await getTopArchivedPostByLikes(env, account.threads_user_id);

  const scheduledPostsTableExists = await doesTableExist(env, "scheduled_posts");
  const scheduledRows = scheduledPostsTableExists
    ? await env.DB.prepare(
      `SELECT id, post_text, status, scheduled_time
       FROM scheduled_posts
       WHERE user_id = ?
         AND status IN (?, ?)
       ORDER BY scheduled_time ASC, id ASC
       LIMIT 100`,
    )
      .bind(
        WORKSPACE_APP_USER_ID,
        SCHEDULED_POST_STATUS_APPROVED,
        SCHEDULED_POST_STATUS_POSTING,
      )
      .all<{
        id: number | string;
        post_text: string;
        status: string;
        scheduled_time: string;
      }>()
    : { results: [] as Array<{ id: number | string; post_text: string; status: string; scheduled_time: string }> };

  const scheduledPosts = (scheduledRows.results ?? []).map((row) => ({
    id: Number(row.id),
    text: row.post_text,
    status: row.status,
    scheduled_time_utc: row.scheduled_time,
    local_date: getPostLocalDate({ timestamp: row.scheduled_time } as Pick<CachedThreadsPost, "timestamp">, DASHBOARD_TIME_ZONE),
  }));

  const remainingPostsToday = scheduledPosts.filter((post) => post.local_date === todayDate).length;
  const nextScheduledPost = scheduledPosts.find((post) => {
    const timestampMs = Date.parse(post.scheduled_time_utc);
    return Number.isFinite(timestampMs) && timestampMs >= nowMs;
  }) ?? null;

  const dailyPerformance = postsToday.reduce((accumulator, post) => ({
    views: accumulator.views + post.views,
    likes: accumulator.likes + post.likes,
    replies: accumulator.replies + post.replies,
    reposts: accumulator.reposts + post.reposts,
    engagement_total: accumulator.engagement_total + post.engagement_total,
  }), {
    views: 0,
    likes: 0,
    replies: 0,
    reposts: 0,
    engagement_total: 0,
  });

  const followerSnapshots = currentFollowersCount !== null
    ? await listThreadsFollowerSnapshots(env, account.threads_user_id, 30)
    : [];
  const followerTrend = followerSnapshots.map((snapshot, index) => {
    const previous = index > 0 ? followerSnapshots[index - 1] : null;
    const gain = snapshot.baseline_followers_count !== null && snapshot.baseline_followers_count !== undefined
      ? snapshot.followers_count - snapshot.baseline_followers_count
      : (previous ? snapshot.followers_count - previous.followers_count : 0);
    return {
      date: snapshot.snapshot_date,
      followers_count: snapshot.followers_count,
      gain,
    };
  });
  const todayFollowerGain = followerTrend.find((entry) => entry.date === todayDate)?.gain ?? 0;
  const yesterdayFollowerGain = yesterdayDate
    ? (followerTrend.find((entry) => entry.date === yesterdayDate)?.gain ?? 0)
    : 0;
  const recentFollowerGains = followerTrend.slice(-7).map((entry) => entry.gain);
  const followerGainSevenDayAverage = recentFollowerGains.length > 0
    ? recentFollowerGains.reduce((sum, value) => sum + value, 0) / recentFollowerGains.length
    : 0;
  const bestFollowerDay = followerTrend.length > 0
    ? followerTrend.reduce((best, entry) => (entry.gain > best.gain ? entry : best), followerTrend[0])
    : null;

  return {
    generated_at: new Date(nowMs).toISOString(),
    timezone: DASHBOARD_TIME_ZONE,
    profile: {
      threads_user_id: account.threads_user_id,
      username: profile?.username ?? null,
      name: profile?.name ?? null,
      biography: profile?.threads_biography ?? null,
      is_verified: profile?.is_verified ?? false,
      threads_profile_picture_url: profile?.threads_profile_picture_url ?? null,
      follower_count: currentFollowersCount,
    },
    top_post: topPost ? {
      id: topPost.id,
      preview: createPostPreview(topPost.text, 180),
      timestamp: topPost.timestamp,
      permalink: topPost.permalink,
      likes: topPost.likes,
      views: topPost.views,
      replies: topPost.replies,
      reposts: topPost.reposts,
    } : null,
    today: {
      date: todayDate,
      followers_gained: todayFollowerGain,
      posts_published: postsToday.length,
      posts_scheduled: postsToday.length + remainingPostsToday,
      remaining_posts: remainingPostsToday,
      next_scheduled_post_utc: nextScheduledPost?.scheduled_time_utc ?? null,
      total_engagement: dailyPerformance.engagement_total,
      total_views: dailyPerformance.views,
      total_likes: dailyPerformance.likes,
      total_replies: dailyPerformance.replies,
      total_reposts: dailyPerformance.reposts,
      total_follower_gain: todayFollowerGain,
    },
    follower_growth: {
      today_gain: todayFollowerGain,
      yesterday_gain: yesterdayFollowerGain,
      seven_day_average_gain: Number(followerGainSevenDayAverage.toFixed(1)),
      best_day: bestFollowerDay,
      trend: followerTrend,
    },
    winners_yesterday: {
      date: yesterdayDate,
      by_likes: buildMetricRanking(postsYesterday, "likes"),
      by_views: buildMetricRanking(postsYesterday, "views"),
      by_replies: buildMetricRanking(postsYesterday, "replies"),
      by_reposts: buildMetricRanking(postsYesterday, "reposts"),
    },
    winners_7d: {
      by_likes: buildMetricRanking(postsLast7d, "likes"),
      by_views: buildMetricRanking(postsLast7d, "views"),
      by_replies: buildMetricRanking(postsLast7d, "replies"),
      by_reposts: buildMetricRanking(postsLast7d, "reposts"),
    },
  };
}

async function ensureThreadsPostsCacheTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS threads_post_insights_cache (
      threads_user_id TEXT NOT NULL,
      post_id TEXT PRIMARY KEY CHECK (length(trim(post_id)) > 0),
      post_text TEXT,
      post_timestamp TEXT,
      post_permalink TEXT,
      post_username TEXT,
      profile_picture_url TEXT,
      views INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      replies INTEGER NOT NULL DEFAULT 0,
      reposts INTEGER NOT NULL DEFAULT 0,
      quotes INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      last_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_threads_post_insights_cache_user_refresh
     ON threads_post_insights_cache (threads_user_id, last_refreshed_at)`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_threads_post_insights_cache_user_sort_order
     ON threads_post_insights_cache (threads_user_id, sort_order)`,
  ).run();

  const tableInfo = await env.DB.prepare(
    `PRAGMA table_info(threads_post_insights_cache)`,
  ).all<{ name: string }>();

  const columnNames = new Set((tableInfo.results ?? []).map((column) => column.name));
  if (!columnNames.has("engagement_total")) {
    await env.DB.prepare(
      `ALTER TABLE threads_post_insights_cache
       ADD COLUMN engagement_total INTEGER NOT NULL DEFAULT 0`,
    ).run();
  }
}

async function ensureThreadsPostsCacheStateTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS threads_posts_cache_state (
      threads_user_id TEXT PRIMARY KEY CHECK (length(trim(threads_user_id)) > 0),
      next_cursor TEXT,
      has_more INTEGER NOT NULL DEFAULT 0,
      last_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_threads_posts_cache_state_last_refreshed_at
     ON threads_posts_cache_state (last_refreshed_at)`,
  ).run();
}

async function ensureThreadsPostsArchiveTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS threads_posts_archive (
      threads_user_id TEXT NOT NULL,
      post_id TEXT NOT NULL CHECK (length(trim(post_id)) > 0),
      post_text TEXT,
      post_timestamp TEXT,
      post_permalink TEXT,
      post_username TEXT,
      profile_picture_url TEXT,
      views INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      replies INTEGER NOT NULL DEFAULT 0,
      reposts INTEGER NOT NULL DEFAULT 0,
      quotes INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      engagement_total INTEGER NOT NULL DEFAULT 0,
      source_rank INTEGER NOT NULL DEFAULT 0,
      first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (threads_user_id, post_id)
    )`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_threads_posts_archive_user_timestamp
     ON threads_posts_archive (threads_user_id, post_timestamp DESC)`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_threads_posts_archive_user_engagement
     ON threads_posts_archive (threads_user_id, engagement_total DESC, likes DESC, views DESC)`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_threads_posts_archive_user_synced
     ON threads_posts_archive (threads_user_id, last_synced_at DESC)`,
  ).run();
}

async function ensureAutomationDailyRunLocksTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS automation_daily_run_locks (
      automation_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      run_date TEXT NOT NULL,
      first_source TEXT NOT NULL,
      first_claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      manual_claim_count INTEGER NOT NULL DEFAULT 0,
      scheduled_claim_count INTEGER NOT NULL DEFAULT 0,
      last_result TEXT NOT NULL DEFAULT 'started',
      successful_completed_at TEXT,
      last_finished_at TEXT,
      PRIMARY KEY (automation_id, account_id, run_date)
    )`,
  ).run();

  const missingColumns: Array<{ name: string; definition: string }> = [];
  if (!(await doesColumnExist(env, "automation_daily_run_locks", "last_result"))) {
    missingColumns.push({ name: "last_result", definition: "TEXT NOT NULL DEFAULT 'started'" });
  }
  if (!(await doesColumnExist(env, "automation_daily_run_locks", "successful_completed_at"))) {
    missingColumns.push({ name: "successful_completed_at", definition: "TEXT" });
  }
  if (!(await doesColumnExist(env, "automation_daily_run_locks", "last_finished_at"))) {
    missingColumns.push({ name: "last_finished_at", definition: "TEXT" });
  }

  for (const column of missingColumns) {
    await env.DB.prepare(
      `ALTER TABLE automation_daily_run_locks ADD COLUMN ${column.name} ${column.definition}`,
    ).run();
  }

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_automation_daily_run_locks_run_date
     ON automation_daily_run_locks (run_date, automation_id, account_id)`,
  ).run();
}

async function getAutomationDailyRunLock(
  env: Env,
  automationId: string,
  accountId: string,
  runDate: string,
): Promise<AutomationDailyRunLockRow | null> {
  await ensureAutomationDailyRunLocksTable(env);

  return env.DB.prepare(
    `SELECT
       automation_id,
       account_id,
       run_date,
       first_source,
       first_claimed_at,
       last_claimed_at,
       manual_claim_count,
       scheduled_claim_count,
       last_result,
       successful_completed_at,
       last_finished_at
     FROM automation_daily_run_locks
     WHERE automation_id = ?
       AND account_id = ?
       AND run_date = ?
     LIMIT 1`,
  )
    .bind(automationId, accountId, runDate)
    .first<AutomationDailyRunLockRow>();
}

async function claimAutomationDailyRun(
  env: Env,
  automationId: string,
  accountId: string,
  runDate: string,
  source: "manual" | "scheduled",
): Promise<{
  acquired: boolean;
  lock: AutomationDailyRunLockRow | null;
  reason: "already_ran_today" | "claimed";
}> {
  await ensureAutomationDailyRunLocksTable(env);

  const existing = await getAutomationDailyRunLock(env, automationId, accountId, runDate);
  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO automation_daily_run_locks (
        automation_id,
        account_id,
        run_date,
        first_source,
        manual_claim_count,
        scheduled_claim_count,
        last_result
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        automationId,
        accountId,
        runDate,
        source,
        source === "manual" ? 1 : 0,
        source === "scheduled" ? 1 : 0,
        "started",
      )
      .run();

    const lock = await getAutomationDailyRunLock(env, automationId, accountId, runDate);
    return { acquired: true, lock, reason: "claimed" };
  }

  if (source === "scheduled" && Boolean(existing.successful_completed_at)) {
    return { acquired: false, lock: existing, reason: "already_ran_today" };
  }

  await env.DB.prepare(
    `UPDATE automation_daily_run_locks
     SET manual_claim_count = manual_claim_count + ?,
         scheduled_claim_count = scheduled_claim_count + ?,
         last_claimed_at = CURRENT_TIMESTAMP,
         last_result = 'started'
     WHERE automation_id = ?
       AND account_id = ?
       AND run_date = ?`,
  )
    .bind(
      source === "manual" ? 1 : 0,
      source === "scheduled" ? 1 : 0,
      automationId,
      accountId,
      runDate,
    )
    .run();

  const updated = await getAutomationDailyRunLock(env, automationId, accountId, runDate);
  return { acquired: true, lock: updated, reason: "claimed" };
}

async function completeAutomationDailyRun(
  env: Env,
  automationId: string,
  accountId: string,
  runDate: string,
  success: boolean,
  result: string,
): Promise<AutomationDailyRunLockRow | null> {
  await ensureAutomationDailyRunLocksTable(env);

  await env.DB.prepare(
    `UPDATE automation_daily_run_locks
     SET last_result = ?,
         last_finished_at = CURRENT_TIMESTAMP,
         successful_completed_at = CASE
           WHEN ? = 1 THEN CURRENT_TIMESTAMP
           ELSE successful_completed_at
         END
     WHERE automation_id = ?
       AND account_id = ?
       AND run_date = ?`,
  )
    .bind(
      result,
      success ? 1 : 0,
      automationId,
      accountId,
      runDate,
    )
    .run();

  return getAutomationDailyRunLock(env, automationId, accountId, runDate);
}

async function upsertThreadsPostsArchive(
  env: Env,
  threadsUserId: string,
  posts: CachedThreadsPost[],
): Promise<void> {
  await ensureThreadsPostsArchiveTable(env);

  for (const [index, post] of posts.entries()) {
    if (!post.id) {
      continue;
    }

    await env.DB.prepare(
      `INSERT INTO threads_posts_archive (
        threads_user_id,
        post_id,
        post_text,
        post_timestamp,
        post_permalink,
        post_username,
        profile_picture_url,
        views,
        likes,
        replies,
        reposts,
        quotes,
        shares,
        engagement_total,
        source_rank,
        first_seen_at,
        last_seen_at,
        last_synced_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(threads_user_id, post_id) DO UPDATE SET
        post_text = excluded.post_text,
        post_timestamp = excluded.post_timestamp,
        post_permalink = excluded.post_permalink,
        post_username = excluded.post_username,
        profile_picture_url = excluded.profile_picture_url,
        views = excluded.views,
        likes = excluded.likes,
        replies = excluded.replies,
        reposts = excluded.reposts,
        quotes = excluded.quotes,
        shares = excluded.shares,
        engagement_total = excluded.engagement_total,
        source_rank = excluded.source_rank,
        last_seen_at = CURRENT_TIMESTAMP,
        last_synced_at = CURRENT_TIMESTAMP`,
    )
      .bind(
        threadsUserId,
        post.id,
        post.text,
        post.timestamp,
        post.permalink,
        post.username,
        post.profile_picture_url,
        post.views,
        post.likes,
        post.replies,
        post.reposts,
        post.quotes,
        post.shares,
        post.engagement_total,
        index,
      )
      .run();
  }
}

async function replaceThreadsPostsCache(
  env: Env,
  threadsUserId: string,
  posts: CachedThreadsPost[],
  state: ThreadsPostsCacheStatePayload,
): Promise<void> {
  await ensureThreadsPostsCacheTable(env);
  await ensureThreadsPostsCacheStateTable(env);

  await env.DB.prepare(
    `DELETE FROM threads_post_insights_cache
     WHERE threads_user_id = ?`,
  )
    .bind(threadsUserId)
    .run();

  for (const [index, post] of posts.entries()) {
    await env.DB.prepare(
      `INSERT INTO threads_post_insights_cache (
        threads_user_id,
        post_id,
        post_text,
        post_timestamp,
        post_permalink,
        post_username,
        profile_picture_url,
        views,
        likes,
        replies,
        reposts,
        quotes,
        shares,
        sort_order,
        last_refreshed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
      .bind(
        threadsUserId,
        post.id,
        post.text,
        post.timestamp,
        post.permalink,
        post.username,
        post.profile_picture_url,
        post.views,
        post.likes,
        post.replies,
        post.reposts,
        post.quotes,
        post.shares,
        index,
      )
      .run();
  }

  await env.DB.prepare(
    `INSERT INTO threads_posts_cache_state (
      threads_user_id,
      next_cursor,
      has_more,
      last_refreshed_at
    )
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(threads_user_id) DO UPDATE SET
      next_cursor = excluded.next_cursor,
      has_more = excluded.has_more,
      last_refreshed_at = CURRENT_TIMESTAMP`,
  )
    .bind(threadsUserId, state.next_cursor, state.has_more ? 1 : 0)
    .run();
}

async function getFreshThreadsPostsCache(
  env: Env,
  threadsUserId: string,
): Promise<{ posts: CachedThreadsPost[]; nextCursor: string | null; hasMore: boolean } | null> {
  await ensureThreadsPostsCacheTable(env);
  await ensureThreadsPostsCacheStateTable(env);

  const state = await env.DB.prepare(
    `SELECT threads_user_id, next_cursor, has_more, last_refreshed_at
     FROM threads_posts_cache_state
     WHERE threads_user_id = ?
       AND datetime(last_refreshed_at) >= datetime('now', '-${THREADS_INSIGHTS_CACHE_MAX_AGE_HOURS} hours')
     LIMIT 1`,
  )
    .bind(threadsUserId)
    .first<ThreadsPostsCacheStateRow>();

  if (!state) {
    return null;
  }

  const postsResult = await env.DB.prepare(
    `SELECT
       post_id,
       post_text,
       post_timestamp,
       post_permalink,
       post_username,
      profile_picture_url,
      views,
      likes,
      replies,
      reposts,
      quotes,
      shares,
      engagement_total
     FROM threads_post_insights_cache
     WHERE threads_user_id = ?
       AND datetime(last_refreshed_at) >= datetime('now', '-${THREADS_INSIGHTS_CACHE_MAX_AGE_HOURS} hours')
     ORDER BY sort_order ASC`,
  )
    .bind(threadsUserId)
    .all<{
      post_id: string;
      post_text: string | null;
      post_timestamp: string | null;
      post_permalink: string | null;
      post_username: string | null;
      profile_picture_url: string | null;
      views: number | string | null;
      likes: number | string | null;
      replies: number | string | null;
      reposts: number | string | null;
      quotes: number | string | null;
      shares: number | string | null;
      engagement_total: number | string | null;
    }>();

  const posts = (postsResult.results ?? []).map((row) => ({
    id: row.post_id,
    text: row.post_text,
    timestamp: row.post_timestamp,
    permalink: row.post_permalink,
    username: row.post_username,
    profile_picture_url: row.profile_picture_url,
    views: Number(row.views ?? 0),
    likes: Number(row.likes ?? 0),
    replies: Number(row.replies ?? 0),
    reposts: Number(row.reposts ?? 0),
    quotes: Number(row.quotes ?? 0),
    shares: Number(row.shares ?? 0),
    engagement_total: Number(row.engagement_total ?? 0),
  }));

  return {
    posts,
    nextCursor: state.next_cursor ?? null,
    hasMore: state.has_more === 1,
  };
}

async function getThreadsPostsCache(
  env: Env,
  threadsUserId: string,
  options: { allowStale?: boolean } = {},
): Promise<{ posts: CachedThreadsPost[]; nextCursor: string | null; hasMore: boolean } | null> {
  await ensureThreadsPostsCacheTable(env);
  await ensureThreadsPostsCacheStateTable(env);

  const freshnessClause = options.allowStale
    ? ""
    : `AND datetime(last_refreshed_at) >= datetime('now', '-${THREADS_INSIGHTS_CACHE_MAX_AGE_HOURS} hours')`;

  const state = await env.DB.prepare(
    `SELECT threads_user_id, next_cursor, has_more, last_refreshed_at
     FROM threads_posts_cache_state
     WHERE threads_user_id = ?
       ${freshnessClause}
     ORDER BY datetime(last_refreshed_at) DESC
     LIMIT 1`,
  )
    .bind(threadsUserId)
    .first<ThreadsPostsCacheStateRow>();

  if (!state) {
    return null;
  }

  const postsResult = await env.DB.prepare(
    `SELECT
       post_id,
       post_text,
       post_timestamp,
       post_permalink,
       post_username,
       profile_picture_url,
       views,
       likes,
       replies,
       reposts,
       quotes,
       shares,
       engagement_total
     FROM threads_post_insights_cache
     WHERE threads_user_id = ?
       ${freshnessClause}
     ORDER BY sort_order ASC`,
  )
    .bind(threadsUserId)
    .all<{
      post_id: string;
      post_text: string | null;
      post_timestamp: string | null;
      post_permalink: string | null;
      post_username: string | null;
      profile_picture_url: string | null;
      views: number | string | null;
      likes: number | string | null;
      replies: number | string | null;
      reposts: number | string | null;
      quotes: number | string | null;
      shares: number | string | null;
      engagement_total: number | string | null;
    }>();

  const posts = (postsResult.results ?? []).map((row) => ({
    id: row.post_id,
    text: row.post_text,
    timestamp: row.post_timestamp,
    permalink: row.post_permalink,
    username: row.post_username,
    profile_picture_url: row.profile_picture_url,
    views: Number(row.views ?? 0),
    likes: Number(row.likes ?? 0),
    replies: Number(row.replies ?? 0),
    reposts: Number(row.reposts ?? 0),
    quotes: Number(row.quotes ?? 0),
    shares: Number(row.shares ?? 0),
    engagement_total: Number(row.engagement_total ?? 0),
  }));

  return {
    posts,
    nextCursor: state.next_cursor ?? null,
    hasMore: state.has_more === 1,
  };
}

async function listArchivedThreadsPosts(
  env: Env,
  threadsUserId: string,
  order: "recent" | "top",
  limit: number,
  offset: number,
): Promise<{ posts: CachedThreadsPost[]; totalCount: number }> {
  await ensureThreadsPostsArchiveTable(env);

  const orderClause = order === "top"
    ? "engagement_total DESC, likes DESC, views DESC, post_timestamp DESC"
    : "post_timestamp DESC, engagement_total DESC, last_synced_at DESC";

  const postsResult = await env.DB.prepare(
    `SELECT
       threads_user_id,
       post_id,
       post_text,
       post_timestamp,
       post_permalink,
       post_username,
       profile_picture_url,
       views,
       likes,
       replies,
       reposts,
       quotes,
       shares,
       engagement_total,
       source_rank,
       first_seen_at,
       last_seen_at,
       last_synced_at
     FROM threads_posts_archive
     WHERE threads_user_id = ?
     ORDER BY ${orderClause}
     LIMIT ?
     OFFSET ?`,
  )
    .bind(threadsUserId, limit, offset)
    .all<ThreadsPostsArchiveRow>();

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total_count
     FROM threads_posts_archive
     WHERE threads_user_id = ?`,
  )
    .bind(threadsUserId)
    .first<{ total_count: number | string }>();

  return {
    posts: (postsResult.results ?? []).map((row) => ({
      id: row.post_id,
      text: row.post_text,
      timestamp: row.post_timestamp,
      permalink: row.post_permalink,
      username: row.post_username,
      profile_picture_url: row.profile_picture_url,
      views: Number(row.views ?? 0),
      likes: Number(row.likes ?? 0),
      replies: Number(row.replies ?? 0),
      reposts: Number(row.reposts ?? 0),
      quotes: Number(row.quotes ?? 0),
      shares: Number(row.shares ?? 0),
      engagement_total: Number(row.engagement_total ?? 0),
    })),
    totalCount: Number(countRow?.total_count ?? 0),
  };
}

async function getTopArchivedPostByLikes(
  env: Env,
  threadsUserId: string,
): Promise<CachedThreadsPost | null> {
  await ensureThreadsPostsArchiveTable(env);

  const row = await env.DB.prepare(
    `SELECT
       post_id,
       post_text,
       post_timestamp,
       post_permalink,
       post_username,
       profile_picture_url,
       views,
       likes,
       replies,
       reposts,
       quotes,
       shares,
       engagement_total
     FROM threads_posts_archive
     WHERE threads_user_id = ?
     ORDER BY likes DESC, views DESC, engagement_total DESC, post_timestamp DESC
     LIMIT 1`,
  )
    .bind(threadsUserId)
    .first<{
      post_id: string;
      post_text: string | null;
      post_timestamp: string | null;
      post_permalink: string | null;
      post_username: string | null;
      profile_picture_url: string | null;
      views: number | string | null;
      likes: number | string | null;
      replies: number | string | null;
      reposts: number | string | null;
      quotes: number | string | null;
      shares: number | string | null;
      engagement_total: number | string | null;
    }>();

  if (!row) {
    return null;
  }

  return {
    id: row.post_id,
    text: row.post_text,
    timestamp: row.post_timestamp,
    permalink: row.post_permalink,
    username: row.post_username,
    profile_picture_url: row.profile_picture_url,
    views: Number(row.views ?? 0),
    likes: Number(row.likes ?? 0),
    replies: Number(row.replies ?? 0),
    reposts: Number(row.reposts ?? 0),
    quotes: Number(row.quotes ?? 0),
    shares: Number(row.shares ?? 0),
    engagement_total: Number(row.engagement_total ?? 0),
  };
}

async function deleteScheduledPostForAppUser(
  env: Env,
  appUserId: string,
  scheduledPostId: number,
): Promise<"deleted" | "not_found" | "not_deletable"> {
  await ensureScheduledPostsTable(env);

  const existing = await env.DB.prepare(
    `SELECT id, status
     FROM scheduled_posts
     WHERE id = ?
       AND user_id = ?
     LIMIT 1`,
  )
    .bind(scheduledPostId, appUserId)
    .first<{ id: number | string; status: string }>();

  if (!existing) {
    return "not_found";
  }

  if (existing.status !== SCHEDULED_POST_STATUS_APPROVED) {
    return "not_deletable";
  }

  await env.DB.prepare(
    `DELETE FROM scheduled_posts
     WHERE id = ?
       AND user_id = ?
       AND status = ?`,
  )
    .bind(scheduledPostId, appUserId, SCHEDULED_POST_STATUS_APPROVED)
    .run();

  return "deleted";
}

async function listScheduledPostsForThreadsAccountOnLocalDate(
  env: Env,
  threadsUserId: string,
  date: string,
  timeZone: string,
): Promise<Array<{
  id: number;
  post_text: string;
  status: string;
  scheduled_time_utc: string;
  scheduled_time_local: string;
  local_time: string;
}>> {
  const startUtc = convertLocalDateTimeToUtcIso(date, "00:00", timeZone);
  const nextDate = addDaysToIsoDate(date, 1);
  const endUtcExclusive = nextDate ? convertLocalDateTimeToUtcIso(nextDate, "00:00", timeZone) : null;
  if (!startUtc || !endUtcExclusive) {
    return [];
  }

  await ensureScheduledPostsTable(env);
  const rows = await env.DB.prepare(
    `SELECT id, post_text, status, scheduled_time
     FROM scheduled_posts
     WHERE threads_user_id = ?
       AND scheduled_time >= ?
       AND scheduled_time < ?
       AND status IN (?, ?)
     ORDER BY scheduled_time ASC, id ASC`,
  )
    .bind(
      threadsUserId,
      startUtc,
      endUtcExclusive,
      SCHEDULED_POST_STATUS_APPROVED,
      SCHEDULED_POST_STATUS_POSTING,
    )
    .all<{
      id: number | string;
      post_text: string;
      status: string;
      scheduled_time: string;
    }>();

  return (rows.results ?? []).map((row) => {
    const utcMs = Date.parse(row.scheduled_time);
    const parts = Number.isFinite(utcMs) ? getPartsInTimeZone(utcMs, timeZone) : null;
    const localTime = parts
      ? `${parts.hour.toString().padStart(2, "0")}:${parts.minute.toString().padStart(2, "0")}`
      : "";

    return {
      id: Number(row.id),
      post_text: row.post_text,
      status: row.status,
      scheduled_time_utc: row.scheduled_time,
      scheduled_time_local: parts
        ? `${formatIsoDateParts(parts.year, parts.month, parts.day)} ${localTime}`
        : row.scheduled_time,
      local_time: localTime,
    };
  });
}

async function createScheduledPostForAppUser(
  env: Env,
  appUserId: string,
  threadsUserId: string,
  text: string,
  date: string,
  time: string,
  timeZone: string,
): Promise<{
  success: boolean;
  scheduledPostId?: number;
  scheduledTimeUtc?: string;
  reused?: boolean;
  error?: string;
}> {
  const trimmedText = text.trim();
  if (!trimmedText || !threadsUserId || !date || !time) {
    return { success: false, error: "missing_required_fields" };
  }

  const scheduledUtc = convertLocalDateTimeToUtcIso(date, time, timeZone);
  if (!scheduledUtc) {
    return { success: false, error: "invalid_date_time" };
  }
  if (isPastUtcTimestamp(scheduledUtc)) {
    return { success: false, error: "scheduled_time_in_past" };
  }

  await ensureWorkspaceUserRecord(env, {
    id: appUserId,
    email: "workspace@lensically.local",
    timezone: timeZone,
    clock_format: "12h",
  });

  await ensureScheduledPostsTable(env);
  const scheduleIdempotencyKey = await buildScheduledPostIdempotencyKey(
    appUserId,
    threadsUserId,
    scheduledUtc,
    trimmedText,
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
    return {
      success: true,
      scheduledPostId: Number(existingScheduledPost.id),
      scheduledTimeUtc: existingScheduledPost.scheduled_time,
      reused: true,
    };
  }

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
        appUserId,
        threadsUserId,
        trimmedText,
        SCHEDULED_POST_STATUS_APPROVED,
        scheduledUtc,
        scheduleIdempotencyKey,
      )
      .run();

    return {
      success: true,
      scheduledPostId: Number(insert.meta?.last_row_id ?? 0),
      scheduledTimeUtc: scheduledUtc,
      reused: false,
    };
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

    return {
      success: true,
      scheduledPostId: Number(racedScheduledPost.id),
      scheduledTimeUtc: racedScheduledPost.scheduled_time,
      reused: true,
    };
  }
}

function getThreadsMetricValue(
  metric: {
    values?: Array<{ value?: number }>;
    total_value?: { value?: number };
    link_total_values?: Array<{ value?: number }>;
  },
): number {
  const value =
    metric.values?.[0]?.value ??
    metric.total_value?.value ??
    metric.link_total_values?.[0]?.value ??
    0;
  return Number(value ?? 0);
}

function buildThreadsMetricMap(
  metrics: Array<{
    name?: string;
    values?: Array<{ value?: number }>;
    total_value?: { value?: number };
    link_total_values?: Array<{ value?: number }>;
  }> | undefined,
): ThreadsMetricMap {
  const defaults: ThreadsMetricMap = {
    views: 0,
    likes: 0,
    replies: 0,
    reposts: 0,
    quotes: 0,
    shares: 0,
    clicks: 0,
    followers_count: 0,
  };

  for (const metric of metrics ?? []) {
    const name = metric?.name;
    if (!name || !(name in defaults)) {
      continue;
    }
    defaults[name as ThreadsInsightsMetricName] = getThreadsMetricValue(metric);
  }

  return defaults;
}

function formatIsoDateParts(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function getLocalDateInTimeZone(timeZone: string, timestampMs = Date.now()): string | null {
  const parts = getPartsInTimeZone(timestampMs, timeZone);
  if (!parts) {
    return null;
  }

  return formatIsoDateParts(parts.year, parts.month, parts.day);
}

function addDaysToIsoDate(date: string, days: number): string | null {
  if (!isValidIsoDate(date) || !Number.isInteger(days)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = date.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return formatIsoDateParts(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

function buildHourlySlotTimes(startHour: number, endHour: number): string[] {
  const slots: string[] = [];
  for (let hour = startHour; hour <= endHour; hour += 1) {
    slots.push(`${hour.toString().padStart(2, "0")}:00`);
  }
  return slots;
}

function buildDefaultTomorrowSlotPlan(
  timeZone: string,
  timestampMs = Date.now(),
): { date: string; slots: string[] } | null {
  const today = getLocalDateInTimeZone(timeZone, timestampMs);
  if (!today) {
    return null;
  }

  const tomorrow = addDaysToIsoDate(today, 1);
  if (!tomorrow) {
    return null;
  }

  return {
    date: tomorrow,
    slots: buildHourlySlotTimes(7, 23),
  };
}

async function fetchThreadsProfileByAccessToken(
  accessToken: string,
): Promise<{
  threads_user_id: string | null;
  username: string | null;
  name: string | null;
  threads_biography: string | null;
  is_verified: boolean;
  threads_profile_picture_url: string | null;
} | null> {
  try {
    const response = await fetch(
      "https://graph.threads.net/v1.0/me?fields=id,username,name,threads_biography,is_verified,threads_profile_picture_url",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = await readJsonSafe(response);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }

    const data = payload as {
      id?: unknown;
      username?: unknown;
      name?: unknown;
      threads_biography?: unknown;
      is_verified?: unknown;
      threads_profile_picture_url?: unknown;
    };

    return {
      threads_user_id: typeof data.id === "string" && data.id.trim() ? data.id.trim() : null,
      username: typeof data.username === "string" && data.username.trim() ? data.username.trim() : null,
      name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : null,
      threads_biography: typeof data.threads_biography === "string" ? data.threads_biography : null,
      is_verified: data.is_verified === true,
      threads_profile_picture_url: typeof data.threads_profile_picture_url === "string"
        ? data.threads_profile_picture_url
        : null,
    };
  } catch {
    return null;
  }
}

async function fetchThreadsUserInsightsByAccount(
  accessToken: string,
  threadsUserId: string,
): Promise<unknown | null> {
  const params = new URLSearchParams({
    metric: "views,likes,replies,reposts,quotes,clicks,followers_count",
  });

  const response = await fetch(
    `https://graph.threads.net/v1.0/${threadsUserId}/threads_insights?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    return null;
  }

  return readJsonSafe(response);
}

async function fetchThreadsPostsPageWithInsights(
  accessToken: string,
  threadsUserId: string,
  cursor: string | null,
): Promise<{
  posts: CachedThreadsPost[];
  nextCursor: string | null;
  hasMore: boolean;
} | null> {
  try {
    const params = new URLSearchParams({
      fields: "id,text,media_type,permalink,timestamp,username,has_replies,is_quote_post,is_reply",
      limit: "40",
    });

    if (cursor) {
      params.set("after", cursor);
    }

    const response = await fetch(
      `https://graph.threads.net/v1.0/${threadsUserId}/threads?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = await readJsonSafe(response);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }

    const data = payload as {
      data?: Array<{
        id?: string;
        text?: string;
        timestamp?: string;
        permalink?: string;
        username?: string;
      }>;
      paging?: {
        next?: string;
        cursors?: {
          after?: string;
        };
      };
    };

    const profile = await fetchThreadsProfileByAccessToken(accessToken);
    const profilePicture = profile?.threads_profile_picture_url ?? null;
    const posts = Array.isArray(data.data) ? data.data : [];
    const enrichedPosts: CachedThreadsPost[] = [];
    const batchSize = 10;

    for (let index = 0; index < posts.length; index += batchSize) {
      const batch = posts.slice(index, index + batchSize);
      const results = await Promise.all(
        batch.map(async (post) => {
          const postId = typeof post.id === "string" ? post.id.trim() : "";
          const basePost: CachedThreadsPost = {
            id: postId,
            text: typeof post.text === "string" ? post.text : null,
            timestamp: typeof post.timestamp === "string" ? post.timestamp : null,
            permalink: typeof post.permalink === "string" ? post.permalink : null,
            username: typeof post.username === "string" ? post.username : null,
            profile_picture_url: profilePicture,
            views: 0,
            likes: 0,
            replies: 0,
            reposts: 0,
            quotes: 0,
            shares: 0,
            engagement_total: 0,
          };

          if (!postId) {
            return basePost;
          }

          try {
            const metricsResponse = await fetch(
              `https://graph.threads.net/v1.0/${postId}/insights?metric=views,likes,replies,reposts,quotes,shares&access_token=${encodeURIComponent(accessToken)}`,
            );

            if (!metricsResponse.ok) {
              return basePost;
            }

            const metricsPayload = await readJsonSafe(metricsResponse);
            if (!metricsPayload || typeof metricsPayload !== "object" || Array.isArray(metricsPayload)) {
              return basePost;
            }

            const metricsJson = metricsPayload as {
              data?: Array<{
                name?: string;
                values?: Array<{ value?: number }>;
                total_value?: { value?: number };
                link_total_values?: Array<{ value?: number }>;
              }>;
            };
            const metricMap = buildThreadsMetricMap(metricsJson.data);

            return {
              ...basePost,
              views: metricMap.views,
              likes: metricMap.likes,
              replies: metricMap.replies,
              reposts: metricMap.reposts,
              quotes: metricMap.quotes,
              shares: metricMap.shares,
              engagement_total:
                metricMap.likes +
                metricMap.replies +
                metricMap.reposts +
                metricMap.quotes +
                metricMap.shares,
            };
          } catch {
            return basePost;
          }
        }),
      );

      enrichedPosts.push(...results);
    }

    return {
      posts: enrichedPosts,
      nextCursor: data.paging?.cursors?.after ?? null,
      hasMore: Boolean(data.paging?.next),
    };
  } catch {
    return null;
  }
}

function isThreadsRefreshWindow(
  timestampMs: number,
  targetHour: number,
  targetMinute: number,
): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: THREADS_INSIGHTS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestampMs));

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "-1");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "-1");

  return hour === targetHour && minute === targetMinute;
}

function isFollowerStartOfDayRefreshWindow(timestampMs: number): boolean {
  return isThreadsRefreshWindow(
    timestampMs,
    THREADS_FOLLOWER_START_OF_DAY_HOUR,
    THREADS_FOLLOWER_START_OF_DAY_MINUTE,
  );
}

function isDailyInsightsRefreshWindow(timestampMs: number): boolean {
  return isThreadsRefreshWindow(
    timestampMs,
    THREADS_INSIGHTS_TARGET_HOUR,
    THREADS_INSIGHTS_TARGET_MINUTE,
  );
}

async function refreshFollowerBaselinesForConfiguredAccounts(env: Env): Promise<void> {
  const snapshotDate = getLocalDateInTimeZone(THREADS_INSIGHTS_TIME_ZONE, Date.now());
  if (!snapshotDate) {
    return;
  }

  const accounts = await Promise.all(
    getConfiguredThreadsAccountDefinitions(env).map((account) => resolveConfiguredThreadsAccount(env, account)),
  );

  for (const configuredAccount of accounts) {
    if (!configuredAccount) {
      continue;
    }

    try {
      const profile = await fetchThreadsProfileByAccessToken(configuredAccount.accessToken);
      const threadsUserId = profile?.threads_user_id;

      if (!threadsUserId) {
        logWorkerEvent("THREADS_FOLLOWER_BASELINE_PROFILE_SKIPPED", {
          configured_account_id: configuredAccount.id,
          configured_username: configuredAccount.username,
        }, "error");
        continue;
      }

      await upsertConfiguredThreadsAccountToken(env, configuredAccount, threadsUserId);

      const currentFollowersCount = await resolveCurrentThreadsFollowerCount(
        configuredAccount.accessToken,
        profile?.username ?? configuredAccount.username,
        null,
      );

      if (currentFollowersCount !== null) {
        await upsertThreadsFollowerSnapshot(env, threadsUserId, snapshotDate, currentFollowersCount);
      }

      logWorkerEvent("THREADS_FOLLOWER_BASELINE_REFRESH_SUCCEEDED", {
        configured_account_id: configuredAccount.id,
        configured_username: configuredAccount.username,
        threads_user_id: threadsUserId,
        baseline_saved: currentFollowersCount !== null,
      });
    } catch (error) {
      logWorkerEvent("THREADS_FOLLOWER_BASELINE_REFRESH_FAILED", {
        configured_account_id: configuredAccount.id,
        configured_username: configuredAccount.username,
        error: getErrorMessage(error),
      }, "error");
    }
  }
}

async function refreshInsightsForConfiguredAccounts(env: Env): Promise<void> {
  const snapshotDate = getLocalDateInTimeZone(THREADS_INSIGHTS_TIME_ZONE, Date.now());

  const accounts = await Promise.all(
    getConfiguredThreadsAccountDefinitions(env).map((account) => resolveConfiguredThreadsAccount(env, account)),
  );

  for (const configuredAccount of accounts) {
    if (!configuredAccount) {
      continue;
    }
    try {
      const profile = await fetchThreadsProfileByAccessToken(configuredAccount.accessToken);
      const threadsUserId = profile?.threads_user_id;

      if (!threadsUserId) {
        logWorkerEvent("THREADS_DAILY_INSIGHTS_PROFILE_SKIPPED", {
          configured_account_id: configuredAccount.id,
          configured_username: configuredAccount.username,
        }, "error");
        continue;
      }

      await upsertConfiguredThreadsAccountToken(env, configuredAccount, threadsUserId);

      await upsertThreadsProfileCache(env, {
        threads_user_id: threadsUserId,
        username: profile?.username ?? configuredAccount.username,
        name: profile?.name ?? configuredAccount.label,
        threads_biography: profile?.threads_biography ?? null,
        is_verified: profile?.is_verified ?? false,
        threads_profile_picture_url: profile?.threads_profile_picture_url ?? null,
      });

      const userInsights = await fetchThreadsUserInsightsByAccount(configuredAccount.accessToken, threadsUserId);
      if (userInsights !== null) {
        await upsertThreadsUserInsightsCache(env, {
          threads_user_id: threadsUserId,
          insights_json: JSON.stringify(userInsights),
        });
      }

      const currentFollowersCount = await resolveCurrentThreadsFollowerCount(
        configuredAccount.accessToken,
        profile?.username ?? configuredAccount.username,
        userInsights,
      );
      if (snapshotDate && currentFollowersCount !== null) {
        await upsertThreadsFollowerSnapshot(env, threadsUserId, snapshotDate, currentFollowersCount);
      }

      const postsPage = await fetchThreadsPostsPageWithInsights(
        configuredAccount.accessToken,
        threadsUserId,
        null,
      );

      if (postsPage) {
        await upsertThreadsPostsArchive(env, threadsUserId, postsPage.posts);
        await replaceThreadsPostsCache(env, threadsUserId, postsPage.posts, {
          threads_user_id: threadsUserId,
          next_cursor: postsPage.nextCursor,
          has_more: postsPage.hasMore,
        });
      }

      logWorkerEvent("THREADS_DAILY_INSIGHTS_REFRESH_SUCCEEDED", {
        configured_account_id: configuredAccount.id,
        configured_username: configuredAccount.username,
        threads_user_id: threadsUserId,
        posts_count: postsPage?.posts.length ?? 0,
        user_insights_cached: userInsights !== null,
        follower_snapshot_saved: snapshotDate !== null && currentFollowersCount !== null,
      });
    } catch (error) {
      logWorkerEvent("THREADS_DAILY_INSIGHTS_REFRESH_FAILED", {
        configured_account_id: configuredAccount.id,
        configured_username: configuredAccount.username,
        error: getErrorMessage(error),
      }, "error");
    }
  }
}

async function restoreTombstonedThreadsConnectionForAppUser(
  env: Env,
  appUserId: string,
  threadsUserId: string,
): Promise<boolean> {
  await ensureAppThreadsTable(env);

  const restored = await env.DB.prepare(
    `UPDATE app_threads_accounts
     SET connection_active = 1,
         is_active = 0,
         tombstone_expires_at = NULL
     WHERE app_user_id = ?
       AND threads_user_id = ?
       AND COALESCE(connection_active, is_active, 1) = 0
       AND tombstone_expires_at IS NOT NULL
       AND datetime(tombstone_expires_at) >= datetime('now')
     RETURNING app_user_id`,
  )
    .bind(appUserId, threadsUserId)
    .first<{ app_user_id: string }>();

  if (restored?.app_user_id) {
    await env.DB.prepare(
      `UPDATE app_threads_accounts
       SET is_active = CASE
         WHEN threads_user_id = ? AND COALESCE(connection_active, is_active, 1) = 1 THEN 1
         ELSE 0
       END
       WHERE app_user_id = ?`,
    )
      .bind(threadsUserId, appUserId)
      .run();
  }

  return Boolean(restored?.app_user_id);
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
): Promise<string | null> {
  const tombstoneExpiresAt = getThreadsConnectionTombstoneExpiresAt();

  const affectedRows = await db.prepare(
    `SELECT a.app_user_id, COALESCE(u.is_admin, 0) AS is_admin
     FROM app_threads_accounts a
     LEFT JOIN users u
       ON u.id = a.app_user_id
     WHERE threads_user_id = ?
       AND COALESCE(a.connection_active, a.is_active, 1) = 1`,
  )
    .bind(platformUserId)
    .all<{ app_user_id: string; is_admin: number }>();

  await db.prepare(
    `UPDATE app_threads_accounts
     SET connection_active = 0,
         is_active = 0,
         tombstone_expires_at = CASE
           WHEN EXISTS (
             SELECT 1
             FROM users
             WHERE users.id = app_threads_accounts.app_user_id
               AND users.is_admin = 1
           ) THEN NULL
           ELSE ?
         END
     WHERE threads_user_id = ?`,
  )
    .bind(tombstoneExpiresAt, platformUserId)
    .run();

  const affectedAppUserIds = [...new Set((affectedRows.results ?? [])
    .map((row) => row.app_user_id?.trim())
    .filter((value): value is string => Boolean(value)))];

  const hasNonAdminAffectedRows = (affectedRows.results ?? []).some((row) => Number(row.is_admin ?? 0) !== 1);

  for (const appUserId of affectedAppUserIds) {
    const fallbackRow = await db.prepare(
      `SELECT threads_user_id
       FROM app_threads_accounts
       WHERE app_user_id = ?
         AND COALESCE(connection_active, is_active, 1) = 1
       ORDER BY created_at DESC, threads_user_id ASC
       LIMIT 1`,
    )
      .bind(appUserId)
      .first<{ threads_user_id: string }>();

    if (!fallbackRow?.threads_user_id) {
      continue;
    }

    await db.prepare(
      `UPDATE app_threads_accounts
       SET is_active = CASE
         WHEN threads_user_id = ? AND COALESCE(connection_active, is_active, 1) = 1 THEN 1
         ELSE 0
       END
       WHERE app_user_id = ?`,
    )
      .bind(fallbackRow.threads_user_id, appUserId)
      .run();
  }

  return hasNonAdminAffectedRows ? tombstoneExpiresAt : null;
}

async function processThreadsUninstallRequest(env: Env, platformUserId: string): Promise<void> {
  await ensureAppThreadsTable(env);
  await ensureThreadsProfileCacheTable(env);

  const dbSession = env.DB.withSession("first-primary");
  let transactionStarted = false;

  try {
    await dbSession.prepare("BEGIN TRANSACTION").run();
    transactionStarted = true;

    const tombstoneExpiresAt = await removeThreadsLinkageForPlatformUser(dbSession, platformUserId);
    logWorkerEvent(tombstoneExpiresAt ? "THREADS_CONNECTION_TOMBSTONE_CREATED" : "THREADS_CONNECTION_TOMBSTONE_SKIPPED", {
      source: "threads_uninstall_callback",
      platform_user_id: platformUserId,
      tombstone_expires_at: tombstoneExpiresAt,
    });

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
  targetThreadsUserId: string | null = null,
  options: { disableTombstone?: boolean } = {},
): Promise<{ disconnected: boolean; threadsUserId: string | null; tombstoneExpiresAt: string | null }> {
  await ensureAppThreadsTable(env);
  await ensureThreadsProfileCacheTable(env);

  const existingLink = await env.DB.prepare(
    `SELECT threads_user_id
     FROM app_threads_accounts
     WHERE app_user_id = ?
       AND (? IS NULL OR threads_user_id = ?)
       AND COALESCE(connection_active, is_active, 1) = 1
     ORDER BY COALESCE(is_active, 1) DESC, created_at DESC
     LIMIT 1`,
  )
    .bind(appUserId, targetThreadsUserId, targetThreadsUserId)
    .first<{ threads_user_id: string }>();

  if (!existingLink?.threads_user_id) {
    return { disconnected: false, threadsUserId: null, tombstoneExpiresAt: null };
  }

  const threadsUserId = existingLink.threads_user_id;
  const tombstoneExpiresAt = getThreadsConnectionTombstoneExpiresAt();
  const disableTombstone = options.disableTombstone === true;

  if (!targetThreadsUserId) {
    await env.DB.prepare(
      `UPDATE app_threads_accounts
       SET connection_active = 0,
           is_active = 0,
           tombstone_expires_at = ?
       WHERE app_user_id = ?
         AND COALESCE(connection_active, is_active, 1) = 1`,
    )
      .bind(disableTombstone ? null : tombstoneExpiresAt, appUserId)
      .run();

    return { disconnected: true, threadsUserId, tombstoneExpiresAt: disableTombstone ? null : tombstoneExpiresAt };
  }

  await env.DB.prepare(
    `UPDATE app_threads_accounts
     SET connection_active = 0,
         is_active = 0,
         tombstone_expires_at = ?
     WHERE app_user_id = ?
       AND threads_user_id = ?`,
  )
    .bind(disableTombstone ? null : tombstoneExpiresAt, appUserId, threadsUserId)
    .run();

  const fallbackRow = await env.DB.prepare(
    `SELECT threads_user_id
     FROM app_threads_accounts
     WHERE app_user_id = ?
       AND COALESCE(connection_active, is_active, 1) = 1
     ORDER BY created_at DESC, threads_user_id ASC
     LIMIT 1`,
  )
    .bind(appUserId)
    .first<{ threads_user_id: string }>();

  if (fallbackRow?.threads_user_id) {
    await env.DB.prepare(
      `UPDATE app_threads_accounts
       SET is_active = CASE
         WHEN threads_user_id = ? AND COALESCE(connection_active, is_active, 1) = 1 THEN 1
         ELSE 0
       END
       WHERE app_user_id = ?`,
    )
      .bind(fallbackRow.threads_user_id, appUserId)
      .run();
  }

  return { disconnected: true, threadsUserId, tombstoneExpiresAt: disableTombstone ? null : tombstoneExpiresAt };
}

async function setActiveThreadsAccountForAppUser(
  env: Env,
  appUserId: string,
  threadsUserId: string,
): Promise<boolean> {
  await ensureAppThreadsTable(env);

  const existingLink = await env.DB.prepare(
    `SELECT threads_user_id
     FROM app_threads_accounts
     WHERE app_user_id = ?
       AND threads_user_id = ?
       AND COALESCE(connection_active, is_active, 1) = 1
     LIMIT 1`,
  )
    .bind(appUserId, threadsUserId)
    .first<{ threads_user_id: string }>();

  if (!existingLink?.threads_user_id) {
    return false;
  }

  const dbSession = env.DB.withSession("first-primary");
  let transactionStarted = false;
  try {
    await dbSession.prepare("BEGIN TRANSACTION").run();
    transactionStarted = true;

    await dbSession.prepare(
      `UPDATE app_threads_accounts
       SET is_active = 0
       WHERE app_user_id = ?`,
    )
      .bind(appUserId)
      .run();

    await dbSession.prepare(
      `UPDATE app_threads_accounts
       SET is_active = 1
       WHERE app_user_id = ?
         AND threads_user_id = ?
         AND COALESCE(connection_active, is_active, 1) = 1`,
    )
      .bind(appUserId, threadsUserId)
      .run();

    await dbSession.prepare("COMMIT").run();
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      await dbSession.prepare("ROLLBACK").run();
    }
    throw error;
  }

  return true;
}

async function checkUserCapacity(
  env: Env,
  threadsUserId: string,
  options: { bypassCapacityLimit?: boolean } = {},
): Promise<Response | null> {
  if (options.bypassCapacityLimit) {
    return null;
  }

  await ensureAppThreadsTable(env);

  const existing = await env.DB.prepare(
    "SELECT threads_user_id FROM threads_accounts WHERE threads_user_id = ? LIMIT 1",
  )
    .bind(threadsUserId)
    .first<{ threads_user_id: string }>();

  if (existing) {
    return null;
  }

  const users = await env.DB.prepare(
    `SELECT COUNT(DISTINCT threads_user_id) AS total
     FROM app_threads_accounts
     WHERE COALESCE(connection_active, is_active, 1) = 1`,
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

    if (normalizedPath === "/api/batch-schedule/presets" && request.method === "GET") {
      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        return applyAuthCors(authUser);
      }

      const presets = await listBatchSchedulePresetsForUser(env, authUser.id);
      return applyAuthCors(new Response(JSON.stringify({
        success: true,
        presets,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    }

    if (normalizedPath === "/api/batch-schedule/presets" && request.method === "POST") {
      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        return applyAuthCors(authUser);
      }

      let payload: {
        name?: string;
        times?: unknown;
        is_favorite?: boolean;
      };
      try {
        payload = await request.json();
      } catch {
        return applyAuthCors(new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }));
      }

      const name = normalizeBatchSchedulePresetName(payload.name);
      const times = normalizeBatchSchedulePresetTimes(payload.times);
      if (!name || !times) {
        return applyAuthCors(new Response(JSON.stringify({
          error: "name and a valid ordered times array are required",
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }));
      }

      await ensureWorkspaceUserRecord(env, {
        id: authUser.id,
        email: authUser.email ?? "workspace@lensically.local",
        timezone: authUser.timezone ?? WORKSPACE_DEFAULT_TIMEZONE,
        clock_format: authUser.clock_format ?? "12h",
      });
      await ensureBatchSchedulePresetsTable(env);

      const existingCount = await env.DB.prepare(
        `SELECT COUNT(*) AS total
         FROM batch_schedule_presets
         WHERE user_id = ?`,
      )
        .bind(authUser.id)
        .first<{ total: number | string }>();

      if (Number(existingCount?.total ?? 0) >= MAX_BATCH_SCHEDULE_PRESET_COUNT) {
        return applyAuthCors(new Response(JSON.stringify({
          error: `Maximum of ${MAX_BATCH_SCHEDULE_PRESET_COUNT} batch schedule presets allowed.`,
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }));
      }

      const isFavorite = payload.is_favorite === true;
      if (isFavorite) {
        await env.DB.prepare(
          `UPDATE batch_schedule_presets
           SET is_favorite = 0
           WHERE user_id = ?`,
        )
          .bind(authUser.id)
          .run();
      }

      const presetId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO batch_schedule_presets (id, user_id, name, times_json, is_favorite)
         VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(
          presetId,
          authUser.id,
          name,
          JSON.stringify(times),
          isFavorite ? 1 : 0,
        )
        .run();

      const presets = await listBatchSchedulePresetsForUser(env, authUser.id);
      const preset = presets.find((entry) => entry.id === presetId) ?? null;

      return applyAuthCors(new Response(JSON.stringify({
        success: true,
        preset,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    }

    const favoritePresetMatch = normalizedPath.match(/^\/api\/batch-schedule\/presets\/([^/]+)\/favorite$/);
    if (favoritePresetMatch && request.method === "POST") {
      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        return applyAuthCors(authUser);
      }

      const presetId = favoritePresetMatch[1];
      await ensureBatchSchedulePresetsTable(env);
      const existingPreset = await env.DB.prepare(
        `SELECT id
         FROM batch_schedule_presets
         WHERE id = ?
           AND user_id = ?
         LIMIT 1`,
      )
        .bind(presetId, authUser.id)
        .first<{ id: string }>();

      if (!existingPreset) {
        return applyAuthCors(new Response(JSON.stringify({ error: "Batch preset not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }));
      }

      await env.DB.prepare(
        `UPDATE batch_schedule_presets
         SET is_favorite = 0
         WHERE user_id = ?`,
      )
        .bind(authUser.id)
        .run();

      await env.DB.prepare(
        `UPDATE batch_schedule_presets
         SET is_favorite = 1
         WHERE id = ?
           AND user_id = ?`,
      )
        .bind(presetId, authUser.id)
        .run();

      const presets = await listBatchSchedulePresetsForUser(env, authUser.id);
      const preset = presets.find((entry) => entry.id === presetId) ?? null;

      return applyAuthCors(new Response(JSON.stringify({
        success: true,
        preset,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    }

    const deletePresetMatch = normalizedPath.match(/^\/api\/batch-schedule\/presets\/([^/]+)$/);
    if (deletePresetMatch && request.method === "DELETE") {
      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        return applyAuthCors(authUser);
      }

      await ensureBatchSchedulePresetsTable(env);
      const deleteResult = await env.DB.prepare(
        `DELETE FROM batch_schedule_presets
         WHERE id = ?
           AND user_id = ?`,
      )
        .bind(deletePresetMatch[1], authUser.id)
        .run();

      if (Number(deleteResult.meta?.changes ?? 0) === 0) {
        return applyAuthCors(new Response(JSON.stringify({ error: "Batch preset not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }));
      }

      return applyAuthCors(new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
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
        const oauthProviderError = url.searchParams.get("error")?.trim().toLowerCase() ?? "";

        logEvent("GOOGLE_OAUTH_CALLBACK_RECEIVED", {
          hasCode: Boolean(code),
          hasState: Boolean(state),
          hasStateCookie: Boolean(cookieState),
        });

        logEvent("GOOGLE_OAUTH_STATE_VALIDATION_STARTED");
        if (oauthProviderError === "access_denied" || !code) {
          logEvent("GOOGLE_OAUTH_CALLBACK_REJECTED", {
            reason_code: "access_denied",
            oauth_error: oauthProviderError || null,
          });
          return redirectToAuthError("access_denied");
        }
        if (!state || !cookieState) {
          logEvent("GOOGLE_OAUTH_CALLBACK_REJECTED", {
            reason_code: "state_missing",
          });
          return redirectToAuthError("state_missing");
        }
        if (state !== cookieState) {
          logEvent("GOOGLE_OAUTH_CALLBACK_REJECTED", {
            reason_code: "state_mismatch",
          });
          return redirectToAuthError("state_mismatch");
        }
        logEvent("GOOGLE_OAUTH_STATE_VALIDATION_SUCCEEDED");

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
          return redirectToAuthError("token_exchange_failed");
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
          return redirectToAuthError("account_lookup_failed");
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

      const modeParam = url.searchParams.get("mode")?.trim().toLowerCase() ?? "";
      const connectionMode: "add" | null = modeParam === "add" ? "add" : null;
      const expectedThreadsUsernameRaw = url.searchParams.get("expected_threads_username")?.trim().toLowerCase() ?? "";
      const expectedThreadsUsername = /^[a-z0-9._]{1,30}$/.test(expectedThreadsUsernameRaw)
        ? expectedThreadsUsernameRaw
        : null;
      const state = buildOauthState(
        requestAppBase,
        effectiveAppUserId,
        connectionMode,
        expectedThreadsUsername,
      );
      const authURL = new URL("https://www.threads.net/oauth/authorize");
      const forceFreshLogin = true;
      authURL.searchParams.set("client_id", env.THREADS_CLIENT_ID);
      authURL.searchParams.set("redirect_uri", buildWorkerCallbackUrl(env, "/api/auth/threads/callback"));
      authURL.searchParams.set("scope", THREADS_OAUTH_SCOPES);
      authURL.searchParams.set("response_type", "code");
      authURL.searchParams.set("state", state);
      if (forceFreshLogin) {
        // Ask the OAuth provider to show account re-auth/selection rather than silently reusing a cached session.
        authURL.searchParams.set("auth_type", "reauthenticate");
        authURL.searchParams.set("prompt", "select_account");
        authURL.searchParams.set("force_reauth", "true");
      }

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
      const modeQuerySuffix = stateContext?.connectionMode === "add" ? "&mode=add" : "";
      const expectedUsernameQuerySuffix = stateContext?.expectedThreadsUsername
        ? `&expected_threads_username=${encodeURIComponent(stateContext.expectedThreadsUsername)}`
        : "";
      const redirectToConnectError = (
        error: string,
        options: { returnedThreadsUsername?: string | null } = {},
      ): Response => {
        const returnedUsernameQuerySuffix = options.returnedThreadsUsername
          ? `&returned_threads_username=${encodeURIComponent(options.returnedThreadsUsername)}`
          : "";
        return applyAuthCors(new Response(null, {
          status: 302,
          headers: {
            Location:
              `${appBaseUrl}/connect?error=${error}${modeQuerySuffix}${expectedUsernameQuerySuffix}${returnedUsernameQuerySuffix}`,
            "Set-Cookie": clearOauthStateCookie(THREADS_OAUTH_STATE_COOKIE_NAME),
          },
        }));
      };
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
        connectionMode: stateContext?.connectionMode ?? null,
        expectedThreadsUsername: stateContext?.expectedThreadsUsername ?? null,
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
        if (!resolveAuthenticatedAppUserId(authUser.id, appUserId)) {
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
        return redirectToConnectError("state_missing");
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
        return redirectToConnectError("token_exchange_failed");
      }

      let threadsUserId = "";
      let threadsProfileForCache: Omit<ThreadsProfileCachePayload, "threads_user_id"> | null = null;
      try {
        logEvent("THREADS_OAUTH_PROFILE_FETCH_STARTED");
        const readThreadsProfile = async () => {
          const primaryResponse = await fetch(
            "https://graph.threads.net/v1.0/me?fields=id,username,name,threads_biography,is_verified,threads_profile_picture_url",
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          );
          if (primaryResponse.ok) {
            return await primaryResponse.json() as {
              id?: string;
              username?: string;
              name?: string;
              threads_biography?: string;
              is_verified?: boolean;
              threads_profile_picture_url?: string;
            };
          }

          const fallbackResponse = await fetch(
            `https://graph.threads.net/me?fields=id,username,name,threads_biography,is_verified,threads_profile_picture_url&access_token=${encodeURIComponent(accessToken)}`,
          );
          if (!fallbackResponse.ok) {
            throw new Error("account_lookup_failed");
          }

          return await fallbackResponse.json() as {
            id?: string;
            username?: string;
            name?: string;
            threads_biography?: string;
            is_verified?: boolean;
            threads_profile_picture_url?: string;
          };
        };

        const meData = await readThreadsProfile();
        if (!meData.id) {
          throw new Error("account_lookup_failed");
        }

        const userCapacityResponse = await checkUserCapacity(env, meData.id, {
          bypassCapacityLimit: authUser.is_admin === true,
        });
        if (userCapacityResponse) {
          throw new Error("account_lookup_failed");
        }

        threadsUserId = meData.id;
        const returnedUsername = meData.username?.trim().toLowerCase() ?? "";
        const expectedThreadsUsername = stateContext?.expectedThreadsUsername?.trim().toLowerCase() ?? "";
        const isAddAnotherFlow = stateContext?.connectionMode === "add";
        if (
          isAddAnotherFlow
          && expectedThreadsUsername
          && returnedUsername
          && returnedUsername !== expectedThreadsUsername
        ) {
          logEvent("THREADS_OAUTH_UNEXPECTED_ACCOUNT_SELECTED", {
            app_user_id: resolvedAppUserId,
            expected_threads_username: expectedThreadsUsername,
            returned_threads_username: returnedUsername,
          });
          return redirectToConnectError("wrong_account_selected", {
            returnedThreadsUsername: returnedUsername,
          });
        }
        threadsProfileForCache = {
          username: meData.username ?? null,
          name: meData.name ?? null,
          threads_biography: meData.threads_biography ?? null,
          is_verified: meData.is_verified === true,
          threads_profile_picture_url: meData.threads_profile_picture_url ?? null,
        };
        logEvent("THREADS_OAUTH_PROFILE_FETCH_SUCCEEDED", {
          hasThreadsUserId: Boolean(threadsUserId),
        });
      } catch (error) {
        logError("THREADS_OAUTH_PROFILE_FETCH_FAILED", error);
        const errorCode = getErrorMessage(error);
        if (errorCode === "account_lookup_failed") {
          return redirectToConnectError(errorCode);
        }
        return redirectToConnectError("account_lookup_failed");
      }

      try {
        const existingSameConnection = await env.DB.prepare(
          `SELECT 1
           FROM app_threads_accounts
           WHERE app_user_id = ?
             AND threads_user_id = ?
             AND COALESCE(connection_active, is_active, 1) = 1
           LIMIT 1`,
        )
          .bind(resolvedAppUserId, threadsUserId)
          .first<{ "1": number }>();

        const isAddAnotherFlow = stateContext?.connectionMode === "add";
        if (isAddAnotherFlow && existingSameConnection) {
          logEvent("THREADS_OAUTH_ACCOUNT_ALREADY_CONNECTED", {
            app_user_id: resolvedAppUserId,
            threads_user_id: threadsUserId,
            reason_code: "same_account_selected_for_add_mode",
          });
          return redirectToConnectError("same_account_selected");
        }
      } catch (error) {
        logError("THREADS_OAUTH_ACCOUNT_DUPLICATE_CHECK_FAILED", error);
      }

      try {
        logEvent("THREADS_OAUTH_ACCOUNT_SAVE_STARTED");
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + expiresIn;
        await ensureThreadsAccountsTable(env);

        await env.DB.prepare(
          `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(threads_user_id) DO UPDATE SET
             access_token = excluded.access_token,
             expires_at = excluded.expires_at`,
        )
          .bind(threadsUserId, accessToken, expiresAt, now)
          .run();

        const restoredConnection = await restoreTombstonedThreadsConnectionForAppUser(
          env,
          resolvedAppUserId,
          threadsUserId,
        );
        if (restoredConnection) {
          logEvent("THREADS_CONNECTION_TOMBSTONE_RESTORED", {
            source: "threads_oauth_reconnect",
            app_user_id: resolvedAppUserId,
            threads_user_id: threadsUserId,
          });
        }
        if (!restoredConnection) {
          await upsertAppThreadsAccountLink(env, resolvedAppUserId, threadsUserId, now);
        }
        await setActiveThreadsAccountForAppUser(env, resolvedAppUserId, threadsUserId);
        logEvent("THREADS_OAUTH_ACCOUNT_LINK_SAVED", {
          resolvedAppUserId,
          threadsUserId,
          restoredConnection,
        });
        if (threadsProfileForCache) {
          try {
            await upsertThreadsProfileCache(env, {
              threads_user_id: threadsUserId,
              ...threadsProfileForCache,
            });
            logEvent("THREADS_PROFILE_CACHE_REFRESHED", {
              source: "threads_oauth_connect",
              app_user_id: resolvedAppUserId,
              threads_user_id: threadsUserId,
            });
          } catch (error) {
            logError("THREADS_OAUTH_PROFILE_CACHE_SAVE_FAILED", error);
          }
        }
        logEvent("THREADS_OAUTH_ACCOUNT_SAVE_SUCCEEDED");
      } catch (error) {
        logError("THREADS_OAUTH_ACCOUNT_SAVE_FAILED", error);
        const now = Math.floor(Date.now() / 1000);
        const fallbackExpiresAt = now + expiresIn;

        let recoveredTokenWrite = false;
        try {
          await ensureThreadsAccountsTable(env);
          await env.DB.prepare(
            `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(threads_user_id) DO UPDATE SET
               access_token = excluded.access_token,
               expires_at = excluded.expires_at`,
          )
            .bind(threadsUserId, accessToken, fallbackExpiresAt, now)
            .run();
          recoveredTokenWrite = true;
        } catch {
          recoveredTokenWrite = false;
        }

        const recoveredViaLegacyLink = await linkThreadsAccountWithSchemaFallback(
          env,
          resolvedAppUserId,
          threadsUserId,
          now,
        );
        if (recoveredTokenWrite && recoveredViaLegacyLink) {
          try {
            await setActiveThreadsAccountForAppUser(env, resolvedAppUserId, threadsUserId);
          } catch {
            // Legacy schemas may not support active-switch semantics yet.
          }
          logEvent("THREADS_OAUTH_ACCOUNT_SAVE_RECOVERED_VIA_LEGACY_LINK", {
            resolvedAppUserId,
            threadsUserId,
          });
          return applyAuthCors(new Response(null, {
            status: 302,
            headers: {
              Location: `${appBaseUrl}/dashboard`,
              "Set-Cookie": clearOauthStateCookie(THREADS_OAUTH_STATE_COOKIE_NAME),
            },
          }));
        }

        const saveErrorMessage = getErrorMessage(error);
        let saveErrorCode = "save_failed";
        if (saveErrorMessage.includes("no such column")) {
          saveErrorCode = "save_schema_mismatch";
        } else if (saveErrorMessage.includes("ON CONFLICT clause does not match")) {
          saveErrorCode = "save_conflict_target";
        } else if (saveErrorMessage.includes("UNIQUE constraint failed")) {
          saveErrorCode = "save_conflict";
        }
        return redirectToConnectError(saveErrorCode);
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
      const configuredAccounts = await getConfiguredThreadsProfiles(env);
      if (configuredAccounts.length > 0) {
        const activeAccount = configuredAccounts.find((account) => account.is_active) ?? configuredAccounts[0];

        return new Response(
          JSON.stringify({
            connected: true,
            account: activeAccount,
            accounts: configuredAccounts,
            active_threads_user_id: activeAccount.threads_user_id,
            ...activeAccount,
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
      const ownedAppUserId = resolveAuthenticatedAppUserId(authUser.id, appUserId);
      if (!ownedAppUserId) {
        return forbiddenJsonResponse(requestCorsHeaders);
      }

      const linkedAccounts = await listConnectedThreadsAccountsForAppUser(env, ownedAppUserId);
      const linkedAccountsPayload = linkedAccounts.map((linkedAccount) => ({
        threads_user_id: linkedAccount.threads_user_id,
        is_active: linkedAccount.is_active === 1,
        created_at: linkedAccount.created_at,
        username: linkedAccount.username ?? null,
        name: linkedAccount.name ?? null,
        threads_biography: linkedAccount.threads_biography ?? null,
        is_verified: linkedAccount.is_verified === 1,
        threads_profile_picture_url: linkedAccount.threads_profile_picture_url ?? null,
      }));
      const activeThreadsUserId = linkedAccounts.find((linkedAccount) => linkedAccount.is_active === 1)?.threads_user_id
        ?? linkedAccounts[0]?.threads_user_id
        ?? null;

      const account = await getThreadsAccountForAppUserWithRetry(env, ownedAppUserId);
      logWorkerEvent("THREADS_ME_LOOKUP_RESULT", {
        appUserId: ownedAppUserId,
        found: Boolean(account),
        threadsUserId: account?.threads_user_id ?? null,
      });

      if (!account) {
        const fallbackLinkedAccount = linkedAccountsPayload.find((linkedAccount) => linkedAccount.is_active)
          ?? linkedAccountsPayload[0]
          ?? null;
        if (fallbackLinkedAccount) {
          return new Response(
            JSON.stringify({
              connected: true,
              account: fallbackLinkedAccount,
              accounts: linkedAccountsPayload,
              active_threads_user_id: activeThreadsUserId ?? fallbackLinkedAccount.threads_user_id,
              ...fallbackLinkedAccount,
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

        return new Response(
          JSON.stringify({
            connected: false,
            accounts: linkedAccountsPayload,
            active_threads_user_id: activeThreadsUserId,
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

      const cachedProfile = await getFreshThreadsProfileCache(env, account.threads_user_id);
      if (cachedProfile) {
        logWorkerEvent("THREADS_PROFILE_CACHE_HIT", {
          app_user_id: ownedAppUserId,
          threads_user_id: account.threads_user_id,
          last_refreshed_at: cachedProfile.last_refreshed_at,
        });
        const cachedAccountPayload = {
          threads_user_id: cachedProfile.threads_user_id,
          name: cachedProfile.name,
          username: cachedProfile.username,
          threads_biography: cachedProfile.threads_biography,
          is_verified: cachedProfile.is_verified === 1,
          threads_profile_picture_url: cachedProfile.threads_profile_picture_url,
        };

        return new Response(
          JSON.stringify({
            connected: true,
            account: cachedAccountPayload,
            accounts: linkedAccountsPayload,
            active_threads_user_id: activeThreadsUserId,
            ...cachedAccountPayload,
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

      const fallbackAccountPayload = {
        threads_user_id: account.threads_user_id,
        name: linkedAccounts.find((linkedAccount) => linkedAccount.threads_user_id === account.threads_user_id)?.name ?? null,
        username: linkedAccounts.find((linkedAccount) => linkedAccount.threads_user_id === account.threads_user_id)?.username ?? null,
        threads_biography: linkedAccounts.find((linkedAccount) => linkedAccount.threads_user_id === account.threads_user_id)?.threads_biography ?? null,
        is_verified: linkedAccounts.find((linkedAccount) => linkedAccount.threads_user_id === account.threads_user_id)?.is_verified === 1,
        threads_profile_picture_url: linkedAccounts.find((linkedAccount) =>
          linkedAccount.threads_user_id === account.threads_user_id
        )?.threads_profile_picture_url ?? null,
      };

      const limit = await enforceLimit(
        env,
        { id: account.threads_user_id, is_admin: authUser.is_admin },
        "me",
      );
      if (!limit.allowed) {
        return new Response(
          JSON.stringify({
            connected: true,
            account: fallbackAccountPayload,
            accounts: linkedAccountsPayload,
            active_threads_user_id: activeThreadsUserId,
            ...fallbackAccountPayload,
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

      const meResp = await fetch(
        "https://graph.threads.net/v1.0/me?fields=id,username,name,threads_biography,is_verified,threads_profile_picture_url",
        {
          headers: { Authorization: `Bearer ${account.access_token}` },
        },
      );
      if (!meResp.ok) {
        logWorkerEvent("THREADS_ME_UPSTREAM_FAILED", {
          status: meResp.status,
          app_user_id: ownedAppUserId,
        }, "error");
        return new Response(
          JSON.stringify({
            connected: true,
            account: fallbackAccountPayload,
            accounts: linkedAccountsPayload,
            active_threads_user_id: activeThreadsUserId,
            ...fallbackAccountPayload,
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

      const mePayload = await readJsonSafe(meResp);
      if (!mePayload || typeof mePayload !== "object") {
        logWorkerEvent("THREADS_ME_UPSTREAM_INVALID_JSON", {
          app_user_id: ownedAppUserId,
        }, "error");
        return new Response(
          JSON.stringify({
            connected: true,
            account: fallbackAccountPayload,
            accounts: linkedAccountsPayload,
            active_threads_user_id: activeThreadsUserId,
            ...fallbackAccountPayload,
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

      try {
        await upsertThreadsProfileCache(env, {
          threads_user_id: account.threads_user_id,
          username: accountPayload.username,
          name: accountPayload.name,
          threads_biography: accountPayload.threads_biography,
          is_verified: accountPayload.is_verified,
          threads_profile_picture_url: accountPayload.threads_profile_picture_url,
        });
        logWorkerEvent("THREADS_PROFILE_CACHE_REFRESHED", {
          source: "threads_me_upstream_refresh",
          app_user_id: ownedAppUserId,
          threads_user_id: account.threads_user_id,
        });
      } catch (error) {
        logWorkerEvent("THREADS_PROFILE_CACHE_UPSERT_FAILED", {
          app_user_id: ownedAppUserId,
          threads_user_id: account.threads_user_id,
          error: getErrorMessage(error),
        }, "error");
      }

      return new Response(
        JSON.stringify({
          connected: true,
          account: accountPayload,
          accounts: linkedAccountsPayload,
          active_threads_user_id: activeThreadsUserId,
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

    if (url.pathname === "/api/threads/dashboard" && request.method === "GET") {
      const ownedAppUserId = WORKSPACE_APP_USER_ID;
      const account = await getThreadsAccountForAppUser(env, ownedAppUserId);

      if (!account?.access_token || !account.threads_user_id) {
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

      const dashboard = await buildThreadsDashboardPayload(env, account);
      return new Response(
        JSON.stringify(dashboard),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...requestCorsHeaders,
          },
        },
      );
    }

    if (url.pathname === "/api/threads/followers" && request.method === "GET") {
      const ownedAppUserId = WORKSPACE_APP_USER_ID;
      const account = await getThreadsAccountForAppUser(env, ownedAppUserId);

      if (!account?.threads_user_id) {
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

      const rawLimit = Number(url.searchParams.get("limit") ?? "100");
      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100)
        : 100;
      const rawPage = Number(url.searchParams.get("page") ?? "1");
      const page = Number.isFinite(rawPage)
        ? Math.max(Math.trunc(rawPage), 1)
        : 1;
      const offset = (page - 1) * limit;

      await refreshCurrentThreadsFollowerSnapshot(env, account, THREADS_INSIGHTS_TIME_ZONE);

      const totalCount = await countThreadsFollowerSnapshots(env, account.threads_user_id);
      const snapshotRows = await listThreadsFollowerSnapshotsPage(
        env,
        account.threads_user_id,
        limit + 1,
        offset,
      );
      const currentPageRows = snapshotRows.slice(0, limit);

      const rows = currentPageRows.map((row, index) => {
        const olderSnapshot = snapshotRows[index + 1] ?? null;
        const startOfDayFollowers = row.baseline_followers_count ?? row.followers_count;
        const gapCarry = olderSnapshot
          ? startOfDayFollowers - olderSnapshot.followers_count
          : 0;
        const netChange = olderSnapshot
          ? row.followers_count - olderSnapshot.followers_count
          : row.followers_count - startOfDayFollowers;

        return {
          date: row.snapshot_date,
          start_of_day_followers: startOfDayFollowers,
          gap_carry: gapCarry,
          latest_followers: row.followers_count,
          net_change: netChange,
          updated_at: row.captured_at,
        };
      });

      const totalPages = Math.max(1, Math.ceil(totalCount / limit));

      return new Response(
        JSON.stringify({
          rows,
          total_count: totalCount,
          page,
          page_size: limit,
          total_pages: totalPages,
          timezone: THREADS_INSIGHTS_TIME_ZONE,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...requestCorsHeaders,
          },
        },
      );
    }

    if (url.pathname === "/api/threads/accounts" && request.method === "GET") {
      const configuredAccounts = await getConfiguredThreadsProfiles(env);
      if (configuredAccounts.length > 0) {
        const activeAccount = configuredAccounts.find((account) => account.is_active) ?? configuredAccounts[0];

        return new Response(
          JSON.stringify({
            connected: true,
            accounts: configuredAccounts,
            active_threads_user_id: activeAccount.threads_user_id,
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
      const ownedAppUserId = resolveAuthenticatedAppUserId(authUser.id, appUserId);
      if (!ownedAppUserId) {
        return forbiddenJsonResponse(requestCorsHeaders);
      }

      const linkedAccounts = await listConnectedThreadsAccountsForAppUser(env, ownedAppUserId);
      const linkedAccountsPayload = linkedAccounts.map((linkedAccount) => ({
        threads_user_id: linkedAccount.threads_user_id,
        is_active: linkedAccount.is_active === 1,
        created_at: linkedAccount.created_at,
        username: linkedAccount.username ?? null,
        name: linkedAccount.name ?? null,
        threads_biography: linkedAccount.threads_biography ?? null,
        is_verified: linkedAccount.is_verified === 1,
        threads_profile_picture_url: linkedAccount.threads_profile_picture_url ?? null,
      }));
      const activeThreadsUserId = linkedAccounts.find((linkedAccount) => linkedAccount.is_active === 1)?.threads_user_id
        ?? linkedAccounts[0]?.threads_user_id
        ?? null;

      return new Response(
        JSON.stringify({
          connected: linkedAccountsPayload.length > 0,
          accounts: linkedAccountsPayload,
          active_threads_user_id: activeThreadsUserId,
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

    if (url.pathname === "/api/threads/accounts/active" && request.method === "POST") {
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

      let payload: { app_user_id?: string; threads_user_id?: string } = {};
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

      const threadsUserId = payload.threads_user_id?.trim();
      if (!threadsUserId) {
        return new Response(
          JSON.stringify({ error: "threads_user_id is required" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }

      const switched = await setActiveThreadsAccountForAppUser(env, appUserId, threadsUserId);
      if (!switched) {
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
          active_threads_user_id: threadsUserId,
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

      let payload: { app_user_id?: string; threads_user_id?: string } = {};
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

      const targetThreadsUserId = payload.threads_user_id?.trim() || null;
      const result = await disconnectThreadsAccountForAppUser(env, appUserId, targetThreadsUserId, {
        disableTombstone: authUser.is_admin === true,
      });
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

      logWorkerEvent(result.tombstoneExpiresAt ? "THREADS_CONNECTION_TOMBSTONE_CREATED" : "THREADS_CONNECTION_TOMBSTONE_SKIPPED", {
        source: "threads_disconnect",
        app_user_id: appUserId,
        threads_user_id: result.threadsUserId,
        tombstone_expires_at: result.tombstoneExpiresAt,
      });

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
      (
        url.pathname === "/api/threads/profile"
        || url.pathname === "/api/threads/profile_lookup"
        || url.pathname === "/api/threads/discovery/profile"
      )
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
      const normalizedUsername = username?.trim() ?? "";
      const requestedAppUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));
      const appUserId = requestedAppUserId ?? authUser.id;

      if (!normalizedUsername) {
        return new Response(
          JSON.stringify({ error: "missing username" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }

      if (requestedAppUserId && authUser.id !== requestedAppUserId) {
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

      const profileLookupResult = await executeThreadsProfileLookup({
        accessToken: account.access_token,
        username: normalizedUsername,
      });
      if (!profileLookupResult.success) {
        logWorkerEvent("THREADS_PROFILE_LOOKUP_FAILED", {
          status: profileLookupResult.status ?? null,
          error_code: profileLookupResult.errorCode,
          upstream_response_body: profileLookupResult.responseBody ?? null,
          error_message: profileLookupResult.errorMessage ?? null,
          username: normalizedUsername,
          app_user_id: appUserId,
        }, "error");
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }

      return new Response(JSON.stringify(profileLookupResult.data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (
      (url.pathname === "/api/threads/profile_posts" || url.pathname === "/api/threads/discovery/profile_posts")
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
      const normalizedUsername = username?.trim() ?? "";
      const cursor = url.searchParams.get("cursor");
      const requestedAppUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));
      const appUserId = requestedAppUserId ?? authUser.id;

      if (!normalizedUsername) {
        return new Response(
          JSON.stringify({ error: "missing username" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }

      if (requestedAppUserId && authUser.id !== requestedAppUserId) {
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

      const profilePostsResult = await executeThreadsProfilePosts({
        accessToken: account.access_token,
        username: normalizedUsername,
        cursor,
      });
      if (!profilePostsResult.success) {
        logWorkerEvent("THREADS_PROFILE_POSTS_FAILED", {
          status: profilePostsResult.status ?? null,
          error_code: profilePostsResult.errorCode,
          app_user_id: appUserId,
        }, "error");
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }

      return new Response(JSON.stringify(profilePostsResult.data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/api/threads/posts" && request.method === "GET") {
      const appUserId = WORKSPACE_APP_USER_ID;
      const cursor = url.searchParams.get("cursor");
      const cursorDepthParam = Number(url.searchParams.get("cursor_depth") || 0);
      const cursorDepth = Number.isFinite(cursorDepthParam) && cursorDepthParam > 0
        ? cursorDepthParam
        : (cursor ? 2 : 1);
      logWorkerEvent("THREADS_POSTS_REQUEST", {
        app_user_id: appUserId,
      });

      if (cursorDepth > MAX_THREADS_POST_CURSOR_DEPTH) {
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

      const ownedAppUserId = WORKSPACE_APP_USER_ID;

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId);
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
          { id: account.threads_user_id, is_admin: WORKSPACE_IS_ADMIN },
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
      logWorkerEvent("THREADS_API_REQUEST", {
        endpoint: "/v1.0/:threads_user_id/threads",
        has_cursor: Boolean(cursor),
      });
      const postsPage = await fetchThreadsPostsPageWithInsights(
        account.access_token,
        account.threads_user_id,
        cursor,
      );
      if (!postsPage) {
        logWorkerEvent("THREADS_POSTS_UPSTREAM_FAILED", {
          app_user_id: appUserId,
          has_cursor: Boolean(cursor),
        }, "error");
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }

      const hasMore = postsPage.hasMore && cursorDepth < MAX_THREADS_POST_CURSOR_DEPTH;
      const nextCursor = cursorDepth < MAX_THREADS_POST_CURSOR_DEPTH ? postsPage.nextCursor : null;

      try {
        await upsertThreadsPostsArchive(env, account.threads_user_id, postsPage.posts);
      } catch (error) {
        logWorkerEvent("THREADS_POSTS_ARCHIVE_UPSERT_FAILED", {
          app_user_id: ownedAppUserId,
          threads_user_id: account.threads_user_id,
          has_cursor: Boolean(cursor),
          error: getErrorMessage(error),
        }, "error");
      }

      if (!cursor) {
        try {
          await replaceThreadsPostsCache(env, account.threads_user_id, postsPage.posts, {
            threads_user_id: account.threads_user_id,
            next_cursor: nextCursor,
            has_more: hasMore,
          });
        } catch (error) {
          logWorkerEvent("THREADS_POSTS_CACHE_UPSERT_FAILED", {
            app_user_id: ownedAppUserId,
            threads_user_id: account.threads_user_id,
            error: getErrorMessage(error),
          }, "error");
        }
      }

      return new Response(JSON.stringify({
        posts: postsPage.posts,
        next_cursor: nextCursor,
        has_more: hasMore,
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          ...requestCorsHeaders,
        },
      });
    }

    if (url.pathname === "/api/threads/posts/archive" && request.method === "GET") {
      const ownedAppUserId = WORKSPACE_APP_USER_ID;

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId);
      if (!account || !account.threads_user_id) {
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

      const requestedOrder = url.searchParams.get("order")?.trim().toLowerCase();
      const order = requestedOrder === "top" ? "top" : "recent";
      const rawLimit = Number(url.searchParams.get("limit") ?? "200");
      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(Math.trunc(rawLimit), 1), 1000)
        : 200;
      const rawPage = Number(url.searchParams.get("page") ?? "1");
      const page = Number.isFinite(rawPage)
        ? Math.max(Math.trunc(rawPage), 1)
        : 1;
      const offset = (page - 1) * limit;

      const archive = await listArchivedThreadsPosts(env, account.threads_user_id, order, limit, offset);
      const totalPages = Math.max(1, Math.ceil(archive.totalCount / limit));

      return new Response(JSON.stringify({
        posts: archive.posts,
        total_count: archive.totalCount,
        order,
        page,
        page_size: limit,
        total_pages: totalPages,
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          ...requestCorsHeaders,
        },
      });
    }

    if (url.pathname === "/api/threads/insights" && request.method === "GET") {
      const appUserId = WORKSPACE_APP_USER_ID;
      const threadsUserId = url.searchParams.get("threads_user_id");
      const ownedAppUserId = WORKSPACE_APP_USER_ID;

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId);

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
        { id: account.threads_user_id, is_admin: WORKSPACE_IS_ADMIN },
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
      const mediaId = url.searchParams.get("id");
      if (!mediaId) {
        return new Response(
          JSON.stringify({ error: "missing media id" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const ownedAppUserId = WORKSPACE_APP_USER_ID;

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId);

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
      const ownedAppUserId = resolveAuthenticatedAppUserId(authUser.id, appUserId);
      if (!ownedAppUserId) {
        return forbiddenJsonResponse(requestCorsHeaders);
      }

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId);

      if (!account) {
        return new Response(
          JSON.stringify({ error: "no connected account" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const cachedInsights = await getFreshThreadsUserInsightsCache(env, account.threads_user_id);
      if (cachedInsights) {
        const cachedPayload = safeParseJsonString(cachedInsights.insights_json);
        if (cachedPayload !== null) {
          logWorkerEvent("THREADS_USER_INSIGHTS_CACHE_HIT", {
            app_user_id: ownedAppUserId,
            threads_user_id: account.threads_user_id,
            last_refreshed_at: cachedInsights.last_refreshed_at,
          });

          return new Response(JSON.stringify(cachedPayload), {
            status: 200,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
      }

      const data = await fetchThreadsUserInsightsByAccount(account.access_token, account.threads_user_id);
      if (data === null) {
        return upstreamProviderErrorResponse(requestCorsHeaders);
      }

      try {
        await upsertThreadsUserInsightsCache(env, {
          threads_user_id: account.threads_user_id,
          insights_json: JSON.stringify(data),
        });
      } catch (error) {
        logWorkerEvent("THREADS_USER_INSIGHTS_CACHE_UPSERT_FAILED", {
          app_user_id: ownedAppUserId,
          threads_user_id: account.threads_user_id,
          error: getErrorMessage(error),
        }, "error");
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
      const authorUsername = url.searchParams.get("author_username")?.trim() ?? "";
      const startTimestamp = url.searchParams.get("start_timestamp")?.trim() ?? "";
      const endTimestamp = url.searchParams.get("end_timestamp")?.trim() ?? "";

      if (!appUserId) {
        return new Response(
          JSON.stringify({ error: "missing app_user_id" }),
          { status: 400 },
        );
      }
      const ownedAppUserId = resolveAuthenticatedAppUserId(authUser.id, appUserId);
      if (!ownedAppUserId) {
        return forbiddenJsonResponse(requestCorsHeaders);
      }

      const validationResult = validateThreadsKeywordSearchParams({
        query: q,
        searchMode,
        searchType,
        limit,
      });
      if (!validationResult.valid) {
        logWorkerEvent("THREADS_KEYWORD_SEARCH_VALIDATION_FAILED", {
          query: q ?? "",
          search_mode: searchMode ?? null,
          search_type: searchType ?? null,
          limit: limit ?? null,
          author_username: authorUsername || null,
          start_timestamp: startTimestamp || null,
          end_timestamp: endTimestamp || null,
          errors: validationResult.errors,
        }, "error");
        return keywordSearchValidationErrorResponse(requestCorsHeaders, validationResult.errors);
      }

      try {
        const account = await getThreadsAccountForAppUser(env, ownedAppUserId);
        const threadsUserId = account?.threads_user_id?.trim();
        const accessToken = account?.access_token?.trim();

        if (!threadsUserId || !accessToken) {
          logWorkerEvent("THREADS_KEYWORD_SEARCH_AUTHORIZATION_FAILED", {
            query: validationResult.value.query,
            search_mode: validationResult.value.searchMode,
            search_type: validationResult.value.searchType,
            limit: validationResult.value.limit,
            author_username: authorUsername || null,
            start_timestamp: startTimestamp || null,
            end_timestamp: endTimestamp || null,
            reason_code: "threads_not_connected",
          }, "error");
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
          { id: threadsUserId, is_admin: authUser.is_admin },
          "keyword_search",
        );
        if (!usageLimit.allowed) {
          return limitDeniedResponse(usageLimit, "keyword_search", request, env);
        }

        const searchStartedAt = Date.now();
        logWorkerEvent("THREADS_KEYWORD_SEARCH_REQUEST", {
          query: validationResult.value.query,
          search_mode: validationResult.value.searchMode,
          search_type: validationResult.value.searchType,
          limit: validationResult.value.limit,
          author_username: authorUsername || null,
          start_timestamp: startTimestamp || null,
          end_timestamp: endTimestamp || null,
        });

        const searchResult = await executeThreadsKeywordSearch({
          accessToken,
          query: validationResult.value.query,
          searchType: validationResult.value.searchType,
          searchMode: validationResult.value.searchMode,
          limit: validationResult.value.limit,
        });

        if (!searchResult.success) {
          logWorkerEvent("THREADS_KEYWORD_SEARCH_RESPONSE", {
            query: validationResult.value.query,
            search_mode: validationResult.value.searchMode,
            search_type: validationResult.value.searchType,
            limit: validationResult.value.limit,
            author_username: authorUsername || null,
            start_timestamp: startTimestamp || null,
            end_timestamp: endTimestamp || null,
            execution_ms: Date.now() - searchStartedAt,
            success: false,
            error_code: searchResult.errorCode,
            status: searchResult.status ?? null,
          }, "error");
          return keywordSearchServiceErrorResponse(requestCorsHeaders, searchResult.errorCode);
        }

        logWorkerEvent("THREADS_KEYWORD_SEARCH_RESPONSE", {
          query: validationResult.value.query,
          search_mode: validationResult.value.searchMode,
          search_type: validationResult.value.searchType,
          limit: validationResult.value.limit,
          author_username: authorUsername || null,
          start_timestamp: startTimestamp || null,
          end_timestamp: endTimestamp || null,
          execution_ms: Date.now() - searchStartedAt,
          success: true,
          result_count: searchResult.data.posts.length,
        });

        return new Response(JSON.stringify(searchResult.data), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        logWorkerEvent("THREADS_KEYWORD_SEARCH_UNEXPECTED_ERROR", {
          app_user_id: appUserId,
          error: getErrorMessage(error),
        }, "error");
        return keywordSearchUnexpectedErrorResponse(requestCorsHeaders);
      }
    }

    if (
      (url.pathname === "/api/threads/publish" || url.pathname === "/api/threads/post-now")
      && request.method === "POST"
    ) {
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

      const ownedAppUserId = WORKSPACE_APP_USER_ID;

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
          { id: account.threads_user_id, is_admin: WORKSPACE_IS_ADMIN },
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
        const cachedStatus = typeof existingResponse.response_status === "number"
          ? existingResponse.response_status
          : 200;
        return new Response(existingResponse.response_body, {
          status: cachedStatus,
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
        const publishErrorMessage = buildPublishErrorStorageValue(
          publishOutcome.errorCode,
          publishOutcome.status,
          publishOutcome.providerErrorMessage,
        );
        logWorkerEvent("IMMEDIATE_THREADS_PUBLISH_FAILURE", {
          scope: publishScope,
          app_user_id: ownedAppUserId,
          threads_user_id: account.threads_user_id,
          error_code: publishOutcome.errorCode,
          status: publishOutcome.status ?? null,
          provider_error_message: publishOutcome.providerErrorMessage ?? null,
          provider_response_body: publishOutcome.providerResponseBody ?? null,
        });
        return upstreamProviderErrorResponse(requestCorsHeaders, publishErrorMessage);
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
          const racedStatus = typeof racedResponse.response_status === "number"
            ? racedResponse.response_status
            : 200;
          return new Response(racedResponse.response_body, {
            status: racedStatus,
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

    if (url.pathname === "/api/threads/schedule/batch" && request.method === "POST") {
      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        return authUser;
      }

      let payload: {
        app_user_id?: string;
        threads_user_id?: string;
        timezone?: string;
        date?: string;
        entries?: Array<{
          text?: string;
          time?: string;
          date?: string;
        }>;
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

      const ownedAppUserId = payload.app_user_id?.trim() || authUser.id || WORKSPACE_APP_USER_ID;
      const threadsUserId = payload.threads_user_id?.trim();
      const timezone = payload.timezone?.trim() || WORKSPACE_DEFAULT_TIMEZONE;
      const sharedDate = payload.date?.trim() || "";
      const entries = Array.isArray(payload.entries) ? payload.entries : [];

      if (!threadsUserId || entries.length === 0 || entries.length > MAX_SCHEDULED_POST_MAX_BATCH_SIZE) {
        return new Response(
          JSON.stringify({ error: "threads_user_id and a non-empty entries array are required" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId);
      const directThreadsAccount = account?.threads_user_id === threadsUserId
        ? account
        : await env.DB.prepare(
          `SELECT threads_user_id
           FROM threads_accounts
           WHERE threads_user_id = ?
           LIMIT 1`,
        )
          .bind(threadsUserId)
          .first<{ threads_user_id: string }>();

      if (!directThreadsAccount?.threads_user_id) {
        return new Response(
          JSON.stringify({ error: "Threads account not connected" }),
          {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const results: Array<{
        row_number: number;
        success: boolean;
        reused: boolean;
        scheduled_post_id: number | null;
        scheduled_time_utc: string | null;
        error: string | null;
      }> = [];

      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const text = typeof entry?.text === "string" ? entry.text : "";
        const time = typeof entry?.time === "string" ? entry.time.trim() : "";
        const date = typeof entry?.date === "string" && entry.date.trim()
          ? entry.date.trim()
          : sharedDate;

        if (!date || !time || typeof text !== "string") {
          results.push({
            row_number: index + 1,
            success: false,
            reused: false,
            scheduled_post_id: null,
            scheduled_time_utc: null,
            error: "missing_required_fields",
          });
          continue;
        }

        const scheduled = await createScheduledPostForAppUser(
          env,
          ownedAppUserId,
          threadsUserId,
          text,
          date,
          time,
          timezone,
        );

        results.push({
          row_number: index + 1,
          success: scheduled.success,
          reused: scheduled.reused === true,
          scheduled_post_id: scheduled.scheduledPostId ?? null,
          scheduled_time_utc: scheduled.scheduledTimeUtc ?? null,
          error: scheduled.success ? null : scheduled.error ?? "schedule_failed",
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          results,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }

    if (url.pathname === "/api/threads/schedule" && request.method === "POST") {
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

      const ownedAppUserId = WORKSPACE_APP_USER_ID;
      const resolvedTimezone = timezone ?? WORKSPACE_DEFAULT_TIMEZONE;

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

      const ownedAppUserId = WORKSPACE_APP_USER_ID;
      const resolvedTimezone = timezone ?? WORKSPACE_DEFAULT_TIMEZONE;
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

    if (url.pathname === "/api/threads/schedule/delete" && request.method === "POST") {
      let payload: {
        app_user_id?: string;
        scheduled_post_id?: number | string;
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

      const scheduledPostId = Number(payload.scheduled_post_id);
      if (!Number.isInteger(scheduledPostId) || scheduledPostId <= 0) {
        return new Response(
          JSON.stringify({ error: "scheduled_post_id is required" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const ownedAppUserId = WORKSPACE_APP_USER_ID;

      const deleted = await deleteScheduledPostForAppUser(env, ownedAppUserId, scheduledPostId);
      if (deleted === "not_found") {
        return new Response(
          JSON.stringify({ error: "Scheduled post not found" }),
          {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      if (deleted === "not_deletable") {
        return new Response(
          JSON.stringify({ error: "Only approved scheduled posts can be deleted." }),
          {
            status: 409,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          deleted: true,
          scheduled_post_id: scheduledPostId,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }

    if (url.pathname === "/api/threads/schedule/retry" && request.method === "POST") {
      let payload: {
        app_user_id?: string;
        scheduled_post_id?: number | string;
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

      const scheduledPostId = Number(payload.scheduled_post_id);
      if (!Number.isInteger(scheduledPostId) || scheduledPostId <= 0) {
        return new Response(
          JSON.stringify({ error: "scheduled_post_id is required" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const ownedAppUserId = WORKSPACE_APP_USER_ID;

      await ensureScheduledPostsTable(env);
      const scheduledPost = await env.DB.prepare(
        `SELECT id, user_id, threads_user_id, post_text, status
         FROM scheduled_posts
         WHERE id = ?
           AND user_id = ?
         LIMIT 1`,
      )
        .bind(scheduledPostId, ownedAppUserId)
        .first<{
          id: number | string;
          user_id: string;
          threads_user_id: string;
          post_text: string;
          status: string;
        }>();

      if (!scheduledPost) {
        return new Response(
          JSON.stringify({ error: "Scheduled post not found" }),
          {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      if (scheduledPost.status === SCHEDULED_POST_STATUS_POSTED) {
        return new Response(
          JSON.stringify({ error: "Scheduled post has already been posted." }),
          {
            status: 409,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
      if (scheduledPost.status === SCHEDULED_POST_STATUS_POSTING) {
        return new Response(
          JSON.stringify({ error: "Scheduled post is already publishing." }),
          {
            status: 409,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
      if (scheduledPost.status !== SCHEDULED_POST_STATUS_APPROVED) {
        return new Response(
          JSON.stringify({ error: "Only approved scheduled posts can be retried." }),
          {
            status: 409,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      await processScheduledPost(env, {
        id: Number(scheduledPost.id),
        user_id: scheduledPost.user_id,
        threads_user_id: scheduledPost.threads_user_id,
        post_text: scheduledPost.post_text,
      });

      const refreshed = await env.DB.prepare(
        `SELECT status, published_post_id, publish_error_message
         FROM scheduled_posts
         WHERE id = ?
           AND user_id = ?
         LIMIT 1`,
      )
        .bind(scheduledPostId, ownedAppUserId)
        .first<{
          status: string;
          published_post_id: string | null;
          publish_error_message: string | null;
        }>();

      const publishedPostId = refreshed?.published_post_id?.trim() || null;
      if (refreshed?.status === SCHEDULED_POST_STATUS_POSTED && publishedPostId) {
        return new Response(
          JSON.stringify({
            success: true,
            posted: true,
            published_post_id: publishedPostId,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const publishErrorMessage = refreshed?.publish_error_message?.trim() || "scheduled_publish_retry_failed";
      return new Response(
        JSON.stringify({
          success: false,
          error: publishErrorMessage,
          publish_error_message: publishErrorMessage,
        }),
        {
          status: 502,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }

    if (url.pathname === "/api/threads/schedule" && request.method === "GET") {
      const ownedAppUserId = WORKSPACE_APP_USER_ID;

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

      const rows = await env.DB.prepare(
        `SELECT id, post_text, status, scheduled_time, publish_error_message, last_attempted_at, processing_started_at
         FROM scheduled_posts
         WHERE user_id = ?
           AND status IN (?, ?)
         ORDER BY scheduled_time ASC, id ASC
         LIMIT 100`,
      )
        .bind(
          ownedAppUserId,
          SCHEDULED_POST_STATUS_APPROVED,
          SCHEDULED_POST_STATUS_POSTING,
        )
        .all<{
          id: number | string;
          post_text: string;
          status: string;
          scheduled_time: string;
          publish_error_message: string | null;
          last_attempted_at: string | null;
          processing_started_at: string | null;
        }>();

      return new Response(
        JSON.stringify({
          success: true,
          scheduled_posts: (rows.results ?? []).map((row) => ({
            id: Number(row.id),
            text: row.post_text,
            status: row.status,
            scheduled_time_utc: row.scheduled_time,
            publish_error_message: row.publish_error_message ?? null,
            last_attempted_at: row.last_attempted_at ?? null,
            processing_started_at: row.processing_started_at ?? null,
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

    if (url.pathname === "/api/automation/claim-daily-run" && request.method === "POST") {
      let payload: {
        automation_id?: string;
        account_id?: string;
        run_date?: string;
        timezone?: string;
        source?: string;
      };
      try {
        payload = await request.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body" }),
          { status: 400, headers: { "content-type": "application/json; charset=UTF-8" } },
        );
      }

      const automationId = payload.automation_id?.trim() ?? "";
      const accountId = payload.account_id?.trim().toLowerCase() ?? "";
      const source = payload.source?.trim().toLowerCase() === "manual" ? "manual" : "scheduled";
      const requestedTimeZone = payload.timezone?.trim() || "America/New_York";
      const timeZone = isValidIanaTimezone(requestedTimeZone) ? requestedTimeZone : "America/New_York";
      const runDate = payload.run_date?.trim() && isValidIsoDate(payload.run_date.trim())
        ? payload.run_date.trim()
        : getLocalDateInTimeZone(timeZone);

      if (!automationId || !accountId || !runDate) {
        return new Response(
          JSON.stringify({ error: "automation_id, account_id, and resolvable run_date are required" }),
          { status: 400, headers: { "content-type": "application/json; charset=UTF-8" } },
        );
      }

      const claim = await claimAutomationDailyRun(env, automationId, accountId, runDate, source);

      return new Response(
        JSON.stringify({
          success: true,
          acquired: claim.acquired,
          reason: claim.reason,
          run_date: runDate,
          source,
          lock: claim.lock,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }

    if (url.pathname === "/api/automation/complete-daily-run" && request.method === "POST") {
      let payload: {
        automation_id?: string;
        account_id?: string;
        run_date?: string;
        success?: boolean;
        result?: string;
      };
      try {
        payload = await request.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body" }),
          { status: 400, headers: { "content-type": "application/json; charset=UTF-8" } },
        );
      }

      const automationId = payload.automation_id?.trim() ?? "";
      const accountId = payload.account_id?.trim().toLowerCase() ?? "";
      const runDate = payload.run_date?.trim() ?? "";
      const success = payload.success === true;
      const result = payload.result?.trim() || (success ? "success" : "failure");

      if (!automationId || !accountId || !isValidIsoDate(runDate)) {
        return new Response(
          JSON.stringify({ error: "automation_id, account_id, and valid run_date are required" }),
          { status: 400, headers: { "content-type": "application/json; charset=UTF-8" } },
        );
      }

      const lock = await completeAutomationDailyRun(
        env,
        automationId,
        accountId,
        runDate,
        success,
        result,
      );

      return new Response(
        JSON.stringify({
          success: true,
          completed: true,
          lock,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }

    if (url.pathname === "/internal/automation/context" && request.method === "GET") {
      if (!isInternalRequestAuthorized(request, env)) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "content-type": "application/json; charset=UTF-8" } },
        );
      }

      const requestedTimeZone = url.searchParams.get("timezone")?.trim() || "America/New_York";
      const timeZone = isValidIanaTimezone(requestedTimeZone) ? requestedTimeZone : "America/New_York";
      const requestedDate = url.searchParams.get("date")?.trim() || null;
      const requestedAccountId = url.searchParams.get("account_id")?.trim() || null;
      const configuredAccount = await getConfiguredThreadsAccountById(env, requestedAccountId);

      if (!configuredAccount) {
        return new Response(
          JSON.stringify({ error: "Configured Threads account not found" }),
          { status: 404, headers: { "content-type": "application/json; charset=UTF-8" } },
        );
      }

      const configuredProfile = await fetchConfiguredThreadsProfile(env, configuredAccount, 0);
      const targetDate = requestedDate && isValidIsoDate(requestedDate)
        ? requestedDate
        : buildDefaultTomorrowSlotPlan(timeZone)?.date ?? null;

      if (!targetDate) {
        return new Response(
          JSON.stringify({ error: "Could not resolve target date" }),
          { status: 400, headers: { "content-type": "application/json; charset=UTF-8" } },
        );
      }

      const desiredSlots = buildHourlySlotTimes(7, 23);
      const [recentArchive, topArchive, scheduledPosts] = await Promise.all([
        listArchivedThreadsPosts(env, configuredProfile.threads_user_id, "recent", 48, 0),
        listArchivedThreadsPosts(env, configuredProfile.threads_user_id, "top", 48, 0),
        listScheduledPostsForThreadsAccountOnLocalDate(
          env,
          configuredProfile.threads_user_id,
          targetDate,
          timeZone,
        ),
      ]);

      const occupiedSlots = new Set(
        scheduledPosts
          .map((post) => post.local_time)
          .filter((slot) => Boolean(slot)),
      );
      const missingSlots = desiredSlots.filter((slot) => !occupiedSlots.has(slot));

      return new Response(
        JSON.stringify({
          success: true,
          account: {
            id: configuredAccount.id,
            label: configuredAccount.label,
            username: configuredProfile.username ?? configuredAccount.username,
            threads_user_id: configuredProfile.threads_user_id,
          },
          date: targetDate,
          timezone: timeZone,
          desired_slots: desiredSlots,
          occupied_slots: Array.from(occupiedSlots),
          missing_slots: missingSlots,
          scheduled_posts: scheduledPosts,
          archive_summary: {
            total_posts: recentArchive.totalCount,
            recent_sample_count: recentArchive.posts.length,
            top_sample_count: topArchive.posts.length,
          },
          archive_recent: recentArchive.posts,
          archive_top: topArchive.posts,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }

    if (url.pathname === "/internal/automation/schedule-plan" && request.method === "POST") {
      if (!isInternalRequestAuthorized(request, env)) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "content-type": "application/json; charset=UTF-8" } },
        );
      }

      let payload: {
        account_id?: string;
        date?: string;
        timezone?: string;
        posts?: Array<{ slot?: string; text?: string }>;
      };
      try {
        payload = await request.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body" }),
          { status: 400, headers: { "content-type": "application/json; charset=UTF-8" } },
        );
      }

      const requestedTimeZone = payload.timezone?.trim() || "America/New_York";
      const timeZone = isValidIanaTimezone(requestedTimeZone) ? requestedTimeZone : "America/New_York";
      const targetDate = payload.date?.trim() && isValidIsoDate(payload.date.trim())
        ? payload.date.trim()
        : buildDefaultTomorrowSlotPlan(timeZone)?.date ?? null;
      const configuredAccount = await getConfiguredThreadsAccountById(env, payload.account_id ?? null);

      if (!targetDate) {
        return new Response(
          JSON.stringify({ error: "Invalid or missing target date" }),
          { status: 400, headers: { "content-type": "application/json; charset=UTF-8" } },
        );
      }

      if (!configuredAccount) {
        return new Response(
          JSON.stringify({ error: "Configured Threads account not found" }),
          { status: 404, headers: { "content-type": "application/json; charset=UTF-8" } },
        );
      }

      if (!Array.isArray(payload.posts) || payload.posts.length === 0) {
        return new Response(
          JSON.stringify({ error: "posts array is required" }),
          { status: 400, headers: { "content-type": "application/json; charset=UTF-8" } },
        );
      }

      const configuredProfile = await fetchConfiguredThreadsProfile(env, configuredAccount, 0);
      const existingScheduledPosts = await listScheduledPostsForThreadsAccountOnLocalDate(
        env,
        configuredProfile.threads_user_id,
        targetDate,
        timeZone,
      );
      const occupiedSlots = new Set(
        existingScheduledPosts
          .map((post) => post.local_time)
          .filter((slot) => Boolean(slot)),
      );

      const seenRequestSlots = new Set<string>();
      const created: Array<{ slot: string; scheduled_post_id: number; scheduled_time_utc: string | null; reused: boolean }> = [];
      const skipped: Array<{ slot: string; reason: string }> = [];

      for (const entry of payload.posts) {
        const slot = entry?.slot?.trim() ?? "";
        const text = entry?.text?.trim() ?? "";

        if (!parseHourMinute(slot)) {
          skipped.push({ slot, reason: "invalid_slot" });
          continue;
        }
        if (!text) {
          skipped.push({ slot, reason: "missing_text" });
          continue;
        }
        if (seenRequestSlots.has(slot)) {
          skipped.push({ slot, reason: "duplicate_slot_in_request" });
          continue;
        }
        seenRequestSlots.add(slot);

        if (occupiedSlots.has(slot)) {
          skipped.push({ slot, reason: "slot_already_scheduled" });
          continue;
        }

        const scheduled = await createScheduledPostForAppUser(
          env,
          "workspace-owner",
          configuredProfile.threads_user_id,
          text,
          targetDate,
          slot,
          timeZone,
        );

        if (!scheduled.success || !scheduled.scheduledPostId) {
          skipped.push({ slot, reason: scheduled.error ?? "schedule_failed" });
          continue;
        }

        occupiedSlots.add(slot);
        created.push({
          slot,
          scheduled_post_id: scheduled.scheduledPostId,
          scheduled_time_utc: scheduled.scheduledTimeUtc ?? null,
          reused: scheduled.reused === true,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          account: {
            id: configuredAccount.id,
            label: configuredAccount.label,
            username: configuredProfile.username ?? configuredAccount.username,
            threads_user_id: configuredProfile.threads_user_id,
          },
          date: targetDate,
          timezone: timeZone,
          created,
          skipped,
        }),
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
      await bootstrapConfiguredThreadsAccounts(env);

      const rows = await env.DB.prepare(
        `SELECT DISTINCT t.threads_user_id, t.access_token, t.expires_at
         FROM threads_accounts t
         LEFT JOIN app_threads_accounts a
           ON a.threads_user_id = t.threads_user_id
         LEFT JOIN users u
           ON u.id = a.app_user_id
         WHERE t.configured_account_id IS NOT NULL
            OR u.id IS NOT NULL`,
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
  await bootstrapConfiguredThreadsAccounts(env);

  const rows = await env.DB
    .prepare(
      `SELECT DISTINCT t.threads_user_id, t.access_token
       FROM threads_accounts t
       LEFT JOIN app_threads_accounts a
         ON a.threads_user_id = t.threads_user_id
       LEFT JOIN users u
         ON u.id = a.app_user_id
       WHERE t.expires_at <= ?
         AND (
           t.configured_account_id IS NOT NULL
           OR u.id IS NOT NULL
         )`,
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

  if (cron === THREADS_FOLLOWER_START_OF_DAY_CRON) {
    const scheduledTime = event.scheduledTime;
    if (!isFollowerStartOfDayRefreshWindow(scheduledTime)) {
      logWorkerEvent("THREADS_FOLLOWER_BASELINE_WINDOW_SKIPPED", {
        scheduled_time_ms: scheduledTime,
        target_time_zone: THREADS_INSIGHTS_TIME_ZONE,
        target_hour: THREADS_FOLLOWER_START_OF_DAY_HOUR,
        target_minute: THREADS_FOLLOWER_START_OF_DAY_MINUTE,
      });
      return;
    }

    logWorkerEvent("THREADS_FOLLOWER_BASELINE_REFRESH_STARTED", {
      scheduled_time_ms: scheduledTime,
      target_time_zone: THREADS_INSIGHTS_TIME_ZONE,
      target_hour: THREADS_FOLLOWER_START_OF_DAY_HOUR,
      target_minute: THREADS_FOLLOWER_START_OF_DAY_MINUTE,
    });
    await refreshFollowerBaselinesForConfiguredAccounts(env);
    return;
  }

  if (cron === THREADS_INSIGHTS_DAILY_WINDOW_CRON) {
    const scheduledTime = typeof event.scheduledTime === "number" ? event.scheduledTime : Date.now();
    if (!isDailyInsightsRefreshWindow(scheduledTime)) {
      logWorkerEvent("THREADS_DAILY_INSIGHTS_REFRESH_SKIPPED", {
        cron,
        scheduled_time: new Date(scheduledTime).toISOString(),
        target_time_zone: THREADS_INSIGHTS_TIME_ZONE,
      });
      return;
    }

    await refreshInsightsForConfiguredAccounts(env);
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
