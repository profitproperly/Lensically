import bcrypt from "bcryptjs";
import { sendEmail } from "../email/sendEmail.js";
import {
  json,
  normalizeEmail,
  readJsonObject,
  rejectUnexpectedFields,
  validateEmail,
  validatePassword,
} from "./validation.js";
import { logAuthEvent } from "./operationalLog.js";

const PASSWORD_SALT_ROUNDS = 12;
const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_WEB_APP_URL = "https://app.lensically.com";
const GENERIC_REGISTRATION_MESSAGE = "If the email address is eligible, a verification email will be sent.";

function buildVerificationEmailHtml(verifyUrl) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify your Lensically account</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background-color:#111827;padding:24px 32px;text-align:center;">
                <div style="font-size:24px;font-weight:700;letter-spacing:0.02em;color:#ffffff;">Lensically</div>
                <div style="margin-top:8px;font-size:13px;color:#d1d5db;">Social signal analytics</div>
              </td>
            </tr>
            <tr>
              <td style="padding:40px 32px 24px 32px;">
                <h1 style="margin:0 0 16px 0;font-size:28px;line-height:1.2;color:#111827;">Verify your email</h1>
                <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#374151;">
                  Welcome to Lensically. Confirm your email address to activate your account and continue.
                </p>
                <p style="margin:0 0 32px 0;font-size:16px;line-height:1.6;color:#374151;">
                  Click the button below to verify your email. This link will expire in 24 hours.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 32px auto;">
                  <tr>
                    <td align="center" style="border-radius:10px;background-color:#111827;">
                      <a
                        href="${verifyUrl}"
                        style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;"
                      >
                        Verify Email
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#6b7280;">
                  If the button does not work, copy and paste this link into your browser:
                </p>
                <p style="margin:0;word-break:break-word;font-size:14px;line-height:1.6;">
                  <a href="${verifyUrl}" style="color:#111827;text-decoration:underline;">${verifyUrl}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <div style="border-top:1px solid #e5e7eb;padding-top:24px;font-size:12px;line-height:1.6;color:#9ca3af;text-align:center;">
                  You received this email because a Lensically account was created with this address.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendVerificationEmail(env, userId, email) {
  const verificationToken = crypto.randomUUID();
  const verificationTokenId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + EMAIL_TOKEN_TTL_MS).toISOString();

  await env.DB.prepare(
    `INSERT INTO email_verification_tokens (id, user_id, token, expires_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(verificationTokenId, userId, verificationToken, expiresAt)
    .run();

  const webAppUrl = (env.APP_URL || env.WEB_APP_URL || DEFAULT_WEB_APP_URL).replace(/\/+$/, "");
  const verifyUrl = `${webAppUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;

  try {
    await sendEmail(env, email, "Verify your Lensically account", buildVerificationEmailHtml(verifyUrl));
  } catch (error) {
    logAuthEvent("register_email_failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function register(request, env) {
  if (request.method !== "POST") {
    logAuthEvent("register_rejected", { reason: "method_not_allowed" });
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    logAuthEvent("register_rejected", { reason: "invalid_json" });
    return parsed.response ?? json({ success: false, error: "Invalid JSON body" }, 400);
  }
  const { body } = parsed;

  const unexpectedFieldResponse = rejectUnexpectedFields(body, ["email", "password"]);
  if (unexpectedFieldResponse) {
    logAuthEvent("register_rejected", { reason: "unexpected_field" });
    return unexpectedFieldResponse;
  }

  const email = normalizeEmail(body.email);
  const password = typeof body?.password === "string" ? body.password : "";

  const emailError = validateEmail(email, "Email and password are required");
  if (emailError) {
    logAuthEvent("register_rejected", { reason: "invalid_email" });
    return json({ success: false, error: emailError }, 400);
  }

  const passwordError = validatePassword(password, "Email and password are required");
  if (passwordError) {
    logAuthEvent("register_rejected", { reason: "invalid_password" });
    return json({ success: false, error: passwordError }, 400);
  }

  const existingUser = await env.DB.prepare(
    "SELECT id, email_verified FROM users WHERE email = ? LIMIT 1",
  )
    .bind(email)
    .first();
  if (existingUser) {
    logAuthEvent("register_duplicate_email_received", {
      email_verified: Boolean(existingUser.email_verified),
    });

    if (!existingUser.email_verified) {
      await sendVerificationEmail(env, existingUser.id, email);
    }

    return json({
      success: true,
      message: GENERIC_REGISTRATION_MESSAGE,
    });
  }

  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

  try {
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, email_verified, created_at)
       VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)`,
    )
      .bind(userId, email, passwordHash)
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("UNIQUE constraint failed: users.email")) {
      logAuthEvent("register_duplicate_email_received", { email_verified: null });
      return json({
        success: true,
        message: GENERIC_REGISTRATION_MESSAGE,
      });
    }
    throw error;
  }

  await sendVerificationEmail(env, userId, email);

  logAuthEvent("register_succeeded", { verification_email_attempted: true });

  return json({
    success: true,
    message: GENERIC_REGISTRATION_MESSAGE,
  });
}
