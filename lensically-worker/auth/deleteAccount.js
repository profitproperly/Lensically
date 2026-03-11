import bcrypt from "bcryptjs";
import { requireAuth } from "./requireAuth.js";
import { clearAuthCookies } from "./cookies.js";
import { getSessionCookieValue } from "./sessions.js";
import {
  readJsonObject,
  rejectUnexpectedFields,
  validateConfirmationText,
  validatePassword,
} from "./validation.js";
import { logAccountDeletionEvent } from "./operationalLog.js";

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function buildDeletionResponse(body, status = 200) {
  const headers = new Headers({
    "Content-Type": "application/json",
  });
  for (const cookie of clearAuthCookies()) {
    headers.append("Set-Cookie", cookie);
  }

  return new Response(JSON.stringify(body), {
    status,
    headers,
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
const OAUTH_DELETE_CONFIRMATION_TEXT = "DELETE";

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

async function ensureAccountDeletionGuardsTable(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS account_deletion_guards (
      session_token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )`,
  ).run();
}

async function getDeletionGuard(db, sessionToken) {
  return db.prepare(
    `SELECT session_token, user_id, status, completed_at
     FROM account_deletion_guards
     WHERE session_token = ?
     LIMIT 1`,
  )
    .bind(sessionToken)
    .first();
}

async function createDeletionGuard(db, sessionToken, userId) {
  return db.prepare(
    `INSERT INTO account_deletion_guards (session_token, user_id, status, created_at, updated_at)
     VALUES (?, ?, 'in_progress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(session_token) DO NOTHING`,
  )
    .bind(sessionToken, userId)
    .run();
}

async function markDeletionGuardCompleted(db, sessionToken) {
  await db.prepare(
    `UPDATE account_deletion_guards
     SET status = 'completed',
         updated_at = CURRENT_TIMESTAMP,
         completed_at = CURRENT_TIMESTAMP
     WHERE session_token = ?`,
  )
    .bind(sessionToken)
    .run();
}

async function removeDeletionGuard(db, sessionToken) {
  await db.prepare(
    `DELETE FROM account_deletion_guards
     WHERE session_token = ?`,
  )
    .bind(sessionToken)
    .run();
}

export async function deleteAccount(request, env) {
  if (request.method !== "POST") {
    logAccountDeletionEvent("deletion_rejected", { reason: "method_not_allowed" });
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  const sessionToken = getSessionCookieValue(request);
  if (!sessionToken) {
    logAccountDeletionEvent("deletion_rejected", { reason: "missing_session" });
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  await ensureAccountDeletionGuardsTable(env.DB);
  const existingGuard = await getDeletionGuard(env.DB, sessionToken);
  if (existingGuard?.status === "completed") {
    logAccountDeletionEvent("deletion_duplicate_ignored", { status: "completed" });
    return buildDeletionResponse({
      success: true,
      message: "Account deletion already processed",
    });
  }
  if (existingGuard?.status === "in_progress") {
    logAccountDeletionEvent("deletion_duplicate_blocked", { status: "in_progress" });
    return jsonResponse({
      success: false,
      error: "Account deletion is already in progress.",
    }, 409);
  }

  const user = await requireAuth(request, env);
  if (user instanceof Response) {
    logAccountDeletionEvent("deletion_rejected", { reason: "unauthorized" });
    return user;
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    logAccountDeletionEvent("deletion_rejected", { reason: "invalid_json" });
    return parsed.response ?? jsonResponse({ success: false, error: "Invalid JSON body" }, 400);
  }
  const body = parsed.body;

  const unexpectedFieldResponse = rejectUnexpectedFields(body, ["password", "confirmation_text"]);
  if (unexpectedFieldResponse) {
    logAccountDeletionEvent("deletion_rejected", { reason: "unexpected_field" });
    return unexpectedFieldResponse;
  }

  const { searchParams } = new URL(request.url);
  if (hasForbiddenTargetingInput(body, searchParams)) {
    logAccountDeletionEvent("deletion_rejected", { reason: "forbidden_targeting_input" });
    return jsonResponse({
      success: false,
      error: "Target user identifiers are not allowed for account deletion.",
    }, 400);
  }

  const password = typeof body?.password === "string" ? body.password : "";
  const confirmationText =
    typeof body?.confirmation_text === "string"
      ? body.confirmation_text.trim().toUpperCase()
      : "";

  if (user.has_password) {
    if (confirmationText) {
      logAccountDeletionEvent("deletion_rejected", { reason: "confirmation_text_not_supported" });
      return jsonResponse({
        success: false,
        error: "Confirmation text is not supported for password-based account deletion.",
      }, 400);
    }

    const passwordError = validatePassword(password, "Password is required to delete this account.");
    if (passwordError) {
      logAccountDeletionEvent("deletion_rejected", { reason: "password_missing_or_invalid", account_type: "password" });
      return jsonResponse({
        success: false,
        error: passwordError,
      }, 400);
    }

    const passwordRow = await env.DB.prepare(
      "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
    )
      .bind(user.id)
      .first();

    if (!passwordRow?.password_hash) {
      logAccountDeletionEvent("deletion_rejected", { reason: "password_reauth_unavailable", account_type: "password" });
      return jsonResponse({
        success: false,
        error: "Password re-authentication is unavailable for this account.",
      }, 400);
    }

    const passwordOk = await bcrypt.compare(password, passwordRow.password_hash);
    if (!passwordOk) {
      logAccountDeletionEvent("deletion_failed", { reason: "password_invalid", account_type: "password" });
      return jsonResponse({
        success: false,
        error: "Invalid password.",
      }, 401);
    }
  } else {
    const confirmationTextError = validateConfirmationText(confirmationText, OAUTH_DELETE_CONFIRMATION_TEXT);
    if (confirmationTextError) {
      logAccountDeletionEvent("deletion_rejected", { reason: "confirmation_text_invalid", account_type: "oauth" });
      return jsonResponse({
        success: false,
        error: confirmationTextError,
      }, 400);
    }
  }

  if (!user.has_password && password) {
    logAccountDeletionEvent("deletion_rejected", { reason: "password_not_supported", account_type: "oauth" });
    return jsonResponse({
      success: false,
      error: "Password is not supported for this account deletion flow.",
    }, 400);
  }

  const guardInsert = await createDeletionGuard(env.DB, sessionToken, user.id);
  if (Number(guardInsert.meta?.changes ?? 0) === 0) {
    const concurrentGuard = await getDeletionGuard(env.DB, sessionToken);
    if (concurrentGuard?.status === "completed") {
      logAccountDeletionEvent("deletion_duplicate_ignored", { status: "completed" });
      return buildDeletionResponse({
        success: true,
        message: "Account deletion already processed",
      });
    }

    logAccountDeletionEvent("deletion_duplicate_blocked", { status: "in_progress" });
    return jsonResponse({
      success: false,
      error: "Account deletion is already in progress.",
    }, 409);
  }

  const dbSession = env.DB.withSession("first-primary");
  let transactionStarted = false;
  logAccountDeletionEvent("deletion_started", {
    account_type: user.has_password ? "password" : "oauth",
    session_guard: "acquired",
  });

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
        logAccountDeletionEvent("deletion_rollback_failed", {
          reason: getErrorMessage(rollbackError),
        }, "error");
      }
    }

    logAccountDeletionEvent("deletion_failed", {
      reason: getErrorMessage(error),
    }, "error");

    await removeDeletionGuard(env.DB, sessionToken);

    return jsonResponse({
      success: false,
      error: "Could not delete account. Please try again.",
    }, 500);
  }
  await markDeletionGuardCompleted(env.DB, sessionToken);
  logAccountDeletionEvent("deletion_completed", {
    account_type: user.has_password ? "password" : "oauth",
    session_guard: "completed",
  });

  return buildDeletionResponse({
    success: true,
    message: "Account has been permanently deleted",
    user: {
      id: user.id,
      email: user.email,
      email_verified: user.email_verified,
    },
  });
}
