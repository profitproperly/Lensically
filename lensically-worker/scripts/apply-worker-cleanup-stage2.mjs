import { readFile, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const indexPath = resolve(root, "src/index.ts");
let source = await readFile(indexPath, "utf8");
const changes = [];

function occurrences(text, needle) {
  return text.split(needle).length - 1;
}

function removeExact(needle, label) {
  const found = occurrences(source, needle);
  if (found !== 1) throw new Error(`${label}: expected one exact block, found ${found}`);
  source = source.replace(needle, "");
  changes.push(label);
}

function replaceRange(start, end, replacement, label) {
  const startCount = occurrences(source, start);
  const endCount = occurrences(source, end);
  if (startCount !== 1) throw new Error(`${label}: expected one start marker, found ${startCount}`);
  if (endCount !== 1) throw new Error(`${label}: expected one end marker, found ${endCount}`);
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (endIndex < 0 || endIndex <= startIndex) throw new Error(`${label}: invalid marker order`);
  source = `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`;
  changes.push(label);
}

removeExact(`import {
  LOCAL_EXECUTION_BOOTSTRAP_VERSION,
  LOCAL_EXECUTION_VERSION,
  LOCAL_VALIDATION_RECEIPT_VERSION,
  isExactSha,
  selectValidationPlane,
  validateLocalExecutionJob,
  validateLocalValidationReceipt,
  validateWorkerUpdatePlan,
  type LocalExecutionJob,
  type LocalExecutionJobType,
  type LocalExecutionNodeStatus,
  type LocalValidationReceipt,
} from "./localExecution";
`, "local execution import");

replaceRange(
  "type AgentAccountControl = ConfiguredThreadsAccountProfile & {",
  "type GptBrandKey =",
  "",
  "Agent control type",
);
replaceRange(
  "const VECTRIX_AGENT_SCHEDULE_SLOTS = Array.from(",
  "const MANIFEST_SOURCE_MIN_VERIFIED_LIKES =",
  "",
  "Agent schedule constants",
);
replaceRange(
  "const VECTRIX_AGENT_CONTENT_BRIEF = [",
  "type ExternalPatternRow =",
  "",
  "Agent content configuration",
);
replaceRange(
  "type AutomationDailyRunLockRow = {",
  "type ThreadsPostsCacheStateRow =",
  "",
  "legacy automation lock type",
);
import { readFile, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const indexPath = resolve(root, "src/index.ts");
let source = await readFile(indexPath, "utf8");
const changes = [];

function occurrences(text, needle) {
  return text.split(needle).length - 1;
}

function removeExact(needle, label) {
  const found = occurrences(source, needle);
  if (found !== 1) throw new Error(`${label}: expected one exact block, found ${found}`);
  source = source.replace(needle, "");
  changes.push(label);
}

function replaceRange(start, end, replacement, label) {
  const startCount = occurrences(source, start);
  const endCount = occurrences(source, end);
  if (startCount !== 1) throw new Error(`${label}: expected one start marker, found ${startCount}`);
  if (endCount !== 1) throw new Error(`${label}: expected one end marker, found ${endCount}`);
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (endIndex < 0 || endIndex <= startIndex) throw new Error(`${label}: invalid marker order`);
  source = `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`;
  changes.push(label);
}

removeExact(`import {
  LOCAL_EXECUTION_BOOTSTRAP_VERSION,
  LOCAL_EXECUTION_VERSION,
  LOCAL_VALIDATION_RECEIPT_VERSION,
  isExactSha,
  selectValidationPlane,
  validateLocalExecutionJob,
  validateLocalValidationReceipt,
  validateWorkerUpdatePlan,
  type LocalExecutionJob,
  type LocalExecutionJobType,
  type LocalExecutionNodeStatus,
  type LocalValidationReceipt,
} from "./localExecution";
`, "local execution import");

replaceRange(
  "type AgentAccountControl = ConfiguredThreadsAccountProfile & {",
  "type GptBrandKey =",
  "",
  "Agent control type",
);
replaceRange(
  "const VECTRIX_AGENT_SCHEDULE_SLOTS = Array.from(",
  "const MANIFEST_SOURCE_MIN_VERIFIED_LIKES =",
  "",
  "Agent schedule constants",
);
replaceRange(
  "const VECTRIX_AGENT_CONTENT_BRIEF = [",
  "type ExternalPatternRow =",
  "",
  "Agent content configuration",
);
replaceRange(
  "type AutomationDailyRunLockRow = {",
  "type ThreadsPostsCacheStateRow =",
  "",
  "legacy automation lock type",
);
import { readFile, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const indexPath = resolve(root, "src/index.ts");
let source = await readFile(indexPath, "utf8");
const changes = [];

function occurrences(text, needle) {
  return text.split(needle).length - 1;
}

function removeExact(needle, label) {
  const found = occurrences(source, needle);
  if (found !== 1) throw new Error(`${label}: expected one exact block, found ${found}`);
  source = source.replace(needle, "");
  changes.push(label);
}

function replaceRange(start, end, replacement, label) {
  const startCount = occurrences(source, start);
  const endCount = occurrences(source, end);
  if (startCount !== 1) throw new Error(`${label}: expected one start marker, found ${startCount}`);
  if (endCount !== 1) throw new Error(`${label}: expected one end marker, found ${endCount}`);
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (endIndex < 0 || endIndex <= startIndex) throw new Error(`${label}: invalid marker order`);
  source = `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`;
  changes.push(label);
}

removeExact(`import {
  LOCAL_EXECUTION_BOOTSTRAP_VERSION,
  LOCAL_EXECUTION_VERSION,
  LOCAL_VALIDATION_RECEIPT_VERSION,
  isExactSha,
  selectValidationPlane,
  validateLocalExecutionJob,
  validateLocalValidationReceipt,
  validateWorkerUpdatePlan,
  type LocalExecutionJob,
  type LocalExecutionJobType,
  type LocalExecutionNodeStatus,
  type LocalValidationReceipt,
} from "./localExecution";
`, "local execution import");

replaceRange(
  "type AgentAccountControl = ConfiguredThreadsAccountProfile & {",
  "type GptBrandKey =",
  "",
  "Agent control type",
);
replaceRange(
  "const VECTRIX_AGENT_SCHEDULE_SLOTS = Array.from(",
  "const MANIFEST_SOURCE_MIN_VERIFIED_LIKES =",
  "",
  "Agent schedule constants",
);
replaceRange(
  "const VECTRIX_AGENT_CONTENT_BRIEF = [",
  "type ExternalPatternRow =",
  "",
  "Agent content configuration",
);
replaceRange(
  "type AutomationDailyRunLockRow = {",
  "type ThreadsPostsCacheStateRow =",
  "",
  "legacy automation lock type",
);
import { readFile, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const indexPath = resolve(root, "src/index.ts");
let source = await readFile(indexPath, "utf8");
const changes = [];

function occurrences(text, needle) {
  return text.split(needle).length - 1;
}

function removeExact(needle, label) {
  const found = occurrences(source, needle);
  if (found !== 1) throw new Error(`${label}: expected one exact block, found ${found}`);
  source = source.replace(needle, "");
  changes.push(label);
}

function replaceRange(start, end, replacement, label) {
  const startCount = occurrences(source, start);
  const endCount = occurrences(source, end);
  if (startCount !== 1) throw new Error(`${label}: expected one start marker, found ${startCount}`);
  if (endCount !== 1) throw new Error(`${label}: expected one end marker, found ${endCount}`);
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (endIndex < 0 || endIndex <= startIndex) throw new Error(`${label}: invalid marker order`);
  source = `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`;
  changes.push(label);
}

removeExact(`import {
  LOCAL_EXECUTION_BOOTSTRAP_VERSION,
  LOCAL_EXECUTION_VERSION,
  LOCAL_VALIDATION_RECEIPT_VERSION,
  isExactSha,
  selectValidationPlane,
  validateLocalExecutionJob,
  validateLocalValidationReceipt,
  validateWorkerUpdatePlan,
  type LocalExecutionJob,
  type LocalExecutionJobType,
  type LocalExecutionNodeStatus,
  type LocalValidationReceipt,
} from "./localExecution";
`, "local execution import");

replaceRange(
  "type AgentAccountControl = ConfiguredThreadsAccountProfile & {",
  "type GptBrandKey =",
  "",
  "Agent control type",
);
replaceRange(
  "const VECTRIX_AGENT_SCHEDULE_SLOTS = Array.from(",
  "const MANIFEST_SOURCE_MIN_VERIFIED_LIKES =",
  "",
  "Agent schedule constants",
);
replaceRange(
  "const VECTRIX_AGENT_CONTENT_BRIEF = [",
  "type ExternalPatternRow =",
  "",
  "Agent content configuration",
);
replaceRange(
  "type AutomationDailyRunLockRow = {",
  "type ThreadsPostsCacheStateRow =",
  "",
  "legacy automation lock type",
);

replaceRange(
  "async function ensureAgentAccountControlsTable(env: Env): Promise<void> {",
  "async function bootstrapConfiguredThreadsAccounts(env: Env): Promise<void> {",
  "",
  "Agent account-control implementation",
);
replaceRange(
  "async function buildOperatorRejectionContextLegacyUnused(env: Env, brand: GptResolvedBrand): Promise<Record<string, unknown>> {",
  "async function insertOperatorInventory(",
  "",
  "legacy owner-rejection learning implementation",
);
replaceRange(
  "async function ensureLocalExecutionTables(env: Env): Promise<void> {",
  "async function handleOperatorMcpEngineeringTool(",
  "",
  "local execution implementation",
);
replaceRange(
  "async function ensureAutomationDailyRunLocksTable(env: Env): Promise<void> {",
  "async function upsertThreadsPostsArchive(",
  "",
  "legacy automation daily-run implementation",
);
replaceRange(
  "function buildGptOpenApiSchema(workerOrigin: string): Record<string, unknown> {",
  "async function resolvePatternAccountId(",
  "",
  "retired GPT OpenAPI schema",
);
replaceRange(
  "    if (normalizedPath === \"/api/gpt/openapi.json\" && request.method === \"GET\") {",
  "    if (\n      normalizedPath === \"/.well-known/oauth-authorization-server\"",
  "",
  "retired GPT OpenAPI route",
);

replaceRange(
  "            if (normalizedPath.startsWith(\"/api/gpt/\")) {",
  "        if (normalizedPath.startsWith(\"/api/gpt-memory/\")) {",
  `    if (normalizedPath.startsWith("/api/gpt/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "legacy_gpt_api_retired",
        replacement: "Lensically Operator Mode direct typed tools",
        human_free_autonomy: HUMAN_FREE_AUTONOMY_CONTRACT,
      }), {
        status: 410,
        headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
      });
    }

`,
  "retired GPT HTTP implementation",
);
replaceRange(
  "        if (normalizedPath.startsWith(\"/api/gpt-memory/\")) {",
  "    if (normalizedPath === \"/api/patterns/import\" && request.method === \"POST\") {",
  `    if (normalizedPath.startsWith("/api/gpt-memory/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "gpt_memory_retired",
        human_free_autonomy: HUMAN_FREE_AUTONOMY_CONTRACT,
      }), {
        status: 410,
        headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
      });
    }

`,
  "retired GPT Memory HTTP implementation",
);
replaceRange(
  "        if (url.pathname.startsWith(\"/api/agent/\")) {",
  "    if (url.pathname === \"/api/threads/posts\" && request.method === \"GET\") {",
  `    if (url.pathname.startsWith("/api/agent/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "legacy_agent_mode_retired",
        local_execution_active: false,
      }), {
        status: 410,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...requestCorsHeaders },
      });
    }

`,
  "retired Agent HTTP implementation",
);
replaceRange(
  "        if (url.pathname.startsWith(\"/api/automation/\") || url.pathname.startsWith(\"/internal/automation/\")) {",
  "    if (url.pathname === \"/internal/refresh-tokens\" && request.method === \"POST\") {",
  `    if (url.pathname.startsWith("/api/automation/") || url.pathname.startsWith("/internal/automation/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "legacy_automation_api_retired",
        replacement: "autonomous cycle MCP tools",
      }), {
        status: 410,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

`,
  "retired automation HTTP implementation",
);

replaceRange(
  "async function ensureAgentAccountControlsTable(env: Env): Promise<void> {",
  "async function bootstrapConfiguredThreadsAccounts(env: Env): Promise<void> {",
  "",
  "Agent account-control implementation",
);
replaceRange(
  "async function buildOperatorRejectionContextLegacyUnused(env: Env, brand: GptResolvedBrand): Promise<Record<string, unknown>> {",
  "async function insertOperatorInventory(",
  "",
  "legacy owner-rejection learning implementation",
);
replaceRange(
  "async function ensureLocalExecutionTables(env: Env): Promise<void> {",
  "async function handleOperatorMcpEngineeringTool(",
  "",
  "local execution implementation",
);
replaceRange(
  "async function ensureAutomationDailyRunLocksTable(env: Env): Promise<void> {",
  "async function upsertThreadsPostsArchive(",
  "",
  "legacy automation daily-run implementation",
);
replaceRange(
  "function buildGptOpenApiSchema(workerOrigin: string): Record<string, unknown> {",
  "async function resolvePatternAccountId(",
  "",
  "retired GPT OpenAPI schema",
);
replaceRange(
  "    if (normalizedPath === \"/api/gpt/openapi.json\" && request.method === \"GET\") {",
  "    if (\n      normalizedPath === \"/.well-known/oauth-authorization-server\"",
  "",
  "retired GPT OpenAPI route",
);

replaceRange(
  "            if (normalizedPath.startsWith(\"/api/gpt/\")) {",
  "        if (normalizedPath.startsWith(\"/api/gpt-memory/\")) {",
  `    if (normalizedPath.startsWith("/api/gpt/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "legacy_gpt_api_retired",
        replacement: "Lensically Operator Mode direct typed tools",
        human_free_autonomy: HUMAN_FREE_AUTONOMY_CONTRACT,
      }), {
        status: 410,
        headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
      });
    }

`,
  "retired GPT HTTP implementation",
);
replaceRange(
  "        if (normalizedPath.startsWith(\"/api/gpt-memory/\")) {",
  "    if (normalizedPath === \"/api/patterns/import\" && request.method === \"POST\") {",
  `    if (normalizedPath.startsWith("/api/gpt-memory/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "gpt_memory_retired",
        human_free_autonomy: HUMAN_FREE_AUTONOMY_CONTRACT,
      }), {
        status: 410,
        headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
      });
    }

`,
  "retired GPT Memory HTTP implementation",
);
replaceRange(
  "        if (url.pathname.startsWith(\"/api/agent/\")) {",
  "    if (url.pathname === \"/api/threads/posts\" && request.method === \"GET\") {",
  `    if (url.pathname.startsWith("/api/agent/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "legacy_agent_mode_retired",
        local_execution_active: false,
      }), {
        status: 410,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...requestCorsHeaders },
      });
    }

`,
  "retired Agent HTTP implementation",
);
replaceRange(
  "        if (url.pathname.startsWith(\"/api/automation/\") || url.pathname.startsWith(\"/internal/automation/\")) {",
  "    if (url.pathname === \"/internal/refresh-tokens\" && request.method === \"POST\") {",
  `    if (url.pathname.startsWith("/api/automation/") || url.pathname.startsWith("/internal/automation/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "legacy_automation_api_retired",
        replacement: "autonomous cycle MCP tools",
      }), {
        status: 410,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

`,
  "retired automation HTTP implementation",
);

replaceRange(
  "async function ensureAgentAccountControlsTable(env: Env): Promise<void> {",
  "async function bootstrapConfiguredThreadsAccounts(env: Env): Promise<void> {",
  "",
  "Agent account-control implementation",
);
replaceRange(
  "async function buildOperatorRejectionContextLegacyUnused(env: Env, brand: GptResolvedBrand): Promise<Record<string, unknown>> {",
  "async function insertOperatorInventory(",
  "",
  "legacy owner-rejection learning implementation",
);
replaceRange(
  "async function ensureLocalExecutionTables(env: Env): Promise<void> {",
  "async function handleOperatorMcpEngineeringTool(",
  "",
  "local execution implementation",
);
replaceRange(
  "async function ensureAutomationDailyRunLocksTable(env: Env): Promise<void> {",
  "async function upsertThreadsPostsArchive(",
  "",
  "legacy automation daily-run implementation",
);
replaceRange(
  "function buildGptOpenApiSchema(workerOrigin: string): Record<string, unknown> {",
  "async function resolvePatternAccountId(",
  "",
  "retired GPT OpenAPI schema",
);
replaceRange(
  "    if (normalizedPath === \"/api/gpt/openapi.json\" && request.method === \"GET\") {",
  "    if (\n      normalizedPath === \"/.well-known/oauth-authorization-server\"",
  "",
  "retired GPT OpenAPI route",
);

replaceRange(
  "            if (normalizedPath.startsWith(\"/api/gpt/\")) {",
  "        if (normalizedPath.startsWith(\"/api/gpt-memory/\")) {",
  `    if (normalizedPath.startsWith("/api/gpt/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "legacy_gpt_api_retired",
        replacement: "Lensically Operator Mode direct typed tools",
        human_free_autonomy: HUMAN_FREE_AUTONOMY_CONTRACT,
      }), {
        status: 410,
        headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
      });
    }

`,
  "retired GPT HTTP implementation",
);
replaceRange(
  "        if (normalizedPath.startsWith(\"/api/gpt-memory/\")) {",
  "    if (normalizedPath === \"/api/patterns/import\" && request.method === \"POST\") {",
  `    if (normalizedPath.startsWith("/api/gpt-memory/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "gpt_memory_retired",
        human_free_autonomy: HUMAN_FREE_AUTONOMY_CONTRACT,
      }), {
        status: 410,
        headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
      });
    }

`,
  "retired GPT Memory HTTP implementation",
);
replaceRange(
  "        if (url.pathname.startsWith(\"/api/agent/\")) {",
  "    if (url.pathname === \"/api/threads/posts\" && request.method === \"GET\") {",
  `    if (url.pathname.startsWith("/api/agent/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "legacy_agent_mode_retired",
        local_execution_active: false,
      }), {
        status: 410,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...requestCorsHeaders },
      });
    }

`,
  "retired Agent HTTP implementation",
);
replaceRange(
  "        if (url.pathname.startsWith(\"/api/automation/\") || url.pathname.startsWith(\"/internal/automation/\")) {",
  "    if (url.pathname === \"/internal/refresh-tokens\" && request.method === \"POST\") {",
  `    if (url.pathname.startsWith("/api/automation/") || url.pathname.startsWith("/internal/automation/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "legacy_automation_api_retired",
        replacement: "autonomous cycle MCP tools",
      }), {
        status: 410,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

`,
  "retired automation HTTP implementation",
);

replaceRange(
  "async function ensureAgentAccountControlsTable(env: Env): Promise<void> {",
  "async function bootstrapConfiguredThreadsAccounts(env: Env): Promise<void> {",
  "",
  "Agent account-control implementation",
);
replaceRange(
  "async function buildOperatorRejectionContextLegacyUnused(env: Env, brand: GptResolvedBrand): Promise<Record<string, unknown>> {",
  "async function insertOperatorInventory(",
  "",
  "legacy owner-rejection learning implementation",
);
replaceRange(
  "async function ensureLocalExecutionTables(env: Env): Promise<void> {",
  "async function handleOperatorMcpEngineeringTool(",
  "",
  "local execution implementation",
);
replaceRange(
  "async function ensureAutomationDailyRunLocksTable(env: Env): Promise<void> {",
  "async function upsertThreadsPostsArchive(",
  "",
  "legacy automation daily-run implementation",
);
replaceRange(
  "function buildGptOpenApiSchema(workerOrigin: string): Record<string, unknown> {",
  "async function resolvePatternAccountId(",
  "",
  "retired GPT OpenAPI schema",
);
replaceRange(
  "    if (normalizedPath === \"/api/gpt/openapi.json\" && request.method === \"GET\") {",
  "    if (\n      normalizedPath === \"/.well-known/oauth-authorization-server\"",
  "",
  "retired GPT OpenAPI route",
);

replaceRange(
  "            if (normalizedPath.startsWith(\"/api/gpt/\")) {",
  "        if (normalizedPath.startsWith(\"/api/gpt-memory/\")) {",
  `    if (normalizedPath.startsWith("/api/gpt/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "legacy_gpt_api_retired",
        replacement: "Lensically Operator Mode direct typed tools",
        human_free_autonomy: HUMAN_FREE_AUTONOMY_CONTRACT,
      }), {
        status: 410,
        headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
      });
    }

`,
  "retired GPT HTTP implementation",
);
replaceRange(
  "        if (normalizedPath.startsWith(\"/api/gpt-memory/\")) {",
  "    if (normalizedPath === \"/api/patterns/import\" && request.method === \"POST\") {",
  `    if (normalizedPath.startsWith("/api/gpt-memory/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "gpt_memory_retired",
        human_free_autonomy: HUMAN_FREE_AUTONOMY_CONTRACT,
      }), {
        status: 410,
        headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
      });
    }

`,
  "retired GPT Memory HTTP implementation",
);
replaceRange(
  "        if (url.pathname.startsWith(\"/api/agent/\")) {",
  "    if (url.pathname === \"/api/threads/posts\" && request.method === \"GET\") {",
  `    if (url.pathname.startsWith("/api/agent/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "legacy_agent_mode_retired",
        local_execution_active: false,
      }), {
        status: 410,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...requestCorsHeaders },
      });
    }

`,
  "retired Agent HTTP implementation",
);
replaceRange(
  "        if (url.pathname.startsWith(\"/api/automation/\") || url.pathname.startsWith(\"/internal/automation/\")) {",
  "    if (url.pathname === \"/internal/refresh-tokens\" && request.method === \"POST\") {",
  `    if (url.pathname.startsWith("/api/automation/") || url.pathname.startsWith("/internal/automation/")) {
      return new Response(JSON.stringify({
        success: false,
        error: "legacy_automation_api_retired",
        replacement: "autonomous cycle MCP tools",
      }), {
        status: 410,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

`,
  "retired automation HTTP implementation",
);

for (const staleName of ["getLocalExecutionStatus", "getValidationPlaneStatus"]) {
  source = source.replaceAll(`, "${staleName}"`, "");
  source = source.replaceAll(`"${staleName}", `, "");
  source = source.replaceAll(`        "${staleName}",\n`, "");
}

const forbiddenAfterCleanup = [
  "async function ensureAgentAccountControlsTable",
  "async function ensureLocalExecutionTables",
  "async function ensureAutomationDailyRunLocksTable",
  "buildOperatorRejectionContextLegacyUnused",
  "function buildGptOpenApiSchema",
  "normalizedPath === \"/api/gpt/operator-playbook\"",
  "normalizedPath === \"/api/gpt-memory/dashboard\"",
  "url.pathname === \"/api/agent/accounts\"",
  "url.pathname === \"/api/automation/claim-daily-run\"",
];
for (const forbidden of forbiddenAfterCleanup) {
  if (source.includes(forbidden)) throw new Error(`cleanup incomplete: ${forbidden}`);
}

await writeFile(indexPath, source);
try {
  await unlink(resolve(root, "src/localExecution.ts"));
  changes.push("localExecution.ts");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

process.stdout.write(`${JSON.stringify({ ok: true, changes, index_bytes: Buffer.byteLength(source) }, null, 2)}\n`);

for (const staleName of ["getLocalExecutionStatus", "getValidationPlaneStatus"]) {
  source = source.replaceAll(`, "${staleName}"`, "");
  source = source.replaceAll(`"${staleName}", `, "");
  source = source.replaceAll(`        "${staleName}",\n`, "");
}

const forbiddenAfterCleanup = [
  "async function ensureAgentAccountControlsTable",
  "async function ensureLocalExecutionTables",
  "async function ensureAutomationDailyRunLocksTable",
  "buildOperatorRejectionContextLegacyUnused",
  "function buildGptOpenApiSchema",
  "normalizedPath === \"/api/gpt/operator-playbook\"",
  "normalizedPath === \"/api/gpt-memory/dashboard\"",
  "url.pathname === \"/api/agent/accounts\"",
  "url.pathname === \"/api/automation/claim-daily-run\"",
];
for (const forbidden of forbiddenAfterCleanup) {
  if (source.includes(forbidden)) throw new Error(`cleanup incomplete: ${forbidden}`);
}

await writeFile(indexPath, source);
try {
  await unlink(resolve(root, "src/localExecution.ts"));
  changes.push("localExecution.ts");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

process.stdout.write(`${JSON.stringify({ ok: true, changes, index_bytes: Buffer.byteLength(source) }, null, 2)}\n`);
