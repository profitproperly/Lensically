import { enforceLimit, type EnforceLimitResult, type UsageFeature } from "./utils/enforceLimit";
import {
  buildTextSpoilerEntities,
  normalizeSpoilerPhrases,
  publishTextToThreads,
} from "./utils/threadsPublishService";
import {
  executeThreadsProfileLookup,
} from "./utils/threadsProfileLookupService";
import { requireAuth } from "../auth/requireAuth.js";
import { sanitizeForLog, sanitizeLogMessage } from "../auth/logSanitizer.js";
import { logAuthEvent, logWorkerOperationalEvent } from "../auth/operationalLog.js";

const DEFAULT_APP_URL = "https://app.lensically.com";
const DEFAULT_ROOT_SITE_URL = "https://lensically.com";
const DEFAULT_WORKER_ORIGIN = "https://api.lensically.com";
const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);
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
const SAVED_PATTERNS_APP_USER_ID = "lensically";
const WORKSPACE_IS_ADMIN = true;
const WORKSPACE_DEFAULT_TIMEZONE = "America/New_York";
const MAX_BATCH_SCHEDULE_PRESET_NAME_LENGTH = 80;
const MAX_BATCH_SCHEDULE_PRESET_COUNT = 50;
const MAX_BATCH_SCHEDULE_PRESET_SLOTS = 50;
const HERMES_DEFAULT_MODEL = "gpt-5.5";
const HERMES_MAX_POST_COUNT = 50;
const HERMES_CONTEXT_ARCHIVE_LIMIT = 48;
const HERMES_CONTEXT_PATTERN_LIMIT = 48;
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
  INTERNAL_API_KEY: string;
  LENSICALLY_GPT_API_KEY?: string;
  APP_URL?: string;
  ROOT_SITE_URL?: string;
  WORKER_ORIGIN?: string;
  WEB_APP_URL?: string;
  SCHEDULED_POST_BATCH_SIZE?: string;
  OPENAI_API_KEY?: string;
  HERMES_MODEL?: string;
  THREADS_TOKEN_MANIFEST_MENTAL?: string;
  THREADS_TOKEN_VECTRIX?: string;
  THREADS_TOKEN_DEADMAN?: string;
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

type AgentAccountControl = ConfiguredThreadsAccountProfile & {
  agent_enabled: boolean;
  agent_updated_at: string | null;
  agent_schedule_slots: string[];
  agent_content_brief: string | null;
};

type GptBrandKey = "manifest_mental" | "vectrix" | "opmg_deadman";

type GptStrategyMemoryKind =
  | "winner"
  | "loser"
  | "hook"
  | "pillar"
  | "voice_rule"
  | "experiment"
  | "scheduled_batch"
  | "result_note"
  | "rejection_feedback"
  | "rule_proposal"
  | "approved_rule"
  | "taste_profile"
  | "approved_pattern"
  | "rejected_pattern"
  | "current_belief"
  | "brand_voice_note"
  | "banned_phrase"
  | "cooldown"
  | "experiment_result"
  | "rule_review"
  | "saved_pattern_note"
  | "approval_feedback";

type GptStrategyMemoryRow = {
  id: number | string;
  account_id: string;
  threads_user_id: string;
  kind: string;
  title: string | null;
  body: string;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
};

type GptPostStrategyInput = {
  pillar: string | null;
  hook_style: string | null;
  format: string | null;
  intent: string | null;
  experiment: string | null;
  novelty_level: string | null;
  metadata_json: string | null;
};

type GptPostStrategyTagRow = {
  scheduled_post_id: number | string;
  account_id: string;
  threads_user_id: string;
  pillar: string | null;
  hook_style: string | null;
  format: string | null;
  intent: string | null;
  experiment: string | null;
  novelty_level: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
};

type GptGenerationRunRow = {
  id: string;
  account_id: string;
  threads_user_id: string;
  objective: string | null;
  prompt_summary: string | null;
  status: string;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
};

type GptGenerationDraftRow = {
  id: string;
  run_id: string;
  account_id: string;
  threads_user_id: string;
  draft_index: number | string;
  text: string;
  status: string;
  rejection_reason: string | null;
  score_json: string | null;
  strategy_json: string | null;
  replacement_for_draft_id: string | null;
  scheduled_post_id: number | string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
};

type GptResolvedBrand = {
  brand_key: GptBrandKey;
  account_id: string;
  configured_account: ResolvedConfiguredThreadsAccount;
  profile: ConfiguredThreadsAccountProfile;
};

const VECTRIX_AGENT_SCHEDULE_SLOTS = Array.from(
  { length: 24 },
  (_, hour) => `${hour.toString().padStart(2, "0")}:00`,
);

const VECTRIX_AGENT_CONTENT_BRIEF = [
  "Create posts for Vectrix about making money online, building wealth, becoming financially free,",
  "digital leverage, online business systems, monetizable skills, disciplined investing, and long-term cash-flow thinking.",
  "Keep the angle practical, specific, and operator-minded. Avoid fake income claims, guaranteed results, scams,",
  "or financial advice that tells readers exactly what asset to buy.",
].join(" ");

const DEFAULT_AGENT_ACCOUNT_CONFIGS: Record<string, { enabled: boolean; scheduleSlots: string[]; contentBrief: string }> = {
  vectrix: {
    enabled: true,
    scheduleSlots: VECTRIX_AGENT_SCHEDULE_SLOTS,
    contentBrief: VECTRIX_AGENT_CONTENT_BRIEF,
  },
};

type ExternalPatternRow = {
  id: number;
  app_user_id: string;
  account_id: string;
  platform: string;
  source_url: string;
  post_id: string | null;
  author_handle: string | null;
  author_display_name: string | null;
  post_text: string;
  likes: number;
  replies: number;
  reposts: number;
  shares: number;
  views: number | null;
  posted_at: string | null;
  capture_confidence: string;
  raw_payload: string | null;
  saved_at: string;
  updated_at: string;
};

const CONFIGURED_THREADS_ACCOUNTS: ConfiguredThreadsAccount[] = [
  {
    id: "manifest-mental",
    label: "Manifest Mental",
    username: "manifestmental",
    tokenEnv: "THREADS_TOKEN_MANIFEST_MENTAL",
  },
  {
    id: "vectrix",
    label: "Vectrix",
    username: "vectrixvoltmore",
    tokenEnv: "THREADS_TOKEN_VECTRIX",
  },
  {
    id: "deadman",
    label: "Deadman",
    username: "opmgdeadman",
    tokenEnv: "THREADS_TOKEN_DEADMAN",
  },
];

const GPT_BRAND_ACCOUNT_ALIASES: Record<GptBrandKey, string> = {
  manifest_mental: "manifest-mental",
  vectrix: "vectrix",
  opmg_deadman: "deadman",
};

const GPT_STRATEGY_MEMORY_KINDS = new Set<string>([
  "winner",
  "loser",
  "hook",
  "pillar",
  "voice_rule",
  "experiment",
  "scheduled_batch",
  "result_note",
  "rejection_feedback",
  "rule_proposal",
  "approved_rule",
  "taste_profile",
  "approved_pattern",
  "rejected_pattern",
  "current_belief",
  "brand_voice_note",
  "banned_phrase",
  "cooldown",
  "experiment_result",
  "rule_review",
  "saved_pattern_note",
  "approval_feedback",
]);

const DEFAULT_PATTERNS_ACCOUNT_ID = "manifest-mental";

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

async function ensureAgentAccountControlsTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS agent_account_controls (
      account_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      schedule_slots_json TEXT,
      content_brief TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ).run();

  const tableInfo = await env.DB.prepare("PRAGMA table_info(agent_account_controls)").all<{
    name: string;
  }>();
  const columnNames = new Set((tableInfo.results ?? []).map((column) => column.name));
  const missingColumns: Array<{ name: string; definition: string }> = [
    { name: "schedule_slots_json", definition: "TEXT" },
    { name: "content_brief", definition: "TEXT" },
  ].filter((column) => !columnNames.has(column.name));

  for (const column of missingColumns) {
    await env.DB.prepare(`ALTER TABLE agent_account_controls ADD COLUMN ${column.name} ${column.definition}`).run();
  }
}

function parseAgentScheduleSlots(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return normalizeBatchSchedulePresetTimes(parsed) ?? [];
  } catch {
    return [];
  }
}

function getDefaultAgentAccountConfig(accountId: string): { scheduleSlots: string[]; contentBrief: string | null } {
  const config = DEFAULT_AGENT_ACCOUNT_CONFIGS[accountId];
  return {
    scheduleSlots: config?.scheduleSlots ?? [],
    contentBrief: config?.contentBrief ?? null,
  };
}

async function seedDefaultAgentAccountConfigs(env: Env): Promise<void> {
  await ensureAgentAccountControlsTable(env);
  for (const [accountId, config] of Object.entries(DEFAULT_AGENT_ACCOUNT_CONFIGS)) {
    await env.DB.prepare(
      `INSERT INTO agent_account_controls (account_id, enabled, schedule_slots_json, content_brief, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(account_id) DO UPDATE SET
         enabled = CASE
           WHEN agent_account_controls.updated_at IS NULL THEN excluded.enabled
           ELSE agent_account_controls.enabled
         END,
         schedule_slots_json = COALESCE(agent_account_controls.schedule_slots_json, excluded.schedule_slots_json),
         content_brief = COALESCE(agent_account_controls.content_brief, excluded.content_brief)`,
    ).bind(accountId, config.enabled ? 1 : 0, JSON.stringify(config.scheduleSlots), config.contentBrief).run();
  }
}

async function listAgentAccountControls(env: Env): Promise<AgentAccountControl[]> {
  await seedDefaultAgentAccountConfigs(env);
  const [profiles, settings] = await Promise.all([
    getConfiguredThreadsProfiles(env),
    env.DB.prepare(
      `SELECT account_id, enabled, schedule_slots_json, content_brief, updated_at
       FROM agent_account_controls`,
    ).all<{
      account_id: string;
      enabled: number | string | null;
      schedule_slots_json: string | null;
      content_brief: string | null;
      updated_at: string | null;
    }>(),
  ]);

  const settingsByAccountId = new Map(
    (settings.results ?? []).map((setting) => [setting.account_id, setting]),
  );

  return profiles.map((profile) => {
    const setting = settingsByAccountId.get(profile.account_id);
    const defaultConfig = getDefaultAgentAccountConfig(profile.account_id);
    const scheduleSlots = parseAgentScheduleSlots(setting?.schedule_slots_json) ?? [];
    return {
      ...profile,
      agent_enabled: Number(setting?.enabled ?? 0) === 1,
      agent_updated_at: setting?.updated_at ?? null,
      agent_schedule_slots: scheduleSlots.length ? scheduleSlots : defaultConfig.scheduleSlots,
      agent_content_brief: setting?.content_brief ?? defaultConfig.contentBrief,
    };
  });
}

async function setAgentAccountEnabled(
  env: Env,
  accountId: string,
  enabled: boolean,
): Promise<AgentAccountControl | null> {
  const normalizedAccountId = accountId.trim().toLowerCase();
  if (!normalizedAccountId) {
    return null;
  }

  const configuredAccount = await getConfiguredThreadsAccountById(env, normalizedAccountId);
  if (!configuredAccount) {
    return null;
  }

  await ensureAgentAccountControlsTable(env);
  await env.DB.prepare(
    `INSERT INTO agent_account_controls (account_id, enabled, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(account_id) DO UPDATE SET
       enabled = excluded.enabled,
       updated_at = excluded.updated_at`,
  ).bind(normalizedAccountId, enabled ? 1 : 0).run();

  const controls = await listAgentAccountControls(env);
  return controls.find((control) => control.account_id === normalizedAccountId) ?? null;
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

function isThreadsPageOrigin(origin: string | null | undefined): boolean {
  const normalizedOrigin = normalizeAppBaseUrl(origin);
  if (!normalizedOrigin) {
    return false;
  }

  const hostname = parseUrl(normalizedOrigin)?.hostname?.toLowerCase() ?? "";
  return hostname === "www.threads.com" || hostname === "threads.com" || hostname === "threads.net";
}

function isBrowserExtensionOrigin(origin: string | null | undefined): boolean {
  if (!origin) {
    return false;
  }
  return origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://");
}

function getPatternsCorsOrigin(request: Request, env: Env): string {
  const requestOrigin = request.headers.get("origin");
  if (isBrowserExtensionOrigin(requestOrigin)) {
    return String(requestOrigin);
  }
  if (isThreadsPageOrigin(requestOrigin)) {
    return normalizeAppBaseUrl(requestOrigin) ?? getConfiguredAppBaseUrl(env);
  }
  return getAuthCorsOrigin(request, env);
}

function getCorsHeadersForRequest(request: Request, env: Env, path?: string): Record<string, string> {
  const normalizedPath = path && path !== "/" ? path.replace(/\/+$/, "") : path ?? "";
  const corsOrigin = normalizedPath.startsWith("/api/patterns/")
    ? getPatternsCorsOrigin(request, env)
    : getAuthCorsOrigin(request, env);
  return {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
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
  spoiler_all_text: number | null;
  spoiler_phrases_json: string | null;
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
  spoilerFingerprint: string = "none",
): Promise<string> {
  return sha256Hex(`schedule|${appUserId}|${threadsUserId}|${scheduledUtc}|${text}|${spoilerFingerprint}`);
}

async function buildImmediatePublishRequestHash(
  appUserId: string,
  threadsUserId: string,
  text: string,
  spoilerFingerprint: string = "none",
): Promise<string> {
  return sha256Hex(`post-now|${appUserId}|${threadsUserId}|${text}|${spoilerFingerprint}`);
}

function normalizeSpoilerFlag(value: unknown): boolean {
  return value === true;
}

function normalizeSpoilerPhrasesInput(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return normalizeSpoilerPhrases(value.filter((item): item is string => typeof item === "string"));
}

function parseSpoilerPhrasesJson(value: string | null | undefined): string[] {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return [];
  }

  try {
    return normalizeSpoilerPhrasesInput(JSON.parse(trimmed));
  } catch {
    return [];
  }
}

function serializeSpoilerPhrases(phrases: string[]): string | null {
  return phrases.length ? JSON.stringify(phrases) : null;
}

function buildSpoilerFingerprint(spoilerAllText: boolean, spoilerPhrases: string[]): string {
  return JSON.stringify({
    spoiler_all_text: spoilerAllText,
    spoiler_phrases: spoilerPhrases,
  });
}

function validateTextSpoilerConfig(
  text: string,
  spoilerAllText: boolean,
  spoilerPhrases: string[],
): string | null {
  const result = buildTextSpoilerEntities(text, {
    spoilerAllText,
    spoilerPhrases,
  });
  return result.error ?? null;
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
    `SELECT id, user_id, threads_user_id, post_text, spoiler_all_text, spoiler_phrases_json
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
  spoilerAllText: boolean = false,
  spoilerPhrases: string[] = [],
): Promise<AppUserThreadsPublishResult> {
  const account = await getThreadsAccountForAppUser(env, appUserId, threadsUserId);
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
      spoilerAllText,
      spoilerPhrases,
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
    post.spoiler_all_text === 1,
    parseSpoilerPhrasesJson(post.spoiler_phrases_json),
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
  const corsHeaders = getCorsHeadersForRequest(request, env, normalizedPath);
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

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function isGptRequestAuthorized(request: Request, env: Env): boolean {
  const configuredKey = env.LENSICALLY_GPT_API_KEY?.trim() || "";
  const providedKey = getBearerToken(request);
  return Boolean(configuredKey && providedKey && providedKey === configuredKey);
}

function unauthorizedGptResponse(): Response {
  return new Response(
    JSON.stringify({ success: false, error: "Unauthorized" }),
    { status: 401, headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}

function normalizeGptBrandKey(value: unknown): GptBrandKey | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "manifest_mental" || normalized === "vectrix" || normalized === "opmg_deadman") {
    return normalized;
  }
  if (normalized === "deadman" || normalized === "opmgdeadman" || normalized === "opmg") {
    return "opmg_deadman";
  }
  if (normalized === "manifestmental") {
    return "manifest_mental";
  }
  if (normalized === "vectrixvoltmore") {
    return "vectrix";
  }
  return null;
}

function gptBrandKeyForAccountId(accountId: string): GptBrandKey | null {
  for (const [brandKey, configuredAccountId] of Object.entries(GPT_BRAND_ACCOUNT_ALIASES)) {
    if (configuredAccountId === accountId) {
      return brandKey as GptBrandKey;
    }
  }
  return null;
}

async function resolveGptBrand(env: Env, rawBrandKey: unknown): Promise<GptResolvedBrand | null> {
  const brandKey = normalizeGptBrandKey(rawBrandKey);
  if (!brandKey) {
    return null;
  }

  const accountId = GPT_BRAND_ACCOUNT_ALIASES[brandKey];
  const configuredAccount = await getConfiguredThreadsAccountById(env, accountId);
  if (!configuredAccount) {
    return null;
  }

  const profile = await fetchConfiguredThreadsProfile(env, configuredAccount, 0);
  return {
    brand_key: brandKey,
    account_id: accountId,
    configured_account: configuredAccount,
    profile,
  };
}

async function resolveGptBrandForThreadsUserId(
  env: Env,
  rawThreadsUserId: unknown,
): Promise<GptResolvedBrand | null> {
  const threadsUserId = typeof rawThreadsUserId === "string" ? rawThreadsUserId.trim() : "";
  const profiles = await getConfiguredThreadsProfiles(env);
  const profile = profiles.find((account) => threadsUserId && account.threads_user_id === threadsUserId)
    ?? profiles.find((account) => account.is_active)
    ?? profiles[0]
    ?? null;
  if (!profile) {
    return null;
  }
  const brandKey = gptBrandKeyForAccountId(profile.account_id);
  if (!brandKey) {
    return null;
  }
  return resolveGptBrand(env, brandKey);
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
  const isAuthPath =
    normalizedPath.startsWith("/api/batch-schedule/")
    || normalizedPath.startsWith("/auth/threads/");

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
      spoiler_all_text INTEGER NOT NULL DEFAULT 0,
      spoiler_phrases_json TEXT,
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
    { name: "spoiler_all_text", definition: "INTEGER NOT NULL DEFAULT 0" },
    { name: "spoiler_phrases_json", definition: "TEXT" },
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
      threads_user_id TEXT,
      name TEXT NOT NULL,
      times_json TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  ).run();

  const columnResult = await env.DB.prepare("PRAGMA table_info(batch_schedule_presets)").all<{ name?: string }>();
  const columnNames = new Set(
    (columnResult.results ?? [])
      .map((row) => (typeof row?.name === "string" ? row.name : ""))
      .filter(Boolean),
  );
  if (!columnNames.has("threads_user_id")) {
    await env.DB.prepare("ALTER TABLE batch_schedule_presets ADD COLUMN threads_user_id TEXT").run();
  }

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_batch_schedule_presets_user_id
     ON batch_schedule_presets (user_id, is_favorite DESC, updated_at DESC)`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_batch_schedule_presets_user_threads
     ON batch_schedule_presets (user_id, threads_user_id, is_favorite DESC, updated_at DESC)`,
  ).run();

  await env.DB.prepare("DROP INDEX IF EXISTS idx_batch_schedule_presets_favorite_per_user").run();

  await env.DB.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_schedule_presets_favorite_per_user_threads
     ON batch_schedule_presets (user_id, threads_user_id)
     WHERE is_favorite = 1 AND threads_user_id IS NOT NULL`,
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
  threadsUserId: string,
): Promise<Array<{ id: string; threads_user_id: string; name: string; times: string[]; is_favorite: boolean; created_at: string; updated_at: string }>> {
  await ensureBatchSchedulePresetsTable(env);
  const rows = await env.DB.prepare(
    `SELECT id, threads_user_id, name, times_json, is_favorite, created_at, updated_at
     FROM batch_schedule_presets
     WHERE user_id = ?
       AND threads_user_id = ?
     ORDER BY is_favorite DESC, updated_at DESC, created_at DESC, id DESC`,
  )
    .bind(userId, threadsUserId)
    .all<{
      id: string;
      threads_user_id: string;
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
      threads_user_id: row.threads_user_id,
      name: row.name,
      times: normalizedTimes,
      is_favorite: Number(row.is_favorite) === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
}

function pickPreferredBatchSchedulePreset(
  presets: Array<{ id: string; threads_user_id: string; name: string; times: string[]; is_favorite: boolean; created_at: string; updated_at: string }>,
): { id: string; threads_user_id: string; name: string; times: string[]; is_favorite: boolean; created_at: string; updated_at: string } | null {
  if (!Array.isArray(presets) || presets.length === 0) {
    return null;
  }

  return presets.find((preset) => preset.is_favorite) ?? presets[0] ?? null;
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

type HydratedThreadsPost = CachedThreadsPost & {
  metrics_loaded: boolean;
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

async function getThreadsAccountForAppUser(
  env: Env,
  appUserId: string,
  requestedThreadsUserId: string | null = null,
): Promise<ThreadsAccount | null> {
  logWorkerEvent("THREADS_ACCOUNT_LOOKUP", {
    appUserId,
    requestedThreadsUserId,
  });
  const configuredAccounts = await Promise.all(
    getConfiguredThreadsAccountDefinitions(env).map((account) => resolveConfiguredThreadsAccount(env, account)),
  );
  const resolvedConfiguredAccounts = configuredAccounts.filter(
    (account): account is ResolvedConfiguredThreadsAccount => account !== null,
  );

  if (resolvedConfiguredAccounts.length > 0) {
    for (let index = 0; index < resolvedConfiguredAccounts.length; index += 1) {
      const configuredAccount = resolvedConfiguredAccounts[index];
      const profile = await fetchConfiguredThreadsProfile(env, configuredAccount, index);
      if (!requestedThreadsUserId || profile.threads_user_id === requestedThreadsUserId) {
        return {
          threads_user_id: profile.threads_user_id,
          access_token: configuredAccount.accessToken,
        };
      }
    }

    return null;
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

  let latestPosts = await fetchThreadsPostsPageWithInsights(env, account.access_token, account.threads_user_id, null);
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
    ? followerTrend.reduce((best, entry) => (
      entry.gain > best.gain
      || (entry.gain === best.gain && String(entry.date ?? "") > String(best.date ?? ""))
        ? entry
        : best
    ), followerTrend[0])
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

async function ensureExternalPatternsTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS external_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_user_id TEXT NOT NULL,
      account_id TEXT NOT NULL DEFAULT 'manifest-mental',
      platform TEXT NOT NULL DEFAULT 'threads',
      source_url TEXT NOT NULL,
      post_id TEXT,
      author_handle TEXT,
      author_display_name TEXT,
      post_text TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      replies INTEGER NOT NULL DEFAULT 0,
      reposts INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      views INTEGER,
      posted_at TEXT,
      capture_confidence TEXT NOT NULL DEFAULT 'medium',
      raw_payload TEXT,
      saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(app_user_id, account_id, source_url)
    )`,
  ).run();

  const tableInfo = await env.DB.prepare("PRAGMA table_info(external_patterns)").all<{ name: string }>();
  const hasAccountId = (tableInfo.results ?? []).some((column) => column.name === "account_id");
  if (!hasAccountId) {
    await env.DB.prepare(
      `ALTER TABLE external_patterns
       ADD COLUMN account_id TEXT NOT NULL DEFAULT 'manifest-mental'`,
    ).run();
  }

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_external_patterns_user_updated
     ON external_patterns (app_user_id, account_id, updated_at DESC, id DESC)`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_external_patterns_user_likes
     ON external_patterns (app_user_id, account_id, likes DESC, views DESC, updated_at DESC, id DESC)`,
  ).run();

  await env.DB.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_external_patterns_user_account_source
     ON external_patterns (app_user_id, account_id, source_url)`,
  ).run();
}

async function ensureGptStrategyMemoryTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS gpt_strategy_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      threads_user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT,
      body TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_gpt_strategy_memory_account_kind_updated
     ON gpt_strategy_memory (account_id, kind, updated_at DESC, id DESC)`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_gpt_strategy_memory_threads_updated
     ON gpt_strategy_memory (threads_user_id, updated_at DESC, id DESC)`,
  ).run();

  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_gpt_strategy_memory_touch_updated_at
     AFTER UPDATE ON gpt_strategy_memory
     FOR EACH ROW
     WHEN NEW.updated_at = OLD.updated_at
     BEGIN
       UPDATE gpt_strategy_memory
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = NEW.id;
     END`,
  ).run();
}

function normalizeGptStrategyMemoryKind(value: unknown): GptStrategyMemoryKind | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return GPT_STRATEGY_MEMORY_KINDS.has(normalized)
    ? normalized as GptStrategyMemoryKind
    : null;
}

function normalizeGptMemoryText(value: unknown, maxLength: number, allowEmpty = false): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!allowEmpty && !trimmed) {
    return null;
  }
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function normalizeGptMemoryMetadata(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 20000 ? serialized.slice(0, 20000) : serialized;
  } catch {
    return null;
  }
}

function normalizeGptStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => normalizeGptMemoryText(item, maxLength, true))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function normalizeGptRecordArray(value: unknown, maxItems: number): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .slice(0, maxItems);
}

function serializeGptStrategyMemoryRow(row: GptStrategyMemoryRow): {
  id: number;
  account_id: string;
  threads_user_id: string;
  kind: string;
  title: string | null;
  body: string;
  metadata: unknown;
  created_at: string;
  updated_at: string;
} {
  return {
    id: Number(row.id),
    account_id: row.account_id,
    threads_user_id: row.threads_user_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    metadata: row.metadata_json ? safeParseJsonString(row.metadata_json) ?? null : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getGptMemoryMetadataRecord(memory: ReturnType<typeof serializeGptStrategyMemoryRow>): Record<string, unknown> {
  return memory.metadata && typeof memory.metadata === "object" && !Array.isArray(memory.metadata)
    ? memory.metadata as Record<string, unknown>
    : {};
}

async function listGptStrategyMemory(
  env: Env,
  accountId: string,
  kinds: string[],
  limit: number,
  offset = 0,
): Promise<ReturnType<typeof serializeGptStrategyMemoryRow>[]> {
  await ensureGptStrategyMemoryTable(env);

  const normalizedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const normalizedOffset = Math.max(Math.trunc(offset), 0);
  const normalizedKinds = kinds
    .map((kind) => normalizeGptStrategyMemoryKind(kind))
    .filter((kind): kind is GptStrategyMemoryKind => Boolean(kind));
  const kindClause = normalizedKinds.length
    ? `AND kind IN (${normalizedKinds.map(() => "?").join(", ")})`
    : "";
  const rows = await env.DB.prepare(
    `SELECT id, account_id, threads_user_id, kind, title, body, metadata_json, created_at, updated_at
     FROM gpt_strategy_memory
     WHERE account_id = ?
       ${kindClause}
     ORDER BY datetime(updated_at) DESC, id DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(accountId, ...normalizedKinds, normalizedLimit, normalizedOffset)
    .all<GptStrategyMemoryRow>();

  return (rows.results ?? []).map(serializeGptStrategyMemoryRow);
}

async function countGptStrategyMemory(env: Env, accountId: string, kinds: string[]): Promise<number> {
  await ensureGptStrategyMemoryTable(env);

  const normalizedKinds = kinds
    .map((kind) => normalizeGptStrategyMemoryKind(kind))
    .filter((kind): kind is GptStrategyMemoryKind => Boolean(kind));
  const kindClause = normalizedKinds.length
    ? `AND kind IN (${normalizedKinds.map(() => "?").join(", ")})`
    : "";
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM gpt_strategy_memory
     WHERE account_id = ?
       ${kindClause}`,
  )
    .bind(accountId, ...normalizedKinds)
    .first<{ total: number }>();

  return Number(row?.total ?? 0);
}

async function saveGptStrategyMemory(
  env: Env,
  input: {
    accountId: string;
    threadsUserId: string;
    kind: GptStrategyMemoryKind;
    title: string | null;
    body: string;
    metadataJson: string | null;
  },
): Promise<ReturnType<typeof serializeGptStrategyMemoryRow> | null> {
  await ensureGptStrategyMemoryTable(env);
  const insert = await env.DB.prepare(
    `INSERT INTO gpt_strategy_memory (
      account_id,
      threads_user_id,
      kind,
      title,
      body,
      metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.accountId,
      input.threadsUserId,
      input.kind,
      input.title,
      input.body,
      input.metadataJson,
    )
    .run();

  const insertedId = Number(insert.meta?.last_row_id ?? 0);
  if (!insertedId) {
    return null;
  }

  const row = await env.DB.prepare(
    `SELECT id, account_id, threads_user_id, kind, title, body, metadata_json, created_at, updated_at
     FROM gpt_strategy_memory
     WHERE id = ?
     LIMIT 1`,
  )
    .bind(insertedId)
    .first<GptStrategyMemoryRow>();

  return row ? serializeGptStrategyMemoryRow(row) : null;
}

async function ensureGptPostStrategyTagsTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS gpt_post_strategy_tags (
      scheduled_post_id INTEGER PRIMARY KEY,
      account_id TEXT NOT NULL,
      threads_user_id TEXT NOT NULL,
      pillar TEXT,
      hook_style TEXT,
      format TEXT,
      intent TEXT,
      experiment TEXT,
      novelty_level TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (scheduled_post_id) REFERENCES scheduled_posts(id) ON DELETE CASCADE
    )`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_gpt_post_strategy_tags_account_updated
     ON gpt_post_strategy_tags (account_id, updated_at DESC, scheduled_post_id DESC)`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_gpt_post_strategy_tags_threads
     ON gpt_post_strategy_tags (threads_user_id, pillar, hook_style, format, intent)`,
  ).run();

  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_gpt_post_strategy_tags_touch_updated_at
     AFTER UPDATE ON gpt_post_strategy_tags
     FOR EACH ROW
     WHEN NEW.updated_at = OLD.updated_at
     BEGIN
       UPDATE gpt_post_strategy_tags
       SET updated_at = CURRENT_TIMESTAMP
       WHERE scheduled_post_id = NEW.scheduled_post_id;
     END`,
  ).run();
}

function normalizeGptStrategyToken(value: unknown, maxLength = 100): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_ -]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) {
    return null;
  }
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function parseGptFieldsParam(value: string | null): Set<string> | null {
  if (!value?.trim()) {
    return null;
  }
  const fields = value
    .split(",")
    .map((field) => field.trim().toLowerCase())
    .filter(Boolean);
  return fields.length ? new Set(fields) : null;
}

function wantsGptField(fields: Set<string> | null, field: string): boolean {
  return fields === null || fields.has(field);
}

