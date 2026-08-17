import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "../src/index.ts"), "utf8");

const required = [
  ['read-only retry classification', 'const retryableRead = ["GET", "HEAD"].includes(method);'],
  ['transient GitHub statuses', 'const transientStatuses = new Set([502, 503, 504]);'],
  ['bounded four-attempt read budget', 'const maxAttempts = retryableRead ? 4 : 1;'],
  ['bounded exponential backoff', '75 * (2 ** (attempt - 1))'],
  ['stop after successful or final attempt', '!transientStatuses.has(response.status) || attempt === maxAttempts'],
  ['bounded base64 encoding chunk size', 'const chunkSize = 0x8000;'],
    ['chunked base64 byte conversion', 'String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)))'],
    ['failed workflow log text reader', 'async function githubText(env: Env, path: string)'],
  ['failed workflow log API media type', 'accept: "application/vnd.github+json"'],
  ['failed workflow log endpoint', '/actions/jobs/${jobId}/logs'],
  ['bounded failed workflow log tail', 'failed_log_tail: failedLogText ? failedLogText.slice(-12000) : null'],
  ['client-safe recovery release contract', 'const clientSafeRelease = publicTask === "typecheck" && rawRequestedRef === "release";'],
  ['direct semantic worker deploy not public', 'if (!["typecheck", "operator-tests", "gpt-memory-tests"].includes(publicTask)) return { ok: false, error: "invalid_workflow_task" };'],
  ['Recovery smoke reads Step-3 execution descriptor', 'const executionDescriptor = liveStateContent?.execution_descriptor'],
  ['Recovery smoke forwards Step-4 execution descriptor', 'execution_descriptor: executionDescriptor'],
];

for (const [label, fragment] of required) {
  if (!source.includes(fragment)) {
    console.error(`::error title=Recovery retry contract missing::${label}`);
    throw new Error(`recovery_github_retry_contract_missing:${label}`);
  }
}

if (!source.includes('const method = String(init.method || "GET").toUpperCase();')) {
  console.error("::error title=Recovery retry contract missing::method guard");
  throw new Error("recovery_github_retry_method_guard_missing");
}

const textToBase64Match = source.match(/function textToBase64\(value: string\): string \{[\s\S]*?\n\}\n\nasync function repoFile/);
if (!textToBase64Match) {
  console.error("::error title=Recovery retry contract missing::textToBase64 function boundary");
  throw new Error("recovery_large_file_base64_function_missing");
}
if (textToBase64Match[0].includes("for (const byte of bytes)")) {
  console.error("::error title=Recovery retry contract regression::per-byte loop present in textToBase64");
  throw new Error("recovery_large_file_base64_per_byte_loop_forbidden");
}

console.log("Recovery GitHub retry contract verified.");
