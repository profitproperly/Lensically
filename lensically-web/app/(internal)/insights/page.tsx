"use client";

import Link from "next/link";
import PostsList from "./PostsList";

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-slate-900">Insights</h1>
        <Link
          href="/post-archive"
          className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Open Post Archive
        </Link>
      </div>
      <PostsList />
    </div>
  );
}
