import { describe, expect, it, vi } from "vitest";
import { admitOperatorGenerationDraft } from "../src/operatorGenerationDraftAdmissionService";

function dependencies(overrides: Partial<Parameters<typeof admitOperatorGenerationDraft>[1]> = {}) {
  return {
    normalizeText: vi.fn((value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null),
    parseJson: vi.fn((value: string) => JSON.parse(value)),
    loadExistingDraft: vi.fn(async () => null),
    countExistingDrafts: vi.fn(async () => 0),
    ...overrides,
  };
}

describe("operator generation draft admission", () => {
  it("returns the exact required-fields rejection before database reads", async () => {
    const deps = dependencies();
    const result = await admitOperatorGenerationDraft({}, deps);

    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "run_id, source_card_id, and text are required",
      },
    });
    expect(deps.loadExistingDraft).not.toHaveBeenCalled();
    expect(deps.countExistingDrafts).not.toHaveBeenCalled();
  });

  it("returns the exact identical-draft reuse response with parsed gate arrays", async () => {
    const deps = dependencies({
      loadExistingDraft: vi.fn(async () => ({
        id: "draft-1",
        status: "candidate",
        showable: 1,
        gate_summary_json: JSON.stringify({
          gate_results: [{ gate: "brand" }],
          blocking_failures: [{ gate: "duplicate" }],
        }),
      })),
    });
    const result = await admitOperatorGenerationDraft({
      run_id: "run-1",
      source_card_id: "card-1",
      text: "Draft text",
    }, deps);

    expect(result).toEqual({
      kind: "response",
      body: {
        draft_id: "draft-1",
        status: "candidate",
        showable: true,
        gate_results: [{ gate: "brand" }],
        blocking_failures: [{ gate: "duplicate" }],
        reused_existing: true,
        idempotency_reason: "identical_run_draft_already_exists",
      },
    });
    expect(deps.countExistingDrafts).not.toHaveBeenCalled();
  });

  it("uses empty gate arrays when an existing draft summary is malformed", async () => {
    const deps = dependencies({
      parseJson: vi.fn(() => null),
      loadExistingDraft: vi.fn(async () => ({
        id: "draft-2",
        status: "self_rejected",
        showable: 0,
        gate_summary_json: "invalid",
      })),
    });
    const result = await admitOperatorGenerationDraft({
      run_id: "run-1",
      source_card_id: "card-1",
      text: "Draft text",
    }, deps);

    expect(result).toMatchObject({
      kind: "response",
      body: {
        draft_id: "draft-2",
        showable: false,
        gate_results: [],
        blocking_failures: [],
      },
    });
  });

  it("returns the exact saved-workflow rejection at the two-draft limit", async () => {
    const deps = dependencies({ countExistingDrafts: vi.fn(async () => 2) });
    const result = await admitOperatorGenerationDraft({
      run_id: "run-1",
      source_card_id: "card-1",
      text: "Draft text",
    }, deps);

    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: {
        success: false,
        error: "lensically_saved_workflow_required",
        existing_draft_count: 2,
        required_workflow: "Lensically account workflows are source-card controlled. A single source-card run may create one candidate plus one repair candidate unless an account has a backend-supported override. Start the next source-card loop instead of adding more drafts to the same run.",
      },
    });
  });

  it("returns normalized continuation context below the draft limit", async () => {
    const deps = dependencies({ countExistingDrafts: vi.fn(async () => 1) });
    const result = await admitOperatorGenerationDraft({
      run_id: " run-1 ",
      source_card_id: " card-1 ",
      text: " Draft text ",
    }, deps);

    expect(result).toEqual({
      kind: "continue",
      context: {
        runId: "run-1",
        sourceCardId: "card-1",
        text: "Draft text",
        existingDraftCount: 1,
      },
    });
  });
});
