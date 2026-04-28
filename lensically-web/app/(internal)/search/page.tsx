"use client";

import { FormEvent, useEffect, useState } from "react";
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

type KeywordSearchCacheEntry = {
  id: string;
  query: string;
  search_mode: SearchMode;
  search_type: SearchType;
  timestamp: string;
  results: NormalizedSearchPost[];
  favorite: boolean;
};

const THREADS_SEARCH_URL = buildWorkerUrl("/api/threads/search");
const DEFAULT_LIMIT = "25";
const KEYWORD_SEARCH_CACHE_STORAGE_KEY = "lensically_keyword_search_cache";
const MAX_CACHED_SEARCHES = 25;
const MAX_FAVORITES = 10;

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

function toIsoFromLocalDateTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function parseKeywordSearchCache(raw: string | null): KeywordSearchCacheEntry[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item): KeywordSearchCacheEntry => {
        const candidate = item as Partial<KeywordSearchCacheEntry>;
        const normalizedSearchMode: SearchMode = candidate.search_mode === "TAG" ? "TAG" : "KEYWORD";
        const normalizedSearchType: SearchType = candidate.search_type === "RECENT" ? "RECENT" : "TOP";
        return {
          id: typeof candidate.id === "string" ? candidate.id : crypto.randomUUID(),
          query: typeof candidate.query === "string" ? candidate.query : "",
          search_mode: normalizedSearchMode,
          search_type: normalizedSearchType,
          timestamp: typeof candidate.timestamp === "string" ? candidate.timestamp : new Date().toISOString(),
          results: Array.isArray(candidate.results) ? candidate.results as NormalizedSearchPost[] : [],
          favorite: candidate.favorite === true,
        };
      })
      .filter((item) => item.query.trim().length > 0);
  } catch {
    return [];
  }
}

