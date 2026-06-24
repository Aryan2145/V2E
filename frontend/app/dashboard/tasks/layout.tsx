'use client'

import React from 'react'
import { useAuth } from '@/lib/auth/context'
import TaskModuleSidebar from '@/components/layout/TaskModuleSidebar'

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  // Test orgs show the fixed TEST CLOCK bar at the bottom. This layout breaks out
  // of the dashboard padding (negative margins), so the bar reservation there
  // doesn't reach us — shrink the shell so the dark sidebar clears the bar.
  const { user } = useAuth()
  const shellMinH = user?.isTestOrg
    ? 'min-h-[calc(100vh-56px-10rem)] sm:min-h-[calc(100vh-56px-7rem)]'
    : 'min-h-[calc(100vh-56px)]'

  return (
    <div className={`flex gap-0 ${shellMinH} -mx-4 sm:-mx-6 lg:-mx-8 -my-6 lg:-my-8`}>
      <TaskModuleSidebar />
      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
