"use client";

import { useEffect, useState } from "react";

type ThreadsPost = {
  id?: string;
  text?: string;
  timestamp?: string;
  username?: string;
  permalink?: string;
};

type PostsResponse = {
  posts?: ThreadsPost[];
  next_cursor?: string | null;
  has_more?: boolean;
  error?: string;
};

const CONNECT_THREADS_URL =
  "https://lensically-worker.lensically.workers.dev/api/auth/threads/start";

export default function PostsList() {
  const [posts, setPosts] = useState<ThreadsPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorDepth, setCursorDepth] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [needsConnection, setNeedsConnection] = useState(false);
  const [hasError, setHasError] = useState(false);

  const loadPosts = async () => {
    try {
      setLoadingInitial(true);
      const res = await fetch(
        "https://lensically-worker.lensically.workers.dev/api/threads/posts"
      );
      const data = (await res.json()) as PostsResponse;

      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setCursor(data.next_cursor || null);
      setHasMore(Boolean(data.has_more));
      setCursorDepth(1);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setLoadingInitial(false);
    }
  };

  const loadMore = async () => {
    if (!cursor || !hasMore) return;

    setLoadingMore(true);

    const nextDepth = cursorDepth + 1;

    const res = await fetch(
      `https://lensically-worker.lensically.workers.dev/api/threads/posts?cursor=${encodeURIComponent(cursor)}&cursor_depth=${nextDepth}`
    );

    const data = (await res.json()) as PostsResponse;

    setPosts(prev => [...prev, ...(data.posts || [])]);
    setCursor(data.next_cursor || null);
    setHasMore(Boolean(data.has_more));
    setCursorDepth(nextDepth);

    setLoadingMore(false);
  };

  useEffect(() => {
    loadPosts();
  }, []);

  if (loadingInitial) return <p>Loading posts...</p>;
  if (hasError) return <p className="text-red-600">Unable to load posts.</p>;

  return (
    <div>
      <div className="space-y-4">
        {posts.map(post => (
          <article key={post.id} className="rounded-xl border p-5">
            <p>{post.text}</p>
            {post.permalink && (
              <a href={post.permalink} target="_blank">
                View on Threads
              </a>
            )}
          </article>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-6 rounded bg-black px-4 py-2 text-white"
        >
          {loadingMore ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );
}
