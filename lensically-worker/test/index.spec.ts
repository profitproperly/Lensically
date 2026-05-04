import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src";
import authSchema from "../db/auth_schema.sql?raw";
import accountDeletionGuardsMigration from "../migrations/account_deletion_guards.sql?raw";
import appThreadsAccountsMigration from "../migrations/app_threads_accounts.sql?raw";
import limitsMigration from "../migrations/limits.sql?raw";
import threadsProfileCacheMigration from "../migrations/threads_profile_cache.sql?raw";
import usageDailyMigration from "../migrations/usage_daily.sql?raw";
import {
  createDeletionTombstones,
  evaluateIdentityAccess,
} from "../auth/identityControl.js";

const schemaSql = authSchema
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .replace(/^\s+/, "")
  .replace(/\r?\n+/g, " ");

function normalizeSqlScript(script: string): string {
  return script
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .replace(/^\s+/, "")
    .replace(/\r?\n+/g, " ");
}

const accountDeletionGuardsSql = normalizeSqlScript(accountDeletionGuardsMigration);
const appThreadsAccountsSql = normalizeSqlScript(appThreadsAccountsMigration);
const limitsSql = normalizeSqlScript(limitsMigration);
const threadsProfileCacheSql = normalizeSqlScript(threadsProfileCacheMigration);
const usageDailySql = normalizeSqlScript(usageDailyMigration);
const createThreadsAccountsTableSql = [
  "CREATE TABLE IF NOT EXISTS threads_accounts (",
  "threads_user_id TEXT PRIMARY KEY,",
  "access_token TEXT NOT NULL,",
  "expires_at INTEGER NOT NULL,",
  "created_at INTEGER NOT NULL",
  ");",
].join(" ");

const resetStatements = `
  DELETE FROM sessions;
  DELETE FROM oauth_accounts;
  DELETE FROM email_verification_tokens;
  DELETE FROM password_reset_tokens;
  DELETE FROM auth_rate_limits;
  DELETE FROM account_deletion_guards;
  DELETE FROM account_deletion_tombstones;
  DELETE FROM banned_identities;
  DELETE FROM batch_schedule_presets;
  DELETE FROM users;
`
  .split(";")
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

async function execStatements(statements: string[]) {
  for (const statement of statements) {
    await env.DB.exec(statement);
  }
}

const SESSION_COOKIE_NAME = "__Host-session_token";

async function ensureSchema() {
  await env.DB.exec(schemaSql);
}

async function resetRows() {
  await execStatements(resetStatements);
}

async function runWorker(request: Request) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

