import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

assert.ok(source.includes('enum: ["typecheck", "operator-tests", "gpt-memory-tests"]'));
assert.ok(!source.includes('enum: ["typecheck", "operator-tests", "gpt-memory-tests", "worker-deploy"]'));
assert.ok(source.includes('if (!["typecheck", "operator-tests", "gpt-memory-tests"].includes(publicTask))'));
assert.ok(source.includes('const clientSafeRelease = publicTask === "typecheck" && rawRequestedRef === "release";'));
assert.ok(source.includes('const workflowTask = clientSafeRelease ? "worker-deploy" : publicTask;'));

assert.match(source, /const exactRequestedRef = \/\^\[a-f0-9\]\{40\}\$\/i\.test\(requestedRef\);/);
assert.match(source, /if \(workflowTask === "worker-deploy" \|\| exactRequestedRef\)/);
assert.match(source, /if \(exactRequestedRef && requestedRef !== verifiedHeadSha\)/);
assert.match(source, /dispatchRef = config\.branch;/);
assert.match(source, /const exactValidation = workflowTask !== "worker-deploy" && exactRequestedRef;/);
assert.match(source, /release_sha: verifiedHeadSha/);
assert.match(source, /exact_sha_not_current_branch_head/);

console.log(JSON.stringify({ ok: true, contract: "recovery-exact-sha-workflow-dispatch-v1" }));
