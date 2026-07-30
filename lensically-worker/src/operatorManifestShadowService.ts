type JsonRecord = Record<string, unknown>;

export const MANIFEST_SHADOW_CONTRACT_VERSION = "manifest-shadow-cycle-v1";
export const MANIFEST_SHADOW_SNAPSHOT_VERSION = "manifest-shadow-snapshot-v1";
export const MANIFEST_SHADOW_DEFAULT_SUCCESS_RETENTION_HOURS = 72;
export const MANIFEST_SHADOW_MAX_FAILURE_RETENTION_HOURS = 24 * 14;

export const MANIFEST_SHADOW_OPERATIONAL_TABLES = [
  "operator_manifest_decision_influences",
  "operator_manifest_experiment_assignments",
  "operator_manifest_candidate_gate_receipts",
  "operator_manifest_post_hypotheses",
  "operator_manifest_cycle_defect_receipts",
  "operator_manifest_cycle_receipt_events",
  "operator_manifest_cycle_receipts",
  "operator_manifest_cycle_plan_items",
  "operator_manifest_cycle_strategies",
  "operator_manifest_analysis_page_reads",
  "operator_manifest_evidence_pages",
  "operator_manifest_evidence_posts",
  "operator_manifest_evidence_snapshots",
  "operator_manifest_exposure_snapshots",
  "operator_source_selection_plans",
  "operator_source_selection_receipts",
  "operator_source_selections",
  "operator_source_selection_batches",
  "operator_autonomous_lineup_items",
  "operator_autonomous_growth_cycles",
  "operator_manifest_prepare_checkpoints",
  "operator_gate_results",
  "operator_gates",
  "operator_content_inventory",
  "operator_post_fingerprints",
  "operator_post_metric_snapshots",
  "operator_performance_evidence",
  "operator_performance_hypotheses",
  "operator_post_performance_scores",
  "operator_manifest_semantic_signatures",
  "operator_manifest_maturity_evaluations",
  "operator_manifest_comparable_analyses",
  "operator_manifest_learning_observations",
  "operator_manifest_portfolio_states",
  "operator_manifest_state_transitions",
  "operator_manifest_experiments",
  "operator_manifest_learning_briefs",
  "operator_manifest_benchmark_snapshots",
  "operator_manifest_run_comparisons",
  "operator_manifest_follower_checkpoints",
  "operator_source_family_evidence_states",
  "operator_source_family_label_transitions",
  "operator_generation_learning_briefs",
  "operator_content_focus_reviews",
  "operator_content_focus_family_states",
  "gpt_generation_drafts",
  "gpt_generation_runs",
  "gpt_post_strategy_tags",
  "gpt_preflight_snapshots",
  "scheduled_post_deletions",
  "scheduled_posts",
  "threads_publish_idempotency",
  "threads_post_insights_cache",
  "threads_posts_cache_state",
  "threads_user_insights_cache",
  "threads_posts_archive",
  "threads_follower_snapshots",
  "threads_profile_cache",
  "operator_daily_source_claims",
  "operator_source_exclusions",
  "operator_source_cards",
  "operator_source_card_families",
  "operator_manifest_saved_pattern_intelligence",
  "external_patterns",
  "operator_manifest_hard_bans",
  "operator_manifest_strategy_versions",
  "operator_manifest_intelligence_policies",
  "gpt_strategy_memory",
  "operator_autonomy_profiles",
  "operator_growth_mission_revisions",
  "operator_growth_missions",
  "app_threads_accounts",
  "threads_accounts",
  "batch_schedule_presets",
  "users",
] as const;

export const MANIFEST_SHADOW_SNAPSHOT_TABLES = new Set<string>([
  "users",
  "app_threads_accounts",
  "threads_accounts",
  "operator_autonomy_profiles",
  "operator_growth_missions",
  "operator_growth_mission_revisions",
  "threads_profile_cache",
  "threads_follower_snapshots",
  "threads_posts_archive",
  "threads_posts_cache_state",
  "threads_post_insights_cache",
  "threads_user_insights_cache",
  "scheduled_posts",
  "external_patterns",
  "operator_manifest_saved_pattern_intelligence",
  "operator_source_card_families",
  "operator_source_cards",
  "operator_source_exclusions",
  "operator_manifest_hard_bans",
  "operator_manifest_intelligence_policies",
  "operator_manifest_strategy_versions",
  "operator_manifest_semantic_signatures",
  "operator_manifest_maturity_evaluations",
  "operator_manifest_comparable_analyses",
  "operator_manifest_learning_observations",
  "operator_manifest_portfolio_states",
  "operator_manifest_state_transitions",
  "operator_manifest_experiments",
  "operator_manifest_learning_briefs",
  "operator_manifest_benchmark_snapshots",
  "operator_manifest_run_comparisons",
  "operator_manifest_follower_checkpoints",
  "operator_source_family_evidence_states",
  "operator_source_family_label_transitions",
  "operator_generation_learning_briefs",
  "operator_content_focus_reviews",
  "operator_content_focus_family_states",
  "operator_post_metric_snapshots",
  "operator_post_performance_scores",
  "operator_performance_evidence",
  "operator_performance_hypotheses",
  "operator_content_inventory",
  "gpt_post_strategy_tags",
  "gpt_strategy_memory",
]);

