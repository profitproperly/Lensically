import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Lensically",
  description: "Lensically privacy policy covering data collection, use, storage, and deletion.",
  alternates: {
    canonical: "https://lensically.com/privacy",
  },
};

const collectedData = [
  "Account information such as email address and authentication credentials",
  "OAuth account linkages used to sign in or connect supported providers",
  "Session records and security-related authentication state",
  "Usage and feature records needed to operate the application and enforce product limits",
  "Scheduled post records and related app content created within Lensically",
  "Threads connection and account metadata required for supported product features",
];

const useCases = [
  "Create and secure your account",
  "Authenticate access to the application",
  "Provide Threads-related product functionality",
  "Support scheduling, discovery, search, and analytics features",
  "Maintain service integrity, abuse prevention, and usage enforcement",
  "Respond to account support and deletion requests",
];

export default function PrivacyPage() {
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
            Public Privacy Policy
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Privacy policy
          </h1>
          <p className="max-w-3xl text-base leading-7 text-slate-600">
            This page explains what information Lensically collects, how that information is used,
            how it is stored within the application, and how users can delete their data.
          </p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium leading-6 text-rose-900">
          Deleting your Lensically account permanently removes associated user data from the system.
          This action cannot be undone.
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Official public review URL</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The canonical public privacy policy for provider review is available at{" "}
            <a
              className="font-medium text-slate-900 underline"
              href="https://lensically.com/privacy"
            >
              https://lensically.com/privacy
            </a>
            .
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-xl font-semibold text-slate-900">What Lensically collects</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {collectedData.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">How Lensically uses data</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {useCases.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">How data is stored</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Lensically stores application data in its production database and supporting
            authentication records needed to operate the service. Session and account access are
            protected through authenticated application flows and server-managed session handling.
            Data is retained only as needed to provide the product and associated account lifecycle
            features until the account is deleted.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">How users can delete data</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Signed-in users can delete their account from the account settings page. That deletion
            flow permanently removes the Lensically account and associated application records tied
            to the user, including sessions, OAuth linkages, reset and verification tokens, usage
            tracking records, and scheduled posts.
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Public deletion instructions are available at{" "}
            <Link href="/data-deletion" className="font-medium text-slate-900 underline">
              https://lensically.com/data-deletion
            </Link>
            .
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            If you cannot access your account, contact{" "}
            <a className="font-medium text-slate-900 underline" href="mailto:support@lensically.com">
              support@lensically.com
            </a>{" "}
            for assistance.
          </p>
        </section>
      </main>
    </div>
  );
}
