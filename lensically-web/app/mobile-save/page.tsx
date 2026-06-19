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

type SaveState = "idle" | "ready" | "saving" | "saved" | "error";

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

async function resolveActiveThreadsUserId(): Promise<{ threadsUserId: string; accounts: ThreadsAccount[] }> {
  const storedThreadsUserId = readSelectedThreadsUserId();
  const data = await loadThreadsAccounts();
  const accounts = Array.isArray(data?.accounts)
    ? data.accounts.filter((account) => account?.threads_user_id?.trim())
    : [];
  const storedAccount = accounts.find((account) => account.threads_user_id === storedThreadsUserId);
  const activeAccount = accounts.find((account) => account.threads_user_id === data?.active_threads_user_id)
    ?? accounts.find((account) => account.is_active)
    ?? accounts[0]
    ?? null;
  const activeThreadsUserId = storedAccount?.threads_user_id?.trim()
    || activeAccount?.threads_user_id?.trim()
    || storedThreadsUserId
    || "";
  if (activeThreadsUserId) {
    writeSelectedThreadsUserId(activeThreadsUserId);
  }
  return { threadsUserId: activeThreadsUserId, accounts };
}

export default function MobileSavePage() {
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("Preparing save...");
  const [savedAccountId, setSavedAccountId] = useState("");
  const [postText, setPostText] = useState("");
  const [pendingPayload, setPendingPayload] = useState<MobileSavePayload | null>(null);
  const [accountChoices, setAccountChoices] = useState<ThreadsAccount[]>([]);
  const [selectedThreadsUserId, setSelectedThreadsUserId] = useState("");

  const statusClass = useMemo(() => {
    if (state === "saved") return "border-emerald-200 bg-emerald-50 text-emerald-900";
    if (state === "error") return "border-red-200 bg-red-50 text-red-900";
    return "border-slate-200 bg-white text-slate-900";
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    async function preparePost() {
      const payload = parsePayloadFromHash();

      if (!payload?.source_url || !payload?.post_text) {
        setState("error");
        setMessage("No Threads post was provided. Open a Threads post and tap the save bookmark again.");
        return;
      }

      setPostText(payload.post_text);
      setPendingPayload(payload);
      const resolved = await resolveActiveThreadsUserId();
      if (cancelled) return;
      setAccountChoices(resolved.accounts);
      setSelectedThreadsUserId(resolved.threadsUserId);

      if (!resolved.threadsUserId && !resolved.accounts.length) {
        setState("error");
        setMessage("Select a Lensically profile first, then tap the save bookmark again.");
        return;
      }

      setState("ready");
      setMessage("Review the capture, choose a profile, then tap Save.");
    }

    void preparePost();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    const normalizedThreadsUserId = selectedThreadsUserId.trim();
    if (!pendingPayload) {
      return;
    }
    if (!normalizedThreadsUserId) {
      setState("error");
      setMessage("Choose a Lensically profile before saving.");
      return;
    }
    writeSelectedThreadsUserId(normalizedThreadsUserId);
    setState("saving");
    setMessage("Saving to the selected Lensically profile...");

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
          {state === "ready" || state === "saving" ? (
            <div className="mt-4 flex flex-col gap-3">
              {accountChoices.length ? (
                <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                  Save to profile
                  <select
                    value={selectedThreadsUserId}
                    onChange={(event) => setSelectedThreadsUserId(event.target.value)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-base font-semibold text-slate-950"
                  >
                    <option value="">Choose profile</option>
                    {accountChoices.map((account) => (
                      <option
                        key={account.threads_user_id ?? account.account_id ?? account.username ?? ""}
                        value={account.threads_user_id ?? ""}
                      >
                        {account.name || account.label || account.username || account.account_id || account.threads_user_id}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={state === "saving" || !selectedThreadsUserId}
                className="rounded-md bg-slate-950 px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state === "saving" ? "Saving..." : "Save"}
              </button>
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