const MUTATING_SQL = /\b(?:INSERT|UPDATE|DELETE|REPLACE|UPSERT|ALTER|CREATE|DROP|TRUNCATE|VACUUM|REINDEX|ATTACH|DETACH|PRAGMA|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function normalizeSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n\r]*/g, " ")
    .trim();
}

export function assertManifestShadowReadOnlySql(sql: string): void {
  const normalized = normalizeSql(sql);
  if (!normalized) throw new Error("manifest_shadow_read_sql_required");
  if (normalized.includes(";")) throw new Error("manifest_shadow_multiple_sql_statements_forbidden");
  if (!/^(?:SELECT|WITH)\b/i.test(normalized)) {
    throw new Error("manifest_shadow_production_query_must_be_read_only");
  }
  if (MUTATING_SQL.test(normalized)) {
    throw new Error("manifest_shadow_production_mutation_forbidden");
  }
}

function wrapReadOnlyStatement(statement: D1PreparedStatement): D1PreparedStatement {
  return new Proxy(statement, {
    get(target, property, receiver) {
      if (property === "run") {
        return () => Promise.reject(new Error("manifest_shadow_production_mutation_forbidden"));
      }
      if (property === "bind") {
        return (...values: unknown[]) => wrapReadOnlyStatement(target.bind(...values));
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export function createManifestShadowReadOnlyDatabase(database: D1Database): D1Database {
  return new Proxy(database, {
    get(target, property, receiver) {
      if (property === "prepare") {
        return (sql: string) => {
          assertManifestShadowReadOnlySql(sql);
          return wrapReadOnlyStatement(target.prepare(sql));
        };
      }
      if (property === "batch" || property === "exec") {
        return () => Promise.reject(new Error("manifest_shadow_production_mutation_forbidden"));
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as D1Database;
}

export type ManifestShadowSnapshotTable = {
  table: string;
  columns: string[];
  rows: JsonRecord[];
};

export type ManifestShadowSnapshot = {
  contract_version: string;
  brand_key: string;
  source_as_of: string;
  snapshot_hash: string;
  tables: ManifestShadowSnapshotTable[];
  metadata?: JsonRecord;
};

export type ManifestShadowRunInput = {
  run_id: string;
  brand_key: string;
  scenario: string;
  evidence_mode: "snapshot" | "live_read";
  variant_key: string;
  operation_root: string;
  code_sha: string;
  retention_hours?: number;
};

export type ManifestShadowBenchmarkInput = {
  id: string;
  shadow_run_id: string;
  brand_key: string;
  scenario: string;
  evidence_mode: "snapshot" | "live_read";
  variant_key: string;
  snapshot_hash: string;
  code_sha: string;
  contract_versions: JsonRecord;
  counts: JsonRecord;
  timings: JsonRecord;
  external_read_count: number;
  retry_count: number;
  continuation_count: number;
  payload_bytes: number;
  production_noninterference_passed: boolean;
  threads_mutation_count: number;
  cleanup_orphan_count: number;
  passed: boolean;
  failed_rule?: string | null;
};

export function createManifestShadowNoThreadsMutationAdapter(): {
  mutationCount(): number;
  schedule(): Promise<never>;
  publish(): Promise<never>;
  delete(): Promise<never>;
  edit(): Promise<never>;
} {
  let attemptedMutations = 0;
  const reject = async (): Promise<never> => {
    attemptedMutations += 1;
    throw new Error("manifest_shadow_threads_mutation_forbidden");
  };
  return {
    mutationCount: () => attemptedMutations,
    schedule: reject,
    publish: reject,
    delete: reject,
    edit: reject,
  };
}

function quotedIdentifier(value: string): string {
  if (!IDENTIFIER.test(value)) throw new Error(`manifest_shadow_invalid_identifier:${value}`);
  return `"${value}"`;
}

function retentionHours(value: unknown, failed = false): number {
  const fallback = failed
    ? MANIFEST_SHADOW_MAX_FAILURE_RETENTION_HOURS
    : MANIFEST_SHADOW_DEFAULT_SUCCESS_RETENTION_HOURS;
  const parsed = Math.trunc(Number(value ?? fallback));
  return Math.max(1, Math.min(parsed, MANIFEST_SHADOW_MAX_FAILURE_RETENTION_HOURS));
}

export async function cleanupManifestShadowMetadata(
  db: D1Database,
  nowIso: string,
): Promise<{ expired_runs: number; expired_archives: number }> {
  const archives = await db.prepare(
    `DELETE FROM manifest_shadow_diagnostic_archives WHERE datetime(expires_at) <= datetime(?)`,
  ).bind(nowIso).run();
  const runs = await db.prepare(
    `DELETE FROM manifest_shadow_runs
     WHERE datetime(details_expires_at) <= datetime(?)
       AND status NOT IN ('preparing', 'running')`,
  ).bind(nowIso).run();
  return {
    expired_runs: Number(runs.meta?.changes ?? 0),
    expired_archives: Number(archives.meta?.changes ?? 0),
  };
}

export async function recoverStaleManifestShadowRun(
  db: D1Database,
  nowIso: string,
): Promise<number> {
  const result = await db.prepare(
    `UPDATE manifest_shadow_runs
     SET status = 'failed',
         failure_code = 'shadow_run_lease_expired',
         failure_message = 'The prior disposable shadow run exceeded its lease.',
         completed_at = ?,
         details_expires_at = datetime(?, '+14 days'),
         updated_at = CURRENT_TIMESTAMP
     WHERE status IN ('preparing', 'running')
       AND datetime(lease_expires_at) <= datetime(?)`,
  ).bind(nowIso, nowIso, nowIso).run();
  return Number(result.meta?.changes ?? 0);
}

export async function resetManifestShadowWorkspace(
  db: D1Database,
): Promise<{ deleted_tables: string[]; orphan_count: number }> {
  const deleted: string[] = [];
  for (const table of MANIFEST_SHADOW_OPERATIONAL_TABLES) {
    try {
      await db.prepare(`DELETE FROM ${quotedIdentifier(table)}`).run();
      deleted.push(table);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/no such table/i.test(message)) throw error;
    }
  }
  const orphanCount = await verifyManifestShadowOrphans(db);
  if (orphanCount !== 0) throw new Error(`manifest_shadow_reset_orphans:${orphanCount}`);
  return { deleted_tables: deleted, orphan_count: orphanCount };
}

export async function verifyManifestShadowOrphans(db: D1Database): Promise<number> {
  const checks = [
    `SELECT COUNT(*) AS count FROM operator_manifest_cycle_plan_items p LEFT JOIN operator_manifest_cycle_strategies s ON s.id = p.strategy_id WHERE s.id IS NULL`,
    `SELECT COUNT(*) AS count FROM operator_manifest_post_hypotheses h LEFT JOIN operator_autonomous_growth_cycles c ON c.id = h.cycle_id WHERE c.id IS NULL`,
    `SELECT COUNT(*) AS count FROM operator_manifest_decision_influences d LEFT JOIN scheduled_posts p ON p.id = d.scheduled_post_id WHERE d.scheduled_post_id IS NOT NULL AND p.id IS NULL`,
    `SELECT COUNT(*) AS count FROM operator_manifest_experiment_assignments a LEFT JOIN operator_manifest_post_hypotheses h ON h.id = a.hypothesis_id WHERE h.id IS NULL`,
  ];
  let total = 0;
  for (const sql of checks) {
    try {
      const row = await db.prepare(sql).first<{ count: number }>();
      total += Number(row?.count ?? 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/no such table|no such column/i.test(message)) throw error;
    }
  }
  return total;
}

export async function beginManifestShadowRun(
  db: D1Database,
  input: ManifestShadowRunInput,
  nowIso: string,
): Promise<JsonRecord> {
  await recoverStaleManifestShadowRun(db, nowIso);
  await cleanupManifestShadowMetadata(db, nowIso);
  const active = await db.prepare(
    `SELECT id, operation_root, status FROM manifest_shadow_runs
     WHERE status IN ('preparing', 'running') LIMIT 1`,
  ).first<JsonRecord>();
  if (active && String(active.operation_root ?? "") !== input.operation_root) {
    throw new Error(`manifest_shadow_run_already_active:${String(active.id ?? "unknown")}`);
  }
  const hours = retentionHours(input.retention_hours);
  await db.prepare(
    `INSERT INTO manifest_shadow_runs (
       id, brand_key, scenario, evidence_mode, variant_key, operation_root,
       code_sha, status, lease_expires_at, details_expires_at, started_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'preparing', datetime(?, '+30 minutes'), datetime(?, '+' || ? || ' hours'), ?)
     ON CONFLICT(operation_root) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`,
  ).bind(
    input.run_id,
    input.brand_key,
    input.scenario,
    input.evidence_mode,
    input.variant_key,
    input.operation_root,
    input.code_sha,
    nowIso,
    nowIso,
    hours,
    nowIso,
  ).run();
  return (await db.prepare(
    `SELECT * FROM manifest_shadow_runs WHERE operation_root = ? LIMIT 1`,
  ).bind(input.operation_root).first<JsonRecord>()) ?? {};
}

export async function seedManifestShadowSnapshot(
  db: D1Database,
  runId: string,
  snapshot: ManifestShadowSnapshot,
  expiresAt: string,
): Promise<{ table_count: number; row_count: number; payload_bytes: number }> {
  if (snapshot.contract_version !== MANIFEST_SHADOW_SNAPSHOT_VERSION) {
    throw new Error("manifest_shadow_snapshot_contract_mismatch");
  }
  let rowCount = 0;
  for (const tablePayload of snapshot.tables) {
    if (!MANIFEST_SHADOW_SNAPSHOT_TABLES.has(tablePayload.table)) {
      throw new Error(`manifest_shadow_snapshot_table_forbidden:${tablePayload.table}`);
    }
    const table = quotedIdentifier(tablePayload.table);
    const columns = tablePayload.columns.map(quotedIdentifier);
    if (!columns.length && tablePayload.rows.length) {
      throw new Error(`manifest_shadow_snapshot_columns_required:${tablePayload.table}`);
    }
    for (const row of tablePayload.rows) {
      const placeholders = columns.map(() => "?").join(", ");
      const values = tablePayload.columns.map((column) => row[column] ?? null);
      await db.prepare(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
      ).bind(...values).run();
      rowCount += 1;
    }
  }
  const payloadJson = JSON.stringify(snapshot);
  const payloadBytes = new TextEncoder().encode(payloadJson).byteLength;
  await db.prepare(
    `INSERT INTO manifest_shadow_snapshots (
       id, shadow_run_id, brand_key, snapshot_hash, contract_version,
       source_as_of, payload_json, payload_bytes, expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    runId,
    snapshot.brand_key,
    snapshot.snapshot_hash,
    snapshot.contract_version,
    snapshot.source_as_of,
    payloadJson,
    payloadBytes,
    expiresAt,
  ).run();
  await db.prepare(
    `UPDATE manifest_shadow_runs
     SET snapshot_hash = ?, status = 'running', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).bind(snapshot.snapshot_hash, runId).run();
  return { table_count: snapshot.tables.length, row_count: rowCount, payload_bytes: payloadBytes };
}

export async function recordManifestShadowStageEvent(
  db: D1Database,
  input: {
    id?: string;
    run_id: string;
    stage_key: string;
    event_key: string;
    status: string;
    started_at?: string | null;
    completed_at?: string | null;
    duration_ms?: number | null;
    payload?: JsonRecord;
  },
): Promise<void> {
  await db.prepare(
    `INSERT INTO manifest_shadow_stage_events (
       id, shadow_run_id, stage_key, event_key, status,
       started_at, completed_at, duration_ms, payload_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(shadow_run_id, event_key) DO UPDATE SET
       status = excluded.status,
       started_at = excluded.started_at,
       completed_at = excluded.completed_at,
       duration_ms = excluded.duration_ms,
       payload_json = excluded.payload_json`,
  ).bind(
    input.id ?? crypto.randomUUID(),
    input.run_id,
    input.stage_key,
    input.event_key,
    input.status,
    input.started_at ?? null,
    input.completed_at ?? null,
    input.duration_ms ?? null,
    JSON.stringify(input.payload ?? {}),
  ).run();
}

export async function failManifestShadowRun(
  db: D1Database,
  input: {
    run_id: string;
    now_iso: string;
    error_code: string;
    error_message: string;
    diagnostics?: JsonRecord;
  },
): Promise<void> {
  const expiresAt = new Date(Date.parse(input.now_iso) + MANIFEST_SHADOW_MAX_FAILURE_RETENTION_HOURS * 3600000).toISOString();
  await db.prepare(
    `UPDATE manifest_shadow_runs
     SET status = 'failed', failure_code = ?, failure_message = ?, completed_at = ?,
         details_expires_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).bind(input.error_code, input.error_message, input.now_iso, expiresAt, input.run_id).run();
  if (input.diagnostics) {
    await db.prepare(
      `INSERT INTO manifest_shadow_diagnostic_archives (
         id, shadow_run_id, archive_key, severity, payload_json, expires_at
       ) VALUES (?, ?, 'failure', 'error', ?, ?)
       ON CONFLICT(shadow_run_id, archive_key) DO UPDATE SET
         payload_json = excluded.payload_json, expires_at = excluded.expires_at`,
    ).bind(crypto.randomUUID(), input.run_id, JSON.stringify(input.diagnostics), expiresAt).run();
  }
}

export async function completeManifestShadowRun(
  db: D1Database,
  runId: string,
  nowIso: string,
): Promise<void> {
  await db.prepare(
    `UPDATE manifest_shadow_runs
     SET status = 'completed', completed_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).bind(nowIso, runId).run();
}

export async function writeManifestShadowBenchmarkReceipt(
  productionDb: D1Database,
  input: ManifestShadowBenchmarkInput,
): Promise<void> {
  await productionDb.prepare(
    `INSERT INTO manifest_shadow_benchmark_receipts (
       id, shadow_run_id, brand_key, scenario, evidence_mode, variant_key,
       snapshot_hash, code_sha, contract_versions_json, counts_json, timings_json,
       external_read_count, retry_count, continuation_count, payload_bytes,
       production_noninterference_passed, threads_mutation_count, cleanup_orphan_count,
       passed, failed_rule
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(shadow_run_id) DO UPDATE SET
       contract_versions_json = excluded.contract_versions_json,
       counts_json = excluded.counts_json,
       timings_json = excluded.timings_json,
       external_read_count = excluded.external_read_count,
       retry_count = excluded.retry_count,
       continuation_count = excluded.continuation_count,
       payload_bytes = excluded.payload_bytes,
       production_noninterference_passed = excluded.production_noninterference_passed,
       threads_mutation_count = excluded.threads_mutation_count,
       cleanup_orphan_count = excluded.cleanup_orphan_count,
       passed = excluded.passed,
       failed_rule = excluded.failed_rule`,
  ).bind(
    input.id,
    input.shadow_run_id,
    input.brand_key,
    input.scenario,
    input.evidence_mode,
    input.variant_key,
    input.snapshot_hash,
    input.code_sha,
    JSON.stringify(input.contract_versions),
    JSON.stringify(input.counts),
    JSON.stringify(input.timings),
    input.external_read_count,
    input.retry_count,
    input.continuation_count,
    input.payload_bytes,
    input.production_noninterference_passed ? 1 : 0,
    input.threads_mutation_count,
    input.cleanup_orphan_count,
    input.passed ? 1 : 0,
    input.failed_rule ?? null,
  ).run();
}

export async function readManifestShadowReceipt(
  shadowDb: D1Database,
  productionDb: D1Database,
  runId: string,
): Promise<JsonRecord> {
  const [run, snapshot, stages, diagnostic, benchmark] = await Promise.all([
    shadowDb.prepare(`SELECT * FROM manifest_shadow_runs WHERE id = ? LIMIT 1`).bind(runId).first<JsonRecord>(),
    shadowDb.prepare(`SELECT id, snapshot_hash, contract_version, source_as_of, payload_bytes, expires_at, created_at FROM manifest_shadow_snapshots WHERE shadow_run_id = ? LIMIT 1`).bind(runId).first<JsonRecord>(),
    shadowDb.prepare(`SELECT stage_key, event_key, status, started_at, completed_at, duration_ms, payload_json, created_at FROM manifest_shadow_stage_events WHERE shadow_run_id = ? ORDER BY datetime(created_at), event_key`).bind(runId).all<JsonRecord>(),
    shadowDb.prepare(`SELECT archive_key, severity, payload_json, expires_at, created_at FROM manifest_shadow_diagnostic_archives WHERE shadow_run_id = ? ORDER BY datetime(created_at) DESC LIMIT 1`).bind(runId).first<JsonRecord>(),
    productionDb.prepare(`SELECT * FROM manifest_shadow_benchmark_receipts WHERE shadow_run_id = ? LIMIT 1`).bind(runId).first<JsonRecord>(),
  ]);
  return {
    contract_version: MANIFEST_SHADOW_CONTRACT_VERSION,
    run: run ?? null,
    snapshot: snapshot ?? null,
    stages: stages.results ?? [],
    diagnostic: diagnostic ? { ...diagnostic, payload: asRecord(JSON.parse(String(diagnostic.payload_json ?? "{}"))) } : null,
    benchmark: benchmark ?? null,
  };
}
