import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

const root = resolve(import.meta.dirname, "..");
const read = async (path) => readFile(resolve(root, path), "utf8");
const count = (text, pattern) => [...text.matchAll(pattern)].length;
const lines = (text) => text.length === 0 ? 0 : text.split(/\r?\n/).length;

const indexPath = "src/index.ts";
const testPath = "test/operatorMode.spec.ts";
const preflightPath = "scripts/release-preflight.mjs";
const [indexSource, operatorTests, releasePreflight, packageJson, tsconfig] = await Promise.all([
  read(indexPath),
  read(testPath),
  read(preflightPath),
  read("package.json"),
  read("tsconfig.json"),
]);

const fileMetric = async (path, text) => ({
  path,
  bytes: (await stat(resolve(root, path))).size,
  lines: lines(text),
});

const result = {
  version: "worker-architecture-baseline-v1",
  generated_at: new Date().toISOString(),
  source: {
    index: await fileMetric(indexPath, indexSource),
    operator_tests: await fileMetric(testPath, operatorTests),
    release_preflight: await fileMetric(preflightPath, releasePreflight),
  },
  index_metrics: {
    async_functions: count(indexSource, /\basync function\b/g),
    inline_create_table_statements: count(indexSource, /CREATE TABLE IF NOT EXISTS/gi),
    inline_alter_table_statements: count(indexSource, /ALTER TABLE/gi),
    exact_path_branches: count(indexSource, /(?:url|normalizedPath)\.pathname ===|normalizedPath ===/g),
    prefix_route_branches: count(indexSource, /(?:url\.pathname|normalizedPath)\.startsWith\(/g),
    runtime_ensure_functions: count(indexSource, /\basync function ensure[A-Z]/g),
    legacy_markers: count(indexSource, /\blegacy\b/gi),
    retired_markers: count(indexSource, /\bretired\b/gi),
    explicitly_unused_legacy_functions: count(indexSource, /LegacyUnused/g),
    local_execution_references: count(indexSource, /LocalExecution|LOCAL_EXECUTION_/g),
    gpt_memory_route_references: count(indexSource, /\/api\/gpt-memory\//g),
    gpt_route_references: count(indexSource, /\/api\/gpt\//g),
    agent_route_references: count(indexSource, /\/api\/agent\//g),
    automation_route_references: count(indexSource, /\/(?:api|internal)\/automation\//g),
  },
  test_metrics: {
    tests: count(operatorTests, /\bit\s*\(/g),
    skipped_tests: count(operatorTests, /\bit\.skip\s*\(/g),
  },
  release_metrics: {
    exact_source_string_checks: count(releasePreflight, /source\.includes\(/g),
  },
  engineering_controls: {
    package_has_lint_script: /"lint"\s*:/.test(packageJson),
    package_has_format_script: /"format"\s*:/.test(packageJson),
    no_unused_locals: /"noUnusedLocals"\s*:\s*true/.test(tsconfig),
    no_unused_parameters: /"noUnusedParameters"\s*:\s*true/.test(tsconfig),
  },
};

if (process.argv.includes("--live")) {
  const endpoints = [
    { name: "worker_health", url: "https://api.lensically.com/health", expected: 200 },
    { name: "operator_health", url: "https://api.lensically.com/api/operator/health", expected: 200 },
    { name: "scheduler_health", url: "https://api.lensically.com/api/operator/scheduler-health", expected: 200 },
    { name: "dashboard", url: "https://lensically.com/dashboard", expected: 200 },
    { name: "retired_gpt_memory", url: "https://api.lensically.com/api/gpt-memory/dashboard", expected: 410 },
    { name: "retired_agent", url: "https://api.lensically.com/api/agent/accounts", expected: 410 },
    { name: "retired_intelligence_ui", url: "https://api.lensically.com/api/threads/intelligence-dashboard", expected: 410 },
  ];
  const samples = 5;
  result.live_runtime = {};
  for (const endpoint of endpoints) {
    const durations = [];
    let lastStatus = null;
    for (let index = 0; index < samples; index += 1) {
      const started = performance.now();
      const response = await fetch(endpoint.url, { headers: { "cache-control": "no-cache" } });
      durations.push(Number((performance.now() - started).toFixed(2)));
      lastStatus = response.status;
      await response.arrayBuffer();
    }
    const ordered = [...durations].sort((a, b) => a - b);
    result.live_runtime[endpoint.name] = {
      url: endpoint.url,
      expected_status: endpoint.expected,
      observed_status: lastStatus,
      status_matches: lastStatus === endpoint.expected,
      samples,
      min_ms: ordered[0],
      median_ms: ordered[Math.floor(ordered.length / 2)],
      max_ms: ordered[ordered.length - 1],
    };
  }
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
