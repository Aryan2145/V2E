'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// The profile now lives at a single universal, ungated location reachable from the
// avatar menu. This ESS route redirects there so there's one canonical page.
export default function EssProfileRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/profile')
  }, [router])
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
