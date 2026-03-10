import bcrypt from "bcryptjs";
import { sendEmail } from "../email/sendEmail.js";

const PASSWORD_SALT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_APP_URL = "https://app.lensically.com";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function getValidResetTokenRow(env, token) {
  const tokenRow = await env.DB.prepare(
    `SELECT id, user_id, token, expires_at
     FROM password_reset_tokens
     WHERE token = ?
     LIMIT 1`,
  )
    .bind(token)
    .first();

  if (!tokenRow) {
    return { tokenRow: null, error: "Invalid reset token" };
  }

  const expiresAt = new Date(tokenRow.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    await env.DB.prepare("DELETE FROM password_reset_tokens WHERE token = ?").bind(token).run();
    return { tokenRow: null, error: "Reset token expired" };
  }

  return { tokenRow, error: null };
}

export async function forgotPassword(request, env) {
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const email = normalizeEmail(body?.email);
  if (!email) {
    return json({ success: false, error: "Email is required" }, 400);
  }

  const user = await env.DB.prepare("SELECT id, email FROM users WHERE email = ? LIMIT 1")
    .bind(email)
    .first();

  if (user) {
    const token = crypto.randomUUID();
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

    await env.DB.prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind(tokenId, user.id, token, expiresAt)
      .run();

    const appUrl = (env.APP_URL || env.WEB_APP_URL || DEFAULT_APP_URL).replace(/\/+$/, "");
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const subject = "Reset your Lensically password";
    const html = `<p>We received a request to reset your Lensically password.</p>
<p>Use the link below to set a new password:</p>
<p><a href="${resetUrl}">Reset password</a></p>`;

    await sendEmail(env, user.email, subject, html);
  }

  return json({
    success: true,
    message: "If an account exists, a reset email has been sent",
  });
}

export async function resetPassword(request, env) {
  if (request.method === "GET") {
    const token = new URL(request.url).searchParams.get("token")?.trim() || "";

    if (!token) {
      return json({ success: false, error: "Reset token is required" }, 400);
    }

    const { error } = await getValidResetTokenRow(env, token);
    if (error) {
      return json({ success: false, error }, 400);
    }

    return json({
      success: true,
      message: "Reset token is valid",
    });
  }

  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token || !password) {
    return json({ success: false, error: "Token and password are required" }, 400);
  }

  const { tokenRow, error } = await getValidResetTokenRow(env, token);
  if (error || !tokenRow) {
    return json({ success: false, error: error || "Invalid reset token" }, 400);
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

  await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .bind(passwordHash, tokenRow.user_id)
    .run();
  await env.DB.prepare("DELETE FROM password_reset_tokens WHERE token = ?").bind(token).run();

  return json({
    success: true,
    message: "Password reset successfully",
  });
}
