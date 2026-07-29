import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = resolve(fileURLToPath(new URL(".", import.meta.url)));
export const WORKER_ROOT = resolve(SCRIPT_DIRECTORY, "..");
export const BACKFILL_DIRECTORY = resolve(WORKER_ROOT, "database", "backfills");
const DATABASE_NAME = "lensically-db";
const CONFIG_PATH = "wrangler.jsonc";
const RUNS_TABLE = "lensically_backfill_runs";
const BATCHES_TABLE = "lensically_backfill_batch_receipts";
const PLAN_VERSION = "lensically-d1-backfill-plan-v1";
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SLUG = /^[a-z0-9][a-z0-9_-]{2,79}$/;
const OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/;

function fail(code, detail = "") {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function commandName(name) {
  return process.platform === "win32" && name === "npx" ? "npx.cmd" : name;
}

function run(command, args) {
  try {
    return execFileSync(commandName(command), args, {
      cwd: WORKER_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    }).trim();
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout).trim() : "";
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    fail("backfill_command_failed", JSON.stringify({ command, args, stdout, stderr }));
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) fail("backfill_argument_invalid", token);
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function assertSqlFragment(fragment, label) {
  if (typeof fragment !== "string" || fragment.trim().length === 0) fail(`backfill_${label}_missing`);
  const normalized = fragment.trim();
  if (normalized.length > 4000) fail(`backfill_${label}_too_long`);
  if (/;|--|\/\*|\*\//.test(normalized)) fail(`backfill_${label}_contains_statement_boundary`);
  if (/\b(?:ATTACH|DETACH|VACUUM|PRAGMA|DROP|ALTER|CREATE|REINDEX|TRUNCATE)\b/i.test(normalized)) {
    fail(`backfill_${label}_contains_ddl`);
  }
  return normalized;
}

function resolvePlanPath(planPath) {
  if (!planPath) fail("backfill_plan_path_missing");
  const absolute = resolve(WORKER_ROOT, planPath);
  const relativePath = relative(BACKFILL_DIRECTORY, absolute);
  if (relativePath.startsWith(`..${sep}`) || relativePath === ".." || relativePath.includes(`${sep}..${sep}`)) {
    fail("backfill_plan_outside_source_directory");
  }
  if (!absolute.endsWith(".json")) fail("backfill_plan_extension_invalid");
  if (!existsSync(absolute)) fail("backfill_plan_missing", absolute);
  return absolute;
}

export function validateBackfillPlan(rawPlan, planPath = "plan.json") {
  if (!rawPlan || typeof rawPlan !== "object" || Array.isArray(rawPlan)) fail("backfill_plan_not_object");
  const plan = {
    version: rawPlan.version,
    backfill_id: rawPlan.backfill_id,
    database: rawPlan.database,
    table: rawPlan.table,
    primary_key: rawPlan.primary_key,
    batch_size: Number(rawPlan.batch_size),
    max_batches_per_run: Number(rawPlan.max_batches_per_run),
    where_sql: assertSqlFragment(rawPlan.where_sql, "where_sql"),
    set_sql: assertSqlFragment(rawPlan.set_sql, "set_sql"),
    execution_mode: rawPlan.execution_mode,
    rationale: rawPlan.rationale,
  };
  if (plan.version !== PLAN_VERSION) fail("backfill_plan_version_invalid");
  if (!SLUG.test(plan.backfill_id ?? "")) fail("backfill_id_invalid");
  if (plan.database !== DATABASE_NAME) fail("backfill_database_invalid");
  if (!IDENTIFIER.test(plan.table ?? "")) fail("backfill_table_invalid");
  if (!IDENTIFIER.test(plan.primary_key ?? "")) fail("backfill_primary_key_invalid");
  if (!Number.isInteger(plan.batch_size) || plan.batch_size < 1 || plan.batch_size > 1000) fail("backfill_batch_size_invalid");
  if (!Number.isInteger(plan.max_batches_per_run) || plan.max_batches_per_run < 1 || plan.max_batches_per_run > 100) {
    fail("backfill_max_batches_invalid");
  }
  if (plan.execution_mode !== "explicit_only") fail("backfill_execution_mode_invalid");
  if (typeof plan.rationale !== "string" || plan.rationale.trim().length < 10 || plan.rationale.length > 1000) {
    fail("backfill_rationale_invalid");
  }
  if (!/^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/.test(plan.set_sql)) fail("backfill_set_sql_invalid");
  const canonical = {
    ...plan,
    plan_file: basename(planPath),
  };
  return {
    ...canonical,
    plan_sha256: sha256(stableJson(canonical)),
  };
}

export function loadBackfillPlan(planPath) {
  const absolute = resolvePlanPath(planPath);
  const parsed = JSON.parse(readFileSync(absolute, "utf8"));
  return validateBackfillPlan(parsed, absolute);
}

function extractResultObjects(value) {
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (Array.isArray(node.results)) found.push(...node.results);
    for (const child of Object.values(node)) visit(child);
  };
  visit(value);
  return found.filter((row) => row && typeof row === "object" && !Array.isArray(row));
}

function parseWranglerJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    const first = stdout.indexOf("[");
    const last = stdout.lastIndexOf("]");
    if (first < 0 || last <= first) fail("backfill_wrangler_json_invalid");
    return JSON.parse(stdout.slice(first, last + 1));
  }
}

