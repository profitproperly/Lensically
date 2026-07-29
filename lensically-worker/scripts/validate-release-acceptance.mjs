import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = resolve(fileURLToPath(new URL(".", import.meta.url)));
export const WORKER_ROOT = resolve(SCRIPT_DIRECTORY, "..");
export const REPOSITORY_ROOT = resolve(WORKER_ROOT, "..");
export const DEFAULT_CONTRACT_PATH = resolve(WORKER_ROOT, "release-acceptance.json");
const CONTRACT_VERSION = "lensically-release-acceptance-v1";
const REQUIRED_CATEGORIES = new Set([
  "routine_worker_validation",
  "routine_worker_deployment",
  "ordinary_web_release",
  "small_migration_release",
  "wrangler_cron_release",
  "workflow_infrastructure",
  "broad_architecture_milestone",
  "large_migration_or_backfill",
]);
const SHA_PATTERN = /^[a-f0-9]{40}$/;

function fail(code, detail = "") {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail("release_acceptance_json_invalid", error instanceof Error ? error.message : String(error));
  }
}

function requireNonemptyString(value, code) {
  if (typeof value !== "string" || value.trim().length === 0) fail(code);
  return value.trim();
}

function durationSeconds(startedAt, completedAt) {
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    fail("release_acceptance_timing_timestamp_invalid", JSON.stringify({ startedAt, completedAt }));
  }
  return Math.ceil((end - start) / 1000);
}

function countRegex(source, pattern) {
  let expression;
  try {
    expression = new RegExp(pattern, "g");
  } catch (error) {
    fail("release_acceptance_regex_invalid", `${pattern}:${error instanceof Error ? error.message : String(error)}`);
  }
  return [...source.matchAll(expression)].length;
}

function resolveRepositoryPath(relativePath) {
  const path = resolve(WORKER_ROOT, requireNonemptyString(relativePath, "release_acceptance_source_path_missing"));
  const repositoryRelative = path.slice(REPOSITORY_ROOT.length + 1);
  if (!path.startsWith(`${REPOSITORY_ROOT}/`) && path !== REPOSITORY_ROOT) {
    fail("release_acceptance_source_outside_repository", relativePath);
  }
  if (!existsSync(path)) fail("release_acceptance_source_missing", repositoryRelative || relativePath);
  return path;
}

export function validateSourceAssertion(assertion, source) {
  const id = requireNonemptyString(assertion?.id, "release_acceptance_source_assertion_id_missing");
  const allOf = Array.isArray(assertion.all_of) ? assertion.all_of : [];
  const noneOf = Array.isArray(assertion.none_of) ? assertion.none_of : [];
  const regexCounts = Array.isArray(assertion.regex_counts) ? assertion.regex_counts : [];
  if (allOf.length + noneOf.length + regexCounts.length === 0) {
    fail("release_acceptance_source_assertion_empty", id);
  }
  for (const marker of allOf) {
    const text = requireNonemptyString(marker, "release_acceptance_source_marker_invalid");
    if (!source.includes(text)) fail("release_acceptance_source_marker_missing", `${id}:${text}`);
  }
  for (const marker of noneOf) {
    const text = requireNonemptyString(marker, "release_acceptance_source_marker_invalid");
    if (source.includes(text)) fail("release_acceptance_forbidden_source_marker", `${id}:${text}`);
  }
  for (const rule of regexCounts) {
    const pattern = requireNonemptyString(rule?.pattern, "release_acceptance_regex_pattern_missing");
    if (!Number.isInteger(rule?.count) || rule.count < 0) fail("release_acceptance_regex_count_invalid", id);
    const actual = countRegex(source, pattern);
    if (actual !== rule.count) {
      fail("release_acceptance_regex_count_mismatch", JSON.stringify({ id, pattern, expected: rule.count, actual }));
    }
  }
  return { id, status: "passed" };
}

