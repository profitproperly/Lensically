function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function verifyEmail(request, env) {
  if (request.method !== "GET") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();

  if (!token) {
    return json({ success: false, error: "Token is required" }, 400);
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
    return json({ success: false, error: "Invalid verification token" }, 400);
  }

  const expiresAt = new Date(tokenRow.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    await env.DB.prepare("DELETE FROM email_verification_tokens WHERE token = ?").bind(token).run();
    return json({ success: false, error: "Verification token expired" }, 400);
  }

  await env.DB.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").bind(tokenRow.user_id).run();
  await env.DB.prepare("DELETE FROM email_verification_tokens WHERE token = ?").bind(token).run();

  return json({
    success: true,
    message: "Email verified successfully",
  });
}
