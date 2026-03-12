import bcrypt from "bcryptjs";
import { sendEmail } from "../email/sendEmail.js";
import {
  json,
  normalizeEmail,
  readJsonObject,
  rejectUnexpectedFields,
  validateEmail,
  validatePassword,
  validateUuidLike,
} from "./validation.js";
import { logAuthEvent } from "./operationalLog.js";

const PASSWORD_SALT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_APP_URL = "https://app.lensically.com";
const GENERIC_RESET_REQUEST_MESSAGE = "If the account is eligible, password reset instructions will be sent.";
const GENERIC_RESET_TOKEN_ERROR = "Invalid or expired reset token.";

function isProductionEnvironment(env) {
  return env?.ENVIRONMENT === "production";
}

function genericResetTokenErrorResponse() {
  return json({ success: false, error: GENERIC_RESET_TOKEN_ERROR }, 400);
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
    return { tokenRow: null, error: GENERIC_RESET_TOKEN_ERROR };
  }

  const expiresAt = new Date(tokenRow.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    await env.DB.prepare("DELETE FROM password_reset_tokens WHERE token = ?").bind(token).run();
    return { tokenRow: null, error: GENERIC_RESET_TOKEN_ERROR };
  }

  return { tokenRow, error: null };
}

export async function forgotPassword(request, env) {
  if (request.method !== "POST") {
    logAuthEvent("forgot_password_rejected", { reason: "method_not_allowed" });
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    logAuthEvent("forgot_password_rejected", { reason: "invalid_json" });
    return parsed.response ?? json({ success: false, error: "Invalid JSON body" }, 400);
  }
  const { body } = parsed;

  const unexpectedFieldResponse = rejectUnexpectedFields(body, ["email"]);
  if (unexpectedFieldResponse) {
    logAuthEvent("forgot_password_rejected", { reason: "unexpected_field" });
    return unexpectedFieldResponse;
  }

  const email = normalizeEmail(body?.email);
  const emailError = validateEmail(email);
  if (emailError) {
    logAuthEvent("forgot_password_rejected", { reason: "invalid_email" });
    return json({ success: false, error: emailError }, 400);
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

    if (!isProductionEnvironment(env)) {
      logAuthEvent("forgot_password_email_skipped", {
        account_found: true,
        reason: "non_production_environment",
      });
    } else {
      try {
        await sendEmail(env, user.email, subject, html);
        logAuthEvent("forgot_password_email_queued", { account_found: true });
      } catch (error) {
        logAuthEvent("forgot_password_email_queued", {
          account_found: true,
          email_dispatch_succeeded: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } else {
    logAuthEvent("forgot_password_email_queued", { account_found: false });
  }

  return json({
    success: true,
    message: GENERIC_RESET_REQUEST_MESSAGE,
  });
}

export async function resetPassword(request, env) {
  if (request.method === "GET") {
    try {
      const token = new URL(request.url).searchParams.get("token")?.trim() || "";

      const tokenError = validateUuidLike(token, "Reset token");
      if (tokenError) {
        logAuthEvent("reset_password_token_invalid", { reason: "token_format_invalid" });
        return genericResetTokenErrorResponse();
      }

      const { error } = await getValidResetTokenRow(env, token);
      if (error) {
        logAuthEvent("reset_password_token_invalid", { reason: error });
        return genericResetTokenErrorResponse();
      }
    } catch (error) {
      logAuthEvent("reset_password_token_invalid", {
        reason: "token_lookup_exception",
        detail: error instanceof Error ? error.message : String(error),
      });
      return genericResetTokenErrorResponse();
    }

    logAuthEvent("reset_password_token_validated");

    return json({
      success: true,
      message: "Reset token is valid",
    });
  }

  if (request.method !== "POST") {
    logAuthEvent("reset_password_rejected", { reason: "method_not_allowed" });
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    logAuthEvent("reset_password_rejected", { reason: "invalid_json" });
    return parsed.response ?? json({ success: false, error: "Invalid JSON body" }, 400);
  }
  const { body } = parsed;

  const unexpectedFieldResponse = rejectUnexpectedFields(body, ["token", "password"]);
  if (unexpectedFieldResponse) {
    logAuthEvent("reset_password_rejected", { reason: "unexpected_field" });
    return unexpectedFieldResponse;
  }

  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const tokenError = validateUuidLike(token, "Reset token");
  if (tokenError) {
    logAuthEvent("reset_password_rejected", { reason: "token_format_invalid" });
    return json({ success: false, error: GENERIC_RESET_TOKEN_ERROR }, 400);
  }

  const passwordError = validatePassword(password, "Token and password are required");
  if (passwordError) {
    logAuthEvent("reset_password_rejected", { reason: "invalid_password" });
    return json({ success: false, error: passwordError }, 400);
  }

  let tokenRow;
  try {
    const tokenLookup = await getValidResetTokenRow(env, token);
    tokenRow = tokenLookup.tokenRow;
    if (tokenLookup.error || !tokenRow) {
      logAuthEvent("reset_password_failed", { reason: tokenLookup.error || "invalid_reset_token" });
      return genericResetTokenErrorResponse();
    }
  } catch (error) {
    logAuthEvent("reset_password_failed", {
      reason: "token_lookup_exception",
      detail: error instanceof Error ? error.message : String(error),
    });
    return genericResetTokenErrorResponse();
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

  await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .bind(passwordHash, tokenRow.user_id)
    .run();
  await env.DB.prepare("DELETE FROM password_reset_tokens WHERE token = ?").bind(token).run();
  logAuthEvent("reset_password_succeeded");

  return json({
    success: true,
    message: "Password reset successfully",
  });
}
