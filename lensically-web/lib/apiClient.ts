const DEFAULT_WORKER_ORIGIN = "https://api.lensically.com";

export function buildWorkerUrl(path: string) {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_WORKER_ORIGIN?.trim() || DEFAULT_WORKER_ORIGIN;
  const normalizedOrigin = configuredOrigin.replace(/\/+$/, "");
  return `${normalizedOrigin}${path}`;
}

export async function apiRequest(
  url: string,
  options: RequestInit = {},
  retries = 2
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      signal: controller.signal,
      ...options
    });

    clearTimeout(timeout);

    let data = null;

    try {
      data = await res.json();
    } catch {}

    if (!res.ok) {
      if (retries > 0 && res.status >= 500) {
        return apiRequest(url, options, retries - 1);
      }
      throw new Error(data?.error || "API request failed");
    }

    return data;
  } catch (err) {
    clearTimeout(timeout);
    const isAbortError = err instanceof DOMException && err.name === "AbortError";
    const isNetworkError = err instanceof TypeError;

    if (retries > 0 && (isAbortError || isNetworkError)) {
      return apiRequest(url, options, retries - 1);
    }

    throw err;
  }
}
