'use client'

import React from 'react'
import GovernanceSidebar from '@/components/layout/GovernanceSidebar'
import { useAuth } from '@/lib/auth/context'

export default function GovernanceLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  // Test orgs show the fixed TimeTravelBar (clock) pinned to the viewport bottom.
  // This section has its own overflow-auto scroll area, so reserve space here or
  // the bottom of the page (e.g. the daily-update submit button) hides behind it.
  const hasClockBar = !!user?.isTestOrg

  return (
    <div className="flex gap-0 min-h-[calc(100vh-56px)] -mx-4 sm:-mx-6 lg:-mx-8 -my-6 lg:-my-8">
      <GovernanceSidebar />
      <main
        className={`flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 overflow-auto ${
          hasClockBar ? 'pb-44 sm:pb-32' : ''
        }`}
      >
        {children}
      </main>
    </div>
  )
}