async function resetDatabase() {
  await ensureSchema();
  await resetRows();
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function createAuthenticatedRequestContext() {
  const passwordHash = await bcrypt.hash("correct-password", 4);
  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, email_verified, created_at)
     VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`,
  )
    .bind("user-authenticated", "auth@example.com", passwordHash)
    .run();

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, session_token, expires_at, created_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
  )
    .bind(
      "session-authenticated",
      "user-authenticated",
      "session-token-1",
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      "198.51.100.60",
      "vitest-auth-client",
    )
    .run();

  return {
    cookieHeader: `${SESSION_COOKIE_NAME}=session-token-1`,
  };
}

async function runScheduled(cron = "* * * * *"): Promise<void> {
  const ctx = createExecutionContext();
  await worker.scheduled(
    {
      cron,
      scheduledTime: Date.now(),
      type: "scheduled",
    } as ScheduledController,
    env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
}

describe("auth rate limiting", () => {
  it("allows login failures until the threshold, then returns 429", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, email_verified, created_at)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    )
      .bind("user-login", "user@example.com", passwordHash)
      .run();

    let response: Response | null = null;

    for (let attempt = 0; attempt < 11; attempt += 1) {
      response = await runWorker(new Request("https://api.lensically.com/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "198.51.100.10",
          "User-Agent": "vitest-login-client",
        },
        body: JSON.stringify({
          email: "user@example.com",
          password: "wrong-password",
        }),
      }));

      if (attempt < 10) {
        expect(response.status).toBe(401);
      }
    }

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBeTruthy();
    await expect(response?.json()).resolves.toMatchObject({
      success: false,
      error: "Too many attempts. Please wait a few minutes and try again.",
    });
  });

  it("throttles failed login attempts from the same IP across different user agents", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, email_verified, created_at)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    )
      .bind("user-login-ip-throttle", "user-ip-throttle@example.com", passwordHash)
      .run();

    let response: Response | null = null;

    for (let attempt = 0; attempt < 11; attempt += 1) {
      response = await runWorker(new Request("https://api.lensically.com/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "198.51.100.11",
          "User-Agent": `rotating-client-${attempt}`,
        },
        body: JSON.stringify({
          email: "user-ip-throttle@example.com",
          password: "wrong-password",
        }),
      }));

      if (attempt < 10) {
        expect(response.status).toBe(401);
      }
    }

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
    await expect(response?.json()).resolves.toMatchObject({
      success: false,
      error: "Too many failed login attempts. Please wait before trying again.",
    });
  });

  it("rate limits login requests by identity across different client IPs", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, email_verified, created_at)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    )
      .bind("user-login-identity", "user-login-identity@example.com", passwordHash)
      .run();

    let response: Response | null = null;

    for (let attempt = 0; attempt < 11; attempt += 1) {
      response = await runWorker(new Request("https://api.lensically.com/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": `198.51.105.${attempt + 1}`,
          "User-Agent": `vitest-login-identity-${attempt}`,
        },
        body: JSON.stringify({
          email: "user-login-identity@example.com",
          password: "wrong-password",
        }),
      }));

      if (attempt < 10) {
        expect(response.status).toBe(401);
      }
    }

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
  });

  it("rate limits repeated signup requests from the same client", async () => {
    let response: Response | null = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await runWorker(new Request("https://api.lensically.com/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "198.51.100.20",
          "User-Agent": "vitest-register-client",
        },
        body: JSON.stringify({
          email: `new-user-${attempt}@example.com`,
          password: "test-password-123",
        }),
      }));

      if (attempt < 5) {
        expect(response.status).toBe(200);
      }
    }

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
  });

  it("rate limits signup requests by identity across different client IPs", async () => {
    let response: Response | null = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await runWorker(new Request("https://api.lensically.com/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": `198.51.101.${attempt + 1}`,
          "User-Agent": `vitest-register-identity-${attempt}`,
        },
        body: JSON.stringify({
          email: "identity-signup@example.com",
          password: "test-password-123",
        }),
      }));

      if (attempt < 5) {
        expect(response.status).toBe(200);
      }
    }

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
  });

  it("rate limits repeated forgot-password requests from the same client", async () => {
    let response: Response | null = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await runWorker(new Request("https://api.lensically.com/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "198.51.100.30",
          "User-Agent": "vitest-forgot-client",
        },
        body: JSON.stringify({
          email: "missing@example.com",
        }),
      }));

      if (attempt < 5) {
        expect(response.status).toBe(200);
      }
    }

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
  });

  it("rate limits forgot-password requests by identity across different client IPs", async () => {
    let response: Response | null = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await runWorker(new Request("https://api.lensically.com/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": `198.51.102.${attempt + 1}`,
          "User-Agent": `vitest-forgot-identity-${attempt}`,
        },
        body: JSON.stringify({
          email: "identity-forgot@example.com",
        }),
      }));

      if (attempt < 5) {
        expect(response.status).toBe(200);
      }
    }

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
  });

  it("rate limits repeated password reset submissions from the same client", async () => {
    let response: Response | null = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await runWorker(new Request("https://api.lensically.com/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "198.51.100.40",
          "User-Agent": "vitest-reset-client",
        },
        body: JSON.stringify({
          token: "invalid-token",
          password: "new-password-123",
        }),
      }));

      if (attempt < 5) {
        expect(response.status).toBe(400);
      }
    }

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
  });

  it("rate limits reset-password requests by token identity across different client IPs", async () => {
    let response: Response | null = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await runWorker(new Request("https://api.lensically.com/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": `198.51.103.${attempt + 1}`,
          "User-Agent": `vitest-reset-identity-${attempt}`,
        },
        body: JSON.stringify({
          token: "11111111-1111-4111-8111-111111111111",
          password: "new-password-123",
        }),
      }));

      if (attempt < 5) {
        expect(response.status).toBe(400);
      }
    }

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
  });

  it("rate limits repeated delete-account attempts from the same client", async () => {
    let response: Response | null = null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await runWorker(new Request("https://api.lensically.com/api/auth/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "198.51.100.50",
          "User-Agent": "vitest-delete-client",
        },
        body: JSON.stringify({
          confirmation_text: "DELETE",
        }),
      }));

      if (attempt < 3) {
        expect(response.status).toBe(401);
      }
    }

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
  });

  it("rate limits delete-account requests by session identity across different client IPs", async () => {
    const { cookieHeader } = await createAuthenticatedRequestContext();
    let response: Response | null = null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await runWorker(new Request("https://api.lensically.com/api/auth/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
          "CF-Connecting-IP": `198.51.104.${attempt + 1}`,
          "User-Agent": `vitest-delete-identity-${attempt}`,
        },
        body: JSON.stringify({
          password: "correct-password",
        }),
      }));

      if (attempt < 3) {
        expect(response.status).toBe(200);
      }
    }

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
  });
});

describe("auth request validation", () => {
  it("rejects unexpected login fields", async () => {
    const response = await runWorker(new Request("https://api.lensically.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        password: "password-123",
        role: "admin",
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Request contains unsupported fields.",
    });
  });

  it("rejects non-object forgot-password payloads", async () => {
    const response = await runWorker(new Request("https://api.lensically.com/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(["user@example.com"]),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "JSON body must be an object",
    });
  });

  it("rejects malformed verification tokens", async () => {
    const response = await runWorker(new Request("https://api.lensically.com/api/auth/verify-email?token=not-a-uuid", {
      method: "GET",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Invalid or expired verification token.",
    });
  });

  it("rejects reset-password payloads with malformed tokens", async () => {
    const response = await runWorker(new Request("https://api.lensically.com/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "bad-token",
        password: "new-password-123",
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Invalid or expired reset token.",
    });
  });

  it("rejects unexpected delete-account fields before deletion logic", async () => {
    const { cookieHeader } = await createAuthenticatedRequestContext();

    const response = await runWorker(new Request("https://api.lensically.com/api/auth/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        password: "correct-password",
        target_user_id: "someone-else",
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Request contains unsupported fields.",
    });
  });
});

describe("public response sanitization", () => {
  it("does not expose internal service identifiers in health responses", async () => {
    const response = await runWorker(new Request("https://api.lensically.com/health", {
      method: "GET",
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as Record<string, unknown>;
    expect(payload.status).toBe("ok");
    expect(payload).not.toHaveProperty("service");
  });

  it("returns a generic message for threads callback validation failures", async () => {
    const { cookieHeader } = await createAuthenticatedRequestContext();
    const response = await runWorker(new Request("https://api.lensically.com/auth/threads/callback", {
      method: "GET",
      headers: {
        Cookie: cookieHeader,
      },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Could not complete Threads authorization.",
    });
  });
});

describe("threads me API", () => {
  it("enforces the me daily usage limit when the cache is stale", async () => {
    await env.DB.exec(usageDailySql);
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);
    await env.DB.exec(threadsProfileCacheSql);

    const { cookieHeader } = await createAuthenticatedRequestContext();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-user-me-limit", "token-me-limit", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-authenticated", "threads-user-me-limit", now)
      .run();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = typeof input === "string" ? input : input.url;
      if (requestUrl.includes("/v1.0/me?fields=id,username,name,threads_biography,is_verified,threads_profile_picture_url")) {
        return new Response(JSON.stringify({
          id: "threads-user-me-limit",
          username: "lensically_test",
          name: "Lensically Test",
          threads_biography: "bio",
          is_verified: false,
          threads_profile_picture_url: "https://example.com/avatar.jpg",
        }), { status: 200 });
      }
      throw new Error(`Unexpected fetch call: ${requestUrl}`);
    });

    const firstResponse = await runWorker(new Request("https://api.lensically.com/api/threads/me?app_user_id=user-authenticated", {
      method: "GET",
      headers: { Cookie: cookieHeader },
    }));
    expect(firstResponse.status).toBe(200);

    await env.DB.prepare(
      `UPDATE threads_profile_cache
       SET last_refreshed_at = datetime('now', '-25 hours')
       WHERE threads_user_id = ?`,
    )
      .bind("threads-user-me-limit")
      .run();

    const secondResponse = await runWorker(new Request("https://api.lensically.com/api/threads/me?app_user_id=user-authenticated", {
      method: "GET",
      headers: { Cookie: cookieHeader },
    }));
    expect(secondResponse.status).toBe(429);
    await expect(secondResponse.json()).resolves.toMatchObject({
      error: "daily_limit_reached",
      feature: "me",
      limit: 1,
      used: 1,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns cached Threads profile data when refreshed within 24 hours", async () => {
    await env.DB.exec(usageDailySql);
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);
    await env.DB.exec(threadsProfileCacheSql);

    const { cookieHeader } = await createAuthenticatedRequestContext();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-user-me-fresh-cache", "token-me-fresh-cache", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-authenticated", "threads-user-me-fresh-cache", now)
      .run();

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
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-23 hours'))`,
    )
      .bind(
        "threads-user-me-fresh-cache",
        "fresh_cached_user",
        "Fresh Cached Name",
        "Fresh cached bio",
        1,
        "https://example.com/fresh-cached-avatar.jpg",
      )
      .run();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = typeof input === "string" ? input : input.url;
      throw new Error(`Unexpected fetch call: ${requestUrl}`);
    });

    const response = await runWorker(new Request("https://api.lensically.com/api/threads/me?app_user_id=user-authenticated", {
      method: "GET",
      headers: { Cookie: cookieHeader },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      connected: true,
      account: {
        threads_user_id: "threads-user-me-fresh-cache",
        username: "fresh_cached_user",
        name: "Fresh Cached Name",
        threads_biography: "Fresh cached bio",
        is_verified: true,
        threads_profile_picture_url: "https://example.com/fresh-cached-avatar.jpg",
      },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it("calls Threads API when cached profile is older than 24 hours", async () => {
    await env.DB.exec(usageDailySql);
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);
    await env.DB.exec(threadsProfileCacheSql);

    const { cookieHeader } = await createAuthenticatedRequestContext();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-user-me-stale-cache", "token-me-stale-cache", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-authenticated", "threads-user-me-stale-cache", now)
      .run();

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
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-25 hours'))`,
    )
      .bind(
        "threads-user-me-stale-cache",
        "stale_cached_user",
        "Stale Cached Name",
        "Stale cached bio",
        0,
        "https://example.com/stale-cached-avatar.jpg",
      )
      .run();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = typeof input === "string" ? input : input.url;
      if (requestUrl.includes("/v1.0/me?fields=id,username,name,threads_biography,is_verified,threads_profile_picture_url")) {
        return new Response(JSON.stringify({
          id: "threads-user-me-stale-cache",
          username: "fresh_user_from_api",
          name: "Fresh Name From API",
          threads_biography: "Fresh bio from API",
          is_verified: false,
          threads_profile_picture_url: "https://example.com/fresh-from-api.jpg",
        }), { status: 200 });
      }
      throw new Error(`Unexpected fetch call: ${requestUrl}`);
    });

    const response = await runWorker(new Request("https://api.lensically.com/api/threads/me?app_user_id=user-authenticated", {
      method: "GET",
      headers: { Cookie: cookieHeader },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      connected: true,
      account: {
        threads_user_id: "threads-user-me-stale-cache",
        username: "fresh_user_from_api",
        name: "Fresh Name From API",
      },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("persists the refreshed Threads profile in the profile cache table", async () => {
    await env.DB.exec(usageDailySql);
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);

    const { cookieHeader } = await createAuthenticatedRequestContext();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-user-me-cache", "token-me-cache", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-authenticated", "threads-user-me-cache", now)
      .run();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = typeof input === "string" ? input : input.url;
      if (requestUrl.includes("/v1.0/me?fields=id,username,name,threads_biography,is_verified,threads_profile_picture_url")) {
        return new Response(JSON.stringify({
          id: "threads-user-me-cache",
          username: "cached_username",
          name: "Cached Display Name",
          threads_biography: "Cached bio",
          is_verified: true,
          threads_profile_picture_url: "https://example.com/cached-avatar.jpg",
        }), { status: 200 });
      }
      throw new Error(`Unexpected fetch call: ${requestUrl}`);
    });

    const response = await runWorker(new Request("https://api.lensically.com/api/threads/me?app_user_id=user-authenticated", {
      method: "GET",
      headers: { Cookie: cookieHeader },
    }));

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const cacheRow = await env.DB.prepare(
      `SELECT threads_user_id, username, name, threads_biography, is_verified, threads_profile_picture_url, last_refreshed_at
       FROM threads_profile_cache
       WHERE threads_user_id = ?
       LIMIT 1`,
    )
      .bind("threads-user-me-cache")
      .first<{
        threads_user_id: string;
        username: string | null;
        name: string | null;
        threads_biography: string | null;
        is_verified: number;
        threads_profile_picture_url: string | null;
        last_refreshed_at: string;
      }>();

    expect(cacheRow).toBeTruthy();
    expect(cacheRow?.threads_user_id).toBe("threads-user-me-cache");
    expect(cacheRow?.username).toBe("cached_username");
    expect(cacheRow?.name).toBe("Cached Display Name");
    expect(cacheRow?.threads_biography).toBe("Cached bio");
    expect(cacheRow?.is_verified).toBe(1);
    expect(cacheRow?.threads_profile_picture_url).toBe("https://example.com/cached-avatar.jpg");
    expect(cacheRow?.last_refreshed_at).toBeTruthy();
  });
});

