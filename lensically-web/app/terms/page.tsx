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
  "Use the application only for lawful purposes and only with accounts and data you are authorized to access.",
  "Do not attempt to bypass authentication, access controls, rate limits, or provider restrictions.",
  "Do not interfere with the service, abuse platform features, or use Lensically to violate third-party terms.",
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
            These terms describe the basic rules for accessing and using Lensically. By
            using the application, you agree to follow these terms and any applicable
            provider platform requirements connected to your use of the service.
          </p>
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
          <h2 className="text-xl font-semibold text-slate-900">Using Lensically</h2>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-slate-700">
            {usageRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Accounts and connected services</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Some Lensically features require an authenticated account and a connected Threads
            account or supported OAuth sign-in provider. You are responsible for maintaining
            the accuracy of your account information and for using connected services in
            compliance with the applicable provider terms.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Account deletion and access</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Lensically provides self-serve account deletion from the authenticated account
            settings area. When an account is permanently deleted, associated application
            records tied to that user are removed from the system according to the product’s
            implemented deletion flow.
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Privacy practices are described at{" "}
            <Link href="/privacy" className="font-medium text-slate-900 underline">
              https://lensically.com/privacy
            </Link>
            , and public deletion instructions are available at{" "}
            <Link href="/data-deletion" className="font-medium text-slate-900 underline">
              https://lensically.com/data-deletion
            </Link>
            .
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
