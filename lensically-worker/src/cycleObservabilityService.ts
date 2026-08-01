type JsonRecord = Record<string, unknown>;

export const CYCLE_OBSERVABILITY_CONTRACT_VERSION = "manifest-cycle-observability-v1";
export const CYCLE_RAIL_STATE_CONTRACT_VERSION = "manifest-cycle-rail-state-v1";
export const CYCLE_HISTORY_DEFAULT_LIMIT = 10;
export const CYCLE_HISTORY_MAX_LIMIT = 10;
export const CYCLE_SELECTION_PREVIEW_LIMIT = 6;
export const CYCLE_SELECTION_MAX_LIMIT = 72;
export const CYCLE_DETAIL_JSON_MAX_BYTES = 64_000;
export const CYCLE_SHADOW_STATE_MAX_BYTES = 512_000;

export type CycleRail = "main" | "innovation";
export type MainCycleRailState =
  | "current_champion"
  | "incumbent_behind_challenger"
  | "incumbent_awaiting_promotion";
export type InnovationCycleRailState = "standby" | "current_challenger" | "champion_candidate";
export type MainCycleVersionBump = "patch" | "minor" | "major";

export type CycleObservabilityAction =
  | "state"
  | "history"
  | "summary"
  | "selections"
  | "selection_detail";

export type CycleObservabilityInput = {
  db: D1Database;
  shadowDb?: D1Database;
  brandKey: string;
  action: CycleObservabilityAction;
  rail?: CycleRail;
  id?: string;
  cursor?: string | null;
  limit?: number;
  showAll?: boolean;
  slotKey?: string;
  filter?: string | null;
};

export type CycleObservabilityResult = {
  status: number;
  body: JsonRecord;
};

type SemanticVersion = {
  major: number;
  minor: number;
  patch: number;
  text: string;
};

