"use client";

import { useEffect } from "react";
import { useAuth } from "../../../lib/AuthProvider";

const CONNECT_THREADS_URL =
  "https://lensically-worker.lensically.workers.dev/api/auth/threads/start";

export default function ConnectPage() {
  const { user } = useAuth();
  const appUserId = user?.email?.trim().toLowerCase();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

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
              onClick={() => {
                const returnTo = encodeURIComponent(window.location.origin);
                const encodedUser = encodeURIComponent(appUserId ?? "");
                window.location.href = `${CONNECT_THREADS_URL}?return_to=${returnTo}&app_user_id=${encodedUser}`;
              }}
              className="bg-black text-white px-6 py-2 rounded-lg hover:bg-neutral-800 transition"
            >
              Connect Threads
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
