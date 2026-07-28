import { describe, expect, it, vi } from "vitest";
import {
  readOperatorProductionBoard,
  type OperatorProductionBoardDependencies,
} from "../src/operatorProductionBoardService";

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function createHarness() {
  const mocks = {
    listActiveItems: vi.fn(async () => [] as JsonRecord[]),
    parseJsonString: vi.fn((value: string) => JSON.parse(value) as unknown),
  };
  const dependencies: OperatorProductionBoardDependencies = {
    normalizeText,
    listActiveItems: mocks.listActiveItems,
    parseJsonString: mocks.parseJsonString,
  };
  return { mocks, dependencies };
}

describe("operatorProductionBoardService", () => {
  it("returns an empty board with exact brand identity and warnings", async () => {
    const harness = createHarness();

    expect(await readOperatorProductionBoard({
      brandKey: "manifest_mental",
      payload: {},
    }, harness.dependencies)).toEqual({
      brand_key: "manifest_mental",
      items: [],
      warnings: [],
    });
    expect(harness.mocks.listActiveItems).toHaveBeenCalledWith({
      brandKey: "manifest_mental",
      workflowSessionId: null,
    });
  });

  it("normalizes the optional workflow-session filter before querying", async () => {
    const harness = createHarness();

    await readOperatorProductionBoard({
      brandKey: "vectrix",
      payload: { workflow_session_id: " session-42 " },
    }, harness.dependencies);

    expect(harness.mocks.listActiveItems).toHaveBeenCalledWith({
      brandKey: "vectrix",
      workflowSessionId: "session-42",
    });
  });

  it("serializes stable item fields and preserves nullable values", async () => {
    const harness = createHarness();
    harness.mocks.listActiveItems.mockResolvedValue([{
      id: "item-1",
      item_type: "source_card",
      lane_key: null,
      title: "Candidate",
      body: "Body",
      priority: null,
      evidence_json: "[]",
      created_from: null,
      created_at: "2026-07-27T20:00:00Z",
      updated_at: "2026-07-27T20:05:00Z",
    }]);

    const result = await readOperatorProductionBoard({
      brandKey: "manifest_mental",
      payload: {},
    }, harness.dependencies);

    expect(result.items).toEqual([{
      id: "item-1",
      item_type: "source_card",
      lane_key: null,
      title: "Candidate",
      body: "Body",
      priority: null,
      evidence: [],
      created_from: null,
      created_at: "2026-07-27T20:00:00Z",
      updated_at: "2026-07-27T20:05:00Z",
    }]);
  });

  it("converts numeric priorities and decodes evidence payloads", async () => {
    const harness = createHarness();
    harness.mocks.listActiveItems.mockResolvedValue([{
      id: "item-2",
      item_type: "experiment",
      lane_key: "exploration",
      title: "Test",
      body: "Run it",
      priority: "7",
      evidence_json: '[{"metric":"likes","value":1200}]',
      created_from: "source-card-9",
      created_at: "created",
      updated_at: "updated",
    }]);

    const result = await readOperatorProductionBoard({ brandKey: "manifest_mental", payload: {} }, harness.dependencies);

    expect(result.items).toEqual([expect.objectContaining({
      priority: 7,
      evidence: [{ metric: "likes", value: 1200 }],
      lane_key: "exploration",
      created_from: "source-card-9",
    })]);
    expect(harness.mocks.parseJsonString).toHaveBeenCalledWith('[{"metric":"likes","value":1200}]');
  });

  it("falls back to an empty evidence array when parsing returns null", async () => {
    const harness = createHarness();
    harness.mocks.parseJsonString.mockReturnValue(null);
    harness.mocks.listActiveItems.mockResolvedValue([{
      id: "item-3",
      item_type: "note",
      title: "Note",
      body: "Text",
      evidence_json: "invalid",
    }]);

    const result = await readOperatorProductionBoard({ brandKey: "opmg_deadman", payload: {} }, harness.dependencies);

    expect(result.items).toEqual([expect.objectContaining({
      id: "item-3",
      evidence: [],
      priority: null,
      lane_key: null,
      created_from: null,
    })]);
  });
});
