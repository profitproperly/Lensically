/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type ProfileMenuProps = {
  avatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
  accountHref?: string;
  onDisconnectThreads?: () => Promise<void> | void;
  onLogout?: () => Promise<void> | void;
  isDisconnecting?: boolean;
  isLoggingOut?: boolean;
};

function getInitials(displayName?: string | null, email?: string | null) {
  const source = displayName?.trim() || email?.trim() || "L";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function ProfileMenu({
  avatarUrl = null,
  displayName = null,
  email = null,
  accountHref = "/account",
  onDisconnectThreads,
  onLogout,
  isDisconnecting = false,
  isLoggingOut = false,
}: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const initials = getInitials(displayName, email);
  const label = displayName?.trim() || email?.trim() || "Account";
  const isBusy = isDisconnecting || isLoggingOut;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleDisconnectThreads() {
    if (!onDisconnectThreads || isDisconnecting) {
      return;
    }

    setIsOpen(false);
    await onDisconnectThreads();
  }

  async function handleLogout() {
    if (!onLogout || isLoggingOut) {
      return;
    }

    setIsOpen(false);
    await onLogout();
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Open profile menu"
        disabled={isBusy}
        onClick={() => setIsOpen((current) => !current)}
        className="cursor-pointer rounded-full p-0 text-left transition disabled:cursor-not-allowed disabled:opacity-70"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={label}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
            {initials}
          </div>
        )}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-30 mt-3 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={label}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
              {email ? (
                <p className="truncate text-xs text-slate-500">{email}</p>
              ) : null}
            </div>
          </div>

          <div role="menu" aria-label="Profile actions" className="pt-2">
            <Link
              href={accountHref}
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="block cursor-pointer rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Account
            </Link>

            <button
              type="button"
              role="menuitem"
              onClick={() => void handleDisconnectThreads()}
              disabled={!onDisconnectThreads || isBusy}
              className="block w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect Threads"}
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => void handleLogout()}
              disabled={!onLogout || isBusy}
              className="block w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
