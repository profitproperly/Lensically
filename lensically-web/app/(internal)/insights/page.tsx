import PostsList from "./PostsList";

export const runtime = "edge";

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">Insights</h1>
      <PostsList />
    </div>
  );
}
