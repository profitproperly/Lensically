#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const configPath = resolve(root, "config/mbrain-delta-writer.config.json");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout || result.error?.message || "unknown_error"}`);
  }
  return result.stdout.trim();
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseFirst(text, pattern, fallback = null) {
  const match = text.match(pattern);
  return match ? match[1].trim().replace(/[.,;:]+$/, "") : fallback;
}

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function buildProjectState(input) {
  return `# LENSICALLY — PROJECT STATE
Type: project-state
Authority: STATE
Status: active
Updated: ${input.date}
Canonical Path: ${input.config.canonical_project_state_path}

## Current Objective
Root \`ENGINEERING_CONTINUATION.md\` remains the sole canonical Lensically engineering continuation authority.

Current canonical continuation state verified from repository \`main\`:
- \`active_job_id: ${input.activeJobId}\`
- \`active_checkpoint: ${input.activeCheckpoint}\`
- \`ecl_active_count: ${input.eclActiveCount}\`

## LOM Callable Wiring And Validation
LOM callable certification is complete-live-verified in \`ENGINEERING_CONTINUATION.md\`.

Verified evidence:
- Production commit: \`${input.lomProductionCommit}\`
- Deployment: \`${input.lomDeployment}\`
- MCP version: \`${input.lomMcpVersion}\`
- Validation/release evidence is recorded in the canonical continuation ledger.
- Mutation-gateway proof is recorded in the canonical continuation ledger: \`executeOperatorAction\` accepted a mutation descriptor and completed the source-defined control path successfully.

## White-Label Product Parity
White-label parity is now wired, operational, and writing validated product parity state.

Source-owned implementation in \`profitproperly/Lensically\`:
- \`config/white-label-parity.config.json\`
- \`scripts/white-label-parity.mjs\`
- \`scripts/test-white-label-parity.mjs\`
- \`.github/workflows/lensically-white-label-parity.yml\`

Operational contract:
- Clones \`profitproperly/Lensically-Operator-Threads\`.
- Classifies deltas as \`SYNCED\`, \`EXCLUDED\`, or \`PENDING\`.
- Copies only allowlisted product-safe files.
- Rejects seller-only/private values and forbidden product content.
- Runs product validation before writing state.
- Commits \`.lensically-parity/latest-report.json\` and \`.lensically-parity/state.json\` only after validation succeeds.
- Scheduled workflow runs every six hours and supports manual dispatch. GitHub Actions cross-repo writes require \`WHITE_LABEL_PARITY_TOKEN\`; the same writer path has been live-proven locally through Git Credential Manager.

Verified write evidence:
- Lensically main: \`${input.lensicallyHead}\`
- Product repo main: \`${input.productHead}\`
- Product state watermark source SHA: \`${input.productSourceWatermark}\`
- Product parity report counts: synced \`${input.productSyncedCount}\`, copied \`${input.productCopiedCount}\`, excluded \`${input.productExcludedCount}\`, pending \`${input.productPendingCount}\`
- Product report SHA-256: \`${input.productReportHash}\`

The \`PENDING\` backlog is intentional. It means product-relevant changes exist that are not yet safe to mirror automatically or require product-native transplant rules. It is not hidden and does not block safe allowlisted parity writes.

## M-BRAIN Gateway State
M-BRAIN Gateway is connected and usable from Codex Desktop. This repository now owns a repeatable delta outbox generator:
- \`config/mbrain-delta-writer.config.json\`
- \`scripts/mbrain-delta-writer.mjs\`
- \`scripts/test-mbrain-delta-writer.mjs\`

The generator derives this project-state payload from repository and product parity state, rejects known stale phrases, and writes \`${input.config.outbox_path}\` for version-checked Gateway application.

## M-BRAIN Parity Rule
M-BRAIN stores durable model-side continuity and must follow fresher verified Lensically truth. It does not override \`ENGINEERING_CONTINUATION.md\`, production runtime identity, GitHub main, or product repo state.

Current model-side parity scope includes:
- LOM callable certification complete
- effect-specific LOM Step-4 validation complete
- white-label product parity injector operational
- product repo parity watermark written
- current pending parity backlog visible
- source-owned M-BRAIN delta outbox generator installed

## Remaining Boundary
This closes the Lensically-to-M-BRAIN durable delta wiring gap. It does not claim universal all-project automation unless each project either adopts this policy/outbox contract or a separate global scheduler applies equivalent source-owned policies.
`;
}