function parseBoundedIntegerParam(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function normalizeGptPostStrategyInput(value: unknown): GptPostStrategyInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const strategy = {
    pillar: normalizeGptStrategyToken(record.pillar),
    hook_style: normalizeGptStrategyToken(record.hook_style),
    format: normalizeGptStrategyToken(record.format),
    intent: normalizeGptStrategyToken(record.intent),
    experiment: normalizeGptStrategyToken(record.experiment),
    novelty_level: normalizeGptStrategyToken(record.novelty_level),
    metadata_json: normalizeGptMemoryMetadata(record.metadata),
  };
  return Object.values(strategy).some((entry) => entry !== null) ? strategy : null;
}

function serializeGptPostStrategyTag(row: GptPostStrategyTagRow): {
  scheduled_post_id: number;
  account_id: string;
  threads_user_id: string;
  pillar: string | null;
  hook_style: string | null;
  format: string | null;
  intent: string | null;
  experiment: string | null;
  novelty_level: string | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
} {
  return {
    scheduled_post_id: Number(row.scheduled_post_id),
    account_id: row.account_id,
    threads_user_id: row.threads_user_id,
    pillar: row.pillar,
    hook_style: row.hook_style,
    format: row.format,
    intent: row.intent,
    experiment: row.experiment,
    novelty_level: row.novelty_level,
    metadata: row.metadata_json ? safeParseJsonString(row.metadata_json) ?? null : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function upsertGptPostStrategyTag(
  env: Env,
  input: {
    scheduledPostId: number;
    accountId: string;
    threadsUserId: string;
    strategy: GptPostStrategyInput | null;
  },
): Promise<void> {
  if (!input.strategy || !Number.isInteger(input.scheduledPostId) || input.scheduledPostId <= 0) {
    return;
  }
  await ensureGptPostStrategyTagsTable(env);
  await env.DB.prepare(
    `INSERT INTO gpt_post_strategy_tags (
      scheduled_post_id,
      account_id,
      threads_user_id,
      pillar,
      hook_style,
      format,
      intent,
      experiment,
      novelty_level,
      metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(scheduled_post_id) DO UPDATE SET
      account_id = excluded.account_id,
      threads_user_id = excluded.threads_user_id,
      pillar = excluded.pillar,
      hook_style = excluded.hook_style,
      format = excluded.format,
      intent = excluded.intent,
      experiment = excluded.experiment,
      novelty_level = excluded.novelty_level,
      metadata_json = excluded.metadata_json`,
  )
    .bind(
      input.scheduledPostId,
      input.accountId,
      input.threadsUserId,
      input.strategy.pillar,
      input.strategy.hook_style,
      input.strategy.format,
      input.strategy.intent,
      input.strategy.experiment,
      input.strategy.novelty_level,
      input.strategy.metadata_json,
    )
    .run();
}

async function listGptPostStrategyTagsForScheduledPosts(
  env: Env,
  scheduledPostIds: number[],
): Promise<Map<number, ReturnType<typeof serializeGptPostStrategyTag>>> {
  const normalizedIds = Array.from(new Set(scheduledPostIds.filter((id) => Number.isInteger(id) && id > 0)));
  const result = new Map<number, ReturnType<typeof serializeGptPostStrategyTag>>();
  if (!normalizedIds.length || !(await doesTableExist(env, "gpt_post_strategy_tags"))) {
    return result;
  }
  const placeholders = normalizedIds.map(() => "?").join(", ");
  const rows = await env.DB.prepare(
    `SELECT scheduled_post_id, account_id, threads_user_id, pillar, hook_style, format, intent,
            experiment, novelty_level, metadata_json, created_at, updated_at
     FROM gpt_post_strategy_tags
     WHERE scheduled_post_id IN (${placeholders})`,
  )
    .bind(...normalizedIds)
    .all<GptPostStrategyTagRow>();
  for (const row of rows.results ?? []) {
    const serialized = serializeGptPostStrategyTag(row);
    result.set(serialized.scheduled_post_id, serialized);
  }
  return result;
}

function calculateMedian(values: number[]): number {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (!sorted.length) {
    return 0;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (!sorted.length) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return sorted[index];
}

function summarizeTagUsage(
  tags: Array<ReturnType<typeof serializeGptPostStrategyTag>>,
  field: "pillar" | "hook_style" | "format" | "intent" | "experiment" | "novelty_level",
): Array<{ key: string; used: number; fatigue_risk: "low" | "medium" | "high" }> {
  const counts = new Map<string, number>();
  for (const tag of tags) {
    const key = tag[field];
    if (!key) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key, used]) => ({
      key,
      used,
      fatigue_risk: used >= 5 ? "high" : used >= 3 ? "medium" : "low",
    }));
}

async function ensureGptGenerationRunsTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS gpt_generation_runs (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      threads_user_id TEXT NOT NULL,
      objective TEXT,
      prompt_summary TEXT,
      status TEXT NOT NULL DEFAULT 'drafted',
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_gpt_generation_runs_account_updated
     ON gpt_generation_runs (account_id, updated_at DESC, created_at DESC)`,
  ).run();

  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_gpt_generation_runs_touch_updated_at
     AFTER UPDATE ON gpt_generation_runs
     FOR EACH ROW
     WHEN NEW.updated_at = OLD.updated_at
     BEGIN
       UPDATE gpt_generation_runs
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = NEW.id;
     END`,
  ).run();
}

async function ensureGptGenerationDraftsTable(env: Env): Promise<void> {
  await ensureGptGenerationRunsTable(env);
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS gpt_generation_drafts (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      threads_user_id TEXT NOT NULL,
      draft_index INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'drafted',
      rejection_reason TEXT,
      score_json TEXT,
      strategy_json TEXT,
      replacement_for_draft_id TEXT,
      scheduled_post_id INTEGER,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES gpt_generation_runs(id) ON DELETE CASCADE
    )`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_gpt_generation_drafts_run_index
     ON gpt_generation_drafts (run_id, draft_index ASC, created_at ASC)`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_gpt_generation_drafts_account_status
     ON gpt_generation_drafts (account_id, status, updated_at DESC)`,
  ).run();

  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_gpt_generation_drafts_touch_updated_at
     AFTER UPDATE ON gpt_generation_drafts
     FOR EACH ROW
     WHEN NEW.updated_at = OLD.updated_at
     BEGIN
       UPDATE gpt_generation_drafts
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = NEW.id;
     END`,
  ).run();
}

function normalizeGptGenerationStatus(value: unknown): string {
  if (typeof value !== "string") {
    return "drafted";
  }
  const normalized = value.trim().toLowerCase();
  return [
    "drafted",
    "self_rejected",
    "shown",
    "approved",
    "rejected",
    "rewritten",
    "scheduled",
    "completed",
  ].includes(normalized) ? normalized : "drafted";
}

function normalizeGptDraftScore(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const key of [
    "hook_strength",
    "specificity",
    "repeat_risk",
    "brand_fit",
    "follower_growth_intent",
    "shareability",
    "engagement_floor_likelihood",
    "overall",
  ]) {
    const numeric = Number(record[key]);
    if (Number.isFinite(numeric)) {
      normalized[key] = Math.min(Math.max(Math.round(numeric), 0), 10);
    }
  }
  if (typeof record.notes === "string" && record.notes.trim()) {
    normalized.notes = record.notes.trim().slice(0, 1000);
  }
  return Object.keys(normalized).length ? normalizeGptMemoryMetadata(normalized) : null;
}

function serializeGptGenerationRun(row: GptGenerationRunRow): {
  id: string;
  account_id: string;
  threads_user_id: string;
  objective: string | null;
  prompt_summary: string | null;
  status: string;
  metadata: unknown;
  created_at: string;
  updated_at: string;
} {
  return {
    id: row.id,
    account_id: row.account_id,
    threads_user_id: row.threads_user_id,
    objective: row.objective,
    prompt_summary: row.prompt_summary,
    status: row.status,
    metadata: row.metadata_json ? safeParseJsonString(row.metadata_json) ?? null : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeGptGenerationDraft(row: GptGenerationDraftRow): {
  id: string;
  run_id: string;
  account_id: string;
  threads_user_id: string;
  draft_index: number;
  text: string;
  status: string;
  rejection_reason: string | null;
  score: unknown;
  strategy: unknown;
  replacement_for_draft_id: string | null;
  scheduled_post_id: number | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
} {
  return {
    id: row.id,
    run_id: row.run_id,
    account_id: row.account_id,
    threads_user_id: row.threads_user_id,
    draft_index: Number(row.draft_index ?? 0),
    text: row.text,
    status: row.status,
    rejection_reason: row.rejection_reason,
    score: row.score_json ? safeParseJsonString(row.score_json) ?? null : null,
    strategy: row.strategy_json ? safeParseJsonString(row.strategy_json) ?? null : null,
    replacement_for_draft_id: row.replacement_for_draft_id,
    scheduled_post_id: row.scheduled_post_id === null || row.scheduled_post_id === undefined
      ? null
      : Number(row.scheduled_post_id),
    metadata: row.metadata_json ? safeParseJsonString(row.metadata_json) ?? null : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createGptGenerationRun(
  env: Env,
  input: {
    accountId: string;
    threadsUserId: string;
    objective: string | null;
    promptSummary: string | null;
    metadataJson: string | null;
  },
): Promise<ReturnType<typeof serializeGptGenerationRun>> {
  await ensureGptGenerationRunsTable(env);
  const runId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO gpt_generation_runs (
      id,
      account_id,
      threads_user_id,
      objective,
      prompt_summary,
      status,
      metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      runId,
      input.accountId,
      input.threadsUserId,
      input.objective,
      input.promptSummary,
      "drafted",
      input.metadataJson,
    )
    .run();

  const row = await env.DB.prepare(
    `SELECT id, account_id, threads_user_id, objective, prompt_summary, status, metadata_json, created_at, updated_at
     FROM gpt_generation_runs
     WHERE id = ?
     LIMIT 1`,
  )
    .bind(runId)
    .first<GptGenerationRunRow>();

  if (!row) {
    throw new Error("generation_run_create_failed");
  }
  return serializeGptGenerationRun(row);
}

async function addGptGenerationDrafts(
  env: Env,
  input: {
    runId: string;
    accountId: string;
    threadsUserId: string;
    drafts: Array<Record<string, unknown>>;
  },
): Promise<Array<ReturnType<typeof serializeGptGenerationDraft>>> {
  await ensureGptGenerationDraftsTable(env);
  const saved: Array<ReturnType<typeof serializeGptGenerationDraft>> = [];
  for (let index = 0; index < input.drafts.length; index += 1) {
    const draft = input.drafts[index];
    const text = normalizeGptMemoryText(draft.text, 20000);
    if (!text) {
      continue;
    }
    const draftId = crypto.randomUUID();
    const draftIndex = Number.isFinite(Number(draft.draft_index))
      ? Math.max(0, Math.trunc(Number(draft.draft_index)))
      : index + 1;
    const status = normalizeGptGenerationStatus(draft.status);
    const strategy = normalizeGptPostStrategyInput(draft.strategy);
    const replacementForDraftId = typeof draft.replacement_for_draft_id === "string"
      ? draft.replacement_for_draft_id.trim() || null
      : null;
    await env.DB.prepare(
      `INSERT INTO gpt_generation_drafts (
        id,
        run_id,
        account_id,
        threads_user_id,
        draft_index,
        text,
        status,
        rejection_reason,
        score_json,
        strategy_json,
        replacement_for_draft_id,
        metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        draftId,
        input.runId,
        input.accountId,
        input.threadsUserId,
        draftIndex,
        text,
        status,
        normalizeGptMemoryText(draft.rejection_reason, 1000, true),
        normalizeGptDraftScore(draft.score),
        strategy ? normalizeGptMemoryMetadata(strategy) : null,
        replacementForDraftId,
        normalizeGptMemoryMetadata(draft.metadata),
      )
      .run();

    const row = await env.DB.prepare(
      `SELECT id, run_id, account_id, threads_user_id, draft_index, text, status, rejection_reason,
              score_json, strategy_json, replacement_for_draft_id, scheduled_post_id, metadata_json,
              created_at, updated_at
       FROM gpt_generation_drafts
       WHERE id = ?
       LIMIT 1`,
    )
      .bind(draftId)
      .first<GptGenerationDraftRow>();
    if (row) {
      saved.push(serializeGptGenerationDraft(row));
    }
  }
  return saved;
}

async function updateGptGenerationDraft(
  env: Env,
  input: {
    draftId: string;
    accountId: string;
    status: string;
    rejectionReason: string | null;
    scheduledPostId: number | null;
    metadataJson: string | null;
  },
): Promise<ReturnType<typeof serializeGptGenerationDraft> | null> {
  await ensureGptGenerationDraftsTable(env);
  await env.DB.prepare(
    `UPDATE gpt_generation_drafts
     SET status = ?,
         rejection_reason = COALESCE(?, rejection_reason),
         scheduled_post_id = COALESCE(?, scheduled_post_id),
         metadata_json = COALESCE(?, metadata_json)
     WHERE id = ?
       AND account_id = ?`,
  )
    .bind(
      input.status,
      input.rejectionReason,
      input.scheduledPostId,
      input.metadataJson,
      input.draftId,
      input.accountId,
    )
    .run();

  const row = await env.DB.prepare(
    `SELECT id, run_id, account_id, threads_user_id, draft_index, text, status, rejection_reason,
            score_json, strategy_json, replacement_for_draft_id, scheduled_post_id, metadata_json,
            created_at, updated_at
     FROM gpt_generation_drafts
     WHERE id = ?
       AND account_id = ?
     LIMIT 1`,
  )
    .bind(input.draftId, input.accountId)
    .first<GptGenerationDraftRow>();

  return row ? serializeGptGenerationDraft(row) : null;
}

async function listGptGenerationRuns(
  env: Env,
  accountId: string,
  limit: number,
  offset = 0,
): Promise<Array<ReturnType<typeof serializeGptGenerationRun> & { drafts: ReturnType<typeof serializeGptGenerationDraft>[] }>> {
  await ensureGptGenerationDraftsTable(env);
  const normalizedLimit = Math.min(Math.max(Math.trunc(limit), 1), 25);
  const normalizedOffset = Math.max(Math.trunc(offset), 0);
  const rows = await env.DB.prepare(
    `SELECT id, account_id, threads_user_id, objective, prompt_summary, status, metadata_json, created_at, updated_at
     FROM gpt_generation_runs
     WHERE account_id = ?
     ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(accountId, normalizedLimit, normalizedOffset)
    .all<GptGenerationRunRow>();

  const runs = (rows.results ?? []).map(serializeGptGenerationRun);
  if (!runs.length) {
    return [];
  }

  const placeholders = runs.map(() => "?").join(", ");
  const draftRows = await env.DB.prepare(
    `SELECT id, run_id, account_id, threads_user_id, draft_index, text, status, rejection_reason,
            score_json, strategy_json, replacement_for_draft_id, scheduled_post_id, metadata_json,
            created_at, updated_at
     FROM gpt_generation_drafts
     WHERE run_id IN (${placeholders})
     ORDER BY run_id, draft_index ASC, datetime(created_at) ASC`,
  )
    .bind(...runs.map((run) => run.id))
    .all<GptGenerationDraftRow>();

  const draftsByRun = new Map<string, ReturnType<typeof serializeGptGenerationDraft>[]>();
  for (const row of draftRows.results ?? []) {
    const serialized = serializeGptGenerationDraft(row);
    const drafts = draftsByRun.get(serialized.run_id) ?? [];
    drafts.push(serialized);
    draftsByRun.set(serialized.run_id, drafts);
  }

  return runs.map((run) => ({
    ...run,
    drafts: draftsByRun.get(run.id) ?? [],
  }));
}

async function listGptGenerationDraftsByStatus(
  env: Env,
  accountId: string,
  statuses: string[],
  limit: number,
  offset = 0,
): Promise<Array<ReturnType<typeof serializeGptGenerationDraft>>> {
  await ensureGptGenerationDraftsTable(env);
  const normalizedStatuses = statuses
    .map((status) => normalizeGptGenerationStatus(status))
    .filter((status, index, all) => all.indexOf(status) === index);
  if (!normalizedStatuses.length) {
    return [];
  }
  const normalizedLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const normalizedOffset = Math.max(Math.trunc(offset), 0);
  const placeholders = normalizedStatuses.map(() => "?").join(", ");
  const rows = await env.DB.prepare(
    `SELECT id, run_id, account_id, threads_user_id, draft_index, text, status, rejection_reason,
            score_json, strategy_json, replacement_for_draft_id, scheduled_post_id, metadata_json,
            created_at, updated_at
     FROM gpt_generation_drafts
     WHERE account_id = ?
       AND status IN (${placeholders})
     ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, draft_index ASC
     LIMIT ? OFFSET ?`,
  )
    .bind(accountId, ...normalizedStatuses, normalizedLimit, normalizedOffset)
    .all<GptGenerationDraftRow>();

  return (rows.results ?? []).map(serializeGptGenerationDraft);
}

function normalizeGptExperimentStatus(value: unknown): string {
  if (typeof value !== "string") {
    return "proposed";
  }
  const normalized = value.trim().toLowerCase();
  return ["proposed", "running", "completed", "paused", "stopped", "retest"].includes(normalized)
    ? normalized
    : "proposed";
}

function normalizeGptExperimentDecision(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return ["exploit", "explore", "stop", "retest", "cooldown", "inconclusive"].includes(normalized)
    ? normalized
    : null;
}

function normalizeGptExperimentConfidence(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return ["low", "medium", "high"].includes(normalized) ? normalized : null;
}

function normalizeGptNumberArray(value: unknown, maxItems: number): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0)
    .slice(0, maxItems);
}

function normalizeGptStringIdArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => normalizeGptMemoryText(item, maxLength, true))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function normalizeGptIsoDateText(value: unknown): string | null {
  const text = normalizeGptMemoryText(value, 30, true);
  if (!text) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isNaN(Date.parse(text))
    ? text
    : null;
}

function buildGptExperimentSummary(memories: ReturnType<typeof serializeGptStrategyMemoryRow>[]): Record<string, unknown> {
  const experiments = memories.filter((memory) => memory.kind === "experiment");
  const results = memories.filter((memory) => memory.kind === "experiment_result");
  const nowMs = Date.now();
  const openExperiments = experiments
    .filter((memory) => {
      const metadata = getGptMemoryMetadataRecord(memory);
      const status = typeof metadata.status === "string" ? metadata.status.toLowerCase() : null;
      return status !== "completed" && status !== "stopped";
    })
    .slice(0, 12);
  const pendingReviews = [...experiments, ...results]
    .filter((memory) => {
      const metadata = getGptMemoryMetadataRecord(memory);
      const reviewAfter = typeof metadata.review_after === "string" ? Date.parse(metadata.review_after) : Number.NaN;
      return Number.isFinite(reviewAfter) && reviewAfter <= nowMs;
    })
    .slice(0, 10);
  const decisionCounts = results.reduce<Record<string, number>>((counts, memory) => {
    const metadata = getGptMemoryMetadataRecord(memory);
    const decision = typeof metadata.decision === "string" ? metadata.decision : "unspecified";
    counts[decision] = (counts[decision] ?? 0) + 1;
    return counts;
  }, {});

  return {
    open_experiments: openExperiments,
    recent_experiment_results: results.slice(0, 12),
    pending_reviews: pendingReviews,
    decision_counts: decisionCounts,
    guidance: [
      "Use experiments to learn without turning weak evidence into permanent rules.",
      "Decide explicitly: exploit, explore, stop, retest, cooldown, or mark inconclusive.",
      "Prefer sample-size caution when post count, follower movement, or feedback evidence is thin.",
      "Retest old experiments when the brand, market, audience, or owner taste changes.",
    ],
  };
}

async function buildGptGrowthContext(
  env: Env,
  brand: GptResolvedBrand,
  days: number,
): Promise<Record<string, unknown>> {
  const normalizedDays = Math.min(Math.max(Math.trunc(days), 7), 90);
  const account: ThreadsAccount = {
    threads_user_id: brand.profile.threads_user_id,
    access_token: brand.configured_account.accessToken,
  };
  const currentFollowers = await refreshCurrentThreadsFollowerSnapshot(env, account, THREADS_INSIGHTS_TIME_ZONE);
  const followerSnapshots = await listThreadsFollowerSnapshots(env, brand.profile.threads_user_id, normalizedDays);
  const dailyGrowth = followerSnapshots.map((snapshot, index) => {
    const previous = index > 0 ? followerSnapshots[index - 1] : null;
    const netChange = snapshot.baseline_followers_count !== null && snapshot.baseline_followers_count !== undefined
      ? snapshot.followers_count - snapshot.baseline_followers_count
      : (previous ? snapshot.followers_count - previous.followers_count : 0);
    return {
      date: snapshot.snapshot_date,
      start_of_day_followers: snapshot.baseline_followers_count ?? previous?.followers_count ?? snapshot.followers_count,
      latest_followers: snapshot.followers_count,
      net_change: netChange,
      captured_at: snapshot.captured_at,
    };
  });

  const archiveLimit = Math.min(Math.max(normalizedDays * 8, 80), 500);
  const [recentArchive, topArchive, scheduledPosts, strategyMemory] = await Promise.all([
    listArchivedThreadsPosts(env, brand.profile.threads_user_id, "recent", archiveLimit, 0),
    listArchivedThreadsPosts(env, brand.profile.threads_user_id, "top", 80, 0),
    listScheduledPostsForHermesContext(env, brand.profile.threads_user_id, 100),
    listGptStrategyMemory(env, brand.account_id, [
      "approved_rule",
      "rule_proposal",
      "rule_review",
      "current_belief",
      "experiment",
      "experiment_result",
      "result_note",
      "scheduled_batch",
    ], 80),
  ]);

  const scheduledTagMap = await listGptPostStrategyTagsForScheduledPosts(env, scheduledPosts.map((post) => post.id));
  const scheduledPostsWithTags = scheduledPosts.map((post) => ({
    ...post,
    strategy: scheduledTagMap.get(post.id) ?? null,
  }));
  const scheduledTags = Array.from(scheduledTagMap.values());

  const postsByDate = new Map<string, CachedThreadsPost[]>();
  for (const post of recentArchive.posts) {
    const localDate = getPostLocalDate(post, THREADS_INSIGHTS_TIME_ZONE);
    if (!localDate) {
      continue;
    }
    const posts = postsByDate.get(localDate) ?? [];
    posts.push(post);
    postsByDate.set(localDate, posts);
  }

  const growthWindows = dailyGrowth.map((day) => {
    const posts = postsByDate.get(day.date) ?? [];
    const previousDate = addDaysToIsoDate(day.date, -1);
    const adjacentPosts = previousDate ? postsByDate.get(previousDate) ?? [] : [];
    const candidatePosts = [...posts, ...adjacentPosts]
      .sort((left, right) => right.engagement_total - left.engagement_total || right.likes - left.likes)
      .slice(0, 12);
    return {
      date: day.date,
      net_followers: day.net_change,
      posts_published: posts.length,
      posts: candidatePosts,
      likely_drivers: candidatePosts.slice(0, 5),
    };
  });

  const bestGrowthDays = [...growthWindows]
    .sort((left, right) => right.net_followers - left.net_followers || left.date.localeCompare(right.date))
    .slice(0, 7);
  const weakGrowthDays = [...growthWindows]
    .sort((left, right) => left.net_followers - right.net_followers || left.date.localeCompare(right.date))
    .slice(0, 7);

  const recentPostsForFloor = recentArchive.posts.slice(0, 50);
  const likes = recentPostsForFloor.map((post) => post.likes);
  const views = recentPostsForFloor.map((post) => post.views);
  const engagementTotals = recentPostsForFloor.map((post) => post.engagement_total);
  const netChanges = dailyGrowth.map((day) => day.net_change);
  const netChangePeriod = dailyGrowth.length >= 2
    ? dailyGrowth[dailyGrowth.length - 1].latest_followers - dailyGrowth[0].latest_followers
    : netChanges.reduce((sum, value) => sum + value, 0);
  const averageDailyGrowth = netChanges.length
    ? netChanges.reduce((sum, value) => sum + value, 0) / netChanges.length
    : 0;

  return {
    success: true,
    brand_key: brand.brand_key,
    account: {
      account_id: brand.account_id,
      label: brand.profile.label,
      username: brand.profile.username,
      name: brand.profile.name,
      threads_user_id: brand.profile.threads_user_id,
      followers_current: currentFollowers,
    },
    period: {
      days: normalizedDays,
      timezone: THREADS_INSIGHTS_TIME_ZONE,
      snapshot_count: dailyGrowth.length,
    },
    followers: {
      current: currentFollowers ?? dailyGrowth[dailyGrowth.length - 1]?.latest_followers ?? null,
      net_change_period: netChangePeriod,
      avg_daily_growth: Number(averageDailyGrowth.toFixed(2)),
      best_growth_days: bestGrowthDays.map((day) => ({ date: day.date, net_followers: day.net_followers })),
      weak_growth_days: weakGrowthDays.map((day) => ({ date: day.date, net_followers: day.net_followers })),
    },
    daily_growth: dailyGrowth,
    growth_windows: growthWindows,
    top_growth_windows: bestGrowthDays,
    weak_growth_windows: weakGrowthDays,
    engagement_floor: {
      sample_size: recentPostsForFloor.length,
      median_likes: Number(calculateMedian(likes).toFixed(2)),
      median_views: Number(calculateMedian(views).toFixed(2)),
      median_engagement_total: Number(calculateMedian(engagementTotals).toFixed(2)),
      top_quartile_likes: Number(calculatePercentile(likes, 75).toFixed(2)),
      top_quartile_views: Number(calculatePercentile(views, 75).toFixed(2)),
      top_quartile_engagement_total: Number(calculatePercentile(engagementTotals, 75).toFixed(2)),
      weak_likes_threshold: Number(calculatePercentile(likes, 25).toFixed(2)),
      weak_engagement_threshold: Number(calculatePercentile(engagementTotals, 25).toFixed(2)),
    },
    archive_recent: recentArchive.posts.slice(0, 80),
    archive_top: topArchive.posts,
    scheduled_posts: scheduledPostsWithTags,
    tag_usage: {
      pillars: summarizeTagUsage(scheduledTags, "pillar"),
      hook_styles: summarizeTagUsage(scheduledTags, "hook_style"),
      formats: summarizeTagUsage(scheduledTags, "format"),
      intents: summarizeTagUsage(scheduledTags, "intent"),
      experiments: summarizeTagUsage(scheduledTags, "experiment"),
      novelty_levels: summarizeTagUsage(scheduledTags, "novelty_level"),
    },
    strategy_memory: strategyMemory,
    experiment_summary: buildGptExperimentSummary(strategyMemory),
    growth_rules: [
      "Separate engagement winners from follower-growth winners.",
      "Prioritize posts that raise the engagement floor and create qualified follower growth.",
      "When evidence is thin, propose an experiment instead of a rule.",
      "When evidence is strong, propose a rule change with specific supporting data.",
    ],
  };
}

async function buildGptGrowthReview(
  env: Env,
  brand: GptResolvedBrand,
  input: {
    days: number;
    objective: string | null;
  },
): Promise<Record<string, unknown>> {
  const normalizedDays = Math.min(Math.max(Math.trunc(input.days), 7), 90);
  const growthContext = await buildGptGrowthContext(env, brand, normalizedDays);
  const followers = growthContext.followers && typeof growthContext.followers === "object"
    ? growthContext.followers as Record<string, unknown>
    : {};
  const engagementFloor = growthContext.engagement_floor && typeof growthContext.engagement_floor === "object"
    ? growthContext.engagement_floor as Record<string, unknown>
    : {};
  const archiveRecent = Array.isArray(growthContext.archive_recent)
    ? growthContext.archive_recent as CachedThreadsPost[]
    : [];
  const topGrowthWindows = Array.isArray(growthContext.top_growth_windows)
    ? growthContext.top_growth_windows as Array<Record<string, unknown>>
    : [];
  const weakGrowthWindows = Array.isArray(growthContext.weak_growth_windows)
    ? growthContext.weak_growth_windows as Array<Record<string, unknown>>
    : [];
  const tagUsage = growthContext.tag_usage && typeof growthContext.tag_usage === "object"
    ? growthContext.tag_usage as Record<string, unknown>
    : {};
  const experimentSummary = growthContext.experiment_summary && typeof growthContext.experiment_summary === "object"
    ? growthContext.experiment_summary as Record<string, unknown>
    : {};
  const sampleSize = archiveRecent.length;
  const weakLikesThreshold = Number(engagementFloor.weak_likes_threshold ?? 0);
  const topQuartileLikes = Number(engagementFloor.top_quartile_likes ?? 0);
  const weakPosts = archiveRecent.filter((post) => Number(post.likes ?? 0) <= weakLikesThreshold);
  const winnerPosts = archiveRecent.filter((post) => Number(post.likes ?? 0) >= topQuartileLikes);
  const weakPostRate = sampleSize ? weakPosts.length / sampleSize : 0;
  const winnerRate = sampleSize ? winnerPosts.length / sampleSize : 0;

  return {
    success: true,
    brand_key: brand.brand_key,
    objective: input.objective,
    review_version: "growth_review_v1",
    review_contract: [
      "Separate follower-growth evidence from engagement-only evidence.",
      "Name what to exploit, what to explore, what to stop, and what needs a retest.",
      "Use sample-size caution; propose experiments when evidence is thin.",
      "Suggest rule changes only when the evidence is strong enough and still fits owner taste.",
      "Keep recommendations flexible so the GPT can adapt as the brand, audience, and market change.",
    ],
    period: growthContext.period,
    account: growthContext.account,
    growth_summary: {
      followers_current: followers.current ?? null,
      net_change_period: followers.net_change_period ?? null,
      avg_daily_growth: followers.avg_daily_growth ?? null,
      sample_size: sampleSize,
      winner_count: winnerPosts.length,
      weak_count: weakPosts.length,
      winner_rate: Number(winnerRate.toFixed(3)),
      weak_post_rate: Number(weakPostRate.toFixed(3)),
      median_likes: engagementFloor.median_likes ?? null,
      median_views: engagementFloor.median_views ?? null,
      median_engagement_total: engagementFloor.median_engagement_total ?? null,
      weak_likes_threshold: engagementFloor.weak_likes_threshold ?? null,
      top_quartile_likes: engagementFloor.top_quartile_likes ?? null,
    },
    likely_drivers: topGrowthWindows.slice(0, 5),
    weak_windows: weakGrowthWindows.slice(0, 5),
    post_samples: {
      recent: archiveRecent.slice(0, 15),
      winners: winnerPosts
        .sort((left, right) => Number(right.engagement_total ?? 0) - Number(left.engagement_total ?? 0))
        .slice(0, 8),
      weak: weakPosts.slice(0, 8),
    },
    tag_usage: tagUsage,
    experiment_summary: experimentSummary,
    recommendation_prompts: [
      "What is working well enough to exploit next week?",
      "What needs a small novelty test instead of a rule?",
      "What is repeating enough to cool down?",
      "Which saved pattern or archive mechanism should be adapted next without copying surface wording?",
      "Which rule proposal deserves a rule review, cooldown, retest, or promotion to current belief?",
    ],
    suggested_follow_up_actions: [
      "Use saveExperiment for tests with hypotheses, criteria, sample size, and review date.",
      "Use saveRuleReview when a belief/rule should be kept, revised, cooled down, retired, retested, promoted, or challenged.",
      "Use saveTasteFeedback when the owner's taste feedback changes the growth strategy.",
      "Use saveStrategyMemory with kind result_note for weekly review notes that should persist.",
    ],
  };
}

function buildGptEvidenceLevel(sampleSize: number, supportingItems: number): "thin" | "emerging" | "moderate" | "strong" {
  if (sampleSize < 12 || supportingItems < 2) {
    return "thin";
  }
  if (sampleSize < 25 || supportingItems < 4) {
    return "emerging";
  }
  if (sampleSize < 50 || supportingItems < 7) {
    return "moderate";
  }
  return "strong";
}

function summarizeMemoryMetadataTokenUsage(
  memories: ReturnType<typeof serializeGptStrategyMemoryRow>[],
  field: string,
): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const memory of memories) {
    const metadata = getGptMemoryMetadataRecord(memory);
    const rawValue = metadata[field];
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (typeof value !== "string" && typeof value !== "number") {
        continue;
      }
      const normalized = String(value).trim();
      if (!normalized) {
        continue;
      }
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 20)
    .map(([value, count]) => ({ value, count }));
}

async function buildGptNoveltyFatigueReport(
  env: Env,
  brand: GptResolvedBrand,
  input: {
    days: number;
    objective: string | null;
  },
): Promise<Record<string, unknown>> {
  const normalizedDays = Math.min(Math.max(Math.trunc(input.days), 7), 90);
  const [recentArchive, scheduledPosts, strategyMemory, generationRuns] = await Promise.all([
    listArchivedThreadsPosts(env, brand.profile.threads_user_id, "recent", Math.min(Math.max(normalizedDays * 6, 60), 300), 0),
    listScheduledPostsForHermesContext(env, brand.profile.threads_user_id, 100),
    listGptStrategyMemory(env, brand.account_id, [
      "saved_pattern_note",
      "approved_pattern",
      "rejected_pattern",
      "cooldown",
      "approval_feedback",
      "rejection_feedback",
      "current_belief",
    ], 100),
    listGptGenerationRuns(env, brand.account_id, 10, 0),
  ]);
  const scheduledTagMap = await listGptPostStrategyTagsForScheduledPosts(env, scheduledPosts.map((post) => post.id));
  const scheduledTags = Array.from(scheduledTagMap.values());
  const drafts = generationRuns.flatMap((run) => run.drafts ?? []);
  const recentTexts = [
    ...recentArchive.posts.map((post) => ({ source: "archive_recent", text: post.text })),
    ...scheduledPosts.map((post) => ({ source: "scheduled", text: post.text })),
    ...drafts.map((draft) => ({ source: `draft_${draft.status}`, text: draft.text })),
  ];
  const tagUsage = {
    scheduled_pillars: summarizeTagUsage(scheduledTags, "pillar"),
    scheduled_hook_styles: summarizeTagUsage(scheduledTags, "hook_style"),
    scheduled_formats: summarizeTagUsage(scheduledTags, "format"),
    scheduled_intents: summarizeTagUsage(scheduledTags, "intent"),
    scheduled_experiments: summarizeTagUsage(scheduledTags, "experiment"),
    scheduled_novelty_levels: summarizeTagUsage(scheduledTags, "novelty_level"),
  };
  const adaptationSummary = buildGptPatternAdaptationSummary(strategyMemory);
  const repeatedOpenings = summarizeRepeatedOpenings(recentTexts);
  const repeatedSkeletons = recentTexts
    .map((item) => ({ source: item.source, skeleton: getSentenceSkeleton(item.text), text: item.text ?? null }))
    .filter((item): item is { source: string; skeleton: string; text: string | null } => Boolean(item.skeleton))
    .reduce<Map<string, { count: number; sources: Set<string>; examples: Array<{ source: string; text: string | null }> }>>((groups, item) => {
      const group = groups.get(item.skeleton) ?? { count: 0, sources: new Set<string>(), examples: [] };
      group.count += 1;
      group.sources.add(item.source);
      if (group.examples.length < 3) {
        group.examples.push({ source: item.source, text: item.text });
      }
      groups.set(item.skeleton, group);
      return groups;
    }, new Map());
  const repeatedSkeletonSummary = Array.from(repeatedSkeletons.entries())
    .filter(([, group]) => group.count > 1)
    .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))
    .slice(0, 12)
    .map(([skeleton, group]) => ({
      skeleton,
      count: group.count,
      sources: Array.from(group.sources),
      examples: group.examples,
    }));
  const scheduledCount = scheduledPosts.length;
  const highUseTags = Object.entries(tagUsage).flatMap(([field, values]) => (
    values
      .filter((value) => value.used >= Math.max(3, Math.ceil(scheduledCount * 0.25)))
      .map((value) => ({ field, ...value }))
  ));
  const fatigueSignals = [
    highUseTags.length ? "One or more scheduled strategy tags dominate the upcoming queue." : null,
    repeatedOpenings.length ? "Recent, scheduled, or draft openings repeat." : null,
    repeatedSkeletonSummary.length ? "Sentence skeletons repeat across recent content." : null,
    Array.isArray((adaptationSummary as Record<string, unknown>).active_pattern_cooldowns)
      && ((adaptationSummary as Record<string, unknown>).active_pattern_cooldowns as unknown[]).length
      ? "Pattern cooldowns are active." : null,
  ].filter(Boolean);

  return {
    success: true,
    brand_key: brand.brand_key,
    objective: input.objective,
    report_version: "novelty_fatigue_v1",
    period: {
      days: normalizedDays,
      archive_recent_count: recentArchive.posts.length,
      scheduled_count: scheduledCount,
      generation_run_count: generationRuns.length,
      draft_count: drafts.length,
      memory_count: strategyMemory.length,
    },
    tag_usage: tagUsage,
    high_use_tags: highUseTags,
    repeated_openings: repeatedOpenings,
    repeated_sentence_skeletons: repeatedSkeletonSummary,
    pattern_adaptation_summary: adaptationSummary,
    memory_mechanism_usage: summarizeMemoryMetadataTokenUsage(strategyMemory, "mechanism"),
    fatigue_signals: fatigueSignals,
    novelty_recommendation: fatigueSignals.length >= 2
      ? "Increase novelty in the next batch and avoid dominant openings/mechanisms."
      : fatigueSignals.length === 1
      ? "Add one or two novelty tests while keeping proven mechanisms in rotation."
      : "No major fatigue signal; keep exploiting proven ideas while preserving some exploration.",
    guidance: [
      "Use these counts as descriptive signals, not rigid rules.",
      "Novelty should change mechanism, emotional frame, nouns, payoff, or structure, not just synonyms.",
      "When fatigue is high, create a fresh experiment or cooldown overused mechanisms.",
      "When fatigue is low, keep exploiting proven patterns with enough variation to avoid audience numbness.",
    ],
  };
}

