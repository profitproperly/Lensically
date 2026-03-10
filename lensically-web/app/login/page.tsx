import { Suspense } from "react"
import LoginPageClient from "./LoginPageClient"

function LoginPageFallback() {
  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-[420px] border border-gray-200 rounded-xl p-8 shadow-sm flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-center text-black">
            Sign in to Lensically
          </h1>
          <div className="flex items-center justify-center py-8 text-sm text-gray-500">
            Loading...
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageClient />
    </Suspense>
  )
}
