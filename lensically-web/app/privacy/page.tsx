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
  "Account information, including email address and password hash (for password-based accounts)",
  "OAuth identity linkages for supported sign-in providers (Google, GitHub, Discord)",
  "Session and cookie records used to authenticate requests and protect account access",
  "Connected Threads account identifiers, access tokens, and profile metadata needed for product functionality",
  "Feature usage records, limit counters, and operational metadata used for reliability and abuse prevention",
  "Profile discovery, keyword search, insights, publish, and scheduling request/response data needed to perform requested actions",
  "Scheduled posts and related publishing status records created by the user",
  "Email delivery metadata for verification and password reset workflows (via configured provider infrastructure)",
];

const useCases = [
  "Create and secure your account",
  "Authenticate and maintain active sessions for authorized users",
  "Provide Threads connection, profile discovery, keyword search, insights, publishing, and scheduling functionality",
  "Operate and secure account settings, account deletion, and lifecycle workflows",
  "Maintain service integrity, prevent abuse, and enforce feature usage limits",
  "Process support requests, deletion requests, and provider-required compliance callbacks",
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
          <p className="text-sm text-slate-500">Effective date: March 14, 2026</p>
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
            Lensically stores application data in production infrastructure used to operate the
            service (including hosted database and API runtime components). Authentication uses
            server-managed sessions and secure cookies. Requests to third-party platforms are made
            only as needed to execute user-requested product actions and connected account features.
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Lensically also uses third-party services where applicable for product operation,
            including Threads/Meta APIs, OAuth provider APIs (Google, GitHub, Discord), Cloudflare
            hosting/runtime infrastructure, and email delivery infrastructure.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Cookies and sessions</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Lensically uses secure authentication cookies and server-side session records to keep
            users signed in and to authorize protected API routes. Session cookies are required for
            account access and authenticated functionality.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Data retention and deletion</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Lensically retains account and feature data while your account is active and as needed
            to provide product functionality. You can initiate permanent deletion from authenticated
            account settings.
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            After account deletion, Lensically removes account-linked application records. For
            security and abuse prevention, limited identity tombstones may be retained for up to 7
            days before expiring.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">How users can delete data</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Signed-in users can delete their account from the account settings page. That deletion
            flow permanently removes the Lensically account and associated application records tied
            to the user, including sessions, OAuth linkages, reset and verification tokens, usage
            tracking records, Threads linkage records, and scheduled posts.
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Children and sensitive data</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Lensically is not intended for children under 13. Please do not submit sensitive
            personal data that is not required for account authentication or core service use.
          </p>
        </section>
      </main>
    </div>
  );
}
