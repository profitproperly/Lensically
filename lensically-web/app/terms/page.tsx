import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Lensically",
  description: "Basic terms governing access to and use of the Lensically application.",
  alternates: {
    canonical: "https://lensically.com/terms",
  },
};

const usageRules = [
  "Use Lensically only for lawful purposes and only with accounts and data you are authorized to access.",
  "Do not bypass authentication, access controls, rate limits, quotas, or platform restrictions.",
  "Do not use Lensically to spam, scrape, misrepresent identity, or violate third-party platform terms.",
  "Do not upload or schedule unlawful, infringing, deceptive, or harmful content.",
  "You are responsible for posts you create, publish now, or schedule through Lensically.",
];

export default function TermsPage() {
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
            Public Terms Of Service
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Terms of service
          </h1>
          <p className="max-w-3xl text-base leading-7 text-slate-600">
            These Terms of Service govern your access to and use of Lensically. By using
            Lensically, you agree to these terms and to the terms of any connected provider
            services used through the product.
          </p>
          <p className="text-sm text-slate-500">Effective date: March 14, 2026</p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Official public review URL</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The canonical public terms page for reviewer access is available at{" "}
            <a
              className="font-medium text-slate-900 underline"
              href="https://lensically.com/terms"
            >
              https://lensically.com/terms
            </a>
            .
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-xl font-semibold text-slate-900">Permitted use</h2>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-slate-700">
            {usageRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Service functionality</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Lensically currently provides account authentication, Threads account connection,
            profile discovery, keyword search, account and post insights, immediate publishing,
            scheduled posting, and account settings management.
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Certain features require a connected Threads account with valid provider permissions.
            Lensically depends on third-party APIs and may limit, modify, or remove features if
            provider policies, access scopes, quotas, or endpoint behavior changes.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Accounts, authentication, and sessions</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            You may sign in with email/password or supported OAuth providers. You are
            responsible for maintaining account security and for activity performed under
            your account session. Lensically may invalidate sessions, limit usage, or block
            access when required for security, abuse prevention, or policy compliance.
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Accounts that violate these terms or third-party platform requirements may be
            restricted, suspended, or permanently removed.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Account deletion and retention</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Lensically provides self-serve account deletion from authenticated account settings.
            Deletion is permanent and removes account-linked application data according to the
            implemented deletion flow described at{" "}
            <Link href="/data-deletion" className="font-medium text-slate-900 underline">
              https://lensically.com/data-deletion
            </Link>
            .
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            For fraud and abuse prevention, limited identity tombstones may be retained for up to
            7 days after deletion. Privacy practices are described at{" "}
            <Link href="/privacy" className="font-medium text-slate-900 underline">
              https://lensically.com/privacy
            </Link>
            .
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Disclaimers and limitation of liability</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Lensically is provided on an "as is" and "as available" basis. To the maximum extent
            permitted by law, Lensically disclaims warranties of merchantability, fitness for a
            particular purpose, and non-infringement. Lensically is not responsible for third-party
            platform outages, API failures, policy changes, or user-generated content.
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            To the maximum extent permitted by law, Lensically will not be liable for indirect,
            incidental, special, consequential, or punitive damages, or for loss of data, profits,
            or goodwill arising from use of the service.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            If you have questions about these terms or need support related to your use of
            the service, contact{" "}
            <a className="font-medium text-slate-900 underline" href="mailto:support@lensically.com">
              support@lensically.com
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