async function buildGptRuleSuggestions(
  env: Env,
  brand: GptResolvedBrand,
  input: {
    days: number;
    objective: string | null;
  },
): Promise<Record<string, unknown>> {
  const normalizedDays = Math.min(Math.max(Math.trunc(input.days), 7), 90);
  const review = await buildGptGrowthReview(env, brand, {
    days: normalizedDays,
    objective: input.objective,
  });
  const growthSummary = review.growth_summary && typeof review.growth_summary === "object"
    ? review.growth_summary as Record<string, unknown>
    : {};
  const postSamples = review.post_samples && typeof review.post_samples === "object"
    ? review.post_samples as Record<string, unknown>
    : {};
  const tagUsage = review.tag_usage && typeof review.tag_usage === "object"
    ? review.tag_usage as Record<string, unknown>
    : {};
  const experimentSummary = review.experiment_summary && typeof review.experiment_summary === "object"
    ? review.experiment_summary as Record<string, unknown>
    : {};
  const sampleSize = Number(growthSummary.sample_size ?? 0);
  const winnerCount = Number(growthSummary.winner_count ?? 0);
  const weakCount = Number(growthSummary.weak_count ?? 0);
  const winnerRate = Number(growthSummary.winner_rate ?? 0);
  const weakPostRate = Number(growthSummary.weak_post_rate ?? 0);
  const winners = Array.isArray(postSamples.winners) ? postSamples.winners : [];
  const weak = Array.isArray(postSamples.weak) ? postSamples.weak : [];
  const openExperiments = Array.isArray(experimentSummary.open_experiments) ? experimentSummary.open_experiments : [];
  const recentExperimentResults = Array.isArray(experimentSummary.recent_experiment_results)
    ? experimentSummary.recent_experiment_results
    : [];
  const suggestions = [
    {
      suggestion_type: winnerRate >= 0.18 ? "exploit" : "explore",
      title: winnerRate >= 0.18 ? "Exploit recent winner mechanisms carefully" : "Find new winner mechanisms before forming a rule",
      proposed_rule: winnerRate >= 0.18
        ? "Lean into mechanisms visible across recent winners, but keep changing surface wording and emotional frame."
        : "Do not overfit to recent winners yet; create experiments that test why the current winners worked.",
      evidence_level: buildGptEvidenceLevel(sampleSize, winnerCount),
      evidence: {
        sample_size: sampleSize,
        winner_count: winnerCount,
        winner_rate: winnerRate,
        winner_examples: winners.slice(0, 5),
      },
      recommended_action: winnerRate >= 0.18 && sampleSize >= 25 ? "save_rule_proposal" : "save_experiment",
      caution: "Engagement winners are not automatically follower-growth winners.",
    },
    {
      suggestion_type: weakPostRate >= 0.35 ? "cooldown" : "watch",
      title: weakPostRate >= 0.35 ? "Cool down weak-post patterns" : "Watch weak-post patterns without overreacting",
      proposed_rule: weakPostRate >= 0.35
        ? "Reduce mechanisms that resemble the recent weak-post set until a retest proves they can recover."
        : "Keep monitoring weak posts, but do not ban mechanisms from a small weak sample.",
      evidence_level: buildGptEvidenceLevel(sampleSize, weakCount),
      evidence: {
        sample_size: sampleSize,
        weak_count: weakCount,
        weak_post_rate: weakPostRate,
        weak_examples: weak.slice(0, 5),
      },
      recommended_action: weakPostRate >= 0.35 && weakCount >= 5 ? "save_rule_proposal_or_cooldown" : "watch",
      caution: "Weak posts can fail from timing, freshness, or audience context; use cooldowns before permanent bans.",
    },
    {
      suggestion_type: openExperiments.length ? "review_experiments" : "explore",
      title: openExperiments.length ? "Review open experiments before adding new rules" : "Create a fresh growth experiment",
      proposed_rule: openExperiments.length
        ? "Do not add a new rule until open experiments are reviewed or enough new evidence arrives."
        : "Run one small experiment aimed at follower growth or raising the engagement floor before promoting a new rule.",
      evidence_level: recentExperimentResults.length >= 3 ? "moderate" : "thin",
      evidence: {
        open_experiments: openExperiments.slice(0, 5),
        recent_experiment_results: recentExperimentResults.slice(0, 5),
      },
      recommended_action: openExperiments.length ? "review_or_update_experiments" : "save_experiment",
      caution: "Experiments should have hypotheses, success criteria, sample size, and a review date.",
    },
  ];

  return {
    success: true,
    brand_key: brand.brand_key,
    objective: input.objective,
    suggestions_version: "rule_suggestions_v1",
    period: review.period,
    account: review.account,
    rule_suggestions: suggestions,
    tag_usage: tagUsage,
    review,
    persistence_guidance: {
      save_uncertain_learning_as: "rule_proposal",
      save_strong_owner_belief_as: "current_belief",
      save_tests_as: "saveExperiment",
      review_existing_rules_with: "saveRuleReview",
      caution: "Do not save suggestions as approved_rule unless the owner approves or evidence is strong enough.",
    },
  };
}

function normalizeCreativeComparisonText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s'$]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getOpeningSignature(value: string | null | undefined, words = 8): string | null {
  const normalized = normalizeCreativeComparisonText(value);
  if (!normalized) {
    return null;
  }
  const tokens = normalized.split(" ").filter(Boolean).slice(0, words);
  return tokens.length >= 3 ? tokens.join(" ") : null;
}

function getTextTokenSet(value: string | null | undefined): Set<string> {
  const normalized = normalizeCreativeComparisonText(value);
  return new Set(
    normalized
      .split(" ")
      .filter((token) => token.length > 2),
  );
}

function calculateTextSimilarity(left: string | null | undefined, right: string | null | undefined): number {
  const leftTokens = getTextTokenSet(left);
  const rightTokens = getTextTokenSet(right);
  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union ? intersection / union : 0;
}

function summarizeRepeatedOpenings(items: Array<{ text?: string | null; source: string }>): Array<{ opening: string; count: number; sources: string[] }> {
  const openings = new Map<string, { count: number; sources: Set<string> }>();
  for (const item of items) {
    const opening = getOpeningSignature(item.text);
    if (!opening) {
      continue;
    }
    const entry = openings.get(opening) ?? { count: 0, sources: new Set<string>() };
    entry.count += 1;
    entry.sources.add(item.source);
    openings.set(opening, entry);
  }
  return Array.from(openings.entries())
    .filter(([, entry]) => entry.count > 1)
    .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))
    .slice(0, 12)
    .map(([opening, entry]) => ({
      opening,
      count: entry.count,
      sources: Array.from(entry.sources),
    }));
}

function findNearDuplicateReferences(
  draftText: string,
  references: Array<{ source: string; id: string | number | null; text?: string | null }>,
): Array<{ source: string; id: string | number | null; similarity: number; text: string | null }> {
  if (!draftText.trim()) {
    return [];
  }
  return references
    .map((reference) => ({
      source: reference.source,
      id: reference.id,
      similarity: Number(calculateTextSimilarity(draftText, reference.text).toFixed(3)),
      text: reference.text ?? null,
    }))
    .filter((reference) => reference.similarity >= 0.35)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 10);
}

function getSentenceSkeleton(value: string | null | undefined): string | null {
  const normalized = normalizeCreativeComparisonText(value);
  if (!normalized) {
    return null;
  }
  const tokens = normalized
    .split(" ")
    .filter((token) => token.length > 2 && !DASHBOARD_STOP_WORDS.has(token))
    .slice(0, 14);
  return tokens.length >= 4 ? tokens.join(" ") : null;
}

function findRepeatedSentenceSkeletons(
  draftText: string,
  references: Array<{ source: string; id: string | number | null; text?: string | null }>,
): Array<{ source: string; id: string | number | null; similarity: number; skeleton: string; text: string | null }> {
  const draftSkeleton = getSentenceSkeleton(draftText);
  if (!draftSkeleton) {
    return [];
  }
  return references
    .map((reference) => {
      const skeleton = getSentenceSkeleton(reference.text);
      return {
        source: reference.source,
        id: reference.id,
        skeleton,
        similarity: skeleton ? Number(calculateTextSimilarity(draftSkeleton, skeleton).toFixed(3)) : 0,
        text: reference.text ?? null,
      };
    })
    .filter((reference): reference is { source: string; id: string | number | null; similarity: number; skeleton: string; text: string | null } => (
      Boolean(reference.skeleton) && reference.similarity >= 0.45
    ))
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 10);
}

async function buildGptDraftSimilarityCheck(
  env: Env,
  brand: GptResolvedBrand,
  draftText: string,
): Promise<Record<string, unknown>> {
  const [
    recentArchive,
    topArchive,
    weakArchiveSource,
    savedPatternsPage,
    scheduledPosts,
    approvedDrafts,
    rejectedDrafts,
    strategyMemory,
  ] = await Promise.all([
    listArchivedThreadsPosts(env, brand.profile.threads_user_id, "recent", 40, 0),
    listArchivedThreadsPosts(env, brand.profile.threads_user_id, "top", 40, 0),
    listArchivedThreadsPosts(env, brand.profile.threads_user_id, "recent", 80, 0),
    listSavedPatternsForHermes(env, brand.profile.threads_user_id, 40),
    listScheduledPostsForHermesContext(env, brand.profile.threads_user_id, 80),
    listGptGenerationDraftsByStatus(env, brand.account_id, ["approved", "scheduled"], 30, 0),
    listGptGenerationDraftsByStatus(env, brand.account_id, ["rejected", "self_rejected"], 30, 0),
    listGptStrategyMemory(env, brand.account_id, ["banned_phrase", "current_belief", "approved_rule", "rejected_pattern"], 80, 0),
  ]);
  const weakPosts = weakArchiveSource.posts
    .filter((post) => Number(post.engagement_total ?? 0) <= 1 || Number(post.likes ?? 0) <= 1)
    .slice(0, 20);
  const references = [
    ...recentArchive.posts.map((post) => ({ source: "archive_recent", id: post.id, text: post.text })),
    ...topArchive.posts.map((post) => ({ source: "archive_top", id: post.id, text: post.text })),
    ...weakPosts.map((post) => ({ source: "archive_weak", id: post.id, text: post.text })),
    ...scheduledPosts.map((post) => ({ source: "scheduled", id: post.id, text: post.text })),
    ...savedPatternsPage.patterns.map((pattern) => ({ source: "saved_pattern", id: pattern.id, text: pattern.post_text })),
    ...approvedDrafts.map((draft) => ({ source: "approved_draft", id: draft.id, text: draft.text })),
    ...rejectedDrafts.map((draft) => ({ source: "rejected_draft", id: draft.id, text: draft.text })),
  ];
  const normalizedDraft = normalizeCreativeComparisonText(draftText);
  const exactMatches = references
    .filter((reference) => normalizeCreativeComparisonText(reference.text) === normalizedDraft)
    .map((reference) => ({
      source: reference.source,
      id: reference.id,
      text: reference.text ?? null,
    }));
  const nearDuplicates = findNearDuplicateReferences(draftText, references);
  const repeatedSkeletons = findRepeatedSentenceSkeletons(draftText, references);
  const bannedPhraseHits = strategyMemory
    .filter((memory) => memory.kind === "banned_phrase")
    .flatMap((memory) => {
      const candidates = [memory.title, memory.body]
        .map((value) => normalizeCreativeComparisonText(value))
        .filter((value) => value.length >= 3);
      return candidates
        .filter((phrase, index, all) => all.indexOf(phrase) === index && normalizedDraft.includes(phrase))
        .map((phrase) => ({
          memory_id: memory.id,
          phrase,
          title: memory.title,
          reason: memory.body,
        }));
    });
  const highestSimilarity = nearDuplicates[0]?.similarity ?? 0;
  const collisionRisk = exactMatches.length || highestSimilarity >= 0.55 || bannedPhraseHits.length
    ? "high"
    : highestSimilarity >= 0.4 || repeatedSkeletons.length >= 2
    ? "medium"
    : "low";
  const reasons = [
    exactMatches.length ? "Exact text match found in existing context." : null,
    highestSimilarity >= 0.55 ? "Very high wording overlap with prior or scheduled content." : null,
    highestSimilarity >= 0.4 && highestSimilarity < 0.55 ? "Moderate wording overlap; rewrite surface language and payoff." : null,
    repeatedSkeletons.length ? "Sentence skeleton resembles prior content." : null,
    bannedPhraseHits.length ? "Draft contains a banned phrase or rejected wording." : null,
  ].filter(Boolean);

  return {
    success: true,
    brand_key: brand.brand_key,
    draft_text: draftText,
    archive_collision_risk: collisionRisk,
    reasons,
    exact_matches: exactMatches,
    near_duplicates: nearDuplicates,
    repeated_openings: summarizeRepeatedOpenings([{ source: "draft", text: draftText }, ...references]),
    repeated_sentence_skeletons: repeatedSkeletons,
    banned_phrase_hits: bannedPhraseHits,
    compared_counts: {
      archive_recent: recentArchive.posts.length,
      archive_top: topArchive.posts.length,
      archive_weak: weakPosts.length,
      scheduled: scheduledPosts.length,
      saved_patterns: savedPatternsPage.patterns.length,
      approved_drafts: approvedDrafts.length,
      rejected_drafts: rejectedDrafts.length,
      strategy_memory: strategyMemory.length,
    },
  };
}

function getGptMemoryReviewAfter(memory: ReturnType<typeof serializeGptStrategyMemoryRow>): string | null {
  const metadata = getGptMemoryMetadataRecord(memory);
  const reviewAfter = metadata.review_after;
  return typeof reviewAfter === "string" && reviewAfter.trim() ? reviewAfter.trim() : null;
}

function buildGptRuleReviewSummary(
  strategyMemory: ReturnType<typeof serializeGptStrategyMemoryRow>[],
  nowMs = Date.now(),
): Record<string, unknown> {
  const ruleKinds = new Set(["current_belief", "approved_rule", "rule_proposal", "rule_review", "cooldown"]);
  const ruleMemory = strategyMemory.filter((memory) => ruleKinds.has(memory.kind));
  const closedProposalIds = new Set<number>();
  for (const memory of ruleMemory) {
    if (memory.kind !== "rule_review") {
      continue;
    }
    const metadata = getGptMemoryMetadataRecord(memory);
    const decision = typeof metadata.decision === "string" ? metadata.decision : null;
    const reviewedMemoryId = Number(metadata.reviewed_memory_id);
    if (
      Number.isInteger(reviewedMemoryId)
      && ["revise", "cooldown", "retire", "promote_to_current_belief", "challenge"].includes(decision ?? "")
    ) {
      closedProposalIds.add(reviewedMemoryId);
    }
  }
  const pendingReviews = ruleMemory
    .map((memory) => ({ memory, reviewAfter: getGptMemoryReviewAfter(memory) }))
    .filter((entry) => {
      if (!entry.reviewAfter) {
        return false;
      }
      const reviewMs = Date.parse(entry.reviewAfter);
      return Number.isFinite(reviewMs) && reviewMs <= nowMs;
    })
    .map((entry) => ({
      id: entry.memory.id,
      kind: entry.memory.kind,
      title: entry.memory.title,
      body: entry.memory.body,
      review_after: entry.reviewAfter,
      metadata: entry.memory.metadata,
      updated_at: entry.memory.updated_at,
    }));
  const activeCooldowns = strategyMemory
    .filter((memory) => memory.kind === "cooldown")
    .map((memory) => ({
      id: memory.id,
      title: memory.title,
      body: memory.body,
      review_after: getGptMemoryReviewAfter(memory),
      metadata: memory.metadata,
      updated_at: memory.updated_at,
    }));

  return {
    current_beliefs: strategyMemory.filter((memory) => memory.kind === "current_belief").slice(0, 20),
    approved_rules: strategyMemory.filter((memory) => memory.kind === "approved_rule").slice(0, 20),
    open_rule_proposals: strategyMemory
      .filter((memory) => memory.kind === "rule_proposal" && !closedProposalIds.has(memory.id))
      .slice(0, 20),
    recent_rule_reviews: strategyMemory.filter((memory) => memory.kind === "rule_review").slice(0, 20),
    active_cooldowns: activeCooldowns,
    pending_reviews: pendingReviews.slice(0, 20),
    guidance: [
      "Treat these as current beliefs and hypotheses, not permanent truth.",
      "Keep using beliefs that still fit the evidence and owner taste.",
      "Challenge, cool down, revise, retest, or retire beliefs when data or taste changes.",
      "When evidence is thin, suggest a test instead of turning an observation into a rule.",
    ],
  };
}

