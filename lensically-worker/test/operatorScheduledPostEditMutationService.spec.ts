import { describe, expect, it, vi } from "vitest";
import { editOperatorScheduledPost } from "../src/operatorScheduledPostEditMutationService";

function createDependencies() {
  const normalizeText = vi.fn((value: unknown, _maxLength: number) => {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized || null;
  });
  return {
    normalizeText,
    normalizeSpoilerPhrases: vi.fn((value: unknown) => Array.isArray(value) ? value : []),
    updateScheduledPost: vi.fn(async () => ({
      success: true,
      scheduledPost: { id: 42, text: "Updated post" },
      linkedDraftsUpdated: 2,
      statusCode: 200,
    })),
    loadLinkedDraft: vi.fn(async () => null),
    parseStrategyJson: vi.fn((value: string) => JSON.parse(value) as Record<string, unknown>),
    persistInventory: vi.fn(async () => undefined),
  };
}

describe("operator scheduled-post edit mutation", () => {
  it("preserves omitted edit fields and writes exact unlinked inventory", async () => {
    const dependencies = createDependencies();

    const result = await editOperatorScheduledPost({
      payload: {},
      scheduledPostId: 42,
      brandKey: "manifest_mental",
      defaultTimezone: "America/New_York",
    }, dependencies);

    expect(dependencies.updateScheduledPost).toHaveBeenCalledWith({
      scheduledPostId: 42,
      text: undefined,
      date: undefined,
      time: undefined,
      timeZone: "America/New_York",
      spoilerAllText: undefined,
      spoilerPhrases: undefined,
    });
    expect(dependencies.loadLinkedDraft).toHaveBeenCalledWith(42);
    expect(dependencies.parseStrategyJson).not.toHaveBeenCalled();
    expect(dependencies.persistInventory).toHaveBeenCalledWith({
      brandKey: "manifest_mental",
      sourceType: "scheduled_post",
      sourceId: "42",
      text: "Updated post",
      sourceCardId: null,
      status: "scheduled",
      strategy: null,
      analysis: {
        edit_source: "edit_scheduled_post",
        linked_draft_id: null,
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      body: {
        success: true,
        scheduled_post: { id: 42, text: "Updated post" },
        linked_drafts_updated: 2,
        linked_draft_id: null,
      },
    });
  });

  it("normalizes every supplied edit and preserves linked-draft inventory lineage", async () => {
    const dependencies = createDependencies();
    dependencies.normalizeSpoilerPhrases.mockReturnValue(["hidden"]);
    dependencies.loadLinkedDraft.mockResolvedValue({
      id: "draft-42",
      source_card_id: "card-42",
      strategy_json: "{\"pillar\":\"money\"}",
    });

    const result = await editOperatorScheduledPost({
      payload: {
        text: "  Revised post  ",
        date: " 2026-07-30 ",
        time: " 14:30 ",
        timezone: " America/Chicago ",
        spoiler_all_text: true,
        spoiler_phrases: [" hidden "],
      },
      scheduledPostId: 42,
      brandKey: "manifest_mental",
      defaultTimezone: "America/New_York",
    }, dependencies);

    expect(dependencies.updateScheduledPost).toHaveBeenCalledWith({
      scheduledPostId: 42,
      text: "Revised post",
      date: "2026-07-30",
      time: "14:30",
      timeZone: "America/Chicago",
      spoilerAllText: true,
      spoilerPhrases: ["hidden"],
    });
    expect(dependencies.normalizeSpoilerPhrases).toHaveBeenCalledWith([" hidden "]);
    expect(dependencies.parseStrategyJson).toHaveBeenCalledWith("{\"pillar\":\"money\"}");
    expect(dependencies.persistInventory).toHaveBeenCalledWith({
      brandKey: "manifest_mental",
      sourceType: "scheduled_post",
      sourceId: "42",
      text: "Updated post",
      sourceCardId: "card-42",
      status: "scheduled",
      strategy: { pillar: "money" },
      analysis: {
        edit_source: "edit_scheduled_post",
        linked_draft_id: "draft-42",
      },
    });
    expect(result.body).toEqual({
      success: true,
      scheduled_post: { id: 42, text: "Updated post" },
      linked_drafts_updated: 2,
      linked_draft_id: "draft-42",
    });
  });

  it("maps an exact protected update failure without draft or inventory work", async () => {
    const dependencies = createDependencies();
    dependencies.updateScheduledPost.mockResolvedValue({
      success: false,
      scheduledPost: null,
      error: "scheduled_post_not_found",
      statusCode: 404,
    });

    const result = await editOperatorScheduledPost({
      payload: { text: "Replacement" },
      scheduledPostId: 42,
      brandKey: "manifest_mental",
      defaultTimezone: "America/New_York",
    }, dependencies);

    expect(result).toEqual({
      statusCode: 404,
      body: { success: false, error: "scheduled_post_not_found" },
    });
    expect(dependencies.loadLinkedDraft).not.toHaveBeenCalled();
    expect(dependencies.persistInventory).not.toHaveBeenCalled();
  });

  it("uses the exact update-failure fallback and zero linked-draft count", async () => {
    const dependencies = createDependencies();
    dependencies.updateScheduledPost.mockResolvedValueOnce({
      success: false,
      scheduledPost: null,
      statusCode: 409,
    });

    const failure = await editOperatorScheduledPost({
      payload: {},
      scheduledPostId: 42,
      brandKey: "manifest_mental",
      defaultTimezone: "America/New_York",
    }, dependencies);
    expect(failure).toEqual({
      statusCode: 409,
      body: { success: false, error: "scheduled_post_update_failed" },
    });

    dependencies.updateScheduledPost.mockResolvedValueOnce({
      success: true,
      scheduledPost: { id: 42, text: "Updated post" },
      statusCode: 200,
    });
    const success = await editOperatorScheduledPost({
      payload: {},
      scheduledPostId: 42,
      brandKey: "manifest_mental",
      defaultTimezone: "America/New_York",
    }, dependencies);
    expect(success.body).toEqual({
      success: true,
      scheduled_post: { id: 42, text: "Updated post" },
      linked_drafts_updated: 0,
      linked_draft_id: null,
    });
  });
});
