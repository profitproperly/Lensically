"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "../lib/AuthProvider";
import HomeAccountDeletedBanner from "./HomeAccountDeletedBanner";

const productFeatures = [
  {
    title: "Threads profile insights",
    description:
      "Connect a Threads account to review profile details, post performance, and audience-facing metrics in one place.",
  },
  {
    title: "Keyword and profile discovery",
    description:
      "Search Threads data and profile information to support discovery, research, and publishing decisions.",
  },
  {
    title: "Publishing and scheduling workflows",
    description:
      "Manage content workflows tied to your connected account, including scheduling-related application records.",
  },
];

const reviewLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Data Deletion Instructions", href: "/data-deletion" },
];

export default function HomePageClient() {
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_35%,#eef2ff_100%)] text-slate-950">
      <nav className="border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/lensically-logo-white-with-black-bg.png"
              alt="Lensically logo"
              width={64}
              height={64}
              className="h-16 w-16 rounded-md"
              priority
            />
            <div>
              <span className="block text-xl font-semibold tracking-tight">Lensically</span>
              <span className="block text-xs uppercase tracking-[0.2em] text-slate-500">
                Threads analytics platform
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            <Link href="#product" className="text-sm font-medium text-slate-700 hover:text-slate-950">
              Product
            </Link>
            <Link href="#compliance" className="text-sm font-medium text-slate-700 hover:text-slate-950">
              Compliance
            </Link>
            <Link href="/privacy" className="text-sm font-medium text-slate-700 hover:text-slate-950">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm font-medium text-slate-700 hover:text-slate-950">
              Terms
            </Link>
            <Link href="/data-deletion" className="text-sm font-medium text-slate-700 hover:text-slate-950">
              Data Deletion
            </Link>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Return to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl border border-sky-700 bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((current) => !current)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 md:hidden"
          >
            Menu
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
            <div className="space-y-2">
              <Link
                href="#product"
                className="block rounded-lg px-2 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
              >
                Product
              </Link>
              <Link
                href="#compliance"
                className="block rounded-lg px-2 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
              >
                Compliance
              </Link>
              <Link
                href="/privacy"
                className="block rounded-lg px-2 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="block rounded-lg px-2 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
              >
                Terms
              </Link>
              <Link
                href="/data-deletion"
                className="block rounded-lg px-2 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
              >
                Data Deletion
              </Link>
            </div>

            <div className="mt-4 flex gap-2">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="w-full rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white"
                >
                  Return to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-center text-sm font-medium text-slate-900"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="flex-1 rounded-xl border border-sky-700 bg-sky-700 px-4 py-2 text-center text-sm font-medium text-white"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </nav>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <Suspense fallback={null}>
          <HomeAccountDeletedBanner />
        </Suspense>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] lg:items-center">
          <div className="space-y-6">
            <p className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-800">
              Public product overview
            </p>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Lensically helps Threads users analyze profiles, review insights, and manage account-connected workflows.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-slate-600">
                Lensically is a web application for Threads-related analytics and workflow support.
                Users authenticate with email/password or supported OAuth providers, connect a Threads
                account, and use product features such as profile insights, keyword research, and
                account-linked publishing workflows.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Open dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Create account
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>
          </div>

          <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="rounded-2xl bg-slate-950 p-5 text-slate-50">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
                For provider review
              </p>
              <h2 className="mt-3 text-2xl font-semibold">Public compliance links</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                The verified public site includes stable legal and compliance pages covering
                product terms, privacy practices, and account deletion instructions for
                unauthenticated visitors.
              </p>
              <div className="mt-5 space-y-3">
                {reviewLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:border-sky-400 hover:text-sky-200"
                  >
                    <span>{link.label}</span>
                    <span aria-hidden="true">↗</span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section id="product" className="grid gap-6 lg:grid-cols-3">
          {productFeatures.map((feature) => (
            <article
              key={feature.title}
              className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                Feature
              </p>
              <h2 className="mt-4 text-2xl font-semibold text-slate-950">{feature.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{feature.description}</p>
            </article>
          ))}
        </section>

        <section
          id="compliance"
          className="grid gap-6 rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]"
        >
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Privacy and deletion
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
              Public documentation for terms, privacy practices, and self-serve account deletion
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              Lensically publishes public legal and compliance pages on the root domain so users
              and provider reviewers can understand what the application does, what rules govern
              its use, what account-linked data it stores, and how deletion works without signing in.
            </p>
          </div>

          <div className="space-y-3 rounded-[24px] bg-slate-50 p-5">
            {reviewLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:border-sky-300 hover:bg-sky-50"
              >
                <span>{link.label}</span>
                <span aria-hidden="true">Open</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
