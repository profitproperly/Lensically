"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { forgotPassword } from "../../lib/authClient"
import { useAuth } from "../../lib/AuthProvider"
import { toUserFacingAuthError } from "../../lib/authErrorMessage"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard")
    }
  }, [loading, router, user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setSubmitting(true)
    setError("")
    setSuccessMessage("")

    try {
      const result = await forgotPassword(email)
      if (result?.success === false || result?.error) {
        setError(result.error || "Could not send reset email.")
        setSubmitting(false)
        return
      }

      setSuccessMessage(
        result?.message || "If an account exists, a reset email has been sent.",
      )
      setEmail("")
    } catch (err) {
      setError(toUserFacingAuthError(err, "Could not send reset email. Please try again."))
    } finally {
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
    <div className="min-h-screen bg-white text-black flex items-center justify-center px-6">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6">
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

        <div className="w-full border border-gray-200 rounded-xl p-8 shadow-sm flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-center text-black">
            Reset your password
          </h1>

          <p className="text-sm text-center text-gray-600">
            Enter the email address tied to your account and we&apos;ll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {(error || successMessage) && (
              <p className={`text-sm text-center ${error ? "text-red-500" : "text-green-700"}`}>
                {error || successMessage}
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

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-black text-white rounded-lg py-3 font-medium disabled:opacity-60 cursor-pointer"
            >
              {submitting ? "Sending reset link..." : "Send reset link"}
            </button>
          </form>

          <p className="text-sm text-center text-gray-600">
            Remembered your password?{" "}
            <Link href="/login" className="text-black font-medium hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
