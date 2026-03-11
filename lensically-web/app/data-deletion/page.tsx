import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Deletion | Lensically",
  description: "How to delete your Lensically account and what data is removed.",
  alternates: {
    canonical: "https://lensically.com/data-deletion",
  },
};

const deletedDataItems = [
  "Your Lensically user account record",
  "Active sessions and authentication cookies",
  "Connected OAuth provider linkages",
  "Email verification and password reset tokens",
  "Usage tracking records associated with your account",
  "Scheduled posts stored for your account",
];

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-white text-black">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/lensically-logo-white-with-black-bg.png"
            alt="Lensically logo"
            width={64}
            height={64}
            className="h-16 w-16 rounded-md"
            priority
          />
          <span className="text-xl font-semibold tracking-tight">Lensically</span>
        </Link>

        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Public Data Deletion Information
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            How to delete your Lensically account
          </h1>
          <p className="max-w-3xl text-base leading-7 text-slate-600">
            Lensically provides self-serve account deletion from the authenticated account settings
            area. Deletion is permanent and removes the account data associated with your use of the
            application.
          </p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium leading-6 text-rose-900">
          Deleting your Lensically account permanently removes associated user data from the system.
          This action cannot be undone.
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Official public review URL</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The canonical public data deletion instructions for provider review are available at{" "}
            <a
              className="font-medium text-slate-900 underline"
              href="https://lensically.com/data-deletion"
            >
              https://lensically.com/data-deletion
            </a>
            .
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-xl font-semibold text-slate-900">Delete your account</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-700">
            <li>Sign in to your Lensically account.</li>
            <li>Open the account settings page.</li>
            <li>Select the delete account action.</li>
            <li>Confirm the permanent deletion prompt.</li>
            <li>
              After confirmation, Lensically runs the deletion process and removes your account from
              the system.
            </li>
          </ol>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">What data is removed</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            When account deletion completes, Lensically permanently removes the account and related
            application records tied to that user, including:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {deletedDataItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Need help?</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The related public privacy policy used for provider review is available at{" "}
            <Link href="/privacy" className="font-medium text-slate-900 underline">
              https://lensically.com/privacy
            </Link>
            .
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            If you cannot access your account and need assistance with deletion, contact Lensically
            support and include the email address associated with your account.
          </p>
          <p className="mt-4 text-sm font-medium text-slate-900">
            Support: <a className="underline" href="mailto:support@lensically.com">support@lensically.com</a>
          </p>
        </section>
      </main>
    </div>
  );
}
