/* eslint-disable @next/next/no-img-element */
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buildWorkerUrl } from "../lib/apiClient";
import { preloadRouteDataForNavigation } from "../lib/routeDataPrefetch";
import {
  readThreadsProfileCache,
  writeThreadsProfileCache,
} from "../lib/threadsProfileCache";

const WORKSPACE_APP_USER_ID = "workspace-owner";
const DEFAULT_THREADS_USERNAME = "manifestmental";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/insights", label: "Insights" },
  { href: "/post-archive", label: "Post Archive" },
  { href: "/schedule", label: "Create Post" },
  { href: "/scheduled-posts", label: "Scheduled Posts" },
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
  const appUserId = WORKSPACE_APP_USER_ID;
  const cachedProfile = appUserId ? readThreadsProfileCache(appUserId) : null;
  const [username, setUsername] = useState<string | null>(DEFAULT_THREADS_USERNAME);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);
  const displayUsername = username || cachedProfile?.account?.username || null;
  const displayProfilePictureUrl = profilePictureUrl ?? cachedProfile?.account?.threads_profile_picture_url ?? null;

  useEffect(() => {
    if (!appUserId) {
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
        setUsername(data.username?.trim() || null);
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
  }, [appUserId]);

  useEffect(() => {
    if (!displayUsername) {
      return;
    }
    setUsername(displayUsername);
  }, [displayUsername]);

  async function handleSidebarNavigation(href: string) {
    if (!href || isActivePath(href) || pendingNavigationHref) {
      return;
    }

    setPendingNavigationHref(href);

    try {
      router.prefetch(href);
      const destinationHref = await preloadRouteDataForNavigation(href, WORKSPACE_APP_USER_ID);
      router.push(destinationHref);
    } finally {
      setPendingNavigationHref(null);
    }
  }

  return (
    <aside className="w-full shrink-0 border-b border-slate-200 bg-white pt-4 xl:sticky xl:top-16 xl:h-[calc(100vh-4rem)] xl:w-72 xl:border-b-0 xl:border-r xl:pt-6 flex flex-col items-start">
      <div className="flex flex-col items-center w-full mt-4 mb-6 xl:mt-6 xl:mb-8">
        <div className="relative group cursor-pointer">
          {displayUsername ? (
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
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-slate-900 text-3xl font-semibold text-white">
                  MM
                </div>
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
          ) : (
            <div className="h-32 w-32 rounded-full bg-slate-200 animate-pulse" />
          )}
          {displayUsername ? (
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 text-white text-xs px-3 py-1 opacity-0 group-hover:opacity-100 transition">
              Open Threads Profile
            </div>
          ) : null}
        </div>
        {displayUsername ? (
          <p className="text-base font-semibold text-slate-900 mt-3">@{displayUsername}</p>
        ) : (
          <p className="text-sm text-slate-500 mt-3">Loading profile...</p>
        )}
      </div>

      <nav className="w-full space-y-2 pb-4 xl:pb-0">
        {links.map((link) => (
          <div key={link.href} className="px-4">
            {(() => {
              const isActive = isActivePath(link.href);
              const isNavigatingToLink = pendingNavigationHref === link.href;
              const isNavigationDisabled = Boolean(pendingNavigationHref);
              const label = isNavigatingToLink ? `Loading ${link.label}...` : link.label;

              return (
                <button
                  type="button"
                  onClick={() => void handleSidebarNavigation(link.href)}
                  disabled={isNavigationDisabled}
                  aria-busy={isNavigatingToLink}
                  className={[
                    "block w-full px-6 py-3 text-[15px] font-medium rounded-xl transition-colors text-left cursor-pointer",
                    isActive ? "bg-black text-white" : "text-black hover:bg-black hover:text-white",
                    isNavigatingToLink ? "opacity-80" : "",
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