function buildGptPatternAdaptationSummary(
  strategyMemory: ReturnType<typeof serializeGptStrategyMemoryRow>[],
): Record<string, unknown> {
  const patternMemory = strategyMemory
    .filter((memory) => ["saved_pattern_note", "approved_pattern", "rejected_pattern", "cooldown"].includes(memory.kind))
    .filter((memory) => {
      const metadata = getGptMemoryMetadataRecord(memory);
      return memory.kind !== "cooldown" || metadata.source === "pattern_adaptation";
    });
  const savedPatternUsage = patternMemory.reduce<Record<string, number>>((counts, memory) => {
    const metadata = getGptMemoryMetadataRecord(memory);
    for (const id of Array.isArray(metadata.saved_pattern_ids) ? metadata.saved_pattern_ids : []) {
      const key = String(id);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, {});
  const archivePostUsage = patternMemory.reduce<Record<string, number>>((counts, memory) => {
    const metadata = getGptMemoryMetadataRecord(memory);
    for (const id of Array.isArray(metadata.archive_post_ids) ? metadata.archive_post_ids : []) {
      const key = String(id);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, {});

  return {
    recent_adaptations: patternMemory.slice(0, 20),
    saved_pattern_usage_counts: savedPatternUsage,
    archive_post_usage_counts: archivePostUsage,
    active_pattern_cooldowns: patternMemory.filter((memory) => memory.kind === "cooldown").slice(0, 10),
    guidance: [
      "Reuse the mechanism when it is clearly strong, but change subject, nouns, payoff, emotional frame, and surface wording.",
      "Avoid repeatedly adapting the same saved pattern or archive post unless there is fresh evidence it still works.",
      "Use cooldowns when the same mechanism, opening, or emotional move starts to feel overused.",
      "Track rejected adaptations so the GPT learns taste boundaries, not just winning formulas.",
    ],
  };
}

async function buildGptMemoryDashboard(
  env: Env,
  brand: GptResolvedBrand,
): Promise<Record<string, unknown>> {
  const memoryKinds: GptStrategyMemoryKind[] = [
    "taste_profile",
    "brand_voice_note",
    "current_belief",
    "approved_rule",
    "rule_proposal",
    "rule_review",
    "approved_pattern",
    "rejected_pattern",
    "approval_feedback",
    "rejection_feedback",
    "banned_phrase",
    "cooldown",
    "experiment",
    "experiment_result",
    "saved_pattern_note",
    "result_note",
  ];
  const [memory, totalCount, generationRuns, growthReview, ruleSuggestions, noveltyFatigue] = await Promise.all([
    listGptStrategyMemory(env, brand.account_id, memoryKinds, 100, 0),
    countGptStrategyMemory(env, brand.account_id, memoryKinds),
    listGptGenerationRuns(env, brand.account_id, 8, 0),
    buildGptGrowthReview(env, brand, { days: 30, objective: "memory dashboard" }),
    buildGptRuleSuggestions(env, brand, { days: 30, objective: "memory dashboard" }),
    buildGptNoveltyFatigueReport(env, brand, { days: 30, objective: "memory dashboard" }),
  ]);
  const memoryByKind = memory.reduce<Record<string, typeof memory>>((groups, item) => {
    const group = groups[item.kind] ?? [];
    group.push(item);
    groups[item.kind] = group;
    return groups;
  }, {});

  return {
    success: true,
    brand_key: brand.brand_key,
    account: {
      account_id: brand.account_id,
      label: brand.profile.label,
      username: brand.profile.username,
      name: brand.profile.name,
      threads_user_id: brand.profile.threads_user_id,
      threads_profile_picture_url: brand.profile.threads_profile_picture_url,
    },
    memory_summary: {
      total_count: totalCount,
      returned_count: memory.length,
      counts_by_kind: Object.fromEntries(
        Object.entries(memoryByKind)
          .map(([kind, items]) => [kind, items.length]),
      ),
      has_more: totalCount > memory.length,
    },
    memory_by_kind: memoryByKind,
    rule_review_summary: buildGptRuleReviewSummary(memory),
    experiment_summary: buildGptExperimentSummary(memory),
    pattern_adaptation_summary: buildGptPatternAdaptationSummary(memory),
    generation_runs: generationRuns,
    growth_review: growthReview,
    rule_suggestions: ruleSuggestions,
    novelty_fatigue: noveltyFatigue,
  };
}

async function buildGptGenerationContext(
  env: Env,
  brand: GptResolvedBrand,
  input: {
    objective: string | null;
    draftText: string | null;
    recentLimit: number;
    recentOffset: number;
    topLimit: number;
    topOffset: number;
    weakLimit: number;
    weakOffset: number;
    savedPatternsLimit: number;
    savedPatternsOffset: number;
    memoryLimit: number;
    memoryOffset: number;
    runsLimit: number;
    runsOffset: number;
    approvedDraftsLimit: number;
    approvedDraftsOffset: number;
    rejectedDraftsLimit: number;
    rejectedDraftsOffset: number;
    growthDays: number;
    compact: boolean;
  },
): Promise<Record<string, unknown>> {
  const recentLimit = Math.min(Math.max(Math.trunc(input.recentLimit), 1), 50);
  const recentOffset = Math.max(Math.trunc(input.recentOffset), 0);
  const topLimit = Math.min(Math.max(Math.trunc(input.topLimit), 1), 50);
  const topOffset = Math.max(Math.trunc(input.topOffset), 0);
  const weakLimit = Math.min(Math.max(Math.trunc(input.weakLimit), 1), 25);
  const weakOffset = Math.max(Math.trunc(input.weakOffset), 0);
  const savedPatternsLimit = Math.min(Math.max(Math.trunc(input.savedPatternsLimit), 1), 50);
  const savedPatternsOffset = Math.max(Math.trunc(input.savedPatternsOffset), 0);
  const memoryLimit = Math.min(Math.max(Math.trunc(input.memoryLimit), 1), 100);
  const memoryOffset = Math.max(Math.trunc(input.memoryOffset), 0);
  const runsLimit = Math.min(Math.max(Math.trunc(input.runsLimit), 1), 15);
  const runsOffset = Math.max(Math.trunc(input.runsOffset), 0);
  const approvedDraftsLimit = Math.min(Math.max(Math.trunc(input.approvedDraftsLimit), 1), 50);
  const approvedDraftsOffset = Math.max(Math.trunc(input.approvedDraftsOffset), 0);
  const rejectedDraftsLimit = Math.min(Math.max(Math.trunc(input.rejectedDraftsLimit), 1), 50);
  const rejectedDraftsOffset = Math.max(Math.trunc(input.rejectedDraftsOffset), 0);
  const growthDays = Math.min(Math.max(Math.trunc(input.growthDays), 7), 45);
  const compact = input.compact === true;
  const generationMemoryKinds = [
    "taste_profile",
    "brand_voice_note",
    "current_belief",
    "approved_rule",
    "rule_proposal",
    "rule_review",
    "approved_pattern",
    "rejected_pattern",
    "approval_feedback",
    "rejection_feedback",
    "banned_phrase",
    "cooldown",
    "experiment",
    "experiment_result",
    "result_note",
    "saved_pattern_note",
  ];

  const [
    recentArchive,
    topArchive,
    weakArchiveSource,
    savedPatternsPage,
    scheduledPosts,
    strategyMemory,
    generationRuns,
    approvedDrafts,
    rejectedDrafts,
    followerSnapshots,
  ] = await Promise.all([
    listArchivedThreadsPosts(env, brand.profile.threads_user_id, "recent", recentLimit, recentOffset),
    listArchivedThreadsPosts(env, brand.profile.threads_user_id, "top", topLimit, topOffset),
    listArchivedThreadsPosts(env, brand.profile.threads_user_id, "recent", Math.max(weakLimit * 8, 24), weakOffset),
    listSavedPatternsForHermes(env, brand.profile.threads_user_id, savedPatternsLimit, savedPatternsOffset),
    listScheduledPostsForHermesContext(env, brand.profile.threads_user_id, 50),
    listGptStrategyMemory(env, brand.account_id, generationMemoryKinds, memoryLimit, memoryOffset),
    listGptGenerationRuns(env, brand.account_id, runsLimit, runsOffset),
    listGptGenerationDraftsByStatus(env, brand.account_id, ["approved", "scheduled"], approvedDraftsLimit, approvedDraftsOffset),
    listGptGenerationDraftsByStatus(env, brand.account_id, ["rejected", "self_rejected"], rejectedDraftsLimit, rejectedDraftsOffset),
    listThreadsFollowerSnapshots(env, brand.profile.threads_user_id, growthDays),
  ]);
  const savedPatterns = savedPatternsPage.patterns.map((pattern) => serializeSavedPatternForGpt(pattern, false, !compact));

  const scheduledTagMap = await listGptPostStrategyTagsForScheduledPosts(env, scheduledPosts.map((post) => post.id));
  const scheduledPostsWithTags = scheduledPosts.map((post) => ({
    ...post,
    strategy: scheduledTagMap.get(post.id) ?? null,
  }));
  const weakPosts = weakArchiveSource.posts
    .filter((post) => Number(post.engagement_total ?? 0) <= 1 || Number(post.likes ?? 0) <= 1)
    .slice(0, weakLimit);
  const memoryByKind = strategyMemory.reduce<Record<string, typeof strategyMemory>>((groups, memory) => {
    const group = groups[memory.kind] ?? [];
    group.push(memory);
    groups[memory.kind] = group;
    return groups;
  }, {});
  const referenceItems = [
    ...recentArchive.posts.map((post) => ({ source: "archive_recent", id: post.id, text: post.text })),
    ...topArchive.posts.map((post) => ({ source: "archive_top", id: post.id, text: post.text })),
    ...scheduledPostsWithTags.map((post) => ({ source: "scheduled", id: post.id, text: post.text })),
    ...savedPatternsPage.patterns.map((pattern) => ({ source: "saved_pattern", id: pattern.id, text: pattern.post_text })),
    ...approvedDrafts.map((draft) => ({ source: "approved_draft", id: draft.id, text: draft.text })),
    ...rejectedDrafts.map((draft) => ({ source: "rejected_draft", id: draft.id, text: draft.text })),
  ];
  const growthDeltas = followerSnapshots.map((snapshot, index) => {
    const previous = index > 0 ? followerSnapshots[index - 1] : null;
    const netChange = snapshot.baseline_followers_count !== null && snapshot.baseline_followers_count !== undefined
      ? snapshot.followers_count - snapshot.baseline_followers_count
      : (previous ? snapshot.followers_count - previous.followers_count : 0);
    return {
      date: snapshot.snapshot_date,
      followers: snapshot.followers_count,
      net_change: netChange,
      captured_at: snapshot.captured_at,
    };
  });
  const netGrowth = growthDeltas.length >= 2
    ? growthDeltas[growthDeltas.length - 1].followers - growthDeltas[0].followers
    : growthDeltas.reduce((sum, day) => sum + day.net_change, 0);

  return {
    success: true,
    brand_key: brand.brand_key,
    objective: input.objective,
    account: {
      account_id: brand.account_id,
      label: brand.profile.label,
      username: brand.profile.username,
      name: brand.profile.name,
      threads_user_id: brand.profile.threads_user_id,
      threads_biography: compact ? null : brand.profile.threads_biography,
    },
    generation_philosophy: [
      "Use tags, scores, rules, and categories as descriptive tools, not creative limits.",
      "Treat rules as current beliefs that can decay, be challenged, cooled down, or retested.",
      "Create flexible creative directions; do not force drafts into fixed buckets.",
      "Ask targeted taste questions when the context is ambiguous instead of blindly generating.",
      "Self-reject drafts that are repetitive, corny, generic, unclear, off-brand, or overfit to one recent correction.",
    ],
    context_summary: {
      archive_total_count: recentArchive.totalCount || topArchive.totalCount,
      recent_returned_count: recentArchive.posts.length,
      top_returned_count: topArchive.posts.length,
      weak_returned_count: weakPosts.length,
      saved_patterns_returned_count: savedPatterns.length,
      saved_patterns_total_count: savedPatternsPage.totalCount,
      has_more_saved_patterns: savedPatternsPage.totalCount > savedPatternsOffset + savedPatterns.length,
      scheduled_returned_count: scheduledPostsWithTags.length,
      memory_returned_count: strategyMemory.length,
      generation_runs_returned_count: generationRuns.length,
      approved_drafts_returned_count: approvedDrafts.length,
      rejected_drafts_returned_count: rejectedDrafts.length,
      growth_snapshot_count: growthDeltas.length,
      offsets: {
        recent: recentOffset,
        top: topOffset,
        weak: weakOffset,
        saved_patterns: savedPatternsOffset,
        memory: memoryOffset,
        runs: runsOffset,
        approved_drafts: approvedDraftsOffset,
        rejected_drafts: rejectedDraftsOffset,
      },
    },
    taste_and_beliefs: {
      all_memory: strategyMemory,
      by_kind: memoryByKind,
      rule_review_summary: buildGptRuleReviewSummary(strategyMemory),
      experiment_summary: buildGptExperimentSummary(strategyMemory),
      saved_pattern_adaptation_summary: buildGptPatternAdaptationSummary(strategyMemory),
    },
    generation_history: {
      runs: generationRuns,
      approved_drafts: approvedDrafts,
      rejected_drafts: rejectedDrafts,
    },
    archive: {
      recent: recentArchive.posts,
      top: topArchive.posts,
      weak: weakPosts,
    },
    saved_patterns: savedPatterns,
    scheduled_posts: scheduledPostsWithTags,
    growth_signals: {
      days: growthDays,
      net_growth: netGrowth,
      daily: growthDeltas,
      best_recent_days: [...growthDeltas]
        .sort((left, right) => right.net_change - left.net_change || left.date.localeCompare(right.date))
        .slice(0, 5),
      weakest_recent_days: [...growthDeltas]
        .sort((left, right) => left.net_change - right.net_change || left.date.localeCompare(right.date))
        .slice(0, 5),
    },
    duplicate_and_fatigue: {
      repeated_openings: summarizeRepeatedOpenings(referenceItems),
      near_duplicate_references: input.draftText ? findNearDuplicateReferences(input.draftText, referenceItems) : [],
      check_against_sources: ["archive_recent", "archive_top", "scheduled", "saved_pattern", "approved_draft", "rejected_draft"],
      guidance: [
        "Do not copy exact saved-pattern wording.",
        "Avoid first-line or sentence-skeleton overlap with recent, scheduled, approved, or rejected drafts.",
        "If a strong mechanism is reused, change subject, nouns, payoff, emotional frame, and surface wording.",
      ],
    },
  };
}

function normalizeGptBatchSize(value: unknown, fallback = 8): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(parsed), 1), 30);
}

function buildGptGenerationWorkflowBrief(
  brand: GptResolvedBrand,
  input: {
    objective: string | null;
    batchSize: number;
    context: Record<string, unknown>;
    run: ReturnType<typeof serializeGptGenerationRun> | null;
  },
): Record<string, unknown> {
  const contextSummary = input.context.context_summary && typeof input.context.context_summary === "object"
    ? input.context.context_summary as Record<string, unknown>
    : {};
  const tasteAndBeliefs = input.context.taste_and_beliefs && typeof input.context.taste_and_beliefs === "object"
    ? input.context.taste_and_beliefs as Record<string, unknown>
    : {};
  const ruleSummary = tasteAndBeliefs.rule_review_summary && typeof tasteAndBeliefs.rule_review_summary === "object"
    ? tasteAndBeliefs.rule_review_summary
    : null;
  const duplicateAndFatigue = input.context.duplicate_and_fatigue && typeof input.context.duplicate_and_fatigue === "object"
    ? input.context.duplicate_and_fatigue as Record<string, unknown>
    : {};
  const savedPatternsCount = Number(contextSummary.saved_patterns_returned_count ?? 0);
  const approvedDraftsCount = Number(contextSummary.approved_drafts_returned_count ?? 0);
  const rejectedDraftsCount = Number(contextSummary.rejected_drafts_returned_count ?? 0);
  const memoryCount = Number(contextSummary.memory_returned_count ?? 0);
  const shouldAskTasteQuestion = memoryCount < 3 || (approvedDraftsCount === 0 && rejectedDraftsCount === 0);

  return {
    success: true,
    brand_key: brand.brand_key,
    objective: input.objective,
    run: input.run,
    workflow_version: "generation_brief_v1",
    generation_contract: [
      "Study the returned context before writing.",
      "Create an internal candidate pool larger than the requested batch before showing drafts.",
      "Self-reject weak, corny, generic, repetitive, off-brand, unclear, or overfit drafts before showing them.",
      "Use flexible creative directions; do not force posts into fixed categories.",
      "Run checkDraftSimilarity on drafts that survive internal review before scheduling or presenting a final batch.",
      "Save shown drafts with saveGenerationDrafts and update approvals, rejections, rewrites, or scheduled drafts later.",
    ],
    context_readiness: {
      memory_count: memoryCount,
      saved_patterns_count: savedPatternsCount,
      approved_drafts_count: approvedDraftsCount,
      rejected_drafts_count: rejectedDraftsCount,
      should_ask_taste_question: shouldAskTasteQuestion,
      ask_taste_question_reasons: [
        memoryCount < 3 ? "Thin owner taste/strategy memory for this brand." : null,
        approvedDraftsCount === 0 && rejectedDraftsCount === 0 ? "No approved or rejected draft calibration examples returned." : null,
      ].filter(Boolean),
    },
    candidate_pool: {
      requested_batch_size: input.batchSize,
      minimum_internal_candidates: Math.max(input.batchSize * 3, input.batchSize + 8),
      show_after_self_rejection: input.batchSize,
      direction_mix_guidance: {
        proven_variants: "Roughly 60-75% when strong winners/saved patterns fit the objective.",
        distant_variants: "Roughly 15-30% to avoid fatigue and surface-level copying.",
        fresh_experiments: "Roughly 10-20% when recent posts look repetitive or growth is flat.",
      },
      flexible_direction_prompts: [
        "Adapt a proven archive or saved-pattern mechanism with different nouns, payoff, emotional frame, and surface wording.",
        "Write a distant variant that keeps the emotional logic but changes the subject and structure.",
        "Write one fresh experiment aimed at follower growth or raising the engagement floor.",
        "Write one clarity-first draft that says the point more directly than the current brand default.",
      ],
    },
    scoring_rubric: {
      scale: "0-10",
      required_scores: [
        "hook_strength",
        "specificity",
        "brand_fit",
        "taste_fit",
        "novelty",
        "clarity",
        "naturalness",
        "duplicate_risk",
        "follower_growth_potential",
        "engagement_floor_potential",
        "overall",
      ],
      self_reject_when: [
        "overall < 7",
        "duplicate_risk > 6",
        "brand_fit < 7",
        "taste_fit < 7 when taste evidence is clear",
        "hook_strength < 7 unless the draft is intentionally quiet/direct",
        "naturalness < 7 because the post sounds generated, corny, try-hard, or generic",
      ],
    },
    taste_question_triggers: [
      "Ask a targeted taste question before generating if the objective conflicts with stored taste or current beliefs.",
      "Ask before generating if recent rejection feedback points in multiple directions.",
      "Ask if you need to choose between a proven repetitive style and a fresh experimental style.",
      "Do not ask broad questions; ask one concrete question that changes the batch.",
    ],
    duplicate_and_fatigue_guidance: {
      from_context: duplicateAndFatigue,
      check_action: "checkDraftSimilarity",
      block_or_rewrite_when: [
        "exact_matches is non-empty",
        "archive_collision_risk is high",
        "near duplicate similarity is 0.55 or higher",
        "banned_phrase_hits is non-empty",
        "opening or sentence skeleton repeats a scheduled post or recent approved draft",
      ],
    },
    rule_and_memory_guidance: {
      rule_review_summary: ruleSummary,
      save_after_generation: [
        "Save useful owner taste as taste_profile, approval_feedback, rejection_feedback, brand_voice_note, current_belief, or banned_phrase.",
        "Use rule_proposal for uncertain learnings and saveRuleReview for keep, revise, cooldown, retire, retest, promote, or challenge decisions.",
        "Do not convert weak evidence into a permanent rule.",
      ],
    },
    context: input.context,
  };
}

function buildGptTasteInterviewBrief(
  brand: GptResolvedBrand,
  input: {
    objective: string | null;
    context: Record<string, unknown>;
  },
): Record<string, unknown> {
  const contextSummary = input.context.context_summary && typeof input.context.context_summary === "object"
    ? input.context.context_summary as Record<string, unknown>
    : {};
  const tasteAndBeliefs = input.context.taste_and_beliefs && typeof input.context.taste_and_beliefs === "object"
    ? input.context.taste_and_beliefs as Record<string, unknown>
    : {};
  const generationHistory = input.context.generation_history && typeof input.context.generation_history === "object"
    ? input.context.generation_history as Record<string, unknown>
    : {};
  const approvedDrafts = Array.isArray(generationHistory.approved_drafts) ? generationHistory.approved_drafts : [];
  const rejectedDrafts = Array.isArray(generationHistory.rejected_drafts) ? generationHistory.rejected_drafts : [];
  const memoryCount = Number(contextSummary.memory_returned_count ?? 0);
  const savedPatternsCount = Number(contextSummary.saved_patterns_returned_count ?? 0);
  const ruleSummary = tasteAndBeliefs.rule_review_summary && typeof tasteAndBeliefs.rule_review_summary === "object"
    ? tasteAndBeliefs.rule_review_summary as Record<string, unknown>
    : {};
  const pendingRuleReviews = Array.isArray(ruleSummary.pending_reviews) ? ruleSummary.pending_reviews : [];
  const activeCooldowns = Array.isArray(ruleSummary.active_cooldowns) ? ruleSummary.active_cooldowns : [];
  const questions = [
    memoryCount < 3
      ? "What should this brand sound less like and more like in the next batch?"
      : null,
    approvedDrafts.length === 0 && rejectedDrafts.length === 0
      ? "If I show you a batch, what would make you instantly reject a post even if the hook is strong?"
      : null,
    rejectedDrafts.length > approvedDrafts.length
      ? "Your recent rejection feedback is heavier than approval evidence. What specific trait should I avoid most in this batch?"
      : null,
    savedPatternsCount > 0
      ? "Do you want me to adapt saved-pattern logic aggressively here, or keep it more original and distant?"
      : null,
    activeCooldowns.length > 0
      ? "There are active cooldowns. Should this batch avoid those moves completely or only reduce them?"
      : null,
    pendingRuleReviews.length > 0
      ? "A rule or belief is due for review. Should I follow it for this batch, challenge it, or retest it?"
      : null,
    input.objective
      ? `For this objective, what would be a win: more followers, higher engagement floor, stronger taste fit, or a fresh experiment?`
      : "What is the main outcome for this batch: followers, engagement floor, taste calibration, novelty, or testing a belief?",
  ].filter((question): question is string => Boolean(question));

  return {
    success: true,
    brand_key: brand.brand_key,
    objective: input.objective,
    interview_version: "taste_interview_v1",
    should_ask_before_generating: questions.length > 0,
    max_questions_to_ask: Math.min(3, questions.length),
    prioritized_questions: questions.slice(0, 6),
    save_answers_with: {
      action: "saveTasteFeedback",
      recommended_feedback_types: ["taste_profile", "brand_voice_note", "current_belief", "rejection_feedback", "approval_feedback"],
      guidance: "Save only answers that will affect future generation. Keep them flexible and reviewable.",
    },
    context_signals: {
      memory_count: memoryCount,
      saved_patterns_count: savedPatternsCount,
      approved_drafts_count: approvedDrafts.length,
      rejected_drafts_count: rejectedDrafts.length,
      active_cooldowns_count: activeCooldowns.length,
      pending_rule_reviews_count: pendingRuleReviews.length,
    },
    question_rules: [
      "Ask one to three concrete questions, not a broad questionnaire.",
      "Ask only questions whose answers would change the batch.",
      "If the user gives a strong preference, save it before generating.",
      "Do not let taste questions box the brand into permanent categories.",
    ],
  };
}

function buildGptOpenApiSchema(workerOrigin: string): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "Lensically GPT Actions",
      version: "1.0.0",
      description: "Manual Custom GPT actions for Lensically Threads account context, memory, and scheduling.",
    },
    servers: [{ url: workerOrigin }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
      schemas: {
        BrandKey: {
          type: "string",
          enum: ["opmg_deadman", "manifest_mental", "vectrix"],
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/gpt/accounts": {
        get: {
          operationId: "listAccounts",
          summary: "List Lensically Threads brand accounts available to this GPT.",
          responses: { "200": { description: "Accounts" } },
        },
      },
      "/api/gpt/context": {
        get: {
          operationId: "getBrandContext",
          summary: "Get lightweight brand context with optional field selection and bounded slices.",
          parameters: [
            { name: "brand_key", in: "query", required: true, schema: { "$ref": "#/components/schemas/BrandKey" } },
            { name: "date", in: "query", required: false, schema: { type: "string", format: "date" } },
            { name: "timezone", in: "query", required: false, schema: { type: "string", default: WORKSPACE_DEFAULT_TIMEZONE } },
            { name: "fields", in: "query", required: false, schema: { type: "string", description: "Comma-separated fields such as saved_patterns,upcoming_scheduled_posts,missing_slots,archive_recent,archive_top,archive_weak,strategy_memory,batch_preset" } },
            { name: "recent_limit", in: "query", required: false, schema: { type: "integer", minimum: 0, maximum: 100, default: 5 } },
            { name: "recent_offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "top_limit", in: "query", required: false, schema: { type: "integer", minimum: 0, maximum: 100, default: 5 } },
            { name: "top_offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "weak_limit", in: "query", required: false, schema: { type: "integer", minimum: 0, maximum: 50, default: 3 } },
            { name: "weak_offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "memory_limit", in: "query", required: false, schema: { type: "integer", minimum: 0, maximum: 100, default: 20 } },
            { name: "memory_offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "saved_patterns_limit", in: "query", required: false, schema: { type: "integer", minimum: 0, maximum: 100, default: 10 } },
            { name: "saved_patterns_offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "order_by", in: "query", required: false, schema: { type: "string", enum: ["saved_at_desc", "likes_desc", "views_desc", "engagement_desc"], default: "likes_desc" } },
            { name: "include_raw_payload", in: "query", required: false, schema: { type: "boolean", default: false } },
          ],
          responses: { "200": { description: "Brand context" } },
        },
      },
      "/api/gpt/generation-context": {
        get: {
          operationId: "getGenerationContext",
          summary: "Get a compact pre-generation context packet with taste memory, current beliefs, archive samples, saved patterns, scheduled posts, generation history, growth signals, and duplicate/fatigue hints.",
          parameters: [
            { name: "brand_key", in: "query", required: true, schema: { "$ref": "#/components/schemas/BrandKey" } },
            { name: "objective", in: "query", required: false, schema: { type: "string", description: "The user's generation objective or prompt summary." } },
            { name: "draft_text", in: "query", required: false, schema: { type: "string", description: "Optional draft to compare against archive, scheduled posts, saved patterns, and prior drafts." } },
            { name: "recent_limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 12 } },
            { name: "recent_offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "top_limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 12 } },
            { name: "top_offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "weak_limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 25, default: 5 } },
            { name: "weak_offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "saved_patterns_limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
            { name: "saved_patterns_offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "memory_limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 60 } },
            { name: "memory_offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "runs_limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 15, default: 5 } },
            { name: "runs_offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "approved_drafts_limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
            { name: "approved_drafts_offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "rejected_drafts_limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
            { name: "rejected_drafts_offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "growth_days", in: "query", required: false, schema: { type: "integer", minimum: 7, maximum: 45, default: 14 } },
            { name: "compact", in: "query", required: false, schema: { type: "boolean", default: false } },
          ],
          responses: { "200": { description: "Generation context" } },
        },
      },
      "/api/gpt/generation-brief": {
        post: {
          operationId: "prepareGenerationBrief",
          summary: "Prepare a structured generation workflow brief before writing drafts, optionally creating a generation run.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["brand_key"],
                  properties: {
                    brand_key: { "$ref": "#/components/schemas/BrandKey" },
                    objective: { type: "string" },
                    batch_size: { type: "integer", minimum: 1, maximum: 30, default: 8 },
                    create_run: { type: "boolean", default: true },
                    prompt_summary: { type: "string" },
                    metadata: { type: "object", additionalProperties: true },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Generation workflow brief" } },
        },
      },
      "/api/gpt/taste-interview": {
        get: {
          operationId: "prepareTasteInterview",
          summary: "Prepare targeted owner taste questions before generation when context, approvals, rejections, cooldowns, or rules are uncertain.",
          parameters: [
            { name: "brand_key", in: "query", required: true, schema: { "$ref": "#/components/schemas/BrandKey" } },
            { name: "objective", in: "query", required: false, schema: { type: "string", description: "The user's generation objective or batch focus." } },
          ],
          responses: { "200": { description: "Taste interview brief" } },
        },
      },
      "/api/gpt/draft-similarity": {
        post: {
          operationId: "checkDraftSimilarity",
          summary: "Check a draft against archive, saved patterns, scheduled posts, prior drafts, and banned phrase memory.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["brand_key", "draft_text"],
                  properties: {
                    brand_key: { "$ref": "#/components/schemas/BrandKey" },
                    draft_text: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Draft similarity report" } },
        },
      },
      "/api/gpt/saved-patterns": {
        get: {
          operationId: "listSavedPatterns",
          summary: "List saved outside/reference patterns for a brand.",
          parameters: [
            { name: "brand_key", in: "query", required: true, schema: { "$ref": "#/components/schemas/BrandKey" } },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 48 } },
            { name: "offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "order_by", in: "query", required: false, schema: { type: "string", enum: ["saved_at_desc", "likes_desc", "views_desc", "engagement_desc"], default: "likes_desc" } },
            { name: "include_raw_payload", in: "query", required: false, schema: { type: "boolean", default: false } },
          ],
          responses: { "200": { description: "Saved patterns" } },
        },
      },
      "/api/gpt/posts/recent": {
        get: {
          operationId: "listRecentPosts",
          summary: "List recent or top archived posts for a brand.",
          parameters: [
            { name: "brand_key", in: "query", required: true, schema: { "$ref": "#/components/schemas/BrandKey" } },
            { name: "order", in: "query", required: false, schema: { type: "string", enum: ["recent", "top"], default: "recent" } },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } },
            { name: "offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
          ],
          responses: { "200": { description: "Posts" } },
        },
      },
      "/api/gpt/growth-context": {
        get: {
          operationId: "getGrowthContext",
          summary: "Get follower growth context, growth windows, engagement floor metrics, scheduled strategy tags, and growth memory for a brand.",
          parameters: [
            { name: "brand_key", in: "query", required: true, schema: { "$ref": "#/components/schemas/BrandKey" } },
            { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 7, maximum: 90, default: 45 } },
          ],
          responses: { "200": { description: "Growth context" } },
        },
      },
      "/api/gpt/growth-review": {
        get: {
          operationId: "prepareGrowthReview",
          summary: "Prepare a compact periodic growth review packet with follower trend, engagement floor, winner/weak rates, experiments, and flexible recommendation prompts.",
          parameters: [
            { name: "brand_key", in: "query", required: true, schema: { "$ref": "#/components/schemas/BrandKey" } },
            { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 7, maximum: 90, default: 30 } },
            { name: "objective", in: "query", required: false, schema: { type: "string", description: "Optional review focus, such as weekly review, follower growth, engagement floor, or novelty fatigue." } },
          ],
          responses: { "200": { description: "Growth review" } },
        },
      },
      "/api/gpt/rule-suggestions": {
        get: {
          operationId: "prepareRuleSuggestions",
          summary: "Prepare evidence-based rule suggestions with sample-size caution, using growth review, winner/weak rates, experiments, and current context.",
          parameters: [
            { name: "brand_key", in: "query", required: true, schema: { "$ref": "#/components/schemas/BrandKey" } },
            { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 7, maximum: 90, default: 30 } },
            { name: "objective", in: "query", required: false, schema: { type: "string", description: "Optional focus such as rule review, novelty fatigue, engagement floor, or follower growth." } },
          ],
          responses: { "200": { description: "Rule suggestions" } },
        },
      },
      "/api/gpt/novelty-fatigue": {
        get: {
          operationId: "getNoveltyFatigueReport",
          summary: "Get novelty and fatigue math from scheduled tags, recent archive text, drafts, pattern adaptations, repeated openings, and cooldown memory.",
          parameters: [
            { name: "brand_key", in: "query", required: true, schema: { "$ref": "#/components/schemas/BrandKey" } },
            { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 7, maximum: 90, default: 30 } },
            { name: "objective", in: "query", required: false, schema: { type: "string", description: "Optional generation or growth focus." } },
          ],
          responses: { "200": { description: "Novelty and fatigue report" } },
        },
      },
      "/api/gpt/generation-runs": {
        get: {
          operationId: "listGenerationRuns",
          summary: "List recent generation runs and draft feedback for a brand.",
          parameters: [
            { name: "brand_key", in: "query", required: true, schema: { "$ref": "#/components/schemas/BrandKey" } },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 25, default: 10 } },
            { name: "offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
          ],
          responses: { "200": { description: "Generation runs" } },
        },
        post: {
          operationId: "createGenerationRun",
          summary: "Create a generation run before producing or showing drafts.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["brand_key"],
                  properties: {
                    brand_key: { "$ref": "#/components/schemas/BrandKey" },
                    objective: { type: "string" },
                    prompt_summary: { type: "string" },
                    metadata: { type: "object", additionalProperties: true },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Created generation run" } },
        },
      },
      "/api/gpt/generation-drafts": {
        post: {
          operationId: "saveGenerationDrafts",
          summary: "Save generated drafts with quality scores and strategy tags.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["brand_key", "run_id", "drafts"],
                  properties: {
                    brand_key: { "$ref": "#/components/schemas/BrandKey" },
                    run_id: { type: "string" },
                    drafts: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["text"],
                        properties: {
                          draft_index: { type: "integer" },
                          text: { type: "string" },
                          status: { type: "string" },
                          score: { type: "object", additionalProperties: true },
                          strategy: { type: "object", additionalProperties: true },
                          rejection_reason: { type: "string" },
                          replacement_for_draft_id: { type: "string" },
                          metadata: { type: "object", additionalProperties: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Saved generation drafts" } },
        },
      },
      "/api/gpt/generation-drafts/update": {
        post: {
          operationId: "updateGenerationDraft",
          summary: "Update one generation draft with approval, rejection, rewrite, or scheduling feedback.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["brand_key", "draft_id", "status"],
                  properties: {
                    brand_key: { "$ref": "#/components/schemas/BrandKey" },
                    draft_id: { type: "string" },
                    status: { type: "string" },
                    rejection_reason: { type: "string" },
                    scheduled_post_id: { type: "integer" },
                    metadata: { type: "object", additionalProperties: true },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Updated generation draft" } },
        },
      },
      "/api/gpt/taste-feedback": {
        post: {
          operationId: "saveTasteFeedback",
          summary: "Save flexible owner taste feedback from a taste interview, draft review, approval, rejection, or brand voice discussion.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["brand_key", "lesson"],
                  properties: {
                    brand_key: { "$ref": "#/components/schemas/BrandKey" },
                    feedback_type: {
                      type: "string",
                      enum: ["taste_profile", "approval_feedback", "rejection_feedback", "approved_pattern", "rejected_pattern", "brand_voice_note", "current_belief", "banned_phrase", "cooldown", "rule_review"],
                      default: "taste_profile",
                    },
                    title: { type: "string" },
                    lesson: { type: "string", description: "Natural-language taste lesson. Keep flexible; do not force rigid categories." },
                    liked: { type: "array", items: { type: "string" } },
                    disliked: { type: "array", items: { type: "string" } },
                    examples: { type: "array", items: { type: "object", additionalProperties: true } },
                    source: { type: "string", description: "taste_interview, draft_review, approval, rejection, saved_pattern_review, archive_review, or conversation." },
                    confidence: { type: "string", enum: ["low", "medium", "high"] },
                    review_after_days: { type: "integer", minimum: 1, maximum: 365 },
                    metadata: { type: "object", additionalProperties: true },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Saved taste feedback memory" } },
        },
      },
      "/api/gpt/rule-review": {
        post: {
          operationId: "saveRuleReview",
          summary: "Review a current belief, rule, proposal, pattern, or cooldown decision without making it permanent truth.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["brand_key", "decision", "reason"],
                  properties: {
                    brand_key: { "$ref": "#/components/schemas/BrandKey" },
                    memory_id: { type: "integer", description: "Optional existing memory id being reviewed." },
                    decision: {
                      type: "string",
                      enum: ["keep", "revise", "cooldown", "retire", "retest", "promote_to_current_belief", "challenge"],
                    },
                    title: { type: "string" },
                    reason: { type: "string", description: "Why this decision is being made. Include evidence and uncertainty when relevant." },
                    replacement_belief: { type: "string", description: "Optional updated belief to save as current_belief." },
                    evidence: { type: "array", items: { type: "object", additionalProperties: true } },
                    review_after_days: { type: "integer", minimum: 1, maximum: 365 },
                    metadata: { type: "object", additionalProperties: true },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Saved rule review and optional follow-up memory" } },
        },
      },
      "/api/gpt/experiment": {
        post: {
          operationId: "saveExperiment",
          summary: "Save a flexible growth experiment, result, or decision for a brand.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["brand_key", "hypothesis"],
                  properties: {
                    brand_key: { "$ref": "#/components/schemas/BrandKey" },
                    title: { type: "string" },
                    experiment_name: { type: "string" },
                    hypothesis: { type: "string", description: "What the GPT thinks this experiment may prove or disprove." },
                    status: {
                      type: "string",
                      enum: ["proposed", "running", "completed", "paused", "stopped", "retest"],
                      default: "proposed",
                    },
                    success_criteria: { type: "array", items: { type: "string" } },
                    sample_size_target: { type: "integer", minimum: 1, maximum: 10000 },
                    start_date: { type: "string" },
                    end_date: { type: "string" },
                    related_memory_id: { type: "integer" },
                    related_saved_pattern_ids: { type: "array", items: { type: "integer" } },
                    related_generation_run_ids: { type: "array", items: { type: "string" } },
                    decision: {
                      type: "string",
                      enum: ["exploit", "explore", "stop", "retest", "cooldown", "inconclusive"],
                    },
                    result_notes: { type: "string" },
                    evidence: { type: "array", items: { type: "object", additionalProperties: true } },
                    confidence: { type: "string", enum: ["low", "medium", "high"] },
                    review_after_days: { type: "integer", minimum: 1, maximum: 365 },
                    metadata: { type: "object", additionalProperties: true },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Saved experiment memory" } },
        },
      },
      "/api/gpt/pattern-adaptation": {
        post: {
          operationId: "savePatternAdaptation",
          summary: "Log how a saved pattern or archive mechanism was adapted, rejected, approved, or cooled down.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["brand_key", "adaptation_note"],
                  properties: {
                    brand_key: { "$ref": "#/components/schemas/BrandKey" },
                    title: { type: "string" },
                    adaptation_note: { type: "string", description: "What mechanism was used and how the GPT changed it." },
                    verdict: {
                      type: "string",
                      enum: ["adapted", "approved", "rejected", "cooldown", "retest", "watch"],
                      default: "adapted",
                    },
                    saved_pattern_ids: { type: "array", items: { type: "integer" } },
                    archive_post_ids: { type: "array", items: { type: "string" } },
                    generated_draft_ids: { type: "array", items: { type: "string" } },
                    mechanism: { type: "string" },
                    surface_changes: { type: "array", items: { type: "string" } },
                    reason: { type: "string" },
                    evidence: { type: "array", items: { type: "object", additionalProperties: true } },
                    cooldown_days: { type: "integer", minimum: 1, maximum: 365 },
                    metadata: { type: "object", additionalProperties: true },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Saved pattern adaptation memory" } },
        },
      },
      "/api/gpt/scheduled": {
        get: {
          operationId: "listScheduledPosts",
          summary: "List upcoming scheduled posts for a brand.",
          parameters: [
            { name: "brand_key", in: "query", required: true, schema: { "$ref": "#/components/schemas/BrandKey" } },
          ],
          responses: { "200": { description: "Scheduled posts" } },
        },
      },
      "/api/gpt/schedule": {
        post: {
          operationId: "schedulePost",
          summary: "Schedule one Threads post for a brand.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["brand_key", "text", "date", "time"],
                  properties: {
                    brand_key: { "$ref": "#/components/schemas/BrandKey" },
                    text: { type: "string" },
                    date: { type: "string", format: "date" },
                    time: { type: "string", description: "HH:MM local time" },
                    timezone: { type: "string", default: WORKSPACE_DEFAULT_TIMEZONE },
                    spoiler_all_text: { type: "boolean" },
                    spoiler_phrases: { type: "array", items: { type: "string" } },
                    strategy: {
                      type: "object",
                      additionalProperties: true,
                      properties: {
                        pillar: { type: "string" },
                        hook_style: { type: "string" },
                        format: { type: "string" },
                        intent: { type: "string" },
                        experiment: { type: "string" },
                        novelty_level: { type: "string" },
                        metadata: { type: "object", additionalProperties: true },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Scheduled post" } },
        },
      },
      "/api/gpt/schedule/batch": {
        post: {
          operationId: "scheduleBatchPosts",
          summary: "Schedule a batch of Threads posts for a brand.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["brand_key", "date", "entries"],
                  properties: {
                    brand_key: { "$ref": "#/components/schemas/BrandKey" },
                    date: { type: "string", format: "date" },
                    timezone: { type: "string", default: WORKSPACE_DEFAULT_TIMEZONE },
                    entries: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["text", "time"],
                        properties: {
                          text: { type: "string" },
                          time: { type: "string", description: "HH:MM local time" },
                          date: { type: "string", format: "date" },
                          spoiler_all_text: { type: "boolean" },
                          spoiler_phrases: { type: "array", items: { type: "string" } },
                          strategy: {
                            type: "object",
                            additionalProperties: true,
                            properties: {
                              pillar: { type: "string" },
                              hook_style: { type: "string" },
                              format: { type: "string" },
                              intent: { type: "string" },
                              experiment: { type: "string" },
                              novelty_level: { type: "string" },
                              metadata: { type: "object", additionalProperties: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Batch scheduling results" } },
        },
      },
      "/api/gpt/batch-presets": {
        get: {
          operationId: "listBatchPresets",
          summary: "List account-scoped batch schedule presets.",
          parameters: [
            { name: "brand_key", in: "query", required: true, schema: { "$ref": "#/components/schemas/BrandKey" } },
          ],
          responses: { "200": { description: "Batch presets" } },
        },
        post: {
          operationId: "saveBatchPreset",
          summary: "Save an account-scoped batch schedule preset.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["brand_key", "name", "times"],
                  properties: {
                    brand_key: { "$ref": "#/components/schemas/BrandKey" },
                    name: { type: "string" },
                    times: { type: "array", items: { type: "string" } },
                    is_favorite: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Saved preset" } },
        },
      },
      "/api/gpt/strategy-memory": {
        get: {
          operationId: "listStrategyMemory",
          summary: "List persistent strategy memory for a brand.",
          parameters: [
            { name: "brand_key", in: "query", required: true, schema: { "$ref": "#/components/schemas/BrandKey" } },
            { name: "kind", in: "query", required: false, schema: { type: "string" } },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } },
            { name: "offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
          ],
          responses: { "200": { description: "Strategy memory" } },
        },
        post: {
          operationId: "saveStrategyMemory",
          summary: "Save persistent strategy memory for a brand.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["brand_key", "kind", "body"],
                  properties: {
                    brand_key: { "$ref": "#/components/schemas/BrandKey" },
                    kind: {
                      type: "string",
                      enum: Array.from(GPT_STRATEGY_MEMORY_KINDS),
                    },
                    title: { type: "string" },
                    body: { type: "string" },
                    metadata: { type: "object", additionalProperties: true },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Saved memory" } },
        },
      },
    },
  };
}

function normalizePatternString(
  value: unknown,
  options: { maxLength?: number; allowEmpty?: boolean } = {},
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!options.allowEmpty && !trimmed) {
    return null;
  }

  const maxLength = options.maxLength ?? 0;
  if (maxLength > 0 && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }

  return trimmed;
}

function normalizePatternMetric(value: unknown): number {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }
  return Math.floor(numericValue);
}

function normalizePatternViews(value: unknown): number | null {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }
  return Math.floor(numericValue);
}

function parsePublicThreadsViewCount(html: string): number | null {
  const match = html.match(/"view_counts"\s*:\s*(\d+)/);
  if (!match?.[1]) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function decodeHtmlEntity(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#34;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parsePublicThreadsPostedAt(html: string): string | null {
  const patterns = [
    /"datePublished"\s*:\s*"([^"]+)"/,
    /"uploadDate"\s*:\s*"([^"]+)"/,
    /"published_time"\s*:\s*"([^"]+)"/,
    /<meta[^>]+(?:property|name)=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const rawValue = match?.[1] ? decodeHtmlEntity(match[1]) : null;
    const normalized = normalizePatternPostedAt(rawValue);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

async function fetchPublicThreadsMetadata(sourceUrl: string | null): Promise<{ views: number | null; postedAt: string | null }> {
  if (!sourceUrl || !/^https:\/\/(?:www\.)?threads\.com\//i.test(sourceUrl)) {
    return { views: null, postedAt: null };
  }
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      },
    });
    if (!response.ok) {
      return { views: null, postedAt: null };
    }
    const html = await response.text();
    return {
      views: parsePublicThreadsViewCount(html),
      postedAt: parsePublicThreadsPostedAt(html),
    };
  } catch {
    return { views: null, postedAt: null };
  }
}

function normalizePatternPostedAt(value: unknown): string | null {
  const normalized = normalizePatternString(value, { maxLength: 100 });
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function normalizePatternConfidence(value: unknown): "low" | "medium" | "high" {
  const normalized = normalizePatternString(value, { maxLength: 16 })?.toLowerCase();
  if (normalized === "low" || normalized === "high") {
    return normalized;
  }
  return "medium";
}

function normalizePatternRawPayload(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function derivePatternAuthorHandleFromSourceUrl(sourceUrl: string | null): string | null {
  if (!sourceUrl) {
    return null;
  }
  try {
    const parsed = new URL(sourceUrl);
    const match = parsed.pathname.match(/\/@([^/]+)/);
    return match?.[1]?.trim() || null;
  } catch {
    const match = sourceUrl.match(/\/@([^/?#]+)/);
    return match?.[1]?.trim() || null;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeImportedPatternText(
  text: string | null,
  authorHandle: string | null,
  authorDisplayName: string | null,
): string | null {
  if (!text) {
    return null;
  }

  const normalizedHandle = authorHandle?.trim().replace(/^@/, "") ?? "";
  const normalizedName = authorDisplayName?.trim() ?? "";
  const dateMetadataPattern = /^(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})(?:,?\s*(?:at\s*)?\d{1,2}:\d{2}\s*(?:am|pm)?)?$/i;
  const cleanedLines = text
    .split("\n")
    .map((line) => line.trim())
    .map((line) => {
      let next = line;
      if (normalizedHandle) {
        next = next.replace(new RegExp(`^@?${escapeRegExp(normalizedHandle)}\\s+`, "i"), "");
      }
      if (normalizedName) {
        next = next.replace(new RegExp(`^${escapeRegExp(normalizedName)}\\s+`, "i"), "");
      }
      next = next.replace(/^@?[a-z0-9._]{2,40}\s+\d+\s*(?:s|m|h|d|w|mo|y)\s+/i, "");
      next = next.replace(/^\d+\s*(?:seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|months?|mos?|mo|years?|yrs?|y)\s+/i, "");
      next = next.replace(/^\d+\s*(?:seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|months?|mos?|mo|years?|yrs?|y)\b\s*/i, "");
      next = next.replace(/^\/\s*\d+\s+/i, "");
      return next.trim();
    })
    .filter((line) => {
      if (!line) {
        return false;
      }
      const lower = line.toLowerCase();
      if (normalizedHandle && (lower === normalizedHandle.toLowerCase() || lower === `@${normalizedHandle.toLowerCase()}`)) {
        return false;
      }
      if (normalizedName && lower === normalizedName.toLowerCase()) {
        return false;
      }
      if (lower === "/" || lower === "thread") {
        return false;
      }
      if (/^\d+\s*\/\s*\d+$/.test(lower) || /^\/\s*\d+$/.test(lower)) {
        return false;
      }
      if (/^\d{1,2}$/.test(lower)) {
        return false;
      }
      if (dateMetadataPattern.test(line)) {
        return false;
      }
      return true;
    });

  return cleanedLines.join("\n").trim() || null;
}

function sanitizeExternalPatternRow(row: ExternalPatternRow): ExternalPatternRow {
  const sourceAuthorHandle = derivePatternAuthorHandleFromSourceUrl(row.source_url);
  const sanitizedText = sanitizeImportedPatternText(
    row.post_text,
    sourceAuthorHandle ?? row.author_handle,
    row.author_display_name,
  );
  return {
    ...row,
    post_text: sanitizedText ?? row.post_text,
    author_handle: sourceAuthorHandle ?? row.author_handle,
  };
}

async function importExternalPattern(
  env: Env,
  appUserId: string,
  accountId: string,
  payload: Record<string, unknown>,
): Promise<ExternalPatternRow> {
  await ensureExternalPatternsTable(env);

  const platform = normalizePatternString(payload.platform, { maxLength: 40 }) ?? "threads";
  const sourceUrl = normalizePatternString(payload.source_url, { maxLength: 2000 });
  const postId = normalizePatternString(payload.post_id, { maxLength: 255 });
  const authorHandle = derivePatternAuthorHandleFromSourceUrl(sourceUrl)
    ?? normalizePatternString(payload.author_handle, { maxLength: 255 });
  const authorDisplayName = normalizePatternString(payload.author_display_name, { maxLength: 255 });
  const rawPostText = normalizePatternString(payload.post_text, { maxLength: 20000 });
  const postText = sanitizeImportedPatternText(rawPostText, authorHandle, authorDisplayName);
  const likes = normalizePatternMetric(payload.likes);
  const replies = normalizePatternMetric(payload.replies);
  const reposts = normalizePatternMetric(payload.reposts);
  const shares = normalizePatternMetric(payload.shares);
  const payloadViews = normalizePatternViews(payload.views);
  const payloadPostedAt = normalizePatternPostedAt(payload.posted_at);
  const needsPublicMetadata = (!payloadViews || payloadViews <= 0) || !payloadPostedAt;
  const publicMetadata = needsPublicMetadata
    ? await fetchPublicThreadsMetadata(sourceUrl)
    : { views: null, postedAt: null };
  const views = payloadViews && payloadViews > 0
    ? payloadViews
    : publicMetadata.views;
  const postedAt = payloadPostedAt ?? publicMetadata.postedAt;
  const captureConfidence = normalizePatternConfidence(payload.capture_confidence);
  const rawPayload = normalizePatternRawPayload(payload.raw_payload);

  if (!sourceUrl || !postText) {
    throw new Error("source_url and post_text are required");
  }

  const nowIso = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO external_patterns (
      app_user_id, account_id, platform, source_url, post_id, author_handle, author_display_name,
      post_text, likes, replies, reposts, shares, views, posted_at, capture_confidence,
      raw_payload, saved_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(app_user_id, account_id, source_url) DO UPDATE SET
      platform = excluded.platform,
      post_id = excluded.post_id,
      author_handle = excluded.author_handle,
      author_display_name = excluded.author_display_name,
      post_text = excluded.post_text,
      likes = excluded.likes,
      replies = excluded.replies,
      reposts = excluded.reposts,
      shares = excluded.shares,
      views = excluded.views,
      posted_at = excluded.posted_at,
      capture_confidence = excluded.capture_confidence,
      raw_payload = excluded.raw_payload,
      updated_at = excluded.updated_at`,
  )
    .bind(
      appUserId,
      accountId,
      platform,
      sourceUrl,
      postId,
      authorHandle,
      authorDisplayName,
      postText,
      likes,
      replies,
      reposts,
      shares,
      views,
      postedAt,
      captureConfidence,
      rawPayload,
      nowIso,
      nowIso,
    )
    .run();

  const row = await env.DB.prepare(
    `SELECT id, app_user_id, platform, source_url, post_id, author_handle, author_display_name,
            account_id, post_text, likes, replies, reposts, shares, views, posted_at, capture_confidence,
            raw_payload, saved_at, updated_at
     FROM external_patterns
     WHERE app_user_id = ? AND account_id = ? AND source_url = ?
     LIMIT 1`,
  )
    .bind(appUserId, accountId, sourceUrl)
    .first<ExternalPatternRow>();

  if (!row) {
    throw new Error("pattern_import_failed");
  }

  return row;
}

async function deleteExternalPatterns(
  env: Env,
  appUserId: string,
  accountId: string,
  ids: number[],
): Promise<number> {
  await ensureExternalPatternsTable(env);

  const normalizedIds = Array.from(
    new Set(
      ids
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );

  if (!normalizedIds.length) {
    return 0;
  }

  const placeholders = normalizedIds.map(() => "?").join(", ");
  const result = await env.DB.prepare(
    `DELETE FROM external_patterns
     WHERE app_user_id = ?
       AND account_id = ?
       AND id IN (${placeholders})`,
  )
    .bind(appUserId, accountId, ...normalizedIds)
    .run();

  return Number(result.meta.changes ?? 0);
}

async function resolvePatternAccountId(
  env: Env,
  threadsUserId: string | null,
  requestedAccountId?: string | null,
): Promise<string> {
  const normalizedAccountId = requestedAccountId?.trim().toLowerCase() ?? "";
  if (normalizedAccountId && CONFIGURED_THREADS_ACCOUNTS.some((account) => account.id === normalizedAccountId)) {
    return normalizedAccountId;
  }

  const normalizedThreadsUserId = threadsUserId?.trim() ?? "";
  if (!normalizedThreadsUserId) {
    return DEFAULT_PATTERNS_ACCOUNT_ID;
  }

  const profiles = await getConfiguredThreadsProfiles(env);
  return profiles.find((profile) => profile.threads_user_id === normalizedThreadsUserId)?.account_id
    ?? DEFAULT_PATTERNS_ACCOUNT_ID;
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
    ? "likes DESC, engagement_total DESC, views DESC, post_timestamp DESC"
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

async function countArchivedThreadsPosts(env: Env, threadsUserId: string): Promise<number> {
  await ensureThreadsPostsArchiveTable(env);
  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total_count
     FROM threads_posts_archive
     WHERE threads_user_id = ?`,
  )
    .bind(threadsUserId)
    .first<{ total_count: number | string }>();
  return Number(countRow?.total_count ?? 0);
}

type SavedPatternsOrderBy = "saved_at_desc" | "likes_desc" | "views_desc" | "engagement_desc";

function normalizeSavedPatternsOrderBy(value: string | null | undefined): SavedPatternsOrderBy {
  const normalized = value?.trim().toLowerCase();
  return normalized === "saved_at_desc"
    || normalized === "likes_desc"
    || normalized === "views_desc"
    || normalized === "engagement_desc"
    ? normalized
    : "likes_desc";
}

function getSavedPatternsOrderClause(orderBy: SavedPatternsOrderBy): string {
  switch (orderBy) {
    case "saved_at_desc":
      return "datetime(saved_at) DESC, id DESC";
    case "views_desc":
      return "COALESCE(views, 0) DESC, likes DESC, datetime(saved_at) DESC, id DESC";
    case "engagement_desc":
      return "(likes + replies + reposts + shares) DESC, COALESCE(views, 0) DESC, datetime(saved_at) DESC, id DESC";
    case "likes_desc":
    default:
      return "likes DESC, COALESCE(views, 0) DESC, datetime(updated_at) DESC, id DESC";
  }
}

function serializeSavedPatternForGpt(
  pattern: ExternalPatternRow,
  includeRawPayload: boolean,
  includeSourceUrl = true,
): Record<string, unknown> {
  return {
    id: pattern.id,
    post_text: pattern.post_text,
    author_handle: pattern.author_handle,
    author_display_name: pattern.author_display_name,
    likes: pattern.likes,
    replies: pattern.replies,
    reposts: pattern.reposts,
    shares: pattern.shares,
    views: pattern.views,
    posted_at: pattern.posted_at,
    saved_at: pattern.saved_at,
    ...(includeSourceUrl ? { source_url: pattern.source_url } : {}),
    ...(includeRawPayload ? { raw_payload: pattern.raw_payload } : {}),
  };
}

async function listSavedPatternsForHermes(
  env: Env,
  threadsUserId: string,
  limit: number,
  offset = 0,
  orderBy: SavedPatternsOrderBy = "likes_desc",
): Promise<{ patterns: ExternalPatternRow[]; totalCount: number }> {
  await ensureExternalPatternsTable(env);
  const accountId = await resolvePatternAccountId(env, threadsUserId, null);
  const normalizedLimit = Math.min(Math.max(Math.trunc(limit), 0), 100);
  const normalizedOffset = Math.max(Math.trunc(offset), 0);
  const orderClause = getSavedPatternsOrderClause(orderBy);
  const rows = await env.DB.prepare(
    `SELECT id, app_user_id, account_id, platform, source_url, post_id, author_handle, author_display_name,
            post_text, likes, replies, reposts, shares, views, posted_at, capture_confidence,
            raw_payload, saved_at, updated_at
     FROM external_patterns
     WHERE app_user_id = ? AND account_id = ?
     ORDER BY ${orderClause}
     LIMIT ? OFFSET ?`,
  )
    .bind(SAVED_PATTERNS_APP_USER_ID, accountId, normalizedLimit, normalizedOffset)
    .all<ExternalPatternRow>();

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total_count
     FROM external_patterns
     WHERE app_user_id = ? AND account_id = ?`,
  )
    .bind(SAVED_PATTERNS_APP_USER_ID, accountId)
    .first<{ total_count: number | string }>();

  return {
    patterns: rows.results ?? [],
    totalCount: Number(countRow?.total_count ?? 0),
  };
}

async function listScheduledPostsForHermesContext(
  env: Env,
  threadsUserId: string,
  limit: number,
): Promise<Array<{ id: number; text: string; status: string; scheduled_time_utc: string }>> {
  await ensureScheduledPostsTable(env);
  const rows = await env.DB.prepare(
    `SELECT id, post_text, status, scheduled_time
     FROM scheduled_posts
     WHERE threads_user_id = ?
       AND status IN (?, ?)
       AND scheduled_time >= ?
     ORDER BY scheduled_time ASC, id ASC
     LIMIT ?`,
  )
    .bind(
      threadsUserId,
      SCHEDULED_POST_STATUS_APPROVED,
      SCHEDULED_POST_STATUS_POSTING,
      new Date().toISOString(),
      limit,
    )
    .all<{ id: number | string; post_text: string; status: string; scheduled_time: string }>();

  return (rows.results ?? []).map((row) => ({
    id: Number(row.id),
    text: row.post_text,
    status: row.status,
    scheduled_time_utc: row.scheduled_time,
  }));
}

function normalizeHermesPostCount(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 6;
  }
  return Math.max(1, Math.min(HERMES_MAX_POST_COUNT, Math.floor(number)));
}

function buildHermesPrompt(input: {
  count: number;
  account: {
    username?: string | null;
    name?: string | null;
    threads_biography?: string | null;
  };
  topic?: string | null;
  archiveRecent: CachedThreadsPost[];
  archiveTop: CachedThreadsPost[];
  scheduledPosts: Array<{ text: string; scheduled_time_utc: string; status: string }>;
  savedPatterns: ExternalPatternRow[];
}): string {
  return JSON.stringify({
    task: "Generate Threads post candidates for Lensically. Return only valid JSON with a posts array of strings.",
    count: input.count,
    account: input.account,
    optional_topic: input.topic ?? null,
    instructions: [
      "Use the archive, top posts, scheduled posts, and saved patterns as context.",
      "Create novelty and avoid repeating old wording or currently scheduled ideas.",
      "Keep each post ready to publish on Threads.",
      "Do not include numbering inside each post string.",
    ],
    context: {
      archive_recent: input.archiveRecent.map((post) => ({
        text: post.text,
        timestamp: post.timestamp,
        likes: post.likes,
        replies: post.replies,
        reposts: post.reposts,
        views: post.views,
        engagement_total: post.engagement_total,
      })),
      archive_top: input.archiveTop.map((post) => ({
        text: post.text,
        timestamp: post.timestamp,
        likes: post.likes,
        replies: post.replies,
        reposts: post.reposts,
        views: post.views,
        engagement_total: post.engagement_total,
      })),
      scheduled_posts: input.scheduledPosts,
      saved_patterns: input.savedPatterns.map((pattern) => ({
        text: pattern.post_text,
        author_handle: pattern.author_handle,
        likes: pattern.likes,
        replies: pattern.replies,
        reposts: pattern.reposts,
        shares: pattern.shares,
        views: pattern.views,
        saved_at: pattern.saved_at,
      })),
    },
    output_schema: {
      posts: ["string"],
    },
  });
}

function extractOpenAiText(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "";
  }
  const response = data as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown; type?: unknown }> }>;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  if (typeof response.output_text === "string") {
    return response.output_text;
  }
  const outputText = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => (typeof content.text === "string" ? content.text : ""))
    .join("")
    .trim();
  if (outputText) {
    return outputText;
  }
  const chatText = response.choices?.[0]?.message?.content;
  return typeof chatText === "string" ? chatText : "";
}

function parseHermesGeneratedPosts(rawText: string, count: number): string[] {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return [];
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        parsed = null;
      }
    }
  }

  const rawPosts = parsed && typeof parsed === "object" && Array.isArray((parsed as { posts?: unknown }).posts)
    ? (parsed as { posts: unknown[] }).posts
    : trimmed
      .split(/\n+/)
      .map((line) => line.replace(/^\s*\d+[\.)]\s*/, "").trim())
      .filter(Boolean);

  return rawPosts
    .map((post) => String(post ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, count);
}

async function generateHermesPosts(input: {
  env: Env;
  count: number;
  account: {
    username?: string | null;
    name?: string | null;
    threads_biography?: string | null;
  };
  topic?: string | null;
  archiveRecent: CachedThreadsPost[];
  archiveTop: CachedThreadsPost[];
  scheduledPosts: Array<{ text: string; scheduled_time_utc: string; status: string }>;
  savedPatterns: ExternalPatternRow[];
}): Promise<{ model: string; posts: string[]; rawText: string }> {
  const apiKey = input.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = input.env.HERMES_MODEL?.trim() || HERMES_DEFAULT_MODEL;
  const prompt = buildHermesPrompt(input);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = data && typeof data === "object" && "error" in data
      ? JSON.stringify((data as { error?: unknown }).error)
      : `OpenAI request failed with HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  const rawText = extractOpenAiText(data);
  const posts = parseHermesGeneratedPosts(rawText, input.count);
  return { model, posts, rawText };
}

async function getArchivedThreadsPostsMetricsMap(
  env: Env,
  threadsUserId: string,
  postIds: string[],
): Promise<Map<string, CachedThreadsPost>> {
  const normalizedPostIds = Array.from(
    new Set(
      postIds
        .map((postId) => postId.trim())
        .filter((postId) => postId.length > 0),
    ),
  );

  if (normalizedPostIds.length === 0) {
    return new Map();
  }

  const cachedPosts = await getThreadsPostsCache(env, threadsUserId, { allowStale: true });
  const allowedIds = new Set(normalizedPostIds);

  return new Map(
    (cachedPosts?.posts ?? [])
      .filter((post) => allowedIds.has(post.id))
      .map((post) => [post.id, post]),
  );
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
  spoilerAllText: boolean = false,
  spoilerPhrases: string[] = [],
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
  const spoilerValidationError = validateTextSpoilerConfig(trimmedText, spoilerAllText, spoilerPhrases);
  if (spoilerValidationError) {
    return { success: false, error: spoilerValidationError };
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
  const spoilerFingerprint = buildSpoilerFingerprint(spoilerAllText, spoilerPhrases);
  const scheduleIdempotencyKey = await buildScheduledPostIdempotencyKey(
    appUserId,
    threadsUserId,
    scheduledUtc,
    trimmedText,
    spoilerFingerprint,
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
        spoiler_all_text,
        spoiler_phrases_json,
        status,
        scheduled_time,
        idempotency_key
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        appUserId,
        threadsUserId,
        trimmedText,
        spoilerAllText ? 1 : 0,
        serializeSpoilerPhrases(spoilerPhrases),
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

function normalizeThreadsPostCount(value: unknown): number {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }
  return Math.trunc(numericValue);
}

function pickThreadsMetricValue(primaryValue: number, fallbackValue: number): number {
  return primaryValue > 0 ? primaryValue : fallbackValue;
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
  env: Env,
  accessToken: string,
  threadsUserId: string,
  cursor: string | null,
): Promise<{
  posts: CachedThreadsPost[];
  nextCursor: string | null;
  hasMore: boolean;
} | null> {
  try {
    const basePostFields = "id,text,media_type,permalink,timestamp,username,has_replies,is_quote_post,is_reply";
    const postCountFields = "view_count,like_count,reply_count,repost_count,quote_count";
    const buildPostsUrl = (fields: string): string => {
      const params = new URLSearchParams({
        fields,
        limit: "40",
      });

      if (cursor) {
        params.set("after", cursor);
      }

      return `https://graph.threads.net/v1.0/${threadsUserId}/threads?${params.toString()}`;
    };

    let response = await fetch(
      buildPostsUrl(`${basePostFields},${postCountFields}`),
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      response = await fetch(
        buildPostsUrl(basePostFields),
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
    }

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
        view_count?: number | string | null;
        like_count?: number | string | null;
        reply_count?: number | string | null;
        repost_count?: number | string | null;
        quote_count?: number | string | null;
        views_count?: number | string | null;
        likes_count?: number | string | null;
        replies_count?: number | string | null;
        reposts_count?: number | string | null;
        quotes_count?: number | string | null;
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
    const fallbackMetricsByPostId = await getArchivedThreadsPostsMetricsMap(
      env,
      threadsUserId,
      posts.map((post) => (typeof post.id === "string" ? post.id : "")),
    );
    const enrichedPosts: HydratedThreadsPost[] = [];
    const batchSize = 4;

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
            views: normalizeThreadsPostCount(post.view_count ?? post.views_count),
            likes: normalizeThreadsPostCount(post.like_count ?? post.likes_count),
            replies: normalizeThreadsPostCount(post.reply_count ?? post.replies_count),
            reposts: normalizeThreadsPostCount(post.repost_count ?? post.reposts_count),
            quotes: normalizeThreadsPostCount(post.quote_count ?? post.quotes_count),
            shares: 0,
            engagement_total:
              normalizeThreadsPostCount(post.like_count ?? post.likes_count) +
              normalizeThreadsPostCount(post.reply_count ?? post.replies_count) +
              normalizeThreadsPostCount(post.repost_count ?? post.reposts_count) +
              normalizeThreadsPostCount(post.quote_count ?? post.quotes_count),
          };

          if (!postId) {
            return {
              ...basePost,
              metrics_loaded: false,
            };
          }

          const fallbackPost = fallbackMetricsByPostId.get(postId);
          const hydratedFromFallback = (): HydratedThreadsPost => ({
            ...basePost,
            views: fallbackPost?.views ?? basePost.views,
            likes: fallbackPost?.likes ?? basePost.likes,
            replies: fallbackPost?.replies ?? basePost.replies,
            reposts: fallbackPost?.reposts ?? basePost.reposts,
            quotes: fallbackPost?.quotes ?? basePost.quotes,
            shares: fallbackPost?.shares ?? basePost.shares,
            engagement_total: fallbackPost?.engagement_total ?? basePost.engagement_total,
            metrics_loaded: false,
          });

          try {
            let metricsResponse: Response | null = null;
            for (let attempt = 0; attempt < 3; attempt += 1) {
              metricsResponse = await fetch(
                `https://graph.threads.net/v1.0/${postId}/insights?metric=views,likes,replies,reposts,quotes,shares&access_token=${encodeURIComponent(accessToken)}`,
              );

              if (metricsResponse.ok) {
                break;
              }

              if (metricsResponse.status !== 429 && metricsResponse.status < 500) {
                break;
              }

              if (attempt < 2) {
                await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
              }
            }

            if (!metricsResponse?.ok) {
              return hydratedFromFallback();
            }

            const metricsPayload = await readJsonSafe(metricsResponse);
            if (!metricsPayload || typeof metricsPayload !== "object" || Array.isArray(metricsPayload)) {
              return hydratedFromFallback();
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
            const views = pickThreadsMetricValue(metricMap.views, basePost.views);
            const likes = pickThreadsMetricValue(metricMap.likes, basePost.likes);
            const replies = pickThreadsMetricValue(metricMap.replies, basePost.replies);
            const reposts = pickThreadsMetricValue(metricMap.reposts, basePost.reposts);
            const quotes = pickThreadsMetricValue(metricMap.quotes, basePost.quotes);
            const shares = metricMap.shares;

            return {
              ...basePost,
              views,
              likes,
              replies,
              reposts,
              quotes,
              shares,
              engagement_total: likes + replies + reposts + quotes + shares,
              metrics_loaded: true,
            };
          } catch {
            return hydratedFromFallback();
          }
        }),
      );

      enrichedPosts.push(...results);
    }

    const metricsLoadedCount = enrichedPosts.filter((post) => post.metrics_loaded).length;
    logWorkerEvent("THREADS_POSTS_METRICS_HYDRATION", {
      threads_user_id: threadsUserId,
      requested_posts: posts.length,
      metrics_loaded: metricsLoadedCount,
      metrics_fallback: posts.length - metricsLoadedCount,
      has_cursor: Boolean(cursor),
    });

    return {
      posts: enrichedPosts.map(({ metrics_loaded: _metricsLoaded, ...post }) => post),
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
        env,
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
  requestedThreadsUserId: string | null = null,
  attempts = 6,
  delayMs = 500,
): Promise<ThreadsAccount | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const account = await getThreadsAccountForAppUser(env, appUserId, requestedThreadsUserId);
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
    const isAuthPath =
      normalizedPath.startsWith("/api/batch-schedule/")
      || normalizedPath.startsWith("/auth/threads/");
    const requestCorsHeaders = getCorsHeadersForRequest(request, env, normalizedPath);
    const applyAuthCors = (response: Response): Response =>
      isAuthPath ? withAuthCors(request, env, response) : response;

    if (request.method === "OPTIONS") {
      const corsHeaders = isApiPath
        ? getCorsHeadersForRequest(request, env, normalizedPath)
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

    if (normalizedPath === "/api/gpt/openapi.json" && request.method === "GET") {
      return new Response(
        JSON.stringify(buildGptOpenApiSchema(getConfiguredWorkerOrigin(env))),
        {
          status: 200,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (normalizedPath.startsWith("/api/gpt/")) {
      if (!isGptRequestAuthorized(request, env)) {
        return unauthorizedGptResponse();
      }

      if (normalizedPath === "/api/gpt/accounts" && request.method === "GET") {
        const profiles = await getConfiguredThreadsProfiles(env);
        return new Response(
          JSON.stringify({
            success: true,
            accounts: profiles.map((profile) => ({
              brand_key: gptBrandKeyForAccountId(profile.account_id),
              account_id: profile.account_id,
              label: profile.label,
              username: profile.username,
              name: profile.name,
              threads_user_id: profile.threads_user_id,
              is_active: profile.is_active,
              threads_biography: profile.threads_biography,
            })),
          }),
          { status: 200, headers: { "content-type": "application/json; charset=UTF-8" } },
        );
      }

      if (normalizedPath === "/api/gpt/context" && request.method === "GET") {
        const brand = await resolveGptBrand(env, url.searchParams.get("brand_key"));
        if (!brand) {
          return new Response(
            JSON.stringify({ success: false, error: "Unknown or unavailable brand_key" }),
            { status: 404, headers: { "content-type": "application/json; charset=UTF-8" } },
          );
        }

        const requestedTimeZone = url.searchParams.get("timezone")?.trim() || WORKSPACE_DEFAULT_TIMEZONE;
        const timeZone = isValidIanaTimezone(requestedTimeZone) ? requestedTimeZone : WORKSPACE_DEFAULT_TIMEZONE;
        const requestedDate = url.searchParams.get("date")?.trim() || null;
        const targetDate = requestedDate && isValidIsoDate(requestedDate)
          ? requestedDate
          : buildDefaultTomorrowSlotPlan(timeZone)?.date ?? getLocalDateInTimeZone(timeZone) ?? new Date().toISOString().slice(0, 10);

        const requestedFields = parseGptFieldsParam(url.searchParams.get("fields"));
        const recentLimit = parseBoundedIntegerParam(url.searchParams.get("recent_limit"), 5, 0, 100);
        const recentOffset = parseBoundedIntegerParam(url.searchParams.get("recent_offset"), 0, 0, 100000);
        const topLimit = parseBoundedIntegerParam(url.searchParams.get("top_limit"), 5, 0, 100);
        const topOffset = parseBoundedIntegerParam(url.searchParams.get("top_offset"), 0, 0, 100000);
        const weakLimit = parseBoundedIntegerParam(url.searchParams.get("weak_limit"), 3, 0, 50);
        const weakOffset = parseBoundedIntegerParam(url.searchParams.get("weak_offset"), 0, 0, 100000);
        const memoryLimit = parseBoundedIntegerParam(url.searchParams.get("memory_limit"), 20, 0, 100);
        const memoryOffset = parseBoundedIntegerParam(url.searchParams.get("memory_offset"), 0, 0, 100000);
        const savedPatternsLimit = parseBoundedIntegerParam(url.searchParams.get("saved_patterns_limit"), 10, 0, 100);
        const savedPatternsOffset = parseBoundedIntegerParam(url.searchParams.get("saved_patterns_offset"), 0, 0, 100000);
        const savedPatternsOrderBy = normalizeSavedPatternsOrderBy(url.searchParams.get("order_by"));
        const includeSavedPatternsRawPayload = url.searchParams.get("include_raw_payload") === "true";

        const includeSlots = wantsGptField(requestedFields, "missing_slots") || wantsGptField(requestedFields, "desired_slots");
        const includeBatchPreset = wantsGptField(requestedFields, "batch_preset") || includeSlots;
        const includeScheduledForDate = wantsGptField(requestedFields, "scheduled_posts_for_date") || includeSlots;
        const includeUpcomingScheduled = wantsGptField(requestedFields, "upcoming_scheduled_posts");
        const includeRecent = wantsGptField(requestedFields, "archive_recent") && recentLimit > 0;
        const includeTop = wantsGptField(requestedFields, "archive_top") && topLimit > 0;
        const includeWeak = wantsGptField(requestedFields, "archive_weak") && weakLimit > 0;
        const includeSavedPatterns = wantsGptField(requestedFields, "saved_patterns") && savedPatternsLimit > 0;
        const includeStrategyMemory = wantsGptField(requestedFields, "strategy_memory") && memoryLimit > 0;

        const [
          batchPresets,
          recentArchive,
          topArchive,
          weakArchiveSource,
          scheduledPostsForDate,
          upcomingScheduledPosts,
          savedPatternsPage,
          strategyMemory,
          strategyMemoryTotal,
          archiveTotalCount,
        ] = await Promise.all([
          includeBatchPreset
            ? listBatchSchedulePresetsForUser(env, WORKSPACE_APP_USER_ID, brand.profile.threads_user_id)
            : Promise.resolve([]),
          includeRecent
            ? listArchivedThreadsPosts(env, brand.profile.threads_user_id, "recent", recentLimit, recentOffset)
            : Promise.resolve({ posts: [], totalCount: 0 }),
          includeTop
            ? listArchivedThreadsPosts(env, brand.profile.threads_user_id, "top", topLimit, topOffset)
            : Promise.resolve({ posts: [], totalCount: 0 }),
          includeWeak
            ? listArchivedThreadsPosts(env, brand.profile.threads_user_id, "recent", Math.max(weakLimit * 8, 24), weakOffset)
            : Promise.resolve({ posts: [], totalCount: 0 }),
          includeScheduledForDate
            ? listScheduledPostsForThreadsAccountOnLocalDate(
              env,
              brand.profile.threads_user_id,
              targetDate,
              timeZone,
            )
            : Promise.resolve([]),
          includeUpcomingScheduled
            ? listScheduledPostsForHermesContext(env, brand.profile.threads_user_id, 50)
            : Promise.resolve([]),
          includeSavedPatterns
            ? listSavedPatternsForHermes(env, brand.profile.threads_user_id, savedPatternsLimit, savedPatternsOffset, savedPatternsOrderBy)
            : Promise.resolve({ patterns: [], totalCount: 0 }),
          includeStrategyMemory
            ? listGptStrategyMemory(env, brand.account_id, [], memoryLimit, memoryOffset)
            : Promise.resolve([]),
          includeStrategyMemory
            ? countGptStrategyMemory(env, brand.account_id, [])
            : Promise.resolve(0),
          countArchivedThreadsPosts(env, brand.profile.threads_user_id),
        ]);

        const selectedBatchPreset = includeBatchPreset ? pickPreferredBatchSchedulePreset(batchPresets) : null;
        const upcomingTagMap = includeUpcomingScheduled
          ? await listGptPostStrategyTagsForScheduledPosts(env, upcomingScheduledPosts.map((post) => post.id))
          : new Map<number, ReturnType<typeof serializeGptPostStrategyTag>>();
        const upcomingScheduledPostsWithTags = upcomingScheduledPosts.map((post) => ({
          ...post,
          strategy: upcomingTagMap.get(post.id) ?? null,
        }));
        const agentControls = await listAgentAccountControls(env);
        const agentControl = agentControls.find((control) => control.account_id === brand.account_id) ?? null;
        const desiredSlots = agentControl?.agent_schedule_slots?.length
          ? agentControl.agent_schedule_slots
          : selectedBatchPreset?.times?.length
          ? selectedBatchPreset.times
          : buildHourlySlotTimes(7, 23);
        const occupiedSlots = new Set(
          scheduledPostsForDate
            .map((post) => post.local_time)
            .filter((slot) => Boolean(slot)),
        );
        const weakPosts = weakArchiveSource.posts
          .filter((post) => Number(post.engagement_total ?? 0) <= 1 && Number(post.likes ?? 0) <= 1)
          .slice(0, weakLimit);

        const payload: Record<string, unknown> = {
            success: true,
            brand_key: brand.brand_key,
            account: {
              account_id: brand.account_id,
              label: brand.profile.label,
              username: brand.profile.username,
              name: brand.profile.name,
              threads_user_id: brand.profile.threads_user_id,
              threads_biography: brand.profile.threads_biography,
            },
            date: targetDate,
            timezone: timeZone,
            archive_summary: {
              archive_total_count: archiveTotalCount,
              recent_sample_count: recentArchive.posts.length,
              top_sample_count: topArchive.posts.length,
              weak_sample_count: weakPosts.length,
              has_more_recent: includeRecent ? recentArchive.totalCount > recentOffset + recentArchive.posts.length : null,
              has_more_top: includeTop ? topArchive.totalCount > topOffset + topArchive.posts.length : null,
              recent_offset: recentOffset,
              top_offset: topOffset,
              weak_offset: weakOffset,
              has_more_weak_source: includeWeak ? weakArchiveSource.totalCount > weakOffset + weakArchiveSource.posts.length : null,
              has_more_memory: includeStrategyMemory ? strategyMemoryTotal > memoryOffset + strategyMemory.length : null,
              memory_returned_count: strategyMemory.length,
              memory_total_count: strategyMemoryTotal,
              memory_offset: memoryOffset,
              saved_patterns_returned_count: savedPatternsPage.patterns.length,
              saved_patterns_total_count: savedPatternsPage.totalCount,
              has_more_saved_patterns: includeSavedPatterns ? savedPatternsPage.totalCount > savedPatternsOffset + savedPatternsPage.patterns.length : null,
              saved_patterns_offset: savedPatternsOffset,
              omitted_fields: [
                !includeRecent ? "archive_recent" : null,
                !includeTop ? "archive_top" : null,
                !includeWeak ? "archive_weak" : null,
                !includeSavedPatterns ? "saved_patterns" : null,
                !includeStrategyMemory ? "strategy_memory" : null,
                !includeUpcomingScheduled ? "upcoming_scheduled_posts" : null,
              ].filter(Boolean),
            },
            operating_rules: [
              "Use proven hook structures when they fit, but do not copy exact wording.",
              "Avoid repeating recent or already scheduled post angles.",
              "Prefer proven patterns unless fatigue risk is visible.",
              "Use novelty deliberately when the recent batch overuses the same hook, style, or pillar.",
              "Suggest rule changes when data supports them; save approved changes as approved_rule memory.",
            ],
        };

        if (includeSlots) {
          payload.desired_slots = desiredSlots;
          payload.occupied_slots = Array.from(occupiedSlots);
          payload.missing_slots = desiredSlots.filter((slot) => !occupiedSlots.has(slot));
        }
        if (includeBatchPreset) {
          payload.batch_preset = selectedBatchPreset;
        }
        if (includeScheduledForDate) {
          payload.scheduled_posts_for_date = scheduledPostsForDate;
        }
        if (includeUpcomingScheduled) {
          payload.upcoming_scheduled_posts = upcomingScheduledPostsWithTags;
        }
        if (includeRecent) {
          payload.archive_recent = recentArchive.posts;
        }
        if (includeTop) {
          payload.archive_top = topArchive.posts;
        }
        if (includeWeak) {
          payload.archive_weak = weakPosts;
        }
        if (includeSavedPatterns) {
          payload.saved_patterns = savedPatternsPage.patterns.map((pattern) => serializeSavedPatternForGpt(pattern, includeSavedPatternsRawPayload));
        }
        if (includeStrategyMemory) {
          payload.strategy_memory = strategyMemory;
        }

        return new Response(
          JSON.stringify(payload),
          { status: 200, headers: { "content-type": "application/json; charset=UTF-8" } },
        );
      }

      if (normalizedPath === "/api/gpt/generation-context" && request.method === "GET") {
        const brand = await resolveGptBrand(env, url.searchParams.get("brand_key"));
        if (!brand) {
          return new Response(JSON.stringify({ success: false, error: "Unknown or unavailable brand_key" }), {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }

        const context = await buildGptGenerationContext(env, brand, {
          objective: normalizeGptMemoryText(url.searchParams.get("objective"), 1000, true),
          draftText: normalizeGptMemoryText(url.searchParams.get("draft_text"), 2000, true),
          recentLimit: parseBoundedIntegerParam(url.searchParams.get("recent_limit"), 12, 1, 50),
          recentOffset: parseBoundedIntegerParam(url.searchParams.get("recent_offset"), 0, 0, 100000),
          topLimit: parseBoundedIntegerParam(url.searchParams.get("top_limit"), 12, 1, 50),
          topOffset: parseBoundedIntegerParam(url.searchParams.get("top_offset"), 0, 0, 100000),
          weakLimit: parseBoundedIntegerParam(url.searchParams.get("weak_limit"), 5, 1, 25),
          weakOffset: parseBoundedIntegerParam(url.searchParams.get("weak_offset"), 0, 0, 100000),
          savedPatternsLimit: parseBoundedIntegerParam(url.searchParams.get("saved_patterns_limit"), 20, 1, 50),
          savedPatternsOffset: parseBoundedIntegerParam(url.searchParams.get("saved_patterns_offset"), 0, 0, 100000),
          memoryLimit: parseBoundedIntegerParam(url.searchParams.get("memory_limit"), 60, 1, 100),
          memoryOffset: parseBoundedIntegerParam(url.searchParams.get("memory_offset"), 0, 0, 100000),
          runsLimit: parseBoundedIntegerParam(url.searchParams.get("runs_limit"), 5, 1, 15),
          runsOffset: parseBoundedIntegerParam(url.searchParams.get("runs_offset"), 0, 0, 100000),
          approvedDraftsLimit: parseBoundedIntegerParam(url.searchParams.get("approved_drafts_limit"), 20, 1, 50),
          approvedDraftsOffset: parseBoundedIntegerParam(url.searchParams.get("approved_drafts_offset"), 0, 0, 100000),
          rejectedDraftsLimit: parseBoundedIntegerParam(url.searchParams.get("rejected_drafts_limit"), 20, 1, 50),
          rejectedDraftsOffset: parseBoundedIntegerParam(url.searchParams.get("rejected_drafts_offset"), 0, 0, 100000),
          growthDays: parseBoundedIntegerParam(url.searchParams.get("growth_days"), 14, 7, 45),
          compact: url.searchParams.get("compact") === "true",
        });
        return new Response(JSON.stringify(context), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/generation-brief" && request.method === "POST") {
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const brand = await resolveGptBrand(env, payload.brand_key);
        if (!brand) {
          return new Response(JSON.stringify({ success: false, error: "Unknown or unavailable brand_key" }), {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const objective = normalizeGptMemoryText(payload.objective, 1000, true);
        const batchSize = normalizeGptBatchSize(payload.batch_size, 8);
        const context = await buildGptGenerationContext(env, brand, {
          objective,
          draftText: null,
          recentLimit: 12,
          recentOffset: 0,
          topLimit: 12,
          topOffset: 0,
          weakLimit: 5,
          weakOffset: 0,
          savedPatternsLimit: 16,
          savedPatternsOffset: 0,
          memoryLimit: 60,
          memoryOffset: 0,
          runsLimit: 5,
          runsOffset: 0,
          approvedDraftsLimit: 20,
          approvedDraftsOffset: 0,
          rejectedDraftsLimit: 20,
          rejectedDraftsOffset: 0,
          growthDays: 14,
          compact: true,
        });
        const shouldCreateRun = payload.create_run !== false;
        const run = shouldCreateRun
          ? await createGptGenerationRun(env, {
            accountId: brand.account_id,
            threadsUserId: brand.profile.threads_user_id,
            objective,
            promptSummary: normalizeGptMemoryText(payload.prompt_summary, 2000, true)
              ?? `Generation brief for ${brand.brand_key}`,
            metadataJson: normalizeGptMemoryMetadata({
              source: "generation_brief",
              batch_size: batchSize,
              workflow_version: "generation_brief_v1",
              ...(payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
                ? payload.metadata
                : {}),
            }),
          })
          : null;
        const brief = buildGptGenerationWorkflowBrief(brand, {
          objective,
          batchSize,
          context,
          run,
        });
        return new Response(JSON.stringify(brief), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/taste-interview" && request.method === "GET") {
        const brand = await resolveGptBrand(env, url.searchParams.get("brand_key"));
        if (!brand) {
          return new Response(JSON.stringify({ success: false, error: "Unknown or unavailable brand_key" }), {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const objective = normalizeGptMemoryText(url.searchParams.get("objective"), 500, true);
        const context = await buildGptGenerationContext(env, brand, {
          objective,
          draftText: null,
          recentLimit: 5,
          recentOffset: 0,
          topLimit: 5,
          topOffset: 0,
          weakLimit: 3,
          weakOffset: 0,
          savedPatternsLimit: 6,
          savedPatternsOffset: 0,
          memoryLimit: 40,
          memoryOffset: 0,
          runsLimit: 3,
          runsOffset: 0,
          approvedDraftsLimit: 8,
          approvedDraftsOffset: 0,
          rejectedDraftsLimit: 8,
          rejectedDraftsOffset: 0,
          growthDays: 14,
          compact: true,
        });
        const interview = buildGptTasteInterviewBrief(brand, { objective, context });
        return new Response(JSON.stringify(interview), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/draft-similarity" && request.method === "POST") {
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const brand = await resolveGptBrand(env, payload.brand_key);
        const draftText = normalizeGptMemoryText(payload.draft_text, 20000);
        if (!brand || !draftText) {
          return new Response(JSON.stringify({ success: false, error: "brand_key and draft_text are required" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const report = await buildGptDraftSimilarityCheck(env, brand, draftText);
        return new Response(JSON.stringify(report), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/posts/recent" && request.method === "GET") {
        const brand = await resolveGptBrand(env, url.searchParams.get("brand_key"));
        if (!brand) {
          return new Response(JSON.stringify({ success: false, error: "Unknown or unavailable brand_key" }), {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const requestedOrder = url.searchParams.get("order")?.trim().toLowerCase();
        const order = requestedOrder === "top" ? "top" : "recent";
        const limit = parseBoundedIntegerParam(url.searchParams.get("limit"), 50, 1, 100);
        const offset = parseBoundedIntegerParam(url.searchParams.get("offset"), 0, 0, 100000);
        const archive = await listArchivedThreadsPosts(env, brand.profile.threads_user_id, order, limit, offset);
        return new Response(JSON.stringify({
          success: true,
          brand_key: brand.brand_key,
          account_id: brand.account_id,
          threads_user_id: brand.profile.threads_user_id,
          order,
          posts: archive.posts,
          total_count: archive.totalCount,
          returned_count: archive.posts.length,
          limit,
          offset,
          has_more: archive.totalCount > offset + archive.posts.length,
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/saved-patterns" && request.method === "GET") {
        const brand = await resolveGptBrand(env, url.searchParams.get("brand_key"));
        if (!brand) {
          return new Response(JSON.stringify({ success: false, error: "Unknown or unavailable brand_key" }), {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const limit = parseBoundedIntegerParam(url.searchParams.get("limit"), 48, 1, 100);
        const offset = parseBoundedIntegerParam(url.searchParams.get("offset"), 0, 0, 100000);
        const orderBy = normalizeSavedPatternsOrderBy(url.searchParams.get("order_by"));
        const includeRawPayload = url.searchParams.get("include_raw_payload") === "true";
        const page = await listSavedPatternsForHermes(env, brand.profile.threads_user_id, limit, offset, orderBy);
        const patterns = page.patterns.map((pattern) => serializeSavedPatternForGpt(pattern, includeRawPayload));
        return new Response(JSON.stringify({
          success: true,
          brand_key: brand.brand_key,
          account_id: brand.account_id,
          threads_user_id: brand.profile.threads_user_id,
          patterns,
          returned_count: patterns.length,
          total_count: page.totalCount,
          has_more: page.totalCount > offset + patterns.length,
          limit,
          offset,
          order_by: orderBy,
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/growth-context" && request.method === "GET") {
        const brand = await resolveGptBrand(env, url.searchParams.get("brand_key"));
        if (!brand) {
          return new Response(JSON.stringify({ success: false, error: "Unknown or unavailable brand_key" }), {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const rawDays = Number(url.searchParams.get("days") ?? "45");
        const days = Number.isFinite(rawDays) ? rawDays : 45;
        const growthContext = await buildGptGrowthContext(env, brand, days);
        return new Response(JSON.stringify(growthContext), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/growth-review" && request.method === "GET") {
        const brand = await resolveGptBrand(env, url.searchParams.get("brand_key"));
        if (!brand) {
          return new Response(JSON.stringify({ success: false, error: "Unknown or unavailable brand_key" }), {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const days = parseBoundedIntegerParam(url.searchParams.get("days"), 30, 7, 90);
        const review = await buildGptGrowthReview(env, brand, {
          days,
          objective: normalizeGptMemoryText(url.searchParams.get("objective"), 500, true),
        });
        return new Response(JSON.stringify(review), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/rule-suggestions" && request.method === "GET") {
        const brand = await resolveGptBrand(env, url.searchParams.get("brand_key"));
        if (!brand) {
          return new Response(JSON.stringify({ success: false, error: "Unknown or unavailable brand_key" }), {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const days = parseBoundedIntegerParam(url.searchParams.get("days"), 30, 7, 90);
        const suggestions = await buildGptRuleSuggestions(env, brand, {
          days,
          objective: normalizeGptMemoryText(url.searchParams.get("objective"), 500, true),
        });
        return new Response(JSON.stringify(suggestions), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/novelty-fatigue" && request.method === "GET") {
        const brand = await resolveGptBrand(env, url.searchParams.get("brand_key"));
        if (!brand) {
          return new Response(JSON.stringify({ success: false, error: "Unknown or unavailable brand_key" }), {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const days = parseBoundedIntegerParam(url.searchParams.get("days"), 30, 7, 90);
        const report = await buildGptNoveltyFatigueReport(env, brand, {
          days,
          objective: normalizeGptMemoryText(url.searchParams.get("objective"), 500, true),
        });
        return new Response(JSON.stringify(report), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/generation-runs" && request.method === "GET") {
        const brand = await resolveGptBrand(env, url.searchParams.get("brand_key"));
        if (!brand) {
          return new Response(JSON.stringify({ success: false, error: "Unknown or unavailable brand_key" }), {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const rawLimit = Number(url.searchParams.get("limit") ?? "10");
        const limit = Number.isFinite(rawLimit) ? rawLimit : 10;
        const offset = parseBoundedIntegerParam(url.searchParams.get("offset"), 0, 0, 100000);
        const runs = await listGptGenerationRuns(env, brand.account_id, limit, offset);
        return new Response(JSON.stringify({
          success: true,
          brand_key: brand.brand_key,
          runs,
          limit,
          offset,
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/generation-runs" && request.method === "POST") {
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const brand = await resolveGptBrand(env, payload.brand_key);
        if (!brand) {
          return new Response(JSON.stringify({ success: false, error: "Unknown or unavailable brand_key" }), {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const run = await createGptGenerationRun(env, {
          accountId: brand.account_id,
          threadsUserId: brand.profile.threads_user_id,
          objective: normalizeGptMemoryText(payload.objective, 1000, true),
          promptSummary: normalizeGptMemoryText(payload.prompt_summary, 2000, true),
          metadataJson: normalizeGptMemoryMetadata(payload.metadata),
        });
        return new Response(JSON.stringify({
          success: true,
          brand_key: brand.brand_key,
          run,
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/generation-drafts" && request.method === "POST") {
        let payload: { brand_key?: unknown; run_id?: unknown; drafts?: unknown };
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const brand = await resolveGptBrand(env, payload.brand_key);
        const runId = typeof payload.run_id === "string" ? payload.run_id.trim() : "";
        const drafts = Array.isArray(payload.drafts) ? payload.drafts as Array<Record<string, unknown>> : [];
        if (!brand || !runId || !drafts.length) {
          return new Response(JSON.stringify({ success: false, error: "brand_key, run_id, and drafts are required" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const savedDrafts = await addGptGenerationDrafts(env, {
          runId,
          accountId: brand.account_id,
          threadsUserId: brand.profile.threads_user_id,
          drafts,
        });
        return new Response(JSON.stringify({
          success: true,
          brand_key: brand.brand_key,
          drafts: savedDrafts,
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/generation-drafts/update" && request.method === "POST") {
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const brand = await resolveGptBrand(env, payload.brand_key);
        const draftId = typeof payload.draft_id === "string" ? payload.draft_id.trim() : "";
        if (!brand || !draftId) {
          return new Response(JSON.stringify({ success: false, error: "brand_key and draft_id are required" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const scheduledPostId = Number(payload.scheduled_post_id);
        const draft = await updateGptGenerationDraft(env, {
          draftId,
          accountId: brand.account_id,
          status: normalizeGptGenerationStatus(payload.status),
          rejectionReason: normalizeGptMemoryText(payload.rejection_reason, 1000, true),
          scheduledPostId: Number.isInteger(scheduledPostId) && scheduledPostId > 0 ? scheduledPostId : null,
          metadataJson: normalizeGptMemoryMetadata(payload.metadata),
        });
        return new Response(JSON.stringify({
          success: Boolean(draft),
          brand_key: brand.brand_key,
          draft,
        }), {
          status: draft ? 200 : 404,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/taste-feedback" && request.method === "POST") {
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const brand = await resolveGptBrand(env, payload.brand_key);
        const allowedTasteKinds = new Set<GptStrategyMemoryKind>([
          "taste_profile",
          "approval_feedback",
          "rejection_feedback",
          "approved_pattern",
          "rejected_pattern",
          "brand_voice_note",
          "current_belief",
          "banned_phrase",
          "cooldown",
          "rule_review",
        ]);
        const requestedKind = normalizeGptStrategyMemoryKind(payload.feedback_type);
        const kind = requestedKind && allowedTasteKinds.has(requestedKind) ? requestedKind : "taste_profile";
        const lesson = normalizeGptMemoryText(payload.lesson, 8000);
        if (!brand || !lesson) {
          return new Response(JSON.stringify({ success: false, error: "brand_key and lesson are required" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }

        const title = normalizeGptMemoryText(payload.title, 200, true)
          ?? `${kind.replace(/_/g, " ")} feedback`;
        const liked = normalizeGptStringArray(payload.liked, 20, 1000);
        const disliked = normalizeGptStringArray(payload.disliked, 20, 1000);
        const examples = normalizeGptRecordArray(payload.examples, 20);
        const source = normalizeGptMemoryText(payload.source, 100, true) ?? "conversation";
        const confidence = normalizeGptMemoryText(payload.confidence, 20, true);
        const reviewAfterDays = parseBoundedIntegerParam(
          typeof payload.review_after_days === "number" || typeof payload.review_after_days === "string"
            ? String(payload.review_after_days)
            : null,
          0,
          0,
          365,
        );
        const reviewAfter = reviewAfterDays > 0
          ? new Date(Date.now() + reviewAfterDays * 24 * 60 * 60 * 1000).toISOString()
          : null;
        const metadata = {
          source,
          confidence: confidence || null,
          liked,
          disliked,
          examples,
          review_after: reviewAfter,
          flexible_note: "Use this as owner taste evidence, not a rigid creative category.",
          ...(payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
            ? payload.metadata
            : {}),
        };
        const bodyParts = [
          `Lesson: ${lesson}`,
          liked.length ? `What worked: ${liked.join(" | ")}` : null,
          disliked.length ? `What did not work: ${disliked.join(" | ")}` : null,
          reviewAfter ? `Review after: ${reviewAfter}` : null,
        ].filter(Boolean);
        const memory = await saveGptStrategyMemory(env, {
          accountId: brand.account_id,
          threadsUserId: brand.profile.threads_user_id,
          kind,
          title,
          body: bodyParts.join("\n"),
          metadataJson: normalizeGptMemoryMetadata(metadata),
        });
        return new Response(JSON.stringify({ success: true, brand_key: brand.brand_key, memory }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/rule-review" && request.method === "POST") {
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const brand = await resolveGptBrand(env, payload.brand_key);
        const allowedDecisions = new Set(["keep", "revise", "cooldown", "retire", "retest", "promote_to_current_belief", "challenge"]);
        const decision = typeof payload.decision === "string" && allowedDecisions.has(payload.decision.trim().toLowerCase())
          ? payload.decision.trim().toLowerCase()
          : null;
        const reason = normalizeGptMemoryText(payload.reason, 8000);
        if (!brand || !decision || !reason) {
          return new Response(JSON.stringify({ success: false, error: "brand_key, valid decision, and reason are required" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }

        const memoryId = Number(payload.memory_id);
        const reviewedMemoryId = Number.isInteger(memoryId) && memoryId > 0 ? memoryId : null;
        const title = normalizeGptMemoryText(payload.title, 200, true)
          ?? `Rule review: ${decision.replace(/_/g, " ")}`;
        const replacementBelief = normalizeGptMemoryText(payload.replacement_belief, 8000, true);
        const evidence = normalizeGptRecordArray(payload.evidence, 25);
        const reviewAfterDays = parseBoundedIntegerParam(
          typeof payload.review_after_days === "number" || typeof payload.review_after_days === "string"
            ? String(payload.review_after_days)
            : null,
          0,
          0,
          365,
        );
        const reviewAfter = reviewAfterDays > 0
          ? new Date(Date.now() + reviewAfterDays * 24 * 60 * 60 * 1000).toISOString()
          : null;
        const metadata = {
          reviewed_memory_id: reviewedMemoryId,
          decision,
          evidence,
          review_after: reviewAfter,
          flexible_note: "This is a current strategic judgment, not permanent creative law.",
          ...(payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
            ? payload.metadata
            : {}),
        };
        const reviewMemory = await saveGptStrategyMemory(env, {
          accountId: brand.account_id,
          threadsUserId: brand.profile.threads_user_id,
          kind: "rule_review",
          title,
          body: [
            `Decision: ${decision}`,
            reviewedMemoryId ? `Reviewed memory id: ${reviewedMemoryId}` : null,
            `Reason: ${reason}`,
            replacementBelief ? `Replacement belief: ${replacementBelief}` : null,
            reviewAfter ? `Review after: ${reviewAfter}` : null,
          ].filter(Boolean).join("\n"),
          metadataJson: normalizeGptMemoryMetadata(metadata),
        });

        const followUpMemories = [];
        if (replacementBelief && (decision === "revise" || decision === "promote_to_current_belief")) {
          const beliefMemory = await saveGptStrategyMemory(env, {
            accountId: brand.account_id,
            threadsUserId: brand.profile.threads_user_id,
            kind: "current_belief",
            title: normalizeGptMemoryText(payload.title, 200, true) ?? "Current belief",
            body: replacementBelief,
            metadataJson: normalizeGptMemoryMetadata({
              source: "rule_review",
              rule_review_memory_id: reviewMemory?.id ?? null,
              reviewed_memory_id: reviewedMemoryId,
              review_after: reviewAfter,
              flexible_note: "Use this as a working belief that can be challenged by future data or owner taste.",
            }),
          });
          if (beliefMemory) {
            followUpMemories.push(beliefMemory);
          }
        }
        if (decision === "cooldown") {
          const cooldownMemory = await saveGptStrategyMemory(env, {
            accountId: brand.account_id,
            threadsUserId: brand.profile.threads_user_id,
            kind: "cooldown",
            title: normalizeGptMemoryText(payload.title, 200, true) ?? "Rule cooldown",
            body: reason,
            metadataJson: normalizeGptMemoryMetadata({
              source: "rule_review",
              rule_review_memory_id: reviewMemory?.id ?? null,
              reviewed_memory_id: reviewedMemoryId,
              review_after: reviewAfter,
              flexible_note: "Pause or reduce this pattern temporarily; retest when context changes.",
            }),
          });
          if (cooldownMemory) {
            followUpMemories.push(cooldownMemory);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          brand_key: brand.brand_key,
          review_memory: reviewMemory,
          follow_up_memory: followUpMemories,
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/experiment" && request.method === "POST") {
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const brand = await resolveGptBrand(env, payload.brand_key);
        const hypothesis = normalizeGptMemoryText(payload.hypothesis, 8000);
        if (!brand || !hypothesis) {
          return new Response(JSON.stringify({ success: false, error: "brand_key and hypothesis are required" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }

        const status = normalizeGptExperimentStatus(payload.status);
        const decision = normalizeGptExperimentDecision(payload.decision);
        const resultNotes = normalizeGptMemoryText(payload.result_notes, 8000, true);
        const title = normalizeGptMemoryText(payload.title, 200, true)
          ?? normalizeGptMemoryText(payload.experiment_name, 200, true)
          ?? "Growth experiment";
        const successCriteria = normalizeGptStringArray(payload.success_criteria, 20, 1000);
        const sampleSizeTarget = parseBoundedIntegerParam(
          typeof payload.sample_size_target === "number" || typeof payload.sample_size_target === "string"
            ? String(payload.sample_size_target)
            : null,
          0,
          0,
          10000,
        );
        const relatedMemoryId = Number(payload.related_memory_id);
        const reviewAfterDays = parseBoundedIntegerParam(
          typeof payload.review_after_days === "number" || typeof payload.review_after_days === "string"
            ? String(payload.review_after_days)
            : null,
          0,
          0,
          365,
        );
        const reviewAfter = reviewAfterDays > 0
          ? new Date(Date.now() + reviewAfterDays * 24 * 60 * 60 * 1000).toISOString()
          : null;
        const evidence = normalizeGptRecordArray(payload.evidence, 25);
        const confidence = normalizeGptExperimentConfidence(payload.confidence);
        const isResult = status === "completed" || Boolean(decision) || Boolean(resultNotes);
        const kind: GptStrategyMemoryKind = isResult ? "experiment_result" : "experiment";
        const metadata = {
          status,
          decision,
          success_criteria: successCriteria,
          sample_size_target: sampleSizeTarget || null,
          start_date: normalizeGptIsoDateText(payload.start_date),
          end_date: normalizeGptIsoDateText(payload.end_date),
          related_memory_id: Number.isInteger(relatedMemoryId) && relatedMemoryId > 0 ? relatedMemoryId : null,
          related_saved_pattern_ids: normalizeGptNumberArray(payload.related_saved_pattern_ids, 25),
          related_generation_run_ids: normalizeGptStringIdArray(payload.related_generation_run_ids, 25, 100),
          evidence,
          confidence,
          review_after: reviewAfter,
          flexible_note: "Use this as a learning loop for growth, not a rigid creative category.",
          sample_size_caution: "Do not promote this to a durable rule until evidence quality and sample size support it.",
          ...(payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
            ? payload.metadata
            : {}),
        };
        const body = [
          `Hypothesis: ${hypothesis}`,
          successCriteria.length ? `Success criteria: ${successCriteria.join(" | ")}` : null,
          sampleSizeTarget > 0 ? `Sample size target: ${sampleSizeTarget}` : null,
          resultNotes ? `Result notes: ${resultNotes}` : null,
          decision ? `Decision: ${decision}` : null,
          confidence ? `Confidence: ${confidence}` : null,
          reviewAfter ? `Review after: ${reviewAfter}` : null,
        ].filter(Boolean).join("\n");
        const memory = await saveGptStrategyMemory(env, {
          accountId: brand.account_id,
          threadsUserId: brand.profile.threads_user_id,
          kind,
          title,
          body,
          metadataJson: normalizeGptMemoryMetadata(metadata),
        });
        return new Response(JSON.stringify({
          success: true,
          brand_key: brand.brand_key,
          memory,
          experiment_summary_guidance: [
            "Read generation-context or growth-context after saving experiments to see open tests and recent decisions.",
            "Use experiment results to decide what to exploit, explore, stop, retest, or cool down.",
          ],
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/pattern-adaptation" && request.method === "POST") {
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const brand = await resolveGptBrand(env, payload.brand_key);
        const adaptationNote = normalizeGptMemoryText(payload.adaptation_note, 8000);
        if (!brand || !adaptationNote) {
          return new Response(JSON.stringify({ success: false, error: "brand_key and adaptation_note are required" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }

        const verdictRaw = typeof payload.verdict === "string" ? payload.verdict.trim().toLowerCase() : "adapted";
        const verdict = ["adapted", "approved", "rejected", "cooldown", "retest", "watch"].includes(verdictRaw)
          ? verdictRaw
          : "adapted";
        const kind: GptStrategyMemoryKind = verdict === "approved"
          ? "approved_pattern"
          : verdict === "rejected"
          ? "rejected_pattern"
          : verdict === "cooldown"
          ? "cooldown"
          : "saved_pattern_note";
        const title = normalizeGptMemoryText(payload.title, 200, true)
          ?? `Pattern adaptation: ${verdict}`;
        const savedPatternIds = normalizeGptNumberArray(payload.saved_pattern_ids, 25);
        const archivePostIds = normalizeGptStringIdArray(payload.archive_post_ids, 25, 100);
        const generatedDraftIds = normalizeGptStringIdArray(payload.generated_draft_ids, 25, 100);
        const surfaceChanges = normalizeGptStringArray(payload.surface_changes, 20, 1000);
        const mechanism = normalizeGptMemoryText(payload.mechanism, 1000, true);
        const reason = normalizeGptMemoryText(payload.reason, 4000, true);
        const evidence = normalizeGptRecordArray(payload.evidence, 25);
        const cooldownDays = parseBoundedIntegerParam(
          typeof payload.cooldown_days === "number" || typeof payload.cooldown_days === "string"
            ? String(payload.cooldown_days)
            : null,
          0,
          0,
          365,
        );
        const reviewAfter = cooldownDays > 0
          ? new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000).toISOString()
          : null;
        const metadata = {
          source: "pattern_adaptation",
          verdict,
          saved_pattern_ids: savedPatternIds,
          archive_post_ids: archivePostIds,
          generated_draft_ids: generatedDraftIds,
          mechanism,
          surface_changes: surfaceChanges,
          evidence,
          review_after: reviewAfter,
          flexible_note: "Track mechanism reuse without trapping creativity into rigid categories.",
          ...(payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
            ? payload.metadata
            : {}),
        };
        const body = [
          `Verdict: ${verdict}`,
          mechanism ? `Mechanism: ${mechanism}` : null,
          `Adaptation note: ${adaptationNote}`,
          surfaceChanges.length ? `Surface changes: ${surfaceChanges.join(" | ")}` : null,
          reason ? `Reason: ${reason}` : null,
          reviewAfter ? `Review after: ${reviewAfter}` : null,
        ].filter(Boolean).join("\n");
        const memory = await saveGptStrategyMemory(env, {
          accountId: brand.account_id,
          threadsUserId: brand.profile.threads_user_id,
          kind,
          title,
          body,
          metadataJson: normalizeGptMemoryMetadata(metadata),
        });
        return new Response(JSON.stringify({
          success: true,
          brand_key: brand.brand_key,
          memory,
          adaptation_guidance: [
            "Read getGenerationContext before generating so repeated saved/archive mechanisms are visible.",
            "Copy useful logic, not exact wording.",
            "Cool down overused mechanisms instead of banning them forever.",
          ],
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/scheduled" && request.method === "GET") {
        const brand = await resolveGptBrand(env, url.searchParams.get("brand_key"));
        if (!brand) {
          return new Response(JSON.stringify({ success: false, error: "Unknown or unavailable brand_key" }), {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const scheduledPosts = await listScheduledPostsForHermesContext(env, brand.profile.threads_user_id, 100);
        const tagMap = await listGptPostStrategyTagsForScheduledPosts(env, scheduledPosts.map((post) => post.id));
        return new Response(JSON.stringify({
          success: true,
          brand_key: brand.brand_key,
          account_id: brand.account_id,
          threads_user_id: brand.profile.threads_user_id,
          scheduled_posts: scheduledPosts.map((post) => ({
            ...post,
            strategy: tagMap.get(post.id) ?? null,
          })),
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/schedule" && request.method === "POST") {
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const brand = await resolveGptBrand(env, payload.brand_key);
        const text = normalizeGptMemoryText(payload.text, 20000);
        const date = normalizeGptMemoryText(payload.date, 20);
        const time = normalizeGptMemoryText(payload.time, 20);
        const requestedTimeZone = normalizeGptMemoryText(payload.timezone, 100) ?? WORKSPACE_DEFAULT_TIMEZONE;
        const timeZone = isValidIanaTimezone(requestedTimeZone) ? requestedTimeZone : WORKSPACE_DEFAULT_TIMEZONE;
        const spoilerAllText = normalizeSpoilerFlag(payload.spoiler_all_text);
        const spoilerPhrases = normalizeSpoilerPhrasesInput(payload.spoiler_phrases);
        const strategy = normalizeGptPostStrategyInput(payload.strategy);
        if (!brand || !text || !date || !time) {
          return new Response(JSON.stringify({ success: false, error: "brand_key, text, date, and time are required" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const scheduled = await createScheduledPostForAppUser(
          env,
          WORKSPACE_APP_USER_ID,
          brand.profile.threads_user_id,
          text,
          date,
          time,
          timeZone,
          spoilerAllText,
          spoilerPhrases,
        );
        if (!scheduled.success) {
          return new Response(JSON.stringify({ success: false, error: scheduled.error ?? "schedule_failed" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        if (scheduled.scheduledPostId) {
          await upsertGptPostStrategyTag(env, {
            scheduledPostId: scheduled.scheduledPostId,
            accountId: brand.account_id,
            threadsUserId: brand.profile.threads_user_id,
            strategy,
          });
        }
        return new Response(JSON.stringify({
          success: true,
          brand_key: brand.brand_key,
          account_id: brand.account_id,
          threads_user_id: brand.profile.threads_user_id,
          scheduled_post: {
            id: scheduled.scheduledPostId ?? null,
            status: SCHEDULED_POST_STATUS_APPROVED,
            scheduled_time_utc: scheduled.scheduledTimeUtc ?? null,
            reused: scheduled.reused === true,
            spoiler_all_text: spoilerAllText,
            spoiler_phrases: spoilerPhrases,
            strategy,
          },
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/schedule/batch" && request.method === "POST") {
        let payload: { brand_key?: unknown; timezone?: unknown; date?: unknown; entries?: unknown };
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const brand = await resolveGptBrand(env, payload.brand_key);
        const sharedDate = normalizeGptMemoryText(payload.date, 20);
        const requestedTimeZone = normalizeGptMemoryText(payload.timezone, 100) ?? WORKSPACE_DEFAULT_TIMEZONE;
        const timeZone = isValidIanaTimezone(requestedTimeZone) ? requestedTimeZone : WORKSPACE_DEFAULT_TIMEZONE;
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        if (!brand || !sharedDate || entries.length === 0 || entries.length > MAX_SCHEDULED_POST_MAX_BATCH_SIZE) {
          return new Response(JSON.stringify({ success: false, error: "brand_key, date, and a non-empty entries array are required" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const results = [];
        for (let index = 0; index < entries.length; index += 1) {
          const entry = entries[index] as Record<string, unknown>;
          const text = normalizeGptMemoryText(entry.text, 20000);
          const time = normalizeGptMemoryText(entry.time, 20);
          const date = normalizeGptMemoryText(entry.date, 20) ?? sharedDate;
          const strategy = normalizeGptPostStrategyInput(entry.strategy);
          if (!text || !time || !date) {
            results.push({ row_number: index + 1, success: false, reused: false, scheduled_post_id: null, scheduled_time_utc: null, error: "missing_required_fields" });
            continue;
          }
          const scheduled = await createScheduledPostForAppUser(
            env,
            WORKSPACE_APP_USER_ID,
            brand.profile.threads_user_id,
            text,
            date,
            time,
            timeZone,
            normalizeSpoilerFlag(entry.spoiler_all_text),
            normalizeSpoilerPhrasesInput(entry.spoiler_phrases),
          );
          if (scheduled.success && scheduled.scheduledPostId) {
            await upsertGptPostStrategyTag(env, {
              scheduledPostId: scheduled.scheduledPostId,
              accountId: brand.account_id,
              threadsUserId: brand.profile.threads_user_id,
              strategy,
            });
          }
          results.push({
            row_number: index + 1,
            success: scheduled.success,
            reused: scheduled.reused === true,
            scheduled_post_id: scheduled.scheduledPostId ?? null,
            scheduled_time_utc: scheduled.scheduledTimeUtc ?? null,
            strategy,
            error: scheduled.success ? null : scheduled.error ?? "schedule_failed",
          });
        }
        await saveGptStrategyMemory(env, {
          accountId: brand.account_id,
          threadsUserId: brand.profile.threads_user_id,
          kind: "scheduled_batch",
          title: `Scheduled batch for ${sharedDate}`,
          body: `GPT scheduled ${results.filter((result) => result.success).length} of ${results.length} requested posts for ${brand.brand_key}.`,
          metadataJson: normalizeGptMemoryMetadata({ date: sharedDate, timezone: timeZone, results }),
        });
        return new Response(JSON.stringify({
          success: true,
          brand_key: brand.brand_key,
          account_id: brand.account_id,
          threads_user_id: brand.profile.threads_user_id,
          results,
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/batch-presets" && request.method === "GET") {
        const brand = await resolveGptBrand(env, url.searchParams.get("brand_key"));
        if (!brand) {
          return new Response(JSON.stringify({ success: false, error: "Unknown or unavailable brand_key" }), {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const presets = await listBatchSchedulePresetsForUser(env, WORKSPACE_APP_USER_ID, brand.profile.threads_user_id);
        return new Response(JSON.stringify({ success: true, brand_key: brand.brand_key, presets }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/batch-presets" && request.method === "POST") {
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const brand = await resolveGptBrand(env, payload.brand_key);
        const name = normalizeBatchSchedulePresetName(payload.name);
        const times = normalizeBatchSchedulePresetTimes(payload.times);
        if (!brand || !name || !times) {
          return new Response(JSON.stringify({ success: false, error: "brand_key, name, and valid times are required" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        await ensureWorkspaceUserRecord(env, {
          id: WORKSPACE_APP_USER_ID,
          email: "workspace@lensically.local",
          timezone: WORKSPACE_DEFAULT_TIMEZONE,
          clock_format: "12h",
        });
        await ensureBatchSchedulePresetsTable(env);
        if (payload.is_favorite === true) {
          await env.DB.prepare(
            `UPDATE batch_schedule_presets
             SET is_favorite = 0
             WHERE user_id = ?
               AND threads_user_id = ?`,
          )
            .bind(WORKSPACE_APP_USER_ID, brand.profile.threads_user_id)
            .run();
        }
        const presetId = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO batch_schedule_presets (id, user_id, threads_user_id, name, times_json, is_favorite)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            presetId,
            WORKSPACE_APP_USER_ID,
            brand.profile.threads_user_id,
            name,
            JSON.stringify(times),
            payload.is_favorite === true ? 1 : 0,
          )
          .run();
        const presets = await listBatchSchedulePresetsForUser(env, WORKSPACE_APP_USER_ID, brand.profile.threads_user_id);
        return new Response(JSON.stringify({
          success: true,
          brand_key: brand.brand_key,
          preset: presets.find((preset) => preset.id === presetId) ?? null,
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/strategy-memory" && request.method === "GET") {
        const brand = await resolveGptBrand(env, url.searchParams.get("brand_key"));
        if (!brand) {
          return new Response(JSON.stringify({ success: false, error: "Unknown or unavailable brand_key" }), {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const rawKinds = url.searchParams.getAll("kind").flatMap((value) => value.split(","));
        const limit = parseBoundedIntegerParam(url.searchParams.get("limit"), 60, 1, 100);
        const offset = parseBoundedIntegerParam(url.searchParams.get("offset"), 0, 0, 100000);
        const [memory, totalCount] = await Promise.all([
          listGptStrategyMemory(env, brand.account_id, rawKinds, limit, offset),
          countGptStrategyMemory(env, brand.account_id, rawKinds),
        ]);
        return new Response(JSON.stringify({
          success: true,
          brand_key: brand.brand_key,
          memory,
          total_count: totalCount,
          returned_count: memory.length,
          limit,
          offset,
          has_more: totalCount > offset + memory.length,
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      if (normalizedPath === "/api/gpt/strategy-memory" && request.method === "POST") {
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const brand = await resolveGptBrand(env, payload.brand_key);
        const kind = normalizeGptStrategyMemoryKind(payload.kind);
        const title = normalizeGptMemoryText(payload.title, 200, true);
        const body = normalizeGptMemoryText(payload.body, 10000);
        if (!brand || !kind || !body) {
          return new Response(JSON.stringify({ success: false, error: "brand_key, kind, and body are required" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          });
        }
        const memory = await saveGptStrategyMemory(env, {
          accountId: brand.account_id,
          threadsUserId: brand.profile.threads_user_id,
          kind,
          title,
          body,
          metadataJson: normalizeGptMemoryMetadata(payload.metadata),
        });
        return new Response(JSON.stringify({ success: true, brand_key: brand.brand_key, memory }), {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      return new Response(JSON.stringify({ success: false, error: "GPT route not found" }), {
        status: 404,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

    if (normalizedPath === "/api/gpt-memory/dashboard" && request.method === "GET") {
      const brand = await resolveGptBrandForThreadsUserId(env, url.searchParams.get("threads_user_id"));
      if (!brand) {
        return new Response(JSON.stringify({ success: false, error: "Configured Threads account not found" }), {
          status: 404,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            ...requestCorsHeaders,
          },
        });
      }
      const dashboard = await buildGptMemoryDashboard(env, brand);
      return new Response(JSON.stringify(dashboard), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=UTF-8",
          "Cache-Control": "no-store",
          ...requestCorsHeaders,
        },
      });
    }

    if (normalizedPath === "/api/gpt-memory/rule-review" && request.method === "POST") {
      let payload: Record<string, unknown>;
      try {
        payload = await request.json();
      } catch {
        return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
          status: 400,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            ...requestCorsHeaders,
          },
        });
      }
      const brand = await resolveGptBrandForThreadsUserId(env, payload.threads_user_id);
      const allowedDecisions = new Set(["keep", "revise", "cooldown", "retire", "retest", "promote_to_current_belief", "challenge"]);
      const decision = typeof payload.decision === "string" && allowedDecisions.has(payload.decision.trim().toLowerCase())
        ? payload.decision.trim().toLowerCase()
        : null;
      const reason = normalizeGptMemoryText(payload.reason, 8000);
      if (!brand || !decision || !reason) {
        return new Response(JSON.stringify({ success: false, error: "threads_user_id, valid decision, and reason are required" }), {
          status: 400,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            ...requestCorsHeaders,
          },
        });
      }

      const memoryId = Number(payload.memory_id);
      const reviewedMemoryId = Number.isInteger(memoryId) && memoryId > 0 ? memoryId : null;
      const title = normalizeGptMemoryText(payload.title, 200, true)
        ?? `Rule review: ${decision.replace(/_/g, " ")}`;
      const replacementBelief = normalizeGptMemoryText(payload.replacement_belief, 8000, true);
      const evidence = normalizeGptRecordArray(payload.evidence, 25);
      const reviewAfterDays = parseBoundedIntegerParam(
        typeof payload.review_after_days === "number" || typeof payload.review_after_days === "string"
          ? String(payload.review_after_days)
          : null,
        0,
        0,
        365,
      );
      const reviewAfter = reviewAfterDays > 0
        ? new Date(Date.now() + reviewAfterDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const metadata = {
        reviewed_memory_id: reviewedMemoryId,
        decision,
        evidence,
        review_after: reviewAfter,
        source: "lensically_memory_dashboard",
        flexible_note: "This is a current strategic judgment, not permanent creative law.",
        ...(payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
          ? payload.metadata
          : {}),
      };
      const reviewMemory = await saveGptStrategyMemory(env, {
        accountId: brand.account_id,
        threadsUserId: brand.profile.threads_user_id,
        kind: "rule_review",
        title,
        body: [
          `Decision: ${decision}`,
          reviewedMemoryId ? `Reviewed memory id: ${reviewedMemoryId}` : null,
          `Reason: ${reason}`,
          replacementBelief ? `Replacement belief: ${replacementBelief}` : null,
          reviewAfter ? `Review after: ${reviewAfter}` : null,
        ].filter(Boolean).join("\n"),
        metadataJson: normalizeGptMemoryMetadata(metadata),
      });

      const followUpMemories = [];
      if (replacementBelief && (decision === "revise" || decision === "promote_to_current_belief")) {
        const beliefMemory = await saveGptStrategyMemory(env, {
          accountId: brand.account_id,
          threadsUserId: brand.profile.threads_user_id,
          kind: "current_belief",
          title: normalizeGptMemoryText(payload.title, 200, true) ?? "Current belief",
          body: replacementBelief,
          metadataJson: normalizeGptMemoryMetadata({
            source: "lensically_memory_dashboard",
            rule_review_memory_id: reviewMemory?.id ?? null,
            reviewed_memory_id: reviewedMemoryId,
            review_after: reviewAfter,
            flexible_note: "Use this as a working belief that can be challenged by future data or owner taste.",
          }),
        });
        if (beliefMemory) {
          followUpMemories.push(beliefMemory);
        }
      }
      if (decision === "cooldown") {
        const cooldownMemory = await saveGptStrategyMemory(env, {
          accountId: brand.account_id,
          threadsUserId: brand.profile.threads_user_id,
          kind: "cooldown",
          title: normalizeGptMemoryText(payload.title, 200, true) ?? "Rule cooldown",
          body: reason,
          metadataJson: normalizeGptMemoryMetadata({
            source: "lensically_memory_dashboard",
            rule_review_memory_id: reviewMemory?.id ?? null,
            reviewed_memory_id: reviewedMemoryId,
            review_after: reviewAfter,
            flexible_note: "Pause or reduce this pattern temporarily; retest when context changes.",
          }),
        });
        if (cooldownMemory) {
          followUpMemories.push(cooldownMemory);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        brand_key: brand.brand_key,
        review_memory: reviewMemory,
        follow_up_memory: followUpMemories,
      }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=UTF-8",
          ...requestCorsHeaders,
        },
      });
    }

    if (normalizedPath === "/api/gpt-memory/generation-drafts/update" && request.method === "POST") {
      let payload: Record<string, unknown>;
      try {
        payload = await request.json();
      } catch {
        return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
          status: 400,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            ...requestCorsHeaders,
          },
        });
      }
      const brand = await resolveGptBrandForThreadsUserId(env, payload.threads_user_id);
      const draftId = typeof payload.draft_id === "string" ? payload.draft_id.trim() : "";
      if (!brand || !draftId) {
        return new Response(JSON.stringify({ success: false, error: "threads_user_id and draft_id are required" }), {
          status: 400,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            ...requestCorsHeaders,
          },
        });
      }
      const scheduledPostId = Number(payload.scheduled_post_id);
      const nextStatus = normalizeGptGenerationStatus(payload.status);
      const feedbackNote = normalizeGptMemoryText(payload.feedback_note, 8000, true);
      const draft = await updateGptGenerationDraft(env, {
        draftId,
        accountId: brand.account_id,
        status: nextStatus,
        rejectionReason: normalizeGptMemoryText(payload.rejection_reason, 1000, true),
        scheduledPostId: Number.isInteger(scheduledPostId) && scheduledPostId > 0 ? scheduledPostId : null,
        metadataJson: normalizeGptMemoryMetadata({
          source: "lensically_memory_dashboard",
          ...(payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
            ? payload.metadata
            : {}),
        }),
      });
      const feedbackMemory = draft && feedbackNote && ["approved", "rejected", "self_rejected"].includes(nextStatus)
        ? await saveGptStrategyMemory(env, {
          accountId: brand.account_id,
          threadsUserId: brand.profile.threads_user_id,
          kind: nextStatus === "approved" ? "approval_feedback" : "rejection_feedback",
          title: `Draft ${nextStatus.replace(/_/g, " ")} feedback`,
          body: [
            `Draft id: ${draft.id}`,
            `Status: ${nextStatus}`,
            `Lesson: ${feedbackNote}`,
          ].join("\n"),
          metadataJson: normalizeGptMemoryMetadata({
            source: "lensically_memory_dashboard",
            draft_id: draft.id,
            run_id: draft.run_id,
            status: nextStatus,
            flexible_note: "Use this as owner taste evidence for future generation, not a permanent rule.",
          }),
        })
        : null;
      return new Response(JSON.stringify({
        success: Boolean(draft),
        brand_key: brand.brand_key,
        draft,
        feedback_memory: feedbackMemory,
      }), {
        status: draft ? 200 : 404,
        headers: {
          "content-type": "application/json; charset=UTF-8",
          ...requestCorsHeaders,
        },
      });
    }

    if (normalizedPath === "/api/gpt-memory/saved-patterns/review" && request.method === "POST") {
      let payload: Record<string, unknown>;
      try {
        payload = await request.json();
      } catch {
        return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
          status: 400,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            ...requestCorsHeaders,
          },
        });
      }
      const brand = await resolveGptBrandForThreadsUserId(env, payload.threads_user_id);
      const savedPatternIds = normalizeGptNumberArray(payload.saved_pattern_ids, 25);
      const verdictRaw = typeof payload.verdict === "string" ? payload.verdict.trim().toLowerCase() : "";
      const verdict = ["approved", "rejected", "cooldown", "retest", "watch", "adapted"].includes(verdictRaw)
        ? verdictRaw
        : null;
      const note = normalizeGptMemoryText(payload.note, 8000, true);
      if (!brand || !savedPatternIds.length || !verdict) {
        return new Response(JSON.stringify({ success: false, error: "threads_user_id, saved_pattern_ids, and valid verdict are required" }), {
          status: 400,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            ...requestCorsHeaders,
          },
        });
      }

      const cooldownDays = parseBoundedIntegerParam(
        typeof payload.cooldown_days === "number" || typeof payload.cooldown_days === "string"
          ? String(payload.cooldown_days)
          : null,
        0,
        0,
        365,
      );
      const reviewAfter = cooldownDays > 0
        ? new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const kind: GptStrategyMemoryKind = verdict === "approved"
        ? "approved_pattern"
        : verdict === "rejected"
        ? "rejected_pattern"
        : verdict === "cooldown"
        ? "cooldown"
        : "saved_pattern_note";
      const title = normalizeGptMemoryText(payload.title, 200, true)
        ?? `Saved pattern review: ${verdict}`;
      const mechanism = normalizeGptMemoryText(payload.mechanism, 1000, true);
      const reason = normalizeGptMemoryText(payload.reason, 4000, true);
      const memory = await saveGptStrategyMemory(env, {
        accountId: brand.account_id,
        threadsUserId: brand.profile.threads_user_id,
        kind,
        title,
        body: [
          `Verdict: ${verdict}`,
          `Saved pattern ids: ${savedPatternIds.join(", ")}`,
          mechanism ? `Mechanism: ${mechanism}` : null,
          note ? `Owner note: ${note}` : null,
          reason ? `Reason: ${reason}` : null,
          reviewAfter ? `Review after: ${reviewAfter}` : null,
        ].filter(Boolean).join("\n"),
        metadataJson: normalizeGptMemoryMetadata({
          source: "lensically_saved_patterns",
          verdict,
          saved_pattern_ids: savedPatternIds,
          mechanism,
          reason,
          review_after: reviewAfter,
          flexible_note: "This marks current taste and pattern usefulness without permanently boxing creative direction.",
          ...(payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
            ? payload.metadata
            : {}),
        }),
      });
      return new Response(JSON.stringify({
        success: true,
        brand_key: brand.brand_key,
        memory,
      }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=UTF-8",
          ...requestCorsHeaders,
        },
      });
    }

    if (normalizedPath === "/api/gpt-memory/experiment" && request.method === "POST") {
      let payload: Record<string, unknown>;
      try {
        payload = await request.json();
      } catch {
        return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
          status: 400,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            ...requestCorsHeaders,
          },
        });
      }
      const brand = await resolveGptBrandForThreadsUserId(env, payload.threads_user_id);
      const hypothesis = normalizeGptMemoryText(payload.hypothesis, 8000);
      if (!brand || !hypothesis) {
        return new Response(JSON.stringify({ success: false, error: "threads_user_id and hypothesis are required" }), {
          status: 400,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            ...requestCorsHeaders,
          },
        });
      }

      const status = normalizeGptExperimentStatus(payload.status);
      const decision = normalizeGptExperimentDecision(payload.decision);
      const resultNotes = normalizeGptMemoryText(payload.result_notes, 8000, true);
      const title = normalizeGptMemoryText(payload.title, 200, true)
        ?? normalizeGptMemoryText(payload.experiment_name, 200, true)
        ?? "Growth experiment";
      const successCriteria = normalizeGptStringArray(payload.success_criteria, 20, 1000);
      const sampleSizeTarget = parseBoundedIntegerParam(
        typeof payload.sample_size_target === "number" || typeof payload.sample_size_target === "string"
          ? String(payload.sample_size_target)
          : null,
        0,
        0,
        10000,
      );
      const relatedMemoryId = Number(payload.related_memory_id);
      const reviewAfterDays = parseBoundedIntegerParam(
        typeof payload.review_after_days === "number" || typeof payload.review_after_days === "string"
          ? String(payload.review_after_days)
          : null,
        14,
        0,
        365,
      );
      const reviewAfter = reviewAfterDays > 0
        ? new Date(Date.now() + reviewAfterDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const evidence = normalizeGptRecordArray(payload.evidence, 25);
      const confidence = normalizeGptExperimentConfidence(payload.confidence);
      const isResult = status === "completed" || Boolean(decision) || Boolean(resultNotes);
      const kind: GptStrategyMemoryKind = isResult ? "experiment_result" : "experiment";
      const metadata = {
        status,
        decision,
        success_criteria: successCriteria,
        sample_size_target: sampleSizeTarget || null,
        start_date: normalizeGptIsoDateText(payload.start_date),
        end_date: normalizeGptIsoDateText(payload.end_date),
        related_memory_id: Number.isInteger(relatedMemoryId) && relatedMemoryId > 0 ? relatedMemoryId : null,
        related_saved_pattern_ids: normalizeGptNumberArray(payload.related_saved_pattern_ids, 25),
        related_generation_run_ids: normalizeGptStringIdArray(payload.related_generation_run_ids, 25, 100),
        evidence,
        confidence,
        review_after: reviewAfter,
        source: "lensically_memory_dashboard",
        flexible_note: "Use this as a learning loop for growth, not a rigid creative category.",
        sample_size_caution: "Do not promote this to a durable rule until evidence quality and sample size support it.",
        ...(payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
          ? payload.metadata
          : {}),
      };
      const body = [
        `Hypothesis: ${hypothesis}`,
        successCriteria.length ? `Success criteria: ${successCriteria.join(" | ")}` : null,
        sampleSizeTarget > 0 ? `Sample size target: ${sampleSizeTarget}` : null,
        resultNotes ? `Result notes: ${resultNotes}` : null,
        decision ? `Decision: ${decision}` : null,
        confidence ? `Confidence: ${confidence}` : null,
        reviewAfter ? `Review after: ${reviewAfter}` : null,
      ].filter(Boolean).join("\n");
      const memory = await saveGptStrategyMemory(env, {
        accountId: brand.account_id,
        threadsUserId: brand.profile.threads_user_id,
        kind,
        title,
        body,
        metadataJson: normalizeGptMemoryMetadata(metadata),
      });
      return new Response(JSON.stringify({
        success: true,
        brand_key: brand.brand_key,
        memory,
      }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=UTF-8",
          ...requestCorsHeaders,
        },
      });
    }

    if (normalizedPath === "/api/gpt-memory/taste-feedback" && request.method === "POST") {
      let payload: Record<string, unknown>;
      try {
        payload = await request.json();
      } catch {
        return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
          status: 400,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            ...requestCorsHeaders,
          },
        });
      }
      const brand = await resolveGptBrandForThreadsUserId(env, payload.threads_user_id);
      const allowedTasteKinds = new Set<GptStrategyMemoryKind>([
        "taste_profile",
        "approval_feedback",
        "rejection_feedback",
        "brand_voice_note",
        "current_belief",
        "banned_phrase",
        "cooldown",
      ]);
      const requestedKind = normalizeGptStrategyMemoryKind(payload.feedback_type);
      const kind = requestedKind && allowedTasteKinds.has(requestedKind) ? requestedKind : "taste_profile";
      const lesson = normalizeGptMemoryText(payload.lesson, 8000);
      if (!brand || !lesson) {
        return new Response(JSON.stringify({ success: false, error: "threads_user_id and lesson are required" }), {
          status: 400,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            ...requestCorsHeaders,
          },
        });
      }

      const title = normalizeGptMemoryText(payload.title, 200, true)
        ?? `${kind.replace(/_/g, " ")} feedback`;
      const liked = normalizeGptStringArray(payload.liked, 20, 1000);
      const disliked = normalizeGptStringArray(payload.disliked, 20, 1000);
      const examples = normalizeGptRecordArray(payload.examples, 20);
      const confidence = normalizeGptMemoryText(payload.confidence, 20, true);
      const reviewAfterDays = parseBoundedIntegerParam(
        typeof payload.review_after_days === "number" || typeof payload.review_after_days === "string"
          ? String(payload.review_after_days)
          : null,
        0,
        0,
        365,
      );
      const reviewAfter = reviewAfterDays > 0
        ? new Date(Date.now() + reviewAfterDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const memory = await saveGptStrategyMemory(env, {
        accountId: brand.account_id,
        threadsUserId: brand.profile.threads_user_id,
        kind,
        title,
        body: [
          `Lesson: ${lesson}`,
          liked.length ? `What worked: ${liked.join(" | ")}` : null,
          disliked.length ? `What did not work: ${disliked.join(" | ")}` : null,
          reviewAfter ? `Review after: ${reviewAfter}` : null,
        ].filter(Boolean).join("\n"),
        metadataJson: normalizeGptMemoryMetadata({
          source: "lensically_memory_dashboard",
          confidence: confidence || null,
          liked,
          disliked,
          examples,
          review_after: reviewAfter,
          flexible_note: "Use this as owner taste evidence, not a rigid creative category.",
          ...(payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
            ? payload.metadata
            : {}),
        }),
      });
      return new Response(JSON.stringify({
        success: true,
        brand_key: brand.brand_key,
        memory,
      }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=UTF-8",
          ...requestCorsHeaders,
        },
      });
    }

    if (normalizedPath === "/api/gpt-memory/generation-brief" && request.method === "POST") {
      let payload: Record<string, unknown>;
      try {
        payload = await request.json();
      } catch {
        return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
          status: 400,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            ...requestCorsHeaders,
          },
        });
      }
      const brand = await resolveGptBrandForThreadsUserId(env, payload.threads_user_id);
      if (!brand) {
        return new Response(JSON.stringify({ success: false, error: "threads_user_id is required" }), {
          status: 400,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            ...requestCorsHeaders,
          },
        });
      }
      const objective = normalizeGptMemoryText(payload.objective, 1000, true);
      const batchSize = normalizeGptBatchSize(payload.batch_size, 8);
      const context = await buildGptGenerationContext(env, brand, {
        objective,
        draftText: null,
        recentLimit: 8,
        recentOffset: 0,
        topLimit: 8,
        topOffset: 0,
        weakLimit: 4,
        weakOffset: 0,
        savedPatternsLimit: 10,
        savedPatternsOffset: 0,
        memoryLimit: 50,
        memoryOffset: 0,
        runsLimit: 4,
        runsOffset: 0,
        approvedDraftsLimit: 12,
        approvedDraftsOffset: 0,
        rejectedDraftsLimit: 12,
        rejectedDraftsOffset: 0,
        growthDays: 14,
        compact: true,
      });
      const shouldCreateRun = payload.create_run === true;
      const run = shouldCreateRun
        ? await createGptGenerationRun(env, {
          accountId: brand.account_id,
          threadsUserId: brand.profile.threads_user_id,
          objective,
          promptSummary: normalizeGptMemoryText(payload.prompt_summary, 2000, true)
            ?? `Lensically dashboard generation brief for ${brand.brand_key}`,
          metadataJson: normalizeGptMemoryMetadata({
            source: "lensically_memory_dashboard",
            batch_size: batchSize,
            workflow_version: "generation_brief_v1",
            ...(payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
              ? payload.metadata
              : {}),
          }),
        })
        : null;
      const brief = buildGptGenerationWorkflowBrief(brand, {
        objective,
        batchSize,
        context,
        run,
      });
      return new Response(JSON.stringify(brief), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=UTF-8",
          "Cache-Control": "no-store",
          ...requestCorsHeaders,
        },
      });
    }

    if (normalizedPath === "/api/patterns/import" && request.method === "POST") {
      let payload: Record<string, unknown>;
      try {
        payload = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const appUserId = normalizeAppUserId(
        typeof payload.app_user_id === "string" ? payload.app_user_id : null,
      );
      if (!appUserId) {
        return new Response(JSON.stringify({ error: "app_user_id is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const accountId = await resolvePatternAccountId(
          env,
          typeof payload.threads_user_id === "string" ? payload.threads_user_id : null,
          typeof payload.account_id === "string" ? payload.account_id : null,
        );
        const imported = await importExternalPattern(env, appUserId, accountId, payload);
        return new Response(JSON.stringify({
          success: true,
          app_user_id: appUserId,
          account_id: accountId,
          updated_at: imported.updated_at,
          pattern: imported,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        const message = getErrorMessage(error);
        const status = message === "source_url and post_text are required" ? 400 : 500;
        return new Response(JSON.stringify({ error: message }), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    if (normalizedPath === "/api/patterns/list" && request.method === "GET") {
      const appUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));
      if (!appUserId) {
        return new Response(JSON.stringify({ error: "app_user_id is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const rawLimit = Number(url.searchParams.get("limit") ?? "50");
      const limit = Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), 200)
        : 50;
      const rawPage = Number(url.searchParams.get("page") ?? "1");
      const page = Number.isFinite(rawPage) && rawPage > 0
        ? Math.max(1, Math.floor(rawPage))
        : 1;
      const offset = (page - 1) * limit;
      const requestedOrder = String(url.searchParams.get("order") ?? "newest").trim().toLowerCase();
      const order = requestedOrder === "likes" ? "likes" : "newest";
      const accountId = await resolvePatternAccountId(
        env,
        url.searchParams.get("threads_user_id"),
        url.searchParams.get("account_id"),
      );

      await ensureExternalPatternsTable(env);
      const listSql = order === "likes"
        ? `SELECT id, app_user_id, account_id, platform, source_url, post_id, author_handle, author_display_name,
                  post_text, likes, replies, reposts, shares, views, posted_at, capture_confidence,
                  raw_payload, saved_at, updated_at
           FROM external_patterns
           WHERE app_user_id = ? AND account_id = ?
           ORDER BY likes DESC, COALESCE(views, 0) DESC, datetime(updated_at) DESC, id DESC
           LIMIT ? OFFSET ?`
        : `SELECT id, app_user_id, account_id, platform, source_url, post_id, author_handle, author_display_name,
                  post_text, likes, replies, reposts, shares, views, posted_at, capture_confidence,
                  raw_payload, saved_at, updated_at
           FROM external_patterns
           WHERE app_user_id = ? AND account_id = ?
           ORDER BY datetime(updated_at) DESC, id DESC
           LIMIT ? OFFSET ?`;
      const rows = await env.DB.prepare(listSql)
        .bind(appUserId, accountId, limit, offset)
        .all<ExternalPatternRow>();

      const totalRow = await env.DB.prepare(
        `SELECT COUNT(*) AS total
         FROM external_patterns
         WHERE app_user_id = ? AND account_id = ?`,
      )
        .bind(appUserId, accountId)
        .first<{ total: number | string }>();

      const total = Number(totalRow?.total ?? 0);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      const sanitizedRows = (rows.results ?? []).map(sanitizeExternalPatternRow);

      return new Response(JSON.stringify({
        success: true,
        app_user_id: appUserId,
        account_id: accountId,
        order,
        total,
        page,
        page_size: limit,
        total_pages: totalPages,
        patterns: sanitizedRows,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (normalizedPath === "/api/patterns/delete" && request.method === "POST") {
      let payload: {
        app_user_id?: unknown;
        account_id?: unknown;
        threads_user_id?: unknown;
        ids?: unknown;
      };
      try {
        payload = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const appUserId = normalizeAppUserId(
        typeof payload.app_user_id === "string" ? payload.app_user_id : null,
      );
      if (!appUserId) {
        return new Response(JSON.stringify({ error: "app_user_id is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const ids = Array.isArray(payload.ids) ? payload.ids.map((value) => Number(value)) : [];
      const accountId = await resolvePatternAccountId(
        env,
        typeof payload.threads_user_id === "string" ? payload.threads_user_id : null,
        typeof payload.account_id === "string" ? payload.account_id : null,
      );
      const deleted = await deleteExternalPatterns(env, appUserId, accountId, ids);

      return new Response(JSON.stringify({
        success: true,
        app_user_id: appUserId,
        account_id: accountId,
        deleted,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (normalizedPath === "/api/batch-schedule/presets" && request.method === "GET") {
      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        return applyAuthCors(authUser);
      }

      const threadsUserId = url.searchParams.get("threads_user_id")?.trim() || "";
      const account = await getThreadsAccountForAppUser(env, authUser.id, threadsUserId || null);
      if (!threadsUserId || !account?.threads_user_id || account.threads_user_id !== threadsUserId) {
        return applyAuthCors(new Response(JSON.stringify({ error: "Threads account not connected" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }));
      }

      const presets = await listBatchSchedulePresetsForUser(env, authUser.id, threadsUserId);
      return applyAuthCors(new Response(JSON.stringify({
        success: true,
        presets,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    }

    if ((normalizedPath === "/internal/batch-schedule/presets" || normalizedPath === "/api/internal/batch-schedule/presets") && request.method === "GET") {
      if (!isInternalRequestAuthorized(request, env)) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "content-type": "application/json; charset=UTF-8" } },
        );
      }

      const threadsUserId = url.searchParams.get("threads_user_id")?.trim() || "";
      const presets = threadsUserId
        ? await listBatchSchedulePresetsForUser(env, WORKSPACE_APP_USER_ID, threadsUserId)
        : [];
      return new Response(JSON.stringify({
        success: true,
        presets,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
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
        threads_user_id?: string;
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
      const threadsUserId = payload.threads_user_id?.trim() ?? "";
      if (!name || !times || !threadsUserId) {
        return applyAuthCors(new Response(JSON.stringify({
          error: "threads_user_id, name, and a valid ordered times array are required",
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }));
      }

      const account = await getThreadsAccountForAppUser(env, authUser.id, threadsUserId);
      if (!account?.threads_user_id || account.threads_user_id !== threadsUserId) {
        return applyAuthCors(new Response(JSON.stringify({ error: "Threads account not connected" }), {
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
         WHERE user_id = ?
           AND threads_user_id = ?`,
      )
        .bind(authUser.id, threadsUserId)
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
           WHERE user_id = ?
             AND threads_user_id = ?`,
        )
          .bind(authUser.id, threadsUserId)
          .run();
      }

      const presetId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO batch_schedule_presets (id, user_id, threads_user_id, name, times_json, is_favorite)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          presetId,
          authUser.id,
          threadsUserId,
          name,
          JSON.stringify(times),
          isFavorite ? 1 : 0,
        )
        .run();

      const presets = await listBatchSchedulePresetsForUser(env, authUser.id, threadsUserId);
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
      const threadsUserId = url.searchParams.get("threads_user_id")?.trim() || "";
      const account = await getThreadsAccountForAppUser(env, authUser.id, threadsUserId || null);
      if (!threadsUserId || !account?.threads_user_id || account.threads_user_id !== threadsUserId) {
        return applyAuthCors(new Response(JSON.stringify({ error: "Threads account not connected" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }));
      }

      await ensureBatchSchedulePresetsTable(env);
      const existingPreset = await env.DB.prepare(
        `SELECT id
         FROM batch_schedule_presets
         WHERE id = ?
           AND user_id = ?
           AND threads_user_id = ?
         LIMIT 1`,
      )
        .bind(presetId, authUser.id, threadsUserId)
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
         WHERE user_id = ?
           AND threads_user_id = ?`,
      )
        .bind(authUser.id, threadsUserId)
        .run();

      await env.DB.prepare(
        `UPDATE batch_schedule_presets
         SET is_favorite = 1
         WHERE id = ?
           AND user_id = ?
           AND threads_user_id = ?`,
      )
        .bind(presetId, authUser.id, threadsUserId)
        .run();

      const presets = await listBatchSchedulePresetsForUser(env, authUser.id, threadsUserId);
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

      const threadsUserId = url.searchParams.get("threads_user_id")?.trim() || "";
      const account = await getThreadsAccountForAppUser(env, authUser.id, threadsUserId || null);
      if (!threadsUserId || !account?.threads_user_id || account.threads_user_id !== threadsUserId) {
        return applyAuthCors(new Response(JSON.stringify({ error: "Threads account not connected" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }));
      }

      await ensureBatchSchedulePresetsTable(env);
      const deleteResult = await env.DB.prepare(
        `DELETE FROM batch_schedule_presets
         WHERE id = ?
           AND user_id = ?
           AND threads_user_id = ?`,
      )
        .bind(deletePresetMatch[1], authUser.id, threadsUserId)
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
      const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
      const configuredAccounts = await getConfiguredThreadsProfiles(env);
      if (configuredAccounts.length > 0) {
        const activeAccount = configuredAccounts.find((account) => selectedThreadsUserId && account.threads_user_id === selectedThreadsUserId)
          ?? configuredAccounts.find((account) => account.is_active)
          ?? configuredAccounts[0];

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

      const account = await getThreadsAccountForAppUserWithRetry(env, ownedAppUserId, selectedThreadsUserId);
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
      const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
      const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);

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
      const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
      const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);

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
      const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
      const configuredAccounts = await getConfiguredThreadsProfiles(env);
      if (configuredAccounts.length > 0) {
        const activeAccount = configuredAccounts.find((account) => selectedThreadsUserId && account.threads_user_id === selectedThreadsUserId)
          ?? configuredAccounts.find((account) => account.is_active)
          ?? configuredAccounts[0];

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

    if (url.pathname === "/api/agent/accounts" && request.method === "GET") {
      const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
      const accounts = await listAgentAccountControls(env);
      const filteredAccounts = selectedThreadsUserId
        ? accounts.filter((account) => account.threads_user_id === selectedThreadsUserId)
        : accounts;
      return new Response(
        JSON.stringify({
          success: true,
          accounts: filteredAccounts,
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

    if (url.pathname === "/api/agent/accounts/toggle" && request.method === "POST") {
      let payload: {
        account_id?: string;
        threads_user_id?: string;
        enabled?: boolean;
      };
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

      const account = await setAgentAccountEnabled(
        env,
        String(payload.account_id ?? ""),
        payload.enabled === true,
      );
      if (!account) {
        return new Response(
          JSON.stringify({ error: "Configured Threads account not found" }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              ...requestCorsHeaders,
            },
          },
        );
      }

      const selectedThreadsUserId = typeof payload.threads_user_id === "string" ? payload.threads_user_id.trim() : "";
      const accounts = await listAgentAccountControls(env);
      const filteredAccounts = selectedThreadsUserId
        ? accounts.filter((control) => control.threads_user_id === selectedThreadsUserId)
        : accounts;
      return new Response(
        JSON.stringify({
          success: true,
          account,
          accounts: filteredAccounts,
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
      const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);
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
        env,
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
      const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);
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

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId, threadsUserId?.trim() || null);

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
      const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);

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

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId, url.searchParams.get("threads_user_id")?.trim() || null);

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


    if (
      (url.pathname === "/api/threads/publish" || url.pathname === "/api/threads/post-now")
      && request.method === "POST"
    ) {
      let payload: {
        app_user_id?: string;
        threads_user_id?: string;
        text?: string;
        spoiler_all_text?: boolean;
        spoiler_phrases?: string[];
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
      const spoilerAllText = normalizeSpoilerFlag(payload.spoiler_all_text);
      const spoilerPhrases = normalizeSpoilerPhrasesInput(payload.spoiler_phrases);

      if (!threadsUserId || !text) {
        return new Response(
          JSON.stringify({ error: "threads_user_id and text are required" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
      const spoilerValidationError = validateTextSpoilerConfig(text, spoilerAllText, spoilerPhrases);
      if (spoilerValidationError) {
        return new Response(
          JSON.stringify({ error: spoilerValidationError }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const ownedAppUserId = WORKSPACE_APP_USER_ID;

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId, threadsUserId);

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
      const spoilerFingerprint = buildSpoilerFingerprint(spoilerAllText, spoilerPhrases);
      const requestHash = await buildImmediatePublishRequestHash(
        ownedAppUserId,
        account.threads_user_id,
        text,
        spoilerFingerprint,
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
        spoilerAllText,
        spoilerPhrases,
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
          spoiler_all_text?: boolean;
          spoiler_phrases?: string[];
        }>;
      };
      try {
        payload = await request.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
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

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId, threadsUserId);
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
        const spoilerAllText = normalizeSpoilerFlag(entry?.spoiler_all_text);
        const spoilerPhrases = normalizeSpoilerPhrasesInput(entry?.spoiler_phrases);

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
          spoilerAllText,
          spoilerPhrases,
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

    if (url.pathname === "/api/hermes/generate-posts" && request.method === "POST") {
      const authUser = await requireAuth(request, env);
      if (authUser instanceof Response) {
        return authUser;
      }

      let payload: {
        threads_user_id?: string;
        count?: unknown;
        topic?: string;
      };
      try {
        payload = await request.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
          },
        );
      }

      const threadsUserId = payload.threads_user_id?.trim();
      const count = normalizeHermesPostCount(payload.count);
      const topic = payload.topic?.trim() || null;
      if (!threadsUserId) {
        return new Response(
          JSON.stringify({ error: "threads_user_id is required" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
          },
        );
      }

      const ownedAppUserId = authUser.id || WORKSPACE_APP_USER_ID;
      const account = await getThreadsAccountForAppUser(env, ownedAppUserId, threadsUserId);
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
            headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
          },
        );
      }

      const cachedProfile = await getFreshThreadsProfileCache(env, threadsUserId);
      const [archiveRecent, archiveTop, scheduledPosts, savedPatterns] = await Promise.all([
        listArchivedThreadsPosts(env, threadsUserId, "recent", HERMES_CONTEXT_ARCHIVE_LIMIT, 0),
        listArchivedThreadsPosts(env, threadsUserId, "top", HERMES_CONTEXT_ARCHIVE_LIMIT, 0),
        listScheduledPostsForHermesContext(env, threadsUserId, HERMES_MAX_POST_COUNT),
        listSavedPatternsForHermes(env, threadsUserId, HERMES_CONTEXT_PATTERN_LIMIT),
      ]);

      try {
        const generated = await generateHermesPosts({
          env,
          count,
          account: {
            username: cachedProfile?.username ?? null,
            name: cachedProfile?.name ?? null,
            threads_biography: cachedProfile?.threads_biography ?? null,
          },
          topic,
          archiveRecent: archiveRecent.posts,
          archiveTop: archiveTop.posts,
          scheduledPosts,
          savedPatterns: savedPatterns.patterns,
        });

        return new Response(
          JSON.stringify({
            success: true,
            model: generated.model,
            posts: generated.posts,
            context_summary: {
              archive_recent: archiveRecent.posts.length,
              archive_top: archiveTop.posts.length,
              scheduled_posts: scheduledPosts.length,
              saved_patterns: savedPatterns.patterns.length,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
          },
        );
      } catch (error) {
        logWorkerEvent("HERMES_GENERATION_FAILURE", {
          threads_user_id: threadsUserId,
          message: getErrorMessage(error),
        });
        return new Response(
          JSON.stringify({ error: getErrorMessage(error) || "Could not generate posts." }),
          {
            status: 502,
            headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
          },
        );
      }
    }

    if (url.pathname === "/api/threads/schedule" && request.method === "POST") {
      let payload: {
        app_user_id?: string;
        threads_user_id?: string;
        text?: string;
        date?: string;
        time?: string;
        timezone?: string;
        spoiler_all_text?: boolean;
        spoiler_phrases?: string[];
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
      const spoilerAllText = normalizeSpoilerFlag(payload.spoiler_all_text);
      const spoilerPhrases = normalizeSpoilerPhrasesInput(payload.spoiler_phrases);

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

      const account = await getThreadsAccountForAppUser(env, ownedAppUserId, threadsUserId);
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
        buildSpoilerFingerprint(spoilerAllText, spoilerPhrases),
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
              spoiler_all_text: spoilerAllText,
              spoiler_phrases: spoilerPhrases,
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
            spoiler_all_text,
            spoiler_phrases_json,
            status,
            scheduled_time,
            idempotency_key
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            ownedAppUserId,
            threadsUserId,
            text,
            spoilerAllText ? 1 : 0,
            serializeSpoilerPhrases(spoilerPhrases),
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
              spoiler_all_text: spoilerAllText,
              spoiler_phrases: spoilerPhrases,
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
            spoiler_all_text: spoilerAllText,
            spoiler_phrases: spoilerPhrases,
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
        spoiler_all_text?: boolean;
        spoiler_phrases?: string[];
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
      const spoilerAllText = normalizeSpoilerFlag(payload.spoiler_all_text);
      const spoilerPhrases = normalizeSpoilerPhrasesInput(payload.spoiler_phrases);

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
      const spoilerValidationError = validateTextSpoilerConfig(text, spoilerAllText, spoilerPhrases);
      if (spoilerValidationError) {
        return new Response(
          JSON.stringify({ error: spoilerValidationError }),
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
        buildSpoilerFingerprint(spoilerAllText, spoilerPhrases),
      );

      try {
        const result = await env.DB.prepare(
          `UPDATE scheduled_posts
           SET post_text = ?,
               spoiler_all_text = ?,
               spoiler_phrases_json = ?,
               scheduled_time = ?,
               idempotency_key = ?
           WHERE id = ?
             AND user_id = ?
             AND status = ?`,
        )
          .bind(
            text,
            spoilerAllText ? 1 : 0,
            serializeSpoilerPhrases(spoilerPhrases),
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
            spoiler_all_text: spoilerAllText,
            spoiler_phrases: spoilerPhrases,
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
        `SELECT id, user_id, threads_user_id, post_text, status, spoiler_all_text, spoiler_phrases_json
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
          spoiler_all_text: number | null;
          spoiler_phrases_json: string | null;
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
        spoiler_all_text: scheduledPost.spoiler_all_text,
        spoiler_phrases_json: scheduledPost.spoiler_phrases_json,
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
      const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;

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
        `SELECT id, post_text, status, scheduled_time, spoiler_all_text, spoiler_phrases_json, publish_error_message, last_attempted_at, processing_started_at
         FROM scheduled_posts
         WHERE user_id = ?
           AND (? IS NULL OR threads_user_id = ?)
           AND status IN (?, ?)
         ORDER BY scheduled_time ASC, id ASC
         LIMIT 100`,
      )
        .bind(
          ownedAppUserId,
          selectedThreadsUserId,
          selectedThreadsUserId,
          SCHEDULED_POST_STATUS_APPROVED,
          SCHEDULED_POST_STATUS_POSTING,
        )
        .all<{
          id: number | string;
          post_text: string;
          status: string;
          scheduled_time: string;
          spoiler_all_text: number | null;
          spoiler_phrases_json: string | null;
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
            spoiler_all_text: row.spoiler_all_text === 1,
            spoiler_phrases: parseSpoilerPhrasesJson(row.spoiler_phrases_json),
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

    if (
      (url.pathname === "/api/automation/context" || url.pathname === "/internal/automation/context")
      && request.method === "GET"
    ) {
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

      const [batchPresets, recentArchive, topArchive, scheduledPosts] = await Promise.all([
        listBatchSchedulePresetsForUser(env, WORKSPACE_APP_USER_ID, configuredProfile.threads_user_id),
        listArchivedThreadsPosts(env, configuredProfile.threads_user_id, "recent", 48, 0),
        listArchivedThreadsPosts(env, configuredProfile.threads_user_id, "top", 48, 0),
        listScheduledPostsForThreadsAccountOnLocalDate(
          env,
          configuredProfile.threads_user_id,
          targetDate,
          timeZone,
        ),
      ]);
      const selectedBatchPreset = pickPreferredBatchSchedulePreset(batchPresets);
      const agentControls = await listAgentAccountControls(env);
      const agentControl = agentControls.find((control) => control.account_id === configuredAccount.id) ?? null;
      const agentScheduleSlots = agentControl?.agent_schedule_slots ?? [];
      const desiredSlots = agentScheduleSlots.length
        ? agentScheduleSlots
        : selectedBatchPreset?.times?.length
        ? selectedBatchPreset.times
        : buildHourlySlotTimes(7, 23);
      const slotSource = agentScheduleSlots.length
        ? "agent_account_config"
        : selectedBatchPreset
          ? "lensically_batch_preset"
          : "default_hourly_fallback";

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
          agent: {
            enabled: agentControl?.agent_enabled ?? false,
            content_brief: agentControl?.agent_content_brief ?? null,
            schedule_slots: agentScheduleSlots,
          },
          batch_preset: selectedBatchPreset
            ? {
                id: selectedBatchPreset.id,
                name: selectedBatchPreset.name,
                times: selectedBatchPreset.times,
                is_favorite: selectedBatchPreset.is_favorite,
              }
            : null,
          slot_source: slotSource,
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

    if (
      (url.pathname === "/api/automation/schedule-plan" || url.pathname === "/internal/automation/schedule-plan")
      && request.method === "POST"
    ) {
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
