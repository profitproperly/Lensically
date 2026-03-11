"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount } from "@/lib/authClient";
import { useAuth } from "@/lib/AuthProvider";

export default function AccountPage() {
  const deletePhrase = "DELETE";
  const router = useRouter();
  const { user, loading, logoutUser } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const deletePhraseConfirmed = deleteConfirmationText === deletePhrase;

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
      setError(err instanceof Error ? err.message : "Could not delete account.");
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
    return null;
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
