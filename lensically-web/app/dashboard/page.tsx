type ThreadsProfile = {
  threads_profile_picture_url?: string;
  name?: string;
  username?: string;
  threads_biography?: string;
  is_verified?: boolean;
};

export const runtime = "edge";
const CONNECT_THREADS_URL =
  "https://lensically-worker.lensically.workers.dev/api/auth/threads/start";

type ProfileResult = {
  profile: ThreadsProfile | null;
  needsConnection: boolean;
};

async function getProfile(): Promise<ProfileResult> {
  try {
    const res = await fetch(
      "https://lensically-worker.lensically.workers.dev/api/threads/me",
      { cache: "no-store" },
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => null) as { error?: string } | null;
      const errorMessage = (errorData?.error || "").toLowerCase();
      return {
        profile: null,
        needsConnection:
          errorMessage.includes("account not connected") ||
          errorMessage.includes("no connected account"),
      };
    }

    return {
      profile: (await res.json()) as ThreadsProfile,
      needsConnection: false,
    };
  } catch {
    return { profile: null, needsConnection: false };
  }
}

export default async function DashboardPage() {
  const { profile, needsConnection } = await getProfile();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>

      {!profile && needsConnection ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">
            Connect your Threads account to load your profile.
          </p>
          <a
            href={CONNECT_THREADS_URL}
            className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Connect Threads
          </a>
        </div>
      ) : !profile ? (
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