describe("threads profile lookup API", () => {
  it("returns normalized profile data when username is provided without app_user_id", async () => {
    await env.DB.exec(usageDailySql);
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);

    const { cookieHeader } = await createAuthenticatedRequestContext();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-user-profile-lookup", "token-profile-lookup", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-authenticated", "threads-user-profile-lookup", now)
      .run();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = typeof input === "string" ? input : input.url;
      if (requestUrl.includes("/v1.0/profile_lookup?username=target-user")) {
        return new Response(JSON.stringify({
          data: [{
            id: "threads-user-profile-lookup",
            username: "target-user",
            name: "Target User",
            biography: "Bio from Threads",
            profile_picture_url: "https://example.com/avatar.jpg",
            is_verified: true,
            follower_count: 1200,
            likes_count: 4500,
            quotes_count: 21,
            replies_count: 98,
            reposts_count: 77,
            views_count: 90000,
          }],
        }), { status: 200 });
      }
      throw new Error(`Unexpected fetch call: ${requestUrl}`);
    });

    const response = await runWorker(new Request("https://api.lensically.com/api/threads/discovery/profile?username=target-user", {
      method: "GET",
      headers: { Cookie: cookieHeader },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "threads-user-profile-lookup",
      username: "target-user",
      name: "Target User",
      biography: "Bio from Threads",
      profile_picture_url: "https://example.com/avatar.jpg",
      is_verified: true,
      follower_count: 1200,
      likes_count: 4500,
      quotes_count: 21,
      replies_count: 98,
      reposts_count: 77,
      views_count: 90000,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when username is missing", async () => {
    const { cookieHeader } = await createAuthenticatedRequestContext();
    const response = await runWorker(new Request("https://api.lensically.com/api/threads/discovery/profile", {
      method: "GET",
      headers: { Cookie: cookieHeader },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "missing username",
    });
  });
});

