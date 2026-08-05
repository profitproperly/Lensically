

type JsonRecord = Record<string, unknown>;

export const OPERATOR_MANIFEST_CYCLE_SERVICE_TOOL_NAMES = [
  "get_manifest_cycle_analysis_page",
  "get_manifest_locked_lineup_page",
    "get_manifest_cycle_receipt",
  "get_manifest_intelligence_foundation",
  "get_performance_learning",
  "get_manifest_intelligence_audit",
  "get_content_focus",
  "commit_manifest_cycle_strategy",
  "record_manifest_cycle_defect",
  "resolve_manifest_cycle_defect",
] as const;

export type OperatorManifestCycleServiceToolName = typeof OPERATOR_MANIFEST_CYCLE_SERVICE_TOOL_NAMES[number];

const OPERATOR_MANIFEST_CYCLE_SERVICE_TOOL_SET = new Set<string>(OPERATOR_MANIFEST_CYCLE_SERVICE_TOOL_NAMES);

export function isOperatorManifestCycleServiceToolName(
  toolName: string,
): toolName is OperatorManifestCycleServiceToolName {
  return OPERATOR_MANIFEST_CYCLE_SERVICE_TOOL_SET.has(toolName);
}

export type OperatorManifestCycleServiceResult = {
  status: number;
  body: JsonRecord;
};

