type GithubApiResult = {
  status: number;
  data: unknown;
};

function responseMessage(data: unknown): string {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "";
  return String((data as Record<string, unknown>).message ?? "").trim();
}

/**
 * GitHub Git Data can briefly return `Tree SHA does not exist` immediately after
 * successfully creating that tree. Only that exact commit-creation race is
 * retryable among 422 responses; validation and semantic 422s remain fail-closed.
 */
export function shouldRetryGithubMutationResponse(
  path: string,
  result: GithubApiResult,
  attempt: number,
): boolean {
  if (attempt >= 3) return false;
  if ([502, 503, 504].includes(result.status)) return true;
  return path === "/git/commits"
    && result.status === 422
    && /tree sha does not exist/i.test(responseMessage(result.data));
}

export function githubMutationRetryDelayMs(attempt: number): number {
  return Math.min(1_200, 300 * (2 ** Math.max(0, attempt)));
}

export function isAmbiguousGithubWorkflowDispatchStatus(status: number): boolean {
  return [502, 503, 504, 520, 521, 522, 523, 524].includes(Math.trunc(status));
}

export function isTransientGithubWorkflowReadStatus(status: number): boolean {
  return [502, 503, 504, 520, 521, 522, 523, 524].includes(Math.trunc(status));
}

export function classifyGithubWorkflowRunLookup404(
  requestedRunId: number,
  recentRunIds: number[],
): {
  error: "workflow_run_temporarily_unreadable" | "workflow_run_not_found_after_reconciliation";
  retryable: boolean;
  requested_run_listed: boolean;
  required_next_action: string;
} {
  const requestedRunListed = recentRunIds.includes(Math.trunc(requestedRunId));
  return requestedRunListed
    ? {
        error: "workflow_run_temporarily_unreadable",
        retryable: true,
        requested_run_listed: true,
        required_next_action: "Retry the same listed run ID after a short delay; do not infer workflow failure from the temporary detail-endpoint 404.",
      }
    : {
        error: "workflow_run_not_found_after_reconciliation",
        retryable: false,
        requested_run_listed: false,
        required_next_action: "Use the authoritative recent workflow list and do not retry or infer status from this stale or superseded run ID.",
      };
}

