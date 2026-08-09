import { describe, expect, it, vi } from "vitest";
import { readOperatorScheduledPostList } from "../src/operatorScheduledPostListReadService";

function createDependencies() {
  return {
    normalizeText: vi.fn((value: unknown, _maxLength: number) => {
      if (typeof value !== "string") return null;
      const normalized = value.trim();
      return normalized || null;
    }),
    defaultTimezone: "America/New_York",
    isValidIsoDate: vi.fn((value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
    listForLocalDate: vi.fn(async () => [
      { id: 11, scheduled_time: "2026-07-30T13:00:00.000Z" },
      { id: 12, scheduled_time: "2026-07-30T14:00:00.000Z" },
    ]),
    listDeletions: vi.fn(async () => [
      { scheduled_post_id: 10, post_text: "deleted text", learning_effect: "unobserved" },
    ]),
  };
}

describe("operator scheduled-post list read", () => {
  it("retrieves one valid local date with the normalized explicit timezone", async () => {
    const dependencies = createDependencies();
    const result = await readOperatorScheduledPostList({
      payload: {
        date: " 2026-07-30 ",
        timezone: " America/Chicago ",
      },
    }, dependencies);

    expect(dependencies.normalizeText).toHaveBeenNthCalledWith(1, " 2026-07-30 ", 20, true);
    expect(dependencies.normalizeText).toHaveBeenNthCalledWith(2, " America/Chicago ", 100, true);
    expect(dependencies.isValidIsoDate).toHaveBeenCalledWith("2026-07-30");
    expect(dependencies.listForLocalDate).toHaveBeenCalledWith({ date: "2026-07-30", timezone: "America/Chicago" });
    expect(dependencies.listDeletions).toHaveBeenCalledWith({ date: "2026-07-30", timezone: "America/Chicago" });
    expect(result.returned_count).toBe(2);
    expect(result.deletion_count).toBe(1);
    expect(result.deletion_history_exposed_to_model).toBe(true);
    expect(result.deletion_history_learning_effect).toBe("none");
  });

  it("uses the workspace timezone and returns an empty exact response when date is absent", async () => {
    const dependencies = createDependencies();
    const result = await readOperatorScheduledPostList({ payload: {} }, dependencies);

    expect(dependencies.normalizeText).toHaveBeenNthCalledWith(1, undefined, 20, true);
    expect(dependencies.normalizeText).toHaveBeenNthCalledWith(2, undefined, 100, true);
    expect(dependencies.isValidIsoDate).not.toHaveBeenCalled();
    expect(dependencies.listForLocalDate).not.toHaveBeenCalled();
    expect(dependencies.listDeletions).toHaveBeenCalledWith({ date: null, timezone: "America/New_York" });
    expect(result.items).toEqual([]);
    expect(result.deletion_count).toBe(1);
  });

  it("suppresses retrieval for an invalid normalized date", async () => {
    const dependencies = createDependencies();
    const result = await readOperatorScheduledPostList({ payload: { date: "July 30, 2026", timezone: "" } }, dependencies);

    expect(dependencies.isValidIsoDate).toHaveBeenCalledWith("July 30, 2026");
    expect(dependencies.listForLocalDate).not.toHaveBeenCalled();
    expect(dependencies.listDeletions).toHaveBeenCalledWith({ date: null, timezone: "America/New_York" });
    expect(result.items).toEqual([]);
  });

  it("exposes deletion receipts without creating a learning effect", async () => {
    const dependencies = createDependencies();
    const result = await readOperatorScheduledPostList({ payload: { date: "2026-07-30" } }, dependencies);

    expect(result.deletions).toEqual([
      { scheduled_post_id: 10, post_text: "deleted text", learning_effect: "unobserved" },
    ]);
    expect(result.deletion_history_exposed_to_model).toBe(true);
    expect(result.deletion_history_learning_effect).toBe("none");
  });
});
