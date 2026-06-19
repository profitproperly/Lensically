"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";
import { readSelectedThreadsUserId } from "@/lib/selectedThreadsAccount";

const APP_USER_ID = "lensically";
const IMPORT_URL = buildWorkerUrl("/api/patterns/import");

type MobileSavePayload = {
  platform?: string;
  source_url?: string;
  post_id?: string | null;
  author_handle?: string | null;
  post_text?: string;
  capture_confidence?: string;
  raw_payload?: Record<string, unknown>;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function parsePayloadFromHash(): MobileSavePayload | null {
  const rawHash = window.location.hash.replace(/^#/, "");
  if (!rawHash) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(rawHash);
    const parsed = JSON.parse(decoded) as MobileSavePayload;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export default function MobileSavePage() {
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("Preparing save...");
  const [savedAccountId, setSavedAccountId] = useState("");
  const [postText, setPostText] = useState("");

  const statusClass = useMemo(() => {
    if (state === "saved") return "border-emerald-200 bg-emerald-50 text-emerald-900";
    if (state === "error") return "border-red-200 bg-red-50 text-red-900";
    return "border-slate-200 bg-white text-slate-900";
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    async function savePost() {
      const payload = parsePayloadFromHash();
      const threadsUserId = readSelectedThreadsUserId();

      if (!payload?.source_url || !payload?.post_text) {
        setState("error");
        setMessage("No Threads post was provided. Open a Threads post and tap the save bookmark again.");
        return;
      }

      setPostText(payload.post_text);

      if (!threadsUserId) {
        setState("error");
        setMessage("Select a Lensically profile first, then tap the save bookmark again.");
        return;
      }

      setState("saving");
      setMessage("Saving to the active Lensically profile...");

      try {
        const response = await fetch(IMPORT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            app_user_id: APP_USER_ID,
            threads_user_id: threadsUserId,
            platform: "threads",
            capture_confidence: "mobile-bookmarklet",
            ...payload,
          }),
        });

        const data = await response.json().catch(() => null) as {
          account_id?: string;
          error?: string;
        } | null;

        if (!response.ok) {
          throw new Error(data?.error || `Save failed with HTTP ${response.status}`);
        }

        if (cancelled) return;
        setSavedAccountId(data?.account_id ?? "");
        setState("saved");
        setMessage("Saved to the active Lensically profile.");
      } catch (error) {
        if (cancelled) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "Could not save this Threads post.");
      }
    }

    void savePost();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <section className="mx-auto flex max-w-xl flex-col gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Lensically</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Mobile Save</h1>
        </div>

        <div className={`rounded-lg border p-4 shadow-sm ${statusClass}`}>
          <p className="text-base font-semibold">{message}</p>
          {savedAccountId ? (
            <p className="mt-2 text-sm opacity-80">Account: {savedAccountId}</p>
          ) : null}
        </div>

        {postText ? (
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-500">Captured post</h2>
            <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-slate-900">{postText}</p>
          </article>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
            href="/saved-patterns"
          >
            Saved Patterns
          </Link>
          <Link
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900"
            href="/dashboard"
          >
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
