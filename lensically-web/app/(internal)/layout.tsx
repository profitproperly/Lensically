"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/lib/AuthProvider";
import { buildWorkerUrl } from "@/lib/apiClient";
import { disconnectThreadsAccount } from "@/lib/authClient";

type ThreadsMeResponse = {
  account?: {
    threads_profile_picture_url?: string;
    username?: string;
  } | null;
};

export default function InternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, logoutUser } = useAuth();
  const router = useRouter();
  const appUserId = user?.id?.trim() ?? "";
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!appUserId) {
      setAvatarUrl(null);
      return;
    }

    const controller = new AbortController();

    async function loadThreadsProfile() {
      try {
        const response = await fetch(
          `${buildWorkerUrl("/api/threads/me")}?app_user_id=${encodeURIComponent(appUserId)}`,
          {
            cache: "no-store",
            credentials: "include",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          setAvatarUrl(null);
          return;
        }

        const data = (await response.json()) as ThreadsMeResponse;
        setAvatarUrl(data.account?.threads_profile_picture_url ?? null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setAvatarUrl(null);
      }
    }

    void loadThreadsProfile();

    return () => {
      controller.abort();
    };
  }, [appUserId]);

  async function handleDisconnectThreads() {
    if (!appUserId) {
      return;
    }

    setIsDisconnecting(true);

    try {
      await disconnectThreadsAccount(appUserId);
      setAvatarUrl(null);
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
            avatarUrl={avatarUrl}
            displayName={user.email}
            email={user.email}
            accountHref="/dashboard"
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
