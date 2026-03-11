type AuthRateLimitEnv = {
  DB: D1Database;
};

export type AuthRateLimitRoute =
  | "login"
  | "register"
  | "forgot-password"
  | "reset-password"
  | "delete-account";

type AuthRateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

type AllowedRateLimitResult = {
  allowed: true;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type BlockedRateLimitResult = {
  allowed: false;
  limit: number;
  remaining: 0;
  resetAt: number;
  retryAfterSeconds: number;
  error: string;
};

export type AuthRateLimitResult = AllowedRateLimitResult | BlockedRateLimitResult;

const MINUTE_MS = 60 * 1000;
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;

const AUTH_RATE_LIMITS: Record<AuthRateLimitRoute, AuthRateLimitConfig> = {
  login: { maxRequests: 10, windowMs: 10 * MINUTE_MS },
  register: { maxRequests: 5, windowMs: 15 * MINUTE_MS },
  "forgot-password": { maxRequests: 5, windowMs: 15 * MINUTE_MS },
  "reset-password": { maxRequests: 5, windowMs: 15 * MINUTE_MS },
  "delete-account": { maxRequests: 3, windowMs: 15 * MINUTE_MS },
};

function getClientIp(request: Request): string {
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

function normalizeUserAgent(request: Request): string {
  const userAgent = request.headers.get("User-Agent")?.trim().toLowerCase();
  if (!userAgent) {
    return "unknown";
  }

  return userAgent.replace(/\s+/g, " ").slice(0, 180);
}

function buildBucketKey(route: AuthRateLimitRoute, request: Request): string {
  return `${route}:${getClientIp(request)}:${normalizeUserAgent(request)}`;
}

export function getAuthRateLimitHeaders(result: AuthRateLimitResult): Record<string, string> {
  return {
    "Retry-After": String(result.retryAfterSeconds),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

export async function enforceAuthRateLimit(
  env: AuthRateLimitEnv,
  request: Request,
  route: AuthRateLimitRoute,
): Promise<AuthRateLimitResult> {
  const config = AUTH_RATE_LIMITS[route];
  const now = Date.now();
  const resetWindowBefore = now - config.windowMs;
  const bucketKey = buildBucketKey(route, request);

  await env.DB.prepare(
    `DELETE FROM auth_rate_limits
     WHERE updated_at < ?`,
  )
    .bind(now - RATE_LIMIT_RETENTION_MS)
    .run();

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
    .bind(bucketKey, route, now, now, resetWindowBefore, resetWindowBefore)
    .first<{ request_count: number; window_started_at: number }>();

  const requestCount = Number(row?.request_count ?? 1);
  const windowStartedAt = Number(row?.window_started_at ?? now);
  const resetAt = windowStartedAt + config.windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

  if (requestCount > config.maxRequests) {
    return {
      allowed: false,
      error: "Too many attempts. Please wait a few minutes and try again.",
      limit: config.maxRequests,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - requestCount),
    resetAt,
    retryAfterSeconds,
  };
}
