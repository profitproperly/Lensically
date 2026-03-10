import { Suspense } from "react"
import VerifyEmailPageClient from "./VerifyEmailPageClient"

function VerifyEmailPageFallback() {
  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center px-6">
      <div className="w-full max-w-[460px] border border-gray-200 rounded-xl p-8 shadow-sm flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-center text-black">
          Verify your email
        </h1>
        <p className="text-sm text-center text-gray-700">
          Loading...
        </p>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailPageFallback />}>
      <VerifyEmailPageClient />
    </Suspense>
  )
}
