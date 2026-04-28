import { apiRequest, buildWorkerUrl } from "./apiClient";

type DeletedAccountUser = {
  id: string;
  email: string;
  email_verified: boolean;
};

export type CurrentUser = {
  id: string;
  email: string;
  timezone?: string;
  clock_format?: "12h" | "24h";
  email_verified: boolean;
  has_password: boolean;
  login_provider?: "google" | "discord" | "github" | null;
};

export type DeleteAccountResponse =
  | {
      success: true;
      message: string;
      user: DeletedAccountUser;
    }
  | {
      success: false;
      error: string;
    };

export type UpdatePreferencesResponse =
  | {
      success: true;
      user: {
        id: string;
        timezone: string;
        clock_format: "12h" | "24h";
      };
    }
  | {
      success: false;
      error: string;
    };

export type ThreadsConnectedAccount = {
  threads_user_id: string;
  is_active: boolean;
  created_at: number;
  username: string | null;
  name: string | null;
  threads_biography: string | null;
  is_verified: boolean;
  threads_profile_picture_url: string | null;
};

export type ThreadsAccountsResponse = {
  connected: boolean;
  accounts: ThreadsConnectedAccount[];
  active_threads_user_id: string | null;
};

type ThreadsMeFallbackResponse = {
  connected?: boolean;
  account?: {
    threads_user_id?: string | null;
    username?: string | null;
    name?: string | null;
    threads_biography?: string | null;
    is_verified?: boolean;
    threads_profile_picture_url?: string | null;
  } | null;
  threads_user_id?: string | null;
};

type DeleteAccountRequest = {
  password?: string;
  confirmationText?: string;
};

export async function register(email: string, password: string) {
  return apiRequest(buildWorkerUrl("/api/auth/register"), {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }, 0);
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

export async function getCurrentUser(): Promise<CurrentUser> {
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

export async function validateResetPasswordToken(token: string) {
  const url = `${buildWorkerUrl("/api/auth/reset-password")}?token=${encodeURIComponent(token)}`;
  return apiRequest(url, {}, 0);
}

export async function deleteAccount({
  password,
  confirmationText,
}: DeleteAccountRequest = {}): Promise<DeleteAccountResponse> {
  return apiRequest(buildWorkerUrl("/api/auth/delete-account"), {
    method: "POST",
    body: JSON.stringify({
      ...(password ? { password } : {}),
      ...(confirmationText ? { confirmation_text: confirmationText } : {}),
    }),
  }, 0);
}

export async function disconnectThreadsAccount(appUserId: string, threadsUserId?: string) {
  return apiRequest(buildWorkerUrl("/api/threads/disconnect"), {
    method: "POST",
    body: JSON.stringify({
      app_user_id: appUserId,
      ...(threadsUserId ? { threads_user_id: threadsUserId } : {}),
    }),
  });
}

export async function getThreadsAccounts(appUserId: string): Promise<ThreadsAccountsResponse> {
  const url = `${buildWorkerUrl("/api/threads/accounts")}?app_user_id=${encodeURIComponent(appUserId)}`;
  return apiRequest(url);
}

export async function getThreadsAccountsWithFallback(appUserId: string): Promise<ThreadsAccountsResponse> {
  try {
    return await getThreadsAccounts(appUserId);
  } catch {
    const meUrl = `${buildWorkerUrl("/api/threads/me")}?app_user_id=${encodeURIComponent(appUserId)}`;
    const me = await apiRequest(meUrl) as ThreadsMeFallbackResponse;
    const threadsUserId = me.account?.threads_user_id?.trim() || me.threads_user_id?.trim() || null;
    if (!threadsUserId) {
      return {
        connected: false,
        accounts: [],
        active_threads_user_id: null,
      };
    }

    return {
      connected: true,
      active_threads_user_id: threadsUserId,
      accounts: [
        {
          threads_user_id: threadsUserId,
          is_active: true,
          created_at: 0,
          username: me.account?.username ?? null,
          name: me.account?.name ?? null,
          threads_biography: me.account?.threads_biography ?? null,
          is_verified: me.account?.is_verified === true,
          threads_profile_picture_url: me.account?.threads_profile_picture_url ?? null,
        },
      ],
    };
  }
}

export async function setActiveThreadsAccount(appUserId: string, threadsUserId: string) {
  return apiRequest(buildWorkerUrl("/api/threads/accounts/active"), {
    method: "POST",
    body: JSON.stringify({
      app_user_id: appUserId,
      threads_user_id: threadsUserId,
    }),
  });
}

export async function updatePreferences(
  timezone: string,
  clockFormat: "12h" | "24h",
): Promise<UpdatePreferencesResponse> {
  return apiRequest(buildWorkerUrl("/api/auth/preferences"), {
    method: "POST",
    body: JSON.stringify({
      timezone,
      clock_format: clockFormat,
    }),
  }, 0);
}
