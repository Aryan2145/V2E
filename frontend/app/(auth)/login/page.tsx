'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function LoginPage() {
  const { login, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    const dest = user.isSuperAdmin ? '/super-admin/organizations' : '/dashboard'
    router.replace(dest)
  }, [user, router])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }

    setIsLoading(true)
    try {
      await login(email.trim(), password)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Invalid email or password. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  // Already authenticated (e.g. navigated here mid-redirect) — show a spinner,
  // never the login form, so it doesn't flash before the redirect lands.
  if (user) {
    return (
      <div className="w-full max-w-[420px] flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-8">
        <div className="mb-8 text-center">
          <span className="text-[28px] font-bold text-[#0F172A] tracking-tight">
            V2E
          </span>
          <p className="mt-1 text-sm text-[#475569]">
            Sign in to your workspace
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-[8px] border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-sm text-[#DC2626]"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <Input
            id="email"
            name="email"
            label="Email address"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="email"
          />

          <Input
            id="password"
            name="password"
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            disabled={isLoading}
            className="w-full mt-1"
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm">
          <a href="/forgot-password" className="font-medium text-[#2563EB] hover:underline">
            Forgot your password?
          </a>
        </p>
      </div>
    </div>
  )
}
