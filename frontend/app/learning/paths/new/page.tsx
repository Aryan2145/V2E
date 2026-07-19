'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** The old multi-step create page is replaced by the one-screen builder. */
export default function NewPathRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/learning/paths/builder') }, [router])
  return null
}
