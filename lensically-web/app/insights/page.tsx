type ThreadsPost = {
  id?: string;
  text?: string;
  timestamp?: string;
  username?: string;
  permalink?: string;
};

type SearchResponse = {
  data?: ThreadsPost[];
};

async function getPosts(): Promise<ThreadsPost[] | null> {
  try {
    const res = await fetch(
      "https://lensically-worker.lensically.workers.dev/api/threads/posts",
      { cache: "no-store" },
    );

    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as SearchResponse;
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return null;
  }
}

export default async function InsightsPage() {
  const posts = await getPosts();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">Insights</h1>

      {!posts ? (
        <p className="text-sm text-red-600">Unable to load posts.</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <article
              key={post.id ?? post.permalink ?? `${post.username}-${post.timestamp}`}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-900">
                {post.text || "No text content."}
              </p>
              <p className="mt-3 text-xs text-slate-600">
                @{post.username || "unknown"} • {post.timestamp || "unknown time"}
              </p>
              {post.permalink ? (
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-medium text-blue-700 hover:text-blue-800"
                >
                  View on Threads
                </a>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
