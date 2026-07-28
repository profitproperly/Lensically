import { describe, expect, it, vi } from "vitest";
import {
  resolveOperatorSourceCardFamily,
  type OperatorSourceCardFamilyResolutionDependencies,
  type OperatorSourceCardFamilyResolutionInput,
} from "../src/operatorSourceCardFamilyResolutionService";

function createInput(
  overrides: Partial<OperatorSourceCardFamilyResolutionInput> = {},
): OperatorSourceCardFamilyResolutionInput {
  return {
    brandKey: "manifest_mental",
    selection: {
      source_identity_key: "threads:post-1",
      source_type: "saved_pattern",
      internal_source_id: "91",
      threads_post_id: "post-1",
      canonical_source_url: "https://threads.net/t/post-1",
    },
    sourceSelectionId: "selection-1",
    sequenceLabel: "daily_draw_batch-1_slot_4",
    createNewVersion: false,
    versionReason: null,
    newFamilyId: "family-new",
    ownerPresentation: { mode: "owner_readable" },
    ...overrides,
  };
}

function createDependencies(
  overrides: Partial<OperatorSourceCardFamilyResolutionDependencies> = {},
): OperatorSourceCardFamilyResolutionDependencies {
  return {
    loadFamily: vi.fn(async () => null),
    createFamily: vi.fn(async () => undefined),
    loadSourceCard: vi.fn(async () => null),
    linkSelectionToCurrentCard: vi.fn(async () => undefined),
    parseWorkflowSequence: vi.fn(() => 4),
    validateSourceCard: vi.fn(() => ({ can_lock: true })),
    ...overrides,
  };
}

describe("resolveOperatorSourceCardFamily", () => {
  it("creates a missing active family from exact selection identity", async () => {
    const dependencies = createDependencies();

    const result = await resolveOperatorSourceCardFamily(createInput(), dependencies);

    expect(dependencies.loadFamily).toHaveBeenCalledWith("threads:post-1");
    expect(dependencies.createFamily).toHaveBeenCalledWith({
      familyId: "family-new",
      sourceIdentityKey: "threads:post-1",
      sourceType: "saved_pattern",
      internalSourceId: "91",
      threadsPostId: "post-1",
      canonicalSourceUrl: "https://threads.net/t/post-1",
    });
    expect(dependencies.loadSourceCard).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "continue",
      context: {
        familyId: "family-new",
        versionNumber: 1,
        supersedesSourceCardId: null,
      },
    });
  });

  it("continues with an existing family that has no current card", async () => {
    const dependencies = createDependencies({
      loadFamily: vi.fn(async () => ({
        id: "family-existing",
        current_source_card_id: null,
      })),
    });

    const result = await resolveOperatorSourceCardFamily(createInput(), dependencies);

    expect(dependencies.createFamily).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "continue",
      context: {
        familyId: "family-existing",
        versionNumber: 1,
        supersedesSourceCardId: null,
      },
    });
  });

  it("reuses the current canonical card and links the selection deterministically", async () => {
    const validation = { can_lock: true, warnings: [] };
    const currentCard = {
      id: "card-current",
      version_number: 3,
      status: "locked",
    };
    const dependencies = createDependencies({
      loadFamily: vi.fn(async () => ({
        id: "family-existing",
        current_source_card_id: "card-current",
      })),
      loadSourceCard: vi.fn(async () => currentCard),
      parseWorkflowSequence: vi.fn(() => 12),
      validateSourceCard: vi.fn(() => validation),
    });

    const result = await resolveOperatorSourceCardFamily(createInput(), dependencies);

    expect(dependencies.linkSelectionToCurrentCard).toHaveBeenCalledWith({
      sourceCardId: "card-current",
      sourceSelectionId: "selection-1",
      workflowSequence: 12,
    });
    expect(result).toEqual({
      kind: "response",
      status: 200,
      body: {
        source_card_id: "card-current",
        source_selection_id: "selection-1",
        family_id: "family-existing",
        version_number: 3,
        status: "locked",
        reused_existing: true,
        reason: "canonical_source_card_reused",
        validation,
        owner_presentation: {
          mode: "owner_readable",
          account_scope: "manifest_mental",
        },
      },
    });
  });

  it("requires a version reason before replacing the current card", async () => {
    const dependencies = createDependencies({
      loadFamily: vi.fn(async () => ({
        id: "family-existing",
        current_source_card_id: "card-current",
      })),
      loadSourceCard: vi.fn(async () => ({
        id: "card-current",
        version_number: 2,
        status: "locked",
      })),
    });

    const result = await resolveOperatorSourceCardFamily(createInput({
      createNewVersion: true,
      versionReason: null,
    }), dependencies);

    expect(dependencies.linkSelectionToCurrentCard).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: { success: false, error: "version_reason_required" },
    });
  });

  it("increments the canonical version and preserves replacement identity", async () => {
    const dependencies = createDependencies({
      loadFamily: vi.fn(async () => ({
        id: "family-existing",
        current_source_card_id: "card-current",
      })),
      loadSourceCard: vi.fn(async () => ({
        id: "card-current",
        version_number: "4",
        status: "locked",
      })),
    });

    const result = await resolveOperatorSourceCardFamily(createInput({
      createNewVersion: true,
      versionReason: "new evidence",
    }), dependencies);

    expect(result).toEqual({
      kind: "continue",
      context: {
        familyId: "family-existing",
        versionNumber: 5,
        supersedesSourceCardId: "card-current",
      },
    });
  });
});
