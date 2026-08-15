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
];

for (const [label, fragment] of required) {
  if (!source.includes(fragment)) {
    throw new Error(`recovery_github_retry_contract_missing:${label}`);
  }
}

if (!source.includes('const method = String(init.method || "GET").toUpperCase();')) {
  throw new Error("recovery_github_retry_method_guard_missing");
}

if (source.includes("for (const byte of bytes) binary += String.fromCharCode(byte);")) {
  throw new Error("recovery_large_file_base64_per_byte_loop_forbidden");
}

console.log("Recovery GitHub retry contract verified.");
