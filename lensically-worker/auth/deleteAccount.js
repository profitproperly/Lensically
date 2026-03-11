import bcrypt from "bcryptjs";
import { requireAuth } from "./requireAuth.js";
import { clearAuthCookies } from "./cookies.js";

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "unknown_error";
}

const FORBIDDEN_TARGET_FIELDS = [
  "id",
  "user_id",
  "userId",
  "target_user_id",
  "targetUserId",
];

function hasForbiddenTargetingInput(body, searchParams) {
  for (const field of FORBIDDEN_TARGET_FIELDS) {
    if (searchParams.has(field)) {
      return true;
    }

    if (
      body
      && typeof body === "object"
      && !Array.isArray(body)
      && Object.prototype.hasOwnProperty.call(body, field)
    ) {
      return true;
    }
  }

  return false;
}

async function tableExists(db, tableName) {
  const row = await db.prepare(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table' AND name = ?
     LIMIT 1`,
  )
    .bind(tableName)
    .first();

  return Boolean(row?.name);
}

async function deleteThreadsAccountLink(db, userId) {
  const appThreadsTableExists = await tableExists(db, "app_threads_accounts");
  if (!appThreadsTableExists) {
    return;
  }

  const existingLink = await db.prepare(
    `SELECT threads_user_id
     FROM app_threads_accounts
     WHERE app_user_id = ?
     LIMIT 1`,
  )
    .bind(userId)
    .first();

  if (!existingLink?.threads_user_id) {
    return;
  }

  const threadsUserId = existingLink.threads_user_id;

  await db.prepare(
    `DELETE FROM app_threads_accounts
     WHERE app_user_id = ?`,
  )
    .bind(userId)
    .run();

  const threadsAccountsTableExists = await tableExists(db, "threads_accounts");
  if (!threadsAccountsTableExists) {
    return;
  }

  const remainingLinks = await db.prepare(
    `SELECT COUNT(*) AS total
     FROM app_threads_accounts
     WHERE threads_user_id = ?`,
  )
    .bind(threadsUserId)
    .first();

  if (Number(remainingLinks?.total ?? 0) === 0) {
    await db.prepare(
      `DELETE FROM threads_accounts
       WHERE threads_user_id = ?`,
    )
      .bind(threadsUserId)
      .run();
  }
}

export async function deleteAccount(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  const user = await requireAuth(request, env);
  if (user instanceof Response) {
    return user;
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { searchParams } = new URL(request.url);
  if (hasForbiddenTargetingInput(body, searchParams)) {
    return jsonResponse({
      success: false,
      error: "Target user identifiers are not allowed for account deletion.",
    }, 400);
  }

  const password = typeof body?.password === "string" ? body.password : "";

  if (user.has_password) {
    if (!password) {
      return jsonResponse({
        success: false,
        error: "Password is required to delete this account.",
      }, 400);
    }

    const passwordRow = await env.DB.prepare(
      "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
    )
      .bind(user.id)
      .first();

    if (!passwordRow?.password_hash) {
      return jsonResponse({
        success: false,
        error: "Password re-authentication is unavailable for this account.",
      }, 400);
    }

    const passwordOk = await bcrypt.compare(password, passwordRow.password_hash);
    if (!passwordOk) {
      return jsonResponse({
        success: false,
        error: "Invalid password.",
      }, 401);
    }
  }

  const dbSession = env.DB.withSession("first-primary");
  let transactionStarted = false;

  try {
    await dbSession.prepare("BEGIN TRANSACTION").run();
    transactionStarted = true;

    await deleteThreadsAccountLink(dbSession, user.id);

    await dbSession.prepare("DELETE FROM user_daily_usage WHERE user_id = ?")
      .bind(user.id)
      .run();

    await dbSession.prepare("DELETE FROM user_usage_daily WHERE user_id = ?")
      .bind(user.id)
      .run();

    await dbSession.prepare("DELETE FROM scheduled_posts WHERE user_id = ?")
      .bind(user.id)
      .run();

    const result = await dbSession.prepare("DELETE FROM users WHERE id = ?")
      .bind(user.id)
      .run();

    if (Number(result.meta?.changes ?? 0) === 0) {
      await dbSession.prepare("ROLLBACK").run();
      transactionStarted = false;
      return jsonResponse({
        success: false,
        error: "Account not found",
      }, 404);
    }

    await dbSession.prepare("COMMIT").run();
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      try {
        await dbSession.prepare("ROLLBACK").run();
      } catch (rollbackError) {
        console.error(JSON.stringify({
          event: "ACCOUNT_DELETION_ROLLBACK_FAILED",
          user_id: user.id,
          error: getErrorMessage(rollbackError),
        }));
      }
    }

    console.error(JSON.stringify({
      event: "ACCOUNT_DELETION_FAILED",
      user_id: user.id,
      error: getErrorMessage(error),
    }));

    return jsonResponse({
      success: false,
      error: "Could not delete account. Please try again.",
    }, 500);
  }

  const headers = new Headers({
    "Content-Type": "application/json",
  });
  for (const cookie of clearAuthCookies()) {
    headers.append("Set-Cookie", cookie);
  }

  console.log(JSON.stringify({
    event: "ACCOUNT_DELETION_COMPLETED",
    user_id: user.id,
  }));

  return new Response(JSON.stringify({
    success: true,
    message: "Account has been permanently deleted",
    user: {
      id: user.id,
      email: user.email,
      email_verified: user.email_verified,
    },
  }), {
    status: 200,
    headers,
  });
}
