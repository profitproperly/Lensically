"use client";

import { useEffect, useState } from "react";
import { buildWorkerUrl } from "@/lib/apiClient";

type AgentAccount = {
  account_id: string;
  label: string;
  username: string | null;
  threads_user_id: string;
  threads_profile_picture_url: string | null;
  agent_enabled: boolean;
  agent_updated_at: string | null;
};

type AgentAccountsResponse = {
  success?: boolean;
  accounts?: AgentAccount[];
  error?: string;
};

const AGENT_ACCOUNTS_URL = buildWorkerUrl("/api/agent/accounts");
const AGENT_TOGGLE_URL = buildWorkerUrl("/api/agent/accounts/toggle");

export default function AgentControlPage() {
  const [accounts, setAccounts] = useState<AgentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAccountId, setSavingAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAccounts() {
    setError(null);
    try {
      const response = await fetch(AGENT_ACCOUNTS_URL, {
        cache: "no-store",
        credentials: "include",
      });
      const data = (await response.json()) as AgentAccountsResponse;
      if (!response.ok) {
        throw new Error(data.error || "Could not load agent accounts.");
      }
      setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load agent accounts.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleAccount(account: AgentAccount) {
    setSavingAccountId(account.account_id);
    setError(null);
    try {
      const response = await fetch(AGENT_TOGGLE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          account_id: account.account_id,
          enabled: !account.agent_enabled,
        }),
      });
      const data = (await response.json()) as AgentAccountsResponse;
      if (!response.ok) {
        throw new Error(data.error || "Could not update agent account.");
      }
      setAccounts(Array.isArray(data.accounts) ? data.accounts : accounts);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update agent account.");
    } finally {
      setSavingAccountId(null);
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Local Worker</p>
        <h1 className="text-3xl font-semibold text-slate-950">Agent Control</h1>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-200 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span>Account</span>
          <span>Agent</span>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-500">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-500">No configured accounts found.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {accounts.map((account) => {
              const isSaving = savingAccountId === account.account_id;
              return (
                <div
                  key={account.account_id}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {account.threads_profile_picture_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={account.threads_profile_picture_url}
                        alt=""
                        className="h-11 w-11 rounded-full"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                        {account.label.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{account.label}</p>
                      <p className="truncate text-sm text-slate-500">
                        @{account.username || account.account_id}
                      </p>
                      <p className="truncate text-xs text-slate-400">{account.threads_user_id}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void toggleAccount(account)}
                    disabled={isSaving}
                    className={[
                      "h-9 min-w-28 rounded-lg px-4 text-sm font-semibold transition",
                      account.agent_enabled
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-slate-200 text-slate-800 hover:bg-slate-300",
                      isSaving ? "cursor-not-allowed opacity-70" : "",
                    ].join(" ")}
                  >
                    {isSaving ? "Saving..." : account.agent_enabled ? "On" : "Off"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
