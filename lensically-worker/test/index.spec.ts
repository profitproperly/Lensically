import { readFileSync } from "node:fs";
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src";

const authSchema = readFileSync(new URL("../db/auth_schema.sql", import.meta.url), "utf8");
const SESSION_COOKIE_NAME = "__Host-session_token";

async function runWorker(request: Request) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

async function resetDatabase() {
  await env.DB.exec(authSchema);
  await env.DB.exec(`
    DELETE FROM sessions;
    DELETE FROM oauth_accounts;
    DELETE FROM email_verification_tokens;
    DELETE FROM password_reset_tokens;
    DELETE FROM auth_rate_limits;
    DELETE FROM account_deletion_guards;
    DELETE FROM users;
  `);
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
      error: "Invalid verification token",
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
      error: "Invalid reset token",
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