type HistoryCursor = {
  at: string;
  id: string;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: unknown): boolean | null {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return null;
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function parseJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseBoundedJson(value: unknown, maxBytes = CYCLE_DETAIL_JSON_MAX_BYTES): {
  available: boolean;
  value: unknown;
  bytes: number;
  reason?: string;
} {
  if (typeof value !== "string" || !value.trim()) {
    return { available: false, value: null, bytes: 0, reason: "unavailable" };
  }
  const bytes = utf8Bytes(value);
  if (bytes > maxBytes) {
    return { available: false, value: null, bytes, reason: "payload_too_large" };
  }
  try {
    return { available: true, value: JSON.parse(value), bytes };
  } catch {
    return { available: false, value: null, bytes, reason: "invalid_json" };
  }
}

function normalizeHistoryLimit(value: unknown): number {
  const parsed = Math.trunc(asNumber(value, CYCLE_HISTORY_DEFAULT_LIMIT));
  return Math.max(1, Math.min(parsed, CYCLE_HISTORY_MAX_LIMIT));
}

function normalizeBrandKey(value: unknown): string {
  return asText(value) ?? "manifest_mental";
}

function normalizeRail(value: unknown): CycleRail {
  return value === "innovation" ? "innovation" : "main";
}

function normalizeFilter(value: unknown): string | null {
  const normalized = asText(value)?.toLowerCase().replace(/\s+/g, "_") ?? null;
  return normalized && /^[a-z0-9_-]{1,40}$/.test(normalized) ? normalized : null;
}

export function parseMainCycleSemanticVersion(value: string): SemanticVersion {
  const match = String(value ?? "").trim().match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error("main_cycle_semantic_version_invalid");
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (![major, minor, patch].every((part) => Number.isSafeInteger(part) && part >= 0)) {
    throw new Error("main_cycle_semantic_version_invalid");
  }
  return { major, minor, patch, text: `v${major}.${minor}.${patch}` };
}

export function incrementMainCycleSemanticVersion(
  currentVersion: string,
  bump: MainCycleVersionBump,
): string {
  const current = parseMainCycleSemanticVersion(currentVersion);
  if (bump === "patch") return `v${current.major}.${current.minor}.${current.patch + 1}`;
  if (bump === "minor") return `v${current.major}.${current.minor + 1}.0`;
  if (bump === "major") return `v${current.major + 1}.0.0`;
  throw new Error("main_cycle_semantic_version_bump_invalid");
}

export function validatePairedCycleRailState(input: {
  mainState: MainCycleRailState;
  innovationState: InnovationCycleRailState;
  activeInnovationRunId?: string | null;
}): void {
  const activeRun = asText(input.activeInnovationRunId);
  const stable = input.mainState === "current_champion"
    && input.innovationState === "standby"
    && !activeRun;
  const challenging = input.mainState === "incumbent_behind_challenger"
    && input.innovationState === "current_challenger"
    && Boolean(activeRun);
  const awaitingPromotion = input.mainState === "incumbent_awaiting_promotion"
    && input.innovationState === "champion_candidate"
    && Boolean(activeRun);
  if (!stable && !challenging && !awaitingPromotion) {
    throw new Error("manifest_cycle_rail_state_pair_invalid");
  }
}

function encodeHistoryCursor(input: HistoryCursor): string {
  return encodeURIComponent(JSON.stringify({ at: input.at, id: input.id }));
}

function decodeHistoryCursor(value: unknown): HistoryCursor | null {
  const normalized = asText(value);
  if (!normalized || normalized.length > 1000) return null;
  try {
    const parsed = asRecord(JSON.parse(decodeURIComponent(normalized)));
    const at = asText(parsed.at);
    const id = asText(parsed.id);
    if (!at || !id || at.length > 80 || id.length > 160) return null;
    return { at, id };
  } catch {
    return null;
  }
}

function compactText(value: unknown, maxLength = 120): string | null {
  const normalized = asText(value);
  if (!normalized) return null;
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function titleCaseCycleState(value: unknown): string {
  const normalized = asText(value);
  if (!normalized) return "Unknown";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function extractSourceText(primarySource: unknown): string | null {
  const source = asRecord(primarySource);
  for (const key of ["source_text", "post_text", "text", "body", "content", "caption"]) {
    const value = asText(source[key]);
    if (value) return value;
  }
  const nested = asRecord(source.source);
  for (const key of ["source_text", "post_text", "text", "body", "content", "caption"]) {
    const value = asText(nested[key]);
    if (value) return value;
  }
  return null;
}

function extractPersistedReason(receipt: JsonRecord): string | null {
  for (const key of ["selection_reason", "placement_reason", "reason", "decision_summary", "causal_reason"]) {
    const value = asText(receipt[key]);
    if (value) return value;
  }
  return null;
}

function isMissingSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /no such table|no such column/i.test(message);
}

async function readRailState(
  mainDb: D1Database,
  shadowDb: D1Database,
  brandKey: string,
): Promise<CycleObservabilityResult> {
  const champion = await mainDb.prepare(
    `SELECT
       id,
       semantic_version,
       source_sha,
       selector_version,
       preselection_policy_version,
       component_versions_json,
       promoted_from_innovation_run_id,
       promotion_classification,
       promoted_at,
       updated_at
     FROM manifest_cycle_champions
     WHERE brand_key = ? AND status = 'current'
     LIMIT 1`,
  ).bind(brandKey).first<JsonRecord>();
  if (!champion) {
    return {
      status: 404,
      body: { success: false, error: "main_cycle_champion_not_found", brand_key: brandKey },
    };
  }

  const promotions = await mainDb.prepare(
    `SELECT
       id,
       previous_version,
       promoted_version,
       classification,
       innovation_run_id,
       tested_sha,
       promoted_at
     FROM manifest_cycle_promotion_history
     WHERE brand_key = ?
     ORDER BY promoted_at DESC, id DESC
     LIMIT 10`,
  ).bind(brandKey).all<JsonRecord>();

  const latestInnovation = await shadowDb.prepare(
    `SELECT
       r.id AS run_id,
       r.status,
       r.variant_key,
       r.code_sha,
       r.snapshot_hash,
       r.started_at,
       r.completed_at,
       r.created_at,
       b.passed AS benchmark_passed,
       b.failed_rule,
       b.counts_json,
       b.timings_json
     FROM manifest_shadow_runs r
     LEFT JOIN manifest_shadow_benchmark_receipts b ON b.shadow_run_id = r.id
     WHERE r.brand_key = ?
     ORDER BY COALESCE(r.completed_at, r.started_at, r.created_at) DESC, r.id DESC
     LIMIT 1`,
  ).bind(brandKey).first<JsonRecord>();

  const latestRunId = asText(latestInnovation?.run_id);
  const promotionForLatest = latestRunId
    ? (promotions.results ?? []).find((promotion) => asText(promotion.innovation_run_id) === latestRunId) ?? null
    : null;
  const promotedByChampion = latestRunId && asText(champion.promoted_from_innovation_run_id) === latestRunId;
  const promoted = Boolean(promotionForLatest || promotedByChampion);
  const latestStatus = asText(latestInnovation?.status)?.toLowerCase() ?? null;
  const benchmarkPassed = asBoolean(latestInnovation?.benchmark_passed);
  const isRunning = latestStatus === "preparing" || latestStatus === "running";
  const isCandidate = !promoted && latestStatus === "completed" && benchmarkPassed !== false;

  const mainState: MainCycleRailState = isRunning
    ? "incumbent_behind_challenger"
    : isCandidate
      ? "incumbent_awaiting_promotion"
      : "current_champion";
  const innovationState: InnovationCycleRailState = isRunning
    ? "current_challenger"
    : isCandidate
      ? "champion_candidate"
      : "standby";
  const activeInnovationRunId = isRunning || isCandidate ? latestRunId : null;
  validatePairedCycleRailState({ mainState, innovationState, activeInnovationRunId });

  const latestDerivedState = promoted
    ? "promoted"
    : latestStatus === "failed" || benchmarkPassed === false
      ? "failed"
      : isRunning
        ? "current_challenger"
        : isCandidate
          ? "champion_candidate"
          : latestStatus;
  const promotionDestinationVersion = asText(promotionForLatest?.promoted_version)
    ?? (promotedByChampion ? asText(champion.semantic_version) : null);
  const latestRun = latestInnovation ? {
    run_id: latestRunId,
    state: latestDerivedState,
    challenged_main_version: asText(champion.semantic_version),
    candidate_version: null,
    tested_sha: asText(latestInnovation.code_sha),
    snapshot_hash: asText(latestInnovation.snapshot_hash),
    selector_version: null,
    preselection_policy_version: null,
    control_or_challenger: asText(latestInnovation.variant_key),
    passed: benchmarkPassed,
    promotion_eligible: isCandidate || promoted,
    promotion_destination_version: promotionDestinationVersion,
    started_at: asText(latestInnovation.started_at),
    completed_at: asText(latestInnovation.completed_at),
    failed_rule: asText(latestInnovation.failed_rule),
    counts: asRecord(parseJson(latestInnovation.counts_json, {})),
    timings: asRecord(parseJson(latestInnovation.timings_json, {})),
  } : null;

  return {
    status: 200,
    body: {
      success: true,
      contract_version: CYCLE_OBSERVABILITY_CONTRACT_VERSION,
      state_contract_version: CYCLE_RAIL_STATE_CONTRACT_VERSION,
      brand_key: brandKey,
      main: {
        state: mainState,
        display_state: mainState === "current_champion"
          ? "Current Champion"
          : mainState === "incumbent_behind_challenger"
            ? "Incumbent — Behind Challenger"
            : "Incumbent — Awaiting Promotion",
        semantic_version: asText(champion.semantic_version),
        source_sha: asText(champion.source_sha),
        selector_version: asText(champion.selector_version),
        preselection_policy_version: asText(champion.preselection_policy_version),
        component_versions: asRecord(parseJson(champion.component_versions_json, {})),
        promoted_from_innovation_run_id: asText(champion.promoted_from_innovation_run_id),
        promotion_classification: asText(champion.promotion_classification),
        promoted_at: asText(champion.promoted_at),
      },
      innovation: {
        state: innovationState,
        display_state: innovationState === "standby"
          ? "Standby"
          : innovationState === "current_challenger"
            ? "Current Challenger"
            : "Champion Candidate",
        active_run: activeInnovationRunId ? latestRun : null,
        latest_run: latestRun,
      },
      promotion_history: (promotions.results ?? []).map((promotion) => ({
        id: asText(promotion.id),
        previous_version: asText(promotion.previous_version),
        promoted_version: asText(promotion.promoted_version),
        classification: asText(promotion.classification),
        innovation_run_id: asText(promotion.innovation_run_id),
        tested_sha: asText(promotion.tested_sha),
        promoted_at: asText(promotion.promoted_at),
      })),
      updated_at: asText(latestInnovation?.completed_at)
        ?? asText(latestInnovation?.started_at)
        ?? asText(champion.updated_at)
        ?? asText(champion.promoted_at),
    },
  };
}



async function readMainHistory(
  db: D1Database,
  brandKey: string,
  cursorValue: unknown,
  limitValue: unknown,
): Promise<CycleObservabilityResult> {
  const limit = normalizeHistoryLimit(limitValue);
  const cursor = decodeHistoryCursor(cursorValue);
  const baseSelect = `SELECT
       r.cycle_id AS id,
       r.operation_id,
       r.receipt_version,
       r.status,
       r.started_at,
       r.completed_at,
       r.output_strategy_version_id,
       r.exposure_snapshot_id,
       (SELECT COUNT(*) FROM operator_source_selection_plans p
         WHERE p.brand_key = r.brand_key AND p.cycle_id = r.cycle_id) AS selected_count,
       (SELECT COUNT(*) FROM operator_manifest_candidate_gate_receipts g
         WHERE g.brand_key = r.brand_key AND g.cycle_id = r.cycle_id) AS gate_receipt_count,
       (SELECT COUNT(*) FROM operator_manifest_cycle_defect_receipts d
         WHERE d.brand_key = r.brand_key AND d.cycle_id = r.cycle_id) AS defect_count
     FROM operator_manifest_cycle_receipts r
     WHERE r.brand_key = ?`;
  const ordered = ` ORDER BY r.started_at DESC, r.cycle_id DESC LIMIT ?`;
  const statement = cursor
    ? db.prepare(`${baseSelect}
       AND (r.started_at < ? OR (r.started_at = ? AND r.cycle_id < ?))${ordered}`)
      .bind(brandKey, cursor.at, cursor.at, cursor.id, limit + 1)
    : db.prepare(`${baseSelect}${ordered}`).bind(brandKey, limit + 1);
  const result = await statement.all<JsonRecord>();
  const rows = result.results ?? [];
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const last = pageRows[pageRows.length - 1];

  return {
    status: 200,
    body: {
      success: true,
      contract_version: CYCLE_OBSERVABILITY_CONTRACT_VERSION,
      rail: "main",
      rows: pageRows.map((row) => ({
        id: asText(row.id),
        operation_id: asText(row.operation_id),
        receipt_version: asText(row.receipt_version),
        status: asText(row.status),
        started_at: asText(row.started_at),
        completed_at: asText(row.completed_at),
        selected_count: asNumber(row.selected_count),
        gate_receipt_count: asNumber(row.gate_receipt_count),
        defect_count: asNumber(row.defect_count),
        output_strategy_version_id: asText(row.output_strategy_version_id),
        exposure_snapshot_id: asText(row.exposure_snapshot_id),
      })),
      page_size: limit,
      has_more: hasMore,
      next_cursor: hasMore && last
        ? encodeHistoryCursor({ at: asText(last.started_at) ?? "", id: asText(last.id) ?? "" })
        : null,
    },
  };
}

async function readPromotionMap(
  db: D1Database,
  brandKey: string,
  runIds: string[],
): Promise<Map<string, JsonRecord>> {
  const uniqueRunIds = [...new Set(runIds.filter(Boolean))].slice(0, CYCLE_HISTORY_MAX_LIMIT);
  if (!uniqueRunIds.length) return new Map();
  const placeholders = uniqueRunIds.map(() => "?").join(", ");
  const result = await db.prepare(
    `SELECT
       innovation_run_id,
       previous_version,
       promoted_version,
       classification,
       tested_sha,
       promoted_at
     FROM manifest_cycle_promotion_history
     WHERE brand_key = ? AND innovation_run_id IN (${placeholders})`,
  ).bind(brandKey, ...uniqueRunIds).all<JsonRecord>();
  return new Map((result.results ?? []).map((row) => [asText(row.innovation_run_id) ?? "", row]));
}

async function readCurrentChampion(
  db: D1Database,
  brandKey: string,
): Promise<JsonRecord> {
  return await db.prepare(
    `SELECT
       semantic_version,
       selector_version,
       preselection_policy_version,
       promoted_from_innovation_run_id
     FROM manifest_cycle_champions
     WHERE brand_key = ? AND status = 'current'
     LIMIT 1`,
  ).bind(brandKey).first<JsonRecord>() ?? {};
}

async function readInnovationHistory(
  mainDb: D1Database,
  shadowDb: D1Database,
  brandKey: string,
  cursorValue: unknown,
  limitValue: unknown,
): Promise<CycleObservabilityResult> {
  const limit = normalizeHistoryLimit(limitValue);
  const cursor = decodeHistoryCursor(cursorValue);
  const baseSelect = `SELECT
       r.id,
       r.scenario,
       r.evidence_mode,
       r.variant_key,
       r.operation_root,
       r.code_sha,
       r.snapshot_hash,
       r.status,
       r.started_at,
       r.completed_at,
       r.failure_code,
       r.failure_message,
       COALESCE(r.completed_at, r.started_at, r.created_at) AS sort_at,
       b.counts_json,
       b.timings_json,
       b.production_noninterference_passed,
       b.threads_mutation_count,
              b.cleanup_orphan_count,
       b.passed AS benchmark_passed,
       b.failed_rule
     FROM manifest_shadow_runs r
     LEFT JOIN manifest_shadow_benchmark_receipts b ON b.shadow_run_id = r.id
     WHERE r.brand_key = ?`;
    const ordered = ` ORDER BY sort_at DESC, r.id DESC LIMIT ?`;
  const statement = cursor
    ? shadowDb.prepare(`${baseSelect}
       AND (COALESCE(r.completed_at, r.started_at, r.created_at) < ?
         OR (COALESCE(r.completed_at, r.started_at, r.created_at) = ? AND r.id < ?))${ordered}`)
      .bind(brandKey, cursor.at, cursor.at, cursor.id, limit + 1)
    : shadowDb.prepare(`${baseSelect}${ordered}`).bind(brandKey, limit + 1);
  const result = await statement.all<JsonRecord>();
  const rows = result.results ?? [];
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
    const promotionByRun = await readPromotionMap(
    mainDb,
    brandKey,
    pageRows.map((row) => asText(row.id) ?? ""),
  );
  const champion = await readCurrentChampion(mainDb, brandKey);
  const last = pageRows[pageRows.length - 1];

  return {
    status: 200,
    body: {
      success: true,
      contract_version: CYCLE_OBSERVABILITY_CONTRACT_VERSION,
      rail: "innovation",
                  rows: pageRows.map((row, index) => {
        const counts = asRecord(parseJson(row.counts_json, {}));
        const timings = asRecord(parseJson(row.timings_json, {}));
        const runId = asText(row.id) ?? "";
        const promotion = promotionByRun.get(runId) ?? null;
        const benchmarkPassed = asBoolean(row.benchmark_passed);
        const runStatus = asText(row.status)?.toLowerCase() ?? "unknown";
        const running = runStatus === "preparing" || runStatus === "running";
        const candidate = index === 0 && !promotion && runStatus === "completed" && benchmarkPassed !== false;
        const derivedState = promotion
          ? "promoted"
          : runStatus === "failed" || benchmarkPassed === false
            ? "failed"
            : running
              ? "current_challenger"
              : candidate
                ? "champion_candidate"
                : benchmarkPassed === true
                  ? "passed"
                  : runStatus;
        const displayState = derivedState === "promoted"
          ? `Promoted to Main ${asText(promotion?.promoted_version) ?? ""}`.trim()
          : derivedState === "failed"
            ? "Failed"
            : derivedState === "champion_candidate"
              ? "Champion Candidate"
              : derivedState === "current_challenger"
                ? "Current Challenger"
                : derivedState === "passed"
                  ? "Passed"
                  : titleCaseCycleState(derivedState);
        return {
          id: asText(row.id),
          scenario: asText(row.scenario),
          evidence_mode: asText(row.evidence_mode),
          variant_key: asText(row.variant_key),
          operation_root: asText(row.operation_root),
          tested_sha: asText(row.code_sha),
          snapshot_hash: asText(row.snapshot_hash),
                    status: derivedState,
          display_state: displayState,
          challenged_main_version: asText(promotion?.previous_version)
            ?? (running || candidate ? asText(champion.semantic_version) : null),
          promotion_destination_version: asText(promotion?.promoted_version),
          promotion_eligible: promotion ? true : candidate || benchmarkPassed === true,
          benchmark_passed: benchmarkPassed,
          accepted_count: asNumber(counts.accepted ?? counts.generated),
          target_count: asNumber(counts.target),
          gate_count: asNumber(counts.gates_executed),
          lineage_count: asNumber(counts.lineage_verified),
          source_replacement_count: asNumber(counts.source_replacements),
          total_wall_clock_ms: asNumber(timings.total_wall_clock_ms),
          production_noninterference_passed: asBoolean(row.production_noninterference_passed),
          threads_mutation_count: asNumber(row.threads_mutation_count),
          cleanup_orphan_count: asNumber(row.cleanup_orphan_count),
          failed_rule: asText(row.failed_rule),
          failure_code: asText(row.failure_code),
          failure_message: compactText(row.failure_message, 240),
          started_at: asText(row.started_at),
          completed_at: asText(row.completed_at),
        };
      }),
      page_size: limit,
      has_more: hasMore,
      next_cursor: hasMore && last
        ? encodeHistoryCursor({ at: asText(last.sort_at) ?? "", id: asText(last.id) ?? "" })
        : null,
    },
  };
}

async function readMainSummary(
  db: D1Database,
  brandKey: string,
  cycleId: string,
): Promise<CycleObservabilityResult> {
  const row = await db.prepare(
    `SELECT
       r.*,
       (SELECT COUNT(*) FROM operator_source_selection_plans p
         WHERE p.brand_key = r.brand_key AND p.cycle_id = r.cycle_id) AS selected_count,
       (SELECT COUNT(*) FROM operator_manifest_candidate_gate_receipts g
         WHERE g.brand_key = r.brand_key AND g.cycle_id = r.cycle_id) AS gate_receipt_count,
       (SELECT COUNT(*) FROM operator_manifest_candidate_gate_receipts g
         WHERE g.brand_key = r.brand_key AND g.cycle_id = r.cycle_id AND g.passed = 1) AS passed_gate_receipt_count,
       (SELECT COUNT(*) FROM operator_manifest_cycle_defect_receipts d
         WHERE d.brand_key = r.brand_key AND d.cycle_id = r.cycle_id) AS defect_count,
       (SELECT COUNT(*) FROM operator_manifest_cycle_defect_receipts d
         WHERE d.brand_key = r.brand_key AND d.cycle_id = r.cycle_id AND d.status = 'open') AS open_defect_count
     FROM operator_manifest_cycle_receipts r
     WHERE r.brand_key = ? AND r.cycle_id = ?
     LIMIT 1`,
  ).bind(brandKey, cycleId).first<JsonRecord>();
  if (!row) {
    return { status: 404, body: { success: false, error: "main_cycle_not_found", id: cycleId } };
  }

  const horizonPlan = parseBoundedJson(row.horizon_plan_json);
  const completion = parseBoundedJson(row.completion_json);
  const unresolved = parseBoundedJson(row.unresolved_issues_json);
  const selectionReceipt = await db.prepare(
    `SELECT engine_version, receipt_json
     FROM operator_source_selection_plans
     WHERE brand_key = ? AND cycle_id = ?
     ORDER BY selection_order ASC
     LIMIT 1`,
  ).bind(brandKey, cycleId).first<JsonRecord>();
  const firstReceipt = asRecord(parseJson(selectionReceipt?.receipt_json, {}));

  return {
    status: 200,
    body: {
      success: true,
      contract_version: CYCLE_OBSERVABILITY_CONTRACT_VERSION,
      rail: "main",
      id: cycleId,
      status: asText(row.status),
      operation_id: asText(row.operation_id),
      receipt_version: asText(row.receipt_version),
      started_at: asText(row.started_at),
      completed_at: asText(row.completed_at),
      selected_count: asNumber(row.selected_count),
      gate_receipt_count: asNumber(row.gate_receipt_count),
      passed_gate_receipt_count: asNumber(row.passed_gate_receipt_count),
      defect_count: asNumber(row.defect_count),
      open_defect_count: asNumber(row.open_defect_count),
      output_strategy_version_id: asText(row.output_strategy_version_id),
      exposure_snapshot_id: asText(row.exposure_snapshot_id),
      selector_version: asText(selectionReceipt?.engine_version),
      preselection_policy_version: asText(firstReceipt.preselection_policy_version),
      preselection_policy_hash: asText(firstReceipt.preselection_policy_hash),
      selector_seed: asText(firstReceipt.selector_seed),
      snapshot_hash: asText(firstReceipt.snapshot_hash),
      horizon_plan: horizonPlan,
      completion,
      unresolved_issues: unresolved,
      legacy_gaps_labeled_unavailable: true,
    },
  };
}

async function readInnovationSummary(
  mainDb: D1Database,
  shadowDb: D1Database,
  brandKey: string,
  runId: string,
): Promise<CycleObservabilityResult> {
    const row = await shadowDb.prepare(
    `SELECT
       r.*,
       s.snapshot_hash AS persisted_snapshot_hash,
       s.contract_version AS snapshot_contract_version,
       s.source_as_of,
       s.payload_bytes AS snapshot_payload_bytes,
       b.contract_versions_json,
       b.counts_json,
       b.timings_json,
       b.external_read_count,
       b.retry_count,
       b.continuation_count,
       b.payload_bytes AS benchmark_payload_bytes,
       b.production_noninterference_passed,
       b.threads_mutation_count,
              b.cleanup_orphan_count,
       b.passed AS benchmark_passed,
       b.failed_rule,
       (SELECT COUNT(*) FROM manifest_shadow_stage_events e WHERE e.shadow_run_id = r.id) AS stage_event_count
     FROM manifest_shadow_runs r
     LEFT JOIN manifest_shadow_snapshots s ON s.shadow_run_id = r.id
     LEFT JOIN manifest_shadow_benchmark_receipts b ON b.shadow_run_id = r.id
     WHERE r.brand_key = ? AND r.id = ?
     LIMIT 1`,
  ).bind(brandKey, runId).first<JsonRecord>();
    if (!row) {
    return { status: 404, body: { success: false, error: "innovation_cycle_not_found", id: runId } };
  }
    const promotion = await mainDb.prepare(
    `SELECT previous_version, promoted_version, classification, tested_sha, promoted_at
     FROM manifest_cycle_promotion_history
     WHERE brand_key = ? AND innovation_run_id = ?
     ORDER BY promoted_at DESC
     LIMIT 1`,
  ).bind(brandKey, runId).first<JsonRecord>();
  const champion = await readCurrentChampion(mainDb, brandKey);
  const benchmarkPassed = asBoolean(row.benchmark_passed);
  const runStatus = asText(row.status)?.toLowerCase() ?? "unknown";
  const derivedState = promotion
    ? "promoted"
    : runStatus === "failed" || benchmarkPassed === false
      ? "failed"
      : runStatus === "preparing" || runStatus === "running"
        ? "current_challenger"
        : runStatus === "completed" && benchmarkPassed !== false
          ? "champion_candidate"
          : runStatus;
  const promotedCurrentChampion = asText(champion.promoted_from_innovation_run_id) === runId;

  return {
    status: 200,
    body: {
      success: true,
      contract_version: CYCLE_OBSERVABILITY_CONTRACT_VERSION,
      rail: "innovation",
      id: runId,
                  status: derivedState,
      scenario: asText(row.scenario),
      evidence_mode: asText(row.evidence_mode),
      variant_key: asText(row.variant_key),
      operation_root: asText(row.operation_root),
      tested_sha: asText(row.code_sha),
      snapshot_hash: asText(row.persisted_snapshot_hash) ?? asText(row.snapshot_hash),
      snapshot_contract_version: asText(row.snapshot_contract_version),
      snapshot_source_as_of: asText(row.source_as_of),
      snapshot_payload_bytes: asNumber(row.snapshot_payload_bytes),
                  challenged_main_version: asText(promotion?.previous_version) ?? asText(champion.semantic_version),
      selector_version: promotedCurrentChampion ? asText(champion.selector_version) : null,
      preselection_policy_version: promotedCurrentChampion ? asText(champion.preselection_policy_version) : null,
      control_or_challenger: asText(row.variant_key),
      promotion_eligible: Boolean(promotion) || derivedState === "champion_candidate",
      promotion_destination_version: asText(promotion?.promoted_version),
      contract_versions: asRecord(parseJson(row.contract_versions_json, {})),
      counts: asRecord(parseJson(row.counts_json, {})),
      timings: asRecord(parseJson(row.timings_json, {})),
      external_read_count: asNumber(row.external_read_count),
      retry_count: asNumber(row.retry_count),
      continuation_count: asNumber(row.continuation_count),
      benchmark_payload_bytes: asNumber(row.benchmark_payload_bytes),
      production_noninterference_passed: asBoolean(row.production_noninterference_passed),
      threads_mutation_count: asNumber(row.threads_mutation_count),
      cleanup_orphan_count: asNumber(row.cleanup_orphan_count),
            benchmark_passed: benchmarkPassed,
      failed_rule: asText(row.failed_rule),
      stage_event_count: asNumber(row.stage_event_count),
      failure_code: asText(row.failure_code),
      failure_message: compactText(row.failure_message, 500),
      started_at: asText(row.started_at),
      completed_at: asText(row.completed_at),
    },
  };
}

function selectionFilterTokens(receipt: JsonRecord): string[] {
  const tokens = new Set<string>();
  for (const key of ["allocation_tier", "audition_state", "lifetime_label", "recent_label", "strategic_role"]) {
    const value = asText(receipt[key])?.toLowerCase().replace(/\s+/g, "_");
    if (value) tokens.add(value);
  }
  if (asText(receipt.experiment_reservation_key) || asText(receipt.reservation_key) || asText(receipt.experiment_key)) {
    tokens.add("experiment");
  }
  return [...tokens];
}

function projectSelectionRow(row: JsonRecord): JsonRecord {
  const receipt = asRecord(row.selection_receipt ?? parseJson(row.receipt_json, {}));
  const primarySource = parseJson(row.primary_source_json, {});
  const sourceText = asText(row.source_text)
    ?? asText(receipt.source_text)
    ?? extractSourceText(primarySource);
  const title = asText(row.title);
  const auditionState = asText(receipt.audition_state) ?? asText(row.lifetime_label);
  const allocationTier = asText(receipt.allocation_tier) ?? asText(receipt.strategic_role);
  const score = Number.isFinite(Number(receipt.score)) ? Number(receipt.score) : null;
  const persistedReason = extractPersistedReason(receipt);
  return {
    slot_key: asText(row.slot_key ?? row.assigned_slot_key),
    selection_order: asNumber(row.selection_order),
    source_identity_key: asText(row.source_identity_key),
    source_card_id: asText(row.source_card_id),
    source_card_family_id: asText(row.source_card_family_id ?? row.family_id),
    source_title: title,
    source_shorthand: compactText(sourceText ?? title ?? row.source_mechanism, 120),
    source_text_available: Boolean(sourceText),
    family_state: auditionState,
    audition_state: auditionState,
    allocation_tier: allocationTier,
    lifetime_label: asText(receipt.lifetime_label ?? row.lifetime_label),
    recent_label: asText(receipt.recent_label ?? row.recent_label),
    confidence_label: asText(receipt.confidence_label ?? row.confidence_label),
    score,
    engine_version: asText(row.engine_version ?? receipt.policy_version ?? receipt.engine_version),
    preselection_policy_version: asText(receipt.preselection_policy_version),
    preselection_policy_hash: asText(receipt.preselection_policy_hash),
    selector_seed: asText(receipt.selector_seed),
    snapshot_hash: asText(receipt.snapshot_hash),
    experiment_reservation_key: asText(receipt.experiment_reservation_key ?? receipt.reservation_key ?? receipt.experiment_key),
    persisted_reason: persistedReason,
    persisted_reason_status: persistedReason ? "available" : "unavailable",
    filter_tokens: selectionFilterTokens(receipt),
  };
}

function projectSelectionDetail(row: JsonRecord): JsonRecord {
  const receiptJson = typeof row.receipt_json === "string"
    ? parseBoundedJson(row.receipt_json)
    : { available: true, value: asRecord(row.selection_receipt), bytes: utf8Bytes(JSON.stringify(asRecord(row.selection_receipt))) };
  const receipt = receiptJson.available ? asRecord(receiptJson.value) : {};
  const compact = projectSelectionRow({ ...row, selection_receipt: receipt });
  const primarySource = parseJson(row.primary_source_json, {});
  const sourceText = asText(row.source_text)
    ?? asText(receipt.source_text)
    ?? extractSourceText(primarySource);
  const causalSignals = receipt.causal_signals
    ?? receipt.causal_trace
    ?? receipt.preselection_causal_trace
    ?? receipt.signal_traces
    ?? null;

  return {
    ...compact,
    source_text: sourceText,
    source_mechanism: asText(row.source_mechanism ?? receipt.source_mechanism),
    required_product: asText(row.required_product ?? receipt.required_product),
    recommended_direction: asText(row.recommended_direction ?? receipt.recommended_direction),
    persisted_reason: extractPersistedReason(receipt),
    score_factors: {
      score: Number.isFinite(Number(receipt.score)) ? Number(receipt.score) : null,
      exploration_bonus: Number.isFinite(Number(receipt.exploration_bonus)) ? Number(receipt.exploration_bonus) : null,
      recent_factor: Number.isFinite(Number(receipt.recent_factor)) ? Number(receipt.recent_factor) : null,
      shrunk_performance: Number.isFinite(Number(receipt.shrunk_performance)) ? Number(receipt.shrunk_performance) : null,
      negative_evidence_multiplier: Number.isFinite(Number(receipt.negative_evidence_multiplier))
        ? Number(receipt.negative_evidence_multiplier)
        : null,
      exposure_burden: Number.isFinite(Number(receipt.exposure_burden)) ? Number(receipt.exposure_burden) : null,
      score_multiplier: Number.isFinite(Number(receipt.score_multiplier)) ? Number(receipt.score_multiplier) : null,
      score_addend: Number.isFinite(Number(receipt.score_addend)) ? Number(receipt.score_addend) : null,
    },
    exposure_checks: {
      uses_24h: Number.isFinite(Number(receipt.uses_24h)) ? Number(receipt.uses_24h) : null,
      uses_7d: Number.isFinite(Number(receipt.uses_7d)) ? Number(receipt.uses_7d) : null,
      uses_28d: Number.isFinite(Number(receipt.uses_28d)) ? Number(receipt.uses_28d) : null,
      planned_uses: Number.isFinite(Number(receipt.planned_uses)) ? Number(receipt.planned_uses) : null,
      published_uses_72h: Number.isFinite(Number(receipt.published_uses_72h)) ? Number(receipt.published_uses_72h) : null,
      future_scheduled_uses: Number.isFinite(Number(receipt.future_scheduled_uses)) ? Number(receipt.future_scheduled_uses) : null,
      semantic_overlap_count: Number.isFinite(Number(receipt.semantic_overlap_count)) ? Number(receipt.semantic_overlap_count) : null,
      semantic_published_uses_24h: Number.isFinite(Number(receipt.semantic_published_uses_24h))
        ? Number(receipt.semantic_published_uses_24h)
        : null,
      semantic_future_scheduled_uses: Number.isFinite(Number(receipt.semantic_future_scheduled_uses))
        ? Number(receipt.semantic_future_scheduled_uses)
        : null,
      cooldown_hours: Number.isFinite(Number(receipt.cooldown_hours)) ? Number(receipt.cooldown_hours) : null,
      cooldown_relaxation: Number.isFinite(Number(receipt.cooldown_relaxation)) ? Number(receipt.cooldown_relaxation) : null,
    },
    audition: {
      state: asText(receipt.audition_state),
      passes: Number.isFinite(Number(receipt.audition_passes)) ? Number(receipt.audition_passes) : null,
      failures: Number.isFinite(Number(receipt.audition_failures)) ? Number(receipt.audition_failures) : null,
      opportunities_remaining: Number.isFinite(Number(receipt.audition_opportunities_remaining))
        ? Number(receipt.audition_opportunities_remaining)
        : null,
      graduated: asBoolean(receipt.graduated),
    },
    hard_exclusions: receipt.hard_exclusions ?? receipt.exclusions ?? null,
    causal_signals: causalSignals,
    persisted_receipt: receiptJson,
    receipt_reference: {
      scope_type: asText(row.scope_type),
      scope_id: asText(row.scope_id ?? row.cycle_id ?? row.shadow_run_id),
      receipt_id: asText(row.receipt_id ?? row.id),
    },
  };
}

function applySelectionFilter(rows: JsonRecord[], filterValue: unknown): JsonRecord[] {
  const filter = normalizeFilter(filterValue);
  if (!filter) return rows;
  return rows.filter((row) => asRecords(row.filter_tokens).some((token) => asText(token) === filter)
    || (Array.isArray(row.filter_tokens) && row.filter_tokens.some((token) => String(token) === filter)));
}

function supportedSelectionFilters(rows: JsonRecord[]): string[] {
  const supported = new Set<string>();
  for (const row of rows) {
    if (!Array.isArray(row.filter_tokens)) continue;
    for (const token of row.filter_tokens) {
      const normalized = asText(token);
      if (normalized) supported.add(normalized);
    }
  }
  return [...supported].sort();
}

async function readMainSelections(
  db: D1Database,
  brandKey: string,
  cycleId: string,
  showAll: boolean,
  filterValue: unknown,
): Promise<CycleObservabilityResult> {
  const result = await db.prepare(
    `SELECT
       p.id AS receipt_id,
       p.cycle_id,
       p.slot_key,
       p.selection_order,
       p.source_identity_key,
       p.source_card_family_id,
       p.source_card_id,
       p.engine_version,
       p.receipt_json,
       p.status,
       c.title,
       c.primary_source_json,
       c.source_mechanism,
       c.required_product,
       c.recommended_direction
     FROM operator_source_selection_plans p
     LEFT JOIN operator_source_cards c
       ON c.id = p.source_card_id AND c.brand_key = p.brand_key
     WHERE p.brand_key = ? AND p.cycle_id = ?
     ORDER BY p.selection_order ASC
     LIMIT ?`,
  ).bind(brandKey, cycleId, CYCLE_SELECTION_MAX_LIMIT).all<JsonRecord>();
  const projected = (result.results ?? []).map(projectSelectionRow);
  const filtered = applySelectionFilter(projected, filterValue);
  const visibleLimit = showAll ? 24 : CYCLE_SELECTION_PREVIEW_LIMIT;
  return {
    status: 200,
    body: {
      success: true,
      contract_version: CYCLE_OBSERVABILITY_CONTRACT_VERSION,
      rail: "main",
      id: cycleId,
      rows: filtered.slice(0, visibleLimit),
      selected_count: projected.length,
      filtered_count: filtered.length,
      returned_count: Math.min(filtered.length, visibleLimit),
      hidden_count: Math.max(0, filtered.length - visibleLimit),
      show_all: showAll,
      supported_filters: supportedSelectionFilters(projected),
      excluded_filter_available: false,
      excluded_filter_status: "unavailable_without_persisted_exclusion_rows",
    },
  };
}

async function readShadowRuntimeState(
  db: D1Database,
  brandKey: string,
  runId: string,
): Promise<{ status: "available"; state: JsonRecord } | { status: "unavailable"; reason: string; bytes: number }> {
  const row = await db.prepare(
    `SELECT s.payload_json, s.payload_bytes
     FROM manifest_shadow_snapshots s
     JOIN manifest_shadow_runs r ON r.id = s.shadow_run_id
     WHERE r.brand_key = ? AND s.shadow_run_id = ?
     LIMIT 1`,
  ).bind(brandKey, runId).first<JsonRecord>();
  if (!row?.payload_json) return { status: "unavailable", reason: "snapshot_not_found", bytes: 0 };
  const payload = String(row.payload_json);
  const bytes = asNumber(row.payload_bytes, utf8Bytes(payload));
  if (bytes > CYCLE_SHADOW_STATE_MAX_BYTES) {
    return { status: "unavailable", reason: "snapshot_state_too_large", bytes };
  }
  try {
    const snapshot = asRecord(JSON.parse(payload));
    const metadata = asRecord(snapshot.metadata);
    const state = asRecord(metadata.state);
    if (!Object.keys(state).length) return { status: "unavailable", reason: "runtime_state_missing", bytes };
    return { status: "available", state };
  } catch {
    return { status: "unavailable", reason: "snapshot_state_invalid", bytes };
  }
}

async function readInnovationSelections(
  db: D1Database,
  brandKey: string,
  runId: string,
  showAll: boolean,
  filterValue: unknown,
): Promise<CycleObservabilityResult> {
  const runtime = await readShadowRuntimeState(db, brandKey, runId);
  if (runtime.status === "unavailable") {
    return {
      status: 200,
      body: {
        success: true,
        contract_version: CYCLE_OBSERVABILITY_CONTRACT_VERSION,
        rail: "innovation",
        id: runId,
        rows: [],
        selected_count: 0,
        audit_status: "unavailable",
        unavailable_reason: runtime.reason,
        snapshot_payload_bytes: runtime.bytes,
      },
    };
  }
  const lineup = asRecords(runtime.state.locked_source_lineup);
  const projected = lineup.map((item, index) => projectSelectionRow({
    ...item,
    selection_order: index + 1,
    selection_receipt: asRecord(item.selection_receipt),
  }));
  const filtered = applySelectionFilter(projected, filterValue);
  const visibleLimit = showAll ? 24 : CYCLE_SELECTION_PREVIEW_LIMIT;
  return {
    status: 200,
    body: {
      success: true,
      contract_version: CYCLE_OBSERVABILITY_CONTRACT_VERSION,
      rail: "innovation",
      id: runId,
      rows: filtered.slice(0, visibleLimit),
      selected_count: projected.length,
      filtered_count: filtered.length,
      returned_count: Math.min(filtered.length, visibleLimit),
      hidden_count: Math.max(0, filtered.length - visibleLimit),
      show_all: showAll,
      supported_filters: supportedSelectionFilters(projected),
      audit_status: "available",
      excluded_filter_available: false,
      excluded_filter_status: "unavailable_without_persisted_exclusion_rows",
    },
  };
}

async function readMainSelectionDetail(
  db: D1Database,
  brandKey: string,
  cycleId: string,
  slotKey: string,
): Promise<CycleObservabilityResult> {
  const row = await db.prepare(
    `SELECT
       p.id AS receipt_id,
       p.cycle_id,
       p.slot_key,
       p.selection_order,
       p.source_identity_key,
       p.source_card_family_id,
       p.source_card_id,
       p.engine_version,
       p.receipt_json,
       p.status,
       c.title,
       c.primary_source_json,
       c.source_mechanism,
       c.required_product,
       c.recommended_direction
     FROM operator_source_selection_plans p
     LEFT JOIN operator_source_cards c
       ON c.id = p.source_card_id AND c.brand_key = p.brand_key
     WHERE p.brand_key = ? AND p.cycle_id = ? AND p.slot_key = ?
     LIMIT 1`,
  ).bind(brandKey, cycleId, slotKey).first<JsonRecord>();
  if (!row) {
    return {
      status: 404,
      body: { success: false, error: "source_selection_not_found", rail: "main", id: cycleId, slot_key: slotKey },
    };
  }
  return {
    status: 200,
    body: {
      success: true,
      contract_version: CYCLE_OBSERVABILITY_CONTRACT_VERSION,
      rail: "main",
      id: cycleId,
      selection: projectSelectionDetail(row),
      explanation_source: "persisted_stage_4_receipt_only",
      recalculated: false,
    },
  };
}

async function readInnovationSelectionDetail(
  db: D1Database,
  brandKey: string,
  runId: string,
  slotKey: string,
): Promise<CycleObservabilityResult> {
  const runtime = await readShadowRuntimeState(db, brandKey, runId);
  if (runtime.status === "unavailable") {
    return {
      status: 200,
      body: {
        success: true,
        contract_version: CYCLE_OBSERVABILITY_CONTRACT_VERSION,
        rail: "innovation",
        id: runId,
        selection: null,
        audit_status: "unavailable",
        unavailable_reason: runtime.reason,
        snapshot_payload_bytes: runtime.bytes,
        recalculated: false,
      },
    };
  }
  const lineup = asRecords(runtime.state.locked_source_lineup);
  const item = lineup.find((candidate) => asText(candidate.assigned_slot_key) === slotKey);
  if (!item) {
    return {
      status: 404,
      body: { success: false, error: "source_selection_not_found", rail: "innovation", id: runId, slot_key: slotKey },
    };
  }
  const index = lineup.indexOf(item);
  return {
    status: 200,
    body: {
      success: true,
      contract_version: CYCLE_OBSERVABILITY_CONTRACT_VERSION,
      rail: "innovation",
      id: runId,
      selection: projectSelectionDetail({
        ...item,
        selection_order: index + 1,
        selection_receipt: asRecord(item.selection_receipt),
        shadow_run_id: runId,
      }),
      explanation_source: "persisted_stage_4_receipt_only",
      recalculated: false,
    },
  };
}

export async function readCycleObservability(
  rawInput: CycleObservabilityInput,
): Promise<CycleObservabilityResult> {
  const input = {
    ...rawInput,
    brandKey: normalizeBrandKey(rawInput.brandKey),
    rail: normalizeRail(rawInput.rail),
  };
    try {
    if (input.action === "state") {
      return await readRailState(input.db, input.brandKey);
    }
    if (input.rail === "innovation" && !input.shadowDb) {
      return {
        status: 503,
        body: {
          success: false,
          error: "innovation_cycle_database_unavailable",
          contract_version: CYCLE_OBSERVABILITY_CONTRACT_VERSION,
        },
      };
    }
    if (input.action === "history") {
      return input.rail === "innovation"
        ? await readInnovationHistory(input.db, input.shadowDb as D1Database, input.brandKey, input.cursor, input.limit)
        : await readMainHistory(input.db, input.brandKey, input.cursor, input.limit);
    }

    const id = asText(input.id);
    if (!id || id.length > 180) {
      return { status: 400, body: { success: false, error: "cycle_id_required" } };
    }

        if (input.action === "summary") {
      return input.rail === "innovation"
        ? await readInnovationSummary(input.db, input.shadowDb as D1Database, input.brandKey, id)
        : await readMainSummary(input.db, input.brandKey, id);
    }
    if (input.action === "selections") {
      return input.rail === "innovation"
        ? await readInnovationSelections(input.shadowDb as D1Database, input.brandKey, id, Boolean(input.showAll), input.filter)
        : await readMainSelections(input.db, input.brandKey, id, Boolean(input.showAll), input.filter);
    }
    if (input.action === "selection_detail") {
      const slotKey = asText(input.slotKey);
      if (!slotKey || slotKey.length > 100) {
        return { status: 400, body: { success: false, error: "slot_key_required" } };
      }
            return input.rail === "innovation"
        ? await readInnovationSelectionDetail(input.shadowDb as D1Database, input.brandKey, id, slotKey)
        : await readMainSelectionDetail(input.db, input.brandKey, id, slotKey);
    }
    return { status: 400, body: { success: false, error: "unsupported_cycle_observability_action" } };
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return {
        status: 503,
        body: {
          success: false,
          error: "cycle_observability_schema_not_ready",
          contract_version: CYCLE_OBSERVABILITY_CONTRACT_VERSION,
        },
      };
    }
    const message = error instanceof Error ? error.message : String(error ?? "cycle_observability_failed");
    return {
      status: 500,
      body: {
        success: false,
        error: "cycle_observability_read_failed",
        detail: compactText(message, 240),
        contract_version: CYCLE_OBSERVABILITY_CONTRACT_VERSION,
      },
    };
  }
}
