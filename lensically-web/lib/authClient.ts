import { apiRequest } from "./apiClient";

const DEFAULT_WORKER_ORIGIN = "https://lensically-worker.lensically.workers.dev";

function buildWorkerAuthUrl(path: string) {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_WORKER_ORIGIN?.trim() || DEFAULT_WORKER_ORIGIN;
  const normalizedOrigin = configuredOrigin.replace(/\/+$/, "");
  return `${normalizedOrigin}${path}`;
}

export async function register(email: string, password: string) {
  return apiRequest(buildWorkerAuthUrl("/api/auth/register"), {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string) {
  return apiRequest(buildWorkerAuthUrl("/api/auth/login"), {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  return apiRequest(buildWorkerAuthUrl("/api/auth/logout"), {
    method: "POST",
  });
}

export async function getCurrentUser() {
  return apiRequest(buildWorkerAuthUrl("/api/auth/me"));
}

export async function forgotPassword(email: string) {
  return apiRequest(buildWorkerAuthUrl("/api/auth/forgot-password"), {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string) {
  return apiRequest(buildWorkerAuthUrl("/api/auth/reset-password"), {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}
