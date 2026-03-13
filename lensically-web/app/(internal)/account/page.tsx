"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount, disconnectThreadsAccount, updatePreferences } from "@/lib/authClient";
import { toUserFacingAuthError } from "@/lib/authErrorMessage";
import { useAuth } from "@/lib/AuthProvider";
import {
  readThreadsConnectionCache,
  writeThreadsConnectionCache,
} from "@/lib/threadsConnectionCache";
import { THREADS_ME_URL } from "@/lib/threadsApi";

type ThreadsMeResponse = {
  connected?: boolean;
  account?: unknown | null;
};

const FALLBACK_TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function getTimezoneOptions(): string[] {
  const supportedValuesOf = (Intl as unknown as {
    supportedValuesOf?: (key: string) => string[];
  }).supportedValuesOf;
  if (typeof supportedValuesOf === "function") {
    try {
      const values = supportedValuesOf("timeZone");
      if (Array.isArray(values) && values.length > 0) {
        return values;
      }
    } catch {
      // Ignore and use fallback values.
    }
  }
  return FALLBACK_TIMEZONE_OPTIONS;
}

function formatLoginProvider(provider: "google" | "discord" | "github" | null | undefined) {
  if (provider === "google") {
    return "Google";
  }
  if (provider === "discord") {
    return "Discord";
  }
  if (provider === "github") {
    return "GitHub";
  }
  return null;
}

