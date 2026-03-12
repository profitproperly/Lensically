"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/lib/AuthProvider";
import { disconnectThreadsAccount } from "@/lib/authClient";

export default function InternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, loading, logoutUser } = useAuth();
  const router = useRouter();
  const appUserId = user?.id?.trim() ?? "";
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  async function handleDisconnectThreads() {
    if (!appUserId) {
      return;
    }

    setIsDisconnecting(true);

    try {
      await disconnectThreadsAccount(appUserId);
      router.push("/connect");
      router.refresh();
    } finally {
      setIsDisconnecting(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logoutUser();
      router.push("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-700">Loading session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-amber-900">Session expired</h1>
          <p className="mt-2 text-sm text-amber-900">
            Your session is no longer active. Log in again to continue.
          </p>
          <div className="mt-4">
            <Link
              href="/login"
              className="inline-flex cursor-pointer rounded-md border border-amber-700 bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
            >
              Log in again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/lensically-logo-white-with-black-bg.png"
            alt="Lensically"
            width={64}
            height={64}
            className="h-16 w-16 rounded-md"
          />
          <span className="text-lg font-semibold text-slate-900">Lensically</span>
        </Link>

        {user ? (
          <ProfileMenu
            displayName={null}
            email={user.email}
            accountHref="/account"
            onDisconnectThreads={handleDisconnectThreads}
            onLogout={handleLogout}
            isDisconnecting={isDisconnecting}
            isLoggingOut={isLoggingOut}
          />
        ) : null}
      </header>

      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