export interface OperatorManifestCycleServiceDependencies {
  db: D1Database;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  observe(
    toolName: OperatorManifestCycleServiceToolName,
    payload: JsonRecord,
    result: JsonRecord,
  ): Promise<JsonRecord>;
    readEvidencePage(input: {
    brandKey: string;
    cycleId: string;
    snapshotId: string | null;
    pageIndex: number;
  }): Promise<JsonRecord>;
  validateLockedLineup(input: {
    brand_key: string;
    cycle_id: string;
    lineup: JsonRecord[];
  }): Promise<JsonRecord[]>;
  commitStrategy(input: JsonRecord): Promise<JsonRecord>;
  appendCycleEvent(input: JsonRecord): Promise<unknown>;
    getCycleReceipt(input: {
    brandKey: string;
    cycleId?: string | null;
    operationId?: string | null;
  }): Promise<JsonRecord | null>;
    buildCycleReceiptRead(
    receipt: JsonRecord,
    section: unknown,
    offset: unknown,
    limit: unknown,
  ): JsonRecord;
  normalizeMachineKey(value: unknown, fallback: string): string;
  readIntelligenceFoundation(brandKey: string): Promise<unknown>;
  readPerformanceLearning(brandKey: string, includePosts: boolean): Promise<unknown>;
  readIntelligenceAudit(input: {
    brandKey: string;
        section: string;
    lifetimeLabel?: string | null;
    offset: number;
    limit: number;
  }): Promise<unknown>;
  readContentFocus(brandKey: string): Promise<unknown>;
  recordCycleDefect(input: JsonRecord): Promise<unknown>;
  resolveCycleDefect(input: JsonRecord): Promise<unknown>;
  finalizeCycleReceipt(input: JsonRecord): Promise<JsonRecord>;
  readAutonomousCycle(brandKey: string, cycleId: string): Promise<JsonRecord | null>;
  sourceSelectionEngineVersion: string;
  now(): string;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asRecordList(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function parseJson(value: unknown, fallback: unknown): unknown {
  try {
    return JSON.parse(String(value ?? ""));
  } catch {
    return fallback;
  }
}

function compactLineupCue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim().slice(0, 800);
  if (["number", "boolean"].includes(typeof value)) return value;
  if (depth >= 2) {
    if (Array.isArray(value)) return { count: value.length };
    if (typeof value === "object") return { keys: Object.keys(value as JsonRecord).slice(0, 12) };
    return null;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 6).map((item) => compactLineupCue(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .slice(0, 12)
        .map(([key, nested]) => [key, compactLineupCue(nested, depth + 1)]),
    );
  }
  return null;
}

function result(body: JsonRecord, status = 200): OperatorManifestCycleServiceResult {
  return { status, body };
}

export async function handleOperatorManifestCycleServiceTool(
  input: {
    toolName: OperatorManifestCycleServiceToolName;
    brandKey: string;
    payload: JsonRecord;
  },
  dependencies: OperatorManifestCycleServiceDependencies,
): Promise<OperatorManifestCycleServiceResult> {
    const { toolName, brandKey, payload } = input;
  const { db, normalizeText } = dependencies;

  if (toolName === "get_manifest_locked_lineup_page") {
    const cycleId = normalizeText(payload.cycle_id, 160);
    const offset = Math.max(0, Math.trunc(Number(payload.offset ?? 0)));
    const limit = Math.min(12, Math.max(1, Math.trunc(Number(payload.limit ?? 12))));
    if (!cycleId) {
      return result({ success: false, error: "autonomous_cycle_id_required" }, 400);
    }
    try {
      const [countRow, rows] = await Promise.all([
        db.prepare(
          `SELECT COUNT(*) AS total
           FROM operator_source_selection_plans
           WHERE brand_key = ? AND cycle_id = ? AND status = 'locked'`,
        ).bind(brandKey, cycleId).first<JsonRecord>(),
        db.prepare(
          `SELECT
             p.slot_key,
             p.selection_order,
             p.source_identity_key,
             p.source_card_family_id,
             p.source_card_id,
                          p.engine_version,
             p.receipt_json,
             i.id AS cycle_plan_item_id,
             i.strategy_id AS cycle_strategy_id,
             c.title AS source_title,
             c.primary_source_json,
             c.source_mechanism,
             c.required_product,
             c.recommended_direction,
             c.transformation_contract_json,
             c.pass_conditions_json,
             c.fail_conditions_json,
             c.source_selection_id,
                          c.version_number AS source_card_version_number,
             f.source_type,
             f.internal_source_id,
             f.canonical_source_url,
             g.id AS owner_guidance_id,
             g.guidance_text AS owner_guidance_text,
             g.version_number AS owner_guidance_version,
             g.updated_at AS owner_guidance_updated_at,
             (
               SELECT json_object(
                 'id', r.id,
                 'scheduled_post_id', r.scheduled_post_id,
                 'owner_note', r.owner_note,
                 'model_or_previous_text', r.previous_text,
                 'owner_version', r.revised_text,
                 'change_magnitude', r.change_magnitude,
                 'became_published', r.became_published,
                 'published_post_id', r.published_post_id,
                 'created_at', r.created_at
               )
               FROM operator_scheduled_post_revisions r
               WHERE r.source_card_id = c.id
                 AND r.owner_note IS NOT NULL
                 AND trim(r.owner_note) <> ''
               ORDER BY datetime(r.created_at) DESC, r.revision_number DESC
               LIMIT 1
             ) AS latest_owner_edit_note_json
                      FROM operator_source_selection_plans p
           LEFT JOIN operator_manifest_cycle_plan_items i
             ON i.cycle_id = p.cycle_id
            AND i.brand_key = p.brand_key
            AND i.slot_key = p.slot_key
           LEFT JOIN operator_source_cards c
             ON c.id = p.source_card_id AND c.brand_key = p.brand_key
                      LEFT JOIN operator_source_card_families f
             ON f.id = p.source_card_family_id AND f.brand_key = p.brand_key
           LEFT JOIN operator_source_card_owner_guidance g
             ON g.source_card_id = c.id AND g.active = 1
           WHERE p.brand_key = ? AND p.cycle_id = ? AND p.status = 'locked'
           ORDER BY p.selection_order ASC
           LIMIT ? OFFSET ?`,
        ).bind(brandKey, cycleId, limit, offset).all<JsonRecord>(),
      ]);
      const totalCount = Math.max(0, Math.trunc(Number(countRow?.total ?? 0)));
      const items = (rows.results ?? []).map((row) => {
        const receipt = asRecord(parseJson(row.receipt_json, {}));
        return {
                    slot_key: row.slot_key,
          selection_order: Number(row.selection_order ?? 0),
          cycle_plan_item_id: row.cycle_plan_item_id ?? null,
          cycle_strategy_id: row.cycle_strategy_id ?? null,
          source_identity_key: row.source_identity_key,
          source_card_family_id: row.source_card_family_id,
          source_card_id: row.source_card_id,
          source_selection_id: row.source_selection_id ?? null,
          source_card_version_number: Number(row.source_card_version_number ?? 1),
          source_type: row.source_type ?? null,
          internal_source_id: row.internal_source_id ?? null,
          canonical_source_url: row.canonical_source_url ?? null,
          source_title: String(row.source_title ?? "").slice(0, 240),
                    primary_source: compactLineupCue(parseJson(row.primary_source_json, {})),
          owner_guidance: row.owner_guidance_id ? {
            id: row.owner_guidance_id,
            text: String(row.owner_guidance_text ?? ""),
            version_number: Number(row.owner_guidance_version ?? 1),
            updated_at: row.owner_guidance_updated_at ?? null,
            active: true,
          } : null,
                    latest_owner_edit_note: parseJson(row.latest_owner_edit_note_json, null),
          generation_direction: "Use the source card and the owner’s notes to understand the opportunity. Decide what the strongest post should be for Manifest Mental.",
          legacy_source_card_interpretation: {
            preserved_historically: true,
            active_generation_instruction: false,
          },
          selection_evidence: {
            lifetime_label: receipt.lifetime_label ?? null,
            recent_label: receipt.recent_label ?? null,
            score: receipt.score ?? null,
            cooldown_hours: receipt.cooldown_hours ?? null,
            planned_uses: receipt.planned_uses ?? null,
          },
        };
      });
      const nextOffset = offset + items.length;
      return result({
        success: true,
        cycle_identity: "Main Cycle",
        cycle_id: cycleId,
        lineup_page: {
          offset,
          limit,
          total_count: totalCount,
          returned_count: items.length,
          items,
          next_offset: nextOffset < totalCount ? nextOffset : null,
          complete: nextOffset >= totalCount,
        },
        source_substitution_allowed: false,
        next_action: nextOffset < totalCount
          ? `Call get_manifest_locked_lineup_page again with offset ${nextOffset} and the same cycle_id. Do not fetch individual source cards already represented in these pages.`
          : "Use the complete paged Main Cycle lineup to author the exact locked slots, then commit one account strategy and continue directly through bounded generation and persistence batches.",
      });
    } catch (error) {
      return result({
        success: false,
        cycle_id: cycleId,
        error: error instanceof Error ? error.message : "manifest_locked_lineup_page_read_failed",
      }, 400);
    }
  }

  if (toolName === "get_manifest_cycle_analysis_page") {
    const cycleId = normalizeText(payload.cycle_id, 160);
    const snapshotId = normalizeText(payload.snapshot_id, 160, true);
    const pageIndex = Math.max(0, Math.trunc(Number(payload.page_index ?? 0)));
    if (!cycleId) {
      return result({ success: false, error: "autonomous_cycle_id_required" }, 400);
    }
    try {
            const page = await dependencies.readEvidencePage({
        brandKey,
        cycleId,
        snapshotId,
        pageIndex,
      });
      return result(await dependencies.observe(toolName, payload, page as JsonRecord));
    } catch (error) {
      const observed = await dependencies.observe(toolName, payload, {
        success: false,
        error: error instanceof Error ? error.message : "manifest_evidence_page_read_failed",
      });
      return result(observed, 400);
    }
  }

    if (toolName === "get_manifest_cycle_receipt") {
    const cycleId = normalizeText(payload.cycle_id, 160, true);
    const operationId = normalizeText(payload.cycle_operation_id, 240, true);
    const receipt = await dependencies.getCycleReceipt({
      brandKey,
      cycleId,
      operationId,
    });
    const receiptRead = receipt
      ? dependencies.buildCycleReceiptRead(
        receipt,
        payload.receipt_section,
        payload.offset,
        payload.limit,
      )
      : null;
    const receiptSection = receiptRead ? { ...receiptRead } : null;
    if (receiptSection) delete receiptSection.summary;
    return result({
      success: true,
      brand_key: brandKey,
      available: Boolean(receipt),
      cycle_receipt: receiptRead?.summary ?? null,
      receipt_section: receiptSection,
    });
  }

    if (toolName === "get_manifest_intelligence_foundation") {
    return result({
      success: true,
      brand_key: brandKey,
      intelligence_foundation: await dependencies.readIntelligenceFoundation(brandKey),
    });
  }

  if (toolName === "get_performance_learning") {
    return result({
      success: true,
      brand_key: brandKey,
      performance_learning: await dependencies.readPerformanceLearning(
        brandKey,
        payload.include_posts === true,
      ),
    });
  }

  if (toolName === "get_manifest_intelligence_audit") {
    const requestedSection = dependencies.normalizeMachineKey(payload.audit_section, "summary");
    return result({
      success: true,
      brand_key: brandKey,
      intelligence_audit: await dependencies.readIntelligenceAudit({
        brandKey,
                section: requestedSection,
        lifetimeLabel: dependencies.normalizeMachineKey(payload.lifecycle_label, "") || null,
        offset: Number(payload.offset ?? 0),
        limit: Number(payload.limit ?? 20),
      }),
    });
  }

  if (toolName === "get_content_focus") {
    return result({
      success: true,
      brand_key: brandKey,
      content_focus: await dependencies.readContentFocus(brandKey),
    });
  }

  if (toolName === "commit_manifest_cycle_strategy") {
        const cycleId = normalizeText(payload.cycle_id, 160);
    const snapshotId = normalizeText(payload.snapshot_id, 160);
    const decisionBundleId = normalizeText(payload.decision_bundle_id, 160);
    const decisionBundleHash = normalizeText(payload.decision_bundle_hash, 128);
    if (!cycleId || !snapshotId || !decisionBundleId || !decisionBundleHash) {
      return result({ success: false, error: "cycle_snapshot_and_decision_bundle_required" }, 400);
    }

    const accountConclusion = asRecord(payload.account_conclusion);
    const contentFocus = asRecord(payload.content_focus);
    const benchmarks = asRecord(payload.benchmarks);
    const directives = asRecord(payload.directives);
    const strongestExecutions = asRecordList(payload.strongest_executions);
    const weakestExecutions = asRecordList(payload.weakest_executions);
    const experiments = asRecordList(payload.experiments);
    const risks = Array.isArray(payload.risks) ? payload.risks : [];
    const lineup = asRecordList(payload.lineup);

    if (!Object.keys(accountConclusion).length
        || !Object.keys(contentFocus).length
        || !Object.keys(benchmarks).length
        || !Object.keys(directives).length
        || !lineup.length) {
      return result({ success: false, error: "complete_cycle_strategy_required" }, 400);
    }

    try {
            const lockedSourceSelectionPlan = await dependencies.validateLockedLineup({
        brand_key: brandKey,
        cycle_id: cycleId,
        lineup,
      });
            const strategy = await dependencies.commitStrategy({
        cycleId,
        brandKey,
                snapshotId,
        decisionBundleId,
        decisionBundleHash,
        accountConclusion,
        contentFocus,
        benchmarks,
        strongestExecutions,
        weakestExecutions,
        directives,
        experiments,
        risks,
        lineup,
      });
            await dependencies.appendCycleEvent({
        cycleId,
        brandKey,
        eventKey: `cycle-strategy:${String(strategy.id ?? "locked")}`,
        eventType: "cycle_strategy_locked",
        payload: {
          strategy_id: strategy.id ?? null,
                    snapshot_id: snapshotId,
          decision_bundle_id: decisionBundleId,
          decision_bundle_hash: decisionBundleHash,
          lineup_count: lineup.length,
          source_backed_generation_only: true,
          primary_metric: "24_hour_likes",
                    source_selection_engine_version: dependencies.sourceSelectionEngineVersion,
          locked_source_selection_count: lockedSourceSelectionPlan.length,
          model_source_substitution_allowed: false,
        },
      });
      const observed = await dependencies.observe(toolName, payload, {
        success: true,
        cycle_id: cycleId,
        strategy,
        next_action: "Generate candidates only from each locked plan item's canonical source card, run every required candidate gate, and persist the first exact planned slot.",
      });
      return result(observed);
    } catch (error) {
      const observed = await dependencies.observe(toolName, payload, {
        success: false,
        cycle_id: cycleId,
        error: error instanceof Error ? error.message : "manifest_cycle_strategy_commit_failed",
      });
      return result(observed, 400);
    }
  }

  if (toolName === "record_manifest_cycle_defect") {
    const cycleId = normalizeText(payload.cycle_id, 160);
    const defectKey = normalizeText(payload.defect_key, 300);
    if (!cycleId || !defectKey) {
      return result({ success: false, error: "cycle_id_and_defect_key_required" }, 400);
    }
        const receipt = await dependencies.getCycleReceipt({ brandKey, cycleId });
    if (!receipt) {
      return result({ success: false, error: "manifest_cycle_receipt_not_found" }, 404);
    }
        const defect = await dependencies.recordCycleDefect({
      cycleId,
      brandKey,
      defectKey,
      stageNumber: Math.max(1, Math.min(7, Math.trunc(Number(payload.stage_number ?? 1)))),
      stageKey: normalizeText(payload.stage_key, 120) || "unknown_stage",
      phase: normalizeText(payload.phase, 160) || "external_failure",
      slotKey: normalizeText(payload.slot_key, 40, true),
      operationId: normalizeText(payload.operation_id, 240, true),
      errorCode: normalizeText(payload.error_code, 300) || "external_cycle_failure",
      errorMessage: normalizeText(payload.error_message, 4000) || "External cycle failure",
      impactState: normalizeText(payload.impact_state, 120) || "definitely_failed",
      retryable: payload.retryable === true,
      blocking: payload.blocking !== false,
      status: payload.status === "repairing" ? "repairing" : "open",
      reconciliation: asRecord(payload.reconciliation),
      metadata: asRecord(payload.metadata),
    });
    return result({ success: true, defect });
  }

  const cycleId = normalizeText(payload.cycle_id, 160);
  const defectKey = normalizeText(payload.defect_key, 300);
  if (!cycleId || !defectKey) {
    return result({ success: false, error: "cycle_id_and_defect_key_required" }, 400);
  }

    const defect = await dependencies.resolveCycleDefect({
    cycleId,
    brandKey,
    defectKey,
    status: payload.status === "irrecoverable_historical_gap"
      ? "irrecoverable_historical_gap"
      : "resolved",
    rootCause: normalizeText(payload.root_cause, 8000) || "Resolved with verified evidence.",
    repairCommitSha: normalizeText(payload.repair_commit_sha, 80, true),
    deployedSha: normalizeText(payload.deployed_sha, 80, true),
    reconciliation: asRecord(payload.reconciliation),
    regressionTests: asRecordList(payload.regression_tests),
    verification: asRecord(payload.verification),
  });
  const cycle = await dependencies.readAutonomousCycle(brandKey, cycleId);
  const missingSlots = cycle && Array.isArray(cycle.missing_slots) ? cycle.missing_slots : [];
  let cycleCompletion: JsonRecord | null = null;

    if (cycle && missingSlots.length === 0) {
    const receipt = await dependencies.getCycleReceipt({ brandKey, cycleId });
    if (receipt && !receipt.completed_at) {
      const scheduledPostIds = Array.isArray(cycle.scheduled_post_ids)
        ? cycle.scheduled_post_ids.map(Number)
        : [];
      const completedAt = dependencies.now();
            cycleCompletion = await dependencies.finalizeCycleReceipt({
        cycleId,
        status: "completed",
        completion: {
          completed_slot_key: null,
          completion_trigger: "last_blocking_defect_resolved",
          scheduled_post_ids: scheduledPostIds,
          scheduled_count: scheduledPostIds.length,
          remaining_missing_count: 0,
          final_post_lineage_complete: true,
          output_strategy_version_id: receipt.output_strategy_version_id ?? null,
          completed_at: completedAt,
        },
        unresolvedIssues: [],
        completedAt,
      }) as JsonRecord;
      if (cycleCompletion.completed === true) {
                await dependencies.appendCycleEvent({
          cycleId,
          brandKey,
          eventKey: "cycle-completed",
          eventType: "cycle_completed",
          payload: cycleCompletion,
        });
        await db.prepare(
          `UPDATE operator_autonomous_growth_cycles
           SET status = 'completed', updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND brand_key = ?`,
        ).bind(cycleId, brandKey).run();
      }
    }
  }

  return result({ success: true, defect, cycle_completion: cycleCompletion });
}
