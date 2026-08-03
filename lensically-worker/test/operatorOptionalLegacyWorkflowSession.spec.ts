import { describe, expect, it } from "vitest";
import { readOptionalLegacyWorkflowSession } from "../src/operatorOptionalLegacyWorkflowSession";

describe("optional legacy workflow session read", () => {
  it("returns null when the retired workflow table is absent", async () => {
    await expect(readOptionalLegacyWorkflowSession(async () => {
      throw new Error("D1_ERROR: no such table: operator_workflow_sessions: SQLITE_ERROR");
    })).resolves.toBeNull();
  });

  it("preserves successful sessions and unrelated database failures", async () => {
    await expect(readOptionalLegacyWorkflowSession(async () => ({ id: "session-1" })))
      .resolves.toEqual({ id: "session-1" });
    await expect(readOptionalLegacyWorkflowSession(async () => {
      throw new Error("D1_ERROR: database locked");
    })).rejects.toThrow("database locked");
  });
});
