const TRANSIENT_MARKERS = [
  /\[code:\s*10013\]/i,
  /assets-upload-session[\s\S]*unknown error/i,
  /too many requests|rate limit|http\s*429/i,
  /http\s*5\d\d|status(?: code)?\s*5\d\d|service unavailable|temporarily unavailable/i,
  /econnreset|etimedout|eai_again|socket hang up|network error|fetch failed/i,
];

export function isTransientWranglerDeployFailure(output) {
  const text = String(output ?? "");
  return TRANSIENT_MARKERS.some((pattern) => pattern.test(text));
}

export function getDeployRetryDelayMs(
  completedAttempt,
  baseDelayMs = 5_000,
  maxDelayMs = 30_000,
) {
  const exponent = Math.max(0, Math.trunc(Number(completedAttempt)) - 1);
  return Math.min(maxDelayMs, baseDelayMs * (2 ** exponent));
}

export async function runWranglerDeployWithRetry({
  args = [],
  command = "npx",
  cwd,
  env,
  maxAttempts = 4,
  baseDelayMs = 5_000,
  maxDelayMs = 30_000,
  spawn,
  sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
  stdout = { write() {} },
  stderr = { write() {} },
} = {}) {
  if (typeof spawn !== "function") {
    throw new TypeError("spawn function is required");
  }

  const deployArgs = Array.isArray(args) ? args : [];
  const boundedAttempts = Math.max(1, Math.trunc(Number(maxAttempts)) || 1);

  for (let attempt = 1; attempt <= boundedAttempts; attempt += 1) {
    stdout.write(`[wrangler-deploy] attempt ${attempt}/${boundedAttempts}\n`);
    const result = spawn(command, ["wrangler", "deploy", ...deployArgs], {
      cwd,
      env,
      encoding: "utf8",
    });
    const capturedStdout = String(result?.stdout ?? "");
    const capturedStderr = String(result?.stderr ?? "");
    if (capturedStdout) stdout.write(capturedStdout);
    if (capturedStderr) stderr.write(capturedStderr);

    if (result?.status === 0) {
      return 0;
    }

    const combinedOutput = `${capturedStdout}\n${capturedStderr}`;
    const transient = isTransientWranglerDeployFailure(combinedOutput);
    const exitCode = Number.isInteger(result?.status) && result.status > 0
      ? result.status
      : 1;
    if (!transient || attempt === boundedAttempts) {
      stderr.write(
        `[wrangler-deploy] ${transient ? "transient retry budget exhausted" : "deterministic failure; not retrying"}\n`,
      );
      return exitCode;
    }

    const delayMs = getDeployRetryDelayMs(attempt, baseDelayMs, maxDelayMs);
    stderr.write(`[wrangler-deploy] transient failure; retrying in ${delayMs}ms\n`);
    await sleep(delayMs);
  }

  return 1;
}
