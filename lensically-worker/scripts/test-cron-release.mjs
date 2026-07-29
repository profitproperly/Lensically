import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  buildTriggerNeutralConfig,
  extractCronContract,
  parseJsonc,
  reconcileCronSchedules,
  schedulesEqual,
  writeTriggerNeutralConfig,
} from "./cron-release.mjs";

function expectFailure(callback, code) {
  assert.throws(callback, (error) => {
    assert.match(String(error?.message ?? error), new RegExp(`^${code}`));
    return true;
  });
}

const parsed = parseJsonc(`{
  // Worker identity
  "name": "lensically-worker",
  "main": "src/index.ts",
  "triggers": {
    "crons": ["0 * * * *", "* * * * *",],
  },
}`);
const contract = extractCronContract(parsed);
assert.deepEqual(contract.crons, ["* * * * *", "0 * * * *"]);
assert.equal(contract.workerName, "lensically-worker");

const neutral = buildTriggerNeutralConfig(parsed);
assert.equal(neutral.name, "lensically-worker");
assert.equal(neutral.main, "src/index.ts");
assert.equal("triggers" in neutral, false);
assert.equal("triggers" in parsed, true);

expectFailure(
  () => extractCronContract({ name: "lensically-worker", triggers: { crons: ["0 * * * *", "0 * * * *"] } }),
  "cron_schedule_duplicate",
);
expectFailure(
  () => extractCronContract({ name: "lensically-worker", triggers: {} }),
  "cron_schedule_list_missing",
);
assert.equal(schedulesEqual(["0 * * * *", "* * * * *"], ["* * * * *", "0 * * * *"]), true);
assert.equal(schedulesEqual(["0 * * * *"], ["* * * * *"]), false);

const directory = mkdtempSync(resolve(tmpdir(), "lensically-cron-release-"));
try {
  const input = resolve(directory, "wrangler.jsonc");
  const output = resolve(directory, "wrangler.release.generated.json");
  writeFileSync(input, `{
    "$schema": "node_modules/wrangler/config-schema.json",
    "name": "lensically-worker",
    "main": "src/index.ts",
    "assets": { "directory": "./public" },
    "triggers": { "crons": ["0 * * * *"] }
  }`);
  const receipt = writeTriggerNeutralConfig(input, output);
  assert.equal(receipt.triggerNeutral, true);
  const generated = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(generated.main, "src/index.ts");
  assert.equal(generated.assets.directory, "./public");
  assert.equal("triggers" in generated, false);
  expectFailure(
    () => writeTriggerNeutralConfig(input, resolve(directory, "nested", "release.json")),
    "cron_deploy_config_directory_mismatch",
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(payload);
    },
  };
}

const unchangedCalls = [];
const unchangedReceipt = await reconcileCronSchedules({
  contract,
  accountId: "account-id",
  token: "token",
  fetchImpl: async (url, options) => {
    unchangedCalls.push({ url, options });
    return response({ success: true, result: { schedules: contract.crons.map((cron) => ({ cron })) } });
  },
});
assert.equal(unchangedReceipt.action, "unchanged");
assert.equal(unchangedCalls.length, 1);
assert.equal(unchangedCalls[0].options.method, "GET");

const updateCalls = [];
const before = ["15 * * * *"];
const updateReceipt = await reconcileCronSchedules({
  contract,
  accountId: "account-id",
  token: "token",
  fetchImpl: async (url, options) => {
    updateCalls.push({ url, options });
    if (updateCalls.length === 1) {
      return response({ success: true, result: { schedules: before.map((cron) => ({ cron })) } });
    }
    if (updateCalls.length === 2) {
      assert.equal(options.method, "PUT");
      assert.deepEqual(JSON.parse(options.body), contract.crons.map((cron) => ({ cron })));
      return response({ success: true, result: { schedules: contract.crons.map((cron) => ({ cron })) } });
    }
    return response({ success: true, result: { schedules: contract.crons.map((cron) => ({ cron })) } });
  },
});
assert.equal(updateReceipt.action, "updated");
assert.equal(updateCalls.length, 3);

await assert.rejects(
  () => reconcileCronSchedules({
    contract,
    accountId: "account-id",
    token: "token",
    fetchImpl: async () => response({ success: false, errors: [{ code: 1000 }] }, 403),
  }),
  /cron_remote_request_failed/,
);

process.stdout.write("cron_release_contract_valid\n");
