"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount } from "@/lib/authClient";
import { useAuth } from "@/lib/AuthProvider";

export default function AccountPage() {
  const router = useRouter();
  const { user, loading, logoutUser } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleDeleteAccount() {
    if (!user || isDeleting) {
      return;
    }

    const confirmed = window.confirm(
      "Delete your account permanently? This action cannot be undone.",
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError("");
    setSuccessMessage("");

    try {
      const result = await deleteAccount();
      if (result?.success === false || result?.error) {
        setError(result.error || "Could not delete account.");
        setIsDeleting(false);
        return;
      }

      setSuccessMessage(result?.message || "Account has been permanently deleted.");
      await logoutUser();
      router.push("/login");
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

        <button
          type="button"
          onClick={() => void handleDeleteAccount()}
          disabled={isDeleting}
          className="mt-5 inline-flex rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeleting ? "Deleting account..." : "Delete account"}
        </button>
      </section>
    </div>
  );
}
