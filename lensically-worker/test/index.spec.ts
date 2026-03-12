import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src";
import authSchema from "../db/auth_schema.sql?raw";
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

const resetStatements = `
  DELETE FROM sessions;
  DELETE FROM oauth_accounts;
  DELETE FROM email_verification_tokens;
  DELETE FROM password_reset_tokens;
  DELETE FROM auth_rate_limits;
  DELETE FROM account_deletion_guards;
  DELETE FROM account_deletion_tombstones;
  DELETE FROM banned_identities;
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
      error: "Unexpected field: role",
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
      error: "Unexpected field: target_user_id",
    });
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
