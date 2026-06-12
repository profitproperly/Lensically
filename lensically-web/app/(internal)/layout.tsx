"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { ThreadsAccountSwitcher } from "@/components/ThreadsAccountSwitcher";

export default function InternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileNavOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 xl:hidden"
            aria-label="Open navigation menu"
            aria-expanded={isMobileNavOpen}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Image
            src="/lensically-logo-white-with-black-bg.png"
            alt="Lensically"
            width={64}
            height={64}
            className="h-12 w-12 rounded-md sm:h-16 sm:w-16"
            priority
          />
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="text-lg font-semibold text-slate-900 sm:text-[1.35rem]">Lensically</span>
          </Link>
        </div>

        <div className="hidden sm:block">
          <ThreadsAccountSwitcher />
        </div>
      </header>

      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-slate-900/45"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <div className="relative h-full w-[min(86vw,22rem)] overflow-y-auto border-r border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Navigation</p>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700"
                aria-label="Close navigation menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <Sidebar mobile onNavigate={() => setIsMobileNavOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col xl:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
