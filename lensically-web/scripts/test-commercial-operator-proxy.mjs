import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
assert.match(config, /source:\s*["']\/operator["']/);
assert.match(config, /destination:\s*["']https:\/\/lensically-operator\.pages\.dev\/operator\/["']/);
assert.match(config, /source:\s*["']\/operator\/:path\*["']/);
assert.match(config, /destination:\s*["']https:\/\/lensically-operator\.pages\.dev\/operator\/:path\*["']/);
console.log("commercial_operator_proxy_tests_passed");