describe("threads profile posts API", () => {
  it("returns normalized posts and next cursor when username is provided without app_user_id", async () => {
    await env.DB.exec(usageDailySql);
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);

    const { cookieHeader } = await createAuthenticatedRequestContext();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-user-profile-posts", "token-profile-posts", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-authenticated", "threads-user-profile-posts", now)
      .run();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = typeof input === "string" ? input : input.url;
      if (requestUrl.includes("/v1.0/profile_posts?username=target-user")) {
        return new Response(JSON.stringify({
          data: [
            {
              id: "post-1",
              username: "target-user",
              text: "First profile post",
              timestamp: "2026-03-14T12:00:00Z",
              permalink: "https://threads.net/@target-user/post/post-1",
              media_type: "TEXT",
              media_url: null,
              has_replies: false,
            },
          ],
          paging: {
            cursors: {
              after: "cursor-next-1",
            },
          },
        }), { status: 200 });
      }
      throw new Error(`Unexpected fetch call: ${requestUrl}`);
    });

    const response = await runWorker(
      new Request("https://api.lensically.com/api/threads/discovery/profile_posts?username=target-user", {
        method: "GET",
        headers: { Cookie: cookieHeader },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      posts: [
        {
          id: "post-1",
          username: "target-user",
          text: "First profile post",
          timestamp: "2026-03-14T12:00:00Z",
          permalink: "https://threads.net/@target-user/post/post-1",
          media_type: "TEXT",
          media_url: null,
          has_replies: false,
        },
      ],
      next_cursor: "cursor-next-1",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("forwards cursor and returns the next page of normalized posts", async () => {
    await env.DB.exec(usageDailySql);
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);

    const { cookieHeader } = await createAuthenticatedRequestContext();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-user-profile-posts-cursor", "token-profile-posts-cursor", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-authenticated", "threads-user-profile-posts-cursor", now)
      .run();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = typeof input === "string" ? input : input.url;
      if (requestUrl.includes("/v1.0/profile_posts?username=target-user&after=cursor-1")) {
        return new Response(JSON.stringify({
          data: [
            {
              id: "post-2",
              username: "target-user",
              text: "Second profile post",
              timestamp: "2026-03-14T12:30:00Z",
              permalink: "https://threads.net/@target-user/post/post-2",
              media_type: "IMAGE",
              media_url: "https://example.com/post-2.jpg",
              has_replies: true,
            },
          ],
          paging: {
            cursors: {
              after: "cursor-2",
            },
          },
        }), { status: 200 });
      }
      throw new Error(`Unexpected fetch call: ${requestUrl}`);
    });

    const response = await runWorker(
      new Request("https://api.lensically.com/api/threads/discovery/profile_posts?username=target-user&cursor=cursor-1", {
        method: "GET",
        headers: { Cookie: cookieHeader },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      posts: [
        {
          id: "post-2",
          username: "target-user",
          text: "Second profile post",
          timestamp: "2026-03-14T12:30:00Z",
          permalink: "https://threads.net/@target-user/post/post-2",
          media_type: "IMAGE",
          media_url: "https://example.com/post-2.jpg",
          has_replies: true,
        },
      ],
      next_cursor: "cursor-2",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when username is missing", async () => {
    const { cookieHeader } = await createAuthenticatedRequestContext();

    const response = await runWorker(
      new Request("https://api.lensically.com/api/threads/discovery/profile_posts", {
        method: "GET",
        headers: { Cookie: cookieHeader },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "missing username",
    });
  });
});

describe("threads connection tombstones", () => {
  it("marks a disconnected Threads link inactive with a tombstone expiry while retaining the Threads user id", async () => {
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);

    const { cookieHeader } = await createAuthenticatedRequestContext();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-user-tombstone", "token-tombstone", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-authenticated", "threads-user-tombstone", now)
      .run();

    const disconnectResponse = await runWorker(new Request("https://api.lensically.com/api/threads/disconnect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        app_user_id: "user-authenticated",
      }),
    }));

    expect(disconnectResponse.status).toBe(200);
    await expect(disconnectResponse.json()).resolves.toMatchObject({
      success: true,
      disconnected: true,
    });

    const linkRow = await env.DB.prepare(
      `SELECT app_user_id, threads_user_id, connection_active, tombstone_expires_at
       FROM app_threads_accounts
       WHERE app_user_id = ?
       LIMIT 1`,
    )
      .bind("user-authenticated")
      .first<{
        app_user_id: string;
        threads_user_id: string;
        connection_active: number;
        tombstone_expires_at: string | null;
      }>();

    expect(linkRow).toBeTruthy();
    expect(linkRow?.app_user_id).toBe("user-authenticated");
    expect(linkRow?.threads_user_id).toBe("threads-user-tombstone");
    expect(linkRow?.connection_active).toBe(0);
    expect(linkRow?.tombstone_expires_at).toBeTruthy();
    const tombstoneExpiryMs = Date.parse(linkRow?.tombstone_expires_at ?? "");
    const msUntilExpiry = tombstoneExpiryMs - Date.now();
    expect(msUntilExpiry).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(msUntilExpiry).toBeLessThan(25 * 60 * 60 * 1000);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = typeof input === "string" ? input : input.url;
      throw new Error(`Unexpected fetch call: ${requestUrl}`);
    });

    const meResponse = await runWorker(new Request("https://api.lensically.com/api/threads/me?app_user_id=user-authenticated", {
      method: "GET",
      headers: { Cookie: cookieHeader },
    }));

    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({
      connected: false,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it("reactivates a tombstoned Threads link and clears tombstone expiry on reconnect upsert", async () => {
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);
    await createAuthenticatedRequestContext();

    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-user-tombstone-reconnect", "token-tombstone-reconnect", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (
        app_user_id,
        threads_user_id,
        connection_active,
        is_active,
        tombstone_expires_at,
        created_at
      )
       VALUES (?, ?, 0, 0, datetime('now', '+7 days'), ?)`,
    )
      .bind("user-authenticated", "threads-user-tombstone-reconnect", now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(app_user_id) DO UPDATE SET
         threads_user_id = excluded.threads_user_id,
         connection_active = 1,
         is_active = 1,
         tombstone_expires_at = NULL`,
    )
      .bind("user-authenticated", "threads-user-tombstone-reconnect", now + 1)
      .run();

    const linkRow = await env.DB.prepare(
      `SELECT app_user_id, threads_user_id, connection_active, tombstone_expires_at
       FROM app_threads_accounts
       WHERE app_user_id = ?
       LIMIT 1`,
    )
      .bind("user-authenticated")
      .first<{
        app_user_id: string;
        threads_user_id: string;
        connection_active: number;
        tombstone_expires_at: string | null;
      }>();

    expect(linkRow).toBeTruthy();
    expect(linkRow?.app_user_id).toBe("user-authenticated");
    expect(linkRow?.threads_user_id).toBe("threads-user-tombstone-reconnect");
    expect(linkRow?.connection_active).toBe(1);
    expect(linkRow?.tombstone_expires_at).toBeNull();
  });

  it("preserves usage buckets and restores tombstoned connection on reconnect within window with observable lifecycle logs", async () => {
    await env.DB.exec(usageDailySql);
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);
    await env.DB.exec(threadsProfileCacheSql);

    const { cookieHeader } = await createAuthenticatedRequestContext();
    const now = Math.floor(Date.now() / 1000);
    const threadsUserId = "threads-user-lifecycle-e2e";
    const todayUtc = new Date().toISOString().slice(0, 10);
    const usageKey = `${threadsUserId}:me:${todayUtc}`;

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind(threadsUserId, "token-initial", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-authenticated", threadsUserId, now)
      .run();

    const workerLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const workerErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const requestUrl = typeof input === "string" ? input : input.url;
      const method = init?.method ?? "GET";

      if (
        (
          requestUrl.includes("/v1.0/me?fields=id,username,name,threads_biography,is_verified,threads_profile_picture_url")
          || requestUrl.includes("/me?fields=id,username,name,threads_biography,is_verified,threads_profile_picture_url")
        )
        && method === "GET"
        && requestUrl.includes("graph.threads.net")
      ) {
        // Supports both bearer-based /api/threads/me refresh and access-token based OAuth profile fetch.
        return new Response(JSON.stringify({
          id: threadsUserId,
          username: "lifecycle_user",
          name: "Lifecycle User",
          threads_biography: "Lifecycle bio",
          is_verified: false,
          threads_profile_picture_url: "https://example.com/lifecycle-avatar.jpg",
        }), { status: 200 });
      }

      if (requestUrl === "https://graph.threads.net/oauth/access_token" && method === "POST") {
        return new Response(JSON.stringify({ access_token: "short-token" }), { status: 200 });
      }

      if (requestUrl.startsWith("https://graph.threads.net/access_token?grant_type=th_exchange_token")) {
        return new Response(JSON.stringify({ access_token: "long-token", expires_in: 5184000 }), { status: 200 });
      }

      throw new Error(`Unexpected fetch call: ${requestUrl}`);
    });

    const firstMeResponse = await runWorker(new Request("https://api.lensically.com/api/threads/me?app_user_id=user-authenticated", {
      method: "GET",
      headers: { Cookie: cookieHeader },
    }));

    expect(firstMeResponse.status).toBe(200);

    const firstUsageRow = await env.DB.prepare(
      `SELECT usage_key, usage_count
       FROM user_usage_feature_daily
       WHERE usage_key = ?
       LIMIT 1`,
    )
      .bind(usageKey)
      .first<{ usage_key: string; usage_count: number }>();
    expect(firstUsageRow?.usage_key).toBe(usageKey);
    expect(Number(firstUsageRow?.usage_count ?? 0)).toBe(1);

    const disconnectResponse = await runWorker(new Request("https://api.lensically.com/api/threads/disconnect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ app_user_id: "user-authenticated" }),
    }));
    expect(disconnectResponse.status).toBe(200);

    const tombstoneRow = await env.DB.prepare(
      `SELECT threads_user_id, connection_active, tombstone_expires_at
       FROM app_threads_accounts
       WHERE app_user_id = ?
       LIMIT 1`,
    )
      .bind("user-authenticated")
      .first<{
        threads_user_id: string;
        connection_active: number;
        tombstone_expires_at: string | null;
      }>();
    expect(tombstoneRow?.threads_user_id).toBe(threadsUserId);
    expect(tombstoneRow?.connection_active).toBe(0);
    expect(tombstoneRow?.tombstone_expires_at).toBeTruthy();

    const encodedStateContext = Buffer.from(JSON.stringify({
      appBaseUrl: "https://app.lensically.com",
      appUserId: "user-authenticated",
    })).toString("base64");
    const reconnectState = `nonce.${encodedStateContext}`;

    // Callback validation requires configured Threads OAuth credentials.
    env.THREADS_CLIENT_ID = "test-threads-client-id";
    env.THREADS_CLIENT_SECRET = "test-threads-client-secret";

    const reconnectResponse = await runWorker(new Request(
      `https://api.lensically.com/api/auth/threads/callback?code=reconnect-code&state=${encodeURIComponent(reconnectState)}`,
      {
        method: "GET",
        headers: {
          Cookie: `${cookieHeader}; lensically_oauth_state=${reconnectState}`,
        },
      },
    ));

    expect(reconnectResponse.status).toBe(302);
    expect(reconnectResponse.headers.get("Location")).toBe("https://app.lensically.com/dashboard");

    const reconnectRow = await env.DB.prepare(
      `SELECT threads_user_id, connection_active, tombstone_expires_at
       FROM app_threads_accounts
       WHERE app_user_id = ?
       LIMIT 1`,
    )
      .bind("user-authenticated")
      .first<{
        threads_user_id: string;
        connection_active: number;
        tombstone_expires_at: string | null;
      }>();
    expect(reconnectRow?.threads_user_id).toBe(threadsUserId);
    expect(reconnectRow?.connection_active).toBe(1);
    expect(reconnectRow?.tombstone_expires_at).toBeNull();

    const linksForThreadsUser = await env.DB.prepare(
      `SELECT COUNT(*) AS total
       FROM app_threads_accounts
       WHERE threads_user_id = ?`,
    )
      .bind(threadsUserId)
      .first<{ total: number | string }>();
    expect(Number(linksForThreadsUser?.total ?? 0)).toBe(1);

    const secondMeResponse = await runWorker(new Request("https://api.lensically.com/api/threads/me?app_user_id=user-authenticated", {
      method: "GET",
      headers: { Cookie: cookieHeader },
    }));
    expect(secondMeResponse.status).toBe(200);

    const usageAfterReconnect = await env.DB.prepare(
      `SELECT usage_count
       FROM user_usage_feature_daily
       WHERE usage_key = ?
       LIMIT 1`,
    )
      .bind(usageKey)
      .first<{ usage_count: number }>();
    expect(Number(usageAfterReconnect?.usage_count ?? 0)).toBe(1);

    const loggedEvents = workerLogSpy.mock.calls
      .map((call) => {
        const message = call[0];
        if (typeof message !== "string") {
          return null;
        }
        try {
          return JSON.parse(message) as { event?: string };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is { event?: string } => entry !== null);

    expect(loggedEvents.some((entry) => entry.event === "THREADS_CONNECTION_TOMBSTONE_CREATED")).toBe(true);
    expect(loggedEvents.some((entry) => entry.event === "THREADS_CONNECTION_TOMBSTONE_RESTORED")).toBe(true);
    expect(loggedEvents.some((entry) => entry.event === "THREADS_PROFILE_CACHE_REFRESHED")).toBe(true);
    expect(loggedEvents.some((entry) => entry.event === "THREADS_PROFILE_CACHE_HIT")).toBe(true);

    expect(fetchSpy).toHaveBeenCalled();
    expect(workerErrorSpy).not.toHaveBeenCalled();
  });
});

