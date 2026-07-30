import { describe, expect, it } from "vitest";
import {
  githubMutationRetryDelayMs,
  shouldRetryGithubMutationResponse,
} from "../src/operatorGithubMutationRetry";

describe("operator GitHub mutation retry policy", () => {
  it("retries only the transient Git tree visibility race among 422 responses", () => {
    expect(shouldRetryGithubMutationResponse(
      "/git/commits",
      { status: 422, data: { message: "Tree SHA does not exist" } },
      0,
    )).toBe(true);
    expect(shouldRetryGithubMutationResponse(
      "/git/commits",
      { status: 422, data: { message: "Validation Failed" } },
      0,
    )).toBe(false);
    expect(shouldRetryGithubMutationResponse(
      "/git/trees",
      { status: 422, data: { message: "Tree SHA does not exist" } },
      0,
    )).toBe(false);
  });

  it("preserves bounded infrastructure retries and stops after three retries", () => {
    expect(shouldRetryGithubMutationResponse("/git/commits", { status: 503, data: {} }, 0)).toBe(true);
    expect(shouldRetryGithubMutationResponse("/git/commits", { status: 503, data: {} }, 3)).toBe(false);
    expect(githubMutationRetryDelayMs(0)).toBe(300);
    expect(githubMutationRetryDelayMs(1)).toBe(600);
    expect(githubMutationRetryDelayMs(2)).toBe(1200);
    expect(githubMutationRetryDelayMs(4)).toBe(1200);
  });
});
