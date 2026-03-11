"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { apiRequest, buildWorkerUrl } from "../../lib/apiClient"

type VerificationState = "idle" | "verifying" | "success" | "error"

function getEmailLabel(rawEmail: string | null) {
  return rawEmail?.trim() || "your inbox"
}

export default function VerifyEmailPageClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const email = searchParams.get("email")
  const [status, setStatus] = useState<VerificationState>(token ? "verifying" : "idle")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setStatus("idle")
      setMessage("")
      return
    }

    const verificationToken = token
    let cancelled = false

    async function verifyToken() {
      setStatus("verifying")
      setMessage("")

      try {
        const result = await apiRequest(
          `${buildWorkerUrl("/api/auth/verify-email")}?token=${encodeURIComponent(verificationToken)}`,
          {},
          0,
        )

        if (cancelled) {
          return
        }

        if (result?.success) {
          setStatus("success")
          setMessage("Email verified successfully.")
          return
        }

        setStatus("error")
        setMessage(result?.error || "Verification failed.")
      } catch (error) {
        if (cancelled) {
          return
        }

        setStatus("error")
        setMessage(error instanceof Error ? error.message : "Verification failed.")
      }
    }

    void verifyToken()

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center px-6">
      <div className="w-full max-w-[460px] border border-gray-200 rounded-xl p-8 shadow-sm flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-center text-black">
          Verify your email
        </h1>

        {!token && (
          <>
            <p className="text-sm text-center text-gray-700">
              If the email address is eligible, check {getEmailLabel(email)} for a verification email before continuing.
            </p>
            <p className="text-sm text-center text-gray-500">
              After you verify your email, return here and log in.
            </p>
          </>
        )}

        {status === "verifying" && (
          <p className="text-sm text-center text-gray-700">
            Verifying your email...
          </p>
        )}

        {status === "success" && (
          <p className="text-sm text-center text-green-700">
            {message}
          </p>
        )}

        {status === "error" && (
          <p className="text-sm text-center text-red-500">
            {message}
          </p>
        )}

        <Link
          href="/login"
          className="w-full bg-black text-white rounded-lg py-3 font-medium text-center"
        >
          Log in
        </Link>
      </div>
    </div>
  )
}
