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
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white pt-6 flex flex-col items-center">
      <div className="mt-6 mb-6 flex flex-col items-center">
        {profilePictureUrl ? (
          <img
            src={profilePictureUrl}
            alt={`@${username}`}
            className="h-12 w-12 rounded-full"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-slate-200" />
        )}
        <p className="text-sm font-semibold text-slate-900 mt-2">@{username}</p>
      </div>

      <nav className="w-full px-4 space-y-1">
        {links.map((link) => (
          <div key={link.href} className="relative group">
            <div
              className={[
                "absolute left-0 top-0 h-full w-1 opacity-0 group-hover:opacity-100",
                pathname === link.href ? "opacity-100 bg-slate-400" : "bg-slate-300",
              ].join(" ")}
            />
            <Link
              href={link.href}
              className={[
                "block px-3 py-2 text-sm rounded-lg",
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
