import { describe, expect, it } from "vitest";
import {
  buildManifestRollingHourlySlots,
  resolveManifestAutonomousClock,
} from "./src/index";

describe("Manifest autonomous clock and horizon", () => {
  it("uses Threads server time when the runtime clock is behind", () => {
    const clock = resolveManifestAutonomousClock(
      "2026-07-21T15:16:39.000Z",
      "2026-07-21T17:16:39.000Z",
      "2026-07-21T17:16:38.000Z",
      "2026-07-21T17:05:00.000Z",
    );

    expect(clock.source).toBe("threads_server");
    expect(clock.effective_now_iso).toBe("2026-07-21T17:16:39.000Z");
    expect(clock.runtime_skew_seconds).toBe(-7200);
  });

  it("uses the newest verified publication as a hard lower bound", () => {
    const clock = resolveManifestAutonomousClock(
      "2026-07-21T15:16:39.000Z",
      null,
      "2026-07-21T15:16:40.000Z",
      "2026-07-21T17:05:00.000Z",
    );

    expect(clock.source).toBe("database");
    expect(clock.latest_publication_floor_applied).toBe(true);
    expect(clock.effective_now_iso).toBe("2026-07-21T17:05:00.000Z");
  });

  it("starts the rolling horizon at the next future hour", () => {
    const slots = buildManifestRollingHourlySlots("2026-07-21", 13, 4);

    expect(slots.map((slot) => slot.key)).toEqual([
      "2026-07-21T14:00",
      "2026-07-21T15:00",
      "2026-07-21T16:00",
      "2026-07-21T17:00",
    ]);
  });
});
