import { describe, expect, it } from "vitest";
import {
    classifyGithubWorkflowRunLookup404,
    githubMutationRetryDelayMs,
  isAmbiguousGithubWorkflowDispatchStatus,
  isTransientGithubWorkflowReadStatus,
  shouldRetryGithubMutationResponse,
  shouldRetryGithubReadResponse,
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

    it("classifies ambiguous GitHub workflow dispatch transport statuses without blind retries", () => {
    for (const status of [502, 503, 504, 520, 521, 522, 523, 524]) {
      expect(isAmbiguousGithubWorkflowDispatchStatus(status)).toBe(true);
    }
    for (const status of [400, 401, 403, 404, 422, 500, 525, 526]) {
      expect(isAmbiguousGithubWorkflowDispatchStatus(status)).toBe(false);
    }
  });

    it("classifies transient GitHub workflow read transport statuses for list reconciliation", () => {
    for (const status of [502, 503, 504, 520, 521, 522, 523, 524]) {
      expect(isTransientGithubWorkflowReadStatus(status)).toBe(true);
    }
    for (const status of [400, 401, 403, 404, 422, 500, 525, 526]) {
      expect(isTransientGithubWorkflowReadStatus(status)).toBe(false);
    }
  });

  it("classifies workflow-run 404s from a reconciled authoritative list", () => {
    expect(classifyGithubWorkflowRunLookup404(123, [125, 123, 120])).toEqual({
      error: "workflow_run_temporarily_unreadable",
      retryable: true,
      requested_run_listed: true,
      required_next_action: "Retry the same listed run ID after a short delay; do not infer workflow failure from the temporary detail-endpoint 404.",
    });
    expect(classifyGithubWorkflowRunLookup404(123, [125, 124, 120])).toEqual({
      error: "workflow_run_not_found_after_reconciliation",
      retryable: false,
      requested_run_listed: false,
      required_next_action: "Use the authoritative recent workflow list and do not retry or infer status from this stale or superseded run ID.",
    });
  });
});
