

type JsonRecord = Record<string, unknown>;

export const OPERATOR_MANIFEST_CYCLE_SERVICE_TOOL_NAMES = [
  "get_manifest_cycle_analysis_page",
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
