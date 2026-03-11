import { apiRequest, buildWorkerUrl } from "./apiClient";

type DeletedAccountUser = {
  id: string;
  email: string;
  email_verified: boolean;
};

export type CurrentUser = {
  id: string;
  email: string;
  email_verified: boolean;
  has_password: boolean;
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

export async function disconnectThreadsAccount(appUserId: string) {
  return apiRequest(buildWorkerUrl("/api/threads/disconnect"), {
    method: "POST",
    body: JSON.stringify({ app_user_id: appUserId }),
  });
}
