import { describe, expect, it } from "vitest";
import {
  CYCLE_SELECTION_PREVIEW_LIMIT,
  incrementMainCycleSemanticVersion,
  parseMainCycleSemanticVersion,
  readCycleObservability,
  validatePairedCycleRailState,
} from "../src/cycleObservabilityService";

type JsonRecord = Record<string, unknown>;
type QueryMethod = "first" | "all";
type QueryHandler = (input: {
  sql: string;
  bindings: unknown[];
  method: QueryMethod;
}) => JsonRecord | JsonRecord[] | null;

function createDb(handler: QueryHandler): D1Database {
  return {
    prepare(sql: string) {
      let bindings: unknown[] = [];
      const statement = {
        bind(...values: unknown[]) {
          bindings = values;
          return statement;
        },
        async first<T>() {
          return handler({ sql, bindings, method: "first" }) as T | null;
        },
        async all<T>() {
          const result = handler({ sql, bindings, method: "all" });
          return { success: true, results: (Array.isArray(result) ? result : []) as T[] };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
}

function championRow(overrides: JsonRecord = {}): JsonRecord {
  return {
    id: "manifest-main-v1.0.0",
    semantic_version: "v1.0.0",
    source_sha: "ec52201",
    selector_version: "source-selection-engine-v6",
    preselection_policy_version: "source-preselection-policy-v1",
    component_versions_json: "{\"mcp\":\"1.41.0\"}",
    promoted_from_innovation_run_id: "shadow-promoted",
    promotion_classification: "baseline",
    promoted_at: "2026-08-01T16:37:15Z",
    updated_at: "2026-08-01T16:37:15Z",
    ...overrides,
  };
}

function promotionRow(overrides: JsonRecord = {}): JsonRecord {
  return {
    id: "promotion-1",
    previous_version: null,
    promoted_version: "v1.0.0",
    classification: "baseline",
    innovation_run_id: "shadow-promoted",
    tested_sha: "ec52201",
    promoted_at: "2026-08-01T16:37:15Z",
    ...overrides,
  };
}

function shadowRun(overrides: JsonRecord = {}): JsonRecord {
  return {
    run_id: "shadow-promoted",
    id: "shadow-promoted",
    status: "completed",
    variant_key: "challenger",
    code_sha: "ec52201",
    snapshot_hash: "snapshot-1",
    started_at: "2026-08-01T16:29:58Z",
    completed_at: "2026-08-01T16:37:15Z",
    created_at: "2026-08-01T16:29:58Z",
    sort_at: "2026-08-01T16:37:15Z",
    benchmark_passed: 1,
    counts_json: "{\"accepted\":24,\"target\":24,\"gates_executed\":288,\"lineage_verified\":24}",
    timings_json: "{\"total_wall_clock_ms\":1000}",
    production_noninterference_passed: 1,
    threads_mutation_count: 0,
    cleanup_orphan_count: 0,
    ...overrides,
  };
}

function createMainStateDb(promotions: JsonRecord[] = [promotionRow()]): D1Database {
  return createDb(({ sql, method }) => {
    if (method === "first" && sql.includes("FROM manifest_cycle_champions")) return championRow();
    if (method === "all" && sql.includes("FROM manifest_cycle_promotion_history")) return promotions;
    return method === "all" ? [] : null;
  });
}

function createShadowStateDb(run: JsonRecord | null): D1Database {
  return createDb(({ sql, method }) => {
    if (method === "first" && sql.includes("FROM manifest_shadow_runs")) return run;
    return method === "all" ? [] : null;
  });
}

describe("cycleObservabilityService", () => {
  it("parses and increments the canonical Main semantic version", () => {
    expect(parseMainCycleSemanticVersion("v1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, text: "v1.2.3" });
    expect(incrementMainCycleSemanticVersion("v1.2.3", "patch")).toBe("v1.2.4");
    expect(incrementMainCycleSemanticVersion("v1.2.3", "minor")).toBe("v1.3.0");
    expect(incrementMainCycleSemanticVersion("v1.2.3", "major")).toBe("v2.0.0");
    expect(() => parseMainCycleSemanticVersion("1.2.3")).toThrow("main_cycle_semantic_version_invalid");
  });

  it("accepts only the three canonical paired rail states", () => {
    expect(() => validatePairedCycleRailState({
      mainState: "current_champion",
      innovationState: "standby",
      activeInnovationRunId: null,
    })).not.toThrow();
    expect(() => validatePairedCycleRailState({
      mainState: "incumbent_behind_challenger",
      innovationState: "current_challenger",
      activeInnovationRunId: "shadow-active",
    })).not.toThrow();
    expect(() => validatePairedCycleRailState({
      mainState: "incumbent_awaiting_promotion",
      innovationState: "champion_candidate",
      activeInnovationRunId: "shadow-passed",
    })).not.toThrow();
    expect(() => validatePairedCycleRailState({
      mainState: "current_champion",
      innovationState: "current_challenger",
      activeInnovationRunId: "shadow-invalid",
    })).toThrow("manifest_cycle_rail_state_pair_invalid");
  });

  it("derives Current Champion and Standby from a promoted isolated run", async () => {
    const result = await readCycleObservability({
      db: createMainStateDb(),
      shadowDb: createShadowStateDb(shadowRun()),
      brandKey: "manifest_mental",
      action: "state",
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      main: { state: "current_champion", display_state: "Current Champion", semantic_version: "v1.0.0" },
      innovation: {
        state: "standby",
        display_state: "Standby",
        active_run: null,
        latest_run: {
          run_id: "shadow-promoted",
          state: "promoted",
          promotion_destination_version: "v1.0.0",
        },
      },
    });
  });

  it("derives Behind Challenger and Current Challenger while the latest isolated run is active", async () => {
    const result = await readCycleObservability({
      db: createMainStateDb([]),
      shadowDb: createShadowStateDb(shadowRun({
        run_id: "shadow-active",
        id: "shadow-active",
        status: "running",
        completed_at: null,
        benchmark_passed: null,
      })),
      brandKey: "manifest_mental",
      action: "state",
    });
    expect(result.body).toMatchObject({
      main: { state: "incumbent_behind_challenger", display_state: "Incumbent — Behind Challenger" },
      innovation: {
        state: "current_challenger",
        display_state: "Current Challenger",
        active_run: { run_id: "shadow-active", state: "current_challenger" },
      },
    });
  });

  it("derives Awaiting Promotion and Champion Candidate for the latest unpromoted passing run", async () => {
    const result = await readCycleObservability({
      db: createMainStateDb([]),
      shadowDb: createShadowStateDb(shadowRun({
        run_id: "shadow-candidate",
        id: "shadow-candidate",
      })),
      brandKey: "manifest_mental",
      action: "state",
    });
    expect(result.body).toMatchObject({
      main: { state: "incumbent_awaiting_promotion", display_state: "Incumbent — Awaiting Promotion" },
      innovation: {
        state: "champion_candidate",
        display_state: "Champion Candidate",
        active_run: { run_id: "shadow-candidate", state: "champion_candidate", promotion_eligible: true },
      },
    });
  });

  it("keeps Main Champion current when the latest isolated run fails", async () => {
    const result = await readCycleObservability({
      db: createMainStateDb([]),
      shadowDb: createShadowStateDb(shadowRun({
        run_id: "shadow-failed",
        id: "shadow-failed",
        status: "failed",
        benchmark_passed: 0,
        failed_rule: "gate_failed",
      })),
      brandKey: "manifest_mental",
      action: "state",
    });
    expect(result.body).toMatchObject({
      main: { state: "current_champion" },
      innovation: {
        state: "standby",
        active_run: null,
        latest_run: { run_id: "shadow-failed", state: "failed", failed_rule: "gate_failed" },
      },
    });
  });

  it("bounds Main history to ten rows and returns an opaque cursor", async () => {
    const rows = Array.from({ length: 11 }, (_, index) => ({
      id: `cycle-${String(20 - index).padStart(2, "0")}`,
      operation_id: `operation-${index}`,
      receipt_version: "manifest-cycle-receipt-v3",
      status: "completed",
      started_at: `2026-08-${String(20 - index).padStart(2, "0")}T12:00:00Z`,
      completed_at: `2026-08-${String(20 - index).padStart(2, "0")}T12:10:00Z`,
      selected_count: 24,
      gate_receipt_count: 24,
      defect_count: 0,
    }));
    const db = createDb(({ sql, method }) => {
      if (method === "all" && sql.includes("FROM operator_manifest_cycle_receipts")) return rows;
      return method === "all" ? [] : null;
    });
    const result = await readCycleObservability({
      db,
      brandKey: "manifest_mental",
      action: "history",
      rail: "main",
      limit: 99,
    });
    expect(result.status).toBe(200);
    expect((result.body.rows as unknown[]).length).toBe(10);
    expect(result.body.page_size).toBe(10);
    expect(result.body.has_more).toBe(true);
    expect(typeof result.body.next_cursor).toBe("string");
  });

  it("keeps Innovation history in SHADOW_DB and enriches promotion only from Main history", async () => {
    const mainQueries: string[] = [];
    const shadowQueries: string[] = [];
    const mainDb = createDb(({ sql, method }) => {
      mainQueries.push(sql);
      if (method === "all" && sql.includes("FROM manifest_cycle_promotion_history")) {
        return [promotionRow({ innovation_run_id: "shadow-1" })];
      }
      if (method === "first" && sql.includes("FROM manifest_cycle_champions")) return championRow();
      return method === "all" ? [] : null;
    });
    const shadowDb = createDb(({ sql, method }) => {
      shadowQueries.push(sql);
      if (method === "all" && sql.includes("FROM manifest_shadow_runs")) {
        return [shadowRun({ id: "shadow-1", run_id: "shadow-1" })];
      }
      return method === "all" ? [] : null;
    });

    const result = await readCycleObservability({
      db: mainDb,
      shadowDb,
      brandKey: "manifest_mental",
      action: "history",
      rail: "innovation",
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      rows: [{
        id: "shadow-1",
        status: "promoted",
        display_state: "Promoted to Main v1.0.0",
        promotion_destination_version: "v1.0.0",
      }],
    });
    expect(mainQueries.some((sql) => sql.includes("manifest_shadow_"))).toBe(false);
    expect(shadowQueries.some((sql) => sql.includes("manifest_cycle_"))).toBe(false);
    expect(mainQueries.some((sql) => sql.includes("manifest_cycle_innovation_runs"))).toBe(false);
  });

  it("returns six compact source rows first and exact persisted detail on demand", async () => {
    const selectionRows = Array.from({ length: 8 }, (_, index) => ({
      receipt_id: `receipt-${index}`,
      cycle_id: "cycle-1",
      slot_key: `2026-08-01T${String(index).padStart(2, "0")}:00`,
      selection_order: index + 1,
      source_identity_key: `threads:source-${index}`,
      source_card_family_id: `family-${index}`,
      source_card_id: `card-${index}`,
      engine_version: "source-selection-engine-v6",
      receipt_json: JSON.stringify({
        audition_state: index === 0 ? "probation" : "untested",
        allocation_tier: "exploration",
        score: 1.5 + index,
        exploration_bonus: 0.5,
        future_scheduled_uses: 0,
        semantic_overlap_count: 0,
        cooldown_hours: 72,
        preselection_policy_version: "source-preselection-policy-v1",
        preselection_policy_hash: "policy:hash",
        selection_reason: "Persisted selector reason",
      }),
      title: `Source ${index}`,
      primary_source_json: JSON.stringify({ source_text: `Exact source text ${index}` }),
      source_mechanism: "Preserve the source mechanism",
      required_product: "Deliver the same audience reward",
            recommended_direction: "Close adaptation",
      scheduled_post_text: `Scheduled output ${index}`,
      scheduled_generation_mode: "controlled_variation",
      scheduled_strategic_purpose: "Test exact source adaptation",
      scheduled_post_id: 800 + index,
      scheduled_post_status: "scheduled",
    }));
    const db = createDb(({ sql, method, bindings }) => {
      if (method === "all" && sql.includes("FROM operator_source_selection_plans")) return selectionRows;
      if (method === "first" && sql.includes("FROM operator_source_selection_plans")) {
        return selectionRows.find((row) => row.slot_key === bindings[2]) ?? null;
      }
      return method === "all" ? [] : null;
    });

    const preview = await readCycleObservability({
      db,
      brandKey: "manifest_mental",
      action: "selections",
      rail: "main",
      id: "cycle-1",
    });
        expect((preview.body.rows as unknown[]).length).toBe(CYCLE_SELECTION_PREVIEW_LIMIT);
    expect(preview.body.hidden_count).toBe(2);
    expect(preview.body.excluded_filter_available).toBe(false);
    expect((preview.body.rows as JsonRecord[])[0]).toMatchObject({
      scheduled_post_text: "Scheduled output 0",
      scheduled_generation_mode: "controlled_variation",
      scheduled_post_id: 800,
      scheduled_post_status: "scheduled",
      source_history_scope: "exact_source_identity",
      source_shorthand: "Exact source text 0",
    });

    const detail = await readCycleObservability({
      db,
      brandKey: "manifest_mental",
      action: "selection_detail",
      rail: "main",
      id: "cycle-1",
      slotKey: selectionRows[0].slot_key,
    });
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      explanation_source: "persisted_stage_4_receipt_only",
      recalculated: false,
      selection: {
                scheduled_post_text: "Scheduled output 0",
        scheduled_generation_mode: "controlled_variation",
        scheduled_strategic_purpose: "Test exact source adaptation",
        scheduled_post_id: 800,
        scheduled_post_status: "scheduled",
        source_history_scope: "exact_source_identity",
        source_text: "Exact source text 0",
        persisted_reason: "Persisted selector reason",
        audition_state: "probation",
        allocation_tier: "exploration",
        score_factors: { exploration_bonus: 0.5 },
        exposure_checks: {
          future_scheduled_uses: 0,
          semantic_overlap_count: 0,
          cooldown_hours: 72,
        },
        persisted_receipt: { available: true },
      },
    });
  });

  it("labels oversized Innovation snapshots unavailable instead of loading them", async () => {
    const shadowDb = createDb(({ sql, method }) => {
      if (method === "first" && sql.includes("FROM manifest_shadow_snapshots")) {
        return { payload_json: "{}", payload_bytes: 900_000 };
      }
      return method === "all" ? [] : null;
    });
    const result = await readCycleObservability({
      db: createDb(() => null),
      shadowDb,
      brandKey: "manifest_mental",
      action: "selections",
      rail: "innovation",
      id: "shadow-large",
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      audit_status: "unavailable",
      unavailable_reason: "snapshot_state_too_large",
      snapshot_payload_bytes: 900000,
      rows: [],
    });
  });

  it("fails closed when isolated Innovation evidence is unavailable", async () => {
    const db = createDb(() => null);
    const history = await readCycleObservability({
      db,
      brandKey: "manifest_mental",
      action: "history",
      rail: "innovation",
    });
    const state = await readCycleObservability({
      db,
      brandKey: "manifest_mental",
      action: "state",
    });
    expect(history).toMatchObject({
      status: 503,
      body: { error: "innovation_cycle_database_unavailable" },
    });
    expect(state).toMatchObject({
      status: 503,
      body: { error: "innovation_cycle_database_unavailable" },
    });
  });

  it("fails closed while the Champion registry migration is unavailable", async () => {
    const mainDb = createDb(() => {
      throw new Error("D1_ERROR: no such table: manifest_cycle_champions");
    });
    const result = await readCycleObservability({
      db: mainDb,
      shadowDb: createShadowStateDb(null),
      brandKey: "manifest_mental",
      action: "state",
    });
    expect(result).toEqual({
      status: 503,
      body: {
        success: false,
        error: "cycle_observability_schema_not_ready",
        contract_version: "manifest-cycle-observability-v1",
      },
    });
  });
});
