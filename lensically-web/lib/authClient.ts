import { apiRequest, buildWorkerUrl } from "./apiClient";

export async function register(email: string, password: string) {
  return apiRequest(buildWorkerUrl("/api/auth/register"), {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string) {
  return apiRequest(buildWorkerUrl("/api/auth/login"), {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  return apiRequest(buildWorkerUrl("/api/auth/logout"), {
    method: "POST",
  });
}

export async function getCurrentUser() {
  return apiRequest(buildWorkerUrl("/api/auth/me"));
}

export async function forgotPassword(email: string) {
  return apiRequest(buildWorkerUrl("/api/auth/forgot-password"), {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string) {
  return apiRequest(buildWorkerUrl("/api/auth/reset-password"), {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function disconnectThreadsAccount(appUserId: string) {
  return apiRequest(buildWorkerUrl("/api/threads/disconnect"), {
    method: "POST",
    body: JSON.stringify({ app_user_id: appUserId }),
  });
}
