export type OperatorControlStepCheckRun = {
  name?: unknown;
  status?: unknown;
  conclusion?: unknown;
};

export type OperatorControlStepCommitStatus = {
  context?: unknown;
  state?: unknown;
};

/**
 * push-validation is the authoritative aggregate check for the exact head: it
 * succeeds only after the change-classified fast-or-full validation path.
 * full-release-preflight is independently published for every validated head.
 * Do not require the optional full-validation status, which is absent by
 * design for fast-mapped validation heads.
 */
export function isOperatorControlStepHeadValidated(
  checkRuns: OperatorControlStepCheckRun[],
  statuses: OperatorControlStepCommitStatus[],
): boolean {
  const pushValidated = checkRuns.some(
    (run) => run.name === "push-validation" && run.status === "completed" && run.conclusion === "success",
  );
  const preflightValidated = statuses.some(
    (status) => status.context === "lensically/full-release-preflight" && status.state === "success",
  );
  return pushValidated && preflightValidated;
}
