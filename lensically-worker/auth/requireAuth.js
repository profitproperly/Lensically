function unauthorized(message = "Unauthorized") {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export async function requireAuth(request, env) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session_token=([^;]+)/);
  const sessionToken = match ? match[1] : null;

  if (!sessionToken) {
    return unauthorized("Unauthorized");
  }

  const row = await env.DB.prepare(
    `SELECT
      sessions.user_id,
      sessions.expires_at,
      users.email,
      users.email_verified,
      users.is_admin,
      users.password_hash
    FROM sessions
    JOIN users
      ON sessions.user_id = users.id
    WHERE sessions.session_token = ?`,
  )
    .bind(sessionToken)
    .first();

  if (!row) {
    return unauthorized("Unauthorized");
  }

  if (new Date(row.expires_at) < new Date()) {
    return unauthorized("Session expired");
  }

  return {
    id: row.user_id,
    email: row.email,
    email_verified: row.email_verified,
    is_admin: Boolean(row.is_admin),
    has_password: Boolean(row.password_hash),
  };
}
