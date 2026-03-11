import { readFileSync } from "node:fs";
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src";

const authSchema = readFileSync(new URL("../db/auth_schema.sql", import.meta.url), "utf8");

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
    DELETE FROM users;
  `);
}

beforeEach(async () => {
  await resetDatabase();
});

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