export function validateContractData(contract, { sourceLoader } = {}) {
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) fail("release_acceptance_contract_not_object");
  if (contract.version !== CONTRACT_VERSION) fail("release_acceptance_version_invalid", String(contract.version));
  if (contract.status !== "accepted") fail("release_acceptance_status_invalid", String(contract.status));
  if (!Number.isFinite(Date.parse(contract.accepted_at))) fail("release_acceptance_date_invalid");

  const evidence = Array.isArray(contract.timing_evidence) ? contract.timing_evidence : [];
  if (evidence.length !== REQUIRED_CATEGORIES.size) fail("release_acceptance_timing_evidence_count_invalid", String(evidence.length));
  const ids = new Set();
  const categories = new Set();
  const timingSummary = [];
  for (const item of evidence) {
    const id = requireNonemptyString(item?.id, "release_acceptance_timing_id_missing");
    const category = requireNonemptyString(item?.category, "release_acceptance_timing_category_missing");
    if (ids.has(id)) fail("release_acceptance_timing_id_duplicate", id);
    if (categories.has(category)) fail("release_acceptance_timing_category_duplicate", category);
    ids.add(id);
    categories.add(category);
    if (!REQUIRED_CATEGORIES.has(category)) fail("release_acceptance_timing_category_unknown", category);

    if (item.mode === "bounded") {
      if (!Number.isInteger(item.target_seconds) || item.target_seconds < 1 || item.target_seconds > 3600) {
        fail("release_acceptance_target_invalid", id);
      }
      if (!Number.isInteger(item.measured_seconds) || item.measured_seconds < 0) {
        fail("release_acceptance_measurement_invalid", id);
      }
      if (!Number.isInteger(item.run_id) || item.run_id < 1 || !Number.isInteger(item.job_id) || item.job_id < 1) {
        fail("release_acceptance_run_identity_invalid", id);
      }
      if (!SHA_PATTERN.test(String(item.commit_sha ?? ""))) fail("release_acceptance_commit_sha_invalid", id);
      if (item.conclusion !== "success") fail("release_acceptance_conclusion_not_success", id);
      const calculated = durationSeconds(item.started_at, item.completed_at);
      if (calculated !== item.measured_seconds) {
        fail("release_acceptance_measurement_timestamp_mismatch", JSON.stringify({ id, measured: item.measured_seconds, calculated }));
      }
      if (item.measured_seconds > item.target_seconds) {
        fail("release_acceptance_target_missed", JSON.stringify({ id, measured: item.measured_seconds, target: item.target_seconds }));
      }
      requireNonemptyString(item.proof, "release_acceptance_proof_missing");
      timingSummary.push({ id, category, measured_seconds: item.measured_seconds, target_seconds: item.target_seconds, status: "passed" });
    } else if (item.mode === "actual_database_work") {
      const contractPath = resolveRepositoryPath(item.contract_path);
      const source = readFileSync(contractPath, "utf8");
      for (const marker of ["explicit_only", "batches_completed", "remaining_rows", "backfill_explicit_confirmation_mismatch"]) {
        if (!source.includes(marker)) fail("release_acceptance_backfill_contract_incomplete", marker);
      }
      const tables = Array.isArray(item.receipt_tables) ? item.receipt_tables : [];
      if (tables.length !== 2 || !tables.includes("lensically_backfill_runs") || !tables.includes("lensically_backfill_batch_receipts")) {
        fail("release_acceptance_backfill_receipt_tables_invalid");
      }
      requireNonemptyString(item.proof, "release_acceptance_proof_missing");
      timingSummary.push({ id, category, governance: "actual_database_work", status: "passed" });
    } else {
      fail("release_acceptance_timing_mode_invalid", `${id}:${String(item.mode)}`);
    }
  }
  const missingCategories = [...REQUIRED_CATEGORIES].filter((category) => !categories.has(category));
  if (missingCategories.length > 0) fail("release_acceptance_timing_category_missing", missingCategories.join(","));

  const assertions = Array.isArray(contract.source_assertions) ? contract.source_assertions : [];
  if (assertions.length < 10) fail("release_acceptance_source_assertion_count_invalid", String(assertions.length));
  const assertionIds = new Set();
  const sourceSummary = [];
  for (const assertion of assertions) {
    const id = requireNonemptyString(assertion?.id, "release_acceptance_source_assertion_id_missing");
    if (assertionIds.has(id)) fail("release_acceptance_source_assertion_duplicate", id);
    assertionIds.add(id);
    const path = resolveRepositoryPath(assertion.path);
    const source = sourceLoader ? sourceLoader(path, assertion) : readFileSync(path, "utf8").replaceAll("\r\n", "\n");
    sourceSummary.push(validateSourceAssertion(assertion, source));
  }

  const signals = Array.isArray(contract.known_non_authoritative_signals) ? contract.known_non_authoritative_signals : [];
  for (const signal of signals) {
    if (signal.authority !== "non_authoritative") fail("release_acceptance_external_signal_authority_invalid");
    requireNonemptyString(signal.name, "release_acceptance_external_signal_name_missing");
    requireNonemptyString(signal.reason, "release_acceptance_external_signal_reason_missing");
  }

  return {
    contract: CONTRACT_VERSION,
    status: "passed",
    timing_evidence_count: timingSummary.length,
    source_assertion_count: sourceSummary.length,
    timing: timingSummary,
    sources: sourceSummary,
    non_authoritative_signal_count: signals.length,
  };
}

export function validateReleaseAcceptance(contractPath = DEFAULT_CONTRACT_PATH) {
  const path = resolve(contractPath);
  if (!existsSync(path)) fail("release_acceptance_contract_missing", path);
  return validateContractData(readJson(path));
}

async function main() {
  const args = process.argv.slice(2);
  const pathIndex = args.indexOf("--contract");
  const contractPath = pathIndex >= 0 ? args[pathIndex + 1] : DEFAULT_CONTRACT_PATH;
  const result = validateReleaseAcceptance(contractPath);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
