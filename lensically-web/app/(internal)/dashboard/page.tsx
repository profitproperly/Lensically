"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/AuthProvider";
import { CONNECT_THREADS_URL, THREADS_ME_URL } from "../../../lib/threadsApi";
import {
  clearThreadsOauthPending,
  hasRecentThreadsOauthPending,
  markThreadsOauthPending,
} from "../../../lib/threadsOauth";
import {
  clearThreadsProfileCache,
  readThreadsProfileCache,
  writeThreadsProfileCache,
} from "../../../lib/threadsProfileCache";

type ThreadsProfile = {
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

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const appUserId = user?.id?.trim() ?? "";
  const [loadingConnection, setLoadingConnection] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [profile, setProfile] = useState<ThreadsProfile | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!appUserId) {
      return;
    }

    const cachedProfile = readThreadsProfileCache(appUserId);
    if (!cachedProfile?.account) {
      return;
    }

    setIsConnected(true);
    setProfile(cachedProfile.account);
    setHasError(false);
    setLoadingConnection(false);
  }, [appUserId]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!appUserId) {
      setIsConnected(false);
      setProfile(null);
      setHasError(false);
      setLoadingConnection(false);
      return;
    }
    const controller = new AbortController();
    const cachedProfile = readThreadsProfileCache(appUserId);
    const hasCachedAccount = Boolean(cachedProfile?.account);

    async function checkConnection() {
      if (!hasCachedAccount) {
        setLoadingConnection(true);
      }
      setHasError(false);
      const shouldWaitForOauth = hasRecentThreadsOauthPending();
      const maxAttempts = shouldWaitForOauth ? 8 : 1;

      try {
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          const res = await fetch(
            `${THREADS_ME_URL}?app_user_id=${encodeURIComponent(appUserId)}`,
            {
              cache: "no-store",
              credentials: "include",
              signal: controller.signal,
            },
          );

          if (!res.ok) {
            if (!hasCachedAccount) {
              setIsConnected(false);
              setProfile(null);
              setHasError(res.status !== 401);
              clearThreadsProfileCache(appUserId);
              clearThreadsOauthPending();
            }
            return;
          }

          const data = (await res.json()) as ThreadsMeResponse;
          const isConnected = Boolean(data.account);

          if (isConnected) {
            setIsConnected(true);
            setProfile(data.account ?? null);
            setHasError(false);
            writeThreadsProfileCache(appUserId, data.account ?? null);
            clearThreadsOauthPending();
            return;
          }

          if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        if (!hasCachedAccount) {
          setIsConnected(false);
          setProfile(null);
          setHasError(false);
          clearThreadsProfileCache(appUserId);
          clearThreadsOauthPending();
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (!hasCachedAccount) {
          setIsConnected(false);
          setProfile(null);
          setHasError(true);
          clearThreadsOauthPending();
        }
      } finally {
        if (!hasCachedAccount) {
          setLoadingConnection(false);
        }
      }
    }

    void checkConnection();
    return () => {
      controller.abort();
    };
  }, [appUserId, loading]);

  const handleConnectRedirect = () => {
    const returnTo = encodeURIComponent(window.location.origin);
    markThreadsOauthPending();
    window.location.href =
      `${CONNECT_THREADS_URL}?return_to=${returnTo}&app_user_id=${encodeURIComponent(appUserId)}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>

      {loadingConnection ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">Loading Threads profile...</p>
        </div>
      ) : !profile && isConnected ? (
        <p className="text-sm text-red-600">Unable to load Threads profile.</p>
      ) : !profile ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">
            Connect your Threads account to load your profile.
          </p>
          <button
            type="button"
            onClick={handleConnectRedirect}
            className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Connect Threads
          </button>
        </div>
      ) : hasError ? (
        <p className="text-sm text-red-600">Unable to load Threads profile.</p>
      ) : (
        <section className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <img
              src={profile.threads_profile_picture_url || ""}
              alt={`${profile.username || "Threads"} profile`}
              className="h-16 w-16 rounded-full border border-slate-200 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xl font-semibold text-slate-900">
                  {profile.name || (profile.username ? `@${profile.username}` : "")}
                </h2>
                {profile.is_verified ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Verified
                  </span>
                ) : null}
              </div>
              {profile.username ? (
                <p className="mt-1 text-sm text-slate-600">
                  @{profile.username}
                </p>
              ) : null}
              {profile.threads_biography ? (
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {profile.threads_biography}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
