import { describe, expect, it, vi } from "vitest";
import { planOperatorGateMutation } from "../src/operatorGateMutationPlanningService";

function createDependencies() {
  const normalizeText = vi.fn((value: unknown, _maxLength: number) => {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized || null;
  });
  const normalizeMachineKey = vi.fn((value: unknown, fallback = "") => {
    if (typeof value !== "string") return fallback;
    const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
    return normalized || fallback;
  });
  const normalizeStage = vi.fn((_value: unknown, fallback: string) => fallback);
  const normalizeJson = vi.fn((value: unknown, fallback: unknown) => JSON.stringify(value ?? fallback));
  const loadMemory = vi.fn(async (_memoryId: number) => null);
  const loadExistingGate = vi.fn(async (_identity: unknown) => null);
  const createGateId = vi.fn(() => "gate-new");
  return {
    normalizeText,
    normalizeMachineKey,
    normalizeStage,
    normalizeJson,
    loadMemory,
    loadExistingGate,
    createGateId,
  };
}

describe("operator gate mutation planning", () => {
  it("returns memory_not_found for an invalid promotion ID before gate lookup", async () => {
    const dependencies = createDependencies();
    const result = await planOperatorGateMutation({
      toolName: "promote_memory_to_gate",
      payload: { memory_id: "not-a-number", gate_key: "brand_gate" },
      accountBrandKey: "manifest_mental",
    }, dependencies);

    expect(result).toEqual({
      kind: "response",
      status: 404,
      body: { success: false, error: "memory_not_found" },
    });
    expect(dependencies.loadMemory).not.toHaveBeenCalled();
    expect(dependencies.loadExistingGate).not.toHaveBeenCalled();
    expect(dependencies.createGateId).not.toHaveBeenCalled();
  });

  it("returns memory_not_found when the account-scoped promotion source is absent", async () => {
    const dependencies = createDependencies();
    const result = await planOperatorGateMutation({
      toolName: "promote_memory_to_gate",
      payload: { memory_id: 77, gate_key: "brand_gate" },
      accountBrandKey: "manifest_mental",
    }, dependencies);

    expect(dependencies.loadMemory).toHaveBeenCalledWith(77);
    expect(result).toEqual({
      kind: "response",
      status: 404,
      body: { success: false, error: "memory_not_found" },
    });
    expect(dependencies.loadExistingGate).not.toHaveBeenCalled();
  });

  it("returns the exact required-fields rejection before identity lookup", async () => {
    const dependencies = createDependencies();
    const result = await planOperatorGateMutation({
      toolName: "create_or_update_gate",
      payload: { gate_key: "", description: "" },
      accountBrandKey: "manifest_mental",
    }, dependencies);

    expect(result).toEqual({
      kind: "response",
      status: 400,
      body: { success: false, error: "gate_key and description are required" },
    });
    expect(dependencies.loadExistingGate).not.toHaveBeenCalled();
    expect(dependencies.createGateId).not.toHaveBeenCalled();
  });

  it("uses promoted memory fallbacks and builds an exact update plan", async () => {
    const dependencies = createDependencies();
    dependencies.loadMemory.mockResolvedValue({
      id: 77,
      title: "Memory Gate",
      body: "Block the repeated failure.",
    });
    dependencies.loadExistingGate.mockResolvedValue({ id: "gate-existing" });

    const result = await planOperatorGateMutation({
      toolName: "promote_memory_to_gate",
      payload: {
        memory_id: "77",
        gate_key: " Repeat Guard ",
        brand_key: "global",
        lane_scope: " Main Lane ",
        content_type: " Text Post ",
        gate_type: " Hard ",
        severity: " Block ",
        evaluator: " Hybrid ",
        active: false,
        order_index: "12",
        pass_examples: ["fresh"],
        fail_examples: ["repeat"],
      },
      accountBrandKey: "manifest_mental",
    }, dependencies);

    expect(dependencies.loadExistingGate).toHaveBeenCalledWith({
      brandScope: null,
      gateKey: "repeat_guard",
      laneScope: "main_lane",
      contentTypeScope: "text_post",
    });
    expect(dependencies.createGateId).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "plan",
      mode: "update",
      gateId: "gate-existing",
      identity: {
        brandScope: null,
        gateKey: "repeat_guard",
        laneScope: "main_lane",
        contentTypeScope: "text_post",
      },
      values: {
        displayName: "Memory Gate",
        description: "Block the repeated failure.",
        stageScope: "gate_evaluation",
        gateType: "hard",
        severity: "block",
        evaluator: "hybrid",
        activeFlag: 0,
        orderIndex: 12,
        passExamplesJson: "[\"fresh\"]",
        failExamplesJson: "[\"repeat\"]",
        sourceMemoryIdsJson: "[77]",
        createdFrom: "strategy_memory",
      },
      body: {
        gate_id: "gate-existing",
        gate_key: "repeat_guard",
        active: false,
        created_from_memory_id: "77",
      },
    });
  });

  it("builds a normalized account-scoped insert plan and exact response", async () => {
    const dependencies = createDependencies();
    dependencies.normalizeStage.mockReturnValue("source_card");

    const result = await planOperatorGateMutation({
      toolName: "create_or_update_gate",
      payload: {
        gate_key: " Source Guard ",
        display_name: " Source Guard Display ",
        description: " Require source lineage. ",
        lane_scope: " Manifest ",
        content_type_scope: " Text ",
        stage_scope: "source_card",
        source_memory_ids: [3, 4],
        created_from: " Owner Feedback ",
      },
      accountBrandKey: "manifest_mental",
    }, dependencies);

    expect(dependencies.loadExistingGate).toHaveBeenCalledWith({
      brandScope: "manifest_mental",
      gateKey: "source_guard",
      laneScope: "manifest",
      contentTypeScope: "text",
    });
    expect(dependencies.createGateId).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      kind: "plan",
      mode: "insert",
      gateId: "gate-new",
      identity: {
        brandScope: "manifest_mental",
        gateKey: "source_guard",
        laneScope: "manifest",
        contentTypeScope: "text",
      },
      values: {
        displayName: "Source Guard Display",
        description: "Require source lineage.",
        stageScope: "source_card",
        gateType: "hard",
        severity: "block",
        evaluator: "hybrid",
        activeFlag: 1,
        orderIndex: 100,
        passExamplesJson: "[]",
        failExamplesJson: "[]",
        sourceMemoryIdsJson: "[3,4]",
        createdFrom: "owner_feedback",
      },
      body: {
        gate_id: "gate-new",
        gate_key: "source_guard",
        active: true,
        created_from_memory_id: null,
      },
    });
  });
});