describe("scheduled post API", () => {
  it("creates an approved scheduled post and stores UTC execution time", async () => {
    await env.DB.exec(limitsSql);
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);

    const { cookieHeader } = await createAuthenticatedRequestContext();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-user-schedule-api", "token-schedule-api", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-authenticated", "threads-user-schedule-api", now)
      .run();

    const response = await runWorker(new Request("https://api.lensically.com/api/threads/schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        app_user_id: "user-authenticated",
        threads_user_id: "threads-user-schedule-api",
        text: "Schedule this post",
        date: "2099-01-15",
        time: "09:30",
        timezone: "America/New_York",
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      scheduled_post: {
        status: "approved",
        scheduled_time_utc: "2099-01-15T14:30:00.000Z",
      },
    });

    const row = await env.DB.prepare(
      `SELECT status, scheduled_time, post_text, threads_user_id
       FROM scheduled_posts
       WHERE user_id = ?
       LIMIT 1`,
    )
      .bind("user-authenticated")
      .first<{
        status: string;
        scheduled_time: string;
        post_text: string;
        threads_user_id: string;
      }>();

    expect(row?.status).toBe("approved");
    expect(row?.scheduled_time).toBe("2099-01-15T14:30:00.000Z");
    expect(row?.post_text).toBe("Schedule this post");
    expect(row?.threads_user_id).toBe("threads-user-schedule-api");
  });

  it("returns the existing scheduled row for duplicate schedule requests", async () => {
    await env.DB.exec(limitsSql);
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);

    const { cookieHeader } = await createAuthenticatedRequestContext();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-user-schedule-idempotent", "token-schedule-idempotent", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-authenticated", "threads-user-schedule-idempotent", now)
      .run();

    const payload = JSON.stringify({
      app_user_id: "user-authenticated",
      threads_user_id: "threads-user-schedule-idempotent",
      text: "Schedule idempotent",
      date: "2099-01-15",
      time: "09:30",
      timezone: "America/New_York",
    });

    const firstResponse = await runWorker(new Request("https://api.lensically.com/api/threads/schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: payload,
    }));

    const secondResponse = await runWorker(new Request("https://api.lensically.com/api/threads/schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: payload,
    }));

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);

    const firstJson = await firstResponse.json() as {
      scheduled_post?: { id?: number; scheduled_time_utc?: string; status?: string };
    };
    const secondJson = await secondResponse.json() as {
      scheduled_post?: { id?: number; scheduled_time_utc?: string; status?: string };
    };

    expect(firstJson.scheduled_post?.id).toBeTruthy();
    expect(secondJson.scheduled_post?.id).toBe(firstJson.scheduled_post?.id);
    expect(secondJson.scheduled_post?.scheduled_time_utc).toBe("2099-01-15T14:30:00.000Z");
    expect(secondJson.scheduled_post?.status).toBe("approved");

    const scheduledCount = await env.DB.prepare(
      `SELECT COUNT(*) AS total
       FROM scheduled_posts
       WHERE user_id = ?`,
    )
      .bind("user-authenticated")
      .first<{ total: number }>();

    expect(Number(scheduledCount?.total ?? 0)).toBe(1);
  });

  it("rejects scheduling requests with timestamps earlier than current UTC time", async () => {
    await env.DB.exec(limitsSql);
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);

    const { cookieHeader } = await createAuthenticatedRequestContext();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-user-schedule-past", "token-schedule-past", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-authenticated", "threads-user-schedule-past", now)
      .run();

    const response = await runWorker(new Request("https://api.lensically.com/api/threads/schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        app_user_id: "user-authenticated",
        threads_user_id: "threads-user-schedule-past",
        text: "Past schedule request",
        date: "2000-01-01",
        time: "00:00",
        timezone: "UTC",
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Scheduled time must be in the future (UTC).",
    });

    const scheduledCount = await env.DB.prepare(
      `SELECT COUNT(*) AS total
       FROM scheduled_posts
       WHERE user_id = ?`,
    )
      .bind("user-authenticated")
      .first<{ total: number }>();

    expect(Number(scheduledCount?.total ?? 0)).toBe(0);
  });
});

describe("immediate post API", () => {
  it("publishes immediately with the two-step Threads flow and returns published id", async () => {
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);

    const { cookieHeader } = await createAuthenticatedRequestContext();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-user-now", "token-now", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-authenticated", "threads-user-now", now)
      .run();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = typeof input === "string" ? input : input.url;
      if (requestUrl.includes("/v1.0/threads-user-now/threads_publish")) {
        return new Response(JSON.stringify({ id: "published-post-now" }), { status: 200 });
      }
      if (requestUrl.includes("/v1.0/threads-user-now/threads")) {
        return new Response(JSON.stringify({ id: "creation-now" }), { status: 200 });
      }
      throw new Error(`Unexpected fetch call: ${requestUrl}`);
    });

    const response = await runWorker(new Request("https://api.lensically.com/api/threads/post-now", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        app_user_id: "user-authenticated",
        threads_user_id: "threads-user-now",
        text: "Post now message",
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      publish_request_id: "creation-now",
      published_post_id: "published-post-now",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns the same publish response for duplicate immediate publish requests", async () => {
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);

    const { cookieHeader } = await createAuthenticatedRequestContext();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-user-now-idempotent", "token-now-idempotent", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-authenticated", "threads-user-now-idempotent", now)
      .run();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = typeof input === "string" ? input : input.url;
      if (requestUrl.includes("/v1.0/threads-user-now-idempotent/threads_publish")) {
        return new Response(JSON.stringify({ id: "published-post-now-idempotent" }), { status: 200 });
      }
      if (requestUrl.includes("/v1.0/threads-user-now-idempotent/threads")) {
        return new Response(JSON.stringify({ id: "creation-now-idempotent" }), { status: 200 });
      }
      throw new Error(`Unexpected fetch call: ${requestUrl}`);
    });

    const payload = JSON.stringify({
      app_user_id: "user-authenticated",
      threads_user_id: "threads-user-now-idempotent",
      text: "Immediate idempotent message",
    });

    const firstResponse = await runWorker(new Request("https://api.lensically.com/api/threads/post-now", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: payload,
    }));

    const secondResponse = await runWorker(new Request("https://api.lensically.com/api/threads/post-now", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: payload,
    }));

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);

    await expect(firstResponse.json()).resolves.toMatchObject({
      success: true,
      publish_request_id: "creation-now-idempotent",
      published_post_id: "published-post-now-idempotent",
    });
    await expect(secondResponse.json()).resolves.toMatchObject({
      success: true,
      publish_request_id: "creation-now-idempotent",
      published_post_id: "published-post-now-idempotent",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("auth enumeration protections", () => {
  it("returns the same login failure response for missing and unverified accounts", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, email_verified, created_at)
       VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)`,
    )
      .bind("user-unverified", "unverified@example.com", passwordHash)
      .run();

    const missingResponse = await runWorker(new Request("https://api.lensically.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "missing@example.com",
        password: "correct-password",
      }),
    }));

    const unverifiedResponse = await runWorker(new Request("https://api.lensically.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "unverified@example.com",
        password: "correct-password",
      }),
    }));

    expect(missingResponse.status).toBe(401);
    expect(unverifiedResponse.status).toBe(401);
    await expect(missingResponse.json()).resolves.toMatchObject({
      success: false,
      error: "Invalid email or password.",
    });
    await expect(unverifiedResponse.json()).resolves.toMatchObject({
      success: false,
      error: "Invalid email or password.",
    });
  });

  it("returns a generic success for duplicate registration attempts", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, email_verified, created_at)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    )
      .bind("user-existing", "existing@example.com", passwordHash)
      .run();

    const response = await runWorker(new Request("https://api.lensically.com/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "existing@example.com",
        password: "new-password-123",
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: "If the email address is eligible, a verification email will be sent.",
    });
  });

  it("returns the same forgot-password response whether the account exists or not", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, email_verified, created_at)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    )
      .bind("user-forgot", "exists@example.com", passwordHash)
      .run();

    const existingResponse = await runWorker(new Request("https://api.lensically.com/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "exists@example.com",
      }),
    }));

    const missingResponse = await runWorker(new Request("https://api.lensically.com/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "missing@example.com",
      }),
    }));

    expect(existingResponse.status).toBe(200);
    expect(missingResponse.status).toBe(200);
    await expect(existingResponse.json()).resolves.toMatchObject({
      success: true,
      message: "If the account is eligible, password reset instructions will be sent.",
    });
    await expect(missingResponse.json()).resolves.toMatchObject({
      success: true,
      message: "If the account is eligible, password reset instructions will be sent.",
    });
  });
});

describe("account deletion deduplication", () => {
  it("returns a no-op success for a repeated delete-account request in the same session after completion", async () => {
    const { cookieHeader } = await createAuthenticatedRequestContext();

    const firstResponse = await runWorker(new Request("https://api.lensically.com/api/auth/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        password: "correct-password",
      }),
    }));

    expect(firstResponse.status).toBe(200);
    await expect(firstResponse.json()).resolves.toMatchObject({
      success: true,
      message: "Account has been permanently deleted",
    });

    const completedGuard = await env.DB.prepare(
      `SELECT status
       FROM account_deletion_guards
       WHERE session_token = ?
       LIMIT 1`,
    )
      .bind("session-token-1")
      .first<{ status: string }>();
    expect(completedGuard?.status).toBe("completed");

    const secondResponse = await runWorker(new Request("https://api.lensically.com/api/auth/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        password: "correct-password",
      }),
    }));

    expect(secondResponse.status).toBe(200);
    await expect(secondResponse.json()).resolves.toMatchObject({
      success: true,
      message: "Account deletion already processed",
    });
  });
});

describe("account scheduling preferences", () => {
  it("persists timezone and clock format preferences and returns them in /api/auth/me", async () => {
    const { cookieHeader } = await createAuthenticatedRequestContext();

    const updateResponse = await runWorker(new Request("https://api.lensically.com/api/auth/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        timezone: "America/Los_Angeles",
        clock_format: "24h",
      }),
    }));

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      success: true,
      user: {
        id: "user-authenticated",
        timezone: "America/Los_Angeles",
        clock_format: "24h",
      },
    });

    const updatedRow = await env.DB.prepare(
      `SELECT timezone, clock_format
       FROM users
       WHERE id = ?
       LIMIT 1`,
    )
      .bind("user-authenticated")
      .first<{ timezone: string; clock_format: string }>();

    expect(updatedRow?.timezone).toBe("America/Los_Angeles");
    expect(updatedRow?.clock_format).toBe("24h");

    const meResponse = await runWorker(new Request("https://api.lensically.com/api/auth/me", {
      method: "GET",
      headers: {
        Cookie: cookieHeader,
      },
    }));

    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({
      id: "user-authenticated",
      timezone: "America/Los_Angeles",
      clock_format: "24h",
    });
  });

  it("rejects invalid timezone values for preference updates", async () => {
    const { cookieHeader } = await createAuthenticatedRequestContext();

    const updateResponse = await runWorker(new Request("https://api.lensically.com/api/auth/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        timezone: "Mars/OlympusMons",
        clock_format: "12h",
      }),
    }));

    expect(updateResponse.status).toBe(400);
    await expect(updateResponse.json()).resolves.toMatchObject({
      error: "timezone must be a valid IANA timezone",
    });
  });
});

describe("batch schedule presets API", () => {
  it("creates, favorites, and lists batch schedule presets for the authenticated user", async () => {
    const { cookieHeader } = await createAuthenticatedRequestContext();

    const createResponse = await runWorker(new Request("https://api.lensically.com/api/batch-schedule/presets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        name: "Daily 17",
        times: ["08:00", "08:45", "09:30"],
        is_favorite: true,
      }),
    }));

    expect(createResponse.status).toBe(200);
    await expect(createResponse.json()).resolves.toMatchObject({
      success: true,
      preset: {
        name: "Daily 17",
        times: ["08:00", "08:45", "09:30"],
        is_favorite: true,
      },
    });

    const listResponse = await runWorker(new Request("https://api.lensically.com/api/batch-schedule/presets", {
      method: "GET",
      headers: {
        Cookie: cookieHeader,
      },
    }));

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      success: true,
      presets: [
        {
          name: "Daily 17",
          times: ["08:00", "08:45", "09:30"],
          is_favorite: true,
        },
      ],
    });
  });

  it("keeps only one favorite preset per user", async () => {
    const { cookieHeader } = await createAuthenticatedRequestContext();

    const firstResponse = await runWorker(new Request("https://api.lensically.com/api/batch-schedule/presets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        name: "Morning",
        times: ["08:00"],
        is_favorite: true,
      }),
    }));

    const firstJson = await firstResponse.json() as { preset?: { id?: string } };
    expect(firstJson.preset?.id).toBeTruthy();

    const secondResponse = await runWorker(new Request("https://api.lensically.com/api/batch-schedule/presets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        name: "Afternoon",
        times: ["14:00"],
        is_favorite: false,
      }),
    }));

    const secondJson = await secondResponse.json() as { preset?: { id?: string } };
    expect(secondJson.preset?.id).toBeTruthy();

    const favoriteResponse = await runWorker(new Request(`https://api.lensically.com/api/batch-schedule/presets/${secondJson.preset?.id}/favorite`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
      },
    }));

    expect(favoriteResponse.status).toBe(200);

    const listResponse = await runWorker(new Request("https://api.lensically.com/api/batch-schedule/presets", {
      method: "GET",
      headers: {
        Cookie: cookieHeader,
      },
    }));

    await expect(listResponse.json()).resolves.toMatchObject({
      success: true,
      presets: [
        {
          name: "Afternoon",
          is_favorite: true,
        },
        {
          name: "Morning",
          is_favorite: false,
        },
      ],
    });
  });
});

