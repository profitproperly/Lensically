import { describe, expect, it } from "vitest";
import { resolveActionBoundWinningPaths } from "../src/mandatoryExecutionMap";

describe("mandatory execution map", () => {
  it("binds the neutral case-step prevention to opaque Step-4 identities", () => {
    const prevention = resolveActionBoundWinningPaths("advanceHardeningIncident")
      .find((candidate) => candidate.id === "neutral_case_step_contract");

    expect(prevention).toBeDefined();
    expect(prevention?.action_binding?.tool_names).toContain("advanceHardeningIncident");
    expect(prevention?.winning_path.procedure).toContain(
      "Derive stable opaque Step-4 action identities exec_02_00 through exec_02_10 from the immutable prepared stage so consecutive transitions remain client-distinguishable without exposing hardening semantics.",
    );
  });
});
