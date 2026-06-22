'use client'

import { useState } from 'react'
import ECSSidebar from '@/components/layout/ECSSidebar'

export default function ECSLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  // Mirror the Governance/Tasks pattern: cancel the dashboard layout's padding
  // so the dark sidebar goes full-bleed, then reapply the standard content
  // padding inside <main>. (No nested MainLayout — the dashboard root supplies it.)
  return (
    <div className="flex gap-0 min-h-[calc(100vh-56px)] -mx-4 sm:-mx-6 lg:-mx-8 -my-6 lg:-my-8">
      <ECSSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
