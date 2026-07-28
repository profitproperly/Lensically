type JsonRecord = Record<string, unknown>;

export interface OperatorManifestSourceCardBackfillDependencies {
  manifestBrandKey: string;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  nowMillis(): number;
  callTool(toolName: string, payload: JsonRecord): Promise<JsonRecord>;
}

function httpStatus(value: unknown): number {
  return Math.trunc(Number(value ?? 200));
}

export async function createAllMissingManifestSourceCards(
  input: { brandKey: string; payload: JsonRecord },
  dependencies: OperatorManifestSourceCardBackfillDependencies,
): Promise<{ status: number; body: JsonRecord }> {
  if (input.brandKey !== dependencies.manifestBrandKey) {
    return {
      status: 400,
      body: { success: false, error: "manifest_mental_required" },
    };
  }

  const limit = Math.min(Math.max(Math.trunc(Number(input.payload.limit ?? 4)), 1), 4);
  const baseOperationId = dependencies.normalizeText(input.payload.operation_id, 160, true)
    ?? `manifest-source-card-backfill-${dependencies.nowMillis()}`;
  const prepared = await dependencies.callTool("prepare_manifest_source_card_backfill", {
    brand_key: input.brandKey,
    limit,
    proceed_confirmed: true,
    operation_id: `${baseOperationId}-prepare`,
  });
  const prepareHttpStatus = httpStatus(prepared.http_status);
  if (prepareHttpStatus >= 400 || prepared.ok === false || prepared.success === false || prepared.error) {
    return {
      status: prepareHttpStatus >= 400 ? prepareHttpStatus : 500,
      body: {
        success: false,
        status: "interrupted",
        error: prepared.error ?? "manifest_source_card_backfill_prepare_failed",
        created_count: 0,
        reused_count: 0,
        remaining_count: Number(prepared.uncarded_count ?? 0),
      },
    };
  }

  const patterns = Array.isArray(prepared.patterns)
    ? prepared.patterns.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
  let createdCount = 0;
  let reusedCount = 0;
  const cards: JsonRecord[] = [];
  for (const pattern of patterns) {
    const savedPatternId = Math.trunc(Number(pattern.saved_pattern_id ?? 0));
    if (savedPatternId <= 0) continue;
    const sourceText = String(pattern.post_text ?? "").replace(/\s+/g, " ").trim();
    const title = sourceText.slice(0, 180) || `Saved Pattern ${savedPatternId}`;
    const cardResult = await dependencies.callTool("create_source_card", {
      brand_key: input.brandKey,
      saved_pattern_id: savedPatternId,
      sequence_label: `saved_pattern_${savedPatternId}`,
      title,
      source_mechanism: `Preserve the Saved Pattern's central premise, delivery structure, tone, and payoff. Canonical source: ${sourceText.slice(0, 1400)}`,
      required_product: `Deliver the same emotional or practical audience reward as this Saved Pattern without replacing its premise: ${sourceText.slice(0, 1400)}`,
      transformation_contract: {
        must_preserve_function: [
          "Preserve the Saved Pattern's central premise and audience reward.",
          "Preserve its recognizable delivery structure, tone, and payoff.",
          "Keep the adaptation close to the source rather than inventing an adjacent concept.",
        ],
        audience_reward: "The same emotional or practical reward delivered by the Saved Pattern.",
        notes: "Use only slight wording changes. Do not invent scenes, characters, activities, settings, events, metaphors, or premises.",
      },
      forbidden_surfaces: [],
      pass_conditions: [
        "The adaptation remains grounded in the Saved Pattern's premise, structure, tone, and payoff.",
        "The same audience reward remains intact.",
        "Only slight wording changes are made and no new premise is introduced.",
      ],
      fail_conditions: [
        "The central premise or payoff is replaced.",
        "The adaptation becomes generic advice or an unrelated concept.",
        "A new scene, character, activity, setting, event, metaphor, or premise is invented.",
        "The complete source text is copied exactly.",
      ],
      recommended_direction: "Create a close, source-faithful adaptation with the same hook function, meaning, tone, and payoff.",
      proceed_confirmed: true,
      operation_id: `${baseOperationId}-pattern-${savedPatternId}`,
    });
    const cardHttpStatus = httpStatus(cardResult.http_status);
    if (cardHttpStatus >= 400 || cardResult.ok === false || cardResult.success === false || cardResult.error) {
      const remainingBeforeStop = Math.max(
        0,
        Number(prepared.uncarded_count ?? patterns.length) - createdCount - reusedCount,
      );
      return {
        status: cardHttpStatus >= 400 ? cardHttpStatus : 500,
        body: {
          success: false,
          status: "interrupted",
          error: cardResult.error ?? "manifest_source_card_creation_failed",
          failed_saved_pattern_id: savedPatternId,
          created_count: createdCount,
          reused_count: reusedCount,
          remaining_count: remainingBeforeStop,
          cards,
        },
      };
    }
    const reused = cardResult.reused_existing === true;
    if (reused) reusedCount += 1;
    else createdCount += 1;
    cards.push({
      saved_pattern_id: savedPatternId,
      source_card_id: cardResult.source_card_id ?? null,
      source_selection_id: cardResult.source_selection_id ?? null,
      status: cardResult.status ?? null,
      reused_existing: reused,
    });
  }

  const after = await dependencies.callTool("prepare_manifest_source_card_backfill", {
    brand_key: input.brandKey,
    limit: 1,
    proceed_confirmed: true,
    operation_id: `${baseOperationId}-verify`,
  });
  const remainingCount = Math.max(0, Number(after.uncarded_count ?? 0));
  const totalCount = Number(after.saved_pattern_total ?? prepared.saved_pattern_total ?? 0);
  const totalCardedAfter = Math.max(0, totalCount - remainingCount);
  return {
    status: 200,
    body: {
      success: true,
      brand_key: input.brandKey,
      status: remainingCount === 0 ? "complete" : "ready",
      saved_pattern_total: totalCount,
      already_carded_before: Number(prepared.already_carded_count ?? 0),
      processed_count: cards.length,
      created_count: createdCount,
      reused_count: reusedCount,
      total_carded_after: totalCardedAfter,
      remaining_count: remainingCount,
      batch_limit: limit,
      cards,
      continuation_required: remainingCount > 0,
      next_action: remainingCount > 0
        ? "Call create_all_missing_manifest_source_cards again with a new operation_id."
        : null,
    },
  };
}
