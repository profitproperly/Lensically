"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { login } from "../../lib/authClient"
import { useAuth } from "../../lib/AuthProvider"

export default function LoginPage() {
  const router = useRouter()
  const { user, loading, refreshUser } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard")
    }
  }, [user, loading, router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    setSubmitting(true)
    setError("")

    try {
      const res = await login(email, password)

      if (res?.success === false || res?.error) {
        setError(res.error || "Login failed")
        setSubmitting(false)
        return
      }

      await refreshUser()
      router.push("/dashboard")
    } catch {
      setError("Login failed")
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
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-[420px] border border-gray-200 rounded-xl p-8 shadow-sm flex flex-col gap-4">

        <h1 className="text-xl font-semibold text-center text-black">
          Sign in to Lensically
        </h1>

        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 p-2 rounded-lg"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 p-2 rounded-lg"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-black text-white rounded-lg py-3 font-medium disabled:opacity-60"
          >
            {submitting ? "Logging in..." : "Login with Email"}
          </button>
        </form>

      </div>
    </div>
  )
}
