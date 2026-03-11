"use client";

import { useSearchParams } from "next/navigation";

export default function HomeAccountDeletedBanner() {
  const searchParams = useSearchParams();
  const accountDeleted = searchParams.get("accountDeleted") === "1";

  if (!accountDeleted) {
    return null;
  }

  return (
    <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-900">
      Your account has been permanently deleted and associated application data has been removed.
    </div>
  );
}