describe("manual batch scheduling API", () => {
  it("creates scheduled posts for each provided batch row and reuses exact duplicates", async () => {
    await env.DB.exec(limitsSql);
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);

    const { cookieHeader } = await createAuthenticatedRequestContext();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-user-batch-api", "token-batch-api", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-authenticated", "threads-user-batch-api", now)
      .run();

    const payload = {
      app_user_id: "user-authenticated",
      threads_user_id: "threads-user-batch-api",
      timezone: "America/New_York",
      entries: [
        {
          text: "Batch post 1",
          date: "2099-01-15",
          time: "08:00",
        },
        {
          text: "Batch post 2",
          date: "2099-01-15",
          time: "08:45",
        },
        {
          text: "Batch post 1",
          date: "2099-01-15",
          time: "08:00",
        },
      ],
    };

    const response = await runWorker(new Request("https://api.lensically.com/api/threads/schedule/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify(payload),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      results: [
        {
          row_number: 1,
          success: true,
          reused: false,
          scheduled_time_utc: "2099-01-15T13:00:00.000Z",
        },
        {
          row_number: 2,
          success: true,
          reused: false,
          scheduled_time_utc: "2099-01-15T13:45:00.000Z",
        },
        {
          row_number: 3,
          success: true,
          reused: true,
          scheduled_time_utc: "2099-01-15T13:00:00.000Z",
        },
      ],
    });

    const scheduledCount = await env.DB.prepare(
      `SELECT COUNT(*) AS total
       FROM scheduled_posts
       WHERE user_id = ?`,
    )
      .bind("user-authenticated")
      .first<{ total: number }>();

    expect(Number(scheduledCount?.total ?? 0)).toBe(2);
  });
});

