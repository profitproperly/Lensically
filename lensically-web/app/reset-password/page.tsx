import { Suspense } from "react"
import ResetPasswordPageClient from "./ResetPasswordPageClient"

function ResetPasswordPageFallback() {
  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center px-6">
      <div className="w-full max-w-[420px] border border-gray-200 rounded-xl p-8 shadow-sm flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-center text-black">
          Choose a new password
        </h1>
        <p className="text-sm text-center text-gray-600">
          Loading...
        </p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordPageFallback />}>
      <ResetPasswordPageClient />
    </Suspense>
  )
}
