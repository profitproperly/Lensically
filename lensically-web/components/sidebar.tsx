/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthProvider";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/insights", label: "Insights" },
  { href: "/schedule", label: "Schedule Posts" },
  { href: "/search", label: "Keyword Search" },
  { href: "/discovery", label: "Profile Discovery" },
];

type ThreadsMeResponse = {
  username?: string;
  threads_profile_picture_url?: string;
};

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isConnectPage = pathname === "/connect";
  const appUserId = user?.id?.trim() ?? "";
  const [username, setUsername] = useState<string>("unknown");
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isConnectPage || !appUserId) {
      return;
    }

    const loadProfile = async () => {
      try {
        const res = await fetch(
          `https://lensically-worker.lensically.workers.dev/api/threads/me?app_user_id=${encodeURIComponent(appUserId)}`,
          { cache: "no-store", credentials: "include" },
        );
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as ThreadsMeResponse;
        setUsername(data.username || "unknown");
        setProfilePictureUrl(data.threads_profile_picture_url ?? null);
      } catch {
        // Ignore profile load errors to keep sidebar usable.
      }
    };

    void loadProfile();
  }, [appUserId, isConnectPage]);

  return (
    <aside className="sticky top-16 h-[calc(100vh-4rem)] w-72 shrink-0 border-r border-slate-200 bg-white pt-6 flex flex-col items-start">
      {!isConnectPage && (
        <div className="flex flex-col items-center w-full mt-6 mb-8">
          <div className="relative group cursor-pointer">
            <a
              href={`https://www.threads.net/@${username}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {profilePictureUrl ? (
                <img
                  src={profilePictureUrl}
                  alt={`@${username}`}
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
          <p className="text-base font-semibold text-slate-900 mt-3">@{username}</p>
        </div>
      )}

      <nav className="w-full space-y-2">
        {links.map((link) => (
          <div key={link.href} className="px-4">
            {isConnectPage ? (
              <button
                type="button"
                className={[
                  "block w-full px-6 py-3 text-[15px] font-medium rounded-xl transition-colors text-left",
                  pathname === link.href
                    ? "bg-black text-white"
                    : "text-black hover:bg-black hover:text-white",
                ].join(" ")}
              >
                {link.label}
              </button>
            ) : (
              <Link
                href={link.href}
                className={[
                  "block w-full px-6 py-3 text-[15px] font-medium rounded-xl transition-colors",
                  pathname === link.href
                    ? "bg-black text-white"
                    : "text-black hover:bg-black hover:text-white",
                ].join(" ")}
              >
                {link.label}
              </Link>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