describe("account lifecycle enforcement", () => {
  it("invalidates existing sessions, blocks password login, and denies authenticated API access after deletion", async () => {
    const { cookieHeader } = await createAuthenticatedRequestContext();

    const beforeDeleteMe = await runWorker(new Request("https://api.lensically.com/api/auth/me", {
      method: "GET",
      headers: { Cookie: cookieHeader },
    }));
    expect(beforeDeleteMe.status).toBe(200);

    const deleteResponse = await runWorker(new Request("https://api.lensically.com/api/auth/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        password: "correct-password",
      }),
    }));
    expect(deleteResponse.status).toBe(200);

    const afterDeleteMe = await runWorker(new Request("https://api.lensically.com/api/auth/me", {
      method: "GET",
      headers: { Cookie: cookieHeader },
    }));
    expect(afterDeleteMe.status).toBe(401);

    const loginAfterDelete = await runWorker(new Request("https://api.lensically.com/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "auth@example.com",
        password: "correct-password",
      }),
    }));
    expect(loginAfterDelete.status).toBe(401);

    const deletedApiAccess = await runWorker(new Request("https://api.lensically.com/api/threads/me?app_user_id=user-authenticated", {
      method: "GET",
      headers: { Cookie: cookieHeader },
    }));
    expect(deletedApiAccess.status).toBe(401);

    const sessionsCount = await env.DB.prepare("SELECT COUNT(*) AS total FROM sessions WHERE user_id = ?")
      .bind("user-authenticated")
      .first<{ total: number }>();
    expect(Number(sessionsCount?.total ?? 0)).toBe(0);

    const oauthCount = await env.DB.prepare("SELECT COUNT(*) AS total FROM oauth_accounts WHERE user_id = ?")
      .bind("user-authenticated")
      .first<{ total: number }>();
    expect(Number(oauthCount?.total ?? 0)).toBe(0);

    const tombstoneCount = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM account_deletion_tombstones WHERE identity_type = ? AND identity_value = ?",
    )
      .bind("email", "auth@example.com")
      .first<{ total: number }>();
    expect(Number(tombstoneCount?.total ?? 0)).toBeGreaterThan(0);
  });

  it("cleans up newly introduced user-linked tables discovered by the deletion pipeline", async () => {
    const { cookieHeader } = await createAuthenticatedRequestContext();

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS future_user_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        payload TEXT
      )`,
    ).run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS future_user_mappings (
        id TEXT PRIMARY KEY,
        app_user_id TEXT NOT NULL,
        label TEXT
      )`,
    ).run();

    await env.DB.prepare("DELETE FROM future_user_events WHERE user_id = ?")
      .bind("user-authenticated")
      .run();
    await env.DB.prepare("DELETE FROM future_user_mappings WHERE app_user_id = ?")
      .bind("user-authenticated")
      .run();

    await env.DB.prepare(
      `INSERT INTO future_user_events (id, user_id, payload)
       VALUES (?, ?, ?)`,
    )
      .bind("future-event-1", "user-authenticated", "event-payload")
      .run();
    await env.DB.prepare(
      `INSERT INTO future_user_mappings (id, app_user_id, label)
       VALUES (?, ?, ?)`,
    )
      .bind("future-mapping-1", "user-authenticated", "mapping")
      .run();

    const deleteResponse = await runWorker(new Request("https://api.lensically.com/api/auth/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        password: "correct-password",
      }),
    }));
    expect(deleteResponse.status).toBe(200);

    const eventCount = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM future_user_events WHERE user_id = ?",
    )
      .bind("user-authenticated")
      .first<{ total: number }>();
    const mappingCount = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM future_user_mappings WHERE app_user_id = ?",
    )
      .bind("user-authenticated")
      .first<{ total: number }>();

    expect(Number(eventCount?.total ?? 0)).toBe(0);
    expect(Number(mappingCount?.total ?? 0)).toBe(0);
  });

  it("treats discovered-table cleanup failures as non-fatal and still completes deletion", async () => {
    const { cookieHeader } = await createAuthenticatedRequestContext();

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS future_cleanup_failures (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        payload TEXT
      )`,
    ).run();
    await env.DB.prepare("DELETE FROM future_cleanup_failures WHERE user_id = ?")
      .bind("user-authenticated")
      .run();
    await env.DB.prepare(
      `INSERT INTO future_cleanup_failures (id, user_id, payload)
       VALUES (?, ?, ?)`,
    )
      .bind("future-failure-1", "user-authenticated", "payload")
      .run();
    await env.DB.prepare(
      `CREATE TRIGGER IF NOT EXISTS fail_delete_future_cleanup_for_test
       BEFORE DELETE ON future_cleanup_failures
       FOR EACH ROW
       WHEN OLD.user_id = 'user-authenticated'
       BEGIN
         SELECT RAISE(ABORT, 'forced_future_cleanup_failure');
       END`,
    ).run();

    try {
      const deleteResponse = await runWorker(new Request("https://api.lensically.com/api/auth/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        body: JSON.stringify({
          password: "correct-password",
        }),
      }));
      expect(deleteResponse.status).toBe(200);
    } finally {
      await env.DB.exec("DROP TRIGGER IF EXISTS fail_delete_future_cleanup_for_test");
      await env.DB.exec("DROP TABLE IF EXISTS future_cleanup_failures");
    }
  });

  it("rolls back deletion safely when a mid-pipeline cleanup step fails", async () => {
    const { cookieHeader } = await createAuthenticatedRequestContext();

    await env.DB.prepare(
      `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
      .bind("oauth-forced-failure", "user-authenticated", "google", "google-subject-failure")
      .run();

    await env.DB.prepare(
      `CREATE TRIGGER fail_delete_oauth_for_test
       BEFORE DELETE ON oauth_accounts
       FOR EACH ROW
       WHEN OLD.user_id = 'user-authenticated'
       BEGIN
         SELECT RAISE(ABORT, 'forced_delete_failure');
       END`,
    ).run();

    try {
      const deleteResponse = await runWorker(new Request("https://api.lensically.com/api/auth/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        body: JSON.stringify({
          password: "correct-password",
        }),
      }));

      expect(deleteResponse.status).toBe(500);

      const userCount = await env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE id = ?")
        .bind("user-authenticated")
        .first<{ total: number }>();
      expect(Number(userCount?.total ?? 0)).toBe(1);

      const sessionCount = await env.DB.prepare("SELECT COUNT(*) AS total FROM sessions WHERE user_id = ?")
        .bind("user-authenticated")
        .first<{ total: number }>();
      expect(Number(sessionCount?.total ?? 0)).toBe(1);

      const oauthCount = await env.DB.prepare("SELECT COUNT(*) AS total FROM oauth_accounts WHERE user_id = ?")
        .bind("user-authenticated")
        .first<{ total: number }>();
      expect(Number(oauthCount?.total ?? 0)).toBe(1);

      const tombstoneCount = await env.DB.prepare(
        "SELECT COUNT(*) AS total FROM account_deletion_tombstones WHERE identity_type = ? AND identity_value = ?",
      )
        .bind("email", "auth@example.com")
        .first<{ total: number }>();
      expect(Number(tombstoneCount?.total ?? 0)).toBe(0);
    } finally {
      await env.DB.exec("DROP TRIGGER IF EXISTS fail_delete_oauth_for_test");
    }
  });

  it("blocks OAuth identity recreation during tombstone retention and allows it after expiry", async () => {
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, email_verified, created_at)
       VALUES (?, ?, NULL, 1, CURRENT_TIMESTAMP)`,
    )
      .bind("user-oauth", "oauth-user@example.com")
      .run();
    await env.DB.prepare(
      `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
      .bind("oauth-link-1", "user-oauth", "google", "google-subject-123")
      .run();

    await createDeletionTombstones(env.DB, {
      email: "oauth-user@example.com",
      oauthIdentities: [{ provider: "google", provider_user_id: "google-subject-123" }],
    });

    const blockedSignupDuringWindow = await runWorker(new Request("https://api.lensically.com/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "oauth-user@example.com",
        password: "new-password-123",
      }),
    }));
    expect(blockedSignupDuringWindow.status).toBe(403);

    const blockedDuringWindow = await evaluateIdentityAccess(env.DB, [
      { type: "google", value: "google-subject-123" },
      { type: "email", value: "oauth-user@example.com" },
    ]);
    expect(blockedDuringWindow).toMatchObject({
      allowed: false,
      reason: "tombstone",
    });

    await env.DB.prepare(
      `UPDATE account_deletion_tombstones
       SET expires_at = ?
       WHERE identity_type IN ('email', 'google')`,
    )
      .bind(new Date(Date.now() - 60_000).toISOString())
      .run();

    const allowedAfterExpiry = await evaluateIdentityAccess(env.DB, [
      { type: "google", value: "google-subject-123" },
      { type: "email", value: "oauth-user@example.com" },
    ]);
    expect(allowedAfterExpiry).toMatchObject({
      allowed: true,
    });

    await env.DB.prepare("DELETE FROM users WHERE id = ?")
      .bind("user-oauth")
      .run();

    const signupAfterExpiry = await runWorker(new Request("https://api.lensically.com/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "oauth-user@example.com",
        password: "new-password-123",
      }),
    }));
    expect(signupAfterExpiry.status).toBe(200);
  });

  it("rejects banned identities for signup and login even after account deletion", async () => {
    await env.DB.prepare(
      `INSERT INTO banned_identities (
        id, identity_type, identity_value, reason, created_at, expires_at, created_by
      )
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, NULL, ?)`,
    )
      .bind(
        "ban-email-1",
        "email",
        "banned@example.com",
        "abuse",
        "test-suite",
      )
      .run();

    const signupResponse = await runWorker(new Request("https://api.lensically.com/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "banned@example.com",
        password: "password-123",
      }),
    }));
    expect(signupResponse.status).toBe(403);

    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, email_verified, created_at)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    )
      .bind("user-banned-login", "banned@example.com", await bcrypt.hash("correct-password", 4))
      .run();

    const loginResponse = await runWorker(new Request("https://api.lensically.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "banned@example.com",
        password: "correct-password",
      }),
    }));
    expect(loginResponse.status).toBe(403);

    await env.DB.prepare("DELETE FROM users WHERE id = ?")
      .bind("user-banned-login")
      .run();

    const signupAfterDeletion = await runWorker(new Request("https://api.lensically.com/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "banned@example.com",
        password: "password-123",
      }),
    }));
    expect(signupAfterDeletion.status).toBe(403);

    const bannedOauthIdentity = await evaluateIdentityAccess(env.DB, [
      { type: "google", value: "google-banned-subject" },
    ]);
    expect(bannedOauthIdentity.allowed).toBe(true);

    await env.DB.prepare(
      `INSERT INTO banned_identities (
        id, identity_type, identity_value, reason, created_at, expires_at, created_by
      )
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, NULL, ?)`,
    )
      .bind(
        "ban-google-1",
        "google",
        "google-banned-subject",
        "abuse",
        "test-suite",
      )
      .run();

    const nowBannedOauthIdentity = await evaluateIdentityAccess(env.DB, [
      { type: "google", value: "google-banned-subject" },
    ]);
    expect(nowBannedOauthIdentity).toMatchObject({
      allowed: false,
      reason: "banned",
    });
  });
});

