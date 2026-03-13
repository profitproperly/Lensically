"use client";

import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { buildWorkerUrl } from "@/lib/apiClient";

type SearchMode = "KEYWORD" | "TAG";
type SearchType = "TOP" | "RECENT";

type NormalizedSearchPost = {
  id: string | null;
  text: string | null;
  username: string | null;
  timestamp: string | null;
  permalink: string | null;
  media_type: string | null;
  has_replies: boolean;
  is_quote_post: boolean;
  is_reply: boolean;
};

type ThreadsSearchResponse = {
  posts?: NormalizedSearchPost[];
  error?: string;
  code?: string;
};

const THREADS_SEARCH_URL = buildWorkerUrl("/api/threads/search");
const DEFAULT_LIMIT = "25";

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Unknown time";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export default function SearchPage() {
  const { user, loading } = useAuth();
  const appUserId = user?.id?.trim() ?? "";

  const [keyword, setKeyword] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("KEYWORD");
  const [searchType, setSearchType] = useState<SearchType>("TOP");
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [results, setResults] = useState<NormalizedSearchPost[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [preparedRequest, setPreparedRequest] = useState<Record<string, string> | null>(null);

  const trimmedKeyword = keyword.trim();
  const canSubmit = Boolean(appUserId && trimmedKeyword && !isSearching);

  const requestPreview = useMemo(() => {
    if (!preparedRequest) {
      return null;
    }
    return JSON.stringify(preparedRequest, null, 2);
  }, [preparedRequest]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!appUserId) {
      setErrorMessage("You must be logged in to run a search.");
      return;
    }

    const query = keyword.trim();
    if (!query) {
      setErrorMessage("Please enter a keyword to search.");
      return;
    }

    const payload = {
      app_user_id: appUserId,
      q: query,
      search_mode: searchMode,
      search_type: searchType,
      limit: DEFAULT_LIMIT,
    };
    setPreparedRequest(payload);

    const params = new URLSearchParams(payload);

    setHasSearched(true);
    setResults([]);
    setIsSearching(true);
    try {
      const response = await fetch(`${THREADS_SEARCH_URL}?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as ThreadsSearchResponse | null;

      if (!response.ok) {
        setResults([]);
        setErrorMessage(data?.error || "Keyword search could not be completed.");
        return;
      }

      const posts = Array.isArray(data?.posts) ? data.posts : [];
      setResults(posts);
      setSuccessMessage(`Search completed. ${posts.length} post${posts.length === 1 ? "" : "s"} found.`);
    } catch {
      setResults([]);
      setErrorMessage("Keyword search failed due to a network error.");
    } finally {
      setIsSearching(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-700">Loading search interface...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">Keyword Search</h1>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-2">
            <label htmlFor="keyword-input" className="block text-sm font-medium text-slate-800">
              Keyword
            </label>
            <input
              id="keyword-input"
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Enter a keyword or phrase"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              disabled={isSearching}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="search-mode" className="block text-sm font-medium text-slate-800">
                Search Mode
              </label>
              <select
                id="search-mode"
                value={searchMode}
                onChange={(event) => setSearchMode(event.target.value as SearchMode)}
                className="w-full cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                disabled={isSearching}
              >
                <option value="KEYWORD">Keyword</option>
                <option value="TAG">Tag</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="search-type" className="block text-sm font-medium text-slate-800">
                Search Type
              </label>
              <select
                id="search-type"
                value={searchType}
                onChange={(event) => setSearchType(event.target.value as SearchType)}
                className="w-full cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                disabled={isSearching}
              >
                <option value="TOP">Top</option>
                <option value="RECENT">Recent</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="inline-flex cursor-pointer items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canSubmit}
            >
              {isSearching ? "Searching..." : "Run Search"}
            </button>
            {!appUserId ? (
              <p className="text-sm text-amber-700">Sign in to run keyword searches.</p>
            ) : null}
          </div>
        </form>
      </section>

      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {requestPreview ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Prepared Request</h2>
          <pre className="mt-3 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            {requestPreview}
          </pre>
        </section>
      ) : null}

      {results.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Search Results</h2>
          <ul className="mt-3 space-y-3">
            {results.map((post, index) => (
              <li key={post.id ?? `search-post-${index}`} className="rounded-md border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {post.username ? `@${post.username}` : "Unknown user"}
                  </p>
                  <p className="text-xs text-slate-500">{formatTimestamp(post.timestamp)}</p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {post.text ?? "No text content."}
                </p>
                {post.permalink ? (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex cursor-pointer text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    Open on Threads
                  </a>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">Permalink unavailable.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasSearched && !isSearching && !errorMessage && results.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">No posts matched this search.</p>
        </section>
      ) : null}
    </div>
  );
}
