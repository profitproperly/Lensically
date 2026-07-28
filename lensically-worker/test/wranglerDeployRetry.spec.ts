import { describe, expect, it, vi } from "vitest";
// @ts-ignore -- executable ESM script is intentionally tested directly.
import {
  getDeployRetryDelayMs,
  isTransientWranglerDeployFailure,
  runWranglerDeployWithRetry,
} from "../scripts/wrangler-deploy-retry-core.mjs";

function createWriter() {
  return { write: vi.fn(() => true) };
}

describe("Wrangler deploy transient classification", () => {
  it("classifies Cloudflare assets-upload code 10013 as transient", () => {
    expect(isTransientWranglerDeployFailure(
      "A request to /assets-upload-session failed. Unknown error [code: 10013]",
    )).toBe(true);
  });

  it("classifies rate limits, service failures, and network resets as transient", () => {
    expect(isTransientWranglerDeployFailure("HTTP 429 too many requests")).toBe(true);
    expect(isTransientWranglerDeployFailure("HTTP 503 service unavailable")).toBe(true);
    expect(isTransientWranglerDeployFailure("fetch failed: ECONNRESET")).toBe(true);
  });

  it("does not classify deterministic authentication failures as transient", () => {
    expect(isTransientWranglerDeployFailure(
      "Authentication error [code: 10000]: invalid API token",
    )).toBe(false);
  });

  it("uses bounded exponential delays", () => {
    expect(getDeployRetryDelayMs(1)).toBe(5_000);
    expect(getDeployRetryDelayMs(2)).toBe(10_000);
    expect(getDeployRetryDelayMs(3)).toBe(20_000);
    expect(getDeployRetryDelayMs(4)).toBe(30_000);
    expect(getDeployRetryDelayMs(8)).toBe(30_000);
  });
});

describe("runWranglerDeployWithRetry", () => {
  it("recovers after one classified transient failure", async () => {
    const spawn = vi.fn()
      .mockReturnValueOnce({
        status: 1,
        stdout: "",
        stderr: "assets-upload-session unknown error [code: 10013]",
      })
      .mockReturnValueOnce({ status: 0, stdout: "deployed", stderr: "" });
    const sleep = vi.fn(async () => undefined);
    const stdout = createWriter();
    const stderr = createWriter();

    const exitCode = await runWranglerDeployWithRetry({
      args: ["--config", "wrangler.jsonc", "--var", "LENSICALLY_COMMIT_SHA:abc"],
      maxAttempts: 4,
      baseDelayMs: 100,
      spawn,
      sleep,
      stdout,
      stderr,
    });

    expect(exitCode).toBe(0);
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(spawn.mock.calls[0][1]).toEqual([
      "wrangler",
      "deploy",
      "--config",
      "wrangler.jsonc",
      "--var",
      "LENSICALLY_COMMIT_SHA:abc",
    ]);
    expect(sleep).toHaveBeenCalledWith(100);
    expect(stderr.write).toHaveBeenCalledWith(
      "[wrangler-deploy] transient failure; retrying in 100ms\n",
    );
  });

  it("fails immediately for a deterministic deployment error", async () => {
    const spawn = vi.fn(() => ({
      status: 1,
      stdout: "",
      stderr: "Authentication error [code: 10000]",
    }));
    const sleep = vi.fn(async () => undefined);
    const stderr = createWriter();

    const exitCode = await runWranglerDeployWithRetry({
      args: [],
      spawn,
      sleep,
      stdout: createWriter(),
      stderr,
    });

    expect(exitCode).toBe(1);
    expect(spawn).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
    expect(stderr.write).toHaveBeenCalledWith(
      "[wrangler-deploy] deterministic failure; not retrying\n",
    );
  });

  it("stops after the bounded transient retry budget", async () => {
    const spawn = vi.fn(() => ({
      status: 1,
      stdout: "",
      stderr: "HTTP 503 service unavailable",
    }));
    const sleep = vi.fn(async () => undefined);
    const stderr = createWriter();

    const exitCode = await runWranglerDeployWithRetry({
      args: [],
      maxAttempts: 4,
      baseDelayMs: 5,
      maxDelayMs: 30,
      spawn,
      sleep,
      stdout: createWriter(),
      stderr,
    });

    expect(exitCode).toBe(1);
    expect(spawn).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(([delay]) => delay)).toEqual([5, 10, 20]);
    expect(stderr.write).toHaveBeenCalledWith(
      "[wrangler-deploy] transient retry budget exhausted\n",
    );
  });
});
