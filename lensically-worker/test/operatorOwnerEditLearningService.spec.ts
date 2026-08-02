import { describe, expect, it } from "vitest";
import {
  classifyScheduledPostRevisionMagnitude,
  normalizeOwnerNote,
} from "../src/operatorOwnerEditLearningService";

describe("owner edit learning primitives", () => {
  it("keeps whitespace-only text changes out of the learning signal", () => {
    expect(classifyScheduledPostRevisionMagnitude(
      "The person reading this is about to win.",
      "  The person reading this   is about to win.  ",
    )).toBe("untouched");
  });

  it("distinguishes light cleanup from a substantial owner rewrite", () => {
    expect(classifyScheduledPostRevisionMagnitude(
      "You are going to make $100,000 keep saying it",
      "You are going to make $100,000. Keep saying it!",
    )).toBe("light");

    expect(classifyScheduledPostRevisionMagnitude(
      "Your money is coming very soon.",
      "Is $100,000 enough to restart your life?",
    )).toBe("substantial");
  });

  it("preserves the owner's full wording while removing only outer whitespace", () => {
    const note = "  Keep this hook.\n\nThe body is too close to the source, and I need a different thought next time.  ";
    expect(normalizeOwnerNote(note)).toBe(
      "Keep this hook.\n\nThe body is too close to the source, and I need a different thought next time.",
    );
  });

  it("does not invent a note when the owner left none", () => {
    expect(normalizeOwnerNote(undefined)).toBeNull();
    expect(normalizeOwnerNote("   ")).toBeNull();
  });
});
