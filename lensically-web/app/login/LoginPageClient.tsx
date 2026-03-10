"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { login } from "../../lib/authClient"
import { useAuth } from "../../lib/AuthProvider"
import { buildWorkerUrl } from "../../lib/apiClient"

const GOOGLE_START_URL = buildWorkerUrl("/api/auth/google/start")
const GITHUB_START_URL = buildWorkerUrl("/api/auth/github/start")
const DISCORD_START_URL = buildWorkerUrl("/api/auth/discord/start")
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  duplicate_email: "This email is already registered. Sign in with your password instead.",
  server_config: "Authentication is temporarily unavailable. Please try again later.",
  access_denied: "Authentication was cancelled. Please try again.",
  state_missing: "Authentication session expired. Please try again.",
  state_mismatch: "Authentication session could not be verified. Please try again.",
  token_exchange_failed: "Authentication could not be completed. Please try again.",
  account_lookup_failed: "We could not load your account details. Please try again.",
  unexpected: "OAuth sign-in failed. Please try again.",
}

function getAuthErrorMessage(errorParam: string | null) {
  return errorParam ? AUTH_ERROR_MESSAGES[errorParam] ?? "" : ""
}

export default function LoginPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading, refreshUser } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const authError = getAuthErrorMessage(searchParams.get("error"))

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard")
    }
  }, [user, loading, router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    setSubmitting(true)
    setFormError("")

    try {
      const res = await login(email, password)

      if (res?.success === false || res?.error) {
        setFormError(res.error || "Login failed")
        setSubmitting(false)
        return
      }

      await refreshUser()
      router.push("/dashboard")
    } catch (err) {
      if (err instanceof Error && err.message.includes("Failed to fetch")) {
        setFormError("Unable to connect. Please try again.")
      } else {
        setFormError(err instanceof Error ? err.message : "Invalid email or password.")
      }
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/lensically-logo-white-with-black-bg.png"
            alt="Lensically logo"
            width={64}
            height={64}
            className="h-16 w-16 rounded-md"
            priority
          />
          <span className="text-xl font-semibold tracking-tight">Lensically</span>
        </Link>

        <div className="w-[420px] border border-gray-200 rounded-xl p-8 shadow-sm flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-center text-black">
            Sign in to Lensically
          </h1>

          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            {(authError || formError) && (
              <p className="text-red-500 text-sm text-center">{authError || formError}</p>
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 p-2 rounded-lg text-black bg-white placeholder-gray-400"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 p-2 rounded-lg text-black bg-white placeholder-gray-400"
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-black text-white rounded-lg py-3 font-medium disabled:opacity-60 cursor-pointer"
            >
              {submitting ? "Logging in..." : "Login"}
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = GOOGLE_START_URL
              }}
              className="w-full border border-gray-300 rounded-lg py-3 font-medium text-black hover:bg-gray-50 cursor-pointer"
            >
              Continue with Google
            </button>

            <button
              type="button"
              onClick={() => {
                const isLocal =
                  window.location.hostname === "localhost"
                  || window.location.hostname === "127.0.0.1"
                const githubStartUrl = isLocal
                  ? `${GITHUB_START_URL}?env=dev`
                  : GITHUB_START_URL
                window.location.href = githubStartUrl
              }}
              className="w-full border border-gray-300 rounded-lg py-3 font-medium text-black hover:bg-gray-50 cursor-pointer"
            >
              Continue with GitHub
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = DISCORD_START_URL
              }}
              className="w-full border border-gray-300 rounded-lg py-3 font-medium text-black hover:bg-gray-50 cursor-pointer"
            >
              Continue with Discord
            </button>
          </form>

          <p className="text-sm text-center text-gray-600">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-black font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
