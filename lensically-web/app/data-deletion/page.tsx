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
  "Workspace-managed Threads account linkage records and related cached profile data",
  "Workspace usage tracking and feature usage records",
  "Scheduled posts and publish status records stored by the workspace",
  "Archived post records and follower history snapshots where deletion is requested",
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
            Lensically currently operates as a private workspace build. Deletion and data removal
            requests are handled through support and the documented provider review callbacks.
          </p>
          <p className="text-sm text-slate-500">Effective date: March 14, 2026</p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium leading-6 text-rose-900">
          Deletion requests permanently remove the requested Lensically data from the system where
          applicable. This action cannot be undone.
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
          <h2 className="text-xl font-semibold text-slate-900">Request deletion</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-700">
            <li>Email <a className="font-medium text-slate-900 underline" href="mailto:support@lensically.com">support@lensically.com</a> with your deletion request.</li>
            <li>Include the Threads account or dataset details needed to identify the stored records.</li>
            <li>Lensically verifies the request and removes the applicable workspace-managed data.</li>
            <li>If a provider-initiated deletion callback applies, Lensically processes that callback and returns the required confirmation response.</li>
          </ol>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">What data is removed</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            When deletion completes, Lensically permanently removes the applicable workspace data,
            including:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {deletedDataItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Lensically may retain limited operational metadata where required for security, abuse
            prevention, or audit purposes.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Need help?</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Lensically also supports provider-initiated deletion callbacks for Meta review
            workflows. When a supported provider sends a deletion request for associated Threads
            data, Lensically processes the request through its configured deletion callback and
            returns a confirmation status response.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            If you need manual deletion support, contact{" "}
            <a className="font-medium text-slate-900 underline" href="mailto:support@lensically.com">
              support@lensically.com
            </a>{" "}
            and include the relevant Threads account or dataset details.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The related public privacy policy used for provider review is available at{" "}
            <Link href="/privacy" className="font-medium text-slate-900 underline">
              https://lensically.com/privacy
            </Link>
            .
          </p>
          <p className="mt-4 text-sm font-medium text-slate-900">
            Support: <a className="underline" href="mailto:support@lensically.com">support@lensically.com</a>
          </p>
        </section>
      </main>
    </div>
  );
}
