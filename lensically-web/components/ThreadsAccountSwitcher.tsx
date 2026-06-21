/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";
import {
  appendAppUserId,
  readSelectedThreadsUserId,
  SELECTED_THREADS_ACCOUNT_EVENT,
  writeSelectedThreadsUserId,
} from "@/lib/selectedThreadsAccount";

type ThreadsAccount = {
  account_id?: string | null;
  threads_user_id?: string | null;
  username?: string | null;
  name?: string | null;
  label?: string | null;
  is_active?: boolean;
  threads_profile_picture_url?: string | null;
};

type ThreadsAccountsResponse = {
  accounts?: ThreadsAccount[] | null;
  active_threads_user_id?: string | null;
};

const THREADS_ACCOUNTS_URL = buildWorkerUrl("/api/threads/accounts");
const APP_USER_ID = "workspace-owner";

export function ThreadsAccountSwitcher() {
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [selectedThreadsUserId, setSelectedThreadsUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadAccounts() {
      setIsLoading(true);
      try {
        const response = await fetch(appendAppUserId(THREADS_ACCOUNTS_URL, APP_USER_ID), {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as ThreadsAccountsResponse;
        if (!isMounted) {
          return;
        }

        const nextAccounts = Array.isArray(data.accounts)
          ? data.accounts.filter((account) => account?.threads_user_id?.trim())
          : [];
        setAccounts(nextAccounts);

        const savedThreadsUserId = readSelectedThreadsUserId();
        const savedAccount = nextAccounts.find((account) => account.threads_user_id === savedThreadsUserId);
        const activeAccount = nextAccounts.find((account) => account.threads_user_id === data.active_threads_user_id)
          ?? nextAccounts.find((account) => account.is_active)
          ?? nextAccounts[0]
          ?? null;
        const nextSelectedThreadsUserId = savedAccount?.threads_user_id?.trim()
          || activeAccount?.threads_user_id?.trim()
          || "";
        setSelectedThreadsUserId(nextSelectedThreadsUserId);
        if (nextSelectedThreadsUserId && nextSelectedThreadsUserId !== savedThreadsUserId) {
          writeSelectedThreadsUserId(nextSelectedThreadsUserId);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAccounts([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadAccounts();

    const handleSelectedAccount = (event: Event) => {
      const nextThreadsUserId = (event as CustomEvent<{ threadsUserId?: string }>).detail?.threadsUserId?.trim() ?? "";
      setSelectedThreadsUserId(nextThreadsUserId);
    };
    window.addEventListener(SELECTED_THREADS_ACCOUNT_EVENT, handleSelectedAccount);

    return () => {
      isMounted = false;
      controller.abort();
      window.removeEventListener(SELECTED_THREADS_ACCOUNT_EVENT, handleSelectedAccount);
    };
  }, []);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.threads_user_id === selectedThreadsUserId) ?? accounts[0] ?? null,
    [accounts, selectedThreadsUserId],
  );

  function handleChange(value: string) {
    setSelectedThreadsUserId(value);
    writeSelectedThreadsUserId(value);
  }

  if (isLoading && !selectedAccount) {
    return (
      <div className="text-right">
        <p className="text-sm font-medium text-slate-900">Loading account...</p>
        <p className="text-xs text-slate-500">Threads</p>
      </div>
    );
  }

  if (!selectedAccount) {
    return (
      <div className="text-right">
        <p className="text-sm font-medium text-slate-900">No account</p>
        <p className="text-xs text-slate-500">Threads disconnected</p>
      </div>
    );
  }

  const selectedName = selectedAccount.name || selectedAccount.label || selectedAccount.username || "Threads";
  const selectedUsername = selectedAccount.username ? `@${selectedAccount.username}` : "Threads account";

  return (
    <div className="flex items-center justify-end gap-3">
      {selectedAccount.threads_profile_picture_url ? (
        <img
          src={selectedAccount.threads_profile_picture_url}
          alt={selectedUsername}
          className="hidden h-9 w-9 rounded-full sm:block"
        />
      ) : null}
      <div className="min-w-0 text-right">
        <label htmlFor="threads-account-switcher" className="sr-only">
          Threads account
        </label>
        {accounts.length > 1 ? (
          <select
            id="threads-account-switcher"
            value={selectedAccount.threads_user_id ?? ""}
            onChange={(event) => handleChange(event.target.value)}
            className="max-w-48 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-900 shadow-sm"
          >
            {accounts.map((account) => (
              <option key={account.threads_user_id ?? account.username ?? ""} value={account.threads_user_id ?? ""}>
                {account.name || account.label || account.username || account.threads_user_id}
              </option>
            ))}
          </select>
        ) : (
          <p className="truncate text-sm font-medium text-slate-900">{selectedName}</p>
        )}
        <p className="truncate text-xs text-slate-500">{selectedUsername}</p>
      </div>
    </div>
  );
}
