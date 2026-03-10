import bcrypt from "bcryptjs";
import { sendEmail } from "../email/sendEmail.js";

const PASSWORD_SALT_ROUNDS = 12;
const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function register(request, env) {
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return json({ success: false, error: "Email and password are required" }, 400);
  }

  if (!isValidEmail(email)) {
    return json({ success: false, error: "Invalid email address" }, 400);
  }

  const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
    .bind(email)
    .first();
  if (existingUser) {
    return json({ success: false, error: "Email already exists" }, 409);
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
      return json({ success: false, error: "Email already exists" }, 409);
    }
    throw error;
  }

  const verificationToken = crypto.randomUUID();
  const verificationTokenId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + EMAIL_TOKEN_TTL_MS).toISOString();

  await env.DB.prepare(
    `INSERT INTO email_verification_tokens (id, user_id, token, expires_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(verificationTokenId, userId, verificationToken, expiresAt)
    .run();

  const verifyUrl = `${env.APP_URL}/verify-email?token=${encodeURIComponent(verificationToken)}`;
  const subject = "Verify your Lensically account";
  const html = `<p>Welcome to Lensically.</p>
<p>Please verify your email by clicking the link below:</p>
<p><a href="${verifyUrl}">Verify your email</a></p>`;

  await sendEmail(env, email, subject, html);

  return json({
    success: true,
    message: "Verification email sent",
  });
}