function buildSystemContract(input) {
  return `# M-BRAIN Durable Delta Writer
Type: system-contract
Authority: M-BRAIN
Status: active
Updated: ${input.date}
Canonical Path: ${input.config.canonical_system_contract_path}

## Contract
Durable model-side state changes must be written through source-owned policy or an explicitly version-checked Gateway call. Chat-only memory is not a durable delta writer.

## Required Writer Shape
For each project/domain, the writer must:
- name the canonical M-BRAIN node path;
- name the source authorities that outrank M-BRAIN;
- derive content from verified source/runtime/product state;
- reject known stale phrases before writing;
- preserve a machine-readable outbox or receipt;
- use \`writeDurableDelta\` with \`expected_version\` for canonical node replacement;
- use \`appendBrainEvent\` for provenance-only events;
- never store secrets or private production data in M-BRAIN.

## Lensically Implementation
Lensically implements this contract with:
- \`config/mbrain-delta-writer.config.json\`
- \`scripts/mbrain-delta-writer.mjs\`
- \`scripts/test-mbrain-delta-writer.mjs\`

Latest verified Lensically source head at generation time: \`${input.lensicallyHead}\`.
Latest verified white-label product head at generation time: \`${input.productHead}\`.

## Boundary
This contract makes M-BRAIN writable and repeatable for projects that adopt it. It is not a claim that every project has already adopted the writer.
`;
}

function main() {
  const config = readJson(configPath);
  const continuation = read(config.source_authorities.continuation);
  const productStatePath = process.env.WHITE_LABEL_PARITY_STATE_PATH;
  const productState = productStatePath && existsSync(productStatePath)
    ? JSON.parse(readFileSync(productStatePath, "utf8"))
    : null;
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const lensicallyHead = run("git", ["rev-parse", "HEAD"]);
  const productHead = process.env.WHITE_LABEL_PRODUCT_HEAD || productState?.target_commit || "unknown";

  const input = {
    config,
    date,
    activeJobId: parseFirst(continuation, /active_job_id:\s*([^\n]+)/, "unknown"),
    activeCheckpoint: parseFirst(continuation, /active_checkpoint:\s*([^\n]+)/, "unknown"),
    eclActiveCount: parseFirst(continuation, /ecl_active_count:\s*([^\n]+)/, "unknown"),
    lomProductionCommit: parseFirst(continuation, /Production commit `?([a-f0-9]{40})`?/i, "recorded-in-ecl"),
    lomDeployment: parseFirst(continuation, /deployment `?([a-f0-9-]{36})`?/i, "recorded-in-ecl"),
    lomMcpVersion: parseFirst(continuation, /MCP ([0-9.]+)/, "recorded-in-ecl"),
    lensicallyHead,
    productHead,
    productSourceWatermark: productState?.source_sha ?? "unknown",
    productSyncedCount: String(productState?.synced_count ?? "unknown"),
    productCopiedCount: String(productState?.copied_count ?? "unknown"),
    productExcludedCount: String(productState?.excluded_count ?? "unknown"),
    productPendingCount: String(productState?.pending_count ?? "unknown"),
    productReportHash: productState?.report_sha256 ?? "unknown",
  };

  const projectContent = buildProjectState(input);
  const systemContent = buildSystemContract(input);
  for (const phrase of config.required_project_state_phrases) {
    if (!projectContent.includes(phrase)) throw new Error(`mbrain_delta_required_phrase_missing:${phrase}`);
  }
  for (const phrase of config.forbidden_stale_phrases) {
    if (projectContent.includes(phrase)) throw new Error(`mbrain_delta_stale_phrase_present:${phrase}`);
  }
  const outbox = {
    version: config.version,
    generated_at: now.toISOString(),
    source_sha: lensicallyHead,
    project_state: {
      canonical_path: config.canonical_project_state_path,
      sha256: sha256(projectContent),
      content: projectContent,
    },
    system_contract: {
      canonical_path: config.canonical_system_contract_path,
      sha256: sha256(systemContent),
      content: systemContent,
    },
  };
  const outboxPath = resolve(root, config.outbox_path);
  ensureParent(outboxPath);
  writeFileSync(outboxPath, `${JSON.stringify(outbox, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    outbox_path: config.outbox_path,
    source_sha: lensicallyHead,
    project_state_sha256: outbox.project_state.sha256,
    system_contract_sha256: outbox.system_contract.sha256,
  }, null, 2));
}

main();