describe("database integrity safeguards", () => {
  it("prevents orphaned usage and scheduling rows and cleans them up on user deletion", async () => {
    await env.DB.exec(limitsSql);
    await env.DB.exec(usageDailySql);

    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, email_verified, created_at)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    )
      .bind("user-integrity-1", "integrity-1@example.com", await bcrypt.hash("pw", 4))
      .run();

    await env.DB.prepare(
      `INSERT INTO user_usage_daily (user_id, date)
       VALUES (?, ?)`,
    )
      .bind("user-integrity-1", "2026-03-12")
      .run();
    await env.DB.prepare(
      `INSERT INTO user_usage_feature_daily (usage_key, user_id, feature, date, usage_count)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind("user-integrity-1:me:2026-03-12", "user-integrity-1", "me", "2026-03-12", 1)
      .run();
    await env.DB.prepare(
      `INSERT INTO user_daily_usage (user_id, date)
       VALUES (?, ?)`,
    )
      .bind("user-integrity-1", "2026-03-12")
      .run();
    await env.DB.prepare(
      `INSERT INTO scheduled_posts (user_id, threads_user_id, post_text, scheduled_time)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("user-integrity-1", "threads-user-1", "hello", "2026-03-12T12:00:00Z")
      .run();

    await expect(
      env.DB.prepare(
        `INSERT INTO user_usage_daily (user_id, date)
         VALUES (?, ?)`,
      )
        .bind("missing-user", "2026-03-12")
        .run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        `INSERT INTO user_daily_usage (user_id, date)
         VALUES (?, ?)`,
      )
        .bind("missing-user", "2026-03-12")
        .run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        `INSERT INTO scheduled_posts (user_id, threads_user_id, post_text, scheduled_time)
         VALUES (?, ?, ?, ?)`,
      )
        .bind("missing-user", "threads-user-missing", "orphan", "2026-03-12T13:00:00Z")
        .run(),
    ).rejects.toThrow();

    await env.DB.prepare("DELETE FROM users WHERE id = ?")
      .bind("user-integrity-1")
      .run();

    const usageDailyCount = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM user_usage_daily WHERE user_id = ?",
    )
      .bind("user-integrity-1")
      .first<{ total: number }>();
    const usageFeatureDailyCount = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM user_usage_feature_daily WHERE user_id = ?",
    )
      .bind("user-integrity-1")
      .first<{ total: number }>();
    const legacyUsageCount = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM user_daily_usage WHERE user_id = ?",
    )
      .bind("user-integrity-1")
      .first<{ total: number }>();
    const scheduledCount = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM scheduled_posts WHERE user_id = ?",
    )
      .bind("user-integrity-1")
      .first<{ total: number }>();

    expect(Number(usageDailyCount?.total ?? 0)).toBe(0);
    expect(Number(usageFeatureDailyCount?.total ?? 0)).toBe(0);
    expect(Number(legacyUsageCount?.total ?? 0)).toBe(0);
    expect(Number(scheduledCount?.total ?? 0)).toBe(0);
  });

  it("keeps completed-session deletion guards after user deletion for idempotent retries", async () => {
    await env.DB.exec(accountDeletionGuardsSql);

    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, email_verified, created_at)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    )
      .bind("user-integrity-2", "integrity-2@example.com", await bcrypt.hash("pw", 4))
      .run();

    await env.DB.prepare(
      `INSERT INTO account_deletion_guards (session_token, user_id, status, created_at, updated_at)
       VALUES (?, ?, 'in_progress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    )
      .bind("guard-session-1", "user-integrity-2")
      .run();

    await expect(
      env.DB.prepare(
        `INSERT INTO account_deletion_guards (session_token, user_id, status, created_at, updated_at)
         VALUES (?, ?, 'in_progress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
        .bind("guard-session-missing", "missing-user")
        .run(),
    ).rejects.toThrow();

    await env.DB.prepare("DELETE FROM users WHERE id = ?")
      .bind("user-integrity-2")
      .run();

    const guardRow = await env.DB.prepare(
      `SELECT status
       FROM account_deletion_guards
       WHERE session_token = ?
       LIMIT 1`,
    )
      .bind("guard-session-1")
      .first<{ status: string }>();
    expect(guardRow?.status).toBe("in_progress");
  });
});

describe("scheduled post state machine", () => {
  it("processes approved posts once even when scheduler runs repeatedly", async () => {
    await env.DB.exec(limitsSql);
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);

    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, email_verified, created_at)
       VALUES (?, ?, NULL, 1, CURRENT_TIMESTAMP)`,
    )
      .bind("user-scheduled-1", "scheduled-1@example.com")
      .run();

    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-scheduled-1", "token-scheduled-1", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-scheduled-1", "threads-scheduled-1", now)
      .run();

    await env.DB.prepare(
      `INSERT INTO scheduled_posts (user_id, threads_user_id, post_text, scheduled_time, status)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        "user-scheduled-1",
        "threads-scheduled-1",
        "Scheduled message",
        "2026-03-12T00:00:00.000Z",
        "approved",
      )
      .run();

    const publishSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = typeof input === "string" ? input : input.url;
      if (requestUrl.includes("/v1.0/threads-scheduled-1/threads_publish")) {
        return new Response(JSON.stringify({ id: "threads-post-1" }), { status: 200 });
      }
      if (requestUrl.includes("/v1.0/threads-scheduled-1/threads")) {
        return new Response(JSON.stringify({ id: "threads-post-1" }), { status: 200 });
      }
      throw new Error(`Unexpected fetch call: ${requestUrl}`);
    });

    await runScheduled();
    await runScheduled();

    const postRow = await env.DB.prepare(
      `SELECT status, publish_request_id, published_post_id, published_at
       FROM scheduled_posts
       WHERE user_id = ?
       LIMIT 1`,
    )
      .bind("user-scheduled-1")
      .first<{
        status: string;
        publish_request_id: string | null;
        published_post_id: string | null;
        published_at: string | null;
      }>();

    expect(postRow?.status).toBe("posted");
    expect(postRow?.publish_request_id).toBe("threads-post-1");
    expect(postRow?.published_post_id).toBe("threads-post-1");
    expect(postRow?.published_at).toBeTruthy();
    expect(publishSpy).toHaveBeenCalledTimes(2);
  });

  it("recovers stale posting rows and preserves deterministic transitions", async () => {
    await env.DB.exec(limitsSql);
    await env.DB.exec(appThreadsAccountsSql);
    await env.DB.exec(createThreadsAccountsTableSql);

    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, email_verified, created_at)
       VALUES (?, ?, NULL, 1, CURRENT_TIMESTAMP)`,
    )
      .bind("user-scheduled-2", "scheduled-2@example.com")
      .run();

    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("threads-scheduled-2", "token-scheduled-2", now + (30 * 24 * 60 * 60), now)
      .run();

    await env.DB.prepare(
      `INSERT INTO app_threads_accounts (app_user_id, threads_user_id, created_at)
       VALUES (?, ?, ?)`,
    )
      .bind("user-scheduled-2", "threads-scheduled-2", now)
      .run();

    await env.DB.prepare(
      `INSERT INTO scheduled_posts (
        user_id,
        threads_user_id,
        post_text,
        scheduled_time,
        status,
        processing_started_at
      )
      VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        "user-scheduled-2",
        "threads-scheduled-2",
        "Recovered message",
        "2026-03-12T00:00:00.000Z",
        "posting",
        "2026-03-11T00:00:00.000Z",
      )
      .run();

    const publishSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = typeof input === "string" ? input : input.url;
      if (requestUrl.includes("/v1.0/threads-scheduled-2/threads_publish")) {
        return new Response(JSON.stringify({ id: "threads-post-2" }), { status: 200 });
      }
      if (requestUrl.includes("/v1.0/threads-scheduled-2/threads")) {
        return new Response(JSON.stringify({ id: "threads-post-2" }), { status: 200 });
      }
      throw new Error(`Unexpected fetch call: ${requestUrl}`);
    });

    await runScheduled();

    const postRow = await env.DB.prepare(
      `SELECT status, publish_request_id, published_post_id
       FROM scheduled_posts
       WHERE user_id = ?
       LIMIT 1`,
    )
      .bind("user-scheduled-2")
      .first<{
        status: string;
        publish_request_id: string | null;
        published_post_id: string | null;
      }>();

    expect(postRow?.status).toBe("posted");
    expect(postRow?.publish_request_id).toBe("threads-post-2");
    expect(postRow?.published_post_id).toBe("threads-post-2");
    expect(publishSpy).toHaveBeenCalledTimes(2);
  });
});
