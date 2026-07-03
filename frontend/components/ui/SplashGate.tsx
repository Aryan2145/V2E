'use client'

import { useAuth } from '@/lib/auth/context'
import BootSplash from './BootSplash'

/**
 * Holds the branded boot splash over the app until the initial session
 * restore/refresh has resolved (AuthProvider.isLoading). Prevents the cold-load
 * flicker where a logged-in user briefly sees a blank page or the login form
 * before their session is confirmed.
 */
export default function SplashGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth()
  if (isLoading) return <BootSplash />
  return <>{children}</>
}