function d1Execute(sql) {
  const stdout = run("npx", [
    "wrangler", "d1", "execute", DATABASE_NAME,
    "--remote", "--config", CONFIG_PATH, "--json", "--command", sql,
  ]);
  const parsed = parseWranglerJson(stdout);
  return { parsed, rows: extractResultObjects(parsed) };
}

function requireRemoteAccess() {
  const missing = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"].filter((name) => !process.env[name]);
  if (missing.length > 0) fail("backfill_remote_access_missing", missing.join(","));
}

function requireSourceSha() {
  const sourceSha = run("git", ["rev-parse", "HEAD"]);
  if (!/^[a-f0-9]{40}$/i.test(sourceSha)) fail("backfill_source_sha_invalid");
  return sourceSha;
}

function readRun(plan, operationId) {
  const query = `SELECT backfill_id, operation_id, plan_sha256, source_sha, table_name, status, last_cursor, batches_completed, rows_changed, remaining_rows, error_message FROM ${RUNS_TABLE} WHERE backfill_id = ${sqlString(plan.backfill_id)} AND operation_id = ${sqlString(operationId)} LIMIT 1`;
  return d1Execute(query).rows[0] ?? null;
}

function initializeRun(plan, operationId, sourceSha) {
  d1Execute(`INSERT OR IGNORE INTO ${RUNS_TABLE} (backfill_id, operation_id, plan_sha256, source_sha, table_name, status, last_cursor, batches_completed, rows_changed, remaining_rows, error_message, started_at, updated_at, completed_at) VALUES (${sqlString(plan.backfill_id)}, ${sqlString(operationId)}, ${sqlString(plan.plan_sha256)}, ${sqlString(sourceSha)}, ${sqlString(plan.table)}, 'running', NULL, 0, 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)`);
  const runState = readRun(plan, operationId);
  if (!runState) fail("backfill_run_initialization_failed");
  if (runState.plan_sha256 !== plan.plan_sha256) fail("backfill_operation_plan_conflict");
  if (runState.table_name !== plan.table) fail("backfill_operation_table_conflict");
  if (runState.status === "failed") fail("backfill_operation_failed_requires_new_operation_id", runState.error_message ?? "unknown");
  return runState;
}

function selectBatch(plan, lastCursor) {
  const cursorClause = lastCursor === null || lastCursor === undefined
    ? ""
    : ` AND ${plan.primary_key} > ${Number(lastCursor)}`;
  const sql = `SELECT ${plan.primary_key} AS backfill_cursor FROM ${plan.table} WHERE (${plan.where_sql})${cursorClause} ORDER BY ${plan.primary_key} ASC LIMIT ${plan.batch_size}`;
  const rows = d1Execute(sql).rows;
  const cursors = rows.map((row) => Number(row.backfill_cursor));
  if (cursors.some((value) => !Number.isSafeInteger(value))) fail("backfill_cursor_not_safe_integer");
  for (let index = 1; index < cursors.length; index += 1) {
    if (cursors[index] <= cursors[index - 1]) fail("backfill_cursor_not_strictly_increasing");
  }
  return cursors;
}

function remainingRows(plan) {
  const rows = d1Execute(`SELECT COUNT(*) AS remaining FROM ${plan.table} WHERE (${plan.where_sql})`).rows;
  const remaining = Number(rows[0]?.remaining);
  if (!Number.isSafeInteger(remaining) || remaining < 0) fail("backfill_remaining_count_invalid");
  return remaining;
}

function changedRowsFromResult(parsed) {
  const candidates = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node.meta && Number.isFinite(Number(node.meta.changes))) candidates.push(Number(node.meta.changes));
    for (const child of Object.values(node)) visit(child);
  };
  visit(parsed);
  return candidates.length > 0 ? Math.max(...candidates) : 0;
}

function applyBatch(plan, cursors) {
  const list = cursors.join(",");
  const result = d1Execute(`UPDATE ${plan.table} SET ${plan.set_sql} WHERE ${plan.primary_key} IN (${list}) AND (${plan.where_sql})`);
  const changedRows = changedRowsFromResult(result.parsed);
  if (changedRows < 0 || changedRows > cursors.length) fail("backfill_changed_rows_invalid");
  return changedRows;
}

