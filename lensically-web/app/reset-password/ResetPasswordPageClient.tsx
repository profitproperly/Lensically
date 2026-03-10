"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { resetPassword } from "../../lib/authClient"

export default function ResetPasswordPageClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")?.trim() ?? ""
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setError("")
    setSuccessMessage("")

    if (!token) {
      setError("Reset link is missing or invalid.")
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
      setError(err instanceof Error ? err.message : "Password reset failed.")
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
            Enter and confirm your new password to finish resetting your account.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {(error || successMessage) && (
              <p className={`text-sm text-center ${error ? "text-red-500" : "text-green-700"}`}>
                {error || successMessage}
              </p>
            )}

            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={!token || Boolean(successMessage)}
              className="w-full border border-gray-300 p-2 rounded-lg text-black bg-white placeholder-gray-400 disabled:opacity-60"
            />

            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={!token || Boolean(successMessage)}
              className="w-full border border-gray-300 p-2 rounded-lg text-black bg-white placeholder-gray-400 disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={submitting || !token || Boolean(successMessage)}
              className="w-full bg-black text-white rounded-lg py-3 font-medium disabled:opacity-60 cursor-pointer"
            >
              {submitting ? "Resetting password..." : "Reset password"}
            </button>
          </form>

          <p className="text-sm text-center text-gray-600">
            <Link href="/login" className="text-black font-medium hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
