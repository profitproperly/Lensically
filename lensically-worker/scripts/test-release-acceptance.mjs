import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_CONTRACT_PATH,
  validateContractData,
  validateReleaseAcceptance,
  validateSourceAssertion,
} from "./validate-release-acceptance.mjs";

function clone(value) {
  return structuredClone(value);
}

function expectFailure(callback, code) {
  assert.throws(callback, (error) => {
    assert.match(String(error?.message ?? error), new RegExp(`^${code}`));
    return true;
  });
}

const contract = JSON.parse(readFileSync(DEFAULT_CONTRACT_PATH, "utf8"));
const result = validateReleaseAcceptance();
assert.equal(result.status, "passed");
assert.equal(result.timing_evidence_count, 8);
assert.ok(result.source_assertion_count >= 10);

const duplicateCategory = clone(contract);
duplicateCategory.timing_evidence[1].category = duplicateCategory.timing_evidence[0].category;
expectFailure(() => validateContractData(duplicateCategory), "release_acceptance_timing_category_duplicate");

const overTarget = clone(contract);
overTarget.timing_evidence[0].target_seconds = 1;
expectFailure(() => validateContractData(overTarget), "release_acceptance_target_missed");

const mismatchedDuration = clone(contract);
mismatchedDuration.timing_evidence[0].measured_seconds += 1;
expectFailure(() => validateContractData(mismatchedDuration), "release_acceptance_measurement_timestamp_mismatch");

const failedRun = clone(contract);
failedRun.timing_evidence[0].conclusion = "failure";
expectFailure(() => validateContractData(failedRun), "release_acceptance_conclusion_not_success");

const missingCategory = clone(contract);
missingCategory.timing_evidence.pop();
expectFailure(() => validateContractData(missingCategory), "release_acceptance_timing_evidence_count_invalid");

expectFailure(
  () => validateSourceAssertion({ id: "missing", all_of: ["required"] }, "not present"),
  "release_acceptance_source_marker_missing",
);
expectFailure(
  () => validateSourceAssertion({ id: "forbidden", none_of: ["unsafe"] }, "unsafe"),
  "release_acceptance_forbidden_source_marker",
);
expectFailure(
  () => validateSourceAssertion({ id: "count", regex_counts: [{ pattern: "safe", count: 2 }] }, "safe"),
  "release_acceptance_regex_count_mismatch",
);

const legacyPlanner = readFileSync(resolve(DEFAULT_CONTRACT_PATH, "..", "scripts", "plan-d1-migration-release.mjs"), "utf8");
assert.match(legacyPlanner, /LEGACY_MIGRATION_PLANNER_STATUS = "retired"/);
assert.doesNotMatch(legacyPlanner, /planMigrationRelease/);

process.stdout.write("release_acceptance_contract_valid\n");
