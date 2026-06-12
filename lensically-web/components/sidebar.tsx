/* eslint-disable @next/next/no-img-element */
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buildWorkerUrl } from "../lib/apiClient";
import { preloadRouteDataForNavigation } from "../lib/routeDataPrefetch";
import {
  appendThreadsUserId,
  readSelectedThreadsUserId,
  SELECTED_THREADS_ACCOUNT_EVENT,
} from "../lib/selectedThreadsAccount";
import {
  readThreadsProfileCache,
  writeThreadsProfileCache,
} from "../lib/threadsProfileCache";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/agent", label: "Agent Control" },
  { href: "/insights", label: "Insights" },
  { href: "/saved-patterns", label: "Saved Patterns" },
  { href: "/followers", label: "Followers" },
  { href: "/post-archive", label: "Post Archive" },
  { href: "/schedule", label: "Create Post" },
  { href: "/scheduled-posts", label: "Scheduled Posts" },
];

type ThreadsMeResponse = {
  username?: string;
  threads_profile_picture_url?: string;
  account?: {
    username?: string | null;
    threads_profile_picture_url?: string | null;
  } | null;
};

const THREADS_ME_URL = buildWorkerUrl("/api/threads/me");

type SidebarProps = {
  mobile?: boolean;
  onNavigate?: () => void;
};

export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentPath = String(pathname ?? "");
  const isActivePath = (href: string) => currentPath === String(href);
  const cachedProfile = readThreadsProfileCache("workspace-owner");
  const [selectedThreadsUserId, setSelectedThreadsUserId] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);
  const displayUsername = username || cachedProfile?.account?.username || null;
  const displayProfilePictureUrl = profilePictureUrl ?? cachedProfile?.account?.threads_profile_picture_url ?? null;

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const selected = readSelectedThreadsUserId();
        setSelectedThreadsUserId(selected);
        const res = await fetch(
          appendThreadsUserId(THREADS_ME_URL, selected),
          { cache: "no-store", credentials: "include" },
        );
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as ThreadsMeResponse;
        const nextUsername = data.account?.username?.trim() || data.username?.trim() || null;
        const nextProfilePictureUrl = data.account?.threads_profile_picture_url ?? data.threads_profile_picture_url ?? null;
        setUsername(nextUsername);
        setProfilePictureUrl(nextProfilePictureUrl);
        writeThreadsProfileCache("workspace-owner", {
          username: nextUsername,
          threads_profile_picture_url: nextProfilePictureUrl,
        });
      } catch {
        // Ignore profile load errors to keep sidebar usable.
      }
    };

    void loadProfile();

    const handleSelectedAccount = (event: Event) => {
      const nextThreadsUserId = (event as CustomEvent<{ threadsUserId?: string }>).detail?.threadsUserId?.trim() ?? "";
      setSelectedThreadsUserId(nextThreadsUserId);
      setUsername(null);
      setProfilePictureUrl(null);
      void loadProfile();
    };
    window.addEventListener(SELECTED_THREADS_ACCOUNT_EVENT, handleSelectedAccount);

    return () => {
      window.removeEventListener(SELECTED_THREADS_ACCOUNT_EVENT, handleSelectedAccount);
    };
  }, []);

  useEffect(() => {
    if (!displayUsername) {
      return;
    }
    setUsername(displayUsername);
  }, [displayUsername, selectedThreadsUserId]);

  async function handleSidebarNavigation(href: string) {
    if (!href || isActivePath(href) || pendingNavigationHref) {
      return;
    }

    setPendingNavigationHref(href);

    try {
      router.prefetch(href);
      const destinationHref = await preloadRouteDataForNavigation(href, "workspace-owner");
      router.push(destinationHref);
      onNavigate?.();
    } finally {
      setPendingNavigationHref(null);
    }
  }

  const asideClassName = mobile
    ? "flex h-full w-full flex-col bg-white"
    : "hidden shrink-0 overflow-y-auto bg-white xl:sticky xl:top-16 xl:flex xl:h-[calc(100vh-4rem)] xl:w-72 xl:flex-col xl:items-start xl:border-r xl:border-slate-200 xl:pt-6";

  return (
    <aside className={asideClassName}>
      <div
        className={`flex w-full flex-col items-center ${
          mobile ? "border-b border-slate-200 px-5 pb-5 pt-6" : "mb-8 mt-6"
        }`}
      >
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
                  className={`${mobile ? "h-24 w-24" : "h-32 w-32"} rounded-full`}
                />
              ) : (
                <div className={`flex items-center justify-center rounded-full bg-slate-900 font-semibold text-white ${mobile ? "h-24 w-24 text-2xl" : "h-32 w-32 text-3xl"}`}>
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

      <nav className={`w-full space-y-2 ${mobile ? "px-4 py-4" : "pb-4 xl:pb-0"}`}>
        {links.map((link) => (
          <div key={link.href} className={mobile ? undefined : "px-4"}>
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
                    "block w-full rounded-xl px-6 py-3 text-left text-[15px] font-medium transition-colors cursor-pointer",
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
