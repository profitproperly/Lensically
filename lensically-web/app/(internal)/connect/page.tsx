"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildWorkerUrl } from "../../../lib/apiClient";

const CONNECT_THREADS_URL = buildWorkerUrl("/api/auth/threads/start");
const CURRENT_USER_URL = buildWorkerUrl("/api/auth/me");

type AuthMeUser = {
  id: string;
  email: string;
  email_verified: boolean;
};

export default function ConnectPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthMeUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

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
    return `${CONNECT_THREADS_URL}?return_to=${encodeURIComponent(window.location.origin)}&app_user_id=${encodeURIComponent(authUser.id)}`;
  }, [authUser?.id]);

  const connectDisabled = loadingUser;

  return (
    <div className="flex-1 flex items-start justify-center pt-32">
      <div className="max-w-xl w-full bg-white rounded-xl shadow p-8 text-center">
        <div className="text-center flex flex-col items-center gap-4">
          <h2 className="text-2xl font-semibold text-black">Connect Threads to Continue</h2>
          <p className="text-gray-600">
            You must connect your Threads account to use Lensically.
          </p>
          <div className="w-full flex justify-center">
            <button
              type="button"
              onClick={() => {
                if (!authUser?.id || !destinationUrl) {
                  router.push("/login");
                  return;
                }
                window.location.href = destinationUrl;
              }}
              disabled={connectDisabled}
              className="bg-black text-white px-6 py-2 rounded-lg hover:bg-neutral-800 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Connect Threads
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
