import { json, validateUuidLike } from "./validation.js";
import { logAuthEvent } from "./operationalLog.js";

const GENERIC_VERIFICATION_TOKEN_ERROR = "Invalid or expired verification token.";

export async function verifyEmail(request, env) {
  if (request.method !== "GET") {
    logAuthEvent("verify_email_rejected", { reason: "method_not_allowed" });
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();

  const tokenError = validateUuidLike(token, "Verification token");
  if (tokenError) {
    logAuthEvent("verify_email_failed", { reason: "token_format_invalid" });
    return json({ success: false, error: GENERIC_VERIFICATION_TOKEN_ERROR }, 400);
  }

  const tokenRow = await env.DB.prepare(
    `SELECT id, user_id, token, expires_at
     FROM email_verification_tokens
     WHERE token = ?
     LIMIT 1`,
  )
    .bind(token)
    .first();

  if (!tokenRow) {
    logAuthEvent("verify_email_failed", { reason: "token_invalid" });
    return json({ success: false, error: GENERIC_VERIFICATION_TOKEN_ERROR }, 400);
  }

  const expiresAt = new Date(tokenRow.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    await env.DB.prepare("DELETE FROM email_verification_tokens WHERE token = ?").bind(token).run();
    logAuthEvent("verify_email_failed", { reason: "token_expired" });
    return json({ success: false, error: GENERIC_VERIFICATION_TOKEN_ERROR }, 400);
  }

  await env.DB.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").bind(tokenRow.user_id).run();
  await env.DB.prepare("DELETE FROM email_verification_tokens WHERE token = ?").bind(token).run();
  logAuthEvent("verify_email_succeeded");

  return json({
    success: true,
    message: "Email verified successfully",
  });
}