function persistKeywordSearchCache(entries: KeywordSearchCacheEntry[]): void {
  try {
    sessionStorage.setItem(KEYWORD_SEARCH_CACHE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage write failures for degraded client environments.
  }
}

function enforceCacheSize(entries: KeywordSearchCacheEntry[]): KeywordSearchCacheEntry[] {
  const working = [...entries];
  while (working.length > MAX_CACHED_SEARCHES) {
    const removeIndex = working.map((entry) => entry.favorite).lastIndexOf(false);
    if (removeIndex === -1) {
      break;
    }
    working.splice(removeIndex, 1);
  }
  return working;
}

export default function SearchPage() {
  const { user, loading } = useAuth();
  const appUserId = user?.id?.trim() ?? "";

  const [keyword, setKeyword] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("KEYWORD");
  const [searchType, setSearchType] = useState<SearchType>("TOP");
  const [authorUsername, setAuthorUsername] = useState("");
  const [startTimestamp, setStartTimestamp] = useState("");
  const [endTimestamp, setEndTimestamp] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [results, setResults] = useState<NormalizedSearchPost[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [cacheEntries, setCacheEntries] = useState<KeywordSearchCacheEntry[]>([]);
  const [isCacheOpen, setIsCacheOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const parsed = parseKeywordSearchCache(sessionStorage.getItem(KEYWORD_SEARCH_CACHE_STORAGE_KEY));
    setCacheEntries(enforceCacheSize(parsed));
  }, []);

  function upsertCacheEntry(query: string, mode: SearchMode, type: SearchType, posts: NormalizedSearchPost[]): void {
    setCacheEntries((previousEntries) => {
      const existingIndex = previousEntries.findIndex(
        (entry) => entry.query === query && entry.search_mode === mode && entry.search_type === type,
      );
      const existingFavorite = existingIndex >= 0 ? previousEntries[existingIndex]?.favorite === true : false;
      const nextEntry: KeywordSearchCacheEntry = {
        id: existingIndex >= 0 ? previousEntries[existingIndex].id : crypto.randomUUID(),
        query,
        search_mode: mode,
        search_type: type,
        timestamp: new Date().toISOString(),
        results: posts,
        favorite: existingFavorite,
      };
      const withoutDuplicate = previousEntries.filter((_, index) => index !== existingIndex);
      const nextEntries = enforceCacheSize([nextEntry, ...withoutDuplicate]);
      persistKeywordSearchCache(nextEntries);
      return nextEntries;
    });
  }

  function handleLoadCachedSearch(entry: KeywordSearchCacheEntry): void {
    setKeyword(entry.query);
    setSearchMode(entry.search_mode);
    setSearchType(entry.search_type);
    setAuthorUsername("");
    setStartTimestamp("");
    setEndTimestamp("");
    setErrorMessage("");
    setHasSearched(true);
    setResults(entry.results);
    setSuccessMessage(
      `Loaded cached search from ${formatTimestamp(entry.timestamp)}. ${entry.results.length} result${entry.results.length === 1 ? "" : "s"} shown.`,
    );
    setIsCacheOpen(false);
  }

  function handleDeleteCachedSearch(entryId: string): void {
    setCacheEntries((previousEntries) => {
      const nextEntries = previousEntries.filter((entry) => entry.id !== entryId);
      persistKeywordSearchCache(nextEntries);
      return nextEntries;
    });
  }

  function handleToggleFavorite(entryId: string): void {
    setCacheEntries((previousEntries) => {
      const favoriteCount = previousEntries.filter((entry) => entry.favorite).length;
      const targetEntry = previousEntries.find((entry) => entry.id === entryId);
      if (!targetEntry) {
        return previousEntries;
      }

      if (!targetEntry.favorite && favoriteCount >= MAX_FAVORITES) {
        setErrorMessage("Maximum of 10 favorites allowed.");
        return previousEntries;
      }

      setErrorMessage("");
      const nextEntries = previousEntries.map((entry) => (
        entry.id === entryId
          ? { ...entry, favorite: !entry.favorite }
          : entry
      ));
      persistKeywordSearchCache(nextEntries);
      return nextEntries;
    });
  }

  const trimmedKeyword = keyword.trim();
  const canSubmit = Boolean(appUserId && trimmedKeyword && !isSearching);
  const favoriteEntries = cacheEntries.filter((entry) => entry.favorite);
  const recentEntries = cacheEntries.filter((entry) => !entry.favorite);

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

    const payload: Record<string, string> = {
      app_user_id: appUserId,
      q: query,
      search_mode: searchMode,
      search_type: searchType,
      limit: DEFAULT_LIMIT,
    };

    const normalizedAuthorUsername = authorUsername.trim().replace(/^@+/, "");
    const normalizedStartTimestamp = startTimestamp.trim();
    const normalizedEndTimestamp = endTimestamp.trim();

    const startIso = normalizedStartTimestamp
      ? toIsoFromLocalDateTime(normalizedStartTimestamp)
      : null;
    const endIso = normalizedEndTimestamp
      ? toIsoFromLocalDateTime(normalizedEndTimestamp)
      : null;

    if (normalizedStartTimestamp && !startIso) {
      setErrorMessage("Start timestamp is invalid.");
      return;
    }

    if (normalizedEndTimestamp && !endIso) {
      setErrorMessage("End timestamp is invalid.");
      return;
    }

    if (startIso && endIso && new Date(startIso).getTime() > new Date(endIso).getTime()) {
      setErrorMessage("Start timestamp must be before end timestamp.");
      return;
    }

    if (normalizedAuthorUsername) {
      payload.author_username = normalizedAuthorUsername;
    }
    if (startIso) {
      payload.start_timestamp = startIso;
    }
    if (endIso) {
      payload.end_timestamp = endIso;
    }

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
      upsertCacheEntry(query, searchMode, searchType, posts);
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
            <div className="relative">
              <input
                id="keyword-input"
                type="text"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Enter a keyword or phrase"
                className="w-full rounded-md border border-slate-300 px-3 py-2 pr-36 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                disabled={isSearching}
              />
              <button
                type="button"
                onClick={() => setIsCacheOpen((current) => !current)}
                className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSearching || cacheEntries.length === 0}
                aria-expanded={isCacheOpen}
                aria-controls="keyword-search-history"
              >
                Search History
              </button>
              {isCacheOpen ? (
                <div
                  id="keyword-search-history"
                  className="absolute z-20 mt-2 max-h-96 w-full overflow-auto rounded-md border border-slate-200 bg-white p-3 shadow-lg"
                >
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Favorites
                      </p>
                      {favoriteEntries.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-500">No favorites yet.</p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {favoriteEntries.map((entry) => (
                            <li key={entry.id} className="rounded-md border border-slate-200 p-2">
                              <button
                                type="button"
                                onClick={() => handleLoadCachedSearch(entry)}
                                className="w-full cursor-pointer text-left"
                              >
                                <p className="text-sm font-medium text-slate-900">{entry.query}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {entry.search_mode} • {entry.search_type} • {formatTimestamp(entry.timestamp)}
                                </p>
                              </button>
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleFavorite(entry.id)}
                                  className="inline-flex cursor-pointer rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                                >
                                  Unfavorite
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCachedSearch(entry.id)}
                                  className="inline-flex cursor-pointer rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Recent Searches
                      </p>
                      {recentEntries.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-500">No recent searches yet.</p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {recentEntries.map((entry) => (
                            <li key={entry.id} className="rounded-md border border-slate-200 p-2">
                              <button
                                type="button"
                                onClick={() => handleLoadCachedSearch(entry)}
                                className="w-full cursor-pointer text-left"
                              >
                                <p className="text-sm font-medium text-slate-900">{entry.query}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {entry.search_mode} • {entry.search_type} • {formatTimestamp(entry.timestamp)}
                                </p>
                              </button>
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleFavorite(entry.id)}
                                  className="inline-flex cursor-pointer rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                                >
                                  Favorite
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCachedSearch(entry.id)}
                                  className="inline-flex cursor-pointer rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
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

          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Advanced Filters (Optional)</p>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="author-username" className="block text-sm font-medium text-slate-800">
                  Author Username
                </label>
                <input
                  id="author-username"
                  type="text"
                  value={authorUsername}
                  onChange={(event) => setAuthorUsername(event.target.value)}
                  placeholder="@username"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  disabled={isSearching}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="start-timestamp" className="block text-sm font-medium text-slate-800">
                  Start Timestamp
                </label>
                <input
                  id="start-timestamp"
                  type="datetime-local"
                  value={startTimestamp}
                  onChange={(event) => setStartTimestamp(event.target.value)}
                  className="w-full cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  disabled={isSearching}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="end-timestamp" className="block text-sm font-medium text-slate-800">
                  End Timestamp
                </label>
                <input
                  id="end-timestamp"
                  type="datetime-local"
                  value={endTimestamp}
                  onChange={(event) => setEndTimestamp(event.target.value)}
                  className="w-full cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  disabled={isSearching}
                />
              </div>
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

      {isSearching ? (
        <section
          aria-live="polite"
          className="rounded-xl border border-sky-200 bg-sky-50 p-6 shadow-sm"
        >
          <p className="text-sm font-medium text-sky-900">Searching Threads posts...</p>
          <p className="mt-1 text-sm text-sky-700">Results will appear here when the search completes.</p>
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
          <p className="text-sm font-medium text-slate-900">No results found.</p>
          <p className="mt-1 text-sm text-slate-700">
            Try a different keyword, search type, or adjust your optional filters.
          </p>
        </section>
      ) : null}
    </div>
  );
}