export default function AccountPage() {
  const deletePhrase = "DELETE";
  const router = useRouter();
  const { user, loading, logoutUser, refreshUser } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [providerError, setProviderError] = useState("");
  const [providerSuccessMessage, setProviderSuccessMessage] = useState("");
  const [preferencesError, setPreferencesError] = useState("");
  const [preferencesSuccessMessage, setPreferencesSuccessMessage] = useState("");
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [timezonePreference, setTimezonePreference] = useState("UTC");
  const [clockFormatPreference, setClockFormatPreference] = useState<"12h" | "24h">("12h");
  const [timezoneOptions, setTimezoneOptions] = useState<string[]>(() => getTimezoneOptions());
  const [isDisconnectingProvider, setIsDisconnectingProvider] = useState(false);
  const [isLoadingProviderStatus, setIsLoadingProviderStatus] = useState(true);
  const [isThreadsConnected, setIsThreadsConnected] = useState(false);
  const deletePhraseConfirmed = deleteConfirmationText === deletePhrase;
  const userId = user?.id;
  const loginProviderLabel = formatLoginProvider(user?.login_provider);
  const currentTimezone = user?.timezone?.trim() || "UTC";
  const currentClockFormat: "12h" | "24h" = user?.clock_format === "24h" ? "24h" : "12h";
  const hasPreferenceChanges = timezonePreference !== currentTimezone || clockFormatPreference !== currentClockFormat;

  useEffect(() => {
    const resolvedTimezone = user?.timezone?.trim() || "UTC";
    const resolvedClockFormat = user?.clock_format === "24h" ? "24h" : "12h";
    if (!timezoneOptions.includes(resolvedTimezone)) {
      setTimezoneOptions((previous) => [resolvedTimezone, ...previous]);
    }
    setTimezonePreference(resolvedTimezone);
    setClockFormatPreference(resolvedClockFormat);
  }, [timezoneOptions, user?.clock_format, user?.timezone]);

  useEffect(() => {
    if (!userId) {
      setIsThreadsConnected(false);
      setIsLoadingProviderStatus(false);
      return;
    }
    const resolvedUserId = userId;

    const cachedConnectionState = readThreadsConnectionCache(resolvedUserId);
    if (cachedConnectionState !== null) {
      setIsThreadsConnected(cachedConnectionState);
      setIsLoadingProviderStatus(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    async function loadThreadsConnectionStatus() {
      setIsLoadingProviderStatus(true);
      setProviderError("");

      try {
        const response = await fetch(
          `${THREADS_ME_URL}?app_user_id=${encodeURIComponent(resolvedUserId)}`,
          {
            cache: "no-store",
            credentials: "include",
            signal: controller.signal,
          },
        );

        if (!isMounted) {
          return;
        }

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          setIsThreadsConnected(false);
          setProviderError("Could not load Threads integration status.");
          return;
        }

        const data = (await response.json()) as ThreadsMeResponse;
        const connected = Boolean(data.connected && data.account);
        setIsThreadsConnected(connected);
        writeThreadsConnectionCache(resolvedUserId, connected);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (isMounted) {
          setIsThreadsConnected(false);
          setProviderError("Could not load Threads integration status.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingProviderStatus(false);
        }
      }
    }

    void loadThreadsConnectionStatus();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [router, userId]);

  async function handleDisconnectThreadsProvider() {
    if (!user || isDisconnectingProvider || !isThreadsConnected) {
      return;
    }

    setIsDisconnectingProvider(true);
    setProviderError("");
    setProviderSuccessMessage("");

    try {
      await disconnectThreadsAccount(user.id);
      writeThreadsConnectionCache(user.id, false);
      setIsThreadsConnected(false);
      setProviderSuccessMessage("Threads provider has been disconnected.");
      router.refresh();
    } catch (err) {
      setProviderError(toUserFacingAuthError(err, "Could not disconnect Threads provider."));
    } finally {
      setIsDisconnectingProvider(false);
    }
  }

  async function handleSavePreferences() {
    if (!user || isSavingPreferences) {
      return;
    }

    const normalizedTimezone = timezonePreference.trim();
    if (!normalizedTimezone) {
      setPreferencesError("Select a timezone before saving.");
      return;
    }

    setIsSavingPreferences(true);
    setPreferencesError("");
    setPreferencesSuccessMessage("");

    try {
      const result = await updatePreferences(normalizedTimezone, clockFormatPreference);
      if (!result.success) {
        setPreferencesError(result.error || "Could not save preferences.");
        return;
      }
      await refreshUser();
      setPreferencesSuccessMessage("Scheduling preferences saved.");
    } catch (err) {
      setPreferencesError(toUserFacingAuthError(err, "Could not save preferences."));
    } finally {
      setIsSavingPreferences(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user || isDeleting) {
      return;
    }

    if (!deleteAcknowledged) {
      setError("Check the confirmation box before permanently deleting your account.");
      return;
    }

    if (user.has_password && !deletePassword) {
      setError("Enter your password to confirm account deletion.");
      return;
    }

    if (!user.has_password && !deletePhraseConfirmed) {
      setError(`Type ${deletePhrase} to confirm account deletion.`);
      return;
    }

    setIsDeleting(true);
    setError("");
    setSuccessMessage("");

    try {
      const result = await deleteAccount(
        user.has_password
          ? { password: deletePassword }
          : { confirmationText: deleteConfirmationText },
      );
      if (!result.success) {
        setError(result.error || "Could not delete account.");
        setIsDeleting(false);
        return;
      }

      setShowDeleteConfirmation(false);
      setDeletePassword("");
      setDeleteConfirmationText("");
      setDeleteAcknowledged(false);
      setSuccessMessage(result.message || "Account has been permanently deleted.");
      await logoutUser();
      router.push("/?accountDeleted=1");
      router.refresh();
    } catch (err) {
      setError(toUserFacingAuthError(err, "Could not delete account."));
      setIsDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl">
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-amber-900">Session expired</h1>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            Your account session is no longer active. Log in again to manage account details,
            connected providers, and account deletion settings.
          </p>
          <div className="mt-4">
            <Link
              href="/login"
              className="inline-flex cursor-pointer rounded-md border border-amber-700 bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
            >
              Log in again
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Account Settings</h1>
        <p className="text-sm text-slate-600">
          Manage your account details and lifecycle.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Account</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-medium text-slate-900">Email:</span> {user.email}
          </p>
          <p>
            <span className="font-medium text-slate-900">Email verified:</span>{" "}
            {user.email_verified ? "Yes" : "No"}
          </p>
          {!user.has_password && loginProviderLabel ? (
            <p>
              <span className="font-medium text-slate-900">Login Provider:</span>{" "}
              {loginProviderLabel}
            </p>
          ) : null}
        </div>
        {!user.has_password ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            This account uses OAuth sign-in. If you connected with Google, Lensically uses Google
            account data only to authenticate your account and maintain access to the application.
            The stored provider linkage supports sign-in and account lifecycle functions. See{" "}
            <a href="/privacy" className="font-medium text-slate-900 underline">
              Privacy Policy
            </a>
            .
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Scheduling Preferences</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Choose how scheduled post timestamps are displayed across the application.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="timezone-preference" className="block text-sm font-medium text-slate-900">
              Timezone
            </label>
            <select
              id="timezone-preference"
              value={timezonePreference}
              onChange={(event) => {
                setTimezonePreference(event.target.value);
                setPreferencesError("");
                setPreferencesSuccessMessage("");
              }}
              disabled={isSavingPreferences}
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {timezoneOptions.map((timezoneOption) => (
                <option key={timezoneOption} value={timezoneOption}>
                  {timezoneOption}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="clock-format-preference" className="block text-sm font-medium text-slate-900">
              Clock Format
            </label>
            <select
              id="clock-format-preference"
              value={clockFormatPreference}
              onChange={(event) => {
                const nextValue = event.target.value === "24h" ? "24h" : "12h";
                setClockFormatPreference(nextValue);
                setPreferencesError("");
                setPreferencesSuccessMessage("");
              }}
              disabled={isSavingPreferences}
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="12h">12-hour</option>
              <option value="24h">24-hour</option>
            </select>
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => void handleSavePreferences()}
            disabled={isSavingPreferences || !hasPreferenceChanges}
            className="inline-flex cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingPreferences ? "Saving preferences..." : "Save Preferences"}
          </button>
        </div>

        {(preferencesError || preferencesSuccessMessage) ? (
          <p className={`mt-4 text-sm ${preferencesError ? "text-red-600" : "text-green-700"}`}>
            {preferencesError || preferencesSuccessMessage}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Threads Integration</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Manage your Threads connection used by Lensically feature pages.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900">Threads</p>
            <p className="text-sm text-slate-700">
              Status:{" "}
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  isLoadingProviderStatus
                    ? "bg-slate-200 text-slate-700"
                    : isThreadsConnected
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                }`}
              >
                {isLoadingProviderStatus
                  ? "Checking..."
                  : isThreadsConnected
                    ? "Connected"
                    : "Not Connected"}
              </span>
            </p>
          </div>

          {isThreadsConnected ? (
            <button
              type="button"
              onClick={() => void handleDisconnectThreadsProvider()}
              disabled={isDisconnectingProvider || isLoadingProviderStatus}
              className="inline-flex cursor-pointer rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDisconnectingProvider ? "Disconnecting Threads..." : "Disconnect Threads"}
            </button>
          ) : (
            <Link
              href="/connect"
              className={`inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${
                isLoadingProviderStatus ? "cursor-not-allowed opacity-60 pointer-events-none" : "cursor-pointer"
              }`}
              aria-disabled={isLoadingProviderStatus}
            >
              Connect Threads
            </Link>
          )}
        </div>

        {(providerError || providerSuccessMessage) ? (
          <p className={`mt-4 text-sm ${providerError ? "text-red-600" : "text-green-700"}`}>
            {providerError || providerSuccessMessage}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-rose-700">Delete Account</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Permanently delete your Lensically account and remove associated access to the application.
        </p>

        {(error || successMessage) ? (
          <p className={`mt-4 text-sm ${error ? "text-red-600" : "text-green-700"}`}>
            {error || successMessage}
          </p>
        ) : null}

        {showDeleteConfirmation ? (
          <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4">
            <div className="rounded-md border border-rose-300 bg-white px-4 py-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">
                Permanent deletion warning
              </p>
              <p className="mt-2 text-sm leading-6 text-rose-900">
                Deleting your account permanently removes associated user data from the system.
                This action cannot be undone.
              </p>
            </div>
            {user.has_password ? (
              <div className="mt-4">
                <label
                  htmlFor="delete-account-password"
                  className="block text-sm font-medium text-slate-900"
                >
                  Re-enter your password
                </label>
                <input
                  id="delete-account-password"
                  type="password"
                  value={deletePassword}
                  onChange={(event) => {
                    setDeletePassword(event.target.value);
                    setError("");
                  }}
                  autoComplete="current-password"
                  disabled={isDeleting}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Enter your password to confirm deletion"
                />
              </div>
            ) : (
              <div className="mt-4">
                <label
                  htmlFor="delete-account-confirmation"
                  className="block text-sm font-medium text-slate-900"
                >
                  Type {deletePhrase} to confirm deletion
                </label>
                <input
                  id="delete-account-confirmation"
                  type="text"
                  value={deleteConfirmationText}
                  onChange={(event) => {
                    setDeleteConfirmationText(event.target.value);
                    setError("");
                  }}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={isDeleting}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm uppercase text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder={`Type ${deletePhrase}`}
                />
              </div>
            )}
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-md border border-rose-200 bg-white px-3 py-3 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={deleteAcknowledged}
                onChange={(event) => {
                  setDeleteAcknowledged(event.target.checked);
                  setError("");
                }}
                disabled={isDeleting}
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-rose-600 focus-visible:outline-none disabled:cursor-not-allowed"
              />
              <span>
                I understand this permanently deletes my account, and I want to confirm that
                action before the request is sent.
              </span>
            </label>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleDeleteAccount()}
                disabled={
                  isDeleting ||
                  !deleteAcknowledged ||
                  (!user.has_password && !deletePhraseConfirmed)
                }
                className="inline-flex cursor-pointer rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Deleting account..." : "Confirm permanent deletion"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isDeleting) {
                    return;
                  }
                  setShowDeleteConfirmation(false);
                  setDeletePassword("");
                  setDeleteConfirmationText("");
                  setDeleteAcknowledged(false);
                  setError("");
                }}
                disabled={isDeleting}
                className="inline-flex cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowDeleteConfirmation(true);
              setDeletePassword("");
              setDeleteConfirmationText("");
              setDeleteAcknowledged(false);
              setError("");
              setSuccessMessage("");
            }}
            disabled={isDeleting}
            className="mt-5 inline-flex cursor-pointer rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete account
          </button>
        )}
      </section>
    </div>
  );
}
