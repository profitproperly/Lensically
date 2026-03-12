"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { resetPassword, validateResetPasswordToken } from "../../lib/authClient"
import { toUserFacingAuthError } from "../../lib/authErrorMessage"

type ResetTokenStatus = "checking" | "ready" | "invalid"

export default function ResetPasswordPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")?.trim() ?? ""
  const [tokenStatus, setTokenStatus] = useState<ResetTokenStatus>(token ? "checking" : "invalid")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setTokenStatus("invalid")
      setError("Reset link is missing or invalid.")
      return
    }

    let cancelled = false

    async function validateToken() {
      setTokenStatus("checking")
      setError("")
      setSuccessMessage("")

      try {
        const result = await validateResetPasswordToken(token)
        if (cancelled) {
          return
        }

        if (result?.success) {
          setTokenStatus("ready")
          return
        }

        setTokenStatus("invalid")
        setError(result?.error || "Reset link is invalid or expired.")
      } catch (err) {
        if (cancelled) {
          return
        }

        setTokenStatus("invalid")
        setError(toUserFacingAuthError(err, "Reset link is invalid or expired."))
      }
    }

    void validateToken()

    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!successMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      router.push("/login?reset=success")
    }, 1500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [router, successMessage])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setError("")
    setSuccessMessage("")

    if (tokenStatus !== "ready" || !token) {
      setError("Reset link is invalid or expired.")
      return
    }

    if (!password || !confirmPassword) {
      setError("Password and confirmation are required.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setSubmitting(true)

    try {
      const result = await resetPassword(token, password)
      if (result?.success === false || result?.error) {
        setError(result.error || "Password reset failed.")
        setSubmitting(false)
        return
      }

      setSuccessMessage(result?.message || "Password reset successfully.")
      setPassword("")
      setConfirmPassword("")
    } catch (err) {
      setError(toUserFacingAuthError(err, "Password reset failed. Please try again."))
    } finally {
      setSubmitting(false)
    }
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
            Choose a new password
          </h1>

          <p className="text-sm text-center text-gray-600">
            {tokenStatus === "invalid"
              ? "This reset link is invalid or has expired. Request a new password reset email to continue."
              : "Enter and confirm your new password to finish resetting your account."}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {(error || successMessage) && (
              <p className={`text-sm text-center ${error ? "text-red-500" : "text-green-700"}`}>
                {error || (successMessage ? `${successMessage} Redirecting to login...` : "")}
              </p>
            )}

            {tokenStatus === "checking" && (
              <p className="text-sm text-center text-gray-600">
                Validating reset link...
              </p>
            )}

            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={tokenStatus !== "ready" || Boolean(successMessage)}
              className="w-full border border-gray-300 p-2 rounded-lg text-black bg-white placeholder-gray-400 disabled:opacity-60"
            />

            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={tokenStatus !== "ready" || Boolean(successMessage)}
              className="w-full border border-gray-300 p-2 rounded-lg text-black bg-white placeholder-gray-400 disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={submitting || tokenStatus !== "ready" || Boolean(successMessage)}
              className="w-full bg-black text-white rounded-lg py-3 font-medium disabled:opacity-60 cursor-pointer"
            >
              {submitting ? "Resetting password..." : "Reset password"}
            </button>
          </form>

          <p className="text-sm text-center text-gray-600">
            {tokenStatus === "invalid" ? (
              <Link href="/forgot-password" className="text-black font-medium hover:underline">
                Request a new reset link
              </Link>
            ) : (
              <Link href="/login" className="text-black font-medium hover:underline">
                Back to login
              </Link>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
