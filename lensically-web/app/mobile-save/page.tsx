"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";
import { readSelectedThreadsUserId, writeSelectedThreadsUserId } from "@/lib/selectedThreadsAccount";

const APP_USER_ID = "lensically";
const IMPORT_URL = buildWorkerUrl("/api/patterns/import");
const THREADS_ACCOUNTS_URL = buildWorkerUrl("/api/threads/accounts");

type MobileSavePayload = {
  platform?: string;
  source_url?: string;
  post_id?: string | null;
  author_handle?: string | null;
  post_text?: string;
  likes?: number;
  replies?: number;
  reposts?: number;
  shares?: number;
  views?: number | null;
  capture_confidence?: string;
  raw_payload?: Record<string, unknown>;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type ThreadsAccount = {
  threads_user_id?: string | null;
  account_id?: string | null;
  label?: string | null;
  username?: string | null;
  name?: string | null;
  is_active?: boolean;
};

type ThreadsAccountsResponse = {
  accounts?: ThreadsAccount[] | null;
  active_threads_user_id?: string | null;
};

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

async function loadThreadsAccounts(): Promise<ThreadsAccountsResponse | null> {
  const response = await fetch(`${THREADS_ACCOUNTS_URL}?app_user_id=${encodeURIComponent(APP_USER_ID)}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  return response.json().catch(() => null) as Promise<ThreadsAccountsResponse | null>;
}

async function resolveActiveThreadsUserId(): Promise<{ threadsUserId: string; needsChoice: boolean; accounts: ThreadsAccount[] }> {
  const storedThreadsUserId = readSelectedThreadsUserId();
  if (storedThreadsUserId) {
    return { threadsUserId: storedThreadsUserId, needsChoice: false, accounts: [] };
  }

  const data = await loadThreadsAccounts();
  const accounts = Array.isArray(data?.accounts)
    ? data.accounts.filter((account) => account?.threads_user_id?.trim())
    : [];
  if (accounts.length > 1) {
    return { threadsUserId: "", needsChoice: true, accounts };
  }
  const activeAccount = accounts.find((account) => account.threads_user_id === data?.active_threads_user_id)
    ?? accounts.find((account) => account.is_active)
    ?? accounts[0]
    ?? null;
  const activeThreadsUserId = activeAccount?.threads_user_id?.trim() ?? "";
  if (activeThreadsUserId) {
    writeSelectedThreadsUserId(activeThreadsUserId);
  }
  return { threadsUserId: activeThreadsUserId, needsChoice: false, accounts };
}

export default function MobileSavePage() {
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("Preparing save...");
  const [savedAccountId, setSavedAccountId] = useState("");
  const [postText, setPostText] = useState("");
  const [pendingPayload, setPendingPayload] = useState<MobileSavePayload | null>(null);
  const [accountChoices, setAccountChoices] = useState<ThreadsAccount[]>([]);

  const statusClass = useMemo(() => {
    if (state === "saved") return "border-emerald-200 bg-emerald-50 text-emerald-900";
    if (state === "error") return "border-red-200 bg-red-50 text-red-900";
    return "border-slate-200 bg-white text-slate-900";
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    async function importPost(payload: MobileSavePayload, threadsUserId: string) {
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
      setMessage("Saved to the selected Lensically profile.");
    }

    async function savePost() {
      const payload = parsePayloadFromHash();

      if (!payload?.source_url || !payload?.post_text) {
        setState("error");
        setMessage("No Threads post was provided. Open a Threads post and tap the save bookmark again.");
        return;
      }

      setPostText(payload.post_text);
      setPendingPayload(payload);
      const resolved = await resolveActiveThreadsUserId();

      if (resolved.needsChoice) {
        setAccountChoices(resolved.accounts);
        setState("idle");
        setMessage("Choose which Lensically profile to save this post to.");
        return;
      }

      if (!resolved.threadsUserId) {
        setState("error");
        setMessage("Select a Lensically profile first, then tap the save bookmark again.");
        return;
      }

      setState("saving");
      setMessage("Saving to the active Lensically profile...");

      try {
        await importPost(payload, resolved.threadsUserId);
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

  async function handleAccountChoice(threadsUserId: string) {
    const normalizedThreadsUserId = threadsUserId.trim();
    if (!pendingPayload || !normalizedThreadsUserId) {
      return;
    }
    writeSelectedThreadsUserId(normalizedThreadsUserId);
    setState("saving");
    setMessage("Saving to the selected Lensically profile...");
    setAccountChoices([]);

    try {
      const response = await fetch(IMPORT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          app_user_id: APP_USER_ID,
          threads_user_id: normalizedThreadsUserId,
          platform: "threads",
          capture_confidence: "mobile-bookmarklet",
          ...pendingPayload,
        }),
      });
      const data = await response.json().catch(() => null) as {
        account_id?: string;
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || `Save failed with HTTP ${response.status}`);
      }
      setSavedAccountId(data?.account_id ?? "");
      setState("saved");
      setMessage("Saved to the selected Lensically profile.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not save this Threads post.");
    }
  }

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
          {accountChoices.length ? (
            <div className="mt-4 flex flex-col gap-2">
              {accountChoices.map((account) => (
                <button
                  key={account.threads_user_id ?? account.account_id ?? account.username ?? ""}
                  type="button"
                  onClick={() => void handleAccountChoice(account.threads_user_id ?? "")}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-950"
                >
                  {account.name || account.label || account.username || account.account_id || account.threads_user_id}
                </button>
              ))}
            </div>
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
