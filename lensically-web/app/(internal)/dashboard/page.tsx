"use client";

import { useEffect, useState } from "react";
import { THREADS_ME_URL } from "../../../lib/threadsApi";
import {
  readThreadsProfileCache,
  writeThreadsProfileCache,
} from "../../../lib/threadsProfileCache";

type ThreadsProfile = {
  label?: string | null;
  account_id?: string | null;
  threads_user_id?: string | null;
  threads_profile_picture_url?: string | null;
  name?: string | null;
  username?: string | null;
  threads_biography?: string | null;
  is_verified?: boolean;
};

type ThreadsMeResponse = {
  connected?: boolean;
  account?: ThreadsProfile | null;
};

const WORKSPACE_APP_USER_ID = "workspace-owner";

const DEFAULT_THREADS_PROFILE: ThreadsProfile = {
  account_id: "manifest-mental",
  threads_user_id: "manifest-mental",
  label: "Manifest Mental",
  name: "Manifest Mental",
  username: "manifestmental",
  threads_biography: null,
  is_verified: false,
  threads_profile_picture_url: null,
};

export default function DashboardPage() {
  const appUserId = WORKSPACE_APP_USER_ID;
  const [loadingConnection, setLoadingConnection] = useState(false);
  const [profile, setProfile] = useState<ThreadsProfile | null>(DEFAULT_THREADS_PROFILE);
  const [hasError, setHasError] = useState(false);
  const visibleProfile = profile ?? DEFAULT_THREADS_PROFILE;

  useEffect(() => {
    if (!appUserId || profile) {
      return;
    }

    const cachedProfile = readThreadsProfileCache(appUserId);
    if (!cachedProfile?.account) {
      return;
    }

    setProfile(cachedProfile.account);
    setHasError(false);
    setLoadingConnection(false);
  }, [appUserId, profile]);

  useEffect(() => {
    const controller = new AbortController();
    async function checkConnection() {
      setLoadingConnection(true);
      setHasError(false);

      try {
        const res = await fetch(
          `${THREADS_ME_URL}?app_user_id=${encodeURIComponent(appUserId)}`,
          {
            cache: "no-store",
            credentials: "include",
            signal: controller.signal,
          },
        );

        if (!res.ok) {
          setProfile(DEFAULT_THREADS_PROFILE);
          setHasError(true);
          return;
        }

        const data = (await res.json()) as ThreadsMeResponse;
        setProfile(data.account ?? DEFAULT_THREADS_PROFILE);
        setHasError(false);
        writeThreadsProfileCache(appUserId, data.account ?? DEFAULT_THREADS_PROFILE);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setProfile(DEFAULT_THREADS_PROFILE);
        setHasError(true);
      } finally {
        setLoadingConnection(false);
      }
    }

    void checkConnection();
    return () => {
      controller.abort();
    };
  }, [appUserId]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>

      {loadingConnection ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">Loading Threads profile...</p>
        </div>
      ) : hasError ? (
        <p className="text-sm text-amber-700">
          Showing configured Threads account. The live Threads profile could not be loaded locally.
        </p>
      ) : (
        <section className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            {visibleProfile.threads_profile_picture_url ? (
              <img
                src={visibleProfile.threads_profile_picture_url}
                alt={`${visibleProfile.username || "Threads"} profile`}
                className="h-16 w-16 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-900 text-lg font-semibold text-white">
                {(visibleProfile.label || visibleProfile.name || visibleProfile.username || "MM")
                  .split(/\s+/)
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xl font-semibold text-slate-900">
                  {visibleProfile.label || visibleProfile.name || (visibleProfile.username ? `@${visibleProfile.username}` : "")}
                </h2>
                {visibleProfile.is_verified ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Verified
                  </span>
                ) : null}
              </div>
              {visibleProfile.username ? (
                <p className="mt-1 text-sm text-slate-600">
                  @{visibleProfile.username}
                </p>
              ) : null}
              {visibleProfile.threads_biography ? (
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {visibleProfile.threads_biography}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
