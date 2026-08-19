import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../config/white-label-parity.config.json", import.meta.url), "utf8"));
const script = readFileSync(new URL("./white-label-parity.mjs", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/lensically-white-label-parity.yml", import.meta.url), "utf8");

assert.equal(config.version, "white-label-parity-v1");
assert.equal(config.target_repository, "profitproperly/Lensically-Operator-Threads");
assert.equal(config.state_path, ".lensically-parity/state.json");
assert.ok(config.sync_allow.length > 0, "sync allowlist must not be empty");
assert.ok(config.exclude.includes("ENGINEERING_CONTINUATION.md"), "ECL must never be copied into product");
assert.ok(config.forbidden_content_patterns.includes("manifest_mental"), "seller account key must be forbidden");
assert.ok(script.includes("contentIsProductSafe"), "script must enforce forbidden content");
assert.ok(script.includes('useWindowsNpm ? "cmd.exe"'), "script must run npm on Windows through cmd resolution");
assert.ok(script.includes("validateTarget(targetRoot, config.validation_commands)"), "script must validate before state advancement");
assert.ok(script.includes("configureAutomationAuthor(targetRoot)"), "script must set a local automation author before committing");
assert.ok(script.includes("writeReportAndState(targetRoot, config, report, newState)"), "script must write state only after validation");
assert.ok(script.includes("pending_count: pending.length"), "state must preserve pending count instead of hiding it");
assert.ok(workflow.includes("schedule:"), "workflow must run autonomously on a schedule");
assert.ok(workflow.includes("WHITE_LABEL_PARITY_TOKEN"), "workflow must use an explicit cross-repo write token");

console.log("white_label_parity_contract_ok");
