import { describe, expect, it } from "vitest";
import { extractOwnerBannedSavedPatternIds } from "../src/sourceFamilySelection";

describe("source family owner exclusions", () => {
  it("extracts only Saved Pattern IDs from durable owner directives", () => {
    const ids = extractOwnerBannedSavedPatternIds({
      owner_hard_bans: [
        "Never generate or schedule I bet having $250,000 removes anxiety wording.",
        "Never select Saved Patterns 6, 7, 218, 189, 25, 27, 214, 118, 205, or 190.",
      ],
    });

    expect([...ids].sort((left, right) => Number(left) - Number(right))).toEqual([
      "6", "7", "25", "27", "118", "189", "190", "205", "214", "218",
    ]);
    expect(ids.has("250000")).toBe(false);
  });

  it("supports structured Saved Pattern exclusion fields", () => {
    const ids = extractOwnerBannedSavedPatternIds({
      banned_saved_pattern_ids: [6, "214"],
      nested: { saved_pattern_id: 118 },
    });

    expect([...ids].sort((left, right) => Number(left) - Number(right))).toEqual(["6", "118", "214"]);
  });
});
