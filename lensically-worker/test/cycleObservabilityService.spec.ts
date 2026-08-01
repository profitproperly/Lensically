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

describe("cycleObservabilityService", () => {
  it("parses and increments the canonical Main semantic version", () => {
    expect(parseMainCycleSemanticVersion("v1.2.3")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      text: "v1.2.3",
    });
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

  it("returns the seeded Main Champion and Standby Innovation relationship", async () => {
    const db = createDb(({ sql, method }) => {
      if (method === "first" && sql.includes("FROM manifest_cycle_rail_state")) {
        return {
          brand_key: "manifest_mental",
          main_state: "current_champion",
          innovation_state: "standby",
          current_champion_id: "manifest-main-v1.0.0",
          active_innovation_run_id: null,
          state_contract_version: "manifest-cycle-rail-state-v1",
          rail_updated_at: "2026-08-01T17:00:00Z",
          semantic_version: "v1.0.0",
          source_sha: "ec52201",
          selector_version: "source-selection-engine-v6",
          preselection_policy_version: "source-preselection-policy-v1",
          component_versions_json: "{\"mcp\":\"1.41.0\"}",
          promoted_from_innovation_run_id: "shadow-promoted",
          promotion_classification: "baseline",
          promoted_at: "2026-08-01T16:37:15Z",
        };
      }
      if (method === "first" && sql.includes("FROM manifest_cycle_innovation_runs")) {
        return {
          run_id: "shadow-promoted",
          state: "promoted",
          tested_sha: "ec52201",
          promotion_destination_version: "v1.0.0",
          passed: 1,
          promotion_eligible: 1,
        };
      }
      if (method === "all" && sql.includes("FROM manifest_cycle_promotion_history")) {
        return [{
          id: "promotion-1",
          previous_version: null,
          promoted_version: "v1.0.0",
          classification: "baseline",
          innovation_run_id: "shadow-promoted",
          tested_sha: "ec52201",
          promoted_at: "2026-08-01T16:37:15Z",
        }];
      }
      return method === "all" ? [] : null;
    });

    const result = await readCycleObservability({
      db,
      brandKey: "manifest_mental",
      action: "state",
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      success: true,
      main: {
        state: "current_champion",
        display_state: "Current Champion",
        semantic_version: "v1.0.0",
      },
      innovation: {
        state: "standby",
        display_state: "Standby",
        latest_run: {
          run_id: "shadow-promoted",
          state: "promoted",
          promotion_destination_version: "v1.0.0",
        },
      },
    });
  });

  it("bounds Main history to ten rows and returns an opaque next cursor", async () => {
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
        source_text: "Exact source text 0",
        persisted_reason: "Persisted selector reason",
        audition_state: "probation",
        allocation_tier: "exploration",
        score_factors: {
          exploration_bonus: 0.5,
        },
        exposure_checks: {
          future_scheduled_uses: 0,
          semantic_overlap_count: 0,
          cooldown_hours: 72,
        },
        persisted_receipt: {
          available: true,
        },
      },
    });
  });

  it("labels oversized Innovation snapshots unavailable instead of loading them", async () => {
    const db = createDb(({ sql, method }) => {
      if (method === "first" && sql.includes("FROM manifest_shadow_snapshots")) {
        return {
          payload_json: "{}",
          payload_bytes: 900_000,
        };
      }
      return method === "all" ? [] : null;
    });
        const result = await readCycleObservability({
      db,
      shadowDb: db,
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

    it("keeps Innovation evidence in SHADOW_DB and promotion state in Main DB", async () => {
    const mainQueries: string[] = [];
    const shadowQueries: string[] = [];
    const mainDb = createDb(({ sql, method }) => {
      mainQueries.push(sql);
      if (method === "all" && sql.includes("FROM manifest_cycle_innovation_runs")) {
        return [{
          run_id: "shadow-1",
          state: "promoted",
          promotion_destination_version: "v1.0.0",
          promotion_eligible: 1,
        }];
      }
      return method === "all" ? [] : null;
    });
    const shadowDb = createDb(({ sql, method }) => {
      shadowQueries.push(sql);
      if (method === "all" && sql.includes("FROM manifest_shadow_runs")) {
        return [{
          id: "shadow-1",
          status: "completed",
          variant_key: "challenger",
          code_sha: "exact-sha",
          snapshot_hash: "snapshot-1",
          sort_at: "2026-08-01T16:37:15Z",
          counts_json: "{\"accepted\":24,\"target\":24}",
          timings_json: "{\"total_wall_clock_ms\":1000}",
          benchmark_passed: 1,
          production_noninterference_passed: 1,
        }];
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
    expect(shadowQueries.some((sql) => sql.includes("manifest_cycle_innovation_runs"))).toBe(false);
  });

  it("fails closed when the isolated Innovation binding is unavailable", async () => {
    const db = createDb(() => null);
    const result = await readCycleObservability({
      db,
      brandKey: "manifest_mental",
      action: "history",
      rail: "innovation",
    });
    expect(result).toMatchObject({
      status: 503,
      body: { error: "innovation_cycle_database_unavailable" },
    });
  });

  it("fails closed while the migration schema is unavailable", async () => {
    const db = createDb(() => {
      throw new Error("D1_ERROR: no such table: manifest_cycle_rail_state");
    });
    const result = await readCycleObservability({
      db,
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
