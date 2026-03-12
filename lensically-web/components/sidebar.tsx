/* eslint-disable @next/next/no-img-element */
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthProvider";
import { buildWorkerUrl } from "../lib/apiClient";
import { preloadRouteDataForNavigation } from "../lib/routeDataPrefetch";
import {
  readThreadsProfileCache,
  writeThreadsProfileCache,
} from "../lib/threadsProfileCache";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/insights", label: "Insights" },
  { href: "/schedule", label: "Schedule Posts" },
  { href: "/search", label: "Keyword Search" },
  { href: "/discovery", label: "Profile Discovery" },
  { href: "/account", label: "Account Settings" },
];

type ThreadsMeResponse = {
  username?: string;
  threads_profile_picture_url?: string;
};

const THREADS_ME_URL = buildWorkerUrl("/api/threads/me");

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const currentPath = String(pathname ?? "");
  const isActivePath = (href: string) => currentPath === String(href);
  const { user } = useAuth();
  const isConnectPage = isActivePath("/connect");
  const isAccountPage = isActivePath("/account");
  const showThreadsProfile = !isConnectPage && !isAccountPage;
  const appUserId = user?.id?.trim() ?? "";
  const cachedProfile = appUserId ? readThreadsProfileCache(appUserId) : null;
  const [username, setUsername] = useState<string>("unknown");
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);
  const displayUsername = username || cachedProfile?.account?.username || "unknown";
  const displayProfilePictureUrl = profilePictureUrl ?? cachedProfile?.account?.threads_profile_picture_url ?? null;

  useEffect(() => {
    if (!showThreadsProfile || !appUserId) {
      return;
    }

    const loadProfile = async () => {
      try {
        const res = await fetch(
          `${THREADS_ME_URL}?app_user_id=${encodeURIComponent(appUserId)}`,
          { cache: "no-store", credentials: "include" },
        );
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as ThreadsMeResponse;
        setUsername(data.username || "unknown");
        setProfilePictureUrl(data.threads_profile_picture_url ?? null);
        writeThreadsProfileCache(appUserId, {
          username: data.username ?? null,
          threads_profile_picture_url: data.threads_profile_picture_url ?? null,
        });
      } catch {
        // Ignore profile load errors to keep sidebar usable.
      }
    };

    void loadProfile();
  }, [appUserId, showThreadsProfile]);

  async function handleSidebarNavigation(href: string) {
    if (!href || isActivePath(href) || pendingNavigationHref) {
      return;
    }

    setPendingNavigationHref(href);

    try {
      router.prefetch(href);
      await preloadRouteDataForNavigation(href, appUserId);
      router.push(href);
    } finally {
      setPendingNavigationHref(null);
    }
  }

  return (
    <aside className="sticky top-16 h-[calc(100vh-4rem)] w-72 shrink-0 border-r border-slate-200 bg-white pt-6 flex flex-col items-start">
      {showThreadsProfile && (
        <div className="flex flex-col items-center w-full mt-6 mb-8">
          <div className="relative group cursor-pointer">
            <a
              href={`https://www.threads.net/@${displayUsername}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {displayProfilePictureUrl ? (
                <img
                  src={displayProfilePictureUrl || ""}
                  alt={`@${displayUsername}`}
                  className="h-32 w-32 rounded-full"
                />
              ) : (
                <div className="h-32 w-32 rounded-full bg-slate-200" />
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M7 7h10v10" />
                </svg>
              </div>
            </a>
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 text-white text-xs px-3 py-1 opacity-0 group-hover:opacity-100 transition">
              Open Threads Profile
            </div>
          </div>
          <p className="text-base font-semibold text-slate-900 mt-3">@{displayUsername}</p>
        </div>
      )}

      <nav className="w-full space-y-2">
        {links.map((link) => (
          <div key={link.href} className="px-4">
            {(() => {
              const isActive = isActivePath(link.href);
              const isNavigatingToLink = pendingNavigationHref === link.href;
              const isNavigationDisabled = Boolean(pendingNavigationHref);
              const label = isNavigatingToLink ? `Loading ${link.label}...` : link.label;

              if (isConnectPage && link.href !== "/account") {
                return (
                  <button
                    type="button"
                    disabled
                    className={[
                      "block w-full px-6 py-3 text-[15px] font-medium rounded-xl transition-colors text-left",
                      isActive ? "bg-black text-white" : "text-black hover:bg-black hover:text-white",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                    ].join(" ")}
                  >
                    {link.label}
                  </button>
                );
              }

              return (
                <button
                  type="button"
                  onClick={() => void handleSidebarNavigation(link.href)}
                  disabled={isNavigationDisabled}
                  aria-busy={isNavigatingToLink}
                  className={[
                    "block w-full px-6 py-3 text-[15px] font-medium rounded-xl transition-colors text-left cursor-pointer",
                    isActive ? "bg-black text-white" : "text-black hover:bg-black hover:text-white",
                    isNavigatingToLink ? "cursor-wait opacity-80" : "",
                    isNavigationDisabled ? "disabled:cursor-not-allowed disabled:opacity-60" : "",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })()}
          </div>
        ))}
      </nav>
    </aside>
  );
}
