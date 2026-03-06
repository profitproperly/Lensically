type ThreadsPost = {
  id?: string;
  text?: string;
  timestamp?: string;
  username?: string;
  permalink?: string;
};

type SearchResponse = {
  data?: ThreadsPost[];
  error?: string;
};

export const runtime = "edge";
const CONNECT_THREADS_URL =
  "https://lensically-worker.lensically.workers.dev/api/auth/threads/start";

type PostsResult = {
  posts: ThreadsPost[] | null;
  needsConnection: boolean;
};

async function getPosts(): Promise<PostsResult> {
  try {
    const res = await fetch(
      "https://lensically-worker.lensically.workers.dev/api/threads/posts",
      { cache: "no-store" },
    );

    const json = (await res.json()) as SearchResponse;

    if (!res.ok) {
      const errorMessage = (json.error || "").toLowerCase();
      return {
        posts: null,
        needsConnection: errorMessage.includes("account not connected"),
      };
    }

    return {
      posts: Array.isArray(json.data) ? json.data : [],
      needsConnection: false,
    };
  } catch {
    return { posts: null, needsConnection: false };
  }
}

export default async function InsightsPage() {
  const { posts, needsConnection } = await getPosts();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">Insights</h1>

      {!posts && needsConnection ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">
            Connect your Threads account to view Insights.
          </p>
          <a
            href={CONNECT_THREADS_URL}
            className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Connect Threads
          </a>
        </div>
      ) : !posts ? (
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
