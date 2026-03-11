"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../lib/AuthProvider";

const tools = [
  { label: "Insights", href: "#" },
  { label: "Schedule Posts", href: "#" },
  { label: "Keyword Search", href: "#" },
  { label: "Profile Discovery", href: "#" },
];

export default function Home() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isAuthenticated = Boolean(user);
  const accountDeleted = searchParams.get("accountDeleted") === "1";
  const [desktopToolsOpen, setDesktopToolsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);

  const handleDesktopBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDesktopToolsOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <nav className="border-b border-slate-200">
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
            <span className="text-xl font-semibold tracking-tight">Lensically</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <div
              className="relative"
              onMouseEnter={() => setDesktopToolsOpen(true)}
              onMouseLeave={() => setDesktopToolsOpen(false)}
              onFocus={() => setDesktopToolsOpen(true)}
              onBlur={handleDesktopBlur}
            >
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={desktopToolsOpen}
                onClick={() => setDesktopToolsOpen((current) => !current)}
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-900"
              >
                Tools
                <span aria-hidden="true" className="text-[0.8em]">
                  ▼
                </span>
              </button>

              {desktopToolsOpen && (
                <div className="absolute left-0 top-full z-20 pt-2">
                  <div
                    role="menu"
                    className="min-w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
                  >
                    {tools.map((tool) => (
                      <Link
                        key={tool.label}
                        href={tool.href}
                        role="menuitem"
                        className="block rounded-lg px-3 py-2 text-sm text-slate-800 hover:bg-black hover:text-white focus:bg-black focus:text-white"
                      >
                        {tool.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link href="#" className="text-sm font-medium text-slate-900">
              Pricing
            </Link>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Return to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl border border-black bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-slate-100"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
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
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium md:hidden"
          >
            Menu
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 px-4 py-4 md:hidden">
            <div className="space-y-3">
              <button
                type="button"
                aria-expanded={mobileToolsOpen}
                onClick={() => setMobileToolsOpen((current) => !current)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-medium"
              >
                Tools
                <span aria-hidden="true">{mobileToolsOpen ? "▲" : "▼"}</span>
              </button>

              {mobileToolsOpen && (
                <div className="space-y-1 pl-2">
                  {tools.map((tool) => (
                    <Link
                      key={tool.label}
                      href={tool.href}
                      className="block rounded-lg px-2 py-2 text-sm text-slate-800 hover:bg-slate-100"
                    >
                      {tool.label}
                    </Link>
                  ))}
                </div>
              )}

              <Link href="#" className="block rounded-lg px-2 py-2 text-sm font-medium text-slate-900">
                Pricing
              </Link>

              <div className="flex gap-2 pt-2">
                {isAuthenticated ? (
                  <Link
                    href="/dashboard"
                    className="w-full rounded-xl border border-black bg-black px-4 py-2 text-center text-sm font-medium text-white"
                  >
                    Return to Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="flex-1 rounded-xl border border-black bg-white px-4 py-2 text-center text-sm font-medium text-black"
                    >
                      Log in
                    </Link>
                    <Link
                      href="/signup"
                      className="flex-1 rounded-xl border border-black bg-black px-4 py-2 text-center text-sm font-medium text-white"
                    >
                      Sign up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-16 sm:px-6 lg:px-8">
        {accountDeleted ? (
          <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-900">
            Your account has been permanently deleted and associated application data has been removed.
          </div>
        ) : null}

        <div className="h-64 w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50" />
      </main>
    </div>
  );
}
