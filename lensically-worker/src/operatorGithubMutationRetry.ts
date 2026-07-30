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
