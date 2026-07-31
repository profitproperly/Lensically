import { describe, expect, it } from "vitest";
import { getManifestShadowBundledSeed } from "../src/operatorManifestShadowBundledSeed";

describe("operatorManifestShadowBundledSeed", () => {
  it("contains 24 unique genuine Saved Pattern sources without synthetic placeholders", () => {
    const seed = getManifestShadowBundledSeed();
    const sources = seed.sources;
    expect(sources).toHaveLength(24);

    const identities = sources.map((source) => String(source.source_identity_key ?? ""));
    expect(new Set(identities).size).toBe(24);
    expect(identities.every(Boolean)).toBe(true);

    const forbidden = /frozen isolated source|shadow validation|clean shadow candidate|shadow fixture|i bet having|i bet making/i;
    for (const source of sources) {
      const text = String(source.text ?? "");
      const metrics = source.metrics as Record<string, unknown>;
      expect(text.length).toBeGreaterThanOrEqual(8);
      expect(text).not.toMatch(forbidden);
      expect(Number(metrics?.likes ?? 0)).toBeGreaterThan(0);
    }

    const fingerprint = seed.evidence.production_fingerprint as Record<string, unknown>;
    expect(Number(fingerprint.source_count)).toBe(24);
    expect(seed.evidence.strategy).toMatchObject({
      primary_metric: "24_hour_likes",
      source_authority: "genuine_saved_patterns_imported_by_value",
    });
  });
});
