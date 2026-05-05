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
  "Workspace access cookie used to unlock the private Lensically workspace",
  "Connected Threads account identifiers, access tokens, and profile metadata needed for product functionality",
  "Feature usage records, limit counters, and operational metadata used for reliability and abuse prevention",
  "Insights, follower history, archive, publish, and scheduling request/response data needed to perform requested actions",
  "Scheduled posts and related publishing status records created by the user",
];

const useCases = [
  "Unlock and operate the private workspace",
  "Provide Threads connection, insights, follower tracking, publishing, archive, and scheduling functionality",
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
            how it is stored within the application, and how deletion requests are handled for the
            current private workspace build.
          </p>
          <p className="text-sm text-slate-500">Effective date: March 14, 2026</p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium leading-6 text-rose-900">
          Lensically currently operates as a private workspace build. Removal requests are handled
          through the documented deletion process and support contact.
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
            service (including hosted database and API runtime components). The current build uses
            a workspace access cookie rather than a public multi-user sign-in system. Requests to
            third-party platforms are made
            only as needed to execute user-requested product actions and connected account features.
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Lensically also uses third-party services where applicable for product operation,
            including Threads/Meta APIs and Cloudflare hosting/runtime infrastructure.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Cookies and sessions</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Lensically uses a secure workspace access cookie to unlock protected routes for the
            private workspace. That cookie is required for workspace access.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Data retention and deletion</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Lensically retains workspace and feature data while the private workspace remains in
            operation and as needed to provide product functionality. Deletion or data removal
            requests are handled through the documented public deletion channel.
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Limited operational metadata may be retained for security, abuse prevention, and audit
            purposes where required.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">How users can delete data</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The current private workspace build does not expose a public self-serve account settings
            flow. Deletion and data removal instructions are available at the public URL below.
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Public deletion instructions are available at{" "}
            <Link href="/data-deletion" className="font-medium text-slate-900 underline">
              https://lensically.com/data-deletion
            </Link>
            .
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            If you need deletion or data removal support, contact{" "}
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
            personal data that is not required for core service use.
          </p>
        </section>
      </main>
    </div>
  );
}
