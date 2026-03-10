import { buildWorkerUrl } from "./apiClient";

export const CURRENT_USER_URL = buildWorkerUrl("/api/auth/me");
export const CONNECT_THREADS_URL = buildWorkerUrl("/api/auth/threads/start");
export const THREADS_ME_URL = buildWorkerUrl("/api/threads/me");