function recordBatch(plan, operationId, batchNumber, cursorFrom, cursorTo, selectedRows, changedRows, remaining) {
  d1Execute(`INSERT INTO ${BATCHES_TABLE} (backfill_id, operation_id, batch_number, cursor_from, cursor_to, selected_rows, changed_rows, remaining_rows, started_at, completed_at) VALUES (${sqlString(plan.backfill_id)}, ${sqlString(operationId)}, ${batchNumber}, ${cursorFrom ?? "NULL"}, ${cursorTo ?? "NULL"}, ${selectedRows}, ${changedRows}, ${remaining}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
  const status = remaining === 0 ? "completed" : "running";
  const completedAt = remaining === 0 ? "CURRENT_TIMESTAMP" : "NULL";
  d1Execute(`UPDATE ${RUNS_TABLE} SET status = ${sqlString(status)}, last_cursor = ${cursorTo ?? "NULL"}, batches_completed = ${batchNumber}, rows_changed = rows_changed + ${changedRows}, remaining_rows = ${remaining}, error_message = NULL, updated_at = CURRENT_TIMESTAMP, completed_at = ${completedAt} WHERE backfill_id = ${sqlString(plan.backfill_id)} AND operation_id = ${sqlString(operationId)}`);
}

function pauseRun(plan, operationId, remaining) {
  d1Execute(`UPDATE ${RUNS_TABLE} SET status = 'paused', remaining_rows = ${remaining}, updated_at = CURRENT_TIMESTAMP WHERE backfill_id = ${sqlString(plan.backfill_id)} AND operation_id = ${sqlString(operationId)} AND status != 'completed'`);
}

function failRun(plan, operationId, error) {
  const message = error instanceof Error ? error.message : String(error);
  try {
    d1Execute(`UPDATE ${RUNS_TABLE} SET status = 'failed', error_message = ${sqlString(message.slice(0, 2000))}, updated_at = CURRENT_TIMESTAMP WHERE backfill_id = ${sqlString(plan.backfill_id)} AND operation_id = ${sqlString(operationId)} AND status != 'completed'`);
  } catch {
    // Preserve the original failure when progress recording itself is unavailable.
  }
}

export function runRemoteBackfill({ plan, operationId, confirmation }) {
  requireRemoteAccess();
  if (!OPERATION_ID.test(operationId ?? "")) fail("backfill_operation_id_invalid");
  if (confirmation !== plan.backfill_id) fail("backfill_explicit_confirmation_mismatch");
  const sourceSha = requireSourceSha();
  let state;
  try {
    state = initializeRun(plan, operationId, sourceSha);
    if (state.status === "completed") return { status: "completed", replay: true, state };
    let lastCursor = state.last_cursor === null ? null : Number(state.last_cursor);
    let batchNumber = Number(state.batches_completed ?? 0);
    for (let executed = 0; executed < plan.max_batches_per_run; executed += 1) {
      const cursors = selectBatch(plan, lastCursor);
      if (cursors.length === 0) {
        const remaining = remainingRows(plan);
        if (remaining !== 0) fail("backfill_no_progress_with_remaining_rows", String(remaining));
        d1Execute(`UPDATE ${RUNS_TABLE} SET status = 'completed', remaining_rows = 0, error_message = NULL, updated_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP WHERE backfill_id = ${sqlString(plan.backfill_id)} AND operation_id = ${sqlString(operationId)}`);
        return { status: "completed", batchesCompleted: batchNumber, remainingRows: 0 };
      }
      const cursorFrom = cursors[0];
      const cursorTo = cursors[cursors.length - 1];
      const changedRows = applyBatch(plan, cursors);
      const remaining = remainingRows(plan);
      batchNumber += 1;
      recordBatch(plan, operationId, batchNumber, cursorFrom, cursorTo, cursors.length, changedRows, remaining);
      lastCursor = cursorTo;
      if (remaining === 0) {
        return { status: "completed", batchesCompleted: batchNumber, remainingRows: 0 };
      }
    }
    const remaining = remainingRows(plan);
    pauseRun(plan, operationId, remaining);
    return { status: "paused", batchesCompleted: batchNumber, lastCursor, remainingRows: remaining };
  } catch (error) {
    if (state) failRun(plan, operationId, error);
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const plan = loadBackfillPlan(String(args.plan ?? ""));
  if (args.check) {
    process.stdout.write(`${JSON.stringify({ checked: true, plan })}\n`);
    return;
  }
  if (!args.remote) fail("backfill_remote_mode_required");
  const result = runRemoteBackfill({
    plan,
    operationId: String(args["operation-id"] ?? ""),
    confirmation: String(args.confirm ?? ""),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
