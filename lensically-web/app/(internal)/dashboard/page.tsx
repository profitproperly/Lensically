"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/AuthProvider";
import { buildWorkerUrl } from "../../../lib/apiClient";

type ThreadsProfile = {
  threads_profile_picture_url?: string;
  name?: string;
  username?: string;
  threads_biography?: string;
  is_verified?: boolean;
};

type ThreadsMeResponse = {
  connected?: boolean;
  account?: ThreadsProfile | null;
};

const CONNECT_THREADS_URL = buildWorkerUrl("/api/auth/threads/start");
const THREADS_ME_URL = buildWorkerUrl("/api/threads/me");

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
    if (!loading && user && !loadingConnection && !isConnected) {
      router.replace("/connect");
    }
  }, [user, loading, loadingConnection, isConnected, router]);

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
          setIsConnected(false);
          setProfile(null);
          setHasError(res.status !== 401);
          return;
        }

        const data = (await res.json()) as ThreadsMeResponse;
        const isConnected = Boolean(data.account);
        setIsConnected(isConnected);
        setProfile(isConnected ? (data.account ?? null) : null);
        setHasError(false);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setIsConnected(false);
        setProfile(null);
        setHasError(true);
      } finally {
        setLoadingConnection(false);
      }
    }

    void checkConnection();
    return () => {
      controller.abort();
    };
  }, [appUserId, loading]);

  const handleConnectRedirect = () => {
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.href =
      `${CONNECT_THREADS_URL}?return_to=${returnTo}&app_user_id=${encodeURIComponent(appUserId)}`;
  };

  if (loading || loadingConnection) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>

      {!profile && isConnected ? (
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
                  {profile.name || "Unknown"}
                </h2>
                {profile.is_verified ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Verified
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                @{profile.username || "unknown"}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {profile.threads_biography || "No biography available."}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
