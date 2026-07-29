import assert from "node:assert/strict";
import { validateBackfillPlan } from "./run-d1-backfill.mjs";

function validPlan(overrides = {}) {
  return {
    version: "lensically-d1-backfill-plan-v1",
    backfill_id: "normalize-example-records",
    database: "lensically-db",
    table: "example_records",
    primary_key: "id",
    batch_size: 100,
    max_batches_per_run: 10,
    where_sql: "normalized_at IS NULL",
    set_sql: "normalized_at = CURRENT_TIMESTAMP",
    execution_mode: "explicit_only",
    rationale: "Normalize historical records in bounded resumable batches.",
    ...overrides,
  };
}

function expectFailure(plan, code) {
  assert.throws(() => validateBackfillPlan(plan), (error) => {
    assert.match(String(error?.message ?? error), new RegExp(`^${code}`));
    return true;
  });
}

const first = validateBackfillPlan(validPlan(), "normalize-example-records.json");
const replay = validateBackfillPlan(validPlan(), "normalize-example-records.json");
assert.equal(first.plan_sha256, replay.plan_sha256);
assert.equal(first.execution_mode, "explicit_only");
assert.equal(first.batch_size, 100);

expectFailure(validPlan({ execution_mode: "automatic" }), "backfill_execution_mode_invalid");
expectFailure(validPlan({ batch_size: 0 }), "backfill_batch_size_invalid");
expectFailure(validPlan({ batch_size: 1001 }), "backfill_batch_size_invalid");
expectFailure(validPlan({ max_batches_per_run: 101 }), "backfill_max_batches_invalid");
expectFailure(validPlan({ table: "example_records; DROP TABLE users" }), "backfill_table_invalid");
expectFailure(validPlan({ where_sql: "1 = 1; DELETE FROM users" }), "backfill_where_sql_contains_statement_boundary");
expectFailure(validPlan({ set_sql: "normalized_at = NULL -- bypass" }), "backfill_set_sql_contains_statement_boundary");
expectFailure(validPlan({ set_sql: "DROP TABLE users" }), "backfill_set_sql_contains_ddl");
expectFailure(validPlan({ set_sql: "CURRENT_TIMESTAMP" }), "backfill_set_sql_invalid");
expectFailure(validPlan({ rationale: "short" }), "backfill_rationale_invalid");

const changed = validateBackfillPlan(validPlan({ batch_size: 50 }), "normalize-example-records.json");
assert.notEqual(first.plan_sha256, changed.plan_sha256);

process.stdout.write("d1_backfill_runner_contract_valid\n");
