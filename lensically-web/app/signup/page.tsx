"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { register } from "../../lib/authClient"
import { useAuth } from "../../lib/AuthProvider"
import { toUserFacingAuthError } from "../../lib/authErrorMessage"
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
      setError("Passwords do not match.")
      setSubmitting(false)
      return
    }

    try {
      const res = await register(email, password)

      if (res?.success === false || res?.error) {
        setError(res.error || "Signup failed.")
        setSubmitting(false)
        return
      }

      const normalizedEmail = email.trim().toLowerCase()
      router.push(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`)
    } catch (err) {
      setError(toUserFacingAuthError(err, "Signup failed. Please try again."))
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
            <p className="text-red-500 text-sm text-center">{error}</p>
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
              window.location.href = GITHUB_START_URL
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

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600">
            If you sign up with Google, Lensically uses your Google account data only for
            authentication, account creation, and account access within the application. Lensically
            stores the OAuth account linkage needed to sign you in. See{" "}
            <Link href="/privacy" className="font-medium text-slate-900 underline">
              Privacy Policy
            </Link>
            .
          </div>
        </form>

          <p className="text-sm text-center text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="text-black font-medium hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
