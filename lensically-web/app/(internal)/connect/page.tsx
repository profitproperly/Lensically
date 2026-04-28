"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearThreadsConnectionCache } from "../../../lib/threadsConnectionCache";
import { markThreadsOauthPending } from "../../../lib/threadsOauth";
import { CONNECT_THREADS_URL, CURRENT_USER_URL } from "../../../lib/threadsApi";

type AuthMeUser = {
  id: string;
  email: string;
  email_verified: boolean;
};

function ConnectPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authUser, setAuthUser] = useState<AuthMeUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const connectError = searchParams.get("error")?.trim().toLowerCase() ?? "";
  const isAddMode = searchParams.get("mode")?.trim().toLowerCase() === "add";
  const returnedThreadsUsername = searchParams.get("returned_threads_username")?.trim().toLowerCase() ?? "";
  const [expectedUsernameInput, setExpectedUsernameInput] = useState(
    searchParams.get("expected_threads_username")?.trim() ?? "",
  );

  const normalizedExpectedUsername = useMemo(() => {
    const stripped = expectedUsernameInput.trim().replace(/^@+/, "").toLowerCase();
    if (!stripped) {
      return "";
    }
    if (!/^[a-z0-9._]{1,30}$/.test(stripped)) {
      return "";
    }
    return stripped;
  }, [expectedUsernameInput]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      setLoadingUser(true);
      try {
        const response = await fetch(CURRENT_USER_URL, {
          credentials: "include",
        });
        if (!isMounted) {
          return;
        }
        if (response.status === 200) {
          const data = await response.json();
          setAuthUser({
            id: String(data.id),
            email: typeof data.email === "string" ? data.email : "",
            email_verified: Boolean(data.email_verified),
          });
          return;
        }
        if (response.status === 401) {
          setAuthUser(null);
          router.replace("/login");
        } else {
          setAuthUser(null);
        }
      } catch {
        if (isMounted) {
          setAuthUser(null);
        }
      } finally {
        if (isMounted) {
          setLoadingUser(false);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const destinationUrl = useMemo(() => {
    if (!authUser?.id || typeof window === "undefined") {
      return "";
    }
    const modeSuffix = isAddMode ? "&mode=add" : "";
    const expectedUsernameSuffix =
      isAddMode && normalizedExpectedUsername
        ? `&expected_threads_username=${encodeURIComponent(normalizedExpectedUsername)}`
        : "";
    return `${CONNECT_THREADS_URL}?return_to=${encodeURIComponent(window.location.origin)}&app_user_id=${encodeURIComponent(authUser.id)}${modeSuffix}${expectedUsernameSuffix}`;
  }, [authUser?.id, isAddMode, normalizedExpectedUsername]);

  const connectDisabled = loadingUser || (isAddMode && !normalizedExpectedUsername);

  return (
    <div className="flex-1 flex items-start justify-center pt-32">
      <div className="max-w-xl w-full bg-white rounded-xl shadow p-8 text-center">
        <div className="text-center flex flex-col items-center gap-4">
          <h2 className="text-2xl font-semibold text-black">Connect Threads to Continue</h2>
          <p className="text-gray-600">
            {isAddMode
              ? "Connect an additional Threads account."
              : "You must connect your Threads account to use Lensically."}
          </p>
          {isAddMode ? (
            <div className="w-full max-w-md rounded-md border border-slate-200 bg-slate-50 p-3 text-left">
              <label htmlFor="expected-threads-username" className="block text-sm font-medium text-slate-900">
                Threads username to connect
              </label>
              <input
                id="expected-threads-username"
                type="text"
                value={expectedUsernameInput}
                onChange={(event) => {
                  setExpectedUsernameInput(event.target.value);
                }}
                placeholder="@username"
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
              <p className="mt-2 text-xs text-slate-600">
                Enter the exact account you want to add. Lensically will reject OAuth if Meta returns a different account.
              </p>
            </div>
          ) : null}
          {connectError === "same_account_selected" ? (
            <p className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Threads returned the same account again. Switch to the other Threads account in the provider login flow, then retry.
            </p>
          ) : null}
          {connectError === "wrong_account_selected" ? (
            <p className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              The connected account did not match the username you entered.
              {returnedThreadsUsername ? ` Meta returned @${returnedThreadsUsername}.` : ""}
              {" "}Switch accounts in Meta/Threads and try again.
            </p>
          ) : null}
          <div className="w-full flex justify-center">
            <button
              type="button"
              onClick={() => {
                if (!authUser?.id || !destinationUrl) {
                  router.push("/login");
                  return;
                }
                clearThreadsConnectionCache(authUser.id);
                markThreadsOauthPending();
                window.location.href = destinationUrl;
              }}
              disabled={connectDisabled}
              className="bg-black text-white px-6 py-2 rounded-lg hover:bg-neutral-800 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isAddMode ? "Connect This Account" : "Connect Threads"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-start justify-center pt-32">
          <div className="max-w-xl w-full bg-white rounded-xl shadow p-8 text-center">
            <p className="text-sm text-slate-700">Loading connection flow...</p>
          </div>
        </div>
      }
    >
      <ConnectPageContent />
    </Suspense>
  );
}
