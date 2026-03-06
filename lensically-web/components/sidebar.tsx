/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  const [username, setUsername] = useState<string>("unknown");
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch(
          "https://lensically-worker.lensically.workers.dev/api/threads/me",
          { cache: "no-store" },
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
  }, []);

  return (
    <aside className="w-72 shrink-0 border-r border-slate-200 bg-white pt-6 flex flex-col items-start">
      <div className="flex flex-col items-center w-full mt-6 mb-8">
        <a
          href={`https://www.threads.net/@${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-90"
        >
          {profilePictureUrl ? (
            <img
              src={profilePictureUrl}
              alt={`@${username}`}
              className="h-16 w-16 rounded-full"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-slate-200" />
          )}
        </a>
        <p className="text-base font-semibold text-slate-900 mt-3">@{username}</p>
      </div>

      <nav className="w-full px-4 space-y-2">
        {links.map((link) => (
          <div key={link.href} className="relative group">
            <div
              className={[
                "absolute left-0 top-0 h-full w-[2px] opacity-0 group-hover:opacity-100",
                pathname === link.href ? "opacity-100 bg-slate-500" : "bg-slate-300",
              ].join(" ")}
            />
            <Link
              href={link.href}
              className={[
                "block px-4 py-3 text-[15px] font-medium rounded-xl",
                pathname === link.href
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-50",
              ].join(" ")}
            >
              {link.label}
            </Link>
          </div>
        ))}
      </nav>
    </aside>
  );
}
