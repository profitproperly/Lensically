import { describe, expect, it } from "vitest";
import { buildTextSpoilerEntities } from "../src/utils/threadsPublishService";

describe("Threads spoiler helpers", () => {
  it("builds a full-text spoiler entity", () => {
    const result = buildTextSpoilerEntities("Spoil the full thing", {
      spoilerAllText: true,
      spoilerPhrases: [],
    });

    expect(result.error).toBeUndefined();
    expect(result.entities).toEqual([{
      entity_type: "SPOILER",
      offset: 0,
      length: "Spoil the full thing".length,
    }]);
  });

  it("builds sorted phrase spoiler entities from exact matches", () => {
    const result = buildTextSpoilerEntities(
      "The ending lands hard when the reveal finally hits.",
      {
        spoilerAllText: false,
        spoilerPhrases: ["reveal", "ending"],
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.entities).toEqual([
      {
        entity_type: "SPOILER",
        offset: 4,
        length: 6,
      },
      {
        entity_type: "SPOILER",
        offset: 31,
        length: 6,
      },
    ]);
  });

  it("rejects spoiler phrases that are not present in the post text", () => {
    const result = buildTextSpoilerEntities("Only this sentence is available.", {
      spoilerAllText: false,
      spoilerPhrases: ["missing phrase"],
    });

    expect(result.entities).toEqual([]);
    expect(result.error).toContain("Spoiler phrase not found");
  });
});
