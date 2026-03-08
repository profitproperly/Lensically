"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAuth } from "../../../lib/AuthProvider";

type ThreadsProfile = {
  threads_profile_picture_url?: string;
  name?: string;
  username?: string;
  threads_biography?: string;
  is_verified?: boolean;
};

const CONNECT_THREADS_URL =
  "https://lensically-worker.lensically.workers.dev/api/auth/threads/start";

type ProfileState = {
  profile: ThreadsProfile | null;
  needsConnection: boolean;
  hasError: boolean;
  loading: boolean;
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { data: session } = useSession();
  const appUserId = session?.user?.email?.trim().toLowerCase();
  const [state, setState] = useState<ProfileState>({
    profile: null,
    needsConnection: true,
    hasError: false,
    loading: false,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user && !state.loading && !state.profile && state.needsConnection) {
      router.push("/connect");
    }
  }, [user, loading, state.loading, state.profile, state.needsConnection, router]);

  useEffect(() => {
    if (!appUserId) {
      return;
    }
    const controller = new AbortController();

    const loadProfile = async () => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const res = await fetch(
          `https://lensically-worker.lensically.workers.dev/api/threads/me?app_user_id=${encodeURIComponent(appUserId)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => null) as { error?: string } | null;
          const errorMessage = (errorData?.error || "").toLowerCase();
          setState({
            profile: null,
            needsConnection:
              errorMessage.includes("account not connected") ||
              errorMessage.includes("no connected account") ||
              errorMessage.includes("missing app_user_id"),
            hasError: !(
              errorMessage.includes("account not connected") ||
              errorMessage.includes("no connected account") ||
              errorMessage.includes("missing app_user_id")
            ),
            loading: false,
          });
          return;
        }

        setState({
          profile: (await res.json()) as ThreadsProfile,
          needsConnection: false,
          hasError: false,
          loading: false,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setState({
          profile: null,
          needsConnection: false,
          hasError: true,
          loading: false,
        });
      }
    };

    void loadProfile();
    return () => {
      controller.abort();
    };
  }, [appUserId]);

  const handleConnectRedirect = () => {
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.href =
      `${CONNECT_THREADS_URL}?return_to=${returnTo}&app_user_id=${encodeURIComponent(appUserId ?? "")}`;
  };

  if (loading || (user && state.loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>

      {!appUserId ? (
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
      ) : state.loading ? (
        <p className="text-sm text-slate-700">Loading profile...</p>
      ) : !state.profile && state.needsConnection ? (
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
      ) : !state.profile ? (
        <p className="text-sm text-red-600">Unable to load Threads profile.</p>
      ) : (
        <section className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <img
              src={state.profile.threads_profile_picture_url || ""}
              alt={`${state.profile.username || "Threads"} profile`}
              className="h-16 w-16 rounded-full border border-slate-200 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xl font-semibold text-slate-900">
                  {state.profile.name || "Unknown"}
                </h2>
                {state.profile.is_verified ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Verified
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                @{state.profile.username || "unknown"}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {state.profile.threads_biography || "No biography available."}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
