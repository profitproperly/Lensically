"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { register } from "../../lib/authClient"
import { useAuth } from "../../lib/AuthProvider"
import { buildWorkerUrl } from "../../lib/apiClient"

const GOOGLE_START_URL = buildWorkerUrl("/api/auth/google/start")
const GITHUB_START_URL = buildWorkerUrl("/api/auth/github/start")
const DISCORD_START_URL = buildWorkerUrl("/api/auth/discord/start")

export default function SignupPage() {
  const router = useRouter()
  const { user, loading, refreshUser } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard")
    }
  }, [user, loading, router])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()

    setSubmitting(true)
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setSubmitting(false)
      return
    }

    try {
      const res = await register(email, password)

      if (res?.success === false || res?.error) {
        setError(res.error || "Signup failed")
        setSubmitting(false)
        return
      }

      await refreshUser()
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed")
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
            Create your Lensically account
          </h1>

        <form onSubmit={handleSignup} className="flex flex-col gap-3">
          {error && (
            <p className="text-red-500 text-sm text-center">
              {error.toLowerCase().includes("already exists") ? (
                <>
                  An account with this email already exists.{" "}
                  <Link href="/login" className="underline">
                    Log in
                  </Link>
                  {" "}instead.
                </>
              ) : (
                error
              )}
            </p>
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

          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full border border-gray-300 p-2 rounded-lg text-black bg-white placeholder-gray-400"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-black text-white rounded-lg py-3 font-medium disabled:opacity-60 cursor-pointer"
          >
            {submitting ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-sm text-center text-gray-500">──────── OR ────────</p>

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
                window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1"
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
            Already have an account?{" "}
            <Link href="/login" className="text-black font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
