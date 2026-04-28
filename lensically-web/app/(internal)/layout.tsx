"use client";

import Image from "next/image";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";

export default function InternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image
            src="/lensically-logo-white-with-black-bg.png"
            alt="Lensically"
            width={64}
            height={64}
            className="h-16 w-16 rounded-md"
            priority
          />
          <span className="text-lg font-semibold text-slate-900">Lensically</span>
        </Link>

        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-slate-900">Manifest Mental</p>
          <p className="text-xs text-slate-500">@manifestmental</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col xl:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
