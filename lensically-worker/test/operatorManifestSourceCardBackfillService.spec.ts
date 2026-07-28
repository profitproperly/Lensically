import { describe, expect, it, vi } from "vitest";
import {
  createAllMissingManifestSourceCards,
  type OperatorManifestSourceCardBackfillDependencies,
} from "../src/operatorManifestSourceCardBackfillService";

type JsonRecord = Record<string, unknown>;

function createDependencies(
  callTool: OperatorManifestSourceCardBackfillDependencies["callTool"],
): OperatorManifestSourceCardBackfillDependencies {
  return {
    manifestBrandKey: "manifest_mental",
    normalizeText: (value) => {
      const text = String(value ?? "").trim();
      return text || null;
    },
    nowMillis: () => 123456,
    callTool,
  };
}

describe("createAllMissingManifestSourceCards", () => {
  it("rejects non-Manifest brands before any internal tool call", async () => {
    const callTool = vi.fn(async () => ({}));
    const result = await createAllMissingManifestSourceCards({
      brandKey: "vectrix",
      payload: {},
    }, createDependencies(callTool));

    expect(result).toEqual({
      status: 400,
      body: { success: false, error: "manifest_mental_required" },
    });
    expect(callTool).not.toHaveBeenCalled();
  });

  it("maps prepare failures without starting source-card creation", async () => {
    const callTool = vi.fn(async () => ({
      http_status: 409,
      error: "prepare_conflict",
      uncarded_count: "7",
    }));
    const result = await createAllMissingManifestSourceCards({
      brandKey: "manifest_mental",
      payload: { limit: 99, operation_id: "backfill-1" },
    }, createDependencies(callTool));

    expect(callTool).toHaveBeenCalledTimes(1);
    expect(callTool).toHaveBeenCalledWith("prepare_manifest_source_card_backfill", {
      brand_key: "manifest_mental",
      limit: 4,
      proceed_confirmed: true,
      operation_id: "backfill-1-prepare",
    });
    expect(result).toEqual({
      status: 409,
      body: {
        success: false,
        status: "interrupted",
        error: "prepare_conflict",
        created_count: 0,
        reused_count: 0,
        remaining_count: 7,
      },
    });
  });

  it("constructs source-faithful payloads sequentially and returns ready continuation state", async () => {
    const calls: Array<{ toolName: string; payload: JsonRecord }> = [];
    const callTool = vi.fn(async (toolName: string, payload: JsonRecord) => {
      calls.push({ toolName, payload });
      if (calls.length === 1) {
        return {
          saved_pattern_total: 8,
          already_carded_count: 4,
          uncarded_count: 4,
          patterns: [
            null,
            { saved_pattern_id: 0, post_text: "skip" },
            { saved_pattern_id: 11, post_text: "  Keep   the same   promise.  " },
            { saved_pattern_id: 12, post_text: "" },
          ],
        };
      }
      if (toolName === "create_source_card" && payload.saved_pattern_id === 11) {
        return {
          source_card_id: "card-11",
          source_selection_id: "selection-11",
          status: "draft",
          reused_existing: false,
        };
      }
      if (toolName === "create_source_card" && payload.saved_pattern_id === 12) {
        return {
          source_card_id: "card-12",
          source_selection_id: "selection-12",
          status: "locked",
          reused_existing: true,
        };
      }
      return {
        saved_pattern_total: 8,
        uncarded_count: 2,
      };
    });

    const result = await createAllMissingManifestSourceCards({
      brandKey: "manifest_mental",
      payload: { limit: 3 },
    }, createDependencies(callTool));

    expect(calls.map((call) => call.toolName)).toEqual([
      "prepare_manifest_source_card_backfill",
      "create_source_card",
      "create_source_card",
      "prepare_manifest_source_card_backfill",
    ]);
    expect(calls[0].payload).toMatchObject({
      limit: 3,
      operation_id: "manifest-source-card-backfill-123456-prepare",
    });
    expect(calls[1].payload).toMatchObject({
      saved_pattern_id: 11,
      sequence_label: "saved_pattern_11",
      title: "Keep the same promise.",
      source_mechanism: "Preserve the Saved Pattern's central premise, delivery structure, tone, and payoff. Canonical source: Keep the same promise.",
      required_product: "Deliver the same emotional or practical audience reward as this Saved Pattern without replacing its premise: Keep the same promise.",
      operation_id: "manifest-source-card-backfill-123456-pattern-11",
    });
    expect(calls[1].payload.transformation_contract).toMatchObject({
      audience_reward: "The same emotional or practical reward delivered by the Saved Pattern.",
    });
    expect(calls[2].payload).toMatchObject({
      saved_pattern_id: 12,
      title: "Saved Pattern 12",
      operation_id: "manifest-source-card-backfill-123456-pattern-12",
    });
    expect(calls[3].payload).toEqual({
      brand_key: "manifest_mental",
      limit: 1,
      proceed_confirmed: true,
      operation_id: "manifest-source-card-backfill-123456-verify",
    });
    expect(result).toEqual({
      status: 200,
      body: {
        success: true,
        brand_key: "manifest_mental",
        status: "ready",
        saved_pattern_total: 8,
        already_carded_before: 4,
        processed_count: 2,
        created_count: 1,
        reused_count: 1,
        total_carded_after: 6,
        remaining_count: 2,
        batch_limit: 3,
        cards: [
          {
            saved_pattern_id: 11,
            source_card_id: "card-11",
            source_selection_id: "selection-11",
            status: "draft",
            reused_existing: false,
          },
          {
            saved_pattern_id: 12,
            source_card_id: "card-12",
            source_selection_id: "selection-12",
            status: "locked",
            reused_existing: true,
          },
        ],
        continuation_required: true,
        next_action: "Call create_all_missing_manifest_source_cards again with a new operation_id.",
      },
    });
  });

  it("stops on the first source-card failure with exact partial evidence", async () => {
    let callNumber = 0;
    const callTool = vi.fn(async (toolName: string, payload: JsonRecord) => {
      callNumber += 1;
      if (callNumber === 1) {
        return {
          uncarded_count: 3,
          patterns: [
            { saved_pattern_id: 21, post_text: "First" },
            { saved_pattern_id: 22, post_text: "Second" },
            { saved_pattern_id: 23, post_text: "Third" },
          ],
        };
      }
      if (toolName === "create_source_card" && payload.saved_pattern_id === 21) {
        return {
          source_card_id: "card-21",
          source_selection_id: "selection-21",
          reused_existing: false,
        };
      }
      return {
        http_status: 422,
        error: "source_card_invalid",
      };
    });

    const result = await createAllMissingManifestSourceCards({
      brandKey: "manifest_mental",
      payload: { operation_id: "backfill-2" },
    }, createDependencies(callTool));

    expect(callTool).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      status: 422,
      body: {
        success: false,
        status: "interrupted",
        error: "source_card_invalid",
        failed_saved_pattern_id: 22,
        created_count: 1,
        reused_count: 0,
        remaining_count: 2,
        cards: [{
          saved_pattern_id: 21,
          source_card_id: "card-21",
          source_selection_id: "selection-21",
          status: null,
          reused_existing: false,
        }],
      },
    });
  });

  it("returns complete state when verification finds no remaining patterns", async () => {
    let callNumber = 0;
    const callTool = vi.fn(async () => {
      callNumber += 1;
      return callNumber === 1
        ? { saved_pattern_total: 5, already_carded_count: 5, uncarded_count: 0, patterns: [] }
        : { saved_pattern_total: 5, uncarded_count: 0 };
    });

    const result = await createAllMissingManifestSourceCards({
      brandKey: "manifest_mental",
      payload: {},
    }, createDependencies(callTool));

    expect(result.body).toMatchObject({
      status: "complete",
      saved_pattern_total: 5,
      total_carded_after: 5,
      remaining_count: 0,
      continuation_required: false,
      next_action: null,
    });
  });
});
